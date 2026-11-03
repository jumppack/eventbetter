// Placeholders that print a number. `{units}` agrees with whichever of these
// came last before it: "{ord} {units}" is "3rd month", "{count} {units}" is
// "3 months". `{elapsed}` and `{unit}` are no longer documented but stay
// understood, because templates saved by older versions still use them.
const NUMBERS = new Set(["count", "ord", "elapsed"]);

export function fill(template, vars) {
  let lastNumber = null;
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    if (key === "units" && Object.hasOwn(vars, "unit")) return unitsAfter(lastNumber, vars);
    if (!Object.hasOwn(vars, key)) return match;
    if (NUMBERS.has(key)) lastNumber = key;
    return String(vars[key]);
  });
}

function unitsAfter(lastNumber, vars) {
  const n = lastNumber === "count" || lastNumber === "elapsed" ? vars[lastNumber] : 1;
  return n === 1 ? vars.unit : vars.unit + "s";
}

// `n` is the number this occurrence shows (counted up or down).
export function vars(name, n, interval, unit) {
  return {
    name,
    count: n,
    ord: ordinal(n),
    elapsed: n * interval,
    unit,
  };
}

export function ordinal(n) {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}
