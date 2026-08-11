# Branding assets

The logo currently rendered by the app is a **vector reconstruction** of the Amanat
Shopping logo (swallow mark + "Amanat" wordmark + gold "Shopping" script), built as
inline SVG in `src/components/brand/logo.tsx`. It was rebuilt from the supplied image
because the original artwork was never added to the repository.

## To install the official artwork

1. Drop the official files into this folder:
   - `public/logo-mark.svg` — the swallow mark on its own (transparent background)
   - `public/logo.svg` — the full lockup
   - `public/logo.png` — raster fallback, ≥512px, for documents
   - `public/favicon.ico` / `src/app/icon.png` — browser tab icon
2. In `src/components/brand/logo.tsx`, replace the inline `<svg>` in `LogoMark`
   with `<img src="/logo-mark.svg" />` (or `next/image`).
3. The brand colours are already sampled from the logo and live as design tokens
   in `src/app/globals.css`:
   - maroon ramp: `--brand-50` … `--brand-950` (primary = `--brand-700`)
   - gold ramp: `--gold-50` … `--gold-900`

Nothing else needs to change — every screen, badge, chart and printed document
reads those tokens.
