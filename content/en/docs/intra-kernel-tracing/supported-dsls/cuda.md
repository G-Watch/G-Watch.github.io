---
title: CUDA
description: Trace the internal phase timeline of a hand-written CUDA C++ kernel by adding device-side scope markers.
order: 11
---

G-Watch can trace the internal phases of a raw **CUDA C++** kernel. You mark
regions inside the kernel with device-side scope markers, run the kernel under
G-Watch, and get back a per-thread timeline of when each phase ran — useful for
spotting pipeline bubbles, synchronization overhead, and warp-role scheduling.

## Example

A runnable example is available at
[`examples/cuda/trace/trace_cuda_hgmma_matmul.py`](https://github.com/mars-compute-ai/G-Watch/blob/main/examples/cuda/trace/trace_cuda_hgmma_matmul.py).

```bash
python3 examples/cuda/trace/trace_cuda_hgmma_matmul.py --report trace.json
```

<video src="/media/iket_cuda.mp4" controls muted loop autoplay playsinline style="width:100%;border-radius:12px;border:1px solid var(--color-line);margin-top:0.5rem"></video>

## Mark scopes in the kernel

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

Markers are **device-side** — they must live inside the kernel body, and each
region uses a unique integer id. A marker inside a loop emits one record per
iteration, so the trace captures every pass of the k-loop, not just the final
state.

## Build and trace

```python
import gwatch
import gwatch.libpygwatch as pygwatch
from gwatch.cuda.trace import do_trace
from gwatch.common.format import File
from gwatch.cuda.trace.format import Section_IntraKernelTrace
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
    dsl="",                               # raw CUDA C++ — no DSL PTX cache
    scope_name_map={10: "load", 20: "compute", 30: "epilogue"},
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

- **`instrumentation_tier="ptx"`** as current OSS G-Watch supports PTX-based instrumentation. SASS-level instrumentation would be open-sourced once ready.
- **Embed PTX.** Tracing recovers the kernel's PTX from the fatbin captured at
  runtime, so the module must contain PTX — compile **both** the PTX
  (`code=compute_90a`) and SASS (`code=sm_90a`) targets.
- **`dsl=""`** tells G-Watch this is a hand-written kernel (no DSL dump to search).
- **`scope_name_map`** turns the integer ids into the labels shown in the report.
- `Section_IntraKernelTrace` renders to interactive **HTML** (`.html`) or a
  machine-readable **JSON** (`.json`) archive, picked from the output extension.
