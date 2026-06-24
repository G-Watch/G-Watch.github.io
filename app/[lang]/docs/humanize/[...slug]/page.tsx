import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { DocsSidebar } from "@/components/docs-sidebar";
import { TableOfContents } from "@/components/table-of-contents";
import { Prose } from "@/components/prose";
import { ViewSwitch } from "@/components/view-switch";
import { getAllDocs, getDoc, getDocsReadingOrder } from "@/lib/content";
import { renderContent } from "@/lib/render-content";
import { getDictionary } from "@/lib/dictionaries";
import { resolveLocale, localePath, type Locale } from "@/lib/i18n";

export function generateStaticParams({
  params,
}: {
  params: { lang: string };
}) {
  const lang = resolveLocale(params.lang);
  return getAllDocs(lang).map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string[] }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  const doc = getDoc(resolveLocale(lang), slug);
  if (!doc) return {};
  return { title: doc.title, description: doc.description };
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string[] }>;
}) {
  const resolved = await params;
  const lang: Locale = resolveLocale(resolved.lang);
  const doc = getDoc(lang, resolved.slug);
  if (!doc) notFound();

  const { html, content, toc } = await renderContent(doc, lang);
  const dict = getDictionary(lang);

  const reading = getDocsReadingOrder(lang);
  const index = reading.findIndex((d) => d.slugPath === doc.slugPath);
  const prev = index > 0 ? reading[index - 1] : undefined;
  const next =
    index >= 0 && index < reading.length - 1 ? reading[index + 1] : undefined;

  return (
    <SiteShell lang={lang}>
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[220px_minmax(0,1fr)_180px]">
          <aside className="hidden lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-8">
              <DocsSidebar lang={lang} activeSlug={doc.slugPath} />
            </div>
          </aside>

          <article className="min-w-0">
            <header className="mb-8 border-b border-line pb-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {doc.group && (
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
                    {doc.group}
                  </p>
                )}
                <ViewSwitch
                  lang={lang}
                  collection="docs"
                  slugPath={doc.slugPath}
                  current="humanize"
                  labels={dict.view}
                />
              </div>
              <h1 className="mt-3 font-serif text-4xl font-bold leading-tight text-ink">
                {doc.title}
              </h1>
              {doc.description && (
                <p className="mt-3 text-lg leading-relaxed text-muted">
                  {doc.description}
                </p>
              )}
            </header>

            <Prose html={html}>{content}</Prose>

            <nav className="mt-14 grid gap-4 border-t border-line pt-8 sm:grid-cols-2">
              {prev ? (
                <Link
                  href={localePath(lang, `/docs/humanize/${prev.slugPath}/`)}
                  className="group rounded-xl border border-line bg-surface p-4 transition-colors hover:border-accent"
                >
                  <span className="text-xs text-muted">{dict.doc.prev}</span>
                  <span className="mt-1 block font-serif font-bold text-ink group-hover:text-accent">
                    {prev.title}
                  </span>
                </Link>
              ) : (
                <span />
              )}
              {next && (
                <Link
                  href={localePath(lang, `/docs/humanize/${next.slugPath}/`)}
                  className="group rounded-xl border border-line bg-surface p-4 text-right transition-colors hover:border-accent"
                >
                  <span className="text-xs text-muted">{dict.doc.next}</span>
                  <span className="mt-1 block font-serif font-bold text-ink group-hover:text-accent">
                    {next.title}
                  </span>
                </Link>
              )}
            </nav>
          </article>

          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <TableOfContents items={toc} title={dict.toc.title} />
            </div>
          </aside>
        </div>
      </div>
    </SiteShell>
  );
}
