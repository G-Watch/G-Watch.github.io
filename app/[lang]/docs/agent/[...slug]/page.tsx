import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AgentShell } from "@/components/agent-shell";
import { getAllDocs, getDoc } from "@/lib/content";
import { renderContent } from "@/lib/render-content";
import { getDictionary } from "@/lib/dictionaries";
import { resolveLocale, type Locale } from "@/lib/i18n";

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
  return { title: `${doc.title} (agent)`, description: doc.description };
}

export default async function DocAgentPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string[] }>;
}) {
  const resolved = await params;
  const lang: Locale = resolveLocale(resolved.lang);
  const doc = getDoc(lang, resolved.slug);
  if (!doc) notFound();

  const { html, content } = await renderContent(doc, lang);

  return (
    <AgentShell
      lang={lang}
      collection="docs"
      slugPath={doc.slugPath}
      title={doc.title}
      html={html !== undefined ? `<h1>${doc.title}</h1>\n${html}` : undefined}
      strings={getDictionary(lang).agent}
    >
      {content}
    </AgentShell>
  );
}
