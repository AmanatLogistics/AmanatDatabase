import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { needsFirstOwner } from "@/lib/auth/actions";
import { PublicTrackingScreen } from "@/features/public/public-tracking-screen";
import { PUBLIC_TRACKING_ENABLED } from "@/lib/constants";

/*
 * Resolved per request rather than exported statically: Next builds metadata
 * before the component runs, so a static export would title the 404 "Track your
 * order" and advertise a route that is meant to look absent.
 */
/*
 * Rendered per request, never prerendered.
 *
 * It reads the database now — to know whether anybody has set this deployment
 * up yet — and a build has no credentials on purpose. Without this the build
 * fails with "Error occurred prerendering page /track", which sounds like a
 * broken page and is really a build being asked for something only a request
 * can answer.
 */
export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  if (!PUBLIC_TRACKING_ENABLED) return {};
  return {
    title: "Track your order",
    description: "Check where your Amanat Shopping order has reached.",
  };
}

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ n?: string }>;
}) {
  if (!PUBLIC_TRACKING_ENABLED) notFound();

  /*
   * A deployment nobody has set up yet has no tracking to offer, and this is
   * where the front door now leads — so without this, the first person ever to
   * open the site would be shown an empty search box and `/setup` would be
   * reachable only by typing it. Once an owner exists this never fires again.
   *
   * It also gives the public page a reason to touch the database, which is what
   * creates the schema on a deployment whose build-time migration did not run.
   */
  if (await needsFirstOwner()) redirect("/setup");

  /*
   * `?n=` lets a link go straight to one order — the admin's "Client view"
   * button, and the shape a shareable link would take later. Read here rather
   * than from `window` in the screen, so the server and the browser start from
   * the same value and hydration stays quiet.
   */
  const { n } = await searchParams;

  return <PublicTrackingScreen initialNumber={n ?? ""} />;
}
