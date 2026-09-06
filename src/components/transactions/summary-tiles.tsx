import { formatMoney } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  income: number;
  expense: number;
  net: number;
  total: number;
  currency: string;
};

export function SummaryTiles({ income, expense, net, total, currency }: Props) {
  const tiles = [
    { label: "Income", value: formatMoney(income, currency), dot: "bg-emerald-500" },
    { label: "Expenses", value: formatMoney(expense, currency), dot: "bg-rose-500" },
    { label: "Net", value: formatMoney(net, currency, { signed: true }), dot: net >= 0 ? "bg-emerald-500" : "bg-rose-500" },
    { label: "Transactions", value: total.toLocaleString("en-IN"), dot: "bg-muted-foreground" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <Card key={t.label} size="sm">
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className={cn("size-2 rounded-full", t.dot)} aria-hidden />
              {t.label}
            </div>
            <div className="mt-1 truncate text-xl font-semibold">{t.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
