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

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ n?: string }>;
}) {
  if (!PUBLIC_TRACKING_ENABLED) notFound();

  /*
   * `?n=` lets a link go straight to one order — the admin's "Client view"
   * button, and the shape a shareable link would take later. Read here rather
   * than from `window` in the screen, so the server and the browser start from
   * the same value and hydration stays quiet.
   */
  const { n } = await searchParams;

  return <PublicTrackingScreen initialNumber={n ?? ""} />;
}
