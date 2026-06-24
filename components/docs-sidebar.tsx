import Link from "next/link";
import { getDocTree, type DocTreeNode } from "@/lib/content";
import { localePath, type Locale } from "@/lib/i18n";

/** Render one level of the docs tree; recurses into nested folders. */
function TreeLevel({
  nodes,
  lang,
  activeSlug,
  depth,
}: {
  nodes: DocTreeNode[];
  lang: Locale;
  activeSlug?: string;
  depth: number;
}) {
  return (
    <ul className={depth === 0 ? "space-y-0.5" : "space-y-0.5 border-l border-line pl-3"}>
      {nodes.map((node, i) => {
        if (node.type === "folder") {
          const heading = node.slugPath ? (
            <Link
              href={localePath(lang, `/docs/humanize/${node.slugPath}/`)}
              className={`block font-serif text-xs font-bold tracking-wide transition-colors hover:text-ink ${
                node.slugPath === activeSlug ? "text-accent" : "text-muted"
              }`}
            >
              {node.title}
            </Link>
          ) : (
            <p className="font-serif text-xs font-bold tracking-wide text-muted">
              {node.title}
            </p>
          );
          return (
            <li
              key={`f:${node.title}:${i}`}
              className={depth === 0 ? "mb-6" : "mt-3"}
            >
              <div className="mb-1.5">{heading}</div>
              <TreeLevel
                nodes={node.children}
                lang={lang}
                activeSlug={activeSlug}
                depth={depth + 1}
              />
            </li>
          );
        }

        const active = node.slugPath === activeSlug;
        return (
          <li key={node.slugPath}>
            <Link
              href={localePath(lang, `/docs/humanize/${node.slugPath}/`)}
              className={`-ml-px block border-l-2 py-1.5 pl-4 transition-colors ${
                active
                  ? "border-accent font-bold text-accent"
                  : "border-transparent text-ink-soft hover:border-line hover:text-ink"
              }`}
            >
              {node.title}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Left navigation for the docs section — a nested tree mirroring the folders. */
export function DocsSidebar({
  lang,
  activeSlug,
}: {
  lang: Locale;
  activeSlug?: string;
}) {
  return (
    <nav className="text-sm">
      <TreeLevel
        nodes={getDocTree(lang)}
        lang={lang}
        activeSlug={activeSlug}
        depth={0}
      />
    </nav>
  );
}
