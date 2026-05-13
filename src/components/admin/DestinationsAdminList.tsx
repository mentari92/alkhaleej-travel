/**
 * DestinationsAdminList — React island for the admin destinations listing page.
 *
 * Renders the destination rows with Edit, toggle-status, and Hapus (delete) actions.
 * Wires in DeleteConfirmDialog for typed-slug confirmation before sending
 * DELETE /api/destinations/{id}.
 *
 * Validates: Requirements 7.1, 7.3, 7.6, 7.7, 7.8
 */

import * as React from "react";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DestinationItem {
  id: string;
  title: { id: string; en: string };
  tagline: { id: string; en: string };
  slug: string;
  heroImage: string | null;
  status: "published" | "draft";
  updatedAt: string;
}

interface DestinationsAdminListProps {
  initialDestinations: DestinationItem[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DestinationsAdminList({
  initialDestinations,
}: DestinationsAdminListProps) {
  const [destinations, setDestinations] =
    React.useState<DestinationItem[]>(initialDestinations);

  // Delete dialog state
  const [deleteDialog, setDeleteDialog] = React.useState<{
    open: boolean;
    id: string;
    title: string;
    slug: string;
  }>({ open: false, id: "", title: "", slug: "" });

  // Status message state
  const [message, setMessage] = React.useState<{
    text: string;
    isError: boolean;
  } | null>(null);

  function showMessage(text: string, isError = false) {
    setMessage({ text, isError });
  }

  function clearMessage() {
    setMessage(null);
  }

  // -------------------------------------------------------------------------
  // Toggle publish/draft status
  // -------------------------------------------------------------------------

  async function handleToggleStatus(dest: DestinationItem) {
    const newStatus = dest.status === "published" ? "draft" : "published";

    try {
      const response = await fetch(`/api/destinations/${dest.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const result = (await response.json()) as {
        success: boolean;
        error?: { message?: string };
      };

      if (result.success) {
        const actionText =
          newStatus === "published" ? "dipublikasi" : "disembunyikan";
        showMessage(`✅ Destinasi berhasil ${actionText}.`);
        setDestinations((prev) =>
          prev.map((d) =>
            d.id === dest.id ? { ...d, status: newStatus } : d
          )
        );
      } else {
        showMessage(result.error?.message || "Gagal mengubah status.", true);
      }
    } catch {
      showMessage("Gagal menghubungi server.", true);
    }
  }

  // -------------------------------------------------------------------------
  // Open delete dialog
  // -------------------------------------------------------------------------

  function openDeleteDialog(dest: DestinationItem) {
    setDeleteDialog({
      open: true,
      id: dest.id,
      title: dest.title.id,
      slug: dest.slug,
    });
  }

  function closeDeleteDialog() {
    setDeleteDialog((prev) => ({ ...prev, open: false }));
  }

  // -------------------------------------------------------------------------
  // Handle successful delete — remove row without page reload
  // -------------------------------------------------------------------------

  function handleDeleteSuccess() {
    setDestinations((prev) =>
      prev.filter((d) => d.id !== deleteDialog.id)
    );
    clearMessage();
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (destinations.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-12 text-center shadow-soft">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-secondary grid place-items-center mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-8 h-8 text-muted-foreground"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>
        <h3 className="font-display text-lg font-semibold text-foreground">
          Belum ada destinasi
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Mulai dengan menambahkan destinasi pertama.
        </p>
        <a
          href="/admin/destinations/new"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-ocean hover:bg-ocean-deep rounded-xl transition-colors min-h-[44px]"
        >
          Tambah Destinasi
        </a>
      </div>
    );
  }

  return (
    <>
      {/* Status message */}
      {message && (
        <div
          role="alert"
          className={`rounded-xl p-4 text-sm font-medium ${
            message.isError
              ? "bg-coral/10 text-coral"
              : "bg-lagoon/10 text-ocean-deep"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Destinations grid */}
      <div className="grid gap-4">
        {destinations.map((dest) => (
          <div
            key={dest.id}
            id={`row-${dest.id}`}
            className="bg-card rounded-2xl border border-border p-5 shadow-soft hover:shadow-card transition-shadow"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Thumbnail + info */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-secondary">
                  {dest.heroImage && (
                    <img
                      src={dest.heroImage}
                      alt={dest.title.id}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-foreground truncate">
                    {dest.title.id}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {dest.tagline.id}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        dest.status === "published"
                          ? "bg-lagoon/10 text-lagoon"
                          : "bg-coral/10 text-coral"
                      }`}
                    >
                      {dest.status === "published"
                        ? "✅ Dipublikasi"
                        : "📝 Draf"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(dest.updatedAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Edit */}
                <a
                  href={`/admin/destinations/${dest.id}/edit`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-ocean bg-ocean/10 hover:bg-ocean/20 rounded-lg transition-colors min-h-[36px]"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
                  </svg>
                  Edit
                </a>

                {/* Toggle publish/draft */}
                <button
                  type="button"
                  onClick={() => handleToggleStatus(dest)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors min-h-[36px]"
                >
                  {dest.status === "published" ? (
                    <span className="inline-flex items-center gap-1.5 text-coral bg-coral/10 hover:bg-coral/20 px-3 py-2 rounded-lg">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-3.5 h-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                        <path d="m2 2 20 20" />
                      </svg>
                      Sembunyikan
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-lagoon bg-lagoon/10 hover:bg-lagoon/20 px-3 py-2 rounded-lg">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-3.5 h-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      Publikasi
                    </span>
                  )}
                </button>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => openDeleteDialog(dest)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-coral bg-coral/10 hover:bg-coral/20 rounded-lg transition-colors min-h-[36px]"
                  aria-label={`Hapus destinasi ${dest.title.id}`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-3.5 h-3.5"
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
                  Hapus
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={deleteDialog.open}
        title={deleteDialog.title}
        slug={deleteDialog.slug}
        deleteUrl={`/api/destinations/${deleteDialog.id}`}
        onSuccess={handleDeleteSuccess}
        onClose={closeDeleteDialog}
      />
    </>
  );
}
