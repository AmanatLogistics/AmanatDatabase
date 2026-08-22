"use client";

import * as React from "react";

import { setActor } from "@/lib/api/actor";
import type { SignedInStaff } from "@/lib/auth/session";

/**
 * Who is signed in, for the chrome that has to show it.
 *
 * The value is read once on the server, in the layout that already had to check
 * the session to let the page render at all, and handed down. A client
 * component asking the server again would be a second round trip for something
 * already known, and would flash the wrong name while it waited.
 *
 * Convenience, not a permission check: nothing may decide what a person is
 * allowed to do from this. Every server action re-reads the session itself.
 */
const SignedInContext = React.createContext<SignedInStaff | null>(null);

export function SignedInProvider({
  staff,
  children,
}: {
  staff: SignedInStaff;
  children: React.ReactNode;
}) {
  /*
   * Also parked where the mutation layer can reach it, so a purchase or a
   * payment is credited to the person who actually made it. `setActor` ignores
   * the call on the server, where a module-level value would be shared between
   * everyone's requests.
   */
  setActor(staff.name);

  return (
    <SignedInContext.Provider value={staff}>
      {children}
    </SignedInContext.Provider>
  );
}

export function useSignedIn(): SignedInStaff | null {
  return React.useContext(SignedInContext);
}
