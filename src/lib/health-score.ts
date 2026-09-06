/**
 * Deterministic financial health score (0–100). Pure function so it is
 * reproducible and testable; the AI only explains it, never computes it.
 */

export type HealthInput = {
  /** last 3 months, minor units */
  income3m: number;
  expense3m: number;
  /** monthly expense totals for up to the last 6 months (most recent last) */
  monthlyExpenses: number[];
  budgetsTotal: number;
  budgetsOver: number;
  overdueBills: number;
  /** total saved across non-archived goals */
  savingsBalance: number;
};

export type HealthFactor = {
  key: "savings" | "budgets" | "bills" | "stability" | "buffer";
  label: string;
  points: number;
  max: number;
  detail: string;
};

export type HealthScore = {
  score: number;
  grade: "Excellent" | "Good" | "Fair" | "Needs attention";
  factors: HealthFactor[];
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function computeHealthScore(i: HealthInput): HealthScore {
  const factors: HealthFactor[] = [];

  // 1. Savings rate over 3 months (30 pts). 20%+ earns full marks.
  const savingsRate = i.income3m > 0 ? (i.income3m - i.expense3m) / i.income3m : 0;
  const savingsPts = i.income3m > 0 ? Math.round(clamp(savingsRate / 0.2, 0, 1) * 30) : 0;
  factors.push({
    key: "savings",
    label: "Savings rate",
    points: savingsPts,
    max: 30,
    detail:
      i.income3m > 0
        ? `You kept ${pct(clamp(savingsRate, -1, 1))} of income over the last 3 months. 20% or more earns full points.`
        : "No income recorded in the last 3 months yet.",
  });

  // 2. Budget adherence this month (20 pts). No budgets = neutral 10.
  let budgetPts = 10;
  let budgetDetail = "No budgets set this month. Setting a few earns up to 10 more points.";
  if (i.budgetsTotal > 0) {
    const okShare = (i.budgetsTotal - i.budgetsOver) / i.budgetsTotal;
    budgetPts = Math.round(okShare * 20);
    budgetDetail = i.budgetsOver === 0 ? `All ${i.budgetsTotal} budgets are within limit.` : `${i.budgetsOver} of ${i.budgetsTotal} budgets are over limit.`;
  }
  factors.push({ key: "budgets", label: "Budget adherence", points: budgetPts, max: 20, detail: budgetDetail });

  // 3. Bill timeliness (15 pts). Each overdue bill costs 5.
  const billPts = clamp(15 - i.overdueBills * 5, 0, 15);
  factors.push({
    key: "bills",
    label: "Bills on time",
    points: billPts,
    max: 15,
    detail: i.overdueBills === 0 ? "No overdue bills." : `${i.overdueBills} overdue bill${i.overdueBills === 1 ? "" : "s"}.`,
  });

  // 4. Spending stability (15 pts): coefficient of variation of monthly expenses.
  const months = i.monthlyExpenses.filter((m) => m > 0);
  let stabilityPts = 8;
  let stabilityDetail = "Not enough months of spending to judge stability yet.";
  if (months.length >= 3) {
    const mean = months.reduce((a, b) => a + b, 0) / months.length;
    const variance = months.reduce((a, b) => a + (b - mean) ** 2, 0) / months.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
    stabilityPts = Math.round(clamp(1 - (cv - 0.15) / 0.45, 0, 1) * 15);
    stabilityDetail = `Monthly spending varies by about ${pct(cv)} around its average. Under 15% earns full points.`;
  }
  factors.push({ key: "stability", label: "Spending stability", points: stabilityPts, max: 15, detail: stabilityDetail });

  // 5. Emergency buffer (20 pts): savings balance vs average monthly expenses. 3 months = full.
  const avgMonthly = months.length ? months.reduce((a, b) => a + b, 0) / months.length : 0;
  const bufferMonths = avgMonthly > 0 ? i.savingsBalance / avgMonthly : i.savingsBalance > 0 ? 3 : 0;
  const bufferPts = Math.round(clamp(bufferMonths / 3, 0, 1) * 20);
  factors.push({
    key: "buffer",
    label: "Emergency buffer",
    points: bufferPts,
    max: 20,
    detail:
      avgMonthly > 0
        ? `Savings goals cover about ${bufferMonths.toFixed(1)} months of typical spending. 3 months earns full points.`
        : "Log savings contributions and expenses to measure your buffer.",
  });

  const score = factors.reduce((s, f) => s + f.points, 0);
  const grade = score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Fair" : "Needs attention";
  return { score, grade, factors };
}
