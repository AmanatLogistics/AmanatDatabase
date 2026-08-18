"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertCircleIcon, LogInIcon } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, type FormResult } from "@/lib/auth/actions";

/** Sign in. Deliberately plain — this is a door, not a landing page. */
export function LoginScreen() {
  const [state, action, pending] = useActionState<FormResult, FormData>(
    signIn,
    {},
  );

  return (
    <>
      <div className="mb-6 flex justify-center">
        <Logo />
      </div>

      <Card>
        <CardContent className="pt-6">
          <h1 className="text-lg font-semibold tracking-tight">Sign in</h1>
          <p className="text-muted-foreground mt-1 text-xs">
            This is the operations database. Customers do not need an account.
          </p>

          <form action={action} className="mt-5 grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                autoFocus
                required
                className="h-11"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="h-11"
              />
            </div>

            {state.error && (
              <p
                role="alert"
                className="text-destructive flex items-start gap-2 text-xs"
              >
                <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" />
                {state.error}
              </p>
            )}

            <Button type="submit" className="h-11 w-full" disabled={pending}>
              <LogInIcon />
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
