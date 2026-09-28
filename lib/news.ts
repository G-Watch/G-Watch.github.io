// User-owned news feed for the hero's right-hand column (lib/hero-news.tsx).
//
// Newest first. Add an entry per locale; `href` is locale-relative
// ("/open-traces/") or absolute ("https://…", opened in a new tab). Only the
// first NEWS_LIMIT entries are shown.
import type { Locale } from "./i18n";

export type NewsLinkIcon = "docs" | "blog" | "paper";

export interface NewsItem {
  /** ISO date, e.g. "2026-09-10". */
  date: string;
  title: string;
  /** A sentence under the title; wraps if it has to. */
  summary?: string;
  href?: string;
  /** Icon links after the title, for an entry that has several places to go. */
  links?: { label: string; href: string; icon: NewsLinkIcon }[];
  /** A looping clip under the entry; paths under public/. */
  video?: { src: string; poster?: string; alt: string };
}

export const NEWS_LIMIT = 5;

export const news: Record<Locale, NewsItem[]> = {
  en: [
    {
      date: "2026-08-25",
      title: "We release Xtrace!",
      summary: "High-fidelity GPU kernel tracing for your code agent",
      links: [
        { label: "Docs", href: "/docs/humanize/xtrace/index/", icon: "docs" },
        { label: "Blog", href: "/blog/humanize/releasing-xtrace/", icon: "blog" },
        { label: "Paper", href: "https://arxiv.org/abs/2609.28769", icon: "paper" },
      ],
      video: {
        src: "/news/xtrace-agent-en.mp4",
        poster: "/news/xtrace-agent-en-poster.webp",
        alt: "A code agent traces a FlashAttention-4 kernel; a region is selected in the trace, copied, and pasted back to the agent, which finds the stall and fixes it.",
      },
    },
  ],
  zh: [
    {
      date: "2026-08-25",
      title: "Xtrace 发布！",
      summary: "为你的代码智能体提供高保真的 GPU kernel 追踪",
      links: [
        { label: "文档", href: "/docs/humanize/xtrace/index/", icon: "docs" },
        { label: "博客", href: "/blog/humanize/releasing-xtrace/", icon: "blog" },
        { label: "论文", href: "https://arxiv.org/abs/2609.28769", icon: "paper" },
      ],
      video: {
        src: "/news/xtrace-agent-zh.mp4",
        poster: "/news/xtrace-agent-zh-poster.webp",
        alt: "代码智能体追踪 FlashAttention-4 kernel；在 trace 里框选一块区域、复制并贴回给智能体，它据此找到停顿并完成优化。",
      },
    },
  ],
};
