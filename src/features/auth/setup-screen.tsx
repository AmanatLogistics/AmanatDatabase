"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertCircleIcon, ArrowRightIcon } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createFirstOwner, type FormResult } from "@/lib/auth/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/policy";

/**
 * The very first account.
 *
 * Reachable by anyone, exactly once — while the staff table is empty there is
 * nobody who could be asked to authorise it. The moment this succeeds the page
 * stops existing.
 */
export function SetupScreen() {
  const [state, action, pending] = useActionState<FormResult, FormData>(
    createFirstOwner,
    {},
  );

  return (
    <>
      <div className="mb-6 flex justify-center">
        <Logo />
      </div>

      <Card>
        <CardContent className="pt-6">
          <h1 className="text-lg font-semibold tracking-tight">
            Create the owner account
          </h1>
          <p className="text-muted-foreground mt-1 text-xs">
            Nobody has an account yet. This is the first one, and it can add the
            rest of your staff afterwards.
          </p>

          <form action={action} className="mt-5 grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                name="name"
                autoComplete="name"
                autoFocus
                required
                className="h-11"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
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
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
                className="h-11"
              />
              <p className="text-muted-foreground text-xs">
                At least {MIN_PASSWORD_LENGTH} characters. A short sentence you
                will remember beats a short word you will not.
              </p>
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
              {pending ? "Creating…" : "Create account"}
              <ArrowRightIcon />
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
