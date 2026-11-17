// Regression tests for saved graph preset parsing/serialization.
import fs from "node:fs";

const src = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const start = src.indexOf("  // >>> GRAPH_PRESETS_BEGIN");
const end = src.indexOf("  // <<< GRAPH_PRESETS_END");
if (start < 0 || end < 0) throw new Error("GRAPH_PRESETS markers not found in js/app.js");
const graphApi = new Function(src.slice(start, end) + "\nreturn { GRAPH_BUILTINS, graphPresetLoad, graphPresetSerialize, graphPresetFind, graphPresetBuiltin };")();

let passed = 0;
let failed = 0;
const ok = (name, condition) => {
  if (condition) passed++;
  else { failed++; console.log(`FAIL ${name}`); }
};

const cleaned = graphApi.graphPresetLoad(JSON.stringify([
  { name: "  My   Graph  ", expr: " sin(x), cos(x) ", xmin: -1, xmax: 1 },
  { name: "bad range", expr: "x", xmin: 5, xmax: -5 },
  { name: "My Graph", expr: "x^2", xmin: 0, xmax: 2 },
]));
ok("cleans and dedupes presets", cleaned.length === 1 && cleaned[0].name === "My Graph");

const roundTrip = graphApi.graphPresetLoad(graphApi.graphPresetSerialize([{ name: "A", expr: "x", xmin: 0, xmax: 1 }]));
ok("serializes and reloads", roundTrip.length === 1 && roundTrip[0].expr === "x");

ok("builtin presets exist", graphApi.graphPresetBuiltin("Trig").expr === "sin(x), cos(x)");
ok("builtin lookup is case-insensitive", graphApi.graphPresetBuiltin("LOGARITHM").name === "Logarithm");
ok("find is case-insensitive", graphApi.graphPresetFind([{ name: "Trig", expr: "x", xmin: 0, xmax: 1 }], "trig").expr === "x");
ok("invalid json returns empty", Array.isArray(graphApi.graphPresetLoad("{nope")) && graphApi.graphPresetLoad("{nope").length === 0);

console.log(`graph presets: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
