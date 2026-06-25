---
title: TileLang
description: Trace the internal phase timeline of a TileLang kernel by adding device-side scope markers.
order: 12
---

G-Watch can trace the internal phases of a **TileLang** kernel. You mark regions
inside the `T.prim_func` with device-side scope markers, run the kernel under
G-Watch, and get back a per-thread timeline of when each phase ran — useful for
spotting pipeline bubbles, synchronization overhead, and warp-role scheduling.

## Example

A runnable example is available at
[`examples/cuda/trace/trace_tilelang_matmul.py`](https://github.com/mars-compute-ai/G-Watch/blob/main/examples/cuda/trace/trace_tilelang_matmul.py).

```bash
pip install tilelang
python3 examples/cuda/trace/trace_tilelang_matmul.py --report trace.json
```

<video src="/media/iket_tilelang.mp4" controls muted loop autoplay playsinline style="width:100%;border-radius:12px;border:1px solid var(--color-line);margin-top:0.5rem"></video>

## Mark scopes in the kernel

Import the TileLang trace helper and wrap each region with `scope_start` /
`scope_end`. The markers are TIR statements, so emit them through `T.evaluate(...)`
inside the kernel body; each region uses a unique integer id.

```python
import gwatch.cuda.trace.tilelang as gw_trace
import tilelang
import tilelang.language as T

@tilelang.jit(out_idx=[-1])
def make_mul(n, block):
    @T.prim_func
    def main(A: T.Tensor((n,), "float32"),
             B: T.Tensor((n,), "float32"),
             C: T.Tensor((n,), "float32")):
        with T.Kernel(T.ceildiv(n, block), threads=block) as bx:
            for i in T.Parallel(block):
                idx = bx * block + i
                T.evaluate(gw_trace.scope_start(1))   # load
                a = A[idx]
                b = B[idx]
                T.evaluate(gw_trace.scope_end(1))

                T.evaluate(gw_trace.scope_start(2))   # store
                C[idx] = a * b
                T.evaluate(gw_trace.scope_end(2))
    return main
```

## Build and trace

TileLang compiles to a single-arch `.cubin` (pure SASS, **no embedded PTX**), so
CUPTI's module capture has no PTX to hand to the tracer. Export the kernel's PTX
explicitly with `kernel.export_ptx(...)` and point the TileLang PTX-cache loader
(`TILELANG_CACHE_PATH`) at it so tracing can find and instrument it.

```python
import os, tempfile
import gwatch.libpygwatch as pygwatch
from gwatch.cuda.trace import do_trace
from gwatch.common.format import File
from gwatch.cuda.trace.format import Section_IntraKernelTrace

pygwatch.init_cupti_hooks()   # install CUPTI hooks before the first module load

kernel = make_mul(N, BLOCK)   # the @tilelang.jit kernel above, with scope markers

# TileLang's cubin is SASS-only, so export the PTX and point the loader at it.
ptx_dir = os.path.join(tempfile.gettempdir(), "gw_tilelang_ptx")
os.makedirs(ptx_dir, exist_ok=True)
kernel.export_ptx(os.path.join(ptx_dir, "main_kernel.ptx"))
os.environ["TILELANG_CACHE_PATH"] = ptx_dir

result = do_trace(
    fn=lambda: kernel(x, y),              # first execution of the kernel
    kernel_name_pattern=r".*main.*",      # regex on the mangled prototype
    dsl="tilelang",                       # TileLang — trace uses the exported PTX
    scope_name_map={1: "load", 2: "store"},
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
- **Export PTX.** TileLang's cubin has no embedded PTX, so `kernel.export_ptx(...)`
  plus `TILELANG_CACHE_PATH` are required for tracing to find the kernel's PTX.
- **`dsl="tilelang"`** tells G-Watch to recover PTX from the exported cache.
- **`scope_name_map`** (optional) turns the integer ids into the labels shown in
  the report.
- `Section_IntraKernelTrace` renders to interactive **HTML** (`.html`) or a
  machine-readable **JSON** (`.json`) archive, picked from the output extension.
