---
title: Writing Content
description: Both docs and blog posts are written in Markdown with frontmatter. Learn the available fields and how to organize them.
group: Getting Started
order: 2
---

# Writing Content

All of goodoc's content lives as Markdown files under `content/<locale>/`
(the default locale is `en`):

- `content/en/docs/` — documentation, shown in the docs sidebar.
- `content/en/blog/` — blog posts, sorted by date in reverse chronological order.

The filename becomes the URL slug. For example, `content/en/docs/guide/setup.md`
renders to `/en/docs/humanize/guide/setup/`. (You write links locale-relative,
as `/docs/humanize/guide/setup/`; the locale prefix is added for you — see
[Internationalization](/docs/humanize/i18n/).)

## Frontmatter

Each file describes its metadata in a block of YAML frontmatter at the top:

```markdown
---
title: Document Title
description: A one-line summary, shown in lists and in the page header.
group: Getting Started   # Sidebar group (docs only)
order: 1                 # Order within the group; lower comes first (docs only)
date: 2026-06-21         # Publish date (blog only, used for sorting)
tags: [Design, Rendering] # Tags (blog only)
draft: false             # When true, visible only in dev mode
---
```

| Field | Applies to | Description |
| --- | --- | --- |
| `title` | docs / blog | Title, required |
| `description` | docs / blog | Summary |
| `group` | docs | Sidebar group heading |
| `order` | docs | Sort key within a group |
| `date` | blog | ISO date, used for reverse-chronological sorting |
| `tags` | blog | Array of tags |
| `draft` | docs / blog | Draft; hidden in production builds |

## Organizing Documentation

The sidebar groups documents by `group` and sorts each group by `order`. Give a batch of documents the same
`group`, then use `order` to control their sequence:

```text
content/en/docs/
├── getting-started.md   # group: Getting Started, order: 1
├── writing-content.md   # group: Getting Started, order: 2
└── deployment.md        # group: Deployment, order: 1
```

## Links and Images

Write in-site links **locale-relative** with an absolute path. At render time the
current locale prefix and the deployment subpath (base path) are added for you;
assets are prefixed with the base path only (never localized):

```markdown
See [Getting Started](/docs/humanize/getting-started/).

![goodoc](/goodoc-mark.svg)
```

Put images in `public/` and reference them with `/your-image.png`.
