// User-owned hero showcase component.
//
// The news feed in the hero's right-hand column: a card with a live header and
// a dated timeline, newest on top. Entries live in lib/news.ts. Registered as
// the "news" / "newsZh" slots in lib/hero-slots.tsx.
//
// Each row is a link. The rail runs down the left of the titles; the newest
// entry gets a filled node, the rest hollow nodes. Static (no
// hooks) → server component.
import Link from "next/link";
import type { ReactNode } from "react";
import { localeHtmlLang, localePath, type Locale } from "@/lib/i18n";
import { withBasePath } from "@/lib/paths";
import { news, NEWS_LIMIT, type NewsItem } from "@/lib/news";

const COPY: Record<Locale, { heading: string }> = {
  en: { heading: "Recent Updates" },
  zh: { heading: "最近更新" },
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

function NewsRow({
  item,
  lang,
  first,
  last,
}: {
  item: NewsItem;
  lang: Locale;
  first: boolean;
  last: boolean;
}) {
  return (
    <li>
      <RowLink
        href={item.href}
        lang={lang}
        className="group grid grid-cols-[4.25rem_1.25rem_minmax(0,1fr)] rounded-xl px-2 transition-colors hover:bg-paper-deep"
      >
        {/* Date */}
        <time
          dateTime={item.date}
          className="pt-4 text-xs tabular-nums text-muted"
        >
          {day(item.date, lang)}
        </time>

        {/* Rail + node. The rail is cut at the first and last node so it
            starts and ends on an entry rather than on the card's edge; a
            lone entry has none. */}
        <div className="relative flex justify-center">
          {!(first && last) && (
            <span
              aria-hidden
              className={`absolute w-px bg-line ${first ? "top-[1.3rem]" : "top-0"} ${
                last ? "h-[1.3rem]" : "bottom-0"
              }`}
            />
          )}
          <span
            aria-hidden
            className={`relative mt-[1.05rem] h-2.5 w-2.5 rounded-full transition-transform duration-200 group-hover:scale-125 ${
              first
                ? "bg-ink ring-4 ring-accent-soft"
                : "border-2 border-line bg-surface group-hover:border-ink"
            }`}
          />
        </div>

        {/* Body */}
        <div className="min-w-0 py-3 pl-2 pr-1">
          <p className="flex items-baseline gap-2 text-base font-bold leading-snug text-ink">
            <span className="min-w-0 truncate decoration-line underline-offset-4 group-hover:underline">
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
        </div>
      </RowLink>
      {item.video && (
        <div className="mx-2 mb-2 mt-1 overflow-hidden rounded-xl border border-line bg-paper">
          <video
            src={withBasePath(item.video.src)}
            poster={item.video.poster ? withBasePath(item.video.poster) : undefined}
            aria-label={item.video.alt}
            width={1200}
            height={710}
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
        {items.map((item, i) => (
          <NewsRow
            key={`${item.date}-${item.title}`}
            item={item}
            lang={lang}
            first={i === 0}
            last={i === items.length - 1}
          />
        ))}
      </ol>
    </section>
  );
}
