import { db } from "./index";
import { categories } from "./schema";

export type DefaultCategory = {
  name: string;
  type: "income" | "expense";
  icon: string;
  color: string;
};

/** Inserted for every new user at signup. Users can rename, archive, or add more. */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // income
  { name: "Salary", type: "income", icon: "briefcase", color: "#16a34a" },
  { name: "Freelance", type: "income", icon: "laptop", color: "#22c55e" },
  { name: "Investments", type: "income", icon: "trending-up", color: "#4ade80" },
  { name: "Gifts", type: "income", icon: "gift", color: "#86efac" },
  { name: "Other Income", type: "income", icon: "plus-circle", color: "#bbf7d0" },
  // expense
  { name: "Housing", type: "expense", icon: "home", color: "#2563eb" },
  { name: "Utilities", type: "expense", icon: "zap", color: "#0ea5e9" },
  { name: "Groceries", type: "expense", icon: "shopping-cart", color: "#f59e0b" },
  { name: "Dining Out", type: "expense", icon: "utensils", color: "#f97316" },
  { name: "Transport", type: "expense", icon: "car", color: "#8b5cf6" },
  { name: "Health", type: "expense", icon: "heart-pulse", color: "#ef4444" },
  { name: "Entertainment", type: "expense", icon: "clapperboard", color: "#ec4899" },
  { name: "Shopping", type: "expense", icon: "shopping-bag", color: "#d946ef" },
  { name: "Subscriptions", type: "expense", icon: "repeat", color: "#6366f1" },
  { name: "Education", type: "expense", icon: "graduation-cap", color: "#14b8a6" },
  { name: "Savings Transfer", type: "expense", icon: "piggy-bank", color: "#10b981" },
  { name: "Other Expense", type: "expense", icon: "circle-ellipsis", color: "#64748b" },
];

export async function seedDefaultCategories(userId: string) {
  await db
    .insert(categories)
    .values(DEFAULT_CATEGORIES.map((c) => ({ ...c, userId, isDefault: true })))
    .onConflictDoNothing();
}
