import type { Locale } from "./i18n";

/**
 * Your project's configuration — the main file you edit when cloning goodoc.
 *
 * Shared, language-neutral fields live at the top level; everything that needs
 * translating lives under `locales`. Add a locale here when you add one to
 * lib/i18n.ts.
 */
export interface NavLink {
  label: string;
  href: string;
  /** Key into the navIcons registry in lib/nav-icons.tsx; shown before the label. */
  icon?: string;
}

/**
 * Hero showcase item. Either a media asset (image/video) or a custom React
 * component registered in `lib/hero-slots.tsx`.
 *
 * `placement` (read from the first item when an array is passed):
 * "below" (default) — floating card beneath the hero text;
 * "overlap" — same height band as the text, shifted to the side.
 */
/**
 * Overlap-frame tuning for a hero showcase item.
 * - `feather`: edge fade 0 (sharp) … 1 (strong). Default 0.4 for image/video,
 *   0 for custom slots (so custom components keep crisp edges).
 * - `offsetX` / `width`: overlap geometry in %, read from the first item.
 * - `glow`: ambient blur behind the showcase.
 */
export interface HeroMediaLayout {
  feather?: number;
  offsetX?: number;
  width?: number;
  glow?: boolean;
  /** Overlap text-col : showcase-col width ratio (1 = equal; >1 favors the text). */
  textRatio?: number;
}

export type HeroMedia =
  | {
      /** "image" (default) or "video". */
      type?: "image" | "video";
      /** Source under public/ (e.g. "/hero.png"). */
      src: string;
      /** Poster frame for videos. */
      poster?: string;
      /** Alt text. */
      alt?: string;
      placement?: "below" | "overlap";
      layout?: HeroMediaLayout;
    }
  | {
      /** A custom React component from lib/hero-slots.tsx. */
      type: "custom";
      /** Key into the heroSlots registry in lib/hero-slots.tsx. */
      slot: string;
      placement?: "below" | "overlap";
      layout?: HeroMediaLayout;
    };

export interface FeatureCard {
  title: string;
  body: string;
  /** Optional illustration, e.g. "/features/landing.svg" (under public/). */
  image?: string;
  /** Optional looping video (muted), e.g. "/features/demo.mp4" — takes precedence over image. */
  video?: string;
  /** Poster frame shown for the video before it plays. */
  poster?: string;
  /** Custom visual component for the card media, keyed into lib/feature-slots.tsx. Takes precedence over video/image. */
  slot?: string;
  /** Makes the whole card a link (locale-relative, e.g. "/docs/humanize/..."). */
  href?: string;
}

/** One step of the mocked agent session in the quick start. */
export type AgentStep =
  /** A tool call; `out` lines starting "+ " / "- " render as a diff. */
  | { kind: "tool"; name: string; arg: string; busy: string; out?: string[] }
  /** The agent talking. */
  | { kind: "say"; text: string; busy?: string };

export interface Quickstart {
  title: string;
  install: { label: string; commands: string[] };
  agent: {
    label: string;
    /** Working directory shown in the session header. */
    cwd: string;
    prompt: string;
    steps: AgentStep[];
  };
}

export interface LocaleContent {
  tagline: string;
  description: string;
  hero: {
    eyebrow: string;
    headline: string;
    /**
     * Turns one substring of `headline` into a link. Kept separate so the
     * headline itself stays plain text for titles and metadata.
     */
    headlineLink?: { text: string; href: string };
    subhead: string;
    /** Call-to-action buttons. Ignored when `actions` is set. */
    primaryCta?: NavLink;
    secondaryCta?: NavLink;
    /**
     * Key into the heroSlots registry in lib/hero-slots.tsx, rendered in place
     * of the two CTA buttons.
     */
    actions?: string;
    /** Optional showcase image/video — a single item or an array (arrays crossfade). */
    media?: HeroMedia | HeroMedia[];
    /** Optional attribution line below the subhead, with one inline link. */
    note?: {
      prefix?: string;
      link?: { label: string; href: string };
      suffix?: string;
      style?: {
        variant?: "text" | "pill";
        tone?: "muted" | "soft" | "ink" | "accent";
        size?: "xs" | "sm" | "base";
        className?: string;
        linkClassName?: string;
      };
    };
  };
  features: FeatureCard[];
  quickstart: Quickstart;
  /** Nav labels are localized; hrefs stay locale-relative ("/docs/"). */
  nav: NavLink[];
  footerNote: string;
  /** Sentence under footerNote, with one inline link (e.g. the owning org). */
  footerAttribution?: {
    prefix?: string;
    link?: { label: string; href: string };
    suffix?: string;
  };
}

export interface Brand {
  /** "logo-and-name" | "logo-only" | "name-only". */
  mode: "logo-and-name" | "logo-only" | "name-only";
  /** Image under public/ (e.g. "/logo.svg"). Ignored in "name-only" mode. */
  logo?: string;
  /** Alt text for the logo image; falls back to `name`. */
  logoAlt?: string;
}

export interface SiteConfig {
  /** Brand wordmark shown in the header/footer. */
  name: string;
  /** Brand lockup mode shown in the header/footer. */
  brand: Brand;
  /** Upstream repository (used by the footer "Powered by" link and upgrades). */
  repo: string;
  social: NavLink[];

  /** Footer line: "<projectName> <duration> | Powered by Goodoc". */
  projectName: string;
  duration: string;
  poweredBy: { label: string; href: string };

  locales: Record<Locale, LocaleContent>;
}

export const siteConfig: SiteConfig = {
  name: "G-Watch",
  brand: { mode: "name-only" },
  repo: "https://github.com/mars-compute-ai/G-Watch",
  social: [
    { label: "GitHub", href: "https://github.com/mars-compute-ai/G-Watch" },
  ],

  projectName: "G-Watch",
  duration: "2024 – 2026",
  poweredBy: { label: "Goodoc", href: "https://github.com/zobinHuang/goodoc" },

  locales: {
    en: {
      tagline: "A toolbox for agentic GPU/TPU kernel optimization",
      description:
        "G-Watch is a toolbox for agentic GPU/TPU kernel optimization. It offers rich profiling on NVIDIA and AMD GPUs and Google TPUs, plus program-analysis tools for inspecting compiler-generated kernel binaries.",
      hero: {
        eyebrow: "",
        headline: "Boosting RSI for AI Infra",
        subhead:
          "G-Watch is an advanced analysis framework for GPU execution. It integrates a comprehensive toolset featuring Xtrace, binary analysis, microbenchmarking, and more. It equips AI agents with precise data for autonomous optimization on NVIDIA and AMD hardwares.",
        actions: "install",
        media: {
          type: "custom",
          slot: "news",
          placement: "overlap",
          layout: { textRatio: 1.3, offsetX: 0, width: 100 },
        },
      },
      features: [],
      quickstart: {
        title: "Quick start",
        install: {
          label: "Install",
          commands: [
            "pip3 install gwatch",
            "npx skills add mars-compute-ai/G-Watch -g",
          ],
        },
        agent: {
          label: "Ask your agent",
          cwd: "~/attention",
          prompt: "Trace the attention kernel in bench.py and find where it stalls",
          steps: [
            {
              kind: "tool",
              name: "Skill",
              arg: "gwatch-cuda-intra-kernel-tracing",
              busy: "Loading",
            },
            {
              kind: "tool",
              name: "Bash",
              arg: "python bench.py --trace trace.json",
              busy: "Tracing",
              out: ["Wrote trace.json"],
            },
            {
              kind: "tool",
              name: "Bash",
              arg: "gwatch show trace.json --bubbles",
              busy: "Reading",
              out: ["Longest bubbles: producer warp, before each KV load"],
            },
            {
              kind: "say",
              text: "The producer waits for a free KV slot before every load, so the mainloop stalls. A third pipeline stage should hide it.",
              busy: "Thinking",
            },
            {
              kind: "tool",
              name: "Update",
              arg: "attention.py",
              busy: "Editing",
              out: ["- kv_stages = 2", "+ kv_stages = 3"],
            },
            {
              kind: "tool",
              name: "Bash",
              arg: "gwatch show trace.json --bubbles",
              busy: "Re-tracing",
              out: ["The producer no longer stalls the mainloop"],
            },
          ],
        },
      },
      nav: [
        {
          label: "Open Traces",
          href: "/open-traces/",
          icon: "view-object-track",
        },
        // Hidden while the calculator is still being built. Put this line
        // back and rename app/[lang]/_calculator back to `calculator` to
        // return it to the site.
        // { label: "Calculator", href: "/calculator/", icon: "calculate" },
        { label: "Docs", href: "/docs/" },
        { label: "Blog", href: "/blog/" },
      ],
      footerNote:
        "Profiling and program analysis for agentic GPU/TPU kernel optimization.",
    },

    zh: {
      tagline: "面向智能体的 GPU/TPU kernel 优化工具箱",
      description:
        "G-Watch 是一个面向智能体（agent）的 GPU/TPU kernel 优化工具箱。它在 NVIDIA、AMD GPU 与 Google TPU 上提供丰富的性能剖析能力，并配备用于检视编译器生成的 kernel 二进制的程序分析工具。",
      hero: {
        eyebrow: "",
        headline: "为 AI Infra 加速 RSI",
        subhead:
          "G-Watch 是一款面向 GPU 运行分析的框架。它集成了包含 Xtrace、GPU 二进制分析、微基准测试在内的多项技术，旨在为 AI Agent 提供精确数据，助力其在 NVIDIA 和 AMD 硬件上实现全自动优化。",
        actions: "installZh",
        media: {
          type: "custom",
          slot: "newsZh",
          placement: "overlap",
          layout: { textRatio: 1.3, offsetX: 0, width: 100 },
        },
      },
      features: [],
      quickstart: {
        title: "快速开始",
        install: {
          label: "安装",
          commands: [
            "pip3 install gwatch",
            "npx skills add mars-compute-ai/G-Watch -g",
          ],
        },
        agent: {
          label: "交给智能体",
          cwd: "~/attention",
          prompt: "追踪 bench.py 里的 attention kernel，找出它卡在哪里",
          steps: [
            {
              kind: "tool",
              name: "Skill",
              arg: "gwatch-cuda-intra-kernel-tracing",
              busy: "Loading",
            },
            {
              kind: "tool",
              name: "Bash",
              arg: "python bench.py --trace trace.json",
              busy: "Tracing",
              out: ["Wrote trace.json"],
            },
            {
              kind: "tool",
              name: "Bash",
              arg: "gwatch show trace.json --bubbles",
              busy: "Reading",
              out: ["Longest bubbles: producer warp, before each KV load"],
            },
            {
              kind: "say",
              text: "producer 每次加载前都在等空闲的 KV 槽位，mainloop 因此停顿。加一级流水线应该能把它藏住。",
              busy: "Thinking",
            },
            {
              kind: "tool",
              name: "Update",
              arg: "attention.py",
              busy: "Editing",
              out: ["- kv_stages = 2", "+ kv_stages = 3"],
            },
            {
              kind: "tool",
              name: "Bash",
              arg: "gwatch show trace.json --bubbles",
              busy: "Re-tracing",
              out: ["The producer no longer stalls the mainloop"],
            },
          ],
        },
      },
      nav: [
        {
          label: "Open Traces",
          href: "/open-traces/",
          icon: "view-object-track",
        },
        // Hidden with the English one above — both nav lists, or the site is
        // half-showing it.
        // { label: "计算器", href: "/calculator/", icon: "calculate" },
        { label: "文档", href: "/docs/" },
        { label: "博客", href: "/blog/" },
      ],
      footerNote: "为面向智能体的 GPU/TPU kernel 优化提供性能剖析与程序分析。",
    },
  },
};

export function getSiteContent(lang: Locale): LocaleContent {
  return siteConfig.locales[lang];
}
