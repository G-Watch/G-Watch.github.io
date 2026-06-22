import Link from "next/link";
import type { Collection } from "@/lib/content";
import { localePath, type Locale } from "@/lib/i18n";

/**
 * Minimal, chrome-free shell for the agent view: a thin banner plus the raw
 * semantic HTML of the document. Optimized for machine readers — no sidebar,
 * no table of contents, monospace body, everything inlined as HTML.
 */
export function AgentShell({
  lang,
  collection,
  slugPath,
  title,
  html,
  strings,
}: {
  lang: Locale;
  collection: Collection;
  slugPath: string;
  title: string;
  html: string;
  strings: { banner: string; toHumanize: string };
}) {
  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-neutral-200 bg-neutral-50 px-5 py-2 font-mono text-xs text-neutral-500">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <span>{strings.banner}</span>
          <Link
            href={localePath(lang, `/${collection}/humanize/${slugPath}/`)}
            className="underline hover:text-neutral-800"
          >
            {strings.toHumanize}
          </Link>
        </div>
      </div>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <article
          className="agent-doc"
          data-doc-title={title}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </main>
    </div>
  );
}
