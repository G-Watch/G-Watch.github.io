"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import {
  locales,
  localeNames,
  isLocale,
  type Locale,
} from "@/lib/i18n";

/** Build the equivalent path in another locale by swapping the first segment. */
function swapLocale(pathname: string, target: Locale): string {
  const segments = pathname.split("/");
  // segments[0] === "" (leading slash); segments[1] is the locale, if any.
  if (segments[1] && isLocale(segments[1])) {
    segments[1] = target;
    return segments.join("/") || "/";
  }
  return `/${target}/`;
}

export function LanguageSwitcher({ current }: { current: Locale }) {
  const pathname = usePathname();
  const router = useRouter();

  /**
   * Switch locale without disturbing anything else: the query string carries
   * view state (open-traces selection, install-wizard platform), the hash
   * carries the reading position, and the scroll offset stays put. Both are
   * read from the live address at click time — open-traces rewrites the query
   * in place on every selection, which the router's own params never see.
   */
  function switchLocale(event: MouseEvent<HTMLAnchorElement>, target: Locale) {
    const opensElsewhere =
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey;
    if (event.defaultPrevented || opensElsewhere) return;
    event.preventDefault();
    const { search, hash } = window.location;
    router.push(`${swapLocale(pathname, target)}${search}${hash}`, {
      scroll: false,
    });
  }

  return (
    <div className="flex items-center gap-1 text-sm">
      {locales.map((lang, i) => (
        <span key={lang} className="flex items-center gap-1">
          {i > 0 && <span className="text-line">·</span>}
          <Link
            href={swapLocale(pathname, lang)}
            onClick={(event) => switchLocale(event, lang)}
            aria-current={lang === current ? "true" : undefined}
            className={
              lang === current
                ? "font-bold text-accent"
                : "text-muted transition-colors hover:text-accent"
            }
          >
            {localeNames[lang]}
          </Link>
        </span>
      ))}
    </div>
  );
}
