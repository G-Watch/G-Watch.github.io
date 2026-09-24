import { CHIP_GAP, type Overview, type PlacedStack } from "./layout";
import type { ArchLayerType, ArchTensor } from "./types";

/**
 * Where the strip is cut so a block can be opened in its place.
 *
 * Domain logic, not presentation: the diagram cuts here and the assertions
 * check here, and they have to be the same rule or one of them is checking
 * something the other does not do.
 *
 * Two things decide a cut, and both are about not drawing one thing twice:
 *
 *   - the block takes the place of its own chip, so the left half stops where
 *     the thing before it ends and the right half resumes where the thing
 *     after it starts;
 *   - a tensor the strip already draws on one side of the cut is the same
 *     tensor the block draws inside itself, and only one of the two may
 *     appear. Before the cut the strip keeps it and the block leaves its entry
 *     out; after the cut the block keeps it and the strip's copy is windowed
 *     away.
 */
export interface Splice {
  /** Where the left half of the strip stops. */
  leftTo: number;
  /** Where the right half resumes. */
  rightFrom: number;
  /** The line in the strip that the cut hands over on. */
  stripLine: number;
  /** Whether the block's first input is already drawn to the left. */
  omitEntry: boolean;
  /** Whether the block's output is already drawn to the right. */
  omitExit: boolean;
}

/** The tensor a block hands on — the last step of its last chain. */
export function outputOf(type: ArchLayerType): ArchTensor | undefined {
  const last = type.sections[type.sections.length - 1];
  const chain = last?.chains[last.chains.length - 1];
  return chain?.steps[chain.steps.length - 1]?.out;
}

/** Whether two tensors are the same thing as far as the picture shows. */
function same(a?: ArchTensor, b?: ArchTensor): boolean {
  return !!a && !!b && a.dims.join() === b.dims.join();
}

function tensorNode(ov: Overview, id: string | undefined) {
  const node = ov.nodes.find((n) => n.id === id);
  return node?.type === "tensor" ? node : undefined;
}

/** The tensor the strip hands to `to`, if it draws one at all. */
function feeds(ov: Overview, to: string) {
  return tensorNode(ov, ov.edges.find((edge) => edge.to === to)?.from);
}

/**
 * The cut for a layer of the stack, or for the block that hangs off it.
 *
 * `layer` is the index in the stack; for the hanging block it is ignored.
 */
export function splice(
  ov: Overview,
  type: ArchLayerType,
  layer: number,
  hanging = false,
): Splice {
  if (hanging) {
    const chip = ov.nodes.find(
      (node): node is PlacedStack => node.type === "stack" && !!node.branch,
    );
    const out = tensorNode(ov, "branchOut");
    return {
      leftTo: chip ? chip.x : ov.width,
      rightFrom: out?.x ?? ov.width,
      stripLine: chip ? chip.y + chip.h / 2 : ov.centre,
      omitEntry: same(feeds(ov, "branch")?.tensor, type.io),
      omitExit: same(out?.tensor, outputOf(type)),
    };
  }

  const stack = ov.nodes.find(
    (node): node is PlacedStack => node.type === "stack" && !node.branch,
  );
  if (!stack) {
    const mid = Math.round(ov.width / 2);
    return {
      leftTo: mid,
      rightFrom: mid,
      stripLine: ov.centre,
      omitEntry: false,
      omitExit: false,
    };
  }
  // The stack's own chip width, not the constant: it depends on how many
  // layers there are, and a cut computed from a stale pitch lands between the
  // wrong two chips.
  const pitch = stack.chipW + CHIP_GAP;
  const after = Math.min(stack.x + (layer + 1) * pitch, stack.x + stack.w);
  // The LAST layer of the stack hands on to the tensor the strip draws after
  // it, which is that layer's own output. Between two chips the strip draws
  // nothing, so no other layer meets a tensor at either end.
  const out = tensorNode(ov, "stackOut");
  const lastOfStack = stack.x + (layer + 1) * pitch >= stack.x + stack.w;
  return {
    leftTo: layer === 0 ? stack.x : stack.x + layer * pitch - CHIP_GAP,
    rightFrom: after,
    stripLine: ov.centre,
    omitEntry: layer === 0 && same(feeds(ov, "stack")?.tensor, type.io),
    omitExit: lastOfStack && same(out?.tensor, outputOf(type)),
  };
}
