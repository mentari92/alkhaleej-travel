/**
 * BlogListIsland — React island for the admin blog list page.
 *
 * Renders the article list with Edit, Publish, and Delete actions.
 * Wires up DeleteConfirmDialog for each article row.
 *
 * Validates: Requirements 7.2, 7.4, 7.5, 7.6, 7.7, 7.8
 */

import * as React from "react";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ArticleSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  language: "id" | "en";
  status: "published" | "draft";
  thumbnailUrl?: string | null;
  publishedAt?: string | null;
  createdAt: string;
}

interface BlogListIslandProps {
  initialArticles: ArticleSummary[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BlogListIsland({ initialArticles }: BlogListIslandProps) {
  const [articles, setArticles] = React.useState<ArticleSummary[]>(initialArticles);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = React.useState<ArticleSummary | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  function openDeleteDialog(article: ArticleSummary) {
    setDeleteTarget(article);
    setDeleteDialogOpen(true);
  }

  function closeDeleteDialog() {
    setDeleteDialogOpen(false);
    // Keep deleteTarget until dialog fully closes to avoid layout shift
    setTimeout(() => setDeleteTarget(null), 300);
  }

  function handleDeleteSuccess() {
    if (!deleteTarget) return;
    setArticles((prev) => prev.filter((a) => a.id !== deleteTarget.id));
  }

  async function handlePublish(article: ArticleSummary) {
    const btn = document.getElementById(`publish-btn-${article.id}`) as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Memproses...";
    }

    try {
      const response = await fetch(`/api/blog/${article.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "published",
          publishedAt: new Date().toISOString(),
        }),
      });

      const data = await response.json() as { success: boolean; error?: { message?: string } };

      if (data.success) {
        setArticles((prev) =>
          prev.map((a) =>
            a.id === article.id
              ? { ...a, status: "published", publishedAt: new Date().toISOString() }
              : a
          )
        );
      } else {
        alert(data.error?.message || "Gagal mempublikasi artikel.");
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Publikasi";
        }
      }
    } catch {
      alert("Tidak dapat terhubung ke server.");
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Publikasi";
      }
    }
  }

  if (articles.length === 0) {
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
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            <path d="M10 9H8" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
          </svg>
        </div>
        <h3 className="font-display text-lg font-semibold text-foreground">Belum ada artikel</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Mulai dengan generate artikel menggunakan AI.
        </p>
        <a
          href="/admin/blog/generate"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-ocean hover:bg-ocean-deep rounded-xl transition-colors min-h-[44px]"
        >
          Generate Artikel Pertama
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4">
        {articles.map((article) => (
          <div
            key={article.id}
            id={`row-${article.id}`}
            className="bg-card rounded-2xl border border-border p-5 shadow-soft hover:shadow-card transition-shadow"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Thumbnail + info */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {article.thumbnailUrl && (
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-secondary">
                    <img
                      src={article.thumbnailUrl}
                      alt={article.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-foreground truncate">
                    {article.title}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">{article.excerpt}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span
                      className={[
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                        article.language === "id"
                          ? "bg-coral/10 text-coral"
                          : "bg-ocean/10 text-ocean",
                      ].join(" ")}
                    >
                      {article.language === "id" ? "🇮🇩 ID" : "🇬🇧 EN"}
                    </span>
                    <span
                      className={[
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                        article.status === "published"
                          ? "bg-lagoon/10 text-lagoon"
                          : "bg-muted text-muted-foreground",
                      ].join(" ")}
                    >
                      {article.status === "published" ? "✅ Dipublikasi" : "📝 Draf"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {article.publishedAt
                        ? new Date(article.publishedAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : new Date(article.createdAt).toLocaleDateString("id-ID", {
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
                  href={`/admin/blog/${article.id}/edit`}
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

                {/* Publish (drafts only) */}
                {article.status === "draft" && (
                  <button
                    id={`publish-btn-${article.id}`}
                    type="button"
                    onClick={() => handlePublish(article)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-lagoon bg-lagoon/10 hover:bg-lagoon/20 rounded-lg transition-colors min-h-[36px]"
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
                      <path d="M12 17V3" />
                      <path d="m6 11 6 6 6-6" />
                      <path d="M19 21H5" />
                    </svg>
                    Publikasi
                  </button>
                )}

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => openDeleteDialog(article)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-coral bg-coral/10 hover:bg-coral/20 rounded-lg transition-colors min-h-[36px]"
                  aria-label={`Hapus artikel ${article.title}`}
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
      {deleteTarget && (
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          title={deleteTarget.title}
          slug={deleteTarget.slug}
          deleteUrl={`/api/blog/${deleteTarget.id}`}
          onSuccess={handleDeleteSuccess}
          onClose={closeDeleteDialog}
        />
      )}
    </>
  );
}
