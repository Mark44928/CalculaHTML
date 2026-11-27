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
  const history = loadHistory();
  const undoStack = [];
  const redoStack = [];

  const settings = loadSettings();

  // >>> SETTINGS_BEGIN — pure, extracted by tests/test_logic.mjs (keep DOM-free)
  function loadSettings() {
    const defaults = { sound: false, haptics: true, thousands: true, precision: 12 };
    try {
      const raw = localStorage.getItem("calc-settings");
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return { ...defaults };
      const precision = Number(parsed.precision);
      return {
        sound: typeof parsed.sound === "boolean" ? parsed.sound : defaults.sound,
        haptics: typeof parsed.haptics === "boolean" ? parsed.haptics : defaults.haptics,
        thousands: typeof parsed.thousands === "boolean" ? parsed.thousands : defaults.thousands,
        precision: Number.isFinite(precision) ? Math.min(100, Math.max(1, Math.round(precision))) : defaults.precision,
      };
    } catch (e) { return { ...defaults }; }
  }
  // <<< SETTINGS_END
  function saveSettings() {
    try { localStorage.setItem("calc-settings", JSON.stringify(settings)); } catch (e) {}
  }

  // >>> HISTORYSTORE_BEGIN — hostile stored data is filtered, not trusted
  function parseHistory(raw) {
    let parsed;
    try { parsed = JSON.parse(raw || "[]"); } catch (e) { return []; }
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((h) => h && typeof h.expr === "string" && typeof h.result === "string").slice(0, 100);
  }
  function loadHistory() {
    try { return parseHistory(localStorage.getItem("calc-history")); } catch (e) { return []; }
  }
  function saveHistory() {
    try { localStorage.setItem("calc-history", JSON.stringify(history)); } catch (e) {}
  }
  // <<< HISTORYSTORE_END

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("show"), 1600);
  }

  function formatNumber(n) {
    if (Number.isNaN(n) || !Number.isFinite(n)) return "Error";
    if (typeof n === "string") return n;
    if (Object.is(n, -0)) n = 0; // avoid "-0" in results
    if (!isFinite(n)) return String(n);
    let s = String(n);
    if (s.includes("e") || s.includes("E")) return s;
    if (Number.isSafeInteger(n)) return s; // don't mangle exact integers to 12 digits
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
    renderBases();
  }

  function renderBases() {
    const hex = document.getElementById("baseHex");
    const bin = document.getElementById("baseBin");
    const oct = document.getElementById("baseOct");
    if (!hex || !bin || !oct) return;
    const n = Number(current);
    const usable = Number.isFinite(n) && Number.isInteger(n) && Math.abs(n) < 9007199254740992;
    const asBase = (base) => usable
      ? (n < 0 ? "-" : "") + Math.abs(n).toString(base).toUpperCase()
      : "—";
    hex.textContent = asBase(16);
    bin.textContent = asBase(2);
    oct.textContent = asBase(8);
  }

  document.querySelectorAll(".base-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = btn.querySelector("b")?.textContent || "";
      if (!value || value === "—") return;
      if (navigator.clipboard) navigator.clipboard.writeText(value).then(() => showToast("Copied " + btn.dataset.copy.toUpperCase())).catch(() => showToast("Copy failed"));
      else showToast("Clipboard unavailable");
    });
  });

  function symbolFor(op) {
    return { "+": "+", "-": "−", "*": "×", "/": "÷", "^": "^", "%": "%" }[op] || op;
  }

  function pushHistory(expr, result) {
    history.unshift({ expr, result });
    if (history.length > 100) history.pop();
    renderHistory();
  }
  function renderHistory() {
    saveHistory();
    if (history.length === 0) {
      historyList.innerHTML = '<div class="empty">No calculations yet</div>';
      return;
    }
    historyList.innerHTML = history.map((h, i) =>
      `<div class="row" data-i="${i}" title="Click to reuse result"><span class="e">${escapeHtml(h.expr)}</span><span class="r">${escapeHtml(h.result)}</span><button class="hist-del" data-del="${i}" title="Delete" aria-label="Delete history entry">×</button></div>`
    ).join("");
  }
  // >>> HISTORYNAV_BEGIN
  function historyMove(entries, cursor, draft, current, direction) {
    if (!entries.length) return { current, cursor, draft };
    if (cursor >= entries.length) cursor = entries.length - 1;
    if (direction > 0) {
      if (cursor === -1) { draft = current; cursor = 0; }
      else if (cursor < entries.length - 1) cursor += 1;
      return { current: entries[cursor].expr, cursor, draft };
    }
    if (cursor === -1) return { current, cursor, draft };
    if (cursor === 0) return { current: draft, cursor: -1, draft };
    cursor -= 1;
    return { current: entries[cursor].expr, cursor, draft };
  }
  // <<< HISTORYNAV_END

  let historyCursor = -1;
  let historyDraft = "0";
  function resetHistoryCursor() {
    historyCursor = -1;
    historyDraft = current;
  }
  function recallHistory(direction) {
    const next = historyMove(history, historyCursor, historyDraft, current, direction);
    historyCursor = next.cursor;
    historyDraft = next.draft;
    current = next.current;
    justEvaluated = false;
    operator = null;
    previous = "";
    updateDisplay();
  }

  historyList.addEventListener("click", (ev) => {
    const del = ev.target.closest(".hist-del");
    if (del) {
      const i = Number(del.dataset.del);
      if (!isNaN(i) && history[i]) { history.splice(i, 1); renderHistory(); resetHistoryCursor(); }
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
    resetHistoryCursor();
    updateDisplay();
    showToast("Result loaded");
  });

  function restoreSharedCalculation() {
    const shared = parseShareHash(location.hash);
    if (!shared) return;
    previous = shared.expr;
    current = shared.result || "0";
    operator = null;
    justEvaluated = true;
    if (shared.expr && shared.result) pushHistory(shared.expr, shared.result);
    resetHistoryCursor();
    updateDisplay();
    if (shared.expr) displayExpr.textContent = shared.expr;
    showToast("Shared calculation loaded");
  }

  function inputDigit(d) {
    resetHistoryCursor();
    if (justEvaluated || current === "Error") { current = d === "." ? "0." : d; justEvaluated = false; return; }
    if (d === ".") {
      if (current.includes(".")) return;
      current += ".";
    } else {
      if (current === "0") current = d; else current += d;
    }
    if (current.length > 20) current = current.slice(0, 20);
  }

  // >>> INPUTOP_BEGIN — pure, extracted by tests/test_logic.mjs (keep DOM-free)
  function inputOperator(op) {
    if (current === "Error") { current = "0"; operator = null; justEvaluated = false; return; }
    if (operator && !justEvaluated) {
      evaluate(true);
      // A failed chain (e.g. division by zero) must not arm the new operator
      // on top of the Error state, or every later "=" returns NaN.
      if (current === "Error") { justEvaluated = true; return; }
    }
    previous = current;
    operator = op;
    justEvaluated = false;
    current = "0";
  }
  // <<< INPUTOP_END

  function evaluate(silent) {
    resetHistoryCursor();
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
    resetHistoryCursor();
  }
  function clearEntry() { current = "0"; resetHistoryCursor(); }
  function backspace() {
    resetHistoryCursor();
    if (justEvaluated) return;
    if (current === "Error") { current = "0"; return; }
    if (current.length <= 1) current = "0";
    else current = current.slice(0, -1);
    if (current === "-" || current === "") current = "0";
  }
  function toggleSign() {
    resetHistoryCursor();
    if (current === "0" || current === "Error") return;
    if (current.startsWith("-")) current = current.slice(1);
    else current = "-" + current;
  }
  function percent() {
    resetHistoryCursor();
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
    if (!Number.isFinite(n) || n < 0) return NaN;
    if (n > 170) return Infinity;
    let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
  }

  function applySci(name) {
    resetHistoryCursor();
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
    if (!Number.isFinite(n) || !Number.isFinite(r) || r < 0 || r > n || n < 0 || n > 1e15) return NaN;
    r = Math.min(r, n - r); // C(n, r) === C(n, n - r); the smaller side keeps the loop bounded
    if (r > 1e6) return NaN;
    let res = 1;
    for (let i = 1; i <= r; i++) res = res * (n - r + i) / i;
    return Math.round(res);
  }
  function perm(n, r) {
    if (!Number.isFinite(n) || !Number.isFinite(r) || r < 0 || r > n || n < 0 || n > 1e15) return NaN;
    r = Math.min(r, n);
    if (r > 1e6) return NaN;
    let res = 1;
    for (let i = 0; i < r; i++) res *= (n - i);
    return res;
  }

  // Memory
  function memClear() { memory = 0; hasMemory = false; renderMemory(); updateDisplay(); showToast("MC"); }
  function memRecall() { current = formatNumber(memory); justEvaluated = false; resetHistoryCursor(); updateDisplay(); showToast("MR"); }
  // >>> MEM_BEGIN — pure, extracted by tests/test_logic.mjs (keep DOM-free)
  function memAdd() { const v = parseFloat(current); memory += Number.isFinite(v) ? v : 0; hasMemory = true; renderMemory(); showToast("M+"); }
  function memSub() { const v = parseFloat(current); memory -= Number.isFinite(v) ? v : 0; hasMemory = (memory !== 0); renderMemory(); showToast("M−"); }
  function memStore() { const v = parseFloat(current); memory = Number.isFinite(v) ? v : 0; hasMemory = true; renderMemory(); showToast("MS"); }
  // <<< MEM_END
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

  // >>> UNITS_BEGIN
  const UNIT_CATEGORIES = {
    length: { label: "Length", units: {
      m: ["Metre", 1], km: ["Kilometre", 1000], cm: ["Centimetre", 0.01], mm: ["Millimetre", 0.001],
      mi: ["Mile", 1609.344], yd: ["Yard", 0.9144], ft: ["Foot", 0.3048], in: ["Inch", 0.0254], nmi: ["Nautical mile", 1852],
    }},
    mass: { label: "Mass", units: {
      kg: ["Kilogram", 1], g: ["Gram", 0.001], mg: ["Milligram", 0.000001], t: ["Tonne", 1000],
      lb: ["Pound", 0.45359237], oz: ["Ounce", 0.028349523125], st: ["Stone", 6.35029318],
    }},
    temperature: { label: "Temperature", units: {
      C: ["Celsius", 1], F: ["Fahrenheit", 1], K: ["Kelvin", 1],
    }},
    data: { label: "Data", units: {
      B: ["Byte", 1], KB: ["Kilobyte", 1000], MB: ["Megabyte", 1e6], GB: ["Gigabyte", 1e9], TB: ["Terabyte", 1e12],
      KiB: ["Kibibyte", 1024], MiB: ["Mebibyte", 1048576], GiB: ["Gibibyte", 1073741824],
    }},
    speed: { label: "Speed", units: {
      mps: ["Metre/second", 1], kmh: ["Kilometre/hour", 1 / 3.6], mph: ["Mile/hour", 0.44704],
      knot: ["Knot", 0.5144444444], fps: ["Foot/second", 0.3048],
    }},
    time: { label: "Time", units: {
      s: ["Second", 1], min: ["Minute", 60], h: ["Hour", 3600], day: ["Day", 86400], week: ["Week", 604800],
    }},
    volume: { label: "Volume", units: {
      L: ["Litre", 1], mL: ["Millilitre", 0.001], gal: ["US gallon", 3.785411784],
      qt: ["US quart", 0.946352946], pt: ["US pint", 0.473176473], cup: ["US cup", 0.2365882365],
      floz: ["US fluid ounce", 0.0295735295625],
    }},
    area: { label: "Area", units: {
      m2: ["Square metre", 1], km2: ["Square kilometre", 1e6], ha: ["Hectare", 10000],
      acre: ["Acre", 4046.8564224], ft2: ["Square foot", 0.09290304], in2: ["Square inch", 0.00064516],
    }},
    energy: { label: "Energy", units: {
      J: ["Joule", 1], kJ: ["Kilojoule", 1000], cal: ["Calorie", 4.184], kcal: ["Kilocalorie", 4184],
      Wh: ["Watt-hour", 3600], kWh: ["Kilowatt-hour", 3.6e6], BTU: ["BTU", 1055.05585262],
    }},
  };
  function convertUnit(value, category, from, to) {
    const spec = UNIT_CATEGORIES[category];
    if (!spec || !(from in spec.units) || !(to in spec.units) || !Number.isFinite(value)) return NaN;
    if (category === "temperature") {
      const celsius = from === "C" ? value : from === "F" ? (value - 32) * 5 / 9 : value - 273.15;
      return to === "C" ? celsius : to === "F" ? celsius * 9 / 5 + 32 : celsius + 273.15;
    }
    return value * spec.units[from][1] / spec.units[to][1];
  }
  // <<< UNITS_END

  // >>> GRAPH_PRESETS_BEGIN
  const GRAPH_PRESETS_KEY = "calc-graph-presets";
  const GRAPH_BUILTINS = Object.freeze([
    { name: "Trig", expr: "sin(x), cos(x)", xmin: -6.29, xmax: 6.29 },
    { name: "Polynomial", expr: "x^2 - 4", xmin: -5, xmax: 5 },
    { name: "Exponential", expr: "exp(x), 2^x", xmin: -3, xmax: 3 },
    { name: "Reciprocal", expr: "1/x", xmin: 0.1, xmax: 10 },
    { name: "Logarithm", expr: "ln(x), log(x)", xmin: 0.1, xmax: 10 },
  ]);
  function graphPresetCleanName(value) {
    return String(value || "").trim().replace(/\s+/g, " ").slice(0, 40);
  }
  function graphPresetCleanExpr(value) {
    return String(value || "").trim().slice(0, 180);
  }
  function graphPresetClean(list) {
    if (!Array.isArray(list)) return [];
    const out = [];
    const seen = new Set();
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const name = graphPresetCleanName(item.name);
      const expr = graphPresetCleanExpr(item.expr);
      const xmin = Number(item.xmin), xmax = Number(item.xmax);
      const key = name.toLowerCase();
      if (!name || !expr || !Number.isFinite(xmin) || !Number.isFinite(xmax) || !(xmax > xmin) || seen.has(key)) continue;
      seen.add(key);
      out.push({ name, expr, xmin, xmax });
      if (out.length >= 12) break;
    }
    return out;
  }
  function graphPresetLoad(raw) {
    if (typeof raw !== "string" || !raw.trim()) return [];
    try { return graphPresetClean(JSON.parse(raw)); }
    catch (_) { return []; }
  }
  function graphPresetSerialize(list) {
    return JSON.stringify(graphPresetClean(list));
  }
  function graphPresetFind(list, name) {
    const key = graphPresetCleanName(name).toLowerCase();
    return (Array.isArray(list) ? list : []).find((item) => graphPresetCleanName(item.name).toLowerCase() === key) || null;
  }
  function graphPresetBuiltin(name) {
    const key = String(name || "").trim().toLowerCase();
    return GRAPH_BUILTINS.find((item) => item.name.toLowerCase() === key) || null;
  }
  // <<< GRAPH_PRESETS_END

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


  // v1.2.0: graph modal — safe, dependency-free f(x) compiler + canvas plot
  const graphBtn = document.getElementById("graphBtn");
  const graphClose = document.getElementById("graphClose");
  const graphModal = document.getElementById("graphModal");
  const graphExpr = document.getElementById("graphExpr");
  const graphXmin = document.getElementById("graphXmin");
  const graphXmax = document.getElementById("graphXmax");
  const graphDrawBtn = document.getElementById("graphDraw");
  const graphDownloadBtn = document.getElementById("graphDownload");
  const graphT = document.getElementById("graphT");
  const graphAnimBtn = document.getElementById("graphAnim");
  const graphPresetSelect = document.getElementById("graphPresetSelect");
  const graphPresetSave = document.getElementById("graphPresetSave");
  const graphPresetDelete = document.getElementById("graphPresetDelete");
  const graphCanvas = document.getElementById("graphCanvas");
  const graphMsg = document.getElementById("graphMsg");
  const graphArea = document.getElementById("graphArea");
  let graphPresets = [];
  let graphTime = 0;
  let graphFrame = null;

  const unitsBtn = document.getElementById("unitsBtn");
  const unitsModal = document.getElementById("unitsModal");
  const unitsClose = document.getElementById("unitsClose");
  const unitCat = document.getElementById("unitCat");
  const unitFrom = document.getElementById("unitFrom");
  const unitTo = document.getElementById("unitTo");
  const unitInput = document.getElementById("unitInput");
  const unitOut = document.getElementById("unitOut");
  const unitSwap = document.getElementById("unitSwap");
  const unitCopy = document.getElementById("unitCopy");
  const unitMsg = document.getElementById("unitMsg");

  function readGraphPresets() {
    let raw = "";
    try { raw = localStorage.getItem(GRAPH_PRESETS_KEY) || ""; } catch (_) {}
    graphPresets = graphPresetLoad(raw);
    return graphPresets;
  }
  function renderGraphPresets(selectedUserName) {
    if (!graphPresetSelect) return;
    readGraphPresets();
    const builtIns = GRAPH_BUILTINS.map((preset) => `<option value="builtin:${preset.name}">${preset.name}</option>`).join("");
    const users = graphPresets.map((preset) => `<option value="user:${escapeHtml(preset.name)}"${selectedUserName === preset.name ? " selected" : ""}>${escapeHtml(preset.name)}</option>`).join("");
    graphPresetSelect.innerHTML = '<option value="">Presets…</option><optgroup label="Built-in">' + builtIns + '</optgroup>' + (users ? '<optgroup label="Saved">' + users + '</optgroup>' : '');
  }
  function applyGraphPreset(value) {
    if (!value) return false;
    const [kind, ...rest] = value.split(":");
    const name = rest.join(":");
    const preset = kind === "builtin" ? graphPresetBuiltin(name) : graphPresetFind(readGraphPresets(), name);
    if (!preset || !graphExpr || !graphXmin || !graphXmax) return false;
    graphExpr.value = preset.expr;
    graphXmin.value = String(preset.xmin);
    graphXmax.value = String(preset.xmax);
    drawGraph();
    return true;
  }
  function saveGraphPreset() {
    const name = graphPresetCleanName(window.prompt("Save graph preset as", graphExpr ? graphExpr.value : "") || "");
    if (!name || !graphExpr || !graphXmin || !graphXmax) return;
    const xmin = parseFloat(graphXmin.value), xmax = parseFloat(graphXmax.value);
    if (!Number.isFinite(xmin) || !Number.isFinite(xmax) || !(xmax > xmin)) {
      if (graphMsg) { graphMsg.textContent = "Set a valid x range before saving"; graphMsg.classList.add("err"); }
      return;
    }
    const next = readGraphPresets().filter((preset) => preset.name.toLowerCase() !== name.toLowerCase());
    if (next.length >= 12) {
      if (graphMsg) { graphMsg.classList.add("err"); graphMsg.textContent = "Preset list is full (12) — delete one first"; }
      return;
    }
    next.push({ name, expr: graphPresetCleanExpr(graphExpr.value), xmin, xmax });
    try { localStorage.setItem(GRAPH_PRESETS_KEY, graphPresetSerialize(next)); } catch (_) {}
    renderGraphPresets(name);
    if (graphMsg) { graphMsg.classList.remove("err"); graphMsg.textContent = `Saved preset “${name}”`; }
  }
  function deleteGraphPreset() {
    const selected = graphPresetSelect ? graphPresetSelect.value : "";
    const [kind, ...rest] = selected.split(":");
    const name = rest.join(":");
    if (kind !== "user" || !name) {
      if (graphMsg) { graphMsg.textContent = "Select a saved preset first"; graphMsg.classList.add("err"); }
      return;
    }
    if (!window.confirm(`Delete preset “${name}”?`)) return;
    const next = readGraphPresets().filter((preset) => preset.name.toLowerCase() !== name.toLowerCase());
    try { localStorage.setItem(GRAPH_PRESETS_KEY, graphPresetSerialize(next)); } catch (_) {}
    renderGraphPresets("");
    if (graphMsg) { graphMsg.classList.remove("err"); graphMsg.textContent = `Deleted preset “${name}”`; }
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function compileExpression(src, graphT = 0) {
    const s = String(src).toLowerCase()
      .replace(/\s+/g, "").replace(/−/g, "-").replace(/×/g, "*")
      .replace(/÷/g, "/").replace(/π/g, "pi");
    let i = 0;
    const peek = () => s[i] || "";
    const eat = (ch) => { if (s[i] === ch) { i++; return true; } return false; };
    const deg = () => angleMode.toUpperCase() === "DEG";
    const toRad = (v) => deg() ? v * Math.PI / 180 : v;
    const fromRad = (v) => deg() ? v * 180 / Math.PI : v;
    const fnTable = {
      sin: (v) => Math.sin(toRad(v)), cos: (v) => Math.cos(toRad(v)),
      tan: (v) => Math.tan(toRad(v)),
      asin: (v) => fromRad(Math.asin(v)), acos: (v) => fromRad(Math.acos(v)),
      atan: (v) => fromRad(Math.atan(v)),
      sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
      sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, exp: Math.exp,
      ln: Math.log, log: Math.log10, log2: Math.log2,
      floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign,
    };
    function atom() {
      if (eat("(")) { const v = expr(); if (!eat(")")) throw new Error("missing )"); return v; }
      const num = /^\d*\.?\d+(?:e[+-]?\d+)?/.exec(s.slice(i));
      if (num) { i += num[0].length; const n = parseFloat(num[0]); return () => n; }
      const id = /^[a-z][a-z0-9]*/.exec(s.slice(i));
      if (id) {
        const name = id[0]; i += name.length;
        if (name === "x") return (x) => x;
        if (name === "t") return () => graphT;
        if (name === "pi") return () => Math.PI;
        if (name === "tau") return () => 2 * Math.PI;
        if (name === "phi") return () => (1 + Math.sqrt(5)) / 2;
        if (name === "e") return () => Math.E;
        if (fnTable[name] && peek() === "(") {
          eat("("); const arg = expr(); if (!eat(")")) throw new Error("missing ) after " + name);
          const f = fnTable[name];
          return (x) => f(arg(x));
        }
        throw new Error("unknown name: " + name);
      }
      throw new Error("unexpected '" + (peek() || "end") + "'");
    }
    function power() {
      const base = atom();
      if (eat("^")) { const exp = unary(); return (x) => Math.pow(base(x), exp(x)); }
      return base;
    }
    function unary() {
      if (eat("-")) { const v = unary(); return (x) => -v(x); }
      if (eat("+")) return unary();
      return power();
    }
    function term() {
      let left = unary();
      for (;;) {
        if (eat("*")) { const r = unary(); const l = left; left = (x) => l(x) * r(x); }
        else if (eat("/")) { const r = unary(); const l = left; left = (x) => l(x) / r(x); }
        else if (/[a-z0-9(]/.test(peek())) { const r = unary(); const l = left; left = (x) => l(x) * r(x); }
        else return left;
      }
    }
    function expr() {
      let left = term();
      for (;;) {
        if (eat("+")) { const r = term(); const l = left; left = (x) => l(x) + r(x); }
        else if (eat("-")) { const r = term(); const l = left; left = (x) => l(x) - r(x); }
        else return left;
      }
    }
    const fn = expr();
    if (i < s.length) throw new Error("unexpected '" + s[i] + "'");
    return fn;
  }

  function simpsonArea(fn, x0, x1) {
    const n = 1000;
    const h = (x1 - x0) / n;
    let sum = 0;
    for (let k = 0; k <= n; k++) {
      let y;
      try { y = fn(x0 + h * k); } catch (_) { return NaN; }
      if (!Number.isFinite(y)) return NaN;
      sum += (k === 0 || k === n) ? y : (k % 2 === 0 ? 2 : 4) * y;
    }
    return (sum * h) / 3;
  }

  function isGraphOpen() { return !!graphModal && graphModal.classList.contains("show"); }
  function isUnitsOpen() { return !!unitsModal && unitsModal.classList.contains("show"); }
  function stopGraphAnimation() {
    if (graphFrame !== null) cancelAnimationFrame(graphFrame);
    graphFrame = null;
    if (graphAnimBtn) graphAnimBtn.textContent = "Play t";
  }
  function closeGraph() {
    stopGraphAnimation();
    if (!graphModal) return;
    graphModal.classList.remove("show");
    graphModal.setAttribute("aria-hidden", "true");
  }
  function openGraph() {
    if (!graphModal) return;
    if (isUnitsOpen()) closeUnits();
    if (!graphExpr.value.trim()) graphExpr.value = "sin(x)";
    if (graphT) graphT.value = String(graphTime);
    renderGraphPresets("");
    graphModal.classList.add("show");
    graphModal.setAttribute("aria-hidden", "false");
    drawGraph();
    graphExpr.focus();
    graphExpr.select();
  }

  function unitOptions(category) {
    return Object.entries(UNIT_CATEGORIES[category].units).map(([key, value]) => [key, value[0]]);
  }
  function fillUnitSelect(select, category, preferred) {
    if (!select) return;
    const options = unitOptions(category);
    select.innerHTML = options.map(([key, label]) => `<option value="${key}">${label}</option>`).join("");
    if (preferred && options.some(([key]) => key === preferred)) select.value = preferred;
  }
  function refreshUnits(reset) {
    if (!unitCat || !unitFrom || !unitTo) return;
    if (!unitCat.options.length) unitCat.innerHTML = Object.entries(UNIT_CATEGORIES).map(([key, value]) => `<option value="${key}">${value.label}</option>`).join("");
    const category = unitCat.value;
    if (reset) {
      const keys = Object.keys(UNIT_CATEGORIES[category].units);
      fillUnitSelect(unitFrom, category, keys[0]);
      fillUnitSelect(unitTo, category, keys[1] || keys[0]);
    }
    const fromLabel = unitFrom.options[unitFrom.selectedIndex]?.textContent || unitFrom.value;
    const toLabel = unitTo.options[unitTo.selectedIndex]?.textContent || unitTo.value;
    const value = parseFloat(unitInput.value);
    if (!Number.isFinite(value)) {
      unitOut.textContent = "—";
      unitMsg.textContent = "Enter a finite number";
      unitMsg.classList.add("err");
      return;
    }
    const converted = convertUnit(value, category, unitFrom.value, unitTo.value);
    if (!Number.isFinite(converted)) {
      unitOut.textContent = "—";
      unitMsg.textContent = "Unsupported conversion";
      unitMsg.classList.add("err");
      return;
    }
    unitMsg.classList.remove("err");
    unitOut.textContent = formatNumber(converted);
    unitMsg.textContent = `${value} ${fromLabel} = ${formatNumber(converted)} ${toLabel}`;
  }
  function openUnits() {
    if (!unitsModal) return;
    if (isGraphOpen()) closeGraph();
    const value = parseFloat(current);
    if (Number.isFinite(value)) unitInput.value = value;
    refreshUnits(true);
    unitsModal.classList.add("show");
    unitsModal.setAttribute("aria-hidden", "false");
    unitInput.focus();
    unitInput.select();
  }
  function closeUnits() {
    if (!unitsModal) return;
    unitsModal.classList.remove("show");
    unitsModal.setAttribute("aria-hidden", "true");
  }

  function drawGraph() {
    if (!graphCanvas || !graphCanvas.getContext) return false;
    const fail = (m) => { if (graphMsg) { graphMsg.textContent = m; graphMsg.classList.add("err"); } };
    if (graphMsg) graphMsg.classList.remove("err");
    const rawSrc = (graphExpr.value || "").trim();
    const src = rawSrc || "sin(x)";
    const parts = src.split(",").map((p) => p.trim()).filter(Boolean).slice(0, 3);
    const fns = [];
    for (const part of parts) {
      try { fns.push({ src: part, fn: compileExpression(part, graphTime) }); }
      catch (err) { fail("Parse error in “" + part + "”: " + err.message); return false; }
    }
    const x0 = parseFloat(graphXmin.value), x1 = parseFloat(graphXmax.value);
    if (!Number.isFinite(x0) || !Number.isFinite(x1) || !(x1 > x0)) { fail("x max must be greater than x min"); return false; }
    if (x1 - x0 > 1e7) { fail("range too wide"); return false; }

    const cvs = graphCanvas, ctx2 = cvs.getContext("2d");
    const cssW = Math.max(280, cvs.clientWidth || 720);
    const cssH = Math.max(220, Math.min(420, Math.round(cssW * 0.52)));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cvs.width = Math.round(cssW * dpr); cvs.height = Math.round(cssH * dpr);
    ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx2.clearRect(0, 0, cssW, cssH);

    const N = Math.max(240, Math.round(cssW * 2));
    const series = fns.map(() => []);
    let ymin = Infinity, ymax = -Infinity, any = false;
    for (let fi = 0; fi < fns.length; fi++) {
      for (let k = 0; k < N; k++) {
        const x = x0 + (x1 - x0) * k / (N - 1);
        let y;
        try { y = fns[fi].fn(x); } catch (e) { y = NaN; }
        series[fi].push([x, y]);
        if (Number.isFinite(y)) { ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); any = true; }
      }
    }
    if (!any) { fail("No real values of f(x) in that range"); return false; }
    if (!(ymax > ymin)) { const c = ymin; ymin = c - 1; ymax = c + 1; }
    const pad = (ymax - ymin) * 0.08; ymin -= pad; ymax += pad;

    const cs = getComputedStyle(document.documentElement);
    const colors = [
      (cs.getPropertyValue("--accent") || "#7c9cff").trim(),
      (cs.getPropertyValue("--accent-2") || "#a78bfa").trim(),
      (cs.getPropertyValue("--accent-3") || "#f472b6").trim(),
    ];
    const dim = (cs.getPropertyValue("--fg-dim") || "#8a909c").trim();
    const grid = (cs.getPropertyValue("--border") || "rgba(255,255,255,.1)").trim();
    const bg = (cs.getPropertyValue("--bg") || "#ffffff").trim();
    const X = (x) => (x - x0) / (x1 - x0) * cssW;
    const Y = (y) => cssH - (y - ymin) / (ymax - ymin) * cssH;

    ctx2.fillStyle = bg;
    ctx2.fillRect(0, 0, cssW, cssH);
    ctx2.strokeStyle = grid; ctx2.lineWidth = 1;
    for (let g = 0; g <= 8; g++) { const px = X(x0 + (x1 - x0) * g / 8); ctx2.beginPath(); ctx2.moveTo(px, 0); ctx2.lineTo(px, cssH); ctx2.stroke(); }
    for (let g = 0; g <= 6; g++) { const py = Y(ymin + (ymax - ymin) * g / 6); ctx2.beginPath(); ctx2.moveTo(0, py); ctx2.lineTo(cssW, py); ctx2.stroke(); }
    ctx2.strokeStyle = dim; ctx2.lineWidth = 1.25;
    if (ymin < 0 && ymax > 0) { const py = Y(0); ctx2.beginPath(); ctx2.moveTo(0, py); ctx2.lineTo(cssW, py); ctx2.stroke(); }
    if (x0 < 0 && x1 > 0) { const px = X(0); ctx2.beginPath(); ctx2.moveTo(px, 0); ctx2.lineTo(px, cssH); ctx2.stroke(); }

    ctx2.lineJoin = "round"; ctx2.lineCap = "round";
    series.forEach((pts, fi) => {
      ctx2.strokeStyle = colors[fi % colors.length];
      ctx2.lineWidth = 2;
      ctx2.beginPath();
      let started = false;
      for (const [x, y] of pts) {
        if (!Number.isFinite(y)) { started = false; continue; }
        if (!started) { ctx2.moveTo(X(x), Y(y)); started = true; }
        else ctx2.lineTo(X(x), Y(y));
      }
      ctx2.stroke();
    });

    ctx2.fillStyle = dim; ctx2.font = "11px ui-monospace, monospace";
    ctx2.textAlign = "left";
    ctx2.fillText("y " + ymin.toFixed(2) + " … " + ymax.toFixed(2), 8, 14);
    ctx2.textAlign = "right";
    ctx2.fillText("x " + x0 + " … " + x1, cssW - 8, cssH - 8);
    const baseMsg = fns.map((f, i) => "f" + (i + 1) + "(x) = " + f.src).join("   ·   ")
      + (parts.some((part) => /(^|[^a-z])t([^a-z]|$)/.test(part)) ? "   ·   t = " + graphTime.toFixed(2) : "");
    if (graphMsg) {
      if (graphArea && graphArea.checked) {
        const area = rawSrc ? simpsonArea(fns[0].fn, x0, x1) : NaN;
        if (Number.isFinite(area)) {
          const absArea = Math.abs(area);
          const areaText = (area !== 0 && (absArea >= 1e12 || absArea < 1e-9)) ? area.toExponential(6) : String(Number(area.toPrecision(10)));
          graphMsg.textContent = baseMsg + "   ·   ∫ f₁ dx ≈ " + areaText;
        } else {
          graphMsg.textContent = rawSrc ? "Area estimate unavailable: f₁ is not finite across the range" : "Estimate area: enter an expression first";
          graphMsg.classList.add("err");
          return true;
        }
      } else {
        graphMsg.textContent = baseMsg;
      }
    }
    return true;
  }

  function graphFrameStep() {
    if (!isGraphOpen()) { stopGraphAnimation(); return; }
    graphTime = (graphTime + 0.06) % (Math.PI * 2);
    if (graphT) graphT.value = String(graphTime);
    if (!drawGraph()) { stopGraphAnimation(); return; }
    graphFrame = requestAnimationFrame(graphFrameStep);
  }
  function toggleGraphAnimation() {
    if (graphFrame !== null) { stopGraphAnimation(); return; }
    graphTime = graphT ? (parseFloat(graphT.value) || 0) : graphTime;
    if (graphAnimBtn) graphAnimBtn.textContent = "Pause t";
    graphFrame = requestAnimationFrame(graphFrameStep);
  }

  if (graphClose) graphClose.addEventListener("click", closeGraph);
  if (graphModal) graphModal.addEventListener("click", (e) => { if (e.target === graphModal) closeGraph(); });
  if (graphBtn) graphBtn.addEventListener("click", openGraph);
  if (unitsBtn) unitsBtn.addEventListener("click", openUnits);
  if (unitsClose) unitsClose.addEventListener("click", closeUnits);
  if (unitsModal) unitsModal.addEventListener("click", (e) => { if (e.target === unitsModal) closeUnits(); });
  if (unitCat) unitCat.addEventListener("change", () => refreshUnits(true));
  if (unitFrom) unitFrom.addEventListener("change", () => refreshUnits(false));
  if (unitTo) unitTo.addEventListener("change", () => refreshUnits(false));
  if (unitInput) unitInput.addEventListener("input", () => refreshUnits(false));
  if (unitSwap) unitSwap.addEventListener("click", () => {
    const from = unitFrom.value;
    unitFrom.value = unitTo.value;
    unitTo.value = from;
    refreshUnits(false);
  });
  if (unitCopy) unitCopy.addEventListener("click", () => {
    const text = unitOut.textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => showToast("Converted value copied")).catch(() => showToast("Copy failed"));
    } else {
      showToast("Clipboard unavailable");
    }
  });
  if (graphDrawBtn) graphDrawBtn.addEventListener("click", drawGraph);
  if (graphArea) graphArea.addEventListener("change", drawGraph);
  if (graphAnimBtn) graphAnimBtn.addEventListener("click", toggleGraphAnimation);
  if (graphT) graphT.addEventListener("input", () => {
    stopGraphAnimation();
    graphTime = parseFloat(graphT.value) || 0;
    drawGraph();
  });
  if (graphPresetSelect) graphPresetSelect.addEventListener("change", () => { applyGraphPreset(graphPresetSelect.value); if (graphPresetSelect.value) graphPresetSelect.value = ""; });
  if (graphPresetSave) graphPresetSave.addEventListener("click", saveGraphPreset);
  if (graphPresetDelete) graphPresetDelete.addEventListener("click", deleteGraphPreset);
  if (graphDownloadBtn) graphDownloadBtn.addEventListener("click", () => {
    if (!graphCanvas || !graphCanvas.getContext) return;
    if (!drawGraph()) return;
    try {
      const link = document.createElement("a");
      link.href = graphCanvas.toDataURL("image/png");
      link.download = "calcula-graph.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      if (graphMsg) { graphMsg.textContent = "Could not export the graph"; graphMsg.classList.add("err"); }
    }
  });
  if (graphExpr) graphExpr.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); drawGraph(); } });

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
    if (e.target && e.target.id === "setPrecision") { const p = parseInt(e.target.value, 10); settings.precision = Number.isFinite(p) ? Math.min(100, Math.max(1, p)) : 12; saveSettings(); updateDisplay(); }
  });

  // Undo / redo
  function snapshot() { return { current, previous, operator, justEvaluated, memory, hasMemory, history: history.slice() }; }
  function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > 60) undoStack.shift(); redoStack.length = 0; }
  function restoreSnap(s) {
    current = s.current; previous = s.previous; operator = s.operator; justEvaluated = s.justEvaluated;
    memory = s.memory; hasMemory = s.hasMemory;
    if (s.history) { history.length = 0; history.push(...s.history); renderHistory(); }
    resetHistoryCursor();
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
  const shareBtn = document.getElementById("shareBtn");
  if (shareBtn) shareBtn.addEventListener("click", () => {
    const latest = history[0];
    const expr = latest ? latest.expr : "";
    const result = latest ? latest.result : current;
    if (!expr && (!result || result === "0" || result === "Error")) { showToast("Nothing to share"); return; }
    const url = location.origin + location.pathname + location.search + makeShareHash(expr, result);
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => showToast("Share link copied")).catch(() => showToast("Copy failed"));
    else showToast("Clipboard unavailable");
  });
  // >>> SHARE_BEGIN — pure, extracted by tests/test_share.mjs (keep DOM-free)
  function makeShareHash(expr, result) {
    const payload = {};
    if (expr) payload.e = String(expr);
    if (result !== undefined && result !== null && result !== "") payload.r = String(result);
    return "#q=" + encodeURIComponent(JSON.stringify(payload));
  }
  function parseShareHash(hash) {
    const raw = String(hash || "").replace(/^#/, "");
    if (!raw.startsWith("q=") || raw.length > 4000) return null;
    let payload;
    try { payload = JSON.parse(decodeURIComponent(raw.slice(2))); } catch (e) { return null; }
    if (!payload || typeof payload !== "object") return null;
    const expr = typeof payload.e === "string" ? payload.e : "";
    const result = typeof payload.r === "string" ? payload.r : "";
    if (!expr && !result) return null;
    return { expr, result };
  }
  // <<< SHARE_END

  // >>> CSV_BEGIN — pure, extracted by tests/test_csv.mjs (keep DOM-free)
  // RFC 4180 CSV: quote everything that contains a comma, quote or newline,
  // and double embedded quotes. Expressions pasted in from anywhere (share
  // links, the expression tape) can start with = + - @, which spreadsheets
  // treat as a formula — prefix those with an apostrophe (CWE-1236). Plain
  // signed numbers are left alone so numeric columns keep numeric type.
  const CSV_NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
  function csvCell(value) {
    let s = String(value);
    if (/^[=+\-@\t\r]/.test(s) && !CSV_NUMBER.test(s)) s = "'" + s;
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
  if (clearHistoryBtn) clearHistoryBtn.addEventListener("click", () => { history.length = 0; renderHistory(); resetHistoryCursor(); });

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
    if (["digit","dot","op","equals","clear","ce","back","sign","percent","sci","const","mem"].includes(action)) {
      resetHistoryCursor();
    }
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
        history.length = 0; renderHistory(); resetHistoryCursor(); break;
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
  let easterBuffer = "";
  window.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey) {
      if (e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); updateDisplay(); }
      if (e.key.toLowerCase() === "c") { /* allow copy text */ }
      return;
    }
    const k = e.key;
    if (!isGraphOpen() && !isUnitsOpen() && !(helpModal && helpModal.classList.contains("show")) && /^[0-9]$/.test(k)) {
      easterBuffer = (easterBuffer + k).slice(-4);
      if (easterBuffer === "1337") { easterBuffer = ""; showToast("Elite mode: still a calculator."); }
    }
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) {
      if (k === "Escape" && isGraphOpen()) { e.preventDefault(); closeGraph(); }
      if (k === "Escape" && isUnitsOpen()) { e.preventDefault(); closeUnits(); }
      return;
    }
    if (isUnitsOpen()) {
      e.preventDefault();
      if (k === "Escape" || k === "u" || k === "U") closeUnits();
      return;
    }
    // ? toggles the shortcut help from anywhere (Shift+? on most layouts);
    // Esc closes it first (v1.1.0)
    if (k === "?") {
      e.preventDefault();
      if (helpModal && helpModal.classList.contains("show")) closeHelp();
      else openHelp();
      return;
    }
    if (k === "g" || k === "G") {
      e.preventDefault();
      if (isGraphOpen()) closeGraph(); else openGraph();
      return;
    }
    if (k === "u" || k === "U") {
      e.preventDefault();
      if (isUnitsOpen()) closeUnits(); else openUnits();
      return;
    }
    if (!isGraphOpen() && !(helpModal && helpModal.classList.contains("show"))) {
      if (k === "ArrowUp" || k === "ArrowDown") {
        e.preventDefault();
        if (!history.length) return;
        pushUndo();
        recallHistory(k === "ArrowUp" ? 1 : -1);
        haptic();
        return;
      }
      const sciKeys = {
        s: "sin", c: "cos", t: "tan",
        l: "ln", r: "sqrt", q: "sq", i: "inv", f: "fact",
        p: "pi",
      };
      const sciName = sciKeys[k];
      if (sciName) {
        e.preventDefault();
        pushUndo();
        applySci(sciName);
        haptic();
        return;
      }
    }
    if (k === "Escape" && isGraphOpen()) {
      e.preventDefault();
      closeGraph();
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
      if (opMap[v]) { pushUndo(); resetHistoryCursor(); inputOperator(opMap[v]); updateDisplay(); haptic(); return; }
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
  restoreSharedCalculation();
  updateDisplay();
  syncSettingsUI();
})();
