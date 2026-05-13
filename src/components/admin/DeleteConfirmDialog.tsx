/**
 * DeleteConfirmDialog — Reusable typed-slug delete confirmation dialog.
 *
 * Renders a modal that requires the admin to type the item's slug exactly
 * before the destructive confirm button becomes active. Sends a DELETE
 * request to `deleteUrl`, shows a loading spinner while in-flight, and
 * surfaces success/error feedback via toast notifications.
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8
 */

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Toast system (lightweight, self-contained)
// ---------------------------------------------------------------------------

type ToastVariant = "success" | "error";

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={cn(
            "pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 shadow-lg text-sm font-medium max-w-sm animate-in slide-in-from-bottom-2",
            toast.variant === "success"
              ? "bg-lagoon/10 text-ocean-deep border border-lagoon/20"
              : "bg-coral/10 text-coral border border-coral/20"
          )}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Tutup notifikasi"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DeleteConfirmDialog props
// ---------------------------------------------------------------------------

export interface DeleteConfirmDialogProps {
  /** Human-readable title of the item being deleted (shown in the dialog). */
  title: string;
  /** URL slug of the item — admin must type this exactly to confirm. */
  slug: string;
  /** Full URL to send the DELETE request to (e.g. `/api/destinations/123`). */
  deleteUrl: string;
  /**
   * Called after a successful DELETE response and before the dialog closes.
   * Use this to remove the row from the parent list without a full page reload.
   */
  onSuccess: () => void;
  /** Called when the dialog is dismissed without deleting. */
  onClose: () => void;
  /** Whether the dialog is currently open. */
  open: boolean;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DeleteConfirmDialog({
  title,
  slug,
  deleteUrl,
  onSuccess,
  onClose,
  open,
}: DeleteConfirmDialogProps) {
  const [typedSlug, setTypedSlug] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  // Reset typed value whenever the dialog opens for a new item.
  React.useEffect(() => {
    if (open) {
      setTypedSlug("");
      setIsLoading(false);
    }
  }, [open, slug]);

  // Auto-dismiss toasts after 4 seconds.
  React.useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 4000);
    return () => clearTimeout(timer);
  }, [toasts]);

  function addToast(message: string, variant: ToastVariant) {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => {
      // Deduplicate: if a toast with the same message already exists, replace it.
      const filtered = prev.filter((t) => t.message !== message);
      return [...filtered, { id, message, variant }];
    });
  }

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  const isConfirmEnabled = typedSlug === slug && !isLoading;

  async function handleConfirm() {
    if (!isConfirmEnabled) return;

    setIsLoading(true);

    try {
      const response = await fetch(deleteUrl, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        addToast("Destinasi / Artikel berhasil dihapus", "success");
        onSuccess();
        onClose();
      } else {
        let serverMessage = "Terjadi kesalahan saat menghapus.";
        try {
          const data = await response.json();
          if (data?.error?.message) {
            serverMessage = data.error.message;
          } else if (typeof data?.message === "string") {
            serverMessage = data.message;
          }
        } catch {
          // JSON parse failed — use default message.
        }
        addToast(serverMessage, "error");
        setIsLoading(false);
      }
    } catch {
      addToast("Tidak dapat terhubung ke server. Silakan coba lagi.", "error");
      setIsLoading(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !isLoading) {
      onClose();
    }
  }

  return (
    <>
      <Dialog.Root open={open} onOpenChange={handleOpenChange}>
        <Dialog.Portal>
          {/* Overlay */}
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

          {/* Content */}
          <Dialog.Content
            className={cn(
              "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2",
              "rounded-2xl bg-card border border-border shadow-xl p-6 space-y-5",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
              "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
            )}
            aria-describedby="delete-dialog-description"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Warning icon */}
                <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-coral/10">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5 text-coral"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    <line x1="10" x2="10" y1="11" y2="17" />
                    <line x1="14" x2="14" y1="11" y2="17" />
                  </svg>
                </div>
                <Dialog.Title className="text-base font-semibold text-foreground">
                  Hapus Item
                </Dialog.Title>
              </div>

              {/* Close button */}
              <Dialog.Close
                disabled={isLoading}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Tutup dialog"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </Dialog.Close>
            </div>

            {/* Body */}
            <div id="delete-dialog-description" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Tindakan ini <strong className="text-foreground">tidak dapat dibatalkan</strong>.
                Item berikut akan dihapus secara permanen:
              </p>

              {/* Item info */}
              <div className="rounded-xl bg-secondary/50 border border-border px-4 py-3 space-y-1">
                <p className="text-sm font-medium text-foreground truncate">{title}</p>
                <p className="text-xs text-muted-foreground font-mono">{slug}</p>
              </div>

              {/* Typed-slug confirmation */}
              <div className="space-y-2">
                <label
                  htmlFor="delete-slug-input"
                  className="block text-sm font-medium text-foreground"
                >
                  Ketik{" "}
                  <code className="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono text-foreground">
                    {slug}
                  </code>{" "}
                  untuk mengonfirmasi:
                </label>
                <input
                  id="delete-slug-input"
                  type="text"
                  value={typedSlug}
                  onChange={(e) => setTypedSlug(e.target.value)}
                  disabled={isLoading}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={slug}
                  className={cn(
                    "w-full rounded-xl border bg-card px-4 py-3 text-sm font-mono outline-none transition",
                    "focus:ring-2 focus:ring-offset-0",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    typedSlug.length > 0 && typedSlug !== slug
                      ? "border-coral focus:ring-coral/20"
                      : typedSlug === slug
                      ? "border-lagoon focus:ring-lagoon/20"
                      : "border-border focus:ring-lagoon/20"
                  )}
                  aria-describedby="slug-hint"
                />
                {typedSlug.length > 0 && typedSlug !== slug && (
                  <p id="slug-hint" className="text-xs text-coral" role="alert">
                    Slug tidak cocok. Ketik persis seperti yang ditampilkan.
                  </p>
                )}
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-end gap-3 pt-1">
              <Dialog.Close
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2.5 text-sm font-medium text-foreground bg-secondary hover:bg-secondary/80 rounded-xl transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Batal
              </Dialog.Close>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={!isConfirmEnabled}
                className={cn(
                  "inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-xl transition-colors min-h-[44px]",
                  "bg-coral hover:bg-coral/90",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
                aria-label="Konfirmasi hapus"
              >
                {isLoading ? (
                  <>
                    {/* Spinner */}
                    <svg
                      className="animate-spin w-4 h-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Menghapus...
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                    Hapus Permanen
                  </>
                )}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Toast notifications rendered outside the dialog portal */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
