import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-enter flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
        <span className="size-2.5 rounded-full bg-primary shadow-[0_0_0_4px] shadow-primary/15" aria-hidden />
        AI Personal Finance Manager
      </Link>
      {children}
      <p className="max-w-md text-center text-xs text-muted-foreground">
        For educational and personal budgeting purposes only. Not professional financial advice.
      </p>
    </div>
  );
}
