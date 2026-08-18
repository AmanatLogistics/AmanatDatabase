import { cn } from "@/lib/utils";

/**
 * The Amanat Shopping swallow.
 *
 * A vector redraw of the company logo: a small head with a pointed beak at the
 * left, one long scythe-shaped wing raised to the upper right, and a swept tail
 * running out to a needle at the lower right. Drawn as a single filled outline
 * so it takes `currentColor` and works white-on-maroon, maroon-on-white, or
 * knocked out of a print document.
 *
 * The viewBox is cropped to the silhouette's own bounds rather than a square
 * canvas, so the bird fills whatever box it is given — it is used as small as
 * 20px in the shop header.
 *
 * If the official vector artwork is ever added to the repo, replace this and
 * `public/logo-mark.svg` with it; see `public/README-branding.md`.
 */
export function LogoMark({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="23 10.5 59 57"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Amanat Shopping"
      className={cn("size-6", className)}
      {...props}
    >
      <path
        fill="currentColor"
        d="M57.5 12.5 C54.5 21 47.5 33.5 42.4 42.6 C47.8 45.4 58.5 51.4 80.5 65.5 C69 62.4 51.5 54.2 38.6 46.4 C34.2 43.6 31.4 41 30.2 38.6 C28.6 38 26.4 37.2 25 36.2 C26.8 35 29 33.6 30.8 32.6 C33 25.5 44 16.5 57.5 12.5 Z"
      />
    </svg>
  );
}

/**
 * Full lockup: mark + "Amanat" wordmark + gold "Shopping" script.
 *
 * The script sits under the right-hand end of the wordmark, as it does in the
 * logo, rather than starting flush beneath the A.
 *
 * `tone="onDark"` is for the maroon bands — the public tracking header and
 * anything else painted in the brand gradient. There the bird is set straight
 * on the colour with no tile behind it, which is how the logo itself is drawn.
 * (It replaces a `brightness-0 invert` filter that turned the whole lockup,
 * tile included, into a solid white square.)
 */
export function Logo({
  className,
  showWordmark = true,
  tone = "default",
  ...props
}: React.ComponentProps<"div"> & {
  showWordmark?: boolean;
  tone?: "default" | "onDark";
}) {
  const onDark = tone === "onDark";

  return (
    <div className={cn("flex items-center gap-2.5", className)} {...props}>
      {onDark ? (
        <LogoMark className="text-primary-foreground size-8 shrink-0" />
      ) : (
        <span className="brand-gradient text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-lg shadow-sm">
          <LogoMark className="size-5" />
        </span>
      )}
      {showWordmark && (
        <span className="flex min-w-0 flex-col leading-none">
          <span
            className={cn(
              "text-[15px] font-bold tracking-tight",
              onDark ? "text-primary-foreground" : "text-foreground",
            )}
          >
            Amanat
          </span>
          <span
            className={cn(
              "font-script -mt-1 self-end text-[13px] leading-tight",
              onDark ? "text-gold-300" : "text-gold-700 dark:text-gold-400",
            )}
          >
            Shopping
          </span>
        </span>
      )}
    </div>
  );
}
