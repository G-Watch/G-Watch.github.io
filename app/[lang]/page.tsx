import Link from "next/link";
import { Fragment } from "react";
import { SiteShell } from "@/components/site-shell";
import { getSiteContent } from "@/lib/site-config";
import { getAllBlogPosts } from "@/lib/content";
import { getDictionary } from "@/lib/dictionaries";
import { resolveLocale, localePath } from "@/lib/i18n";
import { withBasePath } from "@/lib/paths";
import { formatDate } from "@/lib/format";

/** Render plain text, turning `backtick` spans into <code>. */
function inlineCode(text: string) {
  return text.split(/(`[^`]+`)/g).map((part, i) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code
        key={i}
        className="rounded bg-paper-deep px-1.5 py-0.5 font-mono text-[0.85em] text-accent-strong"
      >
        {part.slice(1, -1)}
      </code>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const lang = resolveLocale((await params).lang);
  const content = getSiteContent(lang);
  const dict = getDictionary(lang);
  const { hero, features, quickstart } = content;
  const recentPosts = getAllBlogPosts(lang).slice(0, 3);

  return (
    <SiteShell lang={lang}>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, var(--color-accent-soft) 0%, transparent 70%)",
          }}
        />
        <div className="mx-auto max-w-4xl px-5 pb-16 pt-20 text-center sm:px-8 sm:pt-28">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">
            {hero.eyebrow}
          </p>
          <h1 className="mx-auto mt-6 max-w-3xl font-serif text-4xl font-bold leading-tight tracking-tight text-ink sm:text-6xl">
            {hero.headline}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
            {hero.subhead}
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={localePath(lang, hero.primaryCta.href)}
              className="rounded-full bg-accent px-6 py-3 text-sm font-bold text-paper shadow-paper transition-colors hover:bg-accent-strong"
            >
              {hero.primaryCta.label}
            </Link>
            <Link
              href={localePath(lang, hero.secondaryCta.href)}
              className="rounded-full border border-line bg-surface px-6 py-3 text-sm font-bold text-ink-soft transition-colors hover:border-accent hover:text-accent"
            >
              {hero.secondaryCta.label}
            </Link>
          </div>
        </div>
      </section>

      {/* Features (with optional illustration) */}
      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="flex flex-col bg-surface">
              {feature.image && (
                // Plain <img>: the static export has no next/image optimizer.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={withBasePath(feature.image)}
                  alt=""
                  className="h-44 w-full border-b border-line object-cover"
                />
              )}
              <div className="p-7">
                <h3 className="font-serif text-xl font-bold text-ink">
                  {feature.title}
                </h3>
                <p className="mt-3 leading-relaxed text-ink-soft">
                  {feature.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Quick start: install + immediate usage */}
      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="rounded-2xl border border-line bg-paper-deep p-8 sm:p-12">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
            {dict.quickstart.eyebrow}
          </p>
          <h2 className="mt-3 max-w-2xl font-serif text-3xl font-bold text-ink">
            {quickstart.title}
          </h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-ink-soft">
            {quickstart.intro}
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {/* Terminal */}
            <div className="overflow-hidden rounded-xl border border-line bg-ink">
              <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
              </div>
              <pre className="overflow-x-auto px-5 py-4 font-mono text-sm leading-relaxed text-paper">
                {quickstart.command.split("\n").map((line, i) => (
                  <div key={i}>
                    <span className="select-none text-accent">$ </span>
                    {line}
                  </div>
                ))}
              </pre>
            </div>

            {/* Steps */}
            <ol className="space-y-4">
              {quickstart.steps.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-accent-soft font-mono text-sm font-bold text-accent-strong">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-serif font-bold text-ink">
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">
                      {inlineCode(step.body)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {quickstart.note && (
            <p className="mt-6 text-xs text-muted">{quickstart.note}</p>
          )}
        </div>
      </section>

      {/* Recent blog */}
      {recentPosts.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="font-serif text-2xl font-bold text-ink">
              {dict.blogIndex.title}
            </h2>
            <Link
              href={localePath(lang, "/blog/")}
              className="text-sm text-accent hover:text-accent-strong"
            >
              →
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {recentPosts.map((post) => (
              <Link
                key={post.slugPath}
                href={localePath(lang, `/blog/humanize/${post.slugPath}/`)}
                className="group rounded-xl border border-line bg-surface p-6 transition-colors hover:border-accent"
              >
                {post.date && (
                  <p className="font-mono text-xs text-muted">
                    {formatDate(post.date, lang)}
                  </p>
                )}
                <h3 className="mt-2 font-serif text-lg font-bold text-ink group-hover:text-accent">
                  {post.title}
                </h3>
                {post.description && (
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-soft">
                    {post.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </SiteShell>
  );
}
