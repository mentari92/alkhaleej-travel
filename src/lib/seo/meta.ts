/**
 * Meta tag generation utility with hreflang support.
 * Generates SEO metadata for destinations and blog articles.
 */

import type { Locale } from "../i18n/config";
import { i18nConfig } from "../i18n/config";
import { t } from "../i18n/utils";
import type { Destination, BlogArticle, HreflangEntry } from "../types";

export interface MetaTags {
  title: string;
  description: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogType: string;
  hreflang: HreflangEntry[];
}

const SITE_URL = "https://infotour.id";

/**
 * Determines if the data is a Destination (has LocalizedString title)
 * vs a BlogArticle (has string title).
 */
function isDestination(data: Destination | BlogArticle): data is Destination {
  return typeof data.title === "object" && "id" in data.title && "en" in data.title;
}

/**
 * Generates complete meta tags for a Destination or BlogArticle.
 *
 * For Destinations:
 * - Uses localized title and tagline for meta title/description
 * - Builds canonical URL based on locale prefix + /destinations/{slug}
 * - Generates hreflang entries for both supported locales
 *
 * For BlogArticles:
 * - Uses title and metaDescription for meta
 * - Builds canonical URL with language prefix + /blog/{slug}
 * - Generates hreflang to paired article if it exists
 */
export function generateMetaTags(data: Destination | BlogArticle, locale: Locale): MetaTags {
  if (isDestination(data)) {
    return generateDestinationMetaTags(data, locale);
  }
  return generateBlogMetaTags(data, locale);
}

function generateDestinationMetaTags(destination: Destination, locale: Locale): MetaTags {
  const title = t(destination.title, locale);
  const description = t(destination.tagline, locale);
  const prefix = i18nConfig.urlPrefix[locale];
  const canonicalPath = `${prefix}/destinations/${destination.slug}`;
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;

  // Generate hreflang entries for all supported locales
  const hreflang: HreflangEntry[] = i18nConfig.locales.map((loc) => {
    const locPrefix = i18nConfig.urlPrefix[loc];
    const url = `${SITE_URL}${locPrefix}/destinations/${destination.slug}`;
    return { locale: loc, url };
  });

  return {
    title,
    description,
    canonicalUrl,
    ogTitle: title,
    ogDescription: description,
    ogImage: destination.heroImage,
    ogType: "website",
    hreflang,
  };
}

function generateBlogMetaTags(article: BlogArticle, locale: Locale): MetaTags {
  const prefix = i18nConfig.urlPrefix[locale];
  const canonicalPath = `${prefix}/blog/${article.slug}`;
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;

  // Generate hreflang entries
  const hreflang: HreflangEntry[] = [
    { locale, url: canonicalUrl },
  ];

  // If there's a paired article, add hreflang for the alternate language
  if (article.pairedArticleId) {
    const alternateLocale: Locale = locale === "id" ? "en" : "id";
    const alternatePrefix = i18nConfig.urlPrefix[alternateLocale];
    // For paired articles, we use the same slug since they're translations
    const alternateUrl = `${SITE_URL}${alternatePrefix}/blog/${article.slug}`;
    hreflang.push({ locale: alternateLocale, url: alternateUrl });
  }

  return {
    title: article.title,
    description: article.metaDescription,
    canonicalUrl,
    ogTitle: article.title,
    ogDescription: article.metaDescription,
    ogImage: article.ogImage,
    ogType: "article",
    hreflang,
  };
}
