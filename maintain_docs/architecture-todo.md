# 待绘制架构清单

由 `tools/arch_todo.py` 生成，**不要手工编辑** —— 状态列从 `lib/arch/` 下的 spec 推导，存在什么则来自 vLLM registry。写进这个文件的手写内容会在下次生成时丢失。

```bash
python3 tools/arch_todo.py [path/to/vllm] > maintain_docs/architecture-todo.md
```

口径、核对方法与为什么这样计数，见 [architecture-diagram.md](./architecture-diagram.md) §1。

## 进度

**一行 = 一个 (模块, 类, 任务) 三元组 = 一张要画的图。** 同一个类在不同任务下尾巴不同，是不同的图；一个三元组往下可以挂多个 `architectures` 名字，写完一份 spec 它们一起就位。

| 类型 | 待做（图） | 合计（图） | 合计（类） | 合计（模块） |
| --- | --- | --- | --- | --- |
| 纯文本生成 | **111** | 113 | 113 | 103 |
| 多模态 | **113** | 113 | 113 | 111 |
| pooling / 分类 | **55** | 55 | 43 | 18 |
| **合计** | **279** | **281** | **268** | **225** |

后三列是同一批东西在三种粒度下的计数，越往右越粗，也越会藏东西：

- **图**（三元组）最细，什么都不藏，所以下面的表按它出行；
- **类** 会把同一个类的不同任务合成一行 —— registry 把 `MistralModel` 指向的就是 `LlamaForCausalLM` 这个类，包装器在运行时才换尾巴；
- **模块** 最粗，且「pooling / 分类」那一格只算**整个模块不做别的**那些，寄生在生成模块里的 pooling 类在这一列看不见。

已写 2 张：`llama.LlamaForCausalLM` 的生成任务，和 `deepseek_v4.DeepseekV4ForCausalLM` 的生成任务。

## 纯文本生成（111 张待画 / 113 张）

| 状态 | 模块 | 类 | 任务 | 名字 | `architectures` |
| --- | --- | --- | --- | --- | --- |
| [x] ← LlamaForCausalLM.ts | `llama` | `LlamaForCausalLM` | 生成 | 6 | `CwmForCausalLM`<br>`IQuestCoderForCausalLM`<br>`InternLM3ForCausalLM`<br>`LLaMAForCausalLM`<br>`LlamaForCausalLM`<br>`TeleChat3ForCausalLM` |
| [ ] | `chatglm` | `ChatGLMForCausalLM` | 生成 | 2 | `ChatGLMForConditionalGeneration`<br>`ChatGLMModel` |
| [ ] | `commandr` | `CohereForCausalLM` | 生成 | 2 | `Cohere2ForCausalLM`<br>`CohereForCausalLM` |
| [ ] | `granite` | `GraniteForCausalLM` | 生成 | 2 | `GraniteForCausalLM`<br>`GraniteSWAForCausalLM` |
| [ ] | `granitemoeshared` | `GraniteMoeSharedForCausalLM` | 生成 | 2 | `GraniteMoeSWAForCausalLM`<br>`GraniteMoeSharedForCausalLM` |
| [ ] | `mamba` | `MambaForCausalLM` | 生成 | 2 | `FalconMambaForCausalLM`<br>`MambaForCausalLM` |
| [ ] | `mistral` | `MistralForCausalLM` | 生成 | 2 | `Ministral3ForCausalLM`<br>`MistralForCausalLM` |
| [ ] | `nemotron_h` | `NemotronHForCausalLM` | 生成 | 2 | `NemotronHForCausalLM`<br>`NemotronHPuzzleForCausalLM` |
| [ ] | `AXK1` | `AXK1ForCausalLM` | 生成 | 1 | `AXK1ForCausalLM` |
| [ ] | `afmoe` | `AfmoeForCausalLM` | 生成 | 1 | `AfmoeForCausalLM` |
| [ ] | `apertus` | `ApertusForCausalLM` | 生成 | 1 | `ApertusForCausalLM` |
| [ ] | `arcee` | `ArceeForCausalLM` | 生成 | 1 | `ArceeForCausalLM` |
| [ ] | `bailing_moe` | `BailingMoeForCausalLM` | 生成 | 1 | `BailingMoeForCausalLM` |
| [ ] | `bailing_moe` | `BailingMoeV2ForCausalLM` | 生成 | 1 | `BailingMoeV2ForCausalLM` |
| [ ] | `bailing_moe_linear` | `BailingMoeV25ForCausalLM` | 生成 | 1 | `BailingMoeV2_5ForCausalLM` |
| [ ] | `bailing_moe_v3` | `BailingMoeV3ForCausalLM` | 生成 | 1 | `BailingMoeV3ForCausalLM` |
| [ ] | `bloom` | `BloomForCausalLM` | 生成 | 1 | `BloomForCausalLM` |
| [ ] | `cohere2_moe` | `Cohere2MoeForCausalLM` | 生成 | 1 | `Cohere2MoeForCausalLM` |
| [ ] | `dbrx` | `DbrxForCausalLM` | 生成 | 1 | `DbrxForCausalLM` |
| [ ] | `deepseek_v2` | `DeepseekForCausalLM` | 生成 | 1 | `DeepseekForCausalLM` |
| [ ] | `deepseek_v2` | `DeepseekV2ForCausalLM` | 生成 | 1 | `DeepseekV2ForCausalLM` |
| [ ] | `deepseek_v2` | `DeepseekV3ForCausalLM` | 生成 | 1 | `DeepseekV3ForCausalLM` |
| [ ] | `ernie45` | `Ernie4_5ForCausalLM` | 生成 | 1 | `Ernie4_5ForCausalLM` |
| [ ] | `ernie45_moe` | `Ernie4_5_MoeForCausalLM` | 生成 | 1 | `Ernie4_5_MoeForCausalLM` |
| [ ] | `exaone` | `ExaoneForCausalLM` | 生成 | 1 | `ExaoneForCausalLM` |
| [ ] | `exaone4` | `Exaone4ForCausalLM` | 生成 | 1 | `Exaone4ForCausalLM` |
| [ ] | `exaone_moe` | `ExaoneMoeForCausalLM` | 生成 | 1 | `ExaoneMoeForCausalLM` |
| [ ] | `falcon` | `FalconForCausalLM` | 生成 | 1 | `FalconForCausalLM` |
| [ ] | `falcon_h1` | `FalconH1ForCausalLM` | 生成 | 1 | `FalconH1ForCausalLM` |
| [ ] | `gemma` | `GemmaForCausalLM` | 生成 | 1 | `GemmaForCausalLM` |
| [ ] | `gemma2` | `Gemma2ForCausalLM` | 生成 | 1 | `Gemma2ForCausalLM` |
| [ ] | `gemma3` | `Gemma3ForCausalLM` | 生成 | 1 | `Gemma3ForCausalLM` |
| [ ] | `gemma3n` | `Gemma3nForCausalLM` | 生成 | 1 | `Gemma3nForCausalLM` |
| [ ] | `gemma4` | `Gemma4ForCausalLM` | 生成 | 1 | `Gemma4ForCausalLM` |
| [ ] | `glm` | `GlmForCausalLM` | 生成 | 1 | `GlmForCausalLM` |
| [ ] | `glm4` | `Glm4ForCausalLM` | 生成 | 1 | `Glm4ForCausalLM` |
| [ ] | `glm4_moe` | `Glm4MoeForCausalLM` | 生成 | 1 | `Glm4MoeForCausalLM` |
| [ ] | `glm4_moe_lite` | `Glm4MoeLiteForCausalLM` | 生成 | 1 | `Glm4MoeLiteForCausalLM` |
| [ ] | `gpt2` | `GPT2LMHeadModel` | 生成 | 1 | `GPT2LMHeadModel` |
| [ ] | `gpt_j` | `GPTJForCausalLM` | 生成 | 1 | `GPTJForCausalLM` |
| [ ] | `gpt_neox` | `GPTNeoXForCausalLM` | 生成 | 1 | `GPTNeoXForCausalLM` |
| [ ] | `gpt_oss` | `GptOssForCausalLM` | 生成 | 1 | `GptOssForCausalLM` |
| [ ] | `granitemoe` | `GraniteMoeForCausalLM` | 生成 | 1 | `GraniteMoeForCausalLM` |
| [ ] | `granitemoehybrid` | `GraniteMoeHybridForCausalLM` | 生成 | 1 | `GraniteMoeHybridForCausalLM` |
| [ ] | `hrm_text` | `HrmTextForCausalLM` | 生成 | 1 | `HrmTextForCausalLM` |
| [ ] | `hy_v3` | `HYV3ForCausalLM` | 生成 | 1 | `HYV3ForCausalLM` |
| [ ] | `hyperclovax` | `HyperCLOVAXForCausalLM` | 生成 | 1 | `HyperCLOVAXForCausalLM` |
| [ ] | `hyperclovax_vision_v2` | `HCXVisionV2ForCausalLM` | 生成 | 1 | `HCXVisionV2ForCausalLM` |
| [ ] | `internlm2` | `InternLM2ForCausalLM` | 生成 | 1 | `InternLM2ForCausalLM` |
| [ ] | `iquest_loopcoder` | `IQuestLoopCoderForCausalLM` | 生成 | 1 | `IQuestLoopCoderForCausalLM` |
| [ ] | `jais2` | `Jais2ForCausalLM` | 生成 | 1 | `Jais2ForCausalLM` |
| [ ] | `jamba` | `JambaForCausalLM` | 生成 | 1 | `JambaForCausalLM` |
| [ ] | `k2_horizon` | `K2HorizonForCausalLM` | 生成 | 1 | `K2HorizonForCausalLM` |
| [ ] | `laguna` | `LagunaForCausalLM` | 生成 | 1 | `LagunaForCausalLM` |
| [ ] | `lfm2` | `Lfm2ForCausalLM` | 生成 | 1 | `Lfm2ForCausalLM` |
| [ ] | `lfm2_moe` | `Lfm2MoeForCausalLM` | 生成 | 1 | `Lfm2MoeForCausalLM` |
| [ ] | `llama4` | `Llama4ForCausalLM` | 生成 | 1 | `Llama4ForCausalLM` |
| [ ] | `longcat_flash` | `LongcatFlashForCausalLM` | 生成 | 1 | `LongcatFlashForCausalLM` |
| [ ] | `longcat_flash_ngram` | `LongcatFlashNgramForCausalLM` | 生成 | 1 | `LongcatFlashNgramForCausalLM` |
| [ ] | `mamba2` | `Mamba2ForCausalLM` | 生成 | 1 | `Mamba2ForCausalLM` |
| [ ] | `mellum` | `MellumForCausalLM` | 生成 | 1 | `MellumForCausalLM` |
| [ ] | `mimo` | `MiMoForCausalLM` | 生成 | 1 | `MiMoForCausalLM` |
| [ ] | `mimo_v2` | `MiMoV2FlashForCausalLM` | 生成 | 1 | `MiMoV2FlashForCausalLM` |
| [ ] | `mimo_v2` | `MiMoV2ForCausalLM` | 生成 | 1 | `MiMoV2ForCausalLM` |
| [ ] | `minicpm` | `MiniCPMForCausalLM` | 生成 | 1 | `MiniCPMForCausalLM` |
| [ ] | `minicpm3` | `MiniCPM3ForCausalLM` | 生成 | 1 | `MiniCPM3ForCausalLM` |
| [ ] | `minimax_m2` | `MiniMaxM2ForCausalLM` | 生成 | 1 | `MiniMaxM2ForCausalLM` |
| [ ] | `mistral_large_3` | `MistralLarge3ForCausalLM` | 生成 | 1 | `MistralLarge3ForCausalLM` |
| [ ] | `mixtral` | `MixtralForCausalLM` | 生成 | 1 | `MixtralForCausalLM` |
| [ ] | `muse_glimmer` | `MuseGlimmerForCausalLM` | 生成 | 1 | `MuseGlimmerForCausalLM` |
| [ ] | `nemotron` | `NemotronForCausalLM` | 生成 | 1 | `NemotronForCausalLM` |
| [ ] | `nemotron_nas` | `DeciLMForCausalLM` | 生成 | 1 | `DeciLMForCausalLM` |
| [ ] | `olmo_hybrid` | `OlmoHybridForCausalLM` | 生成 | 1 | `OlmoHybridForCausalLM` |
| [ ] | `olmoe` | `OlmoeForCausalLM` | 生成 | 1 | `OlmoeForCausalLM` |
| [ ] | `openpangu` | `PanguEmbeddedForCausalLM` | 生成 | 1 | `PanguEmbeddedForCausalLM` |
| [ ] | `openpangu` | `PanguProMoEV2ForCausalLM` | 生成 | 1 | `PanguProMoEV2ForCausalLM` |
| [ ] | `openpangu` | `PanguUltraMoEForCausalLM` | 生成 | 1 | `PanguUltraMoEForCausalLM` |
| [ ] | `opt` | `OPTForCausalLM` | 生成 | 1 | `OPTForCausalLM` |
| [ ] | `orion` | `OrionForCausalLM` | 生成 | 1 | `OrionForCausalLM` |
| [ ] | `param2moe` | `Param2MoEForCausalLM` | 生成 | 1 | `Param2MoEForCausalLM` |
| [ ] | `phi` | `PhiForCausalLM` | 生成 | 1 | `PhiForCausalLM` |
| [ ] | `phi3` | `Phi3ForCausalLM` | 生成 | 1 | `Phi3ForCausalLM` |
| [ ] | `phimoe` | `PhiMoEForCausalLM` | 生成 | 1 | `PhiMoEForCausalLM` |
| [ ] | `plamo3` | `Plamo3ForCausalLM` | 生成 | 1 | `Plamo3ForCausalLM` |
| [ ] | `qwen2` | `Qwen2ForCausalLM` | 生成 | 1 | `Qwen2ForCausalLM` |
| [ ] | `qwen2_moe` | `Qwen2MoeForCausalLM` | 生成 | 1 | `Qwen2MoeForCausalLM` |
| [ ] | `qwen3` | `Qwen3ForCausalLM` | 生成 | 1 | `Qwen3ForCausalLM` |
| [ ] | `qwen3_5` | `Qwen3_5ForCausalLM` | 生成 | 1 | `Qwen3_5ForCausalLM` |
| [ ] | `qwen3_5` | `Qwen3_5MoeForCausalLM` | 生成 | 1 | `Qwen3_5MoeForCausalLM` |
| [ ] | `qwen3_moe` | `Qwen3MoeForCausalLM` | 生成 | 1 | `Qwen3MoeForCausalLM` |
| [ ] | `qwen3_next` | `Qwen3NextForCausalLM` | 生成 | 1 | `Qwen3NextForCausalLM` |
| [ ] | `rnj1` | `Rnj1ForCausalLM` | 生成 | 1 | `Rnj1ForCausalLM` |
| [ ] | `sarvam` | `SarvamMLAForCausalLM` | 生成 | 1 | `SarvamMLAForCausalLM` |
| [ ] | `sarvam` | `SarvamMoEForCausalLM` | 生成 | 1 | `SarvamMoEForCausalLM` |
| [ ] | `seed_oss` | `SeedOssForCausalLM` | 生成 | 1 | `SeedOssForCausalLM` |
| [ ] | `solar` | `SolarForCausalLM` | 生成 | 1 | `SolarForCausalLM` |
| [ ] | `stablelm` | `StablelmForCausalLM` | 生成 | 1 | `StableLmForCausalLM` |
| [ ] | `step1` | `Step1ForCausalLM` | 生成 | 1 | `Step1ForCausalLM` |
| [ ] | `step3_text` | `Step3TextForCausalLM` | 生成 | 1 | `Step3TextForCausalLM` |
| [ ] | `step3p5` | `Step3p5ForCausalLM` | 生成 | 1 | `Step3p5ForCausalLM` |
| [ ] | `telechat2` | `TeleChat2ForCausalLM` | 生成 | 1 | `TeleChat2ForCausalLM` |
| [ ] | `teleflm` | `TeleFLMForCausalLM` | 生成 | 1 | `TeleFLMForCausalLM` |
| [ ] | `vllm.models.deepseek_v32` | `DeepseekV32ForCausalLM` | 生成 | 1 | `DeepseekV32ForCausalLM` |
| [ ] | `vllm.models.deepseek_v32` | `GlmMoeDsaForCausalLM` | 生成 | 1 | `GlmMoeDsaForCausalLM` |
| [x] ← DeepseekV4ForCausalLM.ts | `vllm.models.deepseek_v4` | `DeepseekV4ForCausalLM` | 生成 | 1 | `DeepseekV4ForCausalLM` |
| [ ] | `vllm.models.glm5next` | `Glm5NextForCausalLM` | 生成 | 1 | `Glm5NextForCausalLM` |
| [ ] | `vllm.models.hy_v4` | `HYV4ForCausalLM` | 生成 | 1 | `HYV4ForCausalLM` |
| [ ] | `vllm.models.inkling` | `InklingForCausalLM` | 生成 | 1 | `InklingForCausalLM` |
| [ ] | `vllm.models.inkling` | `InklingForConditionalGeneration` | 生成 | 1 | `InklingForConditionalGeneration` |
| [ ] | `vllm.models.kimi_k3` | `KimiLinearForCausalLM` | 生成 | 1 | `KimiLinearForCausalLM` |
| [ ] | `vllm.models.minimax_m3` | `MiniMaxM3SparseForCausalLM` | 生成 | 1 | `MiniMaxM3SparseForCausalLM` |
| [ ] | `vllm.models.qwen4_exp` | `Qwen4ExpForCausalLM` | 生成 | 1 | `Qwen4ExpForCausalLM` |
| [ ] | `zamba2` | `Zamba2ForCausalLM` | 生成 | 1 | `Zamba2ForCausalLM` |

## 多模态（113 张待画 / 113 张）

| 状态 | 模块 | 类 | 任务 | 名字 | `architectures` |
| --- | --- | --- | --- | --- | --- |
| [ ] | `nano_nemotron_vl` | `NemotronH_Nano_VL_V2` | 多模态 | 4 | `NemotronH_Nano_Omni_Reasoning_V3`<br>`NemotronH_Nano_VL_V2`<br>`NemotronH_Omni_Reasoning_V3`<br>`NemotronH_Super_Omni_Reasoning_V3` |
| [ ] | `ovis2_5` | `Ovis2_5` | 多模态 | 3 | `Ovis2_5`<br>`Ovis2_6ForCausalLM`<br>`Ovis2_6_MoeForCausalLM` |
| [ ] | `interns1` | `InternS1ForConditionalGeneration` | 多模态 | 2 | `InternS1ForConditionalGeneration`<br>`InternVLForConditionalGeneration` |
| [ ] | `moondream3` | `Moondream3ForCausalLM` | 多模态 | 2 | `HfMoondream`<br>`Moondream3ForCausalLM` |
| [ ] | `qwen2_5_omni_thinker` | `Qwen2_5OmniThinkerForConditionalGeneration` | 多模态 | 2 | `Qwen2_5OmniForConditionalGeneration`<br>`Qwen2_5OmniModel` |
| [ ] | `aria` | `AriaForConditionalGeneration` | 多模态 | 1 | `AriaForConditionalGeneration` |
| [ ] | `audioflamingo3` | `AudioFlamingo3ForConditionalGeneration` | 多模态 | 1 | `AudioFlamingo3ForConditionalGeneration` |
| [ ] | `bagel` | `BagelForConditionalGeneration` | 多模态 | 1 | `BagelForConditionalGeneration` |
| [ ] | `bailing_moe_v3_vl` | `BailingMoeV3VLForConditionalGeneration` | 多模态 | 1 | `BailingMoeV3VLForConditionalGeneration` |
| [ ] | `bee` | `BeeForConditionalGeneration` | 多模态 | 1 | `BeeForConditionalGeneration` |
| [ ] | `blip2` | `Blip2ForConditionalGeneration` | 多模态 | 1 | `Blip2ForConditionalGeneration` |
| [ ] | `cohere2_vision` | `Cohere2VisionForConditionalGeneration` | 多模态 | 1 | `Cohere2VisionForConditionalGeneration` |
| [ ] | `cohere_asr` | `CohereAsrForConditionalGeneration` | 多模态 | 1 | `CohereAsrForConditionalGeneration` |
| [ ] | `cohere_compass` | `CohereCompassForConditionalGeneration` | 多模态 | 1 | `CohereCompassForConditionalGeneration` |
| [ ] | `cosmos3` | `Cosmos3ForConditionalGeneration` | 多模态 | 1 | `Cosmos3ForConditionalGeneration` |
| [ ] | `cosmos3_edge` | `Cosmos3EdgeForConditionalGeneration` | 多模态 | 1 | `Cosmos3EdgeForConditionalGeneration` |
| [ ] | `deepseek_ocr` | `DeepseekOCRForCausalLM` | 多模态 | 1 | `DeepseekOCRForCausalLM` |
| [ ] | `deepseek_ocr2` | `DeepseekOCR2ForCausalLM` | 多模态 | 1 | `DeepseekOCR2ForCausalLM` |
| [ ] | `deepseek_vl2` | `DeepseekVLV2ForCausalLM` | 多模态 | 1 | `DeepseekVLV2ForCausalLM` |
| [ ] | `diffusion_gemma` | `DiffusionGemmaForConditionalGeneration` | 多模态 | 1 | `DiffusionGemmaForBlockDiffusion` |
| [ ] | `dots_ocr` | `DotsOCRForCausalLM` | 多模态 | 1 | `DotsOCRForCausalLM` |
| [ ] | `eagle2_5_vl` | `Eagle2_5_VLForConditionalGeneration` | 多模态 | 1 | `Eagle2_5_VLForConditionalGeneration` |
| [ ] | `ernie45_vl` | `Ernie4_5_VLMoeForConditionalGeneration` | 多模态 | 1 | `Ernie4_5_VLMoeForConditionalGeneration` |
| [ ] | `exaone4_5` | `Exaone4_5_ForConditionalGeneration` | 多模态 | 1 | `Exaone4_5_ForConditionalGeneration` |
| [ ] | `fireredasr2` | `FireRedASR2ForConditionalGeneration` | 多模态 | 1 | `FireRedASR2ForConditionalGeneration` |
| [ ] | `funasr` | `FunASRForConditionalGeneration` | 多模态 | 1 | `FunASRForConditionalGeneration` |
| [ ] | `funaudiochat` | `FunAudioChatForConditionalGeneration` | 多模态 | 1 | `FunAudioChatForConditionalGeneration` |
| [ ] | `gemma3_mm` | `Gemma3ForConditionalGeneration` | 多模态 | 1 | `Gemma3ForConditionalGeneration` |
| [ ] | `gemma3n_mm` | `Gemma3nForConditionalGeneration` | 多模态 | 1 | `Gemma3nForConditionalGeneration` |
| [ ] | `gemma4_mm` | `Gemma4ForConditionalGeneration` | 多模态 | 1 | `Gemma4ForConditionalGeneration` |
| [ ] | `gemma4_unified` | `Gemma4UnifiedForConditionalGeneration` | 多模态 | 1 | `Gemma4UnifiedForConditionalGeneration` |
| [ ] | `glm4_1v` | `Glm4vForConditionalGeneration` | 多模态 | 1 | `Glm4vForConditionalGeneration` |
| [ ] | `glm4_1v` | `Glm4vMoeForConditionalGeneration` | 多模态 | 1 | `Glm4vMoeForConditionalGeneration` |
| [ ] | `glm4v` | `GLM4VForCausalLM` | 多模态 | 1 | `GLM4VForCausalLM` |
| [ ] | `glm_ocr` | `GlmOcrForConditionalGeneration` | 多模态 | 1 | `GlmOcrForConditionalGeneration` |
| [ ] | `glmasr` | `GlmAsrForConditionalGeneration` | 多模态 | 1 | `GlmAsrForConditionalGeneration` |
| [ ] | `granite4_vision` | `Granite4VisionForConditionalGeneration` | 多模态 | 1 | `Granite4VisionForConditionalGeneration` |
| [ ] | `granite_speech` | `GraniteSpeechForConditionalGeneration` | 多模态 | 1 | `GraniteSpeechForConditionalGeneration` |
| [ ] | `granite_speech_plus` | `GraniteSpeechPlusForConditionalGeneration` | 多模态 | 1 | `GraniteSpeechPlusForConditionalGeneration` |
| [ ] | `h2ovl` | `H2OVLChatModel` | 多模态 | 1 | `H2OVLChatModel` |
| [ ] | `idefics3` | `Idefics3ForConditionalGeneration` | 多模态 | 1 | `Idefics3ForConditionalGeneration` |
| [ ] | `interns1_pro` | `InternS1ProForConditionalGeneration` | 多模态 | 1 | `InternS1ProForConditionalGeneration` |
| [ ] | `interns2_mobius` | `InternS2MobiusForConditionalGeneration` | 多模态 | 1 | `InternS2MobiusForConditionalGeneration` |
| [ ] | `interns2_preview` | `InternS2PreviewForConditionalGeneration` | 多模态 | 1 | `InternS2PreviewForConditionalGeneration` |
| [ ] | `internvl` | `InternVLChatModel` | 多模态 | 1 | `InternVLChatModel` |
| [ ] | `isaac` | `IsaacForConditionalGeneration` | 多模态 | 1 | `IsaacForConditionalGeneration` |
| [ ] | `kanana_v` | `KananaVForConditionalGeneration` | 多模态 | 1 | `KananaVForConditionalGeneration` |
| [ ] | `keye` | `KeyeForConditionalGeneration` | 多模态 | 1 | `KeyeForConditionalGeneration` |
| [ ] | `keye_vl1_5` | `KeyeVL1_5ForConditionalGeneration` | 多模态 | 1 | `KeyeVL1_5ForConditionalGeneration` |
| [ ] | `kimi_audio` | `KimiAudioForConditionalGeneration` | 多模态 | 1 | `MoonshotKimiaForCausalLM` |
| [ ] | `kimi_k25` | `KimiK25ForConditionalGeneration` | 多模态 | 1 | `KimiK25ForConditionalGeneration` |
| [ ] | `kimi_vl` | `KimiVLForConditionalGeneration` | 多模态 | 1 | `KimiVLForConditionalGeneration` |
| [ ] | `lfm2_vl` | `Lfm2VLForConditionalGeneration` | 多模态 | 1 | `Lfm2VlForConditionalGeneration` |
| [ ] | `lightonocr` | `LightOnOCRForConditionalGeneration` | 多模态 | 1 | `LightOnOCRForConditionalGeneration` |
| [ ] | `llava` | `LlavaForConditionalGeneration` | 多模态 | 1 | `LlavaForConditionalGeneration` |
| [ ] | `llava_next` | `LlavaNextForConditionalGeneration` | 多模态 | 1 | `LlavaNextForConditionalGeneration` |
| [ ] | `llava_next_video` | `LlavaNextVideoForConditionalGeneration` | 多模态 | 1 | `LlavaNextVideoForConditionalGeneration` |
| [ ] | `llava_onevision` | `LlavaOnevisionForConditionalGeneration` | 多模态 | 1 | `LlavaOnevisionForConditionalGeneration` |
| [ ] | `llava_onevision2` | `LlavaOnevision2ForConditionalGeneration` | 多模态 | 1 | `LlavaOnevision2ForConditionalGeneration` |
| [ ] | `midashenglm` | `MiDashengLMModel` | 多模态 | 1 | `MiDashengLMModel` |
| [ ] | `mimo_v2_omni` | `MiMoV2OmniForCausalLM` | 多模态 | 1 | `MiMoV2OmniForCausalLM` |
| [ ] | `minicpmo` | `MiniCPMO` | 多模态 | 1 | `MiniCPMO` |
| [ ] | `minicpmv` | `MiniCPMV` | 多模态 | 1 | `MiniCPMV` |
| [ ] | `minicpmv4_6` | `MiniCPMV4_6ForConditionalGeneration` | 多模态 | 1 | `MiniCPMV4_6ForConditionalGeneration` |
| [ ] | `mistral3` | `Mistral3ForConditionalGeneration` | 多模态 | 1 | `Mistral3ForConditionalGeneration` |
| [ ] | `mllama4` | `Llama4ForConditionalGeneration` | 多模态 | 1 | `Llama4ForConditionalGeneration` |
| [ ] | `molmo` | `MolmoForCausalLM` | 多模态 | 1 | `MolmoForCausalLM` |
| [ ] | `molmo2` | `Molmo2ForConditionalGeneration` | 多模态 | 1 | `Molmo2ForConditionalGeneration` |
| [ ] | `moss_audio` | `MossAudioModel` | 多模态 | 1 | `MossAudioModel` |
| [ ] | `moss_transcribe_diarize` | `MossTranscribeDiarizeForConditionalGeneration` | 多模态 | 1 | `MossTranscribeDiarizeForConditionalGeneration` |
| [ ] | `muse_glimmer` | `MuseGlimmerForCausalLM` | 多模态 | 1 | `MuseGlimmerForConditionalGeneration` |
| [ ] | `nemotron_parse` | `NemotronParseForConditionalGeneration` | 多模态 | 1 | `NemotronParseForConditionalGeneration` |
| [ ] | `nemotron_vl` | `LlamaNemotronVLChatModel` | 多模态 | 1 | `Llama_Nemotron_Nano_VL` |
| [ ] | `nvlm_d` | `NVLM_D_Model` | 多模态 | 1 | `NVLM_D` |
| [ ] | `opencua` | `OpenCUAForConditionalGeneration` | 多模态 | 1 | `OpenCUAForConditionalGeneration` |
| [ ] | `openpangu_vl` | `OpenPanguVLForConditionalGeneration` | 多模态 | 1 | `OpenPanguVLForConditionalGeneration` |
| [ ] | `openvla` | `OpenVLAForActionPrediction` | 多模态 | 1 | `OpenVLAForActionPrediction` |
| [ ] | `ovis` | `Ovis` | 多模态 | 1 | `Ovis` |
| [ ] | `paddleocr_vl` | `PaddleOCRVLForConditionalGeneration` | 多模态 | 1 | `PaddleOCRVLForConditionalGeneration` |
| [ ] | `paligemma` | `PaliGemmaForConditionalGeneration` | 多模态 | 1 | `PaliGemmaForConditionalGeneration` |
| [ ] | `phi3v` | `Phi3VForCausalLM` | 多模态 | 1 | `Phi3VForCausalLM` |
| [ ] | `phi4mm` | `Phi4MMForCausalLM` | 多模态 | 1 | `Phi4MMForCausalLM` |
| [ ] | `phi4siglip` | `Phi4ForCausalLMV` | 多模态 | 1 | `Phi4ForCausalLMV` |
| [ ] | `pixtral` | `PixtralForConditionalGeneration` | 多模态 | 1 | `PixtralForConditionalGeneration` |
| [ ] | `qianfan_ocr` | `QianfanOCRForConditionalGeneration` | 多模态 | 1 | `QianfanOCRForConditionalGeneration` |
| [ ] | `qwen2_5_vl` | `Qwen2_5_VLForConditionalGeneration` | 多模态 | 1 | `Qwen2_5_VLForConditionalGeneration` |
| [ ] | `qwen2_audio` | `Qwen2AudioForConditionalGeneration` | 多模态 | 1 | `Qwen2AudioForConditionalGeneration` |
| [ ] | `qwen2_vl` | `Qwen2VLForConditionalGeneration` | 多模态 | 1 | `Qwen2VLForConditionalGeneration` |
| [ ] | `qwen3_5` | `Qwen3_5ForConditionalGeneration` | 多模态 | 1 | `Qwen3_5ForConditionalGeneration` |
| [ ] | `qwen3_5` | `Qwen3_5MoeForConditionalGeneration` | 多模态 | 1 | `Qwen3_5MoeForConditionalGeneration` |
| [ ] | `qwen3_asr` | `Qwen3ASRForConditionalGeneration` | 多模态 | 1 | `Qwen3ASRForConditionalGeneration` |
| [ ] | `qwen3_asr_realtime` | `Qwen3ASRRealtimeGeneration` | 多模态 | 1 | `Qwen3ASRRealtimeGeneration` |
| [ ] | `qwen3_omni_moe_thinker` | `Qwen3OmniMoeThinkerForConditionalGeneration` | 多模态 | 1 | `Qwen3OmniMoeForConditionalGeneration` |
| [ ] | `qwen3_vl` | `Qwen3VLForConditionalGeneration` | 多模态 | 1 | `Qwen3VLForConditionalGeneration` |
| [ ] | `qwen3_vl_moe` | `Qwen3VLMoeForConditionalGeneration` | 多模态 | 1 | `Qwen3VLMoeForConditionalGeneration` |
| [ ] | `rvl` | `RForConditionalGeneration` | 多模态 | 1 | `RForConditionalGeneration` |
| [ ] | `skyworkr1v` | `SkyworkR1VChatModel` | 多模态 | 1 | `SkyworkR1VChatModel` |
| [ ] | `smolvlm` | `SmolVLMForConditionalGeneration` | 多模态 | 1 | `SmolVLMForConditionalGeneration` |
| [ ] | `step3_vl` | `Step3VLForConditionalGeneration` | 多模态 | 1 | `Step3VLForConditionalGeneration` |
| [ ] | `step3p7` | `Step3p7ForConditionalGeneration` | 多模态 | 1 | `Step3p7ForConditionalGeneration` |
| [ ] | `step_vl` | `StepVLForConditionalGeneration` | 多模态 | 1 | `StepVLForConditionalGeneration` |
| [ ] | `ultravox` | `UltravoxModel` | 多模态 | 1 | `UltravoxModel` |
| [ ] | `unlimited_ocr` | `UnlimitedOCRForCausalLM` | 多模态 | 1 | `UnlimitedOCRForCausalLM` |
| [ ] | `vllm.models.deepseek_v4` | `DeepseekV4ForConditionalGeneration` | 多模态 | 1 | `DeepseekV4ForConditionalGeneration` |
| [ ] | `vllm.models.deepseek_v41` | `DeepseekV41ForCausalLM` | 多模态 | 1 | `DeepseekV41ForCausalLM` |
| [ ] | `vllm.models.dots3_note` | `Dots3NoteForCausalLM` | 多模态 | 1 | `Dots3NoteForCausalLM` |
| [ ] | `vllm.models.glm5next` | `Glm5NextForConditionalGeneration` | 多模态 | 1 | `Glm5NextForConditionalGeneration` |
| [ ] | `vllm.models.kimi_k3` | `KimiK3ForConditionalGeneration` | 多模态 | 1 | `KimiK3ForConditionalGeneration` |
| [ ] | `vllm.models.minimax_m3` | `MiniMaxM3SparseForConditionalGeneration` | 多模态 | 1 | `MiniMaxM3SparseForConditionalGeneration` |
| [ ] | `vllm.models.qwen4_exp` | `Qwen4ExpForConditionalGeneration` | 多模态 | 1 | `Qwen4ExpForConditionalGeneration` |
| [ ] | `voxtral` | `VoxtralForConditionalGeneration` | 多模态 | 1 | `VoxtralForConditionalGeneration` |
| [ ] | `voxtral_realtime` | `VoxtralRealtimeGeneration` | 多模态 | 1 | `VoxtralRealtimeGeneration` |
| [ ] | `whisper` | `WhisperForConditionalGeneration` | 多模态 | 1 | `WhisperForConditionalGeneration` |

## pooling / 分类（55 张待画 / 55 张）

按现在的规矩这些画不出来：pooling 方式来自 vLLM 运行时的 `pooler_config`，repo 里没有这个信息。列在这里是为了让省略是一句明确的话 —— 其中就包括 `llama` 的三张（`LlamaModel` / `MistralModel` 走的是我们已经画了的那个类，只是换了尾巴）。

| 状态 | 模块 | 类 | 任务 | 名字 | `architectures` |
| --- | --- | --- | --- | --- | --- |
| [ ] | `colqwen3` | `ColQwen3Model` | 后期交互 | 3 | `ColQwen3`<br>`OpsColQwen3Model`<br>`Qwen3VLNemotronEmbedModel` |
| [ ] | `roberta` | `RobertaEmbeddingModel` | 嵌入 | 3 | `RobertaForMaskedLM`<br>`RobertaModel`<br>`XLMRobertaModel` |
| [ ] | `llama` | `LlamaForCausalLM` | 嵌入 | 2 | `LlamaModel`<br>`MistralModel` |
| [ ] | `qwen2` | `Qwen2ForCausalLM` | 嵌入 | 2 | `Qwen2ForCausalLM`<br>`Qwen2Model` |
| [ ] | `roberta` | `RobertaForSequenceClassification` | 序列分类 | 2 | `RobertaForSequenceClassification`<br>`XLMRobertaForSequenceClassification` |
| [ ] | `roberta` | `RobertaForTokenClassification` | token 分类 | 2 | `RobertaForTokenClassification`<br>`XLMRobertaForTokenClassification` |
| [ ] | `bert` | `BertEmbeddingModel` | 嵌入 | 1 | `BertModel` |
| [ ] | `bert` | `BertForMaskedLM` | 嵌入 | 1 | `BertForMaskedLM` |
| [ ] | `bert` | `BertForSequenceClassification` | 序列分类 | 1 | `BertForSequenceClassification` |
| [ ] | `bert` | `BertForTokenClassification` | token 分类 | 1 | `BertForTokenClassification` |
| [ ] | `bert` | `BertSpladeSparseEmbeddingModel` | 嵌入 | 1 | `BertSpladeSparseEmbeddingModel` |
| [ ] | `bert_with_rope` | `GteNewForSequenceClassification` | 序列分类 | 1 | `GteNewForSequenceClassification` |
| [ ] | `bert_with_rope` | `GteNewModel` | 嵌入 | 1 | `GteNewModel` |
| [ ] | `bert_with_rope` | `NomicBertModel` | 嵌入 | 1 | `NomicBertModel` |
| [ ] | `bert_with_rope` | `SnowflakeGteNewModel` | 嵌入 | 1 | `GteModel` |
| [ ] | `clip` | `CLIPEmbeddingModel` | 嵌入 | 1 | `CLIPModel` |
| [ ] | `colbert` | `ColBERTJinaRobertaModel` | 后期交互 | 1 | `ColBERTJinaRobertaModel` |
| [ ] | `colbert` | `ColBERTLfm2Model` | 后期交互 | 1 | `ColBERTLfm2Model` |
| [ ] | `colbert` | `ColBERTModel` | 后期交互 | 1 | `HF_ColBERT` |
| [ ] | `colbert` | `ColBERTModernBertModel` | 后期交互 | 1 | `ColBERTModernBertModel` |
| [ ] | `colmodernvbert` | `ColModernVBertForRetrieval` | 后期交互 | 1 | `ColModernVBertForRetrieval` |
| [ ] | `colpali` | `ColPaliModel` | 嵌入 | 1 | `ColPaliForRetrieval` |
| [ ] | `colpali` | `ColPaliModel` | 后期交互 | 1 | `ColPaliForRetrieval` |
| [ ] | `colqwen3_5` | `ColQwen3_5Model` | 后期交互 | 1 | `ColQwen3_5` |
| [ ] | `deepseek_v2` | `DeepseekV3ForCausalLM` | 嵌入 | 1 | `DeepseekV3BidirectionalModel` |
| [ ] | `gemma2` | `Gemma2ForCausalLM` | 嵌入 | 1 | `Gemma2Model` |
| [ ] | `gemma3` | `Gemma3Model` | 嵌入 | 1 | `Gemma3TextModel` |
| [ ] | `glm` | `GlmForCausalLM` | 嵌入 | 1 | `GlmForCausalLM` |
| [ ] | `gpt2` | `GPT2ForSequenceClassification` | 序列分类 | 1 | `GPT2ForSequenceClassification` |
| [ ] | `internlm2` | `InternLM2ForRewardModel` | 打分 | 1 | `InternLM2ForRewardModel` |
| [ ] | `jamba` | `JambaForSequenceClassification` | 序列分类 | 1 | `JambaForSequenceClassification` |
| [ ] | `jina` | `JinaEmbeddingsV5Model` | 嵌入 | 1 | `JinaEmbeddingsV5Model` |
| [ ] | `jina` | `JinaForRanking` | 后期交互 | 1 | `JinaForRanking` |
| [ ] | `jina_vl` | `JinaVLForSequenceClassification` | 序列分类 | 1 | `JinaVLForRanking` |
| [ ] | `llama` | `LlamaBidirectionalForSequenceClassification` | 序列分类 | 1 | `LlamaBidirectionalForSequenceClassification` |
| [ ] | `llama` | `LlamaBidirectionalModel` | 嵌入 | 1 | `LlamaBidirectionalModel` |
| [ ] | `llava_next` | `LlavaNextForConditionalGeneration` | 嵌入 | 1 | `LlavaNextForConditionalGeneration` |
| [ ] | `modernbert` | `ModernBertForSequenceClassification` | 序列分类 | 1 | `ModernBertForSequenceClassification` |
| [ ] | `modernbert` | `ModernBertForTokenClassification` | token 分类 | 1 | `ModernBertForTokenClassification` |
| [ ] | `modernbert` | `ModernBertModel` | 嵌入 | 1 | `ModernBertModel` |
| [ ] | `nemotron_nas` | `DeciLMForCausalLM` | 嵌入 | 1 | `DeciLMForCausalLM` |
| [ ] | `nemotron_vl` | `LlamaNemotronVLForEmbedding` | 嵌入 | 1 | `LlamaNemotronVLModel` |
| [ ] | `nemotron_vl` | `LlamaNemotronVLForSequenceClassification` | 序列分类 | 1 | `LlamaNemotronVLForSequenceClassification` |
| [ ] | `openai_privacy_filter` | `OpenAIPrivacyFilterForTokenClassification` | token 分类 | 1 | `OpenAIPrivacyFilterForTokenClassification` |
| [ ] | `phi3` | `Phi3ForCausalLM` | 嵌入 | 1 | `Phi3ForCausalLM` |
| [ ] | `phi3v` | `Phi3VForCausalLM` | 嵌入 | 1 | `Phi3VForCausalLM` |
| [ ] | `qwen2_rm` | `Qwen2ForProcessRewardModel` | 打分 | 1 | `Qwen2ForProcessRewardModel` |
| [ ] | `qwen2_rm` | `Qwen2ForRewardModel` | 打分 | 1 | `Qwen2ForRewardModel` |
| [ ] | `qwen2_vl` | `Qwen2VLForConditionalGeneration` | 嵌入 | 1 | `Qwen2VLForConditionalGeneration` |
| [ ] | `qwen3_asr_forced_aligner` | `Qwen3ASRForcedAlignerForTokenClassification` | token 分类 | 1 | `Qwen3ASRForcedAlignerForTokenClassification` |
| [ ] | `roberta` | `BgeM3EmbeddingModel` | 嵌入 | 1 | `BgeM3EmbeddingModel` |
| [ ] | `siglip` | `SiglipEmbeddingModel` | 嵌入 | 1 | `SiglipModel` |
| [ ] | `telechat2` | `TeleChat2ForCausalLM` | 嵌入 | 1 | `TeleChat2ForCausalLM` |
| [ ] | `terratorch` | `Terratorch` | 嵌入 | 1 | `Terratorch` |
| [ ] | `voyage` | `VoyageQwen3BidirectionalEmbedModel` | 嵌入 | 1 | `VoyageQwen3BidirectionalEmbedModel` |

