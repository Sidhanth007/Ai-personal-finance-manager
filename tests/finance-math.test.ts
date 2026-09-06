import { describe, expect, it } from "vitest";
import { budgetStatus } from "@/lib/budget-math";
import { projectGoal } from "@/lib/goal-math";
import { computeHealthScore } from "@/lib/health-score";

describe("budgetStatus", () => {
  it("classifies against the threshold", () => {
    expect(budgetStatus(50, 100, 80)).toBe("ok");
    expect(budgetStatus(80, 100, 80)).toBe("warning");
    expect(budgetStatus(100, 100, 80)).toBe("warning");
    expect(budgetStatus(101, 100, 80)).toBe("over");
    expect(budgetStatus(10, 0, 80)).toBe("ok");
  });
});

describe("projectGoal", () => {
  it("projects completion from pace and flags on-track", () => {
    const p = projectGoal({ targetAmount: 120000, currentAmount: 60000, targetDate: "2026-12-31", monthlyPace: 30000, today: "2026-09-01" });
    expect(p.remaining).toBe(60000);
    expect(p.pct).toBe(50);
    expect(p.projectedDate).toBe("2026-10-31");
    expect(p.onTrack).toBe(true);
    expect(p.requiredMonthly).toBeGreaterThan(0);
  });
  it("flags behind pace and handles no pace", () => {
    const slow = projectGoal({ targetAmount: 120000, currentAmount: 0, targetDate: "2026-10-01", monthlyPace: 10000, today: "2026-09-01" });
    expect(slow.onTrack).toBe(false);
    const none = projectGoal({ targetAmount: 1000, currentAmount: 0, targetDate: null, monthlyPace: 0, today: "2026-09-01" });
    expect(none.projectedDate).toBeNull();
    expect(none.onTrack).toBeNull();
  });
  it("treats reached goals as complete", () => {
    const done = projectGoal({ targetAmount: 1000, currentAmount: 1500, targetDate: "2026-01-01", monthlyPace: 0, today: "2026-09-01" });
    expect(done.remaining).toBe(0);
    expect(done.pct).toBe(100);
    expect(done.onTrack).toBe(true);
    expect(done.requiredMonthly).toBe(0);
  });
});

describe("computeHealthScore", () => {
  const base = { income3m: 300000, expense3m: 210000, monthlyExpenses: [70000, 70000, 70000, 70000, 70000, 70000], budgetsTotal: 4, budgetsOver: 0, overdueBills: 0, savingsBalance: 210000 };
  it("gives a strong profile a high score", () => {
    const s = computeHealthScore(base);
    expect(s.score).toBeGreaterThanOrEqual(90);
    expect(s.grade).toBe("Excellent");
    expect(s.factors.reduce((a, f) => a + f.points, 0)).toBe(s.score);
    expect(s.factors.every((f) => f.points <= f.max && f.points >= 0)).toBe(true);
  });
  it("penalises overspending, overdue bills and volatility", () => {
    const s = computeHealthScore({ ...base, income3m: 300000, expense3m: 330000, budgetsOver: 4, overdueBills: 3, monthlyExpenses: [10000, 90000, 20000, 150000, 30000, 100000], savingsBalance: 0 });
    expect(s.score).toBeLessThan(25);
    expect(s.grade).toBe("Needs attention");
  });
  it("is neutral about missing budgets and thin history", () => {
    const s = computeHealthScore({ ...base, budgetsTotal: 0, monthlyExpenses: [70000] });
    expect(s.factors.find((f) => f.key === "budgets")?.points).toBe(10);
    expect(s.factors.find((f) => f.key === "stability")?.points).toBe(8);
  });
  it("is deterministic", () => {
    expect(computeHealthScore(base)).toEqual(computeHealthScore(base));
  });
});
