---
title: Supported DSLs
description: Intra-kernel tracing works across CUDA, TileLang, CuTeDSL, and Triton.
order: 11
---

G-Watch supports intra-kernel tracing across multiple kernel DSLs. The workflow
is the same in each one: add scope markers, run `do_trace`, then render the
report. Only the marker syntax and build setup differ per DSL.
