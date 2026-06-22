"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

  return (
    <div className="flex items-center gap-1 text-sm">
      {locales.map((lang, i) => (
        <span key={lang} className="flex items-center gap-1">
          {i > 0 && <span className="text-line">·</span>}
          <Link
            href={swapLocale(pathname, lang)}
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
