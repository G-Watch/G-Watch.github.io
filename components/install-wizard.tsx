"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";

/**
 * PyTorch-style install selector: pick a G-Watch version, a platform
 * (CUDA / ROCm) and a CUDA toolkit version, get the matching install command.
 *
 * The CUDA 12.8 wheel (no +cu local tag) lives on PyPI; wheels for the other
 * CUDA versions are attached to the GitHub Release of the same version. ROCm
 * wheels are distributed on request only.
 *
 * Used from content/en/docs/installation.mdx (registered in
 * lib/mdx-components.tsx) and deep-linked from the hero arch buttons with
 * ?platform=cuda|rocm.
 *
 * NOTE: when publishing a new release, prepend its version to GWATCH_VERSIONS
 * (index 0 is treated as "latest", i.e. what `pip3 install gwatch` resolves
 * to, and feeds the GitHub Release asset URLs below).
 */
const GWATCH_VERSIONS = ["0.0.32", "0.0.31"] as const;
const LATEST_VERSION = GWATCH_VERSIONS[0];
const releaseBase = (version: string) =>
  `https://github.com/mars-compute-ai/G-Watch/releases/download/v${version}`;
const WHEEL_TAIL = "cp312-cp312-manylinux_2_28_x86_64.whl";
const CONTACT_EMAIL = "gwatch.dev.team@gmail.com";

/** The default (PyPI) CUDA version — must match DEFAULT_PYPI_BACKEND. */
const DEFAULT_CUDA = "12.8";
const CUDA_VERSIONS = ["12.8", "12.9", "13.0", "13.1", "13.2", "13.3"] as const;

type Platform = "cuda" | "rocm";
type CudaVersion = (typeof CUDA_VERSIONS)[number];
type GwatchVersion = (typeof GWATCH_VERSIONS)[number];

const STRINGS = {
  en: {
    gwatchVersion: "G-Watch version",
    platform: "Platform",
    cudaVersion: "CUDA version",
    installGwatch: "Install gwatch",
    installSkills: "Install the agent skills",
    copy: "Copy",
    copied: "Copied!",
    defaultBadge: "default",
    latestBadge: "latest",
    pypiNote: (v: string) =>
      `Installs gwatch ${v} from PyPI (built against CUDA ${DEFAULT_CUDA}).`,
    ghNote: (cu: string, v: string) =>
      `Installs the CUDA ${cu} wheel from the v${v} GitHub Release.`,
    py312Note:
      "Prebuilt wheels target Python 3.12 on x86_64 Linux (manylinux_2_28).",
    rocmTitle: "ROCm wheels are available on request",
    rocmBody:
      "AMD (ROCm) support is maintained privately and not published to PyPI. Contact us and we will send you a wheel matching your ROCm version.",
    rocmCta: "Contact us",
  },
  zh: {
    gwatchVersion: "G-Watch 版本",
    platform: "平台",
    cudaVersion: "CUDA 版本",
    installGwatch: "安装 gwatch",
    installSkills: "安装 agent skills",
    copy: "复制",
    copied: "已复制!",
    defaultBadge: "默认",
    latestBadge: "最新",
    pypiNote: (v: string) =>
      `从 PyPI 安装 gwatch ${v}(基于 CUDA ${DEFAULT_CUDA} 构建)。`,
    ghNote: (cu: string, v: string) =>
      `从 v${v} GitHub Release 安装 CUDA ${cu} 对应的 wheel。`,
    py312Note:
      "预编译 wheel 面向 x86_64 Linux 上的 Python 3.12(manylinux_2_28)。",
    rocmTitle: "ROCm wheel 需联系我们获取",
    rocmBody:
      "AMD(ROCm)支持为私有维护,未发布到 PyPI。联系我们,我们会提供与你的 ROCm 版本匹配的 wheel。",
    rocmCta: "联系我们",
  },
} satisfies Record<Locale, unknown>;

const SKILLS_COMMAND = "npx skills add mars-compute-ai/G-Watch -g";

function gwatchCommandFor(cuda: CudaVersion, version: GwatchVersion): string {
  if (cuda === DEFAULT_CUDA) {
    // the default-CUDA wheel is on PyPI; pin the version unless it's the latest
    return version === LATEST_VERSION
      ? "pip3 install gwatch"
      : `pip3 install gwatch==${version}`;
  }
  return `pip3 install ${releaseBase(version)}/gwatch-${version}+cu${cuda.replace(
    ".",
    "",
  )}-${WHEEL_TAIL}`;
}

function OptionButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-4 py-2 font-mono text-sm transition-colors ${
        active
          ? "border-accent bg-accent-soft font-bold text-accent-strong"
          : "border-line bg-surface text-ink-soft hover:border-accent hover:text-accent"
      }`}
    >
      {children}
    </button>
  );
}

/** One labeled terminal block (black background, light text) with its own
 * copy button. */
function CommandBlock({
  label,
  command,
  copyLabel,
  copiedLabel,
}: {
  label: string;
  command: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable (e.g. non-secure context) — ignore */
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="font-mono text-xs text-muted">{label}</p>
        <button
          type="button"
          onClick={copy}
          className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold text-ink-soft transition-colors hover:border-accent hover:text-accent"
        >
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      {/* Fixed black terminal so the light command text stays readable in
          both color themes. */}
      <div className="overflow-hidden rounded-xl border border-line bg-black">
        <pre className="overflow-x-auto px-5 py-4 font-mono text-sm leading-relaxed text-zinc-100">
          {command.split("\n").map((line, i) => (
            <div key={i}>
              <span className="select-none text-emerald-400">$ </span>
              {line}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

export function InstallWizard({ lang }: { lang?: Locale }) {
  const [locale, setLocale] = useState<Locale>(lang ?? "en");
  const [version, setVersion] = useState<GwatchVersion>(LATEST_VERSION);
  const [platform, setPlatform] = useState<Platform>("cuda");
  const [cuda, setCuda] = useState<CudaVersion>(DEFAULT_CUDA);

  // Client-side initialization (static export, so both are read on mount):
  //  - locale from the /en/ | /zh/ URL prefix when no explicit `lang` prop
  //    (the docs content is shared across locales via fallback);
  //  - platform preselect from ?platform= or #cuda / #rocm (deep links from
  //    the landing hero buttons).
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!lang) {
      const seg = url.pathname.split("/").filter(Boolean);
      // basePath-safe: look for a known locale anywhere in the leading segments
      if (seg.includes("zh")) setLocale("zh");
    }
    const fromQuery = url.searchParams.get("platform");
    const fromHash = url.hash.replace("#", "");
    const wanted = (fromQuery ?? fromHash).toLowerCase();
    if (wanted === "rocm" || wanted === "cuda") setPlatform(wanted);
  }, [lang]);

  const t = STRINGS[locale];

  return (
    <div className="not-prose my-8 overflow-hidden rounded-2xl border border-line bg-surface">
      {/* G-Watch version row */}
      <div className="grid gap-3 border-b border-line p-5 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
        <p className="font-mono text-xs text-muted">{t.gwatchVersion}</p>
        <div className="flex flex-wrap gap-2">
          {GWATCH_VERSIONS.map((v) => (
            <OptionButton key={v} active={version === v} onClick={() => setVersion(v)}>
              {v}
              {v === LATEST_VERSION && (
                <span className="ml-1.5 rounded bg-accent/15 px-1 py-0.5 text-[0.7em]">
                  {t.latestBadge}
                </span>
              )}
            </OptionButton>
          ))}
        </div>
      </div>

      {/* Platform row */}
      <div className="grid gap-3 border-b border-line p-5 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
        <p className="font-mono text-xs text-muted">{t.platform}</p>
        <div className="flex flex-wrap gap-2">
          <OptionButton active={platform === "cuda"} onClick={() => setPlatform("cuda")}>
            CUDA
          </OptionButton>
          <OptionButton active={platform === "rocm"} onClick={() => setPlatform("rocm")}>
            ROCm
          </OptionButton>
        </div>
      </div>

      {/* CUDA version row */}
      {platform === "cuda" && (
        <div className="grid gap-3 border-b border-line p-5 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
          <p className="font-mono text-xs text-muted">{t.cudaVersion}</p>
          <div className="flex flex-wrap gap-2">
            {CUDA_VERSIONS.map((v) => (
              <OptionButton key={v} active={cuda === v} onClick={() => setCuda(v)}>
                {v}
                {v === DEFAULT_CUDA && (
                  <span className="ml-1.5 rounded bg-accent/15 px-1 py-0.5 text-[0.7em]">
                    {t.defaultBadge}
                  </span>
                )}
              </OptionButton>
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {platform === "cuda" ? (
        <div className="space-y-5 p-5">
          <CommandBlock
            label={t.installGwatch}
            command={gwatchCommandFor(cuda, version)}
            copyLabel={t.copy}
            copiedLabel={t.copied}
          />
          <CommandBlock
            label={t.installSkills}
            command={SKILLS_COMMAND}
            copyLabel={t.copy}
            copiedLabel={t.copied}
          />
          <p className="text-xs leading-relaxed text-muted">
            {cuda === DEFAULT_CUDA ? t.pypiNote(version) : t.ghNote(cuda, version)}{" "}
            {t.py312Note}
          </p>
        </div>
      ) : (
        <div className="p-5">
          <div className="rounded-xl border border-dashed border-accent/40 bg-accent-soft/40 p-6">
            <p className="font-serif text-lg font-bold text-ink">{t.rocmTitle}</p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
              {t.rocmBody}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <a
                href="https://mars-compute.com/#contact"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-paper shadow-paper transition-colors hover:bg-accent-strong"
              >
                {t.rocmCta}
              </a>
              <span className="font-mono text-xs text-muted">{CONTACT_EMAIL}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
