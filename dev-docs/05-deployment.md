# 05 · 部署

## 静态导出

`next.config.ts` 设 `output: "export"`，`npm run build` 在 `out/` 生成纯静态站点。

```ts
// base path 仅在生产构建生效；dev 永远从根路径提供（见下）
const basePath =
  process.env.NODE_ENV === "production"
    ? (process.env.NEXT_PUBLIC_BASE_PATH ?? "")
    : "";
const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },  // 静态导出无图片优化服务
};
```

## Base path

GitHub *项目* 站点位于 `https://<user>.github.io/<repo>/` 子路径下，需设：

```bash
NEXT_PUBLIC_BASE_PATH=/<repo> npm run build
```

- `next/link`、`next/image` 会自动加前缀。
- Markdown 内 `/foo` 形式的链接/图片由 `rehypeLinkRewrite` 插件加前缀（路由还会
  加 locale 前缀，资源只加 base path）。
- 手写的裸 URL 用 `lib/paths.ts` 的 `withBasePath()`。

用户主页（`<user>.github.io`）或自定义域名部署在根路径，**留空**即可。

### base path 只在生产生效（重要）

`next.config.ts` 与 `lib/paths.ts` 都把 base path 限定为
`NODE_ENV === "production"` 才生效。因此 **`npm run dev` 永远从根路径提供**，
shell 里残留的 `NEXT_PUBLIC_BASE_PATH` 不会把整站 dev 打成 404。两处的判断必须
保持一致，否则 dev 下页面在根路径而内容图片却带了前缀，会导致图片 404。

## CI（`.github/workflows/deploy.yml`）

推送到 `main` 触发：

1. `npm ci` → `npm run build`，并设 `NEXT_PUBLIC_BASE_PATH=/${{ repo name }}`。
2. `touch out/.nojekyll`（禁用 Jekyll，让 `_next/` 原样提供）。
3. `upload-pages-artifact` + `deploy-pages` 发布。

仓库设置：**Settings → Pages → Source = GitHub Actions**。

> `.nojekyll` 同时通过 `public/.nojekyll` 冗余提供，确保非 Actions 部署也正确。

## 本地预览静态产物

```bash
npm run build
npx serve out      # 或任意静态服务器
```

注意：本地用 `serve out` 预览时 base path 为空；若构建时设了 base path，
访问路径需带上对应前缀。日常预览直接用 `npm run dev` 最方便。

## 其他静态主机

`out/` 是普通静态文件，可部署到 Netlify、Cloudflare Pages、Vercel（静态）、Nginx 等。
非 GitHub Pages 场景按需设置 `NEXT_PUBLIC_BASE_PATH`。
