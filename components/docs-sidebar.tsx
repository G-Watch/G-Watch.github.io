import Link from "next/link";
import { getDocsNav } from "@/lib/content";
import { localePath, type Locale } from "@/lib/i18n";

/** Left navigation for the docs section, grouped by frontmatter `group`. */
export function DocsSidebar({
  lang,
  activeSlug,
}: {
  lang: Locale;
  activeSlug?: string;
}) {
  const groups = getDocsNav(lang);

  return (
    <nav className="text-sm">
      {groups.map((group) => (
        <div key={group.group} className="mb-7">
          <p className="mb-2 font-serif text-xs font-bold uppercase tracking-wider text-muted">
            {group.group}
          </p>
          <ul className="space-y-0.5 border-l border-line">
            {group.items.map((item) => {
              const active = item.slugPath === activeSlug;
              return (
                <li key={item.slugPath}>
                  <Link
                    href={localePath(lang, `/docs/humanize/${item.slugPath}/`)}
                    className={`-ml-px block border-l-2 py-1.5 pl-4 transition-colors ${
                      active
                        ? "border-accent font-bold text-accent"
                        : "border-transparent text-ink-soft hover:border-line hover:text-ink"
                    }`}
                  >
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
