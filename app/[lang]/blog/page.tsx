import Link from "next/link";
import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { getAllBlogPosts } from "@/lib/content";
import { getDictionary } from "@/lib/dictionaries";
import { resolveLocale, localePath } from "@/lib/i18n";
import { formatDate } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const lang = resolveLocale((await params).lang);
  return { title: getDictionary(lang).blogIndex.title };
}

export default async function BlogIndexPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const lang = resolveLocale((await params).lang);
  const posts = getAllBlogPosts(lang);
  const t = getDictionary(lang).blogIndex;

  return (
    <SiteShell lang={lang}>
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
        <header className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
            {t.eyebrow}
          </p>
          <h1 className="mt-3 font-serif text-5xl font-bold text-ink">
            {t.title}
          </h1>
          <p className="mt-4 leading-relaxed text-ink-soft">{t.intro}</p>
        </header>

        <div className="mt-14 space-y-10">
          {posts.length === 0 && (
            <p className="text-center text-muted">{t.empty}</p>
          )}
          {posts.map((post) => (
            <article
              key={post.slugPath}
              className="border-b border-line pb-10 last:border-0"
            >
              {post.date && (
                <p className="font-mono text-xs text-muted">
                  {formatDate(post.date, lang)}
                </p>
              )}
              <h2 className="mt-2 font-serif text-2xl font-bold text-ink">
                <Link
                  href={localePath(lang, `/blog/humanize/${post.slugPath}/`)}
                  className="transition-colors hover:text-accent"
                >
                  {post.title}
                </Link>
              </h2>
              {post.description && (
                <p className="mt-3 leading-relaxed text-ink-soft">
                  {post.description}
                </p>
              )}
              <div className="mt-4 flex items-center gap-4">
                <Link
                  href={localePath(lang, `/blog/humanize/${post.slugPath}/`)}
                  className="text-sm font-bold text-accent hover:text-accent-strong"
                >
                  {t.readMore}
                </Link>
                {post.tags && post.tags.length > 0 && (
                  <div className="flex gap-2">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-paper-deep px-2.5 py-0.5 text-xs text-muted"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </SiteShell>
  );
}
