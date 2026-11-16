import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "..", "js", "app.js"), "utf8");
const begin = source.indexOf("// >>> UNITS_BEGIN");
const end = source.indexOf("// <<< UNITS_END");
if (begin < 0 || end < 0) {
  console.error("FAIL: UNITS markers missing from js/app.js");
  process.exit(1);
}
const factory = new Function(`${source.slice(begin, end)}\nreturn { UNIT_CATEGORIES, convertUnit };`);
const { convertUnit } = factory();

let pass = 0;
let fail = 0;
function check(label, got, want) {
  if (Number.isFinite(got) && Number.isFinite(want) && Math.abs(got - want) < 1e-9) pass += 1;
  else {
    fail += 1;
    console.error(`FAIL ${label}: got ${got} want ${want}`);
  }
}
function checkNaN(label, got) {
  if (Number.isNaN(got)) pass += 1;
  else {
    fail += 1;
    console.error(`FAIL ${label}: got ${got} want NaN`);
  }
}

check("1 km -> m", convertUnit(1, "length", "km", "m"), 1000);
check("1 mi -> km", convertUnit(1, "length", "mi", "km"), 1.609344);
check("1 lb -> kg", convertUnit(1, "mass", "lb", "kg"), 0.45359237);
check("0 C -> F", convertUnit(0, "temperature", "C", "F"), 32);
check("212 F -> C", convertUnit(212, "temperature", "F", "C"), 100);
check("0 K -> C", convertUnit(0, "temperature", "K", "C"), -273.15);
check("1 C -> K", convertUnit(1, "temperature", "C", "K"), 274.15);
check("1 GiB -> MiB", convertUnit(1, "data", "GiB", "MiB"), 1024);
check("1 m/s -> km/h", convertUnit(1, "speed", "mps", "kmh"), 3.6);
check("1 day -> h", convertUnit(1, "time", "day", "h"), 24);
check("1 gal -> L", convertUnit(1, "volume", "gal", "L"), 3.785411784);
check("1 acre -> m2", convertUnit(1, "area", "acre", "m2"), 4046.8564224);
check("1 kWh -> J", convertUnit(1, "energy", "kWh", "J"), 3.6e6);
checkNaN("unknown category", convertUnit(1, "nope", "m", "km"));
checkNaN("unknown unit", convertUnit(1, "length", "m", "nope"));
checkNaN("non-finite value", convertUnit(Infinity, "length", "m", "km"));

console.log(`units: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
