---
title: 二进制分析
description: 检视编译器生成的 SASS 二进制——反混淆 kernel 名、遍历反汇编指令、映射 PC→源码行、导出控制流图与基本块。
group: 程序分析
order: 1
---

# 二进制分析

二进制分析在 **SASS 指令级**检视 kernel 二进制。用它把 PC 采样热点与周围指令窗口对应起来、反混淆 kernel 名、遍历反汇编指令流、拉取地址→源码行映射（存在 DWARF 时）、并导出控制流图。

> **热点 PC 周围的指令窗口、地址-到-行映射、CFG 是什么样？**

它有两种模式：

- **运行时加载**——分析运行时已加载的 kernel，经 CUPTI 拦截。
- **静态**——直接从文件分析 cubin / fatbin。

它用于热点周围的*上下文*，而非主要诊断——[PC 采样](/docs/humanize/pc-sampling/)已经为每个 PC 附上了源码与 SASS 行。

## 运行时加载分析

kernel map **只有在 workload 实际运行并加载了它的 kernel 之后**才会被填充——在调用 `get_map_kerneldef_sass()` *之前*要先运行 workload 并 `torch.cuda.synchronize()`。

```python
import re, torch
import gwatch.cuda.profile as gw_profile
import gwatch.cuda.binary as gw_binary

pcontext = gw_profile.ProfileContext()

# 先跑一次 workload，让 kernel 加载、CUPTI 看到它们
run_workload()
torch.cuda.synchronize()

kernel_map = pcontext.get_map_kerneldef_sass()
for mangled, kdef in kernel_map.items():
    demangled = gw_binary.BinaryUtility.demangle(mangled)
    # 遍历反汇编 SASS 指令、PC→源码映射、CFG ...
```

> `import gwatch.cuda` 必须发生在**首次 CUDA kernel 执行之前**，以便目标模块加载前 CUPTI 钩子已生效。不要在目标 kernel 实际 launch 之前调用 `get_map_kerneldef_sass()`。

## 静态分析（cubin / SASS CFG）

为 cubin 中某个 kernel 生成 SASS 控制流图报告，同时输出人类可读的 HTML 与 agent 可读的 YAML：

```bash
python3 examples/cuda/binary/show_sass_cfg.py --kernel CollectiveMainloopFwd \
    --render-yaml fa3.yaml --render-html fa3.html
```

- `--kernel SUBSTR` 选取包含 `SUBSTR` 的最短 mangled kernel 名。
- `--render-html PATH` 写出自包含的交互式 CFG 报告。
- `--render-yaml PATH` 写出同一份 CFG 的结构化 YAML。
- `--cubin PATH` 指向另一个 cubin（否则加载默认值）。

## 可检视的内容

`examples/cuda/binary/` 目录展示了完整能力面：

| 示例 | 展示内容 |
|---|---|
| `show_sass_instructions.py` | 反汇编 SASS 指令流 |
| `show_sass_cfg.py` | 控制流图与基本块 |
| `show_sass_register_liveness.py` | 寄存器 liveness 分析 |
| `show_sass_dwarf.py` / `show_sass_ptx_dwarf.py` | 经 DWARF 的 PC → 源码行映射 |
| `show_instruction_latency.py` | 逐指令延迟模型 |
| `show_ptx_info.py` / `show_ptx_instructions.py` | PTX 级检视 |
| `show_cubin_info.py` / `show_cudnn_cubin.py` | cubin 元数据、cuDNN cubin |

这使 G-Watch 的二进制分析成为**二次开发任务**（如寄存器分析、二进制插桩）的基础——也正是 kernel 内追踪做 PTX 拼接所依赖的同一套机制。

## 何时使用

- 热点 PC **周围的指令窗口**（[PC 采样](/docs/humanize/pc-sampling/)只给单行）。
- **以编程方式遍历** kernel——统计某 opcode 出现次数、验证改动后编译器是否生成了预期序列。
- **CFG 导出**——例如某优化本应删除或合并基本块时。

## 相关

- [PC 采样](/docs/humanize/pc-sampling/)——先找到热点 PC，再来这里看它周围的窗口。
- [Kernel 内追踪](/docs/humanize/intra-kernel-tracing/)——构建于同一套 PTX/SASS 插桩机制之上。
- [自动优化](/docs/humanize/auto-optimization/)——验证某次代码改动是否按预期改变了 SASS / CFG。
