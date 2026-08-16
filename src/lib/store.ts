"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { seedData, TODAY } from "@/lib/mock/seed";
import type {
  AppNotification,
  Client,
  Order,
  Payment,
  Purchase,
  Settings,
} from "@/lib/types";

/**
 * Application state, kept in this browser.
 *
 * Seeded from the mock dataset the first time, then persisted to localStorage
 * so orders, tracking numbers and deletions survive a refresh. Before this the
 * store was memory-only and every reload wiped whatever the operator had just
 * done, which read as the app losing their work.
 *
 * The scope of that promise is one browser: this is not shared between devices
 * or between staff, and it is not a backend. When a real API lands, the
 * functions in `src/lib/api/*` start calling `fetch()` instead of these setters
 * and this file can be deleted (or kept as an optimistic cache). No screen
 * imports this module directly — they all go through `src/lib/api`.
 */

/** Bump to discard persisted data whose shape no longer matches the code. */
const STORAGE_VERSION = 1;
const STORAGE_KEY = "amanat-shopping-data";

export interface DataState {
  clients: Client[];
  notifications: AppNotification[];
  orders: Order[];
  purchases: Purchase[];
  payments: Payment[];
  settings: Settings;
  /** Frozen "now" so derived figures stay stable between server and client. */
  today: Date;

  addClient: (client: Client) => void;
  updateClient: (id: string, patch: Partial<Client>) => void;
  /** Cascades to the client's orders, and to purchases and payments on them. */
  removeClient: (id: string) => void;

  addOrder: (order: Order) => void;
  updateOrder: (id: string, patch: Partial<Order>) => void;
  /** Cascades to the order's purchases and payments. */
  removeOrder: (id: string) => void;

  addPurchase: (purchase: Purchase) => void;
  updatePurchase: (id: string, patch: Partial<Purchase>) => void;
  removePurchase: (id: string) => void;

  addPayment: (payment: Payment) => void;

  /** Append an event. Newest first, capped so the log cannot grow forever. */
  pushNotification: (notification: AppNotification) => void;
  markNotificationsRead: () => void;
  clearNotifications: () => void;

  updateSettings: (patch: Partial<Settings>) => void;

  /** Restore the seed dataset — used by the "Reset demo data" action. */
  reset: () => void;
}

const initial = () => ({
  clients: seedData.clients,
  notifications: [] as AppNotification[],
  orders: seedData.orders,
  purchases: seedData.purchases,
  payments: seedData.payments,
  settings: seedData.settings,
  today: TODAY,
});

export const useDataStore = create<DataState>()(
  persist(
    (set) => ({
      ...initial(),

      addClient: (client) =>
        set((state) => ({ clients: [client, ...state.clients] })),

      updateClient: (id, patch) =>
        set((state) => ({
          clients: state.clients.map((c) =>
            c.id === id ? { ...c, ...patch } : c,
          ),
        })),

      /**
       * Removing a client takes their orders with them, and the purchases and
       * payments hanging off those orders. Leaving those behind would strand
       * rows that reference a client that no longer exists, and the finance
       * screens would count money against nobody.
       */
      removeClient: (id) =>
        set((state) => {
          const orphanedOrderIds = new Set(
            state.orders.filter((o) => o.clientId === id).map((o) => o.id),
          );
          return {
            clients: state.clients.filter((c) => c.id !== id),
            orders: state.orders.filter((o) => o.clientId !== id),
            purchases: state.purchases.filter(
              (p) => !orphanedOrderIds.has(p.orderId),
            ),
            payments: state.payments.filter((p) => p.clientId !== id),
          };
        }),

      addOrder: (order) =>
        set((state) => ({ orders: [order, ...state.orders] })),

      updateOrder: (id, patch) =>
        set((state) => ({
          orders: state.orders.map((o) => (o.id === id ? { ...o, ...patch } : o)),
        })),

      /**
       * Deleting an order also removes what was logged against it. A purchase
       * records money paid out *for that order*; keeping it would leave a cost
       * with nothing to attribute it to and quietly distort the P&L.
       */
      removeOrder: (id) =>
        set((state) => ({
          orders: state.orders.filter((o) => o.id !== id),
          purchases: state.purchases.filter((p) => p.orderId !== id),
          payments: state.payments.filter((p) => p.orderId !== id),
        })),

      addPurchase: (purchase) =>
        set((state) => ({ purchases: [purchase, ...state.purchases] })),

      updatePurchase: (id, patch) =>
        set((state) => ({
          purchases: state.purchases.map((p) =>
            p.id === id ? { ...p, ...patch } : p,
          ),
        })),

      removePurchase: (id) =>
        set((state) => ({
          purchases: state.purchases.filter((p) => p.id !== id),
        })),

      addPayment: (payment) =>
        set((state) => ({ payments: [payment, ...state.payments] })),

      pushNotification: (notification) =>
        set((state) => ({
          notifications: [notification, ...state.notifications].slice(0, 50),
        })),

      markNotificationsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.read ? n : { ...n, read: true },
          ),
        })),

      clearNotifications: () => set({ notifications: [] }),

      updateSettings: (patch) =>
        set((state) => ({ settings: { ...state.settings, ...patch } })),

      reset: () => set(initial()),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      /*
       * Rehydration is triggered explicitly once React is mounted, not at
       * module load. Loading straight away would leave the first client render
       * holding different data from the server HTML, which React reports as a
       * hydration mismatch. See `useStoreHydrated`.
       */
      skipHydration: true,
      /*
       * `today` is a frozen reference date, not the operator's data, and a Date
       * does not survive JSON — it would come back as a string and break every
       * ageing calculation. It is rebuilt from the constant each load instead.
       */
      partialize: (state) => ({
        clients: state.clients,
        notifications: state.notifications,
        orders: state.orders,
        purchases: state.purchases,
        payments: state.payments,
        settings: state.settings,
      }),
    },
  ),
);
