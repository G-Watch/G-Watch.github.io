"use client";

import { useEffect, useState } from "react";
import type { TocItem } from "@/lib/markdown";

/** Right-rail table of contents with scroll-spy highlighting. */
export function TableOfContents({
  items,
  title,
}: {
  items: TocItem[];
  title: string;
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

  return (
    <nav className="text-sm">
      <p className="mb-3 font-serif text-xs font-bold uppercase tracking-wider text-muted">
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((item) => (
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
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
