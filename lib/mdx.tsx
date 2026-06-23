import { compile, run } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeShiki from "@shikijs/rehype";
import type { ReactNode } from "react";
import {
  rehypeCollectToc,
  rehypeLinkRewrite,
  autolinkOptions,
  type TocItem,
} from "./markdown";
import { mdxComponents } from "./mdx-components";
import { basePath } from "./paths";
import type { Locale } from "./i18n";

export interface RenderedMdx {
  content: ReactNode;
  toc: TocItem[];
}

/**
 * Render an `.mdx` document to a React node, reusing the same plugins as the
 * Markdown pipeline (GFM, heading slugs + anchors, table of contents, Shiki
 * highlighting, locale/base-path link rewriting). Custom components written as
 * JSX in the content resolve against `mdxComponents` (lib/mdx-components.tsx) —
 * no per-file imports needed.
 *
 * Compilation/eval happens at build time (the site is a static export), so the
 * `run()` call never reaches the browser; interactive client components in the
 * registry hydrate normally.
 */
export async function renderMdx(
  source: string,
  { lang }: { lang: Locale },
): Promise<RenderedMdx> {
  const toc: TocItem[] = [];

  const compiled = await compile(source, {
    outputFormat: "function-body",
    development: false,
    remarkPlugins: [remarkGfm],
    rehypePlugins: [
      rehypeSlug,
      [rehypeCollectToc, toc],
      [rehypeAutolinkHeadings, autolinkOptions],
      [rehypeShiki, { theme: "github-light" }],
      [rehypeLinkRewrite, basePath, lang],
    ],
  });

  const { default: MDXContent } = await run(String(compiled), {
    ...runtime,
    baseUrl: import.meta.url,
  });

  return {
    content: <MDXContent components={mdxComponents} />,
    toc,
  };
}
