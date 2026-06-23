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
}

export interface HeroMedia {
  /** "image" (default) or "video". */
  type?: "image" | "video";
  /** Source under public/ (e.g. "/hero.png"). */
  src: string;
  /** Poster frame for videos. */
  poster?: string;
  /** Alt text. */
  alt?: string;
  /**
   * Layout (read from the first item when an array is passed):
   * "below" (default) — floating card beneath the hero text;
   * "overlap" — same height band as the text, shifted to the side.
   */
  placement?: "below" | "overlap";
}

export interface FeatureCard {
  title: string;
  body: string;
  /** Optional illustration, e.g. "/features/landing.svg" (under public/). */
  image?: string;
  /** Optional looping video (muted), e.g. "/features/demo.mp4" — takes precedence over image. */
  video?: string;
  /** Poster frame shown for the video before it plays. */
  poster?: string;
}

export interface QuickstartStep {
  title: string;
  body: string;
}

export interface Quickstart {
  title: string;
  intro: string;
  /** Shown in a terminal block; may contain multiple lines. */
  command: string;
  steps: QuickstartStep[];
  note?: string;
}

export interface LocaleContent {
  tagline: string;
  description: string;
  hero: {
    eyebrow: string;
    headline: string;
    subhead: string;
    primaryCta: NavLink;
    secondaryCta: NavLink;
    /** Optional showcase image/video — a single item or an array (arrays crossfade). */
    media?: HeroMedia | HeroMedia[];
  };
  features: FeatureCard[];
  quickstart: Quickstart;
  /** Nav labels are localized; hrefs stay locale-relative ("/docs/"). */
  nav: NavLink[];
  footerNote: string;
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
  social: [{ label: "GitHub", href: "https://github.com/mars-compute-ai/G-Watch" }],

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
        headline: "See inside your GPU kernels",
        subhead:
          "Hardware-counter profiling, instruction-level PC sampling, intra-kernel phase tracing, and SASS binary analysis — across NVIDIA, AMD, and TPU. Built so agents can profile, diagnose, and optimize kernels on their own.",
        primaryCta: { label: "Read the docs", href: "/docs/" },
        secondaryCta: { label: "Quickstart", href: "/docs/humanize/installation/" },
      },
      features: [
        {
          title: "Counter-based profiling",
          body: "Range profiling collects per-launch hardware counters — occupancy, pipe/tensor-core utilization, memory throughput, achieved-vs-peak cycles — and PC sampling localizes the bottleneck to the instructions that stall and why (memory waits, dependency, divergence, throttles), mapped to source and SASS.",
          image: "/features/landing.svg",
        },
        {
          title: "Intra-kernel tracing",
          body: "Instrument device-side scope markers to trace the in-kernel phase timeline — per-phase durations, pipeline bubbles, synchronization overhead, and warp-role scheduling within a single launch. The only tool with this temporal view.",
          image: "/features/two-views.svg",
        },
        {
          title: "Binary analysis",
          body: "Inspect compiler-generated SASS/AMDGPU binaries: demangle kernels, walk decoded instructions, map PC→source line, and dump the control-flow graph and basic blocks — for register analysis and binary instrumentation.",
          image: "/features/blog.svg",
        },
        {
          title: "Agentic auto-optimization",
          body: "Ships as agent skills that drive a reasoning loop: profile → hypothesize → apply one minimal change → verify correctness, performance, and hardware behavior. Works for CUDA C++, Triton, CuTe, TileLang, and HIP.",
          image: "/features/static.svg",
        },
      ],
      quickstart: {
        title: "Install in a minute",
        intro:
          "Install the package and the agent skills, then just ask your agent to profile a kernel.",
        command:
          "pip3 install gwatch\nnpx skills add mars-compute-ai/G-Watch -g",
        steps: [
          {
            title: "Install G-Watch",
            body: "`pip3 install gwatch` pulls the profiling + program-analysis toolbox from PyPI.",
          },
          {
            title: "Install the agent skills",
            body: "`npx skills add mars-compute-ai/G-Watch -g` distributes the G-Watch skills to your coding agents globally.",
          },
          {
            title: "Ask your agent",
            body: "e.g. `Load the gwatch intra-kernel tracing skill and trace the matmul kernel in bench.py` — the agent profiles it and writes a report.",
          },
        ],
        note: "G-Watch supports NVIDIA and AMD GPUs and Google TPUs. See the docs for per-platform setup.",
      },
      nav: [
        { label: "Docs", href: "/docs/" },
        { label: "Blog", href: "/blog/" },
      ],
      footerNote: "Profiling and program analysis for agentic GPU/TPU kernel optimization.",
    },

    zh: {
      tagline: "面向智能体的 GPU/TPU kernel 优化工具箱",
      description:
        "G-Watch 是一个面向智能体（agent）的 GPU/TPU kernel 优化工具箱。它在 NVIDIA、AMD GPU 与 Google TPU 上提供丰富的性能剖析能力，并配备用于检视编译器生成的 kernel 二进制的程序分析工具。",
      hero: {
        eyebrow: "",
        headline: "看清 GPU kernel 内部发生了什么",
        subhead:
          "硬件计数器剖析、指令级 PC 采样、kernel 内 phase 追踪、SASS 二进制分析——覆盖 NVIDIA、AMD 与 TPU。专为智能体而设计，让它能自主完成剖析、诊断与优化。",
        primaryCta: { label: "阅读文档", href: "/docs/" },
        secondaryCta: { label: "快速开始", href: "/docs/humanize/installation/" },
      },
      features: [
        {
          title: "基于计数器的剖析",
          body: "Range profiling 按每次 launch 采集硬件计数器——占用率、pipe/tensor core 利用率、访存吞吐、达成-对-峰值的 cycle 比；PC 采样进一步把瓶颈定位到具体 stall 的指令及其原因（访存等待、依赖、分支发散、throttle），并映射到源码与 SASS。",
          image: "/features/landing.svg",
        },
        {
          title: "Kernel 内追踪",
          body: "通过设备侧 scope marker 追踪 kernel 内 phase 时间线——单次 launch 内各 phase 时长、流水线气泡、同步开销与 warp 角色调度。唯一具备这一时间视图的工具。",
          image: "/features/two-views.svg",
        },
        {
          title: "二进制分析",
          body: "检视编译器生成的 SASS/AMDGPU 二进制：反混淆 kernel 名、遍历反汇编指令、映射 PC→源码行、导出控制流图与基本块——用于寄存器分析与二进制插桩。",
          image: "/features/blog.svg",
        },
        {
          title: "面向智能体的自动优化",
          body: "以 agent skill 形式提供，驱动推理闭环：剖析 → 提出假设 → 施加一处最小改动 → 验证正确性、性能与硬件行为。支持 CUDA C++、Triton、CuTe、TileLang 与 HIP。",
          image: "/features/static.svg",
        },
      ],
      quickstart: {
        title: "一分钟安装",
        intro: "装上包与 agent skill，然后直接让你的智能体去剖析一个 kernel。",
        command:
          "pip3 install gwatch\nnpx skills add mars-compute-ai/G-Watch -g",
        steps: [
          {
            title: "安装 G-Watch",
            body: "`pip3 install gwatch` 从 PyPI 拉取剖析 + 程序分析工具箱。",
          },
          {
            title: "安装 agent skill",
            body: "`npx skills add mars-compute-ai/G-Watch -g` 把 G-Watch skills 全局分发给你的编程智能体。",
          },
          {
            title: "向智能体提问",
            body: "例如 `加载 gwatch intra-kernel tracing skill，追踪 bench.py 里的 matmul kernel`——智能体会完成剖析并写出报告。",
          },
        ],
        note: "G-Watch 支持 NVIDIA、AMD GPU 与 Google TPU。各平台的具体配置见文档。",
      },
      nav: [
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
