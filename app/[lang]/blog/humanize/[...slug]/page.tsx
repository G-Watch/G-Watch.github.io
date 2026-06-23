import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { Prose } from "@/components/prose";
import { ViewSwitch } from "@/components/view-switch";
import { getAllBlogPosts, getBlogPost } from "@/lib/content";
import { renderContent } from "@/lib/render-content";
import { getDictionary } from "@/lib/dictionaries";
import { formatDate } from "@/lib/format";
import { resolveLocale, localePath, type Locale } from "@/lib/i18n";

export function generateStaticParams({
  params,
}: {
  params: { lang: string };
}) {
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

  return (
    <SiteShell lang={lang}>
      <article className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
        <header className="mb-10 text-center">
          {post.date && (
            <p className="font-mono text-xs text-muted">
              {formatDate(post.date, lang)}
            </p>
          )}
          <h1 className="mt-3 font-serif text-4xl font-bold leading-tight text-ink sm:text-5xl">
            {post.title}
          </h1>
          {post.description && (
            <p className="mt-4 text-lg leading-relaxed text-muted">
              {post.description}
            </p>
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
