# Security and privacy notes

This is a demo application built only on free tiers. It handles personal financial
records, so it is built defensively, but it has not had an independent security audit.

## Authentication and sessions

- Passwordless. A 6-digit one-time code is emailed through Brevo. Codes are stored
  only as a keyed HMAC-SHA256 hash, expire after 10 minutes, allow 5 attempts, and
  are limited to 3 per email per 10 minutes plus 10 requests per IP per 15 minutes.
- Sessions are random 256-bit tokens stored hashed (SHA-256). The browser holds a
  signed JWT (HS256, `AUTH_SECRET`) in an `httpOnly`, `SameSite=Lax`, `Secure` (in
  production) cookie valid for 30 days. Logout revokes the server-side row.
- `src/proxy.ts` verifies the cookie signature before protected routes render;
  every page and server action then re-validates the session in the database and
  checks the account is active.

## Authorisation and data isolation

- Every query on user-owned tables filters by the authenticated user's id. Editing
  or deleting another user's record returns "not found".
- The single admin is the account whose email equals `ADMIN_EMAIL`. Admin views are
  aggregate only: counts, signups, email delivery, cron health, and account status.
  No amounts, categories, notes, goals, budgets, or AI conversation content are
  exposed. Admin actions are written to `admin_audit_log`.

## AI assistant

- The model only receives aggregated figures returned by read-only tools (totals,
  category shares, budget percentages, goal progress, upcoming due items). Emails,
  record ids, merchant notes, and free text notes are never sent.
- The system prompt forbids investment, tax, legal, and guaranteed advice and
  requires the educational-use disclaimer on every reply. Tool outputs are data,
  not instructions.
- Usage is capped at 20 messages per hour and 100 per day per user. Google's
  free tier may use prompts to improve its products; see their terms.

## Payments

- Only Stripe **test mode** is supported. The server refuses to start a checkout
  unless `STRIPE_SECRET_KEY` begins with `sk_test_`, and the webhook rejects
  `livemode: true` events. Without Stripe keys the flow runs fully simulated.
- Card data never touches this application; Stripe's hosted checkout collects it.

## Transport and headers

- HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy`, and a Content-Security-Policy are set in `next.config.ts`.
- Scheduled endpoints require `Authorization: Bearer <CRON_SECRET>`.

## Input handling

- All form input is validated with Zod on the server. Money is parsed into integer
  minor units. CSV imports are limited to 2 MB and 2,000 rows and are parsed with a
  strict RFC 4180 parser; imported values are treated as data only.
- AI replies are rendered as text with a minimal markdown renderer; no HTML from the
  model is ever inserted into the page.

## Rate limiting

- Uses Upstash Redis when `UPSTASH_REDIS_REST_URL`/`TOKEN` are set. Otherwise an
  in-memory fallback applies per server instance, which is weaker on serverless
  platforms because each instance keeps its own counters.

## Known limitations

- Data isolation is enforced in application code, not Postgres Row Level Security.
- Development mode prints OTP codes to the server console when Brevo is not configured.
  Production never falls back to that.
- `npm audit` reports moderate advisories in `drizzle-kit`'s bundled esbuild. It is a
  development-only tool and is not part of the deployed application.
- The Neon connection string was shared in a chat transcript during development;
  rotate the database password before treating the deployment as real.

## Reporting

This is a personal demo. If you find an issue, open an issue in the repository.
