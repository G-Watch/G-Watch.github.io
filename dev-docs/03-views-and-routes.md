# 03 · 双视图与路由

## URL 约定

| 内容 | humanize（人） | agent（机器） |
| --- | --- | --- |
| 文档 | `/<lang>/docs/humanize/<slug>/` | `/<lang>/docs/agent/<slug>/` |
| 博客 | `/<lang>/blog/humanize/<slug>/` | `/<lang>/blog/agent/<slug>/` |

索引页：`/<lang>/docs/`（文档列表）、`/<lang>/blog/`（博客列表）、`/<lang>/`（落地页）；
根 `/` 重定向到默认 locale。`<lang>` 为 locale，如 `en`、`zh`。

> 所有 URL 带尾斜杠（`trailingSlash: true`），以便 GitHub Pages 用目录式
> `index.html` 提供服务。

## 路由实现

每个 `[...slug]` 动态路由都导出：

- **`generateStaticParams()`** —— 枚举该集合所有 slug，构建期为每篇生成静态页。
  没有它，静态导出会失败（动态路由必须穷举）。
- **`generateMetadata()`** —— 按文档生成 `<title>`/`description`。
- 默认导出的页面组件 —— **`params` 是 `Promise`**，必须 `await`（Next 16 行为）：

```tsx
export default async function DocPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string[] }>;
}) {
  const { lang: rawLang, slug } = await params;
  const lang = resolveLocale(rawLang);
  const doc = getDoc(lang, slug);
  if (!doc) notFound();
  const { html, toc } = await renderMarkdown(doc.body, { lang });
  // …
}
```

> 路由都在 `app/[lang]/` 下，所以页面 `params` 含 `lang`；`getDoc`/`getAllDocs`
> 等内容函数都接收 `lang`。详见 [07-i18n.md](./07-i18n.md)。

## humanize 页面布局

文档 humanize 页是三栏网格：

```text
lg:grid-cols-[220px_minmax(0,1fr)_180px]
   左：DocsSidebar      中：文章 + ViewSwitch      右：TableOfContents
```

博客 humanize 页是居中单栏（更偏编辑/随笔气质），不带侧边栏与目录。

## agent 页面布局

`AgentShell` 刻意极简：

- 一条说明性 banner（标注"agent view"并提供回 humanize 的链接）；
- 一个 `max-w-3xl` 的 `<main>`，内含 `.agent-doc` 文章；
- 无 `SiteHeader`/`SiteFooter`/侧边栏/目录；
- 正文用等宽字体，语义化标签，图片与文字全部内联。

## 为什么不用嵌套 layout 去掉 agent 外壳？

`app/docs/` 下同时有 humanize 与 agent；若加 `app/docs/layout.tsx` 会同时套到两者。
因此**不设** docs/blog 级 layout，改由各页面显式组合 `SiteShell` 或 `AgentShell`。
根 `layout.tsx` 只负责 `<html>`/`<body>` 与字体变量。
