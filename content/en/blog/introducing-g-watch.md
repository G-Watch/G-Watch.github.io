---
title: Introducing G-Watch
description: A toolbox for agentic GPU/TPU kernel optimization — profiling, program analysis, and a reasoning-driven auto-optimization loop.
date: 2026-06-22
tags: [Announcement]
---

# Introducing G-Watch

GPU kernel optimization has long been a craft reserved for experts staring at profiler dumps. **G-Watch** is built to change that — it gives both engineers *and* coding agents the instruments to see inside a kernel and act on what they find.

G-Watch is a toolbox for **agentic GPU/TPU kernel optimization**, organized around two pillars.

## Profiling

Rich, runtime hardware observation across NVIDIA and AMD GPUs (and Google TPUs):

- **[Range profiling](/docs/humanize/range-profiling/)** — hardware performance counters per launch, to pin the macro bottleneck (memory- vs compute-bound, pipe pressure, occupancy).
- **[PC sampling](/docs/humanize/pc-sampling/)** — instruction-level hotspots and the dominant warp-stall reasons, mapped to source and SASS lines.
- **[Intra-kernel tracing](/docs/humanize/intra-kernel-tracing/)** — the in-kernel phase timeline, exposing pipeline bubbles and synchronization overhead. The only tool with this temporal view.

## Program analysis

Tools for inspecting compiler-generated GPU/TPU binaries — demangle kernels, walk decoded SASS, map PC→source line, and dump the control-flow graph. This [binary analysis](/docs/humanize/binary-analysis/) foundation also powers secondary-development tasks such as register analysis and binary instrumentation.

## Built for agents

On top of the raw capabilities, G-Watch ships **agent skills** that drive a disciplined, reasoning-driven [auto-optimization loop](/docs/humanize/auto-optimization/): profile → hypothesize → apply one minimal change → verify correctness, performance, and hardware behavior → repeat. Every iteration is a reasoned response to the previous one's on-disk evidence — no speculative or shotgun attempts.

The whole stack is **DSL-agnostic**: CUDA C++, Triton, CuTe DSL, TileLang, and HIP on AMD all work through the same workflow.

## Get started

```bash
pip install gwatch
npx skills add mars-compute-ai/G-Watch -a claude-code -a codex -a gemini-cli
```

Then head to the [docs](/docs/humanize/introduction/) to run your first diagnosis.
