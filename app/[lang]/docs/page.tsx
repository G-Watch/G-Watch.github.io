import Link from "next/link";
import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { DocsSidebar } from "@/components/docs-sidebar";
import { getDocsNav } from "@/lib/content";
import { getDictionary } from "@/lib/dictionaries";
import { resolveLocale, localePath } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const lang = resolveLocale((await params).lang);
  return { title: getDictionary(lang).docsIndex.title };
}

export default async function DocsIndexPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const lang = resolveLocale((await params).lang);
  const groups = getDocsNav(lang);
  const t = getDictionary(lang).docsIndex;

  return (
    <SiteShell lang={lang}>
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <DocsSidebar lang={lang} />
            </div>
          </aside>

          <div>
            <header className="border-b border-line pb-6">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
                {t.eyebrow}
              </p>
              <h1 className="mt-2 font-serif text-4xl font-bold text-ink">
                {t.title}
              </h1>
              <p className="mt-3 max-w-2xl leading-relaxed text-ink-soft">
                {t.intro}
              </p>
            </header>

            <div className="mt-8 space-y-10">
              {groups.map((group) => (
                <section key={group.group}>
                  <h2 className="font-serif text-sm font-bold uppercase tracking-wider text-muted">
                    {group.group}
                  </h2>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {group.items.map((item) => (
                      <Link
                        key={item.slugPath}
                        href={localePath(
                          lang,
                          `/docs/humanize/${item.slugPath}/`,
                        )}
                        className="group rounded-xl border border-line bg-surface p-5 transition-colors hover:border-accent"
                      >
                        <h3 className="font-serif text-lg font-bold text-ink group-hover:text-accent">
                          {item.title}
                        </h3>
                        {item.description && (
                          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                            {item.description}
                          </p>
                        )}
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
