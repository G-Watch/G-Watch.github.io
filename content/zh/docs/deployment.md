---
title: 部署到 GitHub Pages
description: goodoc 构建出纯静态站点，你可以一键发布到 GitHub Pages 或任意静态托管平台。
group: 部署
order: 1
---

# 部署到 GitHub Pages

goodoc 使用 Next.js 静态导出（`output: "export"`），因此 `npm run build` 会在 `out/`
目录生成纯静态的 HTML/CSS/JS，可托管到任意静态平台。

## 本地构建

```bash
npm run build      # 输出到 out/
npx serve out      # 在本地预览静态产物
```

## Base Path

GitHub 的*项目*站点地址形如 `https://<username>.github.io/<repo-name>/`，站点位于一个子路径之下。
这种情况下你需要设置 base path：

```bash
NEXT_PUBLIC_BASE_PATH=/goodoc npm run build
```

`next.config.ts` 会读取这个环境变量，并自动为所有链接和资源加上前缀。base path
**只对生产构建生效** —— `npm run dev` 始终从根路径提供服务，所以即便你的 shell 中残留了
`NEXT_PUBLIC_BASE_PATH`，也绝不会让开发站点 404。

## GitHub Actions

仓库自带 `.github/workflows/deploy.yml`；推送到 `main` 分支即可自动构建并发布。
你只需进入仓库设置，把 **Settings → Pages → Source** 设为 **GitHub Actions**。

工作流大致如下：

```yaml
- run: npm ci
- run: npm run build
  env:
    NEXT_PUBLIC_BASE_PATH: /${{ github.event.repository.name }}
- uses: actions/upload-pages-artifact@v3
  with:
    path: ./out
```

> 对于自定义域名或用户页面（`<username>.github.io`），它们部署在根路径，无需 base path
> —— 把 `NEXT_PUBLIC_BASE_PATH` 留空即可。

## 其他托管平台

`out/` 只是普通的静态文件，因此也可以部署到 Netlify、Cloudflare Pages、Nginx 或任意其他
静态托管平台。
