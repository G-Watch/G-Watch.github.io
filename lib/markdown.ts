import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeShiki from "@shikijs/rehype";
import rehypeStringify from "rehype-stringify";
import type { Root, Element, RootContent } from "hast";
import { basePath } from "./paths";
import type { Locale } from "./i18n";

export interface TocItem {
  id: string;
  text: string;
  depth: number;
}

export interface RenderedMarkdown {
  html: string;
  toc: TocItem[];
}

/** Shared rehype-autolink-headings config — a "#" anchor appended to headings. */
export const autolinkOptions = {
  behavior: "append" as const,
  properties: {
    className: ["heading-anchor"],
    ariaHidden: "true",
    tabIndex: -1,
  },
  content: { type: "text" as const, value: "#" },
};

/** Concatenate the text content of a hast node. */
function hastText(node: RootContent | Root): string {
  if (node.type === "text") return node.value;
  if ("children" in node && node.children) {
    return node.children.map(hastText).join("");
  }
  return "";
}

/** Collect h2/h3 headings (with ids from rehype-slug) into a table of contents.
 * Exported so the MDX pipeline (lib/mdx.tsx) can reuse the exact same logic. */
export function rehypeCollectToc(acc: TocItem[]) {
  return (tree: Root) => {
    const walk = (node: Root | RootContent) => {
      if (
        node.type === "element" &&
        /^h[23]$/.test((node as Element).tagName)
      ) {
        const el = node as Element;
        const id = el.properties?.id;
        if (typeof id === "string") {
          acc.push({
            id,
            text: hastText(el).trim(),
            depth: Number(el.tagName.slice(1)),
          });
        }
      }
      if ("children" in node && node.children) node.children.forEach(walk);
    };
    walk(tree);
  };
}

/**
 * Rewrite site-rooted ("/foo") src/href attributes authored inside Markdown so
 * they include the deploy base path and the current locale.
 *
 * - Asset URLs (a filename with an extension, e.g. "/logo.svg") get only the
 *   base path — assets are not localized.
 * - Route URLs (no file extension, e.g. "/docs/humanize/x/") get the base path
 *   AND the locale prefix, so content authors can link locale-relative.
 *
 * next/link/next/image handle their own URLs; this only touches raw Markdown.
 * Exported so the MDX pipeline (lib/mdx.tsx) can reuse it. Custom JSX elements
 * are mdxJsxElement nodes (not `element`), so their props are left untouched.
 */
export function rehypeLinkRewrite(bp: string, lang: Locale) {
  const rewrite = (url: string): string => {
    if (!url.startsWith("/") || url.startsWith("//")) return url;
    const lastSegment = url.split(/[?#]/)[0].split("/").pop() ?? "";
    const isAsset = lastSegment.includes(".");
    return isAsset ? `${bp}${url}` : `${bp}/${lang}${url}`;
  };

  return (tree: Root) => {
    const walk = (node: Root | RootContent) => {
      if (node.type === "element") {
        const props = (node as Element).properties;
        if (props) {
          for (const attr of ["src", "href"] as const) {
            const v = props[attr];
            if (typeof v === "string") props[attr] = rewrite(v);
          }
        }
      }
      if ("children" in node && node.children) node.children.forEach(walk);
    };
    walk(tree);
  };
}

/**
 * Render Markdown to HTML the way GitHub renders a README:
 * GFM (tables, task lists, strikethrough, autolinks), inline raw HTML, and
 * Shiki syntax highlighting with the light `github-light` theme.
 *
 * The same HTML feeds both the humanize and agent views — only the surrounding
 * page chrome differs.
 */
export async function renderMarkdown(
  markdown: string,
  { lang }: { lang: Locale },
): Promise<RenderedMarkdown> {
  const toc: TocItem[] = [];

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSlug)
    .use(rehypeCollectToc, toc)
    .use(rehypeAutolinkHeadings, autolinkOptions)
    .use(rehypeShiki, { theme: "github-light" })
    .use(rehypeLinkRewrite, basePath, lang)
    .use(rehypeStringify)
    .process(markdown);

  return { html: String(file), toc };
}
