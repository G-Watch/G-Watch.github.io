"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { defaultLocale, locales, localeNames } from "@/lib/i18n";

/**
 * The root path ("/") has no locale, so we forward to the default locale.
 * Static-export friendly: a client redirect plus visible links as a no-JS
 * fallback.
 */
export function RootRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/${defaultLocale}/`);
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="font-serif text-2xl font-bold text-ink">goodoc</p>
      <p className="text-muted">Choose a language · 选择语言</p>
      <div className="flex gap-4">
        {locales.map((lang) => (
          <Link
            key={lang}
            href={`/${lang}/`}
            className="rounded-full border border-line bg-surface px-5 py-2 text-sm font-bold text-ink-soft transition-colors hover:border-accent hover:text-accent"
          >
            {localeNames[lang]}
          </Link>
        ))}
      </div>
    </div>
  );
}
