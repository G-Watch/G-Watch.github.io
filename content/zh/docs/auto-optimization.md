---
title: 自动优化
description: 把剖析、诊断与验证编排成一个有纪律、推理驱动的 kernel 优化流程的智能体闭环。
group: 优化
order: 1
---

# 自动优化

自动优化 skill 把 G-Watch 的各项基础能力组织成一个有纪律的**推理驱动优化闭环**。智能体用它来迭代地剖析、诊断、改动、验证一个 kernel，直到它明显变快——不做投机式或散弹式尝试。

它适用于**任意** CUDA C++ / Triton / CuTe / TileLang kernel（以及 AMD 上的 HIP——见 [ROCm 支持](/docs/humanize/rocm/)）。

## 核心原则 —— 推理驱动迭代

> **每次迭代都必须是对上一次迭代观测与结果的有理回应。** 不做投机式迭代、不做散弹式尝试、不套固定模板。

每次迭代前，智能体必须依序：

1. **从磁盘读取**上一次迭代的产物（`post_flops.json`、`post_range_profile.yaml`、`post_pc_sampling.yaml`、`post_trace.yaml`）——磁盘上的文件才是真相之源，而非对对话的记忆。
2. **辨别发生了什么变化**（相对上上次）——量化（"`sm__cycles_active` 38.2% → 44.7%，DRAM 吞吐持平，延迟 −12.5%"）。
3. **形成一个具体假设**：*为什么*会这样，以及*哪一处改动*应当推动下一个数字。
4. **引用**支撑该假设的具体先前文件。
5. **选择本次迭代需要的工具**来检验假设——绝不套固定菜单。

若第 1–4 步说不清楚，这次迭代就还没准备好开始。

## 六个工具

闭环编排六个工具，分三组：

| # | 工具 | 组别 | 问题 |
|---|---|---|---|
| 1 | 基线测量 | 测量 | *kernel 有多快？* |
| 2 | [Range Profile](/docs/humanize/range-profiling/) | 诊断 | *哪个硬件资源是瓶颈？* |
| 3 | [PC 采样](/docs/humanize/pc-sampling/) | 诊断 | *哪些指令在 stall，为什么？* |
| 4 | [Kernel 内追踪](/docs/humanize/intra-kernel-tracing/) | 诊断 | *每个 phase 何时运行、如何重叠？* |
| 5 | [二进制分析](/docs/humanize/binary-analysis/) | 诊断 | *SASS 窗口 / CFG 是什么样？* |
| 6 | 正确性 | 验证 | *优化后的 kernel 输出是否仍正确？* |

**顺序规则：** 一次典型迭代自上而下走诊断栈——工具 1 → 工具 2 → 工具 3（和/或工具 4）→ 仅在需要更深 SASS 视图时用工具 5。工具选择是*推理的一部分*，而非预先承诺的固定流水线。

## 优化闭环

1. **发现** workload——入口、kernel 名、构建步骤、shape 参数。
2. **构建输入配置空间**——5–15 个代表性配置（尺寸、dtype、特性开关），存为 JSON config 文件。
3. **Iter 0（基线）**——对未改动的代码做基准与剖析；任何改动前都必须先做。
4. **从磁盘读取**上一次迭代的 `post_*` 文件。
5. **形成一个假设**，扎根于第 4 步的证据。
6. **改动最小相关代码区域**——每次迭代只改一处。
7. 需要的话**重新构建**。
8. 在*完整*配置空间上**验证正确性**——任一配置失败立即回退。
9. 在所有配置上**重新基准**；检查是否改善（或至少不退化）。
10. **重新剖析**改动后的 kernel，确认本次变化的硬件层面成因。
11. **仅当**性能跨配置改善、正确性处处通过、且剖析确认了预期硬件行为时，**才保留该改动**。
12. **重复**直到显著变快。

## 优先级顺序

> **代码逻辑与算法层面的改动始终优先于超参调优。**

1. **算法 / 数据搬运**——融合、数据复用、tiling 策略、计算重排、循环重构。
2. **硬件利用**——访存模式、向量化 load/store、warp 原语、tensor core 利用、共享内存布局。
3. **超参调优**——block 尺寸、`num_warps`、流水线 stage、展开因子。

朴素的 autotuner / 网格搜索**不是**主策略——它们不体现对瓶颈的理解，而且一次 50 trial 的 sweep 算**一次**迭代，不是五十次。

## 逐迭代 checkpoint

每次迭代在 report 路径下持久化一个文件夹（如 `iter_001_swizzle_smem/`），打包**叙事 + 证据 + diff**：

- `checkpoint.yaml` / `.html`——截至该迭代的累积智能体轨迹（六个结构化 facet：context、reasoning、action、observation、outcome、metadata）。
- `pre_*` / `post_*` 剖析与追踪报告。
- `code.patch`——本次改动（`git diff <baseline_commit>`）。

这让任意迭代都成为有效的恢复点，并让下游工具无需重跑 kernel 即可再分析优化轨迹。

## 交付物

一次完整运行产出：性能改善报告（逐配置完整结果表）、代码改动报告（逐改动收益 + 改动类型分类）、优化过程报告（每次尝试的时序日志，*成功与失败*都记）、合并后的 `optimized.patch`、对比柱状图，以及所有逐迭代 checkpoint 文件夹。

## 常见坑

- 忘了在首次 kernel 执行前 `import gwatch.cuda`。
- 对访存瓶颈 kernel 用 TFLOPS 作 KPI（应用 GBps），反之亦然。
- 接受加速却不做剖析来验证硬件层面成因。
- 在重新测量前堆叠多个未验证的改动。
- 改代码后跳过正确性验证。

## 相关

- [Range Profiling](/docs/humanize/range-profiling/) · [PC 采样](/docs/humanize/pc-sampling/) · [Kernel 内追踪](/docs/humanize/intra-kernel-tracing/) · [二进制分析](/docs/humanize/binary-analysis/)——本闭环所编排的诊断工具。
- [ROCm 支持](/docs/humanize/rocm/)——AMD GPU 上的等价闭环。
