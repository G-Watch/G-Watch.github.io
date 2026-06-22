# 决策记录（ADR）

按时间倒序记录关键决策与取舍。

## 2026-06-22 · i18n、署名、落地页增强、升级机制

### i18n：locale 前缀路由，默认 English
- **决策**：所有页面置于 `app/[lang]/`，URL 形如 `/en/…`、`/zh/…`；根 `/` 客户端
  跳转到默认 locale。内容按 `content/<locale>/` 组织，缺失文档回退默认 locale。
- **理由**：静态导出不支持 middleware/重定向式 i18n；locale 前缀是纯静态友好且
  对 SEO/分享友好的标准做法。
- **代价**：`<html lang>` 在静态层为默认值，靠客户端 `html-lang.tsx` 校正（可接受）。

### 内容文案 vs UI 文案分离
- **决策**：项目文案（hero/features/nav/quickstart/footer）放 `lib/site-config.ts`
  的 `locales[lang]`；框架 UI chrome 文案放 `lib/dictionaries.ts`。
- **理由**：用户改自己项目的话术，不必碰框架 UI 字符串；升级时边界清晰。

### 主题令牌拆分到 `app/theme.css`
- **决策**：调色板/字体令牌移到用户拥有的 `app/theme.css`，渲染 CSS 留在框架的
  `app/globals.css`（用 `@import` 引入）。
- **理由**：让升级机制能更新渲染 CSS，同时永不覆盖用户配色。

### 模板升级：manifest + git checkout，边界互斥
- **决策**：`goodoc.manifest.json` 声明 framework/userOwned/review 三类路径，
  `scripts/upgrade.mjs` 对 framework 路径 `git checkout <ref> -- <path>`。要求
  framework 与 userOwned 路径**互不重叠**，从而无需备份/还原。
- **理由**：git-native、可 diff、可回滚；互斥不变式让实现简单且安全。
- **代价**：上游删除的文件不自动删除；`package.json` 改为产出 `.upstream` 供人工合并。

## 2026-06-21 · 初始框架

### 技术栈：Next.js 16 + 静态导出 + 单项目模板
- **背景**：需要一个承载未来各项目主页/文档/博客的框架。
- **决策**：Next.js App Router；`output: "export"` 纯静态；按"克隆复用"的单项目
  模板组织（非多项目门户）。
- **理由**：App Router 便于按 URL 分发 humanize/agent 双视图；静态导出适配
  GitHub Pages、零运维；单项目模板结构最简单清晰。
- **代价**：放弃 SSR/ISR；agent 视图也须构建期预生成（对静态内容无碍）。

### 双视图共享单一渲染管线
- **决策**：humanize 与 agent 调用同一 `renderMarkdown()`，仅外壳不同。
- **理由**：内容永不脱节；维护成本最低。

### 给机器渲染 HTML 而非直接给 `.md`
- **决策**：agent 视图输出已解析的干净语义化 HTML。
- **理由**：Markdown 含相对链接、内联 HTML、需 base path 的图片；预渲染后机器
  拿到的是可直接读取的结构，无需二次解析。

### 不做 HTML 清洗
- **决策**：管线放行任意内联 HTML（满足"支持 HTML 格式"需求）。
- **前提**：内容均为仓库内可信第一方。渲染不可信内容须另加 `rehype-sanitize`。

### 主题：仅 light、文艺风、PT 字体族
- **决策**：暖纸色 + 墨色 + 单一陶土强调色；PT Sans/Serif/Mono；无暗色模式。
- **理由**：用户明确要求偏文艺、非科技风、默认仅 light theme、字体用 PT Sans。

### 代码高亮用 Shiki
- **决策**：`@shikijs/rehype` + `github-light`，构建期生成内联着色。
- **理由**：与 GitHub README 观感一致；零运行时 JS。

## 注意：Next.js 16 与训练数据差异
- 本项目随附 `AGENTS.md`（由 create-next-app 生成）提示：此版 Next.js 有 breaking
  changes，改代码前应查 `node_modules/next/dist/docs/`。
- 已确认的关键差异：**页面组件的 `params` 现为 `Promise`，必须 `await`**。
- 该 `AGENTS.md`/`CLAUDE.md` 已删除（避免与仓库自身约定冲突）；此条记录留作提醒。
