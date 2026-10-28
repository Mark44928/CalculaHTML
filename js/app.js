/* CalculaHTML — calculator engine */
(function () {
  "use strict";

  const displayExpr = document.getElementById("expr");
  const displayResult = document.getElementById("result");
  const displayMem = document.getElementById("memIndicator");
  const angleIndicator = document.getElementById("angleIndicator");
  const historyList = document.getElementById("historyList");
  historyList.addEventListener("click", (ev) => {
    const row = ev.target.closest(".row");
    if (!row) return;
    const h = history[Number(row.dataset.i)];
    if (!h) return;
    current = h.result;
    justEvaluated = false;
    updateDisplay();
    showToast("Result loaded to display");
  });
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

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("show"), 1400);
  }

  function formatNumber(n) {
    if (typeof n === "string") return n;
    if (!isFinite(n)) return String(n);
    // avoid scientific for reasonable ranges
    let s = String(n);
    if (s.includes("e")) return s;
    if (s.length > 14) {
      const fixed = n.toPrecision(12);
      return parseFloat(fixed).toString();
    }
    return s;
  }

  // Display-only grouping: insert thousands separators into the integer
  // part. Internal state (current/previous/memory/history) stays raw.
  function groupThousands(s) {
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
      // show the full evaluated expression if available
      displayExpr.textContent = previous.includes(" ") ? previous : "";
    } else {
      displayExpr.textContent = "";
    }
    if (hasMemory) {
      displayMem.textContent = "M";
      displayMem.classList.remove("inactive");
    } else {
      displayMem.textContent = "M";
      displayMem.classList.add("inactive");
    }
    angleIndicator.textContent = angleMode.toUpperCase();
  }

  function symbolFor(op) {
    return { "+": "+", "-": "−", "*": "×", "/": "÷", "^": "^" }[op] || op;
  }

  function pushHistory(expr, result) {
    history.unshift({ expr, result });
    if (history.length > 40) history.pop();
    renderHistory();
  }
  function renderHistory() {
    if (history.length === 0) {
      historyList.innerHTML = '<div class="empty">No calculations yet</div>';
      return;
    }
    historyList.innerHTML = history.map((h, i) =>
      `<div class="row" data-i="${i}" title="Click to reuse result"><span class="e">${escapeHtml(h.expr)}</span><span class="r">${escapeHtml(h.result)}</span></div>`
    ).join("");
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  function inputDigit(d) {
    if (justEvaluated) { current = d === "." ? "0." : d; justEvaluated = false; return; }
    if (d === ".") {
      if (current.includes(".")) return;
      current += ".";
    } else {
      if (current === "0") current = d; else current += d;
    }
    if (current.length > 18) current = current.slice(0, 18);
  }

  function inputOperator(op) {
    if (operator && !justEvaluated) {
      // chain evaluate
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
        if (b === 0) { shake(); current = "Error"; operator = null; previous = ""; justEvaluated = true; updateDisplay(); return; }
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
    if (current === "0") return;
    if (current.startsWith("-")) current = current.slice(1);
    else current = "-" + current;
  }
  function percent() {
    const v = parseFloat(current) / 100;
    current = formatNumber(v);
    justEvaluated = false;
  }

  // Scientific functions applied to current
  const sci = {
    sin: (x) => Math.sin(toRad(x)),
    cos: (x) => Math.cos(toRad(x)),
    tan: (x) => Math.tan(toRad(x)),
    asin: (x) => toDeg(Math.asin(x)),
    acos: (x) => toDeg(Math.acos(x)),
    atan: (x) => toDeg(Math.atan(x)),
    log: (x) => Math.log10(x),
    ln: (x) => Math.log(x),
    sqrt: (x) => Math.sqrt(x),
    cbrt: (x) => Math.cbrt(x),
    sq: (x) => x * x,
    cb: (x) => x * x * x,
    inv: (x) => 1 / x,
    fact: (x) => factorial(Math.round(x)),
    abs: (x) => Math.abs(x),
    exp: (x) => Math.exp(x),
  };
  let angleMode = "deg"; // deg | rad
  function toRad(x) { return angleMode === "deg" ? (x * Math.PI / 180) : x; }
  function toDeg(x) { return angleMode === "deg" ? (x * 180 / Math.PI) : x; }
  function factorial(n) {
    if (n < 0) return NaN;
    if (n > 170) return Infinity;
    let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
  }

  function applySci(name) {
    const x = parseFloat(current);
    let res;
    if (name === "pi") { current = formatNumber(Math.PI); justEvaluated = false; updateDisplay(); return; }
    if (name === "e") { current = formatNumber(Math.E); justEvaluated = false; updateDisplay(); return; }
    if (name === "pow10") { current = formatNumber(Math.pow(10, x)); justEvaluated = false; updateDisplay(); return; }
    if (sci[name]) {
      res = sci[name](x);
      const exprStr = name + "(" + current + ")";
      pushHistory(exprStr, formatNumber(res));
      current = formatNumber(res);
      justEvaluated = true;
    }
  }

  function insertConstant(name) {
    if (name === "pi") current = (justEvaluated ? "" : current === "0" ? "" : current) + Math.PI.toString().slice(0,12);
    if (name === "e") current = (justEvaluated ? "" : current === "0" ? "" : current) + Math.E.toString().slice(0,12);
    justEvaluated = false;
    if (current === "" ) current = "0";
  }

  // Memory
  function memClear() { memory = 0; hasMemory = false; renderMemory(); updateDisplay(); }
  function memRecall() { current = formatNumber(memory); justEvaluated = false; updateDisplay(); }
  function memAdd() { memory += parseFloat(current); hasMemory = true; renderMemory(); showToast("M+"); }
  function memSub() { memory -= parseFloat(current); hasMemory = (memory !== 0); renderMemory(); showToast("M−"); }
  function memStore() { memory = parseFloat(current); hasMemory = true; renderMemory(); showToast("MS"); }
  function renderMemory() {
    if (!hasMemory) {
      memoryList.innerHTML = '<div class="empty">Memory empty</div>';
      return;
    }
    memoryList.innerHTML = `<div class="row"><span class="e">Memory</span><span class="r">${formatNumber(memory)}</span></div>`;
  }

  // Theme handling
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  function systemTheme() { return prefersDark ? "dark" : "light"; }

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

  // Button handling
  document.querySelectorAll(".btn").forEach(btn => {
    btn.addEventListener("click", () => handleAction(btn.dataset.action, btn));
  });

  // Mark scientific containers (hidden in Basic mode)
  const sciContainers = document.querySelectorAll(".key-row.sci-row");

  let calcMode = "scientific"; // "scientific" | "basic"
  const modeToggle = document.getElementById("modeToggle");
  function setMode(mode) {
    calcMode = mode;
    document.documentElement.setAttribute("data-mode", mode);
    modeToggle.textContent = mode === "scientific" ? "Scientific" : "Basic";
    modeToggle.classList.toggle("basic", mode === "basic");
    sciContainers.forEach((c) => {
      c.style.display = mode === "basic" ? "none" : "";
    });
  }
  modeToggle.addEventListener("click", () => setMode(calcMode === "scientific" ? "basic" : "scientific"));
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
        btn.textContent = angleMode.toUpperCase();
        showToast("Angle: " + angleMode.toUpperCase());
        break;
      case "copy":
        copyResult(); break;
      case "history-clear":
        history.length = 0; renderHistory(); break;
      default: break;
    }
    updateDisplay();
  }

  function copyResult() {
    const txt = current;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(txt).then(() => showToast("Copied")).catch(() => showToast("Copy failed"));
    } else {
      showToast("Clipboard unavailable");
    }
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
    if (e.metaKey || e.ctrlKey) return;
    const k = e.key;
    if (keyMap[k] !== undefined) {
      e.preventDefault();
      const v = keyMap[k];
      if (v === "dot") { inputDigit("."); updateDisplay(); return; }
      if (["0","1","2","3","4","5","6","7","8","9"].includes(v)) { inputDigit(v); updateDisplay(); return; }
      if (v === "=") { evaluate(false); updateDisplay(); return; }
      if (v === "back") { backspace(); updateDisplay(); return; }
      if (v === "ce") { clearEntry(); updateDisplay(); return; }
      if (v === "clear") { clearAll(); updateDisplay(); return; }
      if (v === "percent") { percent(); updateDisplay(); return; }
      // operators
      const opMap = {"+":"+","-":"-","*":"*","÷":"/","^":"^"};
      if (opMap[v]) { inputOperator(opMap[v]); updateDisplay(); return; }
    }
  });

  angleIndicator.style.cursor = "pointer";
  angleIndicator.addEventListener("click", () => {
    angleMode = angleMode === "deg" ? "rad" : "deg";
    angleIndicator.textContent = angleMode.toUpperCase();
    showToast("Angle: " + angleMode.toUpperCase());
  });

  // Init
  angleIndicator.textContent = angleMode.toUpperCase();
  renderHistory();
  renderMemory();
  updateDisplay();
})();
