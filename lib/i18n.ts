/**
 * Internationalization core.
 *
 * goodoc uses locale-prefixed URLs (e.g. /en/docs/…, /zh/docs/…) so it stays a
 * fully static export — no middleware or runtime redirects required. English is
 * the default locale.
 *
 * To add a locale: add its code here, add a dictionary in lib/dictionaries,
 * add a localized block in lib/site-config.ts, and (optionally) a content
 * folder under content/<locale>/. Missing content falls back to the default.
 */
export const locales = ["en", "zh"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Human-readable names shown in the language switcher. */
export const localeNames: Record<Locale, string> = {
  en: "English",
  zh: "中文",
};

/** BCP-47 tags for the <html lang> attribute. */
export const localeHtmlLang: Record<Locale, string> = {
  en: "en",
  zh: "zh-CN",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** Coerce an arbitrary string to a known locale, falling back to the default. */
export function resolveLocale(value: string | undefined): Locale {
  return value && isLocale(value) ? value : defaultLocale;
}

/** Prefix a locale-relative path ("/docs/") with the locale ("/en/docs/"). */
export function localePath(lang: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `/${lang}${clean === "/" ? "/" : clean}`;
}
