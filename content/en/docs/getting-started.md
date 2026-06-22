---
title: Getting Started
description: Clone goodoc, drop in your content, and have an elegant project site up in minutes.
group: Getting Started
order: 1
---

# Getting Started

**goodoc** is a static site framework for hosting a project home page, documentation, and a blog. Its design goal is simple: write nothing but Markdown and get a site that is beautifully typeset and friendly to both humans and machines.

## Installation

```bash
# Clone the framework
git clone https://github.com/zobinHuang/goodoc.git my-project
cd my-project

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open <http://localhost:3000> to see the site.

## Directory Structure

```text
my-project/
├── app/
│   └── theme.css       # ← palette and font tokens (yours to customize)
├── components/         # UI components (framework)
├── lib/
│   └── site-config.ts  # ← project name, copy, nav, footer (you edit this most)
├── content/
│   └── en/             # ← default locale; add zh/, etc. as needed
│       ├── docs/       # ← documentation Markdown
│       └── blog/       # ← blog Markdown
├── public/             # Static assets such as images
├── dev-docs/           # The framework's own development docs
└── goodoc.manifest.json # framework vs. your files (used by upgrades)
```

The site is multilingual by default (English first); content is organized per
locale under `content/<locale>/`. See [Internationalization](/docs/humanize/i18n/).

## Go Live in Three Steps

1. Edit `lib/site-config.ts` to set your project name, tagline, navigation, and
   per-locale copy. Tune the palette in `app/theme.css`.
2. Drop documentation Markdown into `content/en/docs/` and blog posts into
   `content/en/blog/` (and other locales as you add them).
3. Push to GitHub, and Actions will build and publish to GitHub Pages automatically.

> Want to know how to write each Markdown file and which frontmatter fields are supported? Keep reading:
> [Writing Content](/docs/humanize/writing-content/).
