import type { Locale } from "./i18n";

/**
 * Where the calculator's numbers come from — the methodology document behind
 * the button beside the Model heading.
 *
 * USER-OWNED: this file is not listed in goodoc.manifest.json, so
 * `npm run upgrade` never touches it.
 *
 * Markdown with LaTeX. It is rendered at build time by lib/markdown-math.ts,
 * so writing here costs nothing at runtime: `$…$` inline, `$$…$$` for a block,
 * and GFM tables, headings and lists as usual.
 *
 *     Activated parameters, per token:
 *
 *     $$
 *     P_{\text{act}} = P_{\text{total}}
 *       - P_{\text{expert}}\left(1 - \frac{k}{E}\right)
 *     $$
 *
 * Empty for now — one entry per locale, keyed the same way the rest of the
 * site's copy is.
 */
export const calculatorDoc: Record<Locale, string> = {
  en: "",
  zh: "",
};

export function getCalculatorDoc(lang: Locale): string {
  return calculatorDoc[lang];
}
