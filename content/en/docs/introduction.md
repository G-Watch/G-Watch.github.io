---
title: Introduction
description: What G-Watch is — a toolbox for agentic GPU/TPU kernel optimization, spanning profiling, program analysis, and an auto-optimization loop.
group: Getting Started
order: 1
---

# Introduction

**G-Watch** is a toolbox for **agentic GPU/TPU kernel optimization**. It gives you — and your coding agents — the instruments to *see inside* a GPU kernel: which hardware resource is the bottleneck, which instructions stall and why, when each phase runs inside the kernel, and what the compiler actually emitted.

G-Watch is built around two pillars:

- **Profiling** — rich, runtime hardware observation on both NVIDIA and AMD GPUs (and Google TPUs): hardware-counter range profiling, instruction-level PC sampling, and intra-kernel phase tracing.
- **Program Analysis** — tools for inspecting compiler-generated GPU/TPU binaries (SASS / AMDGPU), enabling secondary-development tasks such as register analysis and binary instrumentation.

On top of these, G-Watch ships **agent skills** that turn the raw capabilities into a disciplined, reasoning-driven **auto-optimization loop**.

## The capability stack

G-Watch's diagnostic tools answer different questions at four resolutions. A typical investigation walks the stack top-down, coarse to fine.

| Capability | Question it answers | Docs |
|---|---|---|
| [Range profiling](/docs/humanize/range-profiling/) | *Which hardware resource is the bottleneck?* — memory- vs compute-bound, pipe pressure, occupancy, achieved-vs-peak throughput. | Hardware counters per launch. |
| [PC sampling](/docs/humanize/pc-sampling/) | *Which specific instructions stall, and why?* — dominant stall reasons mapped to source and SASS lines. | Instruction-level hotspots. |
| [Intra-kernel tracing](/docs/humanize/intra-kernel-tracing/) | *When does each phase run, and how do they overlap?* — pipeline bubbles, sync overhead, warp-role scheduling. | The only temporal in-kernel view. |
| [Binary analysis](/docs/humanize/binary-analysis/) | *What's the instruction window around a hot PC, the address-to-line map, the CFG?* | SASS-level inspection. |
| [Auto-optimization](/docs/humanize/auto-optimization/) | *How do I drive all of the above to an actually-faster kernel?* | The orchestrated agent loop. |

## What it works on

The profiling and tracing tools are **DSL-agnostic**. The same workflow applies to:

- **CUDA C++** kernels (including raw Hopper `wgmma` matmuls and FlashAttention),
- **Triton** kernels,
- **CuTe DSL** kernels,
- **TileLang** kernels,
- **HIP / ROCm** kernels on AMD GPUs (see [ROCm support](/docs/humanize/rocm/)).

## How it hooks in

G-Watch uses CUPTI callback hooks to intercept CUDA driver APIs at runtime. The capsule initializes automatically when you `import gwatch.cuda`, setting up hooks for all subsequent module loads and kernel launches. **No special launcher or `LD_PRELOAD` is needed** — just run your Python script directly:

```bash
python3 your_script.py ...
```

> The one rule: `import gwatch.cuda` must happen **before the first CUDA kernel execution**. Importing after `import torch` is fine — torch loads kernel modules lazily on first use.

## Next steps

- [Installation](/docs/humanize/installation/) — install from PyPI or build from source, and add the agent skills.
- [Range profiling](/docs/humanize/range-profiling/) — start your first diagnosis with hardware counters.
