import type { Author } from "@/lib/content";
import { withBasePath } from "@/lib/paths";

/**
 * A row of blog authors. Full mode (default) shows avatar, name (optionally
 * linked), and an affiliation · email line — for under a post's title. Compact
 * mode shows just a small avatar and name — for list/card bylines.
 */
export function AuthorList({
  authors,
  align = "center",
  compact = false,
}: {
  authors: Author[];
  align?: "center" | "left";
  compact?: boolean;
}) {
  if (authors.length === 0) return null;

  if (compact) {
    return (
      <div
        className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${
          align === "center" ? "justify-center" : ""
        }`}
      >
        {authors.map((author) => (
          <span
            key={`${author.name}-${author.email ?? ""}`}
            className="flex items-center gap-1.5 text-xs text-muted"
          >
            {author.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={withBasePath(author.avatar)}
                alt=""
                className="h-5 w-5 flex-none rounded-full border border-line object-cover"
              />
            ) : (
              <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent-soft text-[0.6rem] font-bold text-accent-strong">
                {author.name.charAt(0)}
              </span>
            )}
            {author.name}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap gap-x-7 gap-y-3 ${
        align === "center" ? "justify-center" : ""
      }`}
    >
      {authors.map((author) => (
        <div key={`${author.name}-${author.email ?? ""}`} className="flex items-center gap-2.5">
          {author.avatar ? (
            // Plain <img>: the static export has no next/image optimizer.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={withBasePath(author.avatar)}
              alt=""
              className="h-9 w-9 flex-none rounded-full border border-line object-cover"
            />
          ) : (
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-accent-soft font-serif text-sm font-bold text-accent-strong">
              {author.name.charAt(0)}
            </span>
          )}
          <div className="text-left leading-tight">
            <p className="text-sm font-bold text-ink">
              {author.url ? (
                <a
                  href={author.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-accent"
                >
                  {author.name}
                </a>
              ) : (
                author.name
              )}
            </p>
            {(author.affiliation || author.email) && (
              <p className="text-xs text-muted">
                {author.affiliation}
                {author.affiliation && author.email && " · "}
                {author.email && (
                  <a
                    href={`mailto:${author.email}`}
                    className="transition-colors hover:text-accent"
                  >
                    {author.email}
                  </a>
                )}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
