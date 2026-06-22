---
title: Humanize and Agent Dual Views
description: From a single Markdown file, goodoc generates two versions—one rendered for humans, one for machines.
group: Writing
order: 2
---

# Humanize and Agent Dual Views

goodoc's most distinctive feature: every doc and blog post has **two URLs**, corresponding to two renderings.

## Two URLs

| View | Docs URL | Blog URL |
| --- | --- | --- |
| Humanize | `/<lang>/docs/humanize/<slug>` | `/<lang>/blog/humanize/<slug>` |
| Agent | `/<lang>/docs/agent/<slug>` | `/<lang>/blog/agent/<slug>` |

(`<lang>` is the locale, e.g. `en` or `zh`.)

There's a toggle in the top-right of the page (below the title for blog posts) that lets you jump between the two views.

## Humanize: Rendered for People

The humanize view is the default, human-friendly version:

- elegant typography, PT Serif headings paired with PT Sans body text;
- code highlighting, tables, and task lists just like a GitHub README;
- a sidebar, an on-page table of contents, and previous/next navigation;
- anchors that appear on heading hover, making it easy to share a specific spot.

## Agent: Rendered for Machines

The agent view is semantic HTML stripped of all decoration:

- no sidebar, no table of contents, no site navigation;
- a monospace font, a clear structure, with all images and text inlined;
- ideal for LLMs, crawlers, and any program that needs to read it.

> Why give machines their own view? Because more and more "readers" are agents. Hand them a clean
> HTML version and they can understand your project far more accurately.

## They Share One Rendering Pipeline

Both views come from **the same Markdown** through **the same rendering pipeline**; only the outer page shell differs.
That means you write the content once, humans and machines each take what they need, and the two never drift apart.

```text
content/en/docs/x.md
        │
   renderMarkdown()        ← one pipeline: GFM + inline HTML + code highlighting
        │
   ┌────┴─────┐
   ▼          ▼
humanize    agent
(with shell) (pure HTML)
```
