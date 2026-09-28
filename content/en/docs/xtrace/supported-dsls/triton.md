---
title: Triton
description: How to trace a Triton kernel with scope markers in its source.
order: 14
---

<div class="skill-line"><strong>Agent skill</strong> <button type="button" class="skill-chip" data-skill="/gwatch_cuda_xtrace_triton" title="Copy to clipboard" onclick="navigator.clipboard.writeText(this.dataset.skill);this.classList.add('is-copied');setTimeout(()=&gt;this.classList.remove('is-copied'),1400)"><code>/gwatch_cuda_xtrace_triton</code></button></div>

Scope markers delimit regions of a **Triton** kernel.
G-Watch records when each region runs on every thread.

## Example

The runnable example is
`examples/cuda/trace/trace_triton_attention.py`.

```bash
# for humanized visualization
python3 examples/cuda/trace/trace_triton_attention.py --report trace.html

# for agentic visualization
python3 examples/cuda/trace/trace_triton_attention.py --report trace.json
gwatch show trace.json
```

<video src="/media/xtrace_triton.mp4" controls muted loop autoplay playsinline style="width:100%;border-radius:12px;border:1px solid var(--color-line);margin-top:0.5rem"></video>

## Step 1: Mark scopes in the kernel

Wrap each region with `scope_start` and `scope_end` from the Triton trace helper.
Markers go inside the `@triton.jit` body, for example around each phase of an inner loop.
Each region needs a unique integer id.

```python
import triton
import triton.language as tl
import gwatch.cuda.xtrace.triton as gw_trace

@triton.jit
def my_kernel(q, desc_k, desc_v, ...):
    for start_n in tl.range(lo, hi, BLOCK_N):
        gw_trace.scope_start(100)        # load_kv
        k = desc_k.load([start_n, 0]).T
        v = desc_v.load([start_n, 0])
        gw_trace.scope_end(100)

        gw_trace.scope_start(101)        # dot_qk
        qk = tl.dot(q, k)
        gw_trace.scope_end(101)
        # ... softmax, dot_pv, ...
```

## Step 2: Build and trace

Triton compiles through PTX, and CUPTI captures it at runtime.
So Triton needs **no extra flags, env vars or export steps**.
Add the markers and call `do_trace` with `dsl="triton"`.

```python
import gwatch.libpygwatch as pygwatch
from gwatch.cuda.xtrace import do_trace

pygwatch.init_cupti_hooks()   # install CUPTI hooks before the first module load

result = do_trace(
    fn=lambda: run_my_kernel(...),        # first execution of the kernel
    kernel_name_pattern=r".*my_kernel.*", # regex on the mangled prototype
    dsl="triton",                         # Triton: PTX captured at runtime
    scope_name_map={100: "load_kv", 101: "dot_qk"},
    instrumentation_tier="ptx",
)
```

A few things to note:

- **`instrumentation_tier="ptx"`** traces the scopes marked in source.
  To trace a compiled cubin without markers, see
  [SASS](/docs/humanize/xtrace/supported-dsls/sass/).
- **No PTX setup needed.** CUPTI captures Triton's PTX at runtime.
- **`dsl="triton"`** tells G-Watch the kernel is a Triton kernel.
- **`scope_name_map`** (optional) turns the integer ids into the labels shown in
  the report.
- **`kernel_name_pattern`** picks one kernel, for example the forward pass or the
  backward pass.
- If a marker edit does not show up, clear Triton's JIT cache with
  `rm -rf ~/.triton/cache/*`.

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
