/**
 * i18n Utility Functions
 * Helpers for locale detection, translation, and URL building.
 */

import { i18nConfig, type Locale, type LocalizedString } from "./config";
import { id as idStrings } from "./id";
import { en as enStrings } from "./en";

const translations = { id: idStrings, en: enStrings } as const;

/**
 * Returns the full translation object for the given locale.
 */
export function getTranslations(locale: Locale) {
  return translations[locale];
}

/**
 * Returns the localized string value for the given locale.
 */
export function t(localized: LocalizedString, locale: Locale): string {
  return localized[locale];
}

/**
 * Determines the current locale from a URL path.
 * URLs starting with /en/ are English; all others default to Bahasa Indonesia.
 */
export function getLocaleFromUrl(url: URL): Locale {
  const pathname = url.pathname;
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    return "en";
  }
  return i18nConfig.defaultLocale;
}

/**
 * Builds the equivalent URL in the target locale.
 * Strips or adds the /en prefix as needed while preserving the rest of the path.
 */
export function getAlternateUrl(currentUrl: URL, targetLocale: Locale): string {
  const pathname = currentUrl.pathname;
  const currentLocale = getLocaleFromUrl(currentUrl);

  if (currentLocale === targetLocale) {
    return pathname;
  }

  let basePath: string;

  if (currentLocale === "en") {
    // Remove /en prefix to get the base path
    if (pathname === "/en") {
      basePath = "/";
    } else {
      basePath = pathname.replace(/^\/en/, "") || "/";
    }
  } else {
    basePath = pathname;
  }

  if (targetLocale === "en") {
    // Add /en prefix
    if (basePath === "/") {
      return "/en";
    }
    return `/en${basePath}`;
  }

  // Target is "id" (default) — return base path without prefix
  return basePath;
}
