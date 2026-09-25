import { localeHtmlLang, type Locale } from "@/lib/i18n";

function parts(iso: string, lang: Locale) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const fmt = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(localeHtmlLang[lang], {
      ...o,
      timeZone: "UTC",
    }).format(d);
  return {
    day: String(d.getUTCDate()).padStart(2, "0"),
    month: fmt({ month: "short" }),
    year: String(d.getUTCFullYear()),
    weekday: fmt({ weekday: "long" }),
  };
}

/**
 * A post's date as a small calendar leaf: the day large in the serif, the month
 * and year stacked beside it in small caps. `stacked` stands the leaf upright
 * for the blog index's date column.
 */
export function PostDate({
  iso,
  lang,
  stacked = false,
}: {
  iso: string;
  lang: Locale;
  stacked?: boolean;
}) {
  const p = parts(iso, lang);
  if (!p) return <time dateTime={iso}>{iso}</time>;

  if (stacked) {
    return (
      <time
        dateTime={iso}
        className="flex w-16 flex-col items-center overflow-hidden rounded-xl border border-line bg-surface text-center shadow-paper"
      >
        <span className="w-full bg-ink py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-paper">
          {p.month}
        </span>
        <span className="pt-1.5 font-serif text-2xl font-bold leading-none tabular-nums text-ink">
          {p.day}
        </span>
        <span className="pb-1.5 pt-1 text-[0.65rem] tabular-nums tracking-wider text-muted">
          {p.year}
        </span>
      </time>
    );
  }

  return (
    <time
      dateTime={iso}
      title={p.weekday}
      className="inline-flex items-stretch overflow-hidden rounded-full border border-line bg-surface shadow-paper"
    >
      <span className="flex items-center bg-ink px-3 font-serif text-base font-bold tabular-nums text-paper">
        {p.day}
      </span>
      <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">
        {p.month}
        <span className="tabular-nums text-muted">{p.year}</span>
      </span>
    </time>
  );
}
