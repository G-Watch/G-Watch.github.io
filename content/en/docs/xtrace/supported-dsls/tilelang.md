---
title: TileLang
description: How to trace a TileLang kernel with scope markers in its source.
order: 12
---

<div class="skill-line"><strong>Agent skill</strong> <button type="button" class="skill-chip" data-skill="/gwatch_cuda_xtrace_tilelang" title="Copy to clipboard" onclick="navigator.clipboard.writeText(this.dataset.skill);this.classList.add('is-copied');setTimeout(()=&gt;this.classList.remove('is-copied'),1400)"><code>/gwatch_cuda_xtrace_tilelang</code></button></div>

Scope markers delimit regions of a **TileLang** kernel.
G-Watch records when each region runs on every thread.

## Example

The runnable example is
`examples/cuda/trace/trace_tilelang_matmul.py`.

```bash
pip install tilelang

# for humanized visualization
python3 examples/cuda/trace/trace_tilelang_matmul.py --report trace.html

# for agentic visualization
python3 examples/cuda/trace/trace_tilelang_matmul.py --report trace.json
gwatch show trace.json
```

<video src="/media/xtrace_tilelang.mp4" controls muted loop autoplay playsinline style="width:100%;border-radius:12px;border:1px solid var(--color-line);margin-top:0.5rem"></video>

## Step 1: Mark scopes in the kernel

Wrap each region with `scope_start` and `scope_end` from the TileLang trace helper.
The markers are TIR statements, so emit them through `T.evaluate(...)`.
Each region needs a unique integer id.

```python
import gwatch.cuda.xtrace.tilelang as gw_trace
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

## Step 2: Build and trace

TileLang builds a `.cubin` with **no embedded PTX**, so CUPTI captures no PTX for the tracer.
Export the PTX with `kernel.export_ptx(...)`.
Then point `TILELANG_CACHE_PATH` at it so tracing can find it.

```python
import os, tempfile
import gwatch.libpygwatch as pygwatch
from gwatch.cuda.xtrace import do_trace

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
    dsl="tilelang",                       # TileLang: trace uses the exported PTX
    scope_name_map={1: "load", 2: "store"},
    instrumentation_tier="ptx",
)
```

A few things to note:

- **`instrumentation_tier="ptx"`** traces the scopes marked in source.
  To trace a compiled cubin without markers, see
  [SASS](/docs/humanize/xtrace/supported-dsls/sass/).
- **Export PTX.** Tracing needs `kernel.export_ptx(...)` and
  `TILELANG_CACHE_PATH` to find the kernel's PTX.
- **`dsl="tilelang"`** tells G-Watch to recover PTX from the exported cache.
- **`scope_name_map`** (optional) turns the integer ids into the labels shown in
  the report.

## Step 3: Render the report

```python
from gwatch.common.format import File
from gwatch.cuda.xtrace.format import Section_IntraKernelTrace

section = Section_IntraKernelTrace()
section.add_run(result)
report = File(title="Xtrace")
report.add_section(section)
report.render("trace.html")     # interactive panel; use .json for the agent archive
```
