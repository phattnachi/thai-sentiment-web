// Thai Sentiment Analysis Web App Client
// Supports both FastAPI Backend API and 100% Client-side Browser Execution (Offline / GitHub Pages)

document.addEventListener("DOMContentLoaded", () => {
  // Theme Management
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const htmlEl = document.documentElement;
  
  function initTheme() {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      htmlEl.classList.add("dark");
      updateThemeIcon(true);
    } else {
      htmlEl.classList.remove("dark");
      updateThemeIcon(false);
    }
  }

  function updateThemeIcon(isDark) {
    const sunIcon = document.getElementById("sunIcon");
    const moonIcon = document.getElementById("moonIcon");
    if (sunIcon && moonIcon) {
      if (isDark) {
        sunIcon.classList.remove("hidden");
        moonIcon.classList.add("hidden");
      } else {
        sunIcon.classList.add("hidden");
        moonIcon.classList.remove("hidden");
      }
    }
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const isDark = htmlEl.classList.toggle("dark");
      localStorage.setItem("theme", isDark ? "dark" : "light");
      updateThemeIcon(isDark);
    });
  }

  initTheme();

  // Navigation Tabs
  const navTabs = document.querySelectorAll(".nav-tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");

  function switchTab(tabId) {
    navTabs.forEach(btn => {
      if (btn.dataset.tab === tabId) {
        btn.classList.add("active-tab", "border-indigo-600", "text-indigo-600", "dark:text-indigo-400", "dark:border-indigo-400");
        btn.classList.remove("border-transparent", "text-slate-500", "hover:text-slate-700", "dark:text-slate-400");
      } else {
        btn.classList.remove("active-tab", "border-indigo-600", "text-indigo-600", "dark:text-indigo-400", "dark:border-indigo-400");
        btn.classList.add("border-transparent", "text-slate-500", "hover:text-slate-700", "dark:text-slate-400");
      }
    });

    tabPanels.forEach(panel => {
      if (panel.id === tabId) {
        panel.classList.remove("hidden");
      } else {
        panel.classList.add("hidden");
      }
    });

    if (tabId === "metricsTab") {
      fetchModelMetrics();
    }
  }

  navTabs.forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // Client-side Machine Learning Inference Engine
  function predictInBrowser(rawText) {
    if (!rawText || !rawText.trim()) {
      return {
        text: "",
        tokens: [],
        sentiment: "Neutral",
        sentiment_th: "เป็นกลาง",
        confidence: 50,
        positive_prob: 50,
        negative_prob: 50,
        decision_score: 0,
        keywords: []
      };
    }

    const model = window.THAI_SENTIMENT_MODEL;
    if (!model || !model.features) return null;

    let text = rawText.trim();
    text = text.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ");

    const features = model.features;
    const termCounts = {};
    const matchedTerms = [];

    for (const term in features) {
      const cleanTermNoSpace = term.replace(/\s+/g, "");
      let count = 0;

      let idx = text.indexOf(term);
      while (idx !== -1) {
        count++;
        idx = text.indexOf(term, idx + 1);
      }

      if (count === 0 && cleanTermNoSpace !== term) {
        idx = text.indexOf(cleanTermNoSpace);
        while (idx !== -1) {
          count++;
          idx = text.indexOf(cleanTermNoSpace, idx + 1);
        }
      }

      if (count > 0) {
        termCounts[term] = count;
        matchedTerms.push(term);
      }
    }

    let sumSq = 0;
    const rawTfidf = {};
    for (const term in termCounts) {
      const c = termCounts[term];
      const tf = 1 + Math.log(c);
      const idf = features[term].idf;
      const val = tf * idf;
      rawTfidf[term] = val;
      sumSq += val * val;
    }

    const norm = Math.sqrt(sumSq) || 1.0;
    let decisionScore = model.intercept || 0;
    const keywordList = [];

    for (const term in rawTfidf) {
      const tfidfNorm = rawTfidf[term] / norm;
      const weight = features[term].weight;
      const contribution = tfidfNorm * weight;
      decisionScore += contribution;

      keywordList.push({
        word: term,
        impact: contribution > 0 ? "Positive" : "Negative",
        weight: parseFloat(weight.toFixed(4)),
        contribution: parseFloat(contribution.toFixed(4)),
        abs_contribution: Math.abs(contribution)
      });
    }

    keywordList.sort((a, b) => b.abs_contribution - a.abs_contribution);

    const probPos = 1.0 / (1.0 + Math.exp(-decisionScore));
    const probNeg = 1.0 - probPos;
    const isPos = decisionScore >= 0;
    const confidence = isPos ? probPos : probNeg;

    return {
      text: rawText,
      tokens: matchedTerms.slice(0, 12),
      sentiment: isPos ? "Positive" : "Negative",
      sentiment_th: isPos ? "เชิงบวก (Positive)" : "เชิงลบ (Negative)",
      confidence: parseFloat((confidence * 100).toFixed(2)),
      decision_score: parseFloat(decisionScore.toFixed(4)),
      positive_prob: parseFloat((probPos * 100).toFixed(2)),
      negative_prob: parseFloat((probNeg * 100).toFixed(2)),
      keywords: keywordList.slice(0, 8)
    };
  }

  // Model Health & Status Badge
  let isApiOnline = false;
  async function checkModelHealth() {
    const statusDot = document.getElementById("modelStatusDot");
    const statusText = document.getElementById("modelStatusText");
    const modelBadge = document.getElementById("modelBadge");

    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      if (data.ready) {
        isApiOnline = true;
        statusDot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 pulse-dot mr-2";
        statusText.textContent = "Model Ready (Active API)";
        modelBadge.title = `ความแม่นยำ: ${data.accuracy}% | ข้อมูลเทรน: ${data.total_samples} ตัวอย่าง`;
        return;
      }
    } catch (err) {
      // API offline or static HTML mode
      isApiOnline = false;
    }

    if (window.THAI_SENTIMENT_MODEL) {
      statusDot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 pulse-dot mr-2";
      statusText.textContent = "Client AI Engine (Offline / Standalone)";
      const meta = window.THAI_SENTIMENT_MODEL.metadata || {};
      modelBadge.title = `โหมด Client-side: ทำงานในเบราว์เซอร์ 100% (Accuracy: ${meta.accuracy || 82.31}%)`;
    } else {
      statusDot.className = "w-2.5 h-2.5 rounded-full bg-amber-500 mr-2";
      statusText.textContent = "Standalone Mode";
    }
  }

  checkModelHealth();

  // Single Text Sentiment Analyzer
  const singleInput = document.getElementById("singleInput");
  const charCounter = document.getElementById("charCounter");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const clearBtn = document.getElementById("clearBtn");
  const singleLoader = document.getElementById("singleLoader");
  const resultEmptyState = document.getElementById("resultEmptyState");
  const resultFilledState = document.getElementById("resultFilledState");

  if (singleInput && charCounter) {
    singleInput.addEventListener("input", () => {
      charCounter.textContent = `${singleInput.value.length} ตัวอักษร`;
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      singleInput.value = "";
      charCounter.textContent = "0 ตัวอักษร";
      resultEmptyState.classList.remove("hidden");
      resultFilledState.classList.add("hidden");
      singleInput.focus();
    });
  }

  const testChips = document.querySelectorAll(".test-chip");
  testChips.forEach(chip => {
    chip.addEventListener("click", () => {
      const text = chip.dataset.sample;
      singleInput.value = text;
      charCounter.textContent = `${text.length} ตัวอักษร`;
      analyzeSentiment();
    });
  });

  singleInput.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      analyzeSentiment();
    }
  });

  if (analyzeBtn) {
    analyzeBtn.addEventListener("click", analyzeSentiment);
  }

  async function analyzeSentiment() {
    const text = singleInput.value.trim();
    if (!text) {
      showToast("กรุณากรอกข้อความที่ต้องการวิเคราะห์", "warning");
      singleInput.focus();
      return;
    }

    analyzeBtn.disabled = true;
    singleLoader.classList.remove("hidden");

    let resultData = null;

    if (isApiOnline) {
      try {
        const response = await fetch("/api/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text })
        });
        if (response.ok) {
          resultData = await response.json();
        }
      } catch (err) {
        // Fallback to client engine
        isApiOnline = false;
      }
    }

    if (!resultData) {
      // Execute with browser ML engine
      resultData = predictInBrowser(text);
    }

    analyzeBtn.disabled = false;
    singleLoader.classList.add("hidden");

    if (resultData) {
      renderSingleResult(resultData);
    } else {
      showToast("ไม่สามารถประมวลผลข้อความได้", "error");
    }
  }

  function renderSingleResult(data) {
    resultEmptyState.classList.add("hidden");
    resultFilledState.classList.remove("hidden");

    const isPositive = data.sentiment === "Positive";
    const sentimentCard = document.getElementById("sentimentCard");
    const sentimentTitle = document.getElementById("sentimentTitle");
    const sentimentDesc = document.getElementById("sentimentDesc");
    const sentimentIcon = document.getElementById("sentimentIcon");

    if (isPositive) {
      sentimentCard.className = "p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 shadow-sm transition-all";
      sentimentTitle.textContent = "ความรู้สึกเชิงบวก (Positive)";
      sentimentTitle.className = "text-xl font-bold text-emerald-700 dark:text-emerald-400";
      sentimentDesc.textContent = "ข้อความมีทัศนคติที่ดี ชื่นชม หรือพึงพอใจ";
      sentimentIcon.innerHTML = `<svg class="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    } else {
      sentimentCard.className = "p-5 rounded-2xl bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border border-rose-500/30 text-rose-800 dark:text-rose-300 shadow-sm transition-all";
      sentimentTitle.textContent = "ความรู้สึกเชิงลบ (Negative)";
      sentimentTitle.className = "text-xl font-bold text-rose-700 dark:text-rose-400";
      sentimentDesc.textContent = "ข้อความมีทัศนคติไม่พึงประสงค์ ตำหนิ หรือโกรธ";
      sentimentIcon.innerHTML = `<svg class="w-10 h-10 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    }

    // Confidence Gauge Animation
    const gaugeValue = document.getElementById("gaugeValue");
    const gaugeCircle = document.getElementById("gaugeCircle");
    const gaugeTextBadge = document.getElementById("gaugeTextBadge");

    const conf = data.confidence || 50;
    gaugeValue.textContent = `${conf.toFixed(1)}%`;
    
    const circumference = 251.2;
    const offset = circumference - (conf / 100) * circumference;
    gaugeCircle.style.strokeDasharray = `${circumference}`;
    gaugeCircle.style.strokeDashoffset = `${offset}`;
    gaugeCircle.style.stroke = isPositive ? "#10b981" : "#f43f5e";

    if (conf >= 85) {
      gaugeTextBadge.textContent = "ความมั่นใจสูงมาก";
      gaugeTextBadge.className = "px-2.5 py-1 text-xs rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-medium";
    } else if (conf >= 70) {
      gaugeTextBadge.textContent = "ความมั่นใจปานกลาง";
      gaugeTextBadge.className = "px-2.5 py-1 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-medium";
    } else {
      gaugeTextBadge.textContent = "ความมั่นใจระดับเริ่มต้น";
      gaugeTextBadge.className = "px-2.5 py-1 text-xs rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-medium";
    }

    // Probability Bars
    document.getElementById("posProbText").textContent = `${data.positive_prob}%`;
    document.getElementById("posProbBar").style.width = `${data.positive_prob}%`;
    document.getElementById("negProbText").textContent = `${data.negative_prob}%`;
    document.getElementById("negProbBar").style.width = `${data.negative_prob}%`;
    document.getElementById("decisionScoreVal").textContent = data.decision_score;

    // Tokens Chips
    const tokensContainer = document.getElementById("tokensContainer");
    tokensContainer.innerHTML = "";
    if (data.tokens && data.tokens.length > 0) {
      data.tokens.forEach(tok => {
        const span = document.createElement("span");
        span.className = "px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600";
        span.textContent = tok;
        tokensContainer.appendChild(span);
      });
    } else {
      tokensContainer.innerHTML = `<span class="text-xs text-slate-400">คำประโยคพื้นฐาน</span>`;
    }

    // Keyword Highlight Card
    const keywordsContainer = document.getElementById("keywordsContainer");
    keywordsContainer.innerHTML = "";
    if (data.keywords && data.keywords.length > 0) {
      data.keywords.forEach(kw => {
        const isPos = kw.impact === "Positive";
        const badge = document.createElement("div");
        badge.className = `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium border ${
          isPos 
            ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40" 
            : "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/40"
        }`;
        badge.innerHTML = `
          <div class="flex items-center gap-1.5 font-semibold">
            <span>${isPos ? '🟢' : '🔴'}</span>
            <span>${kw.word}</span>
          </div>
          <div class="text-[11px] opacity-80">
            ${isPos ? 'ผลักดันเชิงบวก' : 'ผลักดันเชิงลบ'} (${kw.weight > 0 ? '+' : ''}${kw.weight})
          </div>
        `;
        keywordsContainer.appendChild(badge);
      });
    } else {
      keywordsContainer.innerHTML = `<p class="text-xs text-slate-400">โมเดลใช้โครงสร้างภาพรวมของประโยคในการจำแนก</p>`;
    }
  }

  // Model Metrics Tab Fetching
  async function fetchModelMetrics() {
    if (isApiOnline) {
      try {
        const res = await fetch("/api/metrics");
        if (res.ok) {
          const metrics = await res.json();
          renderMetrics(metrics);
          return;
        }
      } catch (err) {}
    }

    // Fallback to embedded metadata
    if (window.THAI_SENTIMENT_MODEL && window.THAI_SENTIMENT_MODEL.metadata) {
      renderMetrics(window.THAI_SENTIMENT_MODEL.metadata);
    }
  }

  function renderMetrics(m) {
    document.getElementById("metricAcc").textContent = `${m.accuracy}%`;
    document.getElementById("metricPrec").textContent = `${m.precision}%`;
    document.getElementById("metricRec").textContent = `${m.recall}%`;
    document.getElementById("metricF1").textContent = `${m.f1_score}%`;

    document.getElementById("metricTotal").textContent = `${m.total_samples} รายการ`;
    document.getElementById("metricTrain").textContent = `${m.train_samples} รายการ`;
    document.getElementById("metricTest").textContent = `${m.test_samples} รายการ`;
    document.getElementById("metricVocab").textContent = `${m.vocabulary_size} คำ`;
    document.getElementById("metricUpdated").textContent = m.last_trained || "-";

    const cm = m.confusion_matrix;
    if (cm && cm.length === 2) {
      const tn = cm[0][0];
      const fp = cm[0][1];
      const fn = cm[1][0];
      const tp = cm[1][1];

      document.getElementById("cmTN").textContent = tn;
      document.getElementById("cmFP").textContent = fp;
      document.getElementById("cmFN").textContent = fn;
      document.getElementById("cmTP").textContent = tp;

      const totalTest = tn + fp + fn + tp;
      document.getElementById("cmSummary").textContent = `ทดสอบจากชุด Test Set จำนวนทั้งหมด ${totalTest} ตัวอย่าง (ทำนายถูกต้อง ${(tn + tp)} ตัวอย่าง, ผิดพลาด ${(fp + fn)} ตัวอย่าง)`;
    }
  }

  // Retrain Button
  const retrainBtn = document.getElementById("retrainBtn");
  if (retrainBtn) {
    retrainBtn.addEventListener("click", async () => {
      if (!isApiOnline) {
        showToast("ฟังก์ชันเทรนใหม่ต้องเชื่อมต่อกับ Python Server ครับ (โหมดเว็บ Offline จะใช้โมเดลล่าสุดที่บันทึกไว้)", "info");
        return;
      }
      if (!confirm("คุณต้องการสั่งฝึกสอนโมเดลใหม่จากไฟล์ฐานข้อมูลหรือไม่?")) return;
      retrainBtn.disabled = true;
      retrainBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
        กำลังเทรนโมเดลใหม่...
      `;

      try {
        const res = await fetch("/api/retrain", { method: "POST" });
        const result = await res.json();
        if (res.ok) {
          showToast("ฝึกสอนโมเดลใหม่สำเร็จแล้ว!", "success");
          fetchModelMetrics();
          checkModelHealth();
        } else {
          showToast(result.detail || "เกิดข้อผิดพลาดในการเทรน", "error");
        }
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        retrainBtn.disabled = false;
        retrainBtn.innerHTML = `
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          ฝึกสอนโมเดลใหม่ (Retrain Model)
        `;
      }
    });
  }

  // Batch / Bulk Analysis
  const batchTextInput = document.getElementById("batchTextInput");
  const analyzeBatchTextBtn = document.getElementById("analyzeBatchTextBtn");
  const fileUploadInput = document.getElementById("fileUploadInput");
  const dropzone = document.getElementById("dropzone");
  const batchResultsCard = document.getElementById("batchResultsCard");
  const batchSpinner = document.getElementById("batchSpinner");

  let batchData = [];
  let currentBatchFilter = "all";
  let batchCurrentPage = 1;
  const itemsPerPage = 8;

  if (analyzeBatchTextBtn) {
    analyzeBatchTextBtn.addEventListener("click", async () => {
      const text = batchTextInput.value.trim();
      if (!text) {
        showToast("กรุณากรอกข้อความหลายบรรทัด", "warning");
        return;
      }

      const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) {
        showToast("ไม่พบข้อความที่ถูกต้อง", "warning");
        return;
      }

      setBatchLoading(true);

      // Process in batch
      let results = [];
      if (isApiOnline) {
        try {
          const res = await fetch("/api/batch-predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texts: lines })
          });
          if (res.ok) {
            const data = await res.json();
            results = data.results || [];
          }
        } catch (e) {
          isApiOnline = false;
        }
      }

      // If offline, process in browser client
      if (results.length === 0) {
        results = lines.map(line => {
          const p = predictInBrowser(line);
          return {
            text: line,
            sentiment: p.sentiment,
            sentiment_th: p.sentiment_th,
            confidence: p.confidence,
            positive_prob: p.positive_prob,
            negative_prob: p.negative_prob,
            top_keywords: p.keywords.slice(0, 3).map(k => k.word).join(", ") || "-"
          };
        });
      }

      batchData = results;
      const posCount = batchData.filter(r => r.sentiment === "Positive").length;
      const negCount = batchData.filter(r => r.sentiment === "Negative").length;
      const total = batchData.length;

      const summary = {
        positive_count: posCount,
        negative_count: negCount,
        positive_rate: parseFloat(((posCount / total) * 100).toFixed(2)),
        negative_rate: parseFloat(((negCount / total) * 100).toFixed(2))
      };

      renderBatchOverview(summary, total);
      renderBatchTable();
      setBatchLoading(false);
    });
  }

  // File Upload Batch Analysis (Supports both Server Upload & Browser SheetJS Client Parsing)
  if (dropzone && fileUploadInput) {
    dropzone.addEventListener("click", () => fileUploadInput.click());

    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("border-indigo-500", "bg-indigo-50/20");
    });

    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("border-indigo-500", "bg-indigo-50/20");
    });

    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("border-indigo-500", "bg-indigo-50/20");
      if (e.dataTransfer.files.length > 0) {
        handleFileUpload(e.dataTransfer.files[0]);
      }
    });

    fileUploadInput.addEventListener("change", () => {
      if (fileUploadInput.files.length > 0) {
        handleFileUpload(fileUploadInput.files[0]);
      }
    });
  }

  async function handleFileUpload(file) {
    const validExtensions = [".csv", ".xlsx", ".xls"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!validExtensions.includes(ext)) {
      showToast("กรุณาเลือกไฟล์ .csv หรือ .xlsx เท่านั้น", "warning");
      return;
    }

    setBatchLoading(true);

    // Try Server API first if online
    if (isApiOnline) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/upload-batch", {
          method: "POST",
          body: formData
        });

        if (res.ok) {
          const data = await res.json();
          batchData = data.results || [];
          showToast(`วิเคราะห์ไฟล์ ${data.filename} (${data.total_analyzed} รายการ) สำเร็จ`, "success");
          renderBatchOverview(data.summary, data.total_analyzed);
          renderBatchTable();
          setBatchLoading(false);
          return;
        }
      } catch (err) {
        isApiOnline = false;
      }
    }

    // Parse file directly in the browser via SheetJS (xlsx library) or FileReader
    try {
      const reader = new FileReader();
      reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        let extractedTexts = [];

        if (window.XLSX) {
          const workbook = window.XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheetName];
          const jsonRows = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });

          // Extract non-empty text cells
          for (let r = 0; r < jsonRows.length; r++) {
            const row = jsonRows[r];
            if (row && row.length > 0) {
              for (let c = 0; c < row.length; c++) {
                const val = String(row[c] || '').trim();
                if (val.length > 2 && isNaN(Number(val))) {
                  extractedTexts.push(val);
                }
              }
            }
          }
        } else {
          // Fallback text reader
          const text = new TextDecoder('utf-8').decode(data);
          extractedTexts = text.split(/[\r\n]+/).map(l => l.trim()).filter(l => l.length > 1);
        }

        // Limit to first 500 for fast client rendering
        const subset = extractedTexts.slice(0, 500);
        const results = subset.map(t => {
          const p = predictInBrowser(t);
          return {
            text: t,
            sentiment: p.sentiment,
            sentiment_th: p.sentiment_th,
            confidence: p.confidence,
            positive_prob: p.positive_prob,
            negative_prob: p.negative_prob,
            top_keywords: p.keywords.slice(0, 3).map(k => k.word).join(", ") || "-"
          };
        });

        batchData = results;
        const posCount = batchData.filter(r => r.sentiment === "Positive").length;
        const negCount = batchData.filter(r => r.sentiment === "Negative").length;
        const total = batchData.length;

        const summary = {
          positive_count: posCount,
          negative_count: negCount,
          positive_rate: parseFloat(((posCount / total) * 100).toFixed(2)),
          negative_rate: parseFloat(((negCount / total) * 100).toFixed(2))
        };

        showToast(`อ่านไฟล์และประมวลผล ${total} รายการเสร็จสิ้น`, "success");
        renderBatchOverview(summary, total);
        renderBatchTable();
        setBatchLoading(false);
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      showToast("เกิดข้อผิดพลาดในการอ่านไฟล์ในเบราว์เซอร์: " + err.message, "error");
      setBatchLoading(false);
    }
  }

  function setBatchLoading(isLoading) {
    if (batchSpinner) {
      if (isLoading) batchSpinner.classList.remove("hidden");
      else batchSpinner.classList.add("hidden");
    }
  }

  function renderBatchOverview(summary, total) {
    batchResultsCard.classList.remove("hidden");
    document.getElementById("batchTotalCount").textContent = `${total} รายการ`;
    document.getElementById("batchPosCount").textContent = `${summary.positive_count} (${summary.positive_rate}%)`;
    document.getElementById("batchNegCount").textContent = `${summary.negative_count} (${summary.negative_rate}%)`;
  }

  // Batch Filter & Search
  const batchSearchInput = document.getElementById("batchSearchInput");
  const batchFilterBtns = document.querySelectorAll(".batch-filter-btn");

  if (batchSearchInput) {
    batchSearchInput.addEventListener("input", () => {
      batchCurrentPage = 1;
      renderBatchTable();
    });
  }

  batchFilterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      batchFilterBtns.forEach(b => {
        b.classList.remove("bg-indigo-600", "text-white");
        b.classList.add("bg-slate-100", "dark:bg-slate-800", "text-slate-600", "dark:text-slate-300");
      });
      btn.classList.add("bg-indigo-600", "text-white");
      btn.classList.remove("bg-slate-100", "dark:bg-slate-800", "text-slate-600", "dark:text-slate-300");

      currentBatchFilter = btn.dataset.filter;
      batchCurrentPage = 1;
      renderBatchTable();
    });
  });

  function renderBatchTable() {
    const tableBody = document.getElementById("batchTableBody");
    const searchTerm = (batchSearchInput ? batchSearchInput.value.trim().toLowerCase() : "");

    const filtered = batchData.filter(item => {
      const matchFilter = (currentBatchFilter === "all") || (item.sentiment.toLowerCase() === currentBatchFilter);
      const matchSearch = !searchTerm || item.text.toLowerCase().includes(searchTerm);
      return matchFilter && matchSearch;
    });

    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
    if (batchCurrentPage > totalPages) batchCurrentPage = totalPages;

    const startIdx = (batchCurrentPage - 1) * itemsPerPage;
    const pageItems = filtered.slice(startIdx, startIdx + itemsPerPage);

    tableBody.innerHTML = "";

    if (pageItems.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="py-8 text-center text-slate-400">ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา</td>
        </tr>
      `;
    } else {
      pageItems.forEach((row, idx) => {
        const isPos = row.sentiment === "Positive";
        const tr = document.createElement("tr");
        tr.className = "border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors";
        tr.innerHTML = `
          <td class="py-3 px-3 text-xs text-slate-400 font-mono">${startIdx + idx + 1}</td>
          <td class="py-3 px-3 text-sm text-slate-800 dark:text-slate-200 max-w-xs md:max-w-md truncate" title="${row.text}">${row.text}</td>
          <td class="py-3 px-3">
            <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
              isPos 
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' 
                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
            }">
              ${isPos ? '🟢 เชิงบวก' : '🔴 เชิงลบ'}
            </span>
          </td>
          <td class="py-3 px-3">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold ${isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">${row.confidence}%</span>
              <div class="w-16 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div class="h-full ${isPos ? 'bg-emerald-500' : 'bg-rose-500'}" style="width: ${row.confidence}%"></div>
              </div>
            </div>
          </td>
          <td class="py-3 px-3 text-xs text-slate-500 dark:text-slate-400">${row.top_keywords || '-'}</td>
        `;
        tableBody.appendChild(tr);
      });
    }

    const pageInfo = document.getElementById("batchPageInfo");
    if (pageInfo) {
      pageInfo.textContent = `แสดง ${filtered.length > 0 ? startIdx + 1 : 0} - ${Math.min(startIdx + itemsPerPage, filtered.length)} จากทั้งหมด ${filtered.length} รายการ`;
    }

    const prevBtn = document.getElementById("batchPrevBtn");
    const nextBtn = document.getElementById("batchNextBtn");
    if (prevBtn) prevBtn.disabled = (batchCurrentPage <= 1);
    if (nextBtn) nextBtn.disabled = (batchCurrentPage >= totalPages);
  }

  const prevBtn = document.getElementById("batchPrevBtn");
  const nextBtn = document.getElementById("batchNextBtn");
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (batchCurrentPage > 1) {
        batchCurrentPage--;
        renderBatchTable();
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      batchCurrentPage++;
      renderBatchTable();
    });
  }

  // Export CSV
  const exportCsvBtn = document.getElementById("exportCsvBtn");
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", () => {
      if (batchData.length === 0) {
        showToast("ไม่มีข้อมูลสำหรับส่งออก", "warning");
        return;
      }

      let csvContent = "\uFEFFลำดับ,ข้อความ,ขั้วอารมณ์,ความเชื่อมั่น (%),เปอร์เซ็นต์เชิงบวก (%),เปอร์เซ็นต์เชิงลบ (%),คำสำคัญเด่น\n";
      batchData.forEach((row, i) => {
        const escapedText = `"${(row.text || '').replace(/"/g, '""')}"`;
        const kw = `"${(row.top_keywords || '').replace(/"/g, '""')}"`;
        csvContent += `${i + 1},${escapedText},${row.sentiment_th},${row.confidence},${row.positive_prob || 0},${row.negative_prob || 0},${kw}\n`;
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `thai_sentiment_results_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("ดาวน์โหลดไฟล์ CSV เรียบร้อยแล้ว", "success");
    });
  }

  // Toast Notification System
  function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    let bgClass = "bg-slate-900 text-white dark:bg-white dark:text-slate-900";
    let icon = "ℹ️";

    if (type === "success") {
      bgClass = "bg-emerald-600 text-white";
      icon = "✅";
    } else if (type === "warning") {
      bgClass = "bg-amber-600 text-white";
      icon = "⚠️";
    } else if (type === "error") {
      bgClass = "bg-rose-600 text-white";
      icon = "❌";
    }

    toast.className = `flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium transition-all transform translate-y-2 opacity-0 duration-300 ${bgClass}`;
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.remove("translate-y-2", "opacity-0");
    });

    setTimeout(() => {
      toast.classList.add("opacity-0", "translate-y-2");
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
});
