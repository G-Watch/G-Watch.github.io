"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { siteConfig, getSiteContent } from "@/lib/site-config";
import { navIcons } from "@/lib/nav-icons";
import { localePath, type Locale } from "@/lib/i18n";
import { withBasePath } from "@/lib/paths";
import { LanguageSwitcher } from "./language-switcher";
import { Brand } from "./brand";

function isActive(pathname: string, href: string): boolean {
  const section = href.replace(/\/$/, "");
  return pathname === section || pathname.startsWith(`${section}/`);
}

export function SiteHeader({ lang }: { lang: Locale }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = getSiteContent(lang).nav;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link
          href={localePath(lang, "/")}
          aria-label={siteConfig.name}
          className="inline-flex items-center gap-4"
        >
          <Brand size="lg" />
          {lang === "zh" && (
            // Chinese wordmark, shown only in the zh locale.
            // Plain <img>: the static export has no next/image optimizer.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={withBasePath("/media/jiheng.png")}
              alt="玑衡"
              className="h-8 w-auto"
            />
          )}
        </Link>

        <nav className="hidden items-center gap-8 sm:flex">
          {nav.map((link) => {
            const href = localePath(lang, link.href);
            return (
              <Link
                key={link.href}
                href={href}
                className={`inline-flex items-center gap-1.5 text-sm transition-colors hover:text-accent ${
                  isActive(pathname, href)
                    ? "font-bold text-accent-strong"
                    : "text-ink-soft"
                }`}
              >
                {link.icon && navIcons[link.icon]}
                {link.label}
              </Link>
            );
          })}
          {siteConfig.social.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-muted transition-colors hover:text-accent"
            >
              {link.label}
            </a>
          ))}
          <LanguageSwitcher current={lang} />
        </nav>

        <button
          type="button"
          aria-label="menu"
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-line text-ink-soft sm:hidden"
        >
          <span className="text-lg leading-none">{open ? "✕" : "≡"}</span>
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-line px-5 py-3 sm:hidden">
          {nav.map((link) => (
            <Link
              key={link.href}
              href={localePath(lang, link.href)}
              onClick={() => setOpen(false)}
              className="flex items-center gap-1.5 rounded-md px-2 py-2 text-sm text-ink-soft hover:bg-paper-deep"
            >
              {link.icon && navIcons[link.icon]}
              {link.label}
            </Link>
          ))}
          {siteConfig.social.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="rounded-md px-2 py-2 text-sm text-ink-soft hover:bg-paper-deep"
            >
              {link.label}
            </a>
          ))}
          <div className="px-2 py-2">
            <LanguageSwitcher current={lang} />
          </div>
        </nav>
      )}
    </header>
  );
}
