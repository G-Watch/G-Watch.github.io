# 04 · 主题与字体

整体风格：**文艺、编辑气质、暖纸色，仅 light theme**。无暗色模式（刻意为之）。

## 调色板

集中在 **`app/theme.css`**（用户拥有，升级不覆盖）的 `@theme` 块（Tailwind v4 令牌）。
框架的渲染 CSS 在 `app/globals.css`，通过 `@import "./theme.css"` 引入这些令牌：

```css
@theme {
  --color-paper: #fbf9f4;       /* 背景：暖纸色 */
  --color-paper-deep: #f4f0e7;  /* 次级背景 / 代码块底 */
  --color-surface: #ffffff;     /* 卡片 */
  --color-ink: #2b2925;         /* 正文主色（暖黑） */
  --color-ink-soft: #4a453d;    /* 次级正文 */
  --color-muted: #7a7368;       /* 辅助文字 */
  --color-line: #e7e1d4;        /* 边框 */
  --color-accent: #a65a3f;      /* 强调：陶土 / 黏土色 */
  --color-accent-strong: #884630;
  --color-accent-soft: #f1e7df;
}
```

这些令牌自动变成工具类：`bg-paper`、`text-ink`、`border-line`、`text-accent` 等。
**换主题只需改这十来个变量。**

## 字体

`app/layout.tsx` 用 `next/font/google` 自托管三款 PT 字体：

| 用途 | 字体 | CSS 变量 |
| --- | --- | --- |
| 正文 / UI | **PT Sans** | `--font-pt-sans` → `font-sans` |
| 标题 / 展示 | **PT Serif** | `--font-pt-serif` → `font-serif` |
| 代码 / 等宽 | **PT Mono** | `--font-pt-mono` → `font-mono` |

PT Sans/Serif 非可变字体，故显式指定 `weight: ["400","700"]`；PT Mono 仅 400。
全部构建期自托管为 woff2，无外部请求、无布局抖动。

## Prose 样式（humanize）

`.prose-goodoc` 在 `@tailwindcss/typography` 基础上覆写为文艺风：

- 标题用 PT Serif；`h2` 带底边线（GitHub 风）。
- 链接用细下划线，hover 变强调色。
- 行内代码 / 代码块用暖底 + 细边框。
- 标题锚点（`.heading-anchor`）默认隐藏，hover 时淡入。
- 引用块为暖色卡片样式。

代码块由 Shiki 以 `github-light` 着色（内联 style），`.prose-goodoc pre` 负责留白、
边框、圆角与横向滚动。

## Agent 样式

`.agent-doc` 是另一套极简规则：等宽字体、朴素边框、最大化可读结构，**不追求美观，
追求机器可解析**。

## 改主题的常见动作

| 想做 | 改哪里 |
| --- | --- |
| 换配色 | `app/theme.css` 的 `@theme` 变量（用户拥有，升级安全） |
| 换字体 | `app/layout.tsx` 的 `next/font` 导入 + `theme.css` 的 `--font-*`（layout 为框架文件） |
| 调 prose 细节 | `globals.css` 的 `.prose-goodoc` 规则（框架文件，升级会更新） |
| 调代码主题 | `lib/markdown.ts` 中 `rehypeShiki({ theme })`（框架文件） |
