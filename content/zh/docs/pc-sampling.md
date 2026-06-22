---
title: PC 采样
description: 找出指令级热点与主导的 warp stall 原因——访存等待、依赖、分支发散、throttle——并映射到源码与 SASS 行。
group: 性能剖析
order: 2
---

# PC 采样

PC 采样识别**指令级热点与主导 stall 原因**。它告诉你 warp 调度器在*哪些* PC 上 stall、以及*为什么*（访存等待、依赖 stall、分支发散、MIO/throttle……），并映射到源码与反汇编后的 SASS 行。

> **哪些具体指令在 stall，为什么？**

请在 [range profiling](/docs/humanize/range-profiling/) 建立宏观瓶颈**之后**再跑——否则你读到的指令缺乏对应的硬件背景。

- **参考脚本：** `GWATCH_PATH/cuda/_examples/do_pc_sampling.py`
- **底层 API：** `gwatch.cuda.profile.do_pc_sample`
- **报告 section：** `Section_PCSampling`

## 运行

```bash
# 单个 case
python3 GWATCH_PATH/cuda/_examples/do_pc_sampling.py \
    --M 1024 --N 1024 --K 1024 \
    --kernel-regex ".*matmul.*" \
    --rep 50

# 用 config 文件批量
python3 GWATCH_PATH/cuda/_examples/do_pc_sampling.py \
    --config test_configs.json \
    --kernel-regex ".*matmul.*" --rep 50
```

调用：

```python
result = gw_profile.do_pc_sample(
    fn=run_once,
    list_kernel_names=[".*matmul.*"],   # 正则
    rep=50,                             # profiler pass 数；计数会聚合
)
```

`--rep` 越高直方图越密，但耗时越长。50 是合理默认值；对短（亚毫秒）kernel，每 pass 样本稀疏，可提到 100–200。

> **调用 `do_pc_sample` 前不要预热目标 kernel。** 采样器会锁定其活动窗口内观测到的第一个 kernel。如果你为"预热"先跑一次 kernel，采样器可能锁定到无关的记账 kernel（allocator 辅助、NCCL 探测、JIT 副产物），从而对你的 kernel 报告零样本。**把目标 kernel 的首次执行放进 `fn=run_once` 里。** `--rep` 已涵盖等效预热——第一个 pass 就充当预热。
>
> **不要并发运行剖析工具**——CUPTI session 互斥。

## 导出报告

| 后缀 | 输出 |
|---|---|
| `.yaml` / `.yml` | 规范归档——每个 kernel + 逐 PC stall 直方图 + 产生这些样本的 launch 元数据。 |
| `.html` / `.htm` | 交互式逐 kernel 卡片：可排序的逐 PC 表（`PC \| 源码 \| SASS \| 总数 \| 主因 \| 分解条`）、聚合 stall 原因汇总、每种原因稳定配色、搜索框。 |

```bash
python3 GWATCH_PATH/cuda/_examples/do_pc_sampling.py \
    --config test_configs.json \
    --kernel-regex ".*matmul.*" --rep 50 \
    --report reports/pc_sampling.html
```

YAML 结构：

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
              source: { file: <str>, line: <int> }   # 或 null
              sass_instruction: <str>                 # 或 null
              stall_reasons: { <reason>: <count>, ... }
```

stall 原因计数是所有 `rep` pass 的求和——除以 `rep` 得到每 pass 均值。

## 诊断流程

1. **先读聚合的 stall 原因汇总**——它告诉你*什么*在 stall（访存、依赖、分支……）。
2. **下钻逐 PC 表**——按总 stall 数排序，看前 5 个 PC。`source` 与 `sass_instruction` 列告诉你每个热点*在哪*。
3. **交叉参考**——需要热点 PC 周围的 SASS 指令窗口时，用[二进制分析](/docs/humanize/binary-analysis/)。

## 前后对比纪律

针对某个 stall 原因做了改动后，用**相同的 `--rep`** 重跑并对比：

- 主导 stall 原因——目标原因是否下降？
- 前 N 个 PC——原热点是否在榜上下移？

> 用 `source`（`{file, line}`）或 `sass_instruction` 对比，**不要用原始 PC**——PC 值绑定到具体 cubin，重新构建后同一源码行会落在不同的 PC。

## 常见坑

- **在采样上下文外预热 kernel**——症状：`num_sampled_pcs` 异常低，或 `kernel_name` 与你的正则不符。修复：去掉预热。
- **短 kernel 的 `--rep` 太低**——直方图发平；提到 100–200。
- **跨重新构建比较 PC**——改用 `source` / `sass_instruction` 比较。
- 忘了在首次 kernel 执行前 `import gwatch.cuda`。

## 相关

- [Range Profiling](/docs/humanize/range-profiling/)——先建立宏观瓶颈。
- [二进制分析](/docs/humanize/binary-analysis/)——热点 PC 周围的 SASS 窗口 / CFG。
- [Kernel 内追踪](/docs/humanize/intra-kernel-tracing/)——时间/phase 视图。
