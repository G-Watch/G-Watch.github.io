#!/usr/bin/env python3
"""Generate maintain_docs/architecture-todo.md from vLLM's registry.

The to-do list is DERIVED, never hand-maintained: what is done comes from the
specs in lib/arch/, and what exists comes from vLLM's registry. Anything typed
by hand into the generated file is lost on the next run, which is the point —
a second copy of a fact is a fact that can be wrong.

Usage:
    python3 tools/arch_todo.py [path/to/vllm] > maintain_docs/architecture-todo.md

`path/to/vllm` defaults to tmp/vllm. See maintain_docs/architecture-diagram.md
§1 for what the counts mean and how they were verified.
"""

import ast
import collections
import os
import re
import sys

TG = "_TEXT_GENERATION_MODELS"
MM = "_MULTIMODAL_MODELS"
POOL = [
    "_EMBEDDING_MODELS",
    "_LATE_INTERACTION_MODELS",
    "_REWARD_MODELS",
    "_TOKEN_CLASSIFICATION_MODELS",
    "_SEQUENCE_CLASSIFICATION_MODELS",
]
MAIN = [TG, MM] + POOL


def read_registry(root):
    """dict name -> {arch name: (module, class)}, as written.

    Returned RAW, one entry per table. Deduplicating by architecture name
    first — `setdefault(name, ...)` — silently dropped eight entries: nine
    names are registered in two tables at once (`MistralModel` is both a
    generation and an embedding entry), and each of those is a different
    picture, not a duplicate.
    """
    path = os.path.join(root, "vllm/model_executor/models/registry.py")
    tables = {}
    for node in ast.parse(open(path).read()).body:
        if not (
            isinstance(node, ast.Assign)
            and isinstance(node.value, ast.Dict)
            and isinstance(node.targets[0], ast.Name)
        ):
            continue
        entries = {}
        for key, val in zip(node.value.keys, node.value.values):
            if not isinstance(key, ast.Constant):
                continue
            if isinstance(val, ast.Tuple) and len(val.elts) >= 2:
                entries[key.value] = (val.elts[0].value, val.elts[1].value)
        if entries:
            tables[node.targets[0].id] = entries

    return {g: tables[g] for g in MAIN}


def read_claims(repo):
    """(module, class) we have a spec for -> spec file name."""
    done = {}
    arch_dir = os.path.join(repo, "lib/arch")
    for f in sorted(os.listdir(arch_dir)):
        # One spec per architecture, named after it — so the capitalised files
        # are the specs and everything else is machinery.
        if not (f[0].isupper() and f.endswith(".ts")):
            continue
        text = open(os.path.join(arch_dir, f)).read()
        block = re.search(r"arch:\s*\[(.*?)\]", text, re.S)
        if block:
            done[f] = re.findall(r'"([A-Za-z0-9_]+)"', block.group(1))
    return done


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "tmp/vllm"
    repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    tables = read_registry(root)
    claims = read_claims(repo)
    # (module, class, task) -> 这张图服务的 architectures 名字
    entries = [
        (mod, cls, g, name)
        for g in MAIN
        for name, (mod, cls) in tables[g].items()
    ]

    # 一行 = 一个 (模块, 类, 任务表) 三元组，也就是一张要画的图、一份 spec 的工作量。
    #
    # 为什么不是模块、也不是 (模块, 类)：两者都会藏东西。
    #   - 按模块：`deepseek_v4` 的因果 LM 画了、多模态变体没画，一个勾说不清；
    #     `llama` 的 pooling 类既不在「文本生成」也不在「只做 pooling 的模块」里，
    #     整个消失。
    #   - 按 (模块, 类)：registry 把嵌入模型的名字指向的就是同一个
    #     `LlamaForCausalLM` 类（`MistralModel`、`LlamaModel` 都是），包装器在运行时
    #     才换尾巴。于是一个勾会把我们特意不声明的嵌入变体也算成已完成。
    # 三元组把「同一个类在不同任务下是不同的图」这件事摊开。
    TASKS = {
        TG: "生成",
        MM: "多模态",
        "_EMBEDDING_MODELS": "嵌入",
        "_LATE_INTERACTION_MODELS": "后期交互",
        "_REWARD_MODELS": "打分",
        "_TOKEN_CLASSIFICATION_MODELS": "token 分类",
        "_SEQUENCE_CLASSIFICATION_MODELS": "序列分类",
    }
    tri_names = collections.defaultdict(set)
    mod_groups = collections.defaultdict(set)
    pair_groups = collections.defaultdict(set)
    for mod, cls, group, name in entries:
        tri_names[(mod, cls, group)].add(name)
        mod_groups[mod].add(group)
        pair_groups[(mod, cls)].add(group)

    def cat_of(group):
        if group == TG:
            return "text"
        if group == MM:
            return "mm"
        return "pool"

    buckets = collections.defaultdict(list)
    for tri in tri_names:
        buckets[cat_of(tri[2])].append(tri)

    # 我们只声明了因果 LM 的那一张表，所以覆盖是按三元组算的：同一个类的嵌入变体
    # 不算已完成。
    # 一个名字若同时登记在两张任务表里，这里会把两张图都算上。今天没有这种情况
    # （我们声明的 7 个名字各自只出现在生成表里），真出现了就得按任务分别声明。
    covered_tri = {}
    claimed = {n: f for f, ns in claims.items() for n in ns}
    for mod, cls, group, name in entries:
        if name in claimed:
            covered_tri[(mod, cls, group)] = claimed[name]
    unknown = set(claimed) - {e[3] for e in entries}
    if unknown:
        print(f"<!-- 警告：registry 里没有这些声明: {sorted(unknown)} -->")

    def counts(cat):
        """同一批东西的三种粒度：模块 / (模块,类) / (模块,类,任务)。"""
        tris = buckets[cat]
        if cat == "text":
            mods = {m for m in mod_groups if TG in mod_groups[m]}
            pairs = {p for p in pair_groups if TG in pair_groups[p]}
        elif cat == "mm":
            mods = {m for m in mod_groups if MM in mod_groups[m]}
            pairs = {p for p in pair_groups if MM in pair_groups[p]}
        else:
            mods = {m for m in mod_groups if not mod_groups[m] & {TG, MM}}
            pairs = {p for p in pair_groups if not pair_groups[p] & {TG, MM}}
        return len(mods), len(pairs), len(tris)

    labels = {"text": "纯文本生成", "mm": "多模态", "pool": "pooling / 分类"}

    def table(tris):
        lines = [
            "| 状态 | 模块 | 类 | 任务 | 名字 | `architectures` |",
            "| --- | --- | --- | --- | --- | --- |",
        ]
        # 名字多的在前：一份 spec 写完它们一起就位，工作走得最远。
        for tri in sorted(tris, key=lambda t: (-len(tri_names[t]), t[0], t[1], t[2])):
            mod, cls, group = tri
            spec = covered_tri.get(tri)
            mark = f"[x] ← {spec}" if spec else "[ ]"
            names = "<br>".join(f"`{n}`" for n in sorted(tri_names[tri]))
            lines.append(
                f"| {mark} | `{mod}` | `{cls}` | {TASKS[group]} "
                f"| {len(tri_names[tri])} | {names} |"
            )
        return "\n".join(lines)

    out = []
    out.append("# 待绘制架构清单")
    out.append("")
    out.append(
        "由 `tools/arch_todo.py` 生成，**不要手工编辑** —— 状态列从 `lib/arch/` 下的 spec "
        "推导，存在什么则来自 vLLM registry。写进这个文件的手写内容会在下次生成时丢失。"
    )
    out.append("")
    out.append("```bash")
    out.append(
        "python3 tools/arch_todo.py [path/to/vllm] > maintain_docs/architecture-todo.md"
    )
    out.append("```")
    out.append("")
    out.append(
        "口径、核对方法与为什么这样计数，见 "
        "[architecture-diagram.md](./architecture-diagram.md) §1。"
    )
    out.append("")
    out.append("## 进度")
    out.append("")
    out.append(
        "**一行 = 一个 (模块, 类, 任务) 三元组 = 一张要画的图。** "
        "同一个类在不同任务下尾巴不同，是不同的图；一个三元组往下可以挂多个 "
        "`architectures` 名字，写完一份 spec 它们一起就位。"
    )
    out.append("")
    out.append("| 类型 | 待做（图） | 合计（图） | 合计（类） | 合计（模块） |")
    out.append("| --- | --- | --- | --- | --- |")
    for cat in ("text", "mm", "pool"):
        mods, pairs, tris = counts(cat)
        done = len([t for t in buckets[cat] if t in covered_tri])
        out.append(
            f"| {labels[cat]} | **{tris - done}** | {tris} | {pairs} | {mods} |"
        )
    total_tri = len(tri_names)
    total_done = len(covered_tri)
    out.append(
        f"| **合计** | **{total_tri - total_done}** | **{total_tri}** "
        f"| **{len(pair_groups)}** | **{len(mod_groups)}** |"
    )
    out.append("")
    out.append("后三列是同一批东西在三种粒度下的计数，越往右越粗，也越会藏东西：")
    out.append("")
    out.append(
        "- **图**（三元组）最细，什么都不藏，所以下面的表按它出行；"
    )
    out.append(
        "- **类** 会把同一个类的不同任务合成一行 —— registry 把 `MistralModel` 指向的"
        "就是 `LlamaForCausalLM` 这个类，包装器在运行时才换尾巴；"
    )
    out.append(
        "- **模块** 最粗，且「pooling / 分类」那一格只算**整个模块不做别的**那些，"
        "寄生在生成模块里的 pooling 类在这一列看不见。"
    )
    out.append("")
    out.append(
        f"已写 {total_done} 张：`llama.LlamaForCausalLM` 的生成任务，"
        "和 `deepseek_v4.DeepseekV4ForCausalLM` 的生成任务。"
    )
    for cat in ("text", "mm", "pool"):
        tris = buckets[cat]
        left = len([t for t in tris if t not in covered_tri])
        out.append("")
        out.append(f"## {labels[cat]}（{left} 张待画 / {len(tris)} 张）")
        out.append("")
        if cat == "pool":
            out.append(
                "按现在的规矩这些画不出来：pooling 方式来自 vLLM 运行时的 "
                "`pooler_config`，repo 里没有这个信息。列在这里是为了让省略是一句"
                "明确的话 —— 其中就包括 `llama` 的三张（`LlamaModel` / `MistralModel` "
                "走的是我们已经画了的那个类，只是换了尾巴）。"
            )
            out.append("")
        out.append(table(tris))
    out.append("")
    print("\n".join(out))


if __name__ == "__main__":
    main()
