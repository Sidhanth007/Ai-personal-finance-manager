"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isTextUIPart, isToolUIPart, type UIMessage } from "ai";
import { Bot, Loader2, SendHorizontal, Sparkles, Square, User } from "lucide-react";
import { AI_DISCLAIMER, SUGGESTED_PROMPTS } from "@/lib/ai-prompt";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  conversationId: string | null;
  initialMessages: UIMessage[];
  configured: boolean;
  hourlyUsed: number;
  hourlyLimit: number;
};

const TOOL_LABELS: Record<string, string> = {
  getSpendingSummary: "Reading monthly totals",
  getCategoryBreakdown: "Reading category spending",
  getBudgetStatus: "Checking budgets",
  suggestBudget: "Computing budget suggestion",
  getUnusualExpenses: "Scanning for unusual expenses",
  getSavingsGoals: "Reading savings goals",
  getUpcomingBills: "Checking upcoming bills",
  getHealthScore: "Reading health score",
};

export function Chat({ conversationId, initialMessages, configured, hourlyUsed, hourlyLimit }: Props) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  // Mutable holder (not a ref) so the transport closures can read the id assigned after the first reply.
  const [conv] = useState(() => ({ id: conversationId }));
  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ conversationId: conv.id }),
        fetch: async (url, init) => {
          const res = await fetch(url, init);
          const id = res.headers.get("x-conversation-id");
          if (id && !conv.id) {
            conv.id = id;
            window.history.replaceState(null, "", `/assistant?c=${id}`);
          }
          return res;
        },
      }),
  );

  const { messages, sendMessage, status, error, stop, clearError } = useChat({
    id: conversationId ?? "new",
    messages: initialMessages,
    transport,
    onFinish: () => router.refresh(),
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  function submit(text: string) {
    const t = text.trim();
    if (!t || busy || !configured) return;
    clearError();
    setInput("");
    void sendMessage({ text: t });
  }

  return (
    <div className="flex h-[calc(100vh-11rem)] min-h-[480px] flex-col rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Sparkles className="size-3.5" /> Educational budgeting assistant · not professional advice
        </span>
        <span className="tabular-nums">{hourlyUsed}/{hourlyLimit} this hour</span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="mx-auto max-w-xl space-y-4 py-8 text-center">
            <Bot className="mx-auto size-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Ask about your money</h2>
            <p className="text-sm text-muted-foreground">
              I can analyse your spending patterns, flag unusual expenses, suggest budgets, track savings goals, and answer general personal-finance questions using only the data in this app.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED_PROMPTS.map((p) => (
                <Button key={p} variant="outline" size="sm" onClick={() => submit(p)} disabled={!configured || busy}>
                  {p}
                </Button>
              ))}
            </div>
            {!configured && (
              <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
                The assistant is not configured. Add a Google Gemini API key to enable it.
              </p>
            )}
          </div>
        )}

        {messages.map((m) => (
          <Message key={m.id} message={m} />
        ))}

        {busy && messages.at(-1)?.role === "user" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Thinking…
          </div>
        )}
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error.message || "Something went wrong."}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="border-t p-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            placeholder={configured ? "Ask about your spending, budgets, or goals… (Enter to send, Shift+Enter for a new line)" : "Assistant unavailable until configured"}
            rows={2}
            maxLength={2000}
            disabled={!configured}
            className="border-input min-h-10 flex-1 resize-none rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          />
          {busy ? (
            <Button type="button" variant="outline" size="icon" onClick={() => stop()} aria-label="Stop">
              <Square className="size-4" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!input.trim() || !configured} aria-label="Send">
              <SendHorizontal className="size-4" />
            </Button>
          )}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{AI_DISCLAIMER}</p>
      </form>
    </div>
  );
}

function Message({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const text = message.parts.filter(isTextUIPart).map((p) => p.text).join("");
  const tools = message.parts.filter(isToolUIPart);

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", isUser ? "bg-primary text-primary-foreground" : "bg-muted")}>
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>
      <div className={cn("max-w-[85%] space-y-2", isUser && "text-right")}>
        {tools.length > 0 && (
          <div className={cn("flex flex-wrap gap-1", isUser && "justify-end")}>
            {tools.map((t) => {
              const name = t.type.replace(/^tool-/, "");
              return (
                <Badge key={t.toolCallId} variant="outline" className="text-[10px]">
                  {t.state === "output-available" ? "✓ " : "… "}
                  {TOOL_LABELS[name] ?? name}
                </Badge>
              );
            })}
          </div>
        )}
        {text && (
          <div className={cn("whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed", isUser ? "bg-primary text-primary-foreground" : "bg-muted")}>
            {renderInline(text)}
          </div>
        )}
      </div>
    </div>
  );
}

/** Minimal markdown: headings, **bold**, *italic*, bullets (nested), numbered lines. Renders text only, never HTML. */
function renderInline(text: string) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g).map((seg, j) => {
      if (seg.startsWith("**") && seg.endsWith("**")) return <strong key={j}>{seg.slice(2, -2)}</strong>;
      if (seg.startsWith("`") && seg.endsWith("`")) return <code key={j} className="rounded bg-background/60 px-1 font-mono text-[0.9em]">{seg.slice(1, -1)}</code>;
      if (seg.length > 2 && seg.startsWith("*") && seg.endsWith("*")) return <em key={j}>{seg.slice(1, -1)}</em>;
      return seg;
    });

  return text.split("\n").map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-2" />;
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
    if (heading) return <div key={i} className="mt-2 font-semibold">{inline(heading[1])}</div>;
    const bullet = /^(\s*)[-*•]\s+(.*)$/.exec(line);
    if (bullet) {
      const depth = Math.min(3, Math.floor(bullet[1].length / 2));
      return (
        <div key={i} className="flex gap-2" style={{ marginLeft: depth * 16 }}>
          <span aria-hidden>•</span>
          <span>{inline(bullet[2])}</span>
        </div>
      );
    }
    const numbered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      return (
        <div key={i} className="flex gap-2">
          <span className="tabular-nums">{numbered[1]}.</span>
          <span>{inline(numbered[2])}</span>
        </div>
      );
    }
    return <div key={i}>{inline(line)}</div>;
  });
}
