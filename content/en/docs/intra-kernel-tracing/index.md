---
title: Intra-kernel Tracing
description: Trace the internal phase timeline of a single GPU kernel across CUDA, TileLang, CuTeDSL, and Triton.
order: 10
---

Intra-kernel Tracing (Iket) reveals the temporal behavior inside a single kernel
invocation: when each phase runs and how they overlap. It exposes pipeline
bubbles, synchronization overhead, and warp-role scheduling that aggregate
metrics miss. You add device-side scope markers, run the kernel under G-Watch,
and get back a per-thread timeline. The same workflow works across multiple
kernel DSLs:
[CUDA](/docs/humanize/intra-kernel-tracing/supported-dsls/cuda/),
[TileLang](/docs/humanize/intra-kernel-tracing/supported-dsls/tilelang/),
[CuTeDSL](/docs/humanize/intra-kernel-tracing/supported-dsls/cutedsl/), and
[Triton](/docs/humanize/intra-kernel-tracing/supported-dsls/triton/).

Every trace renders two ways. The HTML report is a polished, interactive view
for people. The text view is compact and meant for agents, produced by
[`gwatch show`](/docs/humanize/intra-kernel-tracing/visualize-iket-for-agent/).

<div style="display:flex;gap:1rem;align-items:flex-start;margin-top:0.5rem"><figure style="flex:1.571;min-width:0;margin:0"><img src="/media/iket_humanview.png" alt="Human view: interactive HTML report" style="width:100%;border-radius:12px;border:1px solid var(--color-line)" /><figcaption style="text-align:center;font-size:0.85em;color:var(--color-muted);margin-top:0.4rem">Human view (HTML report)</figcaption></figure><figure style="flex:1.386;min-width:0;margin:0"><img src="/media/iket_agentview.png" alt="Agent view: gwatch show terminal output" style="width:100%;border-radius:12px;border:1px solid var(--color-line)" /><figcaption style="text-align:center;font-size:0.85em;color:var(--color-muted);margin-top:0.4rem">Agent view (gwatch show)</figcaption></figure></div>
