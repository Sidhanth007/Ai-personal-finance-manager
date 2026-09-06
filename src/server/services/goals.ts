import "server-only";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { format, parseISO, subDays } from "date-fns";
import { db } from "@/lib/db";
import { goalContributions, savingsGoals } from "@/lib/db/schema";
import { projectGoal } from "@/lib/goal-math";

export type GoalRow = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  status: "active" | "completed" | "archived";
  color: string | null;
  notes: string | null;
  pct: number;
  remaining: number;
  /** average contribution per 30 days over the last 90 days, in minor units */
  monthlyPace: number;
  /** projected completion date based on pace, or null if no pace */
  projectedDate: string | null;
  /** required monthly saving to hit targetDate, or null if no date */
  requiredMonthly: number | null;
  onTrack: boolean | null;
  createdAt: Date;
};

export type ContributionRow = {
  id: string;
  goalId: string;
  amount: number;
  contributedOn: string;
  note: string | null;
  transactionId: string | null;
};

export { projectGoal };

export async function listGoals(userId: string, today: string, opts: { includeArchived?: boolean } = {}) {
  const conds = [eq(savingsGoals.userId, userId)];
  const goals = await db
    .select()
    .from(savingsGoals)
    .where(and(...conds))
    .orderBy(asc(savingsGoals.status), asc(savingsGoals.targetDate), desc(savingsGoals.createdAt));

  const since = format(subDays(parseISO(today), 90), "yyyy-MM-dd");
  const pace = await db
    .select({
      goalId: goalContributions.goalId,
      total: sql<number>`coalesce(sum(${goalContributions.amount}), 0)`.mapWith(Number),
    })
    .from(goalContributions)
    .where(and(eq(goalContributions.userId, userId), gte(goalContributions.contributedOn, since)))
    .groupBy(goalContributions.goalId);
  const paceMap = new Map(pace.map((p) => [p.goalId, p.total / 3]));

  return goals
    .filter((g) => opts.includeArchived || g.status !== "archived")
    .map<GoalRow>((g) => {
      const monthlyPace = Math.round(paceMap.get(g.id) ?? 0);
      const p = projectGoal({
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        targetDate: g.targetDate,
        monthlyPace,
        today,
      });
      return { ...g, monthlyPace, ...p };
    });
}

export async function getGoal(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(savingsGoals)
    .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function listContributions(userId: string, goalId: string): Promise<ContributionRow[]> {
  return db
    .select({
      id: goalContributions.id,
      goalId: goalContributions.goalId,
      amount: goalContributions.amount,
      contributedOn: goalContributions.contributedOn,
      note: goalContributions.note,
      transactionId: goalContributions.transactionId,
    })
    .from(goalContributions)
    .where(and(eq(goalContributions.userId, userId), eq(goalContributions.goalId, goalId)))
    .orderBy(desc(goalContributions.contributedOn), desc(goalContributions.createdAt));
}

export async function goalsSummary(userId: string) {
  const [row] = await db
    .select({
      active: sql<number>`count(*) filter (where ${savingsGoals.status} = 'active')`.mapWith(Number),
      saved: sql<number>`coalesce(sum(${savingsGoals.currentAmount}) filter (where ${savingsGoals.status} <> 'archived'), 0)`.mapWith(Number),
      target: sql<number>`coalesce(sum(${savingsGoals.targetAmount}) filter (where ${savingsGoals.status} = 'active'), 0)`.mapWith(Number),
    })
    .from(savingsGoals)
    .where(eq(savingsGoals.userId, userId));
  return row;
}
