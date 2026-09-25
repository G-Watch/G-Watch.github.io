import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { Prose } from "@/components/prose";
import { ViewSwitch } from "@/components/view-switch";
import { AuthorList } from "@/components/author-list";
import { getAllBlogPosts, getBlogPost, resolveAuthors } from "@/lib/content";
import { authors as authorRegistry } from "@/lib/authors";
import { renderContent } from "@/lib/render-content";
import { getDictionary } from "@/lib/dictionaries";
import { PostDate } from "@/components/post-date";
import { TitleText } from "@/components/title-text";
import { resolveLocale, localePath, type Locale } from "@/lib/i18n";

export function generateStaticParams({ params }: { params: { lang: string } }) {
  const lang = resolveLocale(params.lang);
  return getAllBlogPosts(lang).map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string[] }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  const post = getBlogPost(resolveLocale(lang), slug);
  if (!post) return {};
  return { title: post.title, description: post.description };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string[] }>;
}) {
  const resolved = await params;
  const lang: Locale = resolveLocale(resolved.lang);
  const post = getBlogPost(lang, resolved.slug);
  if (!post) notFound();

  const { html, content } = await renderContent(post, lang);
  const dict = getDictionary(lang);
  const postAuthors = resolveAuthors(post.authors, authorRegistry);

  return (
    <SiteShell lang={lang}>
      <article className="mx-auto max-w-4xl px-5 py-16 sm:px-8">
        <header className="mb-10 text-center">
          {(post.date || (post.tags && post.tags.length > 0)) && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {post.date && <PostDate iso={post.date} lang={lang} />}
              {post.tags?.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-line px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <h1 className="mt-5 font-serif text-4xl font-bold leading-tight text-ink sm:text-5xl">
            <TitleText title={post.title} highlight={post.highlight} />
          </h1>
          {post.description && (
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted">
              {post.description}
            </p>
          )}
          {postAuthors.length > 0 && (
            <div className="mt-7">
              <AuthorList authors={postAuthors} align="center" />
            </div>
          )}
          <div className="mt-6 flex justify-center">
            <ViewSwitch
              lang={lang}
              collection="blog"
              slugPath={post.slugPath}
              current="humanize"
              labels={dict.view}
            />
          </div>
        </header>

        <Prose html={html}>{content}</Prose>

        <footer className="mt-16 border-t border-line pt-8 text-center">
          <Link
            href={localePath(lang, "/blog/")}
            className="text-sm font-bold text-accent hover:text-accent-strong"
          >
            {dict.blogPost.back}
          </Link>
        </footer>
      </article>
    </SiteShell>
  );
}
