/**
 * The only data entry point for screens.
 *
 * `queries` holds read hooks (one per future GET endpoint) and `mutations` holds
 * async write functions (one per future POST/PATCH). Nothing under `src/app` or
 * `src/components` should import `@/lib/store` or `@/lib/initial-*` directly.
 */
export * from "@/lib/api/queries";
export * from "@/lib/api/mutations";
