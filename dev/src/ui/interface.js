// SPDX-License-Identifier: GPL-3.0-or-later
/* REPIX INTERFACE — the description of this program's interface.
   Shelves, windows, controls, stages, themes and their engine arguments.
   The shared engine lives in engine.js. */

/* ===================== SHELVES =====================
   What one sees are shelves, one above another. The engine is told which
   follows which and what stands on each; it builds them itself. Nothing is
   left in the HTML markup.

   A shelf knows its name, its tag and its content. The content is the same
   kind of list: a node is described by WHAT it is, not how to lay it out.  */
/* THE WINDOWS' ARRANGEMENT as it will be after pressing: two windows one
   above the other — turned a quarter, two side by side. Drawn in cells,
   like the gear. */
const ICON_TO_STACK =
  '<svg viewBox="0 0 7 7" aria-hidden="true">'+
  '<path d="M0 0h7v1H0zM0 1h1v1H0zM6 1h1v1H6zM0 2h7v1H0zM0 4h7v1H0zM0 5h1v1H0zM6 5h1v1H6zM0 6h7v1H0z"/></svg>';
/* Lock closed — the color is derived from the body; open — your own color
   stands. The shackle tells them apart: seated in the body when closed,
   raised when open. */
const LOCK_CLOSED =
  '<svg viewBox="0 0 7 7" aria-hidden="true">'+
  '<path d="M2 0h3v1H2zM1 1h1v2H1zM5 1h1v2H5zM0 3h7v4H0z"/></svg>';
const LOCK_OPEN =
  '<svg viewBox="0 0 7 7" aria-hidden="true">'+
  '<path d="M2 0h3v1H2zM1 1h1v2H1zM5 1h1v1H5zM0 3h7v4H0z"/></svg>';

/* The close cross is drawn in cells too, for the same reason. */
const ICON_CROSS =
  '<svg viewBox="0 0 5 5" aria-hidden="true">'+
  '<path d="M0 0h1v1H0zM1 1h1v1H1zM2 2h1v1H2zM3 3h1v1H3zM4 4h1v1H4z'+
          'M4 0h1v1H4zM3 1h1v1H3zM1 3h1v1H1zM0 4h1v1H0z"/></svg>';

/* A floppy disk — saving to disk: the cut corner, the shutter slot, the label. */
const ICON_DISK =
  '<svg viewBox="0 0 7 7" aria-hidden="true">'+
  '<path d="M0 0h6v1H0zM0 1h4v1H0zM5 1h2v1H5zM0 2h7v2H0zM0 4h1v2H0zM6 4h1v2H6zM0 6h7v1H0z"/></svg>';
/* A box to tick: empty, and with a mark in the middle. */
const ICON_BOX_OFF =
  '<svg viewBox="0 0 7 7" aria-hidden="true"><path d="M0 0h7v1H0zM0 6h7v1H0zM0 1h1v5H0zM6 1h1v5H6z"/></svg>';
const ICON_BOX_ON =
  '<svg viewBox="0 0 7 7" aria-hidden="true"><path d="M0 0h7v1H0zM0 6h7v1H0zM0 1h1v5H0zM6 1h1v5H6zM2 2h3v3H2z"/></svg>';
/* A heart, seven cells wide: a favorite theme. */
const ICON_HEART =
  '<svg viewBox="0 0 7 7" aria-hidden="true">'+
  '<path d="M1 0h2v1H1zM4 0h2v1H4zM0 1h7v2H0zM1 3h5v1H1zM2 4h3v1H2zM3 5h1v1H3z"/></svg>';
/* The plus, seven cells wide like the locks. */
const ICON_PLUS =
  '<svg viewBox="0 0 7 7" aria-hidden="true"><path d="M3 0h1v7H3zM0 3h7v1H0z"/></svg>';

/* The pipette is drawn in cells — no system icon next to Tiny5. */
const ICON_PIPETTE =
  '<svg viewBox="0 0 7 7" aria-hidden="true">'+
  '<path d="M4 0h3v3H6v1H5v1H4v1H1v-1H0V5h1V4h1V3h1V2h1V1h-1zM4 2v1h1V2z"/></svg>';

/* A warning: a triangle with the exclamation mark cut out of it, drawn in
   cells like everything else — the font has no such glyph. */
const ICON_WARNING =
  '<svg viewBox="0 0 7 7" aria-hidden="true">'+
  '<path d="M3 0h1v1H3zM2 1h3v1H2zM2 2h1v1H2zM4 2h1v1H4zM1 3h2v1H1zM4 3h2v1H4z'+
          'M1 4h5v1H1zM0 5h3v1H0zM4 5h3v1H4zM0 6h7v1H0z"/></svg>';

/* Undo and redo: an arrow that turns back on itself, and its mirror. */
const ICON_UNDO =
  '<svg viewBox="0 0 7 7" aria-hidden="true">'+
  '<path d="M2 0h1v1H2zM1 1h2v1H1zM0 2h6v1H0zM1 3h2v1H1zM6 3h1v3H6zM2 4h1v1H2zM3 6h3v1H3z"/></svg>';
const ICON_REDO =
  '<svg viewBox="0 0 7 7" aria-hidden="true">'+
  '<path d="M4 0h1v1H4zM4 1h2v1H4zM1 2h6v1H1zM4 3h2v1H4zM0 3h1v3H0zM4 4h1v1H4zM1 6h3v1H1z"/></svg>';

/* The grip of a sliding shelf: which way it goes on a tap. */
const ICON_SLIDE_DOWN =
  '<svg viewBox="0 0 5 3" aria-hidden="true">'+
  '<path d="M0 0h1v1H0zM4 0h1v1H4zM1 1h1v1H1zM3 1h1v1H3zM2 2h1v1H2z"/></svg>';
const ICON_SLIDE_UP =
  '<svg viewBox="0 0 5 3" aria-hidden="true">'+
  '<path d="M2 0h1v1H2zM1 1h1v1H1zM3 1h1v1H3zM0 2h1v1H0zM4 2h1v1H4z"/></svg>';

const ICON_GEAR =
  '<svg viewBox="0 0 7 7" aria-hidden="true"><path d="M2 0h1v1h1V0h1v1h1v1h1v1H6v1h1v1H6v1H5v1H4V6H3v1H2V6H1V5H0V4h1V3H0V2h1V1h1zM3 3v1h1V3z"/></svg>';

/* A THEME'S NAME is at most this long: the theme button holds sixty cells of
   text, and the widest letters take six — ten of any letters always show
   whole, with no ellipsis. */
const THEME_NAME_MAX=10;

const SHELVES=[
  {id_:'header_', tag:'header', onto:[
    // The gear is drawn, not typed: the pixel font has none, and a system icon
    // next to Tiny5 looks like a guest from another world.
    // The engine later moves this node into the "file" group — see INCOMING.
    {tag:'button', id_:'name', inner:'Repix'+ICON_GEAR},
    {tag:'input',  id_:'file', props:{type:'file', accept:'image/*,.repix', hidden:true}},
    // The field of groups, like the knob field below: a section is this field
    // plus singles, and it is the field that folds, squeezes and scrolls.
    {buttons:'header_', field:'headerField'},
    // Its words change quietly; at a threshold of the window it moves fast,
    // not at once.
    {tag:'div',  id_:'status', text:'starting…', follow:{window:{ms:20}},
     align:{rows:'end', bottom:'start'}},
  ]},

  // The captions of the windows: ONE bar, with the flip button between them —
  // over both windows standing side by side, between them stacked. It moves
  // whole, as one object (see stitchCaptions).
  {tag:'div', id_:'captionsShelf', onto:[{areas:'captionsTop', divider:()=>FLIP, wanders:true}]},
  // The seam FADES (its colour, not the windows) when the windows turn.
  // THE PICTURES' ROOM NEVER SCROLLS (scrolls:false): it holds pictures and
  // what the engine draws over them, not a text or a list — whatever stands
  // past its edge for a moment (the seam on its way) is no reason for a scroll.
  {id_:'stages', tag:'div', fades:'--seamAlpha', rest:true, scrolls:false, onto:[
    // The windows are the BACKGROUND of the pictures: they stand where the
    // layout puts them, drawn as a background, not moved as objects.
    // Their captions go after the window three times the standard pace.
    {win:{caption:'ww0', canvas:'xx0', label:'source', background:true, captionArgs:{follow:{window:{ms:20}}}}},
    // THE SEAM of the windows side by side: a line that starts where it
    // touches the captions' bar and fills down to the end of the windows —
    // it goes with the bar, never ahead of it.
    {tag:'i', id_:'seamLine', follow:false,
     goal:{rel:'#captionsTop', side:'downward', gap:0, align:{x:'#flipSplit'}, size:{w:1, h:'fill'}, divides:true}},
    {win:{caption:'ww2', canvas:'xx2', label:'pixels', background:true, captionArgs:{follow:{window:{ms:20}}}}},
  ]},

  /* The palette: a strip that lodges in the footer when the footer has no
     knobs (stage 4). */
  {id_:'palette', props:{hidden:true},
   strip:{leave:()=>lightPaint(-1)},
   lodges:{into:'#knobs', field:'#knobsField', items:'.knob'}},

  // The footer SLIDES: its grip hides it under the screen or brings it back.
  {id_:'knobs', tag:'footer', slides:{items:'.knob',
     hint:['Panel', 'Each press takes the next: all the knobs in view, then one row that scrolls sideways a whole knob at a time, then the panel hidden, then all in view again. Pull the tab down or up to step that way.']},
   // ...and ROLLS: its knobs fold into rows, or stand in one row that scrolls.
   rolls:{field:'#knobsField', items:'.knob'},
   onto:[
    {tag:'div', id_:'knobsField'},
    /* The stage block is an OBJECT that stands among the knobs: undo and redo
       as one piece on top — a phone has no Ctrl+Z — and under them one row
       of the stage buttons — back, where we are, forward. */
    /* In ONE ROW (the shelf rolls) the block is as tall as the row and as
       wide as undo and redo; what does not fit is SQUEEZED OUT below, in
       this order, and the block scrolls down to it. */
    {tag:'div', id_:'stageBlock', even:true, squeezes:['#whereWeAre'], ribbon:true, onto:[
      {tag:'div', cls:'knob history', onto:[
        {buttons:'history'},
      ]},
      {tag:'div', cls:'knob move', onto:[
        {buttons:'footer'},
      ]},
    ]},
  ]},
];
/* FLOATING ENTITIES — the settings window, the hint, the drop invitation.
   They are not tied to the section grid: they stand where they were called
   (settings under the plate, a hint next to what is hovered) and have no say
   in a section's wrapping, dividers or shortening.

   Inside, a floating entity has its own SECTIONS with groups, living by its
   rules — but the engine still carries them out: its buttons are the same
   objects with the same labels, dimming and shortening.

   They are built last, above everything else, and overlap by layers that go
   in pairs: an entity and its hints (see --layer* in the style). */
const FLOATING=[
  {tag:'div', id_:'toss', text:'drop an image here'},
  // The menu, and above it the color picker, because the menu calls it.
  /* THE MENU is a window of PAGES: every group names the page it belongs to,
     and the engine shows one page at a time (see PAGES). */
  // ASKING FIRST (askFirst): a window of its own, by the button that asked.
  {tag:'div', id_:'askWin', props:{hidden:true}, onto:[
    {tag:'h2', id_:'askTitle'},
    {tag:'p', id_:'askText'},
    {tag:'div', cls:'buttonRow', even:true, onto:[
      {tag:'button', id_:'askYes', props:{type:'button'}},
      {tag:'button', id_:'askNo', text:'Cancel', props:{type:'button'}},
    ]},
  ]},
  /* OPEN AND SAVE: a window of its own by the button that called it. Save
     offers the picture, the project as a file, or the project kept in Repix;
     Open — a file (a picture or a project) or one of the kept projects. */
  {tag:'div', id_:'fileWin', props:{hidden:true}, onto:[
    {tag:'h2', id_:'fileTitle'},
    {tag:'div', id_:'saveChoices', cls:'buttonRow', even:true, onto:[
      {tag:'button', id_:'saveArt', text:'Picture', props:{type:'button'}},
      {tag:'button', id_:'saveFile', text:'Project file', props:{type:'button'}},
      {tag:'button', id_:'saveInto', text:'Into Repix', props:{type:'button'}},
    ]},
    {tag:'div', id_:'openChoices', onto:[
      {tag:'div', cls:'buttonRow', even:true, onto:[
        {tag:'button', id_:'openFromFile', text:'From file', props:{type:'button'}},
      ]},
      {tag:'div', cls:'projList', id_:'projList'},
    ]},
  ]},
  {tag:'div', id_:'settings', props:{hidden:true}, onto:[
    {tag:'div', id_:'pageTop', pinned:'top', props:{hidden:true}, onto:[
      {tag:'h2', id_:'pageTitle', clip:true},
      // On a theme's page: the heart that makes it a favorite.
      {tag:'button', id_:'themeFav', cls:'bare', inner:ICON_HEART, props:{type:'button', hidden:true}},
      {tag:'button', id_:'pageBack', cls:'iconButton cross', inner:ICON_CROSS, props:{type:'button'}},
    ]},
    {tag:'div', cls:'group', page:'main', onto:[
      {tag:'h2', text:'Left window cycles'},
      {tag:'div', id_:'stepList'},
    ]},
    {tag:'div', cls:'group', page:'main', onto:[
      {tag:'h2', text:'Interface size'},
      {tag:'div', id_:'sizes', even:true},
    ]},
    {tag:'div', cls:'group', page:'main', onto:[
      {tag:'h2', text:'Spacing'},
      {tag:'div', id_:'spacings', even:true},
    ]},
    {tag:'div', cls:'group', page:'main', onto:[
      {tag:'h2', text:'Undo steps'},
      {tag:'div', id_:'undoSteps'},
    ]},
    {tag:'div', cls:'group', page:'main', onto:[
      {tag:'div', cls:'groupHead', onto:[
        {tag:'h2', text:'Theme'},
        {tag:'span', onto:[
          {tag:'button', id_:'themeFavs', cls:'bare', inner:ICON_HEART, props:{type:'button'}},
          {tag:'button', id_:'themeSave', cls:'bare', inner:ICON_DISK, props:{type:'button'}},
          {tag:'button', id_:'themeAdd', cls:'bare', inner:ICON_PLUS, props:{type:'button'}},
        ]},
      ]},
      {tag:'div', id_:'themes'},
    ]},
    // A THEME'S PAGE: its colors, and what can be done with it.
    {tag:'div', cls:'group', page:'theme', onto:[
      {tag:'h2', text:'Colors'},
      // Three columns in one grid: label, room for a button, swatch. The swatch
      // column must be last, or it stops being a column.
      {tag:'div', cls:'colors', onto:[
        {tag:'label', text:'Body color',   props:{htmlFor:'bodyColor'}},
        {tag:'span'},
        {tag:'button', id_:'bodyColor', cls:'sample'},
        {tag:'label', text:'Accent color', props:{htmlFor:'accentColor'}},
        {tag:'span'},
        {tag:'button', id_:'accentColor', cls:'sample'},
        // What the work lies on is a separate color: it neighbours foreign
        // paints and is chosen for the work, not for the buttons.
        {tag:'label', text:'Canvas color', props:{htmlFor:'canvasColor'}},
        {tag:'span'},
        {tag:'button', id_:'canvasColor', cls:'sample'},
        // Buttons are neither background nor accent: they are always visible and
        // get their own tone. The bevel's light and shadow derive from it.
        {tag:'label', text:'Button color', props:{htmlFor:'buttonsColor'}},
        {tag:'button', id_:'buttonsLock', cls:'bare lock', props:{type:'button'}},
        {tag:'button', id_:'buttonsColor', cls:'sample'},
        // Text: the quiet shade of labels and the status line derives from it too.
        {tag:'label', text:'Text color', props:{htmlFor:'textColor'}},
        {tag:'button', id_:'textLock', cls:'bare lock', props:{type:'button'}},
        {tag:'button', id_:'textColor', cls:'sample'},
        // Markup comes last: it is the only color that lies on the work, not on the
        // interface, and the only one with its own automatic choice.
        {tag:'label', text:'Markup color', props:{htmlFor:'markupColor'}},
        // The same lock: closed — the color is picked from the work, open — your own.
        {tag:'button', id_:'btnAutoColor', cls:'bare lock', props:{type:'button'}},
        {tag:'button', id_:'markupColor', cls:'sample'},
      ]},
    ]},
    {tag:'div', cls:'group buttonRow', even:true, page:'theme', onto:[
      {tag:'button', id_:'btnReset', text:'Reset', props:{type:'button'}},
    ]},
    // Only for a theme of your own: the built-in ones stay as they are.
    {tag:'div', cls:'group buttonRow', even:true, id_:'ownThemeRow', page:'theme', onto:[
      {tag:'button', id_:'themeRename', text:'Rename', props:{type:'button'}},
      {tag:'button', id_:'themeDelete', text:'Delete', props:{type:'button'}},
    ]},
    // The way out of editing: keep what was changed, or put it all back.
    {tag:'div', cls:'group buttonRow', even:true, page:'theme', onto:[
      {tag:'button', id_:'themeApply', text:'Apply', props:{type:'button'}},
      {tag:'button', id_:'themeCancel', text:'Cancel', props:{type:'button'}},
    ]},
    // A NEW THEME: from the colors in force, or from a file.
    {tag:'div', cls:'group', page:'newTheme', onto:[
      {tag:'p', cls:'complaint', id_:'loadComplaint'},
      {tag:'div', cls:'buttonRow', even:true, onto:[
        {tag:'button', id_:'themeFork', text:'Fork theme', props:{type:'button'}},
        {tag:'button', id_:'themeLoad', text:'Load theme', props:{type:'button'}},
      ]},
    ]},
    {tag:'div', cls:'group buttonRow', even:true, page:'newTheme', onto:[
      {tag:'button', id_:'newCancel', text:'Cancel', props:{type:'button'}},
    ]},
    {tag:'input', id_:'themeFile', props:{type:'file', accept:'.json,application/json', hidden:true}},
    // SAVING TO DISK: your themes to tick, and the button pinned below.
    {tag:'div', cls:'group', page:'save', onto:[
      {tag:'p', cls:'complaint', id_:'saveComplaint'},
      {tag:'div', cls:'pickList', id_:'savePick'},
    ]},
    {tag:'div', cls:'group buttonRow', even:true, pinned:'bottom', page:'save', onto:[
      {tag:'button', id_:'saveToDisk', text:'Save to disk', props:{type:'button'}},
      {tag:'button', id_:'saveCancel', text:'Cancel', props:{type:'button'}},
    ]},
    // ASKING BEFORE what cannot be taken back: the question, then yes or no.
    {tag:'div', cls:'group', page:'confirm', onto:[
      {tag:'p', id_:'confirmText'},
      {tag:'div', cls:'buttonRow', even:true, onto:[
        {tag:'button', id_:'confirmYes', props:{type:'button'}},
        {tag:'button', id_:'confirmNo', text:'Cancel', props:{type:'button'}},
      ]},
    ]},
    // NAMING: a theme being forked, loaded or renamed gets its name here.
    {tag:'div', cls:'group', page:'name', onto:[
      {tag:'input', id_:'themeNameField', props:{type:'text', maxLength:THEME_NAME_MAX, spellcheck:false}},
      {tag:'p', cls:'complaint', id_:'nameComplaint'},
      {tag:'div', cls:'buttonRow', even:true, onto:[
        {tag:'button', id_:'nameSave', text:'Save', props:{type:'button'}},
        {tag:'button', id_:'nameCancel', text:'Cancel', props:{type:'button'}},
      ]},
    ]},
    // The guide: its rows come from GUIDE.
    {tag:'div', id_:'guide', cls:'group', page:'guide'},
    {tag:'div', cls:'group buttonRow', even:true, page:'main', onto:[
      // Not about colors but about how the program talks, and what it can do.
      {tag:'button', id_:'btnHints', text:'Hints', props:{type:'button'}},
      {tag:'button', id_:'btnMotion', text:'Motion', props:{type:'button'}},
      {tag:'button', id_:'btnGuide', text:'Guide', props:{type:'button'}},
    ]},
  ]},
  // The engine fills in the cells: hundreds of cells in markup would be
  // hundreds of lines nobody reads.
  {tag:'div', id_:'colorPicker', props:{hidden:true}},
  // The hint comes last: it explains what the cursor is on and must never go
  // under the window that called it.
  {tag:'div', id_:'hint'},
];
/* THE GUIDE — everything done by hand, in one list: a section and pairs of
   "what to press — what happens". */
const GUIDE=[
  ['Pictures', [
    ['Drag', 'move the picture'],
    ['Right drag', 'moves the picture too — also on stage 4, where the left button paints'],
    ['Wheel', 'zoom in or out at the cursor'],
    ['Double click', 'zoom in twice at that spot'],
    ['Two fingers', 'pinch to zoom, slide to move'],
    ['F11', 'a clean full screen, with no browser bar over the buttons'],
    ['1 … 8', 'what the left window shows: 1 source, 2 grid, 3 pixels, 4 cluster borders, 5 clusters, 6 paint borders, 7 merged paints, 8 painted borders'],
    ['0', 'back to the markup of the stage you are on'],
    ['Show', 'the left window steps through the pictures chosen for this stage in the settings'],
    ['The button between the captions', 'the two windows side by side or one above the other'],
  ]],
  ['Grid lines', [
    ['Edit lines', 'turns line editing on — stage 1, left window, grid shown'],
    ['Drag a line', 'move that one line'],
    ['Double click a line', 'put that line back where it was found'],
    ['Right drag', 'move the whole grid'],
    ['By points', 'a ruler: click two grid crossings on one row or column far apart, then set "cells between": the cell size and the origin follow'],
    ['Find grid again', 'find the grid from scratch and drop every fix'],
  ]],
  ['Knobs', [
    ['Drag the slider', 'change the value'],
    ['Type a number, Enter', 'set it exactly; maths is counted: 12/3, (2+3)*4'],
    ['Arrow up, arrow down in a field', 'one step more or less'],
    ['Fine', 'shows the fine knobs of stage 1'],
    ['Auto settings', 'let the program pick the knobs of this stage; dimmed while they stand, there again after any change'],
    ['The tab above the panel', 'each press takes the next: all the knobs in view, one row, the panel hidden; pulled down or up, it steps that way'],
  ]],
  ['Painting — stage 4, right window', [
    ['Click, drag', 'paint with the chosen tool; the cell under the cursor shows what will happen'],
    ['Click the pressed tool', 'put it down: with no tool the mouse only moves the picture'],
    ['Brush', 'paints every cell along the stroke'],
    ['Fill', 'repaints the whole patch of one paint'],
    ['Picker', 'takes the paint you click'],
    ['Alt + click', 'take the paint under the cursor with any tool'],
    ['Click a paint in the ribbon', 'take that paint'],
    ['Double click a paint', 'change its color — everywhere it lies'],
    ['Delete, Del', 'remove the paint in hand: its cells take the closest paint that stays'],
    ['+ at the end of the strip', 'add a new paint and pick its color'],
    ['Clean', 'remove the paints that lie in no cell of the picture'],
    ['Picker on either window', 'copy the color you click, from any picture; painting with it adds it to the palette'],
    ['Mouse on a paint in the ribbon', 'its cells light up on the picture'],
    ['Mouse on the picture', 'the paint under it lights up in the ribbon'],
    ['Wheel, swipe on the ribbon', 'scroll through the paints'],
  ]],
  ['Undo', [
    ['Ctrl + Z', 'undo: the last stroke on stage 4, the last change of knobs or lines elsewhere'],
    ['Ctrl + Y, Ctrl + Shift + Z', 'redo — what you undid stays in reach even after a new change'],
    ['Undo steps', 'how many steps are kept, in the settings menu'],
  ]],
  ['Explanations', [
    ['Hold the mouse on a thing', 'its explanation comes up'],
    ['Hold a finger on a thing', 'the same on a touch screen; that touch does not press it'],
    ['i', 'explains always, even with Hints off'],
  ]],
  ['Files and menus', [
    ['Open, or drop a file', 'a picture, a project file, or a project kept in Repix — dropping works anywhere on the window'],
    ['Save', 'the result as a PNG, the whole project as a file, or the project into Repix'],
    ['Repix', 'opens this menu; it closes by Repix again, a click anywhere outside, or Esc'],
    ['Motion', 'in the menu: off — nothing glides, everything stands in its place at once'],
    ['Hints', 'in the menu: off — explanations no longer come by themselves'],
    ['Arrows by the theme name', 'the next and the previous theme — only the favorites while the heart beside them is lit'],
    ['Heart on a theme\'s page', 'marks the theme as a favorite'],
    ['Disk by the theme name', 'saves themes of your own to a file'],
    ['Interface size', 'in the menu: how large everything is drawn'],
    ['Theme name', 'opens the theme: its colors, Reset and saving to a file; renaming and deleting for a theme of your own'],
    ['+ by Theme', 'a new theme of your own: fork the one in force, or load a theme file'],
    ['Color swatch', 'opens the color window; drag its title to move it, the pipette takes a color from the screen'],
  ]],
];
/* LICENSES — a button in the guide for each: its label, the title while it is
   read, where the text is — an element in this file or a web address — and
   what it means in two lines. The GPL is linked, as is customary; the font
   license is small and travels inside the page. */
const LICENSES=[
  ['Repix — GPL 3.0', 'GNU General Public License 3.0', 'https://www.gnu.org/licenses/gpl-3.0.html',
   'Repix is © 2026 Spuoker and free software: use it, study it, change it, give it away. A changed copy that is given away goes with its source, under the same license. No warranty of any kind.<br><br>Press to open the full text on gnu.org.'],
  ['Tiny5 font — OFL 1.1', 'SIL Open Font License 1.1', 'textOFL',
   'The Tiny5 font is © The Tiny5 Project Authors: free to use, change and embed, but not to be sold on its own.<br><br>Press to read the full text.'],
];
/* HINTS — the explanations of what is not a button record or a knob (those
   carry their own): the settings menu, the color window, the guide, the
   strip. Every control has an explanation: an icon alone says nothing. It
   speaks of the RESULT — what changes on screen — not of how it works
   inside. An entry is [title, text], or a function giving it when the text
   holds numbers of the moment. */
const HINTS={
  flipSplit:['Windows: side by side or stacked',
    'Puts the two windows side by side or one above the other; the drawing shows what you will get.<br><br>The program itself picks the arrangement that shows the work larger. The button overrides it only until the program would pick the same by itself — after the window is resized or another work is opened it decides again.'],
  settings:['Settings',
    'Opens the settings: the colors of the program, ready-made themes, how large everything is drawn, and which pictures the show button walks through.<br><br>Everything chosen there is remembered and comes back the next time the program is opened.'],
  tone:['Tone',
    'Runs through all the tones in a circle: red, orange, yellow, green, blue, violet and back to red.<br><br>It chooses the KIND of color. How pale or how dark it will be is chosen below, in the field.'],
  colorField:['The color field',
    'Every shade of the chosen tone at once: to the right the color gets stronger, to the left it fades into grey; downwards it darkens, upwards it lightens towards white.<br><br>Click anywhere in it to take that shade.'],
  screenPipette:['Pick from the screen',
      'Takes a color from anywhere you can see: from the artwork itself, from another program, from a photo lying open beside it.<br><br>Click here, then click the spot whose color you want.'],
  windowPipette:['Pick from the picture',
      'Takes a color from the windows of Repix: press it, then touch the spot in either window whose color you want.<br><br>This browser cannot take colors from the rest of the screen, so the picture here is where they come from.'],
  closePicker:['Close the picker',
    'Closes this little window. The color you have already taken stays as it is.<br><br>The window can also be dragged by this top strip, if it covers something you need to see.'],
  pageBack:['Back',
      'Back to the page you came from: from a license text to the guide, from the guide or a theme to the settings. The whole menu closes by Repix, a click outside it, or Esc.'],
  themes:['Themes',
    'Ready-made sets of every color at once: the body, the buttons, the letters, the backing under the artwork. The arrows flip through them, and the whole program changes in one step.<br><br>Press the name to open the theme: its colors and Reset — and for a theme of your own, renaming and deleting it.'],
  themeAdd:['New theme',
    'A theme of your own, at the end of the list: fork the one in force with its colors as they are now, or load one from a file someone gave you.'],
  themeFork:['Fork theme',
    'Keeps every color in force now — the body, the buttons, the letters, the backing, the markup — as a new theme of your own. Name it and save.'],
  themeLoad:['Load theme',
    'Opens a file of themes saved by Repix — yours from another browser, or someone else\'s. A single theme is named first: its own name is offered. Several themes are added at once, each under its own name, or with a number if the name is taken.'],
  themeFav:['Favorite',
    'Marks this theme as a favorite: the heart lights up. Press it again to take the mark off.<br><br>The heart beside the disk in the settings then makes the arrows flip through your favorites only.'],
  themeFavs:['Favorites only',
    'Lit — the arrows flip through your favorite themes only; out — through all of them.<br><br>A theme becomes a favorite by the heart on its own page: press the theme\'s name to open it.'],
  themeSave:['Save themes to disk',
    'Your own themes, to tick and save in one file — to carry them to another browser or computer, or to give them away. Load the file there with the plus.'],
  saveToDisk:['Save to disk', 'Saves the ticked themes in one file.'],
  savePickName:['Show this theme', 'Tries the theme on while you choose. It is not kept: leaving this page puts your theme back.'],
  savePickBox:['Save it or not', 'Ticked themes go into the file.'],
  saveArt:['Picture', 'The art as a PNG at its native resolution: one grid cell — one pixel of the file. The name is made from the size, for example art_111x111.png.'],
  saveFile:['Project file', 'The whole work in one .repix file: the picture you opened, every knob and line fix, the stage, the view, the painting and both histories. Open it in Repix anywhere and it stands as it stood.'],
  saveInto:['Into Repix', 'Keeps the project here, in this browser, to be opened again with Open. Saving the same work again updates the kept copy. It lives as long as the browser keeps the site\'s data.'],
  openFromFile:['From file', 'An image to start a new work from, or a .repix project file.'],
  projOpen:['Open this project', 'It stands as it was saved: the picture, the knobs, the stage, the painting and the histories.'],
  projDelete:['Delete', 'Removes the project from Repix. Files saved to your computer are not touched.'],
  noOwnThemes:'No themes of your own yet: make one with the plus.',
  themeRename:['Rename', 'Gives this theme of your own another name. The colors changed so far are kept with it.'],
  themeApply:['Apply', 'Keeps the colors as they are now. On a theme of your own they are written into the theme.'],
  themeCancel:['Cancel', 'Puts every color back as it was when this page was opened. Closing the menu does the same.'],
  themeDelete:['Delete',
    'Removes this theme of your own and steps back to the one before it. It asks first: a deleted theme is gone, unless it was saved to disk.'],
  themeNameField:['Name', `The name the theme will have in the list, up to ${THEME_NAME_MAX} letters: so it always fits its button whole. It must differ from the names already there.`],
  loadFailed:'This file is not a Repix theme: nothing was loaded.',
  motion:['Motion',
      'Turns the movement off: everything stands in its place at once — panels, colors, what appears and what goes.<br><br>Until you press it, it follows the system: if "reduce motion" is on there, it is off here. What your hand moves itself — a scroll, a dragged window — still goes under the hand.'],
  hints:['Hints',
      'Turns off the explanations that come by themselves — the ones on buttons, knobs and fields.<br><br>The small "i" in the corner of a knob keeps working either way: it stands there to be asked, and a button that answers nothing would be worse than no button at all. The warning sign by the grid answers too.<br><br>Nothing appears at once in any case: under the mouse you have to stay still for about a second, by finger you press and hold.'],
  undoSteps:()=>['Undo steps',
      `How many steps are kept for Ctrl+Z and Ctrl+Y together, from ${DEPTH_MIN} to ${DEPTH_MAX}.<br><br>What you undo stays in reach: a new change does not throw it away, and Ctrl+Y can still bring it back. Only when the list is full does the oldest step drop out — one at a time, never all at once.<br><br>More steps take a little more memory; a smaller number trims the list when you let go of the slider.`],
  channel:{
    R:['Red', 'How much red the color holds, from none at all to as much as there is.<br><br>Any color on the screen is these three mixed together. Use them when the number is known beforehand — when a color has to match another program exactly.'],
    G:['Green', 'How much green the color holds, from none at all to as much as there is.<br><br>Any color on the screen is these three mixed together. Use them when the number is known beforehand — when a color has to match another program exactly.'],
    B:['Blue', 'How much blue the color holds, from none at all to as much as there is.<br><br>Any color on the screen is these three mixed together. Use them when the number is known beforehand — when a color has to match another program exactly.'],
    A:['Alpha', 'How much of the paint is there: 255 — wholly, 0 — not at all, and painting with it erases. In between the paint is see-through, and the saved PNG keeps it so.<br><br>Only paints of the work have it: the interface itself is never see-through.']},
  menu:{
    // The flipper has no explanation: it is pressed repeatedly, and text popping
    // up between clicks only gets in the way of the colors.
    'spacings':['Spacing',
      'How much air there is between things: the margins of the panels, the gaps between groups of buttons and between the knobs.<br><br>Counted in cells of the grid, not in pixels, so three cells stay three cells at any interface size. Auto gives three, and two on a narrow screen, where every cell counts. One packs everything as tightly as it goes.'],
    'sizes':['Interface size',
      'How large everything is drawn — buttons, letters, knobs, the thickness of the grid lines.<br><br>Auto chooses by the size of your screen. The digits set it yourself: smaller leaves more room for the picture, larger is easier to read from a distance or on a dense screen.'],
    'btnReset':['Reset',
      'Brings the colors back, undoing what you have changed by hand since.<br><br>A BUILT-IN theme returns to its own colors, as it came with the program. A theme OF YOUR OWN returns to its previous version: the colors it had before the last Apply, not the theme it was forked from.<br><br>Like every change here, it is kept only by Apply; Cancel puts back what stood before. Nothing else in the program is touched.'],
    'btnGuide':['Guide',
      'Everything you can do with the mouse, keys and fingers, in one list, and the licenses at its end.<br><br>The cross at its top brings the settings back. The menu itself closes by Repix, a click outside it, or Esc.'],
    'stepList':['What the show button cycles',
      'The button in the top row walks through the pictures of the work: the source, the grid over it, the pixels, the borders. Here you choose which of them it stops at.<br><br>The choice is kept for each stage separately: on one stage you want the grid, on another only the paints. A digit on the keyboard still opens any picture, whatever is ticked here.'],
  },
  strip:{
    paint:'Paint', add:'Add a paint', copied:'Copied color',
    paintInHand:'Paint — click to take it, double-click to change it',
    addText:'A new paint for the palette: it appears here and the color window opens for it.'}
};
/* A window is a caption and a canvas under it. There are two, built the same
   way, so they are described by one record. */
function assembleWindow(oo){
  oo=checkWindow(oo);
  const el=document.createElement('div'); el.className='stage';
  const ww=document.createElement('div'); ww.className='caption_'; ww.id=oo.caption; ww.textContent=oo.label;
  // QUIET — its words change with every drawing and move nothing else: a
  // change inside it is no input to settle.
  ww.dataset.quiet='';
  const xx=document.createElement('div'); xx.className='canvas';
  const c=document.createElement('canvas'); c.id=oo.canvas;
  // Over the picture, a sheet of the same size for what the video card draws
  // by itself (the borders up close, see cardBorders): it takes no touch.
  const over=document.createElement('canvas'); over.id=oo.canvas+'b'; over.className='over';
  moveArgs(el, oo); moveArgs(c, oo.picture); moveArgs(ww, oo.captionArgs);
  xx.appendChild(c); xx.appendChild(over); el.appendChild(ww); el.appendChild(xx);
  return el;
}

/* THE FLIP BUTTON of the windows' arrangement (see arrangeWindows). */
// Goes after the window three times the standard pace: a mark that keeps up.
const FLIP=buildNode({tag:'button', id_:'flipSplit', cls:'bare', inner:ICON_TO_STACK, follow:{window:{ms:20}}});

/* ===================== knobs ===================== */
/* Each knob has its own MOVE — how a slider position becomes a number:
     'exactly'   — evenly from end to end;
     'multiple'  — by equal ratios, not equal steps: a small cell size gets as
                   much slider as a large one (most pixel art lives in 1..5);
     'step share' — the grid origin lives inside ONE cell, so its slider runs
                   from minus to plus half the current step (the STEP_KNOB).
   A slider position is always an integer from 0 to 1000.

   A record: key, min, max, start, slider precision, shown precision, move,
   stage, explanation, cluster. */
/* A knob's name is a KEY, not a label: val[] and widget[] live by it. What
   the user sees is here. */
const CAPTIONS={
  'step':'cell size, px',
  'origin x':'origin x',
  'origin y':'origin y',
  'cells between':'cells between',
  'jitter':'jitter, u',
  'color tolerance':'color tol., u',
  'tolerance x noise':'tol. ×noise',
  'tolerance cap':'tol. cap, u',
  'overlap':'overlap',
  'spatial width':'spatial width',
  'surround weight':'around weight',
  'agreement':'agreement, u',
  'min paint':'min paint, cells',
  'gauge':'yardstick, u',
  'cell noise':'cell noise, u',
  'min paint total':'min paint total, cells',
  'merge gauge':'merge yardstick, u',
  'neighbor strictness':'neighbors stricter, ×',
  'drift from source':'drift from source, u',
  'drift from neighbors':'drift from neighbors, u',
  'max paints':'max paints'
};
const KNOBS=[
  ['step',GRID_STEP.min,GRID_STEP.max,5,2,4,'multiple',1,
   'Side of one cell in pixels of the source image. Found automatically; if the guess is off, correct it — the grid on the left moves at once. The slider runs by ratio, not by equal steps, so small cell sizes are as easy to set as large ones, and an exact number is easier typed in.','grid'],
  ['origin x',-40,40,0,2,2,'step share',1,
   'Where the first grid line runs horizontally, counted from the nearest one. Images get cropped any which way, so the origin is its own thing.<br><br>It never exceeds half a cell either way: shifting by a whole cell gives the very same grid.','grid'],
  ['origin y',-40,40,0,2,2,'step share',1,
   'The same vertically. Cropping happens independently, so there are two origins.','grid'],
  ['cells between',1,1024,8,0,0,'multiple',1,
   'How many cells the ruler between the two points spans. The cell size becomes its length divided by this number, with a tick at every cell, and the grid starts at the first point.<br><br>Count the cells on the picture and type the number in, or turn it until the grid lies on the cells. It is here only while both points stand.','points'],
  ['jitter',0,60,KNOB_START.jitter,1,1,'exactly',1,
   'How much color jumps about inside a single cell — compression noise. Everything else is built on it: the first stage tolerance comes out of it (×2), and so does cell noise on the second.<br><br>Until you touch it, what stands here is what the image measured about itself. Touch it and the whole count runs from your number, whatever the image actually does; "Auto settings" brings the measurement back.<br><br>Setting it by hand makes sense when the measurement lies: on coarse-grained work it reads high, on a clean one it reads low.','tolerance'],
  ['color tolerance',0,60,KNOB_START.colorTolerance,1,1,'exactly',1,
   'The width within which colors count as one paint, in units of color. This is not a border but a measure of loudness: the further a pixel is from the reference color, the quieter its voice in the result — it is not cut off.<br><br>This is the lower bound of that width: it never gets narrower, not even on a perfectly clean image.<br><br>Raise it and a cell starts gathering neighboring shades into its color. Drop it to zero and only the ratio on the right is left.','tolerance'],
  ['tolerance x noise',0,8,KNOB_START.noiseMultiple,1,1,'exactly',1,
   'How many times wider the tolerance is than the noise of the image. The noise is measured per image, so the same value here gives a different tolerance on a clean scan and on a battered JPEG — and that is right.<br><br>Raise it if one paint has crumbled into patches of different shades. Lower it if different paints have stuck together into one.','tolerance'],
  ['tolerance cap',0,120,KNOB_START.cap,1,1,'exactly',1,
   'The ceiling the tolerance never rises above, however noisy the image. It keeps two close paints on a filthy image from gluing into one: telling them apart afterwards is impossible.<br><br>Zero removes the ceiling.','tolerance'],
  ['overlap',0,3,KNOB_START.overlap,2,2,'exactly',1,
   'How far to look past the cell border, in fractions of its side. It gets more samples of its own color near the edge, where there are few.<br><br>Whatever is foreign in the overlap is filtered out — every piece is judged on its own, by the cell it came from. Worth raising on a small cell, where the cell has only a handful of pixels to begin with.','fineStuff'],
  ['spatial width',0.02,0.6,KNOB_START.placeWidth,2,2,'exactly',1,
   'How far from the center of the cell a pixel is still heard, in fractions of the cell side. This is closeness by PLACE, paired with the tolerance, which is closeness by color.<br><br>Narrower and the cell listens only to its middle: nothing foreign reaches in, but there are few samples and the color gets noisy. Wider and the color is smoother, but the neighbor bleeds in at the edge.<br><br>Images ask for different things, and the difference shows: some do better at 0.18, others at 0.06.','fineStuff'],
  ['surround weight',0,3,KNOB_START.surroundWeight,2,2,'exactly',1,
   'How much voice the pixels taken from beyond the cell border get, compared to the cell’s own. Zero — the neighbors are not heard. One — equal footing. Above one — the surroundings outweigh the cell’s own pixels.<br><br>Images ask for different things: some do better at zero, others at two. If a paint has crept beyond its borders, turn it down; if one paint ripples inside, turn it up.','fineStuff'],
  ['agreement',0,30,KNOB_START.agreement,1,1,'exactly',1,
   'How closely the color of a neighboring piece must agree with the color of the cell for it to be taken, in units of color. The lower bound of strictness.','fineStuff'],
  ['min paint',0,256,0,0,0,'exactly',2,
   'From what size a patch counts as a paint in its own right. Anything smaller is not a paint and sticks to the nearest neighbor. An allowance of √(this number ÷ size of the smaller group) − 1 units is ADDED to the pair threshold: zero for a group of exactly this size, and the larger the smaller the group. Color still decides: a patch sticks only if it is closer than the threshold plus the allowance. One unit of allowance is the median of the image’s own seams, so the knob works even at zero merge thresholds and does not depend on them.<br><br>This sets the smallest meaningful size: anything below it is not a paint of its own and sticks to the nearest one by color. It works harder than the thresholds themselves, because it works in a chain: a stuck patch grows and is then judged as part of a big one.<br><br>0 — ignore size.','groups'],
  ['gauge',0,40,0,1,1,'exactly',2,
   'The unit the threshold is built from: pair threshold = allowance from size × yardstick. In units of color, like everything else here.<br><br>Until you touch it, what stands here is what the image counted about itself: the median of the differences between neighboring cells in lightness. Touch it and the count stops interfering until you press "Auto settings".<br><br>The hue yardstick keeps the image’s own proportion: if lightness is 1.7 and hue is 1.4, then at a yardstick of 6 the hue one becomes 4.9.<br><br>The threshold never drops below the cell’s own noise: telling apart what is finer than the jitter makes no sense.','groups'],
  ['cell noise',0,20,0,2,2,'exactly',2,
   'The floor of the threshold: below it we tell nothing apart, because that is how much the cell trembles on its own.<br><br>It comes out of the jitter: divided by the square root of the number of pixels in a cell — a cell averages its pixels, and its own noise is quieter by exactly that much. On an editor icon a jitter of 16.5 over 33 pixels per cell gives 2.88.<br><br>Until you touch it, what stands here is what was computed. Raise it and large areas stop breaking into seams; lower it and really fine differences start being caught — along with the noise.','groups'],
  ['min paint total',0,4096,0,0,0,'exactly',3,
   'From what weight a paint counts as one in its own right — across the WHOLE image, not one patch. The second stage gathers neighboring cells, but the same paint lies in different places: two highlights, shadow on the left and shadow on the right, pieces of background between leaves. Here they are brought together.<br><br>Weight decides: a paint of five cells in the whole image is almost certainly clustering leftovers, a paint of five hundred is what the author meant. The threshold comes out of the weight the same way the second stage got it out of group size: √(this number ÷ weight of the paint) − 1, in units of the median difference between group colors.<br><br>0 — merge nothing.','merge'],
  ['merge gauge',0,40,0,1,1,'exactly',3,
   'The unit the merge threshold is built from: threshold = allowance from paint weight × yardstick. In units of color.<br><br>Here it is about something else than on the second stage: there neighboring CELLS were measured, here it is the differences between GROUP colors across the whole image. Until you touch it, what stands here is what was computed; touch it and the count stops interfering until you press "Auto settings".<br><br>The hue one keeps the image’s proportion, as on the second stage.','merge'],
  ['neighbor strictness',0,1,KNOB_START.neighbourStrictness,2,2,'exactly',3,
   'How much stricter to judge two paints whose areas stand next to each other in the image.<br><br>If the author picked different paints for neighboring places, they told them apart, and that is a border, not an accident. Similar paints from opposite ends of the image are most often one and the same, pulled apart by clustering — those are the ones to bring back together.<br><br>1 — judge them alike, as before. 0.5 — half the threshold for neighbors. 0 — never merge neighboring paints, however alike they are.','merge'],
  ['drift from source',0,60,KNOB_START.maxDrift,1,1,'exactly',3,
   'How far a cell is allowed to travel from its own color while merging, in units of color. It cuts the threshold from above, however much weight and allowance have blown it up.<br><br>A light paint gets a huge allowance — a group of five cells at a smallest paint of a thousand gets fourteen yardsticks — and travels far to a foreign color. This sets the limit for the ordinary pass. The hard paint limit does not obey it: if forty paints were asked for, forty there will be, even if someone has to travel further.<br><br>0 — no limit.<br><br>On a photograph rather than pixel art, a strong merge with a LOW drift works best: the merge gathers the smooth gradients into large patches, and the low drift keeps what is bright and sharp — stars, rims of light, highlights — from being pulled into the background.','merge'],
  ['drift from neighbors',0,60,KNOB_START.neighbourDrift,1,1,'exactly',3,
   'How much a border between two neighboring groups may grow while merging, in units of color.<br><br>A group barred from the paint of its neighbor goes to another one, and with big thresholds that can be any paint: a speck of brown in a blue sky, a border the source never had. With this set, a paint fits only if, against every neighbor already laid, the difference is not bigger than it was in the source by more than this — for lightness and for tone apart. If no paint fits, the group starts its own.<br><br>0 — no cap. A full palette (max paints) pours past it.','merge'],
  ['max paints',0,256,KNOB_START.maxPaints,0,0,'exactly',3,
   'A hard palette limit. Once that many paints are gathered, the next group has to join the nearest one, however far away it is.<br><br>0 — no limit: as many as the thresholds give.','merge']];
/* CLUSTERS of knobs, by the name a knob record gives. A cluster is a column
   of the footer. "grid" — where the grid lies, not how to compute: touching it
   does not make the computing settings your own. "fine" — hidden behind the
   Fine lid. */
const CLUSTERS={grid:{grid:true}, points:{grid:true, points:true}, tolerance:{}, fineStuff:{fine:true}, groups:{}, merge:{}};
/* The knob whose value is the grid step: 'step share' knobs live inside it,
   and the grid search looks for a step within its range. */
const STEP_KNOB='step';
const MOVE=1000;

function limits(move,mn_,mx_){
  if(move==='step share'){ const ww=Math.max(0.5, val[STEP_KNOB]||mx_); return [-ww/2, ww/2]; }
  return [mn_,mx_];
}
/* One slider step = one unit of the shown precision; otherwise half of the
   steps would change nothing after rounding. A 'multiple' move has no equal
   units by design: it has exactly MOVE steps, and the number is rounded to
   its precision. */

/* FOLDING THE ORIGIN into one cell when the step changes is safe: cell
   borders are built from ceil(-origin/step), going into negatives, so origin
   and origin-step give the SAME lines. It folds by the step into half a cell
   each way, [-step/2, +step/2]: a small shift looks small and its sign says
   which way. */
function currentStep(){ return Math.max(0.5, val[STEP_KNOB]||1); }
function toCell(v,ww){
  const o=((v%ww)+ww)%ww;
  return o>ww/2 ? o-ww : o;
}

/* THE BUTTONS — records the button engine lays out (see its description
   below the list). */
/* THE TOOL IN HAND as a choice for the buttons: pressing a tool takes it,
   pressing it again puts it down. */
const TOOL={get:()=>tool, set:v=>{ tool=v; aimFor=-1; dwellOff(); toolCursors(); redraw(); }, empty:null};
const BUTTONS=[
  {id_:'btnOpen', place:'header_', group:'file', label:'Open',
   calls:()=>openWin(),
   needs:'core',
   hint:['Open',
    'Opens an image, a project file (.repix), or a project kept in Repix. You can also just drop a file into the window. Any image the browser opens will do: JPEG, PNG, WebP. For a new image the grid is searched for automatically.<br><br>With no projects kept in Repix it goes straight to picking a file.']},

  {id_:'btnSave', place:'header_', group:'file', label:'Save',
   calls:()=>saveWin(),
   needs:'image',
   hint:['Save',
    'Three ways: the picture — the art as a PNG, one grid cell to one pixel; a project file — the whole work in one .repix file for your computer: the picture you opened, every knob and line fix, the stage, the painting and both histories; or into Repix — the same project kept here in the browser, to be opened again with Open.']},

  {id_:'btnShow', place:'header_', group:'grid',
   label:()=>'Show '+(STEPS[nextStep()]||{brief:''}).brief,
   // The step name is squeezed first, the verb goes last: what is shown is
   // already written above the window.
   shorter:()=>{ const ss=STEPS[nextStep()]||{brief:''};
                const ii=ss.squeezedDown||ss.brief; return ['Show '+ii, ii]; },
   calls:()=>toStep(nextStep()),
   // Only one step left in the cycle — nothing to flip, and the button shows it.
   needs:'image', dims:()=>showRing().length<2,
   hint:['What is in the left window',
    'The left window holds the PROCESS, the right one the RESULT: on the left lies the markup this stage works with, laid over what it works on — the grid over the source, cluster borders over the pixels, paint borders over the clusters.<br><br>The button cycles the steps chosen in the settings; a digit jumps straight to any step that came before, whatever the settings say.']},

  {id_:'btnLines', place:'header_', group:'grid', label:'Edit lines',
   shorter:['Lines'],
   // Not a flipper: the label stays, the button presses in with the accent,
   // like everything else that is on.
   pressed:()=>editingLines,
   calls:()=>{ editingLines=!editingLines; if(!editingLines) highlight(null); else if(points.on) pointsOff(); },
   shown:()=>stage===1,
   // No grid visible — nothing to edit: a line cannot be moved blind.
   needs:'image', dims:()=>leftView!=='2',
   hint:['Edit lines',
    'Move SINGLE grid lines with the mouse — usually to fit the edge of the work. A line never jumps over its neighbor: at least one pixel always stays between them. A double click on a line drops the correction from that one line. The right button in this same mode drags the whole grid at once.']},

  {id_:'btnPoints', place:'header_', group:'grid', label:'By points',
   shorter:['Points'],
   pressed:()=>points.on,
   calls:()=>{ if(points.on) pointsOff(); else { points.on=true; if(editingLines){ editingLines=false; highlight(null); } refreshPoints(); } redraw(); },
   shown:()=>stage===1,
   // No grid visible — nothing to set by points: the grid it gives is not seen.
   needs:'image', dims:()=>leftView!=='2',
   hint:['Grid by points',
    'A ruler. Click two places on the left window where grid lines cross, on one row or one column, as far from each other as the work allows: the second point goes onto the line across or down from the first. Then set "cells between" to how many cells the ruler spans: the cell size becomes its length divided by that number, a tick marks every cell, and the grid starts at the first point.<br><br>For a cell size no slider finds by hand: a fractional step is two clicks and a count. Zoom in with the wheel to put a point exactly; the right button moves the picture. A third click starts over.']},

  {id_:'btnAgain', place:'header_', group:'grid', label:'Find grid again',
   // "again" is a clarification, not an action: the grid is searched anyway.
   shorter:['Find grid','Grid'],
   calls:()=>{ remember('again'); autoChanged(1); resetFixes(); findGrid(); },
   shown:()=>stage===1,
   needs:'image',
   hint:['Find grid again',
    'Searches for the grid from scratch, drops every line correction and recomputes the art. This is a return to what you had right after opening the image — no need to reopen the file any more.']},

  {id_:'btnAuto', place:'header_', group:'compute', label:'Auto settings',
   shorter:['Auto set.','Auto'],
   calls:()=>{ const aa=currentStage().auto; if(aa && !autoStands[stage]){ aa(); refreshButtons(); } },
   // Not a list of stages but by substance: a stage with automatic settings
   // gets the button.
   shown:()=>!!currentStage().auto,
   needs:'image',
   // They stand already (see autoStands): nothing to ask for until a change.
   dims:()=>!!autoStands[stage],
   hint:['Auto settings',
    'Sets the knobs of the CURRENT stage from the measurements of the image itself.<br><br>On the first — color tolerance and its cap. Tolerance is inversely proportional to cell size: JPEG smears over a constant radius, and in a small cell that murk takes up a larger share of it.<br><br>On the second — merging by lightness and by hue. The threshold goes into the gap between the murk inside paints and the borders between them — from the image itself, without noise. This is a starting point: the eye moves away from it in both directions on different works.<br><br>The first visit to a stage starts from them by itself. After that it is a separate button, so that your settings are never swept away without asking.<br><br>While the automatic settings stand, the button is dimmed: there is nothing to ask for. It is there again as soon as something changes — a knob of this stage or an earlier one, the grid, a line, a step back.']},

  {id_:'btnFine', place:'header_', group:'compute', label:'Fine',
   calls:()=>{ fineVisible=!fineVisible; refreshFine(); },
   shown:()=>stage===1,
   pressed:()=>fineVisible,
   hint:['Fine',
    'Shows the fine knobs of the first stage — the ones that decide HOW a cell gathers its color: how far past its border it looks, how far from the middle a pixel is still heard, how much voice the surroundings get.<br><br>They are hidden because they are rarely needed: the ones on the left are enough on most work. But they do matter, and they pull in different directions on different images — if a paint has crept beyond its borders or one paint ripples inside, they are what to reach for.<br><br>The button lives on the first stage only: there is nothing fine on the others.']},

  {id_:'btnBrush', place:'header_', group:'hand', label:'Brush',
   shown:()=>stage===4, choice:TOOL, value:'brush',
   needs:'image',
   hint:['Brush',
    'Colors the cell under the cursor with the paint in hand. You can take a paint by clicking the strip below, or with the picker — Alt and a click.<br><br>Drag with the button held and it colors along the way; release and that is one stroke, which Ctrl+Z removes whole. The image is still panned by the right button and the wheel.']},

  {id_:'btnFill', place:'header_', group:'hand', label:'Fill',
   shown:()=>stage===4, choice:TOOL, value:'fill',
   needs:'image',
   hint:['Fill',
    'Repaints the whole connected area of the ONE paint you clicked. The borders of the area are where the paint changes, not where the color merely looks alike: likeness was settled by the second and third stages, here everything is already decided.']},

  {id_:'btnPipette', place:'header_', group:'hand', label:'Picker',
   shown:()=>stage===4, choice:TOOL, value:'pipette',
   needs:'image',
   hint:['Picker',
    'Takes the paint from the cell you clicked. On the left window it copies whatever color you click there. Alt does the same with any tool.<br><br>Any tool is put down by pressing it again: with no tool in hand the mouse only moves the picture.']},

  {id_:'btnClean', place:'header_', group:'hand', label:'Clean',
   calls:()=>cleanPalette(),
   shown:()=>stage===4,
   dims:()=>!unusedPaints().length,
   hint:['Clean the palette',
    'Removes from the strip every paint that lies in no cell of the picture — painted over, deleted, or added and never used.<br><br>Only when you press it: a paint you covered by accident does not vanish on its own. Ctrl+Z brings the removed paints back.']},

  {id_:'btnDelete', place:'header_', group:'hand', label:'Delete',
   calls:()=>deletePaint(),
   shown:()=>stage===4,
   dims:()=>!canDeletePaint(),
   hint:['Delete the paint',
    'Removes the paint in hand from the work. Every cell of it takes the closest paint that stays — closest as the eye sees colors, not by the numbers — and that paint goes into your hand. The removed one stays in the strip, empty, until Clean takes it away.<br><br>The Delete key does the same. Ctrl+Z brings it all back.']},

  /* The doubt label is a HOLLOW BUTTON WITH ITS OWN PAINT: it calls nothing,
     has no background, and takes its bevel, icon and text from its own color. */
  {id_:'doubt', place:'header_', group:'compute',
   label:'grid uncertain', icon:ICON_WARNING,
   paint:'var(--alarm)', hollow:true, still:true, always:true,
   shown:()=>doubtShown,
   hint:()=>['Grid uncertain', doubtText]},

  /* UNDO AND REDO on screen, for a finger: the same as Ctrl+Z and Ctrl+Y.
     On stages 1–3 they step through the knobs, on stage 4 through the
     painting. */
  {id_:'btnUndo', place:'history', group:'history', label:'', icon:ICON_UNDO,
   calls:()=>stepBack(),
   dims:()=>!canStepBack(),
   hint:['Undo',
    'One step back: the knobs as they were, a move between stages — back to the stage you came from. On the fourth stage the strokes, fills and paint changes go back first.<br><br>Ctrl+Z does the same.']},
  {id_:'btnRedo', place:'history', group:'history', label:'', icon:ICON_REDO,
   calls:()=>stepForward(),
   dims:()=>!canStepForward(),
   hint:['Redo',
    'Steps forward again over what Undo took back. A new change of your own drops these steps, as in any editor.<br><br>Ctrl+Y or Ctrl+Shift+Z does the same.']},

  /* MOVING BETWEEN STAGES is a FLIPPER, like the themes: a step back, where we
     are, a step forward. The stage buttons live in the footer, but are set up
     the same way as all buttons: one mechanism, not two. */
  {id_:'btnBack', place:'footer', group:'move',
   label:()=>'< '+(stage-1),
   calls:()=>leavePainting(()=>toStage(Math.max(1,stage-1))),
   shown:()=>stage>1,
   needs:'image'},

  // The middle is a dummy: it calls nothing, it says where you are.
  {id_:'whereWeAre', place:'footer', group:'move',
   label:()=>currentStage().brief,
   still:true,
   // Its own explanation, though the neighbouring button tells the whole path:
   // this one is only about the stage you are on.
   hint:()=>{ const ss=currentStage();
     return ['Stage '+ss.number+' — '+ss.title, ss.about]; }},

  {id_:'btnStage2', place:'footer', group:'move',
   label:()=>(stage+1)+' >',
   calls:()=>toStage(Math.min(STAGES.length,stage+1)),
   shown:()=>stage<STAGES.length,
   // Not on until this stage is counted: the next one is built from it.
   needs:'image', dims:()=>counting(),
   hint:['Stages',
    'ONE — prepare: bring back the pixels. Find the grid of the original art and hand it back at its native resolution, where one grid cell equals one pixel of the file. Everything in the bottom panel is about the quality of that preparation.<br><br>Colors are not reduced on the first stage: there are hundreds of them at the output. They can only be brought together by knowing a whole group of cells, and a single cell cannot see the paint.<br><br>TWO — clusters. Neighboring cells of one paint are gathered together, and the group gets one color for all of them: the noise inside it averages out and goes away. A lone patch on a flat background is not dissolved by this — it stands out.<br><br>THREE — merge. Identical groups across the whole work are brought into one paint: the second stage knows nothing about non-neighboring pieces of the same paint, and each becomes a group of its own.<br><br>FOUR — paint. The algorithms are done: whatever did not come together on its own is finished by hand. Brush, fill and picker color cells with the paints the work has. The picker also copies a color from any picture on either side — it joins the palette once you paint with it. Double-click a paint in the ribbon to change its color everywhere. Alt takes the paint under the cursor with any tool, Ctrl+Z undoes a stroke.<br><br>The whole path is laid out by digits: odd ones are clean pictures, even ones are the markup of a stage over its own input — 1 source, 2 grid, 3 pixels, 4 cluster borders, 5 clusters, 6 paint borders, 7 merged paints, 8 paint borders over painted. A digit changes only the LEFT window and never moves you to another stage. Zero brings it back to the markup of the current stage.']},
];

const NEEDS={image:()=>hasImage, core:()=>!!core};

/* INCOMING — objects not built by the button engine that still live in a
   group next to buttons. The name plate with the gear is an object of the
   "file" group like Open and Save: it too does something, opens the settings. */
const INCOMING=[{id_:'name', place:'header_', group:'file', firstly:true}];

/* ===================== WHAT IS MADE OF WHAT =====================
   PRIMITIVE — what an object is built from and does not live alone: a label,
     a slider, a number field, an icon.
   OBJECT — primitives together, the smallest thing the engine moves whole:
     a button, a knob, the stage block. An object is never torn.
   GROUP — objects together, with a shared meaning. A group feels tight
     before its section does and copes by itself.
   SECTION — a place with groups: the header, the knob field. The order of
     groups is fixed, and every joint is marked with a divider.
   SINGLE — a section object outside any group: it has its own rules of
     standing and giving way, and no dividers.

   When room runs out, things give way in this order:
     1. objects wrap INSIDE their group, downwards;
     2. a smaller group lines up under a larger one — all get the same number
        of rows and span the section top to bottom, or the edges are ragged;
     3. labels are shortened — only where a shortening is written, and only
        to the written form.
   Singles are not in this order: they squeeze their own way. */
/* A single's record, by arguments; the engine carries them out.
     counted — the engine counts it when it checks if a row of clusters fits:
               a single that stands on a row of its own or stretches to any
               width must not make the clusters fold;
     seams   — it is text sewn from parts at these seams, and gives way at
               them: gives 'rows' — breaks into rows, then moves down whole;
               'tail' — drops the parts from the end;
     stacks  — it stands as a column as soon as the field beside it takes
               more than one row of its items.
   A single gives way when its WORDS CHANGE or its shelf is laid out — the
   decision is taken after the layout of its row, never from a row not laid
   out yet. A drawing comes before the row's layout on the window's way: by a
   drawing only a single whose words it changed gives way. */
const SINGLES=[
  // Status: stands last in the header and subdivides at its own seams; when
  // there is no room, it takes a row of its own.
  {id_:'status', seams:[' — ','  ·  '], gives:'rows'},
  // Stage block: stands last in the footer and takes room like a cluster; it
  // stands as a column when the knobs already make the footer that tall.
  {id_:'stageBlock', counted:true, stacks:{beside:'#knobsField', rowOf:'.knob'}},
  // The paint strip in the footer: elastic, shrinks to any width and scrolls.
  {id_:'palette'},
  // Window captions: each is a single of its window. It gives way by dropping
  // the tail after the dash: the measure matters less than what is shown.
  {id_:'ww0', seams:[' — '], gives:'tail'},
  {id_:'ww2', seams:[' — '], gives:'tail'},
];

/* HOW TO SPLIT THE WINDOWS. The two windows always share the room equally,
   but they can stand side by side or stacked, and the right choice depends
   on the work: a wide strip belongs stacked, otherwise each window gets a
   narrow column.

   Both cases are computed: the scale side by side and the scale stacked.
   The one showing the work larger wins — unless the flip button said
   otherwise. Its word holds only until the automatic choice comes round to it
   by itself (a new size of the window, another work): from then on the
   automatic choice decides again. A new work drops it at once. */
var barShelfTall=null, roomDue=false;
let splitByHand=null;   // null — automatic; true — stacked; false — side by side
function arrangeWindows(told){
  const el=$('#stages'); if(!el) return;
  let auto=false;
  // The room's size as the browser told it (see the room's size observer),
  // or asked when the choice is made for another reason (a work, the flip).
  const r=told || el.getBoundingClientRect();
  /* THE ROOM OF THE FINAL LAYOUT, the same whichever way the windows stand
     now — or the choice would depend on where the window came from:
       — shelves on their way are drawn off their heights, and the room is
         drawn with them: their way is taken off (it is data);
       — stacked, the captions' bar stands IN the room; side by side it
         stands on its own shelf above. The room is counted as it is side by
         side: stacked, it is less by that shelf's height (kept from when the
         bar last stood there). */
  let H=r.height;
  for(const g of shelfGoing.values()) H+=(g.h-g.h1)+(g.mb-g.mb1);
  const bar=$('#captionsTop'), top=$('#captionsShelf');
  if(bar && top){
    if(bar.parentElement===el){ if(barShelfTall===null) barShelfTall=bar.offsetHeight; H-=barShelfTall; }
    else { const p=shelfPlaced.get(top); if(p && p.h>0) barShelfTall=p.h+p.mb; }
  }
  if(size.w && size.h && r.width && H>0){
    const beside  = Math.min((r.width/2)/size.w, H/size.h);
    const asStack= Math.min(r.width/size.w, (H/2)/size.h);
    auto=(asStack>beside);
  }
  if(splitByHand===auto) splitByHand=null;
  const stacked = splitByHand===null ? auto : splitByHand;
  if(stacked) el.dataset.stacked=''; else delete el.dataset.stacked;
  stitchCaptions(stacked);
}
/* THE FLIP is one trigger: the pictures go out, the windows go to their new
   places — the seam between them to the middle of the room, wherever the
   middle is by then — and the pictures come back in their new windows.
   They come back WHEN THE CAPTIONS' BAR STANDS: the windows are no boxes of
   their own, the bar is the line between them — a picture shown while the bar
   is still on its way would end at a line that is not there yet. */

/* The captions' bar moves WHOLE — one object, its words and the flip button
   on it: over the windows standing side by side, between them stacked.
   Drawing knows nothing about it — it writes into #ww0 and #ww2 wherever
   they are. The flip button's PICTURE turns a quarter to show the arrangement
   it would give - the picture, not the button: the button rides its seam,
   its way drawn plainly on the screen. */
function stitchCaptions(stacked){
  const bar=$('#captionsTop'), stages=$('#stages'), top=$('#captionsShelf'); if(!bar || !stages || !top) return;
  const second=$('#xx2') && $('#xx2').closest('.stage');
  // The captions live on the bar (built with their windows, they are moved
  // onto it once).
  for(const id of ['#ww0','#ww2']){ const c=$(id); if(c && c.parentElement!==bar) bar.appendChild(c); }
  if(stacked){ if(bar.parentElement!==stages && second) stages.insertBefore(bar, second); }
  else if(bar.parentElement!==top) top.appendChild(bar);
  turnTo(FLIP.firstElementChild, stacked ? 90 : 0);
  arrangeAreas();
}
/* KNOB CLUSTERS ARE THE ENGINE'S TOO, laid out like the header's: cluster by
   cluster, a divider between two neighbouring VISIBLE ones, spare room at the
   end of the shelf where the stage block stands. Tightness is measured over
   the WHOLE footer: the stage block takes room like the clusters, though it
   lies outside the knob field. */

function arrangeClusters(){
  const field=$('#knobsField'); if(!field) return;
  divideGroups(field);
  // The knobs are always packed with the stage block standing as a row; only
  // then does it decide whether to stand as a column (its stacks argument). If
  // the column took part in the packing, the room it frees would undo the
  // very reason it was taken, and the two would swap back and forth.
  const block=$('#stageBlock'); if(block) block.classList.remove('inColumn');
  evenOut();          // its rows as they stand in a row, before the packing
  // Label heights are levelled by alignCaptions from scratch, whenever the
  // labels change: another stage's reserve never weighs in.
  packClusters(field, field.parentNode);
}
/* LABEL HEIGHT is measured, not assigned: in a narrow window a label takes
   three lines. The engine measures the tallest visible label and gives
   everyone the same reserve, so the sliders stay level. */
let captionsFor='';
function alignCaptions(){
  const visibleOnes=[...document.querySelectorAll('#knobsField .knob')]
    .filter(seen);                 // (the knobs of a group going out are not counted)
  if(!visibleOnes.length) return;
  // What the reserve depends on: which labels, their words, a knob's width,
  // the scale. The same as last time — the labels keep their reserve.
  const key=[gridPixel(), Math.round(visibleOnes[0].getBoundingClientRect().width),
             ...visibleOnes.map(rr=>rr.querySelector('b').textContent)].join('|');
  if(key===captionsFor) return;
  captionsFor=key;
  const line=gridPixel()*10;                // a line is ten grid pixels
  let mx_=line;
  for(const rr of visibleOnes) rr.querySelector('b').style.minHeight='0';
  for(const rr of visibleOnes){ const vv=rr.querySelector('b').scrollHeight; if(vv>mx_) mx_=vv; }
  const reserve=Math.ceil(mx_/line)*line;
  for(const rr of visibleOnes) rr.querySelector('b').style.minHeight=reserve+'px';
}

/* STAGES ARE DATA, NOT BRANCHES. A stage is a record in this list, and
   everything reads it:
     number, title — "Stage 1 — prepare" in the explanation of where we are;
     brief   — the short name on the stage flipper;
     about   — the stage's explanation;
     result  — the status line;
     auto    — what "Auto settings" does on this stage;
     count_  — recomputing when knobs move.
   Switching stages swaps the record; nothing is rebuilt. */
const STAGES=[
  {number:1, title:'prepare', brief:'st.1',
   about:'You are on the first stage: bringing back the pixels. The grid of the original art is found and the picture is handed back at its native resolution, one grid cell per pixel. The knobs below tune how well the grid fits and how each cell gets its color.',
   result:()=> result ? [`art ${result.nw}×${result.nh}`,`colors ${result.colorsCount}`,`${result.msec} ms`]
                  : (buf ? [`art ${buf.width}×${buf.height}`,'computing…'] : [`${size.w}×${size.h} px`]),
   /* ONE COUNT, NOT A QUEUE. The advice is taken from the measurements of
      the last finished count; a count still running would only be thrown
      away by it — it is stopped first. And the work is counted again only
      if the advice changed something (or nothing counted stands). */
   auto:async ()=>{
     touched=false; autoStands[1]=true;
     clearTimeout(waiting); if(running.s1) stopFrom('s1');
     const share=agreementShare, changed=await applyAdvice();
     if(changed || agreementShare!==share || !result) laterCount(0);
   },
   count_:()=>{ redraw(); laterCount(); }},

  {number:2, title:'clusters', brief:'st.2',
   about:'You are on the second stage: clusters. Neighboring cells of one paint are gathered together and get one shared color, so the noise inside them averages out. A lone patch on a flat background stays on its own.',
   result:()=> result2 ? [`clusters ${result2.groupsCount}`,`colors ${result2.colorsCount}`,`${result2.msec} ms`] : ['computing…'],
   auto:(record=true)=>autoGroups(record),
   count_:()=>laterGroups()},

  {number:3, title:'merge', brief:'st.3',
   about:'You are on the third stage: merge. Clusters of the same color anywhere in the work are brought into one paint, including pieces that do not touch. The ribbon shows the paints that came out.',
   result:()=> result3 ? [`paints ${result3.paintsCount}`,`${result3.msec} ms`] : ['computing…'],
   auto:(record=true)=>autoPaints(record),
   count_:()=>laterMerge()},

  /* FOUR — painting. No more algorithms: what did not come together is
     finished by hand. The stage has no knobs. */
  {number:4, title:'paint', brief:'st.4',
   about:'You are on the fourth stage: painting by hand. Whatever did not come together on its own is finished here. Brush and fill use the paints of the work; the picker also copies a color from any picture, and it joins the palette once you paint with it. Double-click a paint to change its color.',
   result:()=> [`paints ${paintsOnPicture()}`, `edits ${edits()}`],
   // No auto, no computing: nothing to turn, nothing to count — painting is
   // done by hand. The "Auto settings" button disappears by itself, seeing the
   // stage has no automatic settings.
   count_:()=>{}},
];
const currentStage=()=>STAGES[stage-1];

/* STEPS. The whole path from the source to the painted work is laid out by
   digits, and any step opens with one key without disturbing what is computed.
   Odd — a clean picture, even — a STAGE'S MARKUP over its input: what the
   stage works with, laid over what it works on.
   The right window always shows the result, the left one the process: on
   stage N everything up to its own markup (2N) is open on the left. */
const STEPS={
  '1':{brief:'source', squeezedDown:'src',
       above:()=>`source — ${size.w}×${size.h}`,
       draw:kk=>putSource(kk)},
  '2':{brief:'grid',
       above:()=>`source with grid — cell ${val[STEP_KNOB].toFixed(4)}, origin ${val['origin x'].toFixed(2)} / ${val['origin y'].toFixed(2)}`,
       draw:kk=>{ if(!putSource(kk))return false; drawGrid(kk); return true; }},
  '3':{brief:'pixels', squeezedDown:'px',
       above:()=>`pixels — ${buf?buf.width:0}×${buf?buf.height:0} cells`,
       draw:kk=>drawArt(kk,buf)},
  '4':{brief:'cluster borders', squeezedDown:'cl. borders',
       prepare:()=>{ ensureGroups(); },
       above:()=>`cluster borders over pixels — ${result2?result2.groupsCount:0} clusters`,
       draw:kk=>{ if(!drawArt(kk,buf))return false; drawClusters(kk); return true; }},
  '5':{brief:'clusters', squeezedDown:'clust.',
       prepare:()=>{ ensureGroups(); },
       above:()=>`clusters — ${result2?result2.groupsCount:0}`,
       draw:kk=>drawArt(kk,buf2)},
  '6':{brief:'paint borders',
       prepare:()=>{ ensureGroups(); ensureMerge(); },
       above:()=>`paint borders over clusters — ${result3?result3.paintsCount:0} paints`,
       draw:kk=>{ if(!drawArt(kk,buf2))return false; drawMerged(kk); return true; }},
  '7':{brief:'merged',
       prepare:()=>{ ensureGroups(); ensureMerge(); },
       above:()=>`merged paints — ${result3?result3.paintsCount:0}`,
       draw:kk=>drawArt(kk,buf3)},
  '8':{brief:'painted borders',
       prepare:()=>{ ensureGroups(); ensureMerge(); setupRecolor(); },
       above:()=>`paint borders over painted — ${edits()} edits`,
       draw:kk=>{ if(!drawArt(kk,buf4))return false; drawMerged(kk); return true; }},
};

/* WHAT A TOUCH ON A WINDOW DOES — one table, read from the top: the first
   rule that holds takes the touch. When none does, the touch moves the
   picture (or, in line editing, the line under it). A rule alone takes the
   touch without holding the pointer: it is a single tap. */
const WINDOW_TOUCH=[
  // The picker's pipette is armed: the touch takes a color, and its click
  // must not close the picker (a click elsewhere closes it).
  {name:'pick for the picker', alone:true,
   holds:()=>pickingInWindows && !!colorTaker,
   act:(hl,e)=>{
     // What is drawn over the picture (the brush's aim, a lit paint) is not
     // the picture: it goes before the pixel is read.
     aimK=-1; litPaint=-1; redraw();
     const px=pixelAt(hl,e);
     if(px) takeColor('#'+px.map(v=>v.toString(16).padStart(2,'0')).join(''), true);
     disarmPipette(); eatClick=true; }},
  // BY POINTS: a tap on the source marks a corner of the grid (see setPoint).
  {name:'mark a point', alone:true,
   holds:(hl,e,source)=>points.on && source && e.button===0 && stage===1 && hasImage && showGrid,
   act:(hl,e)=>setPoint(hl,e)},
  // The right button carries the whole grid — but only in line editing
  // mode; the grid is not moved in passing.
  {name:'move the grid',
   holds:(hl,e,source)=>e.button===2 && source && editingLines && showGrid && hasImage,
   act:(hl,e)=>{
     gridPull={x:e.clientX,y:e.clientY,nchx:val['origin x'],nchy:val['origin y']};
     linePull=null; }},
  // STAGE 4: the pipette on EITHER window copies the color of what is
  // visible there.
  {name:'take a paint',
   holds:(hl,e,source)=>stage===4 && source && e.button===0 && hasImage && !!paintsField
                        && (e.altKey || tool==='pipette'),
   act:(hl,e)=>copyFromScreen(hl,e)},
  // STAGE 4: the left button over the right window paints instead of
  // panning. Panning is still there — right button, wheel, two fingers.
  // A SECOND FINGER on a stroke: it was a pinch, not painting. The stroke
  // so far is taken back and both fingers zoom and move the picture.
  {name:'pinch out of a stroke',
   holds:(hl,e)=>e.pointerType==='touch' && recoloringNow===hl && strokeAt && strokeAt.pointerId!==e.pointerId,
   act:(hl,e)=>{
     cancelStroke(); recoloringNow=null;
     dots.clear(); dots.set(strokeAt.pointerId, strokeAt); dots.set(e.pointerId, e); base=null; }},
  {name:'paint',
   holds:(hl,e,source)=>stage===4 && !source && e.button===0 && hasImage && !!paintsField
                        && (!!tool || e.altKey),
   act:(hl,e)=>{ recoloringNow=hl; strokeAt=e; recolorTap(hl,e,true); }},
];

/* ===================== COLORS =====================
   A few base colors are chosen — body, accent, markup, canvas, buttons,
   text — and everything else derives from them, so no combination leaves the
   text unreadable. Derived colors keep their DISTANCES in lightness from the
   base, which is what tells raised from pressed.

   Computed in HSL: "the same, but lighter" is one number there. */
/* THEMES are ready sets of the same colors, nothing more: no special rule,
   no separate branch in the engine. They stand by families, and from light
   to dark; the default one (DEFAULT_THEME) is not the first but 98. */
const THEMES=[
  // LIGHT — paper and daylight, warm to cold.
  // Paper: a fully light scheme — light works that merge with a dark window
  // are well visible on it.
  {name:'Paper', colors:{hull:'#e8e4d9', accent:'#b5502a', markup:'#2f6fb5',
                       canvas:'#cfc9bb', buttons:'#d8d2c4', text:'#2b2a26',
                       lockButtons:false, lockText:false, auto:true, theme:'Paper'}},
  // Street: a city poster - cream paper, the dark green of shop signs
  // for the buttons, a red-orange accent.
  {name:'Street', colors:{hull:'#f7f1e1', accent:'#e0552e', markup:'#2f6fb5',
      canvas:'#e9dfc8', buttons:'#1f4a40', text:'#1a2a30',
      lockButtons:false, lockText:false, auto:true, theme:'Street'}},
  // Lemonade: a glass of ice, orange-slice buttons, a mint accent.
  {name:'Lemonade', colors:{hull:'#f6f1e7', accent:'#4fae3a', markup:'#2f6fb5',
      canvas:'#ece3d2', buttons:'#f0a040', text:'#3f2a12',
      lockButtons:false, lockText:false, auto:true, theme:'Lemonade'}},
  // Dune: the desert — sand, terracotta buttons, the turquoise of a
  // nomad's jewel as the accent.
  {name:'Dune', colors:{hull:'#e8d3a9', accent:'#1f9c93', markup:'#c2185b',
      canvas:'#d9bf8e', buttons:'#c8744a', text:'#4a3322',
      lockButtons:false, lockText:false, auto:true, theme:'Dune'}},
  // Sakura: the second light theme, warmer than Paper — blossom and its
  // branch: pink petals, the bark's brown in the letters, the buttons and
  // behind the work.
  {name:'Sakura', colors:{hull:'#f7ecef', accent:'#c0567a', markup:'#2f7d6a',
                        canvas:'#e2cfc6', buttons:'#e3cbc2', text:'#5a3626',
                        lockButtons:false, lockText:false, auto:true, theme:'Sakura'}},
  // Lavender: Provence — lavender fields, olive buttons, a sunflower's
  // yellow for the accent.
  {name:'Lavender', colors:{hull:'#e6def0', accent:'#e9b52a', markup:'#2f7d6a',
      canvas:'#d8cde6', buttons:'#a3a86a', text:'#3b3350',
      lockButtons:false, lockText:false, auto:true, theme:'Lavender'}},
  // Fuji: a sky-blue morning, snow on the buttons, the pink of dawn.
  {name:'Fuji', colors:{hull:'#e3f1fb', accent:'#e87a9a', markup:'#ff6b00',
      canvas:'#cfe4f4', buttons:'#f7f9fc', text:'#253a52',
      lockButtons:false, lockText:false, auto:true, theme:'Fuji'}},
  // Fjord: the third light theme, the North — snow, slate rock for the
  // buttons, the red of a wooden cabin as the accent, cold stone letters.
  {name:'Fjord', colors:{hull:'#e9eef0', accent:'#b5402f', markup:'#2f7d6a',
                       canvas:'#d7e0e5', buttons:'#b8c7d1', text:'#22313a',
                       lockButtons:false, lockText:false, auto:true, theme:'Fjord'}},
  // OLD MACHINES — the screens and halls pixel art was born in.
  // The backing under the work is the desktop teal, panels and buttons silver,
  // the title-bar blue as the accent.
  // Buttons and text have their own colors here (silver level with the
  // background, pure black), so both locks are open.
  {name:'98', colors:{hull:'#c0c0c0', accent:'#000080', markup:'#00a800',
                    canvas:'#008080', buttons:'#c0c0c0', text:'#000000',
                    lockButtons:false, lockText:false, auto:true, theme:'98'}},
  // Retro: a slate-blue body, cream buttons, a plum canvas, black letters and
  // a white accent — an old pixel editor's desk.
  {name:'Retro', colors:{hull:'#7f939e', accent:'#ffffff', markup:'#ff1aff',
                       canvas:'#675762', buttons:'#d3ccbd', text:'#000000',
                       lockButtons:false, lockText:false, auto:true, theme:'Retro'}},
  // Famicom: the console itself — its maroon, cream buttons, the gold of
  // its lettering.
  {name:'Famicom', colors:{hull:'#7a1f24', accent:'#d9a441', markup:'#5cf2c8',
      canvas:'#4a1216', buttons:'#e6dcc2', text:'#f4ecd8',
      lockButtons:false, lockText:false, auto:true, theme:'Famicom'}},
  // Arcade: a dark hall of cabinets, red joystick buttons, the yellow
  // of a token for the accent.
  {name:'Arcade', colors:{hull:'#0e0e14', accent:'#ffd21f', markup:'#5cf2c8',
      canvas:'#050508', buttons:'#b8231c', text:'#f0f0f0',
      lockButtons:false, lockText:false, auto:true, theme:'Arcade'}},
  // BAR — a drink each, light to dark.
  // Champagne: a cream glass, gold bubbles for the accent.
  {name:'Champagne', colors:{hull:'#f3ead2', accent:'#c9a227', markup:'#2f6fb5',
      canvas:'#e8dcbc', buttons:'#e2cf9f', text:'#4a3b1f',
      lockButtons:false, lockText:false, auto:true, theme:'Champagne'}},
  // Mojito: crushed ice, mint buttons, a lime accent, dark-rum letters.
  {name:'Mojito', colors:{hull:'#e4f2e1', accent:'#5aa31f', markup:'#c2185b',
      canvas:'#d2e8cf', buttons:'#9fd8a8', text:'#3a2618',
      lockButtons:false, lockText:false, auto:true, theme:'Mojito'}},
  // Tequila, a shot: salt on the rim, lime buttons, a gold accent.
  {name:'Tequila', colors:{hull:'#e8dcc2', accent:'#e0a526', markup:'#2f6fb5',
      canvas:'#d8c9a8', buttons:'#b9d45a', text:'#3a3320',
      lockButtons:false, lockText:false, auto:true, theme:'Tequila'}},
  // Martini: a cold silver glass, olive buttons, the red heart of the
  // olive for the accent.
  {name:'Martini', colors:{hull:'#9aa3a8', accent:'#c8302c', markup:'#1f6fff',
      canvas:'#6f787d', buttons:'#7d8a3c', text:'#1c2224',
      lockButtons:false, lockText:false, auto:true, theme:'Martini'}},
  // Lagoon (Blue Lagoon): curacao blue, ice-cube buttons, a lemon accent.
  {name:'Lagoon', colors:{hull:'#0b4f9e', accent:'#f2e14c', markup:'#ff6fb5',
      canvas:'#073a78', buttons:'#bfe6f2', text:'#eaf6ff',
      lockButtons:false, lockText:false, auto:true, theme:'Lagoon'}},
  // Negroni: ruby, orange-peel buttons, the gold of vermouth.
  {name:'Negroni', colors:{hull:'#6e1420', accent:'#e8b84a', markup:'#5cf2c8',
      canvas:'#420b13', buttons:'#d9642a', text:'#f8e8d8',
      lockButtons:false, lockText:false, auto:true, theme:'Negroni'}},
  // Wine: bordeaux, cork buttons, the rose glint in a glass.
  {name:'Wine', colors:{hull:'#4a1024', accent:'#f08aa6', markup:'#5cf2c8',
      canvas:'#2c0914', buttons:'#b08a5e', text:'#f3e3e8',
      lockButtons:false, lockText:false, auto:true, theme:'Wine'}},
  // Whisky: a dark oak cask, amber buttons, the gold of the label,
  // letters like ice.
  {name:'Whisky', colors:{hull:'#3b2414', accent:'#e8c15a', markup:'#5fd0ff',
      canvas:'#24150b', buttons:'#b36a1e', text:'#f5ead6',
      lockButtons:false, lockText:false, auto:true, theme:'Whisky'}},
  // Absinthe, the green fairy: a dark bottle, wormwood buttons, the
  // sugar cube on the spoon for the accent.
  {name:'Absinthe', colors:{hull:'#16241a', accent:'#f2efe4', markup:'#ff6fb5',
      canvas:'#0d170f', buttons:'#6f9e3a', text:'#dfeecf',
      lockButtons:false, lockText:false, auto:true, theme:'Absinthe'}},
  // Espresso: a dark roast, crema buttons, the copper of the pot.
  {name:'Espresso', colors:{hull:'#24170f', accent:'#c87533', markup:'#5fd0ff',
      canvas:'#150d08', buttons:'#c9a27a', text:'#f0e2cf',
      lockButtons:false, lockText:false, auto:true, theme:'Espresso'}},
  // SODA — loud cans and bottles.
  // Cola: a red can, the white script as the accent, dark cola buttons and
  // behind the work.
  {name:'Cola', colors:{hull:'#b5121b', accent:'#fff8f0', markup:'#5cf2c8',
      canvas:'#1c0b06', buttons:'#3a1a10', text:'#fff8f0',
      lockButtons:false, lockText:false, auto:true, theme:'Cola'}},
  // Fizz: a blue can with a red band and white letters.
  {name:'Fizz', colors:{hull:'#004b93', accent:'#ffffff', markup:'#ffe34d',
      canvas:'#002a5c', buttons:'#e32934', text:'#f2f6ff',
      lockButtons:false, lockText:false, auto:true, theme:'Fizz'}},
  // Dew: a green bottle, neon-green buttons, a red accent.
  {name:'Dew', colors:{hull:'#0f3d1f', accent:'#e0201b', markup:'#ffe34d',
      canvas:'#07240f', buttons:'#9ee62a', text:'#f4ffd9',
      lockButtons:false, lockText:false, auto:true, theme:'Dew'}},
  // WARM — wood, earth, tea and moss, lighter to darker; the greens together.
  // Workshop: an artist's studio — grey canvas, the raw wood of the easel
  // for the buttons, a stroke of cinnabar for the accent.
  {name:'Workshop', colors:{hull:'#8a8780', accent:'#d8392b', markup:'#2fd0ff',
      canvas:'#5e5b55', buttons:'#c9a77c', text:'#1e1c1a',
      lockButtons:false, lockText:false, auto:true, theme:'Workshop'}},
  // Autumn: a maple park — walnut earth, rust leaves for the buttons, a
  // golden leaf as the accent, the dark of the fir trees behind the work.
  {name:'Autumn', colors:{hull:'#3a2a1e', accent:'#f0b43c', markup:'#5cc8f2',
                        canvas:'#1f2a1f', buttons:'#8c4a2a', text:'#f2e6cf',
                        lockButtons:false, lockText:false, auto:true, theme:'Autumn'}},
  // Matcha: a tea ceremony — dark roasted wood, whisked matcha for the
  // buttons, the red lacquer of the tray as the accent, rice-paper letters.
  {name:'Matcha', colors:{hull:'#2e2419', accent:'#c9463d', markup:'#5fd0ff',
                        canvas:'#1d170f', buttons:'#6d7f45', text:'#eee4cc',
                        lockButtons:false, lockText:false, auto:true, theme:'Matcha'}},
  // Moss: a dark olive body with an orange accent; buttons and text follow
  // the body (both locks closed).
  {name:'Moss', colors:{hull:'#121609', accent:'#ff9d2e', markup:'#3ddc6b',
                      canvas:'#121609', buttons:'#3e4c1f', text:'#f1f3ed',
                      lockButtons:true, lockText:true, auto:true, theme:'Moss'}},
  // Library: an old reading room — green leather bindings, parchment
  // buttons, gold tooling for the accent, ink and paper letters.
  {name:'Library', colors:{hull:'#1f3a2e', accent:'#d4af37', markup:'#ff6fb5',
      canvas:'#152820', buttons:'#d8c8a0', text:'#efe6cf',
      lockButtons:false, lockText:false, auto:true, theme:'Library'}},
  // Terrarium: glass and moss, a bright green lizard for the accent.
  {name:'Terrarium', colors:{hull:'#1e2b22', accent:'#8be04a', markup:'#ff6fb5',
      canvas:'#121b15', buttons:'#4d6b3a', text:'#e3efd9',
      lockButtons:false, lockText:false, auto:true, theme:'Terrarium'}},
  // Sushi: dark nori, rice buttons, salmon pink for the accent.
  {name:'Sushi', colors:{hull:'#1b2320', accent:'#f28c73', markup:'#5cf2c8',
      canvas:'#0f1512', buttons:'#eee8da', text:'#f2eee4',
      lockButtons:false, lockText:false, auto:true, theme:'Sushi'}},
  // Cabin: a winter evening — snowy night blue outside, warm wooden
  // buttons inside, the amber light of the window as the accent.
  {name:'Cabin', colors:{hull:'#1d2b44', accent:'#ffb347', markup:'#5cf2c8',
      canvas:'#121c2e', buttons:'#7a5234', text:'#f2ead8',
      lockButtons:false, lockText:false, auto:true, theme:'Cabin'}},
  // Candle: a dark room, wax buttons, the flame for the accent.
  {name:'Candle', colors:{hull:'#1a1512', accent:'#ffb02e', markup:'#5fd0ff',
      canvas:'#0f0c0a', buttons:'#e9dcc0', text:'#f3e7cf',
      lockButtons:false, lockText:false, auto:true, theme:'Candle'}},
  // COLD — water and the night sky.
  // Pop: pop-art turquoise and coral, white buttons.
  {name:'Pop', colors:{hull:'#2ab6d9', accent:'#e66546', markup:'#ffe34d',
      canvas:'#0d81be', buttons:'#f4f1e8', text:'#0b2a33',
      lockButtons:false, lockText:false, auto:true, theme:'Pop'}},
  // Ocean: a reef in the sun — shallow turquoise water, soft green
  // seaweed for the buttons, the corals' pink for the accent and their
  // yellow, like sunlit sand, in the letters.
  {name:'Ocean', colors:{hull:'#17657a', accent:'#ffa3b1', markup:'#ffe066',
                       canvas:'#0f4c5e', buttons:'#3f8a68', text:'#fff3c8',
                       lockButtons:false, lockText:false, auto:true, theme:'Ocean'}},
  // Koi: an emerald pond, lotus-leaf buttons, an orange carp.
  {name:'Koi', colors:{hull:'#0c4f4a', accent:'#ff7a1f', markup:'#ffd84d',
      canvas:'#073a37', buttons:'#3f8f3a', text:'#e6f4ee',
      lockButtons:false, lockText:false, auto:true, theme:'Koi'}},
  // Blueprint: blue drafting paper, white lines, the wood of a pencil
  // for the accent.
  {name:'Blueprint', colors:{hull:'#1d4f9e', accent:'#d9a066', markup:'#ffd84d',
      canvas:'#133d80', buttons:'#3a6fd8', text:'#f4f8ff',
      lockButtons:false, lockText:false, auto:true, theme:'Blueprint'}},
  // Aurora: the northern lights — a dark sky, the lights' green for the
  // buttons, their violet edge for the accent, snow letters.
  {name:'Aurora', colors:{hull:'#0f1a2b', accent:'#b57bff', markup:'#ffd84d',
      canvas:'#081018', buttons:'#1f7a6a', text:'#eaf6ff',
      lockButtons:false, lockText:false, auto:true, theme:'Aurora'}},
  // Cosmos: the night sky — deep navy, violet nebula buttons, one yellow
  // star for the accent, starlight letters.
  {name:'Cosmos', colors:{hull:'#151a33', accent:'#ffd86b', markup:'#5cf2c8',
                        canvas:'#0a0d1f', buttons:'#3d3a6b', text:'#e4e2ff',
                        lockButtons:false, lockText:false, auto:true, theme:'Cosmos'}},
  // DARK — nights with a story; the plain dark workroom last.
  // Eclipse: the black sun, its gold corona for the accent.
  {name:'Eclipse', colors:{hull:'#08080c', accent:'#f2c14e', markup:'#5cf2c8',
      canvas:'#000000', buttons:'#26262e', text:'#e8e8f0',
      lockButtons:false, lockText:false, auto:true, theme:'Eclipse'}},
  // Noir: a black-and-white film, light through the blinds, red lipstick
  // for the accent.
  {name:'Noir', colors:{hull:'#141414', accent:'#c8102e', markup:'#5cf2c8',
      canvas:'#0a0a0a', buttons:'#3a3a3a', text:'#e8e4dc',
      lockButtons:false, lockText:false, auto:true, theme:'Noir'}},
  // Forge: soot, iron buttons, the glow of hot metal.
  {name:'Forge', colors:{hull:'#1c1b1a', accent:'#ff7a1a', markup:'#5fd0ff',
      canvas:'#0f0e0e', buttons:'#5a5d62', text:'#ece6dc',
      lockButtons:false, lockText:false, auto:true, theme:'Forge'}},
  // Magma: black basalt, lava buttons, the yellow glow of the crack.
  {name:'Magma', colors:{hull:'#1a1412', accent:'#ffcc33', markup:'#5fd0ff',
      canvas:'#0e0a09', buttons:'#b8400f', text:'#f5e6d0',
      lockButtons:false, lockText:false, auto:true, theme:'Magma'}},
  // Halloween: a black night, pumpkin buttons, a witch's purple accent.
  {name:'Halloween', colors:{hull:'#140f1c', accent:'#9b59d0', markup:'#7cff5c',
      canvas:'#0a0710', buttons:'#d9651c', text:'#f2e8d8',
      lockButtons:false, lockText:false, auto:true, theme:'Halloween'}},
  // Gothic: a black castle, violet velvet buttons, blood red for the
  // accent, bone letters.
  {name:'Gothic', colors:{hull:'#150c16', accent:'#b3122e', markup:'#5cf2c8',
      canvas:'#0b060c', buttons:'#3b2438', text:'#e6dcc8',
      lockButtons:false, lockText:false, auto:true, theme:'Gothic'}},
  // Dungeon: a pixel RPG's crypt - dark stone, mossy stone buttons, the
  // amber of a torch.
  {name:'Dungeon', colors:{hull:'#1a1a1f', accent:'#ffa53a', markup:'#5fd0ff',
      canvas:'#0d0d10', buttons:'#3f4a36', text:'#e0dccf',
      lockButtons:false, lockText:false, auto:true, theme:'Dungeon'}},
  // Firefly: a summer night in the woods, a firefly's yellow light.
  {name:'Firefly', colors:{hull:'#0c1a17', accent:'#e8f25c', markup:'#ff6fb5',
      canvas:'#06100d', buttons:'#1f3b2e', text:'#d9ecd8',
      lockButtons:false, lockText:false, auto:true, theme:'Firefly'}},
  // Abyss: the deep sea without light, the glow of a deep-sea fish.
  {name:'Abyss', colors:{hull:'#050d17', accent:'#3ff2e0', markup:'#ff6fb5',
      canvas:'#02060c', buttons:'#0e3a4a', text:'#cfe8ef',
      lockButtons:false, lockText:false, auto:true, theme:'Abyss'}},
  // Neon: a city at night - shop signs in magenta, cyan letters.
  {name:'Neon', colors:{hull:'#0f0b24', accent:'#ff2fb3', markup:'#ffe34d',
      canvas:'#07051a', buttons:'#2a1f5c', text:'#7ff6ff',
      lockButtons:false, lockText:false, auto:true, theme:'Neon'}},
  // Synthwave: a purple night, pink grid buttons, the orange sun of the
  // eighties.
  {name:'Synthwave', colors:{hull:'#1b0f33', accent:'#ffb347', markup:'#5cf2c8',
      canvas:'#0e0720', buttons:'#bf2a6f', text:'#fbe3ff',
      lockButtons:false, lockText:false, auto:true, theme:'Synthwave'}},
  // Blender-like: charcoal background, grey widgets, an orange active accent.
  {name:'Blender', colors:{hull:'#1d1d1d', accent:'#ff8c00', markup:'#4772b3',
                         canvas:'#393939', buttons:'#545454', text:'#e5e5e5',
                         lockButtons:false, lockText:false, auto:true, theme:'Blender'}},
];
/* RETIRED THEMES — built-in ones taken out of the list, with the colors they
   had. Nobody loses one they liked: a retired theme that was on, edited or a
   favorite comes back as a theme of your own. A theme taken out of THEMES is
   moved here, never simply deleted. */
const RETIRED_THEMES={
  Cocoa:   {hull:'#241c14', accent:'#e8a33d', markup:'#6ec7a8', canvas:'#1b150f', buttons:'#4a3b2c', text:'#f0e6d8'},
  Amber:   {hull:'#1a1200', accent:'#ffb000', markup:'#00d0ff', canvas:'#0f0a00', buttons:'#3a2a00', text:'#ffcc66'},
  Phosphor:{hull:'#001100', accent:'#33ff33', markup:'#ff5cf0', canvas:'#000a00', buttons:'#003a00', text:'#66ff66'},
  Plum:    {hull:'#1e1526', accent:'#d17bf0', markup:'#7bf0a8', canvas:'#150f1c', buttons:'#3b2a4a', text:'#ece2f2'},
};
const DEFAULT_THEME='98';
const DEFAULT_COLORS=THEMES.find(tt=>tt.name===DEFAULT_THEME).colors;
const THEME_COLORS=['hull','accent','markup','canvas','buttons','text'];
const THEME_FLAGS=['lockButtons','lockText','auto'];

/* THE COLORS ONE CHOOSES, one record each: the key in colors, its swatch in
   the menu, and — for the three that can follow something else — its lock
   and the key of that lock. A closed lock means "worked out": buttons and
   text from the body, markup from the work (AUTO IS A MODE, NOT AN ACTION:
   while it is on, the markup is recomputed on every new work). Taking a color
   by hand opens its lock: the hand always wins. A swatch shows what is on
   screen NOW — for a locked color, the worked-out one (shows). */
const COLOR_KNOBS=[
  {key:'hull',    swatch:'#bodyColor',
   hint:['Body color', 'The main color of the program: panels, the space around the windows, everything that is not a button and not the artwork.<br><br>It is the one to start from. The buttons and the letters can follow it on their own — see the small locks beside them — so changing this one color repaints the whole program at once.']},
  {key:'accent',  swatch:'#accentColor',
   hint:['Accent color', 'The color of what is switched on right now: a pressed button, the chosen line in a list, the handle you drag.<br><br>It has one job — to be noticed. Take it away from the body color, not next to it, or nothing will look switched on.']},
  {key:'canvas',  swatch:'#canvasColor',
   hint:['Canvas color', 'The color behind the artwork in both windows.<br><br>It stands next to somebody else’s colors, so choose it for the WORK and not for the buttons: a dark work shows itself on a light backing, a light one on a dark backing. On a wrong backing the edges of the art disappear and you cannot see where it ends.']},
  {key:'buttons', swatch:'#buttonsColor', shows:'--frameColor',
   hint:['Button color', 'The color of the buttons themselves.<br><br>The bright edge above and the shadow below are made from it, so a button keeps looking raised — and pressed when you press it — whatever color you take.'],
   lock:'#buttonsLock', lockKey:'lockButtons',
   lockHint:['Button color lock', 'CLOSED — the button color is worked out from the body color and follows it: change the body, and buttons move with it.<br><br>OPEN — your own color stands, whatever the body is.<br><br>Your color is not lost while the lock is closed: it waits in the set and comes back the moment you open it. Picking a color by hand opens the lock by itself.']},
  {key:'text',    swatch:'#textColor', shows:'--text',
   hint:['Text color', 'The color of every letter in the program.<br><br>Labels under the knobs and the line about what is going on are written in a quieter shade of this same color: they should be readable, but not shout as loudly as the buttons.'],
   lock:'#textLock', lockKey:'lockText',
   lockHint:['Text color lock', 'CLOSED — the text color is worked out from the body: light letters on a dark body, dark on a light one. The quiet text — knob labels and the status line — steps a third of the way back towards the body.<br><br>OPEN — your own color stands.<br><br>Your color waits while the lock is closed, as with the buttons.']},
  {key:'markup',  swatch:'#markupColor',
   hint:['Markup color', 'The color of the grid and of the borders drawn OVER the artwork.<br><br>Its only job is to be visible on any paints: a green grid is lost in a forest, an orange one in a sunset. That is why it is kept apart from the colors of the program — the work changes, and this color has to change with it.'],
   lock:'#btnAutoColor', lockKey:'auto',
   lockHint:['Markup color lock', 'This one is not about the interface: the markup lies on the WORK, and its whole job is to be seen on any paints.<br><br>CLOSED — the color is picked from the image itself, so the grid never sinks into it; the pick is repeated whenever the work changes.<br><br>OPEN — your own color stands, and the automaton steps aside.']},
];
