import Link from "next/link";
import { Fragment, type CSSProperties } from "react";
import { SiteShell } from "@/components/site-shell";
import { HeroMedia } from "@/components/hero-media";
import { featureSlots } from "@/lib/feature-slots";
import { heroSlots } from "@/lib/hero-slots";
import { QuickstartTerminals } from "@/lib/quickstart-terminals";
import { HomeScroll } from "@/lib/home-scroll";
import { getSiteContent } from "@/lib/site-config";
import { resolveLocale, localePath } from "@/lib/i18n";
import { withBasePath } from "@/lib/paths";

/** Hero-note text tone → color class (literal so Tailwind generates them). */
const NOTE_TONE: Record<string, string> = {
  muted: "text-muted",
  soft: "text-ink-soft",
  ink: "text-ink",
  accent: "text-accent",
};

/** Hero-note text size → size class. */
const NOTE_SIZE: Record<string, string> = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
};

const NOTE_LINK_DEFAULT =
  "font-medium text-accent underline-offset-2 hover:text-accent-strong hover:underline";

/**
 * The headline, with one of its words linked out.
 *
 * `headline` stays a plain string in lib/site-config.ts — it has to serve as
 * text elsewhere — so the link is declared beside it and spliced in here. A
 * `text` that is not in the headline renders the headline untouched.
 */
function Headline({
  text,
  link,
}: {
  text: string;
  link?: { text: string; href: string };
}) {
  const at = link ? text.indexOf(link.text) : -1;
  if (!link || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <a
        href={link.href}
        target="_blank"
        rel="noreferrer"
        className="underline decoration-2 underline-offset-[6px] transition-colors hover:text-accent"
      >
        {link.text}
      </a>
      {text.slice(at + link.text.length)}
    </>
  );
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const lang = resolveLocale((await params).lang);
  const content = getSiteContent(lang);
  const { hero, features, quickstart } = content;
  const firstMedia = Array.isArray(hero.media) ? hero.media[0] : hero.media;
  const overlapMedia = firstMedia?.placement === "overlap";
  // Text-column : showcase-column width ratio for overlap (1 = equal split).
  const textRatio = firstMedia?.layout?.textRatio ?? 1;

  // Resolve hero-note styling.
  const noteStyle = hero.note?.style ?? {};
  const noteVariant = noteStyle.variant ?? "text";
  const noteToneClass = NOTE_TONE[noteStyle.tone ?? "muted"] ?? NOTE_TONE.muted;
  const noteSizeClass = NOTE_SIZE[noteStyle.size ?? "sm"] ?? NOTE_SIZE.sm;
  const noteExtraClass = noteStyle.className ?? "";
  const noteLinkClass = noteStyle.linkClassName ?? NOTE_LINK_DEFAULT;
  const noteLinkEl = hero.note?.link ? (
    hero.note.link.href.startsWith("http") ? (
      <a
        href={hero.note.link.href}
        target="_blank"
        rel="noopener noreferrer"
        className={noteLinkClass}
      >
        {hero.note.link.label}
      </a>
    ) : (
      <Link
        href={localePath(lang, hero.note.link.href)}
        className={noteLinkClass}
      >
        {hero.note.link.label}
      </Link>
    )
  ) : null;

  return (
    <SiteShell lang={lang}>
      <HomeScroll />
      {/* Part one: the lead-in and the news. It fills the first screen. */}
      <section
        id="home-lead"
        className="relative flex min-h-[calc(100svh-4rem)] flex-col justify-center overflow-hidden"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, var(--color-accent-soft) 0%, transparent 70%)",
          }}
        />
        <div
          className={`home-lead-inner relative mx-auto w-full px-5 sm:px-8 ${
            overlapMedia ? "max-w-7xl" : "max-w-4xl"
          }`}
        >
          <div
            className={
              overlapMedia
                ? "grid items-center gap-8 py-16 sm:py-20 lg:[grid-template-columns:var(--hero-cols)] lg:gap-6 lg:py-24"
                : `pt-20 text-center sm:pt-28 ${hero.media ? "" : "pb-16"}`
            }
            style={
              overlapMedia
                ? ({ "--hero-cols": `${textRatio}fr 1fr` } as CSSProperties)
                : undefined
            }
          >
            <div
              className={`relative z-10 min-w-0 ${
                overlapMedia ? "text-center lg:text-left" : "text-center"
              }`}
            >
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">
                {hero.eyebrow}
              </p>
              {/* Each layout sets its own ramp. Beside a showcase the headline
                  only gets its share of the grid, so it is set a step down from
                  the full-width layout's and stays one line there. */}
              <h1
                className={`mt-6 font-serif font-bold leading-tight tracking-tight text-ink ${
                  overlapMedia
                    ? "mx-auto max-w-xl text-3xl sm:text-4xl lg:mx-0 lg:max-w-none"
                    : "mx-auto max-w-3xl text-4xl sm:text-6xl"
                }`}
              >
                <Headline text={hero.headline} link={hero.headlineLink} />
              </h1>
              <p
                className={`mt-6 text-lg leading-relaxed text-ink-soft ${
                  overlapMedia
                    ? "mx-auto max-w-md lg:mx-0 lg:max-w-none"
                    : "mx-auto max-w-2xl"
                }`}
              >
                {hero.subhead}
              </p>
              {hero.note &&
                (noteVariant === "pill" ? (
                  <div
                    className={`mt-5 flex ${
                      overlapMedia
                        ? "justify-center lg:justify-start"
                        : "justify-center"
                    }`}
                  >
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-paper-deep px-3.5 py-1.5 ${noteSizeClass} ${noteToneClass} ${noteExtraClass}`}
                    >
                      {hero.note.prefix}
                      {noteLinkEl}
                      {hero.note.suffix}
                    </span>
                  </div>
                ) : (
                  <p
                    className={`mt-5 ${noteSizeClass} ${noteToneClass} ${
                      overlapMedia
                        ? "mx-auto max-w-md lg:mx-0 lg:max-w-none"
                        : "mx-auto max-w-2xl"
                    } ${noteExtraClass}`}
                  >
                    {hero.note.prefix}
                    {noteLinkEl}
                    {hero.note.suffix}
                  </p>
                ))}
              {hero.actions ? (
                <div className="mt-10">{heroSlots[hero.actions] ?? null}</div>
              ) : (
                <div
                  className={`mt-9 flex flex-wrap items-center gap-3 ${
                    overlapMedia
                      ? "justify-center lg:justify-start"
                      : "justify-center"
                  }`}
                >
                  {hero.primaryCta && (
                    <Link
                      href={localePath(lang, hero.primaryCta.href)}
                      className="rounded-full bg-accent px-6 py-3 text-sm font-bold text-paper shadow-paper transition-colors hover:bg-accent-strong"
                    >
                      {hero.primaryCta.label}
                    </Link>
                  )}
                  {hero.secondaryCta && (
                    <Link
                      href={localePath(lang, hero.secondaryCta.href)}
                      className="rounded-full border border-line bg-surface px-6 py-3 text-sm font-bold text-ink-soft transition-colors hover:border-accent hover:text-accent"
                    >
                      {hero.secondaryCta.label}
                    </Link>
                  )}
                </div>
              )}
            </div>

            {overlapMedia && hero.media && <HeroMedia media={hero.media} />}
          </div>
        </div>

        {!overlapMedia && hero.media && (
          <div className="px-5 pb-16 pt-16 sm:px-8">
            <HeroMedia media={hero.media} />
          </div>
        )}
        <span aria-hidden className="home-cue">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </section>

      {/* Features (with optional illustration, custom slot, or link) */}
      {features.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
          <div className="grid gap-4 sm:grid-cols-2">
            {features.map((feature) => {
              const media = feature.slot ? (
                (featureSlots[feature.slot] ?? null)
              ) : feature.video ? (
                <video
                  src={withBasePath(feature.video)}
                  poster={
                    feature.poster ? withBasePath(feature.poster) : undefined
                  }
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="h-44 w-full border-b border-line object-cover"
                />
              ) : feature.image ? (
                // Plain <img>: the static export has no next/image optimizer.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={withBasePath(feature.image)}
                  alt=""
                  className="h-44 w-full border-b border-line object-cover"
                />
              ) : null;

              const inner = (
                <>
                  {media}
                  <div className="p-7">
                    <h3 className="font-serif text-xl font-bold text-ink transition-colors group-hover:text-accent">
                      {feature.title}
                    </h3>
                    <p className="mt-3 leading-relaxed text-ink-soft">
                      {feature.body}
                    </p>
                  </div>
                </>
              );

              const base =
                "flex flex-col overflow-hidden rounded-2xl border border-line bg-surface";

              if (feature.href) {
                const linkCls = `group ${base} transition-colors hover:border-accent`;
                return feature.href.startsWith("http") ? (
                  <a
                    key={feature.title}
                    href={feature.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkCls}
                  >
                    {inner}
                  </a>
                ) : (
                  <Link
                    key={feature.title}
                    href={localePath(lang, feature.href)}
                    className={linkCls}
                  >
                    {inner}
                  </Link>
                );
              }

              return (
                <div key={feature.title} className={base}>
                  {inner}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Part two: the quick start. With the footer under it, it fills exactly
          one screen below the header; lib/home-scroll.tsx measures the footer
          into --footer-h. The footer rises with it. */}
      <section
        id="home-quickstart"
        className="mx-auto flex h-[calc(100svh-4rem-var(--footer-h,8rem))] min-h-[32rem] max-w-6xl flex-col px-5 pb-8 pt-10 sm:px-8"
      >
        <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col">
          <h2 data-rise="0" className="mb-8 text-2xl font-bold text-ink">
            {quickstart.title}
          </h2>
          <QuickstartTerminals quickstart={quickstart} />
        </div>
      </section>

    </SiteShell>
  );
}
