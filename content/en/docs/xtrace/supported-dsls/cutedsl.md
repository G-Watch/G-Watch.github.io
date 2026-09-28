---
title: CuTeDSL
description: How to trace a CuTeDSL kernel with scope markers in its source.
order: 13
---

<div class="skill-line"><strong>Agent skill</strong> <button type="button" class="skill-chip" data-skill="/gwatch_cuda_xtrace_cutedsl" title="Copy to clipboard" onclick="navigator.clipboard.writeText(this.dataset.skill);this.classList.add('is-copied');setTimeout(()=&gt;this.classList.remove('is-copied'),1400)"><code>/gwatch_cuda_xtrace_cutedsl</code></button></div>

Scope markers delimit regions of a **CuTeDSL** kernel.
G-Watch records when each region runs on every thread.

## Example

The runnable example is
`examples/cuda/trace/trace_cute_matmul.py`.

```bash
pip install nvidia-cutlass-dsl

# for humanized visualization
python3 examples/cuda/trace/trace_cute_matmul.py --report trace.html

# for agentic visualization
python3 examples/cuda/trace/trace_cute_matmul.py --report trace.json
gwatch show trace.json
```

<video src="/media/xtrace_cutedsl.mp4" controls muted loop autoplay playsinline style="width:100%;border-radius:12px;border:1px solid var(--color-line);margin-top:0.5rem"></video>

## Step 1: Mark scopes in the kernel

Wrap each region with `scope_start` and `scope_end` from the CuTe trace helper.
Markers go inside the `@cute.kernel` body.
Each region needs a unique integer id.

```python
import gwatch.cuda.xtrace.cute as gw_trace
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

## Step 2: Build and trace

CuTe's JIT cubin skips CUPTI's module capture.
So tracing reads CuTe's **dumped PTX** instead.
The order of these steps matters:

1. Set `CUTE_DSL_KEEP_PTX=1` and `CUTE_DSL_DUMP_DIR`.
2. Import `gwatch.cuda.xtrace.cute`, which creates the capsule.
3. Call `init_cupti_hooks()`.
4. Import `cutlass` last.

This way CUPTI is already listening when `@cute.jit` loads the module.

```python
import os
os.environ.setdefault("CUTE_DSL_KEEP_PTX", "1")
os.environ.setdefault("CUTE_DSL_DUMP_DIR", "/tmp/gw_cute_ptx")

import gwatch.libpygwatch as pygwatch
import gwatch.cuda.xtrace.cute as gw_trace          # creates the capsule
from gwatch.cuda.xtrace import do_trace

pygwatch.init_cupti_hooks()                          # install CUPTI hooks

import cutlass                                       # import cutlass only now
# ... define the @cute.kernel above (with scope markers) and its @cute.jit launcher ...

result = do_trace(
    fn=lambda: run_my_kernel(...),        # first execution of the kernel
    kernel_name_pattern=r".*my_kernel.*", # regex on the mangled prototype
    dsl="cute",                           # CuTeDSL: trace uses CuTe's dumped PTX
    scope_name_map={1: "load"},           # optional: id -> label
    instrumentation_tier="ptx",
)
```

A few things to note:

- **`instrumentation_tier="ptx"`** traces the scopes marked in source.
  To trace a compiled cubin without markers, see
  [SASS](/docs/humanize/xtrace/supported-dsls/sass/).
- **PTX dump.** The env vars and the import order above let tracing find the
  kernel's PTX.
- **`dsl="cute"`** tells G-Watch to recover PTX from CuTe's dump directory.
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
