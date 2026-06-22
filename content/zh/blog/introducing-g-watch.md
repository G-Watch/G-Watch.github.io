---
title: G-Watch 发布
description: 一个面向智能体的 GPU/TPU kernel 优化工具箱——性能剖析、程序分析，以及推理驱动的自动优化闭环。
date: 2026-06-22
tags: [公告]
---

# G-Watch 发布

长期以来，GPU kernel 优化是少数专家盯着 profiler 输出才玩得转的手艺。**G-Watch** 想要改变这一点——它让工程师*和*编程智能体都能看清 kernel 内部，并据此采取行动。

G-Watch 是一个面向**智能体（agent）的 GPU/TPU kernel 优化**工具箱，围绕两大支柱组织。

## 性能剖析

在 NVIDIA、AMD GPU（以及 Google TPU）上提供丰富的运行时硬件观测：

- **[Range Profiling](/docs/humanize/range-profiling/)**——按 launch 的硬件性能计数器，定位宏观瓶颈（访存 vs 计算瓶颈、pipe 压力、占用率）。
- **[PC 采样](/docs/humanize/pc-sampling/)**——指令级热点与主导的 warp stall 原因，映射到源码与 SASS 行。
- **[Kernel 内追踪](/docs/humanize/intra-kernel-tracing/)**——kernel 内的 phase 时间线，揭示流水线气泡与同步开销。唯一具备这一时间视图的工具。

## 程序分析

用于检视编译器生成的 GPU/TPU 二进制的工具——反混淆 kernel 名、遍历反汇编 SASS、映射 PC→源码行、导出控制流图。这套[二进制分析](/docs/humanize/binary-analysis/)基础也支撑寄存器分析、二进制插桩等二次开发任务。

## 为智能体而生

在基础能力之上，G-Watch 提供 **agent skill**，驱动一个有纪律、推理驱动的[自动优化闭环](/docs/humanize/auto-optimization/)：剖析 → 提出假设 → 施加一处最小改动 → 验证正确性、性能与硬件行为 → 重复。每次迭代都是对上一次磁盘证据的有理回应——不做投机式或散弹式尝试。

整套栈是 **DSL 无关**的：CUDA C++、Triton、CuTe DSL、TileLang 以及 AMD 上的 HIP 都走同一套流程。

## 开始使用

```bash
pip install gwatch
npx skills add mars-compute-ai/G-Watch -a claude-code -a codex -a gemini-cli
```

随后前往[文档](/docs/humanize/introduction/)运行你的第一次诊断。
