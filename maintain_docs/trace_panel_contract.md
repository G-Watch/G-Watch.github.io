# The trace panel contract

Two implementations draw the same panel: `components/trace-panel.tsx` on this
site, and the self-contained HTML a G-Watch report renders
(`gwatch/cuda/trace/format/panel/` in the G-Watch tree). They cannot share code
-- a report is one HTML file a browser opens from disk, with no React and no
bundler -- so they share this instead.

Everything below is a value both sides must hold. `tools/check_panel_contract.py`
compares the tables here against both implementations and fails on any drift.
Change a number here first, then in both.

---

## 1. Scope inks

Assigned by scope order and **never cycled**: a filter that hides a scope must
not repaint the survivors. A scope past the palette takes the neutral ink.

| index | rgb | name |
|---|---|---|
| 0 | `13, 132, 166` | teal |
| 1 | `192, 74, 44` | brick |
| 2 | `77, 84, 184` | indigo |
| 3 | `176, 128, 26` | ochre |
| 4 | `0, 121, 90` | pine |
| 5 | `192, 90, 155` | plum |
| 6 | `125, 138, 31` | olive |
| — | `107, 114, 120` | neutral (past the palette) |

The palette is validated for adjacent-pair CVD separation and for >= 3:1
contrast against the film surface. Do not extend it by eye; run the validator.

**Exposure density `0.82`.** Identity lives in the hue, so every scope prints at
the same density. Overlapping intervals composite multiplicatively -- the way
layered inks do -- so a crowded row saturates toward its scope's hue and a
bubble stays at paper white.

## 2. Surfaces

| token | value | what it is |
|---|---|---|
| `FILM` | `#fdfdfd` | the plot surface |
| `GRID` | `rgba(21,24,27,0.06)` | time grid |
| `TICK` | `#6b7278` | axis labels |
| `EDGE` | `rgba(21,24,27,0.16)` | plot border |
| `RULE` | `rgba(21,24,27,0.15)` | between one thread / warp and the next |
| `RAIL` | `rgba(21,24,27,0.13)` | down the stripe an event block sits on |

The measurement layer is the one place colour is allowed: the exposure stays
greyscale and the tools sit on top of it.

| token | value | what it is |
|---|---|---|
| `MARK` | `#0f7d8c` | cursor, selection edges, calipers |
| `MARK_FILL` | `rgba(15,125,140,0.13)` | inside a selection |

## 3. Layout

| token | px | what it is |
|---|---|---|
| `AXIS_H` | 26 | time axis strip along the bottom |
| `AXIS_W` | 54 | lane axis gutter on the left |
| `PAD_TOP` | 8 | above the plot |
| `MIN_ROW_PX` | 2.2 | below this a lane level is too dense to draw |
| `MIN_MARK_PX` | 3 | a marked run thinner than this would vanish |
| `MIN_STRIPE_PX` | 2.5 | below this a stripe is worse than the overlap |
| `MIN_RULE_PX` | 5 | a band shorter than this is all rule and no room |
| `MIN_RAIL_PX` | 6 | likewise for a stripe |
| `DRAG_AXIS_PX` | 5 | travel before a plot drag commits to an axis |
| `GRAB_PX` | 8 | how near an axis press has to be to take an edge |

## 4. Lane levels

`thread`, `warp`, `warpgroup`, `block` -- finest first. A level is usable when
it holds more than one row and strictly fewer rows than the level above it;
`thread` is additionally dropped when the trace was sampled, because a sampled
run cannot honestly claim a per-thread axis.

The level drawn is the **finest usable one whose rows still clear
`MIN_ROW_PX * stripes`** at the current zoom, so zooming in hands each row more
pixels and the axis refines itself. Nothing in the toolbar picks it.

A lane selection stores **the set of lanes**, not a stretch of the axis: the
axis re-sorts under role grouping, and a band of screen would name different
threads afterwards.

## 5. Gestures

| gesture | what it does |
|---|---|
| wheel | pan — vertically through the lanes, horizontally along time |
| cmd / ctrl + wheel | zoom time about the pointer |
| alt + wheel | zoom lanes about the pointer |
| double click | reset the view |
| drag on the bottom axis | select a time range |
| drag on the left gutter | select a lane range |
| drag on either selection's edge | move that edge against its opposite |
| drag on the plot | measure along whichever axis the drag travels |
| shift + drag on the plot | measure time, whichever way the hand travels |
| middle button / alt + drag | pan |
| touch drag on the plot | pan (a finger has no middle button) |
| right click | the selection menu — see §7 |

Zoom factor per wheel unit is `exp(delta * 0.0015)`; a drag on the plot commits
to an axis after `DRAG_AXIS_PX` of travel.

## 6. Readouts

`formatTime(ns, span)` — the unit follows the **span**, so labels across one
axis stay in one unit:

- `span >= 1e6` → milliseconds, 2 decimals at `|ns| >= 1e5`, else 3
- `span >= 1e3` → microseconds, 1 decimal at `|ns| >= 1e2`, else 2
- otherwise → whole nanoseconds

An `"sm"` clock counts an SM's own cycles, not nanoseconds; a panel over that
clock labels `cyc` and never converts.

`niceStep(rough)` — a tick step of 1, 2 or 5 × 10ⁿ, the largest that is not
above `rough`.

A selection reads its span on the selection itself, not in a corner.

## 7. The selection menu

Right click opens it. With a selection it offers, in this order:

1. **Copy selection** — the one-line token of §8, for pasting to an agent.
2. **Copy as command** — the same selection as a ready `gwatch show` command.
3. **Clear selection**.

With no selection it offers "Copy the visible range" alone, which is the same
token over the current view.

`navigator.clipboard` is refused on a `file://` page, which is how a report is
opened, so the copy falls back to a hidden textarea and `document.execCommand`.

## 8. The selection token

One line, `key=value` separated by spaces, so a chat client cannot break it
across lines. Order is fixed so two tokens over the same region compare equal.

```
gwtrace/1 kernel=<short>#<hash4> t=<t0>:<t1><unit> lane=<level>:<ranges> order=<thread|role> scopes=<a,b,c>
```

| key | meaning |
|---|---|
| `kernel` | the kernel's leading identifier plus a 4-hex digest of its full mangled name — the full name is hundreds of characters |
| `t` | the time range, in the clock's own unit (`ns` or `cyc`), rounded to whole units and **counted from the run's first interval** — the panel rebases time to zero, and a token that carried a raw `%globaltimer` value would read as an 18-digit number nobody can check |
| `lane` | the level the panel was showing, and **the ids it holds** as `0-3,12,20-23` |
| `order` | `thread` or `role` — how the axis was sorted when the reader drew the band, which reproduces the view but is not needed to read the token |
| `scopes` | the scopes that appear inside the region, comma separated; omitted when none do |

The lane ids are listed, not given as one low-to-high range, because under role
grouping a band of screen holds rows that are scattered in id space. Listing
them means the token says what was selected however the axis was sorted.

No key names the report. The panel is inside one HTML file and the token is
read against a JSON report the reader names on the command line; a panel
guessing that file from its own path would be guessing. `kernel` is what ties
the two together: `gwatch show <report> --select '<token>'` refuses a token
whose kernel is not the report's, rather than answering about the wrong one.
