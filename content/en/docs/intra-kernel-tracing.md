---
title: Intra-Kernel Tracing
description: Trace the internal phase timeline of a kernel — per-phase durations, pipeline bubbles, synchronization overhead, and warp-role scheduling within a single launch.
group: Profiling
order: 3
---

# Intra-Kernel Tracing

Intra-kernel tracing observes **scope / timeline behavior inside a kernel**. It is the **only** G-Watch tool that reveals the *temporal* relationship between phases within a single kernel invocation:

> **When does each phase run, and how do they overlap?** — pipeline bubbles, synchronization overhead, warp-role scheduling.

Use it for **multi-phase / pipelined kernels** (FlashAttention, GEMM + epilogue, warp-specialized producer/consumer). It is **not** for single-phase element-wise ops — there is no inter-phase structure to reveal.

- **Reference script:** `GWATCH_PATH/cuda/_examples/do_trace.py`
- **Underlying API:** `gwatch.cuda.trace.do_trace`
- **Report section:** `Section_IntraKernelTrace`

## How it works

1. Run the kernel once under CUPTI (scout pass) to capture its launch metadata and PTX.
2. Build a `TraceSchema` from the sentinels embedded by the scope markers.
3. Allocate a device-side `TraceBuffer`, splice per-thread record stores at every sentinel, JIT-compile the instrumented PTX, and swap in the instrumented `CUfunction`.
4. Re-run the kernel, then decode the buffer into per-thread records.

## Step 1 — Instrument the kernel

Trace markers are **device-side calls** — they must be placed *inside* the kernel body, not in host code. Use **unique integer SCOPE_IDs** per region.

**Triton:**

```python
import gwatch.cuda.trace.triton as gw_trace_triton

@triton.jit
def my_kernel(...):
    gw_trace_triton.scope_start(SCOPE_ID)
    # ... code to trace ...
    gw_trace_triton.scope_end(SCOPE_ID)
```

**CUDA C++** (macros from `gwatch/cuda/trace.hpp`):

```cpp
#include "gwatch/cuda/trace.hpp"

__global__ void my_kernel(...) {
    GWATCH_CUDA_KERNEL_SCOPE_START(SCOPE_ID);
    // ... code to trace ...
    GWATCH_CUDA_KERNEL_SCOPE_END(SCOPE_ID);
}
```

CUDA C++ kernels must be **in-process loadable** (`torch.utils.cpp_extension.load` / a pybind module), must **embed PTX** (compile with both `-gencode arch=compute_NN,code=compute_NN` and `…,code=sm_NN`), and need the include path via `gwatch.get_include()`. Trace them with `dsl=""`.

**CuTe DSL** and **TileLang** are also supported (`gw_trace_cute` / `gw_trace_tilelang`). They need their PTX exposed to the tracer — set `CUTE_DSL_KEEP_PTX=1` for CuTe, or `export_ptx()` + `TILELANG_CACHE_PATH` for TileLang. See the per-DSL reference scripts under `examples/cuda/trace/`.

> **Install the hooks before the first kernel module loads.** For tracing, the capsule defers hook installation at startup, so call it explicitly near the top of your script:
> ```python
> import gwatch.libpygwatch as pygwatch
> import gwatch.cuda.trace as gw_trace
> pygwatch.init_cupti_hooks()
> ```

## Step 2 — Map scope IDs to names

```python
scope_name_map = {
    100: "load_kv",
    101: "dot_qk",
    102: "softmax",
    103: "dot_pv",
    200: "store_o",
}
```

The runner attaches these labels to every record so the report shows meaningful names.

## Step 3 — Run

```bash
python3 GWATCH_PATH/cuda/_examples/do_trace.py \
    --M 1024 --N 1024 --K 1024 \
    --kernel-regex ".*matmul.*"
```

```python
from gwatch.cuda.trace import do_trace

result = do_trace(
    fn=run_once,
    kernel_name_pattern=r".*matmul.*",
    dsl="triton",                  # "triton" / "cute" / "tilelang"; "" for raw CUDA C++
    scope_name_map=scope_name_map,
    instrumentation_tier="ptx",
)
```

If the kernel was not patched with markers, the runner warns and returns an empty dict — add markers and rebuild (clear the Triton JIT cache with `rm -rf ~/.triton/cache/*` if a source edit isn't picked up).

## Step 4 — Dump a report

| Suffix | Output |
|---|---|
| `.html` / `.htm` | Interactive report — per-run **Stats** (overview, pipeline summary, concurrency, per-scope table, longest bubbles) and a **Timeline** canvas Gantt of every thread (zoom/pan, scope legend). Self-contained and bounded in size. |
| `.yaml` / `.yml` | Canonical lossless archive — every record verbatim, plus a pre-computed `analysis` aggregate block. Can be **hundreds of MB** for million-record kernels. |

```bash
python3 GWATCH_PATH/cuda/_examples/do_trace.py \
    --kernel-regex ".*matmul.*" \
    --report reports/trace.html      # or .yaml for the lossless archive
```

## Read the report

**Prefer the pre-computed `analysis` block** over scanning raw `trace_results` (which can be millions of records). It already contains scope totals, per-thread active/bubble time, longest inter-scope gaps, and concurrency. Durations are in `%globaltimer` ticks (≈ 1 ns).

```
total active time per thread = sum over scopes of (end - start)
total bubble  time per thread = thread_lifetime - total active time
bubble ratio  = total bubble / (total bubble + total active)
```

A well-pipelined kernel shows low bubble ratios; a poorly-pipelined one shows long bubbles between phases.

## Visualize with `gwatch show`

`gwatch show <trace.yaml>` is the interactive terminal companion to the YAML archive. With no flags it prints all four views (header, per-scope stats, pipeline summary, per-thread ASCII Gantt). Focus with flags:

```bash
gwatch show trace.yaml --stats                 # where's the time going?
gwatch show trace.yaml --bubbles --concurrency # hunt the worst pipeline bubble + context
gwatch show trace.yaml --longest softmax       # slowest 'softmax' instance
gwatch show trace.yaml --outliers              # straggler threads (≥2σ)
gwatch show trace.yaml --json | jq .scope_stats  # machine-readable, for diffing
```

Selection flags: `--run N`, `--tid '[0,127]'`, `--stime/--etime` (payload-tick window). Timeline flags: `--sample N`, `--sort-by active|bubble|<scope>`, `--human` (ANSI colour).

## Typical workflow

1. **Coarse markers first** — around the main phases (load, compute, store, sync).
2. **Identify the dominant phase** — the scope with the largest `total`.
3. **Inspect the pipeline shape** — `--bubbles --concurrency` shows whether it serializes or threads stall on each other.
4. **Drill down** — add finer markers inside the dominant phase, re-run.
5. **Compare before vs. after** — `--json` on both, `diff` the scope-stats arrays.

## Common pitfalls

- Markers in host code instead of inside the kernel.
- Reusing SCOPE_IDs across regions (records conflate).
- **"PTX binary not found" / empty result** — no PTX reached the tracer (embed PTX for CUDA C++; `export_ptx()` for TileLang; `CUTE_DSL_KEEP_PTX=1` for CuTe).
- **JIT fails with "Unsupported .version"** — point `GW_PTXAS_PATH` at a newer ptxas (e.g. torch's bundled one).

## Related

- [Range profiling](/docs/humanize/range-profiling/) — *what* resource is slow (run first to know which phase to scrutinize).
- [PC sampling](/docs/humanize/pc-sampling/) — *which instruction* stalls within a phase.
- [Auto-optimization](/docs/humanize/auto-optimization/) — the full profile → change → verify loop.
