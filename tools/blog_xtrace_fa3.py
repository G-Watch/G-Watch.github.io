"""Export the exact data behind fig:agent-case (FA-3) for the web chart."""
import importlib.util, json, os, sys
import numpy as np
FIGS = "/Users/zobin/Desktop/papers/feynman_sass_instrumentation/workdir/sass-iket/figs"
sys.path.insert(0, FIGS)
spec = importlib.util.spec_from_file_location("ac", os.path.join(FIGS, "agent_case", "plot.py"))
A = importlib.util.module_from_spec(spec); spec.loader.exec_module(A)
M = A.M
curves, mock = A.load_curves()
assert not mock
plateau = max(float(np.mean(curves[a][-20:])) for a in A.CURVE_ARMS)
sota = plateau - 2.5
out = {"sota": round(sota, 2), "curves": {}, "reach": {}, "panels": {}}
for arm in A.CURVE_ARMS:
    y = curves[arm][:A.N_ITER + 1]
    out["curves"][arm] = [round(float(v), 2) for v in y]
    sm = np.convolve(y, np.ones(5) / 5, mode="same")
    hit = np.nonzero(sm >= sota)[0]
    out["reach"][arm] = int(hit[0]) if hit.size else None
tf = A.load_snapshots()
for arm in A.ARMS:
    ivs = tf["arms"][arm]["intervals"]
    cta = M.pick_median_cta(ivs)
    ivs = [iv for iv in ivs if iv["cta"] == cta]
    w0, w1, prod = M.pick_producer_window(ivs)
    zw = M.pick_zoom_warp(ivs, w0, w1)
    cons = sorted((iv for iv in ivs if iv["warp"] == zw and iv["region"] in M.ZOOM_PHASES
                   and w0 <= iv["start"] < w1), key=lambda iv: iv["start"])
    if cons: w1 = max(w1, max(iv["end"] for iv in cons))
    def pack(ph):
        ph = sorted(ph, key=lambda i: i["start"])
        rows, n = A._sublanes(ph)
        return [{"region": iv["region"], "start": round(max(iv["start"], w0) - w0, 1),
                 "end": round(min(iv["end"], w1) - w0, 1), "row": r} for iv, r in zip(ph, rows)], n
    p, pn = pack(prod); c, cn = pack(cons)
    out["panels"][arm] = {"span": round(w1 - w0, 1), "producer": p, "consumer": c, "consumerRows": cn}
print(json.dumps(out["reach"]), out["sota"])
for a, p in out["panels"].items(): print(a, p["span"], [(x["region"], x["end"]-x["start"]) for x in p["producer"]])
json.dump(out, open(os.path.join(os.path.dirname(__file__), "..", "lib", "blog", "xtrace-fa3.json"), "w"), separators=(",", ":"))
