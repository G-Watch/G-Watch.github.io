import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";

/**
 * Markdown with LaTeX, rendered at build time.
 *
 * USER-OWNED: this file is not listed in goodoc.manifest.json, so
 * `npm run upgrade` never touches it.
 *
 * Distinct from lib/markdown.ts (the site's content pipeline) on two counts:
 * it adds `$…$` / `$$…$$` math, and it leaves Shiki out — these documents are
 * prose and formulas, not code.
 *
 * KaTeX emits **MathML**, not its usual HTML+CSS. Browsers render MathML
 * natively, so nothing has to ship katex.min.css or its woff2 fonts, and the
 * whole pipeline stays a build-time dependency that never reaches the client.
 *
 * Input is first-party (lib/calculator-doc.ts), which is what makes the result
 * safe to hand to `<Prose html>`.
 */
export async function renderMathMarkdown(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex, { output: "mathml" })
    .use(rehypeStringify)
    .process(markdown);

  return String(file);
}
