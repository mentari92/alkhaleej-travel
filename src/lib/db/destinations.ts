/**
 * Destinations repository for Cloudflare D1.
 * Maps to the `packages` table and related child tables.
 * Provides CRUD operations for travel packages (destinations).
 */

import type {
  PackageRow,
  GalleryImageRow,
  PackageTierRow,
  DepartureScheduleRow,
  TestimonialRow,
  FaqEntryRow,
} from "./schema";
import type { LocalizedString } from "@/lib/i18n/config";

// --- Types ---

export interface GalleryImage {
  url: string;
  alt: LocalizedString;
  order: number;
}

export interface ServicePackage {
  id: string;
  name: LocalizedString;
  description: LocalizedString;
  price: string;
  features: LocalizedString[];
}

export interface Destination {
  id: string;
  slug: string;
  title: LocalizedString;
  tagline: LocalizedString;
  heroImage: string;
  aboutText: LocalizedString;
  galleryImages: GalleryImage[];
  services: ServicePackage[];
  testimonials: {
    id: string;
    author: string;
    content: LocalizedString;
    rating: number;
  }[];
  faqEntries: {
    id: string;
    question: LocalizedString;
    answer: LocalizedString;
    order: number;
  }[];
  whatsappNumber: string;
  status: "published" | "draft";
  createdAt: string;
  updatedAt: string;
}

export interface CreateDestinationInput {
  title: LocalizedString;
  tagline: LocalizedString;
  heroImage: string;
  aboutText: LocalizedString;
  galleryImages: GalleryImage[];
  services: ServicePackage[];
  testimonials: {
    id: string;
    author: string;
    content: LocalizedString;
    rating: number;
  }[];
  faqEntries: {
    id: string;
    question: LocalizedString;
    answer: LocalizedString;
    order: number;
  }[];
  whatsappNumber: string;
  status: "published" | "draft";
}

export interface UpdateDestinationInput {
  title?: LocalizedString;
  tagline?: LocalizedString;
  heroImage?: string;
  aboutText?: LocalizedString;
  galleryImages?: GalleryImage[];
  services?: ServicePackage[];
  testimonials?: {
    id: string;
    author: string;
    content: LocalizedString;
    rating: number;
  }[];
  faqEntries?: {
    id: string;
    question: LocalizedString;
    answer: LocalizedString;
    order: number;
  }[];
  whatsappNumber?: string;
  status?: "published" | "draft";
}

// --- Slug generation ---

function generateSlug(titleId: string): string {
  return titleId
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

// --- Row mapping ---

function mapRowToDestination(
  row: PackageRow,
  gallery: GalleryImageRow[],
  tiers: PackageTierRow[],
  testimonials: TestimonialRow[],
  faq: FaqEntryRow[]
): Destination {
  return {
    id: row.id,
    slug: row.slug,
    title: { id: row.title_id, en: row.title_en },
    tagline: { id: row.tagline_id, en: row.tagline_en },
    heroImage: row.hero_image,
    aboutText: { id: row.about_text_id, en: row.about_text_en },
    galleryImages: gallery
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((g) => ({
        url: g.url,
        alt: { id: g.alt_id, en: g.alt_en },
        order: g.sort_order,
      })),
    services: tiers
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((t) => ({
        id: t.id,
        name: { id: t.name_id, en: t.name_en },
        description: { id: t.description_id, en: t.description_en },
        price: t.price,
        features: JSON.parse(t.features_id || "[]").map(
          (f: string, i: number) => ({
            id: f,
            en: JSON.parse(t.features_en || "[]")[i] || f,
          })
        ),
      })),
    testimonials: testimonials.map((t) => ({
      id: t.id,
      author: t.author,
      content: { id: t.content_id, en: t.content_en },
      rating: t.rating,
    })),
    faqEntries: faq
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((f) => ({
        id: f.id,
        question: { id: f.question_id, en: f.question_en },
        answer: { id: f.answer_id, en: f.answer_en },
        order: f.sort_order,
      })),
    whatsappNumber: row.whatsapp_number,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// --- Helper: load related child records ---

async function loadRelatedRecords(
  db: D1Database,
  packageId: string
): Promise<{
  gallery: GalleryImageRow[];
  tiers: PackageTierRow[];
  testimonials: TestimonialRow[];
  faq: FaqEntryRow[];
}> {
  const [galleryRes, tiersRes, testimonialsRes, faqRes] = await db.batch([
    db
      .prepare("SELECT * FROM gallery_images WHERE package_id = ? ORDER BY sort_order")
      .bind(packageId),
    db
      .prepare("SELECT * FROM package_tiers WHERE package_id = ? ORDER BY sort_order")
      .bind(packageId),
    db
      .prepare("SELECT * FROM testimonials WHERE package_id = ?")
      .bind(packageId),
    db
      .prepare("SELECT * FROM faq_entries WHERE package_id = ? ORDER BY sort_order")
      .bind(packageId),
  ]);

  return {
    gallery: galleryRes.results as GalleryImageRow[],
    tiers: tiersRes.results as PackageTierRow[],
    testimonials: testimonialsRes.results as TestimonialRow[],
    faq: faqRes.results as FaqEntryRow[],
  };
}

// --- CRUD ---

/**
 * Generate a unique UUID-like ID.
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Create a new destination (package).
 */
export async function createDestination(
  db: D1Database,
  input: CreateDestinationInput
): Promise<Destination> {
  const id = generateId();
  const slug = generateSlug(input.title.id);
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  // Build batch statements
  const statements: D1PreparedStatement[] = [];

  // Main INSERT
  statements.push(
    db
      .prepare(
        `INSERT INTO packages (id, slug, title_id, title_en, tagline_id, tagline_en, hero_image, about_text_id, about_text_en, whatsapp_number, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        slug,
        input.title.id,
        input.title.en,
        input.tagline.id,
        input.tagline.en,
        input.heroImage,
        input.aboutText.id,
        input.aboutText.en,
        input.whatsappNumber,
        input.status,
        now,
        now
      )
  );

  // Gallery images
  for (const img of input.galleryImages) {
    statements.push(
      db
        .prepare(
          `INSERT INTO gallery_images (id, package_id, url, alt_id, alt_en, sort_order) VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(generateId(), id, img.url, img.alt.id, img.alt.en, img.order)
    );
  }

  // Service packages (tiers)
  for (const svc of input.services) {
    statements.push(
      db
        .prepare(
          `INSERT INTO service_packages (id, package_id, name_id, name_en, description_id, description_en, price, features_id, features_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          svc.id || generateId(),
          id,
          svc.name.id,
          svc.name.en,
          svc.description.id,
          svc.description.en,
          svc.price,
          JSON.stringify(svc.features.map((f) => f.id)),
          JSON.stringify(svc.features.map((f) => f.en))
        )
    );
  }

  // Testimonials
  for (const t of input.testimonials) {
    statements.push(
      db
        .prepare(
          `INSERT INTO testimonials (id, package_id, author, content_id, content_en, rating) VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(t.id || generateId(), id, t.author, t.content.id, t.content.en, t.rating)
    );
  }

  // FAQ entries
  for (const f of input.faqEntries) {
    statements.push(
      db
        .prepare(
          `INSERT INTO faq_entries (id, package_id, question_id, question_en, answer_id, answer_en, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(f.id || generateId(), id, f.question.id, f.question.en, f.answer.id, f.answer.en, f.order)
    );
  }

  await db.batch(statements);

  // Read back
  return (await getDestinationById(db, id))!;
}

/**
 * Get a destination by its ID.
 */
export async function getDestinationById(
  db: D1Database,
  id: string
): Promise<Destination | null> {
  const row = await db
    .prepare("SELECT * FROM packages WHERE id = ?")
    .bind(id)
    .first<PackageRow>();

  if (!row) return null;

  const related = await loadRelatedRecords(db, id);
  return mapRowToDestination(row, related.gallery, related.tiers, related.testimonials, related.faq);
}

/**
 * Get a destination by its slug.
 */
export async function getDestinationBySlug(
  db: D1Database,
  slug: string
): Promise<Destination | null> {
  const row = await db
    .prepare("SELECT * FROM packages WHERE slug = ?")
    .bind(slug)
    .first<PackageRow>();

  if (!row) return null;

  const related = await loadRelatedRecords(db, row.id);
  return mapRowToDestination(row, related.gallery, related.tiers, related.testimonials, related.faq);
}

/**
 * List all published destinations.
 */
export async function listPublishedDestinations(
  db: D1Database
): Promise<Destination[]> {
  const { results } = await db
    .prepare("SELECT * FROM packages WHERE status = 'published' ORDER BY created_at DESC")
    .all<PackageRow>();

  const destinations: Destination[] = [];
  for (const row of results) {
    const related = await loadRelatedRecords(db, row.id);
    destinations.push(
      mapRowToDestination(row, related.gallery, related.tiers, related.testimonials, related.faq)
    );
  }
  return destinations;
}

/**
 * List all destinations regardless of status.
 */
export async function listAllDestinations(
  db: D1Database
): Promise<Destination[]> {
  const { results } = await db
    .prepare("SELECT * FROM packages ORDER BY created_at DESC")
    .all<PackageRow>();

  const destinations: Destination[] = [];
  for (const row of results) {
    const related = await loadRelatedRecords(db, row.id);
    destinations.push(
      mapRowToDestination(row, related.gallery, related.tiers, related.testimonials, related.faq)
    );
  }
  return destinations;
}

/**
 * Update a destination with partial data.
 */
export async function updateDestination(
  db: D1Database,
  id: string,
  input: UpdateDestinationInput
): Promise<Destination> {
  const existing = await getDestinationById(db, id);
  if (!existing) {
    throw new Error(`Destination ${id} not found`);
  }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const statements: D1PreparedStatement[] = [];

  // Build dynamic UPDATE for scalar fields
  const setClauses: string[] = [];
  const bindArgs: unknown[] = [];

  if (input.title !== undefined) {
    setClauses.push("title_id = ?", "title_en = ?");
    bindArgs.push(input.title.id, input.title.en);
  }
  if (input.tagline !== undefined) {
    setClauses.push("tagline_id = ?", "tagline_en = ?");
    bindArgs.push(input.tagline.id, input.tagline.en);
  }
  if (input.heroImage !== undefined) {
    setClauses.push("hero_image = ?");
    bindArgs.push(input.heroImage);
  }
  if (input.aboutText !== undefined) {
    setClauses.push("about_text_id = ?", "about_text_en = ?");
    bindArgs.push(input.aboutText.id, input.aboutText.en);
  }
  if (input.whatsappNumber !== undefined) {
    setClauses.push("whatsapp_number = ?");
    bindArgs.push(input.whatsappNumber);
  }
  if (input.status !== undefined) {
    setClauses.push("status = ?");
    bindArgs.push(input.status);
  }

  // Always update updated_at
  setClauses.push("updated_at = ?");
  bindArgs.push(now);

  if (setClauses.length > 0) {
    statements.push(
      db
        .prepare(
          `UPDATE packages SET ${setClauses.join(", ")} WHERE id = ?`
        )
        .bind(...bindArgs, id)
    );
  }

  // Gallery images — only if explicitly provided (including empty array)
  if (input.galleryImages !== undefined) {
    statements.push(
      db.prepare("DELETE FROM gallery_images WHERE package_id = ?").bind(id)
    );
    for (const img of input.galleryImages) {
      statements.push(
        db
          .prepare(
            `INSERT INTO gallery_images (id, package_id, url, alt_id, alt_en, sort_order) VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(generateId(), id, img.url, img.alt.id, img.alt.en, img.order)
      );
    }
  }

  // Services (tiers) — only if explicitly provided
  if (input.services !== undefined) {
    statements.push(
      db.prepare("DELETE FROM service_packages WHERE package_id = ?").bind(id)
    );
    for (const svc of input.services) {
      statements.push(
        db
          .prepare(
            `INSERT INTO service_packages (id, package_id, name_id, name_en, description_id, description_en, price, features_id, features_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            svc.id || generateId(),
            id,
            svc.name.id,
            svc.name.en,
            svc.description.id,
            svc.description.en,
            svc.price,
            JSON.stringify(svc.features.map((f) => f.id)),
            JSON.stringify(svc.features.map((f) => f.en))
          )
      );
    }
  }

  // Testimonials — only if explicitly provided
  if (input.testimonials !== undefined) {
    statements.push(
      db.prepare("DELETE FROM testimonials WHERE package_id = ?").bind(id)
    );
    for (const t of input.testimonials) {
      statements.push(
        db
          .prepare(
            `INSERT INTO testimonials (id, package_id, author, content_id, content_en, rating) VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(t.id || generateId(), id, t.author, t.content.id, t.content.en, t.rating)
      );
    }
  }

  // FAQ entries — only if explicitly provided
  if (input.faqEntries !== undefined) {
    statements.push(
      db.prepare("DELETE FROM faq_entries WHERE package_id = ?").bind(id)
    );
    for (const f of input.faqEntries) {
      statements.push(
        db
          .prepare(
            `INSERT INTO faq_entries (id, package_id, question_id, question_en, answer_id, answer_en, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(f.id || generateId(), id, f.question.id, f.question.en, f.answer.id, f.answer.en, f.order)
      );
    }
  }

  if (statements.length > 0) {
    await db.batch(statements);
  }

  // Read back
  return (await getDestinationById(db, id))!;
}

/**
 * Update the status of a destination.
 */
export async function updateDestinationStatus(
  db: D1Database,
  id: string,
  status: "published" | "draft"
): Promise<void> {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  await db
    .prepare("UPDATE packages SET status = ?, updated_at = ? WHERE id = ?")
    .bind(status, now, id)
    .run();
}

/**
 * Delete a destination by ID.
 */
export async function deleteDestination(
  db: D1Database,
  id: string
): Promise<void> {
  await db
    .prepare("DELETE FROM packages WHERE id = ?")
    .bind(id)
    .run();
}

/**
 * Get the count of published destinations.
 */
export async function getDestinationsCount(
  db: D1Database
): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) as count FROM packages WHERE status = 'published'")
    .first<{ count: number }>();
  return row?.count ?? 0;
}
