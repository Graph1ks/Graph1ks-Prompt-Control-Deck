const EXT_VERSION = '1.3.4';

const feedbackConfig = {sound:true, radial:true, fillHotkey:true, retrieveHotkey:true};
const autoFillConfig = {enabled:false, seconds:8};
const autoFillRuntime = {
  active:false,
  phase:'paused',
  remaining:null,
  timer:null,
  generation:0,
  verifiedPending:false,
  requestInFlight:false
};
let feedbackAudioContext = null;
let fTriggerInFlight = false;
let rTriggerInFlight = false;
let fRequiresPrimaryClick = false;
let lastPointer = {x:Math.round(innerWidth/2), y:Math.round(innerHeight/2)};
let autoFillPointerRaf = 0;
let autoFillPointerPlacement = {horizontal:'',vertical:'',x:null,y:null};
let hotkeyPointerRaf = 0;
let hotkeyPointerPlacement = {x:null,y:null};
const UI_THEME_STORAGE_KEY='graph1ks_ui_theme_v1';
let graph1ksUiTheme='dark';

function applyGraph1ksUiTheme(theme){
  graph1ksUiTheme=theme==='light'?'light':'dark';
  const node=hotkeyIndicatorNode();
  if(node)node.dataset.theme=graph1ksUiTheme;
}
async function loadGraph1ksUiTheme(){
  try{
    const stored=await chrome.storage.local.get(UI_THEME_STORAGE_KEY);
    applyGraph1ksUiTheme(stored&&stored[UI_THEME_STORAGE_KEY]);
  }catch(_){applyGraph1ksUiTheme('dark');}
}
try{
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area==='local'&&changes&&changes[UI_THEME_STORAGE_KEY])applyGraph1ksUiTheme(changes[UI_THEME_STORAGE_KEY].newValue);
  });
}catch(_){ }
loadGraph1ksUiTheme();
const sunoAccountCache = {key:'',account:null,expiresAt:0,promise:null};
let runtimeEnabled = false;
let legacyLauncherObserver = null;


// ---------------------------------------------------------------------------
// SUNO-ONLY FLOATING CONTROL DECK OVERLAY
// Full-height overlay; never changes Suno's viewport width. The Deck itself is
// isolated in an extension iframe so Suno CSS and GRAPH1KS CSS cannot collide.
// ---------------------------------------------------------------------------
const OVERLAY_PREF_KEY = 'graph1ks_overlay_shell_v1';
const OVERLAY_STYLE_ID = 'graph1ks-overlay-shell-style';
const OVERLAY_HOST_ID = 'graph1ks-deck-overlay-shell';
const OVERLAY_EDGE_ID = 'graph1ks-deck-overlay-edge';
const overlayState = {
  open:false,
  host:null,
  iframe:null,
  edge:null,
  resizeHandle:null,
  width:520,
  opacity:100,
  autoHide:false,
  hidden:false,
  hideTimer:null,
  resizing:false,
  loadedPrefs:false,
  tabId:null,
  topmostWindow:null,
  topmostIframe:null,
  topmostOpening:false,
  restoreOverlayAfterTopmostClose:true
};

function overlayClampWidth(value){
  const min=Math.min(360,Math.max(280,innerWidth-24));
  const max=Math.max(min,Math.floor(innerWidth*0.95));
  return Math.max(min,Math.min(max,Math.round(Number(value)||520)));
}

function overlayClampOpacity(value){
  const n=Math.round(Number(value));
  return Math.max(60,Math.min(100,Number.isFinite(n)?n:100));
}

async function loadOverlayPrefs(){
  if(overlayState.loadedPrefs)return;
  overlayState.loadedPrefs=true;
  try{
    const stored=(await chrome.storage.local.get(OVERLAY_PREF_KEY))[OVERLAY_PREF_KEY]||{};
    overlayState.width=overlayClampWidth(stored.width);
    overlayState.opacity=overlayClampOpacity(stored.opacity);
    overlayState.autoHide=stored.autoHide===true;
  }catch(_){
    overlayState.width=overlayClampWidth(overlayState.width);
  }
}

async function persistOverlayPrefs(){
  try{
    await chrome.storage.local.set({[OVERLAY_PREF_KEY]:{
      width:overlayClampWidth(overlayState.width),
      opacity:overlayClampOpacity(overlayState.opacity),
      autoHide:overlayState.autoHide===true
    }});
  }catch(_){ }
}

function ensureOverlayShellStyle(){
  if(document.getElementById(OVERLAY_STYLE_ID))return;
  const style=document.createElement('style');
  style.id=OVERLAY_STYLE_ID;
  style.textContent=`
#${OVERLAY_HOST_ID}{position:fixed!important;top:0!important;right:0!important;height:100vh!important;max-height:100vh!important;z-index:2147483645!important;display:block!important;background:transparent!important;box-shadow:-18px 0 48px rgba(0,0,0,.32)!important;transform:translate3d(0,0,0);transition:transform .20s cubic-bezier(.2,.8,.2,1),box-shadow .20s ease!important;contain:layout style!important;isolation:isolate!important;pointer-events:auto!important;}
#${OVERLAY_HOST_ID}.g1-overlay-hidden{transform:translate3d(calc(100% + 10px),0,0)!important;box-shadow:none!important;}
#${OVERLAY_HOST_ID} iframe{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;border:0!important;margin:0!important;padding:0!important;background:transparent!important;opacity:1!important;display:block!important;}
#${OVERLAY_HOST_ID} .g1-overlay-resize{position:absolute!important;left:-5px!important;top:0!important;width:10px!important;height:100%!important;z-index:4!important;cursor:ew-resize!important;background:transparent!important;touch-action:none!important;}
#${OVERLAY_HOST_ID} .g1-overlay-resize::after{content:"";position:absolute;left:4px;top:0;width:1px;height:100%;background:rgba(159,105,255,.34);opacity:.55;transition:opacity .15s ease,box-shadow .15s ease;}
#${OVERLAY_HOST_ID} .g1-overlay-resize:hover::after,#${OVERLAY_HOST_ID}.g1-overlay-resizing .g1-overlay-resize::after{opacity:1;box-shadow:0 0 10px rgba(159,105,255,.65);}
#${OVERLAY_EDGE_ID}{position:fixed!important;right:0!important;top:0!important;width:8px!important;height:100vh!important;z-index:2147483646!important;background:transparent!important;display:none!important;cursor:w-resize!important;}
#${OVERLAY_EDGE_ID}.g1-edge-active{display:block!important;}
#${OVERLAY_EDGE_ID}::after{content:"";position:absolute;right:0;top:0;width:2px;height:100%;background:linear-gradient(180deg,rgba(159,105,255,0),rgba(159,105,255,.58),rgba(66,223,155,.42),rgba(159,105,255,0));opacity:0;transition:opacity .15s ease;}
#${OVERLAY_EDGE_ID}:hover::after{opacity:.85;}
html.g1-overlay-resizing,html.g1-overlay-resizing *{cursor:ew-resize!important;user-select:none!important;}
`;
  document.documentElement.appendChild(style);
}

function overlaySyncClasses(){
  if(!overlayState.host)return;
  overlayState.host.classList.toggle('g1-overlay-hidden',overlayState.autoHide&&overlayState.hidden);
  overlayState.host.classList.toggle('g1-overlay-resizing',overlayState.resizing);
  if(overlayState.edge)overlayState.edge.classList.toggle('g1-edge-active',overlayState.open&&overlayState.autoHide&&overlayState.hidden);
}

function overlayApplyWidth(){
  overlayState.width=overlayClampWidth(overlayState.width);
  if(overlayState.host)overlayState.host.style.setProperty('width',overlayState.width+'px','important');
}

function overlayApplyOpacity(){
  overlayState.opacity=overlayClampOpacity(overlayState.opacity);
  if(overlayState.iframe)overlayState.iframe.style.setProperty('opacity',String(overlayState.opacity/100),'important');
}

function clearOverlayHideTimer(){
  if(overlayState.hideTimer){clearTimeout(overlayState.hideTimer);overlayState.hideTimer=null;}
}

function revealOverlay(){
  clearOverlayHideTimer();
  overlayState.hidden=false;
  overlaySyncClasses();
}

function hideOverlayNow(){
  clearOverlayHideTimer();
  if(!overlayState.open||!overlayState.autoHide||overlayState.resizing)return;
  overlayState.hidden=true;
  overlaySyncClasses();
}

function scheduleOverlayHide(delay=420){
  clearOverlayHideTimer();
  if(!overlayState.open||!overlayState.autoHide||overlayState.resizing)return;
  overlayState.hideTimer=setTimeout(hideOverlayNow,delay);
}

function notifyOverlayState(){
  try{chrome.runtime.sendMessage({type:'OVERLAY_STATE_CHANGED'}).catch(()=>{});}catch(_){ }
}

function topmostIsOpen(){
  return !!(overlayState.topmostWindow && !overlayState.topmostWindow.closed);
}

function postTopmostResult(target,requestId,payload){
  try{
    target?.postMessage({type:'GRAPH1KS_TOPMOST_RESULT',requestId,...payload},'*');
  }catch(_){ }
}

function closeTopmostWindow(options={}){
  const restore=options.restoreOverlay!==false;
  overlayState.restoreOverlayAfterTopmostClose=restore;
  const pip=overlayState.topmostWindow;
  if(pip && !pip.closed){
    try{pip.close();return true;}catch(_){ }
  }
  overlayState.topmostWindow=null;
  overlayState.topmostIframe=null;
  overlayState.topmostOpening=false;
  if(restore && !overlayState.open)ensureOverlayShell().catch(()=>{});
  notifyOverlayState();
  return false;
}

function openTopmostFromOverlay(sourceWindow,requestId){
  if(topmostIsOpen()){
    postTopmostResult(sourceWindow,requestId,{ok:true,alreadyOpen:true});
    return;
  }
  if(overlayState.topmostOpening){
    postTopmostResult(sourceWindow,requestId,{ok:false,error:'Always-on-Top is already opening.'});
    return;
  }
  if(!window.documentPictureInPicture || typeof window.documentPictureInPicture.requestWindow!=='function'){
    postTopmostResult(sourceWindow,requestId,{ok:false,error:'Document Picture-in-Picture is unavailable in this Chrome build.'});
    return;
  }

  // IMPORTANT: requestWindow() is deliberately invoked immediately from the
  // top-level Suno browsing context. Do not add an await before this call: the
  // API requires both a top-level window and the transient activation created
  // by the click inside the Deck iframe.
  overlayState.topmostOpening=true;
  let request;
  try{
    const requestedWidth=Math.max(640,Math.min(1180,Math.round(overlayState.width||1150)));
    const requestedHeight=Math.max(520,Math.min(820,Math.round(innerHeight*0.88)||760));
    request=window.documentPictureInPicture.requestWindow({width:requestedWidth,height:requestedHeight});
  }catch(error){
    overlayState.topmostOpening=false;
    postTopmostResult(sourceWindow,requestId,{ok:false,error:error?.message||String(error)});
    return;
  }

  request.then(pip=>{
    overlayState.topmostWindow=pip;
    overlayState.topmostOpening=false;
    overlayState.restoreOverlayAfterTopmostClose=true;

    const doc=pip.document;
    doc.documentElement.style.cssText='margin:0;width:100%;height:100%;overflow:hidden;background:#09090c;';
    doc.body.style.cssText='margin:0;width:100%;height:100%;overflow:hidden;background:#09090c;';
    doc.title='GRAPH1KS Prompt Control Deck · Always on Top';

    const iframe=doc.createElement('iframe');
    iframe.title='GRAPH1KS Prompt Control Deck · Always on Top';
    const params=new URLSearchParams({surface:'topmost'});
    if(Number.isInteger(overlayState.tabId))params.set('dockTabId',String(overlayState.tabId));
    iframe.src=chrome.runtime.getURL('deck.html?'+params.toString());
    iframe.setAttribute('allow','clipboard-read; clipboard-write');
    iframe.style.cssText='position:fixed;inset:0;width:100%;height:100%;border:0;margin:0;padding:0;background:#09090c;display:block;';
    doc.body.appendChild(iframe);
    overlayState.topmostIframe=iframe;

    let handedOff=false;
    const finishHandoff=()=>{
      if(handedOff)return;
      handedOff=true;
      postTopmostResult(sourceWindow,requestId,{ok:true});
      // Keep the overlay alive until the replacement surface has had a chance
      // to initialize and consume the shared handoff snapshot.
      setTimeout(()=>{if(topmostIsOpen())destroyOverlayShell();},60);
      notifyOverlayState();
    };
    iframe.addEventListener('load',finishHandoff,{once:true});
    setTimeout(finishHandoff,1400);

    pip.addEventListener('pagehide',()=>{
      const restore=overlayState.restoreOverlayAfterTopmostClose!==false;
      overlayState.topmostWindow=null;
      overlayState.topmostIframe=null;
      overlayState.topmostOpening=false;
      overlayState.restoreOverlayAfterTopmostClose=true;
      notifyOverlayState();
      if(restore && !overlayState.open){
        setTimeout(()=>{ensureOverlayShell().catch(()=>{});},60);
      }
    },{once:true});
  }).catch(error=>{
    overlayState.topmostOpening=false;
    postTopmostResult(sourceWindow,requestId,{ok:false,error:error?.message||String(error)});
    notifyOverlayState();
  });
}

window.addEventListener('message',event=>{
  if(!overlayState.iframe || event.source!==overlayState.iframe.contentWindow)return;
  const data=event.data;
  if(!data || data.type!=='GRAPH1KS_TOPMOST_REQUEST')return;
  openTopmostFromOverlay(event.source,String(data.requestId||''));
});

async function ensureOverlayShell(){
  if(overlayState.host&&overlayState.host.isConnected){
    overlayState.open=true;
    revealOverlay();
    return overlayState.host;
  }

  await loadOverlayPrefs();
  ensureOverlayShellStyle();

  const edge=document.createElement('div');
  edge.id=OVERLAY_EDGE_ID;
  edge.setAttribute('aria-hidden','true');
  edge.addEventListener('pointerenter',revealOverlay,{passive:true});
  edge.addEventListener('mouseenter',revealOverlay,{passive:true});

  const host=document.createElement('div');
  host.id=OVERLAY_HOST_ID;
  host.setAttribute('data-graph1ks-overlay','true');
  host.addEventListener('pointerenter',()=>{clearOverlayHideTimer();revealOverlay();},{passive:true});
  host.addEventListener('pointerleave',()=>{scheduleOverlayHide();},{passive:true});

  const iframe=document.createElement('iframe');
  iframe.title='GRAPH1KS Prompt Control Deck';
  iframe.src=chrome.runtime.getURL('deck.html?surface=overlay');
  iframe.setAttribute('allow','clipboard-read; clipboard-write');

  const resize=document.createElement('div');
  resize.className='g1-overlay-resize';
  resize.title='Drag to resize GRAPH1KS Control Deck';
  resize.setAttribute('role','separator');
  resize.setAttribute('aria-orientation','vertical');

  resize.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    event.preventDefault();
    clearOverlayHideTimer();
    revealOverlay();
    overlayState.resizing=true;
    overlaySyncClasses();
    document.documentElement.classList.add('g1-overlay-resizing');
    try{resize.setPointerCapture(event.pointerId);}catch(_){ }
  });
  resize.addEventListener('pointermove',event=>{
    if(!overlayState.resizing)return;
    overlayState.width=overlayClampWidth(innerWidth-event.clientX);
    overlayApplyWidth();
  });
  const finishResize=event=>{
    if(!overlayState.resizing)return;
    overlayState.resizing=false;
    overlaySyncClasses();
    document.documentElement.classList.remove('g1-overlay-resizing');
    try{if(event&&resize.hasPointerCapture(event.pointerId))resize.releasePointerCapture(event.pointerId);}catch(_){ }
    persistOverlayPrefs().catch(()=>{});
  };
  resize.addEventListener('pointerup',finishResize);
  resize.addEventListener('pointercancel',finishResize);

  host.appendChild(iframe);
  host.appendChild(resize);
  document.documentElement.appendChild(edge);
  document.documentElement.appendChild(host);

  overlayState.host=host;
  overlayState.iframe=iframe;
  overlayState.edge=edge;
  overlayState.resizeHandle=resize;
  overlayState.open=true;
  overlayState.hidden=false;
  overlayApplyWidth();
  overlayApplyOpacity();
  overlaySyncClasses();

  // Let dock/popout handoff wait until the replacement Deck surface exists.
  await new Promise(resolve=>{
    let done=false;
    const finish=()=>{if(done)return;done=true;resolve();};
    iframe.addEventListener('load',finish,{once:true});
    setTimeout(finish,1400);
  });

  notifyOverlayState();
  return host;
}

function destroyOverlayShell(){
  clearOverlayHideTimer();
  overlayState.open=false;
  overlayState.hidden=false;
  overlayState.resizing=false;
  document.documentElement.classList.remove('g1-overlay-resizing');
  try{overlayState.host?.remove();}catch(_){ }
  try{overlayState.edge?.remove();}catch(_){ }
  overlayState.host=null;
  overlayState.iframe=null;
  overlayState.edge=null;
  overlayState.resizeHandle=null;
  document.getElementById(OVERLAY_STYLE_ID)?.remove();
  notifyOverlayState();
}

async function setOverlayOpen(open){
  if(open){
    await ensureOverlayShell();
    revealOverlay();
    if(topmostIsOpen()){
      // Return the response first so a Deck inside PiP can finish its Dock
      // request before its owning PiP window disappears.
      setTimeout(()=>closeTopmostWindow({restoreOverlay:false}),120);
    }
  }else destroyOverlayShell();
  return {ok:true,open:overlayState.open,topmostOpen:topmostIsOpen(),autoHide:overlayState.autoHide,hidden:overlayState.hidden,width:overlayState.width,opacity:overlayState.opacity};
}

async function setOverlayAutoHide(autoHide){
  await loadOverlayPrefs();
  overlayState.autoHide=autoHide===true;
  if(!overlayState.autoHide)revealOverlay();
  else overlaySyncClasses();
  await persistOverlayPrefs();
  notifyOverlayState();
  return {ok:true,open:overlayState.open,autoHide:overlayState.autoHide,hidden:overlayState.hidden,width:overlayState.width,opacity:overlayState.opacity};
}

async function setOverlayOpacity(opacity){
  await loadOverlayPrefs();
  overlayState.opacity=overlayClampOpacity(opacity);
  overlayApplyOpacity();
  await persistOverlayPrefs();
  return {ok:true,open:overlayState.open,autoHide:overlayState.autoHide,hidden:overlayState.hidden,width:overlayState.width,opacity:overlayState.opacity};
}

window.addEventListener('resize',()=>{
  if(!overlayState.open)return;
  overlayApplyWidth();
},{passive:true});

function str(v){ return v == null ? '' : String(v); }
function sleep(ms){ return new Promise(r => setTimeout(r,ms)); }
function normalizeLineEndings(v){ return str(v).replace(/\r\n?/g,'\n'); }
function normText(v){ return normalizeLineEndings(v).replace(/[ \t]+\n/g,'\n').trim(); }
function semText(v){ return normText(v).replace(/\s+/g,' ').trim(); }

// Read editor text without Chrome's innerText paragraph spacing. Suno/Lexical
// represents ordinary Enter presses as sibling block nodes; innerText can turn
// those into double newlines. Reconstruct the authored block sequence instead
// so Vault storage round-trips the user's actual line/blank-line structure.
function exactEditableText(root){
  if(!root)return '';
  const blockTags=new Set(['DIV','P','LI','BLOCKQUOTE','PRE','H1','H2','H3','H4','H5','H6']);

  function inlineText(node){
    if(!node)return '';
    if(node.nodeType===Node.TEXT_NODE)return node.nodeValue||'';
    if(node.nodeType!==Node.ELEMENT_NODE)return '';
    if(node.tagName==='BR')return '\n';
    const children=Array.from(node.childNodes);
    if(!children.length)return '';
    let out='';
    for(const child of children){
      if(child.nodeType===Node.ELEMENT_NODE && blockTags.has(child.tagName)){
        const value=blockText(child);
        if(out && !out.endsWith('\n'))out+='\n';
        out+=value;
        if(child!==children[children.length-1] && !out.endsWith('\n'))out+='\n';
      }else{
        out+=inlineText(child);
      }
    }
    return out;
  }

  function blockText(block){
    const value=inlineText(block);
    // A blank Lexical paragraph is commonly rendered as <p><br></p>. The BR
    // marks the empty paragraph itself; it must not become an extra blank line.
    if(!value.replace(/\n/g,'').length)return '';
    return value.replace(/\n$/,'');
  }

  const children=Array.from(root.childNodes);
  const hasDirectBlocks=children.some(node=>node.nodeType===Node.ELEMENT_NODE && blockTags.has(node.tagName));
  if(!hasDirectBlocks)return normalizeLineEndings(inlineText(root));

  const parts=[];
  let inlineBuffer='';
  function flushInline(){
    if(inlineBuffer!==''){parts.push(inlineBuffer);inlineBuffer='';}
  }
  for(const node of children){
    if(node.nodeType===Node.ELEMENT_NODE && blockTags.has(node.tagName)){
      flushInline();
      parts.push(blockText(node));
    }else{
      inlineBuffer+=inlineText(node);
    }
  }
  flushInline();
  return normalizeLineEndings(parts.join('\n'));
}

function arrangementSemanticText(v){
  return normText(v)
    // Suno/Lexical may collapse the whitespace separating adjacent
    // bracketed arrangement sections. Treat only that boundary as equivalent.
    .replace(/\]\s+\[/g,'][')
    .replace(/\s+/g,' ')
    .trim();
}

function arrangementEquivalent(actual,expected){
  return arrangementSemanticText(actual)===arrangementSemanticText(expected);
}

function rendered(el){
  if(!el || !el.isConnected) return false;
  const s=getComputedStyle(el);
  if(
    s.display==='none' ||
    s.visibility==='hidden' ||
    Number(s.opacity)===0
  ) return false;

  const r=el.getBoundingClientRect();
  return r.width>2 && r.height>2;
}

function visible(el){
  if(!rendered(el)) return false;
  const r=el.getBoundingClientRect();
  return (
    r.bottom>0 &&
    r.right>0 &&
    r.top<innerHeight &&
    r.left<innerWidth
  );
}

function describeElement(el){
  if(!el) return null;
  const attrs = {};
  ['data-testid','data-lexical-editor','placeholder','maxlength','aria-label','role','contenteditable','aria-expanded','data-state'].forEach(k => {
    const v = el.getAttribute && el.getAttribute(k); if(v != null) attrs[k] = v;
  });
  return {tag:el.tagName,id:el.id||null,className:str(el.className).slice(0,300),isContentEditable:!!el.isContentEditable,attrs};
}

function contextText(el,depth=3){
  let n=el, out=[];
  for(let i=0;n && i<depth;i++,n=n.parentElement){
    out.push(str(n.getAttribute&&n.getAttribute('aria-label')),str(n.getAttribute&&n.getAttribute('placeholder')),str(n.innerText));
  }
  return out.join(' ').toLowerCase().slice(0,1500);
}

function queryVisible(selectors){
  for(const selector of selectors){
    const nodes=Array.from(document.querySelectorAll(selector));
    const v=nodes.find(visible);
    if(v)return v;
  }
  return null;
}

function queryRendered(selectors){
  for(const selector of selectors){
    const nodes=Array.from(document.querySelectorAll(selector));
    const v=nodes.find(rendered);
    if(v)return v;
  }
  return null;
}

function semanticFieldText(el){
  if(!el)return '';
  return (
    str(el.getAttribute&&el.getAttribute('data-testid'))+' '+
    str(el.getAttribute&&el.getAttribute('aria-label'))+' '+
    str(el.getAttribute&&el.getAttribute('placeholder'))+' '+
    str(el.getAttribute&&el.getAttribute('name'))+' '+
    str(el.id)+' '+
    contextText(el,4)
  ).toLowerCase();
}

function findTitle(){
  const direct=queryRendered([
    'input[data-testid="song-title-input"]',
    'input[data-testid*="song-title" i]',
    'input[data-testid*="title" i]',
    'input[aria-label*="song title" i]',
    'input[aria-label*="song-titel" i]',
    'input[aria-label*="songtitel" i]',
    'input[aria-label="title" i]',
    'input[aria-label="titel" i]',
    'input[placeholder*="song title" i]',
    'input[placeholder*="song-titel" i]',
    'input[placeholder*="songtitel" i]',
    'input[placeholder="Title" i]',
    'input[placeholder="Titel" i]',
    'input[name*="title" i]',
    'input[name*="titel" i]'
  ]);
  if(direct)return direct;

  const candidates=Array.from(document.querySelectorAll(
    'input:not([type="hidden"]),textarea'
  )).filter(rendered);

  let best=null;
  let bestScore=-999;

  for(const el of candidates){
    const t=semanticFieldText(el);
    let score=0;

    if(/song[\s_-]*(?:title|titel)/.test(t))score+=20;
    if(/\b(?:title|titel)\b/.test(t))score+=8;
    if(/optional/.test(t))score+=2;

    if(/search|workspace|clip|filter|exclude|style|lyrics|cowriter|prompt/.test(t)){
      score-=16;
    }

    if(el.tagName==='INPUT')score+=2;

    if(score>bestScore){
      bestScore=score;
      best=el;
    }
  }

  return bestScore>=8?best:null;
}

function findStyles(){
  return queryRendered([
    'textarea[data-testid="styles-textarea"]',
    '[data-testid="create-form-styles-wrapper"] textarea',
    'textarea[maxlength="1000"][placeholder*="harmony" i]',
    'textarea[aria-label*="style" i]',
    'textarea[placeholder*="style" i]'
  ]);
}

function findExclude(){
  const direct=queryRendered([
    'input[placeholder="Exclude styles"]',
    'textarea[placeholder="Exclude styles"]',
    'input[placeholder="Stile ausschließen"]',
    'textarea[placeholder="Stile ausschließen"]',
    'input[aria-label*="Exclude" i]',
    'textarea[aria-label*="Exclude" i]',
    'input[aria-label*="ausschließ" i]',
    'textarea[aria-label*="ausschließ" i]',
    'input[placeholder*="Exclude" i]',
    'textarea[placeholder*="Exclude" i]',
    'input[placeholder*="ausschließ" i]',
    'textarea[placeholder*="ausschließ" i]'
  ]);
  if(direct)return direct;

  // Suno sometimes renders Exclude Styles without a useful stable selector.
  // Structurally it sits immediately before the Vocal Gender row inside More Options.
  try{
    const genderRow=advancedRow('Vocal Gender');
    if(genderRow&&genderRow.parentElement){
      const siblings=Array.from(genderRow.parentElement.children);
      const genderIndex=siblings.indexOf(genderRow);
      for(let i=genderIndex-1;i>=0;i--){
        const field=Array.from(siblings[i].querySelectorAll('input:not([type="range"]),textarea,[contenteditable="true"]')).find(rendered);
        if(field)return field;
      }
    }
  }catch(_){}
  return null;
}

function findLyrics(){
  const direct=queryRendered([
    'textarea[data-testid="lyrics-textarea"]',
    '[data-testid*="lyrics" i] textarea',
    '[data-testid*="lyrics" i] [contenteditable]:not([contenteditable="false"])',
    '.lyrics-editor-content[contenteditable]:not([contenteditable="false"])',
    '[aria-label*="lyrics" i][contenteditable]:not([contenteditable="false"])',
    '[aria-label*="lyrics" i][role="textbox"]',
    '[data-lexical-editor="true"][contenteditable]:not([contenteditable="false"])',
    '[contenteditable]:not([contenteditable="false"])[role="textbox"]',
    'textarea[aria-label*="lyrics" i]',
    'textarea[placeholder*="lyrics" i]',
    'textarea[placeholder*="leave this empty for instrumental" i]'
  ]);

  if(direct){
    const t=semanticFieldText(direct);
    if(!/cowriter|style|exclude|negative|search|title/.test(t)){
      return direct;
    }
  }

  const candidates=Array.from(document.querySelectorAll(
    'textarea,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'
  )).filter(rendered);

  let best=null;
  let bestScore=-999;

  for(const el of candidates){
    const t=semanticFieldText(el);
    let score=0;

    if(/\blyrics?\b/.test(t)) score+=24;
    if(/lyrics[\s_-]*editor/.test(t)) score+=10;
    if(/song[\s_-]*text/.test(t)) score+=8;
    if(/leave this empty for instrumental/.test(t)) score+=18;
    if(el.isContentEditable || el.getAttribute('contenteditable')) score+=3;
    if(el.getAttribute('data-lexical-editor')==='true') score+=4;

    if(/cowriter|style|exclude|negative|search|title/.test(t)){
      score-=20;
    }

    if(score>bestScore){
      bestScore=score;
      best=el;
    }
  }

  return bestScore>=8?best:null;
}

function findLyricsPlaceholder(){
  const attrMatch=queryRendered([
    '[data-placeholder*="start writing lyrics" i]',
    '[data-placeholder*="leave this empty for instrumental" i]',
    '[aria-placeholder*="start writing lyrics" i]',
    '[aria-placeholder*="leave this empty for instrumental" i]',
    '[placeholder*="start writing lyrics" i]',
    '[placeholder*="leave this empty for instrumental" i]'
  ]);

  if(attrMatch)return attrMatch;

  // Current Suno can render the Lyrics empty-state as ordinary text before
  // the actual editor node is mounted. Find only small rendered text nodes
  // containing the exact empty-state language.
  const nodes=Array.from(document.querySelectorAll(
    'p,span,div'
  )).filter(function(el){
    if(!rendered(el))return false;
    if(el.children && el.children.length>8)return false;

    const text=normText(el.innerText||el.textContent||'').toLowerCase();

    return (
      text.includes('start writing lyrics') ||
      text.includes('leave this empty for instrumental')
    );
  });

  // Prefer the smallest matching node, not a large ancestor section.
  nodes.sort(function(a,b){
    const ar=a.getBoundingClientRect();
    const br=b.getBoundingClientRect();
    return (ar.width*ar.height)-(br.width*br.height);
  });

  return nodes[0]||null;
}

function lyricsSectionLooksOpen(placeholder){
  if(!placeholder || !rendered(placeholder))return false;

  // We never click a collapsed "Lyrics" header. A rendered empty-state
  // message inside the body is treated as proof that the body is already open.
  const rect=placeholder.getBoundingClientRect();
  return rect.width>20 && rect.height>5;
}

async function prepareLyricsField(){
  let lyrics=findLyrics();
  if(lyrics)return {
    element:lyrics,
    activated:false,
    placeholder:null
  };

  const placeholder=findLyricsPlaceholder();

  if(!lyricsSectionLooksOpen(placeholder)){
    return {
      element:null,
      activated:false,
      placeholder:describeElement(placeholder),
      reason:'lyrics editor not found and open Lyrics empty-state not visible'
    };
  }

  // The Lyrics body is already open. Clicking/focusing the EMPTY BODY is safe:
  // this initializes Suno's editor; it does NOT toggle/open the Lyrics section,
  // Styles panel, or Advanced Options.
  try{
    placeholder.dispatchEvent(new PointerEvent('pointerdown',{
      bubbles:true,
      pointerType:'mouse',
      isPrimary:true,
      button:0
    }));
  }catch(_){}

  try{
    placeholder.dispatchEvent(new MouseEvent('mousedown',{
      bubbles:true,
      button:0
    }));
  }catch(_){}

  try{
    placeholder.click();
  }catch(_){}

  try{
    placeholder.focus({preventScroll:true});
  }catch(_){
    try{placeholder.focus();}catch(__){}
  }

  // Suno may mount the editor asynchronously after the first interaction.
  for(const wait of [24,48,90,160,280]){
    await sleep(wait);
    lyrics=findLyrics();
    if(lyrics){
      return {
        element:lyrics,
        activated:true,
        placeholder:describeElement(placeholder)
      };
    }
  }

  return {
    element:null,
    activated:true,
    placeholder:describeElement(placeholder),
    reason:'Lyrics empty-state was visible and activated, but no editable node appeared'
  };
}

function findInstrumental(){
  const explicit = queryVisible([
    'button[data-testid*="instrumental" i]',
    '[role="switch"][aria-label*="instrumental" i]',
    'button[aria-label*="instrumental" i]'
  ]);
  if(explicit) return explicit;
  const buttons = Array.from(document.querySelectorAll('button,[role="switch"]')).filter(visible);
  return buttons.find(b => {
    const t=(str(b.getAttribute('aria-label'))+' '+str(b.innerText)).toLowerCase();
    return /instrumental/.test(t) && !/add voice/.test(t);
  }) || null;
}

function instrumentalState(el){
  if(!el) return null;
  const pressed = el.getAttribute('aria-pressed'); if(pressed === 'true') return true; if(pressed === 'false') return false;
  const checked = el.getAttribute('aria-checked'); if(checked === 'true') return true; if(checked === 'false') return false;
  const t=(str(el.getAttribute('aria-label'))+' '+str(el.innerText)).toLowerCase();
  if(/add voice/.test(t)) return true;
  if(/instrumental/.test(t) && /on|enabled|active/.test(t)) return true;
  if(/instrumental/.test(t) && /off|disabled/.test(t)) return false;
  return null;
}

function closedStateOnNode(node){
  if(!node || node.nodeType!==1) return false;

  if(node.hidden || node.hasAttribute('inert')) return true;
  if(node.getAttribute('aria-hidden')==='true') return true;

  const ariaExpanded=node.getAttribute('aria-expanded');
  if(ariaExpanded==='false') return true;

  const ds=str(node.getAttribute('data-state')).toLowerCase();
  if(ds==='closed'||ds==='collapsed') return true;

  const dop=str(node.getAttribute('data-open')).toLowerCase();
  if(dop==='false') return true;

  const de=str(node.getAttribute('data-expanded')).toLowerCase();
  if(de==='false') return true;

  return /\b(collapsed|is-collapsed|panel-closed)\b/i.test(str(node.className));
}

function explicitOpenStateOnNode(node){
  if(!node || node.nodeType!==1) return null;

  const ariaExpanded=node.getAttribute('aria-expanded');
  if(ariaExpanded==='true') return true;
  if(ariaExpanded==='false') return false;

  const ds=str(node.getAttribute('data-state')).toLowerCase();
  if(ds==='open'||ds==='expanded') return true;
  if(ds==='closed'||ds==='collapsed') return false;

  const dop=str(node.getAttribute('data-open')).toLowerCase();
  if(dop==='true') return true;
  if(dop==='false') return false;

  const de=str(node.getAttribute('data-expanded')).toLowerCase();
  if(de==='true') return true;
  if(de==='false') return false;

  return null;
}

function linkedExpansionControlState(container,labelPattern){
  if(!container) return null;

  // Most reliable path: a control explicitly owns this container.
  if(container.id){
    let controls=[];
    try{
      controls=Array.from(document.querySelectorAll(
        '[aria-controls="'+CSS.escape(container.id)+'"]'
      ));
    }catch(_){}

    for(const control of controls){
      const text=(
        str(control.getAttribute('aria-label'))+' '+
        str(control.innerText)
      ).toLowerCase();

      if(labelPattern && !labelPattern.test(text)) continue;

      const state=explicitOpenStateOnNode(control);
      if(state!==null) return state;
    }
  }

  // Second-best: a nearby control whose own label clearly names the section.
  const parent=container.parentElement;
  if(parent){
    let controls=[];
    try{
      controls=Array.from(parent.querySelectorAll(
        ':scope > button[aria-expanded],'+
        ':scope > [role="button"][aria-expanded]'
      ));
    }catch(_){}

    for(const control of controls){
      const text=(
        str(control.getAttribute('aria-label'))+' '+
        str(control.innerText)
      ).toLowerCase();

      if(labelPattern && !labelPattern.test(text)) continue;

      const state=explicitOpenStateOnNode(control);
      if(state!==null) return state;
    }
  }

  return null;
}

function fieldVisibleAndEnabled(el){
  if(!el || !rendered(el)) return false;
  if(el.disabled) return false;
  if(el.getAttribute('aria-disabled')==='true') return false;

  // Only inspect the field itself and immediate semantic containers.
  // Do NOT treat unrelated higher ancestors as panel state.
  if(closedStateOnNode(el)) return false;

  const details=el.closest('details');
  if(details && !details.open) return false;

  return true;
}

function stylesPanelSnapshot(el){
  const wrapper=el&&el.closest
    ? el.closest('[data-testid="create-form-styles-wrapper"]')
    : null;

  const wrapperState=wrapper?explicitOpenStateOnNode(wrapper):null;
  const linkedState=wrapper
    ? linkedExpansionControlState(
        wrapper,
        /styles?|style of music|describe the style|describe the sound/i
      )
    : null;

  return {
    fieldVisible:!!(el&&rendered(el)),
    fieldEnabled:!!(el&&!el.disabled&&el.getAttribute('aria-disabled')!=='true'),
    fieldRect:el?(()=>{
      const r=el.getBoundingClientRect();
      return {
        width:Math.round(r.width),
        height:Math.round(r.height),
        top:Math.round(r.top),
        left:Math.round(r.left)
      };
    })():null,
    wrapperFound:!!wrapper,
    wrapperState:wrapperState,
    linkedControlState:linkedState,
    wrapper:describeElement(wrapper)
  };
}

function advancedPanelSnapshot(el){
  const details=el&&el.closest?el.closest('details'):null;

  return {
    fieldVisible:!!(el&&rendered(el)),
    fieldEnabled:!!(el&&!el.disabled&&el.getAttribute('aria-disabled')!=='true'),
    fieldRect:el?(()=>{
      const r=el.getBoundingClientRect();
      return {
        width:Math.round(r.width),
        height:Math.round(r.height),
        top:Math.round(r.top),
        left:Math.round(r.left)
      };
    })():null,
    detailsFound:!!details,
    detailsOpen:details?!!details.open:null
  };
}

function stylesPanelIsOpen(el){
  if(!fieldVisibleAndEnabled(el)) return false;

  const wrapper=el.closest('[data-testid="create-form-styles-wrapper"]');

  if(wrapper){
    // Only an explicit state on the actual Styles wrapper/control may
    // override a visibly rendered Styles field.
    const wrapperState=explicitOpenStateOnNode(wrapper);
    if(wrapperState===false) return false;

    const linkedState=linkedExpansionControlState(
      wrapper,
      /styles?|style of music|describe the style|describe the sound/i
    );
    if(linkedState===false) return false;
  }

  // No geometry threshold, no elementFromPoint test.
  // Suno's open Styles textarea can legitimately be compact.
  return true;
}

function advancedOptionsIsOpen(el){
  if(!fieldVisibleAndEnabled(el)) return false;

  // The Exclude field itself is the reliable proof that Advanced Options is
  // currently rendered. We deliberately do not inspect unrelated ancestors.
  return true;
}

function pageSetter(el){
  const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:el instanceof HTMLInputElement?HTMLInputElement.prototype:null;
  return proto?Object.getOwnPropertyDescriptor(proto,'value')?.set:null;
}
async function fillPlain(el,value,options={}){
  if(!el) return {ok:false,reason:'field not found'};
  const text=str(value), setter=pageSetter(el);
  if(options.focus!==false) el.focus();
  if(setter) setter.call(el,text); else el.value=text;
  el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));
  el.dispatchEvent(new Event('change',{bubbles:true}));

  // Fast path: native inputs normally update synchronously. Only yield when
  // Suno/React has not reconciled the expected value yet.
  let actual=str(el.value);
  let ok=actual===text || semText(actual)===semText(text);

  // Confirm across one short reconciliation window so a controlled React
  // input cannot briefly match and then revert after we report success.
  await sleep(18);
  actual=str(el.value);
  ok=actual===text || semText(actual)===semText(text);
  if(!ok){
    await sleep(18);
    actual=str(el.value);
    ok=actual===text || semText(actual)===semText(text);
  }
  return {ok,strict:actual===text,semantic:semText(actual)===semText(text),expectedLength:text.length,actualLength:actual.length,element:describeElement(el),method:'native value setter + input/change · stable fast verify'};
}

async function fillRich(el,value){
  if(!el)return {ok:false,reason:'field not found'};

  const text=normalizeLineEndings(value);
  const attempts=[];

  function structuralText(root){
    const blockTags=new Set(['DIV','P','LI','UL','OL','BLOCKQUOTE','PRE','H1','H2','H3','H4','H5','H6']);
    let out='';

    function walk(node){
      if(!node)return;
      if(node.nodeType===Node.TEXT_NODE){
        out+=node.nodeValue||'';
        return;
      }
      if(node.nodeType!==Node.ELEMENT_NODE)return;

      const tag=node.tagName;
      if(tag==='BR'){
        out+='\n';
        return;
      }

      const isBlock=blockTags.has(tag);
      const startLength=out.length;
      for(const child of node.childNodes)walk(child);

      // Lexical/Suno commonly represents Enter as separate paragraph/block
      // nodes. textContent flattens those boundaries, so explicitly recover
      // one line break between rendered blocks for verification.
      if(isBlock && out.length>startLength && !out.endsWith('\n'))out+='\n';
    }

    for(const child of root.childNodes)walk(child);
    return normText(out);
  }

  function currentText(){
    const inner=normText(el.innerText||'');
    const structured=structuralText(el);
    const flat=normText(el.textContent||'');
    const expected=normalizeLines(text);
    const expectedBreaks=(expected.match(/\n/g)||[]).length;
    const candidates=[];

    for(const candidate of [structured,inner,flat]){
      if(candidate && !candidates.includes(candidate))candidates.push(candidate);
    }

    // If any DOM representation exactly preserves the stored line structure,
    // use it. This avoids Chrome's innerText quirk where paragraph elements
    // can produce two newline characters even though the editor represents a
    // single Enter between lines.
    const exact=candidates.find(candidate=>normalizeLines(candidate)===expected);
    if(exact)return exact;

    // Otherwise prefer a semantically equivalent representation whose line
    // count is closest to the source. This makes diagnostics useful even when
    // Suno temporarily renders a different block shape during reconciliation.
    const semanticCandidates=candidates.filter(candidate=>semText(candidate)===semText(text));
    const pool=semanticCandidates.length?semanticCandidates:candidates;
    pool.sort((a,b)=>{
      const aBreaks=(normalizeLines(a).match(/\n/g)||[]).length;
      const bBreaks=(normalizeLines(b).match(/\n/g)||[]).length;
      return Math.abs(aBreaks-expectedBreaks)-Math.abs(bBreaks-expectedBreaks);
    });

    return pool[0]||'';
  }

  function normalizeLines(v){
    return str(v)
      .replace(/\r\n?/g,'\n')
      .split('\n')
      .map(line=>line.replace(/[ \t]+$/g,''))
      .join('\n')
      .trim();
  }

  function verifyValue(actual){
    const expectedLines=normalizeLines(text);
    const actualLines=normalizeLines(actual);
    const lineStructureMatch=actualLines===expectedLines;
    const expectsNewlines=expectedLines.includes('\n');
    const normalSemantic=semText(actual)===semText(text);
    const bracketBoundarySemantic=!expectsNewlines&&arrangementEquivalent(actual,text);

    return {
      actual:actual,
      ok:lineStructureMatch||normalSemantic||bracketBoundarySemantic,
      strict:actual===text,
      lineStructureMatch:lineStructureMatch,
      normalSemantic:normalSemantic,
      bracketBoundarySemantic:bracketBoundarySemantic,
      expectedNewlines:(expectedLines.match(/\n/g)||[]).length,
      actualNewlines:(actualLines.match(/\n/g)||[]).length,
      lengthDelta:text.length-actual.length
    };
  }

  async function focusEditor(){
    try{
      el.focus({preventScroll:true});
    }catch(_){
      try{el.focus();}catch(__){}
    }
    // Focus is synchronous in the common path; one short yield is enough for
    // framework editors without adding a visible fixed delay.
    await sleep(8);
  }

  async function selectAllInsideEditor(){
    await focusEditor();

    try{
      document.execCommand('selectAll',false,null);
    }catch(_){}

    await sleep(8);

    const sel=getSelection();

    if(
      !sel ||
      !sel.rangeCount ||
      !el.contains(sel.anchorNode) ||
      !el.contains(sel.focusNode)
    ){
      try{
        const range=document.createRange();
        range.selectNodeContents(el);
        sel.removeAllRanges();
        sel.addRange(range);
      }catch(_){}
    }

    try{
      document.dispatchEvent(new Event('selectionchange'));
    }catch(_){}

    await sleep(8);
  }

  async function waitForEmpty(timeoutMs){
    const started=Date.now();
    let actual=currentText();

    while(Date.now()-started<timeoutMs){
      if(semText(actual)===''){
        // Confirm once after a tiny reconciliation window. This replaces the
        // previous unconditional 90 ms settle pause.
        await sleep(22);
        actual=currentText();
        if(semText(actual)===''){
          return {empty:true,actual:actual,elapsedMs:Date.now()-started};
        }
      }

      await sleep(32);
      actual=currentText();
    }

    return {empty:semText(actual)==='',actual:actual,elapsedMs:Date.now()-started};
  }

  async function waitForExpected(timeoutMs){
    const started=Date.now();
    let actual=currentText();
    let verified=verifyValue(actual);

    while(Date.now()-started<timeoutMs){
      if(verified.ok){
        // One short stability sample catches editor reconciliation/reverts
        // without the old fixed 120 ms paste delay.
        await sleep(22);
        actual=currentText();
        const stable=verifyValue(actual);
        if(stable.ok)return Object.assign(stable,{elapsedMs:Date.now()-started});
        verified=stable;
      }
      await sleep(32);
      actual=currentText();
      verified=verifyValue(actual);
    }

    return Object.assign(verified,{elapsedMs:Date.now()-started});
  }

  async function clearEditor(label){
    const before=currentText();
    await selectAllInsideEditor();

    let deleteExec=false;
    try{deleteExec=document.execCommand('delete',false,null);}catch(_){}
    let clearResult=await waitForEmpty(520);

    attempts.push({
      phase:label,
      method:'focus + selectAll + execCommand(delete) + settle',
      execResult:deleteExec,
      beforeLength:before.length,
      afterLength:clearResult.actual.length,
      elapsedMs:clearResult.elapsedMs,
      cleared:clearResult.empty
    });

    if(clearResult.empty)return clearResult;

    await selectAllInsideEditor();
    let beforeInputResult=null;
    try{
      beforeInputResult=el.dispatchEvent(new InputEvent('beforeinput',{
        bubbles:true,cancelable:true,composed:true,inputType:'deleteContentBackward',data:null
      }));
    }catch(_){}
    try{document.execCommand('delete',false,null);}catch(_){}

    clearResult=await waitForEmpty(760);
    attempts.push({
      phase:label+'-fallback',
      method:'beforeinput(deleteContentBackward) + execCommand(delete) + settle',
      dispatchResult:beforeInputResult,
      afterLength:clearResult.actual.length,
      elapsedMs:clearResult.elapsedMs,
      cleared:clearResult.empty
    });
    return clearResult;
  }

  async function pastePlainText(textValue){
    let dataTransfer=null;
    let pasteDispatched=null;
    let beforeInputDispatched=null;
    let error=null;

    try{
      dataTransfer=new DataTransfer();
      dataTransfer.setData('text/plain',String(textValue));
      dataTransfer.setData('text',String(textValue));
    }catch(err){
      error='DataTransfer: '+(err?.message||String(err));
    }

    if(dataTransfer){
      try{
        // Lexical-backed editors process their paste command from the paste
        // event and preserve plain-text newlines as editor paragraphs. Unlike
        // direct DOM HTML mutation, this updates the editor's own state.
        pasteDispatched=el.dispatchEvent(new ClipboardEvent('paste',{
          bubbles:true,
          cancelable:true,
          composed:true,
          clipboardData:dataTransfer
        }));
      }catch(err){
        error=(error?error+'; ':'')+'ClipboardEvent: '+(err?.message||String(err));
      }

      // Observe the editor immediately and only wait while it is still empty.
      // This keeps the normal Lexical paste path near-instant while preserving
      // the beforeinput fallback for slower/reconciled editor builds.
      let afterPaste=currentText();
      const pasteStarted=Date.now();
      while(semText(afterPaste)==='' && Date.now()-pasteStarted<110){
        await sleep(18);
        afterPaste=currentText();
      }

      // Some contenteditables listen to beforeinput instead of paste. Only
      // send that semantic event when the paste event produced no content.
      if(semText(afterPaste)===''){
        try{
          beforeInputDispatched=el.dispatchEvent(new InputEvent('beforeinput',{
            bubbles:true,
            cancelable:true,
            composed:true,
            inputType:'insertFromPaste',
            data:String(textValue),
            dataTransfer:dataTransfer
          }));
        }catch(err){
          error=(error?error+'; ':'')+'beforeinput(insertFromPaste): '+(err?.message||String(err));
        }
      }
    }

    return {pasteDispatched,beforeInputDispatched,error};
  }

  async function insertParagraphBreak(){
    let beforeInputResult=null;
    let execResult=false;
    let handledByBeforeInput=false;
    const beforeHtml=el.innerHTML;

    try{
      beforeInputResult=el.dispatchEvent(new InputEvent('beforeinput',{
        bubbles:true,
        cancelable:true,
        composed:true,
        inputType:'insertParagraph',
        data:null
      }));
    }catch(_){}

    // A framework editor can consume beforeinput and update its model itself.
    // Detect an actual DOM change rather than assuming preventDefault means it
    // inserted a break; that prevents both missing breaks and double breaks.
    await sleep(8);
    handledByBeforeInput=el.innerHTML!==beforeHtml;

    if(!handledByBeforeInput){
      // Suno currently ignores insertLineBreak, but insertParagraph is the
      // semantic Enter operation expected by rich text editors. execCommand
      // also produces the browser input event that keeps editor state in sync.
      try{execResult=document.execCommand('insertParagraph',false,null);}catch(_){}
    }else{
      execResult=true;
    }

    return {beforeInputResult,handledByBeforeInput,execResult};
  }

  async function insertLinewiseParagraphs(textValue){
    const lines=String(textValue).replace(/\r\n?/g,'\n').split('\n');
    let textExecOk=true;
    let paragraphExecOk=true;
    let paragraphCount=0;

    for(let i=0;i<lines.length;i++){
      if(lines[i]){
        try{
          if(!document.execCommand('insertText',false,lines[i]))textExecOk=false;
        }catch(_){textExecOk=false;}
      }

      if(i<lines.length-1){
        const br=await insertParagraphBreak();
        paragraphCount++;
        if(!br.execResult)paragraphExecOk=false;
      }
    }

    return {ok:textExecOk&&paragraphExecOk,textExecOk,paragraphExecOk,paragraphCount};
  }

  const before=currentText();
  const cleared=await clearEditor('clear');

  if(!cleared.empty){
    return {
      ok:false,strict:false,semantic:false,
      reason:'existing Lyrics content could not be cleared safely; insertion aborted to prevent duplication',
      expectedLength:text.length,actualLength:cleared.actual.length,beforeLength:before.length,
      element:describeElement(el),attempts:attempts,method:'verified clear before replace'
    };
  }

  // Primary path: give Suno/Lexical a real plain-text paste payload. This is
  // deliberately not insertHTML: React/Lexical can reconcile direct DOM HTML
  // back to empty state because its internal editor model was never updated.
  await focusEditor();
  const pasteResult=await pastePlainText(text);
  let verified=await waitForExpected(1550);

  attempts.push({
    phase:'insert',
    method:'synthetic plain-text paste + beforeinput(insertFromPaste)',
    pasteDispatchResult:pasteResult.pasteDispatched,
    beforeInputDispatchResult:pasteResult.beforeInputDispatched,
    error:pasteResult.error,
    expectedLength:text.length,
    actualLength:verified.actual.length,
    expectedNewlines:verified.expectedNewlines,
    actualNewlines:verified.actualNewlines,
    lineStructureMatch:verified.lineStructureMatch,
    normalSemantic:verified.normalSemantic,
    bracketBoundarySemantic:verified.bracketBoundarySemantic,
    lengthDelta:verified.lengthDelta,
    elapsedMs:verified.elapsedMs,
    ok:verified.ok
  });

  // No destructive second insertion pass. If the primary editor-native
  // paste cannot be verified, report the failure and leave Suno untouched.
  // This prevents the visible paste → clear → line-by-line reinsert cycle.

  return {
    ok:verified.ok,
    strict:verified.strict,
    semantic:verified.ok,
    lineStructureMatch:verified.lineStructureMatch,
    normalSemantic:verified.normalSemantic,
    bracketBoundarySemantic:verified.bracketBoundarySemantic,
    expectedNewlines:verified.expectedNewlines,
    actualNewlines:verified.actualNewlines,
    expectedLength:text.length,
    actualLength:verified.actual.length,
    lengthDelta:verified.lengthDelta,
    beforeLength:before.length,
    element:describeElement(el),
    attempts:attempts,
    method:'verified clear → single editor-native paste · no destructive retry'
  };
}
async function fillField(el,value,options={}){
  if(!el)return {ok:false,reason:'field not found'};

  const ce=el.getAttribute&&el.getAttribute('contenteditable');

  if(
    el.isContentEditable ||
    (ce!=null && ce!=='false')
  ){
    return fillRich(el,value);
  }

  return fillPlain(el,value,options);
}

function discoveryCandidates(){
  const nodes=Array.from(document.querySelectorAll(
    'input:not([type="hidden"]),textarea,[contenteditable="true"],[role="textbox"]'
  )).filter(rendered);

  return nodes.slice(0,80).map(function(el){
    const r=el.getBoundingClientRect();
    return {
      element:describeElement(el),
      rect:{
        width:Math.round(r.width),
        height:Math.round(r.height),
        top:Math.round(r.top),
        left:Math.round(r.left)
      },
      semantic:semanticFieldText(el).slice(0,450)
    };
  });
}


const ADVANCED_LABEL_ALIASES=Object.freeze({
  'More Options':['More Options','Weitere Optionen','Mehr Optionen'],
  'Vocal Gender':['Vocal Gender','Stimmgeschlecht'],
  'Duration':['Duration','Dauer'],
  'Max Mode':['Max Mode','Max-Modus','Max Modus'],
  'Weirdness':['Weirdness','Seltsamkeit'],
  'Style Influence':['Style Influence','Stileinfluss','Stil-Einfluss'],
  'Audio Influence':['Audio Influence','Audio-Einfluss','Audioeinfluss'],
  'Variety':['Variety','Vielfalt']
});
const ADVANCED_OPTION_ALIASES=Object.freeze({
  'Male':['Male','Männlich','Mannlich'],
  'Female':['Female','Weiblich'],
  'Auto':['Auto'],
  'Custom':['Custom','Benutzerdefiniert'],
  'Off':['Off','Aus'],
  'On':['On','An']
});
function advancedKey(value){
  return semText(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
}
function advancedAliases(label){
  return ADVANCED_LABEL_ALIASES[label]||[String(label||'')];
}
function advancedOptionAliases(label){
  return ADVANCED_OPTION_ALIASES[label]||[String(label||'')];
}
function advancedTextMatches(value,label,option=false){
  const key=advancedKey(value);
  const list=option?advancedOptionAliases(label):advancedAliases(label);
  return list.some(alias=>advancedKey(alias)===key);
}
function advancedSelected(el){
  if(!el)return false;
  const state=String(el.getAttribute('data-state')||'').toLowerCase();
  const cls=String(el.className||'').toLowerCase();
  return (
    el.getAttribute('data-selected')==='true'||
    el.getAttribute('aria-pressed')==='true'||
    el.getAttribute('aria-selected')==='true'||
    el.getAttribute('aria-checked')==='true'||
    ['on','checked','active','selected','open'].includes(state)||
    /(?:^|\s)(?:active|selected|checked)(?:\s|$)/.test(cls)||
    (el instanceof HTMLInputElement&&el.checked===true)
  );
}
function advancedExactText(label,root=document){
  const keys=new Set(advancedAliases(label).map(advancedKey));
  return Array.from(root.querySelectorAll('span,div,label,p,h1,h2,h3,button')).find(el=>rendered(el)&&keys.has(advancedKey(el.textContent)))||null;
}
function advancedRow(label,root=document){
  const labelEl=advancedExactText(label,root); if(!labelEl)return null;
  let node=labelEl;
  for(let i=0;i<8&&node&&node!==root&&node!==document.body;i++,node=node.parentElement){
    if(!(node instanceof Element))break;
    const hasControl=!!node.querySelector('button,input,[role="slider"],[role="switch"],[role="radio"],[role="checkbox"],textarea');
    if(hasControl&&semText(node.textContent).length<900)return node;
  }
  return null;
}
function advancedButton(row,label){
  if(!row)return null;
  return Array.from(row.querySelectorAll('button,[role="button"]')).filter(rendered).find(el=>advancedOptionAliases(label).some(alias=>advancedKey(el.textContent)===advancedKey(alias)))||null;
}
function advancedSlider(label){
  const aliases=new Set(advancedAliases(label).map(advancedKey));
  const sliders=Array.from(document.querySelectorAll('[role="slider"],input[type="range"]')).filter(rendered);
  const labeled=sliders.find(el=>aliases.has(advancedKey(el.getAttribute('aria-label')||el.getAttribute('name')||'')));
  if(labeled)return labeled;
  const row=advancedRow(label);
  return row?Array.from(row.querySelectorAll('[role="slider"],input[type="range"]')).find(rendered)||null:null;
}
function advancedSliderNumber(slider){
  if(!slider)return NaN;
  const aria=slider.getAttribute('aria-valuenow');
  if(aria!==null&&aria!=='')return Number(aria);
  if('value' in slider)return Number(slider.value);
  return NaN;
}
function advancedSliderMin(slider,fallback=0){
  const raw=slider&&(slider.getAttribute('aria-valuemin')??slider.getAttribute('min'));
  const n=Number(raw);return Number.isFinite(n)?n:fallback;
}
function advancedSliderMax(slider,fallback=100){
  const raw=slider&&(slider.getAttribute('aria-valuemax')??slider.getAttribute('max'));
  const n=Number(raw);return Number.isFinite(n)?n:fallback;
}
function advancedThumb(slider){
  if(!slider)return null;
  const direct=Array.from(slider.children).filter(el=>el instanceof HTMLElement&&!el.hasAttribute('data-tick-value')&&/(?:^|;)\s*left\s*:/i.test(el.getAttribute('style')||''));
  if(direct.length)return direct[direct.length-1];
  const positioned=Array.from(slider.querySelectorAll('div')).filter(el=>!el.hasAttribute('data-tick-value')&&/(?:^|;)\s*left\s*:/i.test(el.getAttribute('style')||''));
  return positioned[positioned.length-1]||null;
}
function advancedMouseEvent(type,x,y){
  return new MouseEvent(type,{bubbles:true,cancelable:true,composed:true,button:0,buttons:(type==='mousedown'||type==='mousemove')?1:0,clientX:x,clientY:y,screenX:x,screenY:y,view:window});
}
function nextFrame(){return new Promise(resolve=>requestAnimationFrame(resolve));}
async function advancedSetSlider(label,targetValue){
  let slider=advancedSlider(label); if(!slider)throw new Error(label+': slider not found');
  const min=advancedSliderMin(slider,0), max=advancedSliderMax(slider,100);
  const requested=Number(targetValue);
  if(!Number.isFinite(requested))throw new Error(label+': invalid target value');
  const target=Math.max(min,Math.min(max,requested));
  let current=advancedSliderNumber(slider); if(current===target)return true;
  slider.scrollIntoView({block:'nearest',inline:'nearest'});
  try{slider.focus({preventScroll:true});}catch(_){}
  await nextFrame();
  slider=advancedSlider(label); const thumb=advancedThumb(slider); current=advancedSliderNumber(slider);
  if(!slider||!thumb||!Number.isFinite(current))throw new Error(label+': slider grip not found');
  const tr=slider.getBoundingClientRect(),gr=thumb.getBoundingClientRect(),span=max-min||1;
  const startX=gr.width>0?gr.left+gr.width/2:tr.left+((current-min)/span)*tr.width;
  const startY=gr.height>0?gr.top+gr.height/2:tr.top+tr.height/2;
  const ratio=(target-min)/span;
  const targetX=Math.max(tr.left+.5,Math.min(tr.right-.5,tr.left+ratio*tr.width));
  const targetY=tr.top+tr.height/2;
  thumb.dispatchEvent(advancedMouseEvent('mouseover',startX,startY));
  thumb.dispatchEvent(advancedMouseEvent('mousedown',startX,startY));
  for(const t of [.5,.85,1]){
    thumb.dispatchEvent(advancedMouseEvent('mousemove',startX+(targetX-startX)*t,startY+(targetY-startY)*t));
    await nextFrame();
  }
  thumb.dispatchEvent(advancedMouseEvent('mouseup',targetX,targetY)); await nextFrame();
  let actual=advancedSliderNumber(advancedSlider(label));
  if(actual!==target&&Math.abs(actual-target)<=1){
    const fresh=advancedSlider(label),freshThumb=advancedThumb(fresh);
    if(fresh&&freshThumb){
      const fr=fresh.getBoundingClientRect(),fg=freshThumb.getBoundingClientRect();
      const sx=fg.left+fg.width/2,sy=fg.top+fg.height/2,tx=Math.max(fr.left+.5,Math.min(fr.right-.5,fr.left+ratio*fr.width));
      freshThumb.dispatchEvent(advancedMouseEvent('mousedown',sx,sy));
      freshThumb.dispatchEvent(advancedMouseEvent('mousemove',tx,sy)); await nextFrame();
      freshThumb.dispatchEvent(advancedMouseEvent('mouseup',tx,sy)); await nextFrame();
      actual=advancedSliderNumber(advancedSlider(label));
    }
  }
  if(actual!==target)throw new Error(label+': expected '+target+', got '+actual);
  return true;
}
async function advancedSetButton(rowLabel,targetLabel){
  const locate=()=>{const row=advancedRow(rowLabel);return {row,button:advancedButton(row,targetLabel)};};
  let found=locate();
  if(!found.row||!found.button)throw new Error(rowLabel+': option "'+targetLabel+'" not found');
  if(found.button.disabled||found.button.getAttribute('aria-disabled')==='true')throw new Error(rowLabel+': option "'+targetLabel+'" is disabled');
  if(!advancedSelected(found.button)){
    found.button.click();
    const ok=await advancedWaitFor(()=>{const fresh=locate().button;return fresh&&advancedSelected(fresh);},600,15);
    if(!ok)throw new Error(rowLabel+': selection did not stick');
  }
  return true;
}
function advancedSetNativeInput(input,value){
  const proto=input instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
  const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;
  if(setter)setter.call(input,String(value));else input.value=String(value);
  input.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:String(value)}));
  input.dispatchEvent(new Event('change',{bubbles:true}));
}
async function advancedWaitFor(fn,timeout=650,interval=18){
  const start=performance.now();
  while(performance.now()-start<timeout){
    try{const result=fn();if(result)return result;}catch(_){}
    await sleep(interval);
  }
  return null;
}
function advancedDurationInput(row){
  const local=row?Array.from(row.querySelectorAll('input:not([type="range"]),textarea')).filter(rendered):[];
  const global=Array.from(document.querySelectorAll('input:not([type="range"]),textarea')).filter(rendered);
  return [...local,...global].find(el=>{
    const label=advancedKey(el.getAttribute('aria-label')||el.getAttribute('name')||'');
    const value=String(el.value||'').trim();
    return label===advancedKey('Duration')||label===advancedKey('Dauer')||/^\d{1,2}:[0-5]\d$/.test(value);
  })||null;
}
async function advancedSetDuration(value){
  const raw=String(value||'').trim(); if(!raw)return true;
  let row=advancedRow('Duration'); if(!row)throw new Error('Duration: row not found');
  if(/^auto$/i.test(raw)){return advancedSetButton('Duration','Auto');}
  const m=raw.match(/^(\d{1,2}):([0-5]\d)$/); if(!m)throw new Error('Duration: expected AUTO or M:SS');
  const seconds=Number(m[1])*60+Number(m[2]);
  const normalized=String(Number(m[1]))+':'+m[2];
  const custom=advancedButton(row,'Custom');
  if(custom&&!advancedSelected(custom)){
    custom.click();
    await advancedWaitFor(()=>advancedDurationInput(advancedRow('Duration'))||advancedSlider('Duration'),500,15);
    row=advancedRow('Duration')||row;
  }
  let input=advancedDurationInput(row);
  if(input){
    input.focus({preventScroll:true});
    try{input.select?.();}catch(_){}
    advancedSetNativeInput(input,normalized);
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}));
    await sleep(55);
    const slider=advancedSlider('Duration');
    const actualSeconds=advancedSliderNumber(slider);
    const actualText=String(advancedDurationInput(advancedRow('Duration'))?.value||'').trim();
    if(actualText===normalized&&(!slider||actualSeconds===seconds))return true;
  }
  await advancedSetSlider('Duration',seconds);
  input=advancedDurationInput(advancedRow('Duration'));
  const ok=await advancedWaitFor(()=>{
    const slider=advancedSlider('Duration');
    const actualSeconds=advancedSliderNumber(slider);
    const actualText=String(input?.value||'').trim();
    return actualSeconds===seconds&&(!input||actualText===normalized);
  },500,15);
  if(!ok)throw new Error('Duration: expected '+normalized+' / '+seconds+'s');
  return true;
}
function advancedOptionsHeader(){
  const aliases=advancedAliases('More Options').map(advancedKey);
  return Array.from(document.querySelectorAll('[role="button"],button')).filter(rendered).find(el=>{
    const key=advancedKey(semText(el.textContent));
    return aliases.some(alias=>key===alias||key.startsWith(alias));
  })||null;
}
async function ensureAdvancedOptionsOpen(){
  let header=advancedOptionsHeader();
  let controlsVisible=!!(advancedRow('Vocal Gender')||advancedRow('Duration')||advancedSlider('Weirdness')||advancedSlider('Style Influence'));
  if(!header){
    return {header:null,wasOpen:controlsVisible,opened:false,controlsVisible};
  }
  const expanded=header.getAttribute('aria-expanded');
  const wasOpen=expanded==='true'||controlsVisible;
  if(!wasOpen){
    header.click();
    const ready=await advancedWaitFor(()=>advancedRow('Vocal Gender')||advancedRow('Duration')||advancedSlider('Weirdness')||advancedSlider('Style Influence'),900,18);
    if(!ready)throw new Error('More Options opened, but controls were not found');
    controlsVisible=true;
    header=advancedOptionsHeader()||header;
  }
  return {header,wasOpen,opened:!wasOpen,controlsVisible};
}
function advancedVisualSelected(buttons){
  const entries=buttons.map(button=>{
    let bg='';
    try{bg=getComputedStyle(button).backgroundColor||'';}catch(_){}
    const transparent=!bg||bg==='transparent'||bg==='rgba(0, 0, 0, 0)';
    return {button,bg,transparent};
  });
  const filled=entries.filter(x=>!x.transparent);
  if(filled.length===1)return filled[0].button;
  return null;
}
function advancedReadChoice(row,canonicalOptions){
  if(!row)return '';
  const buttons=Array.from(row.querySelectorAll('button,[role="button"],input[type="radio"]')).filter(rendered);
  const recognized=[];
  for(const button of buttons){
    const text=button instanceof HTMLInputElement?(button.value||button.getAttribute('aria-label')||''):semText(button.textContent||button.getAttribute('aria-label')||'');
    for(const canonical of canonicalOptions){
      if(advancedTextMatches(text,canonical,true)){
        recognized.push({button,canonical});
        break;
      }
    }
  }
  const explicit=recognized.find(x=>advancedSelected(x.button));
  if(explicit)return explicit.canonical;
  const visual=advancedVisualSelected(recognized.map(x=>x.button));
  if(visual){
    const hit=recognized.find(x=>x.button===visual);
    if(hit)return hit.canonical;
  }
  return '';
}
function advancedReadDuration(){
  const row=advancedRow('Duration');
  if(!row)return '';
  const input=advancedDurationInput(row);
  const customRaw=String(input&&input.value||'').trim();
  if(/^\d{1,2}:[0-5]\d$/.test(customRaw))return customRaw.replace(/^0+(?=\d:)/,'');
  const choice=advancedReadChoice(row,['Auto','Custom']);
  if(choice==='Auto')return 'AUTO';
  const slider=advancedSlider('Duration');
  const seconds=advancedSliderNumber(slider);
  if(Number.isFinite(seconds)&&seconds>=0){
    return Math.floor(seconds/60)+':'+String(Math.round(seconds%60)).padStart(2,'0');
  }
  return '';
}
function advancedReadVariety(){
  const slider=advancedSlider('Variety');
  if(!slider)return '';
  const now=advancedSliderNumber(slider);
  if(Number.isInteger(now)&&now>=0&&now<=4)return ['Off','Normal','High','Extra','Max'][now];
  return String(slider.getAttribute('aria-valuetext')||slider.getAttribute('aria-valuenow')||('value' in slider?slider.value:'')||'');
}
function readAdvancedOptionsNow(){
  const voice=Array.from(document.querySelectorAll('a[href*="/voice/"]')).filter(rendered)[0]||null;
  const exclude=findExclude();
  const weird=advancedSlider('Weirdness');
  const influence=advancedSlider('Style Influence');
  const audioInfluence=advancedSlider('Audio Influence');
  const gender=advancedReadChoice(advancedRow('Vocal Gender'),['Male','Female']);
  const maxMode=advancedReadChoice(advancedRow('Max Mode'),['Off','On']);
  const weirdValue=advancedSliderNumber(weird);
  const influenceValue=advancedSliderNumber(influence);
  const audioInfluenceValue=advancedSliderNumber(audioInfluence);
  return {
    voice_name:voice?semText(voice.textContent):'',
    voice_url:voice?voice.href:'',
    exclude_styles:exclude?retrievedValue(exclude):'',
    vocal_gender:gender,
    duration:advancedReadDuration(),
    max_mode:maxMode,
    weirdness:Number.isFinite(weirdValue)?String(Math.round(weirdValue)):'',
    style_influence:Number.isFinite(influenceValue)?String(Math.round(influenceValue)):'',
    audio_influence:Number.isFinite(audioInfluenceValue)?String(Math.round(audioInfluenceValue)):'',
    variety:advancedReadVariety()
  };
}
async function collectAdvancedOptions(){
  const open=await ensureAdvancedOptionsOpen().catch(()=>({header:null,wasOpen:false,opened:false}));
  const data=readAdvancedOptionsNow();
  if(open.opened){
    const header=advancedOptionsHeader()||open.header;
    if(header&&header.isConnected){header.click();await sleep(25);}
  }
  return data;
}
function advancedOptionsFromClip(rawClip){
  const clip=rawClip&&typeof rawClip==='object'?rawClip:{};
  const md=clip.metadata&&typeof clip.metadata==='object'?clip.metadata:{};
  const pick=(...keys)=>{
    for(const key of keys){
      const v=md[key]??clip[key];
      if(v!==undefined&&v!==null&&v!=='')return v;
    }
    return '';
  };
  const normalizePercent=v=>{
    const n=Number(v);
    if(!Number.isFinite(n))return '';
    return String(n>=0&&n<=1?Math.round(n*100):Math.round(n));
  };
  const normalizeOnOff=v=>{
    if(v===true||v===1)return 'ON';
    if(v===false||v===0)return 'OFF';
    const text=String(v??'').trim();
    if(/^(?:true|1|on|enabled)$/i.test(text))return 'ON';
    if(/^(?:false|0|off|disabled)$/i.test(text))return 'OFF';
    return text;
  };
  const normalizeVariety=v=>{
    const text=String(v??'').trim();
    if(!text)return '';
    const n=Number(text);
    if(Number.isInteger(n)&&n>=0&&n<=4)return ['Off','Normal','High','Extra','Max'][n];
    return text;
  };
  const voiceId=String(pick('voice_id','persona_id','personaId')||'').trim();
  return {
    voice_name:String(pick('voice_name','persona_name','personaName')||''),
    voice_url:String(pick('voice_url','persona_url')||(voiceId?'https://suno.com/voice/'+voiceId:'')),
    exclude_styles:String(pick('negative_tags','negativeTags','exclude_styles','excludeStyles')||''),
    vocal_gender:String(pick('vocal_gender','vocalGender')||''),
    duration:'',
    max_mode:normalizeOnOff(pick('max_mode','maxMode')),
    weirdness:normalizePercent(pick('weirdness_constraint','weirdnessConstraint','weirdness')),
    style_influence:normalizePercent(pick('style_weight','styleWeight','style_influence','styleInfluence')),
    audio_influence:normalizePercent(pick('audio_weight','audioWeight','audio_influence','audioInfluence')),
    variety:normalizeVariety(pick('variety','variety_level','varietyLevel'))
  };
}
function mergeAdvancedOptions(primary,fallback){
  const out={};
  const keys=['voice_name','voice_url','exclude_styles','vocal_gender','duration','max_mode','weirdness','style_influence','audio_influence','variety'];
  for(const key of keys){
    const a=primary&&primary[key],b=fallback&&fallback[key];
    out[key]=(a!==undefined&&a!==null&&String(a)!=='')?a:((b!==undefined&&b!==null)?b:'');
  }
  return out;
}
async function fillAdvancedOptions(track,result){
  const open=await ensureAdvancedOptionsOpen();
  if(!open.header&&!open.controlsVisible)throw new Error('More Options controls not found');
  const add=(name,ok,detail)=>result.fields.push({name,ok,detail});
  const exclude=findExclude();
  const excludeDetail=await fillField(exclude,track.negative_prompt||'',{focus:false});
  add('Exclude',!!excludeDetail.ok,excludeDetail);
  if(!excludeDetail.ok)throw new Error('Exclude fill failed');
  const steps=[
    ['Vocal Gender',track.vocal_gender,()=>advancedSetButton('Vocal Gender',track.vocal_gender)],
    ['Duration',track.generation_duration,()=>advancedSetDuration(track.generation_duration)],
    ['Max Mode',track.max_mode,()=>advancedSetButton('Max Mode',track.max_mode)],
    ['Weirdness',track.weirdness,()=>advancedSetSlider('Weirdness',Number(track.weirdness))],
    ['Style Influence',track.style_influence,()=>advancedSetSlider('Style Influence',Number(track.style_influence))],
    ['Audio Influence',track.audio_influence,async()=>{
      const slider=advancedSlider('Audio Influence');
      if(!slider)return true; // only exists when Suno exposes the audio reference control
      return advancedSetSlider('Audio Influence',Number(track.audio_influence));
    }],
    ['Variety',track.variety,()=>{
      const key=String(track.variety).trim().toLowerCase();
      const map={off:0,low:1,normal:1,medium:2,high:2,extra:3,max:4,maximum:4};
      if(!Object.prototype.hasOwnProperty.call(map,key))throw new Error('Variety: unsupported value "'+track.variety+'"');
      return advancedSetSlider('Variety',map[key]);
    }]
  ];
  for(const [name,value,fn] of steps){
    if(value==null||String(value).trim()===''){add(name,true,{skipped:true,reason:'no stored value'});continue;}
    if(name==='Audio Influence'&&!advancedSlider('Audio Influence')){add(name,true,{skipped:true,reason:'Suno Audio Influence control is not currently available'});continue;}
    await fn();add(name,true,{value:String(value)});
  }
  if(track.voice_name||track.voice_url)add('Voice',true,{skipped:true,reason:'stored/retrieved metadata only; voice selection is not automated'});
}
function diagnosticText(result){
  return 'GRAPH1KS SUNO AUTOFILL DIAGNOSTIC\n'+JSON.stringify({
    product:'GRAPH1KS Prompt Control Deck',
    version:EXT_VERSION,
    timestamp:new Date().toISOString(),
    url:location.href,
    result
  },null,2);
}

async function autofill(track,recordId,options={}){
  const result={ok:false,recordId,errorField:null,message:'',fields:[],resolved:{}};
  const add=(name,detail)=>{ result.fields.push({name,ok:!!detail?.ok,detail}); if(!detail?.ok&&!result.errorField) result.errorField=name; };
  try{
    let title=findTitle();
    let styles=findStyles();
    let exclude=findExclude();
    let lyrics=null;
    let lyricsPreparation=null;

    result.resolved={
      title:describeElement(title),
      styles:describeElement(styles),
      exclude:describeElement(exclude),
      lyrics:null
    };

    const stylesOpen=stylesPanelIsOpen(styles);
    const fillMoreOptions=options.fillMoreOptions===true;
    const advancedOpen=fillMoreOptions?advancedOptionsIsOpen(exclude):true;
    const action=[];
    if(!stylesOpen) action.push('Open the Styles field');
    if(action.length){
      result.errorField='Suno panels closed';
      result.message=action.join(' + ')+' before using Autofill. GRAPH1KS can open More Options automatically, but Styles must already be visible.';
      result.fields.push({
        name:'Suno panel preflight',
        ok:false,
        detail:{
          stylesFound:!!styles,
          stylesOpen:stylesOpen,
          stylesPanel:stylesPanelSnapshot(styles),
          advancedFieldFound:!!exclude,
          advancedOptionsOpen:advancedOpen,
          fillMoreOptions:fillMoreOptions,
          advancedPanel:advancedPanelSnapshot(exclude),
          actionRequired:action
        }
      });
      result.diagnosticText=diagnosticText(result); return result;
    }

    result.fields.push({
      name:'Suno panel preflight',
      ok:true,
      detail:{
        stylesFound:!!styles,
        stylesOpen:true,
        stylesPanel:stylesPanelSnapshot(styles),
        advancedFieldFound:!!exclude,
        advancedOptionsOpen:advancedOpen,
        fillMoreOptions:fillMoreOptions,
        advancedPanel:advancedPanelSnapshot(exclude)
      }
    });

    // Only after the Styles preflight do we touch any Suno field. More Options is opened on demand when enabled.
    lyricsPreparation=await prepareLyricsField();
    lyrics=lyricsPreparation.element;

    result.resolved.lyrics=describeElement(lyrics);
    result.lyricsPreparation=lyricsPreparation;

    if(!title || !lyrics){
      result.discoveryCandidates=discoveryCandidates();
    }

    const instrumental=findInstrumental();
    const originalInstrumental=instrumentalState(instrumental);

    // Legacy fallback only: if Suno actually hides Lyrics while Instrumental
    // is explicitly ON, temporarily expose it and restore state afterwards.
    if(!lyrics && instrumental && originalInstrumental===true){
      instrumental.click();
      await sleep(180);

      lyricsPreparation=await prepareLyricsField();
      lyrics=lyricsPreparation.element;
      result.resolved.lyrics=describeElement(lyrics);
      result.lyricsPreparation=lyricsPreparation;
    }

    add('Title',await fillField(title,track.title,{focus:false}));
    // Explicit no-focus prevents focus-triggered panel expansion.
    add('Styles',await fillField(styles,track.structured_prompt,{focus:false}));
    if(fillMoreOptions){
      await fillAdvancedOptions(track,result);
    }else{
      result.fields.push({name:'More Options',ok:true,detail:{skipped:true,reason:'FILL MORE OPTIONS disabled'}});
    }
    add('Arrangement',await fillField(lyrics,track.instrumental_arrangement));

    if(instrumental && originalInstrumental===true){
      const now=instrumentalState(instrumental); if(now===false){ instrumental.click(); await sleep(100); }
    }
    result.fields.push({name:'Instrumental state',ok:true,detail:{preserved:true,state:originalInstrumental}});

    const failed=result.fields.find(f=>!f.ok);
    if(failed){ result.errorField=failed.name; result.message='Autofill failed at '+failed.name+'.'; result.diagnosticText=diagnosticText(result); return result; }
    result.ok=true; result.message='Autofill completed and verified.'; result.diagnosticText=diagnosticText(result); return result;
  }catch(error){
    result.errorField=result.errorField||'Unhandled exception'; result.message=error.message||String(error); result.stack=error.stack||null; result.diagnosticText=diagnosticText(result); return result;
  }
}


// ---------------------------------------------------------------------------
// SUNO RETRIEVAL → separate GRAPH1KS Suno Vault
// ---------------------------------------------------------------------------
function retrievedValue(el){
  if(!el)return '';
  if('value' in el&&/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))return normalizeLineEndings(el.value);
  const ce=el.getAttribute&&el.getAttribute('contenteditable');
  if(el.isContentEditable||(ce!=null&&ce!=='false'))return exactEditableText(el);
  return normalizeLineEndings(el.textContent||el.innerText||'');
}

function sidebarCurrentAccountDom(){
  const button=document.querySelector('[data-testid="profile-menu-button"]');
  const links=Array.from(document.querySelectorAll('a[href^="/@"],a[href*="suno.com/@"]')).filter(rendered);
  if(!links.length)return null;

  let candidates=links.map(a=>{
    const r=a.getBoundingClientRect();
    const href=a.getAttribute('href')||'';
    const m=href.match(/\/@([^/?#]+)/);
    if(!m)return null;
    let distance=999999;
    if(button){
      const b=button.getBoundingClientRect();
      distance=Math.hypot((r.left+r.width/2)-(b.left+b.width/2),(r.top+r.height/2)-(b.top+b.height/2));
    }
    return {handle:decodeURIComponent(m[1]),displayName:normText(a.innerText)||null,left:r.left,distance};
  }).filter(Boolean);

  if(button){
    candidates.sort((a,b)=>a.distance-b.distance);
    if(candidates[0]&&candidates[0].distance<260)return candidates[0];
  }

  const sidebar=candidates.filter(c=>c.left<300).sort((a,b)=>a.left-b.left);
  return sidebar[0]||candidates[0]||null;
}

async function resolveCurrentSunoAccount(){
  const dom=sidebarCurrentAccountDom();
  if(!dom||!dom.handle)return null;

  const key=String(dom.handle).toLowerCase();
  const now=Date.now();
  if(sunoAccountCache.key===key && sunoAccountCache.account && sunoAccountCache.expiresAt>now){
    return sunoAccountCache.account;
  }
  if(sunoAccountCache.key===key && sunoAccountCache.promise){
    return sunoAccountCache.promise;
  }

  const fallback={userId:null,handle:dom.handle,displayName:dom.displayName||null,confidence:'dom'};
  const promise=(async()=>{
    try{
      const response=await chrome.runtime.sendMessage({
        type:'SUNO_RESOLVE_ACCOUNT',
        handle:dom.handle,
        displayName:dom.displayName||null
      });
      const account=response&&response.ok&&response.account?response.account:fallback;
      sunoAccountCache.key=key;
      sunoAccountCache.account=account;
      sunoAccountCache.expiresAt=Date.now()+5*60*1000;
      return account;
    }catch(_){
      sunoAccountCache.key=key;
      sunoAccountCache.account=fallback;
      sunoAccountCache.expiresAt=Date.now()+60*1000;
      return fallback;
    }finally{
      if(sunoAccountCache.key===key)sunoAccountCache.promise=null;
    }
  })();

  sunoAccountCache.key=key;
  sunoAccountCache.promise=promise;
  return promise;
}

function controlLabel(el){
  if(!el)return '';
  const out=[];
  if(el.id){try{document.querySelectorAll('label[for="'+CSS.escape(el.id)+'"]').forEach(l=>out.push(l.innerText));}catch(_){}}
  const parentLabel=el.closest&&el.closest('label');
  if(parentLabel)out.push(parentLabel.innerText);
  out.push(el.getAttribute&&el.getAttribute('aria-label'),el.getAttribute&&el.getAttribute('placeholder'),el.getAttribute&&el.getAttribute('name'));
  return semText(out.filter(Boolean).join(' '));
}

function collectCreateOptions(){
  const out={};
  const nodes=Array.from(document.querySelectorAll(
    'input:not([type="hidden"]),select,[role="slider"],[role="switch"],[role="combobox"]'
  )).filter(rendered);

  for(const el of nodes){
    const label=controlLabel(el)||semText(semanticFieldText(el)).slice(0,120);
    if(!label||/song title|exclude styles?|lyrics|search|workspace|clip|filter/i.test(label)||/^styles?$/i.test(label))continue;
    let value='';
    const role=el.getAttribute('role');
    if(role==='slider')value=el.getAttribute('aria-valuenow')||el.getAttribute('aria-valuetext')||'';
    else if(role==='switch')value=el.getAttribute('aria-checked')||el.getAttribute('aria-pressed')||'';
    else if(el.tagName==='INPUT'&&(el.type==='checkbox'||el.type==='radio'))value=!!el.checked;
    else value=retrievedValue(el);
    if(value!==''&&value!=null)out[label.slice(0,180)]=value;
  }
  return out;
}

function retrievalPageType(){
  if(/^\/create(?:\/|$)/.test(location.pathname))return 'create';
  if(/^\/song\//.test(location.pathname))return 'song';
  return 'other';
}

function retrievalSongId(){
  const m=location.pathname.match(/\/song\/([0-9a-f-]{20,})/i);
  return m?m[1]:null;
}

function normalizeClipForVault(clip,songId){
  clip=clip&&typeof clip==='object'?clip:{};
  const md=clip.metadata&&typeof clip.metadata==='object'?clip.metadata:{};
  const prompt=normalizeLineEndings(md.prompt||clip.prompt||'');
  const tags=normalizeLineEndings(md.tags||clip.tags||clip.display_tags||clip.style||clip.styles||'');
  const looksLikeLyrics=/\n/.test(prompt)||/\[(verse|chorus|intro|outro|bridge|pre-?chorus|hook|instrumental|build|drop|break)/i.test(prompt);
  return {
    sunoSongId:str(clip.id||clip.song_id||clip.clip_id||clip.uuid||songId)||songId,
    title:normalizeLineEndings(clip.title),
    styles:tags,
    lyrics:looksLikeLyrics?prompt:'',
    prompt:looksLikeLyrics?'':prompt,
    model:normText(clip.major_model_version||md.major_model_version||md.model||clip.model_name),
    modelName:normText(clip.model_name),
    duration:Number.isFinite(Number(md.duration||clip.duration))?Number(md.duration||clip.duration):null,
    createdAt:clip.created_at||md.created_at||null,
    audioUrl:clip.audio_url||md.audio_url||null,
    videoUrl:clip.video_url||md.video_url||null,
    imageUrl:clip.image_large_url||clip.image_url||md.image_url||null,
    status:clip.status||null,
    owner:{
      userId:str(clip.user_id||md.user_id)||null,
      handle:normText(clip.handle||md.handle).replace(/^@/,'')||null,
      displayName:normText(clip.display_name||md.display_name)||null
    },
    rawClip:clip
  };
}

function songDomFallback(songId){
  const h1=Array.from(document.querySelectorAll('h1')).filter(rendered).find(el=>semText(el.innerText).length>0);
  let styles='';
  const copyStyles=Array.from(document.querySelectorAll('[aria-label*="Copy styles" i]')).filter(rendered)[0]||null;
  if(copyStyles&&copyStyles.parentElement)styles=exactEditableText(copyStyles.parentElement);

  let lyrics='';
  const copyLyrics=Array.from(document.querySelectorAll('[aria-label*="Copy lyrics" i]')).filter(rendered)[0]||null;
  if(copyLyrics&&copyLyrics.parentElement)lyrics=exactEditableText(copyLyrics.parentElement);

  const ownerLinks=Array.from(document.querySelectorAll('a[href^="/@"],a[href*="suno.com/@"]')).filter(rendered);
  let ownerLink=null;
  // Song-owner links normally live in the main content, while the signed-in
  // account link is in the far-left sidebar.
  for(const link of ownerLinks){
    const r=link.getBoundingClientRect();
    if(r.left>300){ownerLink=link;break;}
  }
  const href=ownerLink?ownerLink.getAttribute('href')||'':'';
  const hm=href.match(/\/@([^/?#]+)/);
  return {
    sunoSongId:songId,
    title:h1?normalizeLineEndings(h1.textContent||h1.innerText||''):'',
    styles,lyrics,prompt:'',model:'',modelName:'',duration:null,createdAt:null,
    audioUrl:(document.querySelector('audio[src]')||{}).src||null,
    videoUrl:(document.querySelector('video[src]')||{}).src||null,
    imageUrl:(document.querySelector('meta[property="og:image"]')||{}).content||null,
    status:null,
    owner:{userId:null,handle:hm?decodeURIComponent(hm[1]):null,displayName:ownerLink?normText(ownerLink.innerText)||null:null},
    rawClip:null
  };
}

function mergeRetrievedSong(primary,fallback){
  const out=primary?JSON.parse(JSON.stringify(primary)):JSON.parse(JSON.stringify(fallback||{}));
  if(!fallback)return out;
  ['sunoSongId','title','styles','lyrics','prompt','model','modelName','duration','createdAt','audioUrl','videoUrl','imageUrl','status'].forEach(k=>{
    if(out[k]==null||out[k]==='')out[k]=fallback[k]??out[k];
  });
  out.owner=out.owner||{};
  ['userId','handle','displayName'].forEach(k=>{if(!out.owner[k])out.owner[k]=fallback.owner&&fallback.owner[k]||null;});
  return out;
}

async function retrieveCreateRecord(){
  const advanced=await collectAdvancedOptions().catch(()=>readAdvancedOptionsNow());
  const titleEl=findTitle();
  const stylesEl=findStyles();
  const excludeEl=findExclude();
  let lyrics=findLyrics();
  if(!lyrics){
    const prep=await prepareLyricsField();
    lyrics=prep.element;
  }
  const instrumental=findInstrumental();
  const account=await resolveCurrentSunoAccount();
  const title=retrievedValue(titleEl);
  return {
    schema:'graph1ks-suno-vault-record/v1',
    pageType:'create',recordType:'draft',name:title,title,
    styles:retrievedValue(stylesEl),
    exclude:String(advanced.exclude_styles||retrievedValue(excludeEl)),
    lyrics:retrievedValue(lyrics),
    instrumental:instrumentalState(instrumental),
    advancedOptions:advanced,
    createOptions:collectCreateOptions(),
    currentAccount:account,
    owner:account?{userId:account.userId||null,handle:account.handle||null,displayName:account.displayName||null}:null,
    source:{url:location.href,retrievedAt:new Date().toISOString(),type:'suno-create'},
    retrieval:{version:EXT_VERSION,titleFound:!!titleEl,stylesFound:!!stylesEl,excludeFound:!!excludeEl,lyricsFound:!!lyrics}
  };
}

async function retrieveSongRecord(){
  const songId=retrievalSongId();
  if(!songId)throw new Error('Could not determine the Suno song ID from this URL.');

  // Clip metadata and signed-in identity are independent. Resolve them in
  // parallel instead of serially so R pays only the slower of the two calls.
  const clipPromise=(async()=>{
    try{
      const response=await chrome.runtime.sendMessage({type:'SUNO_FETCH_CLIP',songId});
      return response&&response.ok&&response.clip?normalizeClipForVault(response.clip,songId):null;
    }catch(_){return null;}
  })();
  const accountPromise=resolveCurrentSunoAccount();
  const advancedPromise=collectAdvancedOptions().catch(()=>readAdvancedOptionsNow());
  const fallback=songDomFallback(songId);
  const [exact,account,advancedDom]=await Promise.all([clipPromise,accountPromise,advancedPromise]);
  const song=mergeRetrievedSong(exact,fallback);
  const advanced=mergeAdvancedOptions(advancedDom,advancedOptionsFromClip(song.rawClip));
  const owner=song.owner||{userId:null,handle:null,displayName:null};

  // A private/self song may fall back to the rendered DOM if the public clip
  // endpoint cannot return it. In that case the page still exposes the owner
  // handle; bind it to the already-resolved signed-in account identity.
  if(
    account&&account.handle&&owner.handle&&
    account.handle.toLowerCase()===owner.handle.toLowerCase()
  ){
    if(!owner.userId)owner.userId=account.userId||null;
    if(!owner.displayName)owner.displayName=account.displayName||null;
  }

  let ownership='unknown';
  if(account&&account.userId&&owner.userId)ownership=account.userId===owner.userId?'self':'other';
  else if(account&&account.handle&&owner.handle)ownership=account.handle.toLowerCase()===owner.handle.toLowerCase()?'self':'other';

  return {
    schema:'graph1ks-suno-vault-record/v1',
    pageType:'song',recordType:'song',name:song.title||'',title:song.title||'',
    sunoSongId:song.sunoSongId||songId,
    styles:song.styles||'',lyrics:song.lyrics||'',prompt:song.prompt||'',
    model:song.model||'',modelName:song.modelName||'',duration:song.duration??null,
    createdAt:song.createdAt||null,audioUrl:song.audioUrl||null,videoUrl:song.videoUrl||null,imageUrl:song.imageUrl||null,status:song.status||null,
    owner,currentAccount:account,ownership,rawClip:song.rawClip||null,advancedOptions:advanced,
    source:{url:location.href,retrievedAt:new Date().toISOString(),type:'suno-song',songUrl:location.href,profileUrl:owner.handle?'https://suno.com/@'+owner.handle:null},
    retrieval:{version:EXT_VERSION,exactSongIdMatch:!!(exact&&exact.sunoSongId===songId),apiClipFound:!!exact}
  };
}

async function retrieveCurrentRecord(){
  const type=retrievalPageType();
  if(type==='create')return retrieveCreateRecord();
  if(type==='song')return retrieveSongRecord();
  throw new Error('R Retrieve currently supports Suno /create and /song/<id> pages.');
}

function editableHotkeyTarget(target){
  if(!target||target===document.body)return false;
  if(target.isContentEditable)return true;
  const tag=str(target.tagName).toUpperCase();
  if(tag==='TEXTAREA'||tag==='SELECT')return true;
  if(tag==='INPUT'){
    const type=str(target.type).toLowerCase();
    return !['button','checkbox','radio','range','submit','reset','color','file'].includes(type);
  }
  return !!(target.closest&&target.closest('[contenteditable="true"],[role="textbox"]'));
}

async function runRetrieveHotkey(){
  if(rTriggerInFlight||!runtimeEnabled)return;
  rTriggerInFlight=true;
  try{
    const record=await retrieveCurrentRecord();
    const response=await chrome.runtime.sendMessage({type:'RETRIEVE_TO_DECK',record});
    if(!response||!response.ok)throw new Error(response&&response.message||'Control Deck did not accept the retrieved record.');
    if(response.needsTitle){
      playVerifiedChime();
      radial('ok');
    }else{
      showVerifiedFeedback();
    }
  }catch(error){
    console.error('[GRAPH1KS Retrieve]',error);
    showBlockedFeedback();
  }finally{
    setTimeout(()=>{rTriggerInFlight=false;},160);
  }
}

function handleRHotkey(e){
  if(!runtimeEnabled)return;
  if(!e.isTrusted||e.repeat||e.ctrlKey||e.metaKey||e.altKey||str(e.key).toLowerCase()!=='r')return;
  if(feedbackConfig.retrieveHotkey===false)return;
  if(editableHotkeyTarget(e.target))return;
  e.preventDefault();
  e.stopPropagation();
  rememberPointer(e);
  ensureAudioContext();
  runRetrieveHotkey();
}

function applyFeedbackConfig(input={}){
  feedbackConfig.sound=input.sound!==false;
  feedbackConfig.radial=input.radial!==false;
  feedbackConfig.fillHotkey=input.fillHotkey!==false;
  feedbackConfig.retrieveHotkey=input.retrieveHotkey!==false;
  if(!feedbackConfig.fillHotkey&&runtimeEnabled&&autoFillRuntime.active)stopAutoFillRuntime('disabled');
  if(!feedbackConfig.radial){
    document.getElementById('graph1ks-pointer-fx')?.remove();
    clearAutoFillPointer();
  }
  syncHotkeyIndicators();
}
function applyAutoFillConfig(input={}){
  const wasEnabled=autoFillConfig.enabled;
  autoFillConfig.enabled=input.enabled===true;
  autoFillConfig.seconds=Math.max(1,Math.min(99,Number.parseInt(input.seconds,10)||8));

  if(autoFillConfig.enabled)fRequiresPrimaryClick=false;
  if(runtimeEnabled&&wasEnabled&&!autoFillConfig.enabled)stopAutoFillRuntime('disabled');
}
function rememberPointer(e){
  if(!runtimeEnabled||!e||!e.isTrusted)return;
  if(Number.isFinite(e.clientX))lastPointer.x=e.clientX;
  if(Number.isFinite(e.clientY))lastPointer.y=e.clientY;
  scheduleAutoFillPointerPosition();
  scheduleHotkeyIndicatorPosition();
}

function hotkeyIndicatorNode(){return document.getElementById('graph1ks-hotkey-indicators');}

function ensureHotkeyIndicatorNode(){
  if(!runtimeEnabled||!document.body)return null;
  let node=hotkeyIndicatorNode();
  if(node)return node;
  node=document.createElement('div');
  node.id='graph1ks-hotkey-indicators';
  node.className='g1hotkeys';
  node.dataset.theme=graph1ksUiTheme;
  node.innerHTML='<span data-key="f">F</span><span data-key="r">R</span>';
  document.body.appendChild(node);
  applyHotkeyIndicatorPosition(true);
  return node;
}

function applyHotkeyIndicatorPosition(force=false){
  hotkeyPointerRaf=0;
  const node=hotkeyIndicatorNode();
  if(!node||document.hidden)return;
  const width=node.offsetWidth||38;
  const height=node.offsetHeight||18;
  const gap=17;
  let x=lastPointer.x+gap;
  let y=lastPointer.y+gap;
  if(x+width>innerWidth-8)x=lastPointer.x-width-gap;
  if(y+height>innerHeight-8)y=lastPointer.y-height-gap;
  x=Math.max(8,Math.min(innerWidth-width-8,x));
  y=Math.max(8,Math.min(innerHeight-height-8,y));
  if(force||hotkeyPointerPlacement.x!==x||hotkeyPointerPlacement.y!==y){
    node.style.transform='translate3d('+x+'px,'+y+'px,0)';
    hotkeyPointerPlacement={x,y};
  }
}

function scheduleHotkeyIndicatorPosition(){
  if(hotkeyPointerRaf||!hotkeyIndicatorNode()||document.hidden)return;
  hotkeyPointerRaf=requestAnimationFrame(()=>applyHotkeyIndicatorPosition(false));
}

function syncHotkeyIndicators(){
  if(!runtimeEnabled){hotkeyIndicatorNode()?.remove();return;}
  if(!feedbackConfig.fillHotkey&&!feedbackConfig.retrieveHotkey){
    hotkeyIndicatorNode()?.remove();
    return;
  }
  const node=ensureHotkeyIndicatorNode();
  if(!node)return;
  const f=node.querySelector('[data-key="f"]');
  const r=node.querySelector('[data-key="r"]');
  if(f)f.hidden=!feedbackConfig.fillHotkey;
  if(r)r.hidden=!feedbackConfig.retrieveHotkey;
  node.style.visibility=document.hidden?'hidden':'visible';
  if(!document.hidden)applyHotkeyIndicatorPosition(true);
}

function clearHotkeyIndicators(){
  if(hotkeyPointerRaf){cancelAnimationFrame(hotkeyPointerRaf);hotkeyPointerRaf=0;}
  hotkeyIndicatorNode()?.remove();
  hotkeyPointerPlacement={x:null,y:null};
}
function ensureAudioContext(){
  if(!runtimeEnabled||!feedbackConfig.sound) return null;
  try{ if(!feedbackAudioContext){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;feedbackAudioContext=new C();} if(feedbackAudioContext.state==='suspended')feedbackAudioContext.resume().catch(()=>{}); return feedbackAudioContext;}catch(_){return null;}
}
function tone(ctx,freq,start,duration,gainValue,type='sine'){
  const osc=ctx.createOscillator(),gain=ctx.createGain(); osc.type=type; osc.frequency.setValueAtTime(freq,start); gain.gain.setValueAtTime(.0001,start); gain.gain.exponentialRampToValueAtTime(gainValue,start+.014); gain.gain.exponentialRampToValueAtTime(.0001,start+duration); osc.connect(gain);gain.connect(ctx.destination);osc.start(start);osc.stop(start+duration+.03);
}
function playVerifiedChime(){const c=ensureAudioContext();if(!c)return;const n=c.currentTime;tone(c,880,n,.16,.055);tone(c,1318.51,n+.075,.20,.045);}
function playBlockedChime(){const c=ensureAudioContext();if(!c)return;const n=c.currentTime;tone(c,392,n,.16,.045,'triangle');tone(c,293.66,n+.075,.20,.04,'triangle');tone(c,220,n+.15,.23,.034);}
function radial(kind){
  if(!runtimeEnabled||!feedbackConfig.radial||!document.body)return;
  const id='graph1ks-pointer-fx'; document.getElementById(id)?.remove();
  const wrap=document.createElement('div');wrap.id=id;wrap.className='g1fx '+kind;wrap.innerHTML=kind==='ok'?'<i></i><i></i><b>✓</b>':'<i></i><i></i><b>×</b><em>CLICK</em>';
  Object.assign(wrap.style,{left:Math.max(24,Math.min(innerWidth-24,lastPointer.x))+'px',top:Math.max(24,Math.min(innerHeight-24,lastPointer.y))+'px'});document.body.appendChild(wrap);requestAnimationFrame(()=>wrap.classList.add('go'));setTimeout(()=>wrap.remove(),1150);
}
function reportAutoFillStatus(extra={}){
  if(!runtimeEnabled)return;
  const status={
    active:autoFillRuntime.active,
    phase:autoFillRuntime.phase,
    remaining:Number.isFinite(autoFillRuntime.remaining)?autoFillRuntime.remaining:null,
    verifiedPending:autoFillRuntime.verifiedPending,
    ...extra
  };
  chrome.runtime.sendMessage({type:'AUTO_FILL_STATUS',status}).catch(()=>{});
}

function autoFillPointerNode(){return document.getElementById('graph1ks-auto-fill-pointer');}

const AUTO_FILL_RING_CIRCUMFERENCE=157.08;

function ensureAutoFillPointerNode(){
  if(!runtimeEnabled)return null;
  let node=autoFillPointerNode();
  if(node)return node;
  if(!document.body)return null;

  node=document.createElement('div');
  node.id='graph1ks-auto-fill-pointer';
  node.className='g1autofill pause';
  node.innerHTML=
    '<span class="g1autoAura" aria-hidden="true"></span>'+ 
    '<svg class="g1autoSvg" viewBox="0 0 64 64" aria-hidden="true">'+
      '<defs>'+ 
        '<linearGradient id="g1AutoGradient" x1="10" y1="54" x2="54" y2="10" gradientUnits="userSpaceOnUse">'+
          '<stop offset="0" stop-color="#42df9b"></stop>'+ 
          '<stop offset=".52" stop-color="#9f69ff"></stop>'+ 
          '<stop offset="1" stop-color="#ff4f9b"></stop>'+ 
        '</linearGradient>'+ 
      '</defs>'+ 
      '<circle class="g1autoTrack" cx="32" cy="32" r="25"></circle>'+ 
      '<circle class="g1autoProgress" cx="32" cy="32" r="25"></circle>'+ 
      '<circle class="g1autoHighlight" cx="32" cy="32" r="25"></circle>'+ 
    '</svg>'+ 
    '<span class="g1autoAnchor" aria-hidden="true"></span>'+ 
    '<b><strong></strong><small>AUTO</small></b>';

  document.body.appendChild(node);
  syncAutoFillPointerVisibility();
  applyAutoFillPointerPosition(true);
  return node;
}

function applyAutoFillPointerPosition(force=false){
  autoFillPointerRaf=0;
  const node=autoFillPointerNode();
  if(!node||document.hidden)return;

  // Keep the orb well clear of the system cursor and flip at viewport edges.
  const offset=54;
  const edge=38;
  let x=lastPointer.x+offset;
  let y=lastPointer.y-offset;
  let horizontal='right';
  let vertical='up';

  if(x>innerWidth-edge){x=lastPointer.x-offset;horizontal='left';}
  if(y<edge){y=lastPointer.y+offset;vertical='down';}

  x=Math.max(edge,Math.min(innerWidth-edge,x));
  y=Math.max(edge,Math.min(innerHeight-edge,y));

  if(force||autoFillPointerPlacement.horizontal!==horizontal){
    node.dataset.horizontal=horizontal;
    autoFillPointerPlacement.horizontal=horizontal;
  }
  if(force||autoFillPointerPlacement.vertical!==vertical){
    node.dataset.vertical=vertical;
    autoFillPointerPlacement.vertical=vertical;
  }

  // Transform-only movement keeps this isolated overlay on the compositor
  // instead of triggering layout/paint through left/top on every pointermove.
  if(force||autoFillPointerPlacement.x!==x||autoFillPointerPlacement.y!==y){
    node.style.transform='translate3d('+(x-31)+'px,'+(y-31)+'px,0)';
    autoFillPointerPlacement.x=x;
    autoFillPointerPlacement.y=y;
  }
}

function scheduleAutoFillPointerPosition(){
  if(autoFillPointerRaf||!autoFillPointerNode()||document.hidden)return;
  autoFillPointerRaf=requestAnimationFrame(function(){applyAutoFillPointerPosition(false);});
}

function positionAutoFillPointer(){
  applyAutoFillPointerPosition(true);
}

function syncAutoFillPointerVisibility(){
  const node=autoFillPointerNode();
  if(!node)return;
  node.style.visibility=document.hidden?'hidden':'visible';
  if(!document.hidden)applyAutoFillPointerPosition(true);
}

function showAutoFillPointer(label,kind='countdown'){
  if(!runtimeEnabled||!feedbackConfig.radial||!document.body)return;
  const node=ensureAutoFillPointerNode();
  if(!node)return;

  const captions={
    countdown:'SEC',
    armed:'READY',
    wait:'READY',
    filling:'AUTO',
    pause:'AUTO',
    error:'STOP'
  };

  const strong=node.querySelector('b strong');
  const small=node.querySelector('b small');
  const progressCircle=node.querySelector('.g1autoProgress');

  node.className='g1autofill '+kind;
  strong.textContent=str(label);
  small.textContent=captions[kind]||'AUTO';

  let ratio=.78;
  if(kind==='countdown'){
    const total=Math.max(1,Number(autoFillConfig.seconds)||8);
    const remaining=Math.max(0,Math.min(total,Number(label)||0));
    ratio=remaining/total;
  }else if(kind==='filling'){
    ratio=1;
  }else if(kind==='error'){
    ratio=.76;
  }else if(kind==='pause'){
    ratio=.66;
  }

  if(progressCircle){
    progressCircle.style.strokeDasharray=String(AUTO_FILL_RING_CIRCUMFERENCE);
    progressCircle.style.strokeDashoffset=String(AUTO_FILL_RING_CIRCUMFERENCE*(1-ratio));
  }

  positionAutoFillPointer();
}

function clearAutoFillPointer(){
  if(autoFillPointerRaf){cancelAnimationFrame(autoFillPointerRaf);autoFillPointerRaf=0;}
  autoFillPointerNode()?.remove();
  autoFillPointerPlacement={horizontal:'',vertical:'',x:null,y:null};
}
function flashAutoFillPointer(label,kind='pause',duration=850){
  showAutoFillPointer(label,kind);
  setTimeout(()=>{
    if(!autoFillRuntime.active||autoFillRuntime.phase==='paused'||autoFillRuntime.phase==='error')clearAutoFillPointer();
  },duration);
}
function clearAutoFillTimer(){
  if(autoFillRuntime.timer){clearTimeout(autoFillRuntime.timer);autoFillRuntime.timer=null;}
}
function setAutoFillPhase(phase,remaining=null){
  autoFillRuntime.phase=phase;
  autoFillRuntime.remaining=Number.isFinite(remaining)?remaining:null;
  reportAutoFillStatus();
}
function stopAutoFillRuntime(reason='paused'){
  clearAutoFillTimer();
  autoFillRuntime.active=false;
  autoFillRuntime.generation++;
  autoFillRuntime.requestInFlight=false;
  if(reason==='disabled')autoFillRuntime.verifiedPending=false;
  setAutoFillPhase('paused',null);
  flashAutoFillPointer(reason==='disabled'?'OFF':'PAUSE','pause');
}
function startAutoFillRuntime(){
  if(!runtimeEnabled||!autoFillConfig.enabled)return;
  clearAutoFillTimer();
  autoFillRuntime.active=true;
  autoFillRuntime.generation++;
  if(autoFillRuntime.verifiedPending){
    setAutoFillPhase('wait_click',null);
    showAutoFillPointer('CLICK','wait');
  }else{
    setAutoFillPhase('armed',null);
    showAutoFillPointer('CLICK','armed');
  }
}
function startAutoFillCountdown(){
  if(!runtimeEnabled||!autoFillRuntime.active||!autoFillConfig.enabled)return;
  clearAutoFillTimer();
  const generation=++autoFillRuntime.generation;
  let remaining=autoFillConfig.seconds;
  setAutoFillPhase('countdown',remaining);
  showAutoFillPointer(remaining,'countdown');

  const tick=()=>{
    if(!autoFillRuntime.active||generation!==autoFillRuntime.generation)return;
    remaining--;
    autoFillRuntime.remaining=remaining;
    reportAutoFillStatus();
    showAutoFillPointer(Math.max(0,remaining),'countdown');
    if(remaining<=0){
      autoFillRuntime.timer=setTimeout(()=>executeAutoFillCycle(generation),120);
      return;
    }
    autoFillRuntime.timer=setTimeout(tick,1000);
  };

  autoFillRuntime.timer=setTimeout(tick,1000);
}
async function executeAutoFillCycle(generation){
  if(!runtimeEnabled||!autoFillRuntime.active||generation!==autoFillRuntime.generation)return;
  clearAutoFillTimer();
  setAutoFillPhase('filling',0);
  showAutoFillPointer('FILL','filling');
  autoFillRuntime.requestInFlight=true;

  let response;
  try{
    response=await chrome.runtime.sendMessage({type:'AUTO_FILL_EXECUTE'});
  }catch(error){
    response={ok:false,message:error.message||String(error)};
  }
  autoFillRuntime.requestInFlight=false;

  if(!runtimeEnabled||generation!==autoFillRuntime.generation)return;

  if(!response||!response.ok){
    autoFillRuntime.active=false;
    autoFillRuntime.verifiedPending=false;
    setAutoFillPhase('error',null);
    playBlockedChime();
    showAutoFillPointer('ERR','error');
    return;
  }

  autoFillRuntime.verifiedPending=true;
  if(!autoFillRuntime.active){
    setAutoFillPhase('paused',null);
    clearAutoFillPointer();
    return;
  }

  setAutoFillPhase('wait_click',null);
  showAutoFillPointer('CLICK','wait');
}
async function acceptPostVerifyClick(){
  if(!runtimeEnabled||!autoFillRuntime.active||autoFillRuntime.phase!=='wait_click'||!autoFillRuntime.verifiedPending||autoFillRuntime.requestInFlight)return;

  autoFillRuntime.requestInFlight=true;
  setAutoFillPhase('post_click',null);
  showAutoFillPointer('NEXT','filling');

  let response;
  try{
    response=await chrome.runtime.sendMessage({type:'AUTO_FILL_POST_VERIFY_CLICK'});
  }catch(error){
    response={ok:false,message:error.message||String(error)};
  }
  autoFillRuntime.requestInFlight=false;

  if(!runtimeEnabled)return;

  if(!response||!response.ok){
    autoFillRuntime.active=false;
    autoFillRuntime.verifiedPending=false;
    setAutoFillPhase('error',null);
    playBlockedChime();
    showAutoFillPointer('ERR','error');
    return;
  }

  autoFillRuntime.verifiedPending=false;

  if(response.hasNext===false){
    autoFillRuntime.active=false;
    setAutoFillPhase('paused',null);
    showAutoFillPointer('END','pause');
    return;
  }

  if(autoFillRuntime.active)startAutoFillCountdown();
}

function showVerifiedFeedback(){playVerifiedChime();radial('ok');}
function showBlockedFeedback(){playBlockedChime();radial('blocked');}
function handlePrimaryPointerDown(e){
  if(!runtimeEnabled)return;
  rememberPointer(e);

  if(e?.isTrusted&&e.button===0){
    ensureAudioContext();

    if(autoFillConfig.enabled&&autoFillRuntime.active){
      if(autoFillRuntime.phase==='armed'){
        startAutoFillCountdown();
      }else if(autoFillRuntime.phase==='wait_click'){
        acceptPostVerifyClick();
      }
      // All clicks during countdown / filling / post-click are intentionally
      // ignored by the Auto Fill state machine.
      return;
    }

    fRequiresPrimaryClick=false;
  }
}
function handleFHotkey(e){
  if(!runtimeEnabled)return;
  if(!e.isTrusted||e.repeat||e.ctrlKey||e.metaKey||e.altKey||str(e.key).toLowerCase()!=='f')return;
  if(feedbackConfig.fillHotkey===false)return;
  e.preventDefault();e.stopPropagation();rememberPointer(e);ensureAudioContext();

  if(autoFillConfig.enabled){
    if(autoFillRuntime.active)stopAutoFillRuntime('paused');
    else startAutoFillRuntime();
    return;
  }

  if(fRequiresPrimaryClick){showBlockedFeedback();return;}
  if(fTriggerInFlight)return;
  fRequiresPrimaryClick=true;fTriggerInFlight=true;
  chrome.runtime.sendMessage({type:'F_HOTKEY_TRIGGER'}).catch(()=>{}).finally(()=>setTimeout(()=>{fTriggerInFlight=false;},120));
}

function hideLegacyLauncher(){
  const launcher=document.getElementById('graph1ks-launcher');
  if(launcher){
    launcher.style.setProperty('display','none','important');
    launcher.style.setProperty('visibility','hidden','important');
    launcher.style.setProperty('opacity','0','important');
    launcher.style.setProperty('pointer-events','none','important');
  }
}

function ensureFeedbackStyles(){
  if(document.getElementById('graph1ks-feedback-style')){
    hideLegacyLauncher();
    return;
  }

  const style=document.createElement('style');
  style.id='graph1ks-feedback-style';
  style.textContent=`
#graph1ks-launcher{
  display:none!important;
  visibility:hidden!important;
  opacity:0!important;
  pointer-events:none!important;
}
.g1fx{position:fixed;width:1px;height:1px;z-index:2147483647;pointer-events:none}
.g1fx i,.g1fx b,.g1fx em{position:absolute;left:0;top:0;transform:translate(-50%,-50%)}
.g1fx i{width:24px;height:24px;border:2px solid #42df9b;border-radius:50%;opacity:0}
.g1fx i:nth-child(2){border-color:#9f69ff}
.g1fx b{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:#42df9b;color:#102018;font:1000 15px Inter,system-ui;opacity:0}
.g1fx.go i:first-child{animation:g1ring .72s ease-out}
.g1fx.go i:nth-child(2){animation:g1ring .9s .06s ease-out}
.g1fx.go b{animation:g1core .85s ease-out}
.g1fx.blocked i{border-color:#ff4f7b}
.g1fx.blocked i:nth-child(2){border-color:#ff9e43}
.g1fx.blocked b{background:#ff4f7b;color:#2b1117}
.g1fx em{top:29px;padding:3px 6px;border-radius:999px;background:#181217;color:#ff9fb1;border:1px solid rgba(255,79,123,.4);font:900 8px Inter,system-ui;opacity:0}
.g1fx.blocked.go em{animation:g1label .95s .08s ease-out}
.g1autofill{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;width:62px;height:62px;display:grid;place-items:center;font-family:Inter,system-ui;contain:layout paint style;isolation:isolate;will-change:transform}.g1autofill .g1autoAura{position:absolute;inset:-8px;border-radius:50%;background:radial-gradient(circle,rgba(159,105,255,.19) 0,rgba(66,223,155,.08) 42%,rgba(0,0,0,0) 72%);opacity:.92}.g1autofill .g1autoSvg{position:absolute;inset:0;width:62px;height:62px;overflow:visible;transform:rotate(-90deg)}.g1autofill .g1autoTrack,.g1autofill .g1autoProgress,.g1autofill .g1autoHighlight{fill:none;stroke-width:3;vector-effect:non-scaling-stroke}.g1autofill .g1autoTrack{stroke:rgba(159,105,255,.18)}.g1autofill .g1autoProgress{stroke:url(#g1AutoGradient);stroke-linecap:round;stroke-dasharray:157.08;stroke-dashoffset:0}.g1autofill .g1autoHighlight{stroke:rgba(255,255,255,.13);stroke-width:1;stroke-dasharray:12 145;stroke-linecap:round}.g1autofill b{position:relative;width:50px;height:50px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;background:linear-gradient(145deg,#241f2a 0%,#151219 58%,#0e0c11 100%);color:#fff;border:1px solid rgba(255,255,255,.16);box-shadow:inset 0 1px 0 rgba(255,255,255,.10),inset 0 -8px 18px rgba(0,0,0,.18),0 7px 17px rgba(0,0,0,.34),0 0 0 1px rgba(159,105,255,.07),0 0 16px rgba(159,105,255,.12)}.g1autofill b:before{content:"";position:absolute;left:9px;top:7px;width:19px;height:8px;border-radius:50%;background:linear-gradient(110deg,rgba(255,255,255,.20),rgba(255,255,255,0));transform:rotate(-14deg);opacity:.68}.g1autofill b strong{position:relative;font:1000 12px ui-monospace,SFMono-Regular,Menlo,monospace;line-height:1;letter-spacing:.1px}.g1autofill b small{position:relative;margin-top:3px;color:#8f8995;font:1000 6px Inter,system-ui;line-height:1;letter-spacing:1px}.g1autofill .g1autoAnchor{position:absolute;width:7px;height:7px;border-radius:50%;background:#fff;border:2px solid rgba(159,105,255,.78);box-shadow:0 0 0 3px rgba(159,105,255,.10)}.g1autofill[data-horizontal="right"][data-vertical="up"] .g1autoAnchor{left:1px;bottom:1px}.g1autofill[data-horizontal="left"][data-vertical="up"] .g1autoAnchor{right:1px;bottom:1px}.g1autofill[data-horizontal="right"][data-vertical="down"] .g1autoAnchor{left:1px;top:1px}.g1autofill[data-horizontal="left"][data-vertical="down"] .g1autoAnchor{right:1px;top:1px}.g1autofill.wait .g1autoProgress,.g1autofill.armed .g1autoProgress{stroke:#ffd36f}.g1autofill.wait .g1autoTrack,.g1autofill.armed .g1autoTrack{stroke:rgba(255,158,67,.18)}.g1autofill.wait .g1autoAura,.g1autofill.armed .g1autoAura{background:radial-gradient(circle,rgba(255,211,111,.20),rgba(255,158,67,.07) 48%,transparent 72%)}.g1autofill.wait b strong,.g1autofill.armed b strong{font-size:9px;color:#ffe4a6}.g1autofill.filling .g1autoProgress{stroke:url(#g1AutoGradient)}.g1autofill.filling .g1autoTrack{stroke:rgba(66,223,155,.16)}.g1autofill.filling b{box-shadow:inset 0 1px 0 rgba(255,255,255,.10),inset 0 -8px 18px rgba(0,0,0,.18),0 7px 17px rgba(0,0,0,.34),0 0 0 1px rgba(66,223,155,.10),0 0 17px rgba(66,223,155,.13)}.g1autofill.filling b strong{font-size:9px;color:#baf8dc}.g1autofill.pause .g1autoProgress{stroke:#817a86}.g1autofill.pause .g1autoTrack{stroke:rgba(167,156,255,.13)}.g1autofill.pause .g1autoAura{opacity:.42}.g1autofill.pause b strong{font-size:9px;color:#c5bfbc}.g1autofill.error .g1autoProgress{stroke:#ff4f7b}.g1autofill.error .g1autoTrack{stroke:rgba(255,158,67,.16)}.g1autofill.error .g1autoAura{background:radial-gradient(circle,rgba(255,79,123,.23),rgba(255,158,67,.07) 48%,transparent 72%)}.g1autofill.error b strong{font-size:9px;color:#ffb0c0}.g1autofill.countdown b strong{font-size:22px;line-height:.9;background:linear-gradient(180deg,#fff 0%,#e9dcff 54%,#b8ffd9 100%);-webkit-background-clip:text;background-clip:text;color:transparent}.g1autofill.countdown b small{color:#bdb5c9}.g1autofill.countdown .g1autoAnchor{background:#42df9b;border-color:rgba(159,105,255,.85)}
.g1hotkeys{position:fixed;left:0;top:0;z-index:2147483647;display:flex;gap:4px;pointer-events:none;contain:layout paint style;isolation:isolate;will-change:transform;font-family:Inter,system-ui;animation:none!important;transition:none!important}.g1hotkeys span{width:18px;height:18px;box-sizing:border-box;border-radius:5px;display:grid;place-items:center;background:rgba(18,16,22,.90);border:1px solid rgba(255,255,255,.15);box-shadow:0 3px 10px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.06);font:900 9px ui-monospace,SFMono-Regular,Menlo,monospace;line-height:1;animation:none!important;transition:none!important}.g1hotkeys span[data-key="f"]{color:#86f0bd;border-color:rgba(66,223,155,.42);box-shadow:0 3px 10px rgba(0,0,0,.32),0 0 0 1px rgba(66,223,155,.06)}.g1hotkeys span[data-key="r"]{color:#c4a8ff;border-color:rgba(159,105,255,.45);box-shadow:0 3px 10px rgba(0,0,0,.32),0 0 0 1px rgba(159,105,255,.07)}.g1hotkeys[data-theme="light"] span{background:#fff;color:#27282d;border-color:#cfd0d7;box-shadow:0 2px 7px rgba(20,20,28,.14),inset 0 1px 0 rgba(255,255,255,.95)}.g1hotkeys[data-theme="light"] span[data-key="f"]{background:#fff;color:#126b49;border-color:#82bca3;box-shadow:0 2px 7px rgba(19,122,82,.13),0 0 0 1px rgba(19,122,82,.05)}.g1hotkeys[data-theme="light"] span[data-key="r"]{background:#fff;color:#54328f;border-color:#aa91d6;box-shadow:0 2px 7px rgba(111,69,197,.14),0 0 0 1px rgba(111,69,197,.05)}.g1hotkeys span[hidden]{display:none!important}
@keyframes g1ring{0%{opacity:0;transform:translate(-50%,-50%) scale(.45)}20%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(2.7)}}
@keyframes g1core{0%{opacity:0;transform:translate(-50%,-50%) scale(.4)}20%{opacity:1;transform:translate(-50%,-50%) scale(1.12)}70%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) scale(.8)}}
@keyframes g1label{0%{opacity:0;transform:translate(-50%,-50%) translateY(4px)}25%{opacity:1;transform:translate(-50%,-50%)}75%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) translateY(-3px)}}
`;
  document.documentElement.appendChild(style);
  hideLegacyLauncher();
}


function activateRuntime(){
  if(runtimeEnabled)return;
  runtimeEnabled=true;

  ensureFeedbackStyles();
  syncHotkeyIndicators();
  document.addEventListener('keydown',handleFHotkey,true);
  document.addEventListener('keydown',handleRHotkey,true);
  document.addEventListener('pointermove',rememberPointer,{capture:true,passive:true});
  document.addEventListener('pointerdown',handlePrimaryPointerDown,{capture:true,passive:true});
  document.addEventListener('visibilitychange',syncAutoFillPointerVisibility,{passive:true});

  hideLegacyLauncher();
  legacyLauncherObserver=new MutationObserver(function(){
    if(runtimeEnabled)hideLegacyLauncher();
  });
  legacyLauncherObserver.observe(document.documentElement,{childList:true,subtree:true});
}

function deactivateRuntime(){
  if(!runtimeEnabled){
    clearAutoFillTimer();
    clearAutoFillPointer();
    clearHotkeyIndicators();
    document.getElementById('graph1ks-pointer-fx')?.remove();
    document.getElementById('graph1ks-feedback-style')?.remove();
    return;
  }

  runtimeEnabled=false;
  clearAutoFillTimer();
  autoFillRuntime.active=false;
  autoFillRuntime.generation++;
  autoFillRuntime.verifiedPending=false;
  autoFillRuntime.requestInFlight=false;
  autoFillRuntime.phase='paused';
  autoFillRuntime.remaining=null;
  fTriggerInFlight=false;
  rTriggerInFlight=false;
  fRequiresPrimaryClick=false;

  document.removeEventListener('keydown',handleFHotkey,true);
  document.removeEventListener('keydown',handleRHotkey,true);
  document.removeEventListener('pointermove',rememberPointer,true);
  document.removeEventListener('pointerdown',handlePrimaryPointerDown,true);
  document.removeEventListener('visibilitychange',syncAutoFillPointerVisibility,false);

  if(legacyLauncherObserver){
    legacyLauncherObserver.disconnect();
    legacyLauncherObserver=null;
  }

  clearAutoFillPointer();
  clearHotkeyIndicators();
  document.getElementById('graph1ks-pointer-fx')?.remove();
  document.getElementById('graph1ks-feedback-style')?.remove();

  if(feedbackAudioContext){
    try{feedbackAudioContext.close().catch(()=>{});}catch(_){}
    feedbackAudioContext=null;
  }
}

function applyContextState(state={}){
  if(state.enabled===true)activateRuntime();
  else deactivateRuntime();
}

chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  if(!message||!message.type)return;
  if(message.type==='GRAPH1KS_OVERLAY_STATUS'){
    sendResponse({ok:true,open:overlayState.open&&!!overlayState.host?.isConnected,topmostOpen:topmostIsOpen(),autoHide:overlayState.autoHide,hidden:overlayState.hidden,width:overlayState.width,opacity:overlayState.opacity});
    return;
  }
  if(message.type==='GRAPH1KS_OVERLAY_SET'){
    setOverlayOpen(message.open===true).then(sendResponse).catch(error=>sendResponse({ok:false,message:error.message||String(error)}));
    return true;
  }
  if(message.type==='GRAPH1KS_OVERLAY_REVEAL'){
    if(overlayState.open)revealOverlay();
    sendResponse({ok:true,open:overlayState.open,hidden:overlayState.hidden});
    return;
  }
  if(message.type==='GRAPH1KS_OVERLAY_GET_SETTINGS'){
    loadOverlayPrefs().then(()=>sendResponse({ok:true,open:overlayState.open,topmostOpen:topmostIsOpen(),autoHide:overlayState.autoHide,hidden:overlayState.hidden,width:overlayState.width,opacity:overlayState.opacity})).catch(error=>sendResponse({ok:false,message:error.message||String(error)}));
    return true;
  }
  if(message.type==='GRAPH1KS_OVERLAY_SET_AUTOHIDE'){
    setOverlayAutoHide(message.autoHide===true).then(sendResponse).catch(error=>sendResponse({ok:false,message:error.message||String(error)}));
    return true;
  }
  if(message.type==='GRAPH1KS_OVERLAY_SET_OPACITY'){
    setOverlayOpacity(message.opacity).then(sendResponse).catch(error=>sendResponse({ok:false,message:error.message||String(error)}));
    return true;
  }
  if(message.type==='GRAPH1KS_TOPMOST_CLOSE'){
    const wasOpen=topmostIsOpen();
    if(wasOpen)closeTopmostWindow({restoreOverlay:message.restoreOverlay!==false});
    sendResponse({ok:true,wasOpen,topmostOpen:topmostIsOpen()});
    return;
  }
  if(message.type==='GRAPH1KS_CONTEXT_STATE'){applyContextState(message.state||{});sendResponse({ok:true,enabled:runtimeEnabled});return;}
  if(message.type==='GRAPH1KS_FEEDBACK_CONFIG'){applyFeedbackConfig(message.config||{});sendResponse({ok:true});return;}
  if(message.type==='GRAPH1KS_AUTO_FILL_CONFIG'){applyAutoFillConfig(message.config||{});sendResponse({ok:true});return;}
  if(message.type==='GRAPH1KS_GET_CURRENT_ACCOUNT'){
    if(!runtimeEnabled){sendResponse({ok:false,message:'Control Deck must be open and Suno must be the active browser tab.'});return;}
    resolveCurrentSunoAccount().then(account=>sendResponse({ok:true,account})).catch(error=>sendResponse({ok:false,message:error.message||String(error)}));
    return true;
  }
  if(message.type==='GRAPH1KS_RETRIEVE_CURRENT'){
    if(!runtimeEnabled){sendResponse({ok:false,message:'Control Deck must be open and Suno must be the active browser tab.'});return;}
    retrieveCurrentRecord().then(record=>sendResponse({ok:true,record})).catch(error=>sendResponse({ok:false,message:error.message||String(error)}));
    return true;
  }
  if(message.type==='GRAPH1KS_AUTOFILL_TRACK'){
    // Direct fills initiated by a Vault double-click are explicit user actions
    // from the open Deck. They may target a Suno tab that is not currently the
    // focused browser tab, so they must not be blocked by hotkey runtime gating.
    if(!runtimeEnabled&&message.directFill!==true){sendResponse({ok:false,errorField:'Extension inactive',message:'Control Deck must be open and Suno must be the active browser tab.'});return;}
    autofill(message.track,message.recordId,{fillMoreOptions:message.fillMoreOptions===true}).then(result=>{if(result?.ok)showVerifiedFeedback();sendResponse(result);}).catch(error=>sendResponse({ok:false,errorField:'Unhandled exception',message:error.message||String(error),diagnosticText:'GRAPH1KS SUNO AUTOFILL DIAGNOSTIC\n'+JSON.stringify({version:EXT_VERSION,url:location.href,error:error.message||String(error),stack:error.stack||null},null,2)}));
    return true;
  }
});

(async function init(){
  // Stay completely dormant until the background confirms both conditions:
  // the Control Deck popup is open AND this tab is the active Suno tab.
  try{
    const r=await chrome.runtime.sendMessage({type:'SUNO_READY'});
    if(Number.isInteger(r?.tabId))overlayState.tabId=r.tabId;
    if(r?.ok&&r.config)applyFeedbackConfig(r.config);
    if(r?.ok&&r.autoFill)applyAutoFillConfig(r.autoFill);
    applyContextState(r?.ok?r.context:{});
  }catch(_){
    deactivateRuntime();
  }
})();
