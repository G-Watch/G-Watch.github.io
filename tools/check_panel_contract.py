#!/usr/bin/env python3
"""Fail when the trace panel's three copies of one contract disagree.

The panel is drawn twice -- `components/trace-panel.tsx` here and the vanilla-JS
one a G-Watch report renders -- from values written down a third time in
`maintain_docs/trace_panel_contract.md`. Nothing at build time ties them
together, so a number changed in one place is a panel that quietly stops
matching the other. This reads all three and reports every value that differs.

    python3 tools/check_panel_contract.py [--gwatch <path to the G-Watch tree>]
"""
import argparse
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DEFAULT_GWATCH = os.path.normpath(os.path.join(ROOT, "..", ".."))

# the layout and gesture values, as each side spells them
LIST_SCALAR = (
    "AXIS_H", "AXIS_W", "PAD_TOP", "MIN_ROW_PX", "MIN_MARK_PX", "MIN_STRIPE_PX",
    "MIN_RULE_PX", "MIN_RAIL_PX", "DRAG_AXIS_PX", "GRAB_PX",
)
LIST_SURFACE = ("FILM", "GRID", "TICK", "EDGE", "RULE", "RAIL", "MARK", "MARK_FILL")


def read_markdown(path):
    """The contract as the document states it."""
    with open(path, encoding="utf-8") as handle:
        text = handle.read()
    out = {"inks": [], "surfaces": {}, "scalars": {}, "levels": []}
    for row in re.finditer(r"^\|\s*(\d+|—)\s*\|\s*`([\d, ]+)`\s*\|\s*(\w+)", text, re.M):
        rgb = tuple(int(part) for part in row.group(2).split(","))
        if row.group(1) == "—":
            out["neutral"] = rgb
        else:
            out["inks"].append(rgb)
    for row in re.finditer(r"^\|\s*`(\w+)`\s*\|\s*`([^`]+)`\s*\|", text, re.M):
        out["surfaces"][row.group(1)] = row.group(2)
    for row in re.finditer(r"^\|\s*`(\w+)`\s*\|\s*([\d.]+)\s*\|", text, re.M):
        out["scalars"][row.group(1)] = float(row.group(2))
    match = re.search(r"^`thread`, `warp`, `warpgroup`, `block`", text, re.M)
    if match:
        out["levels"] = ["thread", "warp", "warpgroup", "block"]
    out["density"] = float(re.search(r"Exposure density `([\d.]+)`", text).group(1))
    return out


def read_typescript(path_panel, path_format):
    """The contract as the site's panel holds it."""
    with open(path_panel, encoding="utf-8") as handle:
        text = handle.read()
    out = {"inks": [], "surfaces": {}, "scalars": {}, "levels": []}
    block = re.search(r"SCOPE_INKS[^=]*=\s*\[(.*?)\];", text, re.S).group(1)
    for row in re.finditer(r"\[\s*(\d+),\s*(\d+),\s*(\d+)\s*\]", block):
        out["inks"].append(tuple(int(row.group(i)) for i in (1, 2, 3)))
    neutral = re.search(r"NEUTRAL_INK[^=]*=\s*\[\s*(\d+),\s*(\d+),\s*(\d+)", text)
    out["neutral"] = tuple(int(neutral.group(i)) for i in (1, 2, 3))
    out["density"] = float(re.search(r"const DENSITY = ([\d.]+)", text).group(1))
    for name in LIST_SCALAR:
        match = re.search(rf"const {name} = ([\d.]+)", text)
        if match:
            out["scalars"][name] = float(match.group(1))
    for name in LIST_SURFACE:
        match = re.search(rf'const {name} = "([^"]+)"', text)
        if match:
            out["surfaces"][name] = match.group(1)
    with open(path_format, encoding="utf-8") as handle:
        levels = re.search(r"LANE_LEVELS = \[(.*?)\]", handle.read(), re.S).group(1)
    out["levels"] = re.findall(r'"(\w+)"', levels)
    return out


def read_python(path):
    """The contract as the G-Watch report package holds it."""
    with open(path, encoding="utf-8") as handle:
        text = handle.read()
    out = {"inks": [], "surfaces": {}, "scalars": {}, "levels": []}
    block = re.search(r"SCOPE_INKS = \((.*?)\n\)", text, re.S).group(1)
    for row in re.finditer(r"\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)", block):
        out["inks"].append(tuple(int(row.group(i)) for i in (1, 2, 3)))
    neutral = re.search(r"NEUTRAL_INK = \(\s*(\d+),\s*(\d+),\s*(\d+)", text)
    out["neutral"] = tuple(int(neutral.group(i)) for i in (1, 2, 3))
    out["density"] = float(re.search(r"^DENSITY = ([\d.]+)", text, re.M).group(1))
    for name in LIST_SCALAR:
        match = re.search(rf"^{name} = ([\d.]+)", text, re.M)
        if match:
            out["scalars"][name] = float(match.group(1))
    for name in LIST_SURFACE:
        match = re.search(rf'^{name} = "([^"]+)"', text, re.M)
        if match:
            out["surfaces"][name] = match.group(1)
    levels = re.search(r"LANE_LEVELS = \((.*?)\)", text, re.S).group(1)
    out["levels"] = re.findall(r'"(\w+)"', levels)
    return out


def compare(name_a, a, name_b, b):
    """Every value the two sides spell differently."""
    list_problem = []
    for field in ("inks", "neutral", "density", "levels"):
        if a.get(field) != b.get(field):
            list_problem.append(f"{field}: {name_a}={a.get(field)} {name_b}={b.get(field)}")
    for field in ("surfaces", "scalars"):
        for key in sorted(set(a[field]) | set(b[field])):
            if a[field].get(key) != b[field].get(key):
                list_problem.append(
                    f"{field}.{key}: {name_a}={a[field].get(key)} {name_b}={b[field].get(key)}"
                )
    return list_problem


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--gwatch", default=DEFAULT_GWATCH,
                        help="the G-Watch tree holding the report's panel")
    args = parser.parse_args()

    markdown = read_markdown(os.path.join(ROOT, "maintain_docs", "trace_panel_contract.md"))
    typescript = read_typescript(
        os.path.join(ROOT, "components", "trace-panel.tsx"),
        os.path.join(ROOT, "lib", "trace-format.ts"),
    )
    python = read_python(os.path.join(
        args.gwatch, "gwatch", "cuda", "trace", "format", "panel", "_contract.py"))

    list_problem = (compare("doc", markdown, "tsx", typescript)
                    + compare("doc", markdown, "py", python))
    for problem in list_problem:
        print(f"  {problem}")
    nb_value = len(markdown["scalars"]) + len(markdown["surfaces"]) + len(markdown["inks"]) + 3
    print(f"{nb_value} value(s) checked, {len(list_problem)} disagreement(s)")
    return 1 if list_problem else 0


if __name__ == "__main__":
    sys.exit(main())
