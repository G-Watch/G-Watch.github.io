---
title: ROCm Support
description: G-Watch on AMD GPUs — hardware counter collection, PC sampling, thread trace, kernel-launch tracing, and AMDGPU binary analysis for HIP/ROCm/Triton kernels.
group: Platforms
order: 1
---

# ROCm Support (AMD GPUs)

G-Watch profiles and optimizes **HIP / ROCm / Triton** kernels on AMD GPUs, mirroring the NVIDIA capability stack. The same reasoning-driven [auto-optimization loop](/docs/humanize/auto-optimization/) applies — only the underlying profiling primitives differ.

## Tools on AMD

| Tool | Purpose |
|---|---|
| Baseline measurement | Latency & throughput via GPU events |
| Counter collection | Hardware performance counters per kernel dispatch |
| PC sampling | Instruction-level stall analysis with AMDGPU disassembly |
| Thread trace | Per-instruction latency hotspots and wave-state breakdown |
| Binary analysis | Runtime *and* static AMDGPU binary inspection (intercept & disassemble, or parse a code object / fat binary from file) |
| Correctness | Verify against a reference implementation |

## Reference scripts

A complete set of reference scripts lives under `GWATCH_PATH/rocm/_examples/`. They use a PyTorch GEMM (dispatching to rocBLAS) as the test case:

| Script | Tool |
|---|---|
| `do_flops.py` | Baseline |
| `do_counter_collection.py` | Counter collection |
| `do_pc_sampling.py` | PC sampling |
| `do_thread_trace.py` | Thread trace |
| `do_binary_analysis_runtime.py` | Runtime binary analysis |
| `do_binary_analysis_static.py` | Static binary analysis |
| `do_correctness.py` | Correctness |

Additional standalone examples live under `examples/rocm/` (`trace/`, `binary/`, `profiler/`) — kernel-launch tracing, code-object / HIP fatbin parsing, AMDGPU instruction decoding, and CFG + liveness analysis.

## Runtime setup

The ROCm scripts follow a consistent ordering:

- For **hardware profiling** (counters, PC sampling, thread trace): **import `torch` *before* `gwatch.rocm.profile`**, then create `ProfileContext()` **before any GPU work** — torch's HIP libraries must load first and the profiler must register before GPU operations begin.
- For **kernel-launch tracing and binary analysis**: call `enable_rocm_tracing()` **before `import torch`** instead.

Each script accepts `--config <path.json>` to batch-run over multiple test cases, just like the CUDA tools.

## Related

- [Auto-optimization](/docs/humanize/auto-optimization/) — the NVIDIA equivalent of the optimization loop; the methodology is identical.
- [Introduction](/docs/humanize/introduction/) — the overall capability stack.
