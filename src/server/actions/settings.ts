"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { profileSchema } from "@/lib/validations/settings";

export type SettingsState = { ok?: boolean; error?: string; message?: string };

export async function updateProfileAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireUser();

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    currency: formData.get("currency"),
    timezone: formData.get("timezone"),
    weeklyDigestEnabled: formData.get("weeklyDigestEnabled") ?? false,
    remindersEnabled: formData.get("remindersEnabled") ?? false,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await db
    .update(users)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}
