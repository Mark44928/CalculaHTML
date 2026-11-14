// tests/test_logic.mjs — regression tests for the pure IIFE sections of
// js/app.js that are delimited by `// >>> NAME_BEGIN` / `// <<< NAME_END`
// markers. Mirrors the extraction approach of tests/test_csv.mjs.
// Run with:  node tests/test_logic.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "..", "js", "app.js"), "utf8");

function extract(name) {
  const begin = source.indexOf(`// >>> ${name}_BEGIN`);
  const end = source.indexOf(`// <<< ${name}_END`);
  if (begin < 0 || end < 0) {
    console.error(`FAIL: ${name} markers missing from js/app.js`);
    process.exit(1);
  }
  return source.slice(begin, end);
}

let pass = 0;
let fail = 0;
function check(label, got, want) {
  const gotJson = JSON.stringify(got);
  const wantJson = JSON.stringify(want);
  if (gotJson === wantJson) pass += 1;
  else {
    fail += 1;
    console.error(`FAIL ${label}: got ${gotJson} want ${wantJson}`);
  }
}

// ---- SETTINGS: loadSettings must survive hostile stored JSON ----
{
  const slice = extract("SETTINGS");
  const loadSettings = (raw) => {
    const localStorage = { getItem: () => raw };
    return new Function("localStorage", `${slice}\nreturn loadSettings;`)(localStorage)();
  };
  const defaults = { sound: false, haptics: true, thousands: true, precision: 12 };
  check("no stored settings -> defaults", loadSettings(null), defaults);
  check("corrupt json -> defaults", loadSettings("{nope"), defaults);
  check("non-object json -> defaults", loadSettings("42"), defaults);
  check("out-of-range precision is clamped", loadSettings('{"precision": 999}').precision, 100);
  check("zero precision is clamped", loadSettings('{"precision": 0}').precision, 1);
  check("negative precision is clamped", loadSettings('{"precision": -5}').precision, 1);
  check("non-numeric precision -> default", loadSettings('{"precision": "abc"}').precision, 12);
  check("fractional precision is rounded", loadSettings('{"precision": 7.6}').precision, 8);
  check("string bool does not leak", loadSettings('{"sound": "false"}').sound, false);
  check(
    "real booleans pass through",
    loadSettings('{"sound": true, "thousands": false}'),
    { ...defaults, sound: true, thousands: false },
  );
  check("numeric zero is not a boolean", loadSettings('{"haptics": 0}').haptics, true);
}

// ---- INPUTOP: a failed (e.g. division-by-zero) chain must not arm the next operator ----
{
  const slice = extract("INPUTOP");
  const build = (evaluateBody, initial) => new Function(
    `let current = ${JSON.stringify(initial.current)}, previous = ${JSON.stringify(initial.previous)}, operator = ${JSON.stringify(initial.operator)}, justEvaluated = false;
     const evaluate = ${evaluateBody};
     ${slice}
     return { inputOperator, state: () => ({ current, previous, operator, justEvaluated }) };`,
  )();
  // evaluate stubs mimic evaluate()'s outcomes by mutating the closure lets.
  const divZero = build(
    `() => { current = "Error"; operator = null; previous = ""; justEvaluated = true; }`,
    { current: "0", previous: "1", operator: "/" },
  );
  divZero.inputOperator("+");
  check("error chain does not arm operator", divZero.state().operator, null);
  check("error chain keeps Error on screen", divZero.state().current, "Error");
  check("error chain does not poison previous", divZero.state().previous, "");

  const happy = build(
    `() => { current = "17"; operator = null; previous = "12 + 5"; justEvaluated = true; }`,
    { current: "5", previous: "12", operator: "+" },
  );
  happy.inputOperator("*");
  check("happy path chains operator", happy.state().operator, "*");
  check("happy path carries result", happy.state().previous, "17");
  check("happy path resets current", happy.state().current, "0");
}

// ---- MEM: memory operations must not accumulate non-finite values ----
{
  const slice = extract("MEM");
  const build = (currentValue) => new Function(
    `let memory = 0, hasMemory = true;
     let current = ${JSON.stringify(currentValue)};
     const renderMemory = () => {};
     const showToast = () => {};
     ${slice}
     return { memAdd, memSub, memStore, state: () => ({ memory, hasMemory }) };`,
  )();
  const inf = build("1e999");
  inf.memStore();
  check("memStore of Infinity stores 0", inf.state().memory, 0);
  inf.memAdd();
  check("memAdd of Infinity adds 0", inf.state().memory, 0);
  const nan = build("Error");
  nan.memStore();
  check("memStore of NaN stores 0", nan.state().memory, 0);
  nan.memSub();
  check("memSub of NaN subtracts 0", nan.state().memory, 0);
  const finite = build("42");
  finite.memStore();
  finite.memAdd();
  check("finite values accumulate", finite.state().memory, 84);
}

console.log(`logic: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
