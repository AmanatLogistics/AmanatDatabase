import { settings } from "@/lib/initial-settings";
import type {
  AppNotification,
  CartLine,
  Client,
  Order,
  Payment,
  Purchase,
  StoreProduct,
  WebOrder,
} from "@/lib/types";

/**
 * What the app holds before anyone has entered anything.
 *
 * It used to be a generated demo dataset — twenty invented clients, a catalogue
 * of products nobody sells, orders and payments to make the charts look busy.
 * That is gone. Every record here is now entered by hand, so this file starts
 * empty and only carries the reference data in `initial-settings.ts`.
 */

/**
 * The date the app falls back to before the browser has been read.
 *
 * The server has no clock the browser agrees with, so a fixed value renders the
 * HTML and the real date is set the moment the persisted store finishes loading
 * — see `onRehydrateStorage` in `store.ts`. Nothing that depends on the date is
 * rendered before that point; `StoreGate` holds those screens back.
 */
export const SSR_TODAY = new Date("2026-01-01T00:00:00.000Z");

export const initialData = {
  clients: [] as Client[],
  orders: [] as Order[],
  purchases: [] as Purchase[],
  payments: [] as Payment[],
  storeProducts: [] as StoreProduct[],
  webOrders: [] as WebOrder[],
  notifications: [] as AppNotification[],
  cart: [] as CartLine[],
  settings,
};
