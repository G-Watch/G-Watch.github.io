---
title: CUDA
description: How to trace a CUDA C++ kernel with scope markers in its source.
order: 11
---

<div class="skill-line"><strong>Agent skill</strong> <button type="button" class="skill-chip" data-skill="/gwatch_cuda_xtrace_cuda" title="Copy to clipboard" onclick="navigator.clipboard.writeText(this.dataset.skill);this.classList.add('is-copied');setTimeout(()=&gt;this.classList.remove('is-copied'),1400)"><code>/gwatch_cuda_xtrace_cuda</code></button></div>

Scope markers delimit regions of a **CUDA C++** kernel.
G-Watch records when each region runs on every thread.

## Example

The runnable example is
`examples/cuda/trace/trace_cuda_hgmma_matmul.py`.

```bash
# for humanized visualization
python3 examples/cuda/trace/trace_cuda_hgmma_matmul.py --report trace.html

# for agentic visualization
python3 examples/cuda/trace/trace_cuda_hgmma_matmul.py --report trace.json
gwatch show trace.json
```

<video src="/media/xtrace_cuda.mp4" controls muted loop autoplay playsinline style="width:100%;border-radius:12px;border:1px solid var(--color-line);margin-top:0.5rem"></video>

## Step 1: Mark scopes in the kernel

```cpp
#include "gwatch/cuda/trace.hpp"

__global__ void my_kernel(/* ... */) {
    for (int k = 0; k < K; k += BK) {
        GWATCH_CUDA_KERNEL_SCOPE_START(10);   // load phase
        // ... stage tiles into shared memory ...
        __syncthreads();
        GWATCH_CUDA_KERNEL_SCOPE_END(10);

        GWATCH_CUDA_KERNEL_SCOPE_START(20);   // compute phase
        // ... mma / math ...
        GWATCH_CUDA_KERNEL_SCOPE_END(20);
    }

    GWATCH_CUDA_KERNEL_SCOPE_START(30);       // epilogue
    // ... write results back ...
    GWATCH_CUDA_KERNEL_SCOPE_END(30);
}
```

Markers go inside the kernel body.
Each region needs a unique integer id.
A marker inside a loop records every iteration, so the trace covers every pass of the k-loop.

## Step 2: Build and trace

```python
import gwatch
import gwatch.libpygwatch as pygwatch
from gwatch.cuda.xtrace import do_trace
from torch.utils.cpp_extension import load_inline

pygwatch.init_cupti_hooks()   # install CUPTI hooks before the first module load

mod = load_inline(
    name="my_kernel",
    cpp_sources=CPP_DECL,         # launcher declaration
    cuda_sources=CUDA_SRC,        # the kernel above, with scope markers
    functions=["my_launcher"],
    extra_include_paths=[gwatch.get_include()],          # marker header
    extra_cuda_cflags=[
        "-gencode=arch=compute_90a,code=compute_90a",    # PTX (tracing reads this)
        "-gencode=arch=compute_90a,code=sm_90a",         # SASS
    ],
)

result = do_trace(
    fn=lambda: mod.my_launcher(...),
    kernel_name_pattern=r".*my_kernel.*", # regex on the mangled prototype
    dsl="",                               # raw CUDA C++, no DSL PTX cache
    scope_name_map={10: "load", 20: "compute", 30: "epilogue"},
    instrumentation_tier="ptx",
)
```

A few things to note:

- **`instrumentation_tier="ptx"`** traces the scopes marked in source.
  To trace a compiled cubin without markers, see
  [SASS](/docs/humanize/xtrace/supported-dsls/sass/).
- **Embed PTX.** Tracing reads the kernel's PTX from the fatbin at runtime.
  So compile **both** the PTX target (`code=compute_90a`) and the SASS target
  (`code=sm_90a`).
- **`dsl=""`** marks a hand-written kernel, so there is no DSL dump to search.
- **`scope_name_map`** turns the integer ids into the labels shown in the report.

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
