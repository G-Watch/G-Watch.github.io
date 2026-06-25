---
title: CuTeDSL
description: Trace the internal phase timeline of a CuTeDSL kernel by adding device-side scope markers.
order: 13
---

G-Watch can trace the internal phases of a **CuTeDSL** kernel. You mark regions
inside the `@cute.kernel` with device-side scope markers, run the kernel under
G-Watch, and get back a per-thread timeline of when each phase ran — useful for
spotting pipeline bubbles, synchronization overhead, and warp-role scheduling.

## Example

A runnable example is available at
[`examples/cuda/trace/trace_cute_matmul.py`](https://github.com/mars-compute-ai/G-Watch/blob/main/examples/cuda/trace/trace_cute_matmul.py).

```bash
pip install nvidia-cutlass-dsl
python3 examples/cuda/trace/trace_cute_matmul.py --report trace.json
```

<video src="/media/iket_cutedsl.mp4" controls muted loop autoplay playsinline style="width:100%;border-radius:12px;border:1px solid var(--color-line);margin-top:0.5rem"></video>

## Mark scopes in the kernel

Import the CuTe trace helper and wrap each region with `scope_start` / `scope_end`.
Markers are **device-side** — they go inside the `@cute.kernel` body, and each
region uses a unique integer id.

```python
import gwatch.cuda.trace.cute as gw_trace
import cutlass.cute as cute

@cute.kernel
def my_kernel(x: cute.Tensor, out: cute.Tensor, n: Int32):
    tidx, _, _ = cute.arch.thread_idx()
    bidx, _, _ = cute.arch.block_idx()
    i = bidx * BLOCK_SIZE + tidx
    if i < n:
        gw_trace.scope_start(1)
        v = x[i]
        gw_trace.scope_end(1)
        out[i] = v * 2.0
```

## Build and trace

CuTe's JIT cubin bypasses CUPTI's module-load capture, so tracing falls back to
CuTe's **dumped PTX**. Order matters: set `CUTE_DSL_KEEP_PTX=1` and
`CUTE_DSL_DUMP_DIR` **before** importing `cutlass`, and import
`gwatch.cuda.trace.cute` (which creates the capsule) and call
`init_cupti_hooks()` **before** `cutlass` too — so CUPTI is listening by the time
`@cute.jit` triggers the module load.

```python
import os
os.environ.setdefault("CUTE_DSL_KEEP_PTX", "1")
os.environ.setdefault("CUTE_DSL_DUMP_DIR", "/tmp/gw_cute_ptx")

import gwatch.libpygwatch as pygwatch
import gwatch.cuda.trace.cute as gw_trace          # creates the capsule
from gwatch.cuda.trace import do_trace
from gwatch.common.format import File
from gwatch.cuda.trace.format import Section_IntraKernelTrace

pygwatch.init_cupti_hooks()                          # install CUPTI hooks

import cutlass                                       # import cutlass only now
# ... define the @cute.kernel above (with scope markers) and its @cute.jit launcher ...

result = do_trace(
    fn=lambda: run_my_kernel(...),        # first execution of the kernel
    kernel_name_pattern=r".*my_kernel.*", # regex on the mangled prototype
    dsl="cute",                           # CuTeDSL — trace uses CuTe's dumped PTX
    scope_name_map={1: "load"},           # optional: id -> label
    instrumentation_tier="ptx",
)

# Render the trace to an interactive HTML report (use a .json path for the
# machine-readable archive).
section = Section_IntraKernelTrace()
section.add_run(result)
report = File(title="Intra-kernel trace")
report.add_section(section)
report.render("trace.html")
```

A few things to note:

- **`instrumentation_tier="ptx"`** as current OSS G-Watch supports PTX-based
  instrumentation. SASS-level instrumentation would be open-sourced once ready.
- **PTX dump.** Because CuTe's cubin bypasses CUPTI capture, the
  `CUTE_DSL_KEEP_PTX` / `CUTE_DSL_DUMP_DIR` env vars and the import order above
  are required so tracing can find the kernel's PTX.
- **`dsl="cute"`** tells G-Watch to recover PTX from CuTe's dump directory.
- **`scope_name_map`** (optional) turns the integer ids into the labels shown in
  the report.
- `Section_IntraKernelTrace` renders to interactive **HTML** (`.html`) or a
  machine-readable **JSON** (`.json`) archive, picked from the output extension.
