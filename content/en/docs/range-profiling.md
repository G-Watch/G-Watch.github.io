---
title: Range Profiling
description: Collect hardware performance-counter metrics per kernel launch to diagnose the macro-level bottleneck — memory- vs compute-bound, pipe pressure, occupancy.
group: Profiling
order: 1
---

# Range Profiling

Range profiling collects **hardware performance-counter metrics** per kernel invocation. It answers the macro-level question:

> **Which hardware resource is the bottleneck?** — memory- vs compute-bound, pipe pressure, occupancy, achieved-vs-peak throughput.

It is usually the **first diagnostic step**: run it to establish the macro picture before drilling into instructions ([PC sampling](/docs/humanize/pc-sampling/)) or phases ([intra-kernel tracing](/docs/humanize/intra-kernel-tracing/)).

- **Reference script:** `GWATCH_PATH/cuda/_examples/do_range_profile.py`
- **Underlying API:** `gwatch.cuda.profile.do_range_profile`
- **Report section:** `Section_RangeProfile`

## Identify the target kernel

Profiling targets kernels by a **regex matched against the mangled prototype**. Discover the launched kernel names once:

```python
import gwatch.cuda.profile as gw_profile

pcontext = gw_profile.ProfileContext()
pcontext.start_tracing_kernel_launch()

run_workload()
import torch; torch.cuda.synchronize()

for k in pcontext.stop_tracing_kernel_launch():
    print(k.definition.mangled_prototype,
          f"grid:({k.grid_dim_x},{k.grid_dim_y},{k.grid_dim_z})",
          f"block:({k.block_dim_x},{k.block_dim_y},{k.block_dim_z})")
```

Build a regex from the names — e.g. `".*matmul.*"`, `".*flash.*"`.

## Discover and select metrics

> **You must discover actual metric names on the target chip.** Names vary across GPU architectures (GA100 vs GH100 vs GB100) and G-Watch versions. **Never guess or use memorized names** — an incorrect name silently returns no data or errors out.

Inspect chip topology, then list candidate metrics (always pipe through `grep` — unfiltered output floods the terminal):

```bash
gwatch show-topo --chip gh100

gwatch list-metrics --chip gh100 --unit smsp --subunit sass | grep -i "cycle"
gwatch list-metrics --chip gh100 --unit l1tex              | grep -i "throughput"
gwatch list-metrics --chip gh100 --unit dram               | grep -i "bytes"

gwatch show-metric-details --chip gh100 --name <metric_base_name>
```

Pick a **focused set of 4–10 metrics** that can separate likely bottlenecks: tensor-pipe utilization, active/elapsed cycle ratios, memory throughput / latency pressure, dependency indicators.

## Run

```bash
# single case
python3 GWATCH_PATH/cuda/_examples/do_range_profile.py \
    --M 1024 --N 1024 --K 1024 \
    --metrics "sm__cycles_active.avg.pct_of_peak_sustained_elapsed" \
    --kernel-regex ".*matmul.*"

# batch over a config file
python3 GWATCH_PATH/cuda/_examples/do_range_profile.py \
    --config test_configs.json \
    --metrics "sm__cycles_active.avg.pct_of_peak_sustained_elapsed"
```

The call itself is small:

```python
result = gw_profile.do_range_profile(
    fn=run_once,
    list_metric_names=metric_names,       # list[str], from `gwatch list-metrics`
    list_kernel_names=[".*matmul.*"],     # regex patterns
)
```

> Use **one metric at a time** (or a tight related set). CUPTI's range profiler replays the workload once per metric pass — collecting many at once inflates wall-clock cost. **Do not run profiling tools concurrently** — CUPTI sessions are mutually exclusive.

## Dump a report

Pass `--report`; the format is inferred from the suffix.

| Suffix | Output |
|---|---|
| `.yaml` / `.yml` | Canonical structured archive — full pass-through of every launch's metadata + metric values. Use this for re-analysis. |
| `.html` / `.htm` | Interactive sortable table (per-launch row, one column per metric, aggregate Σ/x̄ footer). |

```bash
python3 GWATCH_PATH/cuda/_examples/do_range_profile.py \
    --config test_configs.json \
    --metrics "sm__cycles_active.avg.pct_of_peak_sustained_elapsed" \
    --report reports/range_profile.yaml
```

The YAML walks as:

```yaml
data:
  runs:
    - range_name: default_range
      metric_names: [<the metrics you collected>]
      profile_results:
        - launch_index: 0
          kernel_metadata: { kernel_name: <mangled>, grid_dim: [...], block_dim: [...], shared_mem_bytes: <int> }
          metrics: { <metric>: <value> }
```

## Before/after discipline

When verifying that a change moved the targeted resource:

1. Re-run with the **same `--metrics` set** so values diff directly.
2. Save into a fresh `--report` file per run (e.g. `range_profile_after.yaml`).
3. Compare the per-launch `metrics` dict before-vs-after and record which metrics moved.

## Common pitfalls

- Guessing metric names instead of running `gwatch list-metrics`.
- Using too many metrics at once — replay overhead explodes.
- Comparing results across different shapes / dtypes / devices.
- Forgetting to `import gwatch.cuda` before the first kernel execution.
- Not warming up before measurement.

## Related

- [PC sampling](/docs/humanize/pc-sampling/) — once the macro bottleneck is pinned, localize it to specific stalling instructions.
- [Intra-kernel tracing](/docs/humanize/intra-kernel-tracing/) — the temporal/phase view inside the kernel.
- [Auto-optimization](/docs/humanize/auto-optimization/) — the full profile → change → verify loop.
