// User-owned hero showcase component.
//
// The news feed in the hero's right-hand column: a card with a live header and
// dated entries, newest on top. Entries live in lib/news.ts. Registered as
// the "news" / "newsZh" slots in lib/hero-slots.tsx.
//
// A row is a link when it has an `href`; an entry with `links` instead carries
// a line of icon links under its title. Static (no hooks) → server component.
import Link from "next/link";
import type { ReactNode } from "react";
import { localeHtmlLang, localePath, type Locale } from "@/lib/i18n";
import { withBasePath } from "@/lib/paths";
import { news, NEWS_LIMIT, type NewsItem, type NewsLinkIcon } from "@/lib/news";

const COPY: Record<Locale, { heading: string }> = {
  en: { heading: "Recent Updates" },
  zh: { heading: "最近更新" },
};

/** Stroke icons for an entry's links, drawn in the text colour. */
const icon = (children: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="h-[1.05em] w-[1.05em] shrink-0"
  >
    {children}
  </svg>
);

const LINK_ICONS: Record<NewsLinkIcon, ReactNode> = {
  // an open book
  docs: icon(
    <>
      <path d="M3 5.5c2.8-1.2 5.8-1 9 1 3.2-2 6.2-2.2 9-1v13c-2.8-1.2-5.8-1-9 1-3.2-2-6.2-2.2-9-1z" />
      <path d="M12 6.5v13" />
    </>,
  ),
  // a page of writing
  blog: icon(
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="2" />
      <path d="M8 8.5h8M8 12h8M8 15.5h5" />
    </>,
  ),
  // a paper with a folded corner
  paper: icon(
    <>
      <path d="M6 2.5h8l4.5 4.5v14.5H6z" />
      <path d="M14 2.5V7h4.5M9 12h6M9 15.5h6" />
    </>,
  ),
};

function day(iso: string, lang: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(localeHtmlLang[lang], {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function RowLink({
  href,
  lang,
  className,
  children,
}: {
  href?: string;
  lang: Locale;
  className: string;
  children: ReactNode;
}) {
  if (!href) return <div className={className}>{children}</div>;
  if (href.startsWith("http")) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={localePath(lang, href)} className={className}>
      {children}
    </Link>
  );
}

function NewsRow({ item, lang }: { item: NewsItem; lang: Locale }) {
  return (
    <li>
      <RowLink
        href={item.href}
        lang={lang}
        className={`group grid grid-cols-[4.25rem_minmax(0,1fr)] rounded-xl px-2 transition-colors ${
          item.href ? "hover:bg-paper-deep" : ""
        }`}
      >
        {/* Date */}
        <time
          dateTime={item.date}
          className="pt-4 text-xs tabular-nums text-muted"
        >
          {day(item.date, lang)}
        </time>

        {/* Body */}
        <div className="min-w-0 py-3 pl-2 pr-1">
          <p className="flex items-baseline gap-2 text-base font-bold leading-snug text-ink">
            <span
              className={`min-w-0 truncate decoration-line underline-offset-4 ${
                item.href ? "group-hover:underline" : ""
              }`}
            >
              {item.title}
            </span>
            {item.href && (
              <span
                aria-hidden
                className="flex-none -translate-x-1 text-sm text-muted opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
              >
                {item.href.startsWith("http") ? "↗" : "→"}
              </span>
            )}
          </p>
          {item.summary && (
            <p className="mt-0.5 text-sm text-ink-soft">
              {item.summary}
            </p>
          )}
          {item.links && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
              {item.links.map((link) => (
                <RowLink
                  key={link.label}
                  href={link.href}
                  lang={lang}
                  className="inline-flex items-center gap-1 text-sm text-ink-soft decoration-line underline-offset-4 transition-colors hover:text-ink hover:underline"
                >
                  {LINK_ICONS[link.icon]}
                  {link.label}
                </RowLink>
              ))}
            </div>
          )}
        </div>
      </RowLink>
      {item.video && (
        <div className="mx-2 mb-2 mt-1 overflow-hidden rounded-xl border border-line bg-paper">
          <video
            src={withBasePath(item.video.src)}
            poster={item.video.poster ? withBasePath(item.video.poster) : undefined}
            aria-label={item.video.alt}
            width={1200}
            height={750}
            autoPlay
            loop
            muted
            playsInline
            className="block h-auto w-full"
          />
        </div>
      )}
    </li>
  );
}

export function HeroNews({ lang = "en" }: { lang?: Locale }) {
  const items = news[lang].slice(0, NEWS_LIMIT);
  if (items.length === 0) return null;
  const copy = COPY[lang];

  return (
    <section
      aria-label={copy.heading}
      className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-paper"
    >
      <header className="border-b border-line-soft px-5 py-3.5">
        <h2 className="flex items-center gap-2.5 text-sm font-bold text-ink">
          {/* Live dot. */}
          <span aria-hidden className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ink/40 motion-reduce:hidden" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-ink" />
          </span>
          {copy.heading}
        </h2>
      </header>
      <ol className="px-3 py-2">
        {items.map((item) => (
          <NewsRow
            key={`${item.date}-${item.title}`}
            item={item}
            lang={lang}
          />
        ))}
      </ol>
    </section>
  );
}
