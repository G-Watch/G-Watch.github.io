---
title: Supported DSLs
description: Intra-kernel tracing works across CUDA, TileLang, CuTeDSL and Triton, and below all of them at the SASS level.
order: 11
---

G-Watch supports intra-kernel tracing across multiple kernel DSLs. The workflow
is the same in each one: add scope markers, run `do_trace`, then render the
report. Only the marker syntax and build setup differ per DSL.

[SASS](/docs/humanize/intra-kernel-tracing/supported-dsls/sass/) is the tier
below all of them, and the exception to that workflow: it splices probes into an
already-compiled cubin, so you name machine instructions instead of marking
source, and the kernel needs no markers, no rebuild and no PTX. It is how you
trace a vendor binary, a single unrolled copy of a loop body, or one particular
instruction a hotspot pointed you at.
