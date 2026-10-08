// Thai Sentiment Analysis Web App Client
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

  // Model Health & Status Badge
  async function checkModelHealth() {
    const statusDot = document.getElementById("modelStatusDot");
    const statusText = document.getElementById("modelStatusText");
    const modelBadge = document.getElementById("modelBadge");

    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      if (data.ready) {
        statusDot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 pulse-dot mr-2";
        statusText.textContent = "Model Ready (Active)";
        modelBadge.title = `ความแม่นยำ: ${data.accuracy}% | ข้อมูลเทรน: ${data.total_samples} ตัวอย่าง`;
      } else {
        statusDot.className = "w-2.5 h-2.5 rounded-full bg-amber-500 pulse-dot mr-2";
        statusText.textContent = "กำลังโหลดโมเดล...";
      }
    } catch (err) {
      statusDot.className = "w-2.5 h-2.5 rounded-full bg-rose-500 mr-2";
      statusText.textContent = "Offline";
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

  // Character Counter
  if (singleInput && charCounter) {
    singleInput.addEventListener("input", () => {
      charCounter.textContent = `${singleInput.value.length} ตัวอักษร`;
    });
  }

  // Clear button
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      singleInput.value = "";
      charCounter.textContent = "0 ตัวอักษร";
      resultEmptyState.classList.remove("hidden");
      resultFilledState.classList.add("hidden");
      singleInput.focus();
    });
  }

  // Quick Test Chips
  const testChips = document.querySelectorAll(".test-chip");
  testChips.forEach(chip => {
    chip.addEventListener("click", () => {
      const text = chip.dataset.sample;
      singleInput.value = text;
      charCounter.textContent = `${text.length} ตัวอักษร`;
      analyzeSentiment();
    });
  });

  // Ctrl+Enter shortcut
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

    // UI Loading state
    analyzeBtn.disabled = true;
    singleLoader.classList.remove("hidden");

    try {
      const response = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error("เกิดข้อผิดพลาดในการวิเคราะห์");
      }

      const data = await response.json();
      renderSingleResult(data);
    } catch (err) {
      showToast(err.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้", "error");
    } finally {
      analyzeBtn.disabled = false;
      singleLoader.classList.add("hidden");
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
    
    // SVG circle circumference = 2 * PI * 40 ≈ 251.2
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
      tokensContainer.innerHTML = `<span class="text-xs text-slate-400">ไม่มีคำที่ตัดได้</span>`;
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
      keywordsContainer.innerHTML = `<p class="text-xs text-slate-400">ไม่พบคำสำคัญเฉพาะในคลังคำศัพท์ (โมเดลใช้โครงสร้างโดยรวมในการตัดสิน)</p>`;
    }
  }

  // Model Metrics Tab Fetching
  let cachedMetrics = null;
  async function fetchModelMetrics() {
    try {
      const res = await fetch("/api/metrics");
      if (!res.ok) throw new Error("ไม่สามารถดึงข้อมูลผลลัพธ์โมเดลได้");
      const metrics = await res.json();
      cachedMetrics = metrics;
      renderMetrics(metrics);
    } catch (err) {
      showToast(err.message, "error");
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

    // Confusion Matrix: [[TN, FP], [FN, TP]]
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

  // Multi-line Text Batch Analysis
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
      try {
        const res = await fetch("/api/batch-predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts: lines })
        });

        if (!res.ok) throw new Error("การวิเคราะห์แบบกลุ่มล้มเหลว");
        const data = await res.json();
        batchData = data.results || [];
        renderBatchOverview(data.summary, batchData.length);
        renderBatchTable();
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        setBatchLoading(false);
      }
    });
  }

  // File Upload Batch Analysis
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
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload-batch", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "อัปโหลดไฟล์ล้มเหลว");
      }

      const data = await res.json();
      batchData = data.results || [];
      showToast(`วิเคราะห์ไฟล์ ${data.filename} (${data.total_analyzed} รายการ) สำเร็จ`, "success");
      renderBatchOverview(data.summary, data.total_analyzed);
      renderBatchTable();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
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

    // Pagination info
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

      // Add UTF-8 BOM so Excel opens Thai properly
      let csvContent = "\uFEFFลำดับ,ข้อความ,ขั้วอารมณ์,ความเชื่อมั่น (%),เปอร์เซ็นต์เชิงบวก (%),เปอร์เซ็นต์เชิงลบ (%),คำสำคัญเด่น\n";
      batchData.forEach((row, i) => {
        const escapedText = `"${(row.text || '').replace(/"/g, '""')}"`;
        const kw = `"${(row.top_keywords || '').replace(/"/g, '""')}"`;
        csvContent += `${i + 1},${escapedText},${row.sentiment_th},${row.confidence},${row.positive_prob},${row.negative_prob},${kw}\n`;
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
