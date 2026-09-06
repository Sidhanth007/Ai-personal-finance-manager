import { google } from "@ai-sdk/google";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isAiConfigured } from "@/lib/env";
import { todayISO } from "@/lib/format";
import { buildSystemPrompt } from "@/lib/ai-prompt";
import { rateLimit } from "@/lib/rate-limit";
import { createConversation, getConversation, saveMessage } from "@/server/services/ai";
import { buildFinanceTools } from "@/server/services/ai-tools";

export const maxDuration = 60;

/** Overridable so the model can be swapped without a code change when Google rotates free-tier models. */
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
const HOURLY_LIMIT = 20;
const DAILY_LIMIT = 100;

function textOf(m: UIMessage): string {
  return m.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("\n")
    .trim();
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAiConfigured) {
    return NextResponse.json({ error: "The AI assistant is not configured yet. Add GOOGLE_GENERATIVE_AI_API_KEY to enable it." }, { status: 503 });
  }

  const [hourly, daily] = await Promise.all([rateLimit(`ai:h:${user.id}`, HOURLY_LIMIT, 3600), rateLimit(`ai:d:${user.id}`, DAILY_LIMIT, 86400)]);
  if (!hourly.ok || !daily.ok) {
    const wait = !hourly.ok ? hourly.resetInSeconds : daily.resetInSeconds;
    return NextResponse.json({ error: `You have reached the assistant limit. Try again in ${Math.ceil(wait / 60)} minutes.` }, { status: 429 });
  }

  let body: { messages?: UIMessage[]; conversationId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const messages = (body.messages ?? []).slice(-30);
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return NextResponse.json({ error: "No message" }, { status: 400 });
  const userText = textOf(lastUser);
  if (!userText || userText.length > 2000) return NextResponse.json({ error: "Message must be 1–2000 characters" }, { status: 400 });

  let conversationId = body.conversationId ?? null;
  if (conversationId && !(await getConversation(user.id, conversationId))) conversationId = null;
  if (!conversationId) conversationId = await createConversation(user.id, userText.replace(/\s+/g, " ").slice(0, 60));
  await saveMessage({ userId: user.id, conversationId, role: "user", content: userText });

  const today = todayISO(user.timezone);
  const tools = buildFinanceTools({ userId: user.id, currency: user.currency, timezone: user.timezone, today });

  const result = streamText({
    model: google(MODEL),
    system: buildSystemPrompt({ firstName: user.name?.split(" ")[0] ?? null, currency: user.currency, today }),
    messages: await convertToModelMessages(messages, { tools, ignoreIncompleteToolCalls: true }),
    tools,
    stopWhen: stepCountIs(6),
    temperature: 0.4,
    onFinish: async ({ text, totalUsage }) => {
      if (text.trim()) {
        await saveMessage({
          userId: user.id,
          conversationId: conversationId!,
          role: "assistant",
          content: text,
          inputTokens: totalUsage.inputTokens,
          outputTokens: totalUsage.outputTokens,
        });
      }
    },
    onError: ({ error }) => {
      console.error("[ai] stream error", error instanceof Error ? error.message : error);
    },
  });

  return result.toUIMessageStreamResponse({
    headers: { "x-conversation-id": conversationId },
    onError: (error) => (error instanceof Error && /quota|rate|429/i.test(error.message) ? "The AI provider's free-tier limit was hit. Please try again in a minute." : "The assistant hit a problem. Please try again."),
  });
}
