/**
 * Shared TypeScript interfaces and types for Alkhaleej Travelindo Utama.
 */

import type { Locale } from "./i18n/config";

// Re-export for convenience
export type { Locale } from "./i18n/config";
export type { LocalizedString } from "./i18n/config";

import type { LocalizedString } from "./i18n/config";

// --- Package Types ---

export type PackageType = "haji_mujamalah" | "umrah" | "umrah_plus" | "tour_muslim";

export interface GalleryImage {
  url: string;
  alt: LocalizedString;
  order: number;
}

export interface PackageTier {
  id: string;
  name: LocalizedString;
  description: LocalizedString;
  price: string;
  duration: LocalizedString;
  hotelRating: string | null;
  airline: string | null;
  features: LocalizedString[];
  order: number;
}

export interface DepartureSchedule {
  id: string;
  departureDate: string;
  returnDate: string | null;
  departureCity: LocalizedString;
  availableSeats: number;
  status: "open" | "full" | "closed";
  notes: string | null;
  order: number;
}

export interface Testimonial {
  id: string;
  author: string;
  content: LocalizedString;
  rating: number;
  originCity: string | null;
  year: string | null;
}

export interface FaqEntry {
  id: string;
  question: LocalizedString;
  answer: LocalizedString;
  order: number;
}

export interface TravelPackage {
  id: string;
  slug: string;
  title: LocalizedString;
  tagline: LocalizedString;
  heroImage: string;
  packageType: PackageType;
  aboutText: LocalizedString;
  galleryImages: GalleryImage[];
  tiers: PackageTier[];
  departureSchedules: DepartureSchedule[];
  testimonials: Testimonial[];
  faqEntries: FaqEntry[];
  whatsappNumber: string;
  status: "published" | "draft";
  createdAt: string;
  updatedAt: string;
}

// --- Blog Types ---

export interface BlogArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  language: Locale;
  thumbnailUrl: string;
  metaDescription: string;
  ogImage: string;
  relatedPackageIds: string[];
  pairedArticleId: string | null;
  status: "published" | "draft";
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Auth Types ---

export interface Session {
  id: string;
  adminId: string;
  expiresAt: string;
}

export interface AuthResult {
  success: boolean;
  session?: Session;
  error?: string;
}

// --- API Types ---

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

// --- SEO Types ---

export interface HreflangEntry {
  locale: Locale;
  url: string;
}
