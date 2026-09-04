import { describe, expect, it } from "vitest";
import { pakistanHolidays, usFederalHolidays } from "./presets";

describe("usFederalHolidays", () => {
  const h2026 = Object.fromEntries(usFederalHolidays(2026).map((h) => [h.name, h.date]));
  it("floating holidays land on the right weekday", () => {
    expect(h2026["Martin Luther King Jr. Day"]).toBe("2026-01-19");
    expect(h2026["Memorial Day"]).toBe("2026-05-25");
    expect(h2026["Labor Day"]).toBe("2026-09-07");
    expect(h2026["Thanksgiving Day"]).toBe("2026-11-26");
  });
  it("applies the observed rule: Jul 4 2026 is Saturday → Friday Jul 3", () => {
    expect(h2026["Independence Day"]).toBe("2026-07-03");
  });
  it("Christmas 2027 is Saturday → observed Friday Dec 24", () => {
    const h = Object.fromEntries(usFederalHolidays(2027).map((x) => [x.name, x.date]));
    expect(h["Christmas Day"]).toBe("2027-12-24");
  });
  it("returns 11 holidays", () => {
    expect(usFederalHolidays(2026)).toHaveLength(11);
  });
});

describe("pakistanHolidays", () => {
  it("fixed dates only", () => {
    expect(pakistanHolidays(2026).map((h) => h.date)).toEqual([
      "2026-02-05",
      "2026-03-23",
      "2026-05-01",
      "2026-08-14",
      "2026-11-09",
      "2026-12-25",
    ]);
  });
});
