---
title: Range Profiling
description: 按每次 kernel launch 采集硬件性能计数器，诊断宏观瓶颈——访存 vs 计算瓶颈、pipe 压力、占用率。
group: 性能剖析
order: 1
---

# Range Profiling

Range profiling 按每次 kernel 调用采集**硬件性能计数器**。它回答宏观层面的问题：

> **哪个硬件资源是瓶颈？**——访存 vs 计算瓶颈、pipe 压力、占用率、达成-对-峰值吞吐。

它通常是**第一个诊断步骤**：先用它建立宏观图景，再下钻到指令（[PC 采样](/docs/humanize/pc-sampling/)）或 phase（[kernel 内追踪](/docs/humanize/intra-kernel-tracing/)）。

- **参考脚本：** `GWATCH_PATH/cuda/_examples/do_range_profile.py`
- **底层 API：** `gwatch.cuda.profile.do_range_profile`
- **报告 section：** `Section_RangeProfile`

## 确定目标 kernel

剖析通过**对 mangled prototype 做正则匹配**来定位 kernel。先发现一次已 launch 的 kernel 名：

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

据此构建正则——如 `".*matmul.*"`、`".*flash.*"`。

## 发现并选择 metric

> **你必须在目标芯片上发现真实的 metric 名。** 名称随 GPU 架构（GA100 vs GH100 vs GB100）与 G-Watch 版本而变。**切勿凭记忆猜测**——错误的名称会静默返回空数据或报错。

先看芯片拓扑，再列候选 metric（务必用 `grep` 过滤，否则未过滤输出会刷屏）：

```bash
gwatch show-topo --chip gh100

gwatch list-metrics --chip gh100 --unit smsp --subunit sass | grep -i "cycle"
gwatch list-metrics --chip gh100 --unit l1tex              | grep -i "throughput"
gwatch list-metrics --chip gh100 --unit dram               | grep -i "bytes"

gwatch show-metric-details --chip gh100 --name <metric_base_name>
```

挑一个**聚焦的 4–10 个 metric 集合**，使其能区分可能的瓶颈：tensor-pipe 利用率、active/elapsed cycle 比、访存吞吐/延迟压力、依赖类指标。

## 运行

```bash
# 单个 case
python3 GWATCH_PATH/cuda/_examples/do_range_profile.py \
    --M 1024 --N 1024 --K 1024 \
    --metrics "sm__cycles_active.avg.pct_of_peak_sustained_elapsed" \
    --kernel-regex ".*matmul.*"

# 用 config 文件批量
python3 GWATCH_PATH/cuda/_examples/do_range_profile.py \
    --config test_configs.json \
    --metrics "sm__cycles_active.avg.pct_of_peak_sustained_elapsed"
```

调用本身很简单：

```python
result = gw_profile.do_range_profile(
    fn=run_once,
    list_metric_names=metric_names,       # list[str]，来自 `gwatch list-metrics`
    list_kernel_names=[".*matmul.*"],     # 正则
)
```

> **一次只用一个 metric**（或一小组相关 metric）。CUPTI 的 range profiler 会为每个 metric pass 重放一次 workload——一次采集太多会让墙钟时间暴涨。**不要并发运行剖析工具**——CUPTI session 是互斥的。

## 导出报告

传入 `--report`，格式由后缀推断。

| 后缀 | 输出 |
|---|---|
| `.yaml` / `.yml` | 规范结构化归档——逐 launch 的完整元数据 + metric 值。用于再分析。 |
| `.html` / `.htm` | 交互式可排序表格（逐 launch 一行，每个 metric 一列，底部聚合 Σ/x̄）。 |

```bash
python3 GWATCH_PATH/cuda/_examples/do_range_profile.py \
    --config test_configs.json \
    --metrics "sm__cycles_active.avg.pct_of_peak_sustained_elapsed" \
    --report reports/range_profile.yaml
```

YAML 结构：

```yaml
data:
  runs:
    - range_name: default_range
      metric_names: [<你采集的 metric>]
      profile_results:
        - launch_index: 0
          kernel_metadata: { kernel_name: <mangled>, grid_dim: [...], block_dim: [...], shared_mem_bytes: <int> }
          metrics: { <metric>: <value> }
```

## 前后对比纪律

在验证某次改动是否动了目标资源时：

1. 用**相同的 `--metrics` 集合**重跑，使数值可直接相减。
2. 每次跑都存到新的 `--report` 文件（如 `range_profile_after.yaml`）。
3. 对比前后逐 launch 的 `metrics` 字典，记录哪些 metric 动了。

## 常见坑

- 凭记忆猜 metric 名而不跑 `gwatch list-metrics`。
- 一次用太多 metric——重放开销暴涨。
- 跨不同 shape / dtype / 设备做对比。
- 忘了在首次 kernel 执行前 `import gwatch.cuda`。
- 测量前没有预热。

## 相关

- [PC 采样](/docs/humanize/pc-sampling/)——宏观瓶颈定位后，下钻到具体 stall 的指令。
- [Kernel 内追踪](/docs/humanize/intra-kernel-tracing/)——kernel 内的时间/phase 视图。
- [自动优化](/docs/humanize/auto-optimization/)——完整的 剖析 → 改动 → 验证 闭环。
