import type { Metadata } from "next";

import { PublicTrackingScreen } from "@/features/public/public-tracking-screen";

export const metadata: Metadata = {
  title: "Track your order",
  description: "Check where your Amanat Shopping order has reached.",
};

export default function TrackPage() {
  return <PublicTrackingScreen />;
}
