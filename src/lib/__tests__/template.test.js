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
  it("gives the number, its ordinal and the unit", () => {
    expect(vars("Gym", 2, 3, "month")).toEqual({
      name: "Gym",
      count: 2,
      ord: "2nd",
      elapsed: 6,
      unit: "month",
    });
  });
});

describe("fill", () => {
  const v = vars("Tuff Gym membership", 3, 1, "month");
  const at = (n, template, interval = 1) => fill(template, vars("Tuff Gym membership", n, interval, "month"));

  it("renders the default template", () => {
    expect(fill("{name}: {ord} {units} over", v)).toBe("Tuff Gym membership: 3rd month over");
  });

  it("renders the payments example", () => {
    expect(at(1, "{name}: {ord} payment done")).toBe("Tuff Gym membership: 1st payment done");
  });

  describe("{units} matches the number before it", () => {
    it.each([
      [1, "{count} {units} remaining", "1 month remaining"],
      [3, "{count} {units} remaining", "3 months remaining"],
      [0, "{count} {units} remaining", "0 months remaining"],
      [3, "{ord} {units}", "3rd month"],
      [1, "{ord} {units}", "1st month"],
      [3, "{units}", "month"],
    ])("%i: %s", (n, template, expected) => {
      expect(at(n, template)).toBe(expected);
    });

    it("follows the closest number when there are two", () => {
      expect(at(3, "{ord} {units}, {count} {units}")).toBe("3rd month, 3 months");
      expect(at(3, "{count} {units}, {ord} {units}")).toBe("3 months, 3rd month");
    });
  });

  describe("templates saved by older versions", () => {
    it("still renders {unit}", () => {
      expect(fill("{name}: {ord} {unit} over", v)).toBe("Tuff Gym membership: 3rd month over");
    });

    it("still renders {elapsed} with {units} matching it", () => {
      expect(at(2, "{name}: {ord} renewal, {elapsed} {units} in", 3)).toBe(
        "Tuff Gym membership: 2nd renewal, 6 months in",
      );
      expect(at(0, "{elapsed} {units}")).toBe("0 months");
    });
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
