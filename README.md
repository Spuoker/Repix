# Repix

You found a piece of pixel art you love, and all the internet has left of it
is a blurry, upscaled JPEG. Repix brings it back: it finds the grid of the original
art and hands you the art at its real size — one cell, one pixel, clean enough
to edit.

**The pixels are still in the file. JPEG only fogged them. Repix develops them.**

Nothing in it jumps or flickers: every button, panel and picture moves to
its place by one law of motion — see [The engine](#the-engine).

**Video:** [I removed every animation from my app. It's never been smoother (GTB Layout)](https://youtu.be/37cs8OTFdZg) — how the engine works, shown on Repix itself.

**From the concept to the first release: nine days.**

<img width="1920" height="1080" alt="Снимок экрана 2026-09-28 174003" src="https://github.com/user-attachments/assets/66da5780-752e-4f3a-9c04-9210fc2d1896" />

## Running it

**In the browser:** open https://spuoker.github.io/Repix/. The browser will
offer to install it as an app, on a phone too, and then it works offline.

**From disk:** download `repix.html` and double-click it. That's it.

Nothing to install, no server, no account, no internet. It is one page of
about 825 KB with everything inside: the computing core (WebAssembly,
~126 KB) and the font. On Android, open the file right from the phone; an
iPhone won't run a saved page, so use the web link there.

## Using it

Drop a picture onto the window, or press **Open**. Repix finds the grid by
itself. If it gets it wrong, turn the knobs — the result follows at once. A
knob's field takes maths too: type `12/3` or `(2+3)*4`. When no knob gets the
cell size right, press **By points** — a ruler: click two grid crossings on one
row or column far apart, say how many cells it spans, and the cell size and origin follow. A PNG with a
transparent background stays transparent, down to the saved result; its
background becomes an empty paint that works as an eraser. **F11** gives a clean
full screen, with no browser bar sliding over the buttons.

What is counted is shown as it is counted. On stage 1 a line in the markup
color goes down the picture: above it the art is new, below it still the old.
On stages 2 and 3 the borders of clusters and paints change with the picture,
and they are drawn at any zoom: lines up close, a tint from afar.
**Auto settings** is dimmed while its settings stand and is there again after
any change. **Motion** in the menu turns all gliding off; the system's
"reduce motion" setting does the same by itself. In a window too low for
both, the knob panel gives way to the pictures: it folds into one row, and
if that is still more than a third of the window, it hides under its tab and
comes back when there is room. Everything the
mouse, keys and fingers can do is listed in **Guide**, in the settings menu
(the gear on the **Repix** plate).

You don't have to think about saving your progress. Close the tab, reload,
let the phone unload the page — Repix opens right where you left it, painting
and undo history included. **Save** gives you the current result as a PNG,
or the whole project — the picture, every knob, the painting and the history —
as a .repix file or kept right in Repix; **Open** takes either back.

And make it yours: **52 themes**, each with an idea behind it, kept by
families — daylight ones, the old machines pixel art was born on, a bar with a
drink each, sodas, warm wood and tea, water and night skies, dark nights with
a story. Heart the ones you like, and the arrows flip through just those. You
can make your own themes too, save them to a file and bring them to another
browser.

## The four stages

The grid first, then three passes that look a little wider each time, then
your hand:

1. **Prepare** — each cell on its own: the grid is found, and every cell gets
   one color from its pixels. Stray pixels are weighed down, neighbouring
   cells help only where they hold the same paint.
2. **Clusters** — neighbouring cells of one paint are joined into clusters
   with one color each; the noise inside them averages out.
3. **Merge** — clusters of the same color anywhere in the work become one
   paint. Size decides: the larger a paint across the work, the harder it
   is to merge away: five hundred cells are the author's, five that differ
   only a little are a leftover.
4. **Paint** — no more algorithms, your turn. Brush, fill and pipette finish
   what did not come together; paints can be copied from any picture, edited, added,
   deleted, and the unused ones cleaned out.

The left window shows any step already passed (keys `1`…`8`: source, grid,
pixels, cluster borders, clusters, paint borders, merged paints, painted
borders); the right window always shows the current stage's result.

The grid is a **map of source areas** from which colors are taken. It does not
shape the output pixel: an art pixel is always square. Moving a grid line by
hand changes *what* goes into a cell, not what the cell looks like.

## Rules the core follows

- **Pass 1 does not reduce colors.** It hands on the truest shade it can,
  noise included: noise averages out in a cluster, a lost intent of the author
  comes back from nowhere. Pass 1 is judged by error against the truth, not by
  the number of colors.
- **Thresholds are built from sources, not tuned per work.** The floor comes
  from 8-bit color, the multiple from the measured noise, the ceiling from
  how close different paints of the work come.
- **A pixel is its color and how much of it is there.** Transparency is data,
  not a guess: a pixel that is not there has no voice in any color, whether a
  cell is there is decided by the rule that decides its color, and a paint
  never merges with nothing. The picture's own transparency noise is measured
  first (a re-saved PNG leaves a little alpha all over its background): a cell
  within that noise of nothing is wholly clear, one within it of whole is
  wholly there, and a part made half there on purpose — glass, a shadow —
  stays as it is.
- **One live source per layer.** Not three variants to pick the best from.
- A threshold tuned on one work means nothing: it is measured on a bench with
  known answers — and then checked by eye.

## How the core works

**One question at three scales.** No threshold in the core is a number picked
by hand. Every decision asks the same thing — is this difference bigger than
this picture's own noise? — and only the scale changes: one cell, its
neighbours, the whole work. Each scale has its own yardstick, measured in the
picture itself. And the smaller a group, the more it is forgiven: a few cells
that differ only a little are a leftover, a few that stand out strongly stay.

**The grid.** Pixel art was drawn cell by cell, so every edge between colors
lies on a lattice: position = origin + k × step. The core collects every color
transition once, with its strength, and scores candidate steps: each
transition gets a phase — where it falls inside the step — and the phases are
added up as arrows. Transitions that agree on one phase give a long sum,
scattered ones cancel out. The true step and its fractions score high, its
multiples do not, so the largest step that still scores high is taken. Then
every line is pulled onto the real transition next to it and the lattice is
fitted by least squares, three rounds. Steps may be fractional. When the
transitions fit no lattice well (a photograph, heavy blur, a neural-net
"pixel" image), the grid is marked uncertain.

**Pass 1 — one cell.** The cell's pixels and a band past its border are taken.
The middle pixel is the anchor; every pixel votes with a weight that falls with
its distance from the anchor in color and from the middle in place. In the
band a neighbour's piece of the same paint counts in full, a piece of another
paint not at all, and the band's voice is capped at a share of the inside's
(by default, as much as the inside). The cell's color is
the weighted mean of four numbers — color times how much of it is there, and
that amount. The yardstick is the tolerance: no less than 8-bit color can
tell apart, a multiple of the noise measured inside this picture's cells, no
more than the closest two different paints of the work. The pass measures the
picture as it goes (noise, blur, how far paints stand apart), and the knobs'
automatic values come from those measurements.
On a grid marked uncertain (a photograph), a detail that fell between cells —
a star off a cell's middle, heard by no cell — goes to the one cell its peak
lies in, with the mean color of its body (not its glow, and not its brightest
pixel). Its strength is measured from the cells' ground, the median of their
pixels, so a star on the corner of four cells is seen alike by all four. It
stands out beyond twice the tolerance, or beyond the noise of its place if that
is higher — read from how neighbouring pixels of the ground differ, so a smooth
glow is no noise and a busy texture is. It must be obvious — eight tolerances
away, or a spot of at least a quarter of a cell — and never a crumb: at least a
sixteenth of the cell, so one pixel does not paint a cell ten pixels wide. On real pixel art every detail holds a
cell of its own,
so there the rule is off: what lies between cells there is compression
ringing.

**Pass 2 — neighbours.** Neighbouring cells are joined into clusters. A
difference of colors is split in two: lightness — the same paint, darker or
lighter — and tone — another paint, each with its own threshold. A cell is
compared with the mean of the group it would join, not with the last cell, so
a paint cannot leak through a bridge of cells, and a group's range from
darkest to lightest is kept in check too, so a ramp cannot slide through step
by step. The yardstick is this picture's own: the median difference between
its neighbouring cells, for lightness and for tone apart. A single cell is
given a wide margin, a group as big as "min paint" one yardstick.

**Pass 3 — the whole work.** Clusters are merged into paints across the whole
work, wherever they lie, largest first: the large ones set the palette, the
small ones join it. A cluster joins the closest paint if it is close enough.
How close depends on weight — the cells of that very color over the whole
work: threshold = max(1, √(min paint / weight) − 1) × the median difference
between this work's cluster colors. "Drift from source" caps how far a color
may move; with a paint limit, a newcomer to a full palette either joins its
closest paint or makes the two most alike ones merge, whichever changes fewer
cells by less.

The source files say the same at the place where each rule is carried out
(`src/core/`).

## The engine

Repix does not sit on a UI library. Its interface runs on an engine of its
own, living inside the same page: **GTB layout — Goal, Trigger, Band.**

- **Goal.** Everything that moves goes to a goal: a button finding its new
  place, a panel rolling into one row, a scroll, a hint appearing, a theme
  color, the pictures' zoom. One law of motion for all of them: a mass on a
  spring with a damper, speeding up and braking within limits. The speed is
  one arrow: a new goal bends the path and keeps the speed; how fast it goes
  is measured by the straight line to the goal. At full speed, farther than
  its braking, it is put on the straight line where braking begins. Let go
  with speed, it glides and slows; pushed past an edge, it stretches and
  springs back. Nothing is animated.
- **Trigger.** Work starts only on a change, and its consequence is worked
  out once, before anything is painted. When nothing changes, nothing runs.
  The engine watches the page itself: whatever is added, shown or hidden is
  laid out and moved in by the same rules. What comes in stands first folded
  behind its neighbour, as if it had been there, and moves into the new
  layout with everyone; what goes out is a ghost — it gets its goal like
  everyone but is counted by no one, the others ride through it, and it fades
  on its way.
- **Band.** The layout changes only at thresholds, and no threshold is
  written by hand. Widths are measured once; from them the engine works out
  the fold for any width and the band of widths where that fold holds.
  The edges of the band are handed to the browser, and the browser tells
  when the window crosses one: that is the trigger. Inside a band a new size
  of the window lays nothing out. A decision reads where things
  will stand in the end, so across several thresholds at once every part
  gets one goal and goes straight there. The same width gives the same layout
  whichever way the window came. A scroll bar is a consequence of the layout,
  never its input.
- **Descriptions and one standard.** Every object is a description; every
  argument has one standard in one table, and a description names only what
  differs. A new ability goes into the engine for everyone, never into one
  window. Every argument is declared once (on what it stands, what it needs,
  its value); an unknown or misplaced one is refused on screen, and one tool
  checks the whole configuration.
- **Pixel style.** Sizes, gaps, frames and shadows are counted in grid
  pixels, and a grid pixel is a whole number of screen pixels, so edges stay
  sharp at 125% or on a phone. The font is a pixel font, the icons are drawn
  cell by cell, the pictures are shown without smoothing, and what comes to
  rest lands on the grid. Motion runs smoothly between the pixels.

The model and the rules for working on it: [`dev/ENGINE.md`](dev/ENGINE.md).

## Building

```sh
cd dev
zig build
```

Needs only [Zig](https://ziglang.org) 0.16. It compiles the core to
WebAssembly, then embeds the shared interface engine, Repix's interface
description and program, the processing pipeline and worker, the core, font
and resources into one page. It puts the result where it belongs:

```
repix.html              the program, in the project root, kept in git
dev/zig-out/Repix.zip   repix.html with README.md, LICENSE and OFL-Tiny5.txt,
                        for a release
dev/zig-out/site/       the web site: the same page as index.html, and what
                        makes it an installable app — its description
                        (manifest), the script that keeps it for work without
                        the network (sw.js) and the app icons
```

Put the contents of `site/` on any web host (GitHub Pages will do). Opened
from there, the browser offers to install Repix: it then opens in a window of
its own, without the browser around it, and works without the network. On an
iPhone this is the only way — "Add to Home Screen" from the site.

Running needs nothing but a browser.

Why embed instead of shipping `core.wasm` next to the page: a page opened from
disk may not read a neighbouring file — browsers forbid it. One file works
everywhere: from disk, from a USB stick, from any web host, on a phone (on an
iPhone — from a web host). The cost is a third on top of the core, ~42 KB of
base64 overhead.

## What is where

The program and the workshop, apart:

```
repix.html              the program; built, never edited by hand
README.md               this description
LICENSE                 GPL-3.0
.gitignore              what git leaves out: build cache, zip, test pictures
dev/                    everything else
  ENGINE.md             the engine (GTB layout): its model, its parts, how to
                        work on it
  build.zig             `zig build`: core -> wasm, page, zip, site
  src/
    core/               Zig, compiled to WebAssembly
      core.zig          the build root
      memory.zig        shared memory: the page asks for blocks, the core bumps a pointer
      grid.zig          grid search: the art's frame, edge profiles, step and origins
      phases.zig        one-pass step search by how well transitions agree on a phase
      pass1.zig         pass 1: image -> cells, measurements, automatic settings
      pass2.zig         pass 2: cells -> clusters
      pass3.zig         pass 3: clusters -> paints across the work, palette
    ui/
      template.html     page markup, styles and placeholders for the build
      engine.js         the canonical shared GTB interface engine; other
                        projects use and extend this same file, not a fork
      interface.js      Repix's interface descriptions and engine arguments
      repix.js          Repix's state, image processing, actions and startup
      pipeline.js       how the page drives the core, as pure functions; the
                        build puts it into the page, the tests import it
      worker.js         the core's own thread: the page sends it jobs and
                        stays alive while it computes
      fonts/            Tiny5, Latin letters (SIL OFL 1.1)
    site/
      manifest.webmanifest  the app's description: name, icons, a window of
                        its own, the images it opens
      sw.js             keeps the site for work without the network
    tools/
      embed.zig         assembles the one-file page from the interface sources,
                        processing code, core, font and licenses
      icons.zig         the app icons of the site, made cell for cell from
                        the page's own small icon
      pack.zig          packs the release zip
  tools/
    check_args.py       runs the built page under `?check` and lists every
                        argument the engine refuses (exit 0 - none, 1 - listed)
  tests/
    bench.html          the test bench, runs the core from the built page
    expected.json       recorded results for the regression test
    lib/                the pipeline adapted to plain images, measures, synthetic art
    data/               your own test pictures (not in the repository)
```

## Tests

The bench tests the core embedded in `repix.html`, the very file that is
released, so run `zig build` first. A browser page may not read
files from disk, so serve the project root with any static server, e.g.

```sh
python -m http.server 8000
```

and open `http://localhost:8000/dev/tests/bench.html`.

The interface's configuration is checked apart: `python dev/tools/check_args.py`
opens the built page in a headless browser and lists every argument the engine
refuses — unknown, not for that kind of object, without what it needs, or of
the wrong form.

- **Regression** needs nothing: five synthetic works, four steps, three kinds
  of damage. Every stage's result is compared with `expected.json`. When a
  change is meant to alter results, press **Record expected** and commit the
  new file.
- **Grid**, **Stages 2–3** and **Real pairs** need pictures with known
  answers. Other people's artworks are not shipped, so put your own into
  `dev/tests/data/`: `pairs.json` lists `{name, source, truth, step}`, sources
  go to `data/sources/`, the hand-made originals to `data/truth/`.
  A hand-made original is the best answer at hand, not a guaranteed truth:
  it may be off by a pixel or a shade, so a small difference from it can be
  its mistake rather than Repix's. Check such cases by eye.

## Compared with

**Pixelera Pixel Art Downscaler** looks for a whole-number factor by
periodicity. On a clean ×6 upscale it is right; at the first JPEG compression
(q=0.95) it falls back to "1×". It does not take fractional steps at all.
Repix holds a step of 6.000 on the same file down to q=0.3.

**pixeldetector** (Astropulse, MIT) — the one inside Aseprite via Retro
Diffusion. It takes peaks of a neighbour-difference profile and the median
distance between them, without searching for the origin. On our real pairs it
found the art size once; Repix finds 26 of 28. The bilateral weight in pass 1
was taken from there and won on both measures.

## Numbers

Grid search on 28 real pairs with hand-made answers: the median step error is
0.015%. The art size is found for 26 of 28.

Pass 1 run over finished art does not change a single cell — a fixed point:
with no overlap even at a wide tolerance, and with overlap at the settings the
program picks itself. Only a tolerance forced wider than the gap between a
work's own shades merges them — which is what a tolerance means.

## License

Repix — Copyright (C) 2026 Spuoker.

Repix is free software: you can redistribute it and/or modify it under the
terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version. It is distributed WITHOUT ANY WARRANTY. See `LICENSE`.

The Tiny5 font embedded in the page is © The Tiny5 Project Authors and stays
under the SIL Open Font License 1.1 — its text is inside repix.html
itself and in `dev/src/ui/fonts/OFL-Tiny5.txt`.
