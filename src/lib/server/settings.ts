"use server";

import { eq, sql as raw } from "drizzle-orm";

import { db } from "@/db";
import { companyProfile, paymentMethods, staff, stores } from "@/db/schema";
import { requireStaff } from "@/lib/auth/session";
import { settings as defaults } from "@/lib/initial-settings";
import type { PaymentMethod, Settings, Store, TeamMember } from "@/lib/types";

/**
 * Reference data: the company profile, where we buy, how money moves, who
 * works here.
 *
 * Seeded on first read rather than by a migration. A migration that inserts
 * rows makes the schema and its contents one thing, and re-running it on a
 * database somebody has already edited would either fail or overwrite their
 * work. This inserts only when there is nothing there.
 */

const COMPANY_ROW = "company";

const COMPANY_FIELDS = [
  "name",
  "legalName",
  "tagline",
  "phone",
  "whatsapp",
  "email",
  "website",
  "addressLine1",
  "addressLine2",
  "city",
  "country",
  "taxId",
  "invoicePrefix",
  "orderPrefix",
  "invoiceFooter",
  "termsAndConditions",
] as const satisfies readonly (keyof Settings["company"])[];

/**
 * Has this process already established that the reference data is there?
 *
 * Once true it stays true: rows are never deleted back to empty by anything the
 * app can do, and a fresh instance re-checks anyway.
 */
let seeded = false;

async function seedIfEmpty(): Promise<void> {
  if (seeded) return;

  /*
   * Ask first, in one round trip, and open a transaction only if the answer is
   * "nothing is there".
   *
   * This used to go straight into the transaction every single time — BEGIN, an
   * advisory lock, three counts, COMMIT. Six round trips that cannot pipeline,
   * because a transaction is by definition sequential, paid on every load of
   * every screen even when all three tables had been full for weeks.
   *
   * That is invisible against a database in the next rack and brutal against
   * one on another continent: at eighty milliseconds a trip it is half a second
   * of pure waiting before the screen has asked for anything it actually needs.
   * Three sub-selects in one statement answer the same question for one trip.
   */
  const [counts] = await db.execute<{
    company: number;
    stores: number;
    methods: number;
  }>(raw`
    SELECT (SELECT count(*)::int FROM company_profile) AS company,
           (SELECT count(*)::int FROM stores) AS stores,
           (SELECT count(*)::int FROM payment_methods) AS methods
  `);

  if (counts && counts.company > 0 && counts.stores > 0 && counts.methods > 0) {
    seeded = true;
    return;
  }

  await db.transaction(async (tx) => {
    // Serialised, so two people opening the app at once cannot both seed it.
    await tx.execute(raw`SELECT pg_advisory_xact_lock(hashtext('amanat:seed-settings'))`);

    const [company] = await tx
      .select({ count: raw<number>`count(*)::int` })
      .from(companyProfile);
    if ((company?.count ?? 0) === 0) {
      await tx.insert(companyProfile).values({
        id: COMPANY_ROW,
        ...defaults.company,
      });
    }

    const [storeCount] = await tx
      .select({ count: raw<number>`count(*)::int` })
      .from(stores);
    if ((storeCount?.count ?? 0) === 0) {
      await tx.insert(stores).values(defaults.stores);
    }

    const [methodCount] = await tx
      .select({ count: raw<number>`count(*)::int` })
      .from(paymentMethods);
    if ((methodCount?.count ?? 0) === 0) {
      await tx.insert(paymentMethods).values(
        defaults.paymentMethods.map((method) => ({
          ...method,
          accountRef: method.accountRef ?? null,
        })),
      );
    }
  });

  seeded = true;
}

export async function loadSettings(): Promise<Settings> {
  await requireStaff();
  await seedIfEmpty();

  const [company, storeRows, methodRows, staffRows] = await Promise.all([
    db.query.companyProfile.findFirst({ where: eq(companyProfile.id, COMPANY_ROW) }),
    db.select().from(stores),
    db.select().from(paymentMethods),
    db.select().from(staff),
  ]);

  return {
    company: company
      ? {
          name: company.name,
          legalName: company.legalName,
          tagline: company.tagline,
          phone: company.phone,
          whatsapp: company.whatsapp,
          email: company.email,
          website: company.website,
          addressLine1: company.addressLine1,
          addressLine2: company.addressLine2,
          city: company.city,
          country: company.country,
          taxId: company.taxId,
          invoicePrefix: company.invoicePrefix,
          orderPrefix: company.orderPrefix,
          currency: "AFN",
          invoiceFooter: company.invoiceFooter,
          termsAndConditions: company.termsAndConditions,
        }
      : defaults.company,
    stores: storeRows.map(
      (row): Store => ({
        id: row.id,
        name: row.name,
        url: row.url,
        country: row.country,
        leadTimeDays: row.leadTimeDays,
        active: row.active,
      }),
    ),
    paymentMethods: methodRows.map(
      (row): PaymentMethod => ({
        id: row.id,
        name: row.name,
        kind: row.kind,
        accountRef: row.accountRef ?? undefined,
        usedFor: row.usedFor,
        active: row.active,
      }),
    ),
    /*
     * The team is the staff table — the accounts that can actually sign in.
     * It used to be a separate list of names, which meant the people shown here
     * and the people who could get in were two things that could disagree.
     */
    team: staffRows.map(
      (row): TeamMember => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        phone: row.phone ?? undefined,
        active: row.active,
      }),
    ),
  };
}

export async function saveCompany(
  patch: Partial<Settings["company"]>,
): Promise<void> {
  await requireStaff();
  await seedIfEmpty();

  /*
   * Named rather than spread. `currency` is absent because this business has
   * one and the money layer reads it as a constant, and `id` because there is
   * exactly one profile row.
   */
  const fields: Record<string, string> = {};
  for (const key of COMPANY_FIELDS) {
    const value = patch[key];
    if (typeof value === "string") fields[key] = value;
  }
  if (Object.keys(fields).length === 0) return;

  await db
    .update(companyProfile)
    .set(fields)
    .where(eq(companyProfile.id, COMPANY_ROW));
}

export async function saveStore(store: Store): Promise<void> {
  await requireStaff();
  await db
    .insert(stores)
    .values(store)
    .onConflictDoUpdate({ target: stores.id, set: store });
}

export async function savePaymentMethod(method: PaymentMethod): Promise<void> {
  await requireStaff();
  const row = { ...method, accountRef: method.accountRef ?? null };
  await db
    .insert(paymentMethods)
    .values(row)
    .onConflictDoUpdate({ target: paymentMethods.id, set: row });
}
