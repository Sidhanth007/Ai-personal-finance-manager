import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv";
import { fromMinorUnits } from "@/lib/format";
import { transactionFiltersSchema } from "@/lib/validations/transactions";
import { listAllTransactionsForExport } from "@/server/services/transactions";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = transactionFiltersSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid filters" }, { status: 400 });

  const rows = await listAllTransactionsForExport(user.id, parsed.data, user.currency);
  const csv = toCsv(
    ["date", "type", "amount", "currency", "category", "description", "merchant", "notes", "source"],
    rows.map((r) => [
      r.occurredOn,
      r.type,
      fromMinorUnits(r.amount, r.currency).toFixed(2),
      r.currency,
      r.category ?? "",
      r.description,
      r.merchant ?? "",
      r.notes ?? "",
      r.source,
    ]),
  );

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="transactions-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
