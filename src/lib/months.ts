import { addMonths, endOfMonth, format, parse, startOfMonth } from "date-fns";

/** "YYYY-MM" for the current month in the user's timezone. */
export function currentMonthKey(timeZone = "Asia/Kolkata"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" })
    .format(new Date())
    .slice(0, 7);
}

export function monthKeyToDate(key: string): Date {
  return parse(key, "yyyy-MM", new Date());
}

/** First and last day of the month as ISO date strings. */
export function monthRange(key: string): { start: string; end: string } {
  const d = monthKeyToDate(key);
  return { start: format(startOfMonth(d), "yyyy-MM-dd"), end: format(endOfMonth(d), "yyyy-MM-dd") };
}

export function shiftMonthKey(key: string, delta: number): string {
  return format(addMonths(monthKeyToDate(key), delta), "yyyy-MM");
}

/** "September 2026" */
export function monthLabel(key: string): string {
  return format(monthKeyToDate(key), "MMMM yyyy");
}
