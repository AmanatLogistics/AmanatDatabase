"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * One confirmation for every destructive action, so deleting an order and
 * deleting a client cannot drift apart in wording or in how carefully they ask.
 *
 * Deletion here is permanent and cascades — there is no undo and no archive —
 * so the dialog names the record and spells out what else goes with it rather
 * than asking a generic "are you sure?".
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  /** What is being deleted, e.g. "AS-2026-0148". Rendered in the sentence. */
  subject,
  /** Lines describing what else disappears. Omit when nothing does. */
  consequences = [],
  confirmLabel = "Delete",
  onConfirm,
  successMessage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subject: string;
  consequences?: string[];
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
  successMessage: string;
}) {
  const [busy, setBusy] = React.useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
      toast.success(successMessage);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete that record.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                <span className="text-foreground font-medium">{subject}</span>{" "}
                will be deleted permanently. This cannot be undone.
              </p>
              {consequences.length > 0 && (
                <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-3">
                  <p className="text-foreground text-sm font-medium">
                    This also deletes:
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm">
                    {consequences.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // Keep the dialog open while the delete runs, and if it fails.
              e.preventDefault();
              void handleConfirm();
            }}
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? "Deleting…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
