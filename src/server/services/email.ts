import "server-only";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { env, isEmailConfigured } from "@/lib/env";

type NotificationType = (typeof notifications.$inferInsert)["type"];

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  type: NotificationType;
  userId?: string | null;
  payload?: Record<string, unknown>;
};

export type SendEmailResult =
  | { ok: true; providerMessageId: string; delivered: "brevo" | "console" }
  | { ok: false; error: string };

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

/**
 * Sends a transactional email through Brevo.
 *
 * Development fallback: when Brevo is not configured and NODE_ENV is not
 * production, the email is printed to the server console instead so the
 * whole flow can be tested without an API key. Production never falls back.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const { to, subject, html, text, type, userId = null, payload } = input;

  if (!isEmailConfigured) {
    if (env.NODE_ENV === "production") {
      await logNotification({ to, subject, type, userId, payload, status: "failed", error: "Email provider not configured" });
      return { ok: false, error: "Email provider not configured" };
    }
    console.log(
      `\n──────── [email:dev-console] ────────\nTo:      ${to}\nSubject: ${subject}\n\n${text}\n──────────────────────────────────────\n`,
    );
    await logNotification({ to, subject, type, userId, payload, status: "sent", providerMessageId: "dev-console" });
    return { ok: true, providerMessageId: "dev-console", delivered: "console" };
  }

  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": env.BREVO_API_KEY!,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: env.BREVO_SENDER_EMAIL, name: env.BREVO_SENDER_NAME },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
    });

    const body = (await res.json().catch(() => ({}))) as { messageId?: string; message?: string };

    if (!res.ok) {
      const error = body.message ?? `Brevo responded with ${res.status}`;
      await logNotification({ to, subject, type, userId, payload, status: "failed", error });
      return { ok: false, error };
    }

    const providerMessageId = body.messageId ?? "unknown";
    await logNotification({ to, subject, type, userId, payload, status: "sent", providerMessageId });
    return { ok: true, providerMessageId, delivered: "brevo" };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown email error";
    await logNotification({ to, subject, type, userId, payload, status: "failed", error });
    return { ok: false, error };
  }
}

async function logNotification(args: {
  to: string;
  subject: string;
  type: NotificationType;
  userId: string | null;
  payload?: Record<string, unknown>;
  status: "sent" | "failed";
  providerMessageId?: string;
  error?: string;
}) {
  await db.insert(notifications).values({
    userId: args.userId,
    type: args.type,
    channel: "email",
    subject: args.subject,
    status: args.status,
    providerMessageId: args.providerMessageId,
    error: args.error,
    // Never store the OTP code itself. Only the recipient.
    payload: { to: args.to, ...(args.payload ?? {}) },
    sentAt: args.status === "sent" ? new Date() : null,
  });
}

export async function sendOtpEmail(to: string, code: string, purpose: "signup" | "login") {
  const action = purpose === "signup" ? "finish creating your account" : "sign in";
  const subject = `${code} is your ${env.BREVO_SENDER_NAME} verification code`;
  const text = [
    `Use this code to ${action}: ${code}`,
    "",
    "It expires in 10 minutes. If you did not request it, you can ignore this email.",
    "",
    `${env.BREVO_SENDER_NAME} is for educational and personal budgeting purposes only.`,
  ].join("\n");
  const html = `
    <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
      <h2 style="margin:0 0 16px">Your verification code</h2>
      <p>Use this code to ${action}:</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:16px 0">${code}</p>
      <p style="color:#475569">It expires in 10 minutes. If you did not request it, you can ignore this email.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
      <p style="font-size:12px;color:#64748b">${env.BREVO_SENDER_NAME} is for educational and personal budgeting purposes only.</p>
    </div>`;

  return sendEmail({ to, subject, html, text, type: "otp", payload: { purpose } });
}
