---
title: SASS
description: How to trace a GPU kernel at the binary SASS level.
order: 10
---

<div class="skill-line"><strong>Agent skill</strong> <button type="button" class="skill-chip" data-skill="/gwatch_cuda_xtrace_sass" title="Copy to clipboard" onclick="navigator.clipboard.writeText(this.dataset.skill);this.classList.add('is-copied');setTimeout(()=&gt;this.classList.remove('is-copied'),1400)"><code>/gwatch_cuda_xtrace_sass</code></button></div>

## Example

The runnable example is
`examples/cuda/trace/trace_cuda_matmul_sass.py`.

```bash
python3 examples/cuda/trace/trace_cuda_matmul_sass.py --source-line 29 --clock gpu
```

## Step 1: Find the instruction index

A site is an instruction index. Read the indices off the cubin, with no GPU:

```python
import gwatch.cuda.binary as gw_binary

cubin = gw_binary.Cubin()
cubin.fill(CUBIN_PATH)
cubin.parse()
kernel_def = cubin.get_kerneldef_by_name(NAME)
kernel_def.parse_cfg()
isize = kernel_def.cfg.instruction_size        # 16 on sm_90

# by source line, when the cubin was built with -lineinfo or -G
candidates = [
    index for index in range(len(kernel_def.list_instructions))
    if (kernel_def.map_address_to_line.get(index * isize) or (None, None))[1] == 29
]

# or straight from the decoded SASS, which needs no line info
for index, instruction in enumerate(kernel_def.list_instructions):
    print(index, instruction.str(flatten=True))
```

One source line maps to several instructions, so pick one from `candidates`.

## Step 2: Declare the sites

```python
from gwatch.cuda.xtrace import SassTraceSite

sites = [
    SassTraceSite(candidates[0]),                     # timestamp only
    SassTraceSite(other_index, value_reg=6),          # also record register R6
    SassTraceSite(load_index, value_reg=42,           # the address a load reads
                  value_width_bits=64),
    SassTraceSite(loop_index, warp_level=True),       # one record per warp
]
```

| field | meaning |
|---|---|
| `insert_index` | Instruction index. The pc is `insert_index * isize`. |
| `value_reg` | Physical register to record. `None` records a timestamp only. |
| `value_width_bits` | 32, or 64 for an address. 64 needs an **even** register. |
| `value_is_uniform` | Read the uniform register file. |
| `value_is_smid` | Record the SM id instead of a register. |
| `warp_level` | One record per warp instead of per thread. |

A site's `site_id` is its position in the list.

## Step 3: Trace

```python
from gwatch.cuda.xtrace import do_trace

result = do_trace(
    fn=run_once,                          # a callable that launches and synchronizes
    kernel_name_pattern=r".*my_kernel.*", # regex on the mangled prototype
    instrumentation_tier="sass",          # required for this tier
    sass_trace_sites=sites,               # required when the tier is "sass"
    clock_type="gpu",                     # "gpu" | "sm" | "anchor"
)
```

| `clock_type` | reads | registers | comparable across SMs? |
|---|---|---|---|
| `"gpu"` | 64-bit GPU-wide ns timer | two | Yes |
| `"sm"` | 32-bit per-SM cycle counter | one | No |
| `"anchor"` | 32-bit per-SM counter, rebuilt to ns | one | Yes |

Optional: `sass_per_thread_records` (ring depth, default 32),
`sass_excluded_registers`, and `sass_arch`.

## Step 4: Render the report

A record is a point. `site_regions` pairs two sites into a region:

```python
from gwatch.common.format import File
from gwatch.cuda.xtrace.format import Section_IntraKernelTrace

section = Section_IntraKernelTrace()
section.add_run(
    result,
    site_regions=[(0, 1, "mainloop"), (2, 3, "epilogue")],
    scope_roles={"mainloop": "Math Warp", "epilogue": "Copy Warp"},
)
report = File(title="SASS trace")
report.add_section(section)
report.render("trace.html")     # the trace panel and the stats
report.render("trace.json")     # the records and the analysis block
```

- `scope_roles` groups the panel's rows by warp role.
- `do_trace` calls `fn` more than once, so measure the last pass.
- See [Read Xtrace with Your Agent](/docs/humanize/xtrace/visualize-xtrace-for-agent/)
  for both report formats.
