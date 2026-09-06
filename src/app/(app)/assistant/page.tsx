import type { Metadata } from "next";
import type { UIMessage } from "ai";
import { requireUser } from "@/lib/auth/session";
import { isAiConfigured } from "@/lib/env";
import { getConversation, getMessages, listConversations, userMessagesSince } from "@/server/services/ai";
import { PageHeader } from "@/components/shared/page-header";
import { Chat } from "@/components/assistant/chat";
import { ConversationList } from "@/components/assistant/conversation-list";

export const metadata: Metadata = { title: "AI assistant" };

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const user = await requireUser();
  const { c } = await searchParams;

  const [conversations, hourlyUsed] = await Promise.all([listConversations(user.id), userMessagesSince(user.id, 1)]);

  let activeId: string | null = null;
  let initialMessages: UIMessage[] = [];
  if (c && (await getConversation(user.id, c))) {
    activeId = c;
    const rows = await getMessages(user.id, c);
    initialMessages = rows
      .filter((r) => r.role === "user" || r.role === "assistant")
      .map((r) => ({ id: r.id, role: r.role as "user" | "assistant", parts: [{ type: "text" as const, text: r.content }] }));
  }

  return (
    <>
      <PageHeader
        title="AI assistant"
        description="Spending analysis, budgeting ideas, and savings planning from your own data. Educational use only."
      />
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <ConversationList conversations={conversations} activeId={activeId} />
        </aside>
        <Chat key={activeId ?? "new"} conversationId={activeId} initialMessages={initialMessages} configured={isAiConfigured} hourlyUsed={hourlyUsed} hourlyLimit={20} />
      </div>
    </>
  );
}
