---
title: Auto-Optimization
description: The orchestrated agent loop that drives profiling, diagnosis, and verification into a disciplined, reasoning-driven kernel optimization workflow.
group: Optimization
order: 1
---

# Auto-Optimization

The auto-optimization skill turns G-Watch's individual capabilities into a disciplined, **reasoning-driven optimization loop**. An agent uses it to iteratively profile, diagnose, change, and verify a kernel until it is measurably faster — without speculative or shotgun attempts.

It works for **any** CUDA C++ / Triton / CuTe / TileLang kernel (and HIP on AMD — see [ROCm support](/docs/humanize/rocm/)).

## Core principle — reasoning-driven iteration

> **Every iteration MUST be a reasoned response to the previous iteration's observations.** No speculative iterations, no shotgun attempts, no fixed templates.

Before every iteration the agent must, in order:

1. **Read** the prior iteration's artifacts from disk (`post_flops.json`, `post_range_profile.yaml`, `post_pc_sampling.yaml`, `post_trace.yaml`) — the on-disk file is the source of truth, not memory of the conversation.
2. **Identify what changed** vs the iteration before — quantify ("`sm__cycles_active` rose 38.2% → 44.7%, DRAM throughput flat, latency −12.5%").
3. **Form one specific hypothesis** about *why* and *what one change* should move the next number.
4. **Cite** the specific prior files that informed the hypothesis.
5. **Choose the tools** this iteration needs to test the hypothesis — never a fixed menu.

If steps 1–4 cannot be articulated, the iteration is not ready to start.

## The six tools

The loop orchestrates six tools in three groups:

| # | Tool | Group | Question |
|---|---|---|---|
| 1 | Baseline measurement | Measurement | *How fast is the kernel?* |
| 2 | [Range profile](/docs/humanize/range-profiling/) | Diagnosis | *Which hardware resource is the bottleneck?* |
| 3 | [PC sampling](/docs/humanize/pc-sampling/) | Diagnosis | *Which instructions stall, and why?* |
| 4 | [Intra-kernel trace](/docs/humanize/intra-kernel-tracing/) | Diagnosis | *When does each phase run, and how do they overlap?* |
| 5 | [Binary analysis](/docs/humanize/binary-analysis/) | Diagnosis | *What's the SASS window / CFG?* |
| 6 | Correctness | Validation | *Does the optimized kernel still produce correct outputs?* |

**Sequencing rule:** a typical iteration walks the diagnostic stack top-down — Tool 1 → Tool 2 → Tool 3 (and/or Tool 4) → Tool 5 only if a deeper SASS view is needed. Tool choice is *part of the reasoning*, not a pre-committed pipeline.

## The optimization loop

1. **Discover** the workload — entry points, kernel names, build steps, shape parameters.
2. **Build the input configuration space** — 5–15 representative configs (sizes, dtypes, feature flags) saved as a JSON config file.
3. **Iter 0 (baseline)** — benchmark + profile the unchanged code; this is mandatory before any change.
4. **Read** the prior iteration's `post_*` files from disk.
5. **Form one hypothesis**, grounded in step 4's evidence.
6. **Change the smallest relevant code region** — one change per iteration.
7. **Rebuild** if needed.
8. **Verify correctness** across the *full* configuration space → revert immediately if any config fails.
9. **Re-benchmark** across all configs; check for improvement (or no regression).
10. **Re-profile** the modified kernel to confirm the hardware-level cause of the change.
11. **Keep the change only if** performance improves across configs, correctness passes everywhere, and profiling confirms the expected hardware behavior.
12. **Repeat** until significantly faster.

## Priority order

> **Code logic and algorithmic changes always take priority over hyperparameter tuning.**

1. **Algorithmic / data movement** — fusion, data reuse, tiling strategy, computation reordering, loop restructuring.
2. **Hardware utilization** — memory access patterns, vectorized loads/stores, warp primitives, tensor-core utilization, shared-memory layout.
3. **Hyperparameter tuning** — block sizes, `num_warps`, pipeline stages, unroll factors.

Naive autotuner / grid-search sweeps are **not** a primary strategy — they don't demonstrate understanding of the bottleneck, and a 50-trial sweep counts as **one** iteration, not fifty.

## Per-iteration checkpointing

Every iteration persists one folder under the report path (e.g. `iter_001_swizzle_smem/`) bundling **narrative + evidence + diff**:

- `checkpoint.yaml` / `.html` — the cumulative agent trajectory through that iteration (six structured facets: context, reasoning, action, observation, outcome, metadata).
- `pre_*` / `post_*` profiling and tracing reports.
- `code.patch` — the change (`git diff <baseline_commit>`).

This makes any iteration a valid resume point and lets downstream tooling re-analyze the optimization trajectory without re-running the kernel.

## Deliverables

A completed run produces: a performance-improvement report (full results table per config), a code-modification report (per-change gain + change-type breakdown), an optimization-process report (chronological log of every attempt, successful *and* failed), the consolidated `optimized.patch`, a comparison bar chart, and all per-iteration checkpoint folders.

## Common pitfalls

- Forgetting to `import gwatch.cuda` before the first kernel execution.
- Using TFLOPS as the KPI for a memory-bound kernel (use GBps), or vice versa.
- Accepting a speedup without profiling to verify the hardware-level cause.
- Making multiple unvalidated changes before re-measuring.
- Skipping correctness verification after a code change.

## Related

- [Range profiling](/docs/humanize/range-profiling/) · [PC sampling](/docs/humanize/pc-sampling/) · [Intra-kernel tracing](/docs/humanize/intra-kernel-tracing/) · [Binary analysis](/docs/humanize/binary-analysis/) — the diagnostic tools this loop orchestrates.
- [ROCm support](/docs/humanize/rocm/) — the equivalent loop for AMD GPUs.
