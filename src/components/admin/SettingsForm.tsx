/**
 * SettingsForm — Admin site settings React island.
 * Five tabs: General, Contact, Homepage, SEO, Analytics.
 * Tracks dirty fields and only sends changed fields on save.
 * Validates: Requirements 11.2–11.13, 14.3, 14.7, 16.1–16.8
 */
import * as React from "react";
import type { SiteSettings } from "@/lib/db/site-settings";

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
interface Toast { id: string; message: string; variant: "success" | "error" }

function ToastList({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div aria-live="polite" className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} role="status"
          className={`pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg text-sm font-medium max-w-sm ${
            t.variant === "success" ? "bg-lagoon/10 text-ocean-deep border border-lagoon/20" : "bg-coral/10 text-coral border border-coral/20"
          }`}>
          <span className="flex-1">{t.message}</span>
          <button type="button" onClick={() => onDismiss(t.id)} className="opacity-60 hover:opacity-100" aria-label="Tutup">✕</button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-coral" role="alert">{error}</p>}
    </div>
  );
}

function Input({ value, onChange, onBlur, placeholder, type = "text", disabled }: {
  value: string; onChange: (v: string) => void; onBlur?: () => void; placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
      placeholder={placeholder} disabled={disabled}
      className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm focus:border-lagoon focus:ring-2 focus:ring-lagoon/20 outline-none transition disabled:opacity-50" />
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} rows={rows}
      className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm focus:border-lagoon focus:ring-2 focus:ring-lagoon/20 outline-none transition resize-y" />
  );
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
function validate(fields: Partial<SiteSettings>): Record<string, string> {
  const errors: Record<string, string> = {};
  if (fields.primaryWhatsappNumber !== undefined && !/^62[0-9]{8,13}$/.test(fields.primaryWhatsappNumber)) {
    errors.primaryWhatsappNumber = "Nomor WhatsApp harus diawali 62 dan berisi 10–15 digit";
  }
  if (fields.supportEmail !== undefined && !/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(fields.supportEmail)) {
    errors.supportEmail = "Format email tidak valid";
  }
  if (fields.socialInstagramUrl && !/^https:\/\/(www\.)?instagram\.com/.test(fields.socialInstagramUrl)) {
    errors.socialInstagramUrl = "URL Instagram tidak valid (harus https://instagram.com/...)";
  }
  if (fields.socialYoutubeUrl && !/^https:\/\/(www\.)?youtube\.com|^https:\/\/youtu\.be/.test(fields.socialYoutubeUrl)) {
    errors.socialYoutubeUrl = "URL YouTube tidak valid";
  }
  if (fields.socialFacebookUrl && !/^https:\/\/(www\.)?(facebook\.com|fb\.com)/.test(fields.socialFacebookUrl)) {
    errors.socialFacebookUrl = "URL Facebook tidak valid";
  }
  if (fields.socialTiktokUrl && !/^https:\/\/(www\.)?tiktok\.com/.test(fields.socialTiktokUrl)) {
    errors.socialTiktokUrl = "URL TikTok tidak valid";
  }
  if (fields.gtmContainerId && !/^GTM-[A-Z0-9]{4,10}$/.test(fields.gtmContainerId)) {
    errors.gtmContainerId = "GTM Container ID harus berpola GTM-XXXXXXX";
  }
  if (fields.ga4MeasurementId && !/^G-[A-Z0-9]{6,12}$/.test(fields.ga4MeasurementId)) {
    errors.ga4MeasurementId = "GA4 Measurement ID harus berpola G-XXXXXXXXXX";
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Props { settings: SiteSettings }

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function SettingsForm({ settings: initial }: Props) {
  const [values, setValues] = React.useState<SiteSettings>({ ...initial });
  const [dirtyFields, setDirtyFields] = React.useState<Set<string>>(new Set());
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [activeTab, setActiveTab] = React.useState<"general" | "contact" | "homepage" | "seo" | "analytics">("general");

  // Unsaved changes guard
  React.useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyFields.size > 0) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirtyFields]);

  // Auto-dismiss toasts
  React.useEffect(() => {
    if (toasts.length === 0) return;
    const t = setTimeout(() => setToasts((p) => p.slice(1)), 4000);
    return () => clearTimeout(t);
  }, [toasts]);

  function addToast(message: string, variant: "success" | "error") {
    const id = `${Date.now()}`;
    // Deduplicate by id
    setToasts((prev) => {
      const filtered = prev.filter((t) => t.id !== id);
      return [...filtered, { id, message, variant }];
    });
  }

  function set<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setDirtyFields((prev) => new Set(prev).add(key));
    // Clear error on change
    if (errors[key]) setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  }

  function blur<K extends keyof SiteSettings>(key: K) {
    const partial: Partial<SiteSettings> = { [key]: values[key] };
    const errs = validate(partial);
    if (errs[key]) setErrors((prev) => ({ ...prev, [key]: errs[key] }));
  }

  async function handleSave() {
    if (dirtyFields.size === 0) return;
    const patch: Partial<SiteSettings> = {};
    dirtyFields.forEach((k) => { (patch as Record<string, unknown>)[k] = (values as Record<string, unknown>)[k]; });
    const errs = validate(patch);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setIsSaving(true);
    try {
      const res = await fetch("/api/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json() as { success: boolean; error?: { message: string } };
      if (data.success) {
        setDirtyFields(new Set());
        addToast("Pengaturan berhasil disimpan", "success");
      } else {
        addToast(data.error?.message ?? "Gagal menyimpan pengaturan", "error");
      }
    } catch {
      addToast("Tidak dapat terhubung ke server", "error");
    } finally {
      setIsSaving(false);
    }
  }

  const tabs = [
    { id: "general", label: "General" },
    { id: "contact", label: "Contact" },
    { id: "homepage", label: "Homepage" },
    { id: "seo", label: "SEO" },
    { id: "analytics", label: "Analytics" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="border-b border-border">
        <nav className="flex gap-1" aria-label="Settings tabs">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 rounded-t-lg min-h-[44px] transition-colors ${
                activeTab === tab.id
                  ? "border-lagoon text-ocean-deep"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              aria-selected={activeTab === tab.id}>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab panels */}
      <div className="space-y-5">

        {/* General */}
        {activeTab === "general" && (
          <div className="space-y-5">
            <h3 className="font-semibold text-lg text-ocean-deep">Branding & General</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Nama Brand (ID)" error={errors.brandNameId}>
                <Input value={values.brandNameId} onChange={(v) => set("brandNameId", v)} onBlur={() => blur("brandNameId")} placeholder="infotour.id" />
              </Field>
              <Field label="Brand Name (EN)" error={errors.brandNameEn}>
                <Input value={values.brandNameEn} onChange={(v) => set("brandNameEn", v)} placeholder="infotour.id" />
              </Field>
              <Field label="Tagline (ID)" error={errors.taglineId}>
                <Input value={values.taglineId} onChange={(v) => set("taglineId", v)} placeholder="Direktori wisata Indonesia terkurasi" />
              </Field>
              <Field label="Tagline (EN)" error={errors.taglineEn}>
                <Input value={values.taglineEn} onChange={(v) => set("taglineEn", v)} placeholder="Curated Indonesia travel directory" />
              </Field>
              <Field label="URL Logo" error={errors.logoUrl}>
                <Input value={values.logoUrl ?? ""} onChange={(v) => set("logoUrl", v || null)} placeholder="https://..." />
              </Field>
              <Field label="URL Favicon" error={errors.faviconUrl}>
                <Input value={values.faviconUrl ?? ""} onChange={(v) => set("faviconUrl", v || null)} placeholder="https://..." />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Copyright Text" error={errors.copyrightText}>
                <Input value={values.copyrightText} onChange={(v) => set("copyrightText", v)} placeholder="© infotour.id. Semua hak dilindungi." />
              </Field>
              <Field label="Footer Tagline (ID)" error={errors.footerTaglineId}>
                <Input value={values.footerTaglineId ?? ""} onChange={(v) => set("footerTaglineId", v || null)} placeholder="Opsional" />
              </Field>
              <Field label="Footer Tagline (EN)" error={errors.footerTaglineEn}>
                <Input value={values.footerTaglineEn ?? ""} onChange={(v) => set("footerTaglineEn", v || null)} placeholder="Optional" />
              </Field>
            </div>
          </div>
        )}

        {/* Contact */}
        {activeTab === "contact" && (
          <div className="space-y-5">
            <h3 className="font-semibold text-lg text-ocean-deep">Kontak & Sosial Media</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Nomor WhatsApp Utama" error={errors.primaryWhatsappNumber}>
                <Input value={values.primaryWhatsappNumber} onChange={(v) => set("primaryWhatsappNumber", v)}
                  onBlur={() => blur("primaryWhatsappNumber")} placeholder="6281200000000" />
              </Field>
              <Field label="Email Support" error={errors.supportEmail}>
                <Input value={values.supportEmail} onChange={(v) => set("supportEmail", v)}
                  onBlur={() => blur("supportEmail")} type="email" placeholder="halo@infotour.id" />
              </Field>
              <Field label="Alamat" error={errors.address}>
                <Input value={values.address ?? ""} onChange={(v) => set("address", v || null)} placeholder="Bali, Indonesia" />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Instagram URL" error={errors.socialInstagramUrl}>
                <Input value={values.socialInstagramUrl ?? ""} onChange={(v) => set("socialInstagramUrl", v || null)}
                  onBlur={() => blur("socialInstagramUrl")} placeholder="https://instagram.com/..." />
              </Field>
              <Field label="YouTube URL" error={errors.socialYoutubeUrl}>
                <Input value={values.socialYoutubeUrl ?? ""} onChange={(v) => set("socialYoutubeUrl", v || null)}
                  onBlur={() => blur("socialYoutubeUrl")} placeholder="https://youtube.com/..." />
              </Field>
              <Field label="Facebook URL" error={errors.socialFacebookUrl}>
                <Input value={values.socialFacebookUrl ?? ""} onChange={(v) => set("socialFacebookUrl", v || null)}
                  onBlur={() => blur("socialFacebookUrl")} placeholder="https://facebook.com/..." />
              </Field>
              <Field label="TikTok URL" error={errors.socialTiktokUrl}>
                <Input value={values.socialTiktokUrl ?? ""} onChange={(v) => set("socialTiktokUrl", v || null)}
                  onBlur={() => blur("socialTiktokUrl")} placeholder="https://tiktok.com/..." />
              </Field>
            </div>
          </div>
        )}

        {/* Homepage */}
        {activeTab === "homepage" && (
          <div className="space-y-5">
            <h3 className="font-semibold text-lg text-ocean-deep">Hero & Statistik</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="URL Gambar Hero" error={errors.heroImageUrl}>
                <Input value={values.heroImageUrl} onChange={(v) => set("heroImageUrl", v)} placeholder="/assets/hero-bali.jpg" />
              </Field>
              <Field label="Hero Title (ID)" error={errors.heroTitleId}>
                <Input value={values.heroTitleId} onChange={(v) => set("heroTitleId", v)} />
              </Field>
              <Field label="Hero Title (EN)" error={errors.heroTitleEn}>
                <Input value={values.heroTitleEn} onChange={(v) => set("heroTitleEn", v)} />
              </Field>
              <Field label="Hero Subtitle (ID)" error={errors.heroSubtitleId}>
                <Input value={values.heroSubtitleId} onChange={(v) => set("heroSubtitleId", v)} />
              </Field>
              <Field label="Hero Subtitle (EN)" error={errors.heroSubtitleEn}>
                <Input value={values.heroSubtitleEn} onChange={(v) => set("heroSubtitleEn", v)} />
              </Field>
              <Field label="Hero CTA Text (ID)" error={errors.heroCtaTextId}>
                <Input value={values.heroCtaTextId} onChange={(v) => set("heroCtaTextId", v)} placeholder="Cari Destinasi" />
              </Field>
              <Field label="Hero CTA Text (EN)" error={errors.heroCtaTextEn}>
                <Input value={values.heroCtaTextEn} onChange={(v) => set("heroCtaTextEn", v)} placeholder="Find Destinations" />
              </Field>
            </div>
            <div className="border-t border-border pt-5 space-y-4">
              <h4 className="font-medium text-foreground">Statistik</h4>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="destCountAuto" checked={values.destinationsCountAuto}
                  onChange={(e) => set("destinationsCountAuto", e.target.checked)}
                  className="w-4 h-4 rounded border-border text-lagoon" />
                <label htmlFor="destCountAuto" className="text-sm font-medium">Gunakan jumlah destinasi otomatis</label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Override Jumlah Destinasi" error={errors.destinationsCountOverride}>
                  <Input value={String(values.destinationsCountOverride ?? "")}
                    onChange={(v) => set("destinationsCountOverride", v ? Number(v) : null)}
                    type="number" disabled={values.destinationsCountAuto} placeholder="Kosongkan untuk otomatis" />
                </Field>
                <Field label="Jumlah Partner" error={errors.partnersCount}>
                  <Input value={String(values.partnersCount)} onChange={(v) => set("partnersCount", Number(v))} type="number" />
                </Field>
                <Field label="Wisatawan Senang" error={errors.happyTouristsCount}>
                  <Input value={String(values.happyTouristsCount)} onChange={(v) => set("happyTouristsCount", Number(v))} type="number" />
                </Field>
                <Field label="Rating Rata-rata" error={errors.averageRating}>
                  <Input value={String(values.averageRating)} onChange={(v) => set("averageRating", Number(v))} type="number" placeholder="4.9" />
                </Field>
              </div>
            </div>
          </div>
        )}

        {/* SEO */}
        {activeTab === "seo" && (
          <div className="space-y-5">
            <h3 className="font-semibold text-lg text-ocean-deep">SEO Default</h3>
            <div className="grid grid-cols-1 gap-5">
              <Field label="Default OG Image URL" error={errors.defaultOgImage}>
                <Input value={values.defaultOgImage ?? ""} onChange={(v) => set("defaultOgImage", v || null)} placeholder="https://..." />
              </Field>
              <Field label="Meta Description Template (ID)" error={errors.defaultMetaDescriptionTemplateId}>
                <Textarea value={values.defaultMetaDescriptionTemplateId}
                  onChange={(v) => set("defaultMetaDescriptionTemplateId", v)}
                  placeholder="Temukan destinasi wisata terbaik di Indonesia." />
              </Field>
              <Field label="Meta Description Template (EN)" error={errors.defaultMetaDescriptionTemplateEn}>
                <Textarea value={values.defaultMetaDescriptionTemplateEn}
                  onChange={(v) => set("defaultMetaDescriptionTemplateEn", v)}
                  placeholder="Discover the best travel destinations in Indonesia." />
              </Field>
            </div>
          </div>
        )}

        {/* Analytics */}
        {activeTab === "analytics" && (
          <div className="space-y-5">
            <h3 className="font-semibold text-lg text-ocean-deep">Analytics & Tracking</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="GTM Container ID" error={errors.gtmContainerId}>
                <Input value={values.gtmContainerId ?? ""} onChange={(v) => set("gtmContainerId", v || null)}
                  onBlur={() => blur("gtmContainerId")} placeholder="GTM-XXXXXXX" />
              </Field>
              <Field label="GA4 Measurement ID" error={errors.ga4MeasurementId}>
                <Input value={values.ga4MeasurementId ?? ""} onChange={(v) => set("ga4MeasurementId", v || null)}
                  onBlur={() => blur("ga4MeasurementId")} placeholder="G-XXXXXXXXXX" />
              </Field>
            </div>
            <Field label="Custom Head HTML (hanya snippet analytics)" error={errors.customHeadHtml}>
              <Textarea value={values.customHeadHtml ?? ""} onChange={(v) => set("customHeadHtml", v || null)}
                placeholder={'<script src="https://googletagmanager.com/..."></script>'} rows={5} />
              <p className="text-xs text-muted-foreground mt-1">Hanya tag &lt;script src&gt; dari host analytics yang diizinkan dan &lt;noscript&gt;</p>
            </Field>
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="flex items-center justify-between border-t border-border pt-5">
        <p className="text-sm text-muted-foreground">
          {dirtyFields.size > 0 ? `${dirtyFields.size} field belum disimpan` : "Semua perubahan tersimpan"}
        </p>
        <button type="button" onClick={handleSave} disabled={isSaving || dirtyFields.size === 0}
          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-ocean hover:bg-ocean-deep rounded-xl transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed">
          {isSaving ? (
            <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Menyimpan...</>
          ) : "Simpan Perubahan"}
        </button>
      </div>

      <ToastList toasts={toasts} onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </div>
  );
}
