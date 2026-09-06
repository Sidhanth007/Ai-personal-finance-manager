import "server-only";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { format, parseISO, subDays } from "date-fns";
import { db } from "@/lib/db";
import { categories, transactions, users, type User } from "@/lib/db/schema";
import { isAiConfigured } from "@/lib/env";
import { formatDate, formatMoney, fromMinorUnits, todayISO } from "@/lib/format";
import { currentMonthKey, monthLabel } from "@/lib/months";
import { describeDue } from "@/lib/schedule";
import { AI_DISCLAIMER } from "@/lib/ai-prompt";
import { getBudgetsForMonth } from "./budgets";
import { upcomingObligations, subscriptionMonthlyTotal } from "./bills";
import { sendEmail } from "./email";
import { escapeHtml, layout, paragraph, section, table, textFooter } from "./email-templates";
import { listGoals } from "./goals";
import { healthScore } from "./analytics";

export type DigestData = {
  weekStart: string;
  weekEnd: string;
  income: number;
  expense: number;
  net: number;
  prevExpense: number;
  topCategories: { name: string; amount: number }[];
  transactionCount: number;
  budgets: { name: string; pct: number; status: string; spent: number; limit: number }[];
  goals: { name: string; pct: number; saved: number; target: number; onTrack: boolean | null }[];
  upcoming: { name: string; kind: string; amount: number; date: string; days: number }[];
  subscriptionsMonthly: number;
  health: { score: number; grade: string };
  insights: string[];
  insightsSource: "ai" | "rules";
};

async function weekTotals(userId: string, start: string, end: string) {
  const [row] = await db
    .select({
      income: sql<number>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} else 0 end), 0)`.mapWith(Number),
      expense: sql<number>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amount} else 0 end), 0)`.mapWith(Number),
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), gte(transactions.occurredOn, start), lte(transactions.occurredOn, end)));
  return row;
}

export async function buildDigest(user: User): Promise<DigestData> {
  const today = todayISO(user.timezone);
  const weekEnd = today;
  const weekStart = format(subDays(parseISO(today), 6), "yyyy-MM-dd");
  const prevStart = format(subDays(parseISO(weekStart), 7), "yyyy-MM-dd");
  const prevEnd = format(subDays(parseISO(weekStart), 1), "yyyy-MM-dd");
  const monthKey = currentMonthKey(user.timezone);

  const [cur, prev, cats, budgets, goals, upcoming, subsMonthly, health] = await Promise.all([
    weekTotals(user.id, weekStart, weekEnd),
    weekTotals(user.id, prevStart, prevEnd),
    db
      .select({ name: categories.name, amount: sql<number>`coalesce(sum(${transactions.amount}), 0)`.mapWith(Number) })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(eq(transactions.userId, user.id), eq(transactions.type, "expense"), gte(transactions.occurredOn, weekStart), lte(transactions.occurredOn, weekEnd)))
      .groupBy(categories.name)
      .orderBy(sql`sum(${transactions.amount}) desc`)
      .limit(5),
    getBudgetsForMonth(user.id, monthKey),
    listGoals(user.id, today),
    upcomingObligations(user.id, today, 7),
    subscriptionMonthlyTotal(user.id),
    healthScore(user.id, user.timezone, today),
  ]);

  const allBudgets = [...(budgets.overall ? [budgets.overall] : []), ...budgets.categoryBudgets];
  const data: DigestData = {
    weekStart,
    weekEnd,
    income: cur.income,
    expense: cur.expense,
    net: cur.income - cur.expense,
    prevExpense: prev.expense,
    topCategories: cats.map((c) => ({ name: c.name ?? "Uncategorised", amount: c.amount })),
    transactionCount: cur.count,
    budgets: allBudgets.map((b) => ({ name: b.categoryName, pct: b.pct, status: b.status, spent: b.spent, limit: b.amount })),
    goals: goals.filter((g) => g.status === "active").slice(0, 4).map((g) => ({ name: g.name, pct: g.pct, saved: g.currentAmount, target: g.targetAmount, onTrack: g.onTrack })),
    upcoming: upcoming.map((u) => ({ name: u.name, kind: u.kind, amount: u.amount, date: u.dueDate, days: u.daysUntil })),
    subscriptionsMonthly: subsMonthly,
    health: { score: health.score, grade: health.grade },
    insights: [],
    insightsSource: "rules",
  };

  const rules = ruleInsights(data, user.currency);
  if (isAiConfigured && cur.count > 0) {
    try {
      data.insights = await aiInsights(data, user.currency);
      data.insightsSource = "ai";
    } catch (err) {
      console.error("[digest] AI insights failed, using rules:", err instanceof Error ? err.message : err);
      data.insights = rules;
    }
  } else {
    data.insights = rules;
  }
  return data;
}

function ruleInsights(d: DigestData, currency: string): string[] {
  const out: string[] = [];
  if (d.prevExpense > 0) {
    const change = Math.round(((d.expense - d.prevExpense) / d.prevExpense) * 100);
    out.push(change > 10 ? `Spending was up ${change}% versus the previous week.` : change < -10 ? `Spending was down ${Math.abs(change)}% versus the previous week. Nice.` : "Spending was roughly level with the previous week.");
  } else if (d.expense > 0) out.push(`You recorded ${formatMoney(d.expense, currency)} of expenses this week.`);
  if (d.topCategories[0]) out.push(`${d.topCategories[0].name} was your biggest category this week at ${formatMoney(d.topCategories[0].amount, currency)}.`);
  const over = d.budgets.filter((b) => b.status === "over");
  const warn = d.budgets.filter((b) => b.status === "warning");
  if (over.length) out.push(`${over.length} budget${over.length === 1 ? " is" : "s are"} over limit: ${over.map((b) => b.name).join(", ")}.`);
  else if (warn.length) out.push(`${warn.map((b) => b.name).join(", ")} ${warn.length === 1 ? "is" : "are"} close to the monthly limit.`);
  const behind = d.goals.filter((g) => g.onTrack === false);
  if (behind.length) out.push(`${behind.map((g) => g.name).join(", ")} ${behind.length === 1 ? "is" : "are"} behind pace for the target date.`);
  const overdue = d.upcoming.filter((u) => u.days < 0);
  if (overdue.length) out.push(`${overdue.length} bill${overdue.length === 1 ? " is" : "s are"} overdue.`);
  if (out.length === 0) out.push("A quiet week. Keep logging transactions to unlock richer insights.");
  return out.slice(0, 5);
}

async function aiInsights(d: DigestData, currency: string): Promise<string[]> {
  const major = (n: number) => fromMinorUnits(n, currency).toFixed(0);
  const facts = {
    currency,
    week: `${d.weekStart} to ${d.weekEnd}`,
    income: major(d.income),
    expenses: major(d.expense),
    previousWeekExpenses: major(d.prevExpense),
    topCategories: d.topCategories.map((c) => ({ name: c.name, amount: major(c.amount) })),
    budgets: d.budgets.map((b) => ({ name: b.name, percentUsed: b.pct, status: b.status })),
    goals: d.goals.map((g) => ({ name: g.name, percent: g.pct, onTrack: g.onTrack })),
    upcoming: d.upcoming.map((u) => ({ name: u.name, amount: major(u.amount), daysUntil: u.days })),
    healthScore: d.health,
  };
  const { text } = await generateText({
    model: google(process.env.GEMINI_MODEL ?? "gemini-3.6-flash"),
    temperature: 0.3,
    system:
      "You write 3 to 5 short, plain-language insight bullets for a weekly personal finance digest email. Use only the facts given. Be specific with numbers, neutral in tone, and suggest at most one small, practical budgeting action. No investment, tax, or legal advice. No guarantees. Output only bullet lines starting with '- ', nothing else.",
    prompt: JSON.stringify(facts),
  });
  const lines = text.split("\n").map((l) => l.replace(/^\s*[-*•]\s*/, "").trim()).filter(Boolean).slice(0, 5);
  if (lines.length === 0) throw new Error("empty insights");
  return lines;
}

export function renderDigestHtml(user: User, d: DigestData): string {
  const c = user.currency;
  let body = paragraph(`Hi ${escapeHtml(user.name?.split(" ")[0] ?? "there")}, here is your week from ${formatDate(d.weekStart)} to ${formatDate(d.weekEnd)}.`);
  body += table([
    ["Income", formatMoney(d.income, c)],
    ["Expenses", formatMoney(d.expense, c)],
    ["Net", formatMoney(d.net, c, { signed: true })],
    ["Previous week expenses", formatMoney(d.prevExpense, c)],
    ["Transactions logged", String(d.transactionCount)],
  ]);
  body += section("Insights" + (d.insightsSource === "ai" ? " (AI-generated)" : ""), `<ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.55">${d.insights.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`);
  if (d.topCategories.length) body += section("Top spending categories", table(d.topCategories.map((t) => [escapeHtml(t.name), formatMoney(t.amount, c)])));
  if (d.budgets.length) body += section(`Budgets · ${monthLabel(currentMonthKey(user.timezone))}`, table(d.budgets.map((b) => [`${escapeHtml(b.name)} <span style="color:${b.status === "over" ? "#dc2626" : b.status === "warning" ? "#d97706" : "#64748b"};font-size:12px">${b.pct}% used</span>`, `${formatMoney(b.spent, c)} / ${formatMoney(b.limit, c)}`])));
  if (d.goals.length) body += section("Savings goals", table(d.goals.map((g) => [`${escapeHtml(g.name)} <span style="color:#64748b;font-size:12px">${g.pct}%${g.onTrack === false ? " · behind pace" : ""}</span>`, `${formatMoney(g.saved, c)} / ${formatMoney(g.target, c)}`])));
  body += section("Next 7 days", d.upcoming.length ? table(d.upcoming.map((u) => [`${escapeHtml(u.name)} <span style="color:${u.days < 0 ? "#dc2626" : "#64748b"};font-size:12px">${u.kind === "subscription" ? "renews" : ""} ${escapeHtml(describeDue(u.days))} · ${formatDate(u.date)}</span>`, formatMoney(u.amount, c)])) : paragraph("Nothing due."));
  body += paragraph(`Active subscriptions cost about <strong>${formatMoney(d.subscriptionsMonthly, c)}</strong> per month. Your financial health score is <strong>${d.health.score}/100</strong> (${escapeHtml(d.health.grade)}).`);
  body += `<p style="margin:16px 0 0;font-size:11px;color:#64748b">${escapeHtml(AI_DISCLAIMER)}</p>`;
  return layout("Your weekly financial digest", body);
}

export function renderDigestText(user: User, d: DigestData): string {
  const c = user.currency;
  const lines = [
    `Hi ${user.name?.split(" ")[0] ?? "there"}, here is your week from ${formatDate(d.weekStart)} to ${formatDate(d.weekEnd)}.`,
    "",
    `Income: ${formatMoney(d.income, c)}`,
    `Expenses: ${formatMoney(d.expense, c)} (previous week ${formatMoney(d.prevExpense, c)})`,
    `Net: ${formatMoney(d.net, c, { signed: true })}`,
    "",
    "Insights:",
    ...d.insights.map((i) => `  - ${i}`),
  ];
  if (d.topCategories.length) lines.push("", "Top categories:", ...d.topCategories.map((t) => `  - ${t.name}: ${formatMoney(t.amount, c)}`));
  if (d.budgets.length) lines.push("", "Budgets:", ...d.budgets.map((b) => `  - ${b.name}: ${b.pct}% used (${formatMoney(b.spent, c)} of ${formatMoney(b.limit, c)})`));
  if (d.goals.length) lines.push("", "Savings goals:", ...d.goals.map((g) => `  - ${g.name}: ${g.pct}% (${formatMoney(g.saved, c)} of ${formatMoney(g.target, c)})`));
  lines.push("", "Next 7 days:", ...(d.upcoming.length ? d.upcoming.map((u) => `  - ${u.name}: ${formatMoney(u.amount, c)} · ${describeDue(u.days)}`) : ["  Nothing due."]));
  lines.push("", `Subscriptions: about ${formatMoney(d.subscriptionsMonthly, c)} per month. Health score: ${d.health.score}/100 (${d.health.grade}).`);
  lines.push("", AI_DISCLAIMER);
  return lines.join("\n") + textFooter();
}

export async function sendDigestTo(user: User): Promise<{ ok: boolean; error?: string; source?: "ai" | "rules" }> {
  const data = await buildDigest(user);
  const res = await sendEmail({
    to: user.email,
    subject: `Your weekly digest · ${formatDate(data.weekStart, "d MMM")} – ${formatDate(data.weekEnd, "d MMM")}`,
    html: renderDigestHtml(user, data),
    text: renderDigestText(user, data),
    type: "weekly_digest",
    userId: user.id,
    payload: { weekStart: data.weekStart, weekEnd: data.weekEnd, insightsSource: data.insightsSource, expense: data.expense, income: data.income },
  });
  return res.ok ? { ok: true, source: data.insightsSource } : { ok: false, error: res.error };
}

export async function sendWeeklyDigests(): Promise<{ usersChecked: number; sent: number; failed: number; aiInsights: number }> {
  const rows = await db.select().from(users).where(and(eq(users.isActive, true), eq(users.weeklyDigestEnabled, true)));
  const out = { usersChecked: rows.length, sent: 0, failed: 0, aiInsights: 0 };
  for (const u of rows) {
    const r = await sendDigestTo(u);
    if (r.ok) {
      out.sent++;
      if (r.source === "ai") out.aiInsights++;
    } else out.failed++;
  }
  return out;
}
