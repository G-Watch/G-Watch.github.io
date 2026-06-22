---
title: Binary Analysis
description: Inspect compiler-generated SASS binaries — demangle kernels, walk decoded instructions, map PC→source line, and dump the control-flow graph and basic blocks.
group: Program Analysis
order: 1
---

# Binary Analysis

Binary analysis inspects kernel binaries at the **SASS instruction level**. Use it to correlate a PC-sampling hotspot with the surrounding instruction window, demangle kernel names, walk the decoded instruction stream, pull the address → source-line mapping (when DWARF is present), and dump the control-flow graph.

> **What's the instruction window around a hot PC, the address-to-line map, the CFG?**

It works in two modes:

- **Runtime-loaded** — analyze kernels that have already loaded at runtime, intercepted via CUPTI.
- **Static** — analyze a cubin / fatbin straight from a file.

Use it for *context* around a hotspot, not as the primary diagnostic — [PC sampling](/docs/humanize/pc-sampling/) already attaches each PC's source and SASS line.

## Runtime-loaded analysis

The kernel map is **only populated after the workload has run and loaded its kernels** — run the workload and `torch.cuda.synchronize()` *before* calling `get_map_kerneldef_sass()`.

```python
import re, torch
import gwatch.cuda.profile as gw_profile
import gwatch.cuda.binary as gw_binary

pcontext = gw_profile.ProfileContext()

# run the workload once so kernels load and CUPTI sees them
run_workload()
torch.cuda.synchronize()

kernel_map = pcontext.get_map_kerneldef_sass()
for mangled, kdef in kernel_map.items():
    demangled = gw_binary.BinaryUtility.demangle(mangled)
    # walk decoded SASS instructions, PC→source map, CFG, ...
```

> `import gwatch.cuda` must happen **before the first CUDA kernel execution** so CUPTI hooks are active before the target module loads. Do not call `get_map_kerneldef_sass()` before the target kernels have actually launched.

## Static analysis (cubin / SASS CFG)

Generate a SASS control-flow-graph report for one kernel of a cubin in both human-readable HTML and agent-readable YAML:

```bash
python3 examples/cuda/binary/show_sass_cfg.py --kernel CollectiveMainloopFwd \
    --render-yaml fa3.yaml --render-html fa3.html
```

- `--kernel SUBSTR` picks the shortest mangled kernel name containing `SUBSTR`.
- `--render-html PATH` writes a self-contained interactive CFG report.
- `--render-yaml PATH` writes a structured YAML dump of the same CFG.
- `--cubin PATH` points at a different cubin (a default is loaded otherwise).

## What you can inspect

The `examples/cuda/binary/` directory demonstrates the full surface:

| Example | What it shows |
|---|---|
| `show_sass_instructions.py` | Decoded SASS instruction stream |
| `show_sass_cfg.py` | Control-flow graph & basic blocks |
| `show_sass_register_liveness.py` | Register liveness analysis |
| `show_sass_dwarf.py` / `show_sass_ptx_dwarf.py` | PC → source-line mapping via DWARF |
| `show_instruction_latency.py` | Per-instruction latency model |
| `show_ptx_info.py` / `show_ptx_instructions.py` | PTX-level inspection |
| `show_cubin_info.py` / `show_cudnn_cubin.py` | Cubin metadata, cuDNN cubins |

This makes G-Watch's binary analysis the foundation for **secondary-development tasks** such as register analysis and binary instrumentation — the same machinery that powers intra-kernel tracing's PTX splicing.

## When to use

- The **instruction window around** a hot PC ([PC sampling](/docs/humanize/pc-sampling/) gives only the single line).
- **Programmatically walking** a kernel — count an opcode's occurrences, validate the compiler emitted the expected sequence after a change.
- A **CFG dump** — e.g. when an optimization is supposed to remove or merge basic blocks.

## Related

- [PC sampling](/docs/humanize/pc-sampling/) — find the hot PC first; come here for the window around it.
- [Intra-kernel tracing](/docs/humanize/intra-kernel-tracing/) — built on the same PTX/SASS instrumentation machinery.
- [Auto-optimization](/docs/humanize/auto-optimization/) — verify a code change altered the SASS / CFG as intended.
