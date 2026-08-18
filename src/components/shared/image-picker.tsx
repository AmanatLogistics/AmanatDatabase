"use client";

import * as React from "react";
import { ImagePlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  fileToResizedDataUrl,
  validateImageFile,
} from "@/lib/image-upload";
import { cn } from "@/lib/utils";

/**
 * Choose a photo for a product.
 *
 * Shows the picture rather than a filename, because the only question the
 * operator has is "is that the right image" — and a name never answers it.
 */
export function ImagePicker({
  value,
  onChange,
  className,
}: {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);

    const problem = validateImageFile(file);
    if (problem) {
      setError(problem.message);
      return;
    }

    setBusy(true);
    try {
      onChange(await fileToResizedDataUrl(file));
    } catch {
      setError("Could not read that image. Try another one.");
    } finally {
      setBusy(false);
      // Clear the input so choosing the same file twice still fires a change.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "bg-muted/40 relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border",
            !value && "border-dashed",
          )}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="Product"
              className="size-full object-cover"
              data-testid="image-preview"
            />
          ) : (
            <ImagePlusIcon className="text-muted-foreground/60 size-6" />
          )}
        </div>

        <div className="grid gap-1.5">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            data-testid="image-input"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlusIcon />
            {busy ? "Processing…" : value ? "Replace photo" : "Add photo"}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive justify-start"
              onClick={() => onChange(undefined)}
            >
              <Trash2Icon />
              Remove
            </Button>
          )}
          <p className="text-muted-foreground text-xs">
            JPG, PNG or WebP. Large photos are shrunk automatically.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
