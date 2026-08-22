"use client";

import { useCompany } from "@/lib/api/queries";

/**
 * Where the shop actually is, in words.
 *
 * The city used to be typed into a dozen components, which is how the whole
 * app came to tell customers the business was somewhere it is not. It comes
 * from the company profile now, so correcting it in Settings corrects it
 * everywhere at once.
 */
export function useWhereWeAre(): {
  /** Just the city, e.g. "Kandahar". */
  city: string;
  /** Street and city when a street is filled in, otherwise the city. */
  address: string;
} {
  const company = useCompany();
  const city = company.city.trim() || "our office";
  const street = [company.addressLine1, company.addressLine2]
    .map((line) => line.trim())
    .filter(Boolean)
    .join(", ");

  return { city, address: street ? `${street}, ${city}` : city };
}
