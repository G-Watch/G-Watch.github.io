import { localeHtmlLang, type Locale } from "./i18n";

/** Format an ISO date string for display in the given locale. */
export function formatDate(iso: string, lang: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(localeHtmlLang[lang], {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}
