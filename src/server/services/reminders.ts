import "server-only";
import { and, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bills, notifications, subscriptions, users } from "@/lib/db/schema";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import { currentMonthKey, monthLabel } from "@/lib/months";
import { daysUntil, describeDue } from "@/lib/schedule";
import { getBudgetsForMonth, type BudgetRow } from "./budgets";
import { sendEmail } from "./email";
import { escapeHtml, layout, paragraph, section, table, textFooter } from "./email-templates";

export type ReminderResult = { usersChecked: number; emailsSent: number; itemsReminded: number; budgetAlerts: number };

type DueItem = { kind: "bill" | "subscription"; id: string; name: string; amount: number; date: string; days: number };

/**
 * For every user with reminders enabled: collect bills and subscriptions inside
 * their reminder window that have not been reminded this cycle, plus budgets
 * that crossed their threshold and have not been alerted this month. Sends one
 * email per user and records what was sent so it is not repeated.
 */
export async function sendDueReminders(onlyUserId?: string): Promise<ReminderResult> {
  const result: ReminderResult = { usersChecked: 0, emailsSent: 0, itemsReminded: 0, budgetAlerts: 0 };

  const userRows = await db
    .select()
    .from(users)
    .where(and(eq(users.isActive, true), eq(users.remindersEnabled, true), onlyUserId ? eq(users.id, onlyUserId) : undefined));

  for (const u of userRows) {
    result.usersChecked++;
    const today = todayISO(u.timezone);
    const monthKey = currentMonthKey(u.timezone);

    // Bills in window and not yet reminded for this due date.
    const billRows = await db
      .select()
      .from(bills)
      .where(and(eq(bills.userId, u.id), ne(bills.status, "paid")));
    const dueBills: DueItem[] = billRows
      .filter((b) => {
        const d = daysUntil(b.dueDate, today);
        const inWindow = d <= b.reminderDaysBefore;
        const alreadyReminded = b.lastRemindedAt !== null && b.lastRemindedAt.toISOString().slice(0, 10) >= today;
        // Overdue bills get a fresh reminder every 3 days.
        const overdueRepeat = d < 0 && b.lastRemindedAt !== null && Date.now() - b.lastRemindedAt.getTime() > 3 * 86400000;
        return inWindow && (b.lastRemindedAt === null || overdueRepeat) && !alreadyReminded;
      })
      .map((b) => ({ kind: "bill", id: b.id, name: b.name, amount: b.amount, date: b.dueDate, days: daysUntil(b.dueDate, today) }));

    const subRows = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, u.id), eq(subscriptions.status, "active"), gte(subscriptions.nextBillingDate, today)));
    const dueSubs: DueItem[] = subRows
      .filter((s) => daysUntil(s.nextBillingDate, today) <= s.reminderDaysBefore && s.lastRemindedAt === null)
      .map((s) => ({ kind: "subscription", id: s.id, name: s.name, amount: s.amount, date: s.nextBillingDate, days: daysUntil(s.nextBillingDate, today) }));

    // Budget alerts not yet sent this month.
    const budgetData = await getBudgetsForMonth(u.id, monthKey);
    const flagged = [...(budgetData.overall ? [budgetData.overall] : []), ...budgetData.categoryBudgets].filter((b) => b.status !== "ok");
    let alerts: BudgetRow[] = [];
    if (flagged.length) {
      const sent = await db
        .select({ payload: notifications.payload })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, u.id),
            eq(notifications.type, "budget_alert"),
            eq(notifications.status, "sent"),
            sql`${notifications.payload}->>'month' = ${monthKey}`,
          ),
        );
      const alerted = new Set(sent.map((s) => `${(s.payload as { budgetId?: string })?.budgetId}:${(s.payload as { status?: string })?.status}`));
      alerts = flagged.filter((b) => !alerted.has(`${b.id}:${b.status}`));
    }

    const items = [...dueBills, ...dueSubs].sort((a, b) => a.date.localeCompare(b.date));
    if (items.length === 0 && alerts.length === 0) continue;

    const html = buildReminderHtml(u.name, u.currency, items, alerts, monthKey);
    const text = buildReminderText(u.name, u.currency, items, alerts, monthKey);
    const subject = subjectFor(items, alerts);

    const sent = await sendEmail({
      to: u.email,
      subject,
      html,
      text,
      type: items.length ? (dueBills.length ? "bill_reminder" : "subscription_reminder") : "budget_alert",
      userId: u.id,
      payload: { items: items.map((i) => ({ kind: i.kind, id: i.id, date: i.date })), month: monthKey },
    });
    if (!sent.ok) continue;

    result.emailsSent++;
    result.itemsReminded += items.length;
    result.budgetAlerts += alerts.length;

    const now = new Date();
    const billIds = dueBills.map((b) => b.id);
    const subIds = dueSubs.map((s) => s.id);
    if (billIds.length) await db.update(bills).set({ lastRemindedAt: now }).where(inArray(bills.id, billIds));
    if (subIds.length) await db.update(subscriptions).set({ lastRemindedAt: now }).where(inArray(subscriptions.id, subIds));
    for (const a of alerts) {
      await db.insert(notifications).values({
        userId: u.id,
        type: "budget_alert",
        channel: "in_app",
        subject: `${a.categoryName} budget ${a.status === "over" ? "exceeded" : "near limit"}`,
        status: "sent",
        payload: { budgetId: a.id, month: monthKey, status: a.status, pct: a.pct },
        sentAt: now,
      });
    }
  }

  return result;
}

function subjectFor(items: DueItem[], alerts: BudgetRow[]): string {
  const parts: string[] = [];
  const overdue = items.filter((i) => i.days < 0).length;
  if (overdue) parts.push(`${overdue} overdue`);
  const due = items.length - overdue;
  if (due) parts.push(`${due} due soon`);
  if (alerts.length) parts.push(`${alerts.length} budget alert${alerts.length === 1 ? "" : "s"}`);
  return `Reminder: ${parts.join(", ")}`;
}

function buildReminderHtml(name: string | null, currency: string, items: DueItem[], alerts: BudgetRow[], monthKey: string): string {
  let body = paragraph(`Hi ${escapeHtml(name ?? "there")}, here is what needs your attention.`);
  if (items.length) {
    body += section(
      "Bills and renewals",
      table(
        items.map((i) => [
          `<strong>${escapeHtml(i.name)}</strong><br><span style="color:${i.days < 0 ? "#dc2626" : "#64748b"};font-size:12px">${i.kind === "subscription" ? "Renews" : describeDue(i.days).startsWith("Due") ? "" : ""}${escapeHtml(describeDue(i.days))} · ${formatDate(i.date)}</span>`,
          formatMoney(i.amount, currency),
        ]),
      ),
    );
  }
  if (alerts.length) {
    body += section(
      `Budget alerts for ${monthLabel(monthKey)}`,
      table(
        alerts.map((a) => [
          `<strong>${escapeHtml(a.categoryName)}</strong><br><span style="color:${a.status === "over" ? "#dc2626" : "#d97706"};font-size:12px">${a.status === "over" ? "Over budget" : "Near limit"} · ${a.pct}% used</span>`,
          `${formatMoney(a.spent, currency)} / ${formatMoney(a.amount, currency)}`,
        ]),
      ),
    );
  }
  return layout("Your finance reminders", body);
}

function buildReminderText(name: string | null, currency: string, items: DueItem[], alerts: BudgetRow[], monthKey: string): string {
  const lines = [`Hi ${name ?? "there"}, here is what needs your attention.`, ""];
  if (items.length) {
    lines.push("Bills and renewals:");
    for (const i of items) lines.push(`  - ${i.name}: ${formatMoney(i.amount, currency)} · ${describeDue(i.days)} (${formatDate(i.date)})`);
    lines.push("");
  }
  if (alerts.length) {
    lines.push(`Budget alerts for ${monthLabel(monthKey)}:`);
    for (const a of alerts) lines.push(`  - ${a.categoryName}: ${a.status === "over" ? "over budget" : "near limit"}, ${a.pct}% used (${formatMoney(a.spent, currency)} of ${formatMoney(a.amount, currency)})`);
  }
  return lines.join("\n") + textFooter();
}
