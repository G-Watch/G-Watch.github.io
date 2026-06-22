---
title: 写作内容
description: 文档与博客文章都用带 frontmatter 的 Markdown 编写。了解可用字段以及如何组织它们。
group: 开始
order: 2
---

# 写作内容

goodoc 的所有内容都以 Markdown 文件的形式存放在 `content/<locale>/`
之下（默认语言是 `en`）：

- `content/en/docs/` —— 文档，显示在文档侧边栏中。
- `content/en/blog/` —— 博客文章，按日期倒序排列。

文件名即 URL slug。例如，`content/en/docs/guide/setup.md`
会渲染为 `/en/docs/humanize/guide/setup/`。（你按语言相对路径书写链接，
写成 `/docs/humanize/guide/setup/`，语言前缀会自动加上 —— 参见
[国际化](/docs/humanize/i18n/)。）

## Frontmatter

每个文件都在顶部用一段 YAML frontmatter 描述自己的元数据：

```markdown
---
title: Document Title
description: A one-line summary, shown in lists and in the page header.
group: Getting Started   # 侧边栏分组（仅文档）
order: 1                 # 组内顺序；值越小越靠前（仅文档）
date: 2026-06-21         # 发布日期（仅博客，用于排序）
tags: [Design, Rendering] # 标签（仅博客）
draft: false             # 为 true 时仅在开发模式下可见
---
```

| 字段 | 适用于 | 说明 |
| --- | --- | --- |
| `title` | 文档 / 博客 | 标题，必填 |
| `description` | 文档 / 博客 | 摘要 |
| `group` | 文档 | 侧边栏分组标题 |
| `order` | 文档 | 组内排序键 |
| `date` | 博客 | ISO 日期，用于倒序排列 |
| `tags` | 博客 | 标签数组 |
| `draft` | 文档 / 博客 | 草稿；在生产构建中隐藏 |

## 组织文档

侧边栏按 `group` 给文档分组，并在每个组内按 `order` 排序。给一批文档赋予相同的
`group`，再用 `order` 控制它们的先后顺序：

```text
content/en/docs/
├── getting-started.md   # group: Getting Started, order: 1
├── writing-content.md   # group: Getting Started, order: 2
└── deployment.md        # group: Deployment, order: 1
```

## 链接与图片

站内链接请用**语言相对**的绝对路径书写。渲染时会自动加上当前语言前缀和部署子路径
（base path）；静态资源只会加上 base path（永远不会本地化）：

```markdown
See [Getting Started](/docs/humanize/getting-started/).

![goodoc](/goodoc-mark.svg)
```

把图片放在 `public/` 中，用 `/your-image.png` 引用。
