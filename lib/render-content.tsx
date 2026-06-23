import type { ReactNode } from "react";
import type { ContentItem } from "./content";
import { renderMarkdown, type TocItem } from "./markdown";
import { renderMdx } from "./mdx";
import type { Locale } from "./i18n";

/**
 * One rendered document. `.md` files produce an HTML string (fast path, injected
 * with dangerouslySetInnerHTML); `.mdx` files produce a React node so custom
 * components can render live. Exactly one of `html` / `content` is set.
 */
export interface RenderedContent {
  toc: TocItem[];
  html?: string;
  content?: ReactNode;
}

export async function renderContent(
  item: ContentItem,
  lang: Locale,
): Promise<RenderedContent> {
  if (item.format === "mdx") {
    const { content, toc } = await renderMdx(item.body, { lang });
    return { toc, content };
  }
  const { html, toc } = await renderMarkdown(item.body, { lang });
  return { toc, html };
}
