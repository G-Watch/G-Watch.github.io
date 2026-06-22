import Link from "next/link";
import type { Collection } from "@/lib/content";
import { localePath, type Locale } from "@/lib/i18n";

/**
 * Toggle between the humanize (human-friendly) and agent (machine-friendly)
 * renderings of the same document. The two views live at parallel URLs:
 *   /<lang>/<collection>/humanize/<slug>  and  /<lang>/<collection>/agent/<slug>
 */
export function ViewSwitch({
  lang,
  collection,
  slugPath,
  current,
  labels,
}: {
  lang: Locale;
  collection: Collection;
  slugPath: string;
  current: "humanize" | "agent";
  labels: { humanize: string; agent: string };
}) {
  const tabs = [
    {
      key: "humanize" as const,
      label: labels.humanize,
      href: localePath(lang, `/${collection}/humanize/${slugPath}/`),
    },
    {
      key: "agent" as const,
      label: labels.agent,
      href: localePath(lang, `/${collection}/agent/${slugPath}/`),
    },
  ];

  return (
    <div className="inline-flex rounded-full border border-line bg-surface p-0.5 text-xs font-bold">
      {tabs.map((tab) => {
        const active = tab.key === current;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`rounded-full px-3 py-1 transition-colors ${
              active ? "bg-accent text-paper" : "text-muted hover:text-accent"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
