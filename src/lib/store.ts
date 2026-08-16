"use client";

import { create } from "zustand";

import { seedData, TODAY } from "@/lib/mock/seed";
import type {
  Client,
  Order,
  Payment,
  Purchase,
  Settings,
} from "@/lib/types";

/**
 * In-memory application state.
 *
 * This is a stand-in for the server: it is seeded from the mock dataset and
 * mutated by the same actions the real API will expose. State resets on reload,
 * which is intentional for a frontend-only build.
 *
 * When the backend lands, the functions in `src/lib/api/*` start calling
 * `fetch()` instead of these setters and this file can be deleted (or kept as an
 * optimistic cache). No screen imports this module directly — they all go
 * through `src/lib/api`.
 */

export interface DataState {
  clients: Client[];
  orders: Order[];
  purchases: Purchase[];
  payments: Payment[];
  settings: Settings;
  /** Frozen "now" so derived figures stay stable between server and client. */
  today: Date;

  addClient: (client: Client) => void;
  updateClient: (id: string, patch: Partial<Client>) => void;

  addOrder: (order: Order) => void;
  updateOrder: (id: string, patch: Partial<Order>) => void;

  addPurchase: (purchase: Purchase) => void;
  addPayment: (payment: Payment) => void;

  updateSettings: (patch: Partial<Settings>) => void;

  /** Restore the seed dataset — used by the "Reset demo data" action. */
  reset: () => void;
}

const initial = () => ({
  clients: seedData.clients,
  orders: seedData.orders,
  purchases: seedData.purchases,
  payments: seedData.payments,
  settings: seedData.settings,
  today: TODAY,
});

export const useDataStore = create<DataState>((set) => ({
  ...initial(),

  addClient: (client) =>
    set((state) => ({ clients: [client, ...state.clients] })),

  updateClient: (id, patch) =>
    set((state) => ({
      clients: state.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),

  addOrder: (order) => set((state) => ({ orders: [order, ...state.orders] })),

  updateOrder: (id, patch) =>
    set((state) => ({
      orders: state.orders.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    })),

  addPurchase: (purchase) =>
    set((state) => ({ purchases: [purchase, ...state.purchases] })),

  addPayment: (payment) =>
    set((state) => ({ payments: [payment, ...state.payments] })),

  updateSettings: (patch) =>
    set((state) => ({ settings: { ...state.settings, ...patch } })),

  reset: () => set(initial()),
}));
