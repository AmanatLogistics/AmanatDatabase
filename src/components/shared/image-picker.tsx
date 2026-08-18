"use client";

import * as React from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ImagePlusIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";

import { fileToResizedDataUrl, validateImageFile } from "@/lib/image-upload";
import { cn } from "@/lib/utils";

const MAX_IMAGES = 6;

/**
 * Choose the photos for a product.
 *
 * Order matters and is therefore visible: the first image is what appears on
 * the shop card, in the basket and on the customer's tracking page, so it can
 * be moved rather than only deleted and re-added. Thumbnails rather than
 * filenames, because "is that the right picture" is the only question being
 * asked and a filename never answers it.
 */
export function ImagePicker({
  value,
  onChange,
  className,
}: {
  value: string[];
  onChange: (images: string[]) => void;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const full = value.length >= MAX_IMAGES;

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);

    const room = MAX_IMAGES - value.length;
    const chosen = Array.from(files).slice(0, room);
    if (files.length > room) {
      setError(`Only ${MAX_IMAGES} photos per product — the rest were skipped.`);
    }

    setBusy(true);
    try {
      const added: string[] = [];
      for (const file of chosen) {
        const problem = validateImageFile(file);
        if (problem) {
          setError(problem.message);
          continue;
        }
        try {
          added.push(await fileToResizedDataUrl(file));
        } catch {
          setError("Could not read one of those images.");
        }
      }
      if (added.length) onChange([...value, ...added]);
    } finally {
      setBusy(false);
      // Clear, so picking the same file twice still fires a change.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  return (
    <div className={cn("grid gap-3", className)}>
      <div className="flex flex-wrap gap-2">
        {value.map((src, index) => (
          <figure
            key={index}
            className="group relative size-24 overflow-hidden rounded-lg border"
            data-testid="image-thumb"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Photo ${index + 1}`} className="size-full object-cover" />

            {index === 0 && (
              <span className="bg-brand-700 text-primary-foreground absolute top-1 left-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium">
                <StarIcon className="size-2.5" />
                Main
              </span>
            )}

            <figcaption className="absolute inset-x-0 bottom-0 flex justify-center gap-0.5 bg-black/55 p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                aria-label={`Move photo ${index + 1} earlier`}
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
                className="rounded p-0.5 text-white disabled:opacity-30"
              >
                <ArrowLeftIcon className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label={`Remove photo ${index + 1}`}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                className="rounded p-0.5 text-white"
              >
                <Trash2Icon className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label={`Move photo ${index + 1} later`}
                disabled={index === value.length - 1}
                onClick={() => move(index, index + 1)}
                className="rounded p-0.5 text-white disabled:opacity-30"
              >
                <ArrowRightIcon className="size-3.5" />
              </button>
            </figcaption>
          </figure>
        ))}

        {!full && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            data-testid="add-photo"
            className="text-muted-foreground hover:border-brand-600/50 hover:text-foreground flex size-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed transition-colors"
          >
            <ImagePlusIcon className="size-5" />
            <span className="text-[10px]">{busy ? "Adding…" : "Add photo"}</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        data-testid="image-input"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      <p className="text-muted-foreground text-xs">
        {value.length}/{MAX_IMAGES} photos. The first one is what customers see
        on the shop. JPG, PNG or WebP — large photos are shrunk automatically.
      </p>

      {error && (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
