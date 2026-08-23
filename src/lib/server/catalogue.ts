"use server";

import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { productImages, storeProducts } from "@/db/schema";
import { toStoreProduct } from "@/db/map";
import { requireStaff } from "@/lib/auth/session";
import type { ProductCategory, StoreProduct } from "@/lib/types";

/**
 * The catalogue, as staff manage it.
 *
 * Every function starts by proving there is a session. The shop admin only
 * rendering behind a login is not the check — these are POST endpoints anyone
 * can call once they know the action exists.
 */

export interface SaveProductInput {
  id?: string;
  name: string;
  description: string;
  imageUrls: string[];
  category: ProductCategory;
  priceAfn: number;
  costAfn: number;
  storeId: string;
  active: boolean;
}

const MAX_IMAGES = 6;

/** Everything, cost prices included. Staff only. */
export async function listProducts(): Promise<StoreProduct[]> {
  await requireStaff();
  const rows = await db.query.storeProducts.findMany({
    with: { images: true },
    orderBy: [desc(storeProducts.createdAt)],
  });
  return rows.map(toStoreProduct);
}

/**
 * A URL segment from a name, unique across the catalogue.
 *
 * The slug is what a customer's link points at, so it has to be stable and it
 * has to be unique — the database refuses a duplicate, and finding out at the
 * insert is too late to pick another.
 *
 * Takes the connection to read on. Called with the global `db` from inside a
 * transaction it deadlocks: the pool holds one connection, the transaction has
 * it, and this read waits for a connection that is waiting for this read. That
 * hung every request the server had, because they all share that one.
 */
type Reader = Pick<typeof db, "select">;

async function uniqueSlug(
  on: Reader,
  name: string,
  keepId?: string,
): Promise<string> {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "product";

  const taken = new Set(
    (await on.select({ slug: storeProducts.slug, id: storeProducts.id }).from(storeProducts))
      .filter((row) => row.id !== keepId)
      .map((row) => row.slug),
  );

  if (!taken.has(base)) return base;
  for (let n = 2; n < 500; n += 1) {
    if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

export async function saveProduct(
  input: SaveProductInput,
): Promise<StoreProduct> {
  await requireStaff();

  const name = input.name.trim();
  if (!name) throw new Error("A product needs a name.");

  const id = input.id ?? randomUUID();
  const images = input.imageUrls.slice(0, MAX_IMAGES);

  await db.transaction(async (tx) => {
    if (input.id) {
      await tx
        .update(storeProducts)
        .set({
          name,
          description: input.description.trim(),
          category: input.category,
          priceAfn: Math.round(input.priceAfn),
          costAfn: Math.round(input.costAfn),
          storeId: input.storeId,
          active: input.active,
        })
        .where(eq(storeProducts.id, id));
    } else {
      await tx.insert(storeProducts).values({
        id,
        slug: await uniqueSlug(tx, name),
        name,
        description: input.description.trim(),
        category: input.category,
        priceAfn: Math.round(input.priceAfn),
        costAfn: Math.round(input.costAfn),
        storeId: input.storeId,
        active: input.active,
      });
    }

    /*
     * Replaced wholesale rather than diffed. The picker hands back the finished
     * list in the operator's order, and position matters — the first photo is
     * the one on the card. Working out which rows moved would be more code for
     * the same six rows.
     */
    await tx.delete(productImages).where(eq(productImages.productId, id));
    if (images.length > 0) {
      await tx.insert(productImages).values(
        images.map((url, position) => ({
          id: randomUUID(),
          productId: id,
          url,
          position,
        })),
      );
    }
  });

  const saved = await db.query.storeProducts.findFirst({
    where: eq(storeProducts.id, id),
    with: { images: true },
  });
  if (!saved) throw new Error("The product was not saved.");
  return toStoreProduct(saved);
}

export async function deleteProduct(id: string): Promise<void> {
  await requireStaff();
  // Images go with it — the foreign key cascades.
  await db.delete(storeProducts).where(eq(storeProducts.id, id));
}
