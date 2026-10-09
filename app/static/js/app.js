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
    if (tabId === "vocabTab") {
      renderVocabTab();
    }
  }

  navTabs.forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // HTML Escape Utility
  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m]));
  }

  // ==========================================
  // CUSTOM VOCABULARY & ACTIVE LEARNING (v1.2)
  // ==========================================
  const CUSTOM_VOCAB_KEY = "thai_sentiment_custom_vocab";

  function getCustomVocab() {
    try {
      const raw = localStorage.getItem(CUSTOM_VOCAB_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveCustomVocab(vocab) {
    try {
      localStorage.setItem(CUSTOM_VOCAB_KEY, JSON.stringify(vocab));
    } catch (e) {
      console.error("Failed to save custom vocab:", e);
    }
    updateVocabBadge();
  }

  function updateVocabBadge() {
    const vocab = getCustomVocab();
    const count = Object.keys(vocab).length;
    const badge = document.getElementById("vocabBadgeCount");
    if (badge) {
      badge.textContent = count;
    }
  }

  async function syncCustomVocabWithApi() {
    if (!isApiOnline) return;
    try {
      const res = await fetch("/api/custom-words");
      if (res.ok) {
        const data = await res.json();
        if (data && data.words) {
          const local = getCustomVocab();
          const merged = { ...data.words, ...local };
          saveCustomVocab(merged);
        }
      }
    } catch (e) {}
  }

  function isWordKnown(word) {
    if (!word) return false;
    const cleanWord = word.trim();
    if (!cleanWord) return false;
    const cleanNoSpace = cleanWord.replace(/\s+/g, "");
    const model = window.THAI_SENTIMENT_MODEL;
    if (model && model.features) {
      if (model.features[cleanWord] || model.features[cleanNoSpace]) {
        return true;
      }
    }
    return false;
  }

  async function teachWord(word, sentiment, weight = 2.5, isSentence = false) {
    if (!word || !word.trim()) {
      showToast("กรุณาระบุข้อความที่ต้องการสอน", "warning");
      return;
    }
    const cleanWord = word.trim();

    // ถ้าไม่ใช่การระบุประโยคโดยตรง และเป็นคำเดี่ยวที่มีอยู่ในพจนานุกรมโมเดลอยู่แล้ว ไม่ต้องบันทึกซ้ำ
    if (!isSentence && isWordKnown(cleanWord)) {
      showToast(`คำว่า "${cleanWord}" มีอยู่ในพจนานุกรมของโมเดลอยู่แล้ว (ไม่ต้องบันทึก)`, "info");
      return;
    }

    const isPos = (sentiment === "Positive" || sentiment === "+");
    const standardSentiment = isPos ? "Positive" : "Negative";
    const valWeight = isPos ? Math.abs(weight) : -Math.abs(weight);

    const vocab = getCustomVocab();
    vocab[cleanWord] = {
      word: cleanWord,
      sentiment: standardSentiment,
      sentiment_th: isPos ? "เชิงบวก (+)" : "เชิงลบ (-)",
      weight: valWeight,
      added_at: new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH", { hour: '2-digit', minute: '2-digit' })
    };
    saveCustomVocab(vocab);

    // Sync to backend if active
    if (isApiOnline) {
      try {
        const resp = await fetch("/api/custom-words", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            word: cleanWord, 
            sentiment: standardSentiment, 
            weight: Math.abs(weight),
            is_sentence: isSentence 
          })
        });
        if (resp.ok) {
          const resJson = await resp.json();
          if (resJson.already_known && !isSentence) {
            delete vocab[cleanWord];
            saveCustomVocab(vocab);
            showToast(resJson.message || `คำว่า "${cleanWord}" มีอยู่ในโมเดลอยู่แล้ว ไม่ต้องบันทึกซ้ำ`, "info");
            renderVocabTab();
            return;
          }
        }
      } catch (err) {}
    }

    showToast(`บันทึกสำเร็จ! กำหนด "${cleanWord}" เป็น${isPos ? 'เชิงบวก (+)' : 'เชิงลบ (-)'}`, "success");
    
    // Update Vocab Tab if open
    renderVocabTab();

    // Re-run single prediction if input currently contains word
    const currentInput = document.getElementById("singleInput")?.value?.trim();
    if (currentInput) {
      analyzeSentiment();
    }
  }

  async function removeTaughtWord(word) {
    if (!word) return;
    const cleanWord = word.trim();
    const vocab = getCustomVocab();
    if (vocab[cleanWord]) {
      delete vocab[cleanWord];
      saveCustomVocab(vocab);

      if (isApiOnline) {
        try {
          await fetch("/api/custom-words/" + encodeURIComponent(cleanWord), {
            method: "DELETE"
          });
        } catch (err) {}
      }

      showToast(`ลบคำว่า "${cleanWord}" ออกจากคลังคำศัพท์แล้ว`, "info");
      renderVocabTab();
      const currentInput = document.getElementById("singleInput")?.value?.trim();
      if (currentInput) {
        analyzeSentiment();
      }
    }
  }

  async function clearAllTaughtWords() {
    if (!confirm("คุณต้องการล้างคำศัพท์ที่สอนระบบทั้งหมดใช่หรือไม่?")) return;
    saveCustomVocab({});
    if (isApiOnline) {
      try {
        await fetch("/api/custom-words", { method: "DELETE" });
      } catch (e) {}
    }
    showToast("ล้างคำศัพท์ที่สอนระบบทั้งหมดเรียบร้อยแล้ว", "success");
    renderVocabTab();
    const currentInput = document.getElementById("singleInput")?.value?.trim();
    if (currentInput) {
      analyzeSentiment();
    }
  }

  // Client-side Machine Learning Inference Engine (Hybrid with Custom Vocab)
  function predictInBrowser(rawText) {
    if (!rawText || !rawText.trim()) {
      return {
        text: "",
        tokens: [],
        known_tokens: [],
        unknown_tokens: [],
        sentiment: "Neutral",
        sentiment_th: "เป็นกลาง",
        confidence: 50,
        positive_prob: 50,
        negative_prob: 50,
        decision_score: 0,
        keywords: [],
        is_unknown: false,
        unknown_word: null,
        custom_keywords: []
      };
    }

    const model = window.THAI_SENTIMENT_MODEL;
    if (!model || !model.features) return null;

    let text = rawText.trim();
    text = text.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ");

    const features = model.features;
    const customVocab = getCustomVocab();
    const termCounts = {};
    const matchedTerms = [];

    // Match base features
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

    // Match custom user-taught words
    const customKeywords = [];
    let customScoreDelta = 0;
    const textNoSpace = text.replace(/\s+/g, "");

    for (const cw in customVocab) {
      const cData = customVocab[cw];
      const cwNoSpace = cw.replace(/\s+/g, "");
      if (text.includes(cw) || textNoSpace.includes(cwNoSpace)) {
        const isPos = cData.sentiment === "Positive";
        const w = parseFloat(cData.weight) || (isPos ? 2.5 : -2.5);
        customKeywords.push({
          word: cw,
          impact: isPos ? "Positive" : "Negative",
          weight: w,
          contribution: w,
          abs_contribution: Math.abs(w),
          is_custom: true
        });
        customScoreDelta += w;
      }
    }

    // Base TF-IDF Calculation
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
    let decisionScore = (model.intercept || 0) + customScoreDelta;
    const baseKeywordList = [];

    for (const term in rawTfidf) {
      const tfidfNorm = rawTfidf[term] / norm;
      const weight = features[term].weight;
      const contribution = tfidfNorm * weight;
      decisionScore += contribution;

      baseKeywordList.push({
        word: term,
        impact: contribution > 0 ? "Positive" : "Negative",
        weight: parseFloat(weight.toFixed(4)),
        contribution: parseFloat(contribution.toFixed(4)),
        abs_contribution: Math.abs(contribution),
        is_custom: false
      });
    }

    // Combine custom and base keywords (custom words have precedence)
    const customWordsSet = new Set(customKeywords.map(k => k.word));
    const combinedKeywords = [...customKeywords, ...baseKeywordList.filter(k => !customWordsSet.has(k.word))];
    combinedKeywords.sort((a, b) => b.abs_contribution - a.abs_contribution);

    // Build tokens representation
    let allTokens = [];
    if (text.includes(" ")) {
      allTokens = text.split(/\s+/).filter(t => t.length > 0);
    } else {
      const matchedTokens = [...customKeywords.map(k => k.word), ...matchedTerms];
      allTokens = matchedTokens.length > 0 ? matchedTokens : [text];
    }

    const knownTokens = allTokens.filter(t => features[t] || customVocab[t]);
    const unknownTokens = allTokens.filter(t => !features[t] && !customVocab[t]);

    // Check if system "doesn't know" (Out of vocabulary)
    const isUnknown = (matchedTerms.length === 0 && customKeywords.length === 0);

    let probPos = 0.5;
    let probNeg = 0.5;
    let confidence = 0.5;
    let sentiment = "Uncertain";
    let sentiment_th = "ไม่แน่ใจ (ระบบยังไม่รู้จักคำนี้)";

    if (isUnknown) {
      decisionScore = 0;
    } else {
      probPos = 1.0 / (1.0 + Math.exp(-decisionScore));
      probNeg = 1.0 - probPos;
      const isPos = decisionScore >= 0;
      confidence = isPos ? probPos : probNeg;
      sentiment = isPos ? "Positive" : "Negative";
      sentiment_th = isPos ? "เชิงบวก (Positive)" : "เชิงลบ (Negative)";
    }

    return {
      text: rawText,
      tokens: allTokens.slice(0, 15),
      known_tokens: knownTokens,
      unknown_tokens: unknownTokens,
      sentiment: sentiment,
      sentiment_th: sentiment_th,
      confidence: parseFloat((confidence * 100).toFixed(2)),
      decision_score: parseFloat(decisionScore.toFixed(4)),
      positive_prob: parseFloat((probPos * 100).toFixed(2)),
      negative_prob: parseFloat((probNeg * 100).toFixed(2)),
      keywords: combinedKeywords.slice(0, 8),
      is_unknown: isUnknown,
      unknown_word: isUnknown ? rawText.trim() : (unknownTokens[0] || null),
      custom_keywords: customKeywords
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
        statusText.textContent = "Model Ready (Active API v1.2)";
        modelBadge.title = `ความแม่นยำ: ${data.accuracy}% | ข้อมูลเทรน: ${data.total_samples} ตัวอย่าง | คำศัพท์ที่สอน: ${data.custom_words_count || 0} คำ`;
        await syncCustomVocabWithApi();
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
      const teachSystemBox = document.getElementById("teachSystemBox");
      if (teachSystemBox) teachSystemBox.classList.add("hidden");
      const toggleTeachChevron = document.getElementById("toggleTeachChevron");
      if (toggleTeachChevron) toggleTeachChevron.classList.remove("rotate-180");
      const toggleTeachText = document.getElementById("toggleTeachText");
      if (toggleTeachText) toggleTeachText.textContent = "คลิกเพื่อเปิด";
      singleInput.focus();
    });
  }

  // Toggle Teach Sentence Box (Collapsible)
  const toggleTeachBoxBtn = document.getElementById("toggleTeachBoxBtn");
  const toggleTeachChevron = document.getElementById("toggleTeachChevron");
  const toggleTeachText = document.getElementById("toggleTeachText");

  if (toggleTeachBoxBtn) {
    toggleTeachBoxBtn.addEventListener("click", () => {
      const teachSystemBox = document.getElementById("teachSystemBox");
      if (!teachSystemBox) return;
      const isHidden = teachSystemBox.classList.contains("hidden");
      if (isHidden) {
        teachSystemBox.classList.remove("hidden");
        if (toggleTeachChevron) toggleTeachChevron.classList.add("rotate-180");
        if (toggleTeachText) toggleTeachText.textContent = "คลิกเพื่อซ่อน";
      } else {
        teachSystemBox.classList.add("hidden");
        if (toggleTeachChevron) toggleTeachChevron.classList.remove("rotate-180");
        if (toggleTeachText) toggleTeachText.textContent = "คลิกเพื่อเปิด";
      }
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

    const isUnknown = data.is_unknown || data.sentiment === "Uncertain";
    const isPositive = data.sentiment === "Positive";
    const sentimentCard = document.getElementById("sentimentCard");
    const sentimentTitle = document.getElementById("sentimentTitle");
    const sentimentDesc = document.getElementById("sentimentDesc");
    const sentimentIcon = document.getElementById("sentimentIcon");

    if (isUnknown) {
      sentimentCard.className = "p-5 rounded-2xl bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/40 text-amber-900 dark:text-amber-200 shadow-sm transition-all";
      sentimentTitle.textContent = "ไม่แน่ใจ (ระบบยังไม่รู้จักคำนี้)";
      sentimentTitle.className = "text-xl font-bold text-amber-600 dark:text-amber-400";
      sentimentDesc.textContent = "ไม่พบคีย์เวิร์ดในฐานข้อมูลโมเดล — สามารถกดบอกขั้วอารมณ์ด้านล่างเพื่อสอนระบบได้ทันที";
      sentimentIcon.innerHTML = `<svg class="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    } else if (isPositive) {
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

    if (isUnknown) {
      gaugeCircle.style.stroke = "#f59e0b";
      gaugeTextBadge.textContent = "ระบบยังไม่รู้จักคำนี้";
      gaugeTextBadge.className = "px-2.5 py-1 text-xs rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-medium";
    } else {
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
    }

    // Probability Bars
    document.getElementById("posProbText").textContent = `${data.positive_prob}%`;
    document.getElementById("posProbBar").style.width = `${data.positive_prob}%`;
    document.getElementById("negProbText").textContent = `${data.negative_prob}%`;
    document.getElementById("negProbBar").style.width = `${data.negative_prob}%`;
    document.getElementById("decisionScoreVal").textContent = data.decision_score;

    // Teach System Box Handling (v1.2 Active Learning - Collapsible Sentence Teaching)
    const teachSystemBox = document.getElementById("teachSystemBox");
    const teachSentenceBadge = document.getElementById("teachSentenceBadge");
    const customVocab = getCustomVocab();

    const currentSentence = (data.text || (singleInput ? singleInput.value : "") || "").trim();
    const teachTargetWord = document.getElementById("teachTargetWord");
    const teachStatusBadge = document.getElementById("teachStatusBadge");
    const teachSavedFooter = document.getElementById("teachSavedFooter");
    const teachPositiveBtn = document.getElementById("teachPositiveBtn");
    const teachNegativeBtn = document.getElementById("teachNegativeBtn");
    const teachRemoveBtn = document.getElementById("teachRemoveBtn");

    if (teachTargetWord) teachTargetWord.textContent = currentSentence;

    const isAlreadyTaught = !!customVocab[currentSentence];
    if (isAlreadyTaught) {
      const tData = customVocab[currentSentence];
      const tPos = tData.sentiment === "Positive";
      if (teachSentenceBadge) {
        teachSentenceBadge.textContent = `สอนแล้ว: ${tPos ? 'เชิงบวก (+)' : 'เชิงลบ (-)'}`;
        teachSentenceBadge.className = `px-2 py-0.5 rounded-full text-[10px] font-semibold ${
          tPos 
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300/40' 
            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300/40'
        }`;
      }
      if (teachStatusBadge) {
        teachStatusBadge.textContent = `สอนแล้ว: ${tPos ? 'เชิงบวก (+)' : 'เชิงลบ (-)'}`;
        teachStatusBadge.className = `px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
          tPos 
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
        }`;
      }
      if (teachSavedFooter) teachSavedFooter.classList.remove("hidden");
    } else {
      const isUnknownSentiment = data.is_unknown || data.sentiment === "Uncertain";
      if (teachSentenceBadge) {
        teachSentenceBadge.textContent = isUnknownSentiment ? "ไม่แน่ใจ (กดเพื่อระบุ)" : "กดเพื่อเปิด";
        teachSentenceBadge.className = `px-2 py-0.5 rounded-full text-[10px] font-semibold ${
          isUnknownSentiment
            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-300/40'
            : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50'
        }`;
      }
      if (teachStatusBadge) {
        teachStatusBadge.textContent = isUnknownSentiment ? "ระบบยังไม่แน่ใจในประโยคนี้" : "ยังไม่ได้กำหนด";
        teachStatusBadge.className = "px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700";
      }
      if (teachSavedFooter) teachSavedFooter.classList.add("hidden");
    }

    if (teachPositiveBtn) teachPositiveBtn.onclick = () => teachWord(currentSentence, "Positive", 3.0, true);
    if (teachNegativeBtn) teachNegativeBtn.onclick = () => teachWord(currentSentence, "Negative", 3.0, true);
    if (teachRemoveBtn) teachRemoveBtn.onclick = () => removeTaughtWord(currentSentence);

    // Tokens Chips Rendering (Interactive Token Pills)
    const tokensContainer = document.getElementById("tokensContainer");
    tokensContainer.innerHTML = "";
    const tokens = data.tokens || [];
    if (tokens.length > 0) {
      tokens.forEach(tok => {
        const div = document.createElement("div");
        const isCustom = !!customVocab[tok];
        const isKnown = (window.THAI_SENTIMENT_MODEL && window.THAI_SENTIMENT_MODEL.features && window.THAI_SENTIMENT_MODEL.features[tok]);

        if (isCustom) {
          const cPos = customVocab[tok].sentiment === "Positive";
          div.className = `inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${
            cPos 
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800' 
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
          }`;
          div.innerHTML = `
            <span>✨ ${escapeHtml(tok)}</span>
            <span class="text-[10px] opacity-80 font-bold">${cPos ? '(+)' : '(-)'}</span>
            <button type="button" class="text-slate-400 hover:text-rose-600 font-bold ml-1 text-sm leading-none" title="ลบคำที่สอน">×</button>
          `;
          div.querySelector("button").onclick = (e) => {
            e.stopPropagation();
            removeTaughtWord(tok);
          };
        } else if (isKnown) {
          div.className = "inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600";
          div.textContent = tok;
        } else {
          // Unknown token! Give user mini buttons [+] and [-]
          div.className = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 border border-dashed border-amber-300 dark:border-amber-700";
          div.innerHTML = `
            <span>${escapeHtml(tok)}</span>
            <span class="text-[10px] text-amber-500 font-bold">❓</span>
            <button type="button" class="btn-teach-pos text-emerald-600 hover:text-emerald-800 font-bold px-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors" title="สอนว่าคำนี้เป็น เชิงบวก (+)">[+]</button>
            <button type="button" class="btn-teach-neg text-rose-600 hover:text-rose-800 font-bold px-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950 transition-colors" title="สอนว่าคำนี้เป็น เชิงลบ (-)">[-]</button>
          `;
          div.querySelector(".btn-teach-pos").onclick = (e) => {
            e.stopPropagation();
            teachWord(tok, "Positive");
          };
          div.querySelector(".btn-teach-neg").onclick = (e) => {
            e.stopPropagation();
            teachWord(tok, "Negative");
          };
        }
        tokensContainer.appendChild(div);
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
            <span>${escapeHtml(kw.word)}</span>
            ${kw.is_custom ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold uppercase tracking-wider">ผู้ใช้สอน</span>' : ''}
          </div>
          <div class="text-[11px] opacity-80">
            ${isPos ? 'ผลักดันเชิงบวก' : 'ผลักดันเชิงลบ'} (${kw.weight > 0 ? '+' : ''}${kw.weight})
          </div>
        `;
        keywordsContainer.appendChild(badge);
      });
    } else {
      if (isUnknown) {
        keywordsContainer.innerHTML = `
          <div class="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 text-xs">
            ⚠️ ไม่พบคีย์เวิร์ดในโมเดลความรู้สึกสำหรับข้อความนี้ กรุณาใช้กล่องสอนระบบด้านบนเพื่อระบุขั้วอารมณ์
          </div>
        `;
      } else {
        keywordsContainer.innerHTML = `<p class="text-xs text-slate-400">โมเดลใช้โครงสร้างภาพรวมของประโยคในการจำแนก</p>`;
      }
    }
  }

  // Vocab Tab Management
  function renderVocabTab() {
    const vocab = getCustomVocab();
    const wordsList = Object.values(vocab);

    const totalEl = document.getElementById("vocabStatTotal");
    const posEl = document.getElementById("vocabStatPos");
    const negEl = document.getElementById("vocabStatNeg");
    const badgeEl = document.getElementById("vocabBadgeCount");
    const tableBody = document.getElementById("vocabTableBody");
    const emptyState = document.getElementById("vocabEmptyState");
    const searchInput = document.getElementById("vocabSearchInput");

    const posCount = wordsList.filter(w => w.sentiment === "Positive").length;
    const negCount = wordsList.filter(w => w.sentiment === "Negative").length;

    if (totalEl) totalEl.textContent = wordsList.length;
    if (posEl) posEl.textContent = posCount;
    if (negEl) negEl.textContent = negCount;
    if (badgeEl) badgeEl.textContent = wordsList.length;

    if (!tableBody) return;

    const searchTerm = (searchInput ? searchInput.value.trim().toLowerCase() : "");
    const filtered = wordsList.filter(w => !searchTerm || w.word.toLowerCase().includes(searchTerm));

    tableBody.innerHTML = "";

    if (filtered.length === 0) {
      if (emptyState) emptyState.classList.remove("hidden");
    } else {
      if (emptyState) emptyState.classList.add("hidden");
      filtered.forEach(item => {
        const isPos = item.sentiment === "Positive";
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors";
        tr.innerHTML = `
          <td class="px-4 py-3 font-medium text-slate-900 dark:text-slate-100 font-mono text-sm">
            ${escapeHtml(item.word)}
          </td>
          <td class="px-4 py-3">
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
              isPos 
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' 
                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
            }">
              <span>${isPos ? '🟢' : '🔴'}</span>
              <span>${isPos ? 'เชิงบวก (+)' : 'เชิงลบ (-)'}</span>
            </span>
          </td>
          <td class="px-4 py-3 font-mono text-slate-500 dark:text-slate-400">
            ${item.weight > 0 ? '+' : ''}${item.weight}
          </td>
          <td class="px-4 py-3 text-slate-400 text-[11px]">
            ${item.added_at || '-'}
          </td>
          <td class="px-4 py-3 text-right">
            <div class="inline-flex items-center gap-2">
              <button
                type="button"
                class="btn-toggle-vocab px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                title="สลับขั้วอารมณ์"
              >
                สลับเป็น ${isPos ? 'ลบ (-)' : 'บวก (+)'}
              </button>
              <button
                type="button"
                class="btn-delete-vocab p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                title="ลบคำศัพท์"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              </button>
            </div>
          </td>
        `;

        tr.querySelector(".btn-toggle-vocab").onclick = () => {
          teachWord(item.word, isPos ? "Negative" : "Positive", item.weight);
        };
        tr.querySelector(".btn-delete-vocab").onclick = () => {
          removeTaughtWord(item.word);
        };

        tableBody.appendChild(tr);
      });
    }
  }

  // Vocab Tab Event Listeners
  const addCustomWordForm = document.getElementById("addCustomWordForm");
  const newWordInput = document.getElementById("newWordInput");
  const newWordSentiment = document.getElementById("newWordSentiment");
  const vocabSearchInput = document.getElementById("vocabSearchInput");
  const exportVocabBtn = document.getElementById("exportVocabBtn");
  const clearAllVocabBtn = document.getElementById("clearAllVocabBtn");

  if (addCustomWordForm && newWordInput && newWordSentiment) {
    addCustomWordForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const word = newWordInput.value.trim();
      if (!word) return;
      teachWord(word, newWordSentiment.value);
      newWordInput.value = "";
    });
  }

  if (vocabSearchInput) {
    vocabSearchInput.addEventListener("input", () => {
      renderVocabTab();
    });
  }

  if (exportVocabBtn) {
    exportVocabBtn.addEventListener("click", () => {
      const vocab = getCustomVocab();
      const count = Object.keys(vocab).length;
      if (count === 0) {
        showToast("ยังไม่มีคำศัพท์สำหรับส่งออก", "warning");
        return;
      }
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(vocab, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `custom_vocabulary_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast("ส่งออกไฟล์ JSON สำเร็จแล้ว", "success");
    });
  }

  if (clearAllVocabBtn) {
    clearAllVocabBtn.addEventListener("click", () => {
      clearAllTaughtWords();
    });
  }

  // Initial badge update & sync
  updateVocabBadge();

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
        const isUnknown = row.sentiment === "Uncertain";
        const isPos = row.sentiment === "Positive";
        const tr = document.createElement("tr");
        tr.className = "border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors";
        
        let badgeHtml = "";
        if (isUnknown) {
          badgeHtml = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">⚠️ ไม่แน่ใจ</span>`;
        } else if (isPos) {
          badgeHtml = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">🟢 เชิงบวก</span>`;
        } else {
          badgeHtml = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">🔴 เชิงลบ</span>`;
        }

        const barColor = isUnknown ? 'bg-amber-500' : (isPos ? 'bg-emerald-500' : 'bg-rose-500');
        const textColor = isUnknown ? 'text-amber-600 dark:text-amber-400' : (isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400');

        tr.innerHTML = `
          <td class="py-3 px-3 text-xs text-slate-400 font-mono">${startIdx + idx + 1}</td>
          <td class="py-3 px-3 text-sm text-slate-800 dark:text-slate-200 max-w-xs md:max-w-md truncate" title="${escapeHtml(row.text)}">${escapeHtml(row.text)}</td>
          <td class="py-3 px-3">
            ${badgeHtml}
          </td>
          <td class="py-3 px-3">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold ${textColor}">${row.confidence}%</span>
              <div class="w-16 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div class="h-full ${barColor}" style="width: ${row.confidence}%"></div>
              </div>
            </div>
          </td>
          <td class="py-3 px-3 text-xs text-slate-500 dark:text-slate-400">${escapeHtml(row.top_keywords || '-')}</td>
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
