export type BudgetStatus = "ok" | "warning" | "over";

/** Pure status rule shared by the UI, reminders, and tests. */
export function budgetStatus(spent: number, amount: number, thresholdPct: number): BudgetStatus {
  if (amount <= 0) return "ok";
  const pct = (spent / amount) * 100;
  if (pct > 100) return "over";
  if (pct >= thresholdPct) return "warning";
  return "ok";
}
