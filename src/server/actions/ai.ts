"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { deleteConversation } from "@/server/services/ai";
import type { ActionState } from "./transactions";

export async function deleteConversationAction(id: string): Promise<ActionState> {
  const user = await requireUser();
  const ok = await deleteConversation(user.id, id);
  if (!ok) return { ok: false, error: "Conversation not found" };
  revalidatePath("/assistant");
  return { ok: true, message: "Conversation deleted." };
}

export async function newConversationAction(): Promise<void> {
  await requireUser();
  redirect("/assistant");
}
