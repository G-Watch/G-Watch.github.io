import type { ReactNode } from "react";

/**
 * Renders article body as a styled `prose` block. Two modes:
 * - `html`     — pre-generated HTML string from a `.md` file (injected directly;
 *   the HTML is built at build time from trusted, first-party Markdown).
 * - `children` — a React node from a rendered `.mdx` file (custom components).
 */
export function Prose({
  html,
  children,
}: {
  html?: string;
  children?: ReactNode;
}) {
  if (html !== undefined) {
    return (
      <div
        className="prose prose-goodoc"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return <div className="prose prose-goodoc">{children}</div>;
}
