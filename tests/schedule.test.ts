import { describe, expect, it } from "vitest";
import { advanceDate, daysUntil, describeDue, monthlyEquivalent } from "@/lib/schedule";
import { monthLabel, monthRange, shiftMonthKey } from "@/lib/months";

describe("advanceDate", () => {
  it("steps by frequency and interval", () => {
    expect(advanceDate("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(advanceDate("2026-01-01", "weekly", 2)).toBe("2026-01-15");
    expect(advanceDate("2024-02-29", "yearly")).toBe("2025-02-28");
    expect(advanceDate("2026-12-31", "daily")).toBe("2027-01-01");
  });
});

describe("daysUntil / describeDue", () => {
  it("counts calendar days", () => {
    expect(daysUntil("2026-09-10", "2026-09-05")).toBe(5);
    expect(daysUntil("2026-09-01", "2026-09-05")).toBe(-4);
  });
  it("describes due state", () => {
    expect(describeDue(0)).toBe("Due today");
    expect(describeDue(1)).toBe("Due tomorrow");
    expect(describeDue(3)).toBe("Due in 3 days");
    expect(describeDue(-1)).toBe("1 day overdue");
    expect(describeDue(-4)).toBe("4 days overdue");
  });
});

describe("monthlyEquivalent", () => {
  it("normalises cycles to a month", () => {
    expect(monthlyEquivalent(12000, "yearly")).toBe(1000);
    expect(monthlyEquivalent(1200, "monthly")).toBe(1200);
    expect(monthlyEquivalent(1200, "weekly")).toBe(5200);
  });
});

describe("month keys", () => {
  it("shifts and labels", () => {
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
    expect(monthLabel("2026-09")).toBe("September 2026");
    expect(monthRange("2026-02")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });
});
