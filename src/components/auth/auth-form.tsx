"use client";

import Link from "next/link";
import { useActionState } from "react";
import { authAction, type AuthFormState } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  purpose: "signup" | "login";
  next?: string;
};

export function AuthForm({ purpose, next }: Props) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(authAction, {
    step: "email",
    purpose,
  });

  const isSignup = purpose === "signup";

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">
          {state.step === "code" ? "Enter your code" : isSignup ? "Create your account" : "Welcome back"}
        </CardTitle>
        <CardDescription>
          {state.step === "code"
            ? state.message
            : isSignup
              ? "We will email you a 6-digit code to verify your address."
              : "Enter your email and we will send you a 6-digit login code."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {state.step === "email" ? (
          <form action={formAction} className="space-y-4" key="email-step">
            <input type="hidden" name="intent" value="request" />
            <input type="hidden" name="purpose" value={purpose} />
            {isSignup && (
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  autoComplete="name"
                  defaultValue={state.name ?? ""}
                  placeholder="Your name"
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                defaultValue={state.email ?? ""}
                placeholder="you@example.com"
                required
              />
            </div>
            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Sending code…" : "Send code"}
            </Button>
          </form>
        ) : (
          <div className="space-y-4" key="code-step">
            <form action={formAction} className="space-y-4">
              <input type="hidden" name="intent" value="verify" />
              <input type="hidden" name="purpose" value={purpose} />
              <input type="hidden" name="email" value={state.email ?? ""} />
              <input type="hidden" name="name" value={state.name ?? ""} />
              {next && <input type="hidden" name="next" value={next} />}
              <div className="space-y-2">
                <Label htmlFor="code">6-digit code</Label>
                <Input
                  id="code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="123456"
                  className="text-center text-lg tracking-[0.5em]"
                  autoFocus
                  required
                />
              </div>
              {state.devConsole && (
                <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
                  Development mode: look for the code in the terminal running <code>npm run dev</code>.
                </p>
              )}
              {state.error && <p className="text-sm text-destructive">{state.error}</p>}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Verifying…" : isSignup ? "Verify and create account" : "Verify and log in"}
              </Button>
            </form>

            <div className="flex items-center justify-between text-sm">
              <form action={formAction}>
                <input type="hidden" name="intent" value="request" />
                <input type="hidden" name="purpose" value={purpose} />
                <input type="hidden" name="email" value={state.email ?? ""} />
                <input type="hidden" name="name" value={state.name ?? ""} />
                <Button type="submit" variant="link" className="h-auto p-0" disabled={pending}>
                  Resend code
                </Button>
              </form>
              <form action={formAction}>
                <input type="hidden" name="intent" value="change-email" />
                <Button type="submit" variant="link" className="h-auto p-0" disabled={pending}>
                  Change email
                </Button>
              </form>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="justify-center text-sm text-muted-foreground">
        {isSignup ? (
          <span>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
              Log in
            </Link>
          </span>
        ) : (
          <span>
            New here?{" "}
            <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
              Create an account
            </Link>
          </span>
        )}
      </CardFooter>
    </Card>
  );
}
