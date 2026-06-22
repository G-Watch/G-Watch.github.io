---
title: Configuration
description: Customize your site name, footer, navigation, and per-locale copy through lib/site-config.ts.
group: Configuration
order: 1
---

# Configuration

After cloning goodoc, the file you'll mostly edit is `lib/site-config.ts`. It
centralizes branding and the landing-page copy. Language-neutral fields live at
the top level; anything that needs translating lives under `locales`.

## Shared fields

```ts
export const siteConfig: SiteConfig = {
  name: "goodoc",                         // wordmark in header/footer
  repo: "https://github.com/zobinHuang/goodoc",
  social: [{ label: "GitHub", href: "https://github.com/zobinHuang/goodoc" }],

  // Footer line: "<projectName> <duration> | Powered by Goodoc"
  projectName: "goodoc",
  duration: "2024 – 2026",
  poweredBy: { label: "Goodoc", href: "https://github.com/zobinHuang/goodoc" },

  locales: { en: { /* … */ }, zh: { /* … */ } },
};
```

The footer renders that attribution line automatically — change `projectName`
and `duration` to yours.

## Per-locale copy

Each entry under `locales` holds the copy for one language:

```ts
en: {
  tagline: "A documentation framework for humans and machines",
  description: "…used for search engines and social sharing.",
  hero: {
    eyebrow: "A documentation framework",
    headline: "Tell your project like a good book",
    subhead: "Landing page, Markdown docs, and a blog — in one.",
    primaryCta: { label: "Read the docs", href: "/docs/" },
    secondaryCta: { label: "Visit the blog", href: "/blog/" },
  },
  features: [
    {
      title: "Landing page",
      body: "Say what your project is on one page.",
      image: "/features/landing.svg",   // optional illustration (under public/)
    },
    // …
  ],
  quickstart: {
    title: "Install and start in a minute",
    intro: "Pull in the package, then you immediately have something to run.",
    command: "pip3 install goodoc",      // shown in the terminal block
    steps: [
      { title: "Run it", body: "`goodoc serve` starts a local site." },
      // …
    ],
    note: "Replace with your own.",
  },
  nav: [
    { label: "Docs", href: "/docs/" },   // labels localized; hrefs locale-relative
    { label: "Blog", href: "/blog/" },
  ],
  footerNote: "Written in Markdown, rendered for humans and machines.",
},
```

- **`features[].image`** is optional — provide an SVG/PNG under `public/` to
  illustrate a card, or omit it for text only.
- **`quickstart`** powers the landing page's install section: a terminal showing
  `command` plus the numbered `steps`. Use backticks in a step's `body` for
  inline code.
- **`nav`** labels are translated per locale; the `href` stays locale-relative
  (`/docs/`) and the locale prefix is added automatically.

Adding a language? See [Internationalization](/docs/humanize/i18n/).

## Theme and fonts

The palette and font mappings live in `app/theme.css` (yours to customize; never
overwritten by upgrades):

```css
@theme {
  --color-paper: #fbf9f4;   /* paper background */
  --color-ink: #2b2925;     /* body ink */
  --color-accent: #a65a3f;  /* terracotta accent */
  --font-sans: var(--font-pt-sans), …;
}
```

Change these few variables for a whole new color scheme. The fonts themselves are
loaded in `app/layout.tsx` via `next/font/google`, defaulting to PT Sans / PT
Serif / PT Mono. UI strings (sidebar labels, "On this page", etc.) live in
`lib/dictionaries.ts`.
