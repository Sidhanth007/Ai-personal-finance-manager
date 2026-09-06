import { isAdmin, requireUser } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <AppShell user={user} isAdmin={isAdmin(user)}>
      {children}
    </AppShell>
  );
}
