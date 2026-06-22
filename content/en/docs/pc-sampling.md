---
title: PC Sampling
description: Find instruction-level hotspots and the dominant warp-stall reasons — memory waits, dependency, divergence, throttles — mapped to source and SASS lines.
group: Profiling
order: 2
---

# PC Sampling

PC sampling identifies **instruction-level hotspots and the dominant stall reasons**. It tells you *which* PCs the warp scheduler stalled at and *why* (memory waits, dependency stalls, branch divergence, MIO/throttle, …), mapped to source and decoded SASS lines.

> **Which specific instructions stall, and why?**

Run it **after** [range profiling](/docs/humanize/range-profiling/) has established the macro bottleneck — otherwise you'll be reading instructions whose hardware context you don't understand.

- **Reference script:** `GWATCH_PATH/cuda/_examples/do_pc_sampling.py`
- **Underlying API:** `gwatch.cuda.profile.do_pc_sample`
- **Report section:** `Section_PCSampling`

## Run

```bash
# single case
python3 GWATCH_PATH/cuda/_examples/do_pc_sampling.py \
    --M 1024 --N 1024 --K 1024 \
    --kernel-regex ".*matmul.*" \
    --rep 50

# batch over a config file
python3 GWATCH_PATH/cuda/_examples/do_pc_sampling.py \
    --config test_configs.json \
    --kernel-regex ".*matmul.*" --rep 50
```

The call:

```python
result = gw_profile.do_pc_sample(
    fn=run_once,
    list_kernel_names=[".*matmul.*"],   # regex patterns
    rep=50,                             # profiler passes; counts are aggregated
)
```

A higher `--rep` gives a denser histogram but takes longer. 50 is a reasonable default; bump to 100–200 for short (sub-millisecond) kernels where per-pass samples are sparse.

> **Do NOT warm up the target kernel before calling `do_pc_sample`.** The sampler latches onto the first kernel it observes inside its active window. If you run the kernel once "to warm up", the sampler may lock onto an unrelated bookkeeping kernel (allocator helpers, NCCL probes, JIT byproducts) and report zero samples for your kernel. **Keep the first execution of the target kernel inside the `fn=run_once` callable.** `--rep` already covers any warmup-equivalent settling — the first pass acts as the warmup.
>
> **Do not run profiling tools concurrently** — CUPTI sessions are mutually exclusive.

## Dump a report

| Suffix | Output |
|---|---|
| `.yaml` / `.yml` | Canonical archive — every kernel + per-PC stall histogram + the launch metadata that produced the samples. |
| `.html` / `.htm` | Interactive per-kernel cards: a sortable per-PC table (`PC \| source \| SASS \| total \| top reason \| breakdown bar`), an aggregated stall-reason summary, a stable colour per reason, and a search box. |

```bash
python3 GWATCH_PATH/cuda/_examples/do_pc_sampling.py \
    --config test_configs.json \
    --kernel-regex ".*matmul.*" --rep 50 \
    --report reports/pc_sampling.html
```

The YAML walks as:

```yaml
data:
  runs:
    - rep: 50
      profile_results:
        - kernel_name: <mangled>
          num_sampled_pcs: <int>
          samples:
            - pc: <int>
              pc_hex: "0x..."
              source: { file: <str>, line: <int> }   # or null
              sass_instruction: <str>                 # or null
              stall_reasons: { <reason>: <count>, ... }
```

Stall-reason counts are summed across all `rep` passes — divide by `rep` for per-pass averages.

## Diagnostic flow

1. **Read the aggregated stall-reason summary first** — this tells you *what* is stalling (memory, dependency, branch, …).
2. **Drill into the per-PC table** — sort by total stalls, look at the top 5 PCs. The `source` and `sass_instruction` columns tell you *where* each hotspot lives.
3. **Cross-reference** a hot PC with [binary analysis](/docs/humanize/binary-analysis/) when you need the surrounding SASS instruction window.

## Before/after discipline

After a change targeted at a specific stall reason, re-run with the **same `--rep`** and compare:

- The dominant stall reason — did the targeted reason drop?
- The top-N PCs — did the previous hotspot move down the list?

> Compare by `source` (`{file, line}`) or `sass_instruction`, **not by raw PC** — PC values are tied to a specific cubin, so the same source line lives at a different PC after a rebuild.

## Common pitfalls

- **Warming up the kernel outside the sampling context** — symptom: `num_sampled_pcs` suspiciously low, or `kernel_name` doesn't match your regex. Fix: remove the pre-call warmup.
- **`--rep` too low for short kernels** — the histogram looks flat; bump to 100–200.
- **Comparing PCs across rebuilds** — compare by `source` / `sass_instruction`.
- Forgetting to `import gwatch.cuda` before the first kernel execution.

## Related

- [Range profiling](/docs/humanize/range-profiling/) — establish the macro bottleneck first.
- [Binary analysis](/docs/humanize/binary-analysis/) — the SASS window / CFG around a hot PC.
- [Intra-kernel tracing](/docs/humanize/intra-kernel-tracing/) — the temporal/phase view.
