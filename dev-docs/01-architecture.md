# 01 · 架构

## 技术选型

| 关注点 | 选择 | 原因 |
| --- | --- | --- |
| 框架 | Next.js 16 App Router | 路由灵活，易于按 URL 分发 humanize/agent 双视图；SSG 成熟 |
| 渲染 | React 19 Server Components | 内容在构建期渲染，零客户端开销 |
| 样式 | Tailwind CSS v4 | `@theme` 令牌化调色板，主题易定制 |
| 排版 | `@tailwindcss/typography` | GitHub README 式的 prose 基线 |
| Markdown | `unified`（remark + rehype） | 可插拔管线，支持 GFM、内联 HTML、代码高亮 |
| 高亮 | Shiki（`github-light`） | 与 VS Code 同款语法着色，构建期生成、零运行时 |
| 部署 | 静态导出 → GitHub Pages | 无服务器、秒级加载、免费托管 |

详细取舍见 [decisions.md](./decisions.md)。

## 目录结构

```text
goodoc/
├── app/                      # App Router 路由
│   ├── layout.tsx            # 根布局：PT 字体、<html>/<body>
│   ├── globals.css           # 框架渲染 CSS（prose/agent）
│   ├── theme.css             # 主题令牌：调色板/字体（用户拥有）
│   ├── page.tsx              # 根 / → 重定向到默认 locale
│   ├── not-found.tsx         # 404
│   └── [lang]/               # locale 段（/en、/zh）
│       ├── layout.tsx        # 校验 locale + <html lang> 同步
│       ├── page.tsx          # 落地页
│       ├── docs/{page, humanize/[...slug], agent/[...slug]}
│       └── blog/{page, humanize/[...slug], agent/[...slug]}
├── components/               # UI 组件（见下）
├── lib/
│   ├── site-config.ts        # 项目品牌与各 locale 文案（用户主要改这里）
│   ├── i18n.ts               # locale 列表/默认/工具
│   ├── dictionaries.ts       # UI chrome 文案（en/zh）
│   ├── content.ts            # 读取 content/<locale>/，解析 frontmatter，回退
│   ├── markdown.ts           # Markdown → HTML 渲染管线（locale 感知）
│   ├── paths.ts              # base path 助手
│   └── format.ts             # 日期格式化（按 locale）
├── content/<locale>/         # 内容：en/、zh/ … 各含 docs/、blog/
├── public/                   # 静态资源（含 .nojekyll、features/）
├── dev-docs/                 # 本框架开发文档
├── scripts/upgrade.mjs       # 模板升级脚本
├── goodoc.manifest.json      # framework / user 所有权边界
├── UPGRADING.md · CHANGELOG.md
└── .github/workflows/deploy.yml
```

## 组件一览

| 组件 | 职责 | 客户端? |
| --- | --- | --- |
| `site-header.tsx` | 顶部导航，移动端菜单，active 高亮，语言切换 | 是（`usePathname`） |
| `language-switcher.tsx` | 切换 locale，保留当前路径 | 是（`usePathname`） |
| `html-lang.tsx` | 按 locale 校正 `<html lang>` | 是 |
| `root-redirect.tsx` | 根 `/` 跳转到默认 locale | 是 |
| `site-footer.tsx` | 页脚 + 署名行（Powered by Goodoc） | 否 |
| `site-shell.tsx` | header + main + footer 外壳 | 否 |
| `docs-sidebar.tsx` | 文档左侧分组导航 | 否 |
| `table-of-contents.tsx` | 右栏本页目录 + 滚动高亮 | 是（IntersectionObserver） |
| `view-switch.tsx` | humanize/agent 切换开关 | 否 |
| `prose.tsx` | 渲染 humanize 文章 HTML | 否 |
| `agent-shell.tsx` | agent 视图的极简外壳 | 否 |

## 数据流

```text
content/*.md ──► lib/content.ts ──► ContentItem { meta, body }
                                          │
                       generateStaticParams（构建期枚举所有 slug）
                                          │
ContentItem.body ──► lib/markdown.ts ──► { html, toc }
                                          │
                        ┌─────────────────┴─────────────────┐
                        ▼                                     ▼
              humanize 页面（SiteShell+Prose+TOC）      agent 页面（AgentShell）
```

所有页面都是 SSG：构建期生成静态 HTML，运行时无需服务器。
