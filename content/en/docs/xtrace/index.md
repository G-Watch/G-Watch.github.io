---
title: Xtrace
description: An overview of Xtrace, its two instrumentation levels and the two ways to read a trace.
order: 10
---

<div class="skill-line"><strong>Agent skill</strong> <button type="button" class="skill-chip" data-skill="/gwatch_cuda_xtrace" title="Copy to clipboard" onclick="navigator.clipboard.writeText(this.dataset.skill);this.classList.add('is-copied');setTimeout(()=&gt;this.classList.remove('is-copied'),1400)"><code>/gwatch_cuda_xtrace</code></button></div>

Xtrace records when each phase of a GPU kernel runs.
The timeline shows how phases overlap and where the pipeline stalls.
Aggregate counters cannot show either.

## Trace at the SASS level

Xtrace splices its probes into the compiled cubin.
The compiler never sees them, so it optimizes the kernel as usual.
The trace therefore describes the binary that ships, which gives the highest-fidelity timeline.

SASS-level tracing needs no source and no rebuild.
So it also works on closed-source kernels, such as those in cuDNN and cuBLAS.
Start with the [SASS guide](/docs/humanize/xtrace/supported-dsls/sass/).

## Alternative: Trace at source code level

Xtrace can also trace scopes marked in the kernel source.
G-Watch turns the markers into probes at the PTX level.
This is quick to set up, but the compiler then builds the probes into the kernel.
Guides cover [CUDA](/docs/humanize/xtrace/supported-dsls/cuda/),
[TileLang](/docs/humanize/xtrace/supported-dsls/tilelang/),
[CuTeDSL](/docs/humanize/xtrace/supported-dsls/cutedsl/) and
[Triton](/docs/humanize/xtrace/supported-dsls/triton/).

## Read the trace

Every trace renders two ways.
People read the HTML report, an interactive panel.
Agents read compact text from
[`gwatch show`](/docs/humanize/xtrace/visualize-xtrace-for-agent/).
A region marked in the panel can be copied and pasted to an agent.

<div style="display:flex;gap:1rem;align-items:flex-start;margin-top:0.5rem"><figure style="flex:1.571;min-width:0;margin:0"><img src="/media/xtrace_humanview.png" alt="Human view: interactive HTML report" style="width:100%;border-radius:12px;border:1px solid var(--color-line)" /><figcaption style="text-align:center;font-size:0.85em;color:var(--color-muted);margin-top:0.4rem">Human view (HTML report)</figcaption></figure><figure style="flex:1.386;min-width:0;margin:0"><img src="/media/xtrace_agentview.png" alt="Agent view: gwatch show terminal output" style="width:100%;border-radius:12px;border:1px solid var(--color-line)" /><figcaption style="text-align:center;font-size:0.85em;color:var(--color-muted);margin-top:0.4rem">Agent view (gwatch show)</figcaption></figure></div>
