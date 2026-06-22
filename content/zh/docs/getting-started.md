---
title: 快速开始
description: 克隆 goodoc，填入你的内容，几分钟内拥有一个文艺的项目站点。
group: 开始
order: 1
---

# 快速开始

**goodoc** 是一个用来承载项目主页、文档与博客的静态站点框架。它的设计目标很简单：让你只用写 Markdown，就能得到一个排版讲究、对人和机器都友好的站点。

## 安装

```bash
# 克隆框架
git clone https://github.com/zobinHuang/goodoc.git my-project
cd my-project

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

打开 <http://localhost:3000> 即可看到站点。

## 目录结构

```text
my-project/
├── app/
│   └── theme.css       # ← 调色板与字体令牌（由你自定义）
├── components/         # UI 组件（框架）
├── lib/
│   └── site-config.ts  # ← 项目名、文案、导航、页脚（你改得最多的文件）
├── content/
│   └── en/             # ← 默认语言；按需添加 zh/ 等
│       ├── docs/       # ← 文档 Markdown
│       └── blog/       # ← 博客 Markdown
├── public/             # 图片等静态资源
├── dev-docs/           # 框架自身的开发文档
└── goodoc.manifest.json # 区分框架文件与你的文件（升级时使用）
```

站点默认支持多语言（英语优先）；内容按语言组织在 `content/<locale>/`
之下。参见[国际化](/docs/humanize/i18n/)。

## 三步上线

1. 编辑 `lib/site-config.ts`，设置你的项目名、标语、导航以及各语言的文案。
   在 `app/theme.css` 中调整调色板。
2. 把文档 Markdown 丢进 `content/en/docs/`、博客文章丢进
   `content/en/blog/`（以及你后续添加的其他语言）。
3. 推送到 GitHub，由 Actions 自动构建并发布到 GitHub Pages。

> 想了解每一篇 Markdown 该怎么写、支持哪些 frontmatter 字段？继续读
> [写作内容](/docs/humanize/writing-content/)。
