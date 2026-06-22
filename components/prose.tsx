/**
 * Renders pre-generated HTML (from lib/markdown) as a styled article.
 * The HTML is produced at build time from trusted, first-party Markdown in
 * this repo, so dangerouslySetInnerHTML is appropriate here.
 */
export function Prose({ html }: { html: string }) {
  return (
    <div
      className="prose prose-goodoc"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
