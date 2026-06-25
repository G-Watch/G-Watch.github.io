---
title: Triton
description: Trace the internal phase timeline of a Triton kernel by adding device-side scope markers.
order: 14
---

G-Watch can trace the internal phases of a **Triton** kernel. You mark regions
inside the `@triton.jit` kernel with device-side scope markers, run the kernel
under G-Watch, and get back a per-thread timeline of when each phase ran — useful
for spotting pipeline bubbles, synchronization overhead, and warp-role scheduling.

## Example

A runnable example is available at
[`examples/cuda/trace/trace_triton_attention.py`](https://github.com/mars-compute-ai/G-Watch/blob/main/examples/cuda/trace/trace_triton_attention.py).

```bash
python3 examples/cuda/trace/trace_triton_attention.py --report trace.json
```

<video src="/media/iket_triton.mp4" controls muted loop autoplay playsinline style="width:100%;border-radius:12px;border:1px solid var(--color-line);margin-top:0.5rem"></video>

## Mark scopes in the kernel

Import the Triton trace helper and wrap each region with `scope_start` /
`scope_end`. Markers are **device-side** — they go inside the `@triton.jit` body
(for example around each phase of an inner loop), and each region uses a unique
integer id.

```python
import triton
import triton.language as tl
import gwatch.cuda.trace.triton as gw_trace

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

## Build and trace

Triton compiles through PTX, which CUPTI captures at runtime — so, unlike the
CUDA C++ / CuTeDSL / TileLang flows, there are **no extra PTX gencode flags,
environment variables, or export steps**. Just add the markers and call
`do_trace` with `dsl="triton"`.

```python
import gwatch.libpygwatch as pygwatch
from gwatch.cuda.trace import do_trace
from gwatch.common.format import File
from gwatch.cuda.trace.format import Section_IntraKernelTrace

pygwatch.init_cupti_hooks()   # install CUPTI hooks before the first module load

result = do_trace(
    fn=lambda: run_my_kernel(...),        # first execution of the kernel
    kernel_name_pattern=r".*my_kernel.*", # regex on the mangled prototype
    dsl="triton",                         # Triton — PTX captured at runtime
    scope_name_map={100: "load_kv", 101: "dot_qk"},
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
- **No PTX setup needed.** Triton emits PTX that CUPTI captures at runtime, so no
  gencode flags or PTX export are required.
- **`dsl="triton"`** tells G-Watch the kernel is a Triton kernel.
- **`scope_name_map`** (optional) turns the integer ids into the labels shown in
  the report. Use `kernel_name_pattern` to pick a specific kernel (e.g. the
  forward vs. backward pass).
- If a marker edit isn't picked up, clear Triton's JIT cache
  (`rm -rf ~/.triton/cache/*`) so the instrumented kernel is recompiled.
- `Section_IntraKernelTrace` renders to interactive **HTML** (`.html`) or a
  machine-readable **JSON** (`.json`) archive, picked from the output extension.
