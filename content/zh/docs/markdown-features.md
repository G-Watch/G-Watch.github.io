---
title: Markdown 渲染
description: goodoc 像 GitHub README 一样渲染 Markdown——代码高亮、表格、任务列表、内联 HTML。
group: 写作
order: 1
---

# Markdown 渲染

goodoc 的渲染遵循 **GitHub Flavored Markdown (GFM)**，并加入语法高亮。这一页本身就是一份渲染样张。

## 文本

支持 **粗体**、*斜体*、~~删除线~~、`行内代码`，以及自动链接 <https://github.com/zobinHuang/goodoc>。

## 代码高亮

代码块由 [Shiki](https://shiki.style) 以 `github-light` 主题高亮：

```ts
interface Doc {
  title: string;
  slug: string[];
}

async function render(doc: Doc): Promise<string> {
  const { html } = await renderMarkdown(doc.body);
  return html;
}
```

```python
def fib(n: int) -> int:
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
```

## 表格

| 视图 | URL | 面向 |
| --- | --- | --- |
| Humanize | `/<lang>/docs/humanize/…` | 人类读者 |
| Agent | `/<lang>/docs/agent/…` | 机器读者 |

## 任务列表

- [x] 落地页
- [x] 双视图文档
- [x] 博客
- [ ] 你的下一个项目

## 引用

> 文档不只是给人看的。
> 当机器也能干净地读到它，文档才真正完整。

## 内联 HTML

Markdown 里可以直接写 HTML，会被原样渲染：

<div align="center">
  <img src="/goodoc-mark.svg" alt="goodoc" width="160" />
  <p><em>上面这张图通过 <code>/goodoc-mark.svg</code> 引用，base path 会自动补全。</em></p>
</div>

## 嵌套列表

1. 第一层
   - 第二层 A
   - 第二层 B
     1. 第三层
2. 回到第一层
