// User-owned news feed for the hero's right-hand column (lib/hero-news.tsx).
//
// Newest first. Add an entry per locale; `href` is locale-relative
// ("/open-traces/") or absolute ("https://…", opened in a new tab). Only the
// first NEWS_LIMIT entries are shown.
import type { Locale } from "./i18n";

export interface NewsItem {
  /** ISO date, e.g. "2026-09-10". */
  date: string;
  title: string;
  /** A sentence under the title; wraps if it has to. */
  summary?: string;
  href?: string;
  /** A looping clip under the entry; paths under public/. */
  video?: { src: string; poster?: string; alt: string };
}

export const NEWS_LIMIT = 5;

export const news: Record<Locale, NewsItem[]> = {
  en: [
    {
      date: "2026-08-25",
      title: "Open Traces is live",
      summary: "A public catalog of intra-kernel traces for major LLM production kernels, powered by Xtrace.",
      href: "/open-traces/",
      video: {
        src: "/news/open-traces-en.mp4",
        poster: "/news/open-traces-en-poster.webp",
        alt: "The trace panel: hover, zoom into time and threads, pan, measure a span, reset.",
      },
    },
  ],
  zh: [
    {
      date: "2026-08-25",
      title: "开放 Trace 上线",
      summary: "面向主流 LLM 生产 kernel 的公开核内 trace 目录，由 Xtrace 驱动。",
      href: "/open-traces/",
      video: {
        src: "/news/open-traces-zh.mp4",
        poster: "/news/open-traces-zh-poster.webp",
        alt: "Trace 面板：悬停、缩放时间与线程、平移、测量区间、复位。",
      },
    },
  ],
};
