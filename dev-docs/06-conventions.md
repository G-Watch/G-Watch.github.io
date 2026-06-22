# 06 · 约定与扩展

## 代码约定

- **TypeScript 严格模式**，路径别名 `@/*` 指向仓库根。
- **Server Components 优先**；仅在需要浏览器 API 时加 `"use client"`
  （目前只有 `site-header.tsx` 与 `table-of-contents.tsx`）。
- 组件文件用 kebab-case，导出命名组件（非默认导出），页面用默认导出。
- 注释解释"为什么"，与周边风格一致；中文内容文案，英文代码与标识符。

## 静态导出红线

以下能力在 `output: "export"` 下**不可用**，引入即破坏构建：

- 依赖请求的 Route Handler、`cookies()`、`headers()`、中间件/proxy；
- `redirect`/`rewrite`/`headers` 配置；
- 默认 loader 的 `next/image`（已设 `unoptimized: true` 规避）；
- 没有 `generateStaticParams()` 的动态路由。

新增动态路由时，**务必**提供 `generateStaticParams()`。

## 扩展指南

### 加一种内容集合（如 `notes`）

1. 在 `lib/content.ts` 的 `Collection` 联合类型加 `"notes"`，补 loader 函数。
2. 建 `app/notes/humanize/[...slug]/` 与 `app/notes/agent/[...slug]/`，仿 docs/blog。
3. 加索引页 `app/notes/page.tsx`，必要时在 `site-config.ts` 的 `nav` 增项。

### 加 Markdown 能力（如脚注、数学公式）

在 `lib/markdown.ts` 的管线插入对应 remark/rehype 插件。注意顺序：
remark 插件在 `remark-rehype` 之前，rehype 插件在之后；`rehype-raw` 要在引入内联
HTML 之后、`rehype-slug` 之前。

### 渲染不可信内容

当前管线放行任意 HTML。若要渲染外部/用户提交内容，在 `rehype-raw` 后加
`rehype-sanitize` 并配置白名单。

## 维护本开发文档

改动框架后，请同步更新：

- 结构/选型变化 → `01-architecture.md`、`decisions.md`
- 内容或管线变化 → `02-content-and-rendering.md`
- 路由/视图变化 → `03-views-and-routes.md`
- 主题/字体变化 → `04-theming.md`
- 构建/部署变化 → `05-deployment.md`
