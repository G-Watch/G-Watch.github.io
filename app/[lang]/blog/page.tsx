import Link from "next/link";
import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { AuthorList } from "@/components/author-list";
import { getAllBlogPosts, resolveAuthors } from "@/lib/content";
import { authors as authorRegistry } from "@/lib/authors";
import { getDictionary } from "@/lib/dictionaries";
import { resolveLocale, localePath } from "@/lib/i18n";
import { PostDate } from "@/components/post-date";
import { TitleText } from "@/components/title-text";

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
      <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8">
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
              className="flex gap-6 border-b border-line pb-10 last:border-0 sm:gap-8"
            >
              {post.date && (
                <div className="hidden flex-none pt-1 sm:block">
                  <PostDate iso={post.date} lang={lang} stacked />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {post.date && (
                  <div className="mb-3 sm:hidden">
                    <PostDate iso={post.date} lang={lang} />
                  </div>
                )}
                <h2 className="font-serif text-2xl font-bold text-ink">
                  <Link
                    href={localePath(lang, `/blog/humanize/${post.slugPath}/`)}
                    className="transition-colors hover:text-accent"
                  >
                    <TitleText title={post.title} highlight={post.highlight} />
                  </Link>
                </h2>
                {post.description && (
                  <p className="mt-3 leading-relaxed text-ink-soft">
                    {post.description}
                  </p>
                )}
                {(() => {
                  const a = resolveAuthors(post.authors, authorRegistry);
                  return a.length > 0 ? (
                    <div className="mt-4">
                      <AuthorList authors={a} align="left" compact />
                    </div>
                  ) : null;
                })()}
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
              </div>
            </article>
          ))}
        </div>
      </div>
    </SiteShell>
  );
}
