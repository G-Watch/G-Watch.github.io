---
title: Visualize Xtrace for Agent
description: Read a trace as an interactive panel, as compact text for an agent, and hand an agent the exact region you are looking at.
order: 20
---

A trace renders two ways from one report. The **HTML** report is an interactive
panel for people. The **JSON** report is the machine archive, and `gwatch show`
renders it as compact text an agent reads directly.

The two are not alternatives. The point of the panel is that a person can see
the whole kernel at a glance and an agent cannot; the point of the text is that
an agent can compute with the numbers and a person should not have to. What
joins them is a **selection token**: you mark a region in the panel, copy it,
and paste it to the agent, which reads exactly that region through the CLI.

```python
report.render("trace.html")   # the panel and the stats, one self-contained file
report.render("trace.json")   # the records and the pre-computed analysis block
```

## The HTML report

`trace.html` is one file with no network dependency — open it from disk, mail
it, check it into a bug. It has two tabs per traced run.

### Trace

Time across, threads or warps down, one ink per scope. Overlapping phases
composite the way layered inks do, so a crowded row saturates toward its scope's
hue and an idle one stays at paper white.

The vertical axis **refines itself as you zoom**: block, warpgroup, warp,
thread — the finest level whose rows still have room to draw. There is no
control for it, because there is nothing to decide.

| gesture | what it does |
|---|---|
| wheel | pan — vertically through the rows, horizontally along time |
| ⌘/ctrl + wheel | zoom time about the pointer |
| alt + wheel | zoom rows about the pointer |
| double click | reset the view |
| drag the bottom axis | mark a time range |
| drag the left gutter | mark a row range |
| drag the plot | measure along whichever way your hand travels |
| shift + drag the plot | measure time, whichever way your hand travels |
| middle button / alt + drag | pan |
| right click | copy the marked region — see below |

### Stats

Two reads over the same intervals: how long one execution of each region takes
and how much it varies, as log-scale box strips grouped under the warp role that
runs them, and the exact numbers as a table. The axis is logarithmic because a
wait and the work it waits on differ by orders of magnitude.

The scope inks are the panel's, assigned by scope order and never cycled, so a
region keeps its identity across both tabs.

## `gwatch show`

`gwatch show` reads the JSON report and prints pipeline analysis to the
terminal. An agent reads this text directly.

```bash
gwatch show trace.json
```

<img src="/media/iket_agentview.png" alt="Agent view of an intra-kernel trace rendered by gwatch show" style="width:100%;border-radius:12px;border:1px solid var(--color-line)" />

By default it prints the header (kernel, launch, record and row counts, scopes,
clock, time span), the per-scope stats, the pipeline summary, and a per-thread
ASCII timeline with a legend.

Flags select a single view:

```bash
gwatch show trace.json --stats         # per-scope stats only
gwatch show trace.json --bubbles       # pipeline summary + longest bubbles
gwatch show trace.json --timeline      # per-thread ASCII timeline
gwatch show trace.json --concurrency   # active rows over time
gwatch show trace.json --outliers      # straggler rows
gwatch show trace.json --json          # the full analysis, machine-readable
```

Filters compose with any view:

```bash
gwatch show trace.json --block 0-3,5 --stats
gwatch show trace.json --tid '[0,31],[64,95]' --timeline
gwatch show trace.json --stime <t> --etime <t> --bubbles
```

The report carries a **pre-computed analysis block** — paired intervals,
per-scope percentiles, per-row active and bubble, concurrency — and `gwatch
show` reads it. Parsing the JSON and re-deriving those numbers by hand gets them
wrong in ways that look plausible: an `"sm"` clock printed as nanoseconds,
unpaired boundaries counted as intervals, a warp-level run's rows called
threads, a wrapped ring read as an execution count.

## Hand an agent the region you are looking at

Mark a region in the panel — a stretch of time across, a set of rows down — and
**right click**:

- **Copy selection** — the region as one line;
- **Copy as gwatch command** — the same region as a ready command;
- **Clear selection**.

What you copy looks like this:

```
gwtrace/1 kernel=kernel_cutlass_kernel_fl#ef46 t=4365:11462ns lane=block:15-33 order=role scopes=softmax,wait_k_empty
```

It names the kernel by a short tag, the time range counted from the run's first
interval, the rows it holds at the level you were looking at, and the scopes that
appear inside it. Paste it to an agent, which reads back exactly that region:

```bash
gwatch show trace.json --select 'gwtrace/1 ...' --stats
```

```
Selection:     19 block(s) → 171 thread(s)  ·  [4365, 11462] = 7.10 µs
Token scopes:  softmax, wait_k_empty
...
```

Two things make this safe to paste around:

- **It is checked, not guessed.** The kernel tag is computed the same way in the
  browser and in the CLI. A token from a panel over a different kernel is
  refused, with both names, instead of being answered about the wrong region.
- **It is verbatim.** The token's row ids count from the grid, while the
  `--warp` flag counts inside a block; rewriting a token by hand into `--tid` or
  `--warp` is how you end up answering about different rows. Paste it as it came.

### When an agent should ask for one

An agent working from aggregates alone cannot see what you can, so a good one
asks rather than guesses:

> The aggregate says `wait_k_empty` averages 1.2 µs but p95 is 3.2 µs, and the
> totals cannot tell me whether that tail is a few blocks or all of them. Open
> `trace.html`, find where the copy warps go quiet, drag out that region, right
> click → **Copy selection**, and paste it here.

Installing the G-Watch agent skills is what teaches it to ask that way, and to
read the token you paste back through `gwatch show` rather than parsing the
report by hand:

```bash
npx skills add mars-compute-ai/G-Watch -g
```
