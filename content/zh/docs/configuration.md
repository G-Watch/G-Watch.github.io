---
title: 配置
description: 通过 lib/site-config.ts 定制站点名称、页脚、导航与各语言的文案。
group: 配置
order: 1
---

# 配置

克隆 goodoc 后，你主要修改的文件是 `lib/site-config.ts`。它集中了品牌信息与落地页文案。
与语言无关的字段位于顶层；任何需要翻译的内容都放在 `locales` 之下。

## 共享字段

```ts
export const siteConfig: SiteConfig = {
  name: "goodoc",                         // 页眉/页脚中的标志文字
  repo: "https://github.com/zobinHuang/goodoc",
  social: [{ label: "GitHub", href: "https://github.com/zobinHuang/goodoc" }],

  // 页脚行："<projectName> <duration> | Powered by Goodoc"
  projectName: "goodoc",
  duration: "2024 – 2026",
  poweredBy: { label: "Goodoc", href: "https://github.com/zobinHuang/goodoc" },

  locales: { en: { /* … */ }, zh: { /* … */ } },
};
```

页脚会自动渲染那一行署名信息 —— 把 `projectName` 和 `duration` 改成你自己的即可。

## 各语言文案

`locales` 下的每一项都保存着一种语言的文案：

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
      image: "/features/landing.svg",   // 可选插图（位于 public/ 下）
    },
    // …
  ],
  quickstart: {
    title: "Install and start in a minute",
    intro: "Pull in the package, then you immediately have something to run.",
    command: "pip3 install goodoc",      // 在终端块中显示
    steps: [
      { title: "Run it", body: "`goodoc serve` starts a local site." },
      // …
    ],
    note: "Replace with your own.",
  },
  nav: [
    { label: "Docs", href: "/docs/" },   // label 本地化；href 按语言相对
    { label: "Blog", href: "/blog/" },
  ],
  footerNote: "Written in Markdown, rendered for humans and machines.",
},
```

- **`features[].image`** 是可选的 —— 在 `public/` 下提供一张 SVG/PNG
  来给卡片配图，或者省略它只用文字。
- **`quickstart`** 驱动落地页的安装区块：一个显示 `command` 的终端，加上带编号的
  `steps`。在某个步骤的 `body` 中用反引号来写行内代码。
- **`nav`** 的 label 会按语言翻译；`href` 保持语言相对
  （`/docs/`），语言前缀会自动加上。

要添加一种语言？参见[国际化](/docs/humanize/i18n/)。

## 主题与字体

调色板与字体映射位于 `app/theme.css`（由你自定义；升级时永远不会被覆盖）：

```css
@theme {
  --color-paper: #fbf9f4;   /* 背景纸色 */
  --color-ink: #2b2925;     /* 正文墨色 */
  --color-accent: #a65a3f;  /* 陶土色强调 */
  --font-sans: var(--font-pt-sans), …;
}
```

改这几个变量，就能换出一套全新配色。字体本身在 `app/layout.tsx` 中通过
`next/font/google` 加载，默认 PT Sans / PT Serif / PT Mono。界面字符串
（侧边栏标签、“On this page”等）位于 `lib/dictionaries.ts`。
