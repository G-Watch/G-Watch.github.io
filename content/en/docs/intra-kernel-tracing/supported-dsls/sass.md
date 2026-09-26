---
title: SASS
description: Trace a kernel by splicing probes into its compiled cubin — no source markers, no recompile, no PTX.
order: 10
---

The other pages in this section mark scopes in source. The **SASS** tier works
one level down: it splices probes into an already-compiled cubin, and you name
the **machine instructions** to observe. Nothing is edited and nothing is
rebuilt, so this is the tier for a kernel whose source you do not have — and for
an instruction no source line owns.

## Example

A runnable example is available at
[`examples/cuda/trace/trace_cuda_matmul_sass.py`](https://github.com/mars-compute-ai/G-Watch/blob/main/examples/cuda/trace/trace_cuda_matmul_sass.py).

```bash
python3 examples/cuda/trace/trace_cuda_matmul_sass.py --source-line 29 --clock gpu
```

## Find the instruction index

A site is named by its **instruction index** — the pc is `index * isize`. Load
the cubin statically (no GPU, no launch) and read the indices off it:

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

One source line maps to several instructions, so `candidates` is a list and you
choose from it.

## Declare the sites

```python
from gwatch.cuda.trace import SassTraceSite

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
| `insert_index` | instruction index; the pc is `insert_index * isize` |
| `value_reg` | a **physical** register to record, or `None` for timestamp-only |
| `value_width_bits` | 32, or 64 for a device address — which must come from an **even** register, since a 64-bit operand is a register pair |
| `value_is_uniform` | the number indexes the uniform register file, not the general one |
| `value_is_smid` | record the SM the block runs on instead of a register |
| `warp_level` | one record per warp, stored by an elected lane, instead of one per thread |

Each site gets a dense `site_id` — its position in the list — and that id is
written into every record.

## Trace

```python
from gwatch.cuda.trace import do_trace

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
| `"gpu"` | 64-bit GPU-wide ns timer | two | yes, directly |
| `"sm"` | 32-bit per-SM cycle counter | one | no — each SM counts from its own origin |
| `"anchor"` | 32-bit per-SM counter, rebuilt to ns | one | yes |

Other parameters: `sass_per_thread_records` sets the per-row ring depth (32 by
default), `sass_excluded_registers` withholds registers from the probe, and
`sass_arch` picks a different image when a library ships one per architecture.

## Render the report

A SASS record is a **point** — `{global_tid, site_id, value, timestamp}` — so
say which two sites bound a region and the report pairs them into intervals:

```python
from gwatch.common.format import File
from gwatch.cuda.trace.format import Section_IntraKernelTrace

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

A few things to note:

- **`site_regions`** is a list of `(enter_site, leave_site, label)`. Without it
  the report carries per-site aggregates only — how often each site fired, over
  how many rows, and the gap between one row's consecutive firings.
- **`scope_roles`** names the warp role each region belongs to, which groups the
  panel's rows and its legend.
- **`do_trace` restores the original kernel before it returns**, and calls `fn`
  more than once. Measure inside `fn` and take the last pass.
- `Section_IntraKernelTrace` renders to interactive **HTML** (`.html`) or a
  machine-readable **JSON** (`.json`) archive, picked from the output extension;
  both are described in
  [Visualize Xtrace for Agent](/docs/humanize/intra-kernel-tracing/visualize-iket-for-agent/).

## Let your agent drive it

Which instruction to trace, how to read the records back, and what to check
before trusting them are workflow, not interface — and they are what the G-Watch
agent skills carry. Install them once:

```bash
npx skills add mars-compute-ai/G-Watch -g
```

then ask your coding agent in its own words: *"trace the inner loop of this
kernel at the SASS level"*. It picks up
`gwatch_cuda_intra_kernel_tracing_sass`, which knows how to choose sites, run
the trace, gate the result and read it back through `gwatch show`.
