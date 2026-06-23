---
name: goodoc
description: >-
  Guide for building a site on the goodoc template (a literary static-site
  framework for project home pages, docs, and blogs). Use when adding or editing
  documentation or blog posts, configuring the landing page / theme / footer,
  managing i18n locales, running/previewing/building the site, deploying to
  GitHub Pages, or upgrading the framework from upstream. Triggers: goodoc,
  content/<locale>/docs, lib/site-config.ts, app/theme.css, humanize/agent
  views, npm run upgrade.
---

# goodoc — agent guide

This single file is the source of truth for working in a goodoc-based site.
Manage/distribute it to your agents (Claude, Codex, Gemini, …) with
`npx skills`. It is framework-managed — `npm run upgrade` keeps it current, so
put project-specific notes in your own file rather than editing this one.

goodoc is a **static-site framework** (Next.js App Router, `output: "export"`)
for a project's **landing page + docs + blog**, with a literary light-only
theme. You author Markdown; goodoc renders each doc/post in two views:

- **humanize** — GitHub-README-style, for people: `/<lang>/docs/humanize/<slug>/`
- **agent** — clean semantic HTML, for machines: `/<lang>/docs/agent/<slug>/`

The site is multilingual with locale-prefixed URLs (`/en/…`, `/zh/…`), English
default. Blog mirrors docs at `/<lang>/blog/{humanize,agent}/<slug>/`.

## Golden rules (read first)

1. **Only edit user-owned files.** Framework files are overwritten by
   `npm run upgrade`. Edit freely:
   - `content/` — your docs and blog (`.md` or `.mdx`)
   - `lib/site-config.ts` — project identity, landing copy, nav, footer
   - `lib/hero-slots.tsx` — your custom hero showcase components
   - `lib/mdx-components.tsx` — your components for use inside `.mdx` content
   - `app/theme.css` — palette and font tokens
   - `public/` — images and assets
   - `README*`
   Do **not** edit (framework-owned): `app/[lang]/`, `app/layout.tsx`,
   `app/globals.css`, `components/`,
   `lib/{content,markdown,mdx,render-content,i18n,dictionaries,paths,format}.ts(x)`,
   configs, `.github/workflows/`. The full boundary is in `goodoc.manifest.json`.
2. **Write in-content links locale-relative**: `/docs/humanize/<slug>/`, not
   `/en/docs/…`. The current locale prefix and deploy base path are added at
   render time. Assets (`/logo.svg`) get the base path only.
3. **Verify with a build.** After changes run `npm run build` — the static
   export fails loudly on broken routes or type errors. Then `npm run lint`.
4. **One source of truth per fact.** Don't duplicate content between humanize
   and agent — they're generated from the same Markdown automatically.

## Repo map

```text
content/<locale>/docs/*.md|mdx docs (sidebar)        ← author here
content/<locale>/blog/*.md|mdx blog posts            ← author here
lib/site-config.ts             identity, hero, features, quickstart, nav, footer
lib/hero-slots.tsx             custom hero showcase components   ← author here
lib/mdx-components.tsx         components usable inside .mdx     ← author here
app/theme.css                  colors + font variables
public/                        images/assets (e.g. /features/*.svg)
lib/i18n.ts                    locales, default, helpers   (framework)
lib/dictionaries.ts            UI chrome strings           (framework)
goodoc.manifest.json           framework-vs-user boundary
dev-docs/                      deep framework docs
```

---

## Task: add or edit a documentation page

Create `content/<locale>/docs/<slug>.md` (the default locale is `en`; use
`.mdx` instead if the page needs custom components — see the MDX task below).
Nested folders become nested slugs (`content/en/docs/guide/setup.md` →
`/en/docs/humanize/guide/setup/`).

```markdown
---
title: Page Title          # required
description: One-line summary shown in lists and the page header.
group: Getting Started     # sidebar group heading
order: 1                   # sort within the group (lower first)
draft: false               # true = visible in dev only, hidden in production
---

# Page Title

Body in GitHub-Flavored Markdown. Link locale-relative:
[Configuration](/docs/humanize/configuration/). Images from public/:
![diagram](/diagram.svg)
```

- The **sidebar** groups by `group` and sorts by `order`. Give a batch the same
  `group` and sequence them with `order`.
- To translate, create the same file under another locale
  (`content/zh/docs/<slug>.md`) with a translated `title`/`group`. Untranslated
  pages **fall back** to the default locale automatically.

## Task: add a blog post

Create `content/<locale>/blog/<slug>.md`:

```markdown
---
title: Post Title
description: One-line summary.
date: 2026-06-22            # ISO date; posts sort newest-first
tags: [Announcement]
---

# Post Title

Same Markdown + rendering as docs.
```

## Task: embed custom components in content (MDX)

Plain Markdown files (`.md`) cannot contain React components. To embed live
components in a doc or post, name the file **`.mdx`** instead — everything
Markdown does still works (GFM, Shiki, TOC, anchors, locale link-rewriting), and
you additionally get JSX.

1. Register the component in `lib/mdx-components.tsx` (user-owned; `npm run
   upgrade` seeds it if missing, never overwrites it). It's then available in
   **every** `.mdx` file with no per-file import:

   ```tsx
   // lib/mdx-components.tsx
   import { Chart } from "@/components/chart";
   export const mdxComponents = { Callout, Chart };
   ```

2. Use it as a tag in `.mdx` content; Markdown renders inside, and JSX
   expressions work:

   ```mdx
   <Callout type="tip">Markdown **works** inside.</Callout>
   <Chart data={[1, 2, 3]} live={true} />
   ```

Notes:
- Custom components come from the registry — content files **don't** use
  `import` statements (the registry is the global scope, like Docusaurus).
- Interactive components (state/effects/browser APIs) go in their own file with
  a `"use client"` directive, imported into the registry. They hydrate normally
  despite the static export. `.mdx` compiles at **build time**, so a bad
  component fails `npm run build` loudly.
- Both views render the components: humanize (styled) and agent (machine view).
- A worked example ships at `content/<locale>/docs/mdx-components.mdx`.

## Task: edit the landing page & site identity

Everything is in `lib/site-config.ts`. Top-level (language-neutral) fields:

```ts
name: "goodoc",                  // wordmark
brand: { mode: "logo-and-name", logo: "/goodoc-mark.svg" },  // see below
repo: "https://github.com/…",
social: [{ label: "GitHub", href: "…" }],
projectName: "goodoc",           // footer line ↓
duration: "2024 – 2026",
poweredBy: { label: "Goodoc", href: "…" },
```

The footer renders: `<projectName> <duration> | Powered by Goodoc`.

**Logo** — `brand.mode` is `"logo-and-name"`, `"logo-only"`, or `"name-only"`;
`brand.logo` is an image under `public/` (e.g. `/logo.svg`). The brand shows in
the header and footer. A logo mode with no `logo` falls back to the name.

Per-locale copy lives under `locales[lang]`:

```ts
locales: {
  en: {
    tagline, description,
    hero: { eyebrow, headline, subhead,
            primaryCta: { label, href }, secondaryCta: { label, href },
            media: { type: "image", src: "/hero.png", alt: "…" } },  // optional
    features: [
      { title, body, image: "/features/landing.svg" },  // image optional
    ],
    quickstart: {
      title, intro,
      command: "pip3 install your-tool",   // shown in the terminal block
      steps: [ { title, body } ],          // body may use `inline code`
      note,
    },
    nav: [ { label: "Docs", href: "/docs/" } ],  // label localized, href relative
    footerNote,
  },
  zh: { /* same shape */ },
}
```

Add a feature illustration by dropping an SVG/PNG in `public/features/` and
referencing it as `image`. `hero.media` (optional) shows an image or video alongside the hero text. Pass
a single item **or an array** — arrays crossfade automatically every 4 s.

`placement` (read from the first item) controls layout:

- `"below"` (default) — elegant floating card beneath the text; dot indicators
  appear below the card when there are multiple slides.
- `"overlap"` — same height band as the text, shifted to the side with a
  radial-gradient feather mask; silent auto-advance (no visible controls).

```ts
// single item
media: { type: "image", src: "/hero.png", alt: "…", placement: "overlap" }

// crossfade carousel
media: [
  { type: "image", src: "/hero-1.png", alt: "Step 1", placement: "below" },
  { type: "image", src: "/hero-2.png", alt: "Step 2" },
  { type: "video", src: "/demo.mp4",   poster: "/demo-poster.png" },
]
```

Put assets in `public/`. Videos play as muted, looping ambient clips.

**Custom component** — the showcase isn't limited to images/videos; it can hold
any React component you write. See the task below.

## Task: put a custom component in the hero showcase

The hero showcase can render **your own React components** — a live demo, an
animated diagram, an embed, a stats panel — not just images and videos. This is
fully **user-owned and upgrade-safe**: you never touch a framework file, and
`npm run upgrade` never overwrites your components.

Two steps, both in user-owned files:

1. Register the component under a key in `lib/hero-slots.tsx` (this file is
   yours — `npm run upgrade` seeds it if missing and never overwrites it):

   ```tsx
   // lib/hero-slots.tsx
   import { LiveDemo } from "@/components/your-demo"; // import your own files freely
   export const heroSlots = { demo: <LiveDemo /> };
   ```

2. Reference the key from `lib/site-config.ts` with `type: "custom"`:

   ```ts
   // single, or mixed into a carousel array alongside image/video items
   media: { type: "custom", slot: "demo", placement: "overlap" }
   ```

Custom slots inherit the same `below`/`overlap` framing and carousel crossfade
as media. The component can import your own files and third-party libraries. If
it needs hooks, state, or browser APIs, put it in its own file with a
`"use client"` directive (don't add `"use client"` to `lib/hero-slots.tsx`
itself). You don't need to fork or edit the framework to do any of this.

## Task: change the theme (colors / fonts)

Edit `app/theme.css` — the `@theme` block defines the palette and font tokens:

```css
@theme {
  --color-paper: #fbf9f4;   /* background */
  --color-ink: #2b2925;     /* text */
  --color-accent: #a65a3f;  /* accent */
  --font-sans: var(--font-pt-sans), …;
}
```

Changing these few variables reskins the whole site. To load a *new* font, also
edit `app/layout.tsx` (framework-owned — expect to re-apply after an upgrade).

## Task: add or manage a language (i18n)

Three edits, then content:

1. `lib/i18n.ts` — add the code to `locales`, plus `localeNames` and
   `localeHtmlLang`.
2. `lib/dictionaries.ts` — add a `Dictionary` of UI strings for it.
3. `lib/site-config.ts` — add a `LocaleContent` block under `locales`.
4. Add translations under `content/<new-locale>/`. Missing files fall back to
   the default locale.

TypeScript flags steps 1–3 until complete, so a `npm run build` tells you what's
missing.

## Markdown capabilities

GitHub-Flavored Markdown: headings (with hover anchors + auto TOC), tables, task
lists, strikethrough, autolinks, blockquotes, and **inline raw HTML** (rendered
as-is). Code blocks are highlighted by Shiki (`github-light`). Content is
trusted/first-party — there is no HTML sanitization. For **live React
components** in content, use `.mdx` files — see "embed custom components" above.

---

## Run, preview, build

```bash
npm install
npm run dev      # http://localhost:3000 (redirects to /en/); always served at root
npm run build    # static export → out/
npm run lint
npx serve out    # preview the static output
```

`npm run dev` ignores `NEXT_PUBLIC_BASE_PATH` (base path is production-only), so
the dev site is never 404'd by a stray env var.

## Deploy to GitHub Pages

The repo ships `.github/workflows/deploy.yml`: push to `main` and it builds +
publishes. One-time setup: **Settings → Pages → Source = GitHub Actions**.

A project site lives under a sub-path, so the workflow sets the base path:

```bash
NEXT_PUBLIC_BASE_PATH=/<repo> npm run build
```

User/org pages (`<user>.github.io`) and custom domains deploy at root — leave it
unset. `out/` is plain static files; Netlify/Cloudflare Pages/Nginx work too.

## Upgrade from upstream

When the goodoc framework improves, pull it in without losing your content:

```bash
npm run upgrade            # from upstream default branch
npm run upgrade -- --ref v1.2.0   # a specific tag
npm run upgrade -- --dry-run      # preview only
```

It overwrites framework files and leaves your user-owned files untouched (per
`goodoc.manifest.json`); `package.json` is written as `package.json.upstream`
to merge. Commit first so the post-upgrade `git diff` is easy to review.

## Gotchas

- **Static export constraints**: no server features (cookies, headers,
  redirects, dynamic route handlers). Any new dynamic route needs
  `generateStaticParams()`, or the build fails.
- **Next.js App Router**: page `params` is a `Promise` — `await` it.
- Don't hand-write locale prefixes in content links; keep them relative.
- After any content/config change, run `npm run build` to confirm it's valid.

## Read more

- On-site docs: `content/<locale>/docs/` (getting-started, writing-content,
  configuration, i18n, deployment, upgrading, markdown-features, mdx-components).
- Framework internals: `dev-docs/` (architecture, rendering pipeline, views &
  routes, theming, deployment, i18n, upgrades).
