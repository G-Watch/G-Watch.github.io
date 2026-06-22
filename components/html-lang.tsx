"use client";

import { useEffect } from "react";

/**
 * Keeps <html lang> in sync with the current locale. The root layout renders a
 * static default; this updates it on the client for locales that differ, which
 * is enough for a static export (the visible content is already localized).
 */
export function HtmlLang({ lang }: { lang: string }) {
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return null;
}
