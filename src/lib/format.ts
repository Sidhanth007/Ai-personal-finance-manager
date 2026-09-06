import { format, parseISO } from "date-fns";

export const CURRENCIES = [
  { code: "INR", label: "Indian Rupee (₹)" },
  { code: "USD", label: "US Dollar ($)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "GBP", label: "British Pound (£)" },
  { code: "AED", label: "UAE Dirham (د.إ)" },
  { code: "SGD", label: "Singapore Dollar (S$)" },
  { code: "AUD", label: "Australian Dollar (A$)" },
  { code: "CAD", label: "Canadian Dollar (C$)" },
  { code: "JPY", label: "Japanese Yen (¥)" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];
export const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as unknown as [CurrencyCode, ...CurrencyCode[]];

/** Currencies whose minor unit is not 1/100. */
const MINOR_DIGITS: Record<string, number> = { JPY: 0 };

export function minorDigits(currency: string): number {
  return MINOR_DIGITS[currency] ?? 2;
}

/** Convert a user-entered major amount (e.g. "1234.50") into integer minor units. */
export function toMinorUnits(amount: number | string, currency = "INR"): number {
  const n = typeof amount === "string" ? Number(amount.replace(/[,\s]/g, "")) : amount;
  if (!Number.isFinite(n)) throw new Error("Invalid amount");
  return Math.round(n * 10 ** minorDigits(currency));
}

export function fromMinorUnits(minor: number, currency = "INR"): number {
  return minor / 10 ** minorDigits(currency);
}

/** Format integer minor units for display, e.g. 123450 -> "₹1,234.50". */
export function formatMoney(
  minor: number,
  currency = "INR",
  opts: { signed?: boolean; compact?: boolean } = {},
): string {
  const value = fromMinorUnits(minor, currency);
  const formatter = new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: opts.compact ? 0 : minorDigits(currency),
    maximumFractionDigits: opts.compact ? 1 : minorDigits(currency),
    notation: opts.compact ? "compact" : "standard",
    signDisplay: opts.signed ? "exceptZero" : "auto",
  });
  return formatter.format(value);
}

/** ISO date string (yyyy-MM-dd) for today in the given timezone. */
export function todayISO(timeZone = "Asia/Kolkata"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

/** Format an ISO date string (yyyy-MM-dd) like "4 Sep 2026". */
export function formatDate(iso: string, pattern = "d MMM yyyy"): string {
  return format(parseISO(iso), pattern);
}

export function formatDateTime(date: Date, timeZone = "Asia/Kolkata"): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function initials(name: string | null | undefined, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
