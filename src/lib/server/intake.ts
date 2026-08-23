"use server";

import { desc, eq, sql as raw } from "drizzle-orm";

import { db } from "@/db";
import { notifications, webOrders } from "@/db/schema";
import { toNotification, toWebOrder } from "@/db/map";
import { requireStaff } from "@/lib/auth/session";
import type { AppNotification, WebOrder } from "@/lib/types";

/**
 * Website orders and the bell, from the staff side.
 *
 * Both are office-wide rather than per-person: everyone works the same queue,
 * and "who has read it" is not something anyone here needs to know.
 */

export async function listWebOrders(): Promise<WebOrder[]> {
  await requireStaff();
  const rows = await db.query.webOrders.findMany({
    with: { lines: true },
    orderBy: [desc(webOrders.placedAt)],
  });
  return rows.map(toWebOrder);
}

export async function getWebOrder(id: string): Promise<WebOrder | null> {
  await requireStaff();
  const row = await db.query.webOrders.findFirst({
    where: eq(webOrders.id, id),
    with: { lines: true },
  });
  return row ? toWebOrder(row) : null;
}

/**
 * Record that staff have turned this into a real order.
 *
 * The id of the order it became is recorded, which is what lets a customer
 * holding only their `WEB-…` reference follow through to the real order and see
 * its actual progress. Without it they would be told "we have your order"
 * forever, however far along it got.
 */
export async function markWebOrderConverted(
  id: string,
  convertedOrderId: string,
): Promise<void> {
  await requireStaff();
  await db
    .update(webOrders)
    .set({ status: "converted", convertedOrderId })
    .where(eq(webOrders.id, id));
}

export async function dismissWebOrder(id: string): Promise<void> {
  await requireStaff();
  await db
    .update(webOrders)
    .set({ status: "dismissed" })
    .where(eq(webOrders.id, id));
}

export async function deleteWebOrder(id: string): Promise<void> {
  await requireStaff();
  await db.delete(webOrders).where(eq(webOrders.id, id));
}

/** How many website orders nobody has dealt with yet. */
export async function countNewWebOrders(): Promise<number> {
  await requireStaff();
  const [row] = await db
    .select({ count: raw<number>`count(*)::int` })
    .from(webOrders)
    .where(eq(webOrders.status, "new"));
  return row?.count ?? 0;
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                               */
/* -------------------------------------------------------------------------- */

/** Capped: this is a running log, not an archive. */
const KEEP = 50;

export async function listNotifications(): Promise<AppNotification[]> {
  await requireStaff();
  const rows = await db.query.notifications.findMany({
    orderBy: [desc(notifications.at)],
    limit: KEEP,
  });
  return rows.map(toNotification);
}

export async function markNotificationsRead(): Promise<void> {
  await requireStaff();
  await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.read, false));
}

export async function clearNotifications(): Promise<void> {
  await requireStaff();
  await db.delete(notifications);
}

/**
 * How many unread there are.
 *
 * Its own query rather than counting a list, because the bell polls this and
 * the list is fifty rows of text it does not need.
 */
export async function countUnread(): Promise<number> {
  await requireStaff();
  const [row] = await db
    .select({ count: raw<number>`count(*)::int` })
    .from(notifications)
    .where(eq(notifications.read, false));
  return row?.count ?? 0;
}
