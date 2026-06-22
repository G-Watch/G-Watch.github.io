# goodoc 开发文档

这是 **goodoc 框架自身**的开发文档（区别于 `content/` 下面向站点访客的文档）。
任何对框架结构、渲染管线、主题或部署的改动，都应在这里同步更新。

## 索引

| 文档 | 内容 |
| --- | --- |
| [01-architecture.md](./01-architecture.md) | 整体架构、技术选型与目录约定 |
| [02-content-and-rendering.md](./02-content-and-rendering.md) | 内容加载与 Markdown 渲染管线 |
| [03-views-and-routes.md](./03-views-and-routes.md) | humanize / agent 双视图与路由 |
| [04-theming.md](./04-theming.md) | 主题、调色板与字体 |
| [05-deployment.md](./05-deployment.md) | 构建、静态导出、base path 与 CI |
| [06-conventions.md](./06-conventions.md) | 代码约定与扩展指南 |
| [07-i18n.md](./07-i18n.md) | 国际化（locale 路由、字典、内容回退） |
| [08-upgrades.md](./08-upgrades.md) | 模板升级机制（framework vs user 边界） |
| [decisions.md](./decisions.md) | 关键决策记录（ADR） |

## TL;DR

- **技术栈**：Next.js 16（App Router）+ React 19 + TypeScript + Tailwind CSS v4。
- **输出**：纯静态导出（`output: "export"`），产物在 `out/`，托管于 GitHub Pages。
- **i18n**：locale 前缀路由（`/en`、`/zh`），默认 English；内容按 `content/<locale>/` 组织。
- **内容**：`content/<locale>/docs` 与 `content/<locale>/blog` 下的 Markdown + frontmatter。
- **渲染**：`unified` 管线（remark/rehype）+ Shiki 高亮，输出 HTML 字符串。
- **双视图**：同一份渲染结果，套不同外壳 —— humanize（给人）/ agent（给机器）。
- **升级**：`npm run upgrade` 按 `goodoc.manifest.json` 拉取上游框架更新，不动用户内容。
- **Agent skill**：`skills/goodoc/SKILL.md` 是单一来源的 skill 文件，指导 code agent
  （Claude/Codex/Gemini）基于本模板写文档/博客、配置落地页与主题、管理 i18n、构建与部署、
  升级；可用 `npx skills` 分发给各 agent（framework-owned，随模板分发）。

## 本地开发

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # 静态导出到 out/
npm run lint
```

> ⚠️ 本项目使用的 Next.js 16 与训练数据中的旧版本有差异。改动路由/渲染相关代码前，
> 建议先查阅 `node_modules/next/dist/docs/` 内的官方指南（见 `decisions.md`）。
