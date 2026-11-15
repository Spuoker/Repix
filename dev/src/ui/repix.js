// SPDX-License-Identifier: GPL-3.0-or-later
/* REPIX PROGRAM — state, image processing, actions and startup. */

/* Everything visible exists before the program looks nodes up by name. */
buildView();
const status=$('#status');
const hint=$('#hint');
// Each single carries its way of giving: its look in each case comes with it.
for(const oo of SINGLES){ const el=$('#'+oo.id_); if(el && oo.gives) el.dataset.gives=oo.gives; }

// QUIET — its words change with every count and move nothing else (it
// stands last, uncounted); a new layout of it is a class, and that is seen.
status.dataset.quiet='';

const val={}, widget={};
let touched=false;   // whether the user changed the computing parameters by hand
/* AUTO SETTINGS STAND. A stage's automatic settings are taken once and stand
   until something changes what they were taken from — a knob of that stage
   or of one before it, the grid, a line, a step back. While they stand,
   asking for them again would only count the same work the same way: the
   button is dimmed. */
var autoStands={};
function autoChanged(fromStage){
  const stood=!!autoStands[stage];
  for(let n=fromStage; n<=4; n++) autoStands[n]=false;
  if(stood && !autoStands[stage]) refreshButtons();     // the button is there again
}

/* FINE KNOBS BEHIND A LID. On view stay the grid and the tolerance; overlap,
   spatial width, surround weight and agreement hide behind "Fine": the
   automatic settings set them alike on any work. Their values still work. */
let fineVisible=false;
let currentGroup=null, prevCluster=null;
for(const record of KNOBS){
  const [name,mn_,mx_,beg,precP,prec,move,stageKnobs,explanation,cluster]=record;
  // A new cluster — a new column. No dividers here: as in the header, the
  // engine places them itself, looking at what is visible now.
  if(cluster!==prevCluster){ currentGroup=null; prevCluster=cluster; }
  val[name]=beg;
  const shares = move==='step share';
  const oo=buildNode({knob:{
    caption:CAPTIONS[name]||name, min:mn_, max:mx_, value:beg,
    limits:()=>limits(move,mn_,mx_),
    curve: move==='multiple' ? 'ratio' : 'even', step:precP, digits:prec,
    fold: shares ? v=>toCell(v,currentStep()) : null,
    // The title shows the knob's CAPTION, not its key: the key is internal.
    hint: explanation ? ()=>[CAPTIONS[name]||name, explanation] : null,
    change:v=>{
      remember('knob:'+name);
      autoChanged(stageKnobs);
      val[name]=v;
      // Computing parameters touched BY HAND are no longer replaced when an
      // image opens. By hand only: the grid knobs are not computing parameters.
      if(!CLUSTERS[cluster].grid) touched=true;
      if(name===STEP_KNOB) refreshStepShares();
      if(CLUSTERS[cluster].points) applyPoints();
      STAGES[stageKnobs-1].count_();
    }}});
  // What the program gives the knob is the value too.
  widget[name]={
    give:v=>{ oo.knob.give(v); val[name]=oo.knob.value(); },
    place:()=>{ oo.knob.place(); val[name]=oo.knob.value(); }};
  // Visibility is managed by the CLUSTER, not by a single knob: hiding both
  // would leave the knobs hidden when the cluster is shown again.
  if(!currentGroup){
    currentGroup=document.createElement('div');
    currentGroup.className='group';
    currentGroup.dataset.stage=stageKnobs;
    currentGroup.dataset.cluster=cluster;
    if(CLUSTERS[cluster].fine) currentGroup.dataset.fine='1';
    if(CLUSTERS[cluster].points) currentGroup.dataset.points='1';
    currentGroup.hidden=stageKnobs!==1 || !!CLUSTERS[cluster].points;
    $('#knobsField').appendChild(currentGroup);
  }
  currentGroup.appendChild(oo);
}
// The step moved — the knobs that live inside one cell got new limits.
function refreshStepShares(){
  for(const [name,,,,,,move] of KNOBS) if(move==='step share' && widget[name]) widget[name].place();
}
/* THE KNOBS OF STAGE 1 as the pipeline takes them. The jitter is measured by
   stage 1 or set by hand; before the first computation it is zero and only
   the tolerance floor works. */
const stage1Knobs=()=>({jitter:val['jitter'], colorTolerance:val['color tolerance'],
  noiseMultiple:val['tolerance x noise'], cap:val['tolerance cap'], overlap:val['overlap'],
  agreement:val['agreement'], placeWidth:val['spatial width'], surroundWeight:val['surround weight'],
  // A grid that is not the picture's own (marked uncertain): a detail that
  // falls between its cells is given to the cell its peak lies in.
  details:doubtShown});
/* AGREEMENT is a share of the tolerance, derived by the core from the grid
   step with the advice: few own pixels on a small cell, so neighbours are let
   in generously; a large cell is its own master. */
let agreementShare=AGREEMENT_SHARE_START;
/* ===================== core =====================
   The computing is done by Zig compiled to WebAssembly. Browsers have run
   WASM since 2017, nothing to install.
   THE CORE HAS ITS OWN THREAD (src/ui/worker.js). The page has one thread for
   the screen and the clicks; while the core computed on it, the window stood
   still. Now the page sends jobs and draws what comes back, and the window
   stays alive whatever is being computed. */
let core=null;
async function bootCore(){
  say_('coreMsg');
  // The core is embedded in the page at build time: the file stays
  // self-contained and opens with a double click. fetch would not work — the
  // browser forbids reading a neighbouring file when the page is not served.
  // For the same reason the thread is made from the page's own text: the
  // pipeline between its marks and the thread's script.
  const bin=atob(CORE_B64);
  const bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  const size_=bytes.byteLength;
  const me=document.querySelector('script[type=module]').textContent;
  const from=me.indexOf('/* PIPELINE '+'BEGINS */'), to=me.indexOf('/* PIPELINE '+'ENDS */');
  const text=me.slice(from,to).replace(/^export\s+/gm,'')+'\n'+$('#coreThread').textContent;
  const th=new Worker(URL.createObjectURL(new Blob([text],{type:'text/javascript'})));
  await new Promise((ok,fail)=>{
    th.onmessage=e=>{ if(e.data.ready) ok(); else if(e.data.failed) fail(e.data.failed); };
    th.onerror=e=>fail(e.message);
    th.postMessage({boot:bytes.buffer},[bytes.buffer]);
  });
  th.onmessage=heard;
  core=th;
  say_('ready',size_);
}
/* JOBS GO BY LANES: the grid, stage 1, stage 2, stage 3. A new job stops the
   one still running in its lane and in every lane after it — they would be
   computed from what is being replaced. A stopped job answers null, and so
   does one that finished just as it was replaced. */
const LANES=['grid','s1','s2','s3'];
const running={grid:0, s1:0, s2:0, s3:0};
const asked=new Map();   // id -> {lane, resolve, onPart}
let lastJob=0;
function stopFrom(lane){
  const drop=[];
  for(const ll of LANES.slice(LANES.indexOf(lane)))
    if(running[ll]){ drop.push(running[ll]); running[ll]=0; }
  if(drop.length) core.postMessage({drop});
}
/* Sends a job; the promise gives its answer. onPart gets what can be shown
   while it runs. */
function coreJob(lane, kind, data, give=[], onPart=null){
  if(lane) stopFrom(lane);
  const id=++lastJob;
  if(lane) running[lane]=id;
  return new Promise(resolve=>{
    asked.set(id,{lane, onPart, resolve});
    core.postMessage({id, kind, data}, give);
  });
}
function heard(e){
  const m=e.data, aa=asked.get(m.id);
  if(m.rows || m.preview){
    try{ if(aa && aa.onPart && running[aa.lane]===m.id) aa.onPart(m); }
    // drawn, not wanted or failed to draw: the next of this job may come
    finally{ core.postMessage({drawn:m.id}); }
    return;
  }
  asked.delete(m.id);
  if(!aa) return;
  if(m.error){ console.error(m.error); say_('coreError', String(m.error).split('\n')[0]); }
  let value=m.dropped ? null : m.value;
  if(aa.lane){
    if(running[aa.lane]===m.id) running[aa.lane]=0;
    else value=null;                   // replaced meanwhile
  }
  aa.resolve(value);
}
/** Gives the decoded image to the core: a copy of the page's bitmap, handed
    over whole — the thread reads its pixels itself. It stays there for as
    long as the work is open. */
function putIntoCore(bitmap,w,h){
  stopFrom('grid');
  return coreJob(null,'image',{bitmap,w,h},[bitmap]);
}
let lastMeasurements=null, adviceGiven=false, adviceAsked=false;
/** The core's advice goes into the knobs, not applied silently: the user must
    see what is used and be able to change it. It looks at the MEASUREMENTS of
    this picture — first of all the noise where paints meet — so it is possible
    only AFTER the first computation. */
async function applyAdvice(){
  const meas=lastMeasurements;
  if(!meas) return false;
  const byHand=touched;
  const ss=await coreJob(null,'advice',{step:val[STEP_KNOB], meas});
  // Late advice is dropped: another image was opened meanwhile (other
  // measurements), or a knob was set by hand while it was on its way.
  if(!ss || lastMeasurements!==meas || (touched && !byHand)) return false;
  agreementShare=ss.agreementShare;
  // if the advice already stands, touch neither the knobs nor the undo stack
  if(Math.abs(ss.colorTolerance-val['color tolerance'])<0.05 &&
     Math.abs(ss.cap-val['tolerance cap'])<0.05 &&
     Math.abs(ss.noiseMultiple-val['tolerance x noise'])<0.01 &&
     Math.abs(ss.overlap-val['overlap'])<0.01 &&
     Math.abs(ss.agreement-val['agreement'])<0.05 &&
     (ss.jitter===null || Math.abs(ss.jitter-val['jitter'])<0.05)) return false;
  remember('advice');
  if(ss.jitter!==null) widget['jitter'].give(ss.jitter);
  widget['color tolerance'].give(ss.colorTolerance);
  widget['tolerance x noise'].give(ss.noiseMultiple);
  widget['tolerance cap'].give(ss.cap);
  widget['overlap'].give(ss.overlap);
  widget['agreement'].give(ss.agreement);
  return true;
}
let stage=1;
/* THE LEFT WINDOW IS FOR LOOKING. It shows any step already passed, flipped
   with the show button or a digit. A step is a key of STEPS: '1' source,
   '2' grid, '3' pixels, '4' cluster borders, '5' clusters, '6' paint
   borders, '7' merged paints, '8' painted borders.
   One cannot look ahead: the current stage's output already stands on the
   right, and what comes later does not exist yet. */
let leftView='2';
const AVAILABLE=()=>['1','2','3','4','5','6','7','8'].filter(nn=>+nn<=stage*2);
/* What the show button flips through is set PER STAGE. Empty — all available. */
let flip={};
function showRing(){
  const avail=AVAILABLE();
  const ownOnes=(flip[stage]||avail).filter(nn=>avail.includes(nn));
  return ownOnes.length?ownOnes:avail;
}

/* THE STAGE IS STILL BEING COUNTED — waiting for the knob to settle,
   computing, or about to compute again with the advice. */
const counting=()=> stage===1 ? (!result || adviceAsked)
                  : stage===2 ? (!result2 || !!running.s2 || waitGroups!==null)
                  : stage===3 ? (!result3 || !!running.s3 || waitMerge!==null)
                  : false;
/* Only the forward button and undo/redo, for the frequent changes: a whole
   refresh on every move of a slider is too much. */
function refreshForward(){
  for(const kk of BUTTONS)
    if((kk.id_==='btnStage2'||kk.id_==='btnUndo'||kk.id_==='btnRedo') && kk.node)
      kk.node.disabled=dimmed(kk);
}
function refreshButtons(){
  for(const kk of BUTTONS){
    const el=kk.node; if(!el) continue;
    el.hidden = kk.shown ? !kk.shown() : false;
    el.disabled = dimmed(kk);
    writeLabel(kk, shownLabel(kk));
    el.classList.toggle('held', pressedNow(kk));
  }
  refreshLive();
  // An empty cluster takes no room and asks for no divider.
  for(const place of Object.values(BUTTON_PLACES))
    for(const gg of place.querySelectorAll('.group'))
      gg.hidden = ![...gg.children].some(el=>!el.hidden);
  relayout();
}

FLIP.onclick=e=>{ e.stopPropagation();
  // What goes out and comes back: the pictures, and the seam between the
  // windows — it goes with the captions' shelf, which the turn changes.
  const pics=[...document.querySelectorAll('#stages canvas')].filter(c=>c.offsetParent);
  if($('#stages')) pics.push($('#stages'));
  let left=pics.length;
  const turn=()=>{
    smoothly(()=>{
      splitByHand = !('stacked' in $('#stages').dataset);
      arrangeWindows();
      if(hasImage) fitCanvas();    // at once, not waiting for the size observer
    });
    // (the seam goes with the bar and comes back with it, on the way)
    const room=$('#stages');
    if(room) appear(room);
    whenThere($('#captionsTop'), ()=>{ for(const c of pics) if(c!==room) appear(c); });
  };
  if(!left) return turn();
  for(const c of pics) vanish(c, ()=>{ if(--left===0) turn(); });
};

OWN_LAYOUT.set($('#knobsField'), ()=>{ arrangeClusters(); alignCaptions(); });


/* The button names an ACTION, not what is shown now: the caption above the
   window says what is shown. */
function nextStep(){
  const ring=showRing();
  const i=ring.indexOf(leftView);
  return ring[(i+1)%ring.length];
}
// The show button's label and availability are computed by the button engine:
// only the name of the next step, which it uses, is left here.
/* ALL OUTPUT IN ONE REFRESH. Buttons, stage label, fine knobs, the step
   list, the paint strip, the status line and both windows are recomputed from
   the current state of the world. Any action changes the world and calls this. */
function refreshView(){ smoothly(refreshViewNow); }
function refreshViewNow(){
  // What is shown first — fine knobs, the step list, the palette and where it
  // lodges — and only then the layout, or it lays out what is about to hide.
  refreshFine();
  buildStepList();
  showPalette();
  lodgeAll();
  refreshButtons();          // and it calls relayout itself if something is to change
  arrangeWindows();
  stripEdges();   // a strip moved — another width, the shutters too
  tell();
  fitCanvas();          // the canvas by its current place, not the previous one
  redraw();             // what is shown has changed: drawn now (fitting draws only a canvas made anew)
}
const autoVisited=new Set();
/* quiet — the move is not a step of its own: undo and redo walk the history,
   a new image starts from the beginning. */
/* ASKING FIRST, from anywhere: a small window of its own (not the menu), by
   the button that asked — or in the middle, when a key asked. Yes closes it
   and acts; Cancel, a click elsewhere or Escape just close it. */
let clickedNow=null, askedAct=null;
addEventListener('click',e=>{
  clickedNow=e.target.closest ? e.target.closest('button') : null;
  setTimeout(()=>{ clickedNow=null; },0);
},true);
function askFirst(title, text, yes, act){
  const by=clickedNow, win=$('#askWin');
  // Opened on the next turn: the click that asks is still on its way up, and
  // a click outside the window closes it.
  setTimeout(()=>{
    askedAct=act;
    $('#askTitle').textContent=title; $('#askText').textContent=text; $('#askYes').textContent=yes;
    win.hidden=false;
    // Against what asked, above it; asked by nothing — in the middle of
    // the window. Its goal either way.
    if(by && by.isConnected) stickTo(win, by, 'upward');
    else placeTo(win, {rel:'window', side:'inside'});
  },0);
}
function closeAsk(){ askedAct=null; $('#askWin').hidden=true; }
function setupAsk(){
  const win=$('#askWin');
  win.addEventListener('click',e=>e.stopPropagation());
  $('#askYes').onclick=()=>{ const act=askedAct; closeAsk(); if(act) act(); };
  $('#askNo').onclick=closeAsk;
  addEventListener('click',()=>{ if(!win.hidden) closeAsk(); });
  addEventListener('keydown',e=>{ if(e.key==='Escape' && !win.hidden) closeAsk(); });
}
/* LEAVING THE PAINTING goes back to stage 3 only when confirmed: there, a
   touched knob merges the paints anew, and the painting starts over. */
function leavePainting(then){
  if(stage!==4) return then();
  askFirst('Leave painting?',
    'You go back to stage 3. Your painting stays as it is and comes back when you return — unless you change a knob of stage 3: then the paints are merged anew and the painting starts over.',
    'Go back', then);
}
// A move between stages is one trigger, whatever calls it (a button, a key,
// undo): one consequence, from where everything stood.
function toStage(nn, quiet=false){ return smoothly(()=>toStageNow(nn, quiet)); }
function toStageNow(nn, quiet=false){
  if(!quiet && nn!==stage && hasImage) remember('stage '+nn);
  stage=nn;
  // The left window gets this stage's MARKUP over its input: the grid over the
  // source, cluster borders over pixels, paint borders over clusters.
  leftView=String(nn*2);
  showGrid=(leftView==='2');
  // THE FIRST VISIT to a stage in a session starts from its automatic
  // settings, as stage 1 does on opening. Later visits keep what the hand
  // set. The auto recomputes by itself, so no computing here then.
  const firstAuto = !autoVisited.has(nn) && nn>1 && nn<4 && !quiet && !!STAGES[nn-1].auto
                    && STAGES[nn-1].auto(false)!==false;
  if(firstAuto) autoVisited.add(nn);
  if(nn===3 && !result3 && !firstAuto) ensureMerge();
  lookAt();
  if(nn===4){ if(!result3) ensureMerge(); else setupRecolor(); }   // or when the merge comes
  // Painting happens in the right window; the cursor shows the tool in hand.
  canvases[1].style.cursor = (nn===4) ? 'crosshair' : '';
  toolCursors();
  // Grid buttons on later stages are not dimmed but REMOVED: a dimmed button
  // says "not now, but in general yes", and here it is "no" — the grid is
  // already found, the work is about groups.
  if(nn!==1 && editingLines){ editingLines=false; highlight(null); }
  if(nn!==1 && points.on) pointsOff();
  // Knobs of this stage: the rest hide with their clusters; the dividers follow
  // on the next layout.
  for(const uu of document.querySelectorAll('#knobsField .group'))
    uu.hidden = +uu.dataset.stage!==nn;
  refreshView();
}
/* THE FINE KNOBS are only their clusters' visibility; the button's look is
   kept by the engine through its "pressed" field. */
function refreshFine(){
  for(const gg of document.querySelectorAll('#knobs .group[data-fine="1"]'))
    gg.hidden = !(stage===1 && fineVisible);
  refreshPoints();
}
/* THE GRID BY POINTS — a ruler. Two clicks on the source mark two crossings
   of the grid on ONE row or column, as far apart as the work allows: the
   second point is put on the line through the first, across or down, whichever
   the click is nearer to. "cells between" says how many cells the ruler
   spans; the cell size is its length over that number, the origin is the
   first point. A fractional step no slider
   finds by hand is two clicks and a count. Its knob is there only while both
   points stand (its cluster's visibility, like the fine knobs'). */
var points={on:false, a:null, b:null};
function pointsReady(){ return points.on && !!points.a && !!points.b; }
function refreshPoints(){
  for(const gg of document.querySelectorAll('#knobs .group[data-points="1"]'))
    gg.hidden = !(stage===1 && pointsReady());
}
function pointsSpan(){ return Math.abs(points.b.x-points.a.x) + Math.abs(points.b.y-points.a.y); }   // one of them is 0
function pointsCount(){ return Math.max(1, Math.round(val['cells between']||1)); }
function applyPoints(){
  if(!pointsReady()) return;
  const s=pointsSpan()/pointsCount();
  if(!(s>0)) return;
  widget[STEP_KNOB].give(s); refreshStepShares();
  const st=val[STEP_KNOB];                 // as the knob took it
  widget['origin x'].give(toCell(points.a.x, st));
  widget['origin y'].give(toCell(points.a.y, st));
}
// A tap on the source in this mode: the first point, the second, then anew.
function setPoint(hl,e){
  const dd=canvasBox(hl), {ax,ay,ssx,ssy}=visiblePart(), d=density();
  const p={x:ax+((e.clientX-dd.left)*d-ssx)/view.mm, y:ay+((e.clientY-dd.top)*d-ssy)/view.mm};
  if(!points.a || points.b){ points.a=p; points.b=null; smoothly(refreshPoints); redraw(); return; }
  // onto the ruler's line: across or down from the first point
  if(Math.abs(p.x-points.a.x)>=Math.abs(p.y-points.a.y)) p.y=points.a.y; else p.x=points.a.x;
  points.b=p;
  if(pointsSpan()<1){ points.b=null; return; }    // the same spot: no distance to divide
  remember('points'); autoChanged(1);
  // It starts from the count the grid standing now gives: the grid moves onto
  // the points, and the number is there to be corrected.
  widget['cells between'].give(Math.max(1, Math.round(pointsSpan()/currentStep())));
  applyPoints();
  smoothly(refreshPoints);
  redraw(); laterCount();
}
function pointsOff(){ points.on=false; points.a=points.b=null; refreshPoints(); }


/* A digit is a VIEW, not a move: it changes the left window, not the stage,
   so the knobs under the hand stay. A step not yet computed is computed here.
   Zero brings the left window back to the current stage's markup. */
function toStep(nn){
  const st_=STEPS[nn]; if(!st_||!hasImage) return;
  if(!AVAILABLE().includes(nn)) return;    // no looking ahead
  if(st_.prepare) st_.prepare();
  leftView=nn;
  // The grid is visible exactly on its own step — no separate button any more.
  // Line editing cannot be done blind, so it freezes with the grid.
  showGrid=(nn==='2');
  freezeEdit();
  refreshView();
}
addEventListener('keydown',e=>{
  if(e.ctrlKey||e.altKey||e.metaKey) return;
  const vv=e.target;
  if(vv && (vv.tagName==='INPUT'||vv.tagName==='TEXTAREA')) return;  // digits are typed in fields
  // Zero — back to the current stage's markup.
  if(e.key==='0'){ e.preventDefault(); toStep(String(stage*2)); return; }
  if(STEPS[e.key]){ e.preventDefault(); toStep(e.key); return; }
  if(e.key==='Delete' && stage===4){ e.preventDefault(); deletePaint(); refreshButtons(); }
});

/* THE WINDOW CHANGED. What is open keeps its goal by itself (see PLACE);
   the color window's field is measured again — it depends on the room. */
function repositionOpen(){
  const unit=$('#colorPicker');
  const mm=$('#settings');
  if(mm && !mm.hidden && mm._fitHeight) mm._fitHeight();
  if(unit && !unit.hidden && paletteAnchor && !unit.contains(document.activeElement)){
    measureColorField();
    setupColorPicker(colorTaker);
    if(unit._goal) placeAt(unit);
  }
}

hint.addEventListener('pointerenter',()=>{
  clearTimeout(leaveTimer);
  if(aimed('fade', hint)===0 && hint.classList.contains('showing')) appear(hint);
});
hint.addEventListener('pointerleave', hideHint);

attachHint(status, ()=>['Image measurements', status.dataset.measurements]);
/* Attached AFTER the buttons are placed: some of them are created from the
   BUTTONS list and do not exist in the markup before that. */
function setupHints(){
  attachHint(FLIP, HINTS.flipSplit);
  const plate=$('#name');
  attachHint(plate, HINTS.settings);
  plate.addEventListener('click',hideHint);
}

/* ===================== view ===================== */
let view={x:0,y:0,mm:6}, size={w:0,h:0}, srcBitmap=null, hasImage=false;
let showGrid=true;   // the grid lies over the source, not in a separate panel
let doubtShown=false, doubtText='';
var coherenceFound=null;
const canvases=[...document.querySelectorAll('.canvas')];
let recoloringNow=null;   // the window a stroke is being drawn over
/* A FINGER THAT NEVER CAME UP. When the page goes to the background in the
   middle of a touch (a save dialog, another app) or the window loses focus
   with the mouse held, the release never arrives. Everything held is let go
   then, or the next touch would count as a second finger. */
function dropPointers(){
  if(recoloringNow){ recoloringNow=null; endStroke(); }
  dots.clear(); pull=null; base=null; linePull=null; gridPull=null;
}
addEventListener('blur',dropPointers);
document.addEventListener('visibilitychange',()=>{ if(document.hidden) dropPointers(); });
/* No system menu on a finger's long press: that is our hint. Real text keeps
   it — fields, links, the guide, the license texts, a held hint. A right
   click with the mouse keeps the browser's menu: copying is welcome there. */
let lastPointer='mouse';
addEventListener('pointerdown',e=>{ lastPointer=e.pointerType; },true);
addEventListener('contextmenu',e=>{
  if(lastPointer!=='touch') return;
  if(!(e.target.closest && e.target.closest('input,textarea,a,#guide,#licenseText,#hint.held'))) e.preventDefault();
});
const ktx={0:$('#xx0').getContext('2d'), 2:$('#xx2').getContext('2d')};
/* The canvas takes its window's size. Only a real change is written: setting
   a canvas size clears it and takes its memory anew. */
/* THE WINDOWS COUNT IN PHYSICAL PIXELS of the screen, not in CSS ones. On a
   screen of density 2.625 (a phone) or 1.25 (Windows at 125%) a canvas sized
   in CSS pixels is stretched by the browser a second time: art cells come out
   two and three pixels wide by turns and shiver as the picture moves. So the
   canvas holds as many pixels as the screen shows there, and everything drawn
   on it — the view scale, lines, the distances a hand grabs from — is in
   those pixels. What comes from the pointer (CSS pixels) is multiplied by the
   density on the way in. */
const density=()=>window.devicePixelRatio||1;
// A line of n CSS pixels in whole screen pixels, never thinner than one.
const hair=n=>Math.max(1,Math.round(n*density()));
/* THE CANVAS IS LARGER THAN ITS WINDOW AND STANDS CENTRED IN IT: the
   window only cuts it. The picture is drawn about the canvas's middle,
   which is the window's middle — so a window that changes its size moves
   the canvas (a style). With a picture open the scale goes with the window
   (see fitCanvas), so the picture is drawn anew at each new size; with none,
   nothing is drawn. The canvas is made anew only when a window outgrows it:
   then with room to spare, a quarter more.
   Both canvases are one size (the view is one for both). */
let drawnDensity=0;
let zoomBox=null;         // the window the scale was last set against
const canvasBox=hl=>(hl.querySelector('canvas')||hl).getBoundingClientRect();
function fitCanvas(){
  const d=density();
  // The density changed under an open picture (another monitor, browser
  // zoom): the scale is in screen pixels, so it follows — the picture keeps
  // its size.
  const newDensity = d!==drawnDensity;
  /* THE SCALE IS RELATIVE TO THE WINDOW. Its limits are the window's (see
     zoomLimits); a new size of the window keeps the scale's SHARE of the way
     between them: the farthest stays the farthest, the nearest the nearest,
     and whatever lies between keeps its place on the same curve (the scale
     grows by ratio, so the share is of its logarithm). */
  const box=zoomBoxNow();
  let rescaled=false;
  if(hasImage && zoomBox && box && (box.W!==zoomBox.W || box.H!==zoomBox.H)){
    const [lo0,hi0]=zoomLimits(zoomBox), [lo1,hi1]=zoomLimits(box);
    if(lo0>0 && hi0>lo0 && hi0<Infinity && lo1>0 && hi1>lo1){
      const t=Math.max(0, Math.min(1, Math.log(view.mm/lo0)/Math.log(hi0/lo0)));
      stopView(); view.mm=lo1*Math.pow(hi1/lo1, t); rescaled=true;
    }
  }
  if(box) zoomBox=box;
  // The density changed under an open picture with the window as it was
  // (another monitor): the scale is in screen pixels, so it follows.
  if(drawnDensity && newDensity && !rescaled){ stopView(); view.mm*=d/drawnDensity; }
  drawnDensity=d;
  const boxes=[canvases[0], canvases[1]].map(hl=>{
    const dd=hl.getBoundingClientRect();
    return {w:Math.max(1,Math.floor(dd.width*d)), h:Math.max(1,Math.floor(dd.height*d)), l:dd.left*d, t:dd.top*d};
  });
  const needW=Math.max(...boxes.map(b=>b.w)), needH=Math.max(...boxes.map(b=>b.h));
  const c0=$('#xx0'), spare=v=>Math.ceil(v*STANDARD.view.spare/64)*64;
  // Twice too large (the window came back from a big screen): made anew too.
  const tooBig = c0.width>2*spare(needW) || c0.height>2*spare(needH);
  const grow = newDensity || tooBig || needW>c0.width || needH>c0.height;
  const W = grow ? (newDensity || tooBig ? spare(needW) : Math.max(c0.width, spare(needW))) : c0.width;
  const H = grow ? (newDensity || tooBig ? spare(needH) : Math.max(c0.height, spare(needH))) : c0.height;
  [0,2].forEach((i,k)=>{
    const c=$('#xx'+i);
    if(grow){ c.width=W; c.height=H; c.style.width=(W/d)+'px'; c.style.height=(H/d)+'px'; }
    // Its middle on the window's middle, on a whole screen pixel of the
    // SCREEN (the window itself may stand between two, at 125%).
    const b=boxes[k];
    c.style.left=((Math.round(b.l+(b.w-W)/2)-b.l)/d)+'px';
    c.style.top =((Math.round(b.t+(b.h-H)/2)-b.t)/d)+'px';
    // The card's sheet lies exactly over the picture.
    const o=$('#xx'+i+'b');
    if(o){
      if(o.width!==W || o.height!==H){ o.width=W; o.height=H; }
      o.style.width=c.style.width; o.style.height=c.style.height; o.style.left=c.style.left; o.style.top=c.style.top;
    }
  });
  if(grow || rescaled) redraw();
}
let pull=null, dots=new Map(), base=null, linePull=null, gridPull=null, pinchMid=null;
let editingLines=false;
let fixes={x:new Map(), y:new Map()};   // line number -> shift in pixels
let highlighting=null;                        // the line under the hand is drawn brighter than the rest
/* CELL BORDERS (pipeline: borders). Usually an even grid from step and
   origin, but every line can be moved by hand — then the cells differ, and the
   core computes with what it is given. Fixes are dropped on a new grid search
   and a new image. */
function bounds(axis,limit){
  return borders(limit, val[STEP_KNOB], val[axis==='x'?'origin x':'origin y'],
                 k=>fixes[axis].get(k)||0);
}
function lineNumber(axis,world){
  const s=val['step'], ff=val[axis==='x'?'origin x':'origin y'];
  return Math.round((world-ff)/s);
}
function linePosition(axis,k){
  const s=val['step'], ff=val[axis==='x'?'origin x':'origin y'];
  return ff+k*s+(fixes[axis].get(k)||0);
}
function resetFixes(){ fixes={x:new Map(), y:new Map()}; highlighting=null; }
/* UNDO. Not "what changed" is stored but the whole state: the knob values and
   the two maps of line fixes. Cheaper and safer than teaching every action
   (slider, field, line drag, grid drag, reset, advice) to undo itself.
   The snapshot is taken BEFORE the action. Consecutive moves of one knob
   count as one action. */
const UNDO={back:[],forward:[],whose:'',when_:0};
const STICKING=700;
/* HISTORY DEPTH is a setting (Undo steps in the menu). It is ONE limit for
   undo and redo together: no more memory is taken than set.
   A new action does not wipe the redo list: what was undone stays reachable
   with Ctrl+Y; only what does not fit the limit drops out, one record at a
   time — the farthest redo first, then the oldest undo. */
const DEPTH_MIN=10, DEPTH_MAX=1000;
let DEPTH=60;
/* A NEW STEP, as in any editor: what was undone before it is gone — redo
   would bring back a past that no longer leads here. */
/* UNSAVED: the work changed since it was last saved as a project (or opened
   as one). A trigger like the rest: every step of either history raises it —
   a new one, an undo, a redo — and saving or opening a project lowers it.
   Opening something else over unsaved changes is asked first. (The page
   keeps the open work by itself — see THE WORK IS KEPT — but only one: what
   is opened over it takes its place.) */
let unsaved=false;
function newStep(hh, auto=false){ hh.forward.length=0; if(!auto) unsaved=true; trimHistory(hh); }
function trimHistory(hh){
  while(hh.back.length+hh.forward.length>DEPTH){
    if(hh.forward.length) hh.forward.shift(); else hh.back.shift();
  }
  refreshForward();   // every new step comes through here: undo lights up
}
function recallDepth(){
  try{ const tt=+localStorage.getItem('repix.undoSteps');
       if(tt>=DEPTH_MIN && tt<=DEPTH_MAX) DEPTH=Math.round(tt); }catch(_){}
}
function saveDepth(){
  try{ localStorage.setItem('repix.undoSteps', DEPTH); }catch(_){}
}
/* A STEP of the history: the knobs, the line fixes, the stage one stands on
   and which stages have had their first visit (its automatic settings belong
   to the visit: undo the visit, and the next one brings them again). */
function capture(){
  const zz={}; for(const kk in val) zz[kk]=val[kk];
  return {val:zz, fixes:{x:new Map(fixes.x), y:new Map(fixes.y)},
          stage, visited:[...autoVisited]};
}
const sameFixes=(a,b)=>a.size===b.size && [...a].every(([k,v])=>b.get(k)===v);
function remember(whose){
  // The program's own advice is no change of the hand's: nothing to save for it.
  const tt=performance.now(), auto=/advice$/.test(whose);
  if(!auto) unsaved=true;
  if(whose===UNDO.whose && tt-UNDO.when_<STICKING){ UNDO.when_=tt; return; }
  UNDO.whose=whose; UNDO.when_=tt;
  UNDO.back.push(capture());
  newStep(UNDO, auto);
}
function goBack(ss){
  // Only a step that changed what is counted counts again: stepping back over
  // a move between stages must not recount the whole work.
  const changed=!sameFixes(ss.fixes.x,fixes.x) || !sameFixes(ss.fixes.y,fixes.y)
             || Object.keys(ss.val).some(kk=>ss.val[kk]!==val[kk]);
  fixes={x:new Map(ss.fixes.x), y:new Map(ss.fixes.y)};
  highlighting=null;
  if(changed) autoChanged(1);          // a step back or forth: what stands is no longer known to be the auto
  for(const name in ss.val) if(widget[name]) widget[name].give(ss.val[name]);
  refreshStepShares();
  autoVisited.clear(); for(const nn of ss.visited||[]) autoVisited.add(nn);
  if(ss.stage && ss.stage!==stage) toStage(ss.stage, true);
  redraw();
  if(changed) laterCount(0);
}
function undo(){
  if(!UNDO.back.length) return;
  unsaved=true;
  UNDO.forward.push(capture());
  goBack(UNDO.back.pop());
  UNDO.whose='';
}
function redo(){
  if(!UNDO.forward.length) return;
  unsaved=true;
  UNDO.back.push(capture());
  goBack(UNDO.forward.pop());
  UNDO.whose='';
}
addEventListener('keydown',e=>{
  if(!(e.ctrlKey||e.metaKey)) return;
  // in a text field Ctrl+Z belongs to the field
  if(e.target && e.target.tagName==='INPUT' && e.target.type!=='range') return;
  /* By KEY CODE, not by letter: on a Russian layout the same key gives "я". */
  const kk=e.code;
  // On stage 4 undo works on the painting: there are no knobs to undo there.
  if(kk==='KeyZ' && !e.shiftKey){ e.preventDefault(); stepBack(); }
  else if(kk==='KeyY' || (kk==='KeyZ' && e.shiftKey)){ e.preventDefault(); stepForward(); }
});
/* On stage 4 undo works on the painting first; with no strokes left it
   steps back through the knobs and the stages, like on any other stage. */
const paintBack=()=> stage===4 && RECOLOR.back.length>0;
const paintForward=()=> stage===4 && RECOLOR.forward.length>0;
function stepBack(){
  if(paintBack()){ undoRecolor(); refreshButtons(); return; }
  // With no strokes left, a step back from the painting leaves it: asked first.
  leavePainting(()=>{ undo(); refreshButtons(); });
}
function stepForward(){ if(paintForward()) redoRecolor(); else redo(); refreshButtons(); }
const canStepBack=()=> hasImage && (paintBack() || UNDO.back.length>0);
const canStepForward=()=> hasImage && (paintForward() || UNDO.forward.length>0);
/* The nearest line by ITS REAL place, not by where it would be on an even
   grid: otherwise a moved line cannot be grabbed again and lines stick. */
function nearestLine(axis,world){
  const k0=lineNumber(axis,world); let ll=k0, dd=Infinity;
  for(let k=k0-2;k<=k0+2;k++){
    const rr=Math.abs(linePosition(axis,k)-world);
    if(rr<dd){ dd=rr; ll=k; }
  }
  return {k:ll, dd};
}
function lineUnder(hl,clientX,clientY){
  if(!hasImage||!showGrid)return null;   // a hidden grid is not touched
  const dd=canvasBox(hl);
  const {ax,ay,ssx,ssy}=visiblePart();
  const d=density();
  const worldX=ax+((clientX-dd.left)*d-ssx)/view.mm, worldY=ay+((clientY-dd.top)*d-ssy)/view.mm;
  const bbx=nearestLine('x',worldX), bby=nearestLine('y',worldY);
  const kx=bbx.k, ky=bby.k;
  const ddx=bbx.dd*view.mm, ddy=bby.dd*view.mm;
  if(ddx<6*d && ddx<=ddy) return {axis:'x',k:kx};
  if(ddy<6*d) return {axis:'y',k:ky};
  return null;
}
/* THE WHOLE GRID with the right button: moving it changes both origins at
   once. Single-line fixes stay intact: they count from their place in the
   grid and travel with it. */
function dragGrid(clientX,clientY){
  if(!gridPull)return;
  // A step of the history once the grid really moves: a press alone is none.
  if(!gridPull.stepped){ remember('drag grid'); autoChanged(1); gridPull.stepped=true; }
  const s=val['step'];
  const d=density();
  const ddx=(clientX-gridPull.x)*d/view.mm, ddy=(clientY-gridPull.y)*d/view.mm;
  widget['origin x'].give(toCell(gridPull.nchx+ddx,s));
  widget['origin y'].give(toCell(gridPull.nchy+ddy,s));
  redrawSoon(true); laterCount();
}
/* A fix of ONE line is removed by double-clicking it: the line returns to its
   place on the even grid, the others stay. */
function resetLine(hl,clientX,clientY){
  const ll=lineUnder(hl,clientX,clientY);
  if(!ll || !fixes[ll.axis].has(ll.k)) return false;
  remember('reset line'); autoChanged(1);
  fixes[ll.axis].delete(ll.k);
  redraw(); laterCount();
  return true;
}
function dragLine(hl,clientX,clientY){
  if(!linePull)return;
  // A step of the history once the line really moves: a click alone is none.
  if(!linePull.stepped){ remember('drag line'); autoChanged(1); linePull.stepped=true; }
  const dd=canvasBox(hl);
  const {ax,ay,ssx,ssy}=visiblePart();
  const {axis,k}=linePull;
  const d=density();
  let world = axis==='x' ? ax+((clientX-dd.left)*d-ssx)/view.mm
                      : ay+((clientY-dd.top)*d-ssy)/view.mm;
  // no passing through a neighbour: at least a pixel always stays between lines
  const lft=linePosition(axis,k-1), rgt=linePosition(axis,k+1);
  world=Math.max(lft+1, Math.min(rgt-1, world));
  const s=val['step'], ff=val[axis==='x'?'origin x':'origin y'];
  fixes[axis].set(k, world-(ff+k*s));
  redrawSoon(true); laterCount();
}
/* THE SCALE of the view: screen pixels per picture pixel. ITS LIMITS ARE THE
   PICTURE'S OWN: the farthest — the whole picture a few times smaller than the
   window; the nearest — a few cells of the grid across the window (how many:
   STANDARD.view). A large
   picture and a small one, a coarse grid and a fine one go the same way from
   one to the other. No picture yet — no limit. */
function zoomBoxNow(){
  const hl=canvases && canvases[0], dd=hl ? hl.getBoundingClientRect() : null;
  if(!dd || !dd.width || !dd.height) return null;
  const d=density(); return {W:dd.width*d, H:dd.height*d};
}
function zoomLimits(box=zoomBoxNow()){
  if(!hasImage || !size.w || !size.h || !box) return [0, Infinity];
  const {W,H}=box;
  const whole=Math.min(W/size.w, H/size.h)/STANDARD.view.far;
  const cell=Math.max(1, +val[STEP_KNOB] || 1);
  const one=Math.min(W, H)/(cell*STANDARD.view.near);
  return [Math.min(whole, one), Math.max(whole, one)];
}
/* A scale left outside its limits by something other than the window (the
   cell's size turned) stays where it is and may only go back towards them. */
const zoomed=(mm, from=view.mm)=>{ const [lo,hi]=zoomLimits(); return Math.max(Math.min(lo, from), Math.min(Math.max(hi, from), mm)); };
/* Zoom anchored to a point: the picture point under the cursor stays under
   it after the scale changes. */
function zoomIn(hl,clientX,clientY,vo){
  const dd=hl.getBoundingClientRect();
  const sx=(clientX-dd.left-dd.width/2)*density(), sy=(clientY-dd.top-dd.height/2)*density();
  // The point under the cursor now stays under it; notches on the way add
  // up on the goal's scale.
  const underX=view.x+sx/view.mm, underY=view.y+sy/view.mm;
  const was_=viewAim().mm, mm=zoomed(was_*vo, was_);
  if(mm===was_)return;
  aimView({mm, x:underX-sx/mm, y:underY-sy/mm}, sx, sy);
}
function highlight(ll){
  const bb=highlighting;
  if((!ll&&!bb) || (ll&&bb&&ll.axis===bb.axis&&ll.k===bb.k)) return;
  highlighting=ll; redraw();
}

for(const hl of canvases){
  // lines live on the source: the result has no grid to grab
  const source = hl===canvases[0];
  // The right-click menu is never needed over our canvas. The handler sees only
  // presses on it, so it silences only itself.
  hl.addEventListener('contextmenu',e=>e.preventDefault());
  hl.addEventListener('pointerdown',e=>{
    const rule=WINDOW_TOUCH.find(rr=>rr.holds(hl,e,source));
    if(rule && rule.alone){ e.preventDefault(); rule.act(hl,e,source); return; }
    try{ hl.setPointerCapture(e.pointerId); }catch(_){}
    // The first finger of a new touch starts from nothing: a finger that
    // never came up must not turn this one into a pinch.
    if(e.isPrimary){ dots.clear(); base=null; }
    if(rule){ e.preventDefault(); rule.act(hl,e,source); pull=null; return; }
    // (the first finger of a pinch is not primary-cleared above: see the rule
    // that turns a stroke into a pinch)
    dots.set(e.pointerId,e);
    // A second finger: the pinch starts from how they stand now.
    if(dots.size===2){
      const [a,b]=[...dots.values()];
      base=Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY);
      pinchMid={x:(a.clientX+b.clientX)/2, y:(a.clientY+b.clientY)/2};
      return;
    }
    if(dots.size!==1) return;
    const ll=(editingLines&&source)? lineUnder(hl,e.clientX,e.clientY) : null;
    if(ll) highlight(ll);
    if(ll){ linePull={...ll}; pull=null; return; }   // in edit mode a line is dragged, not the picture
    // The hand takes the picture where it is drawn now, on its way or not.
    stopView();
    pull={x:e.clientX,y:e.clientY,v:{...view},trail:[{t:performance.now(),x:view.x,y:view.y}]};
  });
  hl.addEventListener('pointermove',e=>{
    if(recoloringNow===hl){ strokeAt=e; recolorTap(hl,e,false); return; }
    if(gridPull){ dragGrid(e.clientX,e.clientY); return; }
    if(dots.has(e.pointerId)) dots.set(e.pointerId,e);
    if(linePull){ dragLine(hl,e.clientX,e.clientY); return; }
    if(!pull && editingLines && source && dots.size===0){
      const ll=lineUnder(hl,e.clientX,e.clientY);
      hl.style.cursor = ll ? 'grab' : '';
      highlight(ll);
    }
    if(dots.size===2){
      pull=null;
      const [a,b]=[...dots.values()];
      const dd=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
      // Two fingers at one spot give no ratio: nothing to scale by. The point
      // between the fingers stays between them.
      const mid={x:(a.clientX+b.clientX)/2, y:(a.clientY+b.clientY)/2};
      if(base>=1 && dd>=1){
        stopView();
        const r=hl.getBoundingClientRect(), d=density(), was=pinchMid||mid;
        // The picture's point under their middle before...
        const ux=view.x+(was.x-r.left-r.width/2)*d/view.mm, uy=view.y+(was.y-r.top-r.height/2)*d/view.mm;
        view.mm=zoomed(view.mm*(dd/base));
        // ...stands under their middle now: they scale and move it.
        view.x=ux-(mid.x-r.left-r.width/2)*d/view.mm; view.y=uy-(mid.y-r.top-r.height/2)*d/view.mm;
        redrawSoon(true);
      }
      base=dd; pinchMid=mid; return;
    }
    if(!pull)return;
    const d=density();
    // Where the hand puts it; past the edge, the rubber's way.
    const raw={mm:view.mm, x:pull.v.x-(e.clientX-pull.x)*d/view.mm, y:pull.v.y-(e.clientY-pull.y)*d/view.mm};
    Object.assign(view, rubberView(raw));
    // The hand's way, for its speed when it lets go.
    const now=performance.now();
    pull.trail.push({t:now,x:view.x,y:view.y});
    while(pull.trail.length>2 && now-pull.trail[0].t>80) pull.trail.shift();
    redrawSoon(true);
  });
  const remove_=e=>{ gridPull=null;
    if(recoloringNow===hl){ recoloringNow=null; endStroke(); }
    const wasPinch=dots.size===2;
    dots.delete(e.pointerId); if(dots.size<2){ base=null; pinchMid=null; }
    // The finger left of a pinch takes the picture where it stands.
    if(wasPinch && dots.size===1 && !recoloringNow){
      const [p]=[...dots.values()];
      pull={x:p.clientX, y:p.clientY, v:{...view}, trail:[{t:performance.now(), x:view.x, y:view.y}]};
    }
    if(dots.size===0){ letGoView(pull); pull=null; linePull=null; } };
  hl.addEventListener('pointerup',remove_);
  hl.addEventListener('pointercancel',remove_);
  hl.addEventListener('lostpointercapture',remove_);
  hl.addEventListener('pointerleave',()=>{ if(!linePull) highlight(null); dwellOff(); if(!source) aimOff(); });
  hl.addEventListener('pointermove',e=>{
    if(!recoloringNow && !pull) dwellOn(hl,e); else dwellOff();
    if(!source) aimAt(hl,e);
    else if(!editingLines) hl.style.cursor = (stage===4&&tool==='pipette') ? toolCursor('pipette') : '';
  });
  hl.addEventListener('wheel',e=>{ e.preventDefault();
    zoomIn(hl,e.clientX,e.clientY,e.deltaY<0?1.15:1/1.15); },{passive:false});
  // a double click zooms in twice at the point clicked
  hl.addEventListener('dblclick',e=>{ e.preventDefault();
    // in edit mode a double click removes a line's fix instead of zooming
    if(editingLines&&source){ resetLine(hl,e.clientX,e.clientY); return; }
    zoomIn(hl,e.clientX,e.clientY,2); });
}
/* Line editing lives only while the grid is visible. Grid hidden — the mode
   is frozen, not reset: dragging moves the picture again, highlighting goes
   out. Grid shown again — everything is back as it was. */
function freezeEdit(){
  if(!showGrid) highlight(null);
}
/* Resets, from small to large:
     double click on a line — remove the fix of one line;
     "Find grid again"      — find the grid from scratch, drop all fixes;
     reopen the image       — the same plus the computing parameters. */
/* ===================== opening ===================== */
const toss=$('#toss');
addEventListener('dragover',e=>{e.preventDefault();toss.classList.add('showing');});
toss.addEventListener('dragleave',()=>toss.classList.remove('showing'));
addEventListener('drop',e=>{e.preventDefault();toss.classList.remove('showing');
  const f=e.dataTransfer.files[0]; if(f) openAny(f);});
/* JOINTS of stage 1's art (pipeline: jointsOf) — the picture's own units of
   difference, kept until the art changes. */
let joints=null;
// Told by pass 1 as it wrote the art (pass1Summary); a work brought
// back without them counts them here once.
const theJoints=()=>joints || (joints=jointUnits(artBytes,buf.width,buf.height));
/* AUTOMATIC SETTINGS of stages 2 and 3 (pipeline: groupAdvice, mergeAdvice). */
/* record=false — part of a step already taken (the first visit), not a step
   of its own. */
function autoGroups(record=true){
  if(!buf||!artBytes) return false;
  autoStands[2]=true;
  const ss=groupAdvice(buf.width,buf.height,theJoints(),lastMeasurements,val['jitter']);
  if(record) remember('group advice');
  widget['min paint'].give(ss.minPaint);
  widget['gauge'].give(ss.gauge);
  widget['cell noise'].give(ss.cellNoise);
  laterGroups();
  return true;
}
function autoPaints(record=true){
  if(!buf) return false;
  autoStands[3]=true;
  if(record) remember('paint advice');
  const sp=theSpread();
  const ss=mergeAdvice(buf.width,buf.height,sp||{S:[]});
  widget['min paint total'].give(ss.minPaintTotal);
  if(sp) widget['merge gauge'].give(ss.mergeGauge);
  laterMerge();
  return true;
}

$('#file').onchange=e=>{const f=e.target.files[0]; e.target.value=''; if(f) openAny(f);};
/* THE WORK IS KEPT. The open work lives in the browser's own store
   (IndexedDB) and comes back when the page opens again: after a closed tab, a
   reload, a crash, a phone that unloaded the page in the background. Kept:
   the source file itself, and the work's state — the knobs, the line fixes,
   the stage, the view, both histories, and the painting (the paint field,
   the paints, what is in hand). Nothing computed is kept: on return the
   stages are counted again from the same knobs, and the painting is laid on
   the merge it was made on.
   A TRIGGER, NOT A CLOCK: every change of the work ends in tell() (the status
   line) — there the keeping is asked for, and done once the hand rests a moment;
   at once when the page is hidden (a phone may not come back). */
const WORK_DB='repix', WORK_STORE='work', PROJ_STORE='projects', WORK_REST=800;
let workDb=null, workId=0, waitKeep=null, pendingPaint=null;
// The kept project this work is (saved into Repix, or opened from there): saving
// it again updates that one, not a new copy.
let projectId=null;
function openWorkDb(){
  if(!window.indexedDB) return Promise.reject();
  return workDb || (workDb=new Promise((ok,fail)=>{
    const rq=indexedDB.open(WORK_DB, 2);
    rq.onupgradeneeded=()=>{
      const db=rq.result;
      if(!db.objectStoreNames.contains(WORK_STORE)) db.createObjectStore(WORK_STORE);
      if(!db.objectStoreNames.contains(PROJ_STORE)) db.createObjectStore(PROJ_STORE);
    };
    rq.onsuccess=()=>ok(rq.result);
    rq.onerror=()=>{ workDb=null; fail(rq.error); };
  }));
}
async function workPut(key, value, store=WORK_STORE){
  try{
    const db=await openWorkDb();
    await new Promise((ok,fail)=>{
      const tx=db.transaction(store,'readwrite');
      tx.objectStore(store).put(value, key);
      tx.oncomplete=ok; tx.onerror=()=>fail(tx.error); tx.onabort=()=>fail(tx.error);
    });
    return true;
  }catch(_){ return false; }        // no store (a private window): the work lives as before
}
async function workGet(key, store=WORK_STORE){
  try{
    const db=await openWorkDb();
    return await new Promise((ok,fail)=>{
      const rq=db.transaction(store).objectStore(store).get(key);
      rq.onsuccess=()=>ok(rq.result); rq.onerror=()=>fail(rq.error);
    });
  }catch(_){ return null; }
}
async function workDrop(key, store){
  try{
    const db=await openWorkDb();
    await new Promise((ok,fail)=>{
      const tx=db.transaction(store,'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete=ok; tx.onerror=()=>fail(tx.error); tx.onabort=()=>fail(tx.error);
    });
  }catch(_){}
}
// All kept projects, newest first.
async function workAll(store){
  try{
    const db=await openWorkDb();
    const all=await new Promise((ok,fail)=>{
      const rq=db.transaction(store).objectStore(store).getAll();
      rq.onsuccess=()=>ok(rq.result||[]); rq.onerror=()=>fail(rq.error);
    });
    return all.sort((a,b)=>b.savedAt-a.savedAt);
  }catch(_){ return []; }
}
function workState(){
  return {id:workId, project:projectId, name:projName, unsaved, at:capture(), touched, adviceGiven, splitByHand,
    // What the grid search said of this work: a kept work is not searched
    // again, and its doubt would be gone with the page.
    doubt:{shown:doubtShown, text:doubtText, coherence:coherenceFound},
    view:{x:view.x, y:view.y, mm:view.mm},
    undo:{back:UNDO.back.slice(), forward:UNDO.forward.slice()},
    paint: paintsField ? {field:paintsField, colors:paintColors, alpha:paintAlpha, palette,
      back:RECOLOR.back.slice(), forward:RECOLOR.forward.slice(), chosen, copied} : null};
}
function keepWorkNow(){
  clearTimeout(waitKeep); waitKeep=null;
  if(hasImage && workId) workPut('state', workState());
}
function keepWork(){
  if(!hasImage || !workId) return;
  clearTimeout(waitKeep);
  waitKeep=setTimeout(keepWorkNow, WORK_REST);
}
addEventListener('visibilitychange',()=>{ if(document.hidden && waitKeep) keepWorkNow(); });
addEventListener('pagehide',()=>{ if(waitKeep) keepWorkNow(); });
/* THE PAINTING COMES BACK onto the merge it was made on: the same knobs and
   line fixes, the same size. On any other merge it is dropped, as a live
   painting is dropped when the merge is counted anew. */
function installPaint(pp){
  if(!pp || !buf3) return false;
  const nw=buf3.width, nh=buf3.height, at=pp.at;
  const same = pp.field.length===nw*nh && at
    && sameFixes(at.fixes.x, fixes.x) && sameFixes(at.fixes.y, fixes.y)
    && Object.keys(at.val).every(kk=>at.val[kk]===val[kk]);
  if(!same) return false;
  if(!buf4||buf4.width!==nw||buf4.height!==nh){
    buf4=sheetOf(nw,nh); bk4=buf4.getContext('2d'); bk4.imageSmoothingEnabled=false;
  }
  paintsField=pp.field; paintColors=pp.colors; palette=pp.palette; paintAlpha=pp.alpha||null;
  RECOLOR.back.length=0; RECOLOR.back.push(...pp.back);
  RECOLOR.forward.length=0; RECOLOR.forward.push(...pp.forward);
  chosen=pp.chosen; copied=pp.copied;
  writeRecolor(); refreshForward();
  return true;
}
/* THE WORK OPEN BEFORE comes back when the page opens — unless a picture came
   with the opening itself (opened with Repix). */
async function recallWork(){
  const src=await workGet('source');
  if(!src || !src.file || hasImage || opening) return;
  const st=await workGet('state');
  if(hasImage || opening) return;
  fromFile(src.file, st && st.id===src.id ? st : {id:src.id});
}
let opening=0;
async function fromFile(file, restore=null, sure=false){
  // Not before the core is up: there is nowhere to put the image yet.
  if(!core){ say_('coreMsg'); return; }
  // A painting in progress is not replaced without a word.
  if(!restore && !sure && hasImage && unsaved){
    askFirst('Not saved', 'The work open now has changes that are not saved as a project, and the new picture will take its place. To keep it, cancel and press Save — Into Repix or Project file.',
             'Open anyway', ()=>fromFile(file, null, true));
    return;
  }
  // Only the last file chosen is opened: a large one still decoding must not
  // replace a smaller one chosen after it.
  const mine=++opening;
  say_('reading');
  // Anything can be dropped on the window — an archive, text, a broken JPEG.
  // Without a catch the promise would reject silently and the status would
  // hang on "reading" forever.
  let bitmap;
  try{ bitmap=await createImageBitmap(file); }
  catch(_){ if(mine===opening) say_('notImage'); return; }
  if(mine!==opening) return;
  const copy=await createImageBitmap(bitmap);
  if(mine!==opening) return;
  // The core takes it or refuses it (too big for its memory): refused, the
  // work open before stays as it was.
  if(await putIntoCore(copy,bitmap.width,bitmap.height)!==true){
    if(mine===opening) say_('tooBig');
    return;
  }
  if(mine!==opening) return;
  srcBitmap=bitmap;
  size={w:bitmap.width,h:bitmap.height}; hasImage=true;
  // The work's own number: the kept state belongs to this source only.
  clearTimeout(waitKeep); waitKeep=null; pendingPaint=null;
  workId = restore && restore.id ? restore.id : Date.now();
  if(!restore || restore.fresh) workPut('source', {id:workId, file});
  projectId = restore && restore.project ? restore.project : null;
  projName = restore && restore.name ? restore.name : baseName(file);
  // A new picture or a project just opened: nothing unsaved yet. A kept work
  // coming back with the page comes back as it was.
  unsaved = !!(restore && !restore.fresh && restore.unsaved);
  adviceGiven=false; lastMeasurements=null; splitByHand=null; autoStands={};
  // A new image starts from the beginning: otherwise, opening a file on stage 3,
  // one would look at paints computed for the previous work.
  result=null; result2=null; result3=null; marks=null; groupPaint=null; palette=null;
  edges2=null; edges3=null;
  forgetRecolor();
  groupSpread=null; joints=null; artOcc=null;
  // The history is of the work open before: its steps must not land here.
  UNDO.back.length=0; UNDO.forward.length=0; UNDO.whose='';
  // Settings are NOT touched: what was set by hand stays for the new image
  // and across stages. Only the previous work's data is dropped. Computed
  // values come back with "Auto settings".
  if(stage!==1) toStage(1, true);
  // A hand held across the open lets go: its view was the old work's.
  pull=null; dots.clear(); base=null; pinchMid=null; linePull=null;
  if(restore && restore.splitByHand!==undefined) splitByHand=restore.splitByHand;
  // The whole work fits the window at first — the window as it splits for
  // THIS work (side by side or stacked).
  arrangeWindows();
  const dd=canvases[0].getBoundingClientRect();
  stopView();
  view={x:bitmap.width/2,y:bitmap.height/2,
       mm:Math.min(dd.width/bitmap.width,dd.height/bitmap.height)*density()};
  drawnDensity=density();   // the scale is set for the density of now
  // One common refresh instead of a handful of calls: one of them always gets
  // forgotten.
  refreshView();
  // A NEW WORK is a trigger for its pictures: they come into view.
  for(const c of document.querySelectorAll('#stages canvas')) appear(c);
  if(restore && restore.at){ restoreWork(restore); return; }
  await findGrid();
  laterCount(0);
}
/* A KEPT WORK stands again: its knobs, fixes and stage (as an undo step would
   bring them), its view and histories; the stages are counted from them, and
   the painting waits for its merge (installPaint). The advice comes only if
   it had not come yet (the page closed before it): else the knobs are the
   ones the hand left. */
function restoreWork(ss){
  touched=!!ss.touched; adviceGiven=ss.adviceGiven!==false;
  pendingPaint = ss.paint ? {...ss.paint, at:ss.at} : null;
  // The grid's doubt stands again as it was said; a work kept before it was
  // kept is asked once (the search only judges here: the lines stay).
  if(ss.doubt){ doubtShown=!!ss.doubt.shown; doubtText=ss.doubt.text||''; coherenceFound=ss.doubt.coherence??null; refreshButtons(); }
  else coreJob(null,'grid',{doubt:COHERENCE_DOUBT}).then(g=>{ if(g){ showDoubt(g.found); keepWork(); } });
  goBack(ss.at);
  if(ss.view && ss.view.mm>0){ view={x:ss.view.x, y:ss.view.y, mm:ss.view.mm}; refreshView(); }
  if(ss.undo){ UNDO.back.push(...ss.undo.back); UNDO.forward.push(...ss.undo.forward); trimHistory(UNDO); }
  laterCount(0);
}
/* ===================== grid ===================== */
/* THE DOUBT LABEL. Coherence — how well color transitions sit on the found
   lattice. Real pixel art gives 0.8..1.0 (all right grids of 27 references
   are 0.79 and above); below 0.7 transitions fit no lattice well — typical
   of neural-net "pixel" images and heavy blur. The grid is placed as usual;
   the label only asks to check it by eye. Its state is just data — whether to
   show it and what it explains; the button engine does the rest. */
const COHERENCE_DOUBT=0.7;
function showDoubt(r){
  const dd=r?r.coherence:0;
  coherenceFound = r ? dd : null;
  doubtShown = !r || dd<COHERENCE_DOUBT;
  doubtText='Color transitions sit badly on any lattice: coherence '+dd.toFixed(2)+
    ' (real pixel art gives 0.8–1.0). Looks like a neural-net image or heavy blur — check the grid by eye.';
  refreshButtons();
}
async function findGrid(){
  if(!hasImage)return;
  say_('seekingGrid');
  const g=await coreJob('grid','grid',{doubt:COHERENCE_DOUBT});
  if(!g) return;                 // another image or search took over
  const r=g.found;
  showDoubt(r);
  // No grid: the lines stay where they were, and the art the search stopped
  // is counted again on them.
  if(!r){ say_('noGrid'); laterCount(0); return; }
  resetFixes();          // line fixes are dropped: the grid is set anew
  widget[STEP_KNOB].give(r.step); widget['origin x'].give(r.ox); widget['origin y'].give(r.oy);
  refreshStepShares();   // the origins came before the step settled — fold them into a cell
  // no advice yet: measurements are born in the first pass, adjusted there
  tell();          // numbers at once, as an estimate; exact ones come when the whole canvas is done
  redraw();
  // and recompute. Otherwise "Find grid again" moved the lines while the
  // right window kept art computed on the OLD grid
  laterCount(0);
}
/* ===================== drawing ===================== */
/* ONLY WHAT THE WINDOW SHOWS IS DRAWN. A work's picture (a cell a point) laid
   whole onto a place many times the window's size is the whole of it for the
   browser to stretch — and not every browser cuts it to the window first:
   zoomed in, a big work moved like a slide show. So only the cells that fall
   into the window are given (one more on each side, for a smoothed edge);
   they land exactly where they would have. */
/* A PICTURE KEPT TO BE DRAWN FROM (a stage's art, a mask, a tint) is drawn
   from its STILL COPY. Measured in Firefox on 1700x1700 cells: drawing from an
   OffscreenCanvas copies the whole of it every time (6 ms a drawing, three a
   frame — a big work moved like a slide show whatever part was shown); from
   an ordinary canvas it is sometimes nothing and sometimes the same 6 ms, by
   the browser's own guess; from a picture that cannot change (ImageBitmap) it
   is 0.15 ms always. So a sheet is an ordinary canvas that notes when it is
   written, and once it has rested (PIC_REST) the next drawing asks for its
   still copy; from then on the drawings take the copy, until the sheet is
   written again. No timer: with nothing drawn, nothing is made. */
const PIC_REST=150;
function sheetOf(w, h){
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const x=c.getContext('2d');
  c._ver=0; c._at=performance.now();
  for(const m of ['putImageData','fillRect','clearRect','drawImage']){
    const f=x[m];
    x[m]=function(...a){ c._ver++; c._at=performance.now(); return f.apply(this, a); };
  }
  return c;
}
function stillOf(c){
  if(c._ver===undefined) return c;
  if(c._still && c._stillVer===c._ver) return c._still;
  if(!c._making && performance.now()-c._at>=PIC_REST){
    const v=c._ver; c._making=true;
    createImageBitmap(c).then(b=>{
      c._making=false;
      if(c._ver!==v){ b.close(); return; }
      if(c._still) c._still.close();
      c._still=b; c._stillVer=v;
    }, ()=>{ c._making=false; });
  }
  return c;
}
function drawCells(kk, img, nw, nh, x0, y0, wd, ht){
  const sk=wd/nw, vk=ht/nh;
  if(!(sk>0) || !(vk>0)) return;
  const W=kk.canvas.width, H=kk.canvas.height;
  const i0=Math.max(0,Math.floor(-x0/sk)-1), i1=Math.min(nw,Math.ceil((W-x0)/sk)+1);
  const j0=Math.max(0,Math.floor(-y0/vk)-1), j1=Math.min(nh,Math.ceil((H-y0)/vk)+1);
  if(i1<=i0 || j1<=j0) return;
  kk.drawImage(stillOf(img), i0,j0,i1-i0,j1-j0, x0+i0*sk, y0+j0*vk, (i1-i0)*sk, (j1-j0)*vk);
}
function visiblePart(){
  const c=$('#xx0'), ww=c.width/view.mm, vv=c.height/view.mm;
  const llx=view.x-ww/2, lly=view.y-vv/2;
  const ax=Math.max(0,Math.floor(llx)), ay=Math.max(0,Math.floor(lly));
  const bx=Math.min(size.w,Math.ceil(view.x+ww/2)), by=Math.min(size.h,Math.ceil(view.y+vv/2));
  return {ax,ay,bx,by,ssx:(ax-llx)*view.mm,ssy:(ay-lly)*view.mm};
}
/* CLUSTER BORDERS. Like the grid on stage 1, but showing what stage 2 built:
   a line runs where neighbouring cells belong to different groups. */
/* The line color comes from the colors: it is drawn on the canvas but belongs
   to the interface. */
// The colors the picture's markup is drawn with: their GOAL (a theme on its
// way is not drawn halfway into the picture).
let paletteGoal={};
const fromPalette=name=>paletteGoal[name] || getComputedStyle(document.documentElement).getPropertyValue(name).trim();
// Which of them the picture stands in now: the lines always, the held
// line's color only while a line is held.
const pictureColors=pp=>[pp['--bar'], highlighting ? pp['--highlighting'] : ''].join('|');
function toTransparency(color,share){
  const ch_=parseInt(color.slice(1),16);
  return `rgba(${ch_>>16&255},${ch_>>8&255},${ch_&255},${share})`;
}
/* THE BORDERS AS THE CORE GIVES THEM (worker: edgesOf) — with every picture
   it shows while it counts, and exactly at the end: four bytes a cell, a
   border on the right, a border below. So the borders change with the
   picture, as it is counted. edges2 — of the clusters, edges3 — of the paints. */
let edges2=null, edges3=null;
/* edges4 — of the PAINTED work (stage 4), the same picture of borders, kept
   by the page: the hand changes the paints cell by cell, so it is written
   whole when the whole work is (writeRecolor) and cell by cell with a
   stroke (writeCell) — never counted over again for a look. */
let edges4=null;
function paintBorder(k, nw, nh){
  const v=paintsField[k], i=k%nw, o=k*4;
  const r = i+1<nw && paintsField[k+1]!==v, b = k+nw<nw*nh && paintsField[k+nw]!==v;
  edges4[o]=r?255:0; edges4[o+1]=b?255:0; edges4[o+3]=(r||b)?255:0;
}
/* FROM AFAR — a cell smaller than a line can be drawn at — the borders are
   laid over the work as a picture of their own, in the markup color, scaled
   with the work: a crowd of small clusters reads as a tint, the edge of a
   large one as a line. (The tinted picture is kept for these borders and
   this color.) */
/* HOW THE BORDERS ARE DRAWN is decided by the cell on the screen:
     under 1.2 px — the picture of the borders laid over, smoothed (a tint);
     under LINES_FROM px — the same picture cell for cell, a little see-through:
        lines there would be tens of thousands of strokes a frame, for a look
        no finer than the cells themselves;
     from LINES_FROM px — hairlines between the cells, only in the window. */
const LINES_FROM=3;
function bordersLook(sk, vk){
  const c=Math.min(sk, vk)/density();
  return c<1.2 ? 'tint' : c<LINES_FROM ? 'cells' : 'lines';
}
/* The borders the core gave, as lines: consecutive ones merged into one
   stroke, only the cells in the window visited. */
function strokeBorders(kk, ed, nw, i0, i1, j0, j1, x0, y0, sk, vk){
  for(let i=i0;i<i1-1;i++){          // borders on the right, merged along a column
    const x=x0+(i+1)*sk; let beg=-1;
    for(let j=j0, o=(j0*nw+i)*4; j<j1; j++, o+=nw*4){
      if(ed[o]!==0){ if(beg<0) beg=j; }
      else if(beg>=0){ kk.moveTo(x,y0+beg*vk); kk.lineTo(x,y0+j*vk); beg=-1; }
    }
    if(beg>=0){ kk.moveTo(x,y0+beg*vk); kk.lineTo(x,y0+j1*vk); }
  }
  for(let j=j0;j<j1-1;j++){          // borders below, merged along a row
    const y=y0+(j+1)*vk; let beg=-1;
    for(let i=i0, o=(j*nw+i0)*4+1; i<i1; i++, o+=4){
      if(ed[o]!==0){ if(beg<0) beg=i; }
      else if(beg>=0){ kk.moveTo(x0+beg*sk,y); kk.lineTo(x0+i*sk,y); beg=-1; }
    }
    if(beg>=0){ kk.moveTo(x0+beg*sk,y); kk.lineTo(x0+i1*sk,y); }
  }
}
/* UP CLOSE THE BORDERS ARE DRAWN BY THE VIDEO CARD. Told as lines one by one
   they are tens of thousands of strokes a frame on a big work, and a browser
   lays every stroke out on the processor before the card sees it: the picture
   moved like a slide show. So the card is given the borders as they came — one
   picture, a cell a point — and a rule: a point of the window is a line's if it
   lies within half the line's width of a cell's edge and that cell has a
   border there. A frame costs the same whatever the number of borders. The
   lines are whole screen pixels, not smoothed: the style is pixel.
   The card draws on a sheet of its own over the left window's picture
   (assembleWindow) and the browser lays the two together: nothing the card
   drew is carried into the picture or read back from it.
   With no such card (or a work wider than it takes) the lines are stroked as
   before (strokeBorders). */
const CARD_RULE=`
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D t; uniform vec2 o, cell, grid; uniform float h, lw; uniform vec4 color;
void main(){
  vec2 p=vec2(gl_FragCoord.x, h-gl_FragCoord.y);     // the window's point, from its top left
  vec2 q=(p-o)/cell;                                 // in cells
  vec2 b=floor(q+0.5);                               // the nearest edge between cells
  vec2 d=abs(p-(o+b*cell));                          // how far from it
  vec2 c=floor(q);                                   // the cell it lies in
  float on=0.;
  if(d.x<lw*0.5 && b.x>=1. && b.x<grid.x && c.y>=0. && c.y<grid.y)
    on=max(on, texture2D(t,(vec2(b.x-1.,c.y)+0.5)/grid).r);      // a border on the right of the cell before the edge
  if(d.y<lw*0.5 && b.y>=1. && b.y<grid.y && c.x>=0. && c.x<grid.x)
    on=max(on, texture2D(t,(vec2(c.x,b.y-1.)+0.5)/grid).g);      // a border below the cell above the edge
  if(on<0.5) discard;
  gl_FragColor=color;
}`;
let card=null, cardBad=false, cardFor=null, cardRows=null, cardShown=false, cardDrew=false, cardHeard=false;
function cardReady(){
  if(cardBad) return null;
  if(card) return card.gl.isContextLost() ? null : card;
  try{
    const c=$('#xx0b');
    if(!c) throw 0;
    if(!cardHeard){
      cardHeard=true;
      // The card was taken away and given back (a driver, a sleep): set up anew.
      c.addEventListener('webglcontextlost', e=>e.preventDefault());
      c.addEventListener('webglcontextrestored', ()=>{ card=null; cardFor=null; cardShown=false; redraw(); });
    }
    // Only a real card: a browser that draws without one would run this rule
    // on the processor, point by point — slower than the strokes.
    const gl=c.getContext('webgl',{alpha:true, premultipliedAlpha:true, antialias:false, depth:false, stencil:false,
                                   preserveDrawingBuffer:true, failIfMajorPerformanceCaveat:true});
    if(!gl || gl.isContextLost()) throw 0;
    const part=(kind,text)=>{ const sh=gl.createShader(kind); gl.shaderSource(sh,text); gl.compileShader(sh);
      if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)) throw 0; return sh; };
    const prog=gl.createProgram();
    gl.attachShader(prog, part(gl.VERTEX_SHADER,'attribute vec2 a; void main(){ gl_Position=vec4(a,0.,1.); }'));
    gl.attachShader(prog, part(gl.FRAGMENT_SHADER, CARD_RULE));
    gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog,gl.LINK_STATUS)) throw 0;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const a=gl.getAttribLocation(prog,'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],
                        [gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D,k,v);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
    const u={}; for(const n of ['o','cell','grid','h','lw','color']) u[n]=gl.getUniformLocation(prog,n);
    card={c, gl, u, most:gl.getParameter(gl.MAX_TEXTURE_SIZE)}; cardFor=null; cardRows=null;
  }catch(_){ card=null; cardBad=true; }
  return card;
}
// Nothing of the card's is to be seen: its sheet is wiped.
function cardClear(){
  cardShown=false;
  if(!card || card.gl.isContextLost()) return;
  card.gl.clearColor(0,0,0,0); card.gl.clear(card.gl.COLOR_BUFFER_BIT);
}
/* Draws the borders `ed` as lines `thick` wide over the window kk; false — the
   card cannot (or it is not the left window), and the caller strokes them. The borders go to the card when
   they are other ones, and only the rows the hand changed (cardRows, see
   writeCell) when they are the same. */
function cardBorders(kk, ed, nw, nh, x0, y0, sk, vk, thick){
  if(kk!==ktx[0]) return false;
  const G=cardReady();
  if(!G || nw>G.most || nh>G.most) return false;
  const {c,gl,u}=G, W=kk.canvas.width, H=kk.canvas.height;
  if(!W || !H || W>G.most || H>G.most) return false;
  if(c.width!==W || c.height!==H){ c.width=W; c.height=H; }
  gl.viewport(0,0,W,H);
  if(cardFor!==ed){
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,nw,nh,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(ed.buffer,ed.byteOffset,nw*nh*4));
    cardFor=ed; cardRows=null;
  } else if(cardRows){
    const a=Math.max(0,cardRows[0]), b=Math.min(nh-1,cardRows[1]);
    if(b>=a) gl.texSubImage2D(gl.TEXTURE_2D,0,0,a,nw,b-a+1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(ed.buffer,ed.byteOffset+a*nw*4,(b-a+1)*nw*4));
    cardRows=null;
  }
  if(gl.isContextLost()){ cardFor=null; return false; }
  const ch_=parseInt(fromPalette('--bar').slice(1),16), al=0.9;
  gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(u.o,x0,y0); gl.uniform2f(u.cell,sk,vk); gl.uniform2f(u.grid,nw,nh);
  gl.uniform1f(u.h,H); gl.uniform1f(u.lw,Math.max(1,Math.round(thick)));
  gl.uniform4f(u.color,(ch_>>16&255)/255*al,(ch_>>8&255)/255*al,(ch_&255)/255*al,al);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  cardShown=cardDrew=true;
  return true;
}
let farFor=null, farColor='', farTint=null;
function drawBordersFar(kk, edges, nw, nh, x0, y0, wd, ht, look){
  const color=fromPalette('--bar');
  if(farFor!==edges || farColor!==color || !farTint){
    // ONE PICTURE, written anew: the borders come many times while a stage is
    // counted, and a new picture the work's size each time is memory thrown
    // away faster than it is taken back. The borders are laid in as they came
    // (their fourth byte — a border is there), then colored where they are.
    if(!farTint || farTint.width!==nw || farTint.height!==nh) farTint=sheetOf(nw,nh);
    const tt=farTint.getContext('2d');
    tt.globalCompositeOperation='source-over';
    tt.putImageData(new ImageData(edges,nw,nh),0,0);
    tt.globalCompositeOperation='source-in';
    tt.fillStyle=color; tt.fillRect(0,0,nw,nh);
    farFor=edges; farColor=color;
  }
  kk.save();
  if(look==='tint'){ kk.imageSmoothingEnabled=true; kk.imageSmoothingQuality='medium'; }
  else { kk.imageSmoothingEnabled=false; kk.globalAlpha=0.7; }
  drawCells(kk, farTint, nw, nh, x0, y0, wd, ht);
  kk.restore();
  kk.imageSmoothingEnabled=false;
}
function drawClusters(kk){
  if(!buf||!boundsField)return;
  const nw=buf.width, nh=buf.height;
  const ed = edges2 && edges2.length===nw*nh*4 ? edges2 : null;
  if(!ed && !marks) return;
  const {ax,ay,bx,by,ssx,ssy}=visiblePart();
  const {ggx,ggy}=boundsField;
  const ll=ggx[0], unit=ggx[ggx.length-1], vv=ggy[0], nn=ggy[ggy.length-1];
  const sk=(unit-ll)/nw*view.mm, vk=(nn-vv)/nh*view.mm;   // a cell on screen
  // How far lines are shown depends on the CELL on screen, not the work's size:
  // what matters is whether cells are distinguishable. On stages 2 and 3 one
  // looks at the borders, so there lines are drawn longer — down to 1.2 px per
  // cell; smaller than that, the borders are laid over as a picture.
  const look=bordersLook(sk, vk);
  if(look!=='lines'){
    if(ed) drawBordersFar(kk, ed, nw, nh, ssx+(ll-ax)*view.mm, ssy+(vv-ay)*view.mm, (unit-ll)*view.mm, (nn-vv)*view.mm, look);
    if(ed || look==='tint') return;
  }
  const onRight = k=>marks[k+1]!==marks[k], below = k=>marks[k+nw]!==marks[k];
  const x0=ssx+(ll-ax)*view.mm, y0=ssy+(vv-ay)*view.mm;
  // A hairline while cells are small; thicker only up close.
  // A bold line on a small cell eats the cell itself.
  const thick = sk<14*density() ? hair(1) : Math.min(hair(3), sk/14);
  // Only cells inside the window are visited: walking the whole grid every
  // frame made large works lag.
  const wid=(unit-ll)/nw, hgt=(nn-vv)/nh;
  const i0=Math.max(0,Math.floor((ax-ll)/wid)-1), i1=Math.min(nw,Math.ceil((bx-ll)/wid)+1);
  const j0=Math.max(0,Math.floor((ay-vv)/hgt)-1), j1=Math.min(nh,Math.ceil((by-vv)/hgt)+1);
  if(i1<=i0||j1<=j0) return;
  if(ed && cardBorders(kk, ed, nw, nh, x0, y0, sk, vk, thick)) return;
  kk.lineCap='butt';
  kk.strokeStyle=toTransparency(fromPalette('--bar'),0.9);
  kk.lineWidth=thick;
  kk.beginPath();
  if(ed){ strokeBorders(kk, ed, nw, i0, i1, j0, j1, x0, y0, sk, vk); kk.stroke(); return; }
  // Consecutive borders merge into one line: drawing a long cluster edge as
  // one segment is much cheaper than as a hundred.
  for(let i=i0;i<i1-1;i++){          // vertical borders merged along a column
    const x=x0+(i+1)*sk;
    let beg=-1;
    for(let j=j0;j<j1;j++){
      if(onRight(j*nw+i)){ if(beg<0) beg=j; }
      else if(beg>=0){ kk.moveTo(x,y0+beg*vk); kk.lineTo(x,y0+j*vk); beg=-1; }
    }
    if(beg>=0){ kk.moveTo(x,y0+beg*vk); kk.lineTo(x,y0+j1*vk); }
  }
  for(let j=j0;j<j1-1;j++){          // horizontal borders merged along a row
    const y=y0+(j+1)*vk, rr=j*nw, rr2=(j+1)*nw;
    let beg=-1;
    for(let i=i0;i<i1;i++){
      if(below(rr+i)){ if(beg<0) beg=i; }
      else if(beg>=0){ kk.moveTo(x0+beg*sk,y); kk.lineTo(x0+i*sk,y); beg=-1; }
    }
    if(beg>=0){ kk.moveTo(x0+beg*sk,y); kk.lineTo(x0+i1*sk,y); }
  }
  kk.stroke();
}

/* The source goes into ANY canvas, not only the left one: the right window
   can show steps too, and the first of them is the picture itself. */
function putSource(kk){
  if(!srcBitmap)return false;
  const {ax,ay,bx,by,ssx,ssy}=visiblePart();
  const c=kk.canvas;
  kk.setTransform(1,0,0,1,0,0); kk.clearRect(0,0,c.width,c.height);
  kk.imageSmoothingEnabled=false;
  kk.drawImage(srcBitmap,ax,ay,bx-ax,by-ay,ssx,ssy,(bx-ax)*view.mm,(by-ay)*view.mm);
  return true;
}
// A caption's words are written when they are new: the same words drawn
// again are no change of the page (its tail may be dropped, see dropTail).
function writeCaption(el, text){
  if((el.dataset.fulltext ?? el.textContent)!==text){ el.dataset.fulltext=text; el.textContent=text; }
}
function drawSource(){
  cardDrew=false;
  drawStep();
  if(cardShown && !cardDrew) cardClear();     // this step has no borders for the card
}
function drawStep(){
  // On the left — the chosen step and only it. A step knows what to draw
  // and how to caption itself; with nothing drawn, the source stands.
  let st_=STEPS[leftView];
  if(!st_ || !st_.draw(ktx[0])){
    st_=STEPS['1'];
    if(!st_.draw(ktx[0])) return;
  }
  writeCaption($('#ww0'), st_.above());
}
function drawGrid(kk){
  if(!srcBitmap)return;
  const {ax,ay,bx,by,ssx,ssy}=visiblePart();
  const s=val['step'], fx=val['origin x'], fy=val['origin y'];
  // zoomed out, lines would merge into a fill — every N-th is drawn so that
  // at least five screen pixels stay between them
  const N=Math.max(1,Math.ceil(5*density()/(s*view.mm)));
  const unitx=(bx-ax)*view.mm, unity=(by-ay)*view.mm;
  kk.save(); kk.beginPath(); kk.rect(ssx,ssy,unitx,unity); kk.clip();
  // Transparency cuts the contrast just as much, so it never goes below half.
  kk.strokeStyle=toTransparency(fromPalette('--bar'), N>1?0.55:Math.min(0.9,0.5+s*view.mm/(40*density())));
  // A line of odd width sits on the middle of a pixel, an even one between.
  const lw=hair(1), half=(lw%2)/2;
  kk.lineWidth=lw; kk.beginPath();
  let k0=Math.floor((ax-fx)/s); k0-=((k0%N)+N)%N;
  for(let k=k0; fx+k*s<=bx+s; k+=N){ const gg=linePosition('x',k); if(gg<ax||gg>bx)continue;
    const x=Math.round(ssx+(gg-ax)*view.mm)+half; kk.moveTo(x,ssy); kk.lineTo(x,ssy+unity); }
  let l0=Math.floor((ay-fy)/s); l0-=((l0%N)+N)%N;
  for(let k=l0; fy+k*s<=by+s; k+=N){ const gg=linePosition('y',k); if(gg<ay||gg>by)continue;
    const y=Math.round(ssy+(gg-ay)*view.mm)+half; kk.moveTo(ssx,y); kk.lineTo(ssx+unitx,y); }
  kk.stroke();
  // the line held or about to be grabbed — brighter and thicker than the rest,
  // drawn separately so thinning out cannot eat it
  if(highlighting){
    const {axis,k}=highlighting, gg=linePosition(axis,k);
    const lw2=hair(2), half2=(lw2%2)/2;
    kk.strokeStyle=fromPalette('--highlighting'); kk.lineWidth=lw2; kk.beginPath();
    if(axis==='x'){ if(gg>=ax&&gg<=bx){ const x=Math.round(ssx+(gg-ax)*view.mm)+half2;
      kk.moveTo(x,ssy); kk.lineTo(x,ssy+unity); } }
    else { if(gg>=ay&&gg<=by){ const y=Math.round(ssy+(gg-ay)*view.mm)+half2;
      kk.moveTo(ssx,y); kk.lineTo(ssx+unitx,y); } }
    kk.stroke();
  }
  // The points of "By points": a square at each, and the ruler between them
  // with a tick at every cell the count divides it into.
  if(points.on && points.a){
    const at=p=>[Math.round(ssx+(p.x-ax)*view.mm), Math.round(ssy+(p.y-ay)*view.mm)];
    const r=hair(4);
    kk.strokeStyle=fromPalette('--highlighting'); kk.lineWidth=hair(2);
    for(const p of [points.a, points.b]) if(p){ const [x,y]=at(p); kk.strokeRect(x-r, y-r, 2*r, 2*r); }
    if(points.b){
      const [x0,y0]=at(points.a), [x1,y1]=at(points.b);
      const n=pointsCount(), t=hair(5), across=y0===y1;
      kk.beginPath(); kk.moveTo(x0,y0); kk.lineTo(x1,y1);
      // ticks only while they stand apart: too dense, and the ruler is enough
      if(Math.hypot(x1-x0,y1-y0)/n >= hair(4))
        for(let k=1;k<n;k++){
          const x=Math.round(x0+(x1-x0)*k/n), y=Math.round(y0+(y1-y0)*k/n);
          if(across){ kk.moveTo(x,y-t); kk.lineTo(x,y+t); } else { kk.moveTo(x-t,y); kk.lineTo(x+t,y); }
        }
      kk.stroke();
    }
  }
  kk.restore();
}
/* ===== buffer of the whole art =====
   The art is computed in strips of cell rows into a buffer for the whole
   work, and showing only scales what is ready: zooming computes NOTHING, and
   the construction is visible live, strip by strip. */
let buf=null, bk=null, result=null, waiting=null, boundsField=null;
let countedTo=-1;   // the row stage 1's count has reached (its cursor, see drawArt); -1 — not counting
let bufWritten=0;   // how many times the picture's buffer was written (what depends on it asks)
let artBytes=null, buf2=null, bk2=null, result2=null, marks=null;
/* WHAT STANDS in the pictures of stages 2 and 3, as the bytes last written
   there. A new count is drawn over what the window shows — taken from here,
   never read back from the canvas: reading a canvas back brings the whole
   picture from the video card and leaves the canvas slow for good. */
let seen2=null, seen3=null;
const bytesOf=a=>new Uint8ClampedArray(a.buffer, a.byteOffset, a.byteLength);
let buf3=null, bk3=null, result3=null, groupPaint=null, palette=null;
function setupBuffer(nw,nh){
  if(buf && buf.width===nw && buf.height===nh) return;
  buf=sheetOf(nw,nh); bk=buf.getContext('2d'); bk.imageSmoothingEnabled=false;
  buf2=sheetOf(nw,nh); bk2=buf2.getContext('2d'); bk2.imageSmoothingEnabled=false;
  buf3=sheetOf(nw,nh); bk3=buf3.getContext('2d'); bk3.imageSmoothingEnabled=false;
  seen2=seen3=null;
}
/* STAGE TWO. Cells into groups, one color per group (pipeline: pass2).
   Computed from stage 1's output, not from the picture. The knobs hold numbers
   — what the work computed about itself (Auto settings) until changed by hand;
   zero means zero, not "auto". */
let clusters=null;   // colors of the clusters and the order they are met in
/* CELLS ARE RGBA. The core reads a picture with its alpha and decides how
   much of each cell is there by the rule that decides its color: every result
   comes with its own alpha, and a transparent PNG stays transparent. */
const groupKnobs=()=>({cellNoise:val['cell noise'], minPaint:val['min paint'], gauge:val['gauge']});
/* STAGE 2 IN THE CORE'S THREAD. When its result is what the right window
   shows (stage 2), the groups come back as they stand while the links are
   resolved, drawn over what the window showed, merging. A small work is done
   within the first part, and nothing flickers. */
async function computeGroups(){
  if(!artBytes||!core||!buf){result2=null;return;}
  const nw=buf.width, nh=buf.height;
  /* SEEN AS IT IS COUNTED, whenever it is looked at. Counted out of sight
     (begun on stage 1) it sends no pictures; the moment its stage is opened
     the core is told to show it (lookAt) — over the cells it began with. */
  const live=(stage===2);
  const shown=new Uint8ClampedArray(live && seen2 && seen2.length===nw*nh*4 ? seen2 : artBytes);
  const job=coreJob('s2','pass2',
    {art:artBytes, nw, nh, k:groupKnobs(), joints:theJoints(), shown, live},
    [shown.buffer],
    m=>{ bk2.putImageData(new ImageData(m.preview,nw,nh),0,0); seen2=m.preview; if(m.edges) edges2=m.edges; redraw(); });
  sayResult();
  const r=await job;
  if(!r) return;                 // replaced by a newer one
  finishGroups(r, r.msec);
}
// A stage opened while it is being counted out of sight: shown from now on.
function lookAt(){
  const id = stage===2 ? running.s2 : stage===3 ? running.s3 : 0;
  if(id) core.postMessage({look:id});
}
/* Computes what a view needs, unless it is there or on its way. */
const ensureGroups=()=>{ if(!result2 && !running.s2) computeGroups(); };
const ensureMerge=()=>{ if(!result3 && !running.s3) computeMerge(); };
function finishGroups(r, msec){
  const nw=buf.width, nh=buf.height;
  // Colors and clusters are counted where the picture is (a cluster of
  // nothing is not a cluster of the art) — in the core's thread. Its bytes
  // are laid in as they came, no copy made.
  seen2=bytesOf(r.art);
  bk2.putImageData(new ImageData(seen2,nw,nh),0,0);
  marks=r.label;
  edges2=r.edges||null; edges3=null;
  clusters=r.cc;
  result2={groupsCount:r.visible,colorsCount:r.colors,msec:msec|0,
           noise:val['cell noise'], pYa:Math.max(0.01,r.mS), pT:Math.max(0.01,r.mT)};
  groupSpread=null; result3=null; groupPaint=null; palette=null;
  // Paints are needed where they are looked at: on stages 3 and 4 and in the
  // left window from step 6 on.
  if(stage>=3 || +leftView>=6) computeMerge();
  refreshButtons(); redraw(); tell();
}
/* STAGE THREE — MERGING (pipeline: pass3). Stage 2's groups are merged into
   paints across the whole work, measured by the spread of cluster colors. */
let groupSpread=null;
const theSpread=()=>groupSpread || (clusters && result2 ? (groupSpread=spreadOf(clusters)) : null);
const mergeKnobs=()=>({mergeGauge:val['merge gauge'], neighbourStrictness:val['neighbor strictness'],
  maxDrift:val['drift from source'], neighbourDrift:val['drift from neighbors'], minPaintTotal:val['min paint total'], maxPaints:val['max paints']});
/* STAGE 3 IN THE CORE'S THREAD, like stage 2: on stage 3 the clusters are
   laid into paints, largest first, drawn over what the window showed. */
async function computeMerge(){
  if(!marks||!result2||!buf2||!core||!clusters){result3=null;return;}
  const nw=buf2.width, nh=buf2.height;
  const live=(stage===3);
  const over = live && seen3 && seen3.length===nw*nh*4 ? seen3 : seen2;      // out of sight: over the clusters
  const shown = over && over.length===nw*nh*4 ? new Uint8ClampedArray(over) : bk2.getImageData(0,0,nw,nh).data;
  const job=coreJob('s3','pass3',
    {label:marks, nw, nh, cc:clusters, k:mergeKnobs(), spread:theSpread(), shown, live},
    [shown.buffer],
    m=>{ bk3.putImageData(new ImageData(m.preview,nw,nh),0,0); seen3=m.preview; if(m.edges) edges3=m.edges; redraw(); });
  sayResult();
  const r=await job;
  if(!r) return;
  finishMerge(r, r.msec);
}
function finishMerge(r, msec){
  const nw=buf2.width, nh=buf2.height, total=nw*nh;
  seen3=bytesOf(r.art);
  bk3.putImageData(new ImageData(seen3,nw,nh),0,0);
  groupPaint=r.where; edges3=r.edges||null;
  const pal=r.palette, inPalette=pal.length/5;     // r, g, b, a, cells
  palette=[];
  // Colors are also kept by the paint's OWN number: the strip is sorted for
  // people, while cells remember the number from the core.
  paintColors=new Uint8Array(inPalette*3); paintAlpha=new Uint8Array(inPalette);
  for(let i=0;i<inPalette;i++){
    if(!(pal[i*5+4]>0)) continue;   // no cell is left behind this paint
    const r=Math.round(pal[i*5]), g=Math.round(pal[i*5+1]), b=Math.round(pal[i*5+2]), a=Math.round(pal[i*5+3]);
    paintColors[i*3]=r; paintColors[i*3+1]=g; paintColors[i*3+2]=b;
    paintAlpha[i]=a;
    palette.push({r,g,b,a,groupsCount:pal[i*5+4],nn:i});
  }
  result3={paintsCount:r.paints,msec:msec|0,mmS:r.mS,mmT:r.mT};
  // Merging rebuilt the paints — their numbers changed, and hand edits no
  // longer apply. The paint field is rebuilt from the new merge.
  resetRecolor();
  const pp=pendingPaint; pendingPaint=null;
  if(pp) installPaint(pp);
  if(stage===4 || leftView==='8') setupRecolor();
  showPalette(); lodgeAll(); stripEdges();
  refreshButtons(); redraw(); tell();
}
let waitMerge=null;
function laterMerge(){
  clearTimeout(waitMerge);
  waitMerge=setTimeout(()=>{ waitMerge=null; computeMerge(); },0);
  refreshForward(); sayResult();
}
/* A paint's color as a tile shows it: one that is not wholly there lies over
   a checker, as editors show transparency. */
function paintCss(r,g,b,a=255){
  if(a>=255) return `rgb(${r},${g},${b})`;
  const c=`rgba(${r},${g},${b},${(a/255).toFixed(3)})`;
  return `linear-gradient(${c},${c}), repeating-conic-gradient(#bbb 0 25%, #777 0 50%) 0 0 / 50% 50%`;
}
/* What a paint's tile says: its color and what stands behind it — cells of
   the picture on stage 4, clusters on stage 3. */
function paintText(kk){
  const a=kk.a===undefined ? 255 : kk.a;
  const rgb = a===0 ? 'transparent' : `${kk.r},${kk.g},${kk.b}`+(a<255 ? `, ${Math.round(a/2.55)}% there` : '');
  if(stage===4 && paintCounts)
    return paintCounts[kk.nn]>0 ? `${rgb} — ${paintCounts[kk.nn]} cells.`
                                : `${rgb} — not on the picture. Clean removes it.`;
  return kk.groupsCount>0 ? `${rgb} — ${kk.groupsCount} clusters.` : `${rgb} — added by hand.`;
}
/* THE PALETTE IN VIEW. Stage 3 is about paints, so they must be visible:
   how many and how many cells behind each. */
function showPalette(){
  const where=$('#palette'); if(!where) return;
  where.hidden = (stage!==3&&stage!==4) || !palette;
  if(where.hidden) return;
  // PALETTE ORDER — as a painter lays it out, not as the core counted: greys
  // first, dark to light (they have no hue), then colors around the hue
  // circle, and within one hue from dark to light. Hues are rounded to 15°
  // sectors, or neighbouring paints of one family scatter by lightness.
  const order=[...palette].map(kk=>({...kk, hsl:vvHSLch_(kk.r,kk.g,kk.b)}))
    .sort((a,b)=>{
      const ssa=a.hsl.S<12?0:1, ssb=b.hsl.S<12?0:1;
      if(ssa!==ssb) return ssa-ssb;                       // greys first
      if(ssa===0) return a.hsl.L-b.hsl.L;                // greys by lightness
      const tta=Math.round(a.hsl.H/15), ttb=Math.round(b.hsl.H/15);
      if(tta!==ttb) return tta-ttb;                       // colors around the circle
      return a.hsl.L-b.hsl.L;                           // within a hue by lightness
    });
  const tt=HINTS.strip, tiles=[];
  // A color copied with the pipette comes first, until it is painted with.
  if(stage===4 && copied)
    tiles.push({key:COPIED, dot:true, held:chosen===COPIED,
      color:`rgb(${copied.r},${copied.g},${copied.b})`,
      hint:()=>[tt.copied, `${copied.r},${copied.g},${copied.b} — a color held in hand, but not a paint of the palette yet.<br><br>It gets here when the picker copies a color from any picture, or when Clean removes the paint you were holding from the palette. The color stays in hand so it is not lost.<br><br>Click it to take it. The first stroke with it makes it a paint of the palette again.`],
      click:()=>{ chosen=COPIED; markChosen(); }});
  // Every paint gets a tile, however many: a paint that is not in the strip
  // cannot be taken in hand. The strip scrolls. On stage 4 the strip is not a
  // report but a set of paints: a click takes the paint in hand, and the one
  // in hand is marked. The hint reads the paint as it is now.
  for(const kk of order){
    const own=palette.find(x=>x.nn===kk.nn)||kk;
    const t={key:kk.nn, color:paintCss(kk.r,kk.g,kk.b,kk.a===undefined?255:kk.a),
             hint:()=>[stage!==4?tt.paint:tt.paintInHand, paintText(own)]};
    if(stage===4){
      t.held=kk.nn===chosen;
      t.click=()=>{ chosen=kk.nn; markChosen(); };
      t.dblclick=dd=>editPaint(kk.nn, dd);
      t.over=()=>lightPaint(kk.nn);
    }
    tiles.push(t);
  }
  if(stage===4)
    tiles.push({plus:true, hint:()=>[tt.add, tt.addText],
      click:e=>{ e.stopPropagation(); addPaint(); }});
  where.strip.fill(tiles);
}
/* PAINT BORDERS. Like cluster borders, but drawn where neighbouring cells
   have different PAINTS: one sees what stage 3 merged and what it kept. */
function drawMerged(kk){
  if(!buf2||!boundsField)return;
  const nw=buf2.width, nh=buf2.height;
  // On stage 4 the borders follow the PAINTED work (see below), not the
  // core's: the hand changes them cell by cell.
  const painted = stage===4 && !!paintsField;
  const from = painted ? edges4 : edges3;
  const ed = from && from.length===nw*nh*4 ? from : null;
  if(!ed && (!marks||!groupPaint)) return;
  const {ax,ay,bx,by,ssx,ssy}=visiblePart();
  const {ggx,ggy}=boundsField;
  const ll=ggx[0], unit=ggx[ggx.length-1], vv=ggy[0], nn=ggy[ggy.length-1];
  const sk=(unit-ll)/nw*view.mm, vk=(nn-vv)/nh*view.mm;
  const look=bordersLook(sk, vk);
  if(look!=='lines'){
    if(ed) drawBordersFar(kk, ed, nw, nh, ssx+(ll-ax)*view.mm, ssy+(vv-ay)*view.mm, (unit-ll)*view.mm, (nn-vv)*view.mm, look);
    if(ed || look==='tint') return;
  }
  const x0=ssx+(ll-ax)*view.mm, y0=ssy+(vv-ay)*view.mm;
  const wid=(unit-ll)/nw, hgt=(nn-vv)/nh;
  const i0=Math.max(0,Math.floor((ax-ll)/wid)-1), i1=Math.min(nw,Math.ceil((bx-ll)/wid)+1);
  const j0=Math.max(0,Math.floor((ay-vv)/hgt)-1), j1=Math.min(nh,Math.ceil((by-vv)/hgt)+1);
  if(i1<=i0||j1<=j0) return;
  // On stage 4 borders follow the PAINTED work, not stage 3's merge: otherwise
  // a line would stay where a paint was painted over by hand.
  const pt= painted ? (i=>paintsField[i])
                    : (i=>{ const g=marks[i]; return g<0?-1:groupPaint[g]; });
  const onRight = k=>pt(k+1)!==pt(k), below = k=>pt(k+nw)!==pt(k);
  const thick=sk<14*density()?hair(1):Math.min(hair(3),sk/14);
  if(ed && cardBorders(kk, ed, nw, nh, x0, y0, sk, vk, thick)) return;
  kk.lineCap='butt';
  // The same color as cluster borders: both are a stage's markup over its
  // input, and one knob, "Markup color", paints them.
  kk.strokeStyle=toTransparency(fromPalette('--bar'),0.9);
  kk.lineWidth=thick;
  kk.beginPath();
  if(ed){ strokeBorders(kk, ed, nw, i0, i1, j0, j1, x0, y0, sk, vk); kk.stroke(); return; }
  for(let i=i0;i<i1-1;i++){
    const x=x0+(i+1)*sk; let beg=-1;
    for(let j=j0;j<j1;j++){
      if(onRight(j*nw+i)){ if(beg<0) beg=j; }
      else if(beg>=0){ kk.moveTo(x,y0+beg*vk); kk.lineTo(x,y0+j*vk); beg=-1; }
    }
    if(beg>=0){ kk.moveTo(x,y0+beg*vk); kk.lineTo(x,y0+j1*vk); }
  }
  for(let j=j0;j<j1-1;j++){
    const y=y0+(j+1)*vk, rr=j*nw, rr2=(j+1)*nw; let beg=-1;
    for(let i=i0;i<i1;i++){
      if(below(rr+i)){ if(beg<0) beg=i; }
      else if(beg>=0){ kk.moveTo(x0+beg*sk,y); kk.lineTo(x0+i*sk,y); beg=-1; }
    }
    if(beg>=0){ kk.moveTo(x0+beg*sk,y); kk.lineTo(x0+i1*sk,y); }
  }
  kk.stroke();
}
/* An art pixel is square — that is about the work itself, not about how it
   was cut. So the result is laid out by one even stretch between the first
   and the last line. A line moved by hand changes WHAT goes into a cell, not
   the cell's shape. */
function drawArt(kk,bb){
  bb=bb||buf;
  if(!bb||!boundsField)return false;
  const {ax,ay,ssx,ssy}=visiblePart();
  const {ggx,ggy}=boundsField;
  const ll=ggx[0], unit=ggx[ggx.length-1], vv=ggy[0], nn=ggy[ggy.length-1];
  const c=kk.canvas;
  kk.setTransform(1,0,0,1,0,0); kk.clearRect(0,0,c.width,c.height); kk.imageSmoothingEnabled=false;
  drawCells(kk, bb, bb.width, bb.height,
            ssx+(ll-ax)*view.mm, ssy+(vv-ay)*view.mm,
            (unit-ll)*view.mm, (nn-vv)*view.mm);
  /* THE CURSOR OF THE COUNT. The art is counted row by row from the top and
     drawn OVER the art that stood there, so a new count of a finished picture
     looks like nothing going on. A line across it shows where the count is:
     above it — counted anew, below — still the old. In the markup color (the
     grid's), two hairs wide, on whole pixels. */
  if(bb===buf && countedTo>=0 && countedTo<bb.height){
    const lw=hair(2), y=Math.round(ssy+(vv-ay)*view.mm+countedTo*(nn-vv)*view.mm/bb.height)+(lw%2)/2;
    kk.strokeStyle=fromPalette('--bar'); kk.lineWidth=lw; kk.lineCap='butt';
    kk.beginPath(); kk.moveTo(ssx+(ll-ax)*view.mm, y); kk.lineTo(ssx+(unit-ax)*view.mm, y); kk.stroke();
  }
  return true;
}
/* THE OUTPUT OF A STAGE — its picture and the caption over it. The right
   window shows it, and Save saves it. */
function stageOutput(){
  return [()=>[buf,`pixels — ${buf?buf.width:0}×${buf?buf.height:0} cells`],
          ()=>[buf2,`clusters — ${result2?result2.groupsCount:0}`],
          ()=>[buf3,`paints — ${result3?result3.paintsCount:0}`],
          ()=>[buf4,`painted — ${paintsOnPicture()} paints, ${edits()} edits`]][stage-1]();
}
function drawResult(){
  // The right window ALWAYS shows the current stage's output: it is the
  // working window. One looks at other steps on the left.
  const [bb,caption]=stageOutput();
  if(!drawArt(ktx[2], bb))return;
  writeCaption($('#ww2'), caption);
}
/* HOLDING. The picture cannot be dragged into emptiness: half of it always
   stays in the window (or half the window, when zoomed in). */
const HOLD=0.5;
// A view kept where the picture stays in its windows.
function holdIn(v, box){
  if(!v.mm) return v;
  // The window, not the canvas: the canvas is larger and the window cuts it.
  // (Its box, when the caller has just asked for it: asked once.)
  const r=box || canvases[0].getBoundingClientRect(), d=density();
  for(const [axis,limit,side] of [['x',size.w,r.width*d],['y',size.h,r.height*d]]){
    const win=side/v.mm, edge=HOLD*Math.min(limit,win);
    const mn_=-win/2+edge, mx_=limit+win/2-edge;
    if(v[axis]<mn_) v[axis]=mn_;
    if(v[axis]>mx_) v[axis]=mx_;
  }
  return v;
}
// On its way the view is kept by its goal (see VIEW), not frame by frame.
// On its way it is kept by its goal (see VIEW); held by the hand, by the
// rubber (rubberView) — frame by frame only when it stands.
function hold(){ if(!viewFlying() && !pull) holdIn(view); }
/* PULLED PAST THE EDGE the picture gives way a little and harder the
   farther it is pulled — the scroll's stretch (STANDARD.stretch): at most
   `reach` of the window, never more than `most` lines, reached when the hand
   is twice that far out. */
function rubberView(raw){
  const r=canvases[0].getBoundingClientRect(), d=density();
  const kept=holdIn({...raw}, r), out={...kept};
  for(const [k,side] of [['x',r.width*d],['y',r.height*d]]){
    const over=(raw[k]-kept[k])*raw.mm;                 // screen pixels past the edge
    const reach=Math.min(side*STANDARD.stretch.reach, gridPixel()*d*STANDARD.line*STANDARD.stretch.most);
    if(Math.abs(over)<1e-9 || reach<=0) continue;
    const t=Math.min(1, Math.abs(over)/(2*reach));
    out[k]=kept[k]+Math.sign(over)*reach*(1-(1-t)*(1-t))/raw.mm;
  }
  return out;
}
/* THE VIEW OF THE PICTURES GOES TO ITS GOAL — one view for both windows, so
   they never part. It is on the 'view' channel as one value: the picture's
   point under the ANCHOR (where the hand is, from the window's middle, in
   screen pixels) and the log of the scale. A zoom about the cursor is a
   straight way there: the point under the cursor stays under it all the way,
   and the shift and the scale arrive together. Units are screen pixels:
   the point at the scale the flight began with, the scale as the window's
   width grows. The wheel and a double click give a goal (notches add up on
   it); the hand holds the picture under itself and, let go on the way,
   leaves it gliding (STANDARD.view.decel). The goal is kept in the
   windows; the way to it is not clamped. */
const VIEW={S:1, W:1, ax:0, ay:0, goal:null, bounce:false};
const viewFlying=()=>CHANNELS.get('view').on.has(VIEW);
const viewValue=v=>[(v.x+VIEW.ax/v.mm)*VIEW.S, (v.y+VIEW.ay/v.mm)*VIEW.S, Math.log(v.mm)*VIEW.W];
const viewOf=p=>{ const mm=Math.exp(p[2]/VIEW.W); return {mm, x:p[0]/VIEW.S-VIEW.ax/mm, y:p[1]/VIEW.S-VIEW.ay/mm}; };
channel('view', {
  least:()=>STANDARD.follow.least*gridPixel()*density(),
  // At an edge the spring is softer, as a scroll's (STANDARD.scroll.edge).
  args:()=>({dataset: VIEW.bounce ? {followDamping:STANDARD.scroll.edge} : {}}),
  read:()=>viewValue(view),
  draw:(_, p)=>{
    Object.assign(view, viewOf(p));
    // A glide that reaches the windows' edge: the spring takes it there with
    // the speed it had, and brings it back in — a bounce, not a wall.
    const g=CHANNELS.get('view').on.get(VIEW);
    if(g && g.glide){
      const kept=holdIn({...view});
      if(Math.abs(kept.x-view.x)>1e-9 || Math.abs(kept.y-view.y)>1e-9){
        // Its velocity: the glide's speed toward the glide's end.
        const from=g.value, to=g.goal, len=Math.hypot(...to.map((v,i)=>v-from[i]))||1;
        const vel=to.map((v,i)=>(v-from[i])/len*(-g.v));
        aimView(holdIn({...VIEW.goal}));
        VIEW.bounce=true;
        const back=CHANNELS.get('view').on.get(VIEW);
        if(back){
          // The new way: from here to the goal kept in the windows. Of the
          // velocity only its part along that way goes on (the axis still
          // free keeps gliding, the one past the edge turns back) — the
          // law counts the speed as the distance left GROWING.
          const d=back.goal.map((v,i)=>v-back.value[i]), dl=Math.hypot(...d)||1;
          back.v = -vel.reduce((a,v,i)=>a+v*d[i]/dl, 0);
        }
      }
    }
    redraw();
  },
  done:(_, p)=>{
    Object.assign(view, VIEW.goal || viewOf(p)); VIEW.goal=null;
    // Landed past the windows' edge (a slow frame): back in by the spring.
    const kept=holdIn({...view});
    if(Math.abs(kept.x-view.x)>1e-9 || Math.abs(kept.y-view.y)>1e-9){ aimView(kept); VIEW.bounce=true; }
    redraw();
  }});
// The goal of the view, about an anchor (ax, ay).
function aimView(to, ax=0, ay=0, o={}){
  const g=CHANNELS.get('view').on.get(VIEW);
  if(!g){ VIEW.S=view.mm; VIEW.W=Math.max(1, canvases[0].getBoundingClientRect().width*density()); }
  VIEW.ax=ax; VIEW.ay=ay; VIEW.bounce=false;
  if(g) g.value=viewValue(view);           // where it is now, about the new anchor
  // A glide's goal is where the glide ends; the edge takes it on the way (draw).
  VIEW.goal = o.glide ? {...to, mm:zoomed(to.mm)} : holdIn({...to, mm:zoomed(to.mm)});
  aim('view', VIEW, viewValue(VIEW.goal), o);
}
// The hand takes the view: its way ends where it is.
function stopView(){ CHANNELS.get('view').on.delete(VIEW); VIEW.goal=null; }
// The hand lets the picture go: with the speed it had (the last 80 ms), it
// glides on and slows, and stops where the glide ends — kept in the windows.
function letGoView(p){
  if(!p) return;
  // Let go past the edge: the spring takes it back in (softer there).
  const kept=holdIn({...view});
  if(Math.abs(kept.x-view.x)>1e-9 || Math.abs(kept.y-view.y)>1e-9){ aimView(kept); VIEW.bounce=true; return; }
  if(!p.trail || p.trail.length<2) return;
  const a=p.trail[0], b=p.trail[p.trail.length-1], dt=b.t-a.t;
  if(dt<=0 || performance.now()-b.t>80) return;           // it stood before it was let go
  const vx=(b.x-a.x)/dt, vy=(b.y-a.y)/dt, k=1/STANDARD.view.decel;
  if(Math.hypot(vx, vy)*view.mm<0.05) return;              // slower than a crawl: it stays
  aimView({mm:view.mm, x:view.x+vx*k, y:view.y+vy*k}, 0, 0, {glide:STANDARD.view.decel});
}
// Where the view is going (itself, standing).
const viewAim=()=>VIEW.goal && viewFlying() ? VIEW.goal : view;
/* DRAWN ONCE A FRAME for what the hand does over the picture. The mouse tells
   of itself many times between two frames; each word only names what must
   be drawn (the whole view, or the right window alone — the tool's aim is
   drawn there and nowhere else), and the frame draws it once. Anything that
   must stand drawn at once (a new size, a pixel to be read) calls redraw. */
let drawDue=0, drawWhole=false;
function redrawSoon(whole){
  if(whole) drawWhole=true;
  if(!drawDue) drawDue=requestAnimationFrame(()=>{
    drawDue=0;
    if(drawWhole) return redraw();
    if(!hasImage) return;
    aimNow();
    drawResult(); drawLit(ktx[2]); drawAim(ktx[2]);
    squeezeSingles('drawing');
  });
}
function redraw(){            // showing only, no computing
  if(drawDue){ cancelAnimationFrame(drawDue); drawDue=0; }
  drawWhole=false;
  if(!hasImage)return;
  hold();
  aimNow();
  drawSource(); drawResult();
  drawLit(ktx[0]); drawLit(ktx[2]); drawAim(ktx[2]);
  // Drawing sets the window captions whole — and they may not fit at once.
  // They are squeezed right away, not at the next layout pass; nothing else
  // gives way by a drawing.
  squeezeSingles('drawing');
}
/* SLIDERS ARE NOT DATA. The computation never touches them: what stands is
   what is used. Computed values go into them only on "Auto settings" — when
   asked. Opening an image and switching stages drop the previous work's data,
   not the settings.
   Only the LAST position is recomputed: while a slider is dragged,
   intermediate positions are skipped instead of queueing up. */
let waitGroups=null;
function laterGroups(){
  clearTimeout(waitGroups);
  waitGroups=setTimeout(()=>{ waitGroups=null; computeGroups(); },0);
  refreshForward(); sayResult();
}
/* recompute after a pause once turning stops */
function laterCount(delay=350){
  clearTimeout(waiting); result=null; tell(); refreshForward();
  waiting=setTimeout(compute,delay);
}
async function compute(){
  if(!hasImage||!core)return;
  const ggx=bounds('x',size.w), ggy=bounds('y',size.h);
  const nw=ggx.length-1, nh=ggy.length-1;
  if(nw<1||nh<1)return;
  boundsField={ggx,ggy};
  // The new rows are drawn OVER the previous art, not onto a cleared window:
  // the picture changes where it changes. Only a new count of cells (a new
  // buffer) starts from empty.
  setupBuffer(nw,nh);
  countedTo=0;                   // counting begins: the cursor stands at the top
  drawResult(); tell();
  /* THE ART GROWS ON SCREEN: the rows done so far come from the core's
     thread as it goes. A newer computation (a knob moved) replaces this one. */
  const r=await coreJob('s1','pass1',
    {gx:ggx, gy:ggy, k:stage1Knobs(), share:agreementShare}, [],
    m=>{ const {from,to,rgba}=m.rows; bk.putImageData(new ImageData(rgba,nw,to-from),0,from); bufWritten++; countedTo=to; redraw(); });
  if(!r) return;                 // the newer one takes over (its cursor is at the top already)
  countedTo=-1;                  // counted: no cursor
  if(r.code===2){ redraw(); say_('winTooBig'); return; }
  if(r.code!==1){ redraw(); say_('noCells'); return; }
  lastMeasurements=r.meas;
  // The whole art at once: rows a busy screen did not take are in it too.
  // What is counted of it (colors, the bins of color, the joints) was
  // counted in the core's thread: the page only lays it in.
  artOcc=r.occ; joints=r.joints;
  bk.putImageData(new ImageData(bytesOf(r.art),nw,nh),0,0); bufWritten++;
  drawResult();
  result={nw,nh,colorsCount:r.colors,msec:r.msec|0};   // computing, not waiting
  // Cells are recomputed — the automatic markup color has something to look at,
  // and the line color is fitted to this work right now if it is on.
  if(colors.auto) applyColors();
  artBytes=r.art;
  // Measurements are ready — ask for advice FIRST: only if the knobs were not
  // touched by hand, and only once per image. It goes to the core before
  // stage 2, or it would wait behind the whole of it. When it counts the art
  // again, stage 2 waits for that count.
  if(!touched && !adviceGiven){
    adviceGiven=true; adviceAsked=true; autoStands[1]=true; refreshButtons(); refreshForward();
    const again=await applyAdvice();
    adviceAsked=false;
    if(again){ laterCount(0); refreshForward(); return; }
  }
  computeGroups();
  if(stage!==1) drawResult();
  tell();
  refreshForward();
}
/* THE TOP LINE IS A RESULT, NOT A DASHBOARD. What matters on each stage is
   what came out: the art size, how many paints, how long it took. The
   measurements are instrument readings; they live in the hint of this line. */
/* PROGRESS MESSAGES ARE DATA: they are kept together here, and the code calls
   them by name. */
const MESSAGES={
  coreMsg:      ()=>'loading core…',
  ready:    bb=>`ready (core ${bb} bytes) — open or drop an image`,
  coreFailed: e=>'core failed to start: '+e,
  reading:     ()=>'reading image…',
  notImage:()=>'cannot read this file — is it an image?',
  notProject:()=>'cannot read this project file',
  projSaved: nn=>`project saved: ${nn}`,
  seekingGrid:  ()=>'looking for grid…',
  noGrid:  ()=>'no grid found',
  winTooBig:()=>'cannot: cell window too large — reduce the overlap',
  noCells: ()=>'this grid yields no cells',
  tooBig:  ()=>'this image is too large for the memory here',
  coreError: t=>'the core could not do it: '+t,
};
const say_=(name,...dd)=>{ status.textContent=MESSAGES[name](...dd); squeezeSingles(); };
/* What the stage came to — and, while it is counted anew, that it is: the
   numbers of the count before stand until the new ones come. */
function sayResult(){
  if(!hasImage) return;
  const ch_=[...currentStage().result()];
  if(counting() && !ch_.includes('computing…')) ch_.push('computing…');
  const text=ch_.join('  ·  ');
  if(status.textContent===text) return;
  status.textContent=text;
  // The status line takes no part in the group layout — it is a single and
  // squeezes itself.
  squeezeSingles();
}
function tell(){
  // Without a work there is no result to tell: the status keeps its message
  // ("ready — open or drop an image", or why the file could not be read).
  if(!hasImage) return;
  keepWork();                  // whatever changed the work ends here: it is kept
  sayResult();
  // Measurements go to the hint, with the step, tolerance, gauges and cell
  // noise.
  const unit=[];
  unit.push(`Source ${size.w}×${size.h}, grid cell ${val['step'].toFixed(4)}`+
            (coherenceFound===null ? '.' : `, coherence ${coherenceFound.toFixed(2)} — how well the color transitions sit on this grid (real pixel art gives 0.8–1.0; under ${COHERENCE_DOUBT} the grid is marked uncertain).`));
  if(lastMeasurements && lastMeasurements[4]>0){
    unit.push(`Jitter ${lastMeasurements[9].toFixed(1)} — how much color jumps inside a cell: compression noise. Tolerance ${tolerance(stage1Knobs()).toFixed(1)} comes out of it, and agreement ${agreement(stage1Knobs(),agreementShare).toFixed(1)} out of the cell size.`,
           `Inside ${lastMeasurements[10].toFixed(1)}, edge ${lastMeasurements[11].toFixed(1)} — the same noise measured apart: in the pixels off the cell border, and how far the border pixels stand from them (ringing, what bleeds in from the neighbors). Only measured for now.`,
           `Slope ${lastMeasurements[8].toFixed(1)} — how far the color creeps from one edge of a cell to the other: that is blur.`,
           `Seams ${(lastMeasurements[7]*100).toFixed(0)}% — the share of cells whose neighbor is a different paint.`,
           `Gap ${lastMeasurements[2].toFixed(1)} — how far paints diverge at those seams.`,
           `Closest paints ${lastMeasurements[6].toFixed(1)} — how close two DIFFERENT paints of the work come together. That is the ceiling for the tolerance.`);
  }
  if(result2) unit.push(`Stage 2: cell noise ${result2.noise.toFixed(2)}, yardstick ${result2.pYa.toFixed(1)} in lightness and ${result2.pT.toFixed(1)} in hue — medians of the differences between neighboring cells of this work.`);
  if(result3) unit.push(`Stage 3: yardstick ${result3.mmS.toFixed(1)} / ${result3.mmT.toFixed(1)} — differences between group colors.`);
  status.dataset.measurements = unit.join('<br>');
}
/* ===================== STAGE FOUR — PAINTING =====================
   The algorithms did what they could. Now the eye works: one cell went into
   the wrong paint, one highlight merged with the background. Knobs cannot fix
   that — a knob moves the WHOLE work, while one spot is spoiled.

   A cell remembers not a color but a PAINT NUMBER. So painting stays
   painting: the palette is the work's paints, plus paints added on purpose —
   copied with the pipette, created with "+". Fill follows cells of ONE paint,
   not similar colors: similarity was decided earlier. */
let buf4=null, bk4=null, paintsField=null, paintColors=null;
/* How much of each paint is there, by its number, beside paintColors: a paint
   of a transparent PNG's background is a paint of nothing — painting with it
   erases. Paints taken or added by hand are wholly there. */
let paintAlpha=null;
const alphaOf=nn=>paintAlpha && nn<paintAlpha.length ? paintAlpha[nn] : 255;
function growAlpha(nn){
  const grown=new Uint8Array(nn+1).fill(255);
  if(paintAlpha) grown.set(paintAlpha.subarray(0, Math.min(paintAlpha.length, nn)));
  paintAlpha=grown;
}
/* How many cells each paint has NOW, with all edits. Used for "Clean", the
   captions and the tiles' hints. */
let paintCounts=null;
// How many paints are on the picture now.
const paintsOnPicture=()=>!palette?0:(!paintCounts?palette.length:palette.filter(kk=>paintCounts[kk.nn]>0).length);
// The tool in hand and the paint in hand.
let tool='brush', chosen=-1;
/* A COPIED COLOR. The pipette takes a color from any picture — the source,
   any step on the left, the result. If the work already has that paint, it
   goes into the hand. If not, the color lies "copied" and becomes a paint of
   the work with the first stroke. */
const COPIED=-2;
let copied=null;
/* The lit paint: hovered in the strip — its area is shown on the picture. */
let litPaint=-1, litMask=null, litFor=-1;
/* Painting has its own undo. The general one stores a snapshot of all knobs;
   for a stroke that is pointlessly expensive. Here only what was touched is
   stored: which cells and what was in them. */
const RECOLOR={back:[],forward:[]};
let strokeK=null, strokeB=null;
const edits=()=>RECOLOR.back.length;

function resetRecolor(){
  paintsField=null; edges4=null;
  RECOLOR.back.length=0; RECOLOR.forward.length=0;
  strokeK=null; strokeB=null;
}
function forgetRecolor(){ resetRecolor(); paintColors=null; paintAlpha=null; }
function setupRecolor(){
  if(!buf3||!marks||!groupPaint||!palette||!palette.length) return false;
  const nw=buf3.width, nh=buf3.height, total=nw*nh;
  if(!buf4||buf4.width!==nw||buf4.height!==nh){
    buf4=sheetOf(nw,nh); bk4=buf4.getContext('2d');
    bk4.imageSmoothingEnabled=false;
  }
  if(paintsField && paintsField.length===total) return true;   // already painted — do not trample
  paintsField=new Int32Array(total);
  for(let k=0;k<total;k++){
    const gg=marks[k];
    paintsField[k] = (gg<0) ? -1 : groupPaint[gg];
  }
  RECOLOR.back.length=0; RECOLOR.forward.length=0;
  if(chosen<0 || chosen>=paintColors.length/3) chosen=palette[0].nn;
  writeRecolor();
  return true;
}
function writeRecolor(){
  if(!buf4||!paintsField) return;
  const nw=buf4.width, nh=buf4.height, total=nw*nh;
  const frame=new ImageData(nw,nh);
  paintCounts=new Int32Array(paintColors.length/3);
  for(let k=0,o=0;k<total;k++,o+=4){
    const pt=paintsField[k];
    if(pt<0) continue;                       // outside the work — transparent
    paintCounts[pt]++;
    frame.data[o]=paintColors[pt*3]; frame.data[o+1]=paintColors[pt*3+1];
    frame.data[o+2]=paintColors[pt*3+2]; frame.data[o+3]=alphaOf(pt);
  }
  bk4.putImageData(frame,0,0);
  litFor=-1; aimFor=-1;
  edges4=new Uint8ClampedArray(total*4);
  for(let k=0;k<total;k++) paintBorder(k, nw, nh);
}
/* Which cell is under the cursor: the inverse of how the result is laid on
   screen — between the first and last grid line, in equal shares. */
function cellUnder(hl,clientX,clientY){
  if(!boundsField||!buf4) return -1;
  const dd=canvasBox(hl);
  const {ax,ay,ssx,ssy}=visiblePart();
  const {ggx,ggy}=boundsField;
  const ll=ggx[0], unit=ggx[ggx.length-1], vv=ggy[0], nn=ggy[ggy.length-1];
  const nw=buf4.width, nh=buf4.height;
  const d=density();
  const mx=ax+((clientX-dd.left)*d-ssx)/view.mm, my=ay+((clientY-dd.top)*d-ssy)/view.mm;
  const i=Math.floor((mx-ll)/((unit-ll)/nw)), j=Math.floor((my-vv)/((nn-vv)/nh));
  if(i<0||j<0||i>=nw||j>=nh) return -1;
  return j*nw+i;
}
/* ONE CELL WRITTEN: the picture's buffer and the paints' counts take the one
   cell that changed — the whole work is written only when the whole of it
   may have changed (writeRecolor). */
function writeCell(k, was){
  const pt=paintsField[k];
  if(!buf4 || !paintCounts || pt>=paintCounts.length || was>=paintCounts.length){ writeRecolor(); return; }
  if(was>=0) paintCounts[was]--;
  if(pt>=0) paintCounts[pt]++;
  const nw=buf4.width, i=k%nw, j=(k-i)/nw, one=new ImageData(1,1);
  if(pt>=0){ one.data[0]=paintColors[pt*3]; one.data[1]=paintColors[pt*3+1]; one.data[2]=paintColors[pt*3+2]; one.data[3]=alphaOf(pt); }
  bk4.putImageData(one, i, j);
  litFor=-1; aimFor=-1;
  // Its borders: its own, and those of the cell to its left and the one above
  // (theirs are the borders with it).
  if(edges4 && edges4.length===nw*buf4.height*4){
    paintBorder(k, nw, buf4.height);
    if(i>0) paintBorder(k-1, nw, buf4.height);
    if(j>0) paintBorder(k-nw, nw, buf4.height);
    if(farFor===edges4) farFor=null;          // the picture of them laid from afar is made anew
    if(cardFor===edges4){                     // and the card takes these rows anew
      const a=Math.max(0,j-1);
      cardRows = cardRows ? [Math.min(cardRows[0],a), Math.max(cardRows[1],j)] : [a,j];
    }
  }
}
function put(k){            // one stroke into one cell
  if(chosen<0||paintsField[k]<0||paintsField[k]===chosen) return false;
  strokeK.push(k); strokeB.push(paintsField[k]);
  paintsField[k]=chosen;
  return true;
}
/* THE AREA of a cell: every cell of the same paint reachable from it by
   side steps. A mask over the whole field; the fill and its preview both
   use it. */
function regionOf(k){
  const nw=buf4.width, nh=buf4.height, was_=paintsField[k];
  const region=new Uint8Array(nw*nh), stack=[k];
  region[k]=1;
  while(stack.length){
    const c=stack.pop(), i=c%nw, j=(c-i)/nw;
    for(const s of [i>0?c-1:-1, i+1<nw?c+1:-1, j>0?c-nw:-1, j+1<nh?c+nw:-1])
      if(s>=0 && !region[s] && paintsField[s]===was_){ region[s]=1; stack.push(s); }
  }
  return region;
}
function floodFill(k){
  const was_=paintsField[k];
  if(was_<0||was_===chosen) return false;
  const region=regionOf(k);
  for(let c=0;c<region.length;c++) if(region[c]) put(c);
  return true;
}
function takePaint(k){
  if(paintsField[k]<0) return;
  chosen=paintsField[k];
  markChosen();
  $('#palette').strip.show(chosen);   // taken from the picture: shown in the middle
}
/* What is in hand is marked in place, without rebuilding the strip. */
function markChosen(){
  $('#palette').strip.mark('held', chosen);
  refreshButtons();   // Delete dims and lights up by what is in hand
}
/* A color from the screen — exactly the pixel visible in the window: the
   source, a step on the left, the result on the right. */
/* The color of exactly the pixel visible under the pointer, or null outside
   the work. */
function pixelAt(hl,e){
  const cv=hl.tagName==='CANVAS'?hl:hl.querySelector('canvas'); if(!cv) return null;
  const r=cv.getBoundingClientRect();
  const x=Math.floor((e.clientX-r.left)*cv.width/r.width);
  const y=Math.floor((e.clientY-r.top)*cv.height/r.height);
  const dd=cv.getContext('2d').getImageData(x,y,1,1).data;
  return dd[3]===0 ? null : [dd[0],dd[1],dd[2]];
}
function copyFromScreen(hl,e){
  const px=pixelAt(hl,e);
  if(!px) return;                          // outside the work — nothing to take
  const [rr,gg,bb]=px;
  const own=palette&&palette.find(kk=>paintColors[kk.nn*3]===rr
    &&paintColors[kk.nn*3+1]===gg&&paintColors[kk.nn*3+2]===bb);
  if(own){ copied=null; chosen=own.nn; }
  else   { copied={r:rr,g:gg,b:bb}; chosen=COPIED; }
  showPalette();
}
/* The first stroke with a copied color makes it a paint of the work. */
function adoptCopied(){
  if(chosen!==COPIED||!copied) return;
  const nn=paintColors.length/3;
  const grown=new Uint8Array(paintColors.length+3);
  grown.set(paintColors);
  grown[nn*3]=copied.r; grown[nn*3+1]=copied.g; grown[nn*3+2]=copied.b;
  paintColors=grown; growAlpha(nn);
  palette.push({r:copied.r,g:copied.g,b:copied.b,a:255,groupsCount:0,nn});
  strokeAdopted={nn, rgb:[copied.r,copied.g,copied.b]};   // if the stroke is undone, the paint goes too
  chosen=nn; copied=null;
  showPalette();
}
let strokeAdopted=null;
/* A paint's color in one place: both editing and undoing go through here. */
function setPaintRGB(nn, rgb, a){
  rgb.forEach((v,i)=>paintColors[nn*3+i]=v);
  if(a!==undefined && a!==alphaOf(nn)){
    if(!paintAlpha || nn>=paintAlpha.length) growAlpha(Math.max(nn, paintAlpha?paintAlpha.length:0));
    paintAlpha[nn]=a;
  }
  const kk=palette.find(x=>x.nn===nn);
  if(kk){ kk.r=rgb[0]; kk.g=rgb[1]; kk.b=rgb[2]; kk.a=alphaOf(nn); }
  const tile=$('#palette').strip.tile(nn);
  if(tile) paintTile(tile, paintCss(rgb[0],rgb[1],rgb[2],alphaOf(nn)));
  litFor=-1;
  keepWork();
}
/* EDITING A PAINT — double-click it in the strip. The same window as for the
   interface colors, but its target is a paint: its color changes everywhere
   it lies. */
function editPaint(nn, tile){
  const hex=()=>'#'+[0,1,2].map(i=>paintColors[nn*3+i].toString(16).padStart(2,'0')).join('');
  const rgbNow=()=>[0,1,2].map(i=>paintColors[nn*3+i]);
  // The color slider moves in dozens of steps — in history it is one edit:
  // however long it is turned, undo returns the color from before opening,
  // and how much of it was there.
  let recorded=false;
  const record=()=>{
    if(recorded) return;
    RECOLOR.back.push({color:nn, bb:rgbNow(), aa:alphaOf(nn)});
    newStep(RECOLOR); recorded=true;
  };
  const done=()=>{ writeRecolor(); redraw(); tell(); };
  openColorPicker({
    get:hex,
    set:cc=>{
      const tt=parseInt(cc.slice(1),16);
      record();
      setPaintRGB(nn, [(tt>>16)&255,(tt>>8)&255,tt&255]);
      done();
    },
    alpha:{
      get:()=>alphaOf(nn),
      set:a=>{ if(a===alphaOf(nn)) return; record(); setPaintRGB(nn, rgbNow(), a); done(); }
    }}, tile);
}
/* DELETING A PAINT. All its cells go to the CLOSEST remaining paint on the
   picture, and that paint goes into the hand; the deleted one stays in the
   strip, empty, until Clean. Closeness is measured in Lab, as the eye sees it, not by RGB
   numbers. It is an ordinary edit: Ctrl+Z brings everything back. */
function toLab(r,g,b){
  const lin=v=>{ v/=255; return v<=0.04045 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); };
  const R=lin(r), G=lin(g), B=lin(b);
  const X=(R*0.4124+G*0.3576+B*0.1805)/0.95047, Y=R*0.2126+G*0.7152+B*0.0722,
        Z=(R*0.0193+G*0.1192+B*0.9505)/1.08883;
  const f=t=>t>0.008856 ? Math.cbrt(t) : 7.787*t+16/116;
  return [116*f(Y)-16, 500*(f(X)-f(Y)), 200*(f(Y)-f(Z))];
}
function canDeletePaint(){
  if(stage!==4||!paintsField||!paintCounts||chosen<0) return false;
  let others=0;
  for(const kk of palette) if(kk.nn!==chosen && paintCounts[kk.nn]>0) others++;
  return paintCounts[chosen]>0 && others>0;
}
function deletePaint(){
  if(!canDeletePaint()) return;
  const nn=chosen;
  const lab=toLab(paintColors[nn*3],paintColors[nn*3+1],paintColors[nn*3+2]);
  let best=-1, bestD=Infinity;
  for(const kk of palette){
    if(kk.nn===nn || !(paintCounts[kk.nn]>0)) continue;
    const q=toLab(paintColors[kk.nn*3],paintColors[kk.nn*3+1],paintColors[kk.nn*3+2]);
    const dd=(q[0]-lab[0])**2+(q[1]-lab[1])**2+(q[2]-lab[2])**2;
    if(dd<bestD){ bestD=dd; best=kk.nn; }
  }
  if(best<0) return;
  startStroke();
  for(let k=0;k<paintsField.length;k++)
    if(paintsField[k]===nn){ strokeK.push(k); strokeB.push(nn); paintsField[k]=best; }
  chosen=best;
  writeRecolor();
  endStroke();
}
/* A NEW PAINT — the plus at the end of the strip. It appears at once with the
   color in hand, goes into the hand, and the color window opens for it. */
function addPaint(){
  if(stage!==4||!paintColors) return;
  const hand = chosen===COPIED&&copied ? [copied.r,copied.g,copied.b]
             : chosen>=0 ? [0,1,2].map(i=>paintColors[chosen*3+i]) : [128,128,128];
  const nn=paintColors.length/3;
  const grown=new Uint8Array(paintColors.length+3);
  grown.set(paintColors); grown.set(hand, nn*3);
  paintColors=grown; growAlpha(nn);
  palette.push({r:hand[0],g:hand[1],b:hand[2],a:255,groupsCount:0,nn});
  RECOLOR.back.push({paletteAdd:[{r:hand[0],g:hand[1],b:hand[2],a:255,groupsCount:0,nn}]});
  newStep(RECOLOR);
  chosen=nn; copied=null;
  writeRecolor(); showPalette(); refreshButtons(); tell();
  const tile=$('#palette').strip.tile(nn);
  if(tile) editPaint(nn, tile);
}
/* CLEANING — only on the button. Paints lying in no cell of the picture go
   away. The strip does not hide them by itself: a paint covered by accident
   must not vanish from under the hand. */
function unusedPaints(){
  if(stage!==4||!palette||!paintCounts) return [];
  return palette.filter(kk=>!(paintCounts[kk.nn]>0));
}
function cleanPalette(){
  const gone=unusedPaints(); if(!gone.length) return;
  palette=palette.filter(kk=>paintCounts[kk.nn]>0);
  RECOLOR.back.push({paletteClean:gone});
  newStep(RECOLOR);
  if(chosen>=0 && gone.some(kk=>kk.nn===chosen)){
    // The paint in hand went away — its color stays in hand as a copied one.
    copied={r:paintColors[chosen*3], g:paintColors[chosen*3+1], b:paintColors[chosen*3+2]};
    chosen=COPIED;
  }
  showPalette(); refreshButtons(); tell();
}
/* SHOWING AN AREA. Everything that is not this paint is shaded; the paint
   itself stays as it is. The mask is computed once per paint. */
function lightPaint(nn){
  if(litPaint===nn) return;
  litPaint=nn; redraw();
}
function drawLit(kk){
  if(stage!==4||litPaint<0||!paintsField||!buf4||!boundsField) return;
  const nw=buf4.width, nh=buf4.height;
  if(litFor!==litPaint || !litMask || litMask.width!==nw || litMask.height!==nh){
    litMask=sheetOf(nw,nh);
    const frame=new ImageData(nw,nh);
    for(let k=0,o=0;k<nw*nh;k++,o+=4)
      if(paintsField[k]!==litPaint){ frame.data[o+3]=150; }
    litMask.getContext('2d').putImageData(frame,0,0);
    litFor=litPaint;
  }
  const {ax,ay,ssx,ssy}=visiblePart();
  const {ggx,ggy}=boundsField;
  const ll=ggx[0], unit=ggx[ggx.length-1], vv=ggy[0], nn=ggy[ggy.length-1];
  kk.imageSmoothingEnabled=false;
  drawCells(kk, litMask, nw, nh,
            ssx+(ll-ax)*view.mm, ssy+(vv-ay)*view.mm,
            (unit-ll)*view.mm, (nn-vv)*view.mm);
}
/* THE CURSOR IS THE TOOL ITSELF, as in Paint: a pen, a bucket, a pipette.
   Drawn in cells and scaled with the grid pixel like everything else; each
   one's tip is where the action lands.
   Under the cursor the brush shows the cell in the paint in hand, and the
   fill shows the whole area that will change. With no tool the cursor is
   ordinary: the mouse only moves the picture. */
const TOOL_CURSORS={
  // All three are drawn after Paint's: an outline with a white middle, so the
  // cursor stays visible on a dark work.
  // Brush — a dark blue pen nib; the tip is at the bottom left.
  brush:{hx:0,hy:11,ink:{K:'#0a1238',W:'#ffffff'},rows:[
    '........KK..',
    '.......KKKK.',
    '....KKKKKKKK',
    '..KKWWWWKKKK',
    '..KWWWWWWKK.',
    '..KWWKKWWK..',
    '.KWWWKKWWK..',
    '.KWWKWWWWK..',
    '.KWKWWWWK...',
    'KWKWWWKKK...',
    'KKWKKK......',
    'KKK.........']},
  // A Paint 98 style bucket, mirrored: paint pours on the left, the tip is
  // the end of the stream. The handle is see-through; the grid is cropped
  // to the drawing.
  fill:{hx:2,hy:14,ink:{K:'#000000',W:'#ffffff'},rows:[
    '.......KK....',
    '......K..K...',
    '......KK.K...',
    '....KKKWKK...',
    '..KKKWKWWK...',
    '.KKKWWKWWWK..',
    'KKKWWKWKWWWK.',
    'KKWWWWKWWWWWK',
    'KKKKWWWWWWWWK',
    'KKK.KWWWWWWK.',
    'KKK..KWWWWK..',
    'KKK...KWWK...',
    'KKK....KK....',
    '.KK..........',
    '..K..........']},
  // Pipette: a thin outline, diagonals stepping one cell at a time;
  // the tip is at the bottom left.
  pipette:{hx:0,hy:11,ink:{K:'#000000',W:'#ffffff'},rows:[
    '.........K..',
    '......K.KWK.',
    '.....KWKWWWK',
    '......KWWWK.',
    '.....KWKWK..',
    '....KWWWKWK.',
    '...KWWWK.K..',
    '..KWWWK.....',
    '.KWWWK......',
    '.KWWK.......',
    'KWKK........',
    'KK..........']},
};
const cursorCache={};
function toolCursor(name){
  const cc=TOOL_CURSORS[name]; if(!cc) return '';
  const px=Math.max(1,Math.round(gridPixel()));
  const key=name+px;
  if(!cursorCache[key]){
    const c=document.createElement('canvas'); c.width=cc.rows[0].length*px; c.height=cc.rows.length*px;
    const x=c.getContext('2d');
    cc.rows.forEach((row,j)=>[...row].forEach((ch,i)=>{
      if(ch==='.') return;
      x.fillStyle = cc.ink[ch] || '#000000';
      x.fillRect(i*px,j*px,px,px);
    }));
    cursorCache[key]=`url(${c.toDataURL()}) ${cc.hx*px} ${cc.hy*px}, default`;
  }
  return cursorCache[key];
}
let aimK=-1, aimFor=-1, aimMask=null, aimTint=null;
function aimAt(hl,e){
  const k=(stage===4&&tool&&paintsField)?cellUnder(hl,e.clientX,e.clientY):-1;
  hl.style.cursor = (stage===4&&tool) ? toolCursor(tool) : '';
  aimFrom={hl, x:e.clientX, y:e.clientY};
  if(k===aimK) return;
  aimK=k; redrawSoon(false);
}
function aimOff(){ aimFrom=null; if(aimK<0) return; aimK=-1; redrawSoon(false); }
/* THE CURSOR IS THE TOOL'S, NOW - not at the next move of the mouse: the
   stage left or the tool changed, the windows' cursors are set at once
   (14.11: out of stage 4 the picker stayed under a still mouse until it
   moved). The same rules as the moves': the pixels window shows the tool in
   hand on stage 4, the left window the picker only. */
function toolCursors(){
  if(!canvases) return;
  if(canvases[1]) canvases[1].style.cursor = (stage===4&&tool) ? toolCursor(tool) : '';
  if(canvases[0] && !editingLines) canvases[0].style.cursor = (stage===4&&tool==='pipette') ? toolCursor('pipette') : '';
}
/* THE AIM IS THE MOUSE'S, NOT THE PICTURE'S. The cell it marks is the one
   under the pointer now: when the picture moves under a still mouse (the
   wheel zooms, a glide goes on), the aim is taken anew from where the mouse
   stands — it never rides away with the cell it was on. Asked with every
   drawing; the mouse's place is kept from its last word. */
let aimFrom=null;
function aimNow(){
  if(!aimFrom || recoloringNow) return;
  aimK = (stage===4 && tool && paintsField) ? cellUnder(aimFrom.hl, aimFrom.x, aimFrom.y) : -1;
}
function inHand(){
  if(chosen===COPIED&&copied) return `rgb(${copied.r},${copied.g},${copied.b})`;
  if(chosen<0||!paintColors) return null;
  return `rgba(${paintColors[chosen*3]},${paintColors[chosen*3+1]},${paintColors[chosen*3+2]},${(alphaOf(chosen)/255).toFixed(3)})`;
}
function drawAim(kk){
  if(stage!==4||!tool||aimK<0||!paintsField||!buf4||!boundsField) return;
  const nw=buf4.width, nh=buf4.height;
  const {ax,ay,ssx,ssy}=visiblePart();
  const {ggx,ggy}=boundsField;
  const ll=ggx[0], unit=ggx[ggx.length-1], vv=ggy[0], nn=ggy[ggy.length-1];
  const x0=ssx+(ll-ax)*view.mm, y0=ssy+(vv-ay)*view.mm;
  const cw=(unit-ll)*view.mm/nw, ch=(nn-vv)*view.mm/nh;
  const i=aimK%nw, j=(aimK-i)/nw;
  const hand=inHand();
  kk.imageSmoothingEnabled=false;
  if(tool==='fill' && hand && paintsField[aimK]>=0){
    // The area is recomputed only when the cursor moves into ANOTHER area.
    if(aimFor<0 || !aimMask || aimMask.width!==nw || aimMask.height!==nh
       || aimMask.region[aimK]!==1){
      const region=regionOf(aimK);
      aimMask=sheetOf(nw,nh); aimMask.region=region;
      const frame=new ImageData(nw,nh);
      for(let c=0,o=0;c<nw*nh;c++,o+=4) if(region[c]){ frame.data[o+3]=255; }
      aimMask.getContext('2d').putImageData(frame,0,0);
      aimFor=aimK; aimTint=null;
    }
    // The mask gives the area's shape, the paint in hand its color; the
    // tinted copy is kept until the area or the paint changes.
    if(!aimTint || aimTint.hand!==hand){
      aimTint=sheetOf(nw,nh); aimTint.hand=hand;
      const tt=aimTint.getContext('2d');
      tt.drawImage(aimMask,0,0); tt.globalCompositeOperation='source-in';
      tt.fillStyle=hand; tt.fillRect(0,0,nw,nh);
    }
    kk.globalAlpha=0.7;
    drawCells(kk, aimTint, nw, nh, x0, y0, cw*nw, ch*nh);
    kk.globalAlpha=1;
  }
  if(tool==='brush' && hand){ kk.fillStyle=hand; kk.fillRect(x0+i*cw, y0+j*ch, cw, ch); }
}
/* SHOWING A PAINT IN THE STRIP. The cursor is on a cell of the picture — its
   paint in the strip looks as if the cursor were on it, and the strip scrolls
   to it. */
let dwellPaint=-1;
function pointPaint(nn){
  const strip=$('#palette').strip;
  if(strip.mark('pointed', nn<0?null:nn)) strip.show(nn);
}
function dwellOn(hl,e){
  if(stage!==4||!paintsField||e.pointerType==='touch') return;
  // Only with the pipette in hand (or Alt, the pipette for a moment): the
  // strip answers "which paint is this" when that is being asked.
  if(!(tool==='pipette' || e.altKey)){ if(dwellPaint>=0) dwellOff(); return; }
  const k=cellUnder(hl,e.clientX,e.clientY);
  const nn=k<0?-1:paintsField[k];
  if(nn===dwellPaint) return;
  dwellPaint=nn; pointPaint(nn);
}
function dwellOff(){ dwellPaint=-1; pointPaint(-1); }
function startStroke(){ strokeK=[]; strokeB=[]; }
function endStroke(){
  if(!strokeK||!strokeK.length){ strokeK=null; strokeB=null; return; }
  RECOLOR.back.push({kk:Int32Array.from(strokeK), bb:Int32Array.from(strokeB),
                    adopted:strokeAdopted});
  strokeAdopted=null;
  newStep(RECOLOR);
  strokeK=null; strokeB=null;
  // Both the status line and the window caption: the edit count is in both.
  showPalette(); refreshButtons(); tell(); redraw();
}
function rollBack(whence,whereTo){
  const ww=whence.pop(); if(!ww) return false;
  unsaved=true;
  const undoing=(whence===RECOLOR.back);
  if(ww.paletteAdd || ww.paletteClean){
    // Adding is undone by removing, cleaning by bringing back, and vice versa.
    const list=ww.paletteAdd||ww.paletteClean;
    const bringBack = ww.paletteClean ? undoing : !undoing;
    if(bringBack){ for(const kk of list) if(!palette.some(x=>x.nn===kk.nn)) palette.push({...kk}); }
    else {
      palette=palette.filter(x=>!list.some(kk=>kk.nn===x.nn));
      if(list.some(kk=>kk.nn===chosen)){
        copied={r:paintColors[chosen*3], g:paintColors[chosen*3+1], b:paintColors[chosen*3+2]};
        chosen=COPIED;
      }
    }
    whereTo.push(ww);
  } else if(ww.color!==undefined){
    // A paint color edit: swap the current color and the remembered one.
    const now=[0,1,2].map(i=>paintColors[ww.color*3+i]), aNow=alphaOf(ww.color);
    setPaintRGB(ww.color, ww.bb, ww.aa);
    whereTo.push({color:ww.color, bb:now, aa:aNow});
    if(colorTaker && typeof colorTaker==='object' && refreshChannels) refreshChannels();
  } else {
    const was_=new Int32Array(ww.kk.length);
    for(let n=0;n<ww.kk.length;n++){ was_[n]=paintsField[ww.kk[n]]; paintsField[ww.kk[n]]=ww.bb[n]; }
    whereTo.push({kk:ww.kk,bb:was_,adopted:ww.adopted});
    /* A stroke that gave birth to a paint — undo moves it from the palette back
       to copied, redo brings it back. */
    if(ww.adopted){
      const {nn,rgb}=ww.adopted;
      if(undoing){
        palette=palette.filter(x=>x.nn!==nn);
        copied={r:rgb[0],g:rgb[1],b:rgb[2]};
        if(chosen===nn) chosen=COPIED;
      } else {
        if(!palette.some(x=>x.nn===nn)) palette.push({r:rgb[0],g:rgb[1],b:rgb[2],groupsCount:0,nn});
        copied=null;
        if(chosen===COPIED) chosen=nn;
      }
    }
  }
  writeRecolor(); showPalette(); refreshButtons(); redraw(); tell();
  return true;
}
const undoRecolor=()=>rollBack(RECOLOR.back,RECOLOR.forward);
const redoRecolor=()=>rollBack(RECOLOR.forward,RECOLOR.back);

/* A click on the right window. The pipette also lives on Alt with any tool:
   taking a paint is needed all the time. */
/* A STROKE KEEPS THE TOOL IT BEGAN WITH: a drag after the pipette or a fill
   takes and floods nothing more, and letting Alt go mid-drag does not turn it
   into a brush. A copied color becomes a paint with the first cell it lands
   on, wherever the stroke began. */
let strokeTool=null, strokeAt=null, strokeLast=-1;
function recolorTap(hl,e,first){
  if(first){ strokeTool = (e.altKey || tool==='pipette') ? 'take' : tool; strokeLast=-1; }
  const k=cellUnder(hl,e.clientX,e.clientY);
  if(k<0){ strokeLast=-1; return; }
  if(strokeTool==='take'){ if(first) takePaint(k); return; }
  if(!first && strokeTool!=='brush') return;
  adoptCopied();
  if(!strokeK) startStroke();
  if(first && strokeTool==='fill'){ if(floodFill(k)){ writeRecolor(); redraw(); } return; }
  /* THE BRUSH DRAWS A LINE, not dots. The mouse tells where it is now and
     then, and a quick hand is cells apart between two words: every cell on
     the straight way from the last one to this one is painted. */
  const nw=buf4.width, from = strokeLast>=0 ? strokeLast : k;
  strokeLast=k;
  let x=from%nw, y=(from-x)/nw, any=false;
  const x1=k%nw, y1=(k-x1)/nw, dx=Math.abs(x1-x), dy=-Math.abs(y1-y), sx=x<x1?1:-1, sy=y<y1?1:-1;
  for(let err=dx+dy;;){
    const c=y*nw+x, was=paintsField[c];
    if(put(c)){ writeCell(c, was); any=true; }
    if(x===x1 && y===y1) break;
    const e2=2*err;
    if(e2>=dy){ err+=dy; x+=sx; }
    if(e2<=dx){ err+=dx; y+=sy; }
  }
  if(any) redrawSoon(true);
}
/* A stroke taken back before it is done (it turned into a pinch): its cells
   return to what they were. A stroke that gave birth to a paint is kept. */
function cancelStroke(){
  if(!strokeK){ return; }
  if(strokeAdopted){ endStroke(); return; }
  for(let n=strokeK.length-1;n>=0;n--) paintsField[strokeK[n]]=strokeB[n];
  strokeK=null; strokeB=null;
  writeRecolor(); redraw();
}


/* THEMES ARE ONE LIST, one record each: its name, its colors in force, and
   `back` — what Reset brings: a built-in theme's factory colors, an own
   theme's previous version (what it had before the last Apply). Own themes
   (`own`) — made with the plus from the colors in force, named "Own 1",
   "Own 2"…, or loaded — stand after the built-in ones, and only they can be
   renamed, deleted and saved to disk. Everything else is the same for all.
   Kept: every own theme, and a built-in one only while it differs from how
   it came (so a new version of the program can bring new factory colors). */
const pickColors=cc=>{ const o={}; for(const kk of THEME_COLORS.concat(THEME_FLAGS)) o[kk]=cc[kk]; return o; };
// Two sets are the same theme. While the markup is picked from the work (auto
// on both), its color is the work's, not the theme's: it does not count.
const sameColors=(a,b)=>THEME_COLORS.concat(THEME_FLAGS)
  .every(kk=>a[kk]===b[kk] || (kk==='markup' && a.auto && b.auto));
let themeList=THEMES.map(tt=>({name:tt.name, colors:pickColors(tt.colors), back:pickColors(tt.colors)}));
const allThemes=()=>themeList;
const ownThemes=()=>themeList.filter(tt=>tt.own);
const themeOf=name=>themeList.find(tt=>tt.name===name);
const isOwnTheme=name=>{ const tt=themeOf(name); return !!(tt && tt.own); };
const themeColors=tt=>({...tt.colors, theme:tt.name});
// Own themes renamed on load (a built-in one took the name): old → new, for
// the marks kept by name (favorites).
const themeRenamed=new Map();
function recallThemes(){
  const good=cc=>cc && /^#[0-9a-f]{6}$/i.test(cc.hull||'') && /^#[0-9a-f]{6}$/i.test(cc.accent||'');
  const fill=cc=>pickColors({...DEFAULT_COLORS, ...cc});
  let kept=null;
  try{ kept=JSON.parse(localStorage.getItem('repix.themeList')||'null'); }catch(_){}
  if(!Array.isArray(kept)){
    // From the earlier record (1.2): own themes only.
    kept=[];
    try{
      const own=JSON.parse(localStorage.getItem('repix.themes')||'[]');
      if(Array.isArray(own)) for(const tt of own) if(tt) kept.push({name:tt.name, colors:tt.colors, own:true});
    }catch(_){}
  }
  for(const tt of kept){
    if(!tt || typeof tt.name!=='string' || !good(tt.colors)) continue;
    let name=tt.name;
    const was=themeOf(name);
    if(was && !was.own && !tt.own){ was.colors=fill(tt.colors); continue; }
    // An own theme under a name a built-in one has since taken: the same
    // colors — it has become that theme; others — it stays, with a number.
    if(was && !was.own && sameColors(fill(tt.colors), was.back)) continue;
    if(was){
      for(let n=2; themeOf(name); n++) name=tt.name.slice(0, THEME_NAME_MAX-String(n).length-1)+' '+n;
      themeRenamed.set(tt.name, name);
    }
    themeList.push({name, colors:fill(tt.colors), back:fill(good(tt.back) ? tt.back : tt.colors), own:true});
  }
}
function saveThemes(){
  const out=themeList.filter(tt=>tt.own || !sameColors(tt.colors, tt.back))
    .map(tt=>tt.own ? {name:tt.name, colors:tt.colors, back:tt.back, own:true} : {name:tt.name, colors:tt.colors});
  try{ localStorage.setItem('repix.themeList', JSON.stringify(out)); }catch(_){}
}
/* FAVORITES — names of themes marked by the heart, and whether the arrows
   flip through them only. Kept apart from the themes: a mark, not a color. */
let favThemes=new Set(), favOnly=false;
function recallFavs(){
  try{
    const tt=JSON.parse(localStorage.getItem('repix.favThemes')||'[]');
    if(Array.isArray(tt)){
      const names=tt.filter(n=>typeof n==='string').map(n=>themeRenamed.get(n)||n);
      let adopted=false;
      for(const n of names) if(!themeOf(n) && RETIRED_THEMES[n]){
        addTheme(n, {...DEFAULT_COLORS, ...RETIRED_THEMES[n], lockButtons:false, lockText:false, auto:true});
        adopted=true;
      }
      if(adopted) saveThemes();
      favThemes=new Set(names.filter(n=>themeOf(n)));
    }
    favOnly=localStorage.getItem('repix.favOnly')==='1' && favThemes.size>0;
    if(themeRenamed.size) saveFavs();          // the marks follow the new names at once
  }catch(_){}
}
function saveFavs(){
  try{
    localStorage.setItem('repix.favThemes', JSON.stringify([...favThemes]));
    localStorage.setItem('repix.favOnly', favOnly ? '1' : '0');
  }catch(_){}
}
/* THE NEXT FAVORITE from a place in the list, in a direction: the arrows in
   favorites mode, turning the mode on, a deletion — one way for all. */
function nextFavorite(from, dd){
  const all=allThemes(), n=all.length;
  let i=all.findIndex(x=>x.name===from);
  if(i<0) i = dd>0 ? -1 : n;
  for(let k=1; k<=n; k++){
    const tt=all[((i+dd*k)%n+n)%n];
    if(favThemes.has(tt.name)) return tt;
  }
  return null;
}
/* A new own theme: its previous version is itself. */
function addTheme(name, cc){
  const tt={name, colors:pickColors(cc), back:pickColors(cc), own:true};
  themeList.push(tt); return tt;
}
/* A THEMES FILE is JSON: {"repix":"themes", "version":1, "themes":[{"name":…,
   "colors":{…}}, …]}; a single theme ({"repix":"theme", "name", "colors"}) is
   read too. The names are the file's header: loading offers them. Colors that
   are missing or not colors are taken from the default theme; a theme without
   its body and accent is skipped, and a file with none left is refused. */
function readThemesFile(text){
  try{
    const ff=JSON.parse(text);
    const list = ff && ff.repix==='themes' && Array.isArray(ff.themes) ? ff.themes
               : ff && ff.repix==='theme' ? [ff] : [];
    const good=vv=>/^#[0-9a-f]{6}$/i.test(vv||'');
    const out=[];
    for(const tt of list){
      if(!tt || !tt.colors || !good(tt.colors.hull) || !good(tt.colors.accent)) continue;
      const cc={};
      for(const kk of THEME_COLORS) cc[kk]=good(tt.colors[kk]) ? tt.colors[kk].toLowerCase() : DEFAULT_COLORS[kk];
      for(const kk of THEME_FLAGS) cc[kk]=typeof tt.colors[kk]==='boolean' ? tt.colors[kk] : DEFAULT_COLORS[kk];
      out.push({name: typeof tt.name==='string' ? tt.name.trim().slice(0,THEME_NAME_MAX) : '', colors:cc});
    }
    return out.length ? out : null;
  }catch(_){ return null; }
}
/* One theme is saved under its own name, several as repix-themes. */
function saveThemesFile(list){
  const out={repix:'themes', version:1, themes:list.map(tt=>{
    const cc={}; for(const kk of THEME_COLORS.concat(THEME_FLAGS)) cc[kk]=tt.colors[kk];
    return {name:tt.name, colors:cc}; })};
  const base = list.length===1 ? list[0].name.replace(/[\\/:*?"<>|]+/g,'_') : 'repix';
  giveFile(new TextEncoder().encode(JSON.stringify(out,null,1)), base+'.repix-themes.json', 'application/json');
}
/* Themes that were renamed are followed to their new name; a theme that is
   gone becomes a theme of your own with its colors (see recallColors, and
   RETIRED_THEMES for the favorites). */
const RENAMED_THEMES={'Repix':'Moss'};
function vvHSL(hex){
  const ch_=parseInt(hex.slice(1),16);
  return vvHSLch_(ch_>>16&255, ch_>>8&255, ch_&255);
}
function vvHSLch_(R,G,B){
  const r=R/255, g=G/255, b=B/255;
  const mak=Math.max(r,g,b), mn_=Math.min(r,g,b), dd=mak-mn_;
  const L=(mak+mn_)/2;
  const S=dd===0?0:dd/(1-Math.abs(2*L-1));
  let H=0;
  if(dd>0){
    if(mak===r) H=((g-b)/dd+6)%6;
    else if(mak===g) H=(b-r)/dd+2;
    else H=(r-g)/dd+4;
    H*=60;
  }
  return {H,S:S*100,L:L*100};
}
function fromWhatHSL(H,S,L){
  H=((H%360)+360)%360; S=Math.max(0,Math.min(100,S))/100; L=Math.max(0,Math.min(100,L))/100;
  const c=(1-Math.abs(2*L-1))*S, x=c*(1-Math.abs((H/60)%2-1)), m=L-c/2;
  let r=0,g=0,b=0;
  if(H<60){r=c;g=x;} else if(H<120){r=x;g=c;} else if(H<180){g=c;b=x;}
  else if(H<240){g=x;b=c;} else if(H<300){r=x;b=c;} else {r=c;b=x;}
  const bin=v=>Math.round((v+m)*255).toString(16).padStart(2,'0');
  return '#'+bin(r)+bin(g)+bin(b);
}
/* THE CHOSEN COLOR IS THE BACKGROUND, exactly. The other colors step away
   from it by fixed distances in lightness, tuned by eye — what matters is not
   the lightness itself but the DISTANCES: the panel six steps lighter, the
   field two darker, the buttons fifteen lighter (when they follow the body).
   Text and quiet text flip with the background's lightness: dark on a light
   body, light on a dark one. */
/* TEXT MUST READ where it stands. The contrast of two colors, 1 to 21 (as
   WCAG counts it): 4.5 is where text reads, 3 where quiet text does. */
function contrast(a,b){
  const lum=h=>{ const c=h.replace('#','');
    const x=[0,2,4].map(i=>parseInt(c.slice(i,i+2),16)/255)
      .map(u=>u<=0.03928 ? u/12.92 : Math.pow((u+0.055)/1.055,2.4));
    return 0.2126*x[0]+0.7152*x[1]+0.0722*x[2]; };
  const A=lum(a), B=lum(b);
  return (Math.max(A,B)+0.05)/(Math.min(A,B)+0.05);
}
/* CORRECTION, NOT A CHOICE. The color stays what it is — one's own or
   derived from the theme — as long as it reads on its ground. Below the
   threshold the same color moves in lightness, away from the ground, just
   until it reads: its hue is kept, and it changes no more than it must. */
function readable(fg, grounds, min){
  // One ground or several (a button's: at rest, under the mouse, pressed):
  // the text must read on the worst of them.
  const gg=[].concat(grounds);
  const worst=cc=>Math.min(...gg.map(bg=>contrast(cc,bg)));
  if(worst(fg)>=min) return fg;
  const ff=vvHSL(fg);
  const up=worst('#ffffff')>=worst('#000000');   // which way reads more
  for(let L=ff.L; up ? L<=100 : L>=0; L+=up?1:-1){
    const cc=fromWhatHSL(ff.H, ff.S, L);
    if(worst(cc)>=min) return cc;
  }
  return up ? '#ffffff' : '#000000';
}
const READS=4.5, READS_QUIET=3, READS_MARK=2.5;
function deriveColors(hull,accent,markup,canvas,buttons,text){
  const cc=deriveBase(hull,accent,markup,canvas,buttons,text);
  // Each text on its own ground: labels on the buttons, text and quiet text
  // on the panel, a pressed button's label on the dark accent, the plate's
  // name on the accent.
  const onButton=[cc['--frameColor'], cc['--hover'], cc['--press']];
  cc['--btnText']  = readable(cc['--text'],  onButton, READS);
  cc['--linkText'] = readable(cc['--accent'], onButton, READS);
  // The accent and the alarm as text: headings, knob values, a hint's title,
  // complaints on the panel; numbers and names typed into a field.
  cc['--accentText']      = readable(cc['--accent'], cc['--panel'], READS);
  // A held icon (a closed lock, a lit heart): the accent itself as long as it
  // stands out from the panel, moved only as far as it takes to.
  cc['--accentMark']      = readable(cc['--accent'], cc['--panel'], READS_MARK);
  cc['--accentField']     = readable(cc['--accent'], cc['--field'], READS);
  cc['--accentLightField']= readable(cc['--accentLight'], cc['--field'], READS);
  cc['--alarmText']       = readable(cc['--alarm'], cc['--panel'], READS);
  cc['--tossText']        = readable(cc['--accentLight'], cc['--bg'], READS);
  cc['--heldText'] = readable(cc['--accentLight'], cc['--accentShade'], READS);
  cc['--plateText']= readable(cc['--bg'],    cc['--accent'], READS);
  cc['--text']     = readable(cc['--text'],  cc['--panel'], READS);
  cc['--quiet']    = readable(cc['--quiet'], cc['--panel'], READS_QUIET);
  return cc;
}
function deriveBase(hull,accent,markup,canvas,buttons,text){
  const kk=vvHSL(hull), aa=vvHSL(accent);
  const S=kk.S, L=kk.L;
  const sv=dd=>Math.max(0,Math.min(100,L+dd));
  /* A button stands on its own color, and the bevel steps away from IT: light
     edge and shadow twenty-five either way, hover seven lighter, press six
     darker. */
  const btn=vvHSL(buttons||fromWhatHSL(kk.H,S,sv(+15)));
  const kvt=dd=>fromWhatHSL(btn.H, btn.S, Math.max(0,Math.min(100,btn.L+dd)));
  const lightBackground=(L>55);
  /* THE ALARM is the accent's neighbour on the hue circle, lighter: it warns
     (the doubt label) and marks the grid line under the hand. */
  const alarm=fromWhatHSL(aa.H+22, Math.min(100,aa.S), Math.min(88,aa.L+16));
  /* DARKER, NOT LOUDER. In HSL a pale color taken darker at the same
     saturation grows much stronger: a soft pink turns into a scarlet. So its
     strength (chroma) is kept no greater than its own — a pastel goes dusty,
     a strong color stays as strong. */
  const darker=(c, by, least)=>{
    const L2=Math.max(least, c.L-by), chroma=(100-Math.abs(2*c.L-100))*c.S/100;
    const room=100-Math.abs(2*L2-100);
    return fromWhatHSL(c.H, Math.min(100, c.S, room>0 ? chroma*100/room : 100), L2);
  };
  return {
    '--bg':    hull,
    '--panel': fromWhatHSL(kk.H, S, sv(+6)),
    '--field':   fromWhatHSL(kk.H, S, sv(-2)),
    '--frameColor':  buttons||fromWhatHSL(kk.H, S, sv(+15)),
    '--light':   kvt(+25),
    '--shadow':   kvt(-25),
    '--text':  text || fromWhatHSL(kk.H, Math.min(20,S*0.5), lightBackground?8:94),
    /* Quiet text is the same color moved a third of the way to the background:
       labels and the status line read quieter than button labels but stay of
       the same blood. */
    '--quiet':   (()=>{ const tt=vvHSL(text||fromWhatHSL(kk.H,Math.min(20,S*0.5),lightBackground?8:94));
                       const toBackground=(tt.L>L)?-32:+24;
                       return fromWhatHSL(tt.H, tt.S, Math.max(0,Math.min(100,tt.L+toBackground))); })(),
    // hover and press — the same family, a step lighter and darker than the
    // frame, so they follow a color change
    '--hover': kvt(+7),
    '--press': kvt(-6),
    '--accent':      accent,
    '--accentLight':  fromWhatHSL(aa.H, Math.min(100,aa.S*1.05), Math.min(92,aa.L+22)),
    '--accentShade':  darker(aa, 30, 6),
    '--accentHover':darker(aa, 24, 10),
    '--alarm':     alarm,
    // The backing under the work: a color of its own, derived from nothing.
    '--canvas':     canvas||hull,
    /* THE LINE ON THE CANVAS is a base color of its own, not derived from the
       accent: it lies on a FOREIGN work and must read over any paints. The
       line under the hand is drawn in the alarm color, to differ from it. */
    '--bar':     markup,
    '--highlighting': alarm,
  };
}
/* AUTOMATIC MARKUP COLOR. The line must not merge with the work, and works
   differ: a green line vanishes in a forest, an orange one in a sunset.

   Not the opposite of the dominant hue (with sky and sun it lands right in
   the sun), but THE FARTHEST FROM ITS NEAREST: for each candidate the distance
   to the nearest paint of the work is computed, and the candidate with the
   largest one wins.

   The work's paints are taken as a coarse histogram, so there are hundreds of
   occupied bins instead of hundreds of thousands of cells. */
// What it depends on: the picture only (not the theme). The same picture —
// the same color, not searched again.
let markupFor=-1, markupWas=null;
// The coarse bins of color the art occupies, told by pass 1 (pass1Summary).
let artOcc=null;
function pickMarkup(){
  const bb=buf; if(!bb) return null;
  if(markupFor===bufWritten && markupWas) return markupWas;
  markupFor=bufWritten; markupWas=pickMarkupNow(bb);
  return markupWas;
}
function pickMarkupNow(bb){
  /* 32 bins per channel: coarsening eats contrast by itself — a real paint can
     lie at a bin's edge, far from its middle. The bins come counted with the
     art, as pass 1 wrote it (pass1Summary). */
  const WW=32, HALF=256/WW/2;
  const occupied=artOcc && artOcc.length===WW*WW*WW ? artOcc : null;
  if(!occupied) return null;
  const pt=[];
  for(let ya=0;ya<occupied.length;ya++){
    if(!occupied[ya]) continue;
    const b=ya%WW, g=((ya-b)/WW)%WW, r=((ya-b)/WW-g)/WW;
    pt.push([r*(256/WW)+HALF, g*(256/WW)+HALF, b*(256/WW)+HALF]);
  }
  if(!pt.length) return null;
  /* Rare paints are NOT dropped: a small detail — a pupil, a highlight — is
     exactly where people look. */
  /* Distance with an eye to perception: green is seen better than blue, so
     the channels have different weights. A cheap stand-in for a real
     perceptual metric, enough for this task. */
  const far_=(r,g,b)=>{
    let mn_=Infinity;
    for(const [R,G,B] of pt){
      const d=2*(r-R)*(r-R) + 4*(g-G)*(g-G) + 3*(b-B)*(b-B);
      if(d<mn_) mn_=d;
    }
    return mn_;
  };
  let bestOne=null, best=-1;
  /* Candidates go around the hue circle in five lightnesses and two
     saturations, both near the maximum: the line's job is to stand out. */
  for(let H=0;H<360;H+=6)
    for(const L of [25,40,55,70,85])
      for(const S of [90,100]){
        const cc=fromWhatHSL(H,S,L);
        const ch_=parseInt(cc.slice(1),16);
        const d=far_(ch_>>16&255, ch_>>8&255, ch_&255);
        if(d>best){ best=d; bestOne=cc; }
      }
  return bestOne;
}
let colors={...DEFAULT_COLORS};

/* THE COLOR PICKER. It does everything the system dialog did — any tone,
   saturation and lightness, a screen pipette and three numbers — but it is
   ours: cells on the grid, interface colors, our own font.
   THE COLOR FIELD — ONE GRID PIXEL PER COLOR, in the same grid as the rest
   of the window: saturation to the right, lightness downwards. Up to 256 by
   256 — as many levels as a color channel has. On a phone there is no room
   for that, so the field takes what fits, always a multiple of sixteen grid
   pixels and no smaller than sixty-four. What else the picker holds — its
   top row, the tone slider and the channels — takes PICKER_ROWS cells. */
let FIELD_W=256, FIELD_H=256;
const PICKER_ROWS=76;      // as measured: the channels (three or four) are one row
function measureColorField(){
  const unit=gridPixel(), edge=unit*FLOAT_EDGE*2;
  const placeW=(innerWidth-edge*2)/unit;
  const placeH=(innerHeight-edge*2)/unit-PICKER_ROWS;
  const downward=(vv,kk)=>Math.max(64, Math.min(256, Math.floor(vv/kk)*kk));
  FIELD_W=downward(placeW,16);
  FIELD_H=Math.min(FIELD_W, downward(placeH,16));
}
let colorTaker=null, pickTone=0, refreshChannels=null, paletteAnchor=null;
/* THE PIPETTE WHERE THE SCREEN IS CLOSED. A phone's browser cannot take a
   color from the screen (no EyeDropper), so the picker's pipette takes it from
   the windows of Repix: armed by its button, the next touch on a window is a
   pick, not a pan. */
let pickingInWindows=false;
const ARMED={get:()=>pickingInWindows, set:v=>{ pickingInWindows=v; }, empty:false};
const disarmPipette=()=>{ pickingInWindows=false; refreshLive(); };
/* Whom the picker gives its color to: the name of an interface color, or any
   other target with two jobs — read its color and take a new one. A paint of
   the work on stage 4 is such a target. */
const takerColor=tt=>(tt && typeof tt==='object') ? tt.get() : colors[tt];
/* HOW MUCH OF THE COLOR IS THERE — a fourth channel, A. Only a paint of the
   work has it: a paint may be half there or not there at all (an eraser).
   The interface's own colors have none — the interface is never see-through. */
const takerAlpha=tt=>(tt && typeof tt==='object' && tt.alpha) ? tt.alpha : null;
function setupColorPicker(who){
  const unit=$('#colorPicker'); if(!unit) return;
  unit.textContent='';
  const current=()=>takerColor(colorTaker||who);
  /* TONE BY SLIDER. Tone is a continuous value — sliders are for that; the
     cells show what exists at the chosen tone. */
  // The slider track is painted in steps of one grid pixel: a smooth blur in
  // a pixel window reads as a foreign detail.
  // One step per grid pixel: as many steps as the field is wide, none taking
  // more than one pixel.
  const stepsCount=Math.min(FIELD_W,256), share=100/stepsCount, pieces=[];
  for(let i=0;i<stepsCount;i++){
    const cc=fromWhatHSL(i*360/stepsCount,80,50);
    pieces.push(`${cc} ${(i*share).toFixed(3)}% ${((i+1)*share).toFixed(3)}%`);
  }
  const toneK=document.createElement('input');
  toneK.type='range'; toneK.className='slider'; toneK.min=0; toneK.max=359;
  toneK.value=Math.round(pickTone);
  toneK.style.setProperty('--track','linear-gradient(to right,'+pieces.join(',')+')');
  toneK.onclick=e=>e.stopPropagation();
  attachHint(toneK, HINTS.tone);
  unit.appendChild(toneK);

  const canvas=document.createElement('canvas');
  canvas.className='colorField'; canvas.width=FIELD_W; canvas.height=FIELD_H;
  const px__=gridPixel();
  canvas.style.width=(FIELD_W*px__)+'px'; canvas.style.height=(FIELD_H*px__)+'px';
  const kk2=canvas.getContext('2d');
  const colorIn=(x,y)=>fromWhatHSL(pickTone, x*100/(FIELD_W-1), 94-y*(88/(FIELD_H-1)));
  const drawIt=()=>{
    for(let y=0;y<FIELD_H;y++)
      for(let x=0;x<FIELD_W;x++){ kk2.fillStyle=colorIn(x,y); kk2.fillRect(x,y,1,1); }
  };
  drawIt();
  canvas.onclick=e=>{
    e.stopPropagation();
    const r=canvas.getBoundingClientRect();
    const x=Math.min(FIELD_W-1,Math.max(0,Math.floor((e.clientX-r.left)/r.width*FIELD_W)));
    const y=Math.min(FIELD_H-1,Math.max(0,Math.floor((e.clientY-r.top)/r.height*FIELD_H)));
    takeColor(colorIn(x,y), true);
  };
  toneK.oninput=()=>{ pickTone=+toneK.value; drawIt(); };
  attachHint(canvas, HINTS.colorField);
  unit.appendChild(canvas);
  /* The top row: pipette on the left (where the browser can pick from the
     screen), close on the right. */
  const topEdge=document.createElement('div'); topEdge.className='colorTop';
  if(window.EyeDropper)
    topEdge.appendChild(buildNode({tag:'button', cls:'iconButton', inner:ICON_PIPETTE,
      hint:HINTS.screenPipette,
      click:async e=>{
        e.stopPropagation();
        try{ const {sRGBHex}=await new EyeDropper().open(); takeColor(sRGBHex, true); }
        catch(_){}                       // cancelled — fine
      }}));
  else
    topEdge.appendChild(buildNode({tag:'button', id_:'windowPipette', cls:'iconButton',
      inner:ICON_PIPETTE, hint:HINTS.windowPipette, choice:ARMED, value:true}));
  topEdge.appendChild(buildNode({tag:'button', cls:'iconButton cross', inner:ICON_CROSS,
    hint:HINTS.closePicker,
    click:e=>{ e.stopPropagation(); closeColorPicker(); }}));
  // To the top of the window, not where it was built: the row with the pipette
  // and the cross is the picker's header.
  unit.insertBefore(topEdge, unit.firstChild);
  dragFloating(unit, topEdge);
  // The bottom: three channels, like knobs, with the same font and field.
  const bottomEdge=document.createElement('div'); bottomEdge.className='colorBottom';
  /* Channels are KNOBS like the parameters below: label, scale, field. The
     program has one way to set a value, and a color channel is no exception. */
  const ch_=parseInt(current().slice(1),16);
  const scales=[];
  const assemble=()=>scales.map(x=>Math.round(x.value()));
  const takeIt=()=>takeColor('#'+assemble().map(v=>v.toString(16).padStart(2,'0')).join(''), true);
  for(const [name,shift] of [['R',16],['G',8],['B',0]]){
    const ya=buildNode({fill:true, knob:{caption:name, min:0, max:255, value:(ch_>>shift)&255,
      curve:'even', step:0, digits:0, hint:HINTS.channel[name], inMenu:true,
      change:()=>takeIt()}});
    scales.push(ya.knob);
    bottomEdge.appendChild(ya);
  }
  // A: its own setter — the color field and the pipette give a color, not how
  // much of it is there, and leave A as it is.
  const al=takerAlpha(colorTaker||who);
  let alphaK=null;
  if(al){
    const ya=buildNode({fill:true, knob:{caption:'A', min:0, max:255, value:al.get(),
      curve:'even', step:0, digits:0, hint:HINTS.channel.A, inMenu:true,
      change:()=>al.set(Math.round(alphaK.value()))}});
    alphaK=ya.knob;
    bottomEdge.appendChild(ya);
  }
  // The field and the pipette change the color past the scales — pull them along.
  refreshChannels=()=>{
    const tt=parseInt((takerColor(colorTaker)||'#000000').slice(1),16);
    [16,8,0].forEach((shift,i)=>{
      const v=(tt>>shift)&255;
      scales[i].give(v);
    });
    const aa=takerAlpha(colorTaker);
    if(alphaK && aa) alphaK.give(aa.get());
  };
  unit.appendChild(bottomEdge);
  unit.onclick=e=>e.stopPropagation();
}
function openColorPicker(who, uu){
  const unit=$('#colorPicker'); if(!unit) return;
  colorTaker=who; paletteAnchor=uu;
  measureColorField();          // the window can be anything, the field follows it
  // Open on the TONE of the current color: no need to search for it again.
  pickTone=Math.round(vvHSL(takerColor(who)).H);
  setupColorPicker(who);
  unit.hidden=false;
  stickTo(unit, uu, 'downward');
}
function closeColorPicker(){
  const unit=$('#colorPicker'); if(unit) unit.hidden=true;
  disarmPipette();
  colorTaker=null;
}
function takeColor(cc, stay){
  if(!colorTaker) return;
  if(typeof colorTaker==='object'){
    colorTaker.set(cc);
    if(stay){ if(refreshChannels) refreshChannels(); }
    else closeColorPicker();
    return;
  }
  colors[colorTaker]=cc;
  // A color taken by hand opens its lock: keeping it closed would throw away
  // what was just chosen.
  const ck=COLOR_KNOBS.find(x=>x.key===colorTaker);
  if(ck && ck.lockKey) colors[ck.lockKey]=false;
  // Numbers are typed digit by digit; the picker must not close on each.
  if(stay){ if(refreshChannels) refreshChannels(); }
  else closeColorPicker();
  applyColors(); saveColors();
}
function applyColors(){
  if(colors.auto){
    const cc=pickMarkup();
    if(cc) colors.markup=cc;
  }
  /* Lock closed — the own color is not passed at all and everything derives
     from the body. The color itself stays in the set untouched and returns
     once the lock opens: frozen, not erased. */
  const nn=deriveColors(colors.hull,colors.accent,colors.markup,colors.canvas,
                        colors.lockButtons?null:colors.buttons,
                        colors.lockText ?null:colors.text);
  // Every color is a goal: the engine takes it there from where it is drawn.
  for(const name in nn) tintTo(name, nn[name]);
  const drawnWith=pictureColors(paletteGoal);
  paletteGoal=nn;
  // An installed app's title bar wears the panel color of the theme.
  const tc=document.querySelector('meta[name=theme-color]');
  if(tc && nn['--panel']) tc.content=nn['--panel'];
  for(const ck of COLOR_KNOBS){
    const sw=$(ck.swatch); if(sw) sw.style.background = ck.shows ? nn[ck.shows] : colors[ck.key];
    const zz=ck.lock && $(ck.lock); if(!zz) continue;
    const closed=!!colors[ck.lockKey];
    zz.innerHTML = closed?LOCK_CLOSED:LOCK_OPEN;
    zz.classList.toggle('held', closed);
  }
  // The current theme's name is on the flipper itself; Reset returns to it.
  const themeNameEl=$('#themeName');
  if(themeNameEl) themeNameEl.textContent=colors.theme||DEFAULT_THEME;
  const title=$('#pageTitle'); if(title && $('#settings').dataset.page==='theme') title.textContent=colors.theme;
  // Header buttons repaint themselves, canvases do not: the caption color and
  // the backing around the work are taken at drawing time — once a frame,
  // however many colors came in it, and only when the colors the picture is
  // drawn with are others (a theme's own colors never touch it).
  if(hasImage && !recolorSoon && pictureColors(nn)!==drawnWith){
    recolorSoon=true;
    requestAnimationFrame(()=>{ recolorSoon=false; redraw(); });
  }
}
let recolorSoon=false;
/* The choice survives a restart: color is not a computing setting, it is set
   once for one's screen. Storage may be missing — in a private window reading
   throws — so both sides are in try. */
function saveColors(){
  try{ localStorage.setItem('repix.colors',JSON.stringify(colors)); }catch(_){}
}
function recallColors(){
  try{
    const tt=JSON.parse(localStorage.getItem('repix.colors')||'null');
    const good=vv=>/^#[0-9a-f]{6}$/i.test(vv||'');
    if(tt && good(tt.hull) && good(tt.accent))
      colors={hull:tt.hull, accent:tt.accent,
             // markup, canvas and mode came later: older records do not have them
             markup: good(tt.markup)?tt.markup:DEFAULT_COLORS.markup,
             canvas: good(tt.canvas)?tt.canvas:DEFAULT_COLORS.canvas,
             buttons: good(tt.buttons)?tt.buttons:DEFAULT_COLORS.buttons,
             text: good(tt.text)?tt.text:DEFAULT_COLORS.text,
             lockButtons: tt.lockButtons!==undefined ? !!tt.lockButtons : DEFAULT_COLORS.lockButtons,
             lockText:  tt.lockText !==undefined ? !!tt.lockText  : DEFAULT_COLORS.lockText,
             theme: tt.theme,
             auto: tt.auto!==undefined ? !!tt.auto : DEFAULT_COLORS.auto};
  }catch(_){}
  /* THE RECORD IS THE TRUTH: what was saved says which theme is on; its
     colors are the theme's record (a new version's factory colors, applied
     edits). A theme that is gone (renamed ones are followed) stays, with the
     colors it had, as a theme of your own. */
  const name=RENAMED_THEMES[colors.theme]||colors.theme;
  let tt=typeof name==='string' && name ? themeOf(name) : null;
  if(!tt && localStorage.getItem('repix.colors')){
    // A record with no theme at all (older than themes) is kept the same way.
    const base=typeof name==='string' && name.trim() ? name.trim().slice(0, THEME_NAME_MAX) : 'Own 1';
    let own=base;
    for(let n=2; themeOf(own); n++) own=base.slice(0, THEME_NAME_MAX-String(n).length-1)+' '+n;
    tt=addTheme(own, colors); saveThemes();
  }
  colors = tt ? themeColors(tt) : {...DEFAULT_COLORS, theme:DEFAULT_THEME};
}
/* ===================== GRID PIXEL SIZE =====================
   The grid cannot be fixed at two CSS pixels: on 4K at 100% that is a strip
   at the screen edge, and at fractional densities (125%, 150%) two CSS pixels
   fall on two and a half physical ones and the pixel font smears.

   So it is computed the other way round: first how many PHYSICAL pixels one
   of ours takes, then the CSS value by dividing by the density. Our pixel
   always covers a whole number of real ones.

   How many depends on the window width: smaller on a phone, larger on a big
   screen. */
/* INTERFACE SIZE. The engine picks it by window width and screen density,
   and there is a manual override that survives a restart: physical pixels per
   grid pixel, one of SIZES. SPACING likewise, in cells, one of SPACINGS.
   Zero means "auto". */
const SIZES=[1,2,3,4], SPACINGS=[1,2,3];
let sizeManual=0, spacingManual=0;
function recallSize(){
  try{ const tt=+localStorage.getItem('repix.size');
       if(SIZES.includes(tt)) sizeManual=tt;
       const oo=+localStorage.getItem('repix.spacing');
       if(SPACINGS.includes(oo)) spacingManual=oo; }catch(_){}
}
function saveSize(){
  try{ if(sizeManual) localStorage.setItem('repix.size',sizeManual);
       else localStorage.removeItem('repix.size');
       if(spacingManual) localStorage.setItem('repix.spacing',spacingManual);
       else localStorage.removeItem('repix.spacing'); }catch(_){}
}
function fitGrid(){
  const density=Math.max(1,window.devicePixelRatio||1);
  const ww=innerWidth;                 // in CSS pixels: this is a measure of ROOM
  // By the room (STANDARD.grid): 1920 gets 2, 2880 — 3, 3840 — 4; it changes
  // halfway between them.
  const G=STANDARD.grid;
  const baseValue = sizeManual || Math.max(G.least, Math.min(G.most, Math.round(ww/G.room)));
  // rounded to a whole number of physical pixels and converted back to CSS
  const phys=Math.max(1,Math.round(baseValue*density));
  const unit=phys/density;
  /* Spacing by itself: squeezed on a narrow screen, where every cell counts. */
  const spacing = spacingManual || (ww<G.narrow ? G.tight : G.spacing);
  /* ITS EDGES TELL TOO: the widths of the window between which the grid
     pixel and the spacing stay what they are, given to the browser like a
     band's (tellEdges) — a new size inside them does not come here at all. */
  let lo=-Infinity, hi=Infinity;
  if(!sizeManual){
    if(baseValue>G.least) lo=(baseValue-0.5)*G.room;
    if(baseValue<G.most) hi=(baseValue+0.5)*G.room;
  }
  if(!spacingManual){ if(ww<G.narrow) hi=Math.min(hi, G.narrow); else lo=Math.max(lo, G.narrow); }
  tellEdges('grid', edgesQuery(lo, hi, 0), ()=>{ fitGrid(); relayout(); });
  // Written when it is new — and then every field is looked at anew: the
  // scale and the spacing are the widths of everything.
  const print=unit+'|'+spacing;
  unitNow=unit;
  if(print===fitGrid.print) return;
  fitGrid.print=print; contentTouched=true; lookAtAll=true;
  document.documentElement.style.setProperty('--unit',unit+'px');
  document.documentElement.style.setProperty('--density',spacing);
  document.documentElement.style.setProperty('--barWidth',STANDARD.barWidth);
}
/* The browser window changed. Only what the size observers cannot see is done
   here — the grid pixel (it depends on screen density) and the split of the
   windows; the observers then lay out the sections and fit the canvases. What
   is already open must not end up past the edge. */
/* The density may change with no new size at all (the window dragged to
   another monitor): the screen is asked to tell when its density leaves the
   one of now. */
(function watchDensity(){
  if(!window.matchMedia) return;
  const mq=matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
  const moved=()=>{ mq.removeEventListener('change', moved); fitGrid(); if(hasImage) fitCanvas(); watchDensity(); };
  mq.addEventListener('change', moved);
})();
addEventListener('resize',()=>{
  if(BLIND.has('grid')) fitGrid();       // told by its edges otherwise
  // The pictures follow by their own trigger (their windows' size observer),
  // and so does the split of their room (the room's size observer).
  roomDue=true;
  repositionOpen();
});

/* WHAT THE SHOW BUTTON FLIPS. The list is rebuilt for the CURRENT stage: each
   has its own set of passed steps. The choice is remembered per stage. */
function buildStepList(){
  const where=$('#stepList'); if(!where) return;
  where.innerHTML='';
  const avail=AVAILABLE(), ring=showRing();
  for(const nn of avail)
    where.appendChild(buildNode({tag:'button', text:nn+'  '+STEPS[nn].brief, data:{step:nn}, align:'start',
      held:ring.includes(nn), off:!hasImage,
      click:()=>{
        const was_=showRing();
        // The last one is never taken away: the button must have something to flip.
        const became = was_.includes(nn) ? was_.filter(x=>x!==nn) : avail.filter(x=>was_.includes(x)||x===nn);
        if(!became.length) return;
        flip[stage]=became;
        saveFlipping();
        if(!became.includes(leftView)) toStep(became[0]);
        refreshButtons();
        buildStepList();
      }}));
}
function saveFlipping(){
  try{ localStorage.setItem('repix.flip',JSON.stringify(flip)); }catch(_){}
}
function recallFlipping(){
  try{
    const tt=JSON.parse(localStorage.getItem('repix.flip')||'null');
    if(tt && typeof tt==='object') flip=tt;
  }catch(_){}
}
/* Storage keys used to be Russian. Old records are moved once under the new
   names, so the settings are not reset. */
function migrateSettings(){
  try{
    const ls=localStorage, old=k=>ls.getItem('repix.'+k);
    const FIELDS={'корпус':'hull', 'акцент':'accent', 'разметка':'markup', 'холст':'canvas', 'кнопки':'buttons', 'текст':'text', 'замКнопки':'lockButtons', 'замТекст':'lockText', 'тема':'theme', 'авто':'auto'};
    if(ls.getItem('repix.hints')===null && old('подсказки')!==null)
      ls.setItem('repix.hints', old('подсказки')==='нет'?'no':'yes');
    if(ls.getItem('repix.colors')===null && old('цвета')!==null){
      const t=JSON.parse(old('цвета')), n={};
      for(const k in t) n[FIELDS[k]||k]=t[k];
      ls.setItem('repix.colors', JSON.stringify(n));
    }
    for(const [ru,en] of [['размер','size'],['отступ','spacing'],['листать','flip']])
      if(ls.getItem('repix.'+en)===null && old(ru)!==null) ls.setItem('repix.'+en, old(ru));
    for(const ru of ['подсказки','цвета','размер','отступ','листать']) ls.removeItem('repix.'+ru);
  }catch(_){}
}
function setupSettings(){
  migrateSettings();
  recallHints();
  recallSize();
  fitGrid();
  recallFlipping();
  buildStepList();
  recallThemes(); recallColors(); recallFavs(); applyColors();
  const win=$('#settings'), plate=$('#name'), guide=$('#guide');
  const opened=()=>!win.hasAttribute('hidden');
  /* THE PAGES of the menu window: a title for the top row, whether the page is
     tall (reaches down to the bottom of the window), and whether it has the
     cross. A page to read has it; a page where something is being done has
     none — it is left by its own buttons, Cancel or doing it. One page is
     shown at a time; the way back is a stack, so Cancel returns to where one
     came from. */
  let readingTitle=null, naming=null, readFrom=0;   // (readFrom: where the guide stood when a license was opened)
  const PAGES={
    main:{},
    guide:{title:()=>readingTitle||'Guide', tall:true, wide:true, cross:true},
    theme:{title:()=>colors.theme, enter:()=>beginEdit(), leave:()=>cancelEdit()},
    newTheme:{title:'New theme'},
    save:{title:'Save to disk', tall:true, enter:()=>{ tryFrom={...colors}; }, leave:()=>putBack()},
    confirm:{title:()=>asking.title},
    name:{title:()=>naming.title},
  };
  let pageStack=['main'];
  const page=()=>pageStack[pageStack.length-1];
  const showPage=()=>{
    const pp=page(), oo=PAGES[pp];
    win.dataset.page=pp;
    if(oo.wide) win.dataset.wide=''; else delete win.dataset.wide;
    for(const gg of win.querySelectorAll(':scope > [data-page]')) gg.hidden = gg.dataset.page!==pp;
    $('#pageTop').hidden = pp==='main';
    $('#pageBack').hidden = !oo.cross;
    $('#pageTitle').textContent = typeof oo.title==='function' ? oo.title() : (oo.title||'');
    // A tall page takes what is left under the plate, down to the same edge
    // it keeps from the sides: the window must not cover Repix, which closes it.
    const pad=gridPixel()*FLOAT_EDGE;
    win._fitHeight=()=>{ win.style.maxHeight = PAGES[page()].tall ? Math.max(pad*20, innerHeight-plate.getBoundingClientRect().bottom-pad*2)+'px' : ''; };
    win._fitHeight();
    refreshOwnRow(); refreshFav();
    if(pp==='save') buildSavePick();
    closeColorPicker(); scrollAt(win, 0);
    if(!win.hidden) stickTo(win, plate, 'downward');
  };
  const goTo=pp=>{ pageStack.push(pp); if(PAGES[pp].enter) PAGES[pp].enter(); showPage(); };
  // Leaving a page by any way — back, home, closing the menu — lets it put
  // back what it only showed for a while (a theme tried on, colors not applied).
  const leave=pp=>{ if(PAGES[pp].leave) PAGES[pp].leave(); };
  const home=()=>{
    while(pageStack.length>1) leave(pageStack.pop());
    leaveText(); showPage();
  };
  const back=()=>{
    // Out of a license text: the guide where it was left, not from its top.
    // (Put back once the engine has kept the guide as it stands - its dividers - or its room is short of the place.)
    if(page()==='guide' && readingTitle){ const at=readFrom; leaveText(); showPage(); Promise.resolve().then(()=>scrollAt(win, at)); return; }
    if(pageStack.length>1) leave(pageStack.pop());
    showPage();
  };
  $('#pageBack').onclick=e=>{ e.stopPropagation(); back(); };
  attachHint($('#pageBack'), HINTS.pageBack);
  const show=()=>{
    leaveText();                     // (a license text left open when it closed)
    win.hidden=false;
    showPage();
  };
  if(guide && !guide.children.length){
    for(const [title, rows] of GUIDE){
      const gg=Object.assign(document.createElement('div'),{className:'group'});
      gg.appendChild(Object.assign(document.createElement('h2'),{textContent:title}));
      for(const [keys, action] of rows){
        gg.appendChild(Object.assign(document.createElement('b'),{textContent:keys}));
        gg.appendChild(Object.assign(document.createElement('span'),{textContent:action}));
      }
      guide.appendChild(gg);
    }
    /* Licenses: the full texts, not a retelling — both licenses ask that the
       text itself goes along with the program. */
    const lic=Object.assign(document.createElement('div'),{className:'group'});
    lic.appendChild(Object.assign(document.createElement('h2'),{textContent:'License'}));
    const row=buildNode({tag:'div', cls:'licenseButtons', even:true});
    const text=Object.assign(document.createElement('pre'),{id:'licenseText'});
    // The texts are wrapped at 80 columns; the window is narrower, so a line
    // that was wrapped (a long one) is joined with the next and the window
    // wraps it itself. A short line — a heading — ends where it ends. Lines of
    // dashes are decoration of a plain text file and are dropped.
    const reflow=t=>t.split('\n').map(x=>x.trim()).filter(x=>!/^-{5,}$/.test(x))
      .reduce((acc,x)=>acc+x+(!x?'\n\n':x.length>=60?' ':'\n'),'')
      .replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
    for(const [label, title, id, hint] of LICENSES)
      row.appendChild(buildNode({tag:'button', text:label,
        // a notice on the net opens there; one kept in the page is read in the guide (one of them, said as one)
        link: id.startsWith('https:') ? id : null,
        click: id.startsWith('https:') ? null : e=>{
          e.stopPropagation();
          text.textContent=reflow(document.getElementById(id).textContent);
          readFrom=win.scrollTop; readingTitle=title;
          guide.classList.add('reading'); showPage();
        },
        // Legal notices must be seen: they explain even with Hints off.
        hint:[title, hint], always:true}));
    lic.appendChild(row);
    guide.appendChild(lic);
    guide.appendChild(text);
  }
  // Out of a license text the cross goes back to the guide.
  function leaveText(){ guide.classList.remove('reading'); readingTitle=null; }
  $('#btnGuide').onclick=e=>{ e.stopPropagation(); goTo('guide'); };
  // A closed menu opens again on the settings.
  /* Closed, it goes out AS IT IS: the page it was on fades with it (14.11:
     closed on a theme's page it first turned into the settings, then went).
     What the pages only showed for a while is put back now; the page it
     opens on - the settings - is shown when it opens again. */
  const conceal=()=>{ win.hidden=true; closeColorPicker(); while(pageStack.length>1) leave(pageStack.pop()); };
  // Repix on an inner page (the guide, a license text, a theme) is the cross:
  // the window flows back one page; on the settings themselves it closes.
  plate.onclick=e=>{ e.stopPropagation();
    if(!opened()) show();
    else if(PAGES[page()].cross && (pageStack.length>1 || readingTitle)) back();
    else conceal(); };
  win.addEventListener('click',e=>e.stopPropagation());
  addEventListener('click',()=>{ if(opened()) conceal(); });
  addEventListener('keydown',e=>{ if(e.key==='Escape'&&opened()) conceal(); });
  addEventListener('click',closeColorPicker);
  /* A ROW OF CHOICES: Auto and the values; the one in force is pressed. Size
     and spacing are such rows, and both change the grid. */
  const choiceRow=(row, values, get, set)=>{
    if(!row || row.children.length) return;
    const markIt=()=>{ for(const kk of row.children) kk.classList.toggle('held', +kk.dataset.value===get()); };
    for(const nn of [0,...values])
      row.appendChild(buildNode({tag:'button', text:nn?String(nn):'Auto', data:{value:nn},
        click:e=>{ e.stopPropagation(); set(nn); saveSize();
                   fitGrid(); markIt();
                   arrangeWindows(); relayout(true);
                   if(hasImage) redraw(); }}));
    markIt();
  };
  choiceRow($('#sizes'), SIZES, ()=>sizeManual, nn=>{ sizeManual=nn; });
  choiceRow($('#spacings'), SPACINGS, ()=>spacingManual, nn=>{ spacingManual=nn; });
  recallDepth();
  /* The same knob as below: a scale and a number field. The scale goes BY
     RATIOS: from 10 to 1000 evenly, all small numbers would fit into the first
     millimetre. History is trimmed on release, not on each step: dragging down
     and back loses nothing. */
  const depthRow=$('#undoSteps');
  if(depthRow && !depthRow.children.length)
    depthRow.appendChild(buildNode({fill:true, knob:{
      min:DEPTH_MIN, max:DEPTH_MAX, value:DEPTH, curve:'ratio', step:0, digits:0,
      hint:HINTS.undoSteps, inMenu:true,
      change:v=>{ DEPTH=v; },
      settle:()=>{ saveDepth(); trimHistory(UNDO); trimHistory(RECOLOR); }}}));
  /* THEMES ARE FLIPPED, not laid out in a row: a flipper takes one row however
     many themes there are — back, the current name, forward. Clicking the name
     also goes forward. */
  const themeRow=$('#themes');
  if(themeRow && !themeRow.children.length){
    const stepTheme=dd=>{
      let tt;
      if(favOnly) tt=nextFavorite(colors.theme, dd);
      else{ const all=allThemes(), i=all.findIndex(x=>x.name===colors.theme);
            tt=all[((i<0?0:i)+dd+all.length)%all.length]; }
      if(!tt) return;
      colors=themeColors(tt); applyColors(); saveColors();
    };
    const arrow=(text,dd)=>buildNode({tag:'button', cls:'themeArrow', text, hug:true,
      click:e=>{ e.stopPropagation(); stepTheme(dd); }});
    themeRow.append(
      arrow('<',-1),
      // The name is set at once, or the button stands empty until the first
      // color refresh. Pressing it opens the theme's page. The explanation sits
      // on the middle, where the name is. The arrows have none: they are
      // pressed in a row, and text under the hand would cover the colors being
      // compared.
      buildNode({tag:'button', id_:'themeName', cls:'themeName', clip:true,
        text:colors.theme||DEFAULT_THEME, hint:HINTS.themes,
        click:e=>{ e.stopPropagation(); goTo('theme'); }}),
      arrow('>',+1));
  }
  /* A NEW THEME — the plus: fork the colors in force, or load a file. Either
     way the theme is named first; "Own 1", "Own 2"… or the name the file
     carries is offered. */
  // A free name: the base itself, or with a number — cut so the whole of it
  // stays within THEME_NAME_MAX.
  const freeName=base=>{
    base=base.slice(0,THEME_NAME_MAX);
    if(!allThemes().some(x=>x.name===base)) return base;
    for(let n=2;;n++){
      const tail=' '+n, name=base.slice(0,THEME_NAME_MAX-tail.length).trimEnd()+tail;
      if(!allThemes().some(x=>x.name===name)) return name;
    }
  };
  const ownName=()=>{ let n=1; while(allThemes().some(x=>x.name==='Own '+n)) n++; return 'Own '+n; };
  const addOwnTheme=(name, cc)=>{
    colors=themeColors(addTheme(name, cc));
    saveThemes(); applyColors(); saveColors();
  };
  const nameIt=(title, value, save)=>{
    naming={title, save, old:value};
    $('#themeNameField').value=value;
    $('#nameComplaint').textContent='';
    goTo('name');
    $('#themeNameField').focus(); $('#themeNameField').select();
  };
  $('#themeAdd').onclick=e=>{ e.stopPropagation(); $('#loadComplaint').textContent=''; goTo('newTheme'); };
  $('#themeFork').onclick=e=>{ e.stopPropagation();
    const cc={...colors};
    nameIt('Fork theme', ownName(), name=>addOwnTheme(name, cc)); };
  $('#themeLoad').onclick=e=>{ e.stopPropagation(); $('#themeFile').value=''; $('#themeFile').click(); };
  $('#themeFile').onchange=async ()=>{
    const ff=$('#themeFile').files[0]; if(!ff) return;
    const list=readThemesFile(await ff.text().catch(()=>''));
    if(!list){ $('#loadComplaint').textContent=HINTS.loadFailed; return; }
    const fromFile=ff.name.replace(/\.json$/i,'').replace(/\.repix-themes?$/i,'');
    if(list.length===1){
      const tt=list[0];
      nameIt('Load theme', freeName(tt.name||fromFile), name=>addOwnTheme(name, tt.colors));
      return;
    }
    // Several themes: each under its own name, or with a number if taken; the
    // first of them is put on.
    let first=null;
    for(const tt of list){
      const made=addTheme(freeName(tt.name||fromFile), tt.colors);
      if(!first) first=made;
    }
    saveThemes();
    colors=themeColors(first); applyColors(); saveColors(); home();
  };
  // The name is checked here: not empty, not one the list already has.
  const saveName=()=>{
    const name=$('#themeNameField').value.trim();
    const taken=name!==naming.old && allThemes().some(x=>x.name===name);
    if(!name){ $('#nameComplaint').textContent='Give the theme a name.'; return; }
    if(taken){ $('#nameComplaint').textContent='A theme with this name is already in the list.'; return; }
    naming.save(name); home();
  };
  $('#nameSave').onclick=e=>{ e.stopPropagation(); saveName(); };
  $('#themeNameField').addEventListener('keydown',e=>{ if(e.key==='Enter') saveName(); });
  $('#nameCancel').onclick=e=>{ e.stopPropagation(); back(); };
  /* THE THEME'S PAGE is editing: the colors change at once, so the change is
     seen, but they are only kept by Apply. Cancel — or closing the menu —
     puts back what stood when the page was opened. Apply on a theme of your
     writes the colors into the theme's record, the same for every theme (see
     themeList); Reset goes to the record's `back`. Renaming and deleting are for
     your own themes only. */
  let editFrom=null;
  function beginEdit(){ editFrom={...colors}; }
  function cancelEdit(){
    if(!editFrom) return;
    colors={...editFrom}; editFrom=null; applyColors(); saveColors();
  }
  // Apply: the theme takes the colors; what it had becomes its previous
  // version (an own theme's; a built-in one goes back to its factory).
  function applyEdit(){
    editFrom=null;
    const tt=themeOf(colors.theme);
    if(tt && !sameColors(tt.colors, colors)){
      if(tt.own) tt.back=tt.colors;
      const cc=pickColors(colors);
      if(cc.auto) cc.markup=tt.colors.markup;   // the work's pick stays out of the theme
      tt.colors=cc; saveThemes();
    }
    saveColors();
  }
  $('#themeApply').onclick=e=>{ e.stopPropagation(); applyEdit(); home(); };
  $('#themeCancel').onclick=e=>{ e.stopPropagation(); cancelEdit(); back(); };
  $('#newCancel').onclick=e=>{ e.stopPropagation(); back(); };
  $('#saveCancel').onclick=e=>{ e.stopPropagation(); back(); };
  function refreshFav(){
    const one=$('#themeFav'), all=$('#themeFavs');
    if(one){ one.hidden = page()!=='theme'; one.classList.toggle('held', favThemes.has(colors.theme)); }
    if(all){ all.disabled=!favThemes.size; all.classList.toggle('held', favOnly); }
  }
  $('#themeFav').onclick=e=>{ e.stopPropagation();
    const n=colors.theme;
    favThemes.has(n) ? favThemes.delete(n) : favThemes.add(n);
    if(!favThemes.size) favOnly=false;
    saveFavs(); refreshFav(); };
  $('#themeFavs').onclick=e=>{ e.stopPropagation();
    if(!favThemes.size) return;
    favOnly=!favOnly; saveFavs(); refreshFav();
    // Turned on over a theme that is not a favorite: the next favorite after
    // it in the list is put on.
    if(favOnly && !favThemes.has(colors.theme)){
      const tt=nextFavorite(colors.theme, +1);
      if(tt){ colors=themeColors(tt); applyColors(); saveColors(); }
    }
  };
  function refreshOwnRow(){ const rr=$('#ownThemeRow'); if(rr) rr.hidden = page()!=='theme' || !isOwnTheme(colors.theme); }
  /* SAVING TO DISK: the list of your themes, each ticked or not; pressing a
     name puts that theme on. The ticks live while the page is open. */
  const ticked=new Set();
  function buildSavePick(){
    const pick=$('#savePick'); pick.textContent='';
    $('#saveComplaint').textContent = ownThemes().length ? '' : HINTS.noOwnThemes;
    for(const tt of ownThemes()){
      const box=buildNode({tag:'button', cls:'bare', hint:HINTS.savePickBox,
        click:e=>{ e.stopPropagation();
          ticked.has(tt.name) ? ticked.delete(tt.name) : ticked.add(tt.name); mark(); }});
      const mark=()=>{ box.innerHTML = ticked.has(tt.name) ? ICON_BOX_ON : ICON_BOX_OFF;
                       box.classList.toggle('held', ticked.has(tt.name));
                       $('#saveToDisk').disabled=!ticked.size; };
      // Tried on only: not saved, and put back when the page is left.
      const nameB=buildNode({tag:'button', cls:'pickName', clip:true, align:'start', text:tt.name,
        held:colors.theme===tt.name, hint:HINTS.savePickName,
        click:e=>{ e.stopPropagation();
          colors=themeColors(tt); applyColors(); buildSavePick(); }});
      pick.append(box, nameB);
      mark();
    }
    $('#saveToDisk').disabled=!ticked.size;
  }
  let tryFrom=null;
  function putBack(){ if(tryFrom){ colors=tryFrom; tryFrom=null; applyColors(); } }
  $('#themeSave').onclick=e=>{ e.stopPropagation(); ticked.clear(); goTo('save'); };
  $('#saveToDisk').onclick=e=>{ e.stopPropagation();
    const list=ownThemes().filter(tt=>ticked.has(tt.name));
    if(list.length){ saveThemesFile(list); back(); } };
  $('#themeRename').onclick=e=>{ e.stopPropagation();
    const old=colors.theme;
    nameIt('Rename theme', old, name=>{
      const tt=themeOf(old); if(tt) tt.name=name;
      if(favThemes.delete(old)){ favThemes.add(name); saveFavs(); }
      colors.theme=name; applyEdit(); saveThemes(); applyColors(); }); };
  /* ASKING: a page with the question and two answers; the answer "no" goes
     back to where one was. */
  let asking=null;
  const ask=(title, text, yes, act)=>{
    asking={title, act};
    $('#confirmText').textContent=text; $('#confirmYes').textContent=yes;
    goTo('confirm');
  };
  $('#confirmYes').onclick=e=>{ e.stopPropagation(); asking.act(); };
  $('#confirmNo').onclick=e=>{ e.stopPropagation(); back(); };
  // Deleting cannot be undone, so it asks first.
  $('#themeDelete').onclick=e=>{ e.stopPropagation();
    if(!isOwnTheme(colors.theme)) return;
    const name=colors.theme;
    ask('Delete theme?', `"${name}" will be removed from the list for good. A theme saved to disk can be loaded again.`, 'Delete', ()=>{
      // What comes on instead: the previous one — a favorite, when the
      // arrows flip through favorites.
      const all=allThemes(), i=all.findIndex(x=>x.name===name);
      if(favThemes.delete(name)){ if(!favThemes.size) favOnly=false; saveFavs(); }
      const next=(favOnly && nextFavorite(name, -1)) || all[i-1];
      themeList=themeList.filter(x=>x.name!==name);
      saveThemes(); editFrom=null;
      colors=themeColors(next); applyColors(); saveColors(); home(); }); };
  for(const id_ of ['themeFav','themeFavs','themeAdd','themeSave','themeFork','themeLoad','themeRename','themeDelete','themeNameField','saveToDisk','themeApply','themeCancel'])
    attachHint($('#'+id_), HINTS[id_]);
  // The colors: swatches open the picker, locks flip; both explain themselves.
  for(const ck of COLOR_KNOBS){
    const el=$(ck.swatch);
    if(el){ el.onclick=e=>{ e.stopPropagation(); openColorPicker(ck.key, el); };
            attachHint(el, ck.hint); }
    const zz=ck.lock && $(ck.lock); if(!zz) continue;
    zz.onclick=e=>{ e.stopPropagation(); colors[ck.lockKey]=!colors[ck.lockKey];
                   applyColors(); saveColors(); };
    attachHint(zz, ck.lockHint);
    zz.addEventListener('click',hideHint);
  }
  for(const id_ in HINTS.menu){
    const el=$('#'+id_); if(el) attachHint(el, HINTS.menu[id_]);
  }
  const btnP=$('#btnHints');
  if(btnP){
    const markIt=()=>btnP.classList.toggle('held', hintsOn);
    markIt();
    btnP.onclick=e=>{ e.stopPropagation();
      hintsOn=!hintsOn; saveHints(); markIt();
      if(!hintsOn) hideHint(); };
    attachHint(btnP, HINTS.hints, true);
  }
  const btnM=$('#btnMotion');
  if(btnM){
    const markIt=()=>btnM.classList.toggle('held', !still());
    markIt();
    if(lessMotion && lessMotion.addEventListener) lessMotion.addEventListener('change', markIt);
    btnM.onclick=e=>{ e.stopPropagation();
      motionChoice=still();          // the opposite of what is in force
      try{ localStorage.setItem('repix.motion', motionChoice?'yes':'no'); }catch(_){}
      markIt(); };
    attachHint(btnM, HINTS.motion);
  }
  /* Reset does not mean "factory defaults" but "back to the theme": whoever sits
     on Windows 98 and tweaked it is not thrown into another theme. */
  $('#btnReset').onclick=()=>{
    const tt=themeOf(colors.theme)||themeOf(DEFAULT_THEME);
    colors=themeColors({...tt, colors:tt.back});
    applyColors(); saveColors();
  };
}

/* ===================== saving ===================== */
/* GIVING A FILE — one way for everything the program saves. An iPhone or an
   iPad does not take a download from a page as a computer does (a web app
   installed from the site takes none at all): there the system's share
   sheet is opened, with "Save Image" and "Save to Files" in it. The file is
   made in the very press — a share asked after a wait is no longer the
   hand's and is refused. Elsewhere it is downloaded, and the file is kept
   for a minute: a browser asking "download?" must still find it. Where
   neither works, the picture opens on its own, to be kept by a long press. */
const appleTouch = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
function giveFile(bytes, name, type){
  const file=new File([bytes], name, {type});
  if(appleTouch && navigator.canShare && navigator.canShare({files:[file]})){
    navigator.share({files:[file]}).catch(err=>{
      if(err && err.name==='AbortError') return;     // closed by the hand: nothing to do
      openFile(file);
    });
    return;
  }
  const url=URL.createObjectURL(file);
  const a=document.createElement('a');
  a.href=url; a.download=name;
  if(appleTouch && !('download' in a)){ window.open(url, '_blank'); }
  else a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 60000);
}
function openFile(file){
  const url=URL.createObjectURL(file);
  window.open(url, '_blank');
  setTimeout(()=>URL.revokeObjectURL(url), 60000);
}
// A picture's PNG, made at once (no waiting — see giveFile).
function pngBytes(bb){
  const c=document.createElement('canvas'); c.width=bb.width; c.height=bb.height;
  c.getContext('2d').drawImage(bb, 0, 0);
  const b64=c.toDataURL('image/png').split(',')[1], bin=atob(b64), out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i);
  return out;
}
function save(){
  // Saved is the CURRENT stage's output — what the user sees on the right.
  const [bb]=stageOutput(); if(!bb) return;
  giveFile(pngBytes(bb), `art_${bb.width}x${bb.height}.png`, 'image/png');
}
/* ===================== projects ===================== */
/* A PROJECT is what the browser's store already keeps for the open work (see
   THE WORK IS KEPT): the picture opened — the file itself — and the work's
   state. Nothing computed: opened, the stages are counted again from the same
   knobs, and the painting is laid on the merge it was made on.
   AS A FILE (.repix): "REPIXPRJ", a version, the length of a JSON head, the
   head, then the bytes of every typed array of the state one after another,
   then the picture file's own bytes. The head is the state with each typed
   array, Map and Set written as a mark of what it was (and where its bytes
   are), and numbers JSON has no word for (NaN, ±Infinity) as marks too.
   INTO REPIX: the same project in the store, under its own number, with a
   small picture of the result for the list. */
const PROJ_MAGIC='REPIXPRJ', PROJ_VERSION=1;
const TYPED={Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array};
let projName='';                 // the name of the work: its picture's file name, without the extension
function packState(state){
  const chunks=[]; let at=0;
  const walk=v=>{
    if(v===null || typeof v==='boolean' || typeof v==='string') return v;
    if(typeof v==='number') return Number.isFinite(v) ? v : {$num:String(v)};
    if(v===undefined) return {$undef:1};
    if(ArrayBuffer.isView(v) && TYPED[v.constructor.name]){
      const b=new Uint8Array(v.buffer, v.byteOffset, v.byteLength).slice();
      const mark={$typed:v.constructor.name, at, n:v.length}; chunks.push(b); at+=b.length; return mark;
    }
    if(v instanceof Map) return {$map:[...v].map(([k,x])=>[walk(k),walk(x)])};
    if(v instanceof Set) return {$set:[...v].map(walk)};
    if(Array.isArray(v)) return v.map(walk);
    if(typeof v==='object'){ const o={}; for(const k of Object.keys(v)) o[k]=walk(v[k]); return o; }
    return null;
  };
  return {head:walk(state), chunks, size:at};
}
function unpackState(head, bytes){
  const walk=v=>{
    if(v===null || typeof v!=='object') return v;
    if(Array.isArray(v)) return v.map(walk);
    if('$num' in v) return Number(v.$num);
    if('$undef' in v) return undefined;
    if('$typed' in v){
      const T=TYPED[v.$typed]; if(!T) throw 0;
      const len=v.n*T.BYTES_PER_ELEMENT, b=bytes.slice(v.at, v.at+len);
      if(b.length!==len) throw 0;
      return new T(b.buffer);
    }
    if('$map' in v) return new Map(v.$map.map(([k,x])=>[walk(k),walk(x)]));
    if('$set' in v) return new Set(v.$set.map(walk));
    const o={}; for(const k of Object.keys(v)) o[k]=walk(v[k]); return o;
  };
  return walk(head);
}
async function sourceFile(){
  const src=await workGet('source');
  return src && src.id===workId && src.file ? src.file : null;
}
function baseName(file){ return ((file && file.name) || 'work').replace(/\.[^.]+$/,'') || 'work'; }
async function saveProjectFile(){
  const file=await sourceFile(); if(!file) return;
  const was=unsaved; unsaved=false;
  const {head, chunks, size}=packState({...workState(), unsaved:false});
  unsaved=was;
  const src=new Uint8Array(await file.arrayBuffer());
  const json=new TextEncoder().encode(JSON.stringify({name:projName||baseName(file), savedAt:Date.now(),
    source:{name:file.name, type:file.type, size:src.length}, chunks:size, state:head}));
  const out=new Uint8Array(8+4+4+json.length+size+src.length), dv=new DataView(out.buffer);
  out.set(new TextEncoder().encode(PROJ_MAGIC),0); dv.setUint32(8,PROJ_VERSION,true); dv.setUint32(12,json.length,true);
  out.set(json,16); let p=16+json.length;
  for(const c of chunks){ out.set(c,p); p+=c.length; }
  out.set(src,p);
  giveFile(out, `${projName||baseName(file)}.repix`, 'application/octet-stream');
  unsaved=false; keepWork();
}
// Reads a .repix file; null if it is not one (or broken).
async function readProjectFile(file){
  try{
    const all=new Uint8Array(await file.arrayBuffer());
    if(all.length<16 || new TextDecoder().decode(all.subarray(0,8))!==PROJ_MAGIC) return null;
    const dv=new DataView(all.buffer), ver=dv.getUint32(8,true), jl=dv.getUint32(12,true);
    if(ver>PROJ_VERSION || 16+jl>all.length) return null;
    const head=JSON.parse(new TextDecoder().decode(all.subarray(16,16+jl)));
    const c0=16+jl, bytes=all.subarray(c0, c0+head.chunks);
    const s0=c0+head.chunks, src=all.subarray(s0, s0+head.source.size);
    if(src.length!==head.source.size) return null;
    const pic=new File([src], head.source.name||'picture', {type:head.source.type||''});
    return {name:head.name, file:pic, state:unpackState(head.state, bytes)};
  }catch(_){ return null; }
}
// A small picture of what the right window shows, for the list of kept projects.
function projThumb(){
  const [bb]=stageOutput(), pic=bb||srcBitmap; if(!pic) return Promise.resolve(null);
  const S=96, k=Math.min(S/pic.width, S/pic.height, 1);
  const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(pic.width*k)); c.height=Math.max(1,Math.round(pic.height*k));
  const x=c.getContext('2d'); x.imageSmoothingEnabled=k<1 && !bb; x.drawImage(pic,0,0,c.width,c.height);
  return new Promise(ok=>c.toBlob(b=>ok(b),'image/png'));
}
async function saveIntoRepix(){
  const file=await sourceFile(); if(!file) return;
  if(!projectId) projectId=Date.now();
  const name=projName||baseName(file);
  const ok=await workPut(projectId, {id:projectId, name, savedAt:Date.now(), thumb:await projThumb(), file, state:{...workState(), unsaved:false}}, PROJ_STORE);
  if(ok){ unsaved=false; keepWorkNow(); say_('projSaved', name); }
}
/* OPENING A PROJECT: the work stands as it was saved — its picture opened as a
   new source of this page's work, the state laid on it as a kept work's. A
   painting in progress is not replaced without a word. */
function openProject(pp, sure=false){
  if(!sure && hasImage && unsaved){
    askFirst('Not saved', 'The work open now has changes that are not saved as a project, and this project will take its place. To keep it, cancel and press Save — Into Repix or Project file.',
             'Open anyway', ()=>openProject(pp, true));
    return;
  }
  fromFile(pp.file, {...pp.state, id:Date.now(), fresh:true, name:pp.name||pp.state.name||baseName(pp.file),
                     project:pp.state.project||pp.id||null}, true);
}
// Whatever comes in — a picture or a project file.
async function openAny(file){
  if(/\.repix$/i.test(file.name||'')){
    const pp=await readProjectFile(file);
    if(!pp){ say_('notProject'); return; }
    // A project file is not the copy kept in Repix: saving it into Repix makes its own.
    pp.state.project=null;
    openProject(pp);
    return;
  }
  fromFile(file);
}
/* THE OPEN-AND-SAVE WINDOW. */
function closeFileWin(){ const w=$('#fileWin'); if(w) w.hidden=true; }
function showFileWin(kind){
  const w=$('#fileWin'), by=$(kind==='save' ? '#btnSave' : '#btnOpen');
  $('#fileTitle').textContent = kind==='save' ? 'Save' : 'Open';
  $('#saveChoices').hidden = kind!=='save';
  $('#openChoices').hidden = kind!=='open';
  // Opened on the next turn: the click that opens it is still on its way up.
  setTimeout(()=>{ w.hidden=false; if(by && by.isConnected) stickTo(w, by, 'downward'); else placeTo(w, {rel:'window', side:'inside'}); },0);
}
function saveWin(){ if(hasImage) showFileWin('save'); }
async function openWin(){
  const list=await workAll(PROJ_STORE);
  if(!list.length){ $('#file').click(); return; }       // nothing kept: straight to a file
  buildProjList(list);
  showFileWin('open');
}
function buildProjList(list){
  const box=$('#projList'); box.textContent='';
  const when=t=>new Date(t).toLocaleString([], {dateStyle:'short', timeStyle:'short'});
  for(const pp of list){
    const img=document.createElement('img'); img.alt='';
    if(pp.thumb){ const u=URL.createObjectURL(pp.thumb); img.src=u; img.onload=()=>URL.revokeObjectURL(u); }
    const nameB=buildNode({tag:'button', cls:'projName', clip:true, align:'start', text:`${pp.name} · ${when(pp.savedAt)}`,
      hint:HINTS.projOpen, click:e=>{ e.stopPropagation(); closeFileWin(); openProject(pp); }});
    const del=buildNode({tag:'button', cls:'iconButton cross', inner:ICON_CROSS, hint:HINTS.projDelete,
      click:e=>{ e.stopPropagation();
        askFirst('Delete this project?', `"${pp.name}" will be removed from Repix. This cannot be undone.`, 'Delete', async()=>{
          await workDrop(pp.id, PROJ_STORE);
          if(projectId===pp.id){ projectId=null; keepWork(); }
          const rest=await workAll(PROJ_STORE);
          if(rest.length) buildProjList(rest); else closeFileWin();
        }); }});
    box.append(img, nameB, del);
  }
}
function setupFileWin(){
  const w=$('#fileWin'); if(!w) return;
  w.addEventListener('click',e=>e.stopPropagation());
  addEventListener('click',()=>{ if(!w.hidden && $('#askWin').hidden) closeFileWin(); });
  addEventListener('keydown',e=>{ if(e.key==='Escape' && !w.hidden && $('#askWin').hidden) closeFileWin(); });
  $('#saveArt').onclick=()=>{ closeFileWin(); save(); };
  $('#saveFile').onclick=()=>{ closeFileWin(); saveProjectFile(); };
  $('#saveInto').onclick=()=>{ closeFileWin(); saveIntoRepix(); };
  $('#openFromFile').onclick=()=>{ closeFileWin(); $('#file').click(); };
  for(const [id_,h] of [['saveArt','saveArt'],['saveFile','saveFile'],['saveInto','saveInto'],['openFromFile','openFromFile']])
    attachHint($('#'+id_), HINTS[h]);
}
/* ===================== start ===================== */
placeButtons();   // the engine places, labels and dims by itself
arrangeWindows();  // the captions take their shelf even before a work is open
/* Fine knobs start hidden — as the unpressed button says. */
refreshFine();
/* Layout hangs on EVENTS, not frames: as soon as the sections get a width,
   the observer calls. It also catches everything that changes width later —
   the window, a scrollbar, zoom. */
adoptScrolls(document.body);
relayout(true);
/* THE CANVAS IS MEASURED BY ITS OWN PLACE, and the place changes not only
   with the browser window: on stage 2 there are fewer knobs, the footer is
   lower and the windows get more height. */
if(window.ResizeObserver){
  /* The pictures follow their windows' size at every step, the window
     dragged or not: fitting them is laying the art held in memory out
     anew — about a millisecond — so no edge is ever left cut. */
  const pupil=new ResizeObserver(()=>{ if(hasImage) fitCanvas(); });
  for(const xx of document.querySelectorAll('.canvas')) pupil.observe(xx);
  /* SIDE BY SIDE OR STACKED is a threshold of the room's own shape. While
     the window is being given a new size the browser tells the room's size,
     and the choice is made from those two numbers: nothing is asked. A turn
     of it is the window's doing — everything stands at once. */
  if($('#stages')) new ResizeObserver(list=>{
    if(!roomDue) return;                 // (asked for by a new size of the window, once)
    roomDue=false;
    const el=$('#stages'), e=list[list.length-1], b=e.borderBoxSize && e.borderBoxSize[0];
    const was='stacked' in el.dataset;
    arrangeWindows(b ? {width:b.inlineSize, height:b.blockSize} : e.contentRect);
    if(('stacked' in el.dataset)!==was) turnedByWindow();
  }).observe($('#stages'));
  // A caption gives way by its own width, whatever changed it.
  const tails=new ResizeObserver(list=>{ for(const e of list) e.target._room=e.target.clientWidth; squeezeSingles(); });
  for(const oo of SINGLES) if(oo.gives==='tail'){ const el=$('#'+oo.id_); if(el) tails.observe(el); }
}
// A font changes the width of EVERY label, and the print does not see that.
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{
  // Measures kept from the fallback font are no measures.
  captionsFor='';
  for(const box of document.querySelectorAll('[data-even]')) box._evenFor=null;
  const st=$('#status'); if(st){ st._widths=null; st._decided=null; }
  relayout(true);
});
setupHints();   // hints of what the button engine does not build: the gear plate
setupSettings();
setupAsk();
setupFileWin();
/* FULL SCREEN IS THE PAGE'S OWN. The browser's (F11) lays its bars over
   the top of the page when the mouse comes near and takes the clicks
   there. The page's own (the Fullscreen API) has no bars at all. So F11,
   heard by the page, turns the page's own full screen on and off; Esc
   leaves it too. A browser that does not let the page have it keeps F11
   as its own. */
addEventListener('keydown', e=>{
  if(e.key!=='F11' || !document.documentElement.requestFullscreen || !document.fullscreenEnabled) return;
  if(!document.fullscreenElement && innerHeight>=screen.height-1 && innerWidth>=screen.width-1) return;   // the browser's own: its key
  e.preventDefault();
  if(e.repeat) return;
  if(document.fullscreenElement) document.exitFullscreen().catch(()=>{});
  else document.documentElement.requestFullscreen({navigationUI:'hide'}).catch(()=>{});
}, true);
/* OPENED WITH REPIX. The installed app is one of the programs a picture can be
   opened with; the picture comes here once the core is up. */
function takeLaunched(){
  if(!('launchQueue' in window)) return;
  launchQueue.setConsumer(async lp=>{
    if(lp.files && lp.files.length) openAny(await lp.files[0].getFile());
  });
}
bootCore().then(()=>{ refreshButtons(); takeLaunched(); recallWork(); }).catch(e=>{ say_('coreFailed',e); });
