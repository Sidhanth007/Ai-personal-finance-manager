import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { isAiConfigured, isEmailConfigured, isRedisConfigured, isStripeConfigured } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { adminOverview, listUsersForAdmin, recentAudit, signupsPerDay } from "@/server/services/admin";
import { recentCronRuns } from "@/server/services/cron";
import { PageHeader } from "@/components/shared/page-header";
import { KpiTiles } from "@/components/dashboard/kpi-tiles";
import { SignupsChart } from "@/components/charts/signups-chart";
import { UsersTable } from "@/components/admin/users-table";
import { JobRunner } from "@/components/admin/job-runner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const admin = await requireAdmin();
  const [overview, signups, users, cron, audit] = await Promise.all([adminOverview(), signupsPerDay(30), listUsersForAdmin(), recentCronRuns(15), recentAudit(30)]);
  const tz = admin.timezone;

  const services = [
    { name: "Email (Brevo)", on: isEmailConfigured },
    { name: "AI (Gemini)", on: isAiConfigured },
    { name: "Payments (Stripe test)", on: isStripeConfigured },
    { name: "Rate limit (Upstash)", on: isRedisConfigured },
  ];

  return (
    <>
      <PageHeader
        title="Admin dashboard"
        description="Aggregate application analytics and account management. Individual users' financial data is never shown here."
        actions={<JobRunner />}
      />
      <div className="space-y-4">
        <KpiTiles
          items={[
            { label: "Users", value: String(overview.users.total), delta: { text: `${overview.users.new7d} new this week · ${overview.users.active} active`, good: null } },
            { label: "Logged in (30d)", value: String(overview.users.loggedIn30d), delta: { text: `${overview.users.loggedIn7d} in the last 7 days`, good: null } },
            { label: "Transactions", value: overview.transactions.total.toLocaleString("en-IN"), delta: { text: `${overview.transactions.last30d} added in 30d · ${overview.transactions.recurring} recurring · ${overview.transactions.imported} imported · ${overview.transactions.sandbox} sandbox`, good: null } },
            { label: "AI messages (30d)", value: String(overview.ai.messages30d), delta: { text: `${overview.ai.usersUsingAi30d} users · ${((overview.ai.inputTokens30d + overview.ai.outputTokens30d) / 1000).toFixed(1)}k tokens`, good: null } },
          ]}
        />

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Signups</CardTitle>
              <CardDescription>Last 30 days.</CardDescription>
            </CardHeader>
            <CardContent>
              <SignupsChart data={signups} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Services</CardTitle>
              <CardDescription>Configured via environment variables.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {services.map((s) => (
                  <li key={s.name} className="flex items-center justify-between">
                    <span>{s.name}</span>
                    <Badge variant={s.on ? "secondary" : "outline"}>{s.on ? "configured" : "fallback"}</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Email delivery (30 days)</CardTitle>
            </CardHeader>
            <CardContent>
              {overview.emails.length === 0 ? (
                <p className="text-sm text-muted-foreground">No emails sent yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Sent</TableHead>
                      <TableHead className="text-right">Failed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.emails.map((e) => (
                      <TableRow key={e.type}>
                        <TableCell className="capitalize">{e.type.replace(/_/g, " ")}</TableCell>
                        <TableCell className="text-right tabular-nums">{e.sent}</TableCell>
                        <TableCell className="text-right tabular-nums">{e.failed}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scheduled jobs</CardTitle>
              <CardDescription>Daily at 02:30 UTC, weekly on Monday 03:00 UTC (Vercel Cron).</CardDescription>
            </CardHeader>
            <CardContent>
              {cron.length === 0 ? (
                <p className="text-sm text-muted-foreground">No runs recorded yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Summary</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cron.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.job}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(c.startedAt, tz)}</TableCell>
                        <TableCell><Badge variant={c.status === "success" ? "secondary" : c.status === "failed" ? "destructive" : "outline"}>{c.status}</Badge></TableCell>
                        <TableCell className="max-w-64 truncate font-mono text-[11px] text-muted-foreground" title={JSON.stringify(c.summary ?? c.error)}>{c.error ?? JSON.stringify(c.summary)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
            <CardDescription>Deactivating an account blocks login and ends its sessions. Data is kept.</CardDescription>
          </CardHeader>
          <CardContent>
            <UsersTable users={users} adminId={admin.id} timezone={tz} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit log</CardTitle>
          </CardHeader>
          <CardContent>
            {audit.length === 0 ? (
              <p className="text-sm text-muted-foreground">No admin actions yet.</p>
            ) : (
              <ul className="divide-y text-sm">
                {audit.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-mono text-xs">{a.action}</span>
                      {a.targetType && <span className="text-muted-foreground"> · {a.targetType} {(a.metadata as { email?: string })?.email ?? a.targetId}</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">{a.adminEmail} · {formatDateTime(a.createdAt, tz)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
