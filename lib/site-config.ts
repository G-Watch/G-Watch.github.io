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

export interface FeatureCard {
  title: string;
  body: string;
  /** Optional illustration, e.g. "/features/landing.svg" (under public/). */
  image?: string;
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
        eyebrow: "Profiling · Program Analysis · Auto-Optimization",
        headline: "See inside your GPU kernels",
        subhead:
          "Hardware-counter profiling, instruction-level PC sampling, intra-kernel phase tracing, and SASS binary analysis — across NVIDIA, AMD, and TPU. Built so agents can profile, diagnose, and optimize kernels on their own.",
        primaryCta: { label: "Read the docs", href: "/docs/" },
        secondaryCta: { label: "Quickstart", href: "/docs/installation/" },
      },
      features: [
        {
          title: "Hardware-counter profiling",
          body: "Range profiling collects per-launch performance counters — occupancy, pipe/tensor-core utilization, memory throughput, achieved-vs-peak cycles — to pin the macro bottleneck: memory- vs compute-bound, pipe pressure.",
        },
        {
          title: "PC sampling & intra-kernel tracing",
          body: "Find which instructions stall and why (memory waits, dependency, divergence, throttles), mapped to source and SASS. Trace the in-kernel phase timeline to expose pipeline bubbles and synchronization overhead.",
        },
        {
          title: "Program & binary analysis",
          body: "Inspect compiler-generated SASS/AMDGPU binaries: demangle kernels, walk decoded instructions, map PC→source line, and dump the control-flow graph and basic blocks — for register analysis and binary instrumentation.",
        },
        {
          title: "Agentic auto-optimization",
          body: "Ships as agent skills that drive a reasoning-loop: profile → hypothesize → apply one minimal change → verify correctness, performance, and hardware behavior. Works for CUDA C++, Triton, CuTe, TileLang, and HIP.",
        },
      ],
      quickstart: {
        title: "Install in a minute",
        intro:
          "Install the package from PyPI, then add the agent skills so Claude, Codex, or Gemini can drive G-Watch for you.",
        command:
          "pip install gwatch\nnpx skills add mars-compute-ai/G-Watch -a claude-code -a codex -a gemini-cli",
        steps: [
          {
            title: "Profile a kernel",
            body: "Run a reference script under CUPTI — e.g. `do_range_profile.py` or `do_pc_sampling.py` — and dump a `.yaml` archive or interactive `.html` report.",
          },
          {
            title: "Diagnose the bottleneck",
            body: "Walk the diagnostic stack top-down: range profile → PC sampling → intra-kernel trace → SASS binary analysis.",
          },
          {
            title: "Let an agent optimize",
            body: "Point the auto-optimization skill at your workload; it iterates profile → change → verify until the kernel is measurably faster.",
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
        eyebrow: "性能剖析 · 程序分析 · 自动优化",
        headline: "看清 GPU kernel 内部发生了什么",
        subhead:
          "硬件计数器剖析、指令级 PC 采样、kernel 内 phase 追踪、SASS 二进制分析——覆盖 NVIDIA、AMD 与 TPU。专为智能体而设计，让它能自主完成剖析、诊断与优化。",
        primaryCta: { label: "阅读文档", href: "/docs/" },
        secondaryCta: { label: "快速开始", href: "/docs/installation/" },
      },
      features: [
        {
          title: "硬件计数器剖析",
          body: "Range profiling 按每次 launch 采集性能计数器——占用率、pipe/tensor core 利用率、访存吞吐、达成-对-峰值的 cycle 比——以定位宏观瓶颈：访存瓶颈还是计算瓶颈、pipe 压力。",
        },
        {
          title: "PC 采样与 kernel 内追踪",
          body: "找出哪些指令在 stall、为什么 stall（访存等待、依赖、分支发散、throttle），并映射到源码与 SASS。追踪 kernel 内 phase 时间线，揭示流水线气泡与同步开销。",
        },
        {
          title: "程序与二进制分析",
          body: "检视编译器生成的 SASS/AMDGPU 二进制：反混淆 kernel 名、遍历反汇编指令、映射 PC→源码行、导出控制流图与基本块——用于寄存器分析与二进制插桩。",
        },
        {
          title: "面向智能体的自动优化",
          body: "以 agent skill 形式提供，驱动推理闭环：剖析 → 提出假设 → 施加一处最小改动 → 验证正确性、性能与硬件行为。支持 CUDA C++、Triton、CuTe、TileLang 与 HIP。",
        },
      ],
      quickstart: {
        title: "一分钟安装",
        intro:
          "从 PyPI 安装包，再装上 agent skills，让 Claude、Codex 或 Gemini 帮你驱动 G-Watch。",
        command:
          "pip install gwatch\nnpx skills add mars-compute-ai/G-Watch -a claude-code -a codex -a gemini-cli",
        steps: [
          {
            title: "剖析一个 kernel",
            body: "在 CUPTI 下运行参考脚本——如 `do_range_profile.py` 或 `do_pc_sampling.py`——并导出 `.yaml` 归档或交互式 `.html` 报告。",
          },
          {
            title: "诊断瓶颈",
            body: "自上而下走诊断栈：range profile → PC 采样 → kernel 内追踪 → SASS 二进制分析。",
          },
          {
            title: "交给智能体优化",
            body: "把自动优化 skill 指向你的 workload，它会反复执行 剖析 → 改动 → 验证，直到 kernel 明显变快。",
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
