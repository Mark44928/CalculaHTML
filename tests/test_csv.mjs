// tests/test_csv.mjs — unit tests for the CSV builder in js/app.js.
//
// app.js is a DOM IIFE (single-file app, no module system), so the pure CSV
// section is delimited by `// >>> CSV_BEGIN` / `// <<< CSV_END` markers and
// extracted here, evaluated in isolation, and tested. Run with:
//   node tests/test_csv.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "..", "js", "app.js"), "utf8");

const begin = source.indexOf("// >>> CSV_BEGIN");
const end = source.indexOf("// <<< CSV_END");
if (begin < 0 || end < 0) {
  console.error("FAIL: CSV markers missing from js/app.js");
  process.exit(1);
}
const factory = new Function(`${source.slice(begin, end)}\nreturn { csvCell, historyToCsv };`);
const { csvCell, historyToCsv } = factory();

let pass = 0;
let fail = 0;
function check(label, got, want) {
  if (got === want) pass += 1;
  else {
    fail += 1;
    console.error(`FAIL ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  }
}

// quoting rules
check("plain cell", csvCell("1+2"), "1+2");
check("comma quoted", csvCell("1,2+3"), '"1,2+3"');
check("newline quoted", csvCell("a\nb"), '"a\nb"');
check("quote doubled", csvCell('say "hi"'), '"say ""hi"""');

// full document
check(
  "header + rows",
  historyToCsv([{ expr: "1+1", result: "2" }]),
  "expression,result\n1+1,2\n",
);
check("empty history", historyToCsv([]), "expression,result\n");
check(
  "hostile expressions survive",
  historyToCsv([{ expr: 'f("a,b"\nc)', result: "=,3" }]),
  'expression,result\n"f(""a,b""\nc)","=,3"\n',
);

console.log(`csv: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
