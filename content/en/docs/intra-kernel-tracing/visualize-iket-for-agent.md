---
title: Visualize Iket for Agent
description: Render an intra-kernel trace as compact text that an LLM agent can read, with gwatch show.
order: 12
---

An intra-kernel trace dumps to two report forms. The HTML report is interactive
and meant for people. The JSON report is machine-readable. To let a coding agent
read a trace, G-Watch renders that JSON report as compact text with `gwatch show`.

## gwatch show

`gwatch show` reads a `Section_IntraKernelTrace` JSON report (the file produced by
`report.render("trace.json")`) and prints pipeline analysis to the terminal. An
agent reads this text directly.

```bash
gwatch show trace.json
```

<img src="/media/iket_agentview.png" alt="Agent view of an intra-kernel trace rendered by gwatch show" style="width:100%;border-radius:12px;border:1px solid var(--color-line)" />

By default it prints:

- A header: kernel, launch dimensions, record and thread counts, scopes, and time span.
- Per-scope stats: count and min, p50, mean, p95, max, and total time per scope.
- A pipeline summary: per-thread active vs. bubble time, bubble ratio, and the bubbliest threads.
- A per-thread ASCII timeline (Gantt) with a scope legend.

## Focused views and structured output

Flags select a single view:

```bash
gwatch show trace.json --stats         # per-scope stats only
gwatch show trace.json --bubbles       # pipeline summary + longest bubbles
gwatch show trace.json --timeline      # per-thread ASCII timeline
gwatch show trace.json --concurrency   # active-threads-over-time histogram
gwatch show trace.json --outliers      # straggler threads
```

For programmatic consumption, `--json` emits the full analysis as structured JSON:

```bash
gwatch show trace.json --json
```
