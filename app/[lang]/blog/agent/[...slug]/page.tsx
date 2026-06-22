import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AgentShell } from "@/components/agent-shell";
import { getAllBlogPosts, getBlogPost } from "@/lib/content";
import { renderMarkdown } from "@/lib/markdown";
import { getDictionary } from "@/lib/dictionaries";
import { resolveLocale, type Locale } from "@/lib/i18n";

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
  return { title: `${post.title} (agent)`, description: post.description };
}

export default async function BlogAgentPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string[] }>;
}) {
  const resolved = await params;
  const lang: Locale = resolveLocale(resolved.lang);
  const post = getBlogPost(lang, resolved.slug);
  if (!post) notFound();

  const { html } = await renderMarkdown(post.body, { lang });

  return (
    <AgentShell
      lang={lang}
      collection="blog"
      slugPath={post.slugPath}
      title={post.title}
      html={`<h1>${post.title}</h1>\n${html}`}
      strings={getDictionary(lang).agent}
    />
  );
}
