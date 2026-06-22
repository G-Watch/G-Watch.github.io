---
title: Markdown Rendering
description: goodoc renders Markdown just like a GitHub README—code highlighting, tables, task lists, inline HTML.
group: Writing
order: 1
---

# Markdown Rendering

goodoc's rendering follows **GitHub Flavored Markdown (GFM)** with added syntax highlighting. This very page is a rendering sample.

## Text

Supports **bold**, *italic*, ~~strikethrough~~, `inline code`, and automatic links like <https://github.com/zobinHuang/goodoc>.

## Code Highlighting

Code blocks are highlighted by [Shiki](https://shiki.style) using the `github-light` theme:

```ts
interface Doc {
  title: string;
  slug: string[];
}

async function render(doc: Doc): Promise<string> {
  const { html } = await renderMarkdown(doc.body);
  return html;
}
```

```python
def fib(n: int) -> int:
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
```

## Tables

| View | URL | Audience |
| --- | --- | --- |
| Humanize | `/<lang>/docs/humanize/…` | Human readers |
| Agent | `/<lang>/docs/agent/…` | Machine readers |

## Task Lists

- [x] Landing page
- [x] Dual-view documentation
- [x] Blog
- [ ] Your next project

## Blockquotes

> Documentation isn't only for people to read.
> It's only truly complete when machines can read it cleanly too.

## Inline HTML

You can write HTML directly inside Markdown, and it renders as-is:

<div align="center">
  <img src="/goodoc-mark.svg" alt="goodoc" width="160" />
  <p><em>The image above is referenced via <code>/goodoc-mark.svg</code>; the base path is filled in automatically.</em></p>
</div>

## Nested Lists

1. First level
   - Second level A
   - Second level B
     1. Third level
2. Back to the first level
