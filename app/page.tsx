import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="page-enter flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <span className="mb-1 inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden /> Free-tier demo
          </span>
          <CardTitle className="text-2xl">AI Personal Finance Manager</CardTitle>
          <CardDescription>
            Track income and expenses, budgets, savings goals, bills and subscriptions, with
            AI-powered spending insights. Demo build on free and open-source platforms.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/signup" className={cn(buttonVariants(), "flex-1")}>
              Create an account
            </Link>
            <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "flex-1")}>
              Log in
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            Information in this app is for educational and personal budgeting purposes only and is
            not professional financial, investment, tax, or legal advice.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
