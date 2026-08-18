"use client";

/**
 * Turning a chosen file into something we can store and show.
 *
 * There is no file storage in this app — no server, no bucket — so an image is
 * read into a data URL and kept in the record itself. That is the only option
 * that works today, and it comes with a real cost: the image travels inside
 * every copy of the data, so it must be small.
 *
 * Hence the resize. A phone photo is several megabytes and would blow through
 * the browser's storage quota after a handful of products; downscaling to fit a
 * 900px box and re-encoding as JPEG brings a typical photo under ~150KB while
 * still looking right on a product card.
 *
 * When a backend arrives this whole module is replaced by an upload to a bucket
 * that returns a URL, and `imageUrl` stops being a data URL without anything
 * that reads it having to change.
 */

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** Before resizing. Generous, because we shrink it ourselves straight after. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_EDGE = 900;
const JPEG_QUALITY = 0.82;

export interface ImageError {
  message: string;
}

/** Human-readable check, run before we bother decoding anything. */
export function validateImageFile(file: File): ImageError | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return { message: "Use a JPG, PNG or WebP image." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { message: "That image is over 10MB. Please choose a smaller one." };
  }
  return null;
}

/**
 * Read, downscale and re-encode. Resolves to a data URL.
 *
 * Uses `createImageBitmap` rather than an `<img>` element because it decodes
 * off the main thread and, importantly, honours EXIF orientation — without that
 * photos taken in portrait arrive on their side.
 */
export async function fileToResizedDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not process that image.");
  }

  // Flatten onto white: a transparent PNG re-encoded as JPEG would otherwise
  // get a black background.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}
