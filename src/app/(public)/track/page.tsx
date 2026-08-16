import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicTrackingScreen } from "@/features/public/public-tracking-screen";
import { PUBLIC_TRACKING_ENABLED } from "@/lib/constants";

/*
 * Resolved per request rather than exported statically: Next builds metadata
 * before the component runs, so a static export would title the 404 "Track your
 * order" and advertise a route that is meant to look absent.
 */
export function generateMetadata(): Metadata {
  if (!PUBLIC_TRACKING_ENABLED) return {};
  return {
    title: "Track your order",
    description: "Check where your Amanat Shopping order has reached.",
  };
}

export default function TrackPage() {
  /*
   * Refused unless explicitly enabled. Until a real backend serves this, the
   * seeded dataset travels in the client bundle, so a reachable /track exposes
   * every client record whatever the page chooses to render. Gating in the
   * route means the page cannot be served by accident — and the 404 is
   * indistinguishable from a route that was never built.
   */
  if (!PUBLIC_TRACKING_ENABLED) notFound();

  return <PublicTrackingScreen />;
}
