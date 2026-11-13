/* CalculaHTML — calculator engine */
(function () {
  "use strict";

  const displayExpr = document.getElementById("expr");
  const displayResult = document.getElementById("result");
  const displayMem = document.getElementById("memIndicator");
  const angleIndicator = document.getElementById("angleIndicator");
  const historyList = document.getElementById("historyList");
  const memoryList = document.getElementById("memoryList");
  const themeSelect = document.getElementById("themeSelect");
  const toast = document.getElementById("toast");

  let current = "0";
  let previous = "";
  let operator = null;
  let justEvaluated = false;
  let memory = 0;
  let hasMemory = false;
  const history = [];
  const undoStack = [];
  const redoStack = [];

  const settings = loadSettings();

  function loadSettings() {
    const defaults = { sound: false, haptics: true, thousands: true, precision: 12 };
    try {
      const raw = localStorage.getItem("calc-settings");
      return raw ? Object.assign(defaults, JSON.parse(raw)) : defaults;
    } catch (e) { return defaults; }
  }
  function saveSettings() {
    try { localStorage.setItem("calc-settings", JSON.stringify(settings)); } catch (e) {}
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("show"), 1600);
  }

  function formatNumber(n) {
    if (Number.isNaN(n) || !Number.isFinite(n)) return "Error";
    if (typeof n === "string") return n;
    if (!isFinite(n)) return String(n);
    let s = String(n);
    if (s.includes("e") || s.includes("E")) return s;
    if (s.length > 14) {
      const fixed = n.toPrecision(settings.precision || 12);
      return parseFloat(fixed).toString();
    }
    return s;
  }

  function groupThousands(s) {
    if (!settings.thousands) return s;
    if (typeof s !== "string") return String(s);
    if (s.includes("e") || s.includes("E")) return s;
    const m = /^(-?)(\d+)(\.\d*)?$/.exec(s);
    if (!m) return s;
    const grouped = m[2].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return m[1] + grouped + (m[3] || "");
  }

  function updateDisplay() {
    displayResult.textContent = groupThousands(current);
    if (operator && !justEvaluated) {
      displayExpr.textContent = (previous || "") + " " + symbolFor(operator);
    } else if (justEvaluated && previous) {
      displayExpr.textContent = previous.includes(" ") ? previous : "";
    } else {
      displayExpr.textContent = "";
    }
    if (hasMemory) {
      displayMem.textContent = "M";
      displayMem.classList.remove("inactive");
    } else {
      displayMem.textContent = "";
      displayMem.classList.add("inactive");
    }
    angleIndicator.textContent = angleMode.toUpperCase();
  const copyBtn = document.getElementById("copyBtn");
  if (copyBtn) {
    copyBtn.disabled = (current === "Error");
  }
  }

  function symbolFor(op) {
    return { "+": "+", "-": "−", "*": "×", "/": "÷", "^": "^", "%": "%" }[op] || op;
  }

  function pushHistory(expr, result) {
    history.unshift({ expr, result });
    if (history.length > 100) history.pop();
    renderHistory();
  }
  function renderHistory() {
    if (history.length === 0) {
      historyList.innerHTML = '<div class="empty">No calculations yet</div>';
      return;
    }
    historyList.innerHTML = history.map((h, i) =>
      `<div class="row" data-i="${i}" title="Click to reuse result"><span class="e">${escapeHtml(h.expr)}</span><span class="r">${escapeHtml(h.result)}</span><button class="hist-del" data-del="${i}" title="Delete">×</button></div>`
    ).join("");
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  historyList.addEventListener("click", (ev) => {
    const del = ev.target.closest(".hist-del");
    if (del) {
      const i = Number(del.dataset.del);
      if (!isNaN(i) && history[i]) { history.splice(i, 1); renderHistory(); }
      return;
    }
    const row = ev.target.closest(".row");
    if (!row) return;
    const h = history[Number(row.dataset.i)];
    if (!h) return;
    current = h.result;
    justEvaluated = false;
    operator = null;
    previous = "";
    updateDisplay();
    showToast("Result loaded");
  });

  function inputDigit(d) {
    if (justEvaluated || current === "Error") { current = d === "." ? "0." : d; justEvaluated = false; return; }
    if (d === ".") {
      if (current.includes(".")) return;
      current += ".";
    } else {
      if (current === "0") current = d; else current += d;
    }
    if (current.length > 20) current = current.slice(0, 20);
  }

  function inputOperator(op) {
    if (current === "Error") { current = "0"; operator = null; justEvaluated = false; return; }
    if (operator && !justEvaluated) {
      evaluate(true);
    }
    previous = current;
    operator = op;
    justEvaluated = false;
    current = "0";
  }

  function evaluate(silent) {
    if (operator === null) { justEvaluated = true; return; }
    const a = parseFloat(previous);
    const b = parseFloat(current);
    let res;
    switch (operator) {
      case "+": res = a + b; break;
      case "-": res = a - b; break;
      case "*": res = a * b; break;
      case "/":
        if (b === 0) { shake(); current = "Error"; operator = null; previous = ""; justEvaluated = true; updateDisplay(); beep(220); return; }
        res = a / b; break;
      case "^": res = Math.pow(a, b); break;
      case "%": res = a % b; break;
      default: res = b;
    }
    const exprStr = previous + " " + symbolFor(operator) + " " + current;
    const resStr = formatNumber(res);
    if (!silent) pushHistory(exprStr, resStr);
    current = resStr;
    previous = exprStr;
    operator = null;
    justEvaluated = true;
  }

  function shake() {
    displayResult.classList.remove("shake");
    void displayResult.offsetWidth;
    displayResult.classList.add("shake");
  }

  function clearAll() {
    current = "0"; previous = ""; operator = null; justEvaluated = false;
  }
  function clearEntry() { current = "0"; }
  function backspace() {
    if (justEvaluated) return;
    if (current.length <= 1) current = "0";
    else current = current.slice(0, -1);
    if (current === "-" || current === "") current = "0";
  }
  function toggleSign() {
    if (current === "0" || current === "Error") return;
    if (current.startsWith("-")) current = current.slice(1);
    else current = "-" + current;
  }
  function percent() {
    const v = parseFloat(current);
    if (isNaN(v)) return;
    // Standard calculator semantics: with a pending + or -, "x%" means
    // "x% of the pending operand"; otherwise it is a plain /100.
    let result;
    if (previous !== "" && (operator === "+" || operator === "-")) {
      result = (parseFloat(previous) || 0) * v / 100;
    } else {
      result = v / 100;
    }
    current = formatNumber(result);
    justEvaluated = false;
  }

  const sci = {
    sin: (x) => Math.sin(toRad(x)),
    cos: (x) => Math.cos(toRad(x)),
    tan: (x) => Math.tan(toRad(x)),
    asin: (x) => toDeg(Math.asin(x)),
    acos: (x) => toDeg(Math.acos(x)),
    atan: (x) => toDeg(Math.atan(x)),
    sinh: (x) => Math.sinh(x),
    cosh: (x) => Math.cosh(x),
    tanh: (x) => Math.tanh(x),
    log: (x) => Math.log10(x),
    log2: (x) => Math.log2(x),
    ln: (x) => Math.log(x),
    sqrt: (x) => Math.sqrt(x),
    cbrt: (x) => Math.cbrt(x),
    sq: (x) => x * x,
    cb: (x) => x * x * x,
    inv: (x) => 1 / x,
    fact: (x) => factorial(Math.round(x)),
    abs: (x) => Math.abs(x),
    exp: (x) => Math.exp(x),
    floor: (x) => Math.floor(x),
    ceil: (x) => Math.ceil(x),
    round: (x) => Math.round(x),
    sign: (x) => Math.sign(x),
    rand: () => Math.random(),
  };
  let angleMode = "deg";
  function toRad(x) { return angleMode === "deg" ? (x * Math.PI / 180) : x; }
  function toDeg(x) { return angleMode === "deg" ? (x * 180 / Math.PI) : x; }
  function factorial(n) {
    if (n < 0) return NaN;
    if (n > 170) return Infinity;
    let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
  }

  function applySci(name) {
    const x = parseFloat(current);
    if (name === "pi") { current = formatNumber(Math.PI); justEvaluated = false; updateDisplay(); beep(660); return; }
    if (name === "e") { current = formatNumber(Math.E); justEvaluated = false; updateDisplay(); beep(660); return; }
    if (name === "tau") { current = formatNumber(Math.PI * 2); justEvaluated = false; updateDisplay(); beep(660); return; }
    if (name === "phi") { current = formatNumber((1 + Math.sqrt(5)) / 2); justEvaluated = false; updateDisplay(); beep(660); return; }
    if (name === "pow10") { current = formatNumber(Math.pow(10, x)); justEvaluated = true; pushHistory("10^(" + x + ")", current); updateDisplay(); beep(550); return; }
    if (name === "pow2") { current = formatNumber(Math.pow(2, x)); justEvaluated = true; pushHistory("2^(" + x + ")", current); updateDisplay(); beep(550); return; }
    if (name === "yroot") {
      // use current as y, ask? Use previous? Simplify: sqrt of x already; yroot needs two operands. Implement as x^(1/y) using previous? Skip complex; use nth root via prompt
      const n = parseFloat(prompt("Root degree n:", "2"));
      if (isNaN(n) || n === 0) return;
      const r = Math.pow(x, 1 / n);
      pushHistory(n + "√(" + x + ")", formatNumber(r));
      current = formatNumber(r); justEvaluated = true; updateDisplay(); return;
    }
    if (name === "nCr") {
      const n = Math.round(x);
      const r = Math.round(parseFloat(prompt("r:", "0")));
      if (isNaN(r)) return;
      current = formatNumber(comb(n, r)); justEvaluated = true;
      pushHistory("C(" + n + "," + r + ")", current); updateDisplay(); return;
    }
    if (name === "nPr") {
      const n = Math.round(x);
      const r = Math.round(parseFloat(prompt("r:", "0")));
      if (isNaN(r)) return;
      current = formatNumber(perm(n, r)); justEvaluated = true;
      pushHistory("P(" + n + "," + r + ")", current); updateDisplay(); return;
    }
    if (name === "mod") {
      const m = parseFloat(prompt("modulus:", "1"));
      if (isNaN(m) || m === 0) return;
      const r = x % m;
      pushHistory("mod(" + x + "," + m + ")", formatNumber(r));
      current = formatNumber(r); justEvaluated = true; updateDisplay(); return;
    }
    if (name === "rand") {
      current = formatNumber(Math.random()); justEvaluated = false; updateDisplay(); return;
    }
    if (sci[name]) {
      let res;
      try { res = sci[name](x); } catch (e) { res = NaN; }
      const exprStr = name + "(" + current + ")";
      pushHistory(exprStr, formatNumber(res));
      current = formatNumber(res);
      justEvaluated = true;
    }
    updateDisplay();
    beep(550);
  }

  function comb(n, r) {
    if (r < 0 || r > n || n < 0) return NaN;
    let res = 1;
    for (let i = 1; i <= r; i++) res = res * (n - r + i) / i;
    return Math.round(res);
  }
  function perm(n, r) {
    if (r < 0 || r > n || n < 0) return NaN;
    let res = 1;
    for (let i = 0; i < r; i++) res *= (n - i);
    return res;
  }

  // Memory
  function memClear() { memory = 0; hasMemory = false; renderMemory(); updateDisplay(); showToast("MC"); }
  function memRecall() { current = formatNumber(memory); justEvaluated = false; updateDisplay(); showToast("MR"); }
  function memAdd() { memory += parseFloat(current) || 0; hasMemory = true; renderMemory(); showToast("M+"); }
  function memSub() { memory -= parseFloat(current) || 0; hasMemory = (memory !== 0); renderMemory(); showToast("M−"); }
  function memStore() { memory = parseFloat(current) || 0; hasMemory = true; renderMemory(); showToast("MS"); }
  function renderMemory() {
    if (!hasMemory) {
      memoryList.innerHTML = '<div class="empty">Memory empty</div>';
      return;
    }
    memoryList.innerHTML = `<div class="row"><span class="e">Memory</span><span class="r">${formatNumber(memory)}</span></div>`;
  }
  memoryList.addEventListener("click", () => { if (hasMemory) { memRecall(); } });

  // Theme handling
  const prefersDarkMQ = window.matchMedia("(prefers-color-scheme: dark)");
  function systemTheme() { return prefersDarkMQ.matches ? "dark" : "light"; }
  prefersDarkMQ.addEventListener("change", () => {
    const saved = (function(){try{return localStorage.getItem("calc-theme");}catch(e){return null;}})();
    if (saved === "system" || !saved) applyTheme("system");
  });

  function applyTheme(name) {
    const effective = name === "system" ? systemTheme() : name;
    document.documentElement.setAttribute("data-theme", effective);
    try { localStorage.setItem("calc-theme", name); } catch (e) {}
    themeSelect.value = name;
    document.querySelectorAll(".theme-swatches button").forEach(b => {
      b.classList.toggle("active", b.dataset.theme === effective);
    });
    const tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.setAttribute("content", getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#7c9cff");
  }
  const savedTheme = (() => { try { return localStorage.getItem("calc-theme"); } catch(e){return null;} })();
  applyTheme(savedTheme || "system");

  themeSelect.addEventListener("change", (e) => applyTheme(e.target.value));
  document.querySelectorAll(".theme-swatches button").forEach(btn => {
    btn.addEventListener("click", () => applyTheme(btn.dataset.theme));
  });

  // Greenit info modal
  const greenitModal = document.getElementById("greenitModal");
  const greenitInfoBtn = document.getElementById("greenitInfoBtn");
  const greenitClose = document.getElementById("greenitClose");
  if (greenitInfoBtn) greenitInfoBtn.addEventListener("click", () => {
    greenitModal.classList.add("show");
    greenitModal.setAttribute("aria-hidden", "false");
  });
  if (greenitClose) greenitClose.addEventListener("click", () => {
    greenitModal.classList.remove("show");
    greenitModal.setAttribute("aria-hidden", "true");
  });
  if (greenitModal) greenitModal.addEventListener("click", (e) => {
    if (e.target === greenitModal) {
      greenitModal.classList.remove("show");
      greenitModal.setAttribute("aria-hidden", "true");
    }
  });

  // v1.1.0: keyboard-shortcuts help modal (? toggles it)
  const helpModal = document.getElementById("helpModal");
  const helpClose = document.getElementById("helpClose");
  function openHelp() {
    if (!helpModal) return;
    helpModal.classList.add("show");
    helpModal.setAttribute("aria-hidden", "false");
  }
  function closeHelp() {
    if (!helpModal) return;
    helpModal.classList.remove("show");
    helpModal.setAttribute("aria-hidden", "true");
  }
  if (helpClose) helpClose.addEventListener("click", closeHelp);
  if (helpModal) helpModal.addEventListener("click", (e) => {
    if (e.target === helpModal) closeHelp();
  });

  // Settings modal
  const settingsModal = document.getElementById("settingsModal");
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsClose = document.getElementById("settingsClose");
  function openSettings() {
    if (!settingsModal) return;
    syncSettingsUI();
    settingsModal.classList.add("show");
    settingsModal.setAttribute("aria-hidden", "false");
  }
  function closeSettings() {
    if (!settingsModal) return;
    settingsModal.classList.remove("show");
    settingsModal.setAttribute("aria-hidden", "true");
  }
  if (settingsBtn) settingsBtn.addEventListener("click", openSettings);
  if (settingsClose) settingsClose.addEventListener("click", closeSettings);
  if (settingsModal) settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) closeSettings();
  });

  function syncSettingsUI() {
    const sSound = document.getElementById("setSound");
    const sHaptics = document.getElementById("setHaptics");
    const sThousands = document.getElementById("setThousands");
    const sPrecision = document.getElementById("setPrecision");
    if (sSound) sSound.checked = settings.sound;
    if (sHaptics) sHaptics.checked = settings.haptics;
    if (sThousands) sThousands.checked = settings.thousands;
    if (sPrecision) sPrecision.value = settings.precision;
  }
  document.addEventListener("change", (e) => {
    if (e.target && e.target.id === "setSound") { settings.sound = e.target.checked; saveSettings(); }
    if (e.target && e.target.id === "setHaptics") { settings.haptics = e.target.checked; saveSettings(); }
    if (e.target && e.target.id === "setThousands") { settings.thousands = e.target.checked; saveSettings(); updateDisplay(); }
    if (e.target && e.target.id === "setPrecision") { settings.precision = parseInt(e.target.value, 10) || 12; saveSettings(); }
  });

  // Undo / redo
  function snapshot() { return { current, previous, operator, justEvaluated, memory, hasMemory, history: history.slice() }; }
  function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > 60) undoStack.shift(); redoStack.length = 0; }
  function restoreSnap(s) {
    current = s.current; previous = s.previous; operator = s.operator; justEvaluated = s.justEvaluated;
    memory = s.memory; hasMemory = s.hasMemory;
    if (s.history) { history.length = 0; history.push(...s.history); renderHistory(); }
    renderMemory(); updateDisplay();
  }
  function undo() {
    if (!undoStack.length) { showToast("Nothing to undo"); return; }
    redoStack.push(snapshot());
    restoreSnap(undoStack.pop());
    showToast("Undo");
  }
  function redo() {
    if (!redoStack.length) { showToast("Nothing to redo"); return; }
    undoStack.push(snapshot());
    restoreSnap(redoStack.pop());
    showToast("Redo");
  }

  // Copy result
  function copyResult() {
    const txt = current;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(txt).then(() => showToast("Copied")).catch(() => showToast("Copy failed"));
    } else {
      showToast("Clipboard unavailable");
    }
  }

  // Export history
  const copyBtn = document.getElementById("copyBtn");
  if (copyBtn) copyBtn.addEventListener("click", () => { copyResult(); });
  // >>> CSV_BEGIN — pure, extracted by tests/test_csv.mjs (keep DOM-free)
  // RFC 4180 CSV: quote everything that contains a comma, quote or newline,
  // and double embedded quotes. Keeps spreadsheet imports sane for
  // expressions like `1,2+3` or quoted strings from the expression tape.
  function csvCell(value) {
    const s = String(value);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function historyToCsv(entries) {
    const rows = [["expression", "result"].map(csvCell).join(",")];
    for (const h of entries) {
      rows.push([csvCell(h.expr), csvCell(h.result)].join(","));
    }
    return rows.join("\n") + "\n";
  }
  // <<< CSV_END

  const exportHistoryBtn = document.getElementById("exportHistory");
  if (exportHistoryBtn) exportHistoryBtn.addEventListener("click", () => {
    if (!history.length) { showToast("No history"); return; }
    const text = history.map(h => h.expr + " = " + h.result).join("\n");
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => showToast("History copied")).catch(() => showToast("Copy failed"));
    } else showToast("Clipboard unavailable");
  });
  // v1.1.0: download the tape as CSV for spreadsheets / record keeping.
  const downloadHistoryBtn = document.getElementById("downloadHistory");
  if (downloadHistoryBtn) downloadHistoryBtn.addEventListener("click", () => {
    if (!history.length) { showToast("No history to export"); return; }
    try {
      const blob = new Blob([historyToCsv(history)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "calcula-history.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoking immediately can cancel the in-flight download in Firefox;
      // give the browser time to pick the blob up.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      showToast("History exported");
    } catch (e) {
      showToast("Export failed");
    }
  });
  const clearHistoryBtn = document.getElementById("clearHistory");
  if (clearHistoryBtn) clearHistoryBtn.addEventListener("click", () => { history.length = 0; renderHistory(); });

  // Memory clear button
  const clearMemoryBtn = document.getElementById("clearMemory");
  if (clearMemoryBtn) clearMemoryBtn.addEventListener("click", () => { memClear(); });

  // Button handling
  document.querySelectorAll(".btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const mutating = btn.dataset.action && !["copy","history-clear","settings","undo","redo"].includes(btn.dataset.action);
      // mem actions mutate
      if (mutating) pushUndo();
      handleAction(btn.dataset.action, btn);
      haptic();
      if (mutating) beep(480);
    });
  });

  const sciContainers = document.querySelectorAll(".key-row.sci-row");

  let calcMode = "scientific";
  const modeToggle = document.getElementById("modeToggle");
  function setMode(mode) {
    calcMode = mode;
    document.documentElement.setAttribute("data-mode", mode);
    if (modeToggle) {
      modeToggle.textContent = mode === "scientific" ? "Scientific" : "Basic";
      modeToggle.classList.toggle("basic", mode === "basic");
    }
    sciContainers.forEach((c) => {
      c.style.display = mode === "basic" ? "none" : "";
    });
    try { localStorage.setItem("calc-mode", mode); } catch (e) {}
  }
  if (modeToggle) modeToggle.addEventListener("click", () => setMode(calcMode === "scientific" ? "basic" : "scientific"));
  const undoBtn = document.getElementById("undoBtn");
  const redoBtn = document.getElementById("redoBtn");
  if (undoBtn) undoBtn.addEventListener("click", () => { undo(); });
  if (redoBtn) redoBtn.addEventListener("click", () => { redo(); });
  try {
    const savedMode = localStorage.getItem("calc-mode");
    setMode(savedMode === "basic" ? "basic" : "scientific");
  } catch (e) { setMode("scientific"); }

  function handleAction(action, btn) {
    if (!action) return;
    switch (action) {
      case "digit": inputDigit(btn.dataset.value); break;
      case "dot": inputDigit("."); break;
      case "op": inputOperator(btn.dataset.value); break;
      case "equals": evaluate(false); break;
      case "clear": clearAll(); break;
      case "ce": clearEntry(); break;
      case "back": backspace(); break;
      case "sign": toggleSign(); break;
      case "percent": percent(); break;
      case "sci": applySci(btn.dataset.value); break;
      case "const": applySci(btn.dataset.value); break;
      case "mem":
        switch (btn.dataset.value) {
          case "mc": memClear(); break;
          case "mr": memRecall(); break;
          case "mplus": memAdd(); break;
          case "mminus": memSub(); break;
          case "ms": memStore(); break;
        }
        break;
      case "angle":
        angleMode = angleMode === "deg" ? "rad" : "deg";
        if (btn) btn.textContent = angleMode.toUpperCase();
        showToast("Angle: " + angleMode.toUpperCase());
        break;
      case "copy": copyResult(); break;
      case "undo": undo(); break;
      case "redo": redo(); break;
      case "history-clear":
        history.length = 0; renderHistory(); break;
      default: break;
    }
    updateDisplay();
  }

  // Keyboard support
  const keyMap = {
    "0":"0","1":"1","2":"2","3":"3","4":"4","5":"5","6":"6","7":"7","8":"8","9":"9",
    ".":"dot", ",":"dot",
    "+":"+", "-":"-", "*":"*", "x":"*", "X":"*", "/":"÷", "^":"^",
    "Enter":"=", "=":"=",
    "Backspace":"back", "Delete":"ce", "Escape":"clear",
    "%":"percent",
  };
  window.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey) {
      if (e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); updateDisplay(); }
      if (e.key.toLowerCase() === "c") { /* allow copy text */ }
      return;
    }
    const k = e.key;
    // ? toggles the shortcut help from anywhere (Shift+? on most layouts);
    // Esc closes it first (v1.1.0)
    if (k === "?") {
      e.preventDefault();
      if (helpModal && helpModal.classList.contains("show")) closeHelp();
      else openHelp();
      return;
    }
    if (k === "Escape" && helpModal && helpModal.classList.contains("show")) {
      e.preventDefault();
      closeHelp();
      return;
    }
    if (keyMap[k] !== undefined) {
      e.preventDefault();
      const v = keyMap[k];
      if (v === "dot") { pushUndo(); inputDigit("."); updateDisplay(); haptic(); return; }
      if (["0","1","2","3","4","5","6","7","8","9"].includes(v)) { pushUndo(); inputDigit(v); updateDisplay(); haptic(); return; }
      if (v === "=") { pushUndo(); evaluate(false); updateDisplay(); haptic(); return; }
      if (v === "back") { pushUndo(); backspace(); updateDisplay(); haptic(); return; }
      if (v === "ce") { pushUndo(); clearEntry(); updateDisplay(); haptic(); return; }
      if (v === "clear") { pushUndo(); clearAll(); updateDisplay(); haptic(); return; }
      if (v === "percent") { pushUndo(); percent(); updateDisplay(); haptic(); return; }
      const opMap = {"+":"+","-":"-","*":"*","÷":"/","^":"^"};
      if (opMap[v]) { pushUndo(); inputOperator(opMap[v]); updateDisplay(); haptic(); return; }
    }
  });

  angleIndicator.style.cursor = "pointer";
  angleIndicator.addEventListener("click", () => {
    angleMode = angleMode === "deg" ? "rad" : "deg";
    angleIndicator.textContent = angleMode.toUpperCase();
    showToast("Angle: " + angleMode.toUpperCase());
    updateDisplay();
  });

  // Haptics / sound
  function haptic() {
    if (settings.haptics && navigator.vibrate) {
      try { navigator.vibrate(8); } catch (e) {}
    }
  }
  let audioCtx;
  function beep(freq) {
    if (!settings.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.frequency.value = freq || 440;
      g.gain.value = 0.04;
      o.start();
      o.stop(audioCtx.currentTime + 0.04);
    } catch (e) {}
  }

  // PWA install prompt
  let deferredPrompt = null;
  const installBtn = document.getElementById("installBtn");
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.hidden = false;
  });
  if (installBtn) installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.hidden = true;
  });
  window.addEventListener("appinstalled", () => { if (installBtn) installBtn.hidden = true; showToast("Installed"); });

  // Init
  angleIndicator.textContent = angleMode.toUpperCase();
  renderHistory();
  renderMemory();
  updateDisplay();
  syncSettingsUI();
})();
