import { cn } from "@/lib/utils";

/**
 * Amanat Shopping brand mark — a stylized swallow in flight.
 *
 * NOTE: this is a vector reconstruction of the supplied company logo so the app
 * ships with correct branding out of the box. To drop in the official artwork,
 * replace `public/logo.svg` / `public/logo-mark.svg` and point `LogoMark` at it.
 * See `public/README-branding.md`.
 */
export function LogoMark({
  className,
  ...props
}: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Amanat Shopping"
      className={cn("size-6", className)}
      {...props}
    >
      <g fill="currentColor">
        {/* raised wing */}
        <path d="M67.5 7.5c-2.2 24.4-9.8 44.6-22.8 60.8 6.4-21.3 14.6-41.6 22.8-60.8Z" />
        {/* head, breast and long swept tail */}
        <path d="M44.7 68.3c-6.6-3.9-15.1-2.8-20.4 2.9-6.2 6.7-4.9 17.2 2.7 22.3 4 2.7 9 3.9 15.3 3.9 17.7 0 44.9-11.3 71.2-31.9-24.6 14.8-48 22.6-63.2 22.6-6.6 0-10.6-1.6-12.2-4.6-2.2-4.1.2-9.3 6.6-15.2Z" />
        {/* beak */}
        <path d="M27.6 70.9 10.4 66.8l14.9 9.9 2.3-5.8Z" />
      </g>
    </svg>
  );
}

/**
 * Full lockup: mark + "Amanat" wordmark + gold "Shopping" script.
 */
export function Logo({
  className,
  showWordmark = true,
  ...props
}: React.ComponentProps<"div"> & { showWordmark?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)} {...props}>
      <span className="brand-gradient text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-lg shadow-sm">
        <LogoMark className="size-5" />
      </span>
      {showWordmark && (
        <span className="flex min-w-0 flex-col leading-none">
          <span className="text-foreground text-[15px] font-bold tracking-tight">
            Amanat
          </span>
          <span className="text-gold-700 dark:text-gold-400 font-script -mt-0.5 text-[13px] leading-tight">
            Shopping
          </span>
        </span>
      )}
    </div>
  );
}
