// Regression tests for the g(x) graph compiler in js/app.js.
// The compiler is extracted from the IIFE so this runs headless in Node.
import fs from "node:fs";

const src = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const start = src.indexOf("function compileExpression");
const end = src.indexOf("\n  function isGraphOpen");
if (start < 0 || end < 0) throw new Error("compileExpression not found in js/app.js");
const compile = new Function("angleMode", src.slice(start, end) + "\nreturn compileExpression;")("DEG");

let passed = 0;
let failed = 0;
const near = (a, b) => Math.abs(a - b) < 1e-9;
const check = (expr, x, want) => {
  try {
    const got = compile(expr)(x);
    if (near(got, want)) passed++;
    else { failed++; console.log(`FAIL ${expr} -> ${got}, want ${want}`); }
  } catch (err) {
    failed++;
    console.log(`FAIL ${expr} threw ${err.message}`);
  }
};
const rejects = (expr) => {
  try { compile(expr); failed++; console.log(`FAIL ${expr} should have been rejected`); }
  catch { passed++; }
};

check("sin(30)", 0, 0.5);
check("cos(0)*pi", 0, Math.PI);
check("2x", 3, 6);
check("x^2+1", 4, 17);
check("-x^2", 3, -9);
check("2^3^2", 0, 512);
check("sqrt(x)+abs(-x)", 9, 12);
check("ln(e)", 0, 1);
check("log(100)+log2(8)", 0, 5);
check("2e3", 0, 2000);
check("pi*x", 2, 2 * Math.PI);
check("2(x+1)", 3, 8);
check("3--2", 0, 5);
check("0.5x", 4, 2);
check("tau", 0, 2 * Math.PI);
check("phi", 0, (1 + Math.sqrt(5)) / 2);

rejects("sin(");
rejects("foo(x)");
rejects("2+*3");
rejects("2.5.3");

console.log(`graph: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
