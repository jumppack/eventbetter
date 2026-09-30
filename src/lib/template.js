export function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    Object.hasOwn(vars, key) ? String(vars[key]) : match,
  );
}

export function vars(name, n, interval, unit) {
  const elapsed = n * interval;
  return {
    name,
    count: n,
    ord: ordinal(n),
    elapsed,
    unit,
    units: elapsed === 1 ? unit : unit + "s",
  };
}

export function ordinal(n) {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}
