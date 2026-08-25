"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { initialData, SSR_TODAY } from "@/lib/initial-data";
import type {
  AppNotification,
  CartLine,
  Client,
  Order,
  Payment,
  Purchase,
  Settings,
  PublicProduct,
  StoreProduct,
  WebOrder,
} from "@/lib/types";

/**
 * Application state, kept in this browser.
 *
 * Starts empty and is persisted to localStorage, so orders, tracking numbers
 * and deletions survive a refresh. Before this the store was memory-only and
 * every reload wiped whatever the operator had just done, which read as the app
 * losing their work.
 *
 * The scope of that promise is one browser: this is not shared between devices
 * or between staff, and it is not a backend. When a real API lands, the
 * functions in `src/lib/api/*` start calling `fetch()` instead of these setters
 * and this file can be deleted (or kept as an optimistic cache). No screen
 * imports this module directly — they all go through `src/lib/api`.
 */

/** Bump to discard persisted data whose shape no longer matches the code. */
const STORAGE_VERSION = 3;
const STORAGE_KEY = "amanat-shopping-data";

export interface DataState {
  clients: Client[];
  notifications: AppNotification[];
  /** The storefront catalogue as staff see it, cost prices and all. */
  storeProducts: StoreProduct[];
  /**
   * The published catalogue as a customer sees it.
   *
   * Deliberately a separate slice rather than a filter over `storeProducts`:
   * that one carries cost prices, and a customer's browser must never hold
   * them. This is seeded from the server on the storefront and is the only
   * product data the shop pages read.
   */
  catalogue: PublicProduct[];
  /** The visitor's basket. Theirs alone — never seen by staff. */
  cart: CartLine[];
  /** Orders placed on the storefront, awaiting a human decision. */
  webOrders: WebOrder[];
  orders: Order[];
  purchases: Purchase[];
  payments: Payment[];
  settings: Settings;
  /** Frozen "now" so derived figures stay stable between server and client. */
  today: Date;
  /**
   * When the server dataset last arrived, or null if it never has.
   *
   * The screens read this to decide whether they have anything to show. It is
   * the difference between "no orders" and "no orders yet, still asking" —
   * which look identical and mean opposite things.
   */
  loadedAt: number | null;

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

  /** Replace the customer-visible catalogue with what the server just sent. */
  setCatalogue: (products: PublicProduct[]) => void;

  addStoreProduct: (product: StoreProduct) => void;
  updateStoreProduct: (id: string, patch: Partial<StoreProduct>) => void;
  removeStoreProduct: (id: string) => void;

  addToCart: (productId: string, qty: number) => void;
  setCartQty: (productId: string, qty: number) => void;
  clearCart: () => void;

  addWebOrder: (order: WebOrder) => void;
  updateWebOrder: (id: string, patch: Partial<WebOrder>) => void;
  removeWebOrder: (id: string) => void;

  /** Append an event. Newest first, capped so the log cannot grow forever. */
  pushNotification: (notification: AppNotification) => void;
  markNotificationsRead: () => void;
  clearNotifications: () => void;

  updateSettings: (patch: Partial<Settings>) => void;

  /** Erase everything and start over. Settings go back to their defaults too. */
  reset: () => void;
}

const initial = () => ({
  clients: initialData.clients,
  notifications: initialData.notifications,
  storeProducts: initialData.storeProducts,
  catalogue: [] as PublicProduct[],
  cart: initialData.cart,
  webOrders: initialData.webOrders,
  orders: initialData.orders,
  purchases: initialData.purchases,
  payments: initialData.payments,
  settings: initialData.settings,
  today: SSR_TODAY,
  loadedAt: null,
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

      setCatalogue: (products) => set({ catalogue: products }),

      addStoreProduct: (product) =>
        set((state) => ({ storeProducts: [product, ...state.storeProducts] })),

      updateStoreProduct: (id, patch) =>
        set((state) => ({
          storeProducts: state.storeProducts.map((p) =>
            p.id === id ? { ...p, ...patch } : p,
          ),
        })),

      /** Also drops it from the basket — you cannot buy what no longer exists. */
      removeStoreProduct: (id) =>
        set((state) => ({
          storeProducts: state.storeProducts.filter((p) => p.id !== id),
          cart: state.cart.filter((line) => line.productId !== id),
        })),

      addToCart: (productId, qty) =>
        set((state) => {
          const existing = state.cart.find((l) => l.productId === productId);
          return {
            cart: existing
              ? state.cart.map((l) =>
                  l.productId === productId ? { ...l, qty: l.qty + qty } : l,
                )
              : [...state.cart, { productId, qty }],
          };
        }),

      /** Setting a quantity of zero or less removes the line entirely. */
      setCartQty: (productId, qty) =>
        set((state) => ({
          cart:
            qty > 0
              ? state.cart.map((l) =>
                  l.productId === productId ? { ...l, qty } : l,
                )
              : state.cart.filter((l) => l.productId !== productId),
        })),

      clearCart: () => set({ cart: [] }),

      addWebOrder: (order) =>
        set((state) => ({ webOrders: [order, ...state.webOrders] })),

      updateWebOrder: (id, patch) =>
        set((state) => ({
          webOrders: state.webOrders.map((o) =>
            o.id === id ? { ...o, ...patch } : o,
          ),
        })),

      removeWebOrder: (id) =>
        set((state) => ({
          webOrders: state.webOrders.filter((o) => o.id !== id),
        })),

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
       * Set the real date once, at the moment the browser's data is in.
       *
       * The server cannot know the visitor's clock, so the state above renders
       * the HTML with a fixed date. This runs before `hasHydrated` flips, so
       * every screen behind `StoreGate` sees the true date on its first render
       * — no flash of a wrong "3 days late".
       */
      onRehydrateStorage: () => () => {
        useDataStore.setState({ today: new Date() });
      },
      /*
       * Everything saved before v3 was the demo dataset — invented clients,
       * products and orders — possibly with a few real records typed on top
       * while the app was being tried out. It is discarded wholesale, because
       * the point of v3 is a database that holds only what its owner entered.
       * Settings are reset with it; the demo ones carried invented phone
       * numbers and staff.
       */
      migrate: () => initial() as DataState,
      /*
       * `today` is a frozen reference date, not the operator's data, and a Date
       * does not survive JSON — it would come back as a string and break every
       * ageing calculation. It is rebuilt from the constant each load instead.
       */
      /*
       * Only the basket is persisted now.
       *
       * Everything else is a copy of what the database holds, and a copy kept
       * in localStorage would be read before the server answered — showing
       * yesterday's orders, or another member of staff's, as though they were
       * current. The basket is genuinely this visitor's own and belongs here.
       */
      partialize: (state) => ({ cart: state.cart }),
    },
  ),
);
