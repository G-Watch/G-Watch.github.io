"""Recover the data behind fig:case-fa4 from the paper's vector PDF.

The raw traces (exp-data/b300, on the external drive) were not reachable, so
this reads the figure itself: every per-SM phase bar is a vector rectangle in
axis coordinates, and the whole-kernel placement map is an embedded bitmap.
"""
import json
import pymupdf as fitz
import numpy as np

PDF = "/Users/zobin/Desktop/papers/feynman_sass_instrumentation/workdir/sass-iket/figs/case_fa4/case_fa4.pdf"
pg = fitz.open(PDF)[0]
dr = pg.get_drawings()
hx = lambda c: '#%02x%02x%02x' % tuple(round(v * 255) for v in c) if c else None

PHASE = {"#8fb0d4": "load", "#7d4a78": "mma", "#2e7d6b": "softmax",
         "#bd9a3f": "rescale", "#efc3ae": "store", "#ae4a38": "drain",
         "#e4e4e4": "tile"}
COLS = [("cudnn", 28.64, 620), ("fa4", 149.35, 1212), ("opt", 270.06, 1746)]
W = 139.27 - 28.64
PT_PER_US = (72.83 - 28.64) / 20.0
Y0, ROW_H, NROW = 71.28, 5.04, 15
MAP_Y0, MAP_Y1, NB_SM = 10.08, 46.08, 148
# Rows by role, read off the panel's darker row borders (identical in all three).
ROLES = [("Producer", 0, 1), ("MMA", 1, 2), ("SoftMax", 2, 10),
         ("Correction", 10, 14), ("Epilogue", 14, 15)]
# Last-tile epilogue, as the paper's magnifiers label it (ns).
LAST = {"cudnn": (608, 544), "fa4": (576, 544), "opt": (576, None)}
SMID = {"cudnn": 20, "fa4": 8, "opt": 41}

imgs = sorted(((pg.get_image_rects(i[0])[0], i[0]) for i in pg.get_images(full=True)),
              key=lambda t: t[0].x0)
out = {"xmaxUs": round(W / PT_PER_US, 2), "nbSm": NB_SM, "roles": ROLES, "cols": {}}
for (key, x0, inset_seq), (irect, xref) in zip(COLS, imgs):
    t = lambda x: round((x - x0) / PT_PER_US, 3)
    bars = []
    for d in dr:
        r = d["rect"]
        if not (x0 - 0.5 <= r.x0 and r.x1 <= x0 + W + 0.5 and Y0 - 0.5 <= r.y0 and r.y1 <= Y0 + NROW * ROW_H + 0.5):
            continue
        if d["seqno"] >= inset_seq or d["type"] == "s":
            continue
        ph = PHASE.get(hx(d.get("fill")))
        if not ph:
            continue
        row = int(((r.y0 + r.y1) / 2 - Y0) // ROW_H)
        bars.append([ph, row, t(r.x0), t(r.x1)])
    # CTA boundaries: black dashed rules spanning the whole trace panel
    waves = sorted({t(d["rect"].x0) for d in dr if d["type"] == "s" and hx(d.get("color")) == "#000000"
                    and d.get("dashes") not in (None, "[] 0") and x0 < d["rect"].x0 < x0 + W
                    and abs(d["rect"].y0 - Y0) < 0.1 and abs(d["rect"].y1 - (Y0 + NROW * ROW_H)) < 0.1})
    # Placement map: the bitmap, one run list per bitmap row.
    pix = fitz.Pixmap(pg.parent, xref)
    a = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)[:, :, :3].astype(int)
    filled = a.sum(axis=2) < 3 * 245
    runs = []
    for y in range(pix.h):
        row, x = [], 0
        while x < pix.w:
            if filled[y, x]:
                s = x
                while x < pix.w and filled[y, x]:
                    x += 1
                row.append([round(s / pix.w * out["xmaxUs"], 2), round(x / pix.w * out["xmaxUs"], 2)])
            else:
                x += 1
        runs.append(row)
    # the zoomed SM: the red line drawn over the map
    red = [d["rect"] for d in dr if d["type"] == "s" and hx(d.get("color")) == "#b02418"
           and MAP_Y0 < d["rect"].y0 < MAP_Y1 and x0 <= d["rect"].x0 < x0 + W]
    zrow = round((red[0].y0 - MAP_Y0) / (MAP_Y1 - MAP_Y0) * NB_SM - 0.5)
    store, drain = LAST[key]
    last_epi = sorted((b for b in bars if b[0] in ("store", "drain")), key=lambda b: b[2])
    out["cols"][key] = {"bars": bars, "waves": waves, "mapRuns": runs,
                        "mapRows": pix.h, "zoomRow": zrow, "smid": SMID[key],
                        "lastTile": {"start": [b for b in last_epi if b[0] == "store"][-1][2],
                                     "storeNs": store, "drainNs": drain}}
    print(key, len(bars), "bars, waves", waves, "map", pix.w, "x", pix.h, "zoomRow", zrow,
          "kernel end", max(b[3] for b in bars))
out["perf"] = {
    "b8 h8 s1024": {"fa4": 770, "cudnn": 821, "opt": 864},
    "b8 h16 s1024": {"fa4": 737, "cudnn": 833, "opt": 832},
    "b4 h32 s1024": {"fa4": 735, "cudnn": 831, "opt": 833},
    "b2 h16 s4096": {"fa4": 1336, "cudnn": 1404, "opt": 1406},
}
import os
json.dump(out, open(os.path.join(os.path.dirname(__file__), "..", "lib", "blog", "xtrace-fa4.json"), "w"), separators=(",", ":"))
