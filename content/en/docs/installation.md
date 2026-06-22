---
title: Installation
description: Install G-Watch from PyPI or build from source with Conda, and add the agent skills for Claude, Codex, and Gemini.
group: Getting Started
order: 2
---

# Installation

G-Watch ships as a Python package (`gwatch`) plus a set of agent skills.

## Option 1 — Install from PyPI

```bash
# install gwatch
pip install gwatch

# install gwatch skills
npx skills add mars-compute-ai/G-Watch -a claude-code -a codex -a gemini-cli
```

The `npx skills add` step distributes the agent skills (auto-optimization, range profiling, PC sampling, intra-kernel tracing, binary analysis) to the listed coding agents.

## Option 2 — Build from source with Conda

Set up a development environment on your host machine.

1. **Clone the repository** (recursively, for submodules):

   ```bash
   git clone --recursive https://github.com/mars-compute-ai/G-Watch.git
   cd G-Watch
   ```

2. **Create and activate a Conda environment.** The toolchain pin caps the resulting wheel at `manylinux_2_31` (Ubuntu 20.04+ / RHEL 9+ / Debian 11+):

   ```bash
   conda create -n gw312 python=3.12 gcc_linux-64=10 gxx_linux-64=10 \
       sysroot_linux-64=2.28 -c conda-forge
   conda activate gw312
   ```

3. **Install system dependencies and build tools:**

   ```bash
   conda install -c conda-forge cmake make meson pkg-config \
       eigen elfutils libwebsockets libprotobuf protobuf libcurl openssl \
       libdwarf libdwarf-dev 'libsqlite=*=h0*' sqlite nlohmann_json \
       pybind11_json pybind11
   ```

4. **Install the Python package** (editable install for development):

   ```bash
   pip install -e .
   ```

> Refer to the repository `README.md` for the most up-to-date build instructions and any platform-specific notes.

## Verify

Resolve the package and header paths used by the reference scripts:

```bash
# path to the gwatch package
python3 -c "import gwatch; print(gwatch.__path__[0])"

# path to the C++ headers (needed for CUDA C++ tracing)
python3 -c "import gwatch; print(gwatch.get_include())"
```

A quick smoke test that CUPTI hooks are active:

```python
import gwatch.cuda.profile as gw_profile  # initializes the capsule + CUPTI hooks
print("G-Watch ready")
```

## Reference scripts

A complete set of runnable reference scripts lives under `GWATCH_PATH/cuda/_examples/` (and `GWATCH_PATH/rocm/_examples/` for AMD). They use a Triton GEMM as a test case and demonstrate each tool end-to-end:

| Script | Tool |
|---|---|
| `do_range_profile.py` | [Range profiling](/docs/humanize/range-profiling/) |
| `do_pc_sampling.py` | [PC sampling](/docs/humanize/pc-sampling/) |
| `do_trace.py` | [Intra-kernel tracing](/docs/humanize/intra-kernel-tracing/) |
| `do_flops.py` / `do_correctness.py` | Baseline & correctness (used by the [auto-optimization loop](/docs/humanize/auto-optimization/)) |

When writing custom profiling scripts for your own workload, **read the matching reference script first** and adapt its structure.

## Next steps

- [Range profiling](/docs/humanize/range-profiling/) — your first diagnosis.
- [Auto-optimization](/docs/humanize/auto-optimization/) — let an agent drive the full loop.
