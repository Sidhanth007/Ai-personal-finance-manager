import { addDays, addMonths, addWeeks, addYears, differenceInCalendarDays, format, parseISO } from "date-fns";

export type Frequency = "daily" | "weekly" | "monthly" | "yearly";

/** Next occurrence strictly after `from`, stepping by frequency × interval. */
export function advanceDate(from: string, frequency: Frequency, interval = 1): string {
  const d = parseISO(from);
  const next =
    frequency === "daily"
      ? addDays(d, interval)
      : frequency === "weekly"
        ? addWeeks(d, interval)
        : frequency === "monthly"
          ? addMonths(d, interval)
          : addYears(d, interval);
  return format(next, "yyyy-MM-dd");
}

/** Days from today until `date` (negative when in the past). */
export function daysUntil(date: string, today: string): number {
  return differenceInCalendarDays(parseISO(date), parseISO(today));
}

/** Convert a recurring amount to an equivalent monthly figure. */
export function monthlyEquivalent(amount: number, cycle: "weekly" | "monthly" | "yearly" | "daily", interval = 1): number {
  const perPeriod = amount / interval;
  switch (cycle) {
    case "daily":
      return Math.round(perPeriod * 30);
    case "weekly":
      return Math.round((perPeriod * 52) / 12);
    case "monthly":
      return Math.round(perPeriod);
    case "yearly":
      return Math.round(perPeriod / 12);
  }
}

export function describeDue(days: number): string {
  if (days < 0) return `${-days} day${days === -1 ? "" : "s"} overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}
