---
title: SASS
description: Trace a kernel by splicing probes into its compiled cubin — no source markers, no recompile, no PTX.
order: 10
---

SASS is not a DSL; it is the tier **below** all of them. Every page in this
section marks scopes in source and traces what the compiler made of them. The
SASS tier goes the other way: it takes an already-compiled cubin, and you name
the **machine instructions** to observe. Nothing is edited, nothing is rebuilt,
and the kernel does not have to be yours.

Reach for it when:

- you want **per-iteration timing of one instruction** inside a loop — a
  source-level scope cannot address a single machine instruction;
- the kernel is a **binary you cannot or must not rebuild** — a vendor cubin, a
  shipped fatbin, a third-party library;
- the instruction has **no clean source counterpart** — one unrolled copy, a
  spill reload, one particular `LDG`;
- you want to record a **register's value** at a point, not only a timestamp;
- PC sampling told you *which* instruction stalls and you now want that
  instruction's timeline across iterations and threads.

Use the source-marker tiers instead when you can edit the kernel and you want
phase structure: they give paired start/end intervals, where this tier gives
point observations you pair yourself.

## Example

A runnable example is available at
[`examples/cuda/trace/trace_cuda_matmul_sass.py`](https://github.com/mars-compute-ai/G-Watch/blob/main/examples/cuda/trace/trace_cuda_matmul_sass.py).
It traces a checked-in cubin at sites chosen by **source line**, so the run is
reproducible without a GPU-specific build:

```bash
python3 examples/cuda/trace/trace_cuda_matmul_sass.py --source-line 29 --clock gpu
```

## Pick the instructions to trace

Load the cubin statically — no GPU, no launch — and cross the DWARF line map
with the control-flow graph:

```python
import gwatch.cuda.binary as gw_binary

cubin = gw_binary.Cubin()
cubin.fill(CUBIN_PATH)
cubin.parse()
kernel_def = cubin.get_kerneldef_by_name(NAME)
kernel_def.parse_cfg()
isize = kernel_def.cfg.instruction_size        # 16 on sm_90

# every SASS instruction DWARF attributes to one source line
candidates = [
    index for index in range(len(kernel_def.list_instructions))
    if (kernel_def.map_address_to_line.get(index * isize) or (None, None))[1] == 29
]
```

One source line maps to **many** instructions across several basic blocks — the
compiler unrolls, schedules and duplicates — so there is a real choice to make.

**Pick the instruction whose probe the kernel can hide.** A probe ends in a
global store, and that store costs you only to the extent the kernel cannot
overlap it. Among a line's candidates, prefer the one with the most kernel work
still queued on the store's pipeline afterwards:

```python
import gwatch.cuda.experimental as gx

probe = gx.get_pipeline_occupancy_of_opcode(kernel_def, "STG")
occupancy = gx.get_list_pipeline_occupancy(kernel_def)

def overlap_after(index):
    """Kernel cycles on the probe store's pipeline still issued after index."""
    block = kernel_def.cfg.get_basic_block_by_pc(index * isize)
    end = block.base_pc // isize + block.nb_instructions
    return sum(entry["cycles"] for entry in occupancy[index + 1:end]
               if entry["pipe"] == probe["pipe"])

site_index = max(candidates, key=overlap_after)
```

Without line info you skip the DWARF filter and pick the index from the decoded
SASS directly; everything else is the same. Line info is present when the cubin
was built with `-lineinfo` or `-G` — Triton and CuTeDSL emit it by default, raw
CUDA C++ does not.

## Declare the sites

```python
from gwatch.cuda.trace import SassTraceSite

sites = [
    SassTraceSite(site_index),                        # timestamp only
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

## Run the trace

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

`do_trace` splices the probes, runs the callable, collects the records and
**puts the original kernel back before it returns** — so measure inside `fn`,
not after it. It also calls `fn` more than once (a scout pass while the kernel
is still being discovered, then the instrumented one), so take the last pass as
the instrumented number and keep the first beside it: the two coming out equal
is the check that the splice ever reached the launch.

### Timestamp source

| `clock_type` | reads | cost | comparable across SMs? |
|---|---|---|---|
| `"gpu"` | 64-bit GPU-wide ns timer | two registers | yes, directly; coarse (~32 ns) |
| `"sm"` | 32-bit per-SM cycle counter | one register | no — each SM counts from its own origin |
| `"anchor"` | 32-bit per-SM counter, rebuilt to ns | one register | yes |

`"gpu"` is the default and needs no post-processing. For a register-starved warp
where even the timestamp pair does not fit, `"anchor"` keeps the one-register
probe *and* recovers absolute time: each warp captures a `(globaltimer, SM
clock)` pair at entry and again before exit, and decode rebuilds every cheap
32-bit probe onto the ns axis using that warp's own measured rate. Prefer it
over `"sm"` whenever you need different blocks on one timeline.

## Read the result

A SASS record is a **point**, not an interval:

```
{"global_tid": ..., "site_id": ..., "value": ..., "timestamp": ...}
```

so the report has nothing to pair until you say which two sites bound a region.
Say it, and every view the source-marker tiers give works here too:

```python
from gwatch.common.format import File
from gwatch.cuda.trace.format import Section_IntraKernelTrace

section = Section_IntraKernelTrace()
section.add_run(
    result,
    # which two sites bound a region is your reading of the kernel, so G-Watch
    # never guesses it for you
    site_regions=[(0, 1, "mainloop"), (2, 3, "epilogue")],
    # the warp role each region belongs to, which groups the panel and the legend
    scope_roles={"mainloop": "Math Warp", "epilogue": "Copy Warp"},
)
report = File(title="SASS trace")
report.add_section(section)
report.render("trace.html")     # the trace panel and the stats
report.render("trace.json")     # the records and the analysis block
```

The analysis block then carries, per region, the intervals it paired, the rows
that produced one, the boundaries it had to drop, and the **pair rate** — twice
the intervals over the boundaries seen. Gate on that rate before anyone reads
the trace.

Without `site_regions` the report still carries per-site aggregates: how often
each site fired, over how many threads or warps, and the gap between one row's
consecutive firings — which on a loop-body site is that loop's per-iteration
time. Both tables print in
[`gwatch show`](/docs/humanize/intra-kernel-tracing/visualize-iket-for-agent/).

## Things that bite

- **A probe's staging registers must survive to its store.** The probe stages
  the address, the timestamp and any value into scratch registers that the
  store reads back. Prefer a site with a comfortable margin of instructions
  after it that do not write into that scratch; register pressure is thinnest
  inside tight tensor-core loops, which is exactly where the margin matters.
- **The ring is finite.** Each thread (or warp) keeps its most recent records,
  32 by default. A site that fires more often wraps and keeps only the newest —
  a count sitting exactly at the depth is a lower bound, not an execution count.
  `sass_per_thread_records` raises it, at the cost of a proportionally larger
  buffer.
- **One kernel name, several images.** A library ships one image per
  architecture under the same name, of different lengths, so an instruction
  index only means something in the image it was read from. `do_trace` defaults
  to the architecture the launch resolved to; pass `sass_arch` only to
  instrument a different one deliberately.
- **Architecture-family images cannot be instrumented.** An `sm_XXXf` image
  runs out of a linker-owned section group that a rebuild cannot carry.
  Serialization refuses one rather than handing the driver an image it cannot
  survive.
