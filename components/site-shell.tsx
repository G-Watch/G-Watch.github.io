import type { Locale } from "@/lib/i18n";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

/** Standard page chrome: sticky header, content, footer. */
export function SiteShell({
  lang,
  children,
  fullHeight = false,
}: {
  lang: Locale;
  children: React.ReactNode;
  /**
   * Pins the page to exactly one viewport: nothing scrolls but the content
   * regions the page itself marks as scrollable, and the footer always sits at
   * the bottom edge. For app-like pages; ordinary documents leave it off.
   */
  fullHeight?: boolean;
}) {
  return (
    <div
      className={
        fullHeight
          ? "flex h-screen flex-col overflow-hidden [&_footer]:mt-0"
          : "flex min-h-screen flex-col"
      }
    >
      <SiteHeader lang={lang} />
      <main className={fullHeight ? "min-h-0 flex-1" : "flex-1"}>
        {children}
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
