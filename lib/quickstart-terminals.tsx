"use client";

// User-owned quick-start section: two terminals, one above the other, on a
// numbered rail.
//
// The first holds the install commands, each copyable. The second is a
// mocked Claude Code session that plays itself once it scrolls into view: the
// prompt types out, then each tool call waits behind a spinner, the way the real
// thing does. Content lives in `quickstart` in lib/site-config.ts.
//
// The session terminal takes whatever height the page gives it, and scrolls to
// follow the newest line once the session outgrows it.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { withBasePath } from "@/lib/paths";
import type { AgentStep, Quickstart } from "@/lib/site-config";

const CLAUDE = "#d97757";
const SPINNER = ["·", "✢", "✳", "✶", "✻", "✽", "✻", "✶", "✳", "✢"];
const TYPE_MS = 28; // per prompt character
const BUSY_MS = 1100; // spinner before each step
const LINE_MS = 160; // between output lines

function Window({
  title,
  children,
  bodyClassName = "",
  fill = false,
}: {
  title: string;
  children: ReactNode;
  bodyClassName?: string;
  /** Take the height it is given; the body pads and scrolls itself. */
  fill?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-ink/80 bg-ink shadow-paper ${
        fill ? "flex min-h-0 flex-1 flex-col" : ""
      }`}
    >
      <div className="relative flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-white/20" />
        <span className="h-3 w-3 rounded-full bg-white/20" />
        <span className="h-3 w-3 rounded-full bg-white/20" />
        <span className="absolute inset-x-0 text-center text-sm text-white/45">
          {title}
        </span>
      </div>
      <div
        className={`font-mono text-sm leading-relaxed text-white/90 ${
          fill ? "min-h-0 flex-1" : "px-5 py-4"
        } ${bodyClassName}`}
      >
        {children}
      </div>
    </div>
  );
}

function CopyLine({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative flex gap-3 py-1">
      <span className="select-none text-white/35">$</span>
      <span className="whitespace-pre">{command}</span>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(command).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          });
        }}
        aria-label={`Copy ${command}`}
        className="absolute right-0 top-1/2 -translate-y-1/2 rounded-md bg-white/10 px-2 py-0.5 font-sans text-sm text-white/70 opacity-0 transition-opacity hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
      >
        {copied ? "✓" : "Copy"}
      </button>
    </div>
  );
}

/** How many reveal ticks a step takes: its head line, then each output line. */
function stepLines(step: AgentStep): number {
  return 1 + (step.kind === "tool" ? (step.out?.length ?? 0) : 0);
}

function useSpinner(active: boolean) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % SPINNER.length), 110);
    return () => clearInterval(id);
  }, [active]);
  return SPINNER[frame];
}

function AgentSession({ agent }: { agent: Quickstart["agent"] }) {
  const ref = useRef<HTMLDivElement>(null);
  const total = agent.steps.reduce((n, step) => n + stepLines(step), 0);
  // typed: prompt characters shown; shown: session lines revealed; busy: the
  // step whose spinner is up, or null.
  const [typed, setTyped] = useState(0);
  const [shown, setShown] = useState(0);
  const [busy, setBusy] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  // Reduced motion: the whole session appears at once when it comes into view.
  const instant = useRef(false);
  const glyph = useSpinner(busy !== null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    instant.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const seen = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setStarted(true);
          seen.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    seen.observe(node);
    return () => seen.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (instant.current) {
      timers.push(
        setTimeout(() => {
          setTyped(agent.prompt.length);
          setShown(total);
        }, 0),
      );
      return () => timers.forEach(clearTimeout);
    }
    let at = 500;
    const later = (ms: number, fn: () => void) => {
      at += ms;
      timers.push(setTimeout(fn, at));
    };
    for (let i = 1; i <= agent.prompt.length; i++) later(TYPE_MS, () => setTyped(i));
    later(400, () => {});
    let line = 0;
    agent.steps.forEach((step, index) => {
      later(0, () => setBusy(index));
      later(BUSY_MS, () => {
        setBusy(null);
      });
      for (let k = 0; k < stepLines(step); k++) {
        const next = ++line;
        later(k === 0 ? 0 : LINE_MS, () => setShown(next));
      }
      later(250, () => {});
    });
    return () => timers.forEach(clearTimeout);
  }, [started, agent, total]);

  // Like a real terminal: once the session outgrows the window, it follows the
  // newest line.
  useEffect(() => {
    const node = ref.current;
    if (node && node.scrollHeight > node.clientHeight) {
      node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
    }
  }, [shown, busy]);

  let line = 0;

  return (
    <div
      ref={ref}
      className="h-full overflow-y-auto px-5 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {/* Welcome box */}
      <div
        className="flex items-center gap-4 rounded-lg border px-4 py-3"
        style={{ borderColor: `${CLAUDE}99` }}
      >
        {/* Plain <img>: the static export has no next/image optimizer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={withBasePath("/claude-gif.gif")}
          alt=""
          width={44}
          height={44}
          className="h-11 w-11 flex-none [image-rendering:pixelated]"
        />
        <div className="min-w-0 font-sans">
          <div className="text-base font-bold text-white">Claude Code</div>
          <div className="truncate text-sm text-white/50">{agent.cwd}</div>
        </div>
      </div>

      {/* Prompt */}
      <div className="mt-4 flex gap-3">
        <span className="select-none text-white/40">&gt;</span>
        <span className="min-w-0 flex-1 text-white">
          {agent.prompt.slice(0, typed)}
          {typed < agent.prompt.length && (
            <span className="ml-px inline-block h-[1.1em] w-[0.55em] translate-y-[0.2em] bg-white/70 align-baseline" />
          )}
          <span className="invisible">{agent.prompt.slice(typed)}</span>
        </span>
      </div>

      {/* Session */}
      <div className="mt-3 space-y-2.5">
        {agent.steps.map((step, index) => {
          const head = ++line;
          const outs =
            step.kind === "tool"
              ? (step.out ?? []).map((text) => ({ text, n: ++line }))
              : [];
          if (head > shown && busy !== index) return null;
          if (head > shown) {
            return (
              <div key={index} className="flex gap-3" aria-hidden>
                <span style={{ color: CLAUDE }}>{glyph}</span>
                <span className="text-white/55">{step.busy}…</span>
              </div>
            );
          }
          return (
            <div key={index}>
              <div className="flex gap-3">
                <span
                  className="select-none"
                  style={{ color: step.kind === "say" ? "#fff" : "#4ade80" }}
                >
                  ⏺
                </span>
                {step.kind === "tool" ? (
                  <span className="min-w-0 flex-1 break-all">
                    <span className="font-bold text-white">{step.name}</span>
                    <span className="text-white/60">({step.arg})</span>
                  </span>
                ) : (
                  <span className="min-w-0 flex-1 font-sans text-[15px] text-white">
                    {step.text}
                  </span>
                )}
              </div>
              {outs.map(({ text, n }, k) => {
                if (n > shown) return null;
                const sign = text.startsWith("+ ") ? "+" : text.startsWith("- ") ? "-" : null;
                return (
                  <div key={k} className="flex gap-3">
                    <span className="w-4 flex-none select-none text-right text-white/30">
                      {k === 0 ? "⎿" : ""}
                    </span>
                    <span
                      className={`min-w-0 flex-1 break-all rounded-sm px-1 ${
                        sign === "+"
                          ? "bg-emerald-400/15 text-emerald-300"
                          : sign === "-"
                            ? "bg-rose-400/15 text-rose-300"
                            : "text-white/60"
                      }`}
                    >
                      {text}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** One numbered step on the rail: a node and label, the terminal beneath. */
function Step({
  n,
  label,
  last,
  grow,
  children,
}: {
  n: number;
  label: string;
  last?: boolean;
  /** Take the rest of the list's height. */
  grow?: boolean;
  children: ReactNode;
}) {
  return (
    <li
      data-rise={n}
      className={`relative grid grid-cols-[2rem_minmax(0,1fr)] gap-x-5 ${
        grow ? "min-h-0 flex-1" : ""
      }`}
    >
      {/* Rail: from under this node down to the next one. */}
      {!last && (
        <span
          aria-hidden
          className="absolute bottom-0 left-4 top-9 w-px -translate-x-1/2 bg-line"
        />
      )}
      <span className="relative z-10 flex h-8 w-8 items-center self-start justify-center rounded-full bg-ink text-sm font-bold text-paper ring-4 ring-paper">
        {n}
      </span>
      <div className={`flex min-h-0 flex-col ${last ? "" : "pb-8"}`}>
        <h3 className="flex h-8 items-center text-lg font-bold text-ink">
          {label}
        </h3>
        <div className={`mt-3 ${grow ? "flex min-h-0 flex-1 flex-col" : ""}`}>
          {children}
        </div>
      </div>
    </li>
  );
}

export function QuickstartTerminals({ quickstart }: { quickstart: Quickstart }) {
  const { install, agent } = quickstart;
  return (
    <ol className="flex min-h-0 flex-1 flex-col">
      <Step n={1} label={install.label}>
        <Window title="bash" bodyClassName="overflow-x-auto">
          {install.commands.map((command) => (
            <CopyLine key={command} command={command} />
          ))}
        </Window>
      </Step>
      <Step n={2} label={agent.label} last grow>
        <Window title="claude" fill>
          <AgentSession agent={agent} />
        </Window>
      </Step>
    </ol>
  );
}
