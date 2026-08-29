#!/usr/bin/env python3
"""Convert a G-Watch Section_IntraKernelTrace report into the compact JSON the
web trace panel renders (see lib/trace-format.ts).

The raw report carries one record per scope boundary per thread (2.1M records /
282 MB for the sample kernel), which no browser should load. This pairs
START/END into intervals, rebases time to t_min, and keeps every Nth thread.

Sampling is lossless as long as the skipped threads really do share the kept
thread's timeline, which is what lockstep execution inside a warp gives you.
This script CHECKS that rather than assuming it: every skipped thread is
compared against its lane's representative, and only if all of them match does
the output claim `laneRepeat`, which lets the panel draw a full per-thread axis
from one stored lane per group. If any thread diverges, laneRepeat drops to 1
and the output honestly covers only the sampled threads — rerun with
--stride 1 to keep them all.

    python3 tools/trace_to_panel_json.py <report.json> <out.json> [--stride 32]
"""
import argparse
import collections
import json
import os


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("report")
    ap.add_argument("out")
    ap.add_argument("--stride", type=int, default=32,
                    help="keep every Nth global thread id")
    ap.add_argument("--kernel", default=None, help="override the kernel name")
    ap.add_argument("--sm-dispatch", default=None,
                    help="JSON object mapping block ids to SM ids, shown in the "
                         "SM dispatching view")
    ap.add_argument("--roles", default=None,
                    help="JSON object mapping scope labels to warp-role names, "
                         "carried into each scope for the legend's role groups")
    args = ap.parse_args()
    roles = json.loads(args.roles) if args.roles else {}

    with open(args.report, encoding="utf8") as fh:
        report = json.load(fh)

    run = next(
        s for s in report["sections"] if s["type"] == "Section_IntraKernelTrace"
    )["data"]["runs"][0]
    analysis = run["analysis"]
    records = run["trace_results"]

    t_min = analysis["t_min"]
    block_size = analysis["block_size"]

    scopes = {}
    for record in records:
        scopes.setdefault(record["scope_id"], record["scope_label"])

    timelines = {}
    lane_of = {}
    lanes = []
    intervals = []
    open_at = {}
    # every thread's timeline, so the sampling can be checked rather than trusted
    timelines = {}
    pending = {}

    for record in records:
        tid = record["global_tid"]
        key_all = (tid, record["scope_id"])
        t_all = record["payload"] - t_min
        if record["type_id"] == 1:
            pending[key_all] = t_all
        else:
            began = pending.pop(key_all, None)
            if began is not None:
                timelines.setdefault(tid, []).append(
                    (record["scope_id"], began, t_all - began)
                )
        if tid % args.stride:
            continue
        lane = lane_of.get(tid)
        if lane is None:
            lane = len(lanes)
            lane_of[tid] = lane
            warp = tid // 32
            lanes.append({
                "tid": tid,
                "warp": warp,
                "wg": warp // 4,
                "block": tid // block_size,
            })
        key = (lane, record["scope_id"])
        t = record["payload"] - t_min
        if record["type_id"] == 1:
            open_at[key] = t
        else:
            start = open_at.pop(key, None)
            if start is not None:
                intervals.append([lane, record["scope_id"], start, t - start])

    intervals.sort(key=lambda iv: (iv[0], iv[2]))

    # Which stripe of a lane's row each scope draws on. Two scopes live at the
    # same moment on one lane cannot share a stripe, which is a graph colouring
    # over the scopes -- done per scope, not per interval, because a row at warp
    # or block level folds hundreds of lanes onto itself and a stripe only means
    # something there if every lane puts the same scope on it. Colouring in
    # order of falling total duration puts the long scope (the mainloop a run of
    # short ones nests inside) on the first stripe. The panel derives this
    # itself when it is missing, so an older bundle still stripes.
    overlaps = set()
    spent = collections.Counter()
    self_overlap = False
    per_lane = collections.defaultdict(list)
    for lane, scope_id, start, dur in intervals:
        per_lane[lane].append((start, dur, scope_id))
    for events in per_lane.values():
        live = []  # (ends, scope_id), already start-ascending
        for start, dur, scope_id in events:
            spent[scope_id] += dur
            live = [entry for entry in live if entry[0] > start]
            for _, other in live:
                if other == scope_id:
                    self_overlap = True
                else:
                    overlaps.add((min(other, scope_id), max(other, scope_id)))
            live.append((start + dur, scope_id))

    if self_overlap:
        # a scope overlapping itself has no one stripe to sit on; leave it off
        print("! a scope overlaps itself; stripes left flat")
        stripe_of = {sid: 0 for sid in scopes}
    else:
        # built up as we go: only an already-coloured scope can claim a stripe,
        # or the first scope would see every other one sitting on stripe 0
        stripe_of = {}
        for sid in sorted(scopes, key=lambda s: (-spent[s], s)):
            taken = {
                stripe_of[other]
                for other in stripe_of
                if (min(other, sid), max(other, sid)) in overlaps
            }
            stripe = 0
            while stripe in taken:
                stripe += 1
            stripe_of[sid] = stripe

    # Does each kept thread stand for the stride's worth of threads after it?
    lane_repeat = args.stride
    diverged = None
    for lane in lanes:
        base = timelines.get(lane["tid"])
        for offset in range(1, args.stride):
            other = timelines.get(lane["tid"] + offset)
            if other is None:
                continue
            if other != base:
                diverged = (lane["tid"], lane["tid"] + offset)
                break
        if diverged:
            break
    if diverged:
        lane_repeat = 1
        print(
            f"! threads {diverged[0]} and {diverged[1]} have different timelines; "
            f"laneRepeat=1 (rerun with --stride 1 to keep every thread)"
        )

    out = {
        "kernel": args.kernel or run["kernel_prototype"],
        "grid": analysis["grid_dim"],
        "block": analysis["block_dim"],
        "blockSize": block_size,
        "span": analysis["span"],
        "clock": run["compile_results"].get("clock_type", "gpu"),
        "sampledEvery": args.stride,
        "laneRepeat": lane_repeat,
        "totalThreads": analysis["n_threads"],
        "scopes": [
            {
                "id": sid,
                "label": label,
                **({"role": roles[label]} if label in roles else {}),
                "stripe": stripe_of[sid],
            }
            for sid, label in sorted(scopes.items())
        ],
        "lanes": lanes,
        "intervals": intervals,
        # block (CTA) id -> the SM it ran on, from the caller's own capture
        "smDispatch": json.loads(args.sm_dispatch) if args.sm_dispatch else {},
    }

    with open(args.out, "w", encoding="utf8") as fh:
        json.dump(out, fh, separators=(",", ":"))

    print(f"lanes     : {len(lanes)}  (each stands for {lane_repeat} thread(s))")
    print(f"stripes   : {max(stripe_of.values()) + 1}  "
          f"(scopes that overlap get one each)")
    print(f"intervals : {len(intervals)}")
    print(f"out       : {args.out}  ({os.path.getsize(args.out) / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
