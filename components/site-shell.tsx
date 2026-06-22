import type { Locale } from "@/lib/i18n";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

/** Standard page chrome: sticky header, content, footer. */
export function SiteShell({
  lang,
  children,
}: {
  lang: Locale;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader lang={lang} />
      <main className="flex-1">{children}</main>
      <SiteFooter lang={lang} />
    </div>
  );
}
