// tests/test_share.mjs — unit tests for the share-link codec in js/app.js.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "..", "js", "app.js"), "utf8");
const begin = source.indexOf("// >>> SHARE_BEGIN");
const end = source.indexOf("// <<< SHARE_END");
if (begin < 0 || end < 0) {
  console.error("FAIL: SHARE markers missing from js/app.js");
  process.exit(1);
}
const factory = new Function(`${source.slice(begin, end)}\nreturn { makeShareHash, parseShareHash };`);
const { makeShareHash, parseShareHash } = factory();

let pass = 0;
let fail = 0;
function check(label, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) pass += 1;
  else {
    fail += 1;
    console.error(`FAIL ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  }
}

const round = parseShareHash(makeShareHash("sin(30) + 2", "2.5"));
check("round trip", round, { expr: "sin(30) + 2", result: "2.5" });
check("unicode", parseShareHash(makeShareHash("π + 2", "5.14159265359")), { expr: "π + 2", result: "5.14159265359" });
check("result only", parseShareHash(makeShareHash("", "42")), { expr: "", result: "42" });
check("expression only", parseShareHash(makeShareHash("1/3", "")), { expr: "1/3", result: "" });
check("empty rejected", parseShareHash(makeShareHash("", "")), null);
check("malformed", parseShareHash("#q=%7Bbad"), null);
check("wrong prefix", parseShareHash("#calc=abc"), null);
check("oversize", parseShareHash("#q=" + "a".repeat(4100)), null);

console.log(`share: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
