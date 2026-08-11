import type { Metadata } from "next";

import { PaymentMethodsSettingsScreen } from "@/features/settings/payment-methods-screen";

export const metadata: Metadata = { title: "Payment methods" };

export default function PaymentMethodsSettingsPage() {
  return <PaymentMethodsSettingsScreen />;
}
