import { describe, expect, it } from "vitest";
import { transactionFiltersSchema, transactionInputSchema } from "@/lib/validations/transactions";
import { budgetInputSchema } from "@/lib/validations/budgets";
import { checkoutInputSchema } from "@/lib/validations/payments";

describe("transactionInputSchema", () => {
  it("accepts a valid expense and normalises optional fields", () => {
    const r = transactionInputSchema.safeParse({ type: "expense", amount: "1,250.50", description: " Groceries ", occurredOn: "2026-09-05", merchant: "", notes: "", categoryId: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.amount).toBe(1250.5);
      expect(r.data.description).toBe("Groceries");
      expect(r.data.merchant).toBeUndefined();
      expect(r.data.categoryId).toBeUndefined();
    }
  });
  it("rejects zero, negative, and malformed amounts and bad dates", () => {
    expect(transactionInputSchema.safeParse({ type: "expense", amount: "0", description: "x", occurredOn: "2026-09-05" }).success).toBe(false);
    expect(transactionInputSchema.safeParse({ type: "expense", amount: "-5", description: "x", occurredOn: "2026-09-05" }).success).toBe(false);
    expect(transactionInputSchema.safeParse({ type: "expense", amount: "abc", description: "x", occurredOn: "2026-09-05" }).success).toBe(false);
    expect(transactionInputSchema.safeParse({ type: "expense", amount: "5", description: "x", occurredOn: "05/09/2026" }).success).toBe(false);
    expect(transactionInputSchema.safeParse({ type: "transfer", amount: "5", description: "x", occurredOn: "2026-09-05" }).success).toBe(false);
  });
});

describe("transactionFiltersSchema", () => {
  it("defaults page and drops empty strings", () => {
    const r = transactionFiltersSchema.safeParse({ q: "", type: "", page: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ page: 1 });
  });
  it("rejects invalid uuids and negative amounts", () => {
    expect(transactionFiltersSchema.safeParse({ categoryId: "nope" }).success).toBe(false);
    expect(transactionFiltersSchema.safeParse({ min: "-1" }).success).toBe(false);
  });
});

describe("budgetInputSchema", () => {
  it("bounds the alert threshold and defaults it", () => {
    expect(budgetInputSchema.safeParse({ month: "2026-09", amount: "100", alertThresholdPct: "20" }).success).toBe(false);
    const r = budgetInputSchema.safeParse({ month: "2026-09", amount: "100", alertThresholdPct: "" });
    expect(r.success && r.data.alertThresholdPct).toBe(80);
    expect(budgetInputSchema.safeParse({ month: "2026-13", amount: "100" }).success).toBe(false);
  });
});

describe("checkoutInputSchema", () => {
  it("caps sandbox amounts", () => {
    expect(checkoutInputSchema.safeParse({ amount: "100000", description: "ok" }).success).toBe(true);
    expect(checkoutInputSchema.safeParse({ amount: "100001", description: "too much" }).success).toBe(false);
  });
});
