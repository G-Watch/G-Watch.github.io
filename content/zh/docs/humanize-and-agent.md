---
title: Humanize 与 Agent 双视图
description: 从同一份 Markdown 文件，goodoc 生成两个版本——一个为人渲染，一个为机器渲染。
group: 写作
order: 2
---

# Humanize 与 Agent 双视图

goodoc 最有特色的功能：每一篇文档和博客文章都有**两个 URL**，对应两种渲染。

## 两个 URL

| 视图 | 文档 URL | 博客 URL |
| --- | --- | --- |
| Humanize | `/<lang>/docs/humanize/<slug>` | `/<lang>/blog/humanize/<slug>` |
| Agent | `/<lang>/docs/agent/<slug>` | `/<lang>/blog/agent/<slug>` |

（`<lang>` 是语言代码，例如 `en` 或 `zh`。）

页面右上角（博客文章则在标题下方）有一个切换开关，可以让你在两个视图之间跳转。

## Humanize：为人渲染

humanize 视图是默认的、对人友好的版本：

- 优雅的排版，PT Serif 标题搭配 PT Sans 正文；
- 代码高亮、表格和任务列表，就像 GitHub 的 README 一样；
- 侧边栏、页内目录以及上一篇/下一篇导航；
- 鼠标悬停在标题上时出现的锚点，方便分享某个具体位置。

## Agent：为机器渲染

agent 视图是剥离了所有装饰的语义化 HTML：

- 没有侧边栏、没有目录、没有站点导航；
- 等宽字体、清晰的结构，所有图片和文本都内联其中；
- 非常适合 LLM、爬虫，以及任何需要读取它的程序。

> 为什么要给机器一个专属视图？因为越来越多的“读者”是 agent。给它们一份干净的
> HTML 版本，它们就能远更准确地理解你的项目。

## 它们共享同一条渲染流水线

两个视图都来自**同一份 Markdown**、经过**同一条渲染流水线**；只是外层的页面外壳不同。
这意味着你只写一次内容，人和机器各取所需，两者永远不会发生偏离。

```text
content/en/docs/x.md
        │
   renderMarkdown()        ← 一条流水线：GFM + 内联 HTML + 代码高亮
        │
   ┌────┴─────┐
   ▼          ▼
humanize    agent
(带外壳)     (纯 HTML)
```
