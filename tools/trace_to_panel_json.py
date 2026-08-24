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
import json
import os


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("report")
    ap.add_argument("out")
    ap.add_argument("--stride", type=int, default=32,
                    help="keep every Nth global thread id")
    ap.add_argument("--kernel", default=None, help="override the kernel name")
    args = ap.parse_args()

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
        "scopes": [{"id": sid, "label": label} for sid, label in sorted(scopes.items())],
        "lanes": lanes,
        "intervals": intervals,
    }

    with open(args.out, "w", encoding="utf8") as fh:
        json.dump(out, fh, separators=(",", ":"))

    print(f"lanes     : {len(lanes)}  (each stands for {lane_repeat} thread(s))")
    print(f"intervals : {len(intervals)}")
    print(f"out       : {args.out}  ({os.path.getsize(args.out) / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
