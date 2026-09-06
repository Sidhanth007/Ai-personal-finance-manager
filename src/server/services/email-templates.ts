import "server-only";
import { env } from "@/lib/env";

const DISCLAIMER =
  "This email is for educational and personal budgeting purposes only. It is not professional financial, investment, tax, or legal advice. Consult a qualified professional for professional financial decisions.";

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function layout(title: string, bodyHtml: string): string {
  const app = escapeHtml(env.BREVO_SENDER_NAME);
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px">
    <div style="background:#ffffff;border-radius:12px;padding:24px;border:1px solid #e2e8f0">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#64748b">${app}</p>
      <h1 style="margin:0 0 16px;font-size:22px">${escapeHtml(title)}</h1>
      ${bodyHtml}
      <p style="margin:24px 0 0;font-size:13px"><a href="${env.NEXT_PUBLIC_APP_URL}/dashboard" style="color:#2563eb">Open ${app}</a> · <a href="${env.NEXT_PUBLIC_APP_URL}/settings" style="color:#64748b">Email preferences</a></p>
    </div>
    <p style="margin:16px 8px 0;font-size:11px;line-height:1.5;color:#64748b">${DISCLAIMER}</p>
  </div></body></html>`;
}

export function section(heading: string, inner: string): string {
  return `<h2 style="margin:20px 0 8px;font-size:15px;color:#334155">${escapeHtml(heading)}</h2>${inner}`;
}

export function table(rows: [string, string][]): string {
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows
    .map(
      ([l, r]) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #f1f5f9">${l}</td><td style="padding:6px 0;border-bottom:1px solid #f1f5f9;text-align:right;white-space:nowrap">${r}</td></tr>`,
    )
    .join("")}</table>`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 12px;font-size:14px;line-height:1.55">${text}</p>`;
}

export function textFooter(): string {
  return `\n\n--\n${DISCLAIMER}\n${env.NEXT_PUBLIC_APP_URL}/settings to change email preferences.`;
}
