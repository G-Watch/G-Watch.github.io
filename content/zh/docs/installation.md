---
title: 安装
description: 从 PyPI 安装 G-Watch 或用 Conda 从源码构建，并为 Claude、Codex、Gemini 装上 agent skill。
group: 开始使用
order: 2
---

# 安装

G-Watch 以一个 Python 包（`gwatch`）外加一组 agent skill 的形式分发。

## 方式一 —— 从 PyPI 安装

```bash
# 安装 gwatch
pip install gwatch

# 安装 gwatch skills
npx skills add mars-compute-ai/G-Watch -a claude-code -a codex -a gemini-cli
```

`npx skills add` 这一步会把 agent skill（自动优化、range profiling、PC 采样、kernel 内追踪、二进制分析）分发给所列的编程智能体。

## 方式二 —— 用 Conda 从源码构建

在你的主机上搭建开发环境。

1. **递归克隆仓库**（含子模块）：

   ```bash
   git clone --recursive https://github.com/mars-compute-ai/G-Watch.git
   cd G-Watch
   ```

2. **创建并激活 Conda 环境。** 该工具链 pin 将生成的 wheel 限制在 `manylinux_2_31`（Ubuntu 20.04+ / RHEL 9+ / Debian 11+）：

   ```bash
   conda create -n gw312 python=3.12 gcc_linux-64=10 gxx_linux-64=10 \
       sysroot_linux-64=2.28 -c conda-forge
   conda activate gw312
   ```

3. **安装系统依赖与构建工具：**

   ```bash
   conda install -c conda-forge cmake make meson pkg-config \
       eigen elfutils libwebsockets libprotobuf protobuf libcurl openssl \
       libdwarf libdwarf-dev 'libsqlite=*=h0*' sqlite nlohmann_json \
       pybind11_json pybind11
   ```

4. **安装 Python 包**（开发用 editable 安装）：

   ```bash
   pip install -e .
   ```

> 最新的构建说明与平台相关注意事项请以仓库 `README.md` 为准。

## 验证

解析参考脚本所用的包路径与头文件路径：

```bash
# gwatch 包路径
python3 -c "import gwatch; print(gwatch.__path__[0])"

# C++ 头文件路径（CUDA C++ 追踪需要）
python3 -c "import gwatch; print(gwatch.get_include())"
```

快速验证 CUPTI 钩子已生效：

```python
import gwatch.cuda.profile as gw_profile  # 初始化 capsule 与 CUPTI 钩子
print("G-Watch ready")
```

## 参考脚本

`GWATCH_PATH/cuda/_examples/`（AMD 为 `GWATCH_PATH/rocm/_examples/`）下提供了一整套可运行的参考脚本。它们以 Triton GEMM 为测试样例，端到端演示每个工具：

| 脚本 | 工具 |
|---|---|
| `do_range_profile.py` | [Range Profiling](/docs/humanize/range-profiling/) |
| `do_pc_sampling.py` | [PC 采样](/docs/humanize/pc-sampling/) |
| `do_trace.py` | [Kernel 内追踪](/docs/humanize/intra-kernel-tracing/) |
| `do_flops.py` / `do_correctness.py` | 基线与正确性（[自动优化闭环](/docs/humanize/auto-optimization/)使用） |

为自己的 workload 编写自定义剖析脚本时，**先读对应的参考脚本**并复用其结构。

## 下一步

- [Range Profiling](/docs/humanize/range-profiling/)——第一次诊断。
- [自动优化](/docs/humanize/auto-optimization/)——让智能体驱动完整闭环。
