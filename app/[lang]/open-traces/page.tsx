import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { OpenTracesBrowser } from "@/components/open-traces-browser";
import { getOpenTracesCopy, getTraceCatalog } from "@/lib/open-traces";
import { localePath, resolveLocale } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const lang = resolveLocale((await params).lang);
  return { title: getOpenTracesCopy(lang).title };
}

export default async function OpenTracesIndexPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const lang = resolveLocale((await params).lang);
  const t = getOpenTracesCopy(lang);

  return (
    <SiteShell lang={lang} fullHeight>
      {/* Full-bleed working surface filling the shell: nothing here scrolls
          except each column's own region, so header and footer stay put. */}
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden px-5 pb-4 pt-4 sm:px-8">
        <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line pb-3 text-xs text-muted">
          <span>
            {t.source.lead}
            <span className="font-bold text-ink-soft">{t.source.product}</span>
            {t.source.tail}
          </span>
          <Link
            href={localePath(lang, t.source.link.href)}
            className="inline-flex items-center gap-1.5 text-ink-soft transition-colors hover:text-accent"
          >
            {/* Material Symbols "open_in_new" (Apache-2.0), inlined. */}
            <svg
              viewBox="0 -960 960 960"
              fill="currentColor"
              aria-hidden="true"
              className="h-[1.05em] w-[1.05em] shrink-0"
            >
              <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h560v-280h80v280q0 33-23.5 56.5T760-120H200Zm188-212-56-56 372-372H560v-80h280v280h-80v-144L388-332Z" />
            </svg>
            <span className="underline underline-offset-2">
              {t.source.link.label}
            </span>
          </Link>
        </p>
        {/* The browser reads its selection from the query string. */}
        <Suspense fallback={null}>
          <OpenTracesBrowser lang={lang} records={getTraceCatalog()} />
        </Suspense>
      </div>
    </SiteShell>
  );
}
