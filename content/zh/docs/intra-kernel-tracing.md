---
title: Kernel 内追踪
description: 追踪 kernel 内部的 phase 时间线——单次 launch 内的各 phase 时长、流水线气泡、同步开销与 warp 角色调度。
group: 性能剖析
order: 3
---

# Kernel 内追踪（Intra-Kernel Tracing）

Kernel 内追踪观测 **kernel 内部的 scope / 时间线行为**。它是 G-Watch **唯一**能揭示单次 kernel 调用内各 phase *时间*关系的工具：

> **每个 phase 何时运行、如何重叠？**——流水线气泡、同步开销、warp 角色调度。

适用于**多 phase / 流水线 kernel**（FlashAttention、GEMM + epilogue、warp 专门化的 producer/consumer）。它**不适用于**单 phase 的逐元素算子——没有 phase 间结构可揭示。

- **参考脚本：** `GWATCH_PATH/cuda/_examples/do_trace.py`
- **底层 API：** `gwatch.cuda.trace.do_trace`
- **报告 section：** `Section_IntraKernelTrace`

## 工作原理

1. 在 CUPTI 下跑一次 kernel（侦察 pass），捕获其 launch 元数据与 PTX。
2. 从 scope marker 嵌入的哨兵构建 `TraceSchema`。
3. 分配设备侧 `TraceBuffer`，在每个哨兵处拼接逐线程记录存储，JIT 编译插桩后的 PTX，并换上插桩后的 `CUfunction`。
4. 重跑 kernel，再把缓冲区解码为逐线程记录。

## 第 1 步 —— 给 kernel 插桩

trace marker 是**设备侧调用**——必须放在 kernel 体*内部*，而非 host 代码里。每个区域用**唯一的整数 SCOPE_ID**。

**Triton：**

```python
import gwatch.cuda.trace.triton as gw_trace_triton

@triton.jit
def my_kernel(...):
    gw_trace_triton.scope_start(SCOPE_ID)
    # ... 需要追踪的代码 ...
    gw_trace_triton.scope_end(SCOPE_ID)
```

**CUDA C++**（用 `gwatch/cuda/trace.hpp` 的宏）：

```cpp
#include "gwatch/cuda/trace.hpp"

__global__ void my_kernel(...) {
    GWATCH_CUDA_KERNEL_SCOPE_START(SCOPE_ID);
    // ... 需要追踪的代码 ...
    GWATCH_CUDA_KERNEL_SCOPE_END(SCOPE_ID);
}
```

CUDA C++ kernel 必须**可进程内加载**（`torch.utils.cpp_extension.load` / pybind 模块），必须**内嵌 PTX**（同时用 `-gencode arch=compute_NN,code=compute_NN` 与 `…,code=sm_NN` 编译），并通过 `gwatch.get_include()` 加上 include 路径。追踪时用 `dsl=""`。

**CuTe DSL** 与 **TileLang** 同样支持（`gw_trace_cute` / `gw_trace_tilelang`）。需把它们的 PTX 暴露给追踪器——CuTe 设 `CUTE_DSL_KEEP_PTX=1`，TileLang 用 `export_ptx()` + `TILELANG_CACHE_PATH`。详见 `examples/cuda/trace/` 下各 DSL 的参考脚本。

> **在首个 kernel 模块加载前装好钩子。** 追踪时 capsule 在启动时会延迟安装钩子，所以要在脚本顶部显式调用：
> ```python
> import gwatch.libpygwatch as pygwatch
> import gwatch.cuda.trace as gw_trace
> pygwatch.init_cupti_hooks()
> ```

## 第 2 步 —— 把 scope ID 映射为名称

```python
scope_name_map = {
    100: "load_kv",
    101: "dot_qk",
    102: "softmax",
    103: "dot_pv",
    200: "store_o",
}
```

runner 会把这些标签附到每条记录上，使报告显示有意义的名称。

## 第 3 步 —— 运行

```bash
python3 GWATCH_PATH/cuda/_examples/do_trace.py \
    --M 1024 --N 1024 --K 1024 \
    --kernel-regex ".*matmul.*"
```

```python
from gwatch.cuda.trace import do_trace

result = do_trace(
    fn=run_once,
    kernel_name_pattern=r".*matmul.*",
    dsl="triton",                  # "triton" / "cute" / "tilelang"；原始 CUDA C++ 用 ""
    scope_name_map=scope_name_map,
    instrumentation_tier="ptx",
)
```

若 kernel 未被打上 marker，runner 会警告并返回空 dict——补上 marker 并重新构建（若源码改动未被识别，用 `rm -rf ~/.triton/cache/*` 清 Triton JIT 缓存）。

## 第 4 步 —— 导出报告

| 后缀 | 输出 |
|---|---|
| `.html` / `.htm` | 交互式报告——逐 run 的 **Stats**（概览、流水线汇总、并发度、逐 scope 表、最长气泡）与 **Timeline**（所有线程的 canvas Gantt，可缩放/平移，含 scope 图例）。自包含且体积有界。 |
| `.yaml` / `.yml` | 规范无损归档——逐条记录原样保存，外加预计算的 `analysis` 聚合块。百万级记录的 kernel 可达**数百 MB**。 |

```bash
python3 GWATCH_PATH/cuda/_examples/do_trace.py \
    --kernel-regex ".*matmul.*" \
    --report reports/trace.html      # 或 .yaml 得到无损归档
```

## 读取报告

**优先读预计算的 `analysis` 块**，而非扫描原始 `trace_results`（可能上百万条）。它已包含各 scope 总时长、逐线程 active/bubble 时间、最长 phase 间间隙、并发度。时长单位是 `%globaltimer` tick（≈ 1 ns）。

```
每线程 active 总时间 = 各 scope 的 (end - start) 之和
每线程 bubble 总时间 = 线程生命周期 - active 总时间
bubble 比率 = bubble 总时间 / (bubble 总时间 + active 总时间)
```

流水线良好的 kernel bubble 比率低；流水线差的在各 phase 间有长气泡。

## 用 `gwatch show` 可视化

`gwatch show <trace.yaml>` 是 YAML 归档的交互式终端伴侣。不带 flag 时打印全部四个视图（header、逐 scope 统计、流水线汇总、逐线程 ASCII Gantt）。用 flag 聚焦：

```bash
gwatch show trace.yaml --stats                 # 时间花在哪？
gwatch show trace.yaml --bubbles --concurrency # 找最严重的流水线气泡及其上下文
gwatch show trace.yaml --longest softmax       # 最慢的 'softmax' 实例
gwatch show trace.yaml --outliers              # 落后线程（≥2σ）
gwatch show trace.yaml --json | jq .scope_stats  # 机器可读，用于 diff
```

筛选 flag：`--run N`、`--tid '[0,127]'`、`--stime/--etime`（payload-tick 窗口）。Timeline flag：`--sample N`、`--sort-by active|bubble|<scope>`、`--human`（ANSI 配色）。

## 典型流程

1. **先粗粒度 marker**——围绕主要 phase（load、compute、store、sync）。
2. **找出主导 phase**——`total` 最大的 scope。
3. **检视流水线形状**——`--bubbles --concurrency` 看它是串行化还是线程相互 stall。
4. **下钻**——在主导 phase 内加更细的 marker，重跑。
5. **前后对比**——两份都跑 `--json`，`diff` scope-stats 数组。

## 常见坑

- marker 放在 host 代码而非 kernel 内部。
- 跨区域复用 SCOPE_ID（记录会混淆）。
- **"PTX binary not found" / 空结果**——没有 PTX 到达追踪器（CUDA C++ 内嵌 PTX；TileLang 用 `export_ptx()`；CuTe 设 `CUTE_DSL_KEEP_PTX=1`）。
- **JIT 报 "Unsupported .version"**——把 `GW_PTXAS_PATH` 指向更新的 ptxas（如 torch 自带的）。

## 相关

- [Range Profiling](/docs/humanize/range-profiling/)——*什么*资源慢（先跑它好知道盯哪个 phase）。
- [PC 采样](/docs/humanize/pc-sampling/)——phase 内*哪条指令* stall。
- [自动优化](/docs/humanize/auto-optimization/)——完整的 剖析 → 改动 → 验证 闭环。
