# 02 · 内容与渲染

## 内容加载（`lib/content.ts`）

内容是 `content/<locale>/docs` 与 `content/<locale>/blog` 下的 Markdown 文件
（默认 locale 为 `en`）。加载流程：

1. `walkMarkdown()` 递归收集某 locale 目录下的 `.md` / `.markdown` 文件。
2. `fileToItem()` 用 `gray-matter` 拆分 frontmatter 与正文，得到 `ContentItem`。
3. slug 来自相对 locale 目录的路径（不含 locale）：
   `content/en/docs/guide/setup.md` → `slug = ["guide","setup"]`。
4. `loadCollection(lang, …)` 先加载默认 locale，再用目标 locale 覆盖同名 slug，
   实现**缺失翻译回退默认 locale**。详见 [07-i18n.md](./07-i18n.md)。

```ts
interface ContentItem {
  collection: "docs" | "blog";
  slug: string[];        // ["guide", "setup"]
  slugPath: string;      // "guide/setup"
  title: string;
  description?: string;
  date?: string;         // blog
  order?: number;        // docs 排序
  group?: string;        // docs 分组
  tags?: string[];       // blog
  draft?: boolean;
  body: string;          // 原始 Markdown
}
```

排序约定：

- **docs**：先按 `order`（默认 1000）升序，再按标题。`getDocsNav(lang)` 按 `group` 归类。
  （内容函数 `getAllDocs(lang)`、`getDoc(lang, slug)` 等都以 `lang` 为首参。）
- **blog**：按 `date` 倒序（新在前）。

草稿（`draft: true`）在 `npm run dev` 可见，在生产构建（`NODE_ENV=production`）中过滤掉。

## 渲染管线（`lib/markdown.ts`）

`renderMarkdown(markdown, { lang })` 返回 `{ html, toc }`，是一条 `unified` 管线：

```text
remark-parse           解析 Markdown
  → remark-gfm         表格 / 任务列表 / 删除线 / 自动链接
  → remark-rehype      转 hast（allowDangerousHtml: true，放行内联 HTML）
  → rehype-raw         把内联 HTML 解析进 hast 树
  → rehype-slug        给标题加 id
  → rehypeCollectToc   收集 h2/h3 到目录（自定义插件）
  → rehype-autolink-headings   给标题追加 "#" 锚点
  → @shikijs/rehype    代码高亮（github-light）
  → rehypeLinkRewrite  重写 "/" 开头的 src/href（自定义插件，见下）
  → rehype-stringify   输出 HTML 字符串
```

两个自定义插件（同文件内）：

- **`rehypeCollectToc`**：遍历 hast，收集带 id 的 `h2`/`h3`，供右栏目录使用。
- **`rehypeLinkRewrite`**：把 Markdown 里 `/foo` 形式的链接/图片加上前缀——**路由**
  （无文件扩展名，如 `/docs/...`）加 `basePath` + 当前 locale；**资源**（有扩展名，如
  `/logo.svg`）只加 `basePath`，不本地化。`next/link` 会自管，但 Markdown 内的裸 URL 不会。

### 安全性说明

管线**有意不做 HTML 清洗**（无 `rehype-sanitize`），以满足"支持 HTML 格式"的需求。
前提是 **内容均来自仓库内可信的第一方 Markdown**。若未来要渲染不可信来源的内容，
必须在 `rehype-raw` 之后加入 `rehype-sanitize`。

## 同源双渲染

humanize 与 agent 调用**同一个 `renderMarkdown()`**，得到同一份 HTML：

- humanize 页面把 HTML 交给 `<Prose>`，落在 `.prose .prose-goodoc` 容器里。
- agent 页面把 HTML 交给 `<AgentShell>`，落在 `.agent-doc` 容器里，并在前面拼上
  `<h1>{title}</h1>`（humanize 的标题由页面 `<header>` 单独渲染，故正文 HTML 不含 h1）。

因此两视图内容**永不脱节**，差异只在外层 CSS 与页面外壳。
