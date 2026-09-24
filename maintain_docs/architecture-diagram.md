# 模型结构图：开发方法

计算器页面里那张「模型结构」图 —— 整条模型的 strip、点开某一层后的算子与张量图 —— 的写法、验法与审计方法。

它的目标只有一条：**图上画出来的每一样东西，都能回溯到一份实现或一个磁盘上的张量。**
画不准就不画，并把没画的东西说出来。任何「看起来差不多」的推断都不允许进入这张图。

---

## 0. 文件分工

| 文件 | 职责 | 允许知道 |
| --- | --- | --- |
| `lib/arch/types.ts` | 数据契约（`ArchSpec` / `ArchLayerType` / `ArchSection` / `ArchStep` / `ArchOp` / `ArchTensor`） | 什么都不知道 |
| `lib/arch/common.ts` | 跨架构复用的词汇：`linear` `norm` `rope` `swigluExpert` `topkRouter` `lowRankPair` `groupLayers` `pickNum` … | 什么都不知道 |
| `lib/arch/<Arch>.ts` | **一个架构一个文件，文件名等于 `architectures` 里的那个名字**。拓扑、分层规则、权重名 | 只知道自己这个架构 |
| `lib/arch/index.ts` | 注册表。没被 import 的 spec 等于不存在 | 架构名 → spec |
| `lib/arch/layout.ts` | 几何引擎。纯函数，输入 spec 产物，输出坐标与路径 | **不知道任何模型** |
| `lib/arch/splice.ts` | 展开某一层时 strip 在哪里剪开。组件和断言共用这一份 | 只知道 overview 的结构 |
| `components/arch-*.tsx` | 只负责把 layout 的输出画成 SVG，不做几何 | 不做决策 |
| `tmp/check/*.tsx` | 三套断言 harness | 全部 |

分界线是硬的：**layout 里不允许出现任何模型名、算子名、权重名的字符串比较。**
如果几何需要知道某个特例，那说明数据契约缺了一个字段，应该加字段，而不是在 layout 里 `if (label === "hc_head")`。

画面本身的规则（字体、灰度、叠片、拐角、展开动画……）在
**[diagram-rules.md](./diagram-rules.md)**，编号 R1 起，动手前整篇读完。
本文管「怎么写、怎么验、怎么审」，那份管「画出来必须长什么样」。

---

## 1. 覆盖率

### 得做多少

一份 spec 画的是一个**拓扑**，所以工作单元是 registry 里的 (实现模块, 类) 对，
而不是 `architectures` 名字 —— 一个类往下可以挂好几个名字（`llama` 的
`LlamaForCausalLM` 一个类就服务 6 个名字），一个模块往上也可以有好几个类
（`llama` 有 3 个）。

最细的单元是 (模块, 类, 任务) 三元组 —— 一张要画的图。同一个类在不同任务下尾巴不同：
registry 把 `MistralModel` 指向的就是 `LlamaForCausalLM` 这个类，包装器在运行时才把
LM head 换成 pooler，那是另一张图。

| | 架构名 | 图（模块,类,任务） | 类（模块,类） | 模块 |
| --- | --- | --- | --- | --- |
| vLLM registry 的主模型 | **300** | **281** | **268** | **225** |
| 已写 spec | 7 | 2 | 2 | 2 |
| **还得做** | **293** | **279** | **266** | **223** |

按任务类型拆待做的部分。三列是同一批东西的三种粒度，越往右越粗、越会藏东西：

| 类型 | 待画的图 | 待做的类 | 待做模块 |
| --- | --- | --- | --- |
| 文本生成 | 111 | 111 | 101 |
| 多模态（带视觉塔等） | 113 | 113 | 110 |
| 只做 pooling / 分类 | 55 | 43 | 18 |

pooling 那一行三个数差得最多：模块粒度只算「整个模块不做别的」那 18 个，类粒度漏掉
「同一个类换任务」的那种，只有图粒度是完整的 55 张。

**逐条清单在 [architecture-todo.md](./architecture-todo.md)**，由 `tools/arch_todo.py`
从 registry 和 `lib/arch/` 生成，状态不手写。

两列的合计都大于总数，因为有重叠。模块粒度：待做部分有 6 个模块同时服务两类
（`muse_glimmer`、`qwen3_5`、`glm5next`、`kimi_k3`、`minimax_m3`、`qwen4_exp`；
连已写的 `deepseek_v4` 一起算是 7 个），`101 + 110 + 18 - 6 = 223` 对得上。
类粒度：只有 1 个类（`muse_glimmer.MuseGlimmerForCausalLM`）同时登记在两张表里。

**只做纯文本生成就是 111 张图 / 101 个模块。** 这是计算器页面最直接相关的范围。
多模态那 110 个要画视觉塔与连接器，是另一类工作量；pooling / 分类按现在的规矩画不出来
（pooling 方式在 vLLM 运行时配置里，repo 里没有），见下。

### 上面那 300 不是全部

`_VLLM_MODELS`（registry.py:772）合并 10 张表，上面只算了其中 7 张「主模型」表。
剩下三类同样是用户可能粘进来的 `architectures` 值：

| 来源 | 新增架构名 | 说明 |
| --- | --- | --- |
| `_SPECULATIVE_DECODING_MODELS` | +62 | MTP / Eagle / Medusa 头，常作为独立 repo 发布 |
| `_TRANSFORMERS_*` | +24 | vLLM 只用 transformers 通用后端服务，拓扑要读 transformers |
| `_PREVIOUSLY_SUPPORTED_MODELS` | +50 | vLLM 已下架，模型还在 HF 上 |
| `_OOT_SUPPORTED_MODELS` | +4 | 由插件提供（bart-plugin） |
| **全部并集** | **440** | |

投机解码那 62 个里有一个已经画了：`DeepSeekV4MTPModel` 就是 V4 spec 里的 MTP block ——
它不是一份独立 spec，而是挂在主模型上的一个块。

而 440 仍然是下界：HuggingFace 上大量靠 `trust_remote_code` 自带建模代码的 repo，
`architectures` 值不在任何注册表里。

### 已写的 7 个

每一行都对着 `vllm/model_executor/models/registry.py` 核过，第三列是 registry 里的原始映射。

| `architectures` 值 | spec 文件 | vLLM registry 映射 | 备注 |
| --- | --- | --- | --- |
| `LlamaForCausalLM` | `LlamaForCausalLM.ts` | `("llama", "LlamaForCausalLM")` | |
| `LLaMAForCausalLM` | 同上 | `("llama", "LlamaForCausalLM")` | 旧拼写 |
| `InternLM3ForCausalLM` | 同上 | `("llama", "LlamaForCausalLM")` | |
| `TeleChat3ForCausalLM` | 同上 | `("llama", "LlamaForCausalLM")` | |
| `CwmForCausalLM` | 同上 | `("llama", "LlamaForCausalLM")` | |
| `IQuestCoderForCausalLM` | 同上 | `("llama", "LlamaForCausalLM")` | |
| `DeepseekV4ForCausalLM` | `DeepseekV4ForCausalLM.ts` | `("vllm.models.deepseek_v4", …)` | 需额外文件 `inference/config.json` |

6 个名字共用一个 spec，是因为 registry 把它们指向同一个模块的同一个类：拓扑相同，
差别只在 config 的数值。新增一个走 `llama.py` 的因果 LM 架构名，通常只要往
`spec.arch` 数组里加一行。

运行时这张表由 `coverage()`（`lib/arch/index.ts`）返回。**没有 spec 的架构什么都不画**，
而不是猜一个出来。

### 故意不声明的

`llama` 模块在 registry 里其实服务 10 个名字，我们只认 6 个。剩下 4 个是同一具骨架配不同的尾巴：

| `architectures` 值 | registry 分组 | 尾巴 |
| --- | --- | --- |
| `LlamaModel` | `_EMBEDDING_MODELS` | 没有 LM head，换成 pooler |
| `MistralModel` | `_EMBEDDING_MODELS` | 同上 |
| `LlamaBidirectionalModel` | `_EMBEDDING_MODELS` | 同上，且注意力不是因果的 |
| `LlamaBidirectionalForSequenceClassification` | `_SEQUENCE_CLASSIFICATION_MODELS` | pooler + `score` 投影 |

包装器是 `as_embedding_model` / `as_seq_cls_model`（`model_executor/models/adapters.py`）。
不声明它们的理由很直接：**pooling 方式来自 vLLM 运行时的 `pooler_config`，repo 里没有这个信息**，
按 §2.2 就画不出来。声明了反而会给一个产出句向量的模型画上 `head` 和一排 logits。

这几个名字曾经在 `spec.arch` 里，是审计时发现并移除的 —— 覆盖率少 3 个，图少错 3 个。

### 怎么重算这些数字

用 `ast` 解析，不要用正则 —— 正则加 `split('\n}')` 截断会漏数（它把投机解码表数成 63，
实际 62）。在一份 vllm 源码树的根目录跑：

```bash
python3 - <<'EOF'
import ast, collections
src = open('vllm/model_executor/models/registry.py').read()
D, S = {}, {}
for node in ast.parse(src).body:
    if not (isinstance(node, ast.Assign) and isinstance(node.value, ast.Dict)
            and isinstance(node.targets[0], ast.Name)):
        continue
    tup, st = {}, {}
    for k, v in zip(node.value.keys, node.value.values):
        if not isinstance(k, ast.Constant):
            continue
        if isinstance(v, ast.Tuple) and len(v.elts) >= 2:
            tup[k.value] = (v.elts[0].value, v.elts[1].value)   # (module, class)
        elif isinstance(v, ast.Constant):
            st[k.value] = v.value
    if tup: D[node.targets[0].id] = tup
    if st: S[node.targets[0].id] = st

TG, MM = '_TEXT_GENERATION_MODELS', '_MULTIMODAL_MODELS'
POOL = ['_EMBEDDING_MODELS', '_LATE_INTERACTION_MODELS', '_REWARD_MODELS',
        '_TOKEN_CLASSIFICATION_MODELS', '_SEQUENCE_CLASSIFICATION_MODELS']
MAIN = [TG, MM] + POOL

names = {}
by_pair = collections.defaultdict(set)   # (module, class) -> 出现在哪些表里
by_mod = collections.defaultdict(set)    # module        -> 出现在哪些表里
for g in MAIN:
    for n, mc in D[g].items():
        names.setdefault(n, mc)
        by_pair[mc].add(g)
        by_mod[mc[0]].add(g)
print('main:', len(names), 'names', len(by_mod), 'modules', len(by_pair), 'pairs')

# 已写：把这里换成 coverage() 的结果
DONE = {('llama', 'LlamaForCausalLM'),
        ('vllm.models.deepseek_v4', 'DeepseekV4ForCausalLM')}
DONE_MODS = {d[0] for d in DONE}
# 两列口径不同，必须各按各的分组并集判定：
#   pairs   = 这个类做不做这件事
#   modules = 这个模块除了这件事还做不做别的（「只做 pooling」指的是模块级）
for label, keep in [('text-gen', lambda gs: TG in gs),
                    ('multimodal', lambda gs: MM in gs),
                    ('pooling only', lambda gs: not (gs & {TG, MM}))]:
    pairs = {p for p in by_pair if p not in DONE and keep(by_pair[p])}
    mods = {m for m in by_mod if m not in DONE_MODS and keep(by_mod[m])}
    print(f'  {label:13s} pairs={len(pairs):4d} modules={len(mods):4d}')

main_n = set(names)
extra = [('_SPECULATIVE_DECODING_MODELS', set(D['_SPECULATIVE_DECODING_MODELS'])),
         ('_TRANSFORMERS_*', set(D['_TRANSFORMERS_SUPPORTED_MODELS'])
                             | set(D['_TRANSFORMERS_BACKEND_MODELS'])),
         ('_PREVIOUSLY_SUPPORTED', set(S['_PREVIOUSLY_SUPPORTED_MODELS'])),
         ('_OOT_SUPPORTED', set(S['_OOT_SUPPORTED_MODELS']))]
seen = set(main_n)
for label, ns in extra:
    print(f'  +{label:24s} {len(ns - seen):3d}')
    seen |= ns
print('union of every table:', len(seen))
EOF
```

写这份文档时的输出：

```
main: 300 names 225 modules 268 pairs
  text-gen      pairs= 111 modules= 101
  multimodal    pairs= 113 modules= 110
  pooling only  pairs=  43 modules=  18
  +_SPECULATIVE_DECODING_MODELS  62
  +_TRANSFORMERS_*           24
  +_PREVIOUSLY_SUPPORTED     50
  +_OOT_SUPPORTED             4
union of every table: 440
```

「pairs」与「modules」两列口径不同，脚本里也分开算：前者问「这个类做不做这件事」，
后者问「这个模块除了这件事还做不做别的」。混用会把「只做 pooling」的模块数算成 23 ——
那是「含有 pooling 类的模块」，不是「只做 pooling 的模块」。

排除在「主模型」之外的是投机解码头（不是独立模型）和 transformers 回落
（不是具体架构，是个通用后端）。那 10 个不在 `model_executor/models/` 里的模块在
`vllm/models/` 下：`deepseek_v4`、`deepseek_v41`、`deepseek_v32`、`glm5next`、
`kimi_k3`、`minimax_m3`、`qwen4_exp`、`hy_v4`、`dots3_note`、`inkling`。

这些数字会随 vLLM 变，所以连同算法一起写在这里，不要当成固定事实引用。

### 这些数字是怎么验的

重算一次不算验证 —— 同一个脚本跑两遍只会重复同一个错。这几条是彼此独立的：

1. **信源是否唯一。** `ModelRegistry` 只由 `_VLLM_MODELS` 构造（registry.py:1517），
   `register_model()` 是运行时/插件入口。所以那 10 张表就是全部，没有第二处注册点。
2. **解析出来的东西是否真实存在。** 268 个 (模块, 类) 对，模块文件全部能在磁盘上找到；
   类定义有 267 个能直接 grep 到 `class X`，剩下 1 个是 import 别名
   （`deepseek_v32` 把 `DeepseekV32ForCausalLM` 别名为 `GlmMoeDsaForCausalLM`）。
   顺带说明：别名意味着 268 对里含少量同拓扑，它是待做量的上界。
3. **树内外的判据是否是 vLLM 自己的。** 用 `startswith("vllm.")`，与
   `_resolve_module_name`（registry.py:1512）一致；`vllm/models/` 下恰好也是那 10 个目录。
4. **独立信源交叉验证。** vLLM 自己的文档（`docs/models/**.md`，16 个 md）列出 316 个
   反引号架构名，其中 260 个落在 main 里；40 个 registry 有而文档还没补（新模型），
   文档里「哪张表都没有」的 39 个多是 pooling 方式常量（`MEAN` / `CLS` / `LAST`）和靠
   `--convert` 转出来的分类变体 —— 后者反过来说明 440 确实只是下界。
5. **换一套写法重算。** 分类用显式 `if/elif` 重写一遍（不用集合运算），得到同样的
   101 / 110 / 18，并且恒等式 `101 + 110 + 18 - 6 = 223` 成立。
6. **我们自己的声明是否对得上。** 把 `spec.arch` 里每个名字回查 registry：7 个全部存在，
   且每份 spec 只对应一个 (模块, 类) —— 没有哪份 spec 跨了两个实现。

---

## 2. 五条铁律

### 2.1 一个 spec 服务一个架构，不是一个 checkpoint

同一个 `architectures` 值下会有不同规模、不同开关的模型。
**只在某一份 config 下成立的代码就是 bug**，即使当前页面看起来是对的。

这类 bug 最难发现的形态是「在我当时看的那个状态下碰巧正确」。真实例子：

```ts
// 错：分支（MTP）的输入恰好和 stack 的输出是同一个张量，
// 所以开着 MTP 时正确，而 MTP 默认关闭，默认状态下画出的是模型的 token ids
tensor: branch?.io ?? input,

// 对：跟踪真正流到这里的张量
tensor: flow,
```

### 2.2 拓扑必须手写，并注明出处

config 里没有拓扑，张量名里也没有。**不允许任何启发式推断。**
拓扑读自一份实现，通常是 vLLM。少数模块不在它的主树里（见 §1），那就退回模型 repo 自带的
reference implementation，并在 spec 头部说明为什么。

注释里写清楚 `file:line`：

```ts
// "Only C4A uses sparse attention and hence has indexer" —— 判据就是实现里
// 那个字面量 4（attention.py:291-292），不是对这个 checkpoint 的猜测。
if (ratio === 4) { … }
```

以后回头看时，「这是实现里的条件」和「这是当时看着像」必须一眼能分辨。

### 2.3 画原始算子，不画融合算子

vLLM 跑的是 `qkv_proj`，checkpoint 里存的是 `q_proj` / `k_proj` / `v_proj`。
图上画后者，因为**每一个 glyph 要对应一个能被 safetensors header 验证形状的张量**。
指向 kernel 的链接用 `ArchOp.fusedInto` 保留，`source.packedModules` 原样带上实现的 `packed_modules_mapping`。

同理：`SiluAndMul` 画成 SiLU + 乘法，`norm(x, residual)` 画成 add + norm。

### 2.4 权重名用 checkpoint 的名字

`ArchOp.weight` 的契约是「checkpoint 里的张量名」。这不是风格问题：

```
_make_deepseek_v4_weights_mapper (vllm/models/deepseek_v4/nvidia/model.py:1862)
  embed.weight  →  embed_tokens.weight
  head.weight   →  lm_head.weight
```

这张表是所有声明该架构的 repo 必须过的映射，所以磁盘上叫 `embed` / `head`。
写成 vLLM 的模块名 `embed_tokens` / `lm_head` 会让读者在 checkpoint 里搜不到。

**核对方法**：下载 `model.safetensors.index.json`，把一层的张量名全列出来，逐个对。

```bash
curl -sL "https://huggingface.co/<repo>/resolve/main/model.safetensors.index.json" -o /tmp/idx.json
python3 -c "
import json; d=json.load(open('/tmp/idx.json'))['weight_map']
print(sorted(set(k.split('.',2)[2] for k in d if k.startswith('layers.3.'))))
print(sorted(k for k in d if not k.startswith(('layers.','mtp.'))))"
```

### 2.5 未声明的 config key 不能变成图上的事实

`[b, s, 0]` 读起来是「这层什么都不留」，而真相是「config 没说」。
0 不是答案，轴名才是：

```ts
// 缺失时画成它本该来自的那个 key 的名字
out: tensor(["b", "s", d.indexTopk || "index_topk"], "kv indices"),
```

读 config 分两种，绝不能混：

```ts
/** 宽度。0 表示 config 没说，读作未知 */
const n = (keys, fallback = 0) => pickNum(input, ...keys) ?? fallback;

/** 计数：会被拿来做除数、重复次数、张量的一个轴。永远 ≥ 1 */
const count = (keys, fallback = 1) => Math.max(1, Math.trunc(n(keys, fallback)));
```

`?? fallback` 只挡得住「key 不存在」。config 明写 `o_groups: 0` 会原样穿过去，
然后 `qkvDim / 0` 在张量形状里留下一个 Infinity。

同族的坑（都出现过）：

- `num_experts_per_tok > n_routed_experts` → 图上写「16 of 4」，要夹到专家数
- `qk_rope_head_dim` 缺失 → 注记写「last 0 of 512 dims」
- `intermediate_size` 缺失 → `[b, s, 0]`
- `head_dim` 缺失 → 按 `dim / heads` 推导（各家 config 的默认行为）
- `num_nextn_predict_layers: 1.5` → 标签写「MTP x1.5」

---

## 3. 写一个新架构 spec 的流程

1. **定位实现**。vLLM registry 里找到该 `architectures` 对应的模块。不在树内就退回 repo 自带的 reference implementation，并在注释里说明为什么。
2. **读三个 forward**：`DecoderLayer.forward`、`Attention.forward`、`MLP/MoE.forward`。拓扑只来自这三处。
3. **抓 index.json**，把张量名和形状列出来。它同时是权重名的来源，和后面宽度计算的验算答案。
4. **`readDims`**：`K` 表里 root 拼写在前、reference implementation 的拼写在后（`hidden_size` / `dim`，`num_hidden_layers` / `n_layers`）。用 `n()` 与 `count()` 两种读法。额外文件走 `spec.extraFiles`，用 `pickNums` / `pickStrs` 读数组。
5. **分层**：写 `kindOf(i)`，交给 `groupLayers`。
   **判据必须是 checkpoint 能区分的**，或者是 config 里明写、checkpoint 看不出的（这时要在 `note` 里说明它看不出，例如 `layer_types`）。
   若某个 key 把 checkpoint 分不开的层分开了，或漏掉了 checkpoint 分得开的差异，那这个 spec 是错的。
6. **写 sections**：`sequence` 是顺序，`parallel` 是同一个输入分叉。`repeat` / `active` 表示有多少个同样的算子实例，`inner` 是「打开其中一个」看到的内容（里面只有一份数据，形状是单实例的）。
7. **注册**到 `lib/arch/index.ts`。
8. **跑三套 harness**，并在 `configs.tsx` 里为这个架构补一组 config 变体（见 §5）。
9. **打开浏览器量一遍、截图看一遍**（见 §6）。

宽度必须全部由 config 算出，并对着 index.json 的形状验过。在 spec 头部写下验算结果：

```
Verified on DeepSeek-V4-Flash: wq_a [1024,4096], wq_b [32768,1024],
wkv [512,4096], wo_a [8192,4096], hc_attn_fn [24,16384]
```

---

## 4. 几何引擎的约定

改 `layout.ts` 之前需要知道的几件事。

### lanes 与 sheets

一个张量可以有 `copies` 份并行副本（hyper-connection 的那种），一个算子可以有 `repeat` 个实例。
但**画出来最多 `STACK_MAX = 4` 张叠片**。

因此凡是回答「这里有几条轨」的地方，一律走 `sheetsFor(lanes)`，绝不用原始数量：

```ts
const fromTracks = sheetsFor(edge.fromLanes);
const toTracks = sheetsFor(edge.toLanes);
```

拿原始数量比较，16 份副本对 4 个实例会被当成一次收束，每条线都落错位置。
（这个 bug 只在 `hc_mult` 恰好等于 4 时不发作 —— 也就是开发时用的那个模型。）

### 边的归属与切分

叠片之间的连线必须落在各自那一层里，才会形成正确的遮挡。
所以每条边声明归谁画：`ownedBySource` / `ownedByTarget`。两端都拥有时，边在拐点处被切成两半（`EdgePart = "source" | "target"`），各画各的一半。

### 拐角

两条规则，都由 `turnsInAGutter` 断言守住：

1. 拐角必须靠近它离开的那一端或到达的那一端（在 gutter 里），不能拐在长途的中间
2. **拐角不得落在任何节点的水平跨度内**

```ts
const bend = edge.bundle
  ? x2 - BUNDLE_BEND                              // 成束的边在目标侧 gutter 一起拐
  : x1 + Math.min(GAP_X / 2, (x2 - x1) / 2);      // 其余立刻离开自己这一行
```

`GAP_X / 2` 对相邻的两个东西就是中点，所以并排的元素不受影响；写大一点（例如 `BUNDLE_BEND`），
从 stack 拐去挂载块的那条 fork 就会把拐角画到 `hc_head` 底下。

### 展开一层：frame 与 splice

展开不是换一个视图，而是把 strip 从中间推开、在原地插进那一层的细节图。于是有两套配合：

- `LayerFrame`：`leadIn` / `leadOut` 给细节图两端接上画布外的替身；`omitEntry` / `omitExit` 决定它自己不画哪一头的张量
- `lib/arch/splice.ts`：strip 在哪里剪开、哪一侧保留那个张量

**同一个张量绝不能在切口两侧各画一次。** 剪口之前由 strip 保留、块不画入口；剪口之后由块保留、strip 那份被窗口裁掉。
`splice()` 是这条规则的唯一实现，组件和断言都调它 —— 两边各写一份就一定会漂移。

顺带一条同类规则：**被剪掉的东西不能留下半截标签。**
chip 只有 11px 宽，名字居中就会探出左缘，剪在 chip 左缘时那几个字母会留在左半边。所以 caption 从 chip 左缘起排。

### 入口线与出口线

`Layout.centre` 是进入的那条线，`Layout.exit` 是离开的那条线，**它们不一定相同**（MTP 块相差 58px）。
需要对齐接缝时用哪一条，取决于对的是哪一头。

---

## 5. 三套断言 harness

都在 `tmp/check/` 下，用 `npx tsx` 直接跑：

```bash
npx tsx tmp/check/check.tsx     # 几何：真模型
npx tsx tmp/check/configs.tsx   # 配置 fuzz：没写过的 config
npx tsx tmp/check/labels.tsx    # 文案：每一个会显示的字符串
```

`geom.tsx` 是共享的几何套件（`walk` 遍历一张图、`turnsInAGutter` 拐角规则、`inked` 节点实占范围）。

### 三条写断言的规矩

1. **断言只能写成布局自己导出的常量，绝不把数字抄第二遍。**
   抄一遍，改了常量之后断言就在守一个已经不存在的约定。
2. **每一条断言都要负向验证。** 故意把代码改坏，确认它报错，再改回来。没报错的断言等于没写。

   ```bash
   # 例：把拐点规则改回 BUNDLE_BEND，应当报
   # "stackOut->branch: turns at 1055, inside eo0"
   ```
3. **fuzz 要覆盖「后加的东西」。** 盲区几乎总是出现在功能加完之后没扩断言的地方。
   MTP 块加完之后，`configs.tsx` 有很长一段时间根本不审计 `model.mtp`，也从不带分支布局 strip —— fork、chip、branchOut 的几何一次都没跑过。

### `configs.tsx` 该覆盖什么

对每个架构，至少覆盖这几类：

- key 缺失（每一个可选 key 各一条）
- key 明写为 0、负数、小数、非数字
- 数量为 1 / 低于 `STACK_MAX` / 等于 / 高于
- 数组型 key 比层数短、比层数长、不是数组
- 只有 reference implementation 拼写的 config
- 一个大一号的形状（换一个数量级，验证没有写死的宽度）
- 空 config（这条允许出现未知轴，用 `complete = false` 标注）

审计规则至少包括：所有数字有限且非负、**画出来的轴不得为 0**、每层恰好属于一个 type、布局坐标有限、边不悬空。

### 注意 harness 不在版本控制里

`tmp/` 在 `.gitignore` 里。clone 一份新的仓库不会带上这三个文件。
要长期保留就得换一个不被忽略的位置。

---

## 6. 浏览器验证

断言守不住「看起来对不对」。最后一步必须是量 DOM + 截图。

```js
// 某个 SVG 里所有文字的位置
const s = document.querySelector('svg[role=img]');
const b = s.getBoundingClientRect();
[...s.querySelectorAll('text')].map(t => ({
  x: Math.round(t.getBoundingClientRect().left - b.left),
  v: t.textContent.trim(),
}));
```

几个反复踩到的判读陷阱：

- **画布外的东西不算数**。`leadIn` / `leadOut` 的替身节点坐标是负的或超出 `width`，被 viewBox 裁掉。看到一个「多余的 hidden」先比一眼它的 x 和 svg 的 `width`。
- **别拿截图当证据链的末端**。JPEG 压缩会在线条端点处造出看起来像竖线的东西。可疑就回去查 DOM 里有没有那个元素。
- **可见性要按裁剪容器判断**，不是按 SVG 自身：`r.right > clip.left && r.left < clip.right`。
- **量之前先确认量的是什么**。犯过两次：把一条路径的起点 y 当成它穿过某处的 y；把距离近当成相邻。

一条通用的扫描（标签是否超出自己的节点框），可以一次性抓出「被切口截断」这一整类问题：

```js
// 对每个 <g>，比较它的矩形并集与它的文字范围
// 正常情况下只有明确预留过空间的 caption 允许外溢
```

---

## 7. 审计清单

每隔一段时间照着过一遍。下面每一类都真实发生过。

- [ ] **只在某个开关状态下成立的写法。** 把每个 toggle 都翻到另一边再看一次页面
- [ ] **权重名与 checkpoint 对不上。** 重新下一次 index.json 逐个对
- [ ] **未声明的 key 变成了图上的数字。** 搜所有进入 `tensor([...])` 的表达式
- [ ] **注释与代码漂移。** 头部注释说的出处、条件、取值范围，是否还是代码在做的事
- [ ] **注释声称画了、实际没画的东西。** 要么补画，要么写进 `omitted`
- [ ] **死代码。** 例如条件项删光之后留下的 `.filter(Boolean)`
- [ ] **harness 盲区。** 最近加的功能，fuzz 跑到了吗
- [ ] **prose。** 「0 of 0」「window 0」「undefined」「x1.5」

`omitted` 是有用的：它会作为 tooltip 显示。checkpoint 里存在、图上没画的东西都应当写进去，
让省略成为一句明确的话，而不是一个缺口。

---

## 8. 已知限制

- `pre post comb` 接进 `attn_norm` / `ffn_norm`，是因为布局没有跨 section 的 carry 轨。这是几何的缺口，不是 spec 的错
- `sparse_attn` 只画成一个算子。它的内部全在不透明 kernel 里，按 §2.2 就不画
- `components/` 整个目录在 `goodoc.manifest.json` 里属于 framework-owned，而 `arch-*.tsx`、`model-picker.tsx` 都在里面。`npm run upgrade` 有覆盖风险
