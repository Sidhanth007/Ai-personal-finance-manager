# AI Personal Finance Manager

A complete, responsive personal finance manager built for demonstration on free
platforms only. Track income and expenses, categories, budgets, recurring
transactions, bills and subscriptions, and savings goals; see dashboards, charts,
monthly reports, and a transparent financial health score; get automated
reminders and a weekly digest; and talk to an AI budgeting assistant that works
from your own data.

> Everything this application and its AI assistant produce is for educational and
> personal budgeting purposes only. It is not professional financial, investment,
> tax, or legal advice, and nothing is a guaranteed recommendation. Consult a
> qualified professional for professional financial decisions.

## Features

| Area | What you get |
|---|---|
| Accounts | Passwordless signup and login with a 6-digit email code sent through Brevo |
| Transactions | Add, edit, delete, search, filter, paginate; CSV import and export; category manager |
| Recurring | Rules that create transactions on a schedule; subscriptions charge themselves on renewal |
| Budgets | Per-category and overall monthly limits, progress, alert thresholds, copy last month |
| Savings goals | Targets and dates, contributions (optionally recorded as expenses), pace and projected finish |
| Bills and subscriptions | Due dates, mark paid with automatic roll-forward, overdue detection, monthly subscription cost |
| Analytics | Dashboard KPIs, six and twelve month trends, category shares, daily pace, top merchants, unusual expenses |
| Health score | Deterministic 0 to 100 score from savings rate, budget adherence, bills on time, stability, and emergency buffer |
| AI assistant | Google Gemini with read-only tools over aggregated data; spending analysis, anomaly detection, budget suggestions, goal planning, general questions; strict guardrails and disclaimer |
| Automation | Daily job: recurring engine, overdue bills, reminder emails, budget alerts. Weekly job: digest email with AI insights |
| Sandbox payments | Stripe test mode hosted checkout, or a fully simulated flow when no Stripe keys exist. Never real money |
| Admin | Single admin (by email): aggregate analytics, service status, cron health, email delivery, account deactivation, audit log |

## Stack

Next.js 16 (App Router, TypeScript), Tailwind CSS 4, shadcn/ui, Recharts, Drizzle ORM,
Neon Postgres, Brevo, Google Gemini via the Vercel AI SDK, Stripe test mode, Upstash
Redis (optional), Vercel Hobby hosting with Vercel Cron, Vitest.

## Local development

```bash
cp .env.example .env.local     # then fill in the values below
npm install
npm run db:migrate             # creates the tables in your Neon database
npm run dev                    # http://localhost:3020
```

Other scripts: `npm run build`, `npm run lint`, `npm run typecheck`, `npm test`,
`npm run db:generate` (after editing `src/lib/db/schema.ts`), `npm run db:studio`,
`npm run db:check`.

Without Brevo keys, development mode prints the login code in the terminal.
Without Gemini keys the assistant page explains it is disabled. Without Stripe
keys the payment page runs in simulated mode. Without Upstash, rate limits are
kept in memory.

## Environment variables

| Variable | Required | Where to get it |
|---|---|---|
| `DATABASE_URL` | yes | Neon console, Connect, pooled connection string |
| `AUTH_SECRET` | yes | `openssl rand -base64 48` |
| `ADMIN_EMAIL` | yes | The one email that gets the admin dashboard |
| `NEXT_PUBLIC_APP_URL` | yes | `http://localhost:3020` locally, your Vercel URL in production |
| `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` | for email | Brevo, SMTP & API keys; verify the sender first and disable IP authorisation |
| `GOOGLE_GENERATIVE_AI_API_KEY` | for AI | Google AI Studio. Optional `GEMINI_MODEL` overrides the default `gemini-3.6-flash` |
| `CRON_SECRET` | production | `openssl rand -hex 32`; Vercel sends it as a bearer token to cron routes |
| `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | optional | Stripe dashboard in **test mode** only. The app refuses live keys |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | optional | Upstash console, Redis database, REST credentials |

## Free-tier limits to know

- **Neon**: 0.5 GB storage per project, compute suspends when idle and wakes on the first request.
- **Brevo**: 300 emails per day; free-plan emails carry a Brevo footer.
- **Google AI Studio**: per-minute and per-day request caps; Google may use free-tier prompts to improve its products. The app sends only aggregated numbers.
- **Vercel Hobby**: non-commercial use; cron jobs run once per day at most, which matches the daily and weekly schedules here.
- **Stripe test mode**: unlimited, no real money.
- **Upstash**: 500k commands per month.

## Deploying to Vercel

1. Push this repository to GitHub.
2. In Vercel, import the repository. Framework preset: Next.js. Leave build settings default.
3. Add every environment variable from the table above in Project Settings. Set
   `NEXT_PUBLIC_APP_URL` to `https://<your-project>.vercel.app`.
4. Deploy. `vercel.json` registers two cron jobs: `/api/cron/daily` at 02:30 UTC
   and `/api/cron/weekly` on Mondays at 03:00 UTC. Vercel calls them with
   `Authorization: Bearer $CRON_SECRET`.
5. Optional Stripe webhook: in the Stripe dashboard (test mode) add an endpoint
   `https://<your-project>.vercel.app/api/webhooks/stripe` for the event
   `checkout.session.completed`, then copy its signing secret into
   `STRIPE_WEBHOOK_SECRET`. The success page also confirms payments directly with
   Stripe, so the webhook is a belt-and-braces addition.
6. Sign up with the `ADMIN_EMAIL` address to get the admin dashboard.

Run the migration against the production database once from your machine with the
production `DATABASE_URL` in `.env.local`:

```bash
npm run db:migrate
```

## Testing

```bash
npm test                # 33 unit tests: money math, CSV, schedules, budgets, goals, health score, validation
npm run lint
npm run typecheck
npm run build
```

Manual smoke test after deploying: sign up, add a few transactions, set a budget,
create a goal and a bill, open Reports and the AI assistant, send yourself the
digest from Settings, try a sandbox payment, and open the admin dashboard.

## Project structure

```
src/
  app/                 routes: (auth) login/signup, (app) all signed-in pages, api/ chat, cron, export, webhooks
  components/          ui/ primitives, feature folders, charts/, layout/, shared/
  lib/                 pure helpers: format, months, schedule, csv, health-score, goal-math, budget-math, validations/, env, rate-limit, auth/
  server/services/     data access and domain logic (transactions, budgets, goals, bills, recurring, reminders, digest, analytics, ai, payments, admin, cron, email)
  server/actions/      server actions called from the UI
  proxy.ts             route protection
drizzle/               SQL migrations
tests/                 Vitest unit tests
```

See `SECURITY.md` for the security and privacy model.
