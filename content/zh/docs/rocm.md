---
title: ROCm 支持
description: G-Watch 在 AMD GPU 上——为 HIP/ROCm/Triton kernel 提供硬件计数器采集、PC 采样、thread trace、kernel launch 追踪与 AMDGPU 二进制分析。
group: 平台
order: 1
---

# ROCm 支持（AMD GPU）

G-Watch 在 AMD GPU 上剖析与优化 **HIP / ROCm / Triton** kernel，能力栈与 NVIDIA 侧对应。同一套推理驱动的[自动优化闭环](/docs/humanize/auto-optimization/)同样适用——只是底层剖析原语不同。

## AMD 上的工具

| 工具 | 用途 |
|---|---|
| 基线测量 | 经 GPU event 的延迟与吞吐 |
| 计数器采集 | 按 kernel dispatch 的硬件性能计数器 |
| PC 采样 | 带 AMDGPU 反汇编的指令级 stall 分析 |
| Thread trace | 逐指令延迟热点与 wave 状态分解 |
| 二进制分析 | 运行时*与*静态 AMDGPU 二进制检视（拦截并反汇编，或从文件解析 code object / fat binary） |
| 正确性 | 对照参考实现验证 |

## 参考脚本

`GWATCH_PATH/rocm/_examples/` 下提供了一整套参考脚本，以 PyTorch GEMM（分派到 rocBLAS）为测试样例：

| 脚本 | 工具 |
|---|---|
| `do_flops.py` | 基线 |
| `do_counter_collection.py` | 计数器采集 |
| `do_pc_sampling.py` | PC 采样 |
| `do_thread_trace.py` | Thread trace |
| `do_binary_analysis_runtime.py` | 运行时二进制分析 |
| `do_binary_analysis_static.py` | 静态二进制分析 |
| `do_correctness.py` | 正确性 |

`examples/rocm/`（`trace/`、`binary/`、`profiler/`）下还有更多独立示例——kernel launch 追踪、code object / HIP fatbin 解析、AMDGPU 指令解码、CFG + liveness 分析。

## 运行时配置

ROCm 脚本遵循一致的顺序：

- 对于**硬件剖析**（计数器、PC 采样、thread trace）：**先 `import torch` 再 `gwatch.rocm.profile`**，然后在**任何 GPU 工作之前**创建 `ProfileContext()`——torch 的 HIP 库必须先加载，且 profiler 必须在 GPU 操作开始前注册。
- 对于 **kernel launch 追踪与二进制分析**：改为在 **`import torch` 之前**调用 `enable_rocm_tracing()`。

每个脚本都接受 `--config <path.json>` 以批量跑多个测试 case，与 CUDA 工具一致。

## 相关

- [自动优化](/docs/humanize/auto-optimization/)——优化闭环的 NVIDIA 版本；方法论完全相同。
- [简介](/docs/humanize/introduction/)——整体能力栈。
