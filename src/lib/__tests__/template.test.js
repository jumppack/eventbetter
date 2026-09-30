import { fill, ordinal, vars } from "../template";

describe("ordinal", () => {
  it.each([
    [0, "0th"],
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [21, "21st"],
    [22, "22nd"],
    [23, "23rd"],
    [101, "101st"],
    [111, "111th"],
    [112, "112th"],
  ])("%i -> %s", (n, expected) => {
    expect(ordinal(n)).toBe(expected);
  });
});

describe("vars", () => {
  it("computes elapsed and pluralizes units", () => {
    expect(vars("Gym", 2, 3, "month")).toEqual({
      name: "Gym",
      count: 2,
      ord: "2nd",
      elapsed: 6,
      unit: "month",
      units: "months",
    });
  });

  it("uses the singular unit when exactly one unit has elapsed", () => {
    expect(vars("Gym", 1, 1, "week").units).toBe("week");
  });

  it("pluralizes zero elapsed units for the start event", () => {
    expect(vars("Gym", 0, 1, "month").units).toBe("months");
  });
});

describe("fill", () => {
  const v = vars("Tuff Gym membership", 3, 1, "month");

  it("renders the default template", () => {
    expect(fill("{name}: {ord} {unit} over", v)).toBe(
      "Tuff Gym membership: 3rd month over",
    );
  });

  it("renders the elapsed example", () => {
    expect(fill("{name}: {elapsed} {units} done", v)).toBe(
      "Tuff Gym membership: 3 months done",
    );
  });

  it("renders the quarterly example", () => {
    expect(
      fill("{name}: {ord} renewal, {elapsed} {units} in", vars("Tuff Gym membership", 2, 3, "month")),
    ).toBe("Tuff Gym membership: 2nd renewal, 6 months in");
  });

  it("leaves unknown placeholders as literal text", () => {
    expect(fill("{name} {foo} {count}", v)).toBe("Tuff Gym membership {foo} 3");
  });

  it("does not resolve inherited object properties", () => {
    expect(fill("{constructor} {toString}", v)).toBe("{constructor} {toString}");
  });

  it("does not re-expand placeholders inside substituted values", () => {
    expect(fill("{name}", vars("{count}", 5, 1, "day"))).toBe("{count}");
  });
});
