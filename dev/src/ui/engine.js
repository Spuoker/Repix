// SPDX-License-Identifier: GPL-3.0-or-later
/* GTB LAYOUT — the shared interface engine.
   This is the canonical source used by Repix and by the other projects.
   It is embedded into the finished page; no separate release or runtime file. */

/* LIVE OBJECTS. A button built from a description with choice, pressed, dims
   or needs is asked again on every refresh, like the records of BUTTONS: the
   engine presses it in and dims it itself, whoever built it. */
const LIVE=new Set();
function refreshLive(){
  for(const el of LIVE){
    if(!el.isConnected){ LIVE.delete(el); continue; }
    el.disabled=dimmed(el._desc);
    el.classList.toggle('held', pressedNow(el._desc));
  }
}
/* THE ENGINE'S STANDARD — one table. Whatever an object's description does
   not say, it gets from here; an argument in the description is only ever
   a difference from it. A move needs nothing but its goal. */
const STANDARD={
  // A move: EVERYTHING THAT MOVES HAS MASS. Its speed is part of what it
  // is; a spring pulls it to its goal and a damper takes the speed off —
  // critically (`damping` 1): it gathers speed and slows by itself, never
  // passes a goal it is sent to, and a new goal on the way just turns it,
  // the speed kept. `ms` — the pace: the spring's stiffness is `stiff`/ms
  // (the way takes about 3·ms). A spring pulls hardest at the start, from
  // far — a leap: speeding up, it gathers at most `gather` a millisecond, and
  // slowing down it sheds at most `brake` times as much (a brake is stronger
  // than a motor; a turn back at speed runs on and slows first: its inertia
  // is seen); so it starts to brake in time, never faster than it can stop
  // in what is left. Never faster than `fastest` (both in units of
  // `least`); it has ARRIVED when it is within 2·least·arrive of the goal and
  // slower than least·arrive (least: grid pixels a millisecond).
  // ON A LEASH (`lag`, lines of text): on its way a thing is drawn no
  // farther from its goal than its leash while the window is dragged, and
  // never past the window's edge when its place is in the window. The leash
  // TIGHTENS, the stretch's law: a little behind, it is drawn where it is;
  // the farther, the harder the leash pulls, and the end is reached softly.
  follow:{ms:60, stiff:2, damping:1, arrive:1, least:0.25, fastest:24, gather:0.06, brake:2, lag:4},
  // A scroll: along which axis; `items` — what stands in it; `notch` — the
  // goal of one notch of the wheel (by 'line' or by 'item', how many); `end`
  // — where a move left by the hand (the bar let go, a finger lifted) is
  // taken on to (the nearest 'line' or 'item', or 'free'); `lead` — room
  // kept before the first item in view (a number or a function).
  scroll:{along:'y', items:null, notch:{by:'line', count:3}, end:{by:'line'}, lead:0,
          stretch:true, bar:true,
  // A WAY of scrolls (`then`): the wheel rests `rest` ms at each joint.
          rest:400,
  // THE BAR'S GOAL is continuous: between two moves of the hand it goes
  // along a line in the time the hand took (at most `gap` ms). The scroll
  // hangs on it by a SPRING WITH PLAY: softened over `soft` ms, never more
  // than `slack` lines behind.
          hand:{gap:200}, soft:60, slack:2,
  // INERTIA. A scroll has mass: let go, it keeps the speed it had. A finger
  // flicks it: it glides on, `decel` of its speed lost a millisecond, and
  // lands on the stop nearest where the glide would end. At an EDGE the
  // spring is softer (damping `edge`): what comes to it with way on it
  // passes it and is pulled back. A push of the wheel against an edge is a
  // blow of `push` grid pixels a millisecond.
          decel:0.004, edge:0.6, push:0.6,
  // THE GROUP THAT SCROLLS BY ITSELF: a box of these whose content does not
  // fit becomes a scroll (see adoptScrolls). Controls and pictures are not in it.
          spill:'div,section,article,aside,nav,main,header,footer,p,ul,ol,li,dl,dd,pre,blockquote,form,fieldset,details,table,td,th'},
  // Pulled past its end by the hand, a scroll STRETCHES: it gives way less
  // the further it is pulled, never more than `reach` of its view; let go,
  // it follows back to its end. At most `reach` of the view and never more
  // than `most` lines — reached when the hand is twice that past the end;
  // further it answers no more.
  stretch:{reach:0.5, most:3},
  line:10,        // grid pixels in a line of text
  // Coming into view and going out of it: the least time the whole way
  // takes, in ms (the opacity follows the same law as everything else).
  appear:{ms:240},
  vanish:{ms:120},
  // A color on its way to a new one (a theme switched): speed = distance
  // left in RGB / ms, never below `least` (RGB steps a millisecond).
  tint:{ms:60, least:1},
  // The pictures' view (see VIEW): let go on the way, it glides losing
  // `decel` of its speed a millisecond — twelve times a scroll's: a brake, no ice.
  // Its limits: the farthest — the whole picture `far` times smaller than
  // the window; the nearest — `near` cells of the grid across the window.
  view:{decel:0.048, spare:1.25, far:3, near:8},
  // THE GRID PIXEL by the room: one more screen pixel in it for every `room`
  // CSS pixels of the window's width, from `least` to `most`. The spacing of
  // the interface: `spacing` cells, `tight` of them where the window is
  // narrower than `narrow` CSS pixels.
  grid:{room:960, least:2, most:4, spacing:3, tight:2, narrow:560},
  // THE WINDOW IS BEING DRAGGED for `windowRest` ms after its last new size:
  // the browser tells of a new size, never of the hand let go.
  windowRest:300,
  // A scroll's bar: grid pixels wide.
  barWidth:5,
  // How many measured widths of words a line of text keeps.
  wordsKept:300,
  // What the hand gives a knob (the slider, the field, the arrows) is KEPT
  // BY ITS RULE, in this order:
  //   outside  — past the range: 'clamp' (to the edge) or 'refuse';
  //   multiple — {of, from}: only from + k·of (a number: of, from 0);
  //   round    — {to, way}: to decimals (the standard: the knob's digits),
  //              'nearest', 'down' or 'up' (a number: to);
  //   forbid   — values and [lo, hi] spans it may not be: it goes to the
  //              nearest allowed one past them, or is refused.
  // The field COUNTS: `math` — the operations it takes, of + - * / and
  // brackets (true — all, false — a bare number). ×, ÷, :, −, a comma are
  // read as * / / - and a point. What the program counts itself stands as
  // counted.
  knob:{math:true, outside:'clamp', multiple:null, round:{way:'nearest'}, forbid:null},
};
/* THE ARGUMENTS OF MOVING, one place for every object however it is built
   (a description, a record of BUTTONS, a window):
     follow  — false: stands at once; {ms, stiff, damping, gather, brake,
               fastest, arrive}: its own law (see THE ARGUMENTS of a move);
     goal    — {rel, side, gap, align, size}: its goal by what it is
               against — an object, its area or the window (see PLACE);
     stick   — {to, side, gap, align, span}: the same, against an object;
     appear, vanish — {ms}: its own time to come and to go;
     fades   — what comes and goes is this share (a CSS variable), not the
               whole object;
     background — it is a BACKGROUND: it stands where the layout puts it,
               with all in it, and is never moved on its way as an object
               (it may still come into view and go out). */
// What is placed by a goal against something (its _goal: the goal or
// stick argument, placeTo, stickTo).
const stuck=new Set();
/* WINDOW-PACED things (follow.window): the window's size is their trigger —
   once the frame's layout is final (a size observer, before paint), they,
   and only they, are settled: their new place, and their way to it. */
const WINDOW_PACED=new Set();
let windowPace=null;
/* The pace after the window is the AREA's: what lies in a window-paced thing
   (the parts of a line, its rows) goes at its pace too. */
function paceAfterWindow(x){
  const a=x && x.closest ? x.closest('[data-follow-window-ms]') : null;
  return a ? +a.dataset.followWindowMs : undefined;
}
var placesOld=false, windowRested=0;
// What a new size of the window resizes: the shelves and the windows shown.
const windowMoves=()=>new Set([...document.body.children].filter(x=>seen(x) || (!x.hidden && getComputedStyle(x).position==='fixed')));
/* THE PLACES NOTED ANEW after the window moved things: the shelves are
   settled as areas that came out another size (not deep) — what stands in
   them is asked, and an area is opened only where it too came out another
   size. As a step of the window: all of it at once. */
function noteAfterWindow(){
  if(!placesOld) return;
  placesOld=false; clearTimeout(windowRested);
  settle(windowMoves(), false, false, true);
}
function windowPaced(el){
  WINDOW_PACED.add(el);
  if(windowPace || !window.ResizeObserver) return;
  windowPace=new ResizeObserver(()=>{
    for(const x of WINDOW_PACED) if(!x.isConnected) WINDOW_PACED.delete(x);
    /* THE WINDOW MOVED THEM. A new size of the window shifts things with no
       word from the page, at once — nothing is to be done about it, and
       nothing is asked: the places the engine keeps are only marked old
       (placesOld). They are noted anew when they are needed — before the
       next change (see noteAfterWindow), or when the window has come to
       rest. Only while something is on its way (a shelf turning at a
       threshold) the step is settled now: its way goes on from where it is
       drawn. */
    const onWay = shelfGoing.size || floatGoing.size || turning.size || [...going.keys()].some(x=>paceAfterWindow(x)===undefined);
    if(onWay){ placesOld=false; settle(windowMoves(), false, false); }
    else { placesOld=true; clearTimeout(windowRested); windowRested=setTimeout(noteAfterWindow, STANDARD.windowRest); }
    if(WINDOW_PACED.size) settle(new Set(WINDOW_PACED), true);
  });
  windowPace.observe(document.documentElement);
}
/* THE ARGUMENTS ARE DECLARED ONCE, AND WHAT IS FORBIDDEN FOLLOWS FROM THEM
   (14.11, Makar: an argument that does not exist, or that cannot act where it
   is written, is refused - and the refusals are not a list of cases kept by
   hand, they come out of what the arguments are).
   Each argument says, once: on what it stands (`on` - a node, a window, a
   button's record, a knob, the arguments of moving), its CATEGORY, what it
   NEEDS beside it, what value it takes (`is`), and the arguments inside it
   (`of`). From that alone:
     - a word no argument of that kind declares is refused;
     - a category is a choice: of one category at most one argument (two that
       set the goal, two that say what a press does, two that write the
       content - one would silence the other);
     - a KIND (win, areas, buttons, knob) narrows what may stand beside it to
       what that kind takes (`kind` of the arguments);
     - an argument without the one it needs is refused;
     - a value of the wrong form is refused.
   And the declaration cannot fall behind the code: when the whole is checked
   (?check), every description is watched while the engine reads it - a word
   the engine reads but nobody declared is refused too. */
const NUM=v=>typeof v==='number' && Number.isFinite(v) && v>=0;
const IS={
  ms:[NUM, 'a number, 0 or more'], num:[NUM, 'a number, 0 or more'], bool:[v=>typeof v==='boolean', 'true or false'],
  text:[v=>typeof v==='string' || typeof v==='number', 'words'], str:[v=>typeof v==='string', 'a word'], fn:[v=>typeof v==='function', 'a function'],
  cssVar:[v=>typeof v==='string' && v.startsWith('--'), 'a CSS variable ("--name")'],
  flag:[v=>v===undefined || v===null || v===false || v===true || v==='' , 'true or false'],
  any:[()=>true, ''],
};
// name -> {on:[kinds], cat, needs, is:[test, said] | of:'spec', kind:[what it lets stand beside it] }
const ARG_SPEC={
  // --- moving (any object, however it is built) ---
  follow:{on:['node','window','button','move'], of:'follow', orFalse:true},
  goal:{on:['node','window','button','move'], cat:'goal', of:'goal'},
  stick:{on:['node','window','button','move'], cat:'goal', of:'stick'},
  appear:{on:['node','window','button','move'], of:'appear'},
  vanish:{on:['node','window','button','move'], of:'vanish'},
  fades:{on:['node','window','button','move'], is:IS.cssVar},
  rest:{on:['node','window','button','move'], is:IS.any},
  background:{on:['node','window','button','move'], is:IS.any},
  wanders:{on:['node','window','button','move'], is:IS.any},
  // --- a node: its kind ---
  win:{on:['node'], cat:'kind', kind:[]},
  areas:{on:['node'], cat:'kind', is:IS.str, kind:['divider','wanders']},
  buttons:{on:['node'], cat:'kind', is:IS.str, kind:['field']},
  knob:{on:['node'], cat:'kind', of:'knob', kind:'all but content'},
  divider:{on:['node'], needs:'areas', is:IS.any},
  field:{on:['node'], needs:'buttons', is:IS.str},
  // --- a node: what it is made of ---
  tag:{on:['node'], is:IS.str}, id_:{on:['node','button'], is:IS.str}, cls:{on:['node'], is:IS.str},
  text:{on:['node'], cat:'content', is:IS.text}, inner:{on:['node'], cat:'content', is:IS.str},
  onto:{on:['node'], is:[v=>Array.isArray(v), 'a list of nodes'], content:true},
  props:{on:['node'], is:IS.any}, page:{on:['node'], is:IS.any}, data:{on:['node'], is:IS.any},
  // --- a node: its layout ---
  even:{on:['node'], is:IS.any}, clip:{on:['node'], is:IS.any}, hug:{on:['node'], is:IS.any}, fill:{on:['node'], is:IS.any},
  scrolls:{on:['node'], is:[v=>typeof v==='boolean' || (v && typeof v==='object'), 'true, false or its arguments']},
  align:{on:['node'], of:'align', orWord:['start','end','center']},
  squeezes:{on:['node'], is:IS.any}, ribbon:{on:['node'], is:IS.any}, lodges:{on:['node'], is:IS.any},
  strip:{on:['node'], is:IS.any}, slides:{on:['node'], is:IS.any}, rolls:{on:['node'], is:IS.any}, pinned:{on:['node'], is:IS.any},
  // --- a button (a node or a record of BUTTONS) ---
  held:{on:['node'], is:IS.any}, off:{on:['node'], is:IS.any},
  choice:{on:['node','button'], cat:'action', is:IS.any}, link:{on:['node','button'], cat:'action', is:IS.any},
  click:{on:['node'], cat:'action', is:IS.fn},
  pressed:{on:['node','button'], is:IS.any}, dims:{on:['node','button'], is:IS.any}, needs:{on:['node','button'], is:IS.any},
  hint:{on:['node','button'], is:IS.any}, always:{on:['node','button'], needs:'hint', is:IS.any},
  calls:{on:['button'], is:IS.any}, group:{on:['button'], is:IS.any}, hollow:{on:['button'], is:IS.any}, icon:{on:['button'], is:IS.any},
  label:{on:['button','window'], is:IS.any}, paint:{on:['button'], is:IS.any}, place:{on:['button'], is:IS.str},
  shorter:{on:['button'], is:IS.any}, shown:{on:['button'], is:IS.any}, still:{on:['button'], is:IS.any}, value:{on:['button'], is:IS.any},
  // --- a window of a picture ---
  caption:{on:['window'], is:IS.str}, canvas:{on:['window'], is:IS.str}, picture:{on:['window'], of:'move'}, captionArgs:{on:['window'], of:'move'},
};
// The arguments inside arguments - the same declaration, smaller.
const SUB_SPEC={
  follow:{ms:{is:IS.ms}, fastest:{is:IS.num}, stiff:{is:IS.num}, damping:{is:IS.num}, gather:{is:IS.num}, brake:{is:IS.num},
          lag:{is:IS.num}, arrive:{is:IS.num}, window:{of:'followWindow'}},
  followWindow:{ms:{is:IS.ms}},
  appear:{ms:{is:IS.ms}}, vanish:{ms:{is:IS.ms}, withWay:{is:IS.bool}},
  goal:{rel:{is:IS.any}, side:{is:IS.any}, gap:{is:IS.any}, align:{is:IS.any}, size:{is:IS.any}, divides:{is:IS.any}},
  stick:{to:{is:IS.any, must:true}, side:{is:IS.any}, gap:{is:IS.any}, align:{is:IS.any}, span:{is:IS.any}, size:{is:IS.any}},
  align:{rows:{is:IS.any}, bottom:{is:IS.any}},
  knob:{caption:{is:IS.any}, change:{is:IS.any}, curve:{is:IS.any}, digits:{is:IS.any}, fold:{is:IS.any}, hint:{is:IS.any},
        inMenu:{is:IS.any}, limits:{is:IS.any}, max:{is:IS.any}, min:{is:IS.any}, settle:{is:IS.any}, step:{is:IS.any}, value:{is:IS.any},
        math:{is:IS.any}, outside:{is:IS.any}, multiple:{is:IS.any}, round:{is:IS.any}, forbid:{is:IS.any}},
};
// What the engine itself writes into a record (not the description's word): read, never refused.
const OWN_WORDS={button:['node']};
const ARGS_OF=kind=>kind==='move' ? Object.keys(ARG_SPEC).filter(n=>ARG_SPEC[n].on.includes('move'))
                                  : Object.keys(ARG_SPEC).filter(n=>ARG_SPEC[n].on.includes(kind));
/* A REFUSAL IS SEEN (Makar: right before the eyes, not only in the console): a
   band over the page says it, whatever was built or not. The whole
   configuration can be gone through at once (the page opened with ?check, as
   the checking tool does - dev/tools/check_args.py): then nothing stops at the
   first refusal, every one is gathered and shown, and the page keeps them in
   its root's data-refusals for the tool to read. */
const CHECK_ALL=typeof location!=='undefined' && /[?&]check\b/.test(location.search);
const refusals=[];
function showRefusals(){
  if(!document.body){ addEventListener('DOMContentLoaded', showRefusals, {once:true}); return; }
  let band=document.getElementById('engineRefusals');
  if(!band){
    band=document.createElement('div'); band.id='engineRefusals'; band.dataset.follow='no';
    band.style.cssText='position:fixed;left:0;right:0;top:0;z-index:2147483647;max-height:60vh;overflow:auto;'
      +'background:#b00020;color:#fff;font:14px/1.45 Consolas,monospace;padding:10px 14px;white-space:pre-wrap;box-shadow:0 2px 12px #0008';
    document.body.appendChild(band);
  }
  band.textContent=`ENGINE REFUSED ${refusals.length} DESCRIPTION${refusals.length>1?'S':''}${CHECK_ALL?' (whole check)':''}:\n`+refusals.map(r=>'• '+r).join('\n');
  document.documentElement.dataset.refusals=JSON.stringify(refusals);
}
function refuse(who, why){
  const msg=`engine refuses ${who}: ${why}`;
  if(refusals.includes(msg)) return;
  refusals.push(msg); showRefusals();
  if(!CHECK_ALL) throw new Error(msg);
}
const nameOf=oo=>oo && (oo.id_ || oo.caption || oo.cls || oo.tag || oo.label);
const whoIs=(oo, kind)=>`the ${kind} ${nameOf(oo) ? `"${nameOf(oo)}"` : '(no name)'}`;
// One value against its declaration (and what is inside it).
function checkValue(name, v, spec, who){
  if(v===undefined || v===null) return;
  if(spec.orFalse && v===false) return;
  if(spec.orWord && typeof v==='string'){ if(!spec.orWord.includes(v)) refuse(who, `${name} is ${spec.orWord.join(', ')} or {${Object.keys(SUB_SPEC[spec.of]).join(', ')}}`); return; }
  if(spec.of){
    if(typeof v!=='object') refuse(who, `${name} is {${Object.keys(spec.of==='move' ? Object.fromEntries(ARGS_OF('move').map(k=>[k,1])) : SUB_SPEC[spec.of]).join(', ')}}${spec.orFalse ? ' or false' : ''}`);
    else if(spec.of==='move') checkArgs(v, 'move', `${who} (${name})`);
    else checkSub(v, spec.of, `${who} (${name})`);
    return;
  }
  if(spec.is && !spec.is[0](v)) refuse(who, `${name} is ${spec.is[1]}`);
}
function checkSub(oo, specName, who){
  const S=SUB_SPEC[specName];
  for(const k of Object.keys(oo)) if(!S[k]) refuse(who, `"${k}" is no argument here (it takes: ${Object.keys(S).join(', ')})`);
  for(const [k,s] of Object.entries(S)){
    if(s.must && oo[k]===undefined) refuse(who, `it needs "${k}"`);
    if(oo[k]!==undefined) checkValue(k, oo[k], s, who);
  }
}
/* A description against the declaration: its words, its kind, its categories,
   what each needs, each value. The arguments it may take are those declared on
   its kind, narrowed by the kind it names (win, areas, buttons, knob). */
function checkArgs(oo, kind, who=whoIs(oo, kind)){
  if(!oo || typeof oo!=='object') return oo;
  const given=Object.keys(oo).filter(k=>oo[k]!==undefined && oo[k]!==null);   // (null: not given)
  let allowed=new Set(ARGS_OF(kind));
  // its kind narrows the rest
  const kinds=given.filter(k=>ARG_SPEC[k] && ARG_SPEC[k].cat==='kind' && allowed.has(k));
  if(kinds.length===1){
    const K=ARG_SPEC[kinds[0]].kind;
    if(K==='all but content') for(const k of [...allowed]){ const s=ARG_SPEC[k]; if(s.cat==='content' || s.content) allowed.delete(k); }
    else allowed=new Set([kinds[0], ...K]);
  }
  for(const k of given){
    if(allowed.has(k) || (OWN_WORDS[kind]||[]).includes(k)) continue;
    if(ARG_SPEC[k] && ARG_SPEC[k].on.includes(kind)) refuse(who, `"${k}" cannot act beside ${kinds[0]} (beside it: ${[...allowed].filter(a=>a!==kinds[0]).join(', ') || 'nothing'})`);
    else refuse(who, `"${k}" is no argument of a ${kind} (it takes: ${[...allowed].join(', ')})`);
  }
  // a category is a choice: one at most
  const byCat={};
  for(const k of given){ const s=ARG_SPEC[k]; if(s && s.cat && allowed.has(k)) (byCat[s.cat]=byCat[s.cat]||[]).push(k); }
  for(const [c,ks] of Object.entries(byCat)) if(ks.length>1) refuse(who, `${ks.join(' and ')} are of one category (${c}) - one of them, or the other is silenced`);
  // what each needs
  for(const k of given){ const s=ARG_SPEC[k]; if(s && s.needs && allowed.has(k) && oo[s.needs]===undefined) refuse(who, `"${k}" needs "${s.needs}" beside it`); }
  // each value
  for(const k of given) if(ARG_SPEC[k] && allowed.has(k)) checkValue(k, oo[k], ARG_SPEC[k], who);
  return CHECK_ALL ? watchReads(oo, kind, who) : oo;
}
/* THE DECLARATION CANNOT FALL BEHIND (?check): the description is handed on
   watched - a word the engine reads from it that no argument of its kind
   declares is refused (the code learnt a word the declaration does not know). */
const undeclaredReads=new Map();   // kind:word -> {first, n}: said once, counted
function watchReads(oo, kind, who){
  const ok=new Set([...ARGS_OF(kind), ...(OWN_WORDS[kind]||[])]);
  return new Proxy(oo, {get(t, k, r){
    if(typeof k==='string' && !ok.has(k) && !(k in Object.prototype) && k!=='then' && k!=='toJSON'){
      const key=kind+':'+k, u=undeclaredReads.get(key);
      if(u){ u.n++; const at=refusals.indexOf(u.msg); u.msg=`the engine reads "${k}" from a ${kind}, which no argument declares (first at ${u.first}; ${u.n} ${kind}s) - declare it in ARG_SPEC`; if(at>=0){ refusals[at]=u.msg; showRefusals(); } }
      else { const msg=`the engine reads "${k}" from a ${kind}, which no argument declares (first at ${who}) - declare it in ARG_SPEC`;
             undeclaredReads.set(key, {first:who, n:1, msg}); refusals.push(msg); showRefusals(); if(!CHECK_ALL) throw new Error(msg); }
    }
    return Reflect.get(t, k, r);
  }});
}
const checkNode=oo=>checkArgs(oo, 'node');
const checkWindow=oo=>checkArgs(oo, 'window');
const checkButton=kk=>checkArgs(kk, 'button');
/* WHAT MAY GO TO ANOTHER AREA (the `wanders` argument; the engine's own: the
   parts of a line of text, a shelf that lodges). Before a named change the
   engine notes where these are drawn — these, not the page: a thing put
   into another area comes from exactly there. One that went unannounced is
   known from then on. */
const WANDERERS=new Set();
function moveArgs(el, oo){
  if(oo && oo.wanders) WANDERERS.add(el);
  if(!oo) return;
  if(oo.follow===false) el.dataset.follow='no';
  else if(oo.follow){
    if(oo.follow.ms!==undefined) el.dataset.followMs=oo.follow.ms;
    for(const k of ['fastest','stiff','damping','gather','brake','lag'])
      if(oo.follow[k]!==undefined) el.dataset['follow'+k[0].toUpperCase()+k.slice(1)]=oo.follow[k];
    if(oo.follow.arrive!==undefined) el.dataset.followArrive=oo.follow.arrive;
    // Its pace after the WINDOW: while the window changes size it goes to
    // its new place at this pace (the standard: it stands there at once).
    if(oo.follow.window && oo.follow.window.ms!==undefined){ el.dataset.followWindowMs=oo.follow.window.ms; windowPaced(el); }
  }
  if(oo.fades) el.dataset.fadeVar=oo.fades;
  if(oo.rest) el.dataset.rest='';
  if(oo.goal){ el._goal=oo.goal; stuck.add(el); }
  if(oo.stick){ const k=oo.stick; el._goal={rel:k.to, side:k.side||'downward', gap:k.gap, align:k.align,
    size: k.span ? {[k.side==='left'||k.side==='right' ? 'h' : 'w']:'span'} : k.size}; stuck.add(el); }
  if(oo.background) el.dataset.background='';
  if(oo.appear && oo.appear.ms) el.dataset.appearMs=oo.appear.ms;
  if(oo.vanish && oo.vanish.ms) el.dataset.vanishMs=oo.vanish.ms;
  if(oo.vanish && oo.vanish.withWay) el.dataset.vanishWithWay='';   // a ghost fades as its way goes (see ghostsFade)
}
function buildNode(oo){
  oo=checkNode(oo);                // an argument it does not know, or one that cannot act here: refused (watched while read, under ?check)
  if(oo.win) return assembleWindow(oo.win);
  if(oo.areas){
    const el=document.createElement('div'); el.id=oo.areas; el.className='areas';
    AREA_DIVIDERS.set(el, oo.divider||'');
    if(oo.wanders) WANDERERS.add(el);
    return el;
  }
  /* A PLACE FOR BUTTONS is a node too, and the order "name, then buttons,
     then status line" is set here, not in the engine. A place with a field is
     the field its clusters are laid out in; one without is an invisible mark
     the buttons stand in front of. The engine finds places by their name in
     BUTTON_PLACES — a button record names its place, never an element id. */
  if(oo.buttons){
    const mm=oo.field ? Object.assign(document.createElement('div'),{id:oo.field})
                      : Object.assign(document.createElement('i'),{hidden:true});
    BUTTON_PLACES[oo.buttons]=mm; return mm;
  }
  // A knob is a label: a click on its caption goes to its field.
  const el=document.createElement(oo.tag||(oo.knob?'label':'div'));
  if(el.tagName==='BUTTON') el.type='button';
  if(oo.id_) el.id=oo.id_;
  if(oo.cls) el.className=oo.cls;
  if(oo.text!==undefined) el.textContent=oo.text;
  if(oo.inner) el.innerHTML=oo.inner;
  if(oo.props) for(const kk in oo.props) el[kk]=oo.props[kk];
  if(oo.page) el.dataset.page=oo.page;
  if(oo.data) for(const kk in oo.data) el.dataset[kk]=oo.data[kk];
  // The layout arguments (see the rules: even, clip, hug, scrolls, pinned).
  for(const aa of ['even','clip','hug','fill','scrolls']) if(oo[aa]) el.dataset[aa]='';
  if(oo.scrolls) makeScroll(el, oo.scrolls===true ? {} : oo.scrolls);
  else if(oo.scrolls===false) el.dataset.scrolls='no';      // out of the group that scrolls by itself
  /* ALIGN — where the content is pressed: one word for every case
     ('start', 'end', 'center'), or by case for what gives way in rows
     ({rows, bottom}: its parts broken in place, and the row of its own). */
  if(typeof oo.align==='string') el.dataset.align=oo.align;
  else if(oo.align){ if(oo.align.rows) el.dataset.alignRows=oo.align.rows; if(oo.align.bottom) el.dataset.alignBottom=oo.align.bottom; }
  moveArgs(el, oo);
  if(oo.squeezes){ el.dataset.squeezes=''; el._squeezes=oo.squeezes; }
  if(oo.ribbon) el.dataset.ribbon='';
  if(oo.lodges){ el.dataset.lodges=''; el._lodges=oo.lodges; }
  if(oo.strip) makeStrip(el, oo.strip);
  if(oo.slides) makeSlides(el, oo.slides);
  if(oo.rolls) makeRolls(el, oo.rolls);
  // A knob fills the node with its own parts; the other arguments of the
  // description still apply to it.
  if(oo.knob) makeKnob(oo.knob, el);
  if(oo.pinned) el.dataset.pinned=oo.pinned;
  // A button's own: pressed in, dimmed, what it does, where it leads, its hint
  // (always — shown even with Hints off).
  if(oo.held) el.classList.add('held');
  if(oo.off) el.disabled=true;
  if(oo.choice || oo.pressed || oo.dims || oo.needs){
    el._desc=oo; LIVE.add(el);
    el.disabled=dimmed(oo); el.classList.toggle('held', pressedNow(oo));
  }
  if(oo.link) makeLink(el, oo.link);
  else if(oo.click) el.onclick=oo.click;
  else if(oo.choice) el.onclick=()=>{ if(el.disabled) return; smoothly(()=>{ act(oo); refreshButtons(); }); };
  if(oo.hint) attachHint(el, oo.hint, !!oo.always);
  if(oo.onto && !oo.knob) for(const vv of oo.onto){ const dd=buildNode(vv); if(dd) el.appendChild(dd); }
  return el;
}
/* An areas shelf's divider is its argument: empty means a plain line. */
const AREA_DIVIDERS=new Map();

const BUTTON_PLACES={};
function arrangeAreas(){
  for(const [shelf, divider] of AREA_DIVIDERS){
    // Dividers that already stand where they should are left alone: the page
    // is written only when the areas changed.
    const have=[...shelf.querySelectorAll(':scope > [data-divider]')];
    const now=[...shelf.children].filter(x=>!x.hidden && !('divider' in x.dataset));
    const asItIs=have.length===Math.max(0, now.length-1) && have.every((mm,i)=>mm.nextElementSibling===now[i+1]
      && (typeof divider!=='function' || mm===divider()));
    if(asItIs) continue;
    for(const mm of have) mm.remove();
    const areas=[...shelf.children].filter(x=>!x.hidden);
    // A divider is a drawing (text of an icon, empty for a plain line) or a
    // control — a function giving the node. A control is one node, so it can
    // stand on one shelf only: the shelf laid out last with two areas takes it.
    for(let i=1;i<areas.length;i++){
      const node = typeof divider==='function' ? divider()
                 : Object.assign(document.createElement('i'),{className:'areaDivider', innerHTML:divider});
      node.dataset.divider='1';
      shelf.insertBefore(node, areas[i]);
    }
  }
}
function buildView(){
  const bodyEl=document.body;
  for(const node of SHELVES.concat(FLOATING)) bodyEl.appendChild(buildNode(node));
  // A sliding shelf's grip stands right before it (see makeSlides) — and
  // before the strips that sit on its top edge, or its tabs would cover
  // their tiles: it hangs over the windows, never over something to press.
  for(const el of SLIDING){
    let at=el;
    while(at.previousElementSibling && at.previousElementSibling.classList.contains('strip')) at=at.previousElementSibling;
    at.before(el._grip);
  }
}
/* SLIDES — an argument of a shelf at the bottom: a grip on its top edge
   hides the shelf whole under the screen or brings it back, and the shelves
   above take the room. The grip stands on a line of no height before the
   shelf, so it rides the shelf's top edge wherever that is — at the bottom
   of the screen when the shelf is gone. Hidden or not is kept per viewer
   (0 or 1): another stage is another height, and a hidden shelf stays
   hidden. */
const SLIDING=[];
/* A LAYOUT CHANGES A SHELF'S HEIGHT — a slid one takes its offset for the
   new height in the same pass, before the engine sets out to move anything:
   else its top would show for a moment and slide away again. */
function reputSlid(){ for(const el of SLIDING) if(el._reput) el._reput(); }
function gripOf(el){
  if(!el._grip){ el._grip=Object.assign(document.createElement('div'),{className:'grip'}); SLIDING.push(el); }
  return el._grip;
}
/* ROLLS — an argument of a shelf: {field, items}. The shelf's grip (slides)
   turns the field, in its round, between FOLDS (the engine folds its groups into rows,
   everything in view) and ONE ROW that scrolls sideways with shutters at the
   edges, like a strip — the shelf then takes the least height. In one row
   nothing folds and no label is shortened: what does not fit is scrolled
   to. Kept per viewer. */
function makeRolls(el, rr){
  const key='repix.rolled.'+el.id;
  /* One row is chosen (the round of the grip) or taken BY ITSELF: a shelf
     that, all in view, would take more than TALLEST of the window's height
     rolls itself into one row instead of being cut, and unrolls when it has
     the room again. ONE EDGE, at TALLEST, the same both ways: it is asked
     with the height its fold would have (from the data, never tried out),
     which does not depend on whether it is rolled — so the edge stands still
     and nothing can throw it to and fro. Asked anew for another height or
     width of the window. `rolled` is what
     stands: chosen or by itself. */
  // A third of the window: past that the pictures are left too little.
  const TALLEST=1/3;
  let chosen=false, auto=false, rolled=false, shut=null;

  try{ chosen=localStorage.getItem(key)==='yes'; }catch(_){}
  rolled=chosen;
  /* SQUEEZES — an argument of an object on a rolling shelf: the parts that
     are pushed DOWN, in the order they stand there. When the shelf is one
     row they always go below — who goes down and who stays is the argument,
     not the room. The object is as tall as the row's items, with a scroll
     bar that is always there, and as wide as its widest row without those
     parts — every button counted as wide as the widest one, the object being
     even. The wheel on the row goes on into the object (see RIBBON, turn). */
  const sinkers=()=>[...el.querySelectorAll('[data-squeezes]')];
  const itemsOf=field=>[...field.querySelectorAll(rr.items)].filter(seen).map(x=>[x, x.getBoundingClientRect()]);
  let sunkFor='', rowTall=null, measuredAt=-1;
  /* WHEN IT IS ASKED ANEW: when the field is laid out, and when one of the
     things it is measured by — an item of the row, a button of the object —
     comes out another size: the browser tells of exactly those (watchSizes).
     A new size of the field's own box (the window, the shelf on its way) is
     no such thing: then only the way is drawn. */
  const sized=new Set(), unsaid=new WeakSet(); let sizes=null;
  const watchSizes=field=>{
    if(!window.ResizeObserver) return;
    // (Told of another size: measured anew whatever the words are. The first
    // word about a thing is only that it is watched — no new size.)
    if(!sizes) sizes=new ResizeObserver(list=>{
      let other=false;
      for(const e of list){ if(unsaid.has(e.target)) unsaid.delete(e.target); else other=true; }
      if(other) sinkOnce(false, true);
    });
    for(const x of sized) if(!x.isConnected){ sizes.unobserve(x); sized.delete(x); }
    for(const x of [...field.querySelectorAll(rr.items), ...sinkers().flatMap(bb=>[...bb.querySelectorAll('button')])])
      if(!sized.has(x)){ sized.add(x); unsaid.add(x); sizes.observe(x); }
  };
  const sink=bySize=>{ sinkOnce(bySize===true); };
  const sinkOnce=(bySize, anew)=>{
    const field=el.querySelector(rr.field); if(!field) return false;
    if(bySize!==true) watchSizes(field);
    const sized = bySize===true && rowTall!==null;
    const itemBoxes = sized ? [] : itemsOf(field), hh = sized ? rowTall : Math.max(0, ...itemBoxes.map(([,r])=>r.height));
    rowTall=hh; if(!sized) measuredAt=field.clientHeight;
    // What it depends on: one row or not, the row's height, the scale and
    // the object's buttons. The same — only the bar is redrawn.
    // Nothing to roll when all stands in one row anyway: the knobs in one
    // row, and nothing on the field taller than that row (the stage block
    // in a column is). The round then skips the one-row step. Asked every
    // time: other knobs (Fine) are another answer.
    if(!rolled && !sized){
      const row=Math.max(0, ...itemBoxes.map(([x])=>x.offsetHeight));
      rollable = new Set(itemBoxes.map(([x,r])=>laidTop(x, r))).size>1
        || [...field.children].some(c=>seen(c) && c.offsetHeight > row+gridPixel()*2);
    }
    const key=[rolled, hh, gridPixel(), ...sinkers().flatMap(bb=>[...bb.querySelectorAll('button')]
                 .filter(b=>!b.hidden).map(b=>b.textContent))].join('|');
    if(key===sunkFor && !anew){ drawWay(); return false; }
    sunkFor=key;
    for(const bb of sinkers()){
      const parts=bb._squeezes.flatMap(q=>[...bb.querySelectorAll(q)]);
      for(const pp of parts){ pp.classList.remove('sunk'); pp.style.order=''; }
      bb.style.width=''; bb.style.maxHeight='';
      bb.classList.toggle('sinking', rolled);
      if(!rolled || !hh){ scrollAt(bb, 0); continue; }
      // Pushed down first, then the rows are levelled anew: a button is as
      // wide as the widest of ITS row, and the parts that went down no
      // longer stand in the row above.
      parts.forEach((pp,i)=>{ pp.classList.add('sunk'); pp.style.order=String(1+i); });
      evenOut();
      // Its width by what stays above, the bar included; the buttons
      // measured at their own width, not stretched.
      bb.style.width='max-content'; bb.classList.add('measuring');
      const kept=[...bb.querySelectorAll('button')].filter(x=>seen(x) && !parts.includes(x));
      // Each row as wide as its own buttons, each counted as wide as the
      // widest of that row (the object is even by rows); the widest row sets
      // the width. What went down counts nowhere.
      let ww=0;
      for(const row of bb.children){
        const mine=kept.filter(x=>row.contains(x)); if(!mine.length) continue;
        const most=Math.max(...mine.map(x=>x.getBoundingClientRect().width));
        const gap=parseFloat(getComputedStyle(row).columnGap)||0;
        ww=Math.max(ww, mine.length*most+(mine.length-1)*gap);
      }
      bb.classList.remove('measuring');
      bb.style.width=Math.ceil(ww)+'px';
      bb.style.maxHeight=hh+'px';
    }
    drawWay();
    return true;
  };
  /* RIBBON (an argument of the object): in one row the knobs and the
     object are ONE WAY of the engine's scroll (`then`): the wheel anywhere on
     the shelf goes through the knobs, rests at their end, then down the
     object; the bar in the object shows the whole way; a finger, a let-go —
     all the engine's, as for any scroll. */
  const rider=()=>rolled ? el.querySelector('[data-ribbon].sinking') : null;
  const drawWay=()=>{ const f=el.querySelector(rr.field); if(f && f._drawWay) f._drawWay(); };
  let watched=false;
  // The field dressed for what stands: one row or folds.
  const dress=field=>{
    field.classList.toggle('rolled', rolled);
    // One row gives way to its neighbours on the shelf and scrolls instead;
    // it never wraps, whatever the field's own rule says.
    field.style.flexBasis = rolled ? '0' : '';
    field.style.flexWrap = rolled ? 'nowrap' : '';
    for(const mm of [...field.querySelectorAll(':scope > .more_')]) mm.remove();
    if(rolled && shut){ field.prepend(shut.shutter('left_')); field.append(shut.shutter('right_')); }
    else { scrolling.delete(field); field.scrollLeft=0; field._at=0; }
  };
  /* Asked by the packing BEFORE anything is shown, with the height the
     chosen fold will have: too tall — it rolls now (by itself), dressed at
     once, and the packing lays it out as one row. */
  // The same decision asked for a fold height h, nothing changed (a band).
  el._rollWould=h=>chosen ? true : h > innerHeight*TALLEST;
  // The window heights this decision holds for, at a fold height h.
  el._rollChosen=()=>chosen;
  el._rollBand=h=>{
    if(chosen) return [0, Infinity];
    return rolled ? [0, h/TALLEST] : [h/TALLEST, Infinity];
  };
  el._rollDecide=h=>{
    // Chosen — one row whatever the room. By itself — one row when all in
    // view would be taller than TALLEST of the window, all in view when not.
    const want = el._rollWould(h);
    auto = want && !chosen;
    if(want!==rolled){
      rolled=want;
      turning.add(shelfOf(el));
      const field=el.querySelector(rr.field); if(field) dress(field);
    }
    return rolled;
  };
  let putting=false, again=false;
  const put=()=>smoothly(putAll);
  const putAll=()=>{
    if(putting){ again=true; return; }
    putting=true;
    try{ let n=0; do{ again=false; putNow(); } while(again && ++n<3); }
    finally { putting=false; }
  };
  const putNow=()=>{
    const field=el.querySelector(rr.field); if(!field) return;
    if(!shut){
      // The object riding the row scrolls by whole rows of its buttons, and
      // has no bar of its own: the way's bar stands in it.
      for(const bb of el.querySelectorAll('[data-ribbon]'))
        makeScroll(bb, {items:'button', notch:{by:'item', count:1}, end:{by:'item'}, bar:false});
      // The row and the object: one way, taken anywhere on the shelf.
      shut=makeShutters(field, rr.items, true, {then:rider, area:el});
    }
    if(!watched && window.ResizeObserver){
      watched=true;
      // Another stage has other knobs: the block follows the row's height.
      // (A new size of the field's box is no new height of its items: those
      // are measured when the field is laid out — only the way is drawn.)
      // While the shelf is on its way its height is the engine's drawing, and
      // a new width alone changes no row: then only the way is drawn. Come to
      // another height that is the layout's own, it is measured as it stands.
      new ResizeObserver(()=>sink(shelfGoing.has(el) || field.clientHeight===measuredAt)).observe(field);
    }
    if(!AFTER_LAYOUT.includes(sink)) AFTER_LAYOUT.push(sink);
    dress(field);
    sink();
    relayout(true);          // runs sink again (AFTER_LAYOUT), and sink draws the bar
    shut.edges();
  };
  /* THE ROUND, driven by the shelf's grip (slides), one press a step:
     all in view (folds) -> one row -> hidden -> all in view. Pulled, it
     steps the way it is pulled. The rolls argument has no tab of its own. */
  let rollable=true;
  const setRolled=v=>{ chosen=v; rolled=chosen||auto; try{ localStorage.setItem(key, chosen?'yes':'no'); }catch(_){} put(); };
  // Another window size: what was rolled by itself tries all in view again,
  // and rolls once more if it still does not fit.
  // The window's HEIGHT is a trigger too: its band of heights (see
  // packClusters) — a height past it lays the field out anew.
  let lastH=innerHeight;
  addEventListener('resize',()=>{
    if(Math.abs(innerHeight-lastH)<0.5) return;
    lastH=innerHeight;
    if(!BLIND.size) return;                // its band of heights tells by itself
    relayout();
  });
  el._round=dir=>{
    const hidden = el._slid && el._slid();
    if(dir>0){                                   // on: toward hidden
      if(hidden) return;
      if(!rolled && rollable) setRolled(true); else el._slide(true);
    } else if(dir<0){                            // back: toward all in view
      if(hidden) el._slide(false);
      else if(rolled) setRolled(false);
    } else {                                     // a press: the next in the round
      if(hidden){ if(rolled) setRolled(false); el._slide(false); }
      else if(!rolled && rollable) setRolled(true);
      else el._slide(true);
    }
  };
  setTimeout(put, 0);   // once the shelf is built and in the page
}
function makeSlides(el, ss){
  const tab=buildNode({tag:'button', cls:'gripTab', inner:ICON_SLIDE_DOWN, hint:ss.hint, follow:{window:{ms:20}}});
  gripOf(el).appendChild(tab);
  const key='repix.slid.'+el.id;
  let share=0;
  try{ share=Math.min(1, Math.max(0, +localStorage.getItem(key)||0)); }catch(_){}
  const OWN=['maxHeight','marginBottom','overflowY','boxSizing'];
  // The shelf's height as the layout gives it, without the slide.
  const tall=()=>{
    const was=OWN.map(kk=>el.style[kk]);
    for(const kk of OWN) el.style[kk]='';
    const hh=el.getBoundingClientRect().height;
    OWN.forEach((kk,i)=>{ el.style[kk]=was[i]; });
    return hh;
  };
  const put=px=>{
    const hh=tall(), off=Math.min(hh, Math.max(0, px));
    for(const kk of OWN) el.style[kk]='';
    // A shelf in one row (rolls) gets no scroll of its own when slid: it
    // simply goes under the screen by as much.
    if(off>0 && el.querySelector('.rolled')){
      el.style.marginBottom=-off+'px';
    } else if(off>0){
      // The part in view scrolls; below its own padding and edge it cannot
      // shrink, and the rest goes under the screen whole.
      const cs=getComputedStyle(el);
      const least=(parseFloat(cs.paddingTop)||0)+(parseFloat(cs.paddingBottom)||0)+(parseFloat(cs.borderTopWidth)||0);
      const seen=hh-off;
      el.style.boxSizing='border-box'; el.style.overflowY='auto';
      el.style.maxHeight=Math.max(seen, least)+'px';
      if(seen<least) el.style.marginBottom=-(least-seen)+'px';
    }
    const gone = hh>0 && off>=hh-0.5;
    if(tab._gone!==gone){ tab._gone=gone; tab.innerHTML = gone ? ICON_SLIDE_UP : ICON_SLIDE_DOWN; }
    return hh>0 ? off/hh : 0;
  };
  const keep=()=>{ try{ localStorage.setItem(key, share); }catch(_){} };
  // What stays in view scrolls a row of its items per notch.
  makeScroll(el, {items:ss.items||'*', notch:{by:'item', count:1}, end:{by:'item'}});
  /* SHOWN OR HIDDEN, nothing between: a press on the grip hides the shelf
     or brings it back; a pull on it does the same, the way it is pulled.
     The arrow says where the next press goes. */
  share = share>0.5 ? 1 : 0;
  el._slid=()=>share>=1;
  // How tall it stands before it scrolls: the part in view while slid.
  el._scrollLimit=()=>{ const mh=parseFloat(el.style.maxHeight); return el.style.overflowY==='auto' && mh>0 ? mh : Infinity; };
  el._slide=v=>{
    // The hand's word stands over the shelf's own (see `own` below): shown by
    // hand, it stays in view until the window has room for it again.
    byItself=false; if(!v) heldOpen=true;
    smoothly(()=>{ share=put(v ? tall() : 0); }); share=share>0.5?1:0; keep();
  };
  /* IT HIDES BY ITSELF — the last step of its own round, taken when the
     steps before it are not enough. A shelf that stands as low as it can
     (one row, if it rolls) and still takes more than MOST of the window's
     height leaves the pictures too little: it goes under the screen, its
     tab stays, and it comes back by itself when the window is tall enough.
     ONE EDGE, the window's height at which its lowest height is MOST of it —
     given to the browser like a band's; nothing is asked between. Not kept
     with the settings: it is the window's doing, not a choice. */
  const MOST=1/3;          // the same third a rolling shelf rolls at (TALLEST)
  let byItself=false, heldOpen=false;
  const own=()=>{
    if(from || shelfGoing.has(el)) return;
    const lowest = !el._rollDecide || !!el.querySelector('.rolled');
    const hh=tall(), edge=hh/MOST, want = lowest && hh>0 && innerHeight<edge;
    tellEdges(tab, hh>0 ? edgesQuery(-Infinity, Infinity, 0, want ? 0 : edge, want ? edge : undefined) : '', own);
    if(!want){
      heldOpen=false;
      if(byItself){ byItself=false; smoothly(()=>{ share=put(0); }); share=0; }
      return;
    }
    if(!heldOpen && share<1){ byItself=true; smoothly(()=>{ share=put(tall()); }); share=1; }
  };
  // Slid away, it stays away whatever its new height: the offset is put anew
  // in the same layout that changed the height (see reputSlid).
  el._reput=()=>{ if(!from && share>0) put(share*tall()); };
  let from=null;
  tab.addEventListener('pointerdown',e=>{
    if(e.button!==0) return;
    e.preventDefault();
    try{ tab.setPointerCapture(e.pointerId); }catch(_){}
    from={y:e.clientY};
  });
  const done=e=>{
    if(!from) return;
    const dd=(e && e.clientY!==undefined) ? e.clientY-from.y : 0;
    from=null;
    const dir = Math.abs(dd)>gridPixel()*2 ? Math.sign(dd) : 0;
    if(el._round) el._round(dir);
    else el._slide(dir ? dir>0 : !el._slid());
  };
  tab.addEventListener('pointerup',done);
  tab.addEventListener('pointercancel',()=>{ from=null; });
  // A new height (another stage, a narrower window) keeps the same share.
  // (Not its own way there: while the engine draws it going, its height is
  // the engine's, no new height.)
  if(window.ResizeObserver) new ResizeObserver(()=>{ if(!from && !shelfGoing.has(el)) put(share*tall()); }).observe(el);   // (not slid too: what a way of the shelf left written on it is taken off)
  requestAnimationFrame(()=>{ put(share*tall()); AFTER_LAYOUT.push(own); own(); });
}


const division=precP=>Math.pow(10,-precP);

/* A KNOB IS AN OBJECT OF THE ENGINE, like a button: a caption, a scale, and a
   number field with the "i" in its corner. The program has one way to set a
   value — the parameters of the stages, the undo depth and a color channel
   are the same knob. Whoever needs one describes it, {knob:{...}}:
     caption — above the scale; none — the scale stands alone;
     min, max — the range, or limits:()=>[a,b] when it moves;
     curve   — how a move of the slider turns into a number: 'even' — one
               slider step per unit of `step` decimals; 'ratio' — by ratios,
               MOVE steps from min to max, small numbers get as much room as
               large ones;
     step    — decimals of the slider's step; digits — decimals shown;
     fold    — how a value given from outside is brought into the range;
     hint    — the explanation on the "i", asked on demand;
     change  — (v, by) on every change by hand, by 'slider' or 'field';
     settle  — (v) when the hand lets go: the slider released, the field done;
     inMenu  — its clicks stay inside: the menu around it does not close;
     math, outside, multiple, round, forbid — its RULE for what the hand
               gives (see STANDARD.knob): the field counts, the value is
               kept on the multiple, rounded, never forbidden.
   The node carries .knob: give(v) sets a value from outside, place() re-reads
   the limits, value() tells it. The field takes an expression; its result, the
   slider's and the arrows' are kept by the rule. */
/* A KNOB'S RULE: its description over the standard (STANDARD.knob). */
function knobRule(k){
  const S=STANDARD.knob, pick=n=>k[n]!==undefined ? k[n] : S[n];
  const m=pick('math'), ops = m===true ? '+-*/' : m ? String(m).replace(/[^+\-*/]/g,'') : '';
  const r=pick('round'), round={way:'nearest', to:k.digits||0, ...(typeof r==='number' ? {to:r} : r||{})};
  const mu=pick('multiple'), multiple = mu===null || mu===undefined ? null : typeof mu==='number' ? {of:mu, from:0} : {from:0, ...mu};
  if(multiple && !(multiple.of>0)) throw new Error('knob: a multiple of '+multiple.of);
  const f=pick('forbid'), forbid=(f||[]).map(x=>Array.isArray(x) ? [Math.min(...x), Math.max(...x)] : [x, x]);
  return {ops, outside:pick('outside'), multiple, round, forbid};
}
// One unit of the rule: the multiple, else the last kept decimal.
const ruleUnit=R=>R.multiple ? R.multiple.of : Math.pow(10, -R.round.to);
/* Kept by the rule: in the range, on the multiple, rounded, never forbidden
   — or null, refused. A snap that would leave the range goes inward. */
function keepByRule(v, R, [a,b]){
  if(!Number.isFinite(v)) return null;
  if(v<a || v>b){ if(R.outside==='refuse') return null; v=Math.max(a, Math.min(b, v)); }
  /* THE ALLOWED VALUES ARE ONE GRID: base + k·q — the multiple (from, of),
     or the last kept decimal. A value goes to a node of it inside the range
     (the rounding's way; a node past the range, the nearest one inward);
     a forbidden node gives way to the nearest allowed node, either side,
     stepping node by node. */
  const q = R.multiple ? R.multiple.of : Math.pow(10, -R.round.to);
  const base = R.multiple ? R.multiple.from : 0, eps=1e-9;
  const kLo=Math.ceil((a-base)/q-eps), kHi=Math.floor((b-base)/q+eps);
  if(kLo>kHi) return null;
  const way = R.round.way==='down' ? Math.floor : R.round.way==='up' ? Math.ceil : Math.round;
  const t=(v-base)/q;
  let k=way(Math.abs(t-Math.round(t))<eps ? Math.round(t) : t);
  k=Math.max(kLo, Math.min(kHi, k));
  // Written tidy: as many decimals as the grid itself has.
  const dec=x=>{ const m=String(x).match(/\.(\d+)|e-(\d+)/); return m ? (m[1] ? m[1].length : +m[2]) : 0; };
  const digits=Math.min(12, Math.max(R.round.to, dec(q), dec(base)));
  const at=n=>+(base+n*q).toFixed(digits);
  const banned=x=>R.forbid.some(([lo,hi])=>x>=lo-eps && x<=hi+eps);
  if(!banned(at(k))) return at(k);
  for(let d=1; d<=kHi-kLo && d<=100000; d++){
    const down=k-d>=kLo && !banned(at(k-d)), up=k+d<=kHi && !banned(at(k+d));
    if(down || up){
      if(down && up) return Math.abs(at(k-d)-v)<=Math.abs(at(k+d)-v) ? at(k-d) : at(k+d);
      return down ? at(k-d) : at(k+d);
    }
  }
  return null;
}
/* THE FIELD COUNTS: numbers, the operations the rule lets it use, brackets;
   a sign before a number is no operation. What is not a whole expression
   (or divides by zero) is null. No eval: its own reading. */
function countField(text, R){
  if(/\d\s+[\d.]/.test(String(text))) return null;       // "1 2" is no number
  const t=String(text).replace(/\s+/g,'').replace(/[×xX]/g,'*').replace(/[÷:]/g,'/')
    .replace(/[−–]/g,'-').replace(/,/g,'.');
  let i=0;
  const peek=()=>t[i];
  const allowed=op=>R.ops.includes(op);
  function number(){
    const m=/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(t.slice(i));
    if(!m) throw 0; i+=m[0].length; return parseFloat(m[0]);
  }
  function primary(){
    if(peek()==='('){ if(!R.ops) throw 0; i++; const v=sum(); if(peek()!==')') throw 0; i++; return v; }
    return number();
  }
  function signed(){
    if(peek()==='-'){ i++; return -signed(); }
    if(peek()==='+'){ i++; return signed(); }
    return primary();
  }
  function product(){
    let v=signed();
    while(peek()==='*' || peek()==='/'){
      const op=t[i++]; if(!allowed(op)) throw 0;
      const w=signed(); v = op==='*' ? v*w : v/w;
    }
    return v;
  }
  function sum(){
    let v=product();
    while(peek()==='+' || peek()==='-'){
      const op=t[i++]; if(!allowed(op)) throw 0;
      const w=product(); v = op==='+' ? v+w : v-w;
    }
    return v;
  }
  try{
    if(!t) return null;
    const v=sum();
    return i===t.length && Number.isFinite(v) ? v : null;
  }catch(_){ return null; }
}
function makeKnob(k, el){
  const lim=()=>k.limits ? k.limits() : [k.min,k.max];
  const unit=()=>division(k.step||0);
  const steps=()=>{ if(k.curve==='ratio') return MOVE;
    const [a,b]=lim(); return Math.max(1,Math.round((b-a)/unit())); };
  const toPlace=v=>{ const [a,b]=lim();
    if(k.curve==='ratio'){
      const t=Math.log(Math.max(v,a)/a)/Math.log(b/a);
      return Math.round(Math.max(0,Math.min(1,t))*MOVE);
    }
    return Math.max(0,Math.min(steps(),Math.round((v-a)/unit()))); };
  const fromPlace=p=>{ const [a,b]=lim();
    return +(k.curve==='ratio' ? a*Math.pow(b/a,p/MOVE) : a+p*unit()).toFixed(k.step||0); };
  el.classList.add('knob');
  el.innerHTML=(k.caption!==undefined?`<b>${k.caption}</b>`:'')
    +`<input class="slider" type="range" min="0" step="1">`
    +`<div class="field"><input class="num" type="text" spellcheck="false" autocomplete="off">`
    +(k.hint?`<i class="info">i</i>`:'')+`</div>`;
  const slider=el.querySelector('.slider'), field=el.querySelector('.num');
  const rule=knobRule(k);
  // A phone gives its number pad only when no operation is asked.
  field.inputMode = rule.ops ? 'text' : k.digits>0 ? 'decimal' : 'numeric';
  let value=k.value;
  // What the hand gives, kept by the rule — or null: refused.
  const keep=v=>keepByRule(v, rule, lim());
  const show=v=>{
    if(document.activeElement===field) return;         // being typed in: the hand's words stand
    field.value=(+v).toFixed(k.digits||0).replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'');
  };
  const put=()=>{ slider.max=steps(); slider.value=toPlace(k.fold ? k.fold(value) : value); };
  const take=(v,by)=>{
    const [a,b]=lim(); value=Math.max(a,Math.min(b,v));
    if(field.classList.contains('wrong')) field.classList.remove('wrong');   // (a bare remove rewrites the class: a change to settle)
    slider.max=steps();
    if(by!=='slider') slider.value=toPlace(value);
    if(by!=='field') show(value);
    if(k.change) k.change(value,by);
  };
  // The slider gives a round number: one of its steps is coarser than the
  // extra decimals anyway. The exact value is typed in.
  slider.addEventListener('input',()=>{
    const v=keep(fromPlace(+slider.value));
    if(v===null) slider.value=toPlace(value); else take(v,'slider');
  });
  // The field counts what is typed, as it is typed: an unfinished or
  // refused expression is shown as not taken and changes nothing.
  field.addEventListener('input',()=>{
    const got=countField(field.value, rule), v = got===null ? null : keep(got);
    if(v===null){ field.classList.add('wrong'); return; }
    take(v,'field');
  });
  // The arrows step by one unit of the rule (its multiple, or its last decimal).
  field.addEventListener('keydown',e=>{
    if(e.key!=='ArrowUp' && e.key!=='ArrowDown') return;
    e.preventDefault();
    const d=e.key==='ArrowUp' ? 1 : -1, v=keep(value+d*ruleUnit(rule));
    if(v!==null){ take(v,'arrows'); show(value); if(k.settle) k.settle(value); }
  });
  if(k.settle){
    slider.addEventListener('change',()=>k.settle(value));
    field.addEventListener('change',()=>k.settle(value));
  }
  field.addEventListener('blur',()=>{ if(field.classList.contains('wrong')) field.classList.remove('wrong'); setTimeout(()=>show(k.fold ? k.fold(value) : value)); });
  field.addEventListener('keydown',e=>{ if(e.key==='Enter') field.blur(); });
  if(k.inMenu) el.addEventListener('click',e=>e.stopPropagation());
  const info=el.querySelector('.info');
  if(info){
    attachHint(info, k.hint, true);
    // a knob is a label: a click on the "i" would otherwise focus the field
    info.addEventListener('click',e=>{ e.preventDefault(); if(k.inMenu) e.stopPropagation(); });
  }
  el.knob={
    give:v=>{ v=+v; if(k.fold) v=k.fold(v); value=v; put(); show(v); },
    place:()=>{ if(k.fold) show(k.fold(value)); put(); },
    value:()=>value };
  put(); show(value);
  return el;
}
/* A STRIP IS AN OBJECT OF THE ENGINE: one row of tiles that does not wrap
   but scrolls — by the wheel, by a finger — with SHUTTERS at the edges saying
   there is more. Its tiles are described, not built:
     key      — how the program finds the tile again;
     color    — the tile's own color;
     held     — the tile in hand (a frame); dot — marked with a dot in the
                corner; plus — a plus instead of a color;
     hint     — ()=>[title, text], asked when hovered;
     click(e), dblclick(tile) — what it does; over — when it is hovered.
   The strip's own description: leave — when the pointer leaves its tiles.
   node.strip: fill(tiles) lays them anew and keeps the scroll; tile(key)
   finds one; mark(flag, key) puts a flag on that one tile only (key null —
   on none) and gives it; show(key) scrolls a tile into view if it is out;
   edges() places the shutters anew. */
/* SHUTTERS — the three dots at the edge of anything that is one row and
   scrolls: the paint strip, a rolled knob field. `items` are what stands in
   the row; a shutter stands at a border between them. */
/* ONE NOTCH — its goal is `notch` (STANDARD.scroll): lines, or whole
   items where the description says so. A wheel that counts in lines
   (Firefox) gives a notch per event; one that counts in pixels gives about a
   hundred a notch, and a touchpad gives them in crumbs — they are gathered
   until a notch is full. */
const NOTCH=100;
// Whole notches in a wheel event, the crumbs kept in `state.gathered`.
function notches(state, e, d){
  state.gathered += e.deltaMode ? Math.sign(d)*NOTCH : d;
  if(!Number.isFinite(state.gathered)){ state.gathered=0; return 0; }
  const n=Math.trunc(state.gathered/NOTCH);
  state.gathered -= n*NOTCH;
  return n;
}
// A scroll's room, and its AIM: the goal it is on its way to, or where it
// stands.
// A stretch drawn on what it holds is no room: while it stands off, the
// room is the one it had before.
// (Within one step of the scrolls a room is asked several times and cannot
// change between the askings: it is asked of the page once.)
var roomsOfStep=null;      // (var: a room is asked from the first lines of the page)
function scrollRoom(el, along){
  const k = along==='x' ? 'x' : 'y';
  if(el._stretched && el._room && el._room[k]!==undefined) return el._room[k];
  if(roomsOfStep){ const m=roomsOfStep.get(el); if(m && m[k]!==undefined) return m[k]; }
  // A box that does not scroll (its overflow visible) has no room, whatever
  // spills out of it.
  const cs=getComputedStyle(el);
  if((k==='x' ? cs.overflowX : cs.overflowY)==='visible'){ (el._room || (el._room={}))[k]=0; return 0; }
  let sh=el.scrollHeight;
  // Its own bar stands down the whole view from where it is scrolled: at the
  // bottom it would hold the old room open after the content shrank.
  const bar=el._barEl;
  if(k==='y' && bar && bar.parentElement===el && !bar.hidden && el.scrollTop+el.clientHeight>=sh-1){
    bar.style.display='none'; sh=el.scrollHeight; bar.style.display='';
  }
  const r = k==='x' ? el.scrollWidth-el.clientWidth : sh-el.clientHeight;
  (el._room || (el._room={}))[k]=r;
  if(roomsOfStep){ let m=roomsOfStep.get(el); if(!m) roomsOfStep.set(el, m={}); m[k]=r; }
  return r;
}
function aimOf(el, key){ const g=scrolling.get(el); return g && g.key===key ? g.goal : el[key]; }
// The stop nearest to a place.
function nearest(st, at){ return st.reduce((b,p)=>Math.abs(p-at)<Math.abs(b-at) ? p : b, st[0]); }
// A finger that scrolled does not also press what it started on.
function eatNextClick(el){
  const eat=ev=>{ ev.stopPropagation(); ev.preventDefault(); };
  el.addEventListener('click',eat,{capture:true, once:true});
  setTimeout(()=>el.removeEventListener('click',eat,true),0);
}
/* THE SCROLL — one model, like everything that moves: a GOAL, and the
   scroll going to it every frame. The INPUT sets the goal, and says how it
   is followed:
     'wheel'   — a notch: the next stop on (lines for text, items for
                 objects). By the law, no play; at an edge it passes by its
                 own speed and comes back, a push against it is a blow;
     'bar'     — held: the goal is where the hand puts the thumb, going
                 there along a line between the hand's moves; the scroll
                 hangs on it by a SPRING WITH PLAY (softened, never more than
                 `slack` behind); past the ends a stretch. A bar is a bar on
                 a phone too;
     'finger'  — on the scroll itself: held, the scroll is under the finger;
     'free'    — let go: the scroll keeps its speed (it has MASS) on the way
                 to the nearest stop — fast, it passes it and comes back; a
                 finger's flick glides on first (see letGo);
     'stop'    — the engine's own goal (a stop after the page scrolled,
                 what gets the focus).
   Past an edge by its own speed, it is drawn stretched, and the edge's
   softer spring pulls it back. */
// A goal for a scroll, given by `input`.
function scrollGoal(el, along, to, input){
  if(Number.isNaN(to)) return;
  const key = along==='x' ? 'scrollLeft' : 'scrollTop';
  const goal=Math.max(0, Math.min(scrollRoom(el, along), to));
  if(stands(el)){ el[key]=goal; el._at=el[key]; return; }
  let g=scrolling.get(el);
  if(!g || g.key!==key){ g={key, along, v:0, trail:[]}; scrolling.set(el, g); }
  Object.assign(g, {goal, input, held:false, hand:null});
  followOn();
}
// By a distance from where it is going, or to a place.
function glide(el, along, by, input='stop'){
  scrollGoal(el, along, aimOf(el, along==='x' ? 'scrollLeft' : 'scrollTop')+by, input);
}
function glideTo(el, along, to, input='stop'){ scrollGoal(el, along, to, input); }
/* PUT THERE BY THE PAGE, at once: a page of a window shown from its top, or
   back where it was left. Not the browser moving it (that is held, see
   makeScroll): the page's own word, so the way it was on ends here. */
function scrollAt(el, to, along='y'){
  const key = along==='x' ? 'scrollLeft' : 'scrollTop';
  scrolling.delete(el); stretching.delete(el); if(el._stretched) standOff(el, '');
  el[key]=Math.max(0, Math.min(scrollRoom(el, along), to)); el._at=el[key];
  drawBarsOf(el);
}
function wheelStep(el, along, by){ glide(el, along, by, 'wheel'); }
/* A HAND'S GOAL may lie past the ends: the scroll goes to the end, the rest
   is a STRETCH (the stretch argument; true by the standard). The stretch
   gives way less the further it is pulled, and stops at its reach (see
   STANDARD.stretch); its goal is followed like any other. letGoPull(el):
   back to 0. */
// How far a scroll stands off when the hand is `over` past its end: less and
// less for each pixel of the hand, and none at all once the hand is twice
// the reach past the end — there it stands at the reach.
function stretchOf(el, along, over){
  if(Number.isNaN(over)) return 0;
  const view=Math.min((along==='x' ? el.clientWidth : el.clientHeight)*STANDARD.stretch.reach,
    gridPixel()*STANDARD.line*STANDARD.stretch.most);
  if(!over || view<=0) return 0;
  const t=Math.min(1, Math.abs(over)/(2*view));
  return Math.sign(over)*view*(1-(1-t)*(1-t));
}
const stretchy=el=>el.dataset.stretch!=='no' && !stands(el);
/* A scroll moved or stretched: what is drawn by where it stands is drawn at
   once, in the same step — its shutters, and the bars it is in: its own
   way's and every bar of a way it is a link of (a bar may stand in another
   scroll of the way). The page's scroll event comes a frame later. */
function drawBarsOf(x){
  if(x._edges) x._edges();
  if(x._drawWay) x._drawWay();
  if(x._bars) for(const b of x._bars) b.draw();
}
/* WHAT IS IN A STRETCHED SCROLL STANDS OFF — all of it: its children are
   moved, the shutters and the bar stay. Loose words and inline things take
   no move (a shift applies to boxes), so each run of them first becomes a
   box of its own — the very block the page already made of it, so nothing
   moves in the layout. */
function standOff(x, t){
  const begins = !!t && !x._stretched;
  if(begins){ scrollRoom(x, 'x'); scrollRoom(x, 'y'); }   // its room, taken before it stands off
  x._stretched=!!t;
  // How far what it holds stands off along its own axis (+ past the start).
  const n=(t||'').split(' ').map(parseFloat);
  x._off=(x._along==='x' ? n[0] : n[1]) || 0;
  if(begins){
    let run=[];
    const flush=()=>{
      if(run.some(n=>n.nodeType===1 || n.textContent.trim())){
        const w=document.createElement('div'); w.className='run_';
        run[0].before(w); for(const n of run) w.appendChild(n);
      }
      run=[];
    };
    for(const n of [...x.childNodes]){
      const loose = n.nodeType===3 || (n.nodeType===1 && getComputedStyle(n).display.startsWith('inline'));
      if(loose) run.push(n); else flush();
    }
    flush();
  }
  for(const c of x.children) if(!c.classList.contains('more_') && !c.classList.contains('scrollBar')) c.style.translate=t;
  // Its bar squeezes by the stretch — every step of it, the last one too.
  drawBarsOf(x);
}
// A HAND HOLDS the scroll (input 'bar' or 'finger') and gives it a goal,
// maybe past the ends (a stretch).
function pullTo(el, along, to, per=1, input='bar'){
  if(Number.isNaN(to)) return;
  if(!(per>0 && Number.isFinite(per))) per=1;       // nothing to scroll: the hand's own pixels
  const at=Math.max(0, Math.min(scrollRoom(el, along), to)), key = along==='x' ? 'scrollLeft' : 'scrollTop';
  if(stands(el)){ el[key]=at; el._at=el[key]; }
  else {
    const now=performance.now();
    let g=scrolling.get(el);
    if(!g || g.key!==key){ g={key, along, v:0, trail:[], goal:el[key]}; scrolling.set(el, g); }
    if(input==='bar'){
      // The bar's goal on a line from where it is now to the hand's place,
      // in the hand's usual gap (smoothed, a little more).
      const gap=Math.max(16, Math.min(STANDARD.scroll.hand.gap, now-(el._handAt||now-16)));
      el._handAt=now;
      el._handGap = el._handGap ? el._handGap*0.7+gap*0.3 : gap;
      const from = g.hand ? handGoal(g, now) : (g.held ? g.goal : el[key]);
      g.hand={from, to:at, t0:now, dur:el._handGap*1.25};
    } else g.hand=null;
    Object.assign(g, {goal:at, input, held:true});
    followOn();
  }
  if(!stretchy(el)) return;
  const o=stretchOf(el, along, (to-at)/per);
  const sg=stretching.get(el);
  if(!sg && !o) return;
  if(sg) sg.to=o; else stretching.set(el, {along, o:0, to:o, v:0});
  followOn();
}
// Where the bar's goal is on its line now.
function handGoal(g, now){
  const h=g.hand, f=Math.min(1, (now-h.t0)/h.dur);
  return h.from+(h.to-h.from)*f;
}
// The hand lets go: the scroll keeps the speed it had (its mass). After a
// bar the goal is the stop nearest the hand's place; after a finger the stop
// nearest where the glide would end (a flick).
function letGo(el, input){
  letGoPull(el);
  const g=scrolling.get(el);
  let at = g ? g.goal : el[keyOf(el)];
  if(g && input==='finger'){
    if(g.vAt && performance.now()-g.vAt>80) g.v=0;       // it stood before it was let go
    at=(g.pos!==undefined ? g.pos : at)+(g.v||0)/STANDARD.scroll.decel;
  }
  at=Math.max(0, Math.min(scrollRoom(el, el._along), at));
  glideTo(el, el._along, el._nearest ? el._nearest(at) : at, 'free');
}
function letGoPull(el){ const g=el && stretching.get(el); if(g){ g.to=0; g.back=false; followOn(); } }
/* A PUSH against the end (the wheel, a notch at a time): a blow outward —
   the scroll goes past its end with that speed, and the edge's spring pulls
   it back. dir: +1 past the far end, -1 past the start. */
function bounce(el, along, dir){
  if(!el || !stretchy(el)) return;
  const key = along==='x' ? 'scrollLeft' : 'scrollTop';
  scrollGoal(el, along, dir>0 ? scrollRoom(el, along) : 0, 'wheel');
  const g=scrolling.get(el); if(!g) return;
  g.v=(g.v||0)+dir*STANDARD.scroll.push*gridPixel();
  followOn();
}
/* A WAY — scrolls turned as ONE, one after another (a scroll alone is a way
   of one). The wheel goes through them in order, resting `rest` ms at each
   joint; the hand (a bar, a finger) puts the whole way at a place; let go,
   each scroll goes to its nearest stop. A scroll's arguments `then` (the
   next scroll: a function, it may come and go) and `area` (where the wheel
   and the finger are taken; the scroll itself by default) make a way of
   more. */
function keyOf(el){ return el._along==='x' ? 'scrollLeft' : 'scrollTop'; }
function wayRooms(ls){ return ls.map(l=>scrollRoom(l, l._along)); }
function wayAim(ls){ return ls.reduce((s,l)=>s+aimOf(l, keyOf(l)), 0); }
// The hand puts the whole way at p (a pixel of the hand is `per` of it):
// the first scroll WITH ROOM takes what lies before its start, the last one
// with room what lies past its end — as a stretch (one with no room there
// would be stretched for nothing, maybe across the hand's way).
function wayTo(ls, p, per=1, input='bar'){
  const R=wayRooms(ls); let last=R.length-1; while(last>0 && R[last]<=0.5) last--;
  let first=0; while(first<last && R[first]<=0.5) first++;
  let left=p;
  ls.forEach((l,i)=>{
    const to = i<first || i>last ? 0
             : (i===first && left<0) ? left
             : i===last ? Math.max(0, left)
             : Math.max(0, Math.min(R[i], left));
    pullTo(l, l._along, to, per, input);
    left-=R[i];
  });
}
// Let go: each scroll to its nearest stop (see letGo).
function wayLetGo(ls, input='bar'){ for(const l of ls) letGo(l, input); }
// One notch of the wheel through the way: the first scroll not at its end
// takes it; at a joint the wheel rests; past the very end it bounces.
function wayNotch(ls, dir, st){
  const R=wayRooms(ls), aims=ls.map(l=>aimOf(l, keyOf(l))), now=performance.now();
  const more=i=>R.slice(i+1).some(r=>r>0.5);
  let i=-1;
  if(dir>0){ i=R.findIndex((r,j)=>aims[j]<r-1); }
  else for(let j=ls.length-1;j>=0;j--) if(aims[j]>0.5){ i=j; break; }
  if(i<0){
    const withRoom=R.map((r,j)=>r>0.5 ? j : -1).filter(j=>j>=0);
    const j = dir>0 ? (withRoom.pop() ?? ls.length-1) : (withRoom[0] ?? 0);
    bounce(ls[j], ls[j]._along, dir);
    return;
  }
  if(dir>0 && i>0 && aims[i]<=0.5 && now-st.restFrom<STANDARD.scroll.rest) return;
  if(dir<0 && more(i) && aims[i]>=R[i]-1 && now-st.restFrom<STANDARD.scroll.rest) return;
  const to=ls[i]._notch(dir, aims[i]);
  wheelStep(ls[i], ls[i]._along, to-aims[i]);
  if(dir>0 ? (to>=R[i]-1 && more(i)) : (to<=0.5 && i>0)) st.restFrom=now;
}
// The wheel over a way's area.
function wheelWay(area, links, capture){
  const st={gathered:0, restFrom:0};
  area.addEventListener('wheel',e=>{
    if(e.defaultPrevented) return;          // something inside took it already
    const ls=links();
    if(wayRooms(ls).reduce((a,b)=>a+b, 0)<=1) return;
    const d = ls.length===1 && ls[0]._along==='y' ? e.deltaY : (e.deltaY||e.deltaX);
    if(!d) return;
    e.preventDefault(); if(capture) e.stopPropagation();
    const n=notches(st, e, d); if(!n) return;
    // Step by step while it goes somewhere: a huge turn stops at the end.
    for(let i=0;i<Math.abs(n);i++){ const was=wayAim(ls); wayNotch(ls, Math.sign(n), st); if(wayAim(ls)===was) break; }
  }, {passive:false, capture});
}
/* THE FINGER over a way's area: along an axis it holds the scrolls of that
   axis (past the ends a stretch); let go, they go strictly to their stops.
   The other axis is left to the page — or to a way around: the innermost
   whose axis the finger went takes it. */
function fingerWay(area, links, capture){
  let hand=null;
  area.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='touch' || e.target.closest('input,.scrollBar')) return;
    hand={id:e.pointerId, x:e.clientX, y:e.clientY, on:false};
  }, capture);
  area.addEventListener('pointermove',e=>{
    if(!hand || e.pointerId!==hand.id) return;
    const dx=e.clientX-hand.x, dy=e.clientY-hand.y;
    if(!hand.on){
      if(Math.hypot(dx,dy)<gridPixel()*4) return;
      const axis = Math.abs(dx)>=Math.abs(dy) ? 'x' : 'y';
      const mine=links().filter(l=>l._along===axis && scrollRoom(l, axis)>1);
      if(e.__hand || !mine.length){ hand=null; return; }     // not ours
      Object.assign(hand, {on:true, axis, ls:mine, from:wayAim(mine)});
    }
    e.__hand=true;
    wayTo(hand.ls, hand.from-(hand.axis==='x' ? dx : dy), 1, 'finger');
  }, capture);
  const gone=()=>{
    if(!hand) return;
    const h=hand; hand=null;
    if(!h.on) return;
    wayLetGo(h.ls, 'finger');
    eatNextClick(area);
  };
  for(const ev of ['pointerup','pointercancel']) area.addEventListener(ev, gone, capture);
}
/* THE BAR of a way: the engine's own, in its last upright scroll — the
   whole way on it. The hand on it holds the way (past the ends a stretch);
   let go, the way goes to its stops. It shows when there is something to
   scroll, and its scroll then keeps room for it on its right. Drawn on the
   triggers only: a scroll, a new size. */
// A box whose size is on its way: a shelf's height, a floating window's box
// (its bar keeps what was decided when the way began).
const resizing=x=>shelfGoing.has(x) || floatGoing.has(x);
function makeBar(host, links){
  if(host._bar) return host._bar;
  host.classList.add('ownBar');
  const bar=Object.assign(document.createElement('div'),{className:'scrollBar', _drawn:true});
  const thumb=Object.assign(document.createElement('i'),{className:'barThumb'});
  bar.dataset.follow='no'; bar.hidden=true; bar.appendChild(thumb); host.appendChild(bar);
  let padR=null;
  const total=ls=>wayRooms(ls).reduce((a,b)=>a+b, 0);
  const draw=atGoal=>{
    // Its scroll's content laid anew (innerHTML) took the bar out: back in.
    if(bar.parentElement!==host) host.appendChild(bar);
    /* WHETHER IT HAS A BAR IS DECIDED BY WHERE THE BOX GOES, not by how it is
       drawn on its way: asked when the way begins, the box at its laid-out
       size (atGoal, see settle) - the bar comes at once and goes the whole
       way; on the way it stays as it was decided (what it holds is taller or
       shorter only while it goes) - 14.11: the guide's bar came only at the
       end of the window's way, and a page that needs none showed one for a
       moment. */
    const ls=links(), T=total(ls), need=T>1 && ls.includes(host);
    const on = resizing(host) && atGoal!==true ? !bar.hidden : need;
    if(host._bar) for(const l of ls) (l._bars || (l._bars=new Set())).add(host._bar);   // each link draws it
    if(on===bar.hidden){
      if(padR===null) padR=parseFloat(getComputedStyle(host).paddingRight)||0;
      // The bar stands in the scroll: it needs a place to stand from; a
      // scroll of a set width grows by the bar instead of squeezing its own.
      if(on && getComputedStyle(host).position==='static') host.style.position='relative';
      if(host.style.width) host.style.boxSizing = on ? 'content-box' : '';
      bar.hidden=!on;
      host.style.paddingRight = on ? (padR+bar.offsetWidth)+'px' : '';
      // The room the bar takes: a consequence of a layout, never its input
      // (see packClusters).
      host._barPad = on ? bar.offsetWidth : 0;
      // The bar took room in its scroll or gave it back: what stands in the
      // scroll is laid anew by that. The engine wrote it — so the engine
      // says it: this area changed.
      if(engineUp) settle(new Set([host]));
    }
    if(!on) return;
    // Scrolled past a room that shrank (only the bar held it): back to its end.
    if(!scrolling.has(host) && !host._stretched){
      const room=scrollRoom(host, 'y');
      if(host.scrollTop>room+0.5){ host.scrollTop=room; host._at=host.scrollTop; }
    }
    const h=host.clientHeight, size=Math.max(gridPixel()*6, h*h/(h+T));
    const at=ls.reduce((s,l)=>s+l[keyOf(l)], 0);
    bar.style.top=host.scrollTop+'px'; bar.style.height=h+'px';
    // A way stretched past an end: the thumb squeezes by the stretch from
    // that side — past the start its bottom comes up, past the far end its
    // top comes down. It stands where the way is (a held way lags the hand).
    // Any link of the way, across or along: the bar is the whole way's.
    const push=ls.reduce((s,l)=>s+(l._off || 0), 0);
    const squeezed=Math.max(gridPixel()*3, size-Math.abs(push));
    const top=(h-size)*Math.min(1, at/T) + (push<0 ? size-squeezed : 0);
    thumb.style.height=Math.round(squeezed)+'px'; thumb._size=size;
    thumb.style.top=Math.round(top)+'px';
  };
  host.addEventListener('scroll', draw);
  // A new size is drawn at the next frame: the bar's own room would be
  // another new size inside the same observation.
  const ro=new ResizeObserver(()=>requestAnimationFrame(draw));
  ro.observe(host);
  const watchKids=()=>{ for(const c of host.children) if(c!==bar) ro.observe(c); };
  watchKids();
  new MutationObserver(()=>{ watchKids(); draw(); }).observe(host, {childList:true});
  let drag=null;
  bar.addEventListener('pointerdown',e=>{
    e.preventDefault(); e.stopPropagation();
    try{ bar.setPointerCapture(e.pointerId); }catch(_){}
    const r=thumb.getBoundingClientRect(), ls=links(), T=total(ls);
    const top=host.getBoundingClientRect().top+host.clientTop, free=Math.max(1, host.clientHeight-(thumb._size||thumb.offsetHeight));
    // Taken by the thumb, the way stays where it is (the grab counted from
    // the way's exact place, not the thumb's drawn pixel); taken beside it,
    // the thumb's middle goes to the hand.
    const onThumb = e.clientY>=r.top && e.clientY<=r.bottom;
    drag={grab: onThumb ? e.clientY-top-wayAim(ls)/Math.max(1,T)*free : r.height/2};
    for(const l of ls) l._handGap=0;
    move(e);
  });
  // Measured against the scroll's own box, not the bar's: the bar rides the
  // scroll and is drawn anew only after it moved.
  const move=e=>{
    if(!drag) return;
    const ls=links(), T=total(ls), top=host.getBoundingClientRect().top+host.clientTop;
    const free=Math.max(1, host.clientHeight-(thumb._size||thumb.offsetHeight));
    wayTo(ls, (e.clientY-top-drag.grab)/free*T, T/free, 'bar');
  };
  bar.addEventListener('pointermove', move);
  for(const ev of ['pointerup','pointercancel','lostpointercapture']) bar.addEventListener(ev,()=>{
    if(!drag) return; drag=null; wayLetGo(links(), 'bar');
  });
  host._bar={draw, drawAtGoal:()=>draw(true)}; host._barEl=bar;
  return host._bar;
}
/* One step: the first item that stands and the gap after it. */
function itemStep(el, items, along){
  const it=[...el.querySelectorAll(items)].find(seen);
  if(!it) return gridPixel()*STANDARD.line;
  const r=it.getBoundingClientRect(), cs=getComputedStyle(it.parentElement);
  const gap = along==='x' ? (parseFloat(cs.columnGap)||0) : (parseFloat(cs.rowGap)||0);
  return (along==='x' ? r.width : r.height)+gap;
}
/* `cover` — the shutter is a plate of its own width laid over the edge,
   not cut to the border between items: for items wider than a paint. */
function makeShutters(el, items, cover, way){
  // A plate stands (it is drawn by the engine, no input to it) and carries
  // its own width: written when it is new, and only where plates show at all.
  const shutter=side=>{ const pl=Object.assign(document.createElement('i'),{className:'more_ '+side, _drawn:true}); pl.dataset.follow='no'; return pl; };
  const widthOf=(side, name, px)=>{
    const pl=el.querySelector(':scope > .more_.'+side) || el.querySelector('.more_.'+side); if(!pl) return;
    const v=px+'px'; if(pl.style.getPropertyValue(name)!==v) pl.style.setProperty(name, v);
  };
  /* THE SHUTTER STANDS AT A TILE BORDER. The strip edge falls in the middle
     of a tile, so the width is computed each time: from the strip edge to the
     nearest border between tiles, wide enough for the dots. Computed from the
     ACTUAL edges of the tiles, not from scroll arithmetic: padding and gaps
     would each be another chance to be off by a pixel. The plate is wider by
     the strip padding and shifted outward by as much, so the padding is
     subtracted from the distance to the edge. */
  /* WHERE THE ITEMS END IN THE ROW is noted once — their actual edges, in
     the row's own content (the scroll moves nothing there) and as the layout
     puts them (a thing on its way is drawn off its place: that offset is
     data, and is taken off). Noted anew when the row is laid out anew or its
     content came out another length — never because the row scrolled or its
     box changed. */
  let notedFor='', noted=[], told=false;
  const itemEdges=r=>{
    if(!told){ told=true; AFTER_LAYOUT.push(()=>{ notedFor=''; }); }   // laid out anew: noted anew when next asked
    const key=[layoutSerial, gridPixel(), el.querySelectorAll(items).length, el.scrollWidth].join('|');
    const o=r.left-el.scrollLeft;
    if(key!==notedFor){
      notedFor=key;
      noted=[...el.querySelectorAll(items)].filter(seen).map(x=>{
        const b=x.getBoundingClientRect(); let dx=0;
        for(let a=x; a && a!==el; a=a.parentElement){ const g=going.get(a); if(g) dx+=drawnOff(g).x; }
        return {l:b.left-dx-o, r:b.right-dx-o};
      });
    }
    return noted.map(e=>({left:e.l+o, right:e.r+o}));
  };
  const trim=()=>{
    if(!el.closest('.strip,.rolled')) return;       // no plates are shown here
    if(cover){
      /* Over wide items: the left plate is the dots' own width, and the row
         stops so that a whole item begins right past it (see `lead` in
         makeScroll); the right
         plate covers what is left of a cut item, up to the last whole one. */
      const own=gridPixel()*11;
      widthOf('left_', '--shutterLeft', own);
      // It begins at the right edge of the last item that stays whole with
      // room for the dots, and covers everything past it: never half a knob.
      const r=el.getBoundingClientRect();
      const ends=itemEdges(r).map(e=>e.right).filter(e=>r.right-e>=own-0.5);
      const wid = ends.length ? r.right-Math.max(...ends) : own;
      widthOf('right_', '--shutterRight', Math.ceil(wid));
      return;
    }
    const r=el.getBoundingClientRect(), mn_=gridPixel()*7;   // what the dots need
    const edges=itemEdges(r); if(!edges.length) return;
    const field=parseFloat(getComputedStyle(el).paddingLeft)||0;
    let widR=0;
    for(let i=edges.length-1;i>=0;i--){
      const upTo=r.right-edges[i].right-field;
      if(upTo>=mn_-0.5){ widR=upTo; break; }      // the nearest edge where the dots fit
    }
    widthOf('right_', '--shutterRight', Math.ceil(widR||mn_));
    let widL=0;
    for(const g of edges){
      const upTo=g.left-r.left-field;
      if(upTo>=mn_-0.5){ widL=upTo; break; }
    }
    widthOf('left_', '--shutterLeft', Math.ceil(widL||mn_));
  };
  /* Shutters go out by themselves: the left one at the start, the right one
     at the end. The threshold on both sides is half a tile, so tiny offsets
     at the ends do not keep them lit. */
  const edges=()=>{
    trim();
    const right_=el.querySelector('.more_.right_'), left_=el.querySelector('.more_.left_');
    const pt=el.querySelector(items);
    // An overlaid shutter shows as soon as anything is hidden under it.
    const halfTile = cover ? gridPixel() : pt ? pt.getBoundingClientRect().width/2 : 8;
    if(right_) right_.classList.toggle('shown', el.scrollWidth-(el.scrollLeft+el.clientWidth) > halfTile);
    if(left_) left_.classList.toggle('shown', el.scrollLeft > halfTile);
  };
  // The row scrolls by the engine's scroll: a whole item a notch, and a
  // whole item where the hand lets go; over wide items (cover) the first one
  // in view begins right past the left dots.
  makeScroll(el, {along:'x', items, notch:{by:'item', count:1}, end:{by:'item'},
                  lead: cover ? ()=>gridPixel()*11 : 0, ...(way||{})});
  el.addEventListener('scroll',edges,{passive:true});
  // Its width changes when it moves, on a stage change and when the window
  // shrinks, and the shutters are computed from it.
  if(window.ResizeObserver) new ResizeObserver(edges).observe(el);
  el._edges=edges;
  return {shutter, edges};
}
/* A tile's paint, and its opposite for the frame of the one in hand: the
   opposite side of the color circle (turquoise — coral), as saturated, and
   on the other side in lightness, so it shows by both; its light edge and
   its shadow edge. A grey has no hue: its opposite is only in lightness. */
function paintTile(dd, color){
  dd.style.background=color;
  const c=(color.match(/\d+(\.\d+)?/g)||[]).slice(0,3).map(Number); if(c.length<3) return;
  const [r,g,b]=c.map(v=>v/255), hi=Math.max(r,g,b), lo=Math.min(r,g,b), L=(hi+lo)/2;
  let H=0, S=0;
  if(hi>lo){
    const d=hi-lo; S=d/(1-Math.abs(2*L-1));
    H = hi===r ? ((g-b)/d+6)%6 : hi===g ? (b-r)/d+2 : (r-g)/d+4;
  }
  const oH=(H*60+180)%360, oS=S<0.12 ? 0 : Math.max(S, 0.6), oL=L<0.5 ? 0.75 : 0.28;
  const hsl=l=>`hsl(${oH.toFixed(1)} ${(oS*100).toFixed(1)}% ${(Math.max(0,Math.min(1,l))*100).toFixed(1)}%)`;
  dd.style.setProperty('--oppLight', hsl(oL+0.12));
  dd.style.setProperty('--oppShade', hsl(oL-0.14));
}
function makeStrip(el, ss){
  el.classList.add('strip');
  const byKey=new Map();
  const {shutter, edges}=makeShutters(el, '.tile');
  el.strip={
    fill(list){
      const keep=el.scrollLeft;
      el.textContent=''; byKey.clear();
      el.appendChild(shutter('left_'));
      for(const t of list){
        const dd=document.createElement('i'); dd.className='tile';
        for(const ff of ['held','dot','plus']) if(t[ff]) dd.classList.add(ff);
        if(t.color) paintTile(dd, t.color);
        if(t.key!==undefined) byKey.set(String(t.key), dd);
        dd._tile=t;
        if(t.click) dd.onclick=e=>t.click(e);
        // The strip is not rebuilt by a click: the second click of a double
        // click must hit the same tile, not a fresh copy of it.
        if(t.dblclick) dd.ondblclick=e=>{ e.stopPropagation(); t.dblclick(dd); };
        el.appendChild(dd);
      }
      el.appendChild(shutter('right_'));
      el.scrollLeft=keep;
      edges();
    },
    tile:key=>byKey.get(String(key))||null,
    mark(flag,key){
      for(const dd of el.querySelectorAll('.tile.'+flag)) dd.classList.remove(flag);
      const dd=key==null ? null : byKey.get(String(key));
      if(dd) dd.classList.add(flag);
      return dd||null;
    },
    // A tile shown goes to the middle of the strip, whether it was in view
    // or not — by the engine's scroll, from its place in the layout.
    show(key){
      const dd=byKey.get(String(key)); if(!dd) return;
      glideTo(el, 'x', dd.offsetLeft+dd.offsetWidth/2-el.clientWidth/2);
    },
    edges};
  // One listener for all tiles: there can be hundreds of them.
  // HOVERING (a mouse): the tile's hint, and what it lights while under it.
  // A finger does not hover — touching is not hovering.
  el.addEventListener('pointerover',e=>{
    if(e.pointerType==='touch' || hintHeld) return;
    const dd=e.target.closest('.tile'); if(!dd||!dd._tile) return;
    const t=dd._tile;
    if(t.hint){ const [title,text]=t.hint(); showHint(dd,title,text||''); }
    if(t.over) t.over();
  });
  el.addEventListener('pointerout',e=>{
    if(e.pointerType==='touch' || hintHeld) return;
    hideHint();
    const to=e.relatedTarget;
    if(ss.leave && !(to && to.closest && to.closest('.tile') && el.contains(to))) ss.leave();
  });
  /* HOLDING a tile — a finger or the mouse button — is its own question, as
     on buttons: the hint comes and stays until the next press, and what the
     tile lights (a paint's cells on the picture) stays lit with it. The tile
     is not taken by a hold. A finger that slides scrolls the strip instead. */
  let holdTimer=null, holdFrom=null;
  const letGo=()=>{ clearTimeout(holdTimer); holdTimer=null; };
  el.addEventListener('pointerdown',e=>{
    const dd=e.target.closest('.tile'); if(!dd||!dd._tile) return;
    if(e.pointerType==='mouse' && e.button!==0) return;
    const t=dd._tile; letGo(); holdFrom=[e.clientX,e.clientY];
    holdTimer=setTimeout(()=>{
      holdTimer=null;
      if(ss.leave) ss.leave();
      if(t.over) t.over();
      if(t.hint){ const [title,text]=t.hint(); placeHint(dd,title,text||'',true); }
      holdHint(ss.leave);
      eatClick=true;                 // held to be explained, not to be taken
    }, PRESS);
  });
  el.addEventListener('pointermove',e=>{
    if(holdTimer && holdFrom && Math.hypot(e.clientX-holdFrom[0], e.clientY-holdFrom[1])>gridPixel()*4) letGo();
  });
  for(const ev of ['pointerup','pointercancel']) el.addEventListener(ev, letGo);
  return el;
}
const stripEdges=()=>{ for(const el of document.querySelectorAll('.strip, .rolled')) if(el._edges) el._edges(); };
/* LODGES — an argument: {into, field, items}. Two half-empty bands are one
   too many: when the `field` of the shelf `into` shows none of its `items`,
   this shelf moves to the start of `into`, and the empty field (elastic, it
   would still take half the band) is removed; when items show up again, it
   goes back home. */
function lodgeAll(){
  for(const el of document.querySelectorAll('[data-lodges]')){
    const lo=el._lodges, into=$(lo.into), field=$(lo.field);
    if(!into||!field) continue;
    if(!el._home){ el._home={parent:el.parentElement, next:el.nextSibling}; WANDERERS.add(el); }
    /* First the field is put back: while hidden, its items are invisible to
       this check, and the shelf would stay lodged forever. */
    field.hidden=false;
    const any=[...field.querySelectorAll(lo.items)].some(seen);
    const go=!el.hidden && !any;
    el.classList.toggle('lodged', go);
    field.hidden=go;
    if(go){ if(el.parentElement!==into) into.insertBefore(el, into.firstChild); }
    else if(el.parentElement!==el._home.parent) el._home.parent.insertBefore(el, el._home.next);
  }
}

/* THE BUTTON ENGINE. A record knows only its name and its job; where to
   stand, when to dim, hide or press in is computed by the engine, AGAIN after
   every press. So one button can dim another without knowing about it: it
   changes the state of the world, and the engine asks everyone.
     label   — a string or a function (a toggle is named by its state);
     calls   — what to do on press;
     shown   — whether it has a place here and now;
     needs   — what it cannot work without, and the engine dims it without
               that by itself: 'image' — an open image, 'core' — the core;
     dims    — its own dimming on top: "possible in general, not now"
               (nothing to undo, nothing to clean);
     choice, value — one of a choice (the tool in hand): pressed when the
               choice holds its value, and a press takes the value, or puts
               it down (choice.empty) when it is already held — no calls or
               pressed are written then;
     pressed — pressed bevel: "this one is working now", for a toggle that
               is not a choice;
     shorter — shortenings of the label, mildest first, or a function;
     place   — the place in SHELVES ({buttons:name}) it stands in;
     group   — its cluster in that place;
     icon    — a drawn icon before the label;
     still   — it may explain but does not act;
     hollow, paint — no background, bevel and label in its own paint;
     hint    — [title, text] or a function returning it;
     always  — the hint shows even with Hints off;
     link    — a web address: the press opens it in a new tab, and the label
               is highlighted as a link (makeLink).
   A button is hidden when the action does not exist on this stage at all,
   and dimmed when it exists but is not available yet. */
/* What the engine decides for every button from its record. */

const dimmed=kk=> (kk.needs && !NEEDS[kk.needs]()) || (kk.dims ? !!kk.dims() : false);
const pressedNow=kk=> kk.choice ? kk.choice.get()===kk.value : (kk.pressed ? !!kk.pressed() : false);
function act(kk){
  if(kk.calls) return kk.calls();
  const cc=kk.choice; if(!cc) return;
  cc.set(cc.get()===kk.value && ('empty' in cc) ? cc.empty : kk.value);
}
/* A button that leads to a web page — for the engine's records and for
   buttons built by hand alike. */
function makeLink(el, url){
  el.classList.add('link');
  el.onclick=e=>{ e.stopPropagation(); open(url, '_blank', 'noopener'); };
}
const recordsChecked=new WeakSet();
function placeButtons(){
  for(let i=0;i<BUTTONS.length;i++){
    // read as written (before the engine notes its node in it); under ?check the record is
    // put back watched, so every later reading of it is checked against the declaration too
    if(!recordsChecked.has(BUTTONS[i])){ const w=checkButton(BUTTONS[i]); recordsChecked.add(w); recordsChecked.add(BUTTONS[i]); BUTTONS[i]=w; }
    const kk=BUTTONS[i];
    if(!BUTTON_PLACES[kk.place]) continue;
    let el=$('#'+kk.id_);
    if(!el){ el=document.createElement('button'); el.id=kk.id_; }
    kk.node=el;
    moveArgs(el, kk);
    if(kk.link) makeLink(el, kk.link);
    // A press is a TRIGGER and all it leads to is one consequence: the
    // engine notes where everything stands first, then the action changes
    // what it changes, then everything goes to its new place — never from a
    // half-changed page.
    else if(!kk.still) el.onclick=()=>{ if(el.disabled) return; smoothly(()=>{ act(kk); refreshButtons(); tell(); }); };
    el.classList.toggle('still', !!kk.still);
    /* Its own paint: no background, bevel and label follow it. */
    el.classList.toggle('hollow', !!kk.hollow);
    el.classList.toggle('withIcon', !!kk.icon);
    if(kk.paint) el.style.setProperty('--paint', kk.paint);
    if(kk.hint){
      attachHint(el, ()=>typeof kk.hint==='function'?kk.hint():kk.hint, !!kk.always);
      el.addEventListener('click',hideHint);
    }
  }
  gatherButtonClusters();
  refreshButtons();
}
/* BUTTONS LIVE IN CLUSTERS TOO, and a cluster wraps whole, like the knob
   clusters below. A place with a field gets clusters; a place without one is
   a mark the buttons simply line up after, in their order. */

function gatherButtonClusters(){
  for(const [name, place] of Object.entries(BUTTON_PLACES)){
    const mine=BUTTONS.filter(kk=>kk.place===name && kk.node);
    if(place.hidden){
      let after=place;
      for(const kk of mine){ place.parentNode.insertBefore(kk.node, after.nextSibling); after=kk.node; }
      continue;
    }
    for(const gg of [...place.querySelectorAll('.group')]) gg.remove();
    /* A group is by NAME, not by adjacent records: a button listed further
       down still joins its group, at its end. Groups go in the order their
       names first appear. */
    const clusters=new Map();
    for(const kk of mine){
      let cluster=clusters.get(kk.group);
      if(!cluster){
        cluster=Object.assign(document.createElement('div'),{className:'group'});
        cluster.dataset.cluster=kk.group;
        place.appendChild(cluster);
        clusters.set(kk.group, cluster);
      }
      cluster.appendChild(kk.node);
    }
    // Incoming objects join their groups — first, if so written.
    for(const oo of INCOMING){
      const el=$('#'+oo.id_), gg=clusters.get(oo.group);
      if(oo.place===name && el && gg) gg.insertBefore(el, oo.firstly ? gg.firstChild : null);
    }
  }
}
/* The label a button shows: its full label, or the shortening its section is
   squeezed to now (packClusters keeps the level on the section). Writing the
   full label back on every refresh would undo the squeezing, and the layout
   print — which sees full labels — would not notice. */
function shownLabel(kk){
  const row_=labelsRow(kk);
  const section=kk.node.closest('[data-squeeze]');
  const level=section ? +section.dataset.squeeze : 0;
  return row_[Math.min(level, row_.length-1)];
}
function writeLabel(kk, text){
  const el=kk.node;
  if(!kk.icon){ if(el.textContent!==text) el.textContent=text; return; }
  if(el.dataset.label===text) return;
  el.dataset.label=text;
  el.innerHTML=kk.icon;
  el.append(text);
}

/* LAYOUT ON CHANGE, NOT ON A CLOCK. Laying out is expensive: to lay out a
   section the engine resets its groups' styles and measures them again, on
   every squeezing level.

   So the layout has a PRINT — everything it depends on: grid pixel, section
   widths, which objects are visible and their FULL labels, which knob groups
   are open and how many knobs they hold. Same print — nothing to lay out.

   The print takes the full label, not the current one: shortening is a
   result of the layout, and counting it as a cause would loop. */
let layoutPrint=null;
/* A FIELD'S OWN PRINT: what stands on it — its visible groups and objects
   with their words — and the scale. A change of stage changes the prints of
   the fields whose content changed, and only those are laid out again. */
function fieldPrint(where){
  // The scale AND the spacing: both are the widths of everything, and a
  // band worked out at one spacing is no band at another.
  const root=getComputedStyle(document.documentElement);
  const parts=[root.getPropertyValue('--unit'), root.getPropertyValue('--density')];
  for(const gg of where.querySelectorAll(':scope > .group')){
    if(gg.hidden) continue;
    parts.push((gg.dataset.cluster||'')+'['+[...gg.children].filter(x=>!x.hidden)
      .map(x=>{ const kk=BUTTONS.find(k=>k.node===x); return x.id+':'+(kk ? labelsRow(kk)[0] : x.textContent); }).join(',')+']');
  }
  return parts.join('|');
}
const fieldPrints=new Map();
const fieldsNow=()=>[...Object.values(BUTTON_PLACES).filter(p=>!p.hidden && p.id), $('#knobsField')].filter(Boolean);
function viewPrint(){
  // The scale, the visible buttons' labels and the knob groups — no widths:
  // those are the BANDS' (bandsBroken). A field's width depends on how its
  // neighbours laid themselves out, and counting that as a cause would make
  // the layout chase its own tail.
  const btn=BUTTONS.filter(kk=>kk.node && !kk.node.hidden)
                 .map(kk=>kk.id_+':'+labelsRow(kk)[0]).join('|');
  const ru_=[...document.querySelectorAll('#knobsField .group')]
    .filter(gg=>!gg.hidden)
    .map(gg=>gg.dataset.cluster+':'+gg.childElementCount).join('|');
  const root=getComputedStyle(document.documentElement);
  return [root.getPropertyValue('--unit'), root.getPropertyValue('--density'),
          btn, ru_].join(';');
}
/* LAID OUT BY TRIGGERS, NOT BY FRAMES. A shelf's folds change only at
   certain widths: where the fold in force stops fitting (the width its
   content takes now), and where a fold of one row less would start to fit
   (worked out from the widths already measured, no layout needed). The
   packing leaves these two edges — its BAND — for each field; while the
   field's room stays inside its band, the width alone changes nothing and
   the fold is not tried anew. */
const BANDS=new Map();       // field -> {shelf, lo, hi}
// A shelf's room for its fields — the one a fold is decided in: the room its
// own bar takes now is given back (a bar is a consequence, never an input),
// so the room is the same with the bar and without.
const roomOf=shelf=>{
  const st_=getComputedStyle(shelf);
  return shelf.clientWidth-(parseFloat(st_.paddingLeft)||0)-(parseFloat(st_.paddingRight)||0)+(shelf._barPad||0);
};
/* THE EDGE TELLS. A band's edges are given to the browser (a media query of
   the window's width and height they stand at), and the browser tells when
   the window has crossed one: between the edges nobody looks at the band —
   not the engine either. The room a band is counted in is the window's
   width less what stands beside it, so an edge of the room is an edge of
   the window. An edge the browser cannot be given (no such query, or it
   does not hold at once) leaves its band BLIND: that one is looked at on
   every new size, as a last resort. */
const EDGES=new Map(), BLIND=new Set();
function edgesQuery(lo, hi, off, hLo, hHi){
  const q=[];
  if(lo>-Infinity && lo+off>0) q.push(`(min-width:${(lo+off).toFixed(2)}px)`);
  if(hi<Infinity) q.push(`(max-width:${(hi+off-0.01).toFixed(2)}px)`);
  if(hLo>0.5) q.push(`(min-height:${(hLo-0.5).toFixed(2)}px)`);
  if(hHi!==undefined && hHi<Infinity) q.push(`(max-height:${(hHi-0.51).toFixed(2)}px)`);
  return q.join(' and ');
}
function tellEdges(key, q, crossed){
  const was=EDGES.get(key);
  if(was){
    if(was.q===q && was.mql.matches) return;
    was.mql.removeEventListener('change', was.fn); EDGES.delete(key);
  }
  BLIND.delete(key);
  if(!q) return;                         // no edge: nothing to cross
  if(!window.matchMedia){ BLIND.add(key); return; }
  const mql=matchMedia(q);
  if(!mql.matches){ BLIND.add(key); return; }
  const fn=()=>{ if(!mql.matches) crossed(); };
  mql.addEventListener('change', fn);
  EDGES.set(key, {q, mql, fn});
}
// The fields whose room has left their band: only they are laid out anew.
// (Asked when an edge has told, or for a blind band.)
function bandsBroken(){
  const out=[];
  for(const [where,b] of BANDS){
    if(!where.isConnected || !seen(b.shelf)) continue;
    const room=roomOf(b.shelf);
    if(room < b.lo || room >= b.hi
       || innerHeight < (b.hLo||0)-0.5 || innerHeight >= (b.hHi===undefined ? Infinity : b.hHi)-0.5) out.push(where);
  }
  return out;
}
/* What an argument must redo after every layout (squeezes: who is pushed
   down depends on what the buttons say now). */
const AFTER_LAYOUT=[];
/* FOLLOWING — the engine's own way of moving, for everything it builds,
   not an animation. A thing is told where to be; from where it is drawn NOW
   it goes there at a SPEED: the farther the goal, the faster it goes (the
   distance over `ms`), so it never lags far behind — but never slower
   than a least speed, so it ARRIVES in a finite time instead of creeping up
   for ever. A new goal given on the way is followed from the place already
   reached, without a jerk. Speed is per millisecond, not per frame: a slow
   screen takes bigger steps and keeps up the same.

   One law for all: objects follow by their place, shelves by their height
   and bottom margin, scrolled rows by their scroll, appearing things by
   their opacity. The standard is for every object; an object's description
   may say otherwise by an argument: follow:false — it stands at once;
   follow:{...} — its own pace (see below); follow.window:{ms} — its pace
   after the window's size, and of all that lies in it (the standard: at once). Only while the window itself is
   dragged the layout stands where the hand puts it. */
/* THE ARGUMENTS of a move (follow:{ms, stiff, damping, gather, brake,
   fastest, arrive} in a description; the standard for every object that says
   nothing):
     ms        — the pace: the spring's stiffness is stiff/ms (the way takes
                 about 3·ms);
     stiff     — how hard the spring pulls, against the pace;
     damping   — 1: critical, it never passes its goal; less: it passes and
                 comes back (a softer spring), more: it creeps in;
     gather    — the most speed gathered a millisecond, speeding up (in
                 units of the least);
     brake     — how many times that it may shed a millisecond, slowing
                 down (2: from a move across a screen turned back it runs on
                 about half as far as it took to speed up);
     fastest   — the most speed, however far the goal (in units of the least);
     arrive    — a multiplier of the least speed, so it arrives in a finite
                 time and does not creep up for ever. */
function followArgs(el){
  const ds=(el && el.dataset) || {}, F=STANDARD.follow;
  const arg=(v, std)=>v!==undefined ? +v : std;
  const pw=paceAfterWindow(el);
  const ms = pw!==undefined && windowDragging() ? pw : arg(ds.followMs, F.ms);
  return {ms, fastest: arg(ds.followFastest, F.fastest),
          arrive: arg(ds.followArrive, F.arrive), stiff: arg(ds.followStiff, F.stiff),
          damping: arg(ds.followDamping, F.damping), gather: arg(ds.followGather, F.gather),
          brake: arg(ds.followBrake, F.brake),
          lag: arg(ds.followLag, F.lag)};
}
// One step of the way: from cur toward to, in dt ms — a mass on a spring
// with a damper (see STANDARD.follow); its speed is kept in st[k].
/* THE LAW IN THE PLANE (14.11, Makar: it goes along a curve, but how fast it
   goes is measured by the straight line to its goal). A way is its offset
   (dx, dy) and its velocity (vx, vy). At every small step the velocity is split
   against the straight line to the goal: the part TOWARD the goal goes by the
   law as it always did - the distance |offset| the spring, gathering at most
   `gather`, shedding at most `brake`, braking in time (never past the goal),
   put where its braking begins when at full speed from far; the part ACROSS
   that line has no goal of its own and is shed by the brake. The line to the
   goal is taken anew every step, so a way whose goal turned bends by itself:
   no curve is drawn, none is kept - the speed it had runs on and is turned. */
function approachPlane(g, dt, el, least){
  const a=followArgs(el), damping=a.damping;
  const w=a.stiff/Math.max(1, a.ms>0 ? a.ms : 1);
  const top=least*(a.fastest>0 ? a.fastest : Infinity), eps=Math.max(least*a.arrive, 1e-4);
  const gain=least*a.gather, stop=gain*(a.brake>0 ? a.brake : 1);
  const brakeD = damping>=1 && gain>0 ? top*top/(2*stop) : 2*damping*top/w;   // its braking way from full speed
  let ox=g.dx, oy=g.dy, vx=g.vx||0, vy=g.vy||0;
  if(!Number.isFinite(ox) || !Number.isFinite(oy)){ g.dx=g.dy=g.vx=g.vy=0; return; }
  // ONE STEP OF THE LAW, h ms (the same for the frames and for the way gone through unseen)
  const step=h=>{
    const d=Math.hypot(ox, oy);
    const rx = d ? -ox/d : 0, ry = d ? -oy/d : 0;             // toward the goal (the offset's 0)
    const vr=vx*rx+vy*ry;                                     // its speed toward the goal
    let tx=vx-vr*rx, ty=vy-vr*ry;                             // and across that line
    // TOWARD - the law on the distance, as in approachTo (u: how fast the distance changes)
    let u=-vr;
    let dv=(w*w*(0-d) - 2*damping*w*u)*h;
    const slowing = u!==0 && Math.sign(dv)!==Math.sign(u), m=Math.min(Math.abs(dv), stop*h);
    if(!slowing) dv=Math.max(-gain*h, Math.min(gain*h, dv));
    else if(m<=Math.abs(u)) dv=Math.sign(dv)*m;
    else dv=-u+Math.sign(dv)*Math.min(Math.abs(dv)-Math.abs(u), gain*(h-Math.abs(u)/stop));
    u+=dv;
    if(damping>=1 && gain>0 && u<0){ const vmax=Math.sqrt(2*stop*d); if(-u>vmax) u=-vmax; }
    // ACROSS - no goal of its own: shed by the brake
    const vt=Math.hypot(tx, ty);
    if(vt>0){ const k=Math.max(0, vt-stop*h)/vt; tx*=k; ty*=k; }
    vx=-u*rx+tx; vy=-u*ry+ty;
    const sp=Math.hypot(vx, vy); if(sp>top){ vx*=top/sp; vy*=top/sp; }
    let nx=ox+vx*h, ny=oy+vy*h;
    // never past the goal along its line (damping 1 and more): the crumb that would carry it over stops on it
    if(damping>=1 && d>0 && nx*ox+ny*oy<0 && (nx*rx+ny*ry)>0){ const along=nx*rx+ny*ry; nx-=along*rx; ny-=along*ry; const vrn=vx*rx+vy*ry; vx-=vrn*rx; vy-=vrn*ry; }
    ox=nx; oy=ny;
  };
  /* AT FULL SPEED THE WAY IS NOT GONE THROUGH (14.11, Makar: once it has
     reached its peak, it leaps straight to its braking). A thing at its full
     speed farther from its goal than its braking way is put on the straight line
     to the goal where its braking begins, going at the goal at that same full
     speed - whatever curve it was on (what of its speed lay across that line is
     gone with the leap). A formula, no steps: from there its way is the real one. */
  const skip=()=>{
    const d=Math.hypot(ox, oy);
    if(d<=brakeD || Math.hypot(vx, vy)<top*0.999) return;
    ox*=brakeD/d; oy*=brakeD/d;
    vx=-ox/brakeD*top; vy=-oy/brakeD*top;
  };
  const n=Math.max(1, Math.ceil(dt/4), Math.ceil(dt*w/0.5)), h=dt/n;
  for(let i=0;i<n;i++){ step(h); if(!g.noSkip) skip(); }      // (noSkip: the bench's honest way, gone through)
  if(Math.hypot(ox, oy)<2*eps && Math.hypot(vx, vy)<eps){ ox=oy=vx=vy=0; }     // it has arrived
  g.dx=ox; g.dy=oy; g.vx=vx; g.vy=vy;
}
function approach(cur, to, dt, el, least, st, k, damping){
  if(!Number.isFinite(cur) || !Number.isFinite(to)) return Number.isFinite(to) ? to : cur;
  return approachTo(cur, to, dt, followArgs(el), least, st, k, damping);
}
function approachTo(cur, to, dt, a, least, st, k, damping){
  if(damping===undefined) damping=a.damping;
  // A pace under a millisecond is a millisecond: the steps below are counted
  // from it, and a pace near nothing would be steps without end.
  const w=a.stiff/Math.max(1, a.ms>0 ? a.ms : 1);
  const top=least*(a.fastest>0 ? a.fastest : Infinity), eps=Math.max(least*a.arrive, 1e-4);
  const gain=least*a.gather;                        // the most speed gathered a millisecond
  const stop=gain*(a.brake>0 ? a.brake : 1);        // and the most shed
  let x=cur, v=Number.isFinite(st[k]) ? st[k] : 0;
  // Small steps, so a slow frame is the same way as fast ones — at most 4 ms, and small enough for a stiff spring (a pace
  // of a few ms would swing for ever on 4 ms steps).
  const n=Math.max(1, Math.ceil(dt/4), Math.ceil(dt*w/0.5)), h=dt/n;
  for(let i=0;i<n;i++){
    let dv=(w*w*(to-x) - 2*damping*w*v)*h;
    // Speeding up, at most `gain` a millisecond; slowing down, at most
    // `stop`. A thing going fast does not stop dead when its goal turns
    // back — it runs on, slowing, and only then comes back (the speed it had
    // is kept). A step that stops it and goes on the other way spends the
    // rest of its time speeding up again — gathered.
    const slowing = v!==0 && Math.sign(dv)!==Math.sign(v), m=Math.min(Math.abs(dv), stop*h);
    if(!slowing) dv=Math.max(-gain*h, Math.min(gain*h, dv));
    else if(m<=Math.abs(v)) dv=Math.sign(dv)*m;
    else dv=-v+Math.sign(dv)*Math.min(Math.abs(dv)-Math.abs(v), gain*(h-Math.abs(v)/stop));
    v += dv;
    // So that it never passes a goal it is sent to (damping 1 and more), it
    // brakes in time: going toward the goal, never faster than it can stop
    // in what is left with that most of slowing — √(2·stop·d).
    if(damping>=1 && gain>0 && (to-x)*v>0){
      const vmax=Math.sqrt(2*stop*Math.abs(to-x));
      if(Math.abs(v)>vmax) v=Math.sign(v)*vmax;
    }
    v = Math.max(-top, Math.min(top, v));
    let nx=x+v*h;
    if(damping>=1 && (to-x)*(to-nx)<0){ nx=to; v=0; }     // (the last crumb of a step does not carry it past)
    x=nx;
    /* AT FULL SPEED THE WAY IS NOT GONE THROUGH. Going toward its goal at
       its fastest, a thing only keeps that speed until it has to brake — at
       top²/(2·stop) before the goal (the spring's own, 2·damping·top/w, for a
       softer one). That stretch grows with the distance and nothing happens
       on it: on a screen of a million pixels it would take minutes. So it is
       not gone through — the thing is put where its braking begins, at the
       speed it would have there (the same), and from there on its way is
       exactly the real one. A way shorter than the run-up to full speed
       never gets here: on an ordinary screen nothing changes. */
    if(Math.abs(v)>=top && Math.sign(v)===Math.sign(to-x)){
      const brake = damping>=1 && gain>0 ? top*top/(2*stop) : 2*damping*top/w;
      if(Math.abs(to-x)>brake) x=to-Math.sign(v)*brake;
    }
  }
  if(Math.abs(to-x)<2*eps && Math.abs(v)<eps){ st[k]=0; return to; }   // it has arrived
  st[k]=v;
  return x;
}
const stands=x=>x.closest && x.closest('[data-follow="no"]');
/* SEEN BY THE LAYOUT: drawn, and not hidden. A thing hidden goes out where it
   was drawn (see goOut) - drawn still, but out of everything the layout asks:
   whatever counts what stands in a field asks this, not just whether it is
   drawn. */
// (THE ONE RULE of being there for the layout: every walk that counts things asks
// this - nothing else - 14.11: walks that asked only "is it drawn" took a ghost for one that stands.)
const seen=x=>x.offsetParent!==null && !x.closest('[hidden]');
/* LESS MOTION. When the system asks for it (prefers-reduced-motion), nothing
   goes on its way: every goal is reached at once — places, heights, colors,
   appearing. One switch for the whole engine; what the hand itself moves (a
   scroll, a thing dragged) still goes under the hand. The user's own choice
   (Motion, in the settings) stands over the system's. */
const lessMotion=window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
let motionChoice=null;       // null — as the system says; true / false — the user's
try{ const m=localStorage.getItem('repix.motion'); if(m==='yes' || m==='no') motionChoice = m==='yes'; }catch(_){}
const still=()=>motionChoice!==null ? !motionChoice : !!(lessMotion && lessMotion.matches);
/* COLORS FOLLOW TOO. The goal is a color; the engine takes it from the color
   drawn NOW (on the way or standing), so a new goal midway just turns it. */
const TINT={dataset:{followMs:STANDARD.tint.ms}};
const hexRgb=h=>/^#[0-9a-f]{6}$/i.test(h||'') ? [1,3,5].map(i=>parseInt(h.slice(i,i+2),16)) : null;
const rgbHex=c=>'#'+c.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
/* CHANNELS — HOW AN ANIMATION IS MADE. Everything the engine moves by the
   law is on a CHANNEL, described by one record; the engine keeps, for each
   thing on it, its value, its speed and its goal, moves it every frame and
   draws it. A new kind of motion is one more record — not one more loop:
     least(x, goal) — the least speed, in the channel's own units a
                      millisecond (when it has arrived, how fast it gathers);
     args(x, goal)  — the law's arguments (by default the thing's own:
                      followArgs);
     read(x, goal)  — the value drawn now, for a thing new on it (undefined:
                      it takes its goal at once — a first value stands);
     draw(x, v)     — draws a value;
     done(x, goal, final) — draws the goal reached (by default: draw).
   A value is a number, or a list of numbers (a color), which goes along its
   straight line. aim(name, x, goal, {final, then, glide}) gives the goal —
   `then` is called when it is reached; `glide` — it was let go with speed
   and glides there, losing that share of its speed a millisecond (the goal
   is where the glide ends); aimed(name, x) is the goal on its way. A
   thing that stands (follow:false), or while the window is dragged, takes
   its goal at once. */
const CHANNELS=new Map();          // name -> {def, on: Map(thing -> {value, goal, v, final, then})}
function channel(name, def){ CHANNELS.set(name, {def, on:new Map()}); }
const sameValue=(a,b)=>Array.isArray(a) ? a.every((v,i)=>Math.abs(v-b[i])<1e-6) : a===b;
function aimed(name, x){ const g=CHANNELS.get(name).on.get(x); return g ? g.goal : undefined; }
function arrive(def, x, goal, final, then){ (def.done || def.draw)(x, goal, final); if(then) then(); }
function aim(name, x, goal, o={}){
  const c=CHANNELS.get(name), def=c.def, g=c.on.get(x);
  const at = g ? g.value : def.read(x, goal);
  const atOnce = still() || (x && x.nodeType===1 && (stands(x) || windowDragging()));
  if(at===undefined || at===null || goal===null || atOnce || sameValue(at, goal)){
    c.on.delete(x); arrive(def, x, goal, o.final, o.then); return;
  }
  // Its speed goes on — for a list of numbers, only its part along the new
  // way (the speed is kept as the way left shrinking or growing).
  let v = g ? g.v : 0;
  if(g && v && Array.isArray(goal) && Array.isArray(g.goal)){
    const unit=(a,b)=>{ const d=a.map((q,i)=>q-b[i]), l=Math.hypot(...d); return l ? d.map(q=>q/l) : null; };
    const was=unit(g.goal, at), now=unit(goal, at);
    v = was && now ? v*was.reduce((a,q,i)=>a+q*now[i], 0) : 0;
  }
  c.on.set(x, {value:at, goal, v, final:o.final, then:o.then, glide:o.glide});
  def.draw(x, at);                 // drawn from where it is, from the start
  followOn();
}
function stepChannels(dt){
  for(const [, c] of CHANNELS) for(const [x,g] of c.on){
    const def=c.def, least=def.least(x, g.goal), a=def.args ? def.args(x, g.goal) : x;
    if(g.glide){
      // LET GO WITH SPEED, it glides: `glide` of its speed lost a millisecond,
      // it ends where that takes it (its goal) — the way left shrinks as its
      // speed does, from the hand's speed on, never speeding up.
      const f=Math.exp(-g.glide*dt), eps=least*STANDARD.follow.arrive;
      g.value = Array.isArray(g.goal) ? g.goal.map((v,i)=>v+(g.value[i]-v)*f) : g.goal+(g.value-g.goal)*f;
      const left = Array.isArray(g.goal) ? Math.hypot(...g.goal.map((v,i)=>g.value[i]-v)) : Math.abs(g.value-g.goal);
      g.v=-g.glide*left;                   // its speed (the way left shrinking), kept for a goal given on the way
      if(left<2*eps) g.value = Array.isArray(g.goal) ? g.goal.slice() : g.goal;
    } else if(Array.isArray(g.goal)){
      const d=g.value.map((v,i)=>v-g.goal[i]), len=Math.hypot(...d);
      const left = len>0 ? approach(len, 0, dt, a, least, g, 'v') : 0;
      g.value = left<=0 ? g.goal.slice() : g.goal.map((v,i)=>v+d[i]*left/len);
    } else g.value=approach(g.value, g.goal, dt, a, least, g, 'v');
    if(sameValue(g.value, g.goal) || (x && x.nodeType===1 && !x.isConnected)){
      c.on.delete(x); arrive(def, x, g.goal, g.final, g.then);
    } else def.draw(x, g.value);
  }
}
const channelsBusy=()=>[...CHANNELS.values()].some(c=>c.on.size);

// FADING: how much of a thing is there (its opacity, or the share its
// fades argument names); its own time to come and to go (appear, vanish).
const fadeMs=(x, goal)=>goal>0 ? (+x.dataset.appearMs || STANDARD.appear.ms) : (+x.dataset.vanishMs || STANDARD.vanish.ms);
channel('fade', {
  least:(x, goal)=>1/fadeMs(x, goal),
  args:(x, goal)=>({dataset:{...x.dataset, followMs:fadeMs(x, goal)/3}}),
  read:(x, goal)=>shareOf(x, goal>0 ? 0 : 1),
  draw:(x, v)=>setShare(x, v),
  done:(x, goal)=>setShare(x, goal>0 ? null : 0)});
// A TURN: the angle, in degrees.
channel('turn', {
  least:()=>0.5,
  read:x=>x._deg,
  draw:(x, a)=>{ x._deg=a; x.style.rotate = a ? a+'deg' : ''; const g=going.get(x); if(g){ const d=drawnOff(g); x.style.transform=wayTransform(x, d.x, d.y); } }});   // (its way stays where it is on the screen as it turns)
// A COLOR of the theme (a CSS variable of the page), along its line in RGB;
// the first colors, or one that is no plain color, stand at once.
channel('tint', {
  least:()=>STANDARD.tint.least,
  args:()=>TINT,
  read:name=>hexRgb(document.documentElement.style.getPropertyValue(name).trim()),
  draw:(name, c)=>document.documentElement.style.setProperty(name, rgbHex(c)),
  done:(name, goal, final)=>document.documentElement.style.setProperty(name, final)});
const turnTo=(el, deg)=>aim('turn', el, deg);
function tintTo(name, goal){
  const to=hexRgb(goal);
  if(!to){ CHANNELS.get('tint').on.delete(name); document.documentElement.style.setProperty(name, goal); return; }
  aim('tint', name, to, {final:goal});
}
/* THE STATE. Where a thing is drawn is the engine's own data, never read
   back from the page: its PLACE in its AREA (where the layout put it in its
   parent's content, as of the last settling) and its OFFSET on the way (how
   far it is still drawn from that place). It rides its area: where the area
   is, is nothing to it. A shelf likewise: its height and bottom margin as
   laid out, and as drawn on the way. */
const placed=new WeakMap();// object -> {x, y, ax, ay, pa, w, h}: its place in its area (pa), on the screen, and its size
const forgotten=new WeakSet();   // not shown: its place and the places of all in it are forgotten
// What is not shown has no place: shown again, it comes where it is put (it
// appears there), not from where it stood before it was hidden.
function forget(x){
  if(forgotten.has(x)) return;
  forgotten.add(x); placed.delete(x);
  for(const d of x.querySelectorAll('*')) placed.delete(d);
}
// Shown by this very change (told by the page's records, see judgeShown):
// nothing in it stood anywhere before, so nothing in it was moved.
const justShown=new Set();
// Put elsewhere on the page by this very change (told by the records too):
// a thing that had a place and was moved — asked where it stands now.
const movedIn=new Set();
// Nothing told what changed (a new scale, a new font, a layout from scratch):
// the next settling asks everything.
var lookAtAll=true;
const going=new Map();     // object -> {dx, dy, v}: its offset on the way
const shelfPlaced=new Map();// shelf -> {h, mb}
const shelfGoing=new Map();// shelf -> {h, mb, h1, mb1, mbStyle, mhStyle, ov, vh, vm}
/* FLOATING WINDOWS (fixed: the menu, the color window, the question, a
   hint) follow by their box too: where they stand and how large they are.
   Drawn = the laid-out box moved by `translate`, cut down to a smaller size
   by `clip-path`, held out to a larger one by min-width/min-height. */
const floatPlaced=new Map();// window -> {x, y, w, h} as laid out
const floatGoing=new Map(); // window -> {x, y, w, h (drawn), to:{x,y,w,h}, v…}
const scrolling=new Map(); // scrolled row -> {key, to, v}
const stretching=new Map();// pulled scroll -> {along, o, to, v}: its stretch past the end
let windowDragged=-Infinity, followFrame=0, lastFrame=0, followScale=0;
let watcher=null;          // the page's changes, seen as inputs (below)
// The window changed: every placed thing takes its goal anew (against the
// window, or against what the new window moved).
/* (A placed thing is put HERE, in the window's own word of its new size — not
   left to the size observers: the frame's callbacks come before them, and a
   thing still as tall as the old window would be seen spilling out of its
   area for that moment.) */
addEventListener('resize',()=>{ windowDragged=performance.now(); for(const g of going.values()) g.at=g.box=null; for(const x of stuckNow()) placeAt(x); });
function followOn(){ if(!followFrame) followFrame=requestAnimationFrame(followStep); }
/* THE LEASH of a thing on its way (follow.lag): how long it is now along
   the thing's line.
     — Its CONTENT stays in the window: what it shows (its children, or
       itself when it has none) is never drawn past the window's edge when
       its place is in the window. A wide box (a row of its own) is no reason
       to hold back the words in it.
     — Following the window, it lags its goal by `lag` lines at most. A turn
       of its shelf's state is its own way, not a lag: no such leash then. */
function leash(x, g){
  let most=Infinity;
  if(windowDragging() && !movedByTurn(shelfOf(x))) most=followArgs(x).lag*STANDARD.line*gridPixel();
  const room=(u, lo, hi, max)=>{
    if(lo<0 || hi>max) return Infinity;          // its place itself is out: nothing to keep
    return u>0 ? (max-hi)/u : u<0 ? lo/(-u) : Infinity;
  };
  // Its place is carried by the areas it stands in: those on their own way
  // are drawn off their places, and it with them (their offsets are data).
  let cx=0, cy=0;
  for(let a=x.parentElement; a && a!==document.body; a=a.parentElement){ const ga=going.get(a); if(ga){ const d=drawnOff(ga); cx+=d.x; cy+=d.y; } }
  const along=b=>Math.min(room(g.ux, b.L+cx, b.R+cx, innerWidth), room(g.uy, b.T+cy, b.B+cy, innerHeight));
  /* BY THE DATA, nothing read: where the thing's own box stands at its place
     was noted when it was sent on its way (g.at). Its content is inside that
     box (none of it is on a way of its own), so the content's leash is no
     shorter than the box's — and while the box's is slack, so is the content's. */
  if(g.at && !g.box && g.at.L+cx>=0 && g.at.T+cy>=0 && g.at.R+cx<=innerWidth && g.at.B+cy<=innerHeight){
    let own=true; for(const c of x.children) if(going.has(c)){ own=false; break; }
    if(own){ const L=along(g.at); if(g.s<=SLACK*L) return Math.max(0, Math.min(most, L)); }
  }
  // Tight: where each part of its content stands at ITS place — read once for
  // the way (anew after the window changed); a part on a way of its own is
  // drawn off that place by its own offset, which is data.
  if(!g.box){
    const off=g.drawn ? g.drawn : {x:g.dx, y:g.dy};
    const kids=[...x.children].filter(c=>c.getClientRects().length);
    g.box=(kids.length ? kids : [x]).map(c=>{
      const r=c.getBoundingClientRect(), d = c===x ? {x:0, y:0} : drawnOff(going.get(c));
      return {el:c, L:r.left-off.x-cx-d.x, T:r.top-off.y-cy-d.y, R:r.right-off.x-cx-d.x, B:r.bottom-off.y-cy-d.y};
    });
  }
  let L=Infinity, T=Infinity, R=-Infinity, B=-Infinity;
  for(const k of g.box){
    const d = k.el===x ? {x:0, y:0} : drawnOff(going.get(k.el));
    L=Math.min(L, k.L+d.x); T=Math.min(T, k.T+d.y); R=Math.max(R, k.R+d.x); B=Math.max(B, k.B+d.y);
  }
  return Math.max(0, Math.min(most, along({L, T, R, B})));
}
// Where a thing on its way is DRAWN off its place (on its leash, maybe short
// of its way): a new goal is taken from there.
const drawnOff=g=>!g ? {x:0, y:0} : g.drawn ? {x:g.drawn.x, y:g.drawn.y} : {x:g.dx, y:g.dy};
/* A WAY IS ON THE SCREEN (14.11, Makar: the flip button, turned a quarter while
   the windows stand stacked, flew up and fell as the window was jerked left and
   right). A thing's own transform comes after its own turn and scale (CSS: the
   rotate and scale properties, then transform), so an offset written plainly
   is turned with the thing - its way across drawn up and down. The offset is
   written in the thing's own frame: the screen's offset turned back, unscaled. */
function wayTransform(x, dx, dy){
  const deg=x._deg||0, sc=x.style.scale ? parseFloat(x.style.scale)||1 : 1;
  if(!deg && sc===1) return `translate(${dx}px,${dy}px)`;
  const a=-deg*Math.PI/180, c=Math.cos(a), s=Math.sin(a);
  return `translate(${(dx*c-dy*s)/sc}px,${(dx*s+dy*c)/sc}px)`;
}
/* THE SPEED IS CARRIED AS IT IS (14.11: carried as a bare number "towards the
   goal", a thing whose goal turned back flipped its motion in one frame). A way
   keeps its velocity in the plane (vx, vy: how its offset moves); a new goal
   changes nothing of it - the law in the plane turns it (approachPlane). */
const carried=g=>g ? {vx:g.vx||0, vy:g.vy||0} : {vx:0, vy:0};
// A thing shown while its ghost still went: the speed it had, for the way it is given back (taken once).
const speedBack=new WeakMap();
const carriedBack=(x, g)=>{ if(g) return carried(g); const v=speedBack.get(x); if(v){ speedBack.delete(x); return v; } return {vx:0, vy:0}; };
/* THE LEASH TIGHTENS: an offset s drawn on a leash of length L. Slack for
   three quarters of it — drawn where it is; over the last quarter it
   tightens by the stretch's own curve (as a scroll pulled past its end),
   reaching the end softly. */
var SLACK=0.75;
/* (14.11) THE LEASH NEVER MOVES A THING FROM WHERE IT IS DRAWN: its knee is
   no nearer than where the way began (`knee`, noted at its first leash) - a
   thing whose way starts in the last quarter of its room (a group standing at
   the window's edge, its new place far) was drawn nearer at once and jumped.
   Only what would go farther toward the edge than it was is held, softly. */
function onLeash(s, L, knee){
  if(!(L<Infinity)) return s;
  if(L<=0) return 0;
  const k=Math.min(L, Math.max(SLACK*L, knee||0));
  if(s<=k) return s;
  const R=L-k; if(R<=0) return L;
  const t=Math.min(1, (s-k)/(2*R));
  return k + R*(1-(1-t)*(1-t));
}
/* WHEN IT IS THERE. What must wait for a thing on its way (pictures that come
   back into windows only when the line between them stands) is told when the
   thing has arrived; a thing that is not on its way is there already. */
const ARRIVALS=new Map();
function whenThere(x, then){
  if(!x || !going.has(x)){ then(); return; }
  if(!ARRIVALS.has(x)) ARRIVALS.set(x, []);
  ARRIVALS.get(x).push(then);
}
function tellArrivals(){
  if(!ARRIVALS.size) return;
  for(const [x,list] of [...ARRIVALS]) if(!going.has(x)){ ARRIVALS.delete(x); for(const f of list) f(); }
}
function followStep(now){
  followFrame=0;
  const dt=Math.max(0, Math.min(100, now-(lastFrame||now-16))); lastFrame=now;
  // Ghosts carried by their holders FIRST - before anything reads a box this frame
  // (14.11: a leash read a ghost's knob 74 px off - its holder had moved, the ghost
  // not yet - cut its way to 21 px, and a new goal taken from there made it jump).
  ghostsRide();
  const least=STANDARD.follow.least*gridPixel();
  // Stepped, then their leashes read (all reads together, nothing written
  // between them: one layout), then drawn.
  const moving=[];
  for(const [x,g] of going){
    // The offset goes to 0 by the law in the plane (approachPlane): along a
    // curve when its goal turned on the way, at the speed the straight line to
    // the goal asks.
    approachPlane(g, dt, x, least);
    g.s=Math.hypot(g.dx, g.dy);
    if(!x.isConnected || (g.s===0 && !g.vx && !g.vy)){ x.style.transform=''; going.delete(x); lower(x); continue; }
    if(g.s>0){ g.ux=g.dx/g.s; g.uy=g.dy/g.s; }    // its line now: its place to where it is (the leash measures along it)
    moving.push([x,g]);
  }
  tellArrivals();
  for(const [x,g] of moving) g.lim=leash(x, g);
  for(const [x,g] of moving){
    // The way itself is untouched (its goal, its speed, its brake): only
    // where it is drawn on it is held by the leash.
    if(g.knee===undefined && g.lim<Infinity) g.knee=Math.min(g.s, g.lim);   // where this way began: drawn there as it is
    const d=onLeash(g.s, g.lim, g.knee);
    g.drawn={x:(g.ux||0)*d, y:(g.uy||0)*d};
    x.style.transform=wayTransform(x, g.drawn.x, g.drawn.y);
  }
  for(const [sh,g] of shelfGoing){
    g.h=approach(g.h, g.h1, dt, sh, least, g, 'vh'); g.mb=approach(g.mb, g.mb1, dt, sh, least, g, 'vm');
    if(g.h===g.h1 && g.mb===g.mb1){
      unshelf(sh, g); shelfGoing.delete(sh);
      if(sh._bar) sh._bar.draw();          // arrived: its bar, if it scrolls now (see resizing)
      continue;
    }
    sh.style.height=g.h+'px'; sh.style.marginBottom=g.mb+'px';
  }
  stepChannels(dt);
  ridePlaced();
  dividersAtDrawn();
  ghostsFade();                  // (vanish:{withWay}: a ghost as faded as its way is gone)
  for(const [x,g] of floatGoing){
    for(const k of ['x','y','w','h']) g[k]=approach(g[k], g.to[k], dt, x, least, g, 'v'+k);
    if(!x.isConnected || ['x','y','w','h'].every(k=>g[k]===g.to[k])){ unfloat(x); floatGoing.delete(x); if(x._bar) x._bar.draw(); continue; }   // (there: its bar, if it scrolls now)
    drawFloat(x, g);
  }
  for(const [x,g] of stretching){
    // What is IN the pulled scroll stands off by the stretch, inside its
    // box, which cuts it; the shutters stay at the edges.
    g.o=approach(g.o, g.to, dt, x, least, g, 'v');
    if(g.back && g.o===g.to){ g.to=0; g.back=false; }            // out, now back
    const done = !x.isConnected || (g.o===g.to && g.to===0);
    const off = done ? '' : (g.along==='x' ? `${-g.o}px 0` : `0 ${-g.o}px`);
    standOff(x, off);
    if(done) stretching.delete(x);
  }
  roomsOfStep=new Map();
  try{
  for(const [x,g] of scrolling){
    if(!x.isConnected){ scrolling.delete(x); if(g.over) standOff(x, ''); continue; }
    /* MOVED BY ANOTHER: the page set the scroll itself (a page of a window shown
       from its top), or the browser cut it to a smaller room - it stands where
       it was put, and the way it was on is over: its place and speed were of
       content that is gone (14.11: the guide scrolled down, then the settings
       shown - the scroll went on from the guide's place, far past the short
       page's end, and bounced on the edge's rubber). */
    if(x._at!==undefined && Math.abs(x[g.key]-x._at)>1){
      scrolling.delete(x); stretching.delete(x); if(g.over || x._stretched) standOff(x, '');
      x._at=x[g.key]; drawBarsOf(x); continue;
    }
    const S=STANDARD.scroll, L=gridPixel()*STANDARD.line;
    const room=scrollRoom(x, g.along);
    // Its place (past an edge too) and its speed are its own.
    if(g.pos===undefined) g.pos=x[g.key];
    const was=g.pos;
    if(g.held && g.input==='finger') g.pos=g.goal;                 // under the finger
    else if(g.held){
      // Held by a bar: a spring with play on the bar's goal.
      const target = g.hand ? handGoal(g, now) : g.goal;
      let next=g.pos+(target-g.pos)*Math.min(1, dt/S.soft);
      const lag=target-next, slack=S.slack*L;
      if(Math.abs(lag)>slack) next=target-Math.sign(lag)*slack;
      if(Math.abs(target-next)<0.5) next=target;
      g.pos=next;
    } else {
      // Free: its mass on the spring to the goal — softer at an edge.
      const atEdge = g.goal<=0.5 || g.goal>=room-0.5;
      g.pos=approach(g.pos, g.goal, dt, x, least, g, 'v', atEdge ? S.edge : STANDARD.follow.damping);
    }
    // The hand's speed, kept for the let-go: of its last move (a frame with
    // no move is no stop — a hand still for 80 ms is).
    if(g.held && Math.abs(g.pos-was)>0.01){ g.v=(g.pos-was)/Math.max(1, dt); g.vAt=performance.now(); }
    const inside=Math.max(0, Math.min(room, g.pos));
    x[g.key]=inside;
    // A step the page did not take (it counts whole pixels): near the goal, it is there.
    if(!g.held && Math.abs(x[g.key]-inside)>0.01 && Math.abs(g.goal-inside)<2){ x[g.key]=g.goal; g.pos=g.goal; }
    x._at=x[g.key];                 // where the engine put it (see makeScroll)
    // Its bar is drawn in the same step: waiting for the page's scroll event
    // (a frame later) it would ride the content for a frame and jump back.
    drawBarsOf(x);
    // Past an edge by its own speed: what is in it stands off, stretched.
    const arrived = !g.held && g.pos===g.goal;
    const over = g.held || arrived || Math.abs(g.pos-inside)<0.5 ? 0 : g.pos-inside;
    // (The hand's pull, while it is drawn, draws the stretch alone.)
    if((over || g.over) && !stretching.has(x)){
      const off=stretchOf(x, g.along, over), t = over ? (g.along==='x' ? `${-off}px 0` : `0 ${-off}px`) : '';
      standOff(x, t);
      g.over=!!over;
    }
    if(arrived){ scrolling.delete(x); x.dispatchEvent(new Event('scroll')); }
  }
  } finally { roomsOfStep=null; }
  pruneTurning();
  // What the following itself wrote is not a change to settle.
  if(watcher) noteContent(watcher.takeRecords());
  if(going.size || shelfGoing.size || floatGoing.size || scrolling.size || stretching.size || channelsBusy()) followOn();
  else lastFrame=0;
}
/* THE SHELVES are the page's own rows (the body's children that stand in
   the flow); what takes the room they leave says so itself (the `rest`
   argument) and is no shelf. */
const shelvesNow=()=>[...document.body.children].filter(x=>seen(x) && !('rest' in x.dataset)
  && getComputedStyle(x).position!=='fixed' && !stands(x));
// Everything the engine shows is an object that follows — not the parts of
// an icon, not a paint tile (the strip moves whole), not a background.
const MOVERS='body *:not(svg *):not(option):not(.tile):not([data-background]):not([data-background] *)';
/* WHO IS ASKED (see settle): from the touched nodes, through their areas.
   `deep` — a touched node is itself suspect, with all that stands in it (the
   change was in it); not deep — it is only an area that came out another
   size (the window moved it): what stands in it is asked, and opened only
   where it too came out another size. */
function whoIsAsked(touched, deep, inScope, rectOf){
  const look=new Set(), opened=new Map();
  const resized=x=>{
    const p=placed.get(x); if(!p || p.w===undefined) return true;
    const r=rectOf(x); return Math.abs(r.width-p.w)>=0.5 || Math.abs(r.height-p.h)>=0.5;
  };
  const see=(c, suspect)=>{
    if(!seen(c)){ forget(c); return; }        // (one going out, and all in it, is not shown either)
    forgotten.delete(c);
    if(stands(c)) return;
    const mover = c.parentElement!==document.body && c.matches(MOVERS);
    if(mover) look.add(c);
    if(c.matches('svg,[data-background]')) return;
    /* NEW — it has no place yet (just shown, or never asked): it is noted
       where it stands, and NOT opened: nothing in it had a place, so nothing
       in it has a way to go. What stands in it is asked when a change comes
       into it — then the change is in it itself (touched, and not just
       shown): it is opened, one step in. */
    const fresh = mover && !placed.has(c);
    const hit = deep && touched.has(c);
    if(fresh && !(hit && !justShown.has(c))) return;
    const sus = !fresh && (suspect || hit);
    if(opened.get(c)===true || (opened.has(c) && !sus)) return;
    if(sus || resized(c)){ opened.set(c, sus); for(const k of c.children) see(k, sus); }
  };
  // What is IN a thing just shown was moved by nothing, it appeared with it:
  // a change in it is a change of that thing — it is the one that came.
  const shownOver=t=>{ let top=t; for(let a=t.parentElement; a && a!==document.body; a=a.parentElement) if(justShown.has(a)) top=a; return top; };
  const from=new Set();
  for(const t of touched) if(t.isConnected && t!==document.body && t!==document.documentElement) from.add(justShown.size ? shownOver(t) : t);
  for(const t of from){
    if(t.parentElement===document.body){
      // A shelf or a window hidden: what stood in it has no place any more.
      if(t.hidden){ for(const k of t.children){ forgotten.delete(k); forget(k); } continue; }
      if(justShown.has(t)) continue;                       // just shown: nothing in it was moved
      opened.set(t, deep); for(const k of t.children) see(k, deep); continue;
    }
    see(t, deep);
    for(let a=t; a.parentElement && a.parentElement!==document.body; a=a.parentElement){
      const pa=a.parentElement;
      for(const k of pa.children) see(k, false);            // what stands beside it
      if(pa.parentElement===document.body) break;          // a shelf: its height is the shelves' own
      if(!resized(pa)) break;                              // it kept its size: beyond it nothing moved
    }
  }
  // What stands by a goal against another thing goes with that thing.
  for(const x of stuckNow()) if(x.isConnected && (!inScope || inScope(x))) see(x, false);
  for(const x of movedIn) if(x.isConnected && (!inScope || inScope(x))) see(x, false);
  return look;
}
/* SETTLING — what the engine does with ANY change, whatever brought it (a
   press, a stage, a new text, a key): the change is an input; the engine
   takes the new places the layout gives, and for every thing sets its way
   from where it is DRAWN — by the data, not by a look at the page — to its
   new place. Nothing has to be noted before a change: a page changed by
   halves breaks nothing, the old places are in the data.
   While the window is dragged, or at a new scale, everything stands at its
   new place at once (old places mean nothing then). */
let settling=false;
// Shelves whose STATE turned, while their way to it goes on (see settle);
// one is done when nothing on it is on the way any more.
const turning=new Set();
/* A shelf below one whose state turned is moved BY it: it goes the same
   smooth way. `sh` is moved by a turning shelf if it is that shelf or stands
   after it on the page. */
const movedByTurn=sh=>!!sh && [...turning].some(t=>t===sh || (t.compareDocumentPosition(sh) & Node.DOCUMENT_POSITION_FOLLOWING));
function pruneTurning(){
  // Done when nothing on it, or on a shelf below it, is on the way any more.
  const below=(t,sh)=>!!sh && (t===sh || !!(t.compareDocumentPosition(sh) & Node.DOCUMENT_POSITION_FOLLOWING));
  for(const sh of turning)
    if(![...shelfGoing.keys()].some(x=>below(sh,x)) && ![...going.keys()].some(x=>below(sh, shelfOf(x)))) turning.delete(sh);
}
// A shelf drawn on its way given back to the layout: its own styles again.
function unshelf(sh, g){ sh.style.height=''; sh.style.marginBottom=g.mbStyle; sh.style.maxHeight=g.mhStyle; sh.style.overflow=g.ov; }
// The floating windows in view.
function floatsNow(){
  return [...document.body.children].filter(x=>!x.hidden && !stands(x) && x.getClientRects().length
    && getComputedStyle(x).position==='fixed' && getComputedStyle(x).visibility!=='hidden');
}
// A window drawn as the data says: moved, cut or held out to its drawn box.
function drawFloat(x, g){
  const t=g.to;
  x.style.translate=`${g.x-t.x}px ${g.y-t.y}px`;
  x.style.minWidth = g.w>t.w ? g.w+'px' : '';
  x.style.minHeight = g.h>t.h ? g.h+'px' : '';
  x.style.clipPath = (g.w<t.w || g.h<t.h) ? `inset(0 ${Math.max(0,t.w-g.w)}px ${Math.max(0,t.h-g.h)}px 0)` : '';
}
function unfloat(x){ x.style.translate=''; x.style.minWidth=''; x.style.minHeight=''; x.style.clipPath=''; }
// The window is being dragged: everything stands where the layout puts it.
const windowDragging=()=>performance.now()-windowDragged<STANDARD.windowRest;
// The shelf a thing stands on: the body's child it is in.
const shelfOf=x=>{ while(x && x.parentElement && x.parentElement!==document.body) x=x.parentElement; return x; };
function settle(touched, only=false, deep=true, asWindow=false){
  if(settling) return;
  settling=true;
  try{
    const scale=gridPixel()*(window.devicePixelRatio||1);
    const dragged=asWindow || windowDragging(), rescaled = scale!==followScale;
    // The window moved things and their places are not noted yet (a change
    // that came by itself, with no word before it): where they stood is not
    // known — what this change is asked about stands at once.
    const unknown = placesOld && !only && !asWindow;
    /* At once while the window is dragged or at a new scale — except a shelf
       whose STATE turned (it rolled into one row or out of it): a change of
       state is no following of the window, it goes smoothly. */
    const quiet=still() || unknown || asWindow==='at once';
    followScale=scale;
    /* WHAT CHANGED IS TOLD BY THE PAGE. Called with nothing (a named change,
       smoothly), the engine takes the page's own records of it: which nodes
       were touched. No record at all, or a change that moves everything —
       then, and only then, everything is asked. */
    let all=false;
    if(!only){
      if(!touched && watcher){
        const told=watcher.takeRecords();
        if(told.length){
          judgeShown(told);
          touched=new Set();
          for(const m of told){ const x = m.target.nodeType===1 ? m.target : m.target.parentElement; if(x && x.isConnected && !stands(x)) touched.add(x); }
        }
      }
      if(!touched || lookAtAll || rescaled){ all=true; touched=undefined; }
      lookAtAll=false;
    }
    const atOnceFor = sh => quiet || rescaled || (dragged && !movedByTurn(sh));
    const atOnce = quiet || rescaled || (dragged && !turning.size);
    // What the change touched: its shelves only (all of them when nothing
    // says which). A thing on another shelf moves with its shelf, whose
    // height follows by itself.
    // ONLY: these things themselves, not their shelves (a window's step moves
    // the window-paced ones; the rest of their shelves stand).
    const scope = touched ? new Set([...touched].map(shelfOf).filter(Boolean)) : null;
    const inScope = only ? (x=>touched.has(x)) : (x=>!scope || scope.has(shelfOf(x)));
    // What went to another area comes from where it stands drawn in its OLD
    // area now (that area is still on the screen; as it was left, with its
    // own offset) — see below.
    // (Who may have gone: what stands in the touched areas, and the wanderers.)
    const movedAway=new Map();
    const mayHaveGone = all ? [...document.querySelectorAll(MOVERS)]
      : [...new Set([...touched].flatMap(t=>t.isConnected ? [t, ...t.children] : []).concat([...WANDERERS]))];
    for(const x of mayHaveGone){
      const p=placed.get(x);
      if(!p || !x.isConnected || p.pa===x.parentElement) continue;
      WANDERERS.add(x);
      const g=going.get(x), od = drawnOff(g);
      if(drawnBefore && drawnBefore.has(x)) movedAway.set(x, drawnBefore.get(x));   // exactly
      else if(p.pa && p.pa.isConnected){
        const r=p.pa.getBoundingClientRect();
        movedAway.set(x, {x:r.left-p.pa.scrollLeft+p.x+od.x, y:r.top-p.pa.scrollTop+p.y+od.y});
      } else movedAway.set(x, {x:p.ax+od.x, y:p.ay+od.y});
    }
    // The layout's own places: the offsets in scope and every shelf's drawn
    // height off for the measuring (in the same task — nothing is painted).
    for(const [x] of going) if(inScope(x)) x.style.transform='';
    // (ONLY these things: the shelves and the floating windows stand as
    // they are drawn — they are not asked.)
    if(!only) for(const [sh,g] of shelfGoing) unshelf(sh, g);
    // Shelves: drawn by the data, laid out anew by the page. One no longer
    // shown has no height to come from.
    if(!only) for(const [sh] of shelfPlaced) if(!sh.isConnected || !seen(sh)) shelfPlaced.delete(sh);
    const newShelf=new Map();
    for(const sh of (only ? [] : shelvesNow())){
      if(sh._bar) sh._bar.drawAtGoal();    // its bar by the height it goes to (it may take room: before the measure)
      const h1=sh.getBoundingClientRect().height, mb1=parseFloat(getComputedStyle(sh).marginBottom)||0;
      const old=shelfPlaced.get(sh), was=shelfGoing.get(sh);
      const h0 = was ? was.h : (old ? old.h : h1), mb0 = was ? was.mb : (old ? old.mb : mb1);
      shelfPlaced.set(sh, {h:h1, mb:mb1});
      if(atOnceFor(sh) || !old || (Math.abs(h0-h1)<0.5 && Math.abs(mb0-mb1)<0.5)) continue;
      newShelf.set(sh, {h:h0, mb:mb0, h1, mb1, mbStyle:sh.style.marginBottom, mhStyle:sh.style.maxHeight, ov: was ? was.ov : sh.style.overflow,
                        vh: was ? was.vh : 0, vm: was ? was.vm : 0, open: (was && was.open) || [...risen].some(x=>shelfOf(x)===sh)});
    }
    // Floating windows: their laid-out box against the drawn one. One closed
    // on its way (hidden, still drawn while it fades) goes on with its way.
    const leaving = only ? [] : [...floatGoing].filter(([x])=>x.hidden && x.isConnected && x.getClientRects().length);
    if(!only) for(const [x] of floatGoing) unfloat(x);
    // A placed thing's goal goes with what it is against.
    if(!only) for(const x of stuckNow()) placeAt(x);
    const newFloat=new Map();
    const floats = only ? [] : floatsNow();
    for(const x of floats){
      if(x._bar) x._bar.drawAtGoal();      // its bar by the box it goes to (it may take room: before the measure)
      const r=x.getBoundingClientRect(), to={x:r.left, y:r.top, w:r.width, h:r.height};
      const was=floatGoing.get(x);
      // Not seen (faded out to nothing), it has no place to come from: it
      // appears where it is put. Seen even a little, it goes from there.
      const old = +getComputedStyle(x).opacity>0 ? floatPlaced.get(x) : null;
      const d = was ? {x:was.x, y:was.y, w:was.w, h:was.h} : old;
      floatPlaced.set(x, to);
      if(atOnceFor(x) || x._held || !d || ['x','y','w','h'].every(k=>Math.abs(d[k]-to[k])<0.5)) continue;
      newFloat.set(x, {...d, to, vx:was?was.vx:0, vy:was?was.vy:0, vw:was?was.vw:0, vh:was?was.vh:0});
    }
    // Out of view, its place is forgotten: shown again, it comes where it is put.
    if(!only) for(const [x] of floatPlaced) if(!floats.includes(x)) floatPlaced.delete(x);
    /* Objects in scope — each on a LEASH to its AREA (its parent): its
       place is where it stands in its area's content (the area's own scroll
       moves nothing), and it is drawn at that place plus its own offset.
       Where the area is, is nothing to it: an area whose inner geometry
       stays keeps all in it still and carries it with itself. Only a thing
       that went to another area comes from where it stood on the screen.
       The shelves (the body's own children) follow by their height. */
    /* WHO IS ASKED WHERE IT STANDS: only what the change could have moved.
       A thing's place is its place in its AREA, and the page shifts things
       inside one area only. So, from each touched node:
         — what stands beside it in its area is asked (it may have been
           shifted);
         — UP: if that area itself came out another size, the same for the
           area it stands in, and so on — until an area that kept its size:
           beyond it nothing moved;
         — DOWN: an area is opened (what stands in it is asked) when it is
           the touched node or stands in it, or came out another size; an
           area that kept its size and was not touched is NOT opened — all
           in it stands as it stood and goes with it.
       Nothing is looked over: a thousand things in an area that did not
       change are not asked a thing. */
    // (One reading of a box for the whole asking: nothing is written between.)
    const rects=new Map(), rectOf=x=>{ let r=rects.get(x); if(!r) rects.set(x, r=x.getBoundingClientRect()); return r; };
    let els;
    if(only) els=[...touched].filter(x=>seen(x) && !stands(x) && x.parentElement!==document.body);
    else if(all) els=[...document.body.querySelectorAll(MOVERS)].filter(x=>seen(x) && !stands(x) && x.parentElement!==document.body);
    else {
      const look=whoIsAsked(touched, deep, inScope, rectOf);
      // What went to another area is asked where it came to.
      for(const x of movedAway.keys()) if(seen(x) && !stands(x) && x.parentElement!==document.body && inScope(x)) look.add(x);
      els=[...look];
    }
    // WHAT GOES OUT IS NO ONE THE LAYOUT ASKS - it, and all in it: it keeps
    // its own way to its own goal (ghostLayout); drawn by its own display, it
    // looks shown to every walk, and asked it was taken for one that stands
    // (14.11: a second ghost got the settling's way and jumped).
    els=els.filter(x=>!inLeaving(x));
    const asked=new Set(els);
    // Everything was asked: what did not answer is not shown, and has no place.
    if(all) for(const x of document.body.querySelectorAll('*')){ if(asked.has(x)) forgotten.delete(x); else if(placed.has(x)) placed.delete(x); }
    const oldOff=new Map(going);
    const boxes=new Map();
    // A stretch drawn on it (a scroll pulled past its end) is no place.
    const drawnShift=x=>{ const t=(x.style.translate||'').split(' ').map(parseFloat); return {x:t[0]||0, y:t[1]||0}; };
    const inArea=x=>{
      const pa=x.parentElement; let c=boxes.get(pa);
      if(!c){ const r=rectOf(pa); c={x:r.left-pa.scrollLeft, y:r.top-pa.scrollTop}; boxes.set(pa, c); }
      const r=rectOf(x), t=drawnShift(x);
      return {x:r.left-t.x-c.x, y:r.top-t.y-c.y, ax:r.left-t.x, ay:r.top-t.y, pa, w:r.width, h:r.height};
    };
    const now=new Map(els.map(x=>[x, inArea(x)]));
    const newOff=new Map();
    if(!rescaled) for(const x of els){
      if(atOnceFor(shelfOf(x)) && !(dragged && !quiet && paceAfterWindow(x)!==undefined)) continue;
      const p=placed.get(x); if(!p) continue;           // new: it stands (it may appear)
      /* WHAT COMES IN, COMES IN BY THE ROWS IT BRINGS (14.11 evening, Makar:
         the Fine knobs came "somewhere from the bottom right"): a thing shown
         stands where the layout AFTER its coming puts it - the fold its coming
         turns to - and appears there; the others go to their new places. Its
         first noting (before the fold turned) is no place: it was born in this
         very change, so the turn gives it no way. What stands IN an area that
         is coming into view (a window opening) has no way of its own either:
         that area appears, and all in it with it, in frame. */
      // What stands in a window opening comes in frame with that window.
      if(x.parentElement && appearingWindow(x.parentElement)) continue;
      const q=now.get(x), g0=oldOff.get(x), od = drawnOff(g0);
      if(p.pa!==x.parentElement) continue;        // into another area: below, once all is drawn
      const dx=p.x+od.x-q.x, dy=p.y+od.y-q.y;
      if(Math.abs(dx)<0.5 && Math.abs(dy)<0.5) continue;
      newOff.set(x, {dx, dy, ...carriedBack(x, g0), bx:p.x+od.x, by:p.y+od.y, at:{L:q.ax, T:q.ay, R:q.ax+q.w, B:q.ay+q.h}});
    }
    // What was just shown is not noted by the window's own settling (it comes
    // before the change that showed it is laid out): it has no place before
    // that change, so it stands where the change puts it and only appears.
    const shownNow = x=>{ for(let a=x; a && a!==document.body; a=a.parentElement) if(justShown.has(a)) return true; return false; };
    for(const [x,q] of now){
      if(asWindow && justShown.size && shownNow(x)) continue;
      placed.set(x, q);
      if(x._display===undefined) x._display=getComputedStyle(x).display;   // (how it stands: kept drawn so while it goes out)
      // It stands shown: neither it nor anything it stands in is forgotten.
      for(let a=x; a && a!==document.body; a=a.parentElement) forgotten.delete(a);
    }
    // Offsets out of scope stay as they were; in scope those asked take the
    // new ones, and those not asked (their areas did not change) go on as
    // they were going.
    for(const [x,g] of going) if(inScope(x)){
      if(asked.has(x) || !x.isConnected || (!seen(x) && !inLeaving(x))) going.delete(x);   // (one going out goes on, and what is in it)
      else { const d=drawnOff(g); x.style.transform=wayTransform(x, d.x, d.y); g.at=g.box=null; }
    }
    for(const [x,g] of newOff){ going.set(x, g); x.style.transform=wayTransform(x, g.dx, g.dy); }
    if(!only) shelfGoing.clear();
    for(const [sh,g] of newShelf){
      shelfGoing.set(sh, g);
      // Drawn by the data on its way: its own cap (a slid shelf's) waits
      // until it is there.
      // One that a thing comes into from outside stays open all its way.
      sh.style.overflow = g.open ? 'visible' : 'hidden'; sh.style.maxHeight='none'; sh.style.height=g.h+'px'; sh.style.marginBottom=g.mb+'px';
    }
    if(!only){
      floatGoing.clear();
      for(const [x,g] of leaving) if(!newFloat.has(x)) newFloat.set(x, g);
      for(const [x,g] of newFloat){ floatGoing.set(x, g); drawFloat(x, g); }
    }
    /* A shelf on its way draws the room of the areas below it: their inner
       geometry (a column that stretches) is the one of the shelf's DRAWN
       height, not of the height it goes to. What goes in them goes from
       where it stood in its area as it is drawn now; its place stays the
       layout's own (the shelf brings the rest). */
    if(newShelf.size && newOff.size){
      boxes.clear();
      for(const [x] of newOff) x.style.transform='';
      for(const [x,g] of newOff){
        rects.clear();                 // (each is drawn again as it is measured: read anew)
        const q=inArea(x); g.dx=g.bx-q.x; g.dy=g.by-q.y;
        x.style.transform=wayTransform(x, g.dx, g.dy);
      }
    }
    // Into another area: from where it was drawn to where it stands now that
    // all else is drawn (shelves' heights, its new area's own way) — its own
    // offset off, measured as it is.
    if(!atOnce) for(const [x,from] of movedAway){
      if(!now.get(x) || atOnceFor(shelfOf(x))) continue;
      x.style.transform=''; going.delete(x);
      const r=x.getBoundingClientRect(), dx=from.x-r.left, dy=from.y-r.top;
      if(Math.abs(dx)<0.5 && Math.abs(dy)<0.5) continue;
      const g={dx, dy, ...carried(going.get(x)), at:{L:r.left, T:r.top, R:r.right, B:r.bottom}}; going.set(x, g); x.style.transform=wayTransform(x, dx, dy);
      rise(x);
      // The shelf it comes into does not cut it on its way in (a shelf on
      // its way cuts what it holds; this one comes from outside).
      const sh=shelfOf(x); if(shelfGoing.has(sh)){ sh.style.overflow='visible'; shelfGoing.get(sh).open=true; }
    }
    pruneTurning();
    for(const x of risen) if(!going.has(x)) lower(x);
    // What stands by a goal against a thing just sent on its way stands by
    // it as it is drawn now — in this same pass, not a frame later.
    ridePlaced();
    ghostsRide();                  // the ghosts with their holders as the shelves are drawn now - right at any moment, not a frame later
    dividersAtDrawn();
    tellArrivals();                // (a thing taken off its way by this settling is there too)
    if(going.size || shelfGoing.size || floatGoing.size) followOn();
  } finally {
    // What the settling takes for itself is still judged: shown or hidden.
    if(watcher){ judgeShown(watcher.takeRecords()); watcher.takeRecords(); }
    justShown.clear(); movedIn.clear();
    settling=false;
  }
}
/* WHERE THE LAYOUT PUTS A THING, not where it is drawn: its drawn top less
   the engine's offsets on its way — its own and its areas' (a move, a
   stretch, a floating window's). Rows are told apart by this. The offset
   taken off is the one DRAWN: a thing far on its way is drawn on its leash,
   nearer than its way (g.dy) — taking off the way, two knobs of one row
   came out in two rows while they went, and their group was shrunk to one
   column for good (the knobs in three rows where two fit). */
function laidTop(el, r){
  let t=(r || el.getBoundingClientRect()).top;
  for(let a=el; a && a!==document.body; a=a.parentElement){
    if(going.has(a)){ const m=/translate\(\s*[-+\d.e]+px\s*,\s*([-+\d.e]+)px/.exec(a.style.transform); if(m) t-=parseFloat(m[1])||0; }
    const tr=(a.style.translate||'').split(' '); if(tr.length>1) t-=parseFloat(tr[1])||0;
  }
  return Math.round(t);
}
/* WHAT GOES TO ANOTHER AREA IS DRAWN OVER what it passes on its way (the
   pictures under a captions' bar going up): risen for the way, back in its
   layer when it is there. */
const risen=new Set();
function rise(x){
  if(risen.has(x)) return;
  x._rise={position:x.style.position, zIndex:x.style.zIndex};
  if(getComputedStyle(x).position==='static') x.style.position='relative';
  x.style.zIndex='1'; risen.add(x);
}
function lower(x){
  if(!risen.has(x)) return;
  x.style.position=x._rise.position; x.style.zIndex=x._rise.zIndex; x._rise=null; risen.delete(x);
}
// A CHANGE NAMED EXPLICITLY: before it, the engine notes where the things
// that may go to another area are DRAWN (WANDERERS: such a thing comes from
// exactly there); after it, the settling (which would come by itself anyway).
let drawnBefore=null;
function smoothly(change){
  const outer=!drawnBefore;
  if(outer){
    noteAfterWindow();              // the window moved things since: their places first
    drawnBefore=new Map();
    for(const x of WANDERERS){
      if(!x.isConnected || !seen(x) || x.parentElement===document.body) continue;
      const r=x.getBoundingClientRect(); drawnBefore.set(x, {x:r.left, y:r.top});
    }
  }
  try{ const r=change(); settle(); return r; }
  finally{ if(outer) drawnBefore=null; }
}
/* THE SCROLL of the engine (the scrolls argument; the standard in
   STANDARD.scroll). Every scrolled thing moves by the law of following and
   has two moves, each with its own goal:
     the wheel — each notch's goal is the next stop on (`notch`: by lines or
                 by whole items, how many);
     the hand  — the bar dragged or a finger: it goes where the hand puts it;
                 let go, the END of the move takes it on to the nearest stop
                 (`end`), never half a line or half an item.
   Stops by 'item' are where each item begins, less `lead`. */
/* THE ENGINE PUTS THE SCROLL ITSELF, with the standard:
     - whatever the page lets scroll (its overflow is auto or scroll) — seen
       when it comes onto the page;
     - WHATEVER DOES NOT FIT ITS BOX, of the group that may scroll
       (STANDARD.scroll.spill: the boxes that hold text and lists — not a
       button, a field, a picture): what it holds goes past its edge — seen
       when the page or the window changes.
   Cut is only what is said to be cut: the clip argument, or an overflow
   written as hidden (a picture's window). Out of the group by its
   description: scrolls:false. What the engine draws itself (a shutter, a
   bar), a background and a box in motion are no place for a scroll. `scrolls` in a
   description is only a difference from the standard. */
function adoptScrolls(root){
  if(!root || root.nodeType!==1) return;
  for(const el of [root, ...root.querySelectorAll('*')]){
    // A BACKGROUND IS NO OBJECT (a picture's window): it is drawn where the
    // layout puts it and holds nothing that could not fit — no scroll is
    // ever its, nor of anything in it.
    if(el._scroll || el._drawn || el.dataset.scrolls==='no' || el.closest('svg') || el.closest('[data-background]')) continue;
    const cs=getComputedStyle(el);
    if(/auto|scroll/.test(cs.overflowY)) makeScroll(el, {});
    else if(/auto|scroll/.test(cs.overflowX)) makeScroll(el, {along:'x'});
    // Of the group that may scroll: watched — its own trigger asks it.
    else if(el.matches(STANDARD.scroll.spill) && !el._spillWatched){ el._spillWatched=true; spillWatch.observe(el); }
  }
}
/* WHAT SPILLS IS ASKED BY ITS TRIGGERS, box by box, never by a look over
   the page: its own size changed (spillWatch), or what it holds changed
   (the watcher: spillAsk). Only those boxes are asked, once all stands. */
const spillPending=new Set();
const spillWatch=new ResizeObserver(es=>{ for(const e of es) spillPending.add(e.target); spillsSoon(); });
function spillAsk(x){
  for(let a=x; a && a!==document.body; a=a.parentElement) if(a._spillWatched) spillPending.add(a);
  if(spillPending.size) spillsSoon();
}
// What it holds goes past its box, and nothing said it may.
function spills(el, cs){
  if(cs.overflowX!=='visible' || cs.overflowY!=='visible' || el.dataset.clip!==undefined) return false;
  if(el.style.overflow || el.style.overflowX || el.style.overflowY) return false;   // written by hand or by the engine
  if(/^inline/.test(cs.display) || cs.display==='contents' || cs.display==='none') return false;
  if(!el.firstChild || !el.getClientRects().length || movingNow(el)) return false;
  return el.scrollHeight-el.clientHeight>1 || el.scrollWidth-el.clientWidth>1;
}
// Asked by a change of the page or the window: once, when all stands — a
// thing on its way is drawn off its place and would seem to spill.
let spillFrame=0;
function spillsSoon(){
  if(!spillFrame) spillFrame=requestAnimationFrame(()=>{
    spillFrame=0;
    if(going.size || shelfGoing.size || floatGoing.size || stretching.size || scrolling.size) return spillsSoon();
    for(const el of spillPending){
      spillPending.delete(el);
      if(!el.isConnected || el._scroll || !spills(el, getComputedStyle(el))) continue;
      const y=el.scrollHeight-el.clientHeight>1;
      if(!y) continue;                      // sideways only: no scroll of a wheel that turns down
      el.style[y ? 'overflowY' : 'overflowX']='auto';
      makeScroll(el, y ? {} : {along:'x'});
    }
  });
}
// Scrolls pressed now: one release lets all of them go (one listener for all).
const PRESSED=new Set();
for(const ev of ['pointerup','pointercancel'])
  addEventListener(ev, ()=>{ for(const x of PRESSED) x._pressed=false; PRESSED.clear(); }, true);
function makeScroll(el, args){
  if(el._scroll) return;
  el._scroll=true;
  const a={...STANDARD.scroll, ...args,
           notch:{...STANDARD.scroll.notch, ...((args && args.notch)||{})},
           end:{...STANDARD.scroll.end, ...((args && args.end)||{})}};
  const x=a.along==='x', key = x ? 'scrollLeft' : 'scrollTop';
  if(a.stretch===false) el.dataset.stretch='no';
  const room=()=>scrollRoom(el, a.along);
  const lead=()=>typeof a.lead==='function' ? a.lead() : a.lead;
  const stops=by=>{
    const R=room();
    if(by==='line'){
      const L=gridPixel()*STANDARD.line, out=[];
      for(let p=0; p<R; p+=L) out.push(p);
      out.push(R); return out;
    }
    if(by==='item' && a.items){
      const r=el.getBoundingClientRect(), ld=lead();
      return [0, ...[...el.querySelectorAll(a.items)].filter(seen).map(i=>{
          const q=i.getBoundingClientRect();
          return (x ? q.left-r.left : q.top-r.top)+el[key]-ld;
        }).filter(p=>p>0.5), R].map(p=>Math.min(R, Math.round(p))).sort((p,q)=>p-q);
    }
    return null;                        // free: no stops
  };
  const next=(by, dir, from)=>{
    const st=stops(by);
    if(!st) return Math.max(0, Math.min(room(), from+dir*gridPixel()*STANDARD.line));
    if(dir>0){ const t=st.find(p=>p>from+1); return t===undefined ? room() : t; }
    const t=[...st].reverse().find(p=>p<from-1); return t===undefined ? 0 : t;
  };
  const notch=(dir, from)=>{ let at=from; for(let i=0;i<a.notch.count;i++) at=next(a.notch.by, dir, at); return at; };
  el._along=a.along;
  el._notch=notch;
  el._snap=(dir, from)=>next(a.notch.by, dir, from);
  el._nearest=at=>{ const st=stops(a.end.by); return st ? nearest(st, at) : at; };
  // Its way: itself, and the scroll after it when there is one.
  const links=()=>{ const nx=a.then && a.then(); return nx && nx._scroll ? [el, nx] : [el]; };
  const area=a.area||el, capture=area!==el;
  wheelWay(area, links, capture);
  if(getComputedStyle(el).touchAction==='auto') el.style.touchAction = x ? 'pan-y' : 'pan-x';
  fingerWay(area, links, capture);
  // The way's bar, in its last upright scroll (a bar argument false: none).
  let barHost=null;
  el._drawWay=()=>{
    const host = a.bar ? [...links()].reverse().find(l=>l._along==='y') : null;
    if(barHost && barHost!==host && barHost._bar) barHost._bar.draw();     // the old one hides
    barHost=host;
    if(host) makeBar(host, links).draw();
  };
  el.addEventListener('scroll', el._drawWay);
  if(!x && a.bar) el._drawWay();
  /* ONLY THE ENGINE MOVES A SCROLL. The browser moves one by itself too —
     it shows what gets the focus. Pressed (a click, a finger), that is no
     wish to go anywhere: the scroll stays where it was. Without a press (the
     keyboard) it is a goal, and the scroll follows it by the law. */
  el._at=el[key];
  el.addEventListener('pointerdown',()=>{ el._pressed=true; PRESSED.add(el); }, true);
  el.addEventListener('scroll',()=>{
    if(scrolling.has(el) || Math.abs(el[key]-el._at)<=0.5) return;
    const to=el[key];
    el[key]=el._at;
    if(Math.abs(el[key]-el._at)>0.5){ el._at=el[key]; return; }   // held there: the room changed
    if(!el._pressed) glideTo(el, a.along, to, 'stop');
  });
  el.addEventListener('scrollend',()=>{
    // Only a scroll the page made itself: where the engine put it is its own.
    if(scrolling.has(el) || Math.abs(el[key]-el._at)<=0.5) return;
    const st=stops(a.end.by); if(!st) return;
    const at=el[key], to=nearest(st, at);
    if(Math.abs(to-at)>0.5) glideTo(el, a.along, to, 'stop');
  });
}
/* APPEARING follows the same law: whatever comes into view — a shelf, a
   floating window, a hint — comes from transparent. Watched once for all:
   the engine sees it shown (its hidden mark gone, or marked showing). */
// How much of a thing is there now, and setting it (its opacity, or the
// share its fades argument names).
const shareOf=(x, none)=>{ const p=x.dataset.fadeVar, v = p ? x.style.getPropertyValue(p) : x.style.opacity; return v!=='' ? +v : none; };
const setShare=(x, v)=>{ const p=x.dataset.fadeVar; if(p){ if(v===null) x.style.removeProperty(p); else x.style.setProperty(p, String(v)); } else x.style.opacity = v===null ? '' : String(v); };
/* A THING HIDDEN GOES OUT ITSELF: no copy of it. It is hidden for everything
   that asks (seen: the layout, the fields, the dividers), the others go to
   their new places at once, and it becomes a GHOST (14.11 evening, Makar):
   counted for ITSELF and for no one else. It is taken out of the flow (it
   takes no room: the one after it comes onto its place straight through it,
   no row grows for it), and keeps getting its goal like everyone - in the
   layout of now it takes the form the others take (a cluster stacked for
   want of room unstacks with them) and stands right after the neighbour
   before it in its flow, behind the divider that would bound it, as far as
   the row reaches. It goes there by the same law as the rest, all in it with
   it, and fades as it goes: its goal means nothing any more. Ghosts see each
   other - a ghost stands after the goal of a ghost before it, never on it;
   one that stands sees no ghost. Shown again while it goes, it stands again.
   All its places are kept against its holder, not the screen: a holder that
   moves (a panel sliding to its new height) carries them. */
const LEAVING=new Map();     // thing -> {pa, keep, drawn | R, goal, withWay, share, s0}
const inLeaving=x=>{ for(let a=x; a && a!==document.body; a=a.parentElement) if(LEAVING.has(a)) return true; return false; };
const docOrder=(a,b)=>a===b ? 0 : (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
// Against its holder: the holder's content origin (scrolled with it).
const holderAt=pa=>{ const r=pa.getBoundingClientRect(); return {x:r.left-pa.scrollLeft, y:r.top-pa.scrollTop}; };   // (as settle keeps places)
// How a holder lays its things out: along a row or a column, which way, with what gaps; or a grid.
function flowOf(pa){
  const cs=getComputedStyle(pa), d=cs.display, grid=d.includes('grid'), flex=d.includes('flex');
  const row = flex && cs.flexDirection.startsWith('row'), rev = flex && cs.flexDirection.endsWith('reverse');
  const rtl = cs.direction==='rtl';
  const padL=parseFloat(cs.paddingLeft)||0, padR=parseFloat(cs.paddingRight)||0;
  return {grid, row, back: row ? (rev!==rtl) : rev, gapRow:parseFloat(cs.columnGap)||0, gapCol:parseFloat(cs.rowGap)||0,
          padL:pa.clientLeft+padL, padT:pa.clientTop+(parseFloat(cs.paddingTop)||0), inner:pa.clientWidth-padL-padR,
          // a thing in a block flow, or in a column that stretches, is as wide as the flow
          stretch: (!flex && !grid) || (flex && !row && (cs.alignItems==='normal' || cs.alignItems==='stretch'))};
}
// A neighbour in the flow: a thing that moves (not a divider, nothing that stands).
const inFlow=el=>!stands(el) && !el.classList.contains('divider') && el.matches(MOVERS);
function goOut(x){
  const p=placed.get(x), pa=x.parentElement;
  if(!p || !pa || !p.w || !p.h || !(fadeMs(x, 0)>0)) return;   // its own vanish:{ms:0}: it goes at once
  const keep={display:x.style.display, position:x.style.position, left:x.style.left, top:x.style.top, width:x.style.width,
              flexWrap:x.style.flexWrap, maxWidth:x.style.maxWidth, pointerEvents:x.style.pointerEvents, transform:'', translate:''};
  // Where it and what is in it are drawn now, against their holders: their places
  // as of the last settling and how far off them their ways have them.
  const drawn=new Map(), o=drawnOff(going.get(x));
  drawn.set(x, {x:p.x+o.x, y:p.y+o.y});
  for(const k of x.querySelectorAll(MOVERS)){
    const q=placed.get(k); if(!q || q.pa!==k.parentElement) continue;
    const d=drawnOff(going.get(k)); drawn.set(k, {x:q.x+d.x, y:q.y+d.y});
  }
  // Out of the flow at once - before the others are laid out - its own size, no hand.
  x.style.setProperty('display', x._display || 'block', 'important');   // ([hidden] is display:none !important)
  Object.assign(x.style, {position:'absolute', left:'0px', top:'0px', pointerEvents:'none', transform:'', translate:''});
  if(!x.style.width && x.style.width!==keep.width) x.style.width=keep.width;
  const l={pa, keep, drawn, withWay:'vanishWithWay' in x.dataset};
  LEAVING.set(x, l);
  if(!l.withWay) vanish(x, ()=>{ if(x.hidden) standBack(x); });
}
/* A ghost's goal: right after the neighbour before it, in that one's row (in a
   column: under it; the flow's own direction kept); after the goal of a ghost
   before it; in a grid, the cell the thing after it took; the first in its flow,
   where the flow begins. `goals`: thing -> {x, y, w, h} against the holder - the
   ghosts' and the coming ones' worked out so far. */
function behindPrev(x, pa, goals, size, F){
  if(F.grid){
    for(let nx=x.nextElementSibling; nx; nx=nx.nextElementSibling){
      if(!inFlow(nx) || !(seen(nx) || goals.has(nx))) continue;
      const gl=goals.get(nx); if(gl) return {x:gl.x, y:gl.y};
      const q=nx.getBoundingClientRect(), d=drawnOff(going.get(nx)), h=holderAt(pa);
      return {x:q.left-d.x-h.x, y:q.top-d.y-h.y};
    }
    return null;
  }
  for(let prev=x.previousElementSibling; prev; prev=prev.previousElementSibling){
    if(!inFlow(prev)) continue;
    let b=goals.get(prev);
    if(!b){
      if(!seen(prev)) continue;
      const q=prev.getBoundingClientRect(), d=drawnOff(going.get(prev)), h=holderAt(pa);
      b={x:q.left-d.x-h.x, y:q.top-d.y-h.y, w:q.width, h:q.height};
    }
    if(F.row) return {x: F.back ? b.x-F.gapRow-size.w : b.x+b.w+F.gapRow, y:b.y};
    return {x:b.x, y: F.back ? b.y-F.gapCol-size.h : b.y+b.h+F.gapCol};
  }
  return F.row ? {x: F.back ? F.padL+F.inner-size.w : F.padL, y:F.padT} : {x:F.padL, y:F.padT};
}
// (for the checking tools only, under ?check: the engine's own tables, to read - never in a page opened plainly)
if(CHECK_ALL) window.__engine={placed, going, LEAVING, shelfGoing, approach, approachPlane, followArgs, least:()=>STANDARD.follow.least*gridPixel()};
const ghostGoals=()=>{ const m=new Map(); for(const [x,l] of LEAVING) if(l.goal) m.set(x, l.goal); return m; };
// The rows the others of a field stand in now: a CLUSTER's form (the engine's unit
// of a field - see packClusters) is as many rows as they, the narrowest split.
const rowsOf=c=>new Set([...c.children].filter(seen).map(el=>Math.round(laidTop(el, el.getBoundingClientRect())))).size;
// (read with its form undone; written apart - so a hundred are one layout)
function readForm(x, pa){
  const others=[...pa.children].filter(c=>c!==x && c.classList.contains('group') && seen(c));
  return {nn:Math.max(1, ...others.map(rowsOf)), ws:[...x.children].filter(el=>!el.hidden).map(el=>el.getBoundingClientRect().width),
          gap:parseFloat(getComputedStyle(x).columnGap)||0};
}
function writeForm(x, {nn, ws, gap}){
  if(nn>1 && ws.length>1){ x.style.flexWrap='wrap'; x.style.maxWidth=Math.ceil(Math.max(Math.max(...ws), narrowestSplit(ws, Math.min(nn, ws.length), gap)))+'px'; }
}
/* THE GHOSTS' GOALS in the layout of now, and their ways there from where they
   are drawn: all at once, reads and writes apart - one layout of the page for any
   number of them (a hundred going out together cost what one does). */
function ghostLayout(){
  const all=[...LEAVING].filter(([x,l])=>{ if(!x.isConnected || !l.pa.isConnected){ LEAVING.delete(x); return false; } return true; })
                        .sort((a,b)=>docOrder(a[0],b[0]));
  if(!all.length) return;
  // READ - drawn now, against the holder: the first time as it stood before it went
  // out; then its last place and how far off it its way has it (not off the screen:
  // where the browser puts it moves with the others, its goal does not).
  const work=all.map(([x,l])=>{
    const els=[x, ...x.querySelectorAll(MOVERS)], D=new Map();
    if(l.drawn) for(const el of els){ const d=l.drawn.get(el); if(d) D.set(el, d); }
    else if(l.R) for(const el of els){
      const q=l.R.get(el); if(!q) continue;
      const c=drawnOff(going.get(el)); D.set(el, {x:q.x+c.x, y:q.y+c.y});
    }
    return {x, l, els, D, F:flowOf(l.pa), cluster:x.classList.contains('group')};
  });
  // WRITE - its ways off, its form undone (a cluster's), its width in a stretching flow.
  for(const w of work){
    for(const el of w.els) el.style.transform='';
    w.x.style.translate='';
    if(w.cluster){ w.x.style.flexWrap=''; w.x.style.maxWidth=''; }
    w.x.style.width = w.F.stretch ? w.F.inner+'px' : w.l.keep.width;
  }
  // READ - a cluster's form: its things' widths, the rows the others stand in.
  for(const w of work) if(w.cluster) w.form=readForm(w.x, w.l.pa);
  // WRITE - the form.
  for(const w of work) if(w.form) writeForm(w.x, w.form);
  // READ - where each of it stands now, against its holder; its size.
  for(const w of work){
    const r=w.x.getBoundingClientRect(), h=holderAt(w.l.pa);
    w.size={w:r.width, h:r.height};
    w.R=new Map(w.els.map(el=>{
      if(el===w.x) return [el, {x:r.left-h.x, y:r.top-h.y}];
      const q=el.getBoundingClientRect(), hh=holderAt(el.parentElement);
      return [el, {x:q.left-hh.x, y:q.top-hh.y}];
    }));
  }
  // (no reads, no writes) - the goals, in the flow's order: a ghost after a ghost's goal.
  const goals=new Map();
  for(const w of work){
    const T=behindPrev(w.x, w.l.pa, goals, w.size, w.F) || w.l.goal || w.R.get(w.x);
    w.l.goal={x:T.x, y:T.y, w:w.size.w, h:w.size.h}; goals.set(w.x, w.l.goal);
  }
  // WRITE - put at its goal; its way there from where it is drawn - the same law as all.
  for(const w of work){
    const {x, l, els, D, R}=w, r=R.get(x), T=l.goal, sx=T.x-r.x, sy=T.y-r.y;
    x.style.translate = Math.abs(sx)>=0.5 || Math.abs(sy)>=0.5 ? `${sx}px ${sy}px` : '';
    l.shift={x:sx, y:sy}; l.hold=holderAt(l.pa); l.op=x.offsetParent; l.opAt=l.op ? holderAt(l.op) : {x:0, y:0};
    R.set(x, {x:T.x, y:T.y});
    for(const el of els){
      const d=D.get(el), q=R.get(el); if(!d || !q) continue;
      const dx=d.x-q.x, dy=d.y-q.y, g=going.get(el);
      if(Math.abs(dx)<0.5 && Math.abs(dy)<0.5){ going.delete(el); continue; }
      going.set(el, {dx, dy, ...carried(g)});
      el.style.transform=wayTransform(el, dx, dy);
      if(el===x && l.withWay && l.s0===undefined) l.s0=Math.hypot(dx, dy);
    }
    l.drawn=null; l.R=R;
    // vanish:{withWay} with no way to go at all: it fades by the vanish law after all
    if(l.withWay && l.s0===undefined && !going.has(x)){ l.withWay=false; vanish(x, ()=>{ if(x.hidden) standBack(x); }); }
  }
  followOn();
}
/* VANISH WITH ITS WAY (an argument: vanish:{withWay:true}): a ghost fades as it
   goes - as much of it is there as of its way is left, and it is gone when it
   arrives. Without it the fade keeps its own pace (the standard). */
/* IT RIDES ITS HOLDER: out of the flow it is put against the box it is
   positioned by, not against its holder - when the holder moves within that
   box (a panel taking its new height), it is carried along, every frame. */
function ghostsRide(){
  for(const [x,l] of LEAVING){
    if(!l.shift || !l.pa.isConnected) continue;
    const h=holderAt(l.pa), o=l.op && l.op.isConnected ? holderAt(l.op) : l.opAt;
    const ex=(h.x-l.hold.x)-(o.x-l.opAt.x), ey=(h.y-l.hold.y)-(o.y-l.opAt.y);
    const tx=l.shift.x+ex, ty=l.shift.y+ey;
    x.style.translate = Math.abs(tx)>=0.5 || Math.abs(ty)>=0.5 ? `${tx}px ${ty}px` : '';
  }
}
function ghostsFade(){
  for(const [x,l] of LEAVING){
    if(!l.withWay || l.s0===undefined) continue;
    const g=going.get(x), dd=g ? drawnOff(g) : {x:0, y:0}, left=Math.hypot(dd.x, dd.y);
    l.share=Math.min(l.share===undefined ? 1 : l.share, l.s0>0 ? left/l.s0 : 0);
    setShare(x, l.share);
    if(!g && x.hidden){ setShare(x, 0); standBack(x); }
  }
}
// Back to how it stood before it went out (out of sight, or shown again).
function standBack(x){
  const l=LEAVING.get(x); if(!l) return;
  LEAVING.delete(x); going.delete(x);
  for(const el of x.querySelectorAll(MOVERS)) if(going.has(el)){ going.delete(el); el.style.transform=''; }
  x.style.removeProperty('display');
  for(const [k,v] of Object.entries(l.keep)) if(k!=='display') x.style[k]=v;
  if(l.keep.display) x.style.display=l.keep.display;
  if(x.hidden) setShare(x, null);
}
// THE GHOSTS TAKE THEIR GOALS WHEN THE LAYOUT IS DONE - whichever way it was laid.
AFTER_LAYOUT.push(()=>ghostLayout());
/* Its first place, when it comes: as a ghost would stand - right after the
   neighbour before it in its flow (behind the divider that would bound it, as
   far as the row reaches: a flow would carry it to a row of its own when the
   room ends, a ghost knows no room); after a ghost's goal. Then, with everyone,
   it takes the layout its coming turns to. */
const comesAfter=new Set();
function placeComing(){
  const goals=ghostGoals();
  for(const x of [...comesAfter].sort(docOrder)){
    const p=placed.get(x), pa=x.parentElement;
    if(!p || !pa || !x.isConnected) continue;
    const T=behindPrev(x, pa, goals, {w:p.w, h:p.h}, flowOf(pa));
    if(T){
      const h=holderAt(pa);
      placed.set(x, {...p, x:T.x, y:T.y, ax:T.x+h.x, ay:T.y+h.y});
      goals.set(x, {x:T.x, y:T.y, w:p.w, h:p.h});
    }
  }
  comesAfter.clear();
}
function appearing(x){
  for(let a=x; a && a!==document.body; a=a.parentElement) if(aimed('fade', a)===1) return true;
  return false;
}
// A window (a shelf of the page, or a floating one) coming into view: all in
// it comes in frame with it. A group shown inside a field is no window.
function appearingWindow(x){
  for(let a=x; a && a!==document.body; a=a.parentElement)
    if(aimed('fade', a)===1 && (a.parentElement===document.body || getComputedStyle(a).position==='fixed')) return true;
  return false;
}
function appear(x){
  // How it stands when shown — to keep it drawn while it goes out.
  const disp=getComputedStyle(x).display; if(disp!=='none') x._display=disp;
  // From where it is now: a thing still going out turns and comes back.
  aim('fade', x, 1);
}
/* VANISHING, the same law the other way: the thing goes out from how it is
   now, and what was waiting for it (then) comes when it is out. */
function vanish(x, then){ aim('fade', x, 0, {then}); }
/* THE WATCHER: a change of the page is an input the engine settles — seen
   by itself, before anything is painted. What it sees: nodes added and taken
   out, words set, and four attributes — hidden, class, style, width/height.
   A mark in a node's data is not seen: what changes one settles by its own
   word (smoothly). What stands (follow:false) is no input. Something shown
   is also an appearing. */
/* What stands in the fields changed (something added, taken out, shown,
   hidden, its words set): told by the page's own records — a new size of the
   window is no reason to look the fields over. */
let contentTouched=true;
function noteContent(list){
  for(const m of list){
    if(m.type==='attributes' && m.attributeName!=='hidden') continue;
    // Words that change quietly (the status, a caption) and what stands are
    // in no field's content.
    const x = m.target.nodeType===1 ? m.target : m.target.parentElement;
    if(x && (x.closest('[data-quiet]') || stands(x))) continue;
    contentTouched=true; return;
  }
}
/* A CHANGE THAT FEEDS ITSELF IS STOPPED, and said (14.11: a ghost asked on
   every batch asked itself for ever, and the page hung with no word). The
   engine's answer to a change may change the page again - a wave or two; a
   chain that runs on in one task past its measure is a loop: the wave is let
   go, the rest of the task is left alone, and the console says where. */
const LOOP_WAVES=40;
let waves=0, wavesClear=0, loopSaid=false;
function loopGuard(where, what){
  if(!wavesClear) wavesClear=setTimeout(()=>{ waves=0; wavesClear=0; });
  if(++waves<=LOOP_WAVES) return false;
  if(!loopSaid){ loopSaid=true; console.error(`engine: a change feeds itself (${where}) - stopped after ${LOOP_WAVES} waves in one task`, what); }
  return true;
}
watcher=new MutationObserver(list=>{
  let any=false; const touched=new Set();
  if(loopGuard('the page watcher', list.slice(0, 5).map(m=>m.target))) return;
  for(const m of list){
    for(const nn of m.addedNodes) adoptScrolls(nn);
    const x = m.target.nodeType===1 ? m.target : m.target.parentElement;
    spillAsk(x);
    if(!x || stands(x)) continue;
    if(m.type!=='attributes' && x.closest('[data-quiet]')) continue;
    // A background is drawn where the layout puts it and moves nothing: how
    // it is styled (a picture's canvas shifted to its window's middle) is no
    // input. What is added to it or taken out still is.
    if(m.type==='attributes' && m.attributeName==='style' && x.closest('[data-background]')) continue;
    // A thing hidden is out of the layout: how it is styled while it goes out
    // (drawn where it was, riding with its holder) is no input.
    if(m.type==='attributes' && m.attributeName==='style' && x.closest('[hidden]')) continue;
    any=true; touched.add(x);
  }
  judgeShown(list);
  // The areas kept first (their groups divided, their rows evened): what the
  // places and the bars are decided by is the content as it will stand.
  if(contentTouched && engineUp) tidyAreas();
  if(any) settle(touched); else { justShown.clear(); movedIn.clear(); }
  if(comesAfter.size) placeComing();    // a thing shown: its first place behind the one before it
  /* A CHANGE OF CONTENT ASKS ITS THRESHOLDS BY ITSELF. What changed in a
     field (a group shown or hidden — Fine) is known only here, after the
     action that made it has already asked the layout and found nothing; a
     new size is not coming to ask again (a field that loses a group keeps
     its width). So the content's own word goes to the layout's door: the
     fields whose print changed are laid out anew against the room of now —
     the same thresholds, the user's choice (a field he rolled stays rolled)
     standing as it was. */
  if(contentTouched && engineUp) relayout();
  // what goes out takes its goal in the layout of now - when the page really
  // changed (its own drawing is no input: asked on every batch it would ask itself)
  if([...LEAVING.values()].some(l=>l.drawn)) ghostLayout();   // gone out with no layout after it: its goal now
});
/* SHOWN OR HIDDEN is judged by how it was before the batch against how it
   is now — never record by record: hidden and shown again in one step is
   no change (it would blink out and fade in). Every batch is judged, the
   one a settling takes for itself too: a thing shown by a named change
   (smoothly) appears like one shown by any other. */
function judgeShown(list){
  noteContent(list);
  // Taken out of the page and not put back: it has no place any more.
  for(const m of list) for(const nn of m.removedNodes) if(nn.nodeType===1 && !nn.isConnected){ forgotten.delete(nn); forget(nn); forgotten.delete(nn); }
  for(const m of list) for(const nn of [...m.addedNodes, ...m.removedNodes]) if(nn.nodeType===1 && nn.isConnected && placed.has(nn)) movedIn.add(nn);
  // Put on the page by this change and never placed: it has just appeared.
  for(const m of list) for(const nn of m.addedNodes) if(nn.nodeType===1 && nn.isConnected && !placed.has(nn)) justShown.add(nn);
  const hiddenWas=new Map(), showingWas=new Map();
  for(const m of list){
    const x=m.target;
    if(m.type!=='attributes' || x.nodeType!==1 || stands(x)) continue;
    // How it was BEFORE this batch: the first record of each keeps it.
    if(m.attributeName==='hidden' && !hiddenWas.has(x)) hiddenWas.set(x, m.oldValue!==null);
    if(m.attributeName==='class' && !showingWas.has(x)) showingWas.set(x, (m.oldValue||'').split(' ').includes('showing'));
  }
  for(const [x,was] of hiddenWas){
    if(was && !x.hidden && (seen(x) || getComputedStyle(x).position==='fixed')){
      // SHOWN AGAIN IT COMES WHERE IT STANDS NOW: the place it had before it
      // was hidden is no place (14.11: the Fine knobs, hidden and shown, got
      // a way from where they stood last time - drawn off by hundreds of
      // pixels, held at the window's edge, then on). It comes in by the layout
      // in force, as anything new does (see settle).
      // SHOWN WHILE ITS GHOST STILL GOES, it comes back from where the ghost is
      // drawn - its place, its form, all in it as they are drawn now - and goes
      // on from there by the law (14.11: it came from the first-place rule and
      // jumped hundreds of pixels). Read before it stands back.
      let back=null;
      if(LEAVING.has(x)){
        back=new Map();
        for(const el of [x, ...x.querySelectorAll(MOVERS)]){
          const r=el.getBoundingClientRect(); if(r.width || r.height) back.set(el, r);
          const g=going.get(el); if(g) speedBack.set(el, carried(g));     // its speed comes back with it (standBack ends the ghost's ways)
        }
      }
      forgotten.delete(x); forget(x); forgotten.delete(x);
      // Still going out (hidden a moment ago): it stands again where it
      // belongs, and comes back from how far it had gone.
      standBack(x);
      // Back while still going out: it stands again as it is.
      x.style.removeProperty('display'); x.style.pointerEvents='';
      /* IT COMES AS ONE OF THEM (14.11 evening, Makar): first it thinks itself
         a ghost as flat as the rest - the rows the others stand in now - and
         stands where that layout puts it: after the last, behind the divider
         that would bound it. Then, with everyone, it takes the rows its coming
         turns the layout to, its own buttons going there with it, gaining
         clarity. So its buttons are noted where they stand in that first form. */
      if(back){
        const rx=back.get(x), h=holderAt(x.parentElement);
        if(rx) placed.set(x, {x:rx.left-h.x, y:rx.top-h.y, ax:rx.left, ay:rx.top, pa:x.parentElement, w:rx.width, h:rx.height});
        for(const [el,r] of back){
          if(el===x) continue;
          const pr=back.get(el.parentElement); if(!pr) continue;     // against its holder as drawn
          placed.set(el, {x:r.left-pr.left, y:r.top-pr.top, ax:r.left, ay:r.top, pa:el.parentElement, w:r.width, h:r.height});
        }
      }
      else if(x.parentElement && x.parentElement!==document.body && getComputedStyle(x).position!=='fixed'){
        if(x.classList.contains('group')){ x.style.flexWrap=''; x.style.maxWidth=''; writeForm(x, readForm(x, x.parentElement)); }
        comesAfter.add(x);
        for(const el of x.querySelectorAll(MOVERS)){
          const r=el.getBoundingClientRect(), h=holderAt(el.parentElement);
          if(r.width || r.height) placed.set(el, {x:r.left-h.x, y:r.top-h.y, ax:r.left, ay:r.top, pa:el.parentElement, w:r.width, h:r.height});
        }
      }
      appear(x); justShown.add(x);
    }
    // A floating window hidden GOES OUT: the engine keeps it drawn (and
    // out of the hand's way) while it fades, then lets it be hidden.
    else if(!was && x.hidden && x._display && getComputedStyle(x).position==='fixed' && !windowDragging()){
      // ([hidden] is display:none !important: only an inline important is stronger.)
      x.style.setProperty('display', x._display, 'important'); x.style.pointerEvents='none';
      vanish(x, ()=>{ if(x.hidden){ x.style.removeProperty('display'); x.style.pointerEvents=''; setShare(x, null); } });
    }
    // ANYTHING ELSE HIDDEN GOES OUT TOO (14.11): it leaves the layout at once
    // (the others go to their new places), and where it was drawn its image
    // stays and fades - out of the layout, out of the engine's ways, gone when
    // it is out. Only the outermost of what is hidden together goes out.
    else if(!was && x.hidden && !windowDragging() && !still()){
      let inner=false; for(let a=x.parentElement; a && a!==document.body; a=a.parentElement) if(hiddenWas.get(a)===false && a.hidden){ inner=true; break; }
      if(!inner) goOut(x);
    }
  }
  for(const [x,was] of showingWas) if(!was && x.classList.contains('showing')) appear(x);
}
watcher.observe(document.body, {subtree:true, childList:true, characterData:true,
  attributes:true, attributeOldValue:true, attributeFilter:['hidden','class','style','width','height']});
var engineUp=true;           // (var: asked by what is built before the engine stands)
/* The only door to the layout. Forcibly — when something the print does not
   see has changed, e.g. the font loaded and all widths moved. */
function relayout(forcibly){
  /* A field whose room crossed an edge of its band takes another fold: a
     turn of its STATE, not a following of the window — it goes smoothly
     even while the window is dragged, as a roll does (see settle). */
  const broken=bandsBroken();
  for(const where of broken){ const sh=shelfOf(where); if(sh) turning.add(sh); }
  if(!forcibly){
    // WHAT TRIGGERED, AND ONLY THAT: a field whose content changed (its
    // print) or whose room crossed an edge of its band is laid out anew —
    // its fold computed from the data, kept when no edge is crossed, the new
    // objects put in it; every other field stands as it is.
    const touched=new Set(broken);
    if(contentTouched){
      contentTouched=false;
      for(const where of fieldsNow()) if(fieldPrints.get(where)!==fieldPrint(where)) touched.add(where);
    }
    if(!touched.size){ tidyAreas(); squeezeSingles(); for(const ff of AFTER_LAYOUT) ff(); return; }
    return smoothly(()=>{
      for(const where of touched){ layOutField(where); fieldPrints.set(where, fieldPrint(where)); }
      tidyAreas();
      layoutPrint=viewPrint();
      squeezeSingles();
      for(const ff of AFTER_LAYOUT) ff();
      reputSlid();
    });
  }
  lookAtAll=true;                  // a layout from scratch: everything may have moved
  measuresEpoch++;                 // and what the print does not see has changed: measured anew
  smoothly(relayoutNow);
}
/* EVERY AREA IS KEPT BY THE ENGINE, not only the fields: what changed in any
   of them (a page of a window shown, a list filled) - its even rows evened
   (memoized: an unchanged one is not measured), its groups divided (one in
   its place is left). The program says nothing: it shows and hides, the
   engine keeps the rest (14.11: the settings and the file window were
   divided and evened by hand after every change). And the rooms of the
   fields are watched by the engine itself: a section may stay as wide while
   the room in it changes - then its blind bands, or content noted and not
   laid out yet, are looked at. */
function tidyAreas(){
  evenOut();
  const areas=new Set();
  for(const gg of document.querySelectorAll('.group')){
    const a=gg.parentElement;
    if(a && seen(a) && !BANDS.has(a)) areas.add(a);    // (a field is divided by its own layout)
  }
  for(const a of areas) divideGroups(a);
  watchRooms();
}
const watchedRooms=new WeakSet(); let roomWatch=null;
function watchRooms(){
  if(!window.ResizeObserver) return;
  if(!roomWatch) roomWatch=new ResizeObserver(()=>{ if((contentTouched || BLIND.size) && !loopGuard('the rooms watcher', [...fieldsNow()])) relayout(); });
  for(const where of fieldsNow()) for(const r of [where, shelfOf(where)]) if(r && !watchedRooms.has(r)){ watchedRooms.add(r); roomWatch.observe(r); }
}
/* A TURN BY THE WINDOW (a threshold of the room's own shape crossed while the
   window is given a new size - the pictures side by side or stacked): the
   window's doing, so everything stands at once where the new layout puts it. */
function turnedByWindow(){ placesOld=false; settle(windowMoves(), false, true, 'at once'); }
/* A field that lays itself out its own way says so (OWN_LAYOUT): the engine
   asks it, by no name. */
const OWN_LAYOUT=new Map();
function layOutField(where){
  const own=OWN_LAYOUT.get(where);
  if(own){ own(); return; }
  evenOut(where);
  divideGroups(where);
  packClusters(where, where.parentNode);
}
function relayoutNow(){
  contentTouched=false;
  layoutPrint=viewPrint();
  tidyAreas();
  arrangeDividers();
  arrangeClusters();
  alignCaptions();
  for(const where of fieldsNow()) fieldPrints.set(where, fieldPrint(where));
  for(const ff of AFTER_LAYOUT) ff();
  reputSlid();
}

/* EVEN — an argument of an object's description: the buttons of each ROW
   inside it are as wide as the widest of that row, and the rows stretch to
   the widest row. So the stage buttons in a row are all alike, and in a
   column the pair of arrows stands by its own icons while the stage buttons
   under it stretch to it — a button is never widened by one in another row.
   The engine measures them as they are, without stretching. */
function evenOut(root=document){
  for(const box of root.querySelectorAll('[data-even]')){
    if(!seen(box)) continue;       // not shown (or going out): measured when it is
    // What it depends on: its buttons' words, how it stands, its width and
    // the scale. The same as last time — its buttons stand as they are.
    const btns=[...box.querySelectorAll('button')].filter(seen);
    const key=[gridPixel(), box.className, Math.round(box.getBoundingClientRect().width),
               ...btns.map(b=>b.textContent+'/'+b.className)].join('|');
    if(key===box._evenFor) continue;
    box._evenFor=key;
    box.dataset.measuring='';
    const rows=new Map();
    for(const bb of box.querySelectorAll('button')){
      if(!seen(bb)) continue;
      // Rows by where the LAYOUT puts them: a button still on its way is
      // drawn off its row (its offset) and would be a row alone.
      const r=bb.getBoundingClientRect(), top=laidTop(bb, r);
      if(!rows.has(top)) rows.set(top, []);
      rows.get(top).push([bb, r.width]);
    }
    delete box.dataset.measuring;
    for(const row of rows.values()){
      const ww=Math.ceil(Math.max(...row.map(x=>x[1])));
      for(const [bb] of row) bb.style.setProperty('--even', ww+'px');
    }
  }
}
/* ONE RULE FOR ALL SECTIONS. Between two neighbouring visible groups of a
   section stands a divider. Which one depends on how the groups stand: in a
   row — upright, in a column — lying. Header, footer, menu and guide are
   divided by the same code. */
function divideGroups(where){
  const cs=getComputedStyle(where);
  const lying=!(cs.display.includes('flex') && cs.flexDirection.startsWith('row'));
  const groups=[...where.children].filter(gg=>gg.classList.contains('group') && seen(gg));
  // The dividers that stand are kept when they already stand where they
  // belong — right before each group but the first — and lie the right way.
  const cls=lying?'divider lying':'divider';
  const have=[...where.querySelectorAll(':scope > .divider')];
  const right = have.length===Math.max(0, groups.length-1)
    && groups.slice(1).every((gg,i)=>gg.previousElementSibling===have[i] && have[i].className===cls);
  if(right) return;
  for(const mm of have) mm.remove();
  for(let i=1;i<groups.length;i++){
    const dv=Object.assign(document.createElement('i'),{className:cls});
    dv.dataset.follow='no';              // no way of its own: it stands on its neighbours' border (dividersAtDrawn)
    where.insertBefore(dv, groups[i]);
  }
}
/* A DIVIDER STANDS ON THE REAL BORDER: between its neighbours as they are
   DRAWN, and as far as they reach - it counts nothing of its own and has no
   way of its own. While the groups beside it go, it goes with their border;
   when they stand, it stands where the layout put it (14.11: it jumped to the
   border's end and took its new height at once while the groups still went). */
function dividersAtDrawn(){
  const dvs=[...document.querySelectorAll('.divider')];
  for(const dv of dvs) dv.style.transform='';
  const plan=[];
  for(const dv of dvs){
    if(!seen(dv)) continue;
    const sib=d=>{ let x=d>0 ? dv.nextElementSibling : dv.previousElementSibling;
      while(x && (!seen(x) || x.classList.contains('divider'))) x=d>0 ? x.nextElementSibling : x.previousElementSibling;
      return x; };
    const a=sib(-1), b=sib(1);
    if(!a || !b) continue;
    const r=dv.getBoundingClientRect(), ra=a.getBoundingClientRect(), rb=b.getBoundingClientRect();
    let t='';
    if(!dv.classList.contains('lying')){
      const c=(ra.right+rb.left)/2, lo=Math.min(ra.top, rb.top), hi=Math.max(ra.bottom, rb.bottom);
      const d=c-(r.left+r.width/2), k=r.height>0 ? (hi-lo)/r.height : 1, e=lo-r.top;
      if(Math.abs(d)>0.25 || Math.abs(e)>0.25 || Math.abs(k-1)>0.002) t=`translate(${d}px,${e}px) scaleY(${k})`;
    } else {
      const c=(ra.bottom+rb.top)/2, lo=Math.min(ra.left, rb.left), hi=Math.max(ra.right, rb.right);
      const d=c-(r.top+r.height/2), k=r.width>0 ? (hi-lo)/r.width : 1, e=lo-r.left;
      if(Math.abs(d)>0.25 || Math.abs(e)>0.25 || Math.abs(k-1)>0.002) t=`translate(${e}px,${d}px) scaleX(${k})`;
    }
    plan.push([dv, t]);
  }
  for(const [dv,t] of plan){ dv.style.transformOrigin='0 0'; dv.style.transform=t; }
}
/* Every place of buttons that has a field is a section of clusters, laid out
   within the shelf it stands on. */
function arrangeDividers(){
  for(const place of Object.values(BUTTON_PLACES)){
    if(place.hidden) continue;
    divideGroups(place);
    packClusters(place, place.parentNode);
  }
}

/* A SUBDIVIDED SINGLE. The status line is not solid text but parts sewn
   with separators: "art 307×172 · colors 43346 · 81 ms". It may break only
   at those seams, so spaces inside parts are non-breaking.

   It gives way in LINES, as many as the room beside it holds: one row of
   buttons is two lines of text, two rows hold three. For each count of lines,
   from one up, the parts are grouped so that the widest line is as narrow as
   can be — the two short ones together, the long one alone — and a seam
   that would end a line is dropped. The first count that fits the width
   wins; none fits — the status goes down whole and takes a row of its own
   at the left edge. */
/* Parts and the seam that followed each ('' for the last). Gaps at a seam
   are non-breaking, or "·" sticks to the text. */
function statusParts(full, seams){
  let pieces=[{text:full, seam:''}];
  for(const seam of seams){
    const fresh=[];
    for(const pp of pieces){
      const ch_=pp.text.split(seam);
      ch_.forEach((x,i)=>fresh.push({text:x, seam: i<ch_.length-1 ? seam.replace(/ /g,'\u00A0') : pp.seam}));
    }
    pieces=fresh;
  }
  return pieces.filter(x=>x.text!=='');
}
/* The narrowest grouping of parts (their widths) into exactly k lines. Every
   grouping is tried — there are a handful of parts — and between equally
   narrow ones the one keeping the reading order wins. A line's parts keep
   their order; lines are ordered by their first part. */
function narrowestLines(ws, joins, k){
  const n=ws.length; let best=null;
  const line=idx=>idx.reduce((a,i,pos)=>a+ws[i]+(pos<idx.length-1 ? joins[i] : 0),0);
  const at=Array(n).fill(0);
  const walk=(i, used)=>{
    if(i===n){
      if(used!==k) return;
      const lines=Array.from({length:k},()=>[]);
      at.forEach((l,p)=>lines[l].push(p));
      const wide=Math.max(...lines.map(line));
      const inOrder=lines.flat().every((p,q)=>p===q);
      if(!best || wide<best.wide-0.5 || (Math.abs(wide-best.wide)<=0.5 && inOrder && !best.inOrder))
        best={wide, lines, inOrder};
      return;
    }
    // a part goes into a line already opened, or opens the next one
    for(let l=0; l<=Math.min(used, k-1); l++){ at[i]=l; walk(i+1, Math.max(used, l+1)); }
  };
  walk(0, 0);
  return best;
}
function squeezeStatus(el, oo){
  // Fresh text from the computation or our own earlier layout? Told apart
  // by the snapshot: drawing sets the whole line, we set it in lines.
  const ownIt=(el.dataset.snapshot!==undefined && el.textContent===el.dataset.snapshot);
  const full=ownIt ? (el.dataset.fulltext||'') : el.textContent;
  if(full!==el.dataset.fulltext || !el._parts){
    el.dataset.fulltext=full;
    el._parts=statusParts(full, oo.seams);
  }
  const parts=el._parts;
  /* WHAT IT DEPENDS ON: its words, the scale, the room its row leaves it and
     how tall its neighbours stand (see its band below). */
  const unit=el.parentElement;
  // All of that as it was when it was last laid (the room is the window's
  // width less what the layout of then gave the neighbours — an edge of its
  // band tells when the window crosses it): it stands as it is, nothing asked.
  const asLaid=[full, layoutSerial, gridPixel(), innerWidth, unit.id, unit._barPad||0].join('|');
  if(ownIt && el._laidAs===asLaid && el._decided!==undefined
     && el.classList.contains('atBottom')===(el._decided==='bottom')
     && el.classList.contains('inColumn')===(el._decided!=='bottom' && el._decided!=='1')) return;
  el._laidAs=asLaid;
  const st_=getComputedStyle(unit);
  const place=unit.clientWidth-(parseFloat(st_.paddingLeft)||0)-(parseFloat(st_.paddingRight)||0);
  const gapSize=parseFloat(st_.columnGap)||0;
  /* THE NEIGHBOURS AS THEY STAND BY THEMSELVES: without this single in the
     row (its own width would press them, its column would hold up the very
     height it is decided by), and not stretched by a shelf drawn on its way
     (a height between two layouts is no layout). Only the final layout is an
     input: the goal is set once, never by stages. */
  /* MEASURED WHEN A LAYOUT CHANGED THEM, kept otherwise: how the neighbours
     stand by themselves is theirs — it changes only when a field is laid out
     anew or the scale changes, never with the room alone. */
  const stamp=layoutSerial+'|'+gridPixel();
  if(!el._neighbours || el._neighbours.stamp!==stamp || el._neighbours.unit!==unit){
    let occupied=0, neighbors=0, tallest=0;
    unit.dataset.ownHeights=''; el.dataset.aside='';
    for(const dd of unit.children){
      if(dd===el || !seen(dd)) continue;            // (one going out is no neighbour)
      const r=dd.getBoundingClientRect();
      occupied+=r.width; neighbors++; tallest=Math.max(tallest, r.height);
    }
    delete unit.dataset.ownHeights; delete el.dataset.aside;
    el._neighbours={stamp, unit, occupied, neighbors, tallest};
  }
  const {occupied, neighbors, tallest}=el._neighbours;
  const remainder=place-occupied-gapSize*neighbors;
  /* ITS BAND: the rooms where the same would be decided, kept with the
     decision. Its words, its neighbours and the scale as they were, the room
     inside the band — nothing is decided and the page is not touched. */
  const band=el._band;
  if(band && ownIt && band.stamp===stamp && band.words===full && remainder>=band.lo && remainder<band.hi) return;
  /* ITS PARTS ARE OBJECTS OF THEIR OWN, a group that shares its rows: each
     part is kept from one layout to the next (its words may change, it is
     the same object), and the rows are only where they stand. Laid anew, a
     part goes to its new row and place by the engine's way, from where it is
     drawn — however many parts there are and however many rows. A part ends
     with its seam, hidden when it is the last of its row. */
  const seamAny=(parts.find(x=>x.seam)||{seam:''}).seam;
  const lay=lines=>{
    const own=el._partEls || (el._partEls=[]);
    while(own.length<parts.length){
      const pp=document.createElement('span'); pp.className='part'; WANDERERS.add(pp);
      pp.append(document.createTextNode(''), Object.assign(document.createElement('span'),{className:'seam'}));
      own.push(pp);
    }
    own.length=parts.length;
    parts.forEach((x,i)=>{
      const pp=own[i];
      if(pp.firstChild.nodeValue!==x.text) pp.firstChild.nodeValue=x.text;
      const sm=pp.lastChild, seam=x.seam||seamAny;
      if(sm.textContent!==seam) sm.textContent=seam;
    });
    const rows=el._rowEls || (el._rowEls=[]);
    while(rows.length<lines.length) rows.push(Object.assign(document.createElement('span'),{className:'row'}));
    rows.length=lines.length;
    // Only what is not where it should be is moved: a part already in its
    // row, in its turn, is not touched.
    for(const rr of [...el.childNodes]) if(!rows.includes(rr)) rr.remove();
    lines.forEach((idx,r)=>{
      const rr=rows[r];
      if(el.childNodes[r]!==rr) el.insertBefore(rr, el.childNodes[r]||null);
      idx.forEach((p,pos)=>{
        const pp=own[p];
        if(rr.childNodes[pos]!==pp) rr.insertBefore(pp, rr.childNodes[pos]||null);
        pp.lastChild.hidden = pos===idx.length-1;
      });
      while(rr.childNodes.length>idx.length) rr.lastChild.remove();
    });
    el.dataset.snapshot=el.textContent;
  };
  /* Widths of the parts and of their seams, as they will stand — the DATA,
     measured once for a text at a scale and kept. The page is touched only
     for a width not measured yet. */
  // (Kept for a scale; texts come and go — past a few hundred it starts anew.)
  const widths = el._widths && el._widthsAt===gridPixel() && el._widths.size<STANDARD.wordsKept ? el._widths : (el._widths=new Map(), el._widthsAt=gridPixel(), el._widths);
  const texts=[...parts.map(x=>x.text), ...parts.map(x=>x.seam||seamAny)];
  if(texts.some(t=>!widths.has(t))){
    el.textContent='';
    for(const t of texts) if(!widths.has(t)){
      const sp=document.createElement('span'); sp.textContent=t; el.appendChild(sp);
      widths.set(t, sp.getBoundingClientRect().width); sp.remove();
    }
    el._decided=null;                       // the page was touched: lay it anew
  }
  const ws=parts.map(x=>widths.get(x.text)), joins=parts.map(x=>widths.get(x.seam||seamAny));
  /* THE DECISION, from the data: the fewest lines that fit the rest of the
     row beside the neighbours (a line is eight grid pixels, no more lines
     than they stand tall), or a row of its own at the bottom. ONE EDGE for
     each layout, the same both ways: the room it is given comes from its
     neighbours, not from how it stands itself, so the edge stands still. A
     pixel to spare, so what the page lays out never wraps it by a hair. */
  const lineH=gridPixel()*8;
  const most=Math.min(parts.length, Math.max(1, Math.floor((tallest+0.5)/lineH)));
  let decided='bottom', lines=[parts.map((_,i)=>i)];
  // The band with it: it fits from its own width up, and stays the choice
  // until a layout of fewer lines fits (those passed over on the way here).
  let bandLo=-Infinity, bandHi=Infinity;
  if(parts.length) for(let k=1; k<=most; k++){
    const bb = k===1 ? {wide:ws.reduce((a,w,i)=>a+w+(i<ws.length-1?joins[i]:0),0), lines:[parts.map((_,i)=>i)]}
                     : narrowestLines(ws, joins, k);
    if(!bb) continue;
    if(bb.wide <= remainder-1){ decided=String(k); lines=bb.lines; bandLo=bb.wide+1; break; }
    bandHi=Math.min(bandHi, bb.wide+1);
  }
  el._band={stamp, words:full, lo:bandLo, hi:bandHi};
  tellEdges(el, edgesQuery(bandLo, bandHi, innerWidth-remainder), ()=>squeezeSingles());
  // How it stands follows the decision always (a packing takes its classes
  // off while it measures); its words are laid only when the decision or
  // the words changed — else the page is not touched.
  // A NEW LAYOUT OF IT IS ITS SHELF'S STATE TURNING: the shelf grows or
  // shrinks by it, and what stands below goes there smoothly, even while
  // the window is dragged (as a shelf that folds anew).
  if(el._decided!==undefined && decided!==el._decided){ const sh=shelfOf(el); if(sh) turning.add(sh); }
  el.classList.toggle('atBottom', decided==='bottom');
  el.classList.toggle('inColumn', decided!=='bottom' && decided!=='1');
  if(decided===el._decided && el.textContent===el.dataset.snapshot) return;
  el._decided=decided;
  lay(parts.length ? lines : []);
}
/* A window caption reads "pixels — 111×111 cells": what is shown, then the
   measure. In a narrow window the measure is dropped whole rather than cut
   with an ellipsis. The full text is kept on the node itself: drawing sets it
   anew every frame, and our own cut-down text must be told apart from it. */
function dropTail(el, oo){
  if(el.textContent!==el.dataset.squeezed) el.dataset.fulltext=el.textContent;
  // Its words and its width as last time: nothing to do.
  // (Its width is the one the browser told last — see the captions' size
  // observer; asked only before the first word of it.)
  const full=el.dataset.fulltext||el.textContent, room = el._room!==undefined ? el._room : el.clientWidth;
  const key=full+'|'+room;
  if(key===el._laidFor && el.textContent===el.dataset.squeezed) return;
  el._laidFor=key;
  /* ITS TAILS ARE DATA: the words whole and with each tail dropped, each
     width measured once for these words at this scale. A new width of the
     caption picks among them by numbers; the page is written only when the
     pick changes. */
  const stamp=full+'|'+gridPixel();
  if(!el._tails || el._tails.stamp!==stamp){
    const cs=getComputedStyle(el), pads=(parseFloat(cs.paddingLeft)||0)+(parseFloat(cs.paddingRight)||0);
    const range=document.createRange(), list=[];
    let text=full;
    for(;;){
      el.textContent=text; range.selectNodeContents(el);
      list.push({text, w:range.getBoundingClientRect().width+pads});
      const at=Math.max(...oo.seams.map(ss=>text.lastIndexOf(ss)));
      if(at<=0) break;
      text=text.slice(0,at);
    }
    el._tails={stamp, list};
  }
  const list=el._tails.list, pick=list.find(c=>c.w<=room+1) || list[list.length-1];
  if(el.textContent!==pick.text) el.textContent=pick.text;
  el.dataset.squeezed=el.textContent;
}
/* STACKS — a single as a column as soon as the field beside it takes more
   than one row: decided with the field's fold, in packClusters. */
const GIVING={rows:squeezeStatus, tail:dropTail};
// Its words are no longer the ones it laid out last (they were set anew).
const wordsChanged=el=>el.textContent!==(el.dataset.snapshot ?? el.dataset.squeezed);
function squeezeSingles(by){
  for(const oo of SINGLES){
    if(by==='drawing'){ const el=$('#'+oo.id_); if(!el || !wordsChanged(el)) continue; }
    // A stacking single is decided with its field's fold (packClusters),
    // not a second time after it.
    const how = oo.stacks ? null : oo.seams ? GIVING[oo.gives] : null;
    if(!how) continue;
    const el=$('#'+oo.id_); if(el && seen(el)) how(el, oo);
  }
}
/* SHORTENING BY RULE, NOT BY CUTTING. An object has a SERIES: the full label
   and its shortenings in order, from mildest to harshest. No series — the
   label is untouchable. A shortening that did not change the label does not
   count as a level. */
function labelsRow(kk){
  const fulltext=(typeof kk.label==='function')?kk.label():kk.label;
  const row_=(typeof kk.shorter==='function')?kk.shorter():(kk.shorter||[]);
  const everything=[fulltext,...row_];
  return everything.filter((tt,i)=>i===0||tt!==everything[i-1]);
}
function squeezeDepth(where){
  let gg=0;
  for(const kk of BUTTONS){
    const el=kk.node;
    if(el && where.contains(el) && seen(el)) gg=Math.max(gg, labelsRow(kk).length-1);
  }
  return gg;
}
function squeezeLabels(where, level){
  where.dataset.squeeze=level;
  for(const kk of BUTTONS)
    if(kk.node && where.contains(kk.node)) writeLabel(kk, shownLabel(kk));
}

/* EACH CLUSTER LAYS ITSELF OUT, NOT NECESSARILY IN ONE ROW. As soon as ONE
   cluster takes two rows, the shelf is twice as tall anyway, and a second row
   is free for the rest. So a cluster is not "row or stack" but "as many rows
   as needed"; a stack is just the extreme case.

   Dividers stay between clusters, dividing neighbours in the row. */
/* Where the clusters lie and where tightness is measured are not always the
   same: the knob field is measured over the whole footer. */
/* The narrowest width that holds the objects (their widths, in order) in at
   most n rows, a gap between neighbours in a row. */
function narrowestSplit(ws, n, gap){
  const m=ws.length; if(!m) return 0;
  const span=(a,b)=>{ let ss=gap*(b-a-1); for(let i=a;i<b;i++) ss+=ws[i]; return ss; };
  let prev=Array(m+1).fill(Infinity); prev[0]=0;
  let best=Infinity;
  for(let r=1; r<=n; r++){
    const cur=Array(m+1).fill(Infinity); cur[0]=0;
    for(let i=1;i<=m;i++) for(let j=0;j<i;j++) cur[i]=Math.min(cur[i], Math.max(prev[j], span(j,i)));
    best=Math.min(best, cur[m]); prev=cur;
  }
  return best;
}
var measuresEpoch=0;     // goes up when what was measured is no measure any more (a new font)
var layoutSerial=0;      // goes up with every field laid out: what was measured before is old
function packClusters(where, shelf){
  layoutSerial++;
  const clusters=[...where.querySelectorAll('.group')].filter(seen);
  if(!clusters.length) return;
  const st_=getComputedStyle(shelf);
  // The INNER width is available: the shelf padding is not given to clusters.
  // THE BAR IS NO INPUT: the room its bar takes now is given back, and a fold
  // pays for a bar only where that fold itself would scroll (see foldIn).
  const place=roomOf(shelf);
  const barW=gridPixel()*STANDARD.barWidth;
  // How tall the shelf may stand before it scrolls (a slid shelf: the part
  // in view); no limit — it never scrolls.
  const limit=shelf._scrollLimit ? shelf._scrollLimit() : Infinity;
  const pads=(parseFloat(st_.paddingTop)||0)+(parseFloat(st_.paddingBottom)||0)+(parseFloat(st_.borderTopWidth)||0);
  const gapSize=parseFloat(st_.columnGap)||0;
  const linesCount=new Map(clusters.map(gg=>[gg,1]));
  /* A cluster's one-row width is the basis for its width in N rows. Not a
     grid: a column would take the widest button's width and leave holes.
     Instead the cluster's width is capped and it wraps by itself, buttons
     packed with the same gap as in one row. */
  const toLine=new Map();
  const most=new Map();
  const gapIn=new Map();   // the gap INSIDE a group counts towards the width too
  const widths=new Map();   // object widths, largest first: columns are computed from them
  const inOrder=new Map();  // the same widths in the order the objects stand
  const heights=new Map();  // their heights, in the same order
  const rowGapIn=new Map(); // the gap between a group's rows
  // Measured more than once: a shortened label is another width, and counting
  // by the old one would fold groups where everything already fits.
  const measure=()=>{
    /* Measured UNSQUEEZED: a group wider than the field would be shrunk by
       the row it stands in, its knobs and labels with it, and a fold planned
       from shrunk widths comes out taller than planned. For the measuring it
       stands at its own full width. */
    for(const gg of clusters){ gg.style.flex='0 0 auto'; gg.style.width='max-content'; }
    // The knobs' labels are given the height they will stand with (the
    // reserve alignCaptions gives): measured by their default, two lines,
    // every knob would be data taller than it stands.
    if(where.querySelector('.knob')) alignCaptions();
    for(const gg of clusters){
      gg.style.flexWrap=''; gg.style.maxWidth='';
      for(const el of gg.children) el.style.flexGrow='';
      // Measured BEFORE stretching: the whole cluster in one row and its widest
      // button. A cluster cannot be narrower than its widest button.
      toLine.set(gg, gg.getBoundingClientRect().width);
      gapIn.set(gg, parseFloat(getComputedStyle(gg).columnGap)||0);
      const boxesIn=[...gg.children].filter(el=>!el.hidden).map(el=>el.getBoundingClientRect());
      const ww=boxesIn.map(r=>r.width).sort((a,b)=>b-a);
      widths.set(gg, ww);
      inOrder.set(gg, boxesIn.map(r=>r.width));
      heights.set(gg, boxesIn.map(r=>r.height));
      rowGapIn.set(gg, parseFloat(getComputedStyle(gg).rowGap)||0);
      most.set(gg, ww[0]||0);
    }
    for(const gg of clusters){ gg.style.flex=''; gg.style.width=''; }
  };
  measure();
  const place_=()=>{
    for(const [gg,nn] of linesCount){
      if(nn<=1){
        gg.style.flexWrap=''; gg.style.maxWidth='';
        for(const el of gg.children) el.style.flexGrow='';
      } else {
        gg.style.flexWrap='wrap';
        /* THE CEILING IS THE NARROWEST SPLIT into n rows, the objects kept
           in their order: a long one stands alone, short ones share a row —
           "Repix" above, "Open" and "Save" together under it, not "Repix"
           with "Open" and "Save" alone. Rows fill from the left within it and
           come out exactly that split. */
        const ceiling=narrowestSplit(inOrder.get(gg)||[], nn, gapIn.get(gg));
        gg.style.maxWidth=Math.ceil(Math.max(most.get(gg), ceiling))+'px';
        /* Buttons in a folded cluster stretch to its full width, or the rows end
           raggedly. Not knobs: a slider is an instrument, its width is fixed. */
        for(const el of gg.children) if(el.tagName==='BUTTON') el.style.flexGrow='1';
      }
    }
  };
  /* WIDTH BY FACT, NOT BY CALCULATION. The calculated width is a ceiling
     for deciding how many columns fit: the k widest objects side by side. But
     the widest ones need not share a row — "Show source" and "Edit lines"
     stand on top, the wider "Find grid again" below. So once laid out, every
     row is measured at its objects' OWN widths, unstretched, and the group
     becomes as wide as its widest real row: that row stands exactly by its
     labels, the others stretch to it. */
  const shrink=()=>{
    for(const [gg,nn] of linesCount){
      if(nn<=1) continue;
      const kids=[...gg.children].filter(el=>!el.hidden);
      for(const el of kids) el.style.flexGrow='';
      const rows=new Map();
      // Rows by where the LAYOUT puts them (offsetTop): a thing still on its
      // way is drawn off its row (its offset), and would count as a row alone.
      for(const el of kids){
        const r=el.getBoundingClientRect(), top=laidTop(el, r), w=r.width;
        rows.set(top, (rows.get(top)||0) + w + (rows.has(top) ? gapIn.get(gg) : 0));
      }
      const widest=Math.max(...rows.values());
      if(widest>0) gg.style.maxWidth=Math.ceil(widest)+'px';
      for(const el of kids) if(el.tagName==='BUTTON') el.style.flexGrow='1';
    }
  };
  if(place<=0) return;               // the shelf is not laid out yet — nothing to measure
  // What stands on the shelf beside the field and counts for its room: all
  // but the singles that are not counted.
  const uncounted=new Set(SINGLES.filter(oo=>!oo.counted).map(oo=>oo.id_));
  const children_=()=>{
    const sp=[...where.children].filter(seen);
    if(shelf!==where) for(const el of shelf.children){
      if(el===where || !seen(el) || uncounted.has(el.id)) continue;
      sp.push(el);
    }
    return sp;
  };
  /* THE FOLD IS COMPUTED, NOT TRIED. Every fold — all groups in n rows —
     is worked out from the DATA measured once for this packing: the objects'
     widths and heights, the gaps, the dividers, the shelf's other objects.
     Nothing is laid out on the page to see what comes of it; the page gets
     the chosen fold once, at the end.
     For n rows a group is as wide as the narrowest split of its objects into
     n rows (its order kept), and as tall as the rows that split fills. All
     the groups side by side with the dividers, and the shelf's other objects
     beside them: that fits the room — one band — or it wraps, and the shelf
     is as tall as the lines it wraps into. */
  const G=clusters.length;
  const fieldCs=getComputedStyle(where);
  const fieldGap=parseFloat(fieldCs.columnGap)||0, fieldRowGap=parseFloat(fieldCs.rowGap)||0;
  const dvd=[...where.querySelectorAll(':scope > .divider')].find(seen);
  const dw=dvd ? dvd.getBoundingClientRect().width : 0;
  // The singles of this shelf stand whole while the data is taken: a status
  // left broken in rows by the last layout would make the heights depend on
  // it. They give way again after (squeezeSingles).
  for(const oo of SINGLES){ const el=$('#'+oo.id_); if(el && shelf.contains(el)) el.classList.remove('inColumn','atBottom'); }
  const others = shelf===where ? [] : [...shelf.children].filter(el=>el!==where && seen(el)
    && !uncounted.has(el.id) && getComputedStyle(el).position!=='absolute');
  /* A STACKING SINGLE (stacks — the stage block) is part of this decision,
     not a second one after it: it stands as a column when the field, beside
     it standing as a row, takes more than one row. Both its forms are
     measured once here, and every fold is worked out with the form it would
     have — one trigger, one layout, one way for all. */
  const stacker=others.find(el=>SINGLES.some(oo=>oo.id_===el.id && oo.stacks));
  const measureOthers=()=>({w:others.reduce((a,el)=>a+el.getBoundingClientRect().width+gapSize, 0),
                            h:Math.max(0, ...others.map(el=>el.getBoundingClientRect().height))});
  // Measured as it stands unrolled: a sunk block's narrow width and cap
  // (the ribbon's, see sink) are the rolled shelf's, not this decision's.
  // ITS OWN BAR IS NO INPUT EITHER: the room a bar of its own takes now (it
  // scrolled while sunk) is given back for the measuring — or the fold would
  // depend on where the window came from.
  const sunk = stacker && {w:stacker.style.width, mh:stacker.style.maxHeight, cls:stacker.classList.contains('sinking'),
                           pr:stacker.style.paddingRight, bs:stacker.style.boxSizing};
  if(sunk){ stacker.style.width=''; stacker.style.maxHeight=''; stacker.classList.remove('sinking');
            if(stacker._barPad){ stacker.style.paddingRight=''; stacker.style.boxSizing=''; } }
  if(stacker) evenOut();
  const rowForm=measureOthers();
  let colForm=rowForm;
  if(stacker){
    stacker.classList.add('inColumn'); evenOut(); colForm=measureOthers();
    stacker.classList.remove('inColumn'); evenOut();
  }
  if(sunk){ stacker.style.width=sunk.w; stacker.style.maxHeight=sunk.mh; stacker.classList.toggle('sinking', sunk.cls);
            stacker.style.paddingRight=sunk.pr; stacker.style.boxSizing=sunk.bs; }
  /* THE DATA OF EVERY LEVEL of shortened labels, measured once for this
     packing: then the fold for ANY room is worked out from it — the fold
     chosen now, and the rooms where the choice would change (the band). */
  const mx_=Math.max(...clusters.map(gg=>gg.childElementCount));
  const depth=squeezeDepth(where);
  const levels=[];
  /* MEASURED ONCE FOR A CONTENT. What is measured here — every object at its
     own width and height, at every level of shortened labels — is the same
     at any room: it is the content's, not the window's. So it is kept with
     the content's print (which objects, their words at every level, the
     scale and spacing), and a field laid out anew for another room only — an
     edge of its band crossed — takes its fold from the kept numbers: the
     page is not asked again. Another content, another scale, a new font
     (measuresEpoch): measured anew. */
  const print=[measuresEpoch, fieldPrint(where),
    ...BUTTONS.filter(kk=>kk.node && !kk.node.hidden && where.contains(kk.node)).map(kk=>labelsRow(kk).join('/')),
    ...[...where.querySelectorAll('.knob b')].filter(b=>!b.closest('[hidden]')).map(b=>b.textContent)].join('|');
  const keepData=()=>clusters.map(gg=>({toLine:toLine.get(gg), most:most.get(gg), gapIn:gapIn.get(gg), widths:widths.get(gg),
                                         inOrder:inOrder.get(gg), heights:heights.get(gg), rowGapIn:rowGapIn.get(gg)}));
  const takeData=kept=>clusters.forEach((gg,i)=>{ const d=kept[i];
    toLine.set(gg, d.toLine); most.set(gg, d.most); gapIn.set(gg, d.gapIn); widths.set(gg, d.widths);
    inOrder.set(gg, d.inOrder); heights.set(gg, d.heights); rowGapIn.set(gg, d.rowGapIn); });
  const had = where._measured && where._measured.print===print && where._measured.levels.length===depth+1
              && where._measured.levels.every(l=>l.length===clusters.length) ? where._measured.levels : null;
  const measured=[];
  const dataAt=ss=>takeData((had || measured)[ss]);
  for(let ss=0; ss<=depth; ss++){
    // Level zero is a level too: labels must be RESTORED, or a button squeezed
    // once would stay "Grid" on a wide screen.
    if(had) takeData(had[ss]);
    else { squeezeLabels(where, ss); measure(); measured.push(keepData()); }
    const widthAt=(gg,k)=>{
      const kk=Math.min(k, gg.childElementCount);
      return kk<=1 ? toLine.get(gg) : Math.max(most.get(gg), narrowestSplit(inOrder.get(gg)||[], kk, gapIn.get(gg)));
    };
    const heightAt=(gg,k)=>{
      const ws=inOrder.get(gg)||[], hs=heights.get(gg)||[], cap=widthAt(gg,k)+0.5, gap=gapIn.get(gg);
      let lines=0, w=0, h=0, total=0;
      ws.forEach((x,i)=>{
        if(lines && w+gap+x<=cap){ w+=gap+x; h=Math.max(h, hs[i]); }
        else { if(lines) total+=h+rowGapIn.get(gg); lines++; w=x; h=hs[i]; }
      });
      return total+h;
    };
    // Each number of rows: the groups' widths and heights — the same at any room.
    const folds=[null];
    for(let nn=1; nn<=mx_; nn++){
      const Wg=clusters.map(gg=>widthAt(gg,nn)), Hg=clusters.map(gg=>heightAt(gg,nn));
      folds.push({Wg, Hg, fieldOne:Wg.reduce((a,b)=>a+b,0)+(G-1)*(dw+2*fieldGap)});
    }
    levels.push(folds);
  }
  if(!had) where._measured={print, levels:measured};
  // A fold (level ss, nn rows) in a room P: its height, whether it keeps one
  // band, and how its groups wrap into lines (the page wraps them so).
  const foldOf=(ss,nn,P)=>{
    const {Wg, Hg, fieldOne}=levels[ss][nn];
    /* The stacking single is a column exactly when the field stands in more
       than one row, and a row when the field is one: a single row of knobs
       beside a tall column is no state (it would stand so for a while and
       then give its height back — a step). */
    const multi = nn>1 && clusters.some(gg=>gg.childElementCount>1);
    if(!stacker){ const f=foldWith(Wg, Hg, fieldOne, P, rowForm); return {ss, nn, hh:f.hh, one:f.one, lines:f.lines, col:false}; }
    if(!multi){
      const f=foldWith(Wg, Hg, fieldOne, P, rowForm);
      if(f.one) return {ss, nn, hh:f.hh, one:true, lines:f.lines, col:false};
      const g=foldWith(Wg, Hg, fieldOne, P, colForm);
      // One row beside the column: not allowed — another fold is taken.
      if(g.one) return {ss, nn, hh:Infinity, one:false, lines:'x', col:true};
      return {ss, nn, hh:g.hh, one:false, lines:g.lines+'c', col:true};
    }
    const f=foldWith(Wg, Hg, fieldOne, P, colForm);
    return {ss, nn, hh:f.hh, one:f.one, lines:f.lines+'c', col:true};
  };
  const foldWith=(Wg, Hg, fieldOne, P, form)=>{
    const otherW=form.w, otherH=form.h;
    const one=fieldOne+otherW<=P+0.5;
    let hh, lines='';
    if(one) hh=Math.max(...Hg, otherH);
    else {
      // The field's own lines over the whole width, the others under it.
      const room = P;
      let fieldH=0, lineH=0, w=0, first=true;
      Wg.forEach((x,i)=>{
        const add = first ? x : dw+2*fieldGap+x;
        if(!first && w+add>room+0.5){ fieldH+=lineH+fieldRowGap; w=x; lineH=Hg[i]; lines+='|'+i; }
        else { w+=add; lineH=Math.max(lineH, Hg[i]); }
        first=false;
      });
      fieldH+=lineH;
      hh = fieldH+(others.length ? gapSize+otherH : 0);
      lines+='u';
    }
    return {hh, one, lines};
  };
  /* ORDER OF CONCESSIONS. First groups fold into rows — all into the same
     number. Only when folding is exhausted do labels get shortened. ONE
     BAND FIRST: the lowest fold that keeps everyone in one band wins, on a
     phone too — there it is every cluster in a column beside the stage
     block. Only when no fold gives one band does the lowest shelf win, and
     only then are labels shortened. */
  /* A FOLD THAT WOULD SCROLL pays for its bar: worked out again in the room
     less the bar. Narrower is never shorter, so it scrolls there too — the
     same decision both ways, whatever bar stands now. */
  const foldIn=(ss,nn,P)=>{
    const f=foldOf(ss,nn,P);
    return f.hh+pads > limit+0.5 ? foldOf(ss,nn,P-barW) : f;
  };
  const decide=P=>{
    let best=null, fitted=false;
    for(let ss=0; ss<=depth; ss++){
      let lowest=null, lowestOne=null;
      for(let nn=1; nn<=mx_; nn++){
        const tt=foldIn(ss, nn, P);
        if(!lowest || tt.hh<lowest.hh-0.5) lowest=tt;
        if(tt.one && (!lowestOne || tt.hh<lowestOne.hh-0.5)) lowestOne=tt;
      }
      if(lowestOne) fitted=true;
      const here = lowestOne || lowest;
      if(!best || fitted || here.hh<best.hh-0.5) best=here;
      if(fitted) break;
    }
    return best;
  };
  const best=decide(place);
  /* DECIDED BEFORE SHOWN: a shelf that rolls (rolls) is asked with the
     height the chosen fold would have. One row — a ROLLED field is one row
     that scrolls: nothing folds, no label is shortened; it is never shown
     tall first. */
  const rolled=!!(best && shelf._rollDecide && shelf._rollDecide(best.hh+pads));
  /* THE BAND: the rooms about this one where the same would be decided —
     the same fold, the same wraps, rolled or not — worked out from the data
     above, nothing laid out. Its edges are the TRIGGERS: a room past one
     lays this field out anew; within it nothing is asked. The window's
     height is a trigger of a rolling shelf too: its band of heights. */
  const keyAt=P=>{
    const b=decide(P);
    if(b && shelf._rollWould && shelf._rollWould(b.hh+pads)) return 'rolled';
    return b ? b.ss+'/'+b.nn+'/'+(b.one ? 'one' : b.lines) : '-';
  };
  /* ITS EDGES ARE KNOWN, NOT LOOKED FOR. A room enters a decision in two
     ways only: do all the groups with the shelf's other objects stand in one
     row, and where does a line of groups break. Both are a run of groups'
     widths against the room — so the decision can change only at the rooms
     that are exactly such a run (and at those plus a bar, for a fold that
     pays for one). These rooms are listed from the data; between two
     neighbours of the list the decision is one. The band is the stretch of
     the list about the room of now where the decision stays what it is.
     THE BAR'S EDGE ONLY FOR WHO PAYS IT. A fold that scrolls is worked out
     in the room less the bar, so its run stands a bar further: r + bar. Only
     a fold that does scroll at that room has that edge; a fold that stands
     there without a bar has its run at r alone. (Where a fold starts or stops
     scrolling, its height changes — at a run of its own: listed already.) */
  const key=keyAt(place);
  let lo=0, hi=Infinity;
  if(!(key==='rolled' && shelf._rollChosen && shelf._rollChosen())){
    const all=new Set(), sep=dw+2*fieldGap;
    levels.forEach((folds,ss)=>{ for(let nn=1; nn<=mx_; nn++){
      const {Wg, fieldOne}=folds[nn], runs=[fieldOne+rowForm.w-0.5, fieldOne+colForm.w-0.5];
      for(let i=0;i<G;i++){ let w=Wg[i]; for(let j=i+1;j<G;j++){ w+=sep+Wg[j]; runs.push(w-0.5); } }
      for(const r of runs){
        all.add(r);
        if(foldOf(ss,nn,r+barW).hh+pads > limit+0.5) all.add(r+barW);
      }
    } });
    const edges=[...all].filter(r=>r>0).sort((a,b)=>a-b);
    // The stretch the room of now lies in: from edges[at-1] up to edges[at].
    let at=0; while(at<edges.length && edges[at]<=place) at++;
    // A room inside each stretch speaks for the whole of it.
    const inside=k=>((k>0 ? edges[k-1] : edges[0]-2)+(k<edges.length ? edges[k] : edges[edges.length-1]+2))/2;
    if(edges.length){
      let k=at; while(k>0 && keyAt(inside(k-1))===key) k--;
      lo = k>0 ? edges[k-1] : 0;
      k=at; while(k<edges.length && keyAt(inside(k+1))===key) k++;
      hi = k<edges.length ? edges[k] : Infinity;
    }
  }
  const [hLo, hHi] = best && shelf._rollBand ? shelf._rollBand(best.hh+pads) : [0, Infinity];
  BANDS.set(where, {shelf, lo, hi, hLo, hHi});
  // Its edges, told by the browser: crossed, the field is laid out anew —
  // and if that laid nothing out (the edge and the room disagree), it is blind.
  tellEdges(where, edgesQuery(lo, hi, innerWidth-roomOf(shelf), hLo, hHi),
    ()=>{ const n=layoutSerial; relayout(); if(layoutSerial===n) BLIND.add(where); });
  if(rolled){
    squeezeLabels(where, 0);
    dataAt(0);
    for(const gg of clusters) linesCount.set(gg, 1);
    place_(); squeezeSingles();
    return;
  }
  if(best){
    squeezeLabels(where, best.ss);
    dataAt(best.ss);
    for(const gg of clusters) linesCount.set(gg, Math.min(best.nn, gg.childElementCount));
    if(stacker){ stacker.classList.toggle('inColumn', !!best.col); evenOut(); }
    place_();
  }
  shrink();
  /* Groups are laid out — now it is clear whether singles have room. */
  squeezeSingles();
  /* No reverse step (straightening narrow clusters one by one): the shelf
     height is set by the most awkward cluster anyway, and a shared ceiling
     looks even. */
}

/* ===================== hints =====================
   Everything explained goes through ONE hint: a native tooltip has its own
   look and font and reads as a foreign program.
   EXPLANATION ON HOLD. With the mouse — stay on one spot for almost a second
   (leave earlier and it does not appear at all); with a finger — press and
   hold. A short tap only does the job, a long one only explains, and the
   press is not passed through. */

let hintsOn=true;
function recallHints(){
  try{ hintsOn = localStorage.getItem('repix.hints')!=='no'; }catch(_){}
}
function saveHints(){
  try{ localStorage.setItem('repix.hints', hintsOn?'yes':'no'); }catch(_){}
}
const WAIT=900;              // mouse: how long to stay
const PRESS=450;             // finger: how long to hold
let hintTimer=null;
let fingerHold=null, swallowClick=false;
/* THE ICON IS AN EXPLICIT QUESTION. The hints switch turns off what pops up
   by itself: explanations of buttons, fields, knobs. But the "i" is there to
   be asked, so icons are "on demand" and the switch does not apply to them. */
function attachHint(el, give, onDemand){
  const name=()=>typeof give==='function'?give():give;
  // Explained even with Hints off: the question mark under the cursor says so.
  el.classList.toggle('alwaysHint', !!onDemand);
  el.addEventListener('pointerenter', ss=>{
    if(ss.pointerType==='touch') return;   // a finger has its own way — press and hold
    const [ii,tt]=name(); showHint(el,ii,tt,onDemand);
  });
  el.addEventListener('pointerleave', hideHint);
  // HOLDING is its own question, by finger or by the left mouse button: the
  // hint comes and stays (see holdHint). Hovering is hovering.
  el.addEventListener('pointerdown', ss=>{
    if(ss.pointerType==='mouse' && ss.button!==0) return;
    clearTimeout(fingerHold);
    fingerHold=setTimeout(()=>{
      const [ii,tt]=name();
      if(placeHint(el,ii,tt,onDemand)===false) return;
      holdHint();
      swallowClick=true;              // held for an explanation, not for the action
    }, PRESS);
  });
  for(const ss of ['pointerup','pointercancel','pointermove'])
    el.addEventListener(ss, ()=>clearTimeout(fingerHold));
  el.addEventListener('click', ss=>{
    if(!swallowClick) return;
    swallowClick=false;
    ss.preventDefault(); ss.stopPropagation();
  }, true);
}
function showHint(uu,name,text,onDemand){
  clearTimeout(hintTimer);
  // Back on what the hint still shows: it stays, it is not asked anew.
  if(hint._for===uu && hint.classList.contains('showing')){ clearTimeout(leaveTimer); return; }
  if(hintHeld) return;                   // a held hint is not replaced by passing by
  if(!hintsOn && !onDemand)return;
  if(!text)return;
  hintTimer=setTimeout(()=>placeHint(uu,name,text,onDemand),WAIT);
}
// The grid pixel of now: set in one place (fitGrid) and kept — asked many
// times a frame, it is no reason to ask the page for its styles.
var unitNow=0;            // (var: asked from the very first lines of the page)
function gridPixel(){
  return unitNow || (unitNow=parseFloat(getComputedStyle(document.documentElement)
           .getPropertyValue('--unit'))||2);
}
/* A FLOATING WINDOW IS DRAGGED BY ITS HEADER — and lands on the grid like
   everything else. Buttons in the header stay buttons: one drags by the empty
   space between them. The drag step is the grid pixel. */
function dragFloating(win, knob){
  knob.addEventListener('pointerdown', ss=>{
    if(ss.target.closest('button')) return;
    const unit=gridPixel(), edge=unit*FLOAT_EDGE;
    const rr=win.getBoundingClientRect();
    const dx_=ss.clientX-rr.left, du=ss.clientY-rr.top;
    knob.setPointerCapture(ss.pointerId);
    win._held=true;                  // the hand holds it: it stands where the hand puts it
    win._goal=null;                  // and its goal against what it came to is let go
    const drag=mm=>{
      let x=Math.round((mm.clientX-dx_)/unit)*unit;
      let y=Math.round((mm.clientY-du)/unit)*unit;
      x=Math.max(edge, Math.min(innerWidth-rr.width-edge, x));
      y=Math.max(edge, Math.min(innerHeight-rr.height-edge, y));
      win.style.left=x+'px'; win.style.top=y+'px';
    };
    const enough=()=>{
      win._held=false;
      knob.removeEventListener('pointermove',drag);
      knob.removeEventListener('pointerup',enough);
      knob.removeEventListener('pointercancel',enough);
    };
    knob.addEventListener('pointermove',drag);
    knob.addEventListener('pointerup',enough);
    knob.addEventListener('pointercancel',enough);
    ss.preventDefault();
  });
}

/* WHERE A FLOATING ENTITY STANDS. It comes to the entity the user is dealing
   with, so its place is computed from it: horizontally centre to centre,
   vertically on the side where there is room. It keeps FLOAT_EDGE cells from
   what called it and from every border of the window alike. */
const FLOAT_EDGE=4, FLOAT_GAP=FLOAT_EDGE;
/* PLACE — A GOAL BY WHAT IT IS AGAINST (the goal argument; stick is the
   same with rel as `to`; placeTo and stickTo give it on the way). Every
   part may be left out: the standard stands.
     rel    — relative to what: an object (a selector or the node), 'area'
              (its own area — the standard) or 'window';
     side   — 'inside' (in it — the standard for an area or the window),
              'downward', 'upward', 'left', 'right' (against it — the
              standard for an object is 'downward'); against it with no
              room on that side, it goes to the other one;
     gap    — grid pixels off it (outside: FLOAT_GAP; inside: 0);
     align  — where along the face: 'start', 'center' (the standard),
              'end', or a share 0…1; inside, {x, y} — each its own;
              {x: a selector} — across from that thing's middle, as it is
              drawn (it goes with that thing on its way);
     size   — {w, h}: grid pixels, 'N%' of what it is against, 'span' (as
              long as that face) or 'fill' (to the end of its area);
              minW, maxW, minH, maxH the same way;
              ratio — w/h kept when only one of them is given.
   It NEVER LEAVES ITS AREA: the window for a floating thing, its own area
   for one in it. A floating or absolute thing is put by left/top; one in
   the flow by a relative shift from where the layout puts it. The engine
   keeps the goal at every settling, and — while what it is against is on
   its way — every frame, from where that is drawn. A circle (A against B,
   B against A) is refused. A hand that takes the thing lets its goal go. */
const stuckNow=()=>{ for(const x of stuck) if(!x.isConnected || !x._goal) stuck.delete(x); return [...stuck]; };
const placedRef=P=>P.rel && P.rel!=='area' && P.rel!=='window' ? (typeof P.rel==='string' ? $(P.rel) : P.rel) : null;
function placeTo(el, P){
  if(!P){ el._goal=null; return; }
  // A circle of goals is refused: it would never stand.
  for(let t=placedRef(P), n=0; t && n<64; t = t._goal ? placedRef(t._goal) : null, n++)
    if(t===el){ console.warn('place: a circle of goals', el); return; }
  el._goal=P; stuck.add(el); placeAt(el);
}
function stickTo(win, to, side='downward', o={}){
  placeTo(win, to ? {rel:to, side, gap:o.gap, align:o.align, size: o.span ? {[side==='left'||side==='right' ? 'h' : 'w']:'span'} : o.size} : null);
}
const placeStuck=el=>placeAt(el);
// A box of the page: an element's content box, or the window.
function contentBox(a){
  if(!a || a===document.body || a===document.documentElement) return {left:0, top:0, right:innerWidth, bottom:innerHeight, width:innerWidth, height:innerHeight};
  const r=a.getBoundingClientRect(), cs=getComputedStyle(a);
  const l=r.left+a.clientLeft+(parseFloat(cs.paddingLeft)||0), t=r.top+a.clientTop+(parseFloat(cs.paddingTop)||0);
  const w=a.clientWidth-(parseFloat(cs.paddingLeft)||0)-(parseFloat(cs.paddingRight)||0);
  const h=a.clientHeight-(parseFloat(cs.paddingTop)||0)-(parseFloat(cs.paddingBottom)||0);
  return {left:l, top:t, right:l+w, bottom:t+h, width:w, height:h};
}
function placeAt(el){
  const P=el._goal; if(!P || el.hidden) return;
  const g=gridPixel(), cs=getComputedStyle(el), pos=cs.position, fixed=pos==='fixed', flow=pos==='static'||pos==='relative';
  const obj=placedRef(P);
  if(P.rel && P.rel!=='area' && P.rel!=='window' && (!obj || !obj.isConnected)) return;
  const ref = obj ? obj.getBoundingClientRect() : P.rel==='window' ? contentBox(null) : contentBox(el.parentElement);
  const side = P.side || (obj ? 'downward' : 'inside');
  const across = side==='left' || side==='right';
  // Its SIZE: by what it is against, within its limits, its ratio kept.
  const S=P.size||{};
  // 'fill' is laid last, from where it stands to the end of its area.
  // (In the flow its own size is its area's too: it is taken off for the
  // measuring. Out of the flow it weighs on nothing: counted as nothing.)
  if(S.w==='fill' && flow) el.style.width='0px';
  if(S.h==='fill' && flow) el.style.height='0px';
  const len=(v, full, face)=>v===undefined || v===null || v==='fill' ? null : v==='span' ? face
    : typeof v==='string' && v.endsWith('%') ? full*parseFloat(v)/100 : +v*g;
  if(P.size){
    let w=len(S.w, ref.width, across ? null : ref.width), h=len(S.h, ref.height, across ? ref.height : null);
    if(S.ratio){ if(w!==null && h===null) h=w/S.ratio; else if(h!==null && w===null) w=h*S.ratio; }
    const clamp=(v, lo, hi)=>{ if(v===null) return v; if(lo!==null && v<lo) v=lo; if(hi!==null && v>hi) v=hi; return v; };
    w=clamp(w, len(S.minW, ref.width, ref.width), len(S.maxW, ref.width, ref.width));
    h=clamp(h, len(S.minH, ref.height, ref.height), len(S.maxH, ref.height, ref.height));
    // A size the goal gives is the goal's: the page's own limits give way
    // (its limits are the goal's minW…maxH).
    if(w!==null){ el.style.width=Math.round(w)+'px'; el.style.maxWidth='none'; el.style.minWidth='0'; }
    if(h!==null){ el.style.height=Math.round(h)+'px'; el.style.maxHeight='none'; el.style.minHeight='0'; }
  }
  // Its AREA, which it never leaves.
  const edge = fixed ? g*FLOAT_EDGE : 0;
  const cb = fixed ? null : pos==='absolute' ? (el.offsetParent || el.parentElement) : el.parentElement;
  const ab=contentBox(cb);
  let box=el.getBoundingClientRect();
  if(!flow && (S.w==='fill' || S.h==='fill'))
    box={left:box.left, top:box.top, width: S.w==='fill' ? 0 : box.width, height: S.h==='fill' ? 0 : box.height};
  const lo={x:ab.left+edge, y:ab.top+edge}, hi={x:ab.right-box.width-edge, y:ab.bottom-box.height-edge};
  const gap=g*(P.gap!==undefined ? P.gap : side==='inside' ? 0 : FLOAT_GAP);
  const share=a=>a==='start' ? 0 : a==='end' ? 1 : typeof a==='number' ? Math.max(0, Math.min(1, a)) : 0.5;
  const alignTo = P.align && typeof P.align==='object' && typeof P.align.x==='string' ? $(P.align.x) : null;
  const ax=share(P.align && typeof P.align==='object' ? (alignTo ? 0.5 : P.align.x) : P.align);
  const ay=share(P.align && typeof P.align==='object' ? P.align.y : P.align);
  let x, y;
  if(side==='inside'){
    x=ref.left+gap+(ref.width-2*gap-box.width)*ax;
    if(alignTo){ const o=alignTo.getBoundingClientRect(); x=o.left+o.width/2-box.width/2; }
    y=ref.top+gap+(ref.height-2*gap-box.height)*ay;
  } else if(across){
    const left=ref.left-box.width-gap, right=ref.right+gap;
    x = side==='right' ? (right<=hi.x ? right : left) : (left>=lo.x ? left : right);
    y=ref.top+(ref.height-box.height)*ay;
  } else {
    const up=ref.top-box.height-gap, down=ref.bottom+gap;
    y = side==='downward' ? (down<=hi.y ? down : up) : (up>=lo.y ? up : down);
    x=ref.left+(ref.width-box.width)*ax;
    // Across from another thing's middle, as it is drawn.
    if(alignTo){ const o=alignTo.getBoundingClientRect(); x=o.left+o.width/2-box.width/2; }
  }
  x=Math.max(lo.x, Math.min(hi.x, x)); y=Math.max(lo.y, Math.min(hi.y, y));
  // A floating window stands on the grid; in an area it stands exactly.
  if(fixed){ x=Math.round(x/g)*g; y=Math.round(y/g)*g; }
  if(S.w==='fill') el.style.width=Math.max(0, Math.round(ab.right-edge-x))+'px';
  if(S.h==='fill') el.style.height=Math.max(0, Math.round(ab.bottom-edge-y))+'px';
  if(fixed){ el.style.left=x+'px'; el.style.top=y+'px'; return; }
  if(!flow){
    const r=cb.getBoundingClientRect();
    el.style.left=(x-r.left-cb.clientLeft+cb.scrollLeft)+'px'; el.style.top=(y-r.top-cb.clientTop+cb.scrollTop)+'px';
    return;
  }
  // In the flow: a relative shift from where the layout puts it.
  const was={x:parseFloat(el.style.left)||0, y:parseFloat(el.style.top)||0};
  el.style.position='relative';
  el.style.left=(x-(box.left-was.x))+'px'; el.style.top=(y-(box.top-was.y))+'px';
}
// Placed against something on its way: the goal goes with it every frame.
function movingNow(el){
  for(let a=el; a && a!==document.body; a=a.parentElement)
    if(going.has(a) || floatGoing.has(a) || shelfGoing.has(a) || scrolling.has(a) || stretching.has(a)) return true;
  return false;
}
function ridePlaced(){
  for(const x of stuck){
    const P=x._goal, obj = P && placedRef(P);
    if(!obj) continue;
    if(floatGoing.has(x) || going.has(x)){ if(movingNow(obj)) x._riding=true; continue; }
    // On its way — every frame; just arrived — once more, where it stands.
    const al = P.align && typeof P.align==='object' && typeof P.align.x==='string' ? $(P.align.x) : null;
    /* NO BLIND SPOT: what stands by a goal depends on more than the one it is
       against - its alignment, its area's end ('fill'), the window - and any
       of those may be on its way. So it is not asked which: while ANYTHING
       goes (a place, a shelf's height, a window's box, a stretch), it is put
       where its goal is now, every frame; when all stands, once more (14.11:
       the seam between the pictures took its new length at once and ran
       ahead of the panel being slid away - nothing it was against moved, its
       area's end did). Few things stand by goals: this costs nothing. */
    const anyGoing = going.size>0 || shelfGoing.size>0 || floatGoing.size>0 || stretching.size>0;
    const moving=movingNow(obj) || (al && movingNow(al)) || anyGoing;
    if(moving || x._riding){ placeAt(x); if(P.divides) divideBy(x, moving); }
    x._riding=moving;
  }
}
/* A LINE THAT DIVIDES (the `divides` argument of a goal). A line placed
   between two neighbours standing in a row is where the first of them ends:
   on its way, the first neighbour is as wide as the line is drawn far — so
   what the neighbours show is never cut away from the line. Arrived, the
   layout has them back. */
function divideBy(line, moving){
  const row=line.parentElement, first=line.previousElementSibling; if(!row || !first) return;
  const cs=getComputedStyle(row);
  if(!moving || !cs.flexDirection.startsWith('row') || getComputedStyle(line).display==='none'){ first.style.flex=''; return; }
  const l=line.getBoundingClientRect(), a=row.getBoundingClientRect(), gap=parseFloat(cs.columnGap)||0;
  const w=Math.round(l.left+l.width/2-(a.left+row.clientLeft)-gap/2);
  first.style.flex=`0 0 ${Math.max(0,w)}px`;
}
function placeFloating(win, uu, whereTo, o={}){ stickTo(win, uu, whereTo, o); }
function placeHint(uu,name,text,onDemand){
  if(!hintsOn && !onDemand) return false;
  if(!uu.isConnected || !uu.getClientRects().length) return false;   // gone or hidden meanwhile
  hint._for=uu;
  hint.innerHTML='<b>'+name+'</b>'+text;
  /* The layer comes from the owner: a hint stands right above what called it
     and does not cover what was opened over it. */
  hint.style.zIndex =
    uu.closest('#colorPicker') ? 'var(--layerPickerHints)' :
    uu.closest('#settings,#askWin') ? 'var(--layerMenuHints)' :
                                  'var(--layerUiHints)';
  // A new hint, or the same one called again while it was going out: it
  // stays, and comes back from how it is now.
  clearTimeout(leaveTimer);
  hint.classList.add('showing');
  if(aimed('fade', hint)===0) appear(hint);
  scrollAt(hint, 0);
  stickTo(hint, uu, 'upward');
  // Some texts are longer than the window — the stages cannot be told briefly.
  // Then the hint becomes scrollable.
  hint.classList.toggle('scrolls',
    hint.scrollHeight>hint.clientHeight+1);
}
/* A HINT IS A GOAL too: left by the cursor — the button or the hint itself
   — it waits LINGER before it goes, so the cursor can get to it; on it, it
   stays and is read, selected, copied. Then it goes out by the engine; the
   cursor back on it while it goes turns it back. */
const LINGER=600;
let leaveTimer=null;
function hideHint(){
  clearTimeout(hintTimer);
  if(hintHeld) return;                   // only the next press lets it go
  clearTimeout(leaveTimer);
  leaveTimer=setTimeout(()=>{
    if(hintHeld || !hint.classList.contains('showing')) return;
    vanish(hint, ()=>{ hint.classList.remove('showing','scrolls'); hint.style.opacity=''; });
  }, LINGER);
}

/* A HELD HINT stays until the next press anywhere outside it — a finger or
   the mouse. That press only lets it go: its click does nothing, or a tap to
   close the hint would also press whatever lay under it. Inside the hint a
   press selects its text. */
let hintHeld=false, eatClick=false;
// after — what to undo when the held hint is let go (a lit paint goes dark).
let heldAfter=null;
function holdHint(after){ hintHeld=true; hint.classList.add('held'); heldAfter=after||null; }
function releaseHint(){
  hintHeld=false;
  if(heldAfter){ const ff=heldAfter; heldAfter=null; ff(); }
  hint.classList.remove('held','showing','scrolls');
  const ss=getSelection(); if(ss && hint.contains(ss.anchorNode)) ss.removeAllRanges();
}
addEventListener('pointerdown',e=>{
  // Every press starts clean: a click left uneaten by a press that ended
  // otherwise (a drag, a scroll that cancelled the touch) is forgotten here.
  eatClick=false; swallowClick=false;
  if(!hintHeld || hint.contains(e.target)) return;
  // This press only lets the hint go: it reaches nothing under it — no stroke,
  // no slider, no line — and its click is eaten.
  releaseHint(); eatClick=true;
  e.stopPropagation(); e.preventDefault();
},true);
addEventListener('click',e=>{
  if(!eatClick) return;
  eatClick=false; e.preventDefault(); e.stopPropagation();
},true);

