<div align="center">
  <img src="./public/goodoc-mark.svg" alt="goodoc" width="160" />
  <h1>goodoc</h1>
  <p><em>承载项目主页、文档与博客的文档框架</em></p>
  <p><a href="./README.md">English</a> · <strong>简体中文</strong></p>
</div>

**goodoc** 把 Markdown 变成一个项目站点——落地页、文档、博客——并构建为可发布到
GitHub Pages 的静态站点。每篇文档与博客都有两种渲染：**humanize**（给人）与
**agent**（给机器的干净 HTML）。内置多语言（locale 前缀路由，默认英文）。

## 快速开始

```bash
git clone https://github.com/zobinHuang/goodoc.git my-project
cd my-project
npm install
npm run dev        # http://localhost:3000
```

1. 编辑 `lib/site-config.ts` —— 项目名、导航、落地页文案（调色板在 `app/theme.css`）。
2. 把 Markdown 放进 `content/<locale>/docs/` 与 `content/<locale>/blog/`
   （默认 locale 为 `en`）。
3. 推送到 GitHub，内置 Actions 自动发布到 Pages
   （**Settings → Pages → Source → GitHub Actions**）。

## Agent skill

仓库自带一个 agent skill：[`skills/goodoc/`](./skills/goodoc/SKILL.md)，
教 code agent（Claude、Codex、Gemini…）如何在本模板上写内容、配置、构建与部署。
用 [`skills`](https://www.npmjs.com/package/skills) CLI 安装与管理：

```bash
npx skills        # 安装 / 管理自带的 skill
```

## 构建与部署

```bash
npm run build                                 # 静态导出 → out/
NEXT_PUBLIC_BASE_PATH=/goodoc npm run build   # GitHub 项目站点（子路径）
```

## 升级

以 goodoc 为模板 clone 后，拉取上游框架更新而不动你的内容：

```bash
npm run upgrade
```

详见 [`UPGRADING.md`](./UPGRADING.md) 与 [`CHANGELOG.md`](./CHANGELOG.md)。

## 文档

- 站点内：访问 `/`（跳转到 `/en/`）或 `/en/docs/`。
- 框架内部文档：[`dev-docs/`](./dev-docs/)。

技术栈：Next.js 16（App Router）· React 19 · TypeScript · Tailwind CSS v4 · 静态导出。

## License

见 [LICENSE](./LICENSE)。
