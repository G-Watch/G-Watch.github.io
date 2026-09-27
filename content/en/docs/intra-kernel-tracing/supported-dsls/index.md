---
title: Supported DSLs
description: Xtrace works across CUDA, TileLang, CuTeDSL and Triton, and below all of them at the SASS level.
order: 11
---

<div class="skill-line"><strong>Agent skill</strong> <button type="button" class="skill-chip" data-skill="/gwatch_cuda_xtrace" title="Copy to clipboard" onclick="navigator.clipboard.writeText(this.dataset.skill);this.classList.add('is-copied');setTimeout(()=&gt;this.classList.remove('is-copied'),1400)"><code>/gwatch_cuda_xtrace</code></button></div>

G-Watch supports Xtrace across multiple kernel DSLs. The workflow
is the same in each one: add scope markers, run `do_trace`, then render the
report. Only the marker syntax and build setup differ per DSL.

[SASS](/docs/humanize/intra-kernel-tracing/supported-dsls/sass/) is the exception
to that workflow: it splices probes into an already-compiled cubin, so you name
machine instructions instead of marking source, and the kernel needs no markers
and no rebuild.
