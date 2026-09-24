import { spec as DeepseekV4ForCausalLM } from "./DeepseekV4ForCausalLM";
import { spec as LlamaForCausalLM } from "./LlamaForCausalLM";
import type { ArchInput, ArchModel, ArchSpec } from "./types";
import type { HfConfig, HfModelSnapshot } from "../hf-model";

/**
 * The architecture registry.
 *
 * USER-OWNED. One file per `architectures` entry, named after it exactly, so
 * what is covered and what is not is answerable by listing this directory.
 * Registration is explicit — a spec that is not imported here does not exist,
 * and an architecture with no spec renders nothing rather than a guess.
 *
 * For scale: vLLM's registry names 300 architectures that load as a main model
 * across 225 implementation modules, 10 of which live outside
 * `model_executor/models/` and are read from `vllm/models/` instead. This
 * covers the ones written so far, and `coverage()` reports the gap instead of
 * hiding it.
 *
 * A spec claims a name only when the whole picture can be traced. The `llama`
 * module serves ten names and this registry claims six: the four pooling and
 * classification ones end in a pooler whose method comes from vLLM's runtime
 * config rather than from the repo, so they cannot be drawn.
 *
 * Those counts move with vLLM, so `maintain_docs/architecture-diagram.md`
 * states them with the rule that produces them rather than as a fact.
 */
const SPECS: ArchSpec[] = [LlamaForCausalLM, DeepseekV4ForCausalLM];

/** Architecture name → spec. */
const BY_ARCH = new Map<string, ArchSpec>(
  SPECS.flatMap((spec) => spec.arch.map((name) => [name, spec] as const)),
);

/** Every architecture that has a spec, sorted. */
export function coverage(): string[] {
  return [...BY_ARCH.keys()].sort();
}

/** The spec for a config's `architectures[0]`, if one is written. */
export function specFor(config: HfConfig): ArchSpec | undefined {
  const names = config.architectures;
  if (!Array.isArray(names)) return undefined;
  for (const name of names) {
    if (typeof name === "string") {
      const spec = BY_ARCH.get(name);
      if (spec) return spec;
    }
  }
  return undefined;
}

/** `architectures[0]`, whether or not a spec exists for it. */
export function archNameOf(config: HfConfig): string | undefined {
  const names = config.architectures;
  return Array.isArray(names) && typeof names[0] === "string"
    ? names[0]
    : undefined;
}

const HF_ORIGIN = "https://huggingface.co";

/**
 * Fetch whatever extra repo files a spec declared, pinned to the snapshot's
 * commit so they describe the same state of the repo as the config does.
 * A file that is missing or unparseable comes back undefined; a spec must cope
 * with that rather than assume it is there.
 */
async function fetchExtras(
  spec: ArchSpec,
  snapshot: HfModelSnapshot,
  signal?: AbortSignal,
): Promise<Record<string, HfConfig | undefined>> {
  const paths = spec.extraFiles ?? [];
  const at = snapshot.repo.sha || snapshot.ref.revision;
  const entries = await Promise.all(
    paths.map(async (path) => {
      try {
        const response = await fetch(
          `${HF_ORIGIN}/${snapshot.ref.id}/resolve/${encodeURIComponent(at)}/${path}`,
          { signal },
        );
        if (!response.ok) return [path, undefined] as const;
        return [path, (await response.json()) as HfConfig] as const;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          throw error;
        return [path, undefined] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

/**
 * Build the diagram for a loaded model, or undefined when its architecture has
 * no spec yet. Cached per commit: a spec is pure, so the only reason to rebuild
 * is a different checkpoint.
 */
const BUILT = new Map<string, ArchModel>();

export async function buildArchModel(
  snapshot: HfModelSnapshot,
  signal?: AbortSignal,
): Promise<ArchModel | undefined> {
  const spec = specFor(snapshot.config);
  if (!spec) return undefined;

  const key = `${snapshot.ref.id}@${snapshot.repo.sha}`;
  const hit = BUILT.get(key);
  if (hit) return hit;

  const input: ArchInput = {
    config: snapshot.config,
    shape: snapshot.shape,
    extra: await fetchExtras(spec, snapshot, signal),
  };
  const model = spec.build(input);
  BUILT.set(key, model);
  return model;
}

/** Resolve a spec's `source` to a link into the loaded repo. */
export function sourceHref(
  model: ArchModel,
  snapshot: HfModelSnapshot,
): string | undefined {
  if (model.source.upstream) return model.source.upstream;
  if (!model.source.path) return undefined;
  const at = snapshot.repo.sha || snapshot.ref.revision;
  return `${HF_ORIGIN}/${snapshot.ref.id}/blob/${at}/${model.source.path}`;
}

export type { ArchModel, ArchSpec } from "./types";
