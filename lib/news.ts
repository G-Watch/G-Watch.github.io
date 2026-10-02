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
        src: "/news/xtrace-explainer.mp4",
        poster: "/news/xtrace-explainer-poster.webp",
        alt: "How Xtrace works: the kernel is compiled as usual, probes are spliced into its SASS, and it runs on the GPU. A code agent then reads a region selected in the trace, finds the stall and fixes it; the clip ends on a wall of traced kernels.",
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
        src: "/news/xtrace-explainer.mp4",
        poster: "/news/xtrace-explainer-poster.webp",
        alt: "Xtrace 的工作原理：kernel 照常编译，探针插进它的 SASS，再上 GPU 运行。随后代码智能体读取 trace 里框选的区域，找到停顿并修复；最后是一面已追踪 kernel 的墙。",
      },
    },
  ],
};
