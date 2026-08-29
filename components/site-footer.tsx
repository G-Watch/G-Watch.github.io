import Link from "next/link";
import { siteConfig, getSiteContent } from "@/lib/site-config";
import { localePath, type Locale } from "@/lib/i18n";
import { Brand } from "./brand";

export function SiteFooter({ lang }: { lang: Locale }) {
  const content = getSiteContent(lang);
  const { projectName, duration } = siteConfig;

  return (
    <footer className="mt-12 border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-8">
        <div>
          <Brand size="sm" />
          <p className="mt-1 text-sm text-muted">{content.footerNote}</p>
          {content.footerAttribution && (
            <p className="mt-1 text-sm text-muted">
              {content.footerAttribution.prefix}
              {content.footerAttribution.link &&
                (/^https?:\/\//.test(content.footerAttribution.link.href) ? (
                  <a
                    href={content.footerAttribution.link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted underline underline-offset-2 transition-colors hover:text-ink-soft"
                  >
                    {content.footerAttribution.link.label}
                  </a>
                ) : (
                  <Link
                    href={localePath(lang, content.footerAttribution.link.href)}
                    className="text-muted underline underline-offset-2 transition-colors hover:text-ink-soft"
                  >
                    {content.footerAttribution.link.label}
                  </Link>
                ))}
              {content.footerAttribution.suffix}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
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
          <p className="text-sm text-muted">
            <span className="text-ink-soft">{projectName}</span>{" "}
            <span>{duration}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
