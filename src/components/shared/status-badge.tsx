import { Badge } from "@/components/ui/badge";
import {
  CLIENT_STATUS,
  ORDER_STATUS,
  PAYMENT_TYPE,
  PURCHASE_STATUS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type {
  ClientStatus,
  OrderStatus,
  PaymentType,
  PurchaseStatus,
} from "@/lib/types";

type Registry =
  | { kind: "order"; value: OrderStatus }
  | { kind: "purchase"; value: PurchaseStatus }
  | { kind: "payment"; value: PaymentType }
  | { kind: "client"; value: ClientStatus };

function resolve(input: Registry) {
  switch (input.kind) {
    case "order":
      return ORDER_STATUS[input.value];
    case "purchase":
      return PURCHASE_STATUS[input.value];
    case "payment":
      return PAYMENT_TYPE[input.value];
    case "client":
      return CLIENT_STATUS[input.value];
  }
}

/**
 * One badge for every status in the system, so a status always looks the same
 * whichever screen it appears on.
 */
export function StatusBadge({
  className,
  withDot = true,
  ...input
}: Registry & { className?: string; withDot?: boolean }) {
  const meta = resolve(input);

  return (
    <Badge variant={meta.tone} className={cn("gap-1.5 py-1 font-medium", className)}>
      {withDot && <span className={cn("size-1.5 rounded-full", meta.dot)} />}
      {meta.label}
    </Badge>
  );
}

