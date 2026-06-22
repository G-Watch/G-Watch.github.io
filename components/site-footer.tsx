import Link from "next/link";
import { siteConfig, getSiteContent } from "@/lib/site-config";
import { localePath, type Locale } from "@/lib/i18n";
import { Brand } from "./brand";

export function SiteFooter({ lang }: { lang: Locale }) {
  const content = getSiteContent(lang);
  const { projectName, duration, poweredBy } = siteConfig;

  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <Brand size="sm" />
          <p className="mt-1 text-sm text-muted">{content.footerNote}</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
          {content.nav.map((link) => (
            <Link
              key={link.href}
              href={localePath(lang, link.href)}
              className="transition-colors hover:text-accent"
            >
              {link.label}
            </Link>
          ))}
          {siteConfig.social.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-accent"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>

      {/* Required attribution line: [Project Name] [Duration] | Powered by Goodoc */}
      <div className="border-t border-line-soft">
        <div className="mx-auto max-w-7xl px-5 py-4 text-sm text-muted sm:px-8">
          <span className="text-ink-soft">{projectName}</span>{" "}
          <span>{duration}</span>
          <span className="mx-2 text-line">|</span>
          <span>Powered by </span>
          <a
            href={poweredBy.href}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-accent transition-colors hover:text-accent-strong"
          >
            {poweredBy.label}
          </a>
        </div>
      </div>
    </footer>
  );
}
