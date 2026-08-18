import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { needsFirstOwner } from "@/lib/auth/actions";
import { readSession } from "@/lib/auth/session";
import { LoginScreen } from "@/features/auth/login-screen";

export const metadata: Metadata = { title: "Sign in" };

/** Never cached: whether you are signed in is the whole question. */
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await readSession()) redirect("/");
  // Nobody has an account yet, so there is nothing to sign in to.
  if (await needsFirstOwner()) redirect("/setup");
  return <LoginScreen />;
}
