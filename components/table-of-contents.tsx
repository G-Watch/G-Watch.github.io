"use client";

import { useEffect, useState } from "react";
import type { TocItem } from "@/lib/markdown";

/** Right-rail table of contents with scroll-spy highlighting. */
/**
 * Section numbers for h2/h3 entries: "1", "1.1", ... The same rule the
 * .docs-numbered CSS counters apply to the headings, so the two agree.
 */
function sectionNumbers(items: TocItem[]): string[] {
  let h2 = 0;
  let h3 = 0;
  return items.map((item) => {
    if (item.depth === 2) {
      h2 += 1;
      h3 = 0;
      return `${h2}`;
    }
    h3 += 1;
    return `${h2}.${h3}`;
  });
}

export function TableOfContents({
  items,
  title,
  numbered = false,
}: {
  items: TocItem[];
  title: string;
  /** Prefix each entry with its section number. */
  numbered?: boolean;
}) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (items.length === 0) return;
    const headings = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "0px 0px -70% 0px", threshold: 1.0 },
    );

    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;
  const numbers = numbered ? sectionNumbers(items) : null;

  return (
    <nav className="text-sm">
      <p className="mb-3 font-serif text-xs font-boldr text-muted">
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li
            key={item.id}
            style={{ paddingLeft: item.depth === 3 ? "0.85rem" : 0 }}
          >
            <a
              href={`#${item.id}`}
              className={`block leading-snug transition-colors ${
                activeId === item.id
                  ? "text-accent"
                  : "text-muted hover:text-ink"
              }`}
            >
              {numbers && (
                <span className="mr-1.5 tabular-nums text-muted/70">
                  {numbers[i]}
                </span>
              )}
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
