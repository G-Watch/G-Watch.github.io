---
title: 简介
description: G-Watch 是什么——一个面向智能体的 GPU/TPU kernel 优化工具箱，涵盖性能剖析、程序分析与自动优化闭环。
group: 开始使用
order: 1
---

# 简介

**G-Watch** 是一个面向**智能体（agent）的 GPU/TPU kernel 优化**工具箱。它让你和你的编程智能体能够*看清* GPU kernel 内部：哪个硬件资源是瓶颈、哪些指令在 stall 以及为什么、kernel 内各 phase 何时运行、编译器到底生成了什么。

G-Watch 由两大支柱构成：

- **性能剖析（Profiling）**——在 NVIDIA、AMD GPU（以及 Google TPU）上提供丰富的运行时硬件观测：硬件计数器 range profiling、指令级 PC 采样、kernel 内 phase 追踪。
- **程序分析（Program Analysis）**——用于检视编译器生成的 GPU/TPU 二进制（SASS / AMDGPU）的工具，支撑寄存器分析、二进制插桩等二次开发任务。

在此之上，G-Watch 提供 **agent skill**，把这些基础能力组织成一个有纪律、推理驱动的**自动优化闭环**。

## 能力栈

G-Watch 的诊断工具在四个分辨率上回答不同的问题。一次典型的排查会自上而下、由粗到细地走这个栈。

| 能力 | 回答的问题 | 文档 |
|---|---|---|
| [Range Profiling](/docs/humanize/range-profiling/) | *哪个硬件资源是瓶颈？*——访存 vs 计算瓶颈、pipe 压力、占用率、达成-对-峰值吞吐。 | 按 launch 的硬件计数器。 |
| [PC 采样](/docs/humanize/pc-sampling/) | *哪些具体指令在 stall，为什么？*——主导 stall 原因，映射到源码与 SASS 行。 | 指令级热点。 |
| [Kernel 内追踪](/docs/humanize/intra-kernel-tracing/) | *每个 phase 何时运行、如何重叠？*——流水线气泡、同步开销、warp 角色调度。 | 唯一的 kernel 内时间视图。 |
| [二进制分析](/docs/humanize/binary-analysis/) | *热点 PC 周围的指令窗口、地址-到-行映射、CFG 是什么样？* | SASS 级检视。 |
| [自动优化](/docs/humanize/auto-optimization/) | *如何驱动上述能力把 kernel 真正变快？* | 编排好的智能体闭环。 |

## 适用范围

剖析与追踪工具是 **DSL 无关**的，同一套流程适用于：

- **CUDA C++** kernel（包括原始 Hopper `wgmma` matmul 与 FlashAttention），
- **Triton** kernel，
- **CuTe DSL** kernel，
- **TileLang** kernel，
- AMD GPU 上的 **HIP / ROCm** kernel（见 [ROCm 支持](/docs/humanize/rocm/)）。

## 如何挂载

G-Watch 使用 CUPTI 回调钩子在运行时拦截 CUDA driver API。执行 `import gwatch.cuda` 时 capsule 会自动初始化，为后续所有模块加载与 kernel launch 装好钩子。**无需特殊启动器，也不需要 `LD_PRELOAD`**——直接运行你的 Python 脚本即可：

```bash
python3 your_script.py ...
```

> 唯一的规则：`import gwatch.cuda` 必须发生在**首次 CUDA kernel 执行之前**。在 `import torch` 之后再导入是可以的——torch 只在首次使用时惰性加载 kernel 模块。

## 下一步

- [安装](/docs/humanize/installation/)——从 PyPI 安装或从源码构建，并装上 agent skill。
- [Range Profiling](/docs/humanize/range-profiling/)——用硬件计数器开始你的第一次诊断。
