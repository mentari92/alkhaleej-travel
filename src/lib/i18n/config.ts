/**
 * i18n Configuration
 * Defines supported locales, default locale, and URL prefix mapping.
 */

export type Locale = "id" | "en";

export interface LocalizedString {
  id: string;
  en: string;
}

export interface I18nConfig {
  defaultLocale: Locale;
  locales: Locale[];
  urlPrefix: Record<Locale, string>;
}

export const i18nConfig: I18nConfig = {
  defaultLocale: "id",
  locales: ["id", "en"],
  urlPrefix: {
    id: "",
    en: "/en",
  },
};
