# The engine

The video walks through it on Repix itself: https://youtu.be/37cs8OTFdZg

Repix is not built on a UI library. It runs on its own **framework-engine**,
written for it. The shared implementation is `src/ui/engine.js`; Repix's own
interface descriptions are in `src/ui/interface.js`, and its program logic is
in `src/ui/repix.js`. `src/ui/template.html` holds the page, styles and build
placeholders. The build embeds all of them into the single `repix.html`.

There is one canonical `engine.js`, kept in the Repix sources. Other projects
use and extend that same file; their engine improvements are brought back into
it rather than maintained as a divergent fork. This is not a separately
released or supported engine package, and the finished page needs no runtime
file beside it.

Two halves, one model:

- **The framework** says *how an object is written*. Every object is a
  **description** (built by `buildNode`); every argument of a description has
  a **standard** in one table, `STANDARD`; a description names only what
  differs. There are no local rules: nothing is special-cased for one window.
- **The engine** says *how it is carried out*. One law of motion for
  everything, decisions worked out from data, and triggers instead of
  recomputation.

## The model

1. **Everything that moves goes to a goal.** A thing is told where to be; from
   where it is drawn *now* it goes there, frame by frame. A new goal on the way
   just turns it. The hand gives goals too — a finger holds what it drags under
   itself, a bar pulls its scroll by a spring with play.
2. **One law.** A mass on a spring with a damper (`STANDARD.follow`: `ms` —
   the pace, `stiff`, `damping`, `arrive`, `least` — the least speed,
   `fastest`, `gather` — how fast speed is gathered, `brake` — how many times
   faster it is shed). Place, a shelf's height,
   a scroll, opacity, a theme color, the pictures' view — all on this law.
   It speeds up at most by `gather`, brakes at most `brake` times harder and
   starts braking in time to stop on the goal; the spring alone settles the
   last pixels and moves short paths. **In the plane the speed is one arrow**:
   the law works on the distance to the goal (how fast it goes is measured by
   the straight line to it), the speed across that line has no goal of its own
   and is shed by braking, the whole arrow never above `fastest` — so a new
   goal bends the path instead of turning the speed round. **At full speed the
   way is not gone through**: a thing farther from its goal than its braking
   is put on the straight line to the goal where braking would begin, at full
   speed; from there the way is real.
   Something let go with speed **glides**: it loses a share of its speed each
   millisecond and ends where that takes it, never speeding up.
3. **The standard is the engine's; an object differs by arguments.** A new
   feature goes into the engine for every object that may need it, never into
   one window.
4. **Triggers, not recomputation.** A change of the page is an input; its
   consequence is worked out from data before anything is painted. Nothing is
   recomputed every frame, nothing is looked over "just in case".
5. **Thresholds are data.** A layout decision (how many rows the knobs take,
   which labels are shortened, whether a row rolls, whether the stage block
   stands as a column) is a function of the room, worked out from widths
   measured once. Its **band** — the rooms where the same would be decided — is
   worked out from the same data. The edges of a band are given to the
   browser (a media query), and the browser tells when the window crosses
   one: that is the trigger; it lays out that field anew, and the change goes
   smoothly. Inside a band nobody looks at it — a new size of the window by
   itself lays nothing out.
6. **An object is on a leash to its area.** Its place is kept in its parent's
   content; an area that does not change inside moves everything in it with
   itself. On its way a thing whose place is in the window is never drawn past
   the window's edge, and while the window is dragged it lags its goal by at
   most `follow.lag` lines (a turn of its shelf's state is its own way, no lag
   then); what it shows (its children) stays in the window, however wide its
   box. The leash is slack for three quarters of its length and tightens over
   the last quarter by the stretch's law, reaching its end softly. Its way (goal, speed, brake) is untouched; a new
   goal is taken from where it is drawn. The backing (the page's own background) never moves.
7. **The window.** While the window is dragged, things follow it at once —
   except a shelf whose state turns at a threshold (a field folding anew, a
   line of text going down) with all it moves below it, and things that declare
   their own pace after the window (`follow.window`) — with all that lies in
   them.
8. **Pixel style.** Everything is measured in grid pixels (`--unit`): a grid
   pixel is a whole number of screen pixels, chosen by the window's width and
   rounded for the screen's density. The font is a pixel font, icons are
   drawn cell by cell, pictures are drawn without smoothing on whole screen
   pixels, and what comes to rest (a floating window, a placed thing) lands
   on the grid. Motion runs between pixels: the style is pixel, the movement
   is smooth.

## The machinery

| Part | What it does |
|---|---|
| `STANDARD` | every standard in one place: follow, scroll, stretch, line, appear/vanish, tint, view, grid, windowRest, barWidth, wordsKept, knob |
| `approach` | one step of the law, in small sub-steps of at most 4 ms (stable at any pace) |
| `approachPlane` | the law in the plane: on the distance to the goal, the speed one arrow, the leap at full speed |
| ghosts (`goOut`, `behindPrev`, `ghostLayout`, `placeComing`) | what goes out and what comes in: a goal behind the neighbour before it, counted by no one |
| channels (`channel`, `aim`) | a kind of motion is one record: `least`, `args`, `read`, `draw`, `done`; a value is a number or a list of numbers moved along its straight line; `glide` for a let-go |
| `settle(touched)` | turns a change of the page into motion: asks where things stand only in the areas the change could reach (`whoIsAsked`), sets offsets from where things are drawn |
| `smoothly(change)` | a named change: notes where the things that may go to another area (`wanders`) are drawn, makes the change, settles by the page's own records of it |
| the watcher | a `MutationObserver`: every change of the page is an input; shown/hidden is judged over the whole batch |
| goals (`goal`, `stick`, `placeTo`) | a place by what a thing is against: an object, its area, the window; side, gap, align, size, limits; a thing never leaves its area |
| scrolls (`makeScroll`, ways, `makeBar`) | the engine's own scroll: wheel by notches, a bar on a spring with play, a finger under itself, inertia, rubber at the edges; several scrolls can be one way with one bar |
| `packClusters` | the fold of a field for any room, from data; its band |

## Arguments of a description

The layout: `even`, `clip`, `hug`, `fill`, `align` (`'start'`, `'end'`,
`'center'` for every case, or `{rows, bottom}` for text that gives way in rows),
`pinned`. Text sewn at seams gives way by its record in `SINGLES` (`seams`,
`gives`); how it looks broken in rows or moved down is the engine's.
Motion: `follow` (`false` — stands at once; `{ms, stiff, damping, lag, …}` — its
own pace and leash; `{window:{ms}}` — its pace after the window), `fades`, `appear`,
`vanish` (`{withWay:true}` — the fade tied to the way), `wanders` (may be put into another area: it comes from exactly where it
was drawn). Place: `goal` (with `divides` — a line between two neighbours in a row is
where the first of them ends, on its way too), `stick`, `rest` (takes the room the
shelves leave; no shelf itself). Scroll: `scrolls` (`false` — never a
scroll). Shelves: `slides`, `rolls`, `squeezes`, `ribbon`, `strip`, `lodges`.
Knobs: `knob` with its rule — `math`, `outside`, `multiple`, `round`, `forbid`.
`background` — drawn where the layout puts it, never moved or asked.

What a node is (one at most): `win` (a floating window), `areas` (areas with
`divider` lines between them), `buttons` (a row of buttons, its `field`),
`knob`. What it is made of: `tag`, `id_`, `cls`, `text` or `inner` (one),
`onto`, `props`, `page`, `data`. A button (a node or a record of `BUTTONS`):
an action — `click`, `choice` or `link` (one) — and `held`, `off`, `pressed`,
`dims`, `needs`, `hint` (`always`), `calls`, `group`, `hollow`, `icon`,
`label`, `paint`, `place`, `shorter`, `shown`, `still`, `value`. A window of a
picture: `caption`, `canvas`, `label`, `picture` and `captionArgs` (its
motion).

Each argument is described where the engine carries it out; its standard is
in `STANDARD`; on what it stands, its category and what it needs are declared
once in `ARG_SPEC` — that list is the full one.

## Working on it

- **Edit the sources, never `repix.html`** (it is built): shared behavior in
  `src/ui/engine.js`, Repix descriptions in `src/ui/interface.js`, program
  behavior in `src/ui/repix.js`, and markup or styles in `src/ui/template.html`.
  Build with `zig build` in `dev/`.
- **A feature goes into the engine**, with a standard and an argument —
  then used everywhere it fits. Check every place that uses it, not one.
  Bring improvements from other projects back into this same `engine.js`;
  do not let project-specific forks grow apart.
- **No per-frame work, no looking over the page.** Find the trigger; make the
  consequence one action. A threshold is a number worked out from measured
  data, never a band one pixel wide.
- **A scroll bar is a consequence, never an input.** A layout takes its room
  without the bar that stands now; a fold that would scroll pays for its bar
  in that very decision. A shelf whose height is on its way shows no bar: it
  is moving, not scrollable.
- **One edge per decision, the same both ways.** No margin to stop a
  decision going to and fro: if it would, the decision changes its own input —
  fix that input. Two edges for one decision make the layout depend on where
  the window came from.
- **A decision reads the final layout only.** Its neighbours are measured as
  they stand by themselves: without the deciding object in the row and
  unstretched by a shelf drawn on its way. Then the goal is set once, straight
  to the final place, never by stages.
- **The engine knows no node by its name and reads no state back from a
  style.** What a node is to the engine is an argument of its description or
  a mark in its data; a number of the engine's is in `STANDARD`.
- **Nothing is looked over.** A change reaches only its own area, and beyond
  it only while areas come out another size: what stands beside the touched
  node is asked where it stands; if their area changed size, the same one
  level up; an area that kept its size and was not touched is not opened —
  all in it goes with it. What changed is told by the page's records (or by
  the engine itself, when it wrote the change: a bar taking room). Everything
  is asked only when everything moved (a new scale, a layout from scratch).
- **A new size of the window is no reason to ask.** Inside a band it moves
  things at once and by itself: the places the engine keeps are only marked
  old (`placesOld`) and are noted anew once — before the next change
  (`noteAfterWindow`, called by `smoothly`), or when the window has come to
  rest. A step is settled at once only while something is on its way (a
  shelf turning at a threshold). What is still asked at every step: the
  things described as following the window (`follow:{window}`), a thing
  placed by a goal (once a step), and the pictures themselves.
- **Side by side or stacked is a threshold of the room's shape.** The
  browser tells the room's new size; the choice is made from those two
  numbers, once per new size of the window, for the room of the layout that
  size ends in: shelves on their way are counted at the heights they go to,
  and the captions' bar is counted on its own shelf whichever way the
  windows stand now. So the same window gives the same split whichever way
  it came.
- **A field is measured once for a content.** Every object's own width and
  height at every level of shortened labels is the content's, not the
  window's: kept with the content's print (`where._measured`). An edge of a
  band crossed, the fold is worked out from the kept numbers and the page is
  not asked; another content, scale or font (`measuresEpoch`) — measured
  anew. The status line and the captions are asked nothing while what they
  depend on stands (their words, the layout, the width the browser told).
- **A sliding shelf hides by itself as the last step of its round.** Standing
  as low as it can (one row, if it rolls) and still taller than a third of
  the window, it goes under the screen and comes back when the window is
  tall enough. One edge — the window's height at which its lowest height is
  that third — given to the browser like a band's. The hand's word stands
  over it: shown by hand, it stays until the window has room again. It is
  not kept with the settings.
- **A background is no object.** What is described as a background (a
  picture's window) is drawn where the layout puts it: it is not moved, not
  asked where it stands, and no scroll is ever its or of anything in it. An
  area that holds only backgrounds and things placed by goals says
  `scrolls:false` itself (the pictures' room).
- **What a line divides comes back when the line stands.** The windows are
  backgrounds with no box of their own; the line between them is an object
  (the seam side by side, the captions' bar stacked). When the windows turn,
  the pictures go out, the line goes to its new place, and the pictures come
  back only when it has arrived (`whenThere`): a picture is never shown
  ending at a line that is still on its way. Stacked, the bar's own lines are
  the whole seam — no gap of the room beside them.
- **A measure is taken when its input changes, not when its box does.** The
  items' edges in a scrolled row are noted when the row is laid out, and the
  shutters are worked out from them and the scroll's own number; the block
  riding a rolled row is measured when the field is laid out or when the
  browser tells that one of its items or buttons came out another size.
- **What has just appeared is noted, not opened.** A thing shown or put on
  the page by the change had no place: it is asked once where it stands, and
  nothing in it is asked — nothing in it could have moved. What stands in it
  is asked when a change comes into it (that first time it stands; from then
  on it moves). A thing that had a place and was put elsewhere is asked where
  it came to.
- **What comes in stands first behind its neighbour.** A thing shown is first
  placed as if it had been there all along: flat (a group in one row), right
  after the neighbour before it in its flow — behind the divider that would
  bound it, as far as the row reaches. Then, with everyone, it takes the
  layout its coming turns to, by the same law as the rest, fading in on the
  way. Only what stands in an area that is itself coming into view (a window
  opening) has no way of its own.
- **What goes out is a ghost.** A thing hidden leaves the layout at once — for
  everything that asks it is hidden — and goes out itself, no copy. It gets its
  goal like everyone, by the same rule as a thing coming in (flat, after the
  neighbour before it), but it is counted by no one: the others take its room
  and ride through it, the hand passes through it. It goes to that goal by the
  same law and fades on the way; out, it is gone (shown again before that, it
  comes back from where it is drawn, at the speed it has). Ghosts see each
  other: a ghost's goal is after the goal of a ghost before it, never on it.
  Its fade and its way are independent; `vanish:{withWay:true}` ties the fade
  to how much of the way is left. A ghost rides with what holds it (its goal
  is kept against its holder). A divider has no way of its own: it stands on
  the border of its neighbours as they are drawn.
- **A way is drawn on the screen.** A thing that is turned or scaled draws its
  way in its own frame turned back, so the offset on the screen is the one the
  law gave. A picture that only shows a state (the flip button's arrows) turns
  itself, not the thing that moves.
- **One rule of being seen, one point where layout is done.** Whether a thing
  is seen is one test (`seen`), never a property read here and there; what
  must follow a finished layout (the ghosts' goals) is registered in
  `AFTER_LAYOUT` and run once, whichever way the layout was laid. A change that
  would call itself back for ever is cut by `loopGuard` (40 waves a task).
- **Every area is kept by the engine.** What changed in any area — a page of a
  window shown, a list filled — has its even rows evened and its groups
  divided before places are noted; the program only shows and hides. The
  rooms of the fields are watched by the engine itself, and a turn the
  window causes (side by side or stacked) stands at once (`turnedByWindow`).
- **A bar is decided by where its box goes.** When a shelf or a floating
  window starts on its way to a new size, whether it scrolls is asked at the
  size it goes to; the bar comes at once and stays so the whole way.
- **A scroll moved by another stands where it was put.** The page setting it
  (`scrollAt`), or the browser cutting it to a smaller room, ends the way it
  was on — its place and speed were of content that is gone, and it never
  bounces on an edge for it.
- **On its way a thing is not looked at.** Where it is drawn is data (its
  offset and the offsets of the areas it stands in), and so is its leash: the
  box it stands in at its place is noted when it is sent. Its content is read
  once, and only when the leash comes tight. What is still read every frame:
  a thing placed by a goal against another thing that is on its way, and the
  pictures' room while a shelf changes height — there the layout itself
  changes every frame.
- **Measure, don't guess.** Before and after a change of the layout, compare
  where every object stands at several window sizes; they must match unless
  the change means otherwise.
- **A built-in theme is retired, never deleted.** Taking one out of `THEMES`,
  move its colors to `RETIRED_THEMES`: whoever had it on, edited or among the
  favorites keeps it as a theme of their own. Settings live by the page's
  address, not its version, so they outlive every update.
- **Rows by the layout, not by the drawing.** A thing on its way is drawn off
  its place; tell rows apart by where the layout puts it (`laidTop`).
- **Testing in a hidden browser tab lies.** A tab that is not painted runs
  no animation frames and no `ResizeObserver`: call what they would call, in
  the order a real frame does (resize events → animation frames → layout →
  size observers → paint), or force real frames (a screenshot paints).
- **The arguments are declared once; the refusals follow from them.** Each
  argument is declared in `ARG_SPEC` (on what it stands, its category, what it
  needs, its value, the arguments inside it - `SUB_SPEC`). From that alone: a
  word no argument of that kind declares is refused; of one category at most
  one (goal/stick, link/click/choice, text/inner); a kind (win, areas, buttons,
  knob) narrows what may stand beside it; an argument without what it needs is
  refused; a value of the wrong form is refused. Under `?check` every
  description is watched while read: a word the engine reads that is not
  declared is refused too, so the declaration cannot fall behind the code. A
  refusal stops the building and is shown in a red band over the page; the
  whole configuration at once: `python dev/tools/check_args.py` (exit 0 -
  none, 1 - refusals listed). A new argument: one entry in `ARG_SPEC`, nothing else.
