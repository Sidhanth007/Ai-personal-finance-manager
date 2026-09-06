import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

export type GoalProjection = {
  remaining: number;
  pct: number;
  projectedDate: string | null;
  requiredMonthly: number | null;
  onTrack: boolean | null;
};

/** Pure projection math for a savings goal. Amounts are minor units. */
export function projectGoal(args: {
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  monthlyPace: number;
  today: string;
}): GoalProjection {
  const { targetAmount, currentAmount, targetDate, monthlyPace, today } = args;
  const remaining = Math.max(0, targetAmount - currentAmount);
  const pct = targetAmount > 0 ? Math.min(100, Math.round((currentAmount / targetAmount) * 100)) : 0;

  let projectedDate: string | null = null;
  if (remaining === 0) projectedDate = today;
  else if (monthlyPace > 0) {
    const days = Math.ceil((remaining / monthlyPace) * 30);
    projectedDate = format(addDays(parseISO(today), days), "yyyy-MM-dd");
  }

  let requiredMonthly: number | null = null;
  let onTrack: boolean | null = null;
  if (targetDate) {
    const daysLeft = Math.max(1, differenceInCalendarDays(parseISO(targetDate), parseISO(today)));
    requiredMonthly = remaining === 0 ? 0 : Math.ceil((remaining / daysLeft) * 30);
    onTrack = remaining === 0 || (projectedDate !== null && projectedDate <= targetDate);
  }
  return { remaining, pct, projectedDate, requiredMonthly, onTrack };
}
