import { MAX_COUNT } from "../../config/defaults";
import { normalize, validate, ValidationError } from "../validate";

const base = { name: "Tuff Gym membership", start: "2026-09-30" };

describe("validate", () => {
  it("fills defaults for empty fields", () => {
    const { sub, valid } = validate({
      ...base,
      frequency: "",
      interval: "",
      end: "",
      maxCount: "",
      title: "",
      startTitle: "",
    });
    expect(valid).toBe(true);
    expect(sub).toEqual({
      name: "Tuff Gym membership",
      start: "2026-09-30",
      frequency: "monthly",
      interval: 1,
      end: "",
      maxCount: 12,
      title: "{name}: {ord} {unit} over",
      startTitle: "",
      description: "",
    });
  });

  it("coerces numeric strings and trims the name", () => {
    const { sub } = validate({ ...base, name: "  Gym  ", interval: " 3 ", maxCount: "6" });
    expect(sub.name).toBe("Gym");
    expect(sub.interval).toBe(3);
    expect(sub.maxCount).toBe(6);
  });

  it("keeps the template and start title verbatim", () => {
    const { sub } = validate({ ...base, title: " {name} #{count} ", startTitle: "{name} started" });
    expect(sub.title).toBe(" {name} #{count} ");
    expect(sub.startTitle).toBe("{name} started");
  });

  it.each([
    [{ name: "  " }, "name"],
    [{ start: "" }, "start"],
    [{ start: "2026-02-30" }, "start"],
    [{ frequency: "hourly" }, "frequency"],
    [{ frequency: "toString" }, "frequency"],
    [{ interval: "0" }, "interval"],
    [{ interval: "1.5" }, "interval"],
    [{ interval: "abc" }, "interval"],
    [{ maxCount: "-1" }, "maxCount"],
    [{ maxCount: String(MAX_COUNT + 1) }, "maxCount"],
    [{ end: "2026-09-29" }, "end"],
    [{ end: "not-a-date" }, "end"],
  ])("rejects %p", (override, field) => {
    const { errors, valid } = validate({ ...base, ...override });
    expect(valid).toBe(false);
    expect(errors).toHaveProperty(field);
  });

  it("accepts an end date equal to the start date", () => {
    expect(validate({ ...base, end: base.start }).valid).toBe(true);
  });

  it("does not report an end-date ordering error when the start is invalid", () => {
    const { errors } = validate({ ...base, start: "bad", end: "2026-01-01" });
    expect(errors.end).toBeUndefined();
  });
});

describe("normalize", () => {
  it("returns the normalized subscription", () => {
    expect(normalize(base).maxCount).toBe(12);
  });

  it("throws a ValidationError carrying all field errors", () => {
    expect.assertions(3);
    try {
      normalize({ name: "", start: "" });
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect(e.message).toBe("Title is required");
      expect(Object.keys(e.errors)).toEqual(["name", "start"]);
    }
  });
});
