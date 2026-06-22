import type { Locale } from "./i18n";

/**
 * UI chrome strings (framework-level), separate from your project's copy which
 * lives in lib/site-config.ts. Add a block here when you add a locale.
 */
export interface Dictionary {
  docsIndex: { eyebrow: string; title: string; intro: string };
  blogIndex: {
    eyebrow: string;
    title: string;
    intro: string;
    empty: string;
    readMore: string;
  };
  doc: { prev: string; next: string };
  toc: { title: string };
  view: { humanize: string; agent: string };
  agent: { banner: string; toHumanize: string };
  blogPost: { back: string };
  quickstart: { eyebrow: string };
  notFound: { title: string; body: string; home: string };
  language: string;
}

const en: Dictionary = {
  docsIndex: {
    eyebrow: "Documentation",
    title: "Docs",
    intro:
      "Every page offers a humanize (human-friendly) and an agent (machine-friendly) view. Clicking through opens the humanize rendering; switch to the agent view from within the page.",
  },
  blogIndex: {
    eyebrow: "Blog",
    title: "Blog",
    intro: "Recent notes and updates, written in Markdown.",
    empty: "No posts yet.",
    readMore: "Read more →",
  },
  doc: { prev: "← Previous", next: "Next →" },
  toc: { title: "On this page" },
  view: { humanize: "Humanize", agent: "Agent" },
  agent: {
    banner: "agent view · machine-readable HTML",
    toHumanize: "→ humanize view",
  },
  blogPost: { back: "← Back to blog" },
  quickstart: { eyebrow: "Quick start" },
  notFound: {
    title: "This page wandered off",
    body: "Maybe the link changed, or it never existed.",
    home: "Back home",
  },
  language: "Language",
};

const zh: Dictionary = {
  docsIndex: {
    eyebrow: "Documentation",
    title: "文档",
    intro:
      "每篇文档都提供 humanize（人类友好）与 agent（机器友好）两种视图。点击进入即为 humanize 渲染，页内可切换到 agent 视图。",
  },
  blogIndex: {
    eyebrow: "Blog",
    title: "博客",
    intro: "近期的随笔与更新，以 Markdown 写就。",
    empty: "还没有博客。",
    readMore: "阅读全文 →",
  },
  doc: { prev: "← 上一篇", next: "下一篇 →" },
  toc: { title: "本页内容" },
  view: { humanize: "Humanize", agent: "Agent" },
  agent: {
    banner: "agent view · 机器可读 HTML",
    toHumanize: "→ humanize 视图",
  },
  blogPost: { back: "← 返回博客" },
  quickstart: { eyebrow: "快速开始" },
  notFound: {
    title: "这一页走失了",
    body: "也许链接已经改变，或者它从未存在。",
    home: "回到首页",
  },
  language: "语言",
};

const dictionaries: Record<Locale, Dictionary> = { en, zh };

export function getDictionary(lang: Locale): Dictionary {
  return dictionaries[lang];
}
