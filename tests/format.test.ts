import { describe, expect, it } from "vitest";
import { formatMoney, fromMinorUnits, initials, toMinorUnits } from "@/lib/format";

describe("money conversion", () => {
  it("converts major amounts to minor units without float drift", () => {
    expect(toMinorUnits("1234.50")).toBe(123450);
    expect(toMinorUnits("0.10")).toBe(10);
    expect(toMinorUnits("1,00,000")).toBe(10000000);
    expect(toMinorUnits(19.99)).toBe(1999);
  });
  it("handles zero-decimal currencies", () => {
    expect(toMinorUnits("5000", "JPY")).toBe(5000);
    expect(fromMinorUnits(5000, "JPY")).toBe(5000);
  });
  it("rejects invalid input", () => {
    expect(() => toMinorUnits("abc")).toThrow();
  });
  it("round-trips", () => {
    expect(fromMinorUnits(toMinorUnits("99.95"))).toBe(99.95);
  });
});

describe("formatMoney", () => {
  it("formats INR with Indian grouping", () => {
    expect(formatMoney(12345678)).toBe("₹1,23,456.78");
  });
  it("formats USD", () => {
    expect(formatMoney(199900, "USD")).toBe("$1,999.00");
  });
  it("shows sign when requested", () => {
    expect(formatMoney(5000, "USD", { signed: true })).toBe("+$50.00");
    expect(formatMoney(-5000, "USD", { signed: true })).toBe("-$50.00");
    expect(formatMoney(0, "USD", { signed: true })).toBe("$0.00");
  });
  it("compacts large values", () => {
    expect(formatMoney(150000000, "USD", { compact: true })).toBe("$1.5M");
  });
});

describe("initials", () => {
  it("uses the name when present", () => {
    expect(initials("Sid Kumar", "x@y.com")).toBe("SK");
  });
  it("falls back to email", () => {
    expect(initials(null, "sid.kumar@example.com")).toBe("SK");
  });
});
