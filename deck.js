(function(){
  'use strict';

  var APP_VERSION='1.3.4';
  var SURFACE_PARAMS=new URLSearchParams(location.search);
  var SURFACE_NAME=SURFACE_PARAMS.get('surface');
  var DECK_SURFACE=SURFACE_NAME==='overlay'||SURFACE_NAME==='topmost'?SURFACE_NAME:'popup';
  var DOCK_TAB_ID=Number.parseInt(SURFACE_PARAMS.get('dockTabId'),10);
  if(!Number.isFinite(DOCK_TAB_ID))DOCK_TAB_ID=null;
  var SURFACE_HANDOFF_KEY='graph1ks_surface_handoff_v1';
  var surfaceOverlayAutoHide=false;
  var surfaceOverlayOpacity=100;
  var overlayOpacitySendTimer=null;
  var surfaceTransitionBusy=false;
  document.documentElement.setAttribute('data-g1-surface',DECK_SURFACE);
  var THEME_STORAGE_KEY='graph1ks_ui_theme_v1';
  function currentTheme(){return document.documentElement.getAttribute('data-theme')==='light'?'light':'dark';}
  function syncThemeToggle(){
    var btn=document.querySelector('#themeToggle');if(!btn)return;
    var light=currentTheme()==='light';
    var de=false;try{de=window.G1I18N&&G1I18N.getLanguage()==='de';}catch(_){}
    btn.textContent=light?'☀ LIGHT':'☾ DARK';
    btn.setAttribute('aria-pressed',light?'true':'false');
    btn.title=de?(light?'Zum Dark Mode wechseln':'Zum Light Mode wechseln'):(light?'Switch to Dark Mode':'Switch to Light Mode');
    btn.setAttribute('aria-label',btn.title);
  }
  function applyTheme(theme,persist){
    theme=theme==='light'?'light':'dark';
    document.documentElement.setAttribute('data-theme',theme);
    if(persist!==false){try{localStorage.setItem(THEME_STORAGE_KEY,theme);}catch(_){}}
    // Mirror the active appearance to extension storage so Suno-page content-script
    // overlays (F/R cursor badges, etc.) use the same Dark/Light appearance.
    try{if(chrome&&chrome.storage&&chrome.storage.local)chrome.storage.local.set({[THEME_STORAGE_KEY]:theme}).catch(function(){});}catch(_){}
    syncThemeToggle();
    try{window.dispatchEvent(new CustomEvent('graph1ks-theme-changed',{detail:{theme:theme}}));}catch(_){}
  }
  function toggleTheme(){applyTheme(currentTheme()==='light'?'dark':'light',true);}
  var PUBLIC_DB_NAME='graph1ks_prompt_control_deck';
  var DB_NAME=PUBLIC_DB_NAME;
  var DB_VERSION=5;
  var TRACK_STORE='tracks'; // legacy compatibility / one-time migration source
  var TRACK_INDEX_STORE='track_index';
  var TRACK_CONTENT_STORE='track_content';
  var GENRE_MAP_STORE='genre_map';
  var DBM_HISTORY_STORE='db_manager_history';
  var DBM_RULES_STORE='db_manager_rules';
  var DBM_CANONICAL_STORE='db_manager_canonical';
  var INDEX_FIELDS=['title','genre','bpm','emotion','style','year','key','reference_artist','reference_song','created_at','artist_name','artist_handle','artist_user_id','artist_profile_url','suno_song_id','suno_song_url','record_type','genre_source','genre_matched_text','retrieved_at','source_url','voice_name','voice_url','vocal_gender','generation_duration','max_mode','weirdness','style_influence','audio_influence','variety','exclude_styles'];
  var CONTENT_FIELDS=['structured_prompt','negative_prompt','instrumental_arrangement'];
  var DBM_FIELDS={
    title:{label:'Title',store:'index',type:'text'},
    genre:{label:'Genre',store:'index',type:'text',canonical:true},
    bpm:{label:'BPM',store:'index',type:'number'},
    emotion:{label:'Emotion',store:'index',type:'text',canonical:true},
    style:{label:'Style Tag',store:'index',type:'text',canonical:true},
    year:{label:'Year',store:'index',type:'number'},
    created_at:{label:'Creation Date',store:'index',type:'text'},
    artist_name:{label:'Artist',store:'index',type:'text'},
    key:{label:'Key',store:'index',type:'text',canonical:true},
    reference_artist:{label:'Reference Artist',store:'index',type:'text',canonical:true},
    reference_song:{label:'Reference Song',store:'index',type:'text',canonical:true},
    used:{label:'Used',store:'index',type:'boolean'},
    favorite:{label:'Favorite',store:'index',type:'boolean'},
    structured_prompt:{label:'Style',store:'content',type:'text'},
    negative_prompt:{label:'Negative Prompt',store:'content',type:'text'},
    instrumental_arrangement:{label:'Lyrics/Arrangement',store:'content',type:'text'}
  };
  var DBM_CANONICAL_FIELDS=['genre','emotion','style','key','reference_artist','reference_song'];
  var DBM_HISTORY_LIMIT=24;
  var DBM_HISTORY_MAX_BYTES=64*1024*1024;
  var VIRTUAL_ROW_HEIGHT=36;
  var VIRTUAL_OVERSCAN=14;
  var CONTENT_CACHE_LIMIT=32;
  var LAST_LIST_KEY='graph1ks_last_list_v1';
  var FACTORY_SEED_KEY='graph1ks_factory_public_seed_v1';
  var FACTORY_PUBLIC_ASSET='data/GRAPH1KS_PUBLIC_VAULT_FACTORY.json.gz';
  var FACTORY_GENRE_ASSET='data/GRAPH1KS_GENRE_MAP_FACTORY.json';
  var FACTORY_RELEASE='1.3.4';
  var FACTORY_TAXONOMY_VERSION=6;
  var FACTORY_TAXONOMY_MARKER_PREFIX='graph1ks_genre_taxonomy_v6_';
  var VAULT_REGISTRY_KEY='graph1ks_suno_vault_registry_v1';
  var ACTIVE_VAULT_KEY='graph1ks_suno_active_vault_key_v1';
  var AUTOFIT_STORAGE_KEY='graph1ks_textarea_autofit_v1';
  var VAULT_DB_VERSION=1;
  var VAULT_RECORD_STORE='records';
  var VAULT_META_STORE='meta';
  var PRIVATE_PROVENANCE_FIELDS=new Set(['artist_name','artist_handle','artist_user_id','artist_profile_url','suno_song_id','suno_song_url','source_url','record_type','retrieved_at','reference_artist','reference_song']);

  var MAJOR_GENRES=[
    'Pop','Rock','Metal','Punk / Hardcore','Hip-Hop / Rap','R&B','Soul','Funk / Disco',
    'Jazz','Blues','Country','Folk / Traditional','Electronic','Dance / EDM','Ambient / New Age',
    'Reggae / Dub / Ska','Latin','African / Afrobeats','World / Regional','Classical',
    'Gospel / Religious','Easy Listening / Lounge','Experimental / Avant-Garde','Soundtrack / Stage / Screen'
  ];

  var REQUIRED_FIELDS=['title','genre','bpm','emotion','style','year','key','reference_artist','reference_song','structured_prompt','negative_prompt','instrumental_arrangement'];
  var MULTILINE_FIELDS=['structured_prompt','negative_prompt','instrumental_arrangement'];

  var state={
    records:[], recordById:new Map(), genreMap:new Map(), genreIdentityMap:new Map(),
    selectedId:null, selectedFull:null, selectedIds:new Set(), lastClickedVisibleIndex:null,
    contentCache:new Map(), viewCache:null, genreStatsCache:null,
    majorSelection:new Set(), subgenreSelection:new Set(), canonicalMap:new Map(),
    randomViewIds:null, randomViewMeta:null,
    dbManagerOpen:false, dbManagerTab:'replace', dbManagerPreview:null,
    dbManagerApplying:false, dbManagerCancel:false, dbmNormalizationGroups:[],
    autoNormalizeImports:true,
    query:'', searchField:'all', genreFilter:{type:'all',value:null,values:[]}, genreSearch:'', sort:'id-asc', status:'all',
    sidebarSide:'right', editUnlocked:false, deleteConfirmStage:0, deleteDbStage:0, restorePublicStage:0,
    autofilling:false, autofillError:null, autoUsedAfterAutofill:false, autoNextAfterAutofill:false,
    autoFillEnabled:false, autoFillSeconds:8, autoFillRuntimePhase:'paused', autoFillRemaining:null,
    autoFillPending:null,
    sunoContextActive:false, sunoTabId:null,
    vaultRegistry:{}, activeVaultKey:null, vaultRecords:[], selectedVaultRecordId:null, pendingRetrieve:null,
    soundFeedback:true, radialFeedback:true, fillHotkeyEnabled:true, retrieveHotkeyEnabled:true, fillMoreOptionsEnabled:true,
    virtualRaf:0, searchTimer:0,
    activeDataset:'public', publicGenreVocabulary:null, retrievalReadyVaults:new Set(), dbmPatchLoaded:null, genreRandomExpanded:false, genreTaxonomyVersion:FACTORY_TAXONOMY_VERSION,
    autoFitFields:{structured_prompt:false,instrumental_arrangement:false}, vaultEditorOpen:false, vaultEditorBpmDirty:false, vaultEditorYearDirty:false
  };

  var vaultDirectClick={
    lastId:null,lastAt:0,suppressId:null,suppressUntil:0,
    lastTriggeredId:null,lastTriggeredAt:0,inFlight:false,
    indicatorTimer:0
  };

  var deckRoot=document.querySelector('#deckRoot');
  var deckHost=document.querySelector('#deckHost');
  var $=function(sel,root){return (root||deckRoot||document).querySelector(sel);};
  var $$=function(sel,root){return Array.from((root||deckRoot||document).querySelectorAll(sel));};

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function normKey(v){return String(v==null?'':v).trim().replace(/\s+/g,' ').toLowerCase();}
  function genreIdentity(v){
    return String(v==null?'':v)
      .normalize('NFKD')
      .toLocaleLowerCase()
      .replace(/\p{M}+/gu,'')
      .replace(/[^\p{L}\p{N}]+/gu,'');
  }
  function canonicalMajor(v){var k=normKey(v);return MAJOR_GENRES.find(function(m){return normKey(m)===k;})||null;}
  function rebuildGenreIdentityMap(){
    var map=new Map();
    state.genreMap.forEach(function(row){
      var key=genreIdentity(row&&row.genre);
      if(key&&!map.has(key))map.set(key,row);
    });
    state.genreIdentityMap=map;
    return map;
  }
  function normalizeMultiline(v){return String(v==null?'':v).replace(/\r\n?/g,'\n');}

  function loadAutoFitSettings(){
    try{
      var raw=JSON.parse(localStorage.getItem(AUTOFIT_STORAGE_KEY)||'{}');
      state.autoFitFields.structured_prompt=raw.structured_prompt===true;
      state.autoFitFields.instrumental_arrangement=raw.instrumental_arrangement===true;
    }catch(_){state.autoFitFields={structured_prompt:false,instrumental_arrangement:false};}
  }
  function saveAutoFitSettings(){
    try{localStorage.setItem(AUTOFIT_STORAGE_KEY,JSON.stringify(state.autoFitFields));}catch(_){ }
  }
  function autoFitEnabled(key){return !!(state.autoFitFields&&state.autoFitFields[key]);}
  function fitTextarea(el){
    if(!el)return;
    el.style.height='auto';
    el.style.height=Math.max(el.scrollHeight+2,76)+'px';
  }
  function applyAutoFit(root){
    $$('textarea[data-autofit-field]',root||deckRoot).forEach(function(el){
      var key=el.dataset.autofitField;
      el.classList.toggle('autoFitActive',autoFitEnabled(key));
      if(autoFitEnabled(key))fitTextarea(el);
      else el.style.height='';
    });
    $$('[data-autofit-key]',root||deckRoot).forEach(function(btn){
      var on=autoFitEnabled(btn.dataset.autofitKey);
      btn.classList.toggle('on',on);
      btn.setAttribute('aria-pressed',on?'true':'false');
      btn.textContent=on?'✓ AUTO FIT':'AUTO FIT';
    });
  }
  function toggleAutoFit(key){
    if(key!=='structured_prompt'&&key!=='instrumental_arrangement')return;
    state.autoFitFields[key]=!autoFitEnabled(key);
    saveAutoFitSettings();
    applyAutoFit(deckRoot);
  }

  function surfaceHandoffSnapshot(){
    return {
      schema:1,
      saved_at:Date.now(),
      activeDataset:state.activeDataset,
      activeVaultKey:state.activeVaultKey||null,
      selectedId:state.selectedId==null?null:Number(state.selectedId),
      selectedIds:Array.from(state.selectedIds||[]).map(Number).filter(Number.isFinite),
      query:String(state.query||''),
      searchField:String(state.searchField||'all'),
      sort:String(state.sort||'id-asc'),
      status:String(state.status||'all'),
      sidebarSide:state.sidebarSide==='left'?'left':'right'
    };
  }

  function persistSurfaceHandoff(){
    try{localStorage.setItem(SURFACE_HANDOFF_KEY,JSON.stringify(surfaceHandoffSnapshot()));}catch(_){ }
  }

  function consumeSurfaceHandoff(){
    var raw=null;
    try{raw=localStorage.getItem(SURFACE_HANDOFF_KEY);localStorage.removeItem(SURFACE_HANDOFF_KEY);}catch(_){return null;}
    if(!raw)return null;
    try{
      var parsed=JSON.parse(raw);
      if(!parsed||parsed.schema!==1)return null;
      if(!Number.isFinite(Number(parsed.saved_at))||Date.now()-Number(parsed.saved_at)>60000)return null;
      return parsed;
    }catch(_){return null;}
  }

  async function restoreSurfaceHandoff(saved){
    if(!saved)return false;
    var wanted=saved.activeDataset==='private'?'private':'public';
    if(wanted!==state.activeDataset){
      await switchDataset(wanted,wanted==='private'?saved.activeVaultKey:null);
    }else if(wanted==='private'&&saved.activeVaultKey&&state.vaultRegistry[saved.activeVaultKey]&&saved.activeVaultKey!==state.activeVaultKey){
      await switchDataset('private',saved.activeVaultKey);
    }

    state.query=String(saved.query||'');
    state.searchField=String(saved.searchField||'all');
    state.sort=String(saved.sort||'id-asc');
    state.status=String(saved.status||'all');
    state.sidebarSide=saved.sidebarSide==='left'?'left':'right';

    var validIds=Array.isArray(saved.selectedIds)?saved.selectedIds.map(Number).filter(function(id){return Number.isFinite(id)&&state.recordById.has(id);}):[];
    state.selectedIds=new Set(validIds);
    var selected=Number(saved.selectedId);
    if(Number.isFinite(selected)&&state.recordById.has(selected)){
      state.selectedId=selected;
      state.selectedFull=await getFullTrack(selected);
    }else{
      state.selectedId=null;
      state.selectedFull=null;
    }

    var search=$('#searchInput');if(search)search.value=state.query;
    var field=$('#searchField');if(field&&Array.from(field.options).some(function(o){return o.value===state.searchField;}))field.value=state.searchField;
    var sort=$('#sortSelect');if(sort&&Array.from(sort.options).some(function(o){return o.value===state.sort;}))sort.value=state.sort;
    var status=$('#statusFilter');if(status&&Array.from(status.options).some(function(o){return o.value===state.status;}))status.value=state.status;

    invalidateView(true);
    renderAll();
    return true;
  }

  function clampOverlayOpacity(value){
    var n=Math.round(Number(value));
    return Math.max(60,Math.min(100,Number.isFinite(n)?n:100));
  }

  function syncOverlayOpacityUi(value){
    surfaceOverlayOpacity=clampOverlayOpacity(value);
    var range=$('#overlayOpacityRange');
    var label=$('#overlayOpacityValue');
    if(range&&Number(range.value)!==surfaceOverlayOpacity)range.value=String(surfaceOverlayOpacity);
    if(label)label.textContent=surfaceOverlayOpacity+'%';
  }

  async function setOverlayOpacity(value,showError){
    var next=clampOverlayOpacity(value);
    syncOverlayOpacityUi(next);
    try{
      var result=await chrome.runtime.sendMessage({type:'SET_OVERLAY_OPACITY',opacity:next,targetTabId:DOCK_TAB_ID});
      if(!result||result.ok!==true)throw new Error(result&&result.error?result.error:'Could not update overlay opacity.');
      syncOverlayOpacityUi(result.opacity);
      return result;
    }catch(error){
      if(showError!==false)toast('Opacity update failed',error.message||String(error));
      throw error;
    }
  }

  async function configureSurfaceControls(){
    var autoBtn=$('#overlayAutoHideBtn');
    var switchBtn=$('#surfaceSwitchBtn');
    var topmostBtn=$('#topmostBtn');
    if(topmostBtn)topmostBtn.classList.toggle('hidden',DECK_SURFACE!=='overlay');
    if(DECK_SURFACE==='overlay'){
      if(autoBtn)autoBtn.classList.remove('hidden');
      if(switchBtn){switchBtn.textContent='↗ POP OUT';switchBtn.title='Open the Control Deck in its own window and close the Suno overlay';}
      try{
        var settings=await chrome.runtime.sendMessage({type:'GET_OVERLAY_SETTINGS'});
        if(settings&&settings.ok){
          surfaceOverlayAutoHide=settings.autoHide===true;
          syncOverlayOpacityUi(settings.opacity);
          if(autoBtn){autoBtn.classList.toggle('on',surfaceOverlayAutoHide);autoBtn.textContent=surfaceOverlayAutoHide?'✓ AUTO-HIDE':'AUTO-HIDE';}
        }
      }catch(_){ }
    }else{
      if(autoBtn)autoBtn.classList.add('hidden');
      if(switchBtn){switchBtn.textContent='⇥ DOCK TO SUNO';switchBtn.title='Dock the Control Deck as the floating Suno overlay and close this window';}
      try{
        var popupSettings=await chrome.runtime.sendMessage({type:'GET_OVERLAY_SETTINGS',targetTabId:DOCK_TAB_ID});
        if(popupSettings&&popupSettings.ok)syncOverlayOpacityUi(popupSettings.opacity);
      }catch(_){syncOverlayOpacityUi(surfaceOverlayOpacity);}
    }
  }

  async function switchDeckSurface(){
    if(surfaceTransitionBusy)return;
    surfaceTransitionBusy=true;
    var button=$('#surfaceSwitchBtn');
    if(button)button.disabled=true;
    persistSurfaceHandoff();
    try{
      var result;
      if(DECK_SURFACE==='overlay'){
        result=await chrome.runtime.sendMessage({type:'DECK_POPOUT'});
      }else{
        result=await chrome.runtime.sendMessage({type:'DECK_DOCK',targetTabId:DOCK_TAB_ID});
      }
      if(!result||result.ok!==true)throw new Error(result&&result.error?result.error:'Surface switch failed.');
    }catch(error){
      surfaceTransitionBusy=false;
      if(button)button.disabled=false;
      toast('Surface switch failed',error.message||String(error));
    }
  }

  async function toggleOverlayAutoHide(){
    if(DECK_SURFACE!=='overlay')return;
    var next=!surfaceOverlayAutoHide;
    var button=$('#overlayAutoHideBtn');
    if(button)button.disabled=true;
    try{
      var result=await chrome.runtime.sendMessage({type:'SET_OVERLAY_AUTOHIDE',autoHide:next});
      if(!result||result.ok!==true)throw new Error(result&&result.error?result.error:'Could not update Auto-hide.');
      surfaceOverlayAutoHide=result.autoHide===true;
      if(button){button.classList.toggle('on',surfaceOverlayAutoHide);button.textContent=surfaceOverlayAutoHide?'✓ AUTO-HIDE':'AUTO-HIDE';}
    }catch(error){
      toast('Auto-hide failed',error.message||String(error));
    }finally{
      if(button)button.disabled=false;
    }
  }

  function dbmWhitespace(v){
    return String(v==null?'':v)
      .normalize('NFKC')
      .replace(/[\u00A0\u2007\u202F]/g,' ')
      .trim()
      .replace(/\s+/g,' ');
  }

  function dbmVariantKey(v){
    return dbmWhitespace(v).toLocaleLowerCase();
  }

  function dbmCanonicalKey(field,value){
    return String(field)+'|'+dbmVariantKey(value);
  }

  function dbmTitleCase(v){
    var small=new Set(['and','or','of','the','a','an','in','on','to','for','with','by']);
    var words=dbmWhitespace(v).toLocaleLowerCase().split(' ');
    return words.map(function(word,index){
      if(!word)return word;
      if(index>0&&small.has(word))return word;
      return word.split(/([\/&-])/).map(function(part){
        if(part==='/'||part==='&'||part==='-')return part;
        return part?part.charAt(0).toLocaleUpperCase()+part.slice(1):part;
      }).join('');
    }).join(' ');
  }

  function dbmBuiltInCanonical(field,key){
    if(field==='genre'){
      var fixedMajor=MAJOR_GENRES.find(function(major){
        return dbmVariantKey(major)===key;
      });
      if(fixedMajor)return fixedMajor;
    }

    var dict={
      'genre|easy listening':'Easy Listening',
      'genre|r&b':'R&B',
      'genre|edm':'EDM',
      'genre|idm':'IDM',
      'genre|uk garage':'UK Garage',
      'genre|lo-fi':'Lo-Fi',
      'genre|hip-hop':'Hip-Hop',
      'genre|hip hop':'Hip Hop',
      'genre|drum & bass':'Drum & Bass',
      'genre|afrobeats':'Afrobeats',
      'genre|dnb':'DnB',
      'genre|k-pop':'K-Pop',
      'genre|j-pop':'J-Pop',
      'genre|rock':'Rock',
      'genre|pop':'Pop',
      'genre|jazz':'Jazz',
      'genre|blues':'Blues'
    };
    return dict[field+'|'+key]||null;
  }

  function dbmSuggestCanonical(field,variants){
    variants=variants||[];
    var key=variants.length?dbmVariantKey(variants[0].value):'';
    var stored=state.canonicalMap.get(field+'|'+key);
    if(stored&&stored.canonical)return stored.canonical;

    var builtIn=dbmBuiltInCanonical(field,key);
    if(builtIn)return builtIn;

    var best=variants.slice().sort(function(a,b){
      if(Number(b.count)!==Number(a.count))return Number(b.count)-Number(a.count);
      return String(a.value).localeCompare(String(b.value));
    })[0];

    var base=dbmWhitespace(best?best.value:'');
    if(['genre','emotion','style','key'].includes(field))return dbmTitleCase(base);
    return base;
  }

  function applyCanonicalTrack(track){
    if(!state.autoNormalizeImports||!track)return track;

    DBM_CANONICAL_FIELDS.forEach(function(field){
      var current=track[field];
      if(current==null||current==='')return;
      var row=state.canonicalMap.get(dbmCanonicalKey(field,current));
      if(row&&row.canonical)track[field]=row.canonical;
    });

    return track;
  }

  function clone(obj){return JSON.parse(JSON.stringify(obj));}
  function nowIso(){return new Date().toISOString();}

  function isPrivateDataset(){return state.activeDataset==='private';}
  function activeDbName(){
    if(!isPrivateDataset())return PUBLIC_DB_NAME;
    var entry=activeVaultEntry();
    return entry&&entry.dbName?entry.dbName:null;
  }
  function privateVaultArtistLabel(entry,includeHandle){
    if(!entry)return 'PRIVATE VAULT';
    var displayName=String(entry.displayName||'').trim();
    var handle=String(entry.handle||'').replace(/^@/,'').trim();
    if(displayName&&handle&&includeHandle!==false)return displayName+' · @'+handle;
    return displayName||(handle?'@'+handle:'PRIVATE VAULT');
  }
  function activeVaultLabel(){
    if(!isPrivateDataset())return 'PUBLIC VAULT';
    return privateVaultArtistLabel(activeVaultEntry(),true);
  }

  function uiText(value){return window.G1I18N&&typeof window.G1I18N.t==='function'?window.G1I18N.t(value):String(value==null?'':value);}
  function toast(title,message){
    title=uiText(title);message=uiText(message||'');
    var el=$('#toast'); el.innerHTML='<strong>'+esc(title)+'</strong><span>'+esc(message||'')+'</span>';el.classList.remove('hidden');
    clearTimeout(toast._t);toast._t=setTimeout(function(){el.classList.add('hidden');},3200);
  }
  function setImportStatus(text,kind){var el=$('#importStatus');el.textContent=uiText(text);el.classList.remove('hidden');el.dataset.kind=kind||'';clearTimeout(setImportStatus._t);setImportStatus._t=setTimeout(function(){el.classList.add('hidden');},8000);}

  function openDb(dbName){
    dbName=dbName||activeDbName();
    return new Promise(function(resolve,reject){
      if(!dbName){reject(new Error('No active Private Vault database is selected.'));return;}
      var req=indexedDB.open(dbName,DB_VERSION);

      req.onupgradeneeded=function(event){
        var db=req.result;
        var tx=req.transaction;
        var oldVersion=event.oldVersion||0;

        if(!db.objectStoreNames.contains(TRACK_STORE)){
          db.createObjectStore(TRACK_STORE,{keyPath:'id'});
        }

        var indexStore;
        if(!db.objectStoreNames.contains(TRACK_INDEX_STORE)){
          indexStore=db.createObjectStore(TRACK_INDEX_STORE,{keyPath:'id'});
        }else{
          indexStore=tx.objectStore(TRACK_INDEX_STORE);
        }

        if(!indexStore.indexNames.contains('genre_key'))indexStore.createIndex('genre_key','genre_key',{unique:false});
        if(!indexStore.indexNames.contains('used_flag'))indexStore.createIndex('used_flag','used_flag',{unique:false});
        if(!indexStore.indexNames.contains('favorite_flag'))indexStore.createIndex('favorite_flag','favorite_flag',{unique:false});
        if(!indexStore.indexNames.contains('year'))indexStore.createIndex('year','year',{unique:false});
        if(!indexStore.indexNames.contains('bpm'))indexStore.createIndex('bpm','bpm',{unique:false});
        if(!indexStore.indexNames.contains('suno_song_id'))indexStore.createIndex('suno_song_id','suno_song_id',{unique:false});

        var contentStore;
        if(!db.objectStoreNames.contains(TRACK_CONTENT_STORE)){
          contentStore=db.createObjectStore(TRACK_CONTENT_STORE,{keyPath:'id'});
        }else{
          contentStore=tx.objectStore(TRACK_CONTENT_STORE);
        }

        if(!db.objectStoreNames.contains(GENRE_MAP_STORE)){
          db.createObjectStore(GENRE_MAP_STORE,{keyPath:'genre_key'});
        }

        if(!db.objectStoreNames.contains(DBM_HISTORY_STORE)){
          db.createObjectStore(DBM_HISTORY_STORE,{keyPath:'id',autoIncrement:true});
        }

        if(!db.objectStoreNames.contains(DBM_RULES_STORE)){
          db.createObjectStore(DBM_RULES_STORE,{keyPath:'id',autoIncrement:true});
        }

        if(!db.objectStoreNames.contains(DBM_CANONICAL_STORE)){
          db.createObjectStore(DBM_CANONICAL_STORE,{keyPath:'key'});
        }

        // V3 -> V4 one-time optimization. Keep the old store untouched as a
        // safety backup, but split its heavy rows into metadata + content.
        if(oldVersion<3 && db.objectStoreNames.contains(TRACK_STORE)){
          try{setImportStatus('Optimizing existing database… one-time migration to fast index/content stores.','working');}catch(_){}
          var legacy=tx.objectStore(TRACK_STORE);
          var cursorReq=legacy.openCursor();
          var migrated=0;

          cursorReq.onsuccess=function(){
            var cursor=cursorReq.result;
            if(!cursor)return;

            var full=hydrateStoredTrack(cursor.value);
            if(full&&Number.isFinite(Number(full.id))){
              indexStore.put(toIndexRecord(full));
              contentStore.put(toContentRecord(full));
              migrated++;
              if(migrated%1000===0){
                try{setImportStatus('Optimizing database… '+migrated+' tracks migrated.','working');}catch(_){}
              }
            }
            cursor.continue();
          };
        }
      };

      req.onsuccess=function(){
        var db=req.result;
        db.onversionchange=function(){db.close();};
        resolve(db);
      };
      req.onerror=function(){reject(req.error);};
      req.onblocked=function(){reject(new Error('Database upgrade is blocked by another GRAPH1KS window. Close other deck windows and retry.'));};
    });
  }

  async function withTx(stores,mode,fn,dbName){
    var db=await openDb(dbName);
    return new Promise(function(resolve,reject){
      var tx=db.transaction(stores,mode);
      var result;
      try{result=fn(tx);}catch(error){db.close();reject(error);return;}
      tx.oncomplete=function(){db.close();resolve(result);};
      tx.onerror=function(){var error=tx.error;db.close();reject(error);};
      tx.onabort=function(){var error=tx.error;db.close();reject(error);};
    });
  }

  async function indexAll(dbName){
    var db=await openDb(dbName);
    return new Promise(function(resolve,reject){
      var tx=db.transaction(TRACK_INDEX_STORE,'readonly');
      var req=tx.objectStore(TRACK_INDEX_STORE).getAll();
      req.onsuccess=function(){resolve(req.result||[]);};
      req.onerror=function(){reject(req.error);};
      tx.oncomplete=function(){db.close();};
      tx.onabort=function(){db.close();};
    });
  }

  async function mapAll(dbName){
    var db=await openDb(dbName);
    return new Promise(function(resolve,reject){
      var tx=db.transaction(GENRE_MAP_STORE,'readonly');
      var req=tx.objectStore(GENRE_MAP_STORE).getAll();
      req.onsuccess=function(){resolve(req.result||[]);};
      req.onerror=function(){reject(req.error);};
      tx.oncomplete=function(){db.close();};
      tx.onabort=function(){db.close();};
    });
  }

  async function maxTrackId(dbName){
    var db=await openDb(dbName);
    return new Promise(function(resolve,reject){
      var tx=db.transaction(TRACK_INDEX_STORE,'readonly');
      var req=tx.objectStore(TRACK_INDEX_STORE).openCursor(null,'prev');
      req.onsuccess=function(){resolve(req.result?Number(req.result.key)||0:0);};
      req.onerror=function(){reject(req.error);};
      tx.oncomplete=function(){db.close();};
      tx.onabort=function(){db.close();};
    });
  }

  async function findIndexBySunoSongId(dbName,songId){
    if(!songId)return null;
    var db=await openDb(dbName);
    return new Promise(function(resolve,reject){
      var tx=db.transaction(TRACK_INDEX_STORE,'readonly');
      var req=tx.objectStore(TRACK_INDEX_STORE).index('suno_song_id').get(String(songId));
      req.onsuccess=function(){resolve(req.result||null);};
      req.onerror=function(){reject(req.error);};
      tx.oncomplete=function(){db.close();};
      tx.onabort=function(){db.close();};
    });
  }

  async function storeCount(storeName,dbName){
    var db=await openDb(dbName);
    return new Promise(function(resolve,reject){
      var tx=db.transaction(storeName,'readonly');
      var req=tx.objectStore(storeName).count();
      req.onsuccess=function(){resolve(Number(req.result)||0);};
      req.onerror=function(){reject(req.error);};
      tx.oncomplete=function(){db.close();};
      tx.onabort=function(){db.close();};
    });
  }

  async function getContentRecord(id){
    if(state.contentCache.has(id)){
      var cached=state.contentCache.get(id);
      state.contentCache.delete(id);
      state.contentCache.set(id,cached);
      return cached;
    }

    var db=await openDb();
    var result=await new Promise(function(resolve,reject){
      var tx=db.transaction(TRACK_CONTENT_STORE,'readonly');
      var req=tx.objectStore(TRACK_CONTENT_STORE).get(id);
      req.onsuccess=function(){resolve(req.result||{id:id,structured_prompt:'',negative_prompt:'',instrumental_arrangement:''});};
      req.onerror=function(){reject(req.error);};
      tx.oncomplete=function(){db.close();};
      tx.onabort=function(){db.close();};
    });

    cacheContent(result);
    return result;
  }

  async function getAllContentRecords(dbName){
    var db=await openDb(dbName);
    return new Promise(function(resolve,reject){
      var tx=db.transaction(TRACK_CONTENT_STORE,'readonly');
      var req=tx.objectStore(TRACK_CONTENT_STORE).getAll();
      req.onsuccess=function(){resolve(req.result||[]);};
      req.onerror=function(){reject(req.error);};
      tx.oncomplete=function(){db.close();};
      tx.onabort=function(){db.close();};
    });
  }

  async function putIndexRecord(rec,dbName){
    var indexRec=toIndexRecord(rec);
    return withTx([TRACK_INDEX_STORE],'readwrite',function(tx){tx.objectStore(TRACK_INDEX_STORE).put(indexRec);},dbName);
  }

  async function putIndexMany(records,dbName){
    var chunks=[];
    for(var i=0;i<records.length;i+=500)chunks.push(records.slice(i,i+500));
    for(var c=0;c<chunks.length;c++){
      await withTx([TRACK_INDEX_STORE],'readwrite',function(tx){
        var os=tx.objectStore(TRACK_INDEX_STORE);
        chunks[c].forEach(function(r){os.put(toIndexRecord(r));});
      },dbName);
      await yieldUi();
    }
  }

  async function putFullRecord(rec,dbName){
    var indexRec=toIndexRecord(rec);
    var contentRec=toContentRecord(rec);
    await withTx([TRACK_INDEX_STORE,TRACK_CONTENT_STORE],'readwrite',function(tx){
      tx.objectStore(TRACK_INDEX_STORE).put(indexRec);
      tx.objectStore(TRACK_CONTENT_STORE).put(contentRec);
    },dbName);
    if(!dbName||dbName===activeDbName())cacheContent(contentRec);
  }

  async function putFullChunk(records,dbName){
    await withTx([TRACK_INDEX_STORE,TRACK_CONTENT_STORE],'readwrite',function(tx){
      var ix=tx.objectStore(TRACK_INDEX_STORE);
      var cs=tx.objectStore(TRACK_CONTENT_STORE);
      records.forEach(function(r){ix.put(toIndexRecord(r));cs.put(toContentRecord(r));});
    },dbName);
  }

  // Compatibility wrappers used by a few UI paths.
  async function putRecord(rec){
    var hasHeavy=CONTENT_FIELDS.some(function(k){return Object.prototype.hasOwnProperty.call(rec,k);});
    return hasHeavy?putFullRecord(rec):putIndexRecord(rec);
  }

  async function putMany(records){
    var hasHeavy=records.length&&CONTENT_FIELDS.some(function(k){return Object.prototype.hasOwnProperty.call(records[0],k);});
    if(hasHeavy){
      for(var i=0;i<records.length;i+=350){await putFullChunk(records.slice(i,i+350));await yieldUi();}
      return;
    }
    return putIndexMany(records);
  }

  async function deleteIds(ids){
    await withTx([TRACK_INDEX_STORE,TRACK_CONTENT_STORE,TRACK_STORE],'readwrite',function(tx){
      var ix=tx.objectStore(TRACK_INDEX_STORE);
      var cs=tx.objectStore(TRACK_CONTENT_STORE);
      var legacy=tx.objectStore(TRACK_STORE);
      ids.forEach(function(id){ix.delete(id);cs.delete(id);legacy.delete(id);});
    });
    ids.forEach(function(id){state.contentCache.delete(id);});
  }

  async function clearTracks(dbName){
    await withTx([TRACK_INDEX_STORE,TRACK_CONTENT_STORE,TRACK_STORE],'readwrite',function(tx){
      tx.objectStore(TRACK_INDEX_STORE).clear();
      tx.objectStore(TRACK_CONTENT_STORE).clear();
      tx.objectStore(TRACK_STORE).clear();
    },dbName);
    if(!dbName||dbName===activeDbName())state.contentCache.clear();
  }

  async function clearGenreMappings(dbName){
    return withTx([GENRE_MAP_STORE],'readwrite',function(tx){
      tx.objectStore(GENRE_MAP_STORE).clear();
    },dbName);
  }

  async function putMappings(rows,dbName){
    return withTx([GENRE_MAP_STORE],'readwrite',function(tx){
      var os=tx.objectStore(GENRE_MAP_STORE);
      rows.forEach(function(r){os.put(r);});
    },dbName);
  }

  async function replaceMappingsAtomic(rows,dbName){
    return withTx([GENRE_MAP_STORE],'readwrite',function(tx){
      var os=tx.objectStore(GENRE_MAP_STORE);
      os.clear();
      rows.forEach(function(r){os.put(r);});
    },dbName);
  }

  async function deleteMappings(keys){
    if(!keys||!keys.length)return;
    return withTx([GENRE_MAP_STORE],'readwrite',function(tx){
      var os=tx.objectStore(GENRE_MAP_STORE);
      keys.forEach(function(key){os.delete(key);});
    });
  }

  async function canonicalAll(){
    var db=await openDb();
    return new Promise(function(resolve,reject){
      var tx=db.transaction(DBM_CANONICAL_STORE,'readonly');
      var req=tx.objectStore(DBM_CANONICAL_STORE).getAll();
      req.onsuccess=function(){resolve(req.result||[]);};
      req.onerror=function(){reject(req.error);};
      tx.oncomplete=function(){db.close();};
      tx.onabort=function(){db.close();};
    });
  }

  async function putCanonicalRows(rows){
    if(!rows||!rows.length)return;
    await withTx([DBM_CANONICAL_STORE],'readwrite',function(tx){
      var os=tx.objectStore(DBM_CANONICAL_STORE);
      rows.forEach(function(row){os.put(row);});
    });
    rows.forEach(function(row){state.canonicalMap.set(row.key,row);});
  }

  async function dbmHistoryAll(){
    var db=await openDb();
    return new Promise(function(resolve,reject){
      var tx=db.transaction(DBM_HISTORY_STORE,'readonly');
      var req=tx.objectStore(DBM_HISTORY_STORE).getAll();
      req.onsuccess=function(){
        var rows=req.result||[];
        rows.sort(function(a,b){return Number(b.id)-Number(a.id);});
        resolve(rows);
      };
      req.onerror=function(){reject(req.error);};
      tx.oncomplete=function(){db.close();};
      tx.onabort=function(){db.close();};
    });
  }

  async function dbmHistoryAdd(record){
    var db=await openDb();
    return new Promise(function(resolve,reject){
      var tx=db.transaction(DBM_HISTORY_STORE,'readwrite');
      var req=tx.objectStore(DBM_HISTORY_STORE).add(record);
      var id=null;
      req.onsuccess=function(){id=req.result;};
      req.onerror=function(){reject(req.error);};
      tx.oncomplete=function(){db.close();resolve(id);};
      tx.onabort=function(){var err=tx.error;db.close();reject(err);};
    });
  }

  async function dbmHistoryDelete(id){
    return withTx([DBM_HISTORY_STORE],'readwrite',function(tx){
      tx.objectStore(DBM_HISTORY_STORE).delete(Number(id));
    });
  }

  async function dbmHistoryTrim(){
    var rows=await dbmHistoryAll();
    var keep=[];
    var remove=[];
    var bytes=0;

    rows.forEach(function(row,index){
      var size=0;
      try{size=JSON.stringify(row).length*2;}catch(_){size=0;}

      if(index<DBM_HISTORY_LIMIT && (bytes+size<=DBM_HISTORY_MAX_BYTES || keep.length===0)){
        keep.push(row);
        bytes+=size;
      }else{
        remove.push(row);
      }
    });

    if(!remove.length)return;

    await withTx([DBM_HISTORY_STORE],'readwrite',function(tx){
      var os=tx.objectStore(DBM_HISTORY_STORE);
      remove.forEach(function(row){os.delete(Number(row.id));});
    });
  }

  async function dbmRulesAll(){
    var db=await openDb();
    return new Promise(function(resolve,reject){
      var tx=db.transaction(DBM_RULES_STORE,'readonly');
      var req=tx.objectStore(DBM_RULES_STORE).getAll();
      req.onsuccess=function(){
        var rows=req.result||[];
        rows.sort(function(a,b){return Number(a.id)-Number(b.id);});
        resolve(rows);
      };
      req.onerror=function(){reject(req.error);};
      tx.oncomplete=function(){db.close();};
      tx.onabort=function(){db.close();};
    });
  }

  async function dbmRuleAdd(rule){
    var db=await openDb();
    return new Promise(function(resolve,reject){
      var tx=db.transaction(DBM_RULES_STORE,'readwrite');
      var copy=clone(rule);
      delete copy.id;
      var req=tx.objectStore(DBM_RULES_STORE).add(copy);
      var id=null;
      req.onsuccess=function(){id=req.result;};
      req.onerror=function(){reject(req.error);};
      tx.oncomplete=function(){db.close();resolve(id);};
      tx.onabort=function(){var err=tx.error;db.close();reject(err);};
    });
  }

  async function dbmRuleDelete(id){
    return withTx([DBM_RULES_STORE],'readwrite',function(tx){
      tx.objectStore(DBM_RULES_STORE).delete(Number(id));
    });
  }

  async function getContentRecordsByIds(ids){
    ids=(ids||[]).map(Number);
    if(!ids.length)return [];

    var db=await openDb();
    return new Promise(function(resolve,reject){
      var tx=db.transaction(TRACK_CONTENT_STORE,'readonly');
      var os=tx.objectStore(TRACK_CONTENT_STORE);
      var out=[];
      var failed=false;

      ids.forEach(function(id){
        var req=os.get(id);
        req.onsuccess=function(){
          out.push(req.result||{
            id:id,
            structured_prompt:'',
            negative_prompt:'',
            instrumental_arrangement:''
          });
        };
        req.onerror=function(){
          failed=true;
          reject(req.error);
        };
      });

      tx.oncomplete=function(){
        db.close();
        if(!failed)resolve(out);
      };
      tx.onabort=function(){
        var err=tx.error;
        db.close();
        if(!failed)reject(err);
      };
    });
  }

  async function updateContentFieldBatch(changes,field,valueKey){
    valueKey=valueKey||'after';
    if(!changes||!changes.length)return;

    var db=await openDb();
    return new Promise(function(resolve,reject){
      var tx=db.transaction(TRACK_CONTENT_STORE,'readwrite');
      var os=tx.objectStore(TRACK_CONTENT_STORE);
      var failed=false;

      changes.forEach(function(change){
        var id=Number(change.id);
        var req=os.get(id);
        req.onsuccess=function(){
          var rec=req.result||{
            id:id,
            structured_prompt:'',
            negative_prompt:'',
            instrumental_arrangement:''
          };
          rec[field]=normalizeMultiline(change[valueKey]==null?'':change[valueKey]);
          os.put(rec);
          cacheContent(rec);
        };
        req.onerror=function(){
          failed=true;
          reject(req.error);
        };
      });

      tx.oncomplete=function(){
        db.close();
        if(!failed)resolve();
      };
      tx.onabort=function(){
        var err=tx.error;
        db.close();
        if(!failed)reject(err);
      };
    });
  }

  function yieldUi(){return new Promise(function(resolve){setTimeout(resolve,0);});}

  function normalizeTrack(raw){
    var src=raw&&raw.source&&typeof raw.source==='object'?raw.source:raw;
    if(!src||typeof src!=='object')throw new Error('Track entry is not an object.');

    // reference_song was added after the original database schema.
    // Old exports / old records remain valid and receive a blank value.
    var missing=REQUIRED_FIELDS.filter(function(k){
      return k!=='reference_song' && !(k in src);
    });
    if(missing.length)throw new Error('Missing required fields: '+missing.join(', '));

    var out={};
    REQUIRED_FIELDS.forEach(function(k){
      var value=(k in src)?src[k]:(k==='reference_song'?'':'');
      out[k]=MULTILINE_FIELDS.includes(k)?normalizeMultiline(value):value;
    });

    out.title=String(out.title==null?'':out.title);
    out.genre=String(out.genre==null?'':out.genre).trim();
    out.emotion=String(out.emotion==null?'':out.emotion);
    out.style=String(out.style==null?'':out.style);
    out.key=String(out.key==null?'':out.key);
    out.reference_artist=String(out.reference_artist==null?'':out.reference_artist);
    out.reference_song=String(out.reference_song==null?'':out.reference_song);
    INDEX_FIELDS.forEach(function(k){
      if(REQUIRED_FIELDS.includes(k))return;
      var value=(raw&&Object.prototype.hasOwnProperty.call(raw,k))?raw[k]:src[k];
      out[k]=value==null?'':value;
    });

    out.bpm=Number(out.bpm);
    out.year=Number(out.year);
    if(!Number.isFinite(out.bpm))throw new Error('Invalid BPM.');
    if(!Number.isFinite(out.year))throw new Error('Invalid year.');

    var usedValue=raw&&Object.prototype.hasOwnProperty.call(raw,'used')
      ? raw.used
      : src.used;
    var favoriteValue=raw&&Object.prototype.hasOwnProperty.call(raw,'favorite')
      ? raw.favorite
      : src.favorite;

    out.used=!!usedValue;
    out.favorite=!!favoriteValue;
    return out;
  }

  function hydrateStoredTrack(raw){
    var src=raw&&raw.source&&typeof raw.source==='object'?raw.source:raw;
    if(!src||typeof src!=='object')return null;

    // Reading the existing IndexedDB must be tolerant. The UI should never
    // blank out a valid legacy database simply because the storage wrapper
    // differs from the latest import/export shape.
    var out={};
    REQUIRED_FIELDS.forEach(function(k){
      var value=(k in src)?src[k]:(k==='reference_song'?'':'');
      out[k]=MULTILINE_FIELDS.includes(k)?normalizeMultiline(value):value;
    });

    out.id=Number(
      raw&&raw.id!=null
        ? raw.id
        : (src.id!=null?src.id:0)
    );

    out.title=String(out.title==null?'':out.title);
    out.genre=String(out.genre==null?'':out.genre).trim();
    out.emotion=String(out.emotion==null?'':out.emotion);
    out.style=String(out.style==null?'':out.style);
    out.key=String(out.key==null?'':out.key);
    out.reference_artist=String(out.reference_artist==null?'':out.reference_artist);
    out.reference_song=String(out.reference_song==null?'':out.reference_song);
    INDEX_FIELDS.forEach(function(k){
      if(REQUIRED_FIELDS.includes(k))return;
      var value=(raw&&Object.prototype.hasOwnProperty.call(raw,k))?raw[k]:src[k];
      out[k]=value==null?'':value;
    });

    var bpm=Number(out.bpm);
    var year=Number(out.year);
    out.bpm=Number.isFinite(bpm)?bpm:(out.bpm==null?'':out.bpm);
    out.year=Number.isFinite(year)?year:(out.year==null?'':out.year);

    var usedValue=raw&&Object.prototype.hasOwnProperty.call(raw,'used')
      ? raw.used
      : src.used;
    var favoriteValue=raw&&Object.prototype.hasOwnProperty.call(raw,'favorite')
      ? raw.favorite
      : src.favorite;

    out.used=!!usedValue;
    out.favorite=!!favoriteValue;

    // Keep storage-shape knowledge outside JSON serialization. Existing rows
    // are not rewritten just by opening V3.9.
    try{
      Object.defineProperty(out,'__legacyWrapped',{
        value:!!(raw&&raw.source&&typeof raw.source==='object'),
        enumerable:false,
        configurable:true
      });
    }catch(_){}

    return out;
  }

  function toIndexRecord(full){
    var out={id:Number(full.id)};
    INDEX_FIELDS.forEach(function(k){out[k]=full[k]==null?'':full[k];});
    out.exclude_styles=normalizeMultiline(full.negative_prompt!=null?full.negative_prompt:(full.exclude_styles||''));
    out.bpm=Number(full.bpm);
    out.year=Number(full.year);
    out.used=!!full.used;
    out.favorite=!!full.favorite;
    out.genre_key=normKey(full.genre);
    out.used_flag=out.used?1:0;
    out.favorite_flag=out.favorite?1:0;
    return out;
  }

  function toContentRecord(full){
    return {
      id:Number(full.id),
      structured_prompt:normalizeMultiline(full.structured_prompt),
      negative_prompt:normalizeMultiline(full.negative_prompt),
      instrumental_arrangement:normalizeMultiline(full.instrumental_arrangement)
    };
  }

  function mergeTrack(indexRec,contentRec){
    if(!indexRec)return null;
    var out={id:Number(indexRec.id)};
    INDEX_FIELDS.forEach(function(k){out[k]=indexRec[k]==null?'':indexRec[k];});
    CONTENT_FIELDS.forEach(function(k){out[k]=contentRec&&contentRec[k]!=null?contentRec[k]:'';});
    out.used=!!indexRec.used;
    out.favorite=!!indexRec.favorite;
    return out;
  }

  function cacheContent(rec){
    if(!rec||!Number.isFinite(Number(rec.id)))return;
    var id=Number(rec.id);
    if(state.contentCache.has(id))state.contentCache.delete(id);
    state.contentCache.set(id,rec);
    while(state.contentCache.size>CONTENT_CACHE_LIMIT){
      var first=state.contentCache.keys().next().value;
      state.contentCache.delete(first);
    }
  }

  function rebuildRecordMap(){
    state.recordById=new Map(state.records.map(function(r){return [Number(r.id),r];}));
  }

  function replaceIndexRecord(rec){
    var normalized=toIndexRecord(rec);
    var old=state.recordById.get(normalized.id);
    if(old){
      var idx=state.records.indexOf(old);
      if(idx>=0)state.records[idx]=normalized;
    }else{
      state.records.push(normalized);
    }
    state.recordById.set(normalized.id,normalized);
    if(state.selectedFull&&state.selectedFull.id===normalized.id){
      INDEX_FIELDS.forEach(function(k){state.selectedFull[k]=normalized[k];});
      state.selectedFull.used=normalized.used;
      state.selectedFull.favorite=normalized.favorite;
    }
  }

  async function getFullTrack(id){
    var indexRec=state.recordById.get(Number(id));
    if(!indexRec)return null;
    var contentRec=await getContentRecord(Number(id));
    return mergeTrack(indexRec,contentRec);
  }

  async function selectTrack(id,options){
    options=options||{};
    id=Number(id);
    state.selectedId=id;
    state.selectedFull=null;
    state.editUnlocked=false;
    state.deleteConfirmStage=0;
    state.autofillError=null;
    renderTable();
    renderInspector();

    if(options.followAuto){
      followTrackNearTop(id,{smooth:options.smooth!==false});
    }

    var full=await getFullTrack(id);
    if(state.selectedId===id){
      state.selectedFull=full;
      renderInspector();
    }
    return full;
  }

  function followTrackNearTop(id,options){
    options=options||{};
    var scroller=$('.tableScroll');
    if(!scroller)return false;

    var rows=visibleRecords();
    var index=rows.findIndex(function(r){return Number(r.id)===Number(id);});
    if(index<0)return false;

    var viewportRows=Math.max(1,Math.floor((scroller.clientHeight||VIRTUAL_ROW_HEIGHT)/VIRTUAL_ROW_HEIGHT));
    var preferredSlot=Math.min(2,Math.max(0,viewportRows-1));
    var firstVisible=Math.max(0,Math.floor(scroller.scrollTop/VIRTUAL_ROW_HEIGHT));
    var currentSlot=index-firstVisible;

    // Keep the active automated track in the first three visible rows. Do
    // nothing while it is already there so the list stays calm instead of
    // constantly re-centering.
    if(currentSlot>=0&&currentSlot<=preferredSlot)return false;

    var targetTop=Math.max(0,(index-preferredSlot)*VIRTUAL_ROW_HEIGHT);
    var estimatedContentHeight=rows.length*VIRTUAL_ROW_HEIGHT;
    var maxTop=Math.max(0,estimatedContentHeight-scroller.clientHeight);
    targetTop=Math.min(maxTop,targetTop);

    if(Math.abs(scroller.scrollTop-targetTop)<2)return false;

    if(options.smooth!==false&&typeof scroller.scrollTo==='function'){
      scroller.scrollTo({top:targetTop,behavior:'smooth'});
    }else{
      scroller.scrollTop=targetTop;
    }

    scheduleVirtualRender();
    return true;
  }

  function invalidateView(resetScroll){
    state.viewCache=null;
    state.lastClickedVisibleIndex=null;
    if(resetScroll){
      var scroller=$('.tableScroll');
      if(scroller)scroller.scrollTop=0;
    }
  }

  function invalidateGenreStats(){state.genreStatsCache=null;if(!isPrivateDataset())state.publicGenreVocabulary=null;}

  function exportTrack(record){
    var out={id:record.id};
    REQUIRED_FIELDS.forEach(function(k){out[k]=record[k];});
    INDEX_FIELDS.forEach(function(k){
      if(REQUIRED_FIELDS.includes(k))return;
      var value=record[k];
      if(value!=null&&value!=='')out[k]=value;
    });
    out.used=!!record.used;
    out.favorite=!!record.favorite;
    return out;
  }
  function unwrapTrackArray(json){
    if(Array.isArray(json))return json;
    if(Array.isArray(json.tracks))return json.tracks;
    if(Array.isArray(json.entries))return json.entries;
    if(json.data&&Array.isArray(json.data.tracks))return json.data.tracks;
    if(json.database&&Array.isArray(json.database.tracks))return json.database.tracks;
    throw new Error('No track array found. Supported: array, tracks, entries, data.tracks, database.tracks.');
  }

  function mappingMajors(mapping){
    if(!mapping)return [];

    var raw=[];
    if(Array.isArray(mapping.major_genres))raw=raw.concat(mapping.major_genres);
    if(mapping.major_genre)raw.push(mapping.major_genre);

    var out=[];
    raw.forEach(function(value){
      var major=canonicalMajor(value);
      if(major&&!out.includes(major))out.push(major);
    });
    return out;
  }

  function resolveMajors(genre){
    var out=[];
    var direct=canonicalMajor(genre);

    // A track whose genre is itself one of the fixed 24 roots belongs to
    // that root, but may also have additional imported relationships.
    if(direct)out.push(direct);

    var mapping=state.genreMap.get(normKey(genre))||state.genreIdentityMap.get(genreIdentity(genre))||null;
    mappingMajors(mapping).forEach(function(major){
      if(!out.includes(major))out.push(major);
    });

    return out;
  }

  function resolveMajor(genre){
    return resolveMajors(genre)[0]||null;
  }

  function genreBelongsToAnyMajor(genre,majors){
    var wanted=new Set((majors||[]).map(canonicalMajor).filter(Boolean));
    if(!wanted.size)return true;
    return resolveMajors(genre).some(function(major){return wanted.has(major);});
  }

  function genreStats(){
    if(state.genreStatsCache)return state.genreStatsCache;

    var collected=new Map();
    var majorCounts=new Map(MAJOR_GENRES.map(function(m){return [m,0];}));
    var unmapped=0;

    state.records.forEach(function(r){
      var key=genreIdentity(r.genre)||normKey(r.genre);
      if(!key)return;

      var mapped=state.genreIdentityMap.get(key);
      var displayGenre=mapped&&mapped.genre?mapped.genre:r.genre;
      var x=collected.get(key)||{genre:displayGenre,count:0};
      x.count++;
      collected.set(key,x);

      var majors=resolveMajors(r.genre);
      if(majors.length){
        majors.forEach(function(major){
          majorCounts.set(major,(majorCounts.get(major)||0)+1);
        });
      }else{
        unmapped++;
      }
    });

    state.genreStatsCache={
      collected:Array.from(collected.values()).sort(function(a,b){
        return a.genre.localeCompare(b.genre);
      }),
      majorCounts:majorCounts,
      unmapped:unmapped
    };

    return state.genreStatsCache;
  }

  function relationshipSummary(){
    var mappedTracks=0;
    var unmappedTracks=0;
    var mappedGenres=new Set();
    var unmappedGenres=new Set();

    state.records.forEach(function(r){
      var key=genreIdentity(r.genre)||normKey(r.genre);
      if(!key)return;

      if(resolveMajors(r.genre).length){
        mappedTracks++;
        mappedGenres.add(key);
      }else{
        unmappedTracks++;
        unmappedGenres.add(key);
      }
    });

    return {
      mappedTracks:mappedTracks,
      unmappedTracks:unmappedTracks,
      mappedGenres:mappedGenres.size,
      unmappedGenres:unmappedGenres.size
    };
  }

  function visibleRecords(){
    if(state.viewCache)return state.viewCache;

    var q=state.query.trim().toLowerCase();
    var arr=state.records.filter(function(r){
      if(state.randomViewIds&&!state.randomViewIds.has(r.id))return false;

      if(state.status==='used'&&!r.used)return false;
      if(state.status==='unused'&&r.used)return false;
      if(state.status==='favorite'&&!r.favorite)return false;

      var gf=state.genreFilter;
      if(gf.type==='major'&&!genreBelongsToAnyMajor(r.genre,[gf.value]))return false;
      if(gf.type==='majors'&&!genreBelongsToAnyMajor(r.genre,gf.values||[]))return false;
      if(gf.type==='genre'&&genreIdentity(r.genre)!==genreIdentity(gf.value))return false;
      if(gf.type==='genres'&&!(gf.values||[]).some(function(g){return genreIdentity(r.genre)===genreIdentity(g);}))return false;
      if(gf.type==='unmapped'&&resolveMajors(r.genre).length)return false;

      if(q){
        var fields=state.searchField==='all'
          ? ['title','genre','bpm','emotion','year','reference_artist','reference_song']
          : [state.searchField];
        var hit=fields.some(function(k){return String(r[k]==null?'':r[k]).toLowerCase().includes(q);});
        if(!hit)return false;
      }
      return true;
    });

    var parts=state.sort.split('-');
    var key=parts.slice(0,-1).join('-')||'id';
    var dir=parts[parts.length-1]==='desc'?-1:1;
    arr.sort(function(a,b){
      var av=a[key],bv=b[key];
      if(typeof av==='number'||typeof bv==='number')return ((Number(av)||0)-(Number(bv)||0))*dir;
      return String(av||'').localeCompare(String(bv||''))*dir;
    });

    state.viewCache=arr;
    return arr;
  }

  function positionGenrePicker(){
    var picker=$('#genrePicker');
    var trigger=$('#genrePickerBtn');
    if(!picker||!trigger||picker.classList.contains('hidden'))return;

    var doc=deckRoot&&deckRoot.ownerDocument?deckRoot.ownerDocument:document;
    var view=doc.defaultView||window;
    var rect=trigger.getBoundingClientRect();

    var margin=12;
    var desiredWidth=Math.min(
      920,
      Math.max(620,view.innerWidth-(margin*2))
    );

    // Prefer opening LEFT from the trigger's right edge.
    var left=rect.right-desiredWidth;
    left=Math.max(margin,Math.min(left,view.innerWidth-desiredWidth-margin));

    var top=rect.bottom+6;
    var availableBelow=view.innerHeight-top-margin;
    var desiredHeight=Math.min(780,Math.max(560,availableBelow));

    // Toolbar is near the top, but keep a safe fallback if the deck is ever
    // embedded differently.
    if(availableBelow<430){
      desiredHeight=Math.min(780,Math.max(500,rect.top-margin));
      top=Math.max(margin,rect.top-desiredHeight-6);
    }

    picker.style.left=Math.round(left)+'px';
    picker.style.right='auto';
    picker.style.top=Math.round(top)+'px';
    picker.style.width=Math.round(desiredWidth)+'px';
    picker.style.height=Math.round(desiredHeight)+'px';
  }

  function serializeGenreFilter(filter){
    filter=filter||{type:'all',value:null,values:[]};
    var type=String(filter.type||'all');

    if(type==='major'){
      var major=canonicalMajor(filter.value);
      return major?{type:'major',value:major,values:[major]}:{type:'all',value:null,values:[]};
    }

    if(type==='majors'){
      var values=(filter.values||[]).map(canonicalMajor).filter(Boolean);
      values=Array.from(new Set(values));
      return values.length?{type:'majors',value:null,values:values}:{type:'all',value:null,values:[]};
    }

    if(type==='genre'){
      var genre=String(filter.value==null?'':filter.value).trim();
      return genre?{type:'genre',value:genre,values:[]}:{type:'all',value:null,values:[]};
    }

    if(type==='genres'){
      var genres=(filter.values||[]).map(function(v){return String(v==null?'':v).trim();}).filter(Boolean);
      genres=Array.from(new Set(genres.map(function(g){return genreIdentity(g)||normKey(g);}))).map(function(k){return genres.find(function(g){return (genreIdentity(g)||normKey(g))===k;});});
      return genres.length?{type:'genres',value:null,values:genres}:{type:'all',value:null,values:[]};
    }

    if(type==='unmapped')return {type:'unmapped',value:null,values:[]};
    return {type:'all',value:null,values:[]};
  }

  function persistLastListState(){
    try{
      var payload={
        schema:1,
        saved_at:nowIso(),
        mode:state.randomViewIds?'random':'genre',
        genreFilter:serializeGenreFilter(state.genreFilter),
        majorSelection:Array.from(state.majorSelection).map(canonicalMajor).filter(Boolean),
        subgenreSelection:Array.from(state.subgenreSelection),
        randomViewIds:state.randomViewIds?Array.from(state.randomViewIds):null,
        randomViewMeta:state.randomViewMeta||null
      };
      localStorage.setItem(LAST_LIST_KEY,JSON.stringify(payload));
    }catch(_){ }
  }

  function restoreRandomInputsFromMeta(meta){
    if(!meta)return;
    var from=$('#genreRandomFromYear');
    var to=$('#genreRandomToYear');
    var per=$('#genreRandomPerYear');

    if(from&&meta.from!=null)from.value=String(meta.from);
    if(to&&meta.to!=null)to.value=String(meta.to);
    if(per&&meta.perYear!=null)per.value=String(Math.max(1,Math.min(99,Number(meta.perYear)||1)));
  }

  function restoreLastListState(){
    var raw=null;
    try{raw=localStorage.getItem(LAST_LIST_KEY);}catch(_){return false;}
    if(!raw)return false;

    var saved;
    try{saved=JSON.parse(raw);}catch(_){return false;}
    if(!saved||typeof saved!=='object')return false;

    var majors=Array.isArray(saved.majorSelection)
      ? saved.majorSelection.map(canonicalMajor).filter(Boolean)
      : [];
    state.majorSelection=new Set(majors);
    state.subgenreSelection=new Set(Array.isArray(saved.subgenreSelection)?saved.subgenreSelection.map(function(v){return String(v||'').trim();}).filter(Boolean):[]);

    if(saved.mode==='random'&&Array.isArray(saved.randomViewIds)){
      var ids=saved.randomViewIds
        .map(function(id){return Number(id);})
        .filter(function(id){return Number.isFinite(id)&&state.recordById.has(id);});

      state.randomViewIds=new Set(ids);
      state.randomViewMeta=saved.randomViewMeta&&typeof saved.randomViewMeta==='object'
        ? saved.randomViewMeta
        : {count:ids.length};
      state.randomViewMeta.count=ids.length;
      state.genreFilter={type:'all',value:null,values:[]};
      restoreRandomInputsFromMeta(state.randomViewMeta);
    }else{
      state.randomViewIds=null;
      state.randomViewMeta=null;
      state.genreFilter=serializeGenreFilter(saved.genreFilter);
    }

    // Search/status are intentionally transient. Reopening the deck restores
    // the created list itself without an old text/status filter hiding rows.
    state.query='';
    state.status='all';
    var search=$('#searchInput');
    if(search)search.value='';
    var status=$('#statusFilter');
    if(status)status.value='all';

    invalidateView(true);
    renderAll();

    // Re-save after intersecting Random IDs with the current database so stale
    // deleted IDs disappear from storage automatically.
    persistLastListState();
    return true;
  }

  function renderAll(){renderGenrePicker();renderTable();renderInspector();renderStats();applySidebar();syncSearchClear();positionGenrePicker();renderVaultNavigation();}
  function renderStats(){
    var vis=visibleRecords();
    var used=state.records.filter(function(r){return r.used;}).length;
    var favorites=state.records.filter(function(r){return r.favorite;}).length;

    $('#dbStats').textContent=
      activeVaultLabel()+' · '+state.records.length+' tracks · '+
      vis.length+' visible · '+
      used+' used · '+
      favorites+' favorites';

    $('#selectionInfo').textContent=state.selectedIds.size+' selected';

    [
      'markSelectedUsedBtn',
      'markSelectedUnusedBtn',
      'markSelectedFavoriteBtn',
      'markSelectedUnfavoriteBtn',
      'deleteSelectedBtn',
      'clearSelectionBtn'
    ].forEach(function(id){
      var el=$('#'+id);
      if(el)el.disabled=state.selectedIds.size===0;
    });

    var randomBtn=$('#clearRandomViewBtn');
    if(randomBtn){
      if(state.randomViewIds){
        randomBtn.classList.remove('hidden');
        randomBtn.textContent='RANDOM VIEW · '+state.randomViewIds.size+' ×';
      }else{
        randomBtn.classList.add('hidden');
        randomBtn.textContent='RANDOM VIEW ×';
      }
    }
  }
  function applySidebar(){var m=$('#mainLayout');m.classList.toggle('sidebar-left',state.sidebarSide==='left');m.classList.toggle('sidebar-right',state.sidebarSide!=='left');}
  function syncSearchClear(){var b=$('#clearSearchBtn');b.style.visibility=state.query?'visible':'hidden';}

  function clearRandomView(options){
    options=options||{};
    var hadRandom=!!state.randomViewIds;

    state.randomViewIds=null;
    state.randomViewMeta=null;
    invalidateView(true);
    persistLastListState();

    if(options.clearSelection){
      state.selectedIds.clear();
      state.lastClickedVisibleIndex=null;
    }

    if(options.render!==false)renderAll();

    if(hadRandom&&!options.silent){
      toast('Random View cleared','Showing the normal track list again.');
    }
  }

  function setRandomView(records,meta){
    state.randomViewIds=new Set(records.map(function(r){return r.id;}));
    state.randomViewMeta=Object.assign({
      created_at:nowIso(),
      count:records.length
    },meta||{});

    // Random is a VIEW, not an automatic mass-selection.
    state.selectedIds.clear();
    state.lastClickedVisibleIndex=null;

    // The new draw must initially be shown in full.
    state.query='';
    state.status='all';
    state.genreFilter={type:'all',value:null,values:[]};

    var search=$('#searchInput');
    if(search)search.value='';

    var status=$('#statusFilter');
    if(status)status.value='all';

    invalidateView(true);
    persistLastListState();
  }

  function randomScopeMajors(){
    return Array.from(state.majorSelection);
  }

  function randomScopedRecords(){
    var majors=randomScopeMajors();

    return state.records.filter(function(r){
      if(majors.length&&!genreBelongsToAnyMajor(r.genre,majors))return false;

      var year=Number(r.year);
      return Number.isFinite(year)&&Number.isInteger(year)&&year>=0&&year<=9999;
    });
  }

  function shuffleRandomTracks(rows){
    var arr=rows.slice();

    for(var i=arr.length-1;i>0;i--){
      var j=Math.floor(Math.random()*(i+1));
      var tmp=arr[i];
      arr[i]=arr[j];
      arr[j]=tmp;
    }

    return arr;
  }

  function readRandomYearValue(id){
    var el=$('#'+id);
    if(!el)return null;

    var raw=String(el.value||'').trim();
    if(!raw)return null;

    var n=Number(raw);
    if(!Number.isFinite(n))return NaN;

    n=Math.trunc(n);
    if(n<0||n>9999)return NaN;

    return n;
  }

  function randomSelectorRange(){
    var pool=randomScopedRecords();
    var years=pool.map(function(r){return Number(r.year);});
    var minYear=years.length?Math.min.apply(Math,years):null;
    var maxYear=years.length?Math.max.apply(Math,years):null;

    var from=readRandomYearValue('genreRandomFromYear');
    var to=readRandomYearValue('genreRandomToYear');

    if(Number.isNaN(from)||Number.isNaN(to)){
      throw new Error('Years must be whole numbers from 0 to 9999.');
    }

    if(from==null&&to==null){
      if(minYear==null||maxYear==null){
        throw new Error('No tracks with a usable year are available in this Major Genre scope.');
      }
      from=minYear;
      to=maxYear;
    }else if(from==null){
      from=to;
    }else if(to==null){
      to=from;
    }

    if(from>to){
      var swap=from;
      from=to;
      to=swap;
    }

    return {
      pool:pool,
      from:from,
      to:to,
      minYear:minYear,
      maxYear:maxYear
    };
  }

  function updateGenreRandomSummary(){
    var scope=$('#genreRandomScope');
    var availability=$('#genreRandomAvailability');
    if(!scope||!availability)return;

    var majors=randomScopeMajors();
    var pool=randomScopedRecords();

    scope.textContent=majors.length
      ? majors.length+' MAJOR'+(majors.length===1?'':'S')+' · '+majors.join(' + ')
      : 'ALL MAJORS';

    var years=pool.map(function(r){return Number(r.year);});
    if(!years.length){
      availability.textContent='0 year-tagged tracks';
      return;
    }

    var minYear=Math.min.apply(Math,years);
    var maxYear=Math.max.apply(Math,years);

    availability.textContent=
      minYear+
      (maxYear!==minYear?'–'+maxYear:'')+
      ' · '+pool.length+' tracks';
  }

  function clampRandomPerYear(){
    var input=$('#genreRandomPerYear');
    if(!input)return 1;

    var n=Math.trunc(Number(input.value));
    if(!Number.isFinite(n))n=1;
    n=Math.max(1,Math.min(99,n));
    input.value=String(n);
    return n;
  }

  function runGenreRandomView(){
    var perYear=clampRandomPerYear();
    var range;

    try{
      range=randomSelectorRange();
    }catch(error){
      toast('Random View',error.message||String(error));
      return;
    }

    var byYear=new Map();

    range.pool.forEach(function(r){
      var year=Number(r.year);
      if(year<range.from||year>range.to)return;

      if(!byYear.has(year))byYear.set(year,[]);
      byYear.get(year).push(r);
    });

    var picked=[];
    var yearsRequested=range.to-range.from+1;
    var shortYears=0;
    var emptyYears=0;
    var yearsWithTracks=0;

    for(var year=range.from;year<=range.to;year++){
      var available=byYear.get(year)||[];

      if(!available.length){
        emptyYears++;
        shortYears++;
        continue;
      }

      yearsWithTracks++;
      if(available.length<perYear)shortYears++;

      shuffleRandomTracks(available)
        .slice(0,perYear)
        .forEach(function(r){picked.push(r);});
    }

    var majors=randomScopeMajors();

    setRandomView(picked,{
      from:range.from,
      to:range.to,
      perYear:perYear,
      majors:majors.slice(),
      yearsRequested:yearsRequested,
      yearsWithTracks:yearsWithTracks,
      shortYears:shortYears,
      emptyYears:emptyYears
    });

    renderAll();
    $('#genrePicker').classList.add('hidden');

    var result=$('#genreRandomResult');
    if(result){
      result.textContent=
        picked.length+' IN RANDOM VIEW · '+
        yearsRequested+' YEAR'+(yearsRequested===1?'':'S')+
        ' · '+shortYears+' SHORT'+
        (emptyYears?' · '+emptyYears+' EMPTY':'');
    }

    toast(
      'Random View',
      picked.length+' tracks · '+
      range.from+
      (range.to!==range.from?'–'+range.to:'')+
      ' · up to '+perYear+'/year.'
    );
  }

  function activeMajorFilterValues(){
    if(state.genreFilter.type==='major'&&state.genreFilter.value)return [state.genreFilter.value];
    if(state.genreFilter.type==='majors')return (state.genreFilter.values||[]).slice();
    return [];
  }

  function renderGenrePicker(){
    var stats=genreStats();
    var grid=$('#majorGenreGrid');
    grid.innerHTML='';

    var activeFilterMajors=new Set(activeMajorFilterValues());
    var selectedBrowseMajors=state.majorSelection;

    MAJOR_GENRES.forEach(function(m){
      var b=document.createElement('button');
      b.type='button';

      var selected=selectedBrowseMajors.has(m);
      var opened=activeFilterMajors.has(m);

      b.className=
        'majorGenreBtn'+
        (selected?' active':'')+
        (opened?' opened':'');

      b.dataset.major=m;
      b.title=
        m+' · '+(stats.majorCounts.get(m)||0)+' track memberships\n'+
        (selected
          ? 'Click again: open this major · Shift/Ctrl-click: remove selection'
          : 'Click: select this major for browsing');

      b.innerHTML=
        '<span class="majorName">'+esc(m)+'</span>'+
        '<span class="majorCount">'+(stats.majorCounts.get(m)||0)+'</span>';

      grid.appendChild(b);
    });

    var openSelectedBtn=$('#genreOpenSelectedBtn');
    if(openSelectedBtn){
      var totalSelected=selectedBrowseMajors.size+state.subgenreSelection.size;
      openSelectedBtn.disabled=totalSelected===0;
      openSelectedBtn.textContent=totalSelected?'SHOW ('+totalSelected+')':'SHOW';
    }
    var randomPanel=$('#genreRandomPanel');
    var randomToggle=$('#genreRandomToggleBtn');
    if(randomPanel)randomPanel.classList.toggle('hidden',!state.genreRandomExpanded);
    if(randomToggle){randomToggle.classList.toggle('active',state.genreRandomExpanded);randomToggle.setAttribute('aria-expanded',state.genreRandomExpanded?'true':'false');}

    $('#unmappedBadge').textContent=stats.unmapped?('UNMAPPED '+stats.unmapped):'';

    var list=$('#collectedGenreList');
    list.innerHTML='';

    var search=state.genreSearch.trim().toLowerCase();
    var browseMajors=Array.from(selectedBrowseMajors);

    var rows=stats.collected.filter(function(g){
      if(browseMajors.length&&!genreBelongsToAnyMajor(g.genre,browseMajors))return false;

      if(!search)return true;

      var majors=resolveMajors(g.genre);
      return (
        g.genre.toLowerCase().includes(search) ||
        majors.join(' ').toLowerCase().includes(search) ||
        (!majors.length&&'unmapped'.includes(search))
      );
    });

    if(
      !browseMajors.length &&
      stats.unmapped>0 &&
      (!search||'unmapped'.includes(search))
    ){
      var u=document.createElement('div');
      u.className=
        'genreRow unmapped'+
        (state.genreFilter.type==='unmapped'?' active':'');
      u.dataset.unmapped='1';
      u.innerHTML=
        '<span class="genreRowName">Unmapped</span>'+
        '<span class="genreRowMap">needs relationship</span>'+
        '<span class="genreRowCount">'+stats.unmapped+'</span>';
      list.appendChild(u);
    }

    rows.forEach(function(g){
      var majors=resolveMajors(g.genre);
      var row=document.createElement('div');

      row.className=
        'genreRow'+
        (!majors.length?' unmapped':'')+
        (
          state.subgenreSelection.has(g.genre) ||
          (state.genreFilter.type==='genre' && normKey(state.genreFilter.value)===normKey(g.genre)) ||
          (state.genreFilter.type==='genres' && (state.genreFilter.values||[]).some(function(v){return normKey(v)===normKey(g.genre);}))
            ?' active'
            :''
        );

      row.dataset.genre=g.genre;
      row.innerHTML=
        '<span class="genreRowName">'+esc(g.genre)+'</span>'+
        '<span class="genreRowMap">'+
          (majors.length?'→ '+esc(majors.join(' + ')):'UNMAPPED')+
        '</span>'+
        '<span class="genreRowCount">'+g.count+'</span>';

      list.appendChild(row);
    });

    var trigger=$('#genrePickerBtn');
    var label='All Genres';

    if(state.randomViewIds){
      label='Random View';
    }else{
      if(state.genreFilter.type==='major')label=state.genreFilter.value;
      if(state.genreFilter.type==='majors'){
        var n=(state.genreFilter.values||[]).length;
        label=n===1?state.genreFilter.values[0]:(n+' Major Genres');
      }
      if(state.genreFilter.type==='genre')label=state.genreFilter.value;
      if(state.genreFilter.type==='genres'){var gn=(state.genreFilter.values||[]).length;label=gn===1?state.genreFilter.values[0]:(gn+' Subgenres');}
      if(state.genreFilter.type==='unmapped')label='Unmapped';
    }

    trigger.childNodes[0].nodeValue=label+' ';
    $('#genreTriggerCount').textContent=visibleRecords().length;
    updateGenreRandomSummary();
  }

  function renderTrackRow(r,index){
    var tr=document.createElement('tr');
    tr.dataset.id=r.id;
    tr.dataset.index=index;
    tr.className='trackRow '+
      (r.used?'used ':'')+
      (r.favorite?'favorite ':'')+
      (state.selectedId===r.id?'selected ':'')+
      (state.selectedIds.has(r.id)?'massSelected ':'');

    var artistCell=esc(r.reference_artist);
    var songCell=esc(r.reference_song);
    if(isPrivateDataset()){
      var artistLabel=r.artist_name||(r.artist_handle?'@'+r.artist_handle:'—');
      artistCell=r.artist_profile_url
        ? '<a class="trackLink" href="'+esc(r.artist_profile_url)+'" target="_blank" rel="noopener" title="Open Suno artist profile">'+esc(artistLabel)+'</a>'
        : esc(artistLabel);
      var songLabel=r.suno_song_id?String(r.suno_song_id).slice(0,8)+'…':(r.record_type==='draft'?'DRAFT':'—');
      songCell=r.suno_song_url
        ? '<a class="trackLink songLink" href="'+esc(r.suno_song_url)+'" target="_blank" rel="noopener" title="Open Suno song">'+esc(songLabel)+'</a>'
        : esc(songLabel);
    }

    var sunoSettingsCell='—';
    if(isPrivateDataset()){
      var voiceLabel=String(r.voice_name||'').trim()||'—';
      var voiceHtml=r.voice_url&&r.voice_name
        ? '<a class="trackLink sunoVoiceLink" href="'+esc(r.voice_url)+'" target="_blank" rel="noopener" title="Open Suno voice">'+esc(voiceLabel)+'</a>'
        : esc(voiceLabel);
      var excludeText=String(r.exclude_styles||'').trim();
      var chips=[
        '<span class="sunoDataChip voice"><b>VOICE</b> '+voiceHtml+'</span>',
        '<span class="sunoDataChip"><b>GENDER</b> '+esc(r.vocal_gender||'—')+'</span>',
        '<span class="sunoDataChip"><b>DUR</b> '+esc(r.generation_duration||'—')+'</span>',
        '<span class="sunoDataChip"><b>MAX</b> '+esc(r.max_mode||'—')+'</span>',
        '<span class="sunoDataChip"><b>W</b> '+esc(r.weirdness===''?'—':r.weirdness)+'</span>',
        '<span class="sunoDataChip"><b>STYLE</b> '+esc(r.style_influence===''?'—':r.style_influence)+'</span>',
        '<span class="sunoDataChip"><b>AUDIO</b> '+esc(r.audio_influence===''?'—':r.audio_influence)+'</span>',
        '<span class="sunoDataChip"><b>VAR</b> '+esc(r.variety||'—')+'</span>',
        '<span class="sunoDataChip exclude" title="'+esc(excludeText||'No excluded styles')+'"><b>EXCL</b> '+esc(excludeText||'—')+'</span>'
      ];
      sunoSettingsCell='<div class="sunoSettingsInline">'+chips.join('')+'</div>';
    }

    tr.innerHTML=
      '<td class="checkCol"><input type="checkbox" class="rowCheck" '+(state.selectedIds.has(r.id)?'checked':'')+' title="Select track"></td>'+ 
      '<td>'+r.id+'</td>'+ 
      '<td class="trackTitle">'+esc(r.title)+'</td>'+ 
      '<td>'+esc(r.genre)+'</td>'+ 
      '<td class="subtle majorCell">'+esc(resolveMajors(r.genre).join(' + ')||'—')+'</td>'+ 
      '<td>'+esc(r.bpm)+'</td>'+ 
      '<td>'+esc(r.emotion)+'</td>'+ 
      '<td>'+esc(r.year)+'</td>'+ 
      '<td>'+artistCell+'</td>'+ 
      '<td>'+songCell+'</td>'+ 
      '<td class="sunoSettingsCell '+(isPrivateDataset()?'privateSuno':'')+'">'+sunoSettingsCell+'</td>'+
      '<td class="usedCell"><input type="checkbox" class="usedCheck" '+(r.used?'checked':'')+' title="Mark Used"></td>'+ 
      '<td class="favoriteCell"><button type="button" class="favoriteToggle '+(r.favorite?'on':'')+'" title="'+(r.favorite?'Unfavorite':'Favorite')+'">'+(r.favorite?'★':'☆')+'</button></td>';
    return tr;
  }

  function renderTable(){
    var tbody=$('#trackBody');
    var rows=visibleRecords();
    var scroller=$('.tableScroll');
    var viewport=scroller?scroller.clientHeight:600;
    var scrollTop=scroller?scroller.scrollTop:0;

    $('#emptyState').classList.toggle('hidden',rows.length!==0);
    tbody.innerHTML='';
    if(!rows.length)return;

    var start=Math.max(0,Math.floor(scrollTop/VIRTUAL_ROW_HEIGHT)-VIRTUAL_OVERSCAN);
    if(start>=rows.length){
      if(scroller)scroller.scrollTop=0;
      start=0;
      scrollTop=0;
    }
    var count=Math.ceil(viewport/VIRTUAL_ROW_HEIGHT)+(VIRTUAL_OVERSCAN*2);
    var end=Math.min(rows.length,start+count);
    var frag=document.createDocumentFragment();

    if(start>0){
      var topSpacer=document.createElement('tr');
      topSpacer.className='virtualSpacer';
      topSpacer.innerHTML='<td colspan="13" style="height:'+(start*VIRTUAL_ROW_HEIGHT)+'px"></td>';
      frag.appendChild(topSpacer);
    }

    for(var i=start;i<end;i++)frag.appendChild(renderTrackRow(rows[i],i));

    if(end<rows.length){
      var bottomSpacer=document.createElement('tr');
      bottomSpacer.className='virtualSpacer';
      bottomSpacer.innerHTML='<td colspan="13" style="height:'+((rows.length-end)*VIRTUAL_ROW_HEIGHT)+'px"></td>';
      frag.appendChild(bottomSpacer);
    }

    tbody.appendChild(frag);
  }

  function scheduleVirtualRender(){
    if(state.virtualRaf)return;
    var view=(deckRoot&&deckRoot.ownerDocument&&deckRoot.ownerDocument.defaultView)||window;
    state.virtualRaf=view.requestAnimationFrame(function(){state.virtualRaf=0;renderTable();});
  }

  function selectedRecord(){return state.recordById.get(Number(state.selectedId))||null;}
  function selectedFullRecord(){return state.selectedFull&&state.selectedFull.id===state.selectedId?state.selectedFull:null;}
  function fieldHtml(label,key,value,multiline,cls){
    var disabled=state.editUnlocked?'':' disabled';
    var autoFit=(key==='structured_prompt'||key==='instrumental_arrangement');
    var fitButton=autoFit?'<button type="button" class="autoFitBtn '+(autoFitEnabled(key)?'on':'')+'" data-autofit-key="'+key+'" aria-pressed="'+(autoFitEnabled(key)?'true':'false')+'">'+(autoFitEnabled(key)?'✓ AUTO FIT':'AUTO FIT')+'</button>':'';
    var labelRow='<div class="fieldLabelRow"><label>'+label+'</label>'+fitButton+'</div>';
    var textareaClass=((cls||'')+(autoFit&&autoFitEnabled(key)?' autoFitActive':'')).trim();
    var input=multiline?'<textarea data-field="'+key+'" data-autofit-field="'+(autoFit?key:'')+'" class="'+textareaClass+'"'+disabled+'>'+esc(value)+'</textarea>':'<input data-field="'+key+'" value="'+esc(value)+'"'+disabled+'>';
    return '<div class="fieldBlock">'+labelRow+input+'<button class="copyBtn" data-copy="'+key+'">Copy</button></div>';
  }

  function renderInspector(){
    var box=$('#inspector'),meta=selectedRecord(),layout=$('#mainLayout');
    if(layout)layout.classList.toggle('inspector-hidden',!meta);
    if(!meta){box.innerHTML='';return;}
    var r=selectedFullRecord();
    if(!r){box.innerHTML='<div class="inspectHeader"><h2>'+esc(meta.title)+'</h2><span class="idBadge">#'+meta.id+'</span></div><div class="inspectEmpty inspectLoading">Loading track details…</div>';return;}
    var error=state.autofillError?'<div class="errorBox">'+esc(state.autofillError)+'</div><div class="errorActions"><button id="copyErrorBtn">Copy Error</button></div>':'';
    var privateMeta='';
    var fields='';
    if(isPrivateDataset()){
      var artistLabel=r.artist_name||(r.artist_handle?'@'+r.artist_handle:'—');
      var artistHtml=r.artist_profile_url?'<a href="'+esc(r.artist_profile_url)+'" target="_blank" rel="noopener">'+esc(artistLabel)+'</a>':esc(artistLabel);
      var songLabel=r.suno_song_id||((r.record_type||'')==='draft'?'DRAFT':'—');
      var songHtml=r.suno_song_url?'<a href="'+esc(r.suno_song_url)+'" target="_blank" rel="noopener">'+esc(songLabel)+'</a>':esc(songLabel);
      var ownEntry=activeVaultEntry();var isOwnArtist=!!(ownEntry&&ownEntry.userId&&r.artist_user_id&&String(ownEntry.userId)===String(r.artist_user_id));
      privateMeta='<div class="privateMetaCard">'+
        '<div class="privateMetaItem"><label>ARTIST <span class="privateMetaLock">LOCKED</span></label><div>'+artistHtml+(r.artist_handle&&artistLabel.indexOf('@')!==0?' · @'+esc(r.artist_handle):'')+'</div></div>'+ 
        '<div class="privateMetaItem"><label>SUNO SONG ID <span class="privateMetaLock">LOCKED</span></label><div>'+songHtml+'</div></div>'+ 
      '</div><div class="privateMetaNote">Source attribution is authoritative Suno metadata and cannot be manually edited. '+(isOwnArtist?'Your current Suno name/handle can only be refreshed with UPDATE FROM SUNO.':'Other artists’ identity and source links are permanently read-only in the Deck.')+'</div>';
      var sourceText=String(r.genre_source||'none');
      var genreHint='<div class="genreSourceHint '+esc(sourceText)+'">GENRE '+(sourceText==='manual'?'MANUAL OVERRIDE':sourceText==='auto'?'AUTO-DETECTED'+(r.genre_matched_text?' FROM “'+esc(r.genre_matched_text)+'”':''):'UNCLASSIFIED')+'</div>';
      fields='<div class="provenanceGuardNote">Artist identity, profile link and Suno source identity are protected provenance fields. Edit classification/content below; attribution stays bound to Suno.</div>'+fieldHtml('Title','title',r.title,false)+fieldHtml('Genre','genre',r.genre,false)+genreHint+
        fieldHtml('BPM','bpm',r.bpm,false)+fieldHtml('Emotion','emotion',r.emotion,false)+fieldHtml('Style Tag','style',r.style,false)+
        fieldHtml('Year · display / classification','year',r.year,false)+fieldHtml('Creation Date · actual Suno timestamp','created_at',r.created_at||'',false)+
        fieldHtml('Key','key',r.key,false)+fieldHtml('Style','structured_prompt',r.structured_prompt,true)+
        fieldHtml('Negative Prompt / Exclude','negative_prompt',r.negative_prompt,true)+
        '<div class="advancedInspectorHeading">SUNO MORE OPTIONS</div>'+
        (r.voice_name?'<div class="voiceInspectorCard"><span>VOICE</span>'+(r.voice_url?'<a href="'+esc(r.voice_url)+'" target="_blank" rel="noopener">'+esc(r.voice_name)+'</a>':'<strong>'+esc(r.voice_name)+'</strong>')+'</div>':'')+
        fieldHtml('Voice Name','voice_name',r.voice_name||'',false)+fieldHtml('Voice URL','voice_url',r.voice_url||'',false)+
        fieldHtml('Vocal Gender','vocal_gender',r.vocal_gender||'',false)+fieldHtml('Duration','generation_duration',r.generation_duration||'',false)+
        fieldHtml('Max Mode','max_mode',r.max_mode||'',false)+fieldHtml('Weirdness','weirdness',r.weirdness??'',false)+
        fieldHtml('Style Influence','style_influence',r.style_influence??'',false)+fieldHtml('Audio Influence','audio_influence',r.audio_influence??'',false)+
        fieldHtml('Variety','variety',r.variety||'',false)+
        fieldHtml('Lyrics/Arrangement','instrumental_arrangement',r.instrumental_arrangement,true,'arrangement');
    }else{
      fields=fieldHtml('Title','title',r.title,false)+fieldHtml('Genre','genre',r.genre,false)+fieldHtml('BPM','bpm',r.bpm,false)+fieldHtml('Emotion','emotion',r.emotion,false)+fieldHtml('Style Tag','style',r.style,false)+fieldHtml('Year','year',r.year,false)+fieldHtml('Key','key',r.key,false)+fieldHtml('Reference Artist','reference_artist',r.reference_artist,false)+fieldHtml('Reference Song','reference_song',r.reference_song,false)+fieldHtml('Style','structured_prompt',r.structured_prompt,true)+fieldHtml('Negative Prompt','negative_prompt',r.negative_prompt,true)+fieldHtml('Lyrics/Arrangement','instrumental_arrangement',r.instrumental_arrangement,true,'arrangement');
    }
    box.innerHTML='<div class="inspectHeader"><h2>'+esc(r.title)+'</h2><span class="idBadge">#'+r.id+'</span></div>'+ 
      '<div class="autofillShell '+(state.autofilling?'running ':'')+(state.autofillError?'error':'')+'"><button id="autofillBtn" '+((state.autofilling||!state.sunoContextActive)?'disabled':'')+' title="'+(state.sunoContextActive?'Fill the active Suno tab':'Suno must be the active browser tab')+'">'+(state.autofilling?'AUTOFILLING…':state.autofillError?'ERROR — RETRY':'AUTOFILL SUNO')+'</button><div class="autofillSub">'+(state.autofillError?'Autofill stopped. Diagnostic remains below.':'Verified fill · Styles must be open · More Options can be filled automatically.')+'</div>'+ 
      '<div class="workflowControls">'+
        '<div class="autoModeRow">'+
          '<button id="autoUsedBtn" class="autoModeBtn '+(state.autoUsedAfterAutofill?'on':'')+'" title="After a verified Autofill, mark this track Used">'+(state.autoUsedAfterAutofill?'✓ AUTO USED':'AUTO USED')+'</button>'+
          '<button id="autoNextBtn" class="autoModeBtn '+(state.autoNextAfterAutofill?'on':'')+'" title="After a verified Autofill, select the next visible track">'+(state.autoNextAfterAutofill?'✓ AUTO NEXT':'AUTO NEXT')+'</button>'+ 
        '</div>'+
        '<button id="fillMoreOptionsBtn" class="autoModeBtn fillMoreOptionsBtn '+(state.fillMoreOptionsEnabled?'on':'')+'" title="Fill stored Suno More Options during Autofill">'+(state.fillMoreOptionsEnabled?'✓ FILL MORE OPTIONS':'FILL MORE OPTIONS')+'</button>'+
        '<div class="autoFillRow">'+
          '<button id="autoFillBtn" class="autoModeBtn autoFillBtn '+(state.autoFillEnabled?'on':'')+'" title="Enable Auto Fill mode. When enabled, F starts/pauses the click-gated countdown workflow">'+(state.autoFillEnabled?'✓ AUTO FILL':'AUTO FILL')+'</button>'+ 
          '<label class="autoFillSecondsWrap" title="Countdown seconds (01–99)"><input id="autoFillSeconds" type="number" min="1" max="99" step="1" inputmode="numeric" value="'+state.autoFillSeconds+'"><span>SEC</span></label>'+ 
          '<span class="autoFillStatus '+esc(state.autoFillRuntimePhase)+'">'+(state.autoFillEnabled?(state.autoFillRuntimePhase==='countdown'&&state.autoFillRemaining!=null?String(state.autoFillRemaining):state.autoFillRuntimePhase.replace(/_/g,' ').toUpperCase()):'OFF')+'</span>'+ 
        '</div>'+ 
        '<div class="hotkeyFeedbackRow">'+
          '<button id="fillHotkeyBtn" class="hotkeyHint hotkeyToggle '+(state.fillHotkeyEnabled?'on ':'off ')+(state.sunoContextActive&&state.fillHotkeyEnabled?'active':'inactive')+'" title="'+(state.fillHotkeyEnabled?(state.sunoContextActive?(state.autoFillEnabled?'F shortcut ON · starts / pauses Auto Fill':'F shortcut ON · press F in Suno to Autofill'):'F shortcut ON · waiting for active Suno tab'):'F shortcut OFF · typing F does nothing to GRAPH1KS')+'"><kbd>F</kbd><span>'+(state.fillHotkeyEnabled?(state.autoFillEnabled?'start / pause':'fill'):'off')+'</span><i class="hotkeyCheck">'+(state.fillHotkeyEnabled?'✓':'')+'</i></button>'+ 
          '<button id="retrieveHotkeyBtn" class="hotkeyHint hotkeyToggle retrieve '+(state.retrieveHotkeyEnabled?'on ':'off ')+(state.sunoContextActive&&state.retrieveHotkeyEnabled?'active':'inactive')+'" title="'+(state.retrieveHotkeyEnabled?(state.sunoContextActive?'R shortcut ON · retrieve current Suno Create/Song':'R shortcut ON · waiting for active Suno tab'):'R shortcut OFF · typing R does nothing to GRAPH1KS')+'"><kbd>R</kbd><span>'+(state.retrieveHotkeyEnabled?'retrieve':'off')+'</span><i class="hotkeyCheck">'+(state.retrieveHotkeyEnabled?'✓':'')+'</i></button>'+ 
          '<button id="soundFeedbackBtn" class="feedbackIconBtn '+(state.soundFeedback?'on':'')+'" title="Verified / blocked F sound"><span class="feedbackGlyph">🔊</span><span class="feedbackCheck">'+(state.soundFeedback?'✓':'')+'</span></button>'+ 
          '<button id="radialFeedbackBtn" class="feedbackIconBtn '+(state.radialFeedback?'on':'')+'" title="Pointer success / blocked F visual"><span class="feedbackGlyph radialGlyph">◎</span><span class="feedbackCheck">'+(state.radialFeedback?'✓':'')+'</span></button>'+ 
        '</div>'+ 
      '</div></div>'+error+
      '<div class="inspectToggles"><label class="usedInspectorToggle '+(r.used?'on':'')+'" title="Persistent Used state"><input id="usedCheckbox" type="checkbox" '+(r.used?'checked':'')+'><span class="usedInspectorBox">'+(r.used?'✓':'')+'</span><span>Used</span></label><button id="favoriteBtn" class="'+(r.favorite?'on':'')+'">'+(r.favorite?'★ Favorite':'☆ Favorite')+'</button></div>'+ 
      privateMeta+
      '<div class="editRow"><button id="editLockBtn">'+(state.editUnlocked?'LOCK':'UNLOCK EDIT')+'</button>'+(state.editUnlocked?'<button id="saveEditBtn">SAVE</button>':'')+'</div>'+ 
      fields+
      '<button id="deleteEntryBtn" class="deleteEntryBtn '+(state.deleteConfirmStage?'confirming':'')+'">'+(state.deleteConfirmStage?'CONFIRM DELETE':'DELETE ENTRY')+'</button>';

    var view=(deckRoot&&deckRoot.ownerDocument&&deckRoot.ownerDocument.defaultView)||window;
    view.requestAnimationFrame(function(){applyAutoFit(box);});
  }


  function editorGenreIdentity(value){
    return genreIdentity(value);
  }

  function editorGenreVocabulary(){
    var seen=new Map();
    function add(value,priority,count){
      value=String(value||'').trim();
      if(!value)return;
      var key=editorGenreIdentity(value);
      if(!key)return;
      var current=seen.get(key);
      var next={value:value,priority:Number(priority||0),count:Number(count||0)};
      if(!current||next.priority>current.priority||(next.priority===current.priority&&next.count>current.count)){
        seen.set(key,next);
      }
    }

    // The active taxonomy is authoritative for spelling. Track/database values
    // are only fallbacks for custom genres outside the taxonomy.
    state.genreMap.forEach(function(row){add(row&&row.genre,100000,0);});
    if(Array.isArray(state.publicGenreVocabulary))state.publicGenreVocabulary.forEach(function(genre){add(genre,1000,0);});
    try{genreStats().collected.forEach(function(row){add(row.genre,100,row.count||1);});}catch(_){}
    state.records.forEach(function(row){add(row.genre,10,1);});

    return Array.from(seen.values())
      .sort(function(a,b){return b.priority-a.priority||b.count-a.count||a.value.localeCompare(b.value);})
      .map(function(x){return x.value;});
  }

  function canonicalizeEditorGenre(value){
    var raw=String(value||'').trim();
    if(!raw)return '';
    var key=editorGenreIdentity(raw);
    var mapped=state.genreIdentityMap.get(key);
    if(mapped&&mapped.genre)return mapped.genre;
    var vocab=editorGenreVocabulary();
    for(var i=0;i<vocab.length;i++){
      if(editorGenreIdentity(vocab[i])===key)return vocab[i];
    }
    return raw.replace(/\s+/g,' ');
  }

  function findEditorGenreMapping(value){
    var raw=String(value||'').trim();
    if(!raw)return null;
    var canonical=canonicalizeEditorGenre(raw);
    return state.genreMap.get(normKey(canonical))||state.genreIdentityMap.get(editorGenreIdentity(canonical))||null;
  }

  function genreSuggestComparable(value){
    return String(value||'')
      .normalize('NFKD')
      .toLocaleLowerCase()
      .replace(/\p{M}+/gu,'')
      .replace(/[^\p{L}\p{N}]+/gu,' ')
      .trim()
      .replace(/\s+/g,' ');
  }

  function scoreEditorGenreSuggestion(genre,query){
    var qText=genreSuggestComparable(query);
    var gText=genreSuggestComparable(genre);
    var qCompact=editorGenreIdentity(query);
    var gCompact=editorGenreIdentity(genre);
    if(!qCompact)return 999;
    if(gCompact===qCompact)return 0;
    if(gText===qText)return 0;
    if(gCompact.startsWith(qCompact))return 1;
    if(gText.startsWith(qText))return 2;
    if(gCompact.indexOf(qCompact)>=0)return 3;
    if(gText.indexOf(qText)>=0)return 4;
    var tokens=qText.split(' ').filter(Boolean);
    if(tokens.length&&tokens.every(function(token){
      var compact=editorGenreIdentity(token);
      return compact&&gCompact.indexOf(compact)>=0;
    }))return 5;
    return 999;
  }

  function editorGenreSuggestions(query){
    var matches=[];
    editorGenreVocabulary().forEach(function(genre){
      var score=scoreEditorGenreSuggestion(genre,query);
      if(score>=999)return;
      var mapping=findEditorGenreMapping(genre);
      matches.push({genre:genre,score:score,majors:mappingMajors(mapping)});
    });
    matches.sort(function(a,b){return a.score-b.score||a.genre.length-b.genre.length||a.genre.localeCompare(b.genre);});
    return matches;
  }

  function hideVaultEditorGenreSuggestions(){
    var box=$('#vaultEditorSubgenreSuggest');
    var input=$('#vaultEditorSubgenre');
    if(box){box.classList.add('hidden');box.innerHTML='';}
    if(input)input.setAttribute('aria-expanded','false');
  }

  function renderVaultEditorGenreSuggestions(query){
    var box=$('#vaultEditorSubgenreSuggest');
    var input=$('#vaultEditorSubgenre');
    if(!box||!input)return;
    query=String(query||'').trim();
    if(!query){hideVaultEditorGenreSuggestions();return;}
    var matches=editorGenreSuggestions(query);
    if(!matches.length){hideVaultEditorGenreSuggestions();return;}
    box.innerHTML=matches.map(function(row){
      return '<button type="button" class="vaultEditorGenreSuggestion" role="option" data-editor-genre="'+esc(row.genre)+'">'+
        '<span>'+esc(row.genre)+'</span>'+
        '<small>'+esc(row.majors.length?row.majors.join(' + '):'UNMAPPED')+'</small>'+
      '</button>';
    }).join('');
    box.classList.remove('hidden');
    input.setAttribute('aria-expanded','true');
  }

  function syncVaultEditorMajorGenreFromSubgenre(){
    var sub=$('#vaultEditorSubgenre');
    var major=$('#vaultEditorMajorGenre');
    var hint=$('#vaultEditorMajorGenreHint');
    var autoList=$('#vaultEditorMajorGenreAutoList');
    if(!sub||!major)return [];
    var raw=String(sub.value||'').trim();
    if(!raw){
      major.disabled=false;
      delete major.dataset.autoMajors;
      if(autoList){autoList.classList.add('hidden');autoList.innerHTML='';}
      if(hint)hint.textContent='Optional: choose a Major Genre, or enter a mapped Subgenre to fill it automatically.';
      return [];
    }
    var mapping=findEditorGenreMapping(raw);
    var majors=mappingMajors(mapping);
    if(majors.length){
      major.value=majors[0];
      major.disabled=true;
      major.dataset.autoMajors=majors.join('|');
      if(autoList){
        autoList.innerHTML=majors.map(function(m){return '<span>'+esc(m)+'</span>';}).join('');
        autoList.classList.remove('hidden');
      }
      if(hint)hint.textContent='AUTO from Subgenre: '+majors.join(' + ');
      return majors;
    }
    major.disabled=false;
    delete major.dataset.autoMajors;
    if(autoList){autoList.classList.add('hidden');autoList.innerHTML='';}
    if(hint)hint.textContent='New / unmapped Subgenre: choose its Major Genre before saving.';
    return [];
  }

  function populateVaultEditorGenres(){
    var major=$('#vaultEditorMajorGenre');
    if(major){
      var current=major.value;
      major.innerHTML='<option value="">Major Genre…</option>'+MAJOR_GENRES.map(function(m){return '<option value="'+esc(m)+'">'+esc(m)+'</option>';}).join('');
      if(MAJOR_GENRES.includes(current))major.value=current;
    }
    hideVaultEditorGenreSuggestions();
    publicGenreVocabulary().then(function(){
      syncVaultEditorMajorGenreFromSubgenre();
    }).catch(function(){});
    syncVaultEditorMajorGenreFromSubgenre();
  }

  function parseYearFromStyle(styles){
    var matches=String(styles||'').match(/\b(?:19|20)\d{2}\b/g)||[];
    for(var i=0;i<matches.length;i++){
      var n=Number(matches[i]);
      if(n>=1900&&n<=2099)return n;
    }
    return 0;
  }

  function inferVaultEditorMetadataFromStyle(){
    var style=$('#vaultEditorStyle');
    if(!style)return;
    if(!state.vaultEditorBpmDirty){
      var bpm=parseBpmFromStyles(style.value);
      var bpmEl=$('#vaultEditorBpm');
      if(bpmEl)bpmEl.value=bpm>0?String(bpm):'';
    }
    if(!state.vaultEditorYearDirty){
      var year=parseYearFromStyle(style.value);
      var yearEl=$('#vaultEditorYear');
      if(yearEl)yearEl.value=year>0?String(year):'';
    }
  }


  function updateVaultEditorCounters(){
    var fields=[
      ['vaultEditorTitle',80],['vaultEditorStyle',1000],['vaultEditorNegative',1000],['vaultEditorLyrics',5000]
    ];
    fields.forEach(function(pair){
      var el=$('#'+pair[0]);if(!el)return;
      if(el.value.length>pair[1])el.value=el.value.slice(0,pair[1]);
      var counter=$('[data-counter-for="'+pair[0]+'"]');
      if(counter)counter.textContent=el.value.length+' / '+pair[1];
      if(el.matches('textarea[data-autofit-field]')&&autoFitEnabled(el.dataset.autofitField))fitTextarea(el);
    });
    var save=$('#vaultEditorSaveBtn');
    if(save)save.disabled=!isPrivateDataset()||!String($('#vaultEditorTitle')&&$('#vaultEditorTitle').value||'').trim();
  }

  function resetVaultEditor(){
    ['vaultEditorTitle','vaultEditorStyle','vaultEditorNegative','vaultEditorLyrics','vaultEditorBpm','vaultEditorYear','vaultEditorSubgenre','vaultEditorVoiceName','vaultEditorVoiceUrl','vaultEditorVocalGender','vaultEditorDuration','vaultEditorMaxMode','vaultEditorWeirdness','vaultEditorStyleInfluence','vaultEditorAudioInfluence','vaultEditorVariety'].forEach(function(id){var el=$('#'+id);if(el)el.value='';});
    var major=$('#vaultEditorMajorGenre');if(major){major.value='';major.disabled=false;delete major.dataset.autoMajors;}
    var majorHint=$('#vaultEditorMajorGenreHint');if(majorHint)majorHint.textContent='Optional: choose a Major Genre, or enter a mapped Subgenre to fill it automatically.';
    var majorAuto=$('#vaultEditorMajorGenreAutoList');if(majorAuto){majorAuto.innerHTML='';majorAuto.classList.add('hidden');}
    state.vaultEditorBpmDirty=false;state.vaultEditorYearDirty=false;
    populateVaultEditorGenres();
    var status=$('#vaultEditorStatus');if(status)status.textContent='';
    updateVaultEditorCounters();
    applyAutoFit($('#vaultEditorModal'));
  }

  function openVaultEditor(){
    if(!isPrivateDataset()){toast('Private Vault required','EDITOR MODE stores manual songs in the active Private Vault.');return;}
    var modal=$('#vaultEditorModal');if(!modal)return;
    state.vaultEditorOpen=true;
    resetVaultEditor();
    modal.classList.remove('hidden');modal.setAttribute('aria-hidden','false');
    applyAutoFit(modal);
    var title=$('#vaultEditorTitle');if(title)setTimeout(function(){title.focus();},0);
  }

  function closeVaultEditor(){
    var modal=$('#vaultEditorModal');if(!modal)return;
    state.vaultEditorOpen=false;
    modal.classList.add('hidden');modal.setAttribute('aria-hidden','true');
  }

  async function saveVaultEditorSong(){
    if(!isPrivateDataset())throw new Error('EDITOR MODE requires the Private Vault.');
    var entry=activeVaultEntry();if(!entry)entry=await ensureLocalPrivateVault();
    var title=String($('#vaultEditorTitle').value||'');
    var structured=String($('#vaultEditorStyle').value||'');
    var negative=String($('#vaultEditorNegative').value||'');
    var arrangement=String($('#vaultEditorLyrics').value||'');
    var bpmRaw=String($('#vaultEditorBpm')&&$('#vaultEditorBpm').value||'').trim();
    var yearRaw=String($('#vaultEditorYear')&&$('#vaultEditorYear').value||'').trim();
    var voiceName=String($('#vaultEditorVoiceName')&&$('#vaultEditorVoiceName').value||'').trim();
    var voiceUrl=String($('#vaultEditorVoiceUrl')&&$('#vaultEditorVoiceUrl').value||'').trim();
    var vocalGender=String($('#vaultEditorVocalGender')&&$('#vaultEditorVocalGender').value||'').trim();
    var generationDuration=String($('#vaultEditorDuration')&&$('#vaultEditorDuration').value||'').trim();
    var maxMode=String($('#vaultEditorMaxMode')&&$('#vaultEditorMaxMode').value||'').trim();
    var weirdnessRaw=String($('#vaultEditorWeirdness')&&$('#vaultEditorWeirdness').value||'').trim();
    var influenceRaw=String($('#vaultEditorStyleInfluence')&&$('#vaultEditorStyleInfluence').value||'').trim();
    var audioInfluenceRaw=String($('#vaultEditorAudioInfluence')&&$('#vaultEditorAudioInfluence').value||'').trim();
    var variety=String($('#vaultEditorVariety')&&$('#vaultEditorVariety').value||'').trim();
    var selectedMajorGenre=canonicalMajor($('#vaultEditorMajorGenre')&&$('#vaultEditorMajorGenre').value||'')||'';
    await publicGenreVocabulary().catch(function(){return [];});
    var subgenre=canonicalizeEditorGenre($('#vaultEditorSubgenre')&&$('#vaultEditorSubgenre').value||'');
    var existingGenreMapping=subgenre?findEditorGenreMapping(subgenre):null;
    var mappedMajorGenres=mappingMajors(existingGenreMapping);
    var majorGenres=mappedMajorGenres.length?mappedMajorGenres:(selectedMajorGenre?[selectedMajorGenre]:[]);
    var majorGenre=majorGenres[0]||'';
    if(subgenre&&!mappedMajorGenres.length&&!selectedMajorGenre)throw new Error('Choose a Major Genre for this new / unmapped Subgenre.');
    if(!title.trim())throw new Error('Title is required.');
    if(title.length>80||structured.length>1000||negative.length>1000||arrangement.length>5000)throw new Error('One or more fields exceed the Suno character limit.');
    var bpm=bpmRaw?Number(bpmRaw):parseBpmFromStyles(structured);
    if(!Number.isFinite(bpm)||bpm<0||bpm>999)throw new Error('BPM must be between 0 and 999.');
    var year=yearRaw?Number(yearRaw):parseYearFromStyle(structured);
    if(!Number.isFinite(year)||year<0||year>2099)throw new Error('Year must be between 0 and 2099.');
    if(!year)year=Number(new Date().getFullYear());
    if(generationDuration&&!/^auto$/i.test(generationDuration)&&!/^\d{1,2}:[0-5]\d$/.test(generationDuration))throw new Error('Duration must be AUTO or M:SS.');
    if(/^auto$/i.test(generationDuration))generationDuration='AUTO';
    var weirdness=weirdnessRaw===''?'':Number(weirdnessRaw);
    var styleInfluence=influenceRaw===''?'':Number(influenceRaw);
    if(weirdness!==''&&(!Number.isFinite(weirdness)||weirdness<0||weirdness>100))throw new Error('Weirdness must be 0–100.');
    if(styleInfluence!==''&&(!Number.isFinite(styleInfluence)||styleInfluence<0||styleInfluence>100))throw new Error('Style Influence must be 0–100.');
    var audioInfluence=audioInfluenceRaw===''?'':Number(audioInfluenceRaw);
    if(audioInfluence!==''&&(!Number.isFinite(audioInfluence)||audioInfluence<0||audioInfluence>100))throw new Error('Audio Influence must be 0–100.');
    var genre=subgenre||majorGenre||'';

    var id=(await maxTrackId(entry.dbName))+1;
    var now=nowIso();
    var artistHandle=normalizeIdentityHandle(entry.handle);
    var artistName=normalizeIdentityPart(entry.displayName)||artistHandle;
    var track={
      id:id,title:title,genre:genre,bpm:bpm||0,emotion:'',style:'',year:year,key:'',
      reference_artist:artistName||'',reference_song:'',
      structured_prompt:normalizeMultiline(structured),negative_prompt:normalizeMultiline(negative),instrumental_arrangement:normalizeMultiline(arrangement),
      used:false,favorite:false,created_at:now,
      artist_name:artistName||'',artist_handle:artistHandle||'',artist_user_id:String(entry.userId||''),
      artist_profile_url:artistHandle?'https://suno.com/@'+artistHandle:'',
      suno_song_id:'',suno_song_url:'',record_type:'draft',genre_source:genre?'manual':'none',genre_matched_text:'',retrieved_at:'',source_url:'',
      voice_name:voiceName,voice_url:voiceUrl,vocal_gender:vocalGender,generation_duration:generationDuration,max_mode:maxMode,
      weirdness:weirdness,style_influence:styleInfluence,audio_influence:audioInfluence,variety:variety,exclude_styles:normalizeMultiline(negative)
    };
    await putFullRecord(track,entry.dbName);
    if(subgenre&&!mappedMajorGenres.length&&selectedMajorGenre){
      var mapping={genre_key:normKey(genre),genre:genre,major_genres:[selectedMajorGenre],major_genre:selectedMajorGenre,updated_at:now};
      await putMappings([mapping],entry.dbName);
      state.genreMap.set(mapping.genre_key,mapping);
      rebuildGenreIdentityMap();
    }
    entry.updatedAt=now;state.vaultRegistry[entry.key]=entry;await saveVaultRegistry();
    await refresh();
    state.selectedId=id;state.selectedFull=track;state.editUnlocked=false;state.deleteConfirmStage=0;
    renderAll();
    closeVaultEditor();
    toast('Saved to Private Vault',title+' · #'+id);
    return track;
  }

  async function migratePrivateSunoSettingsIndex(records){
    if(!isPrivateDataset()||!Array.isArray(records)||!records.length)return records;
    var needs=records.some(function(r){return !Object.prototype.hasOwnProperty.call(r,'exclude_styles')||!Object.prototype.hasOwnProperty.call(r,'audio_influence')||Object.prototype.hasOwnProperty.call(r,'personalize');});
    if(!needs)return records;
    var contents=await getAllContentRecords();
    var contentById=new Map(contents.map(function(c){return [Number(c.id),c];}));
    var migrated=records.map(function(r){
      var full=Object.assign({},r);
      var c=contentById.get(Number(r.id));
      full.negative_prompt=c&&c.negative_prompt!=null?c.negative_prompt:(r.exclude_styles||'');
      if(!Object.prototype.hasOwnProperty.call(full,'audio_influence'))full.audio_influence='';
      delete full.personalize;
      return full;
    });
    await putIndexMany(migrated,activeDbName());
    return await indexAll();
  }

  async function refresh(){
    var records=await indexAll();
    records=await migratePrivateSunoSettingsIndex(records);
    var maps=await mapAll();
    var canonicalRows=await canonicalAll();

    state.records=records.sort(function(a,b){return Number(a.id)-Number(b.id);});
    rebuildRecordMap();
    state.genreMap=new Map(maps.map(function(m){return [m.genre_key,m];}));
    rebuildGenreIdentityMap();
    state.genreTaxonomyVersion=maps.reduce(function(max,row){var n=Number(row&&row.taxonomy_version);return Number.isFinite(n)?Math.max(max,n):max;},FACTORY_TAXONOMY_VERSION);
    state.canonicalMap=new Map(canonicalRows.map(function(row){return [row.key,row];}));
    invalidateView(false);
    invalidateGenreStats();

    state.selectedIds=new Set(Array.from(state.selectedIds).filter(function(id){return state.recordById.has(Number(id));}));

    if(state.randomViewIds){
      state.randomViewIds=new Set(Array.from(state.randomViewIds).filter(function(id){return state.recordById.has(Number(id));}));
      if(state.randomViewMeta)state.randomViewMeta.count=state.randomViewIds.size;
      persistLastListState();
    }

    if(state.selectedId&&!state.recordById.has(Number(state.selectedId))){
      state.selectedId=null;
      state.selectedFull=null;
    }else if(state.selectedId){
      state.selectedFull=await getFullTrack(state.selectedId);
    }

    renderAll();
  }

  function downloadJson(obj,name){var blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);}


  // -------------------------------------------------------------------------
  // PRIVATE VAULT — same track/index/content schema as PUBLIC VAULT.
  // Existing v4.12 per-account Suno Vault databases are upgraded in place and
  // migrated once from their legacy `records` store into the normal track
  // stores. Retrieval always targets the signed-in Suno account's Private Vault.
  // -------------------------------------------------------------------------
  function vaultUuid(){
    if(globalThis.crypto&&crypto.randomUUID)return crypto.randomUUID();
    return 'g1v-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);
  }

  function vaultSafePart(value){
    return String(value||'unknown').replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,120)||'unknown';
  }

  function vaultFilePart(value){
    return String(value||'PRIVATE_VAULT').trim().replace(/[^a-zA-Z0-9._-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,100)||'PRIVATE_VAULT';
  }

  function normalizeIdentityPart(value){return String(value||'').trim();}
  function normalizeIdentityHandle(value){return normalizeIdentityPart(value).replace(/^@/,'');}
  function sameIdentitySnapshot(a,b){
    return normalizeIdentityHandle(a&&a.handle).toLowerCase()===normalizeIdentityHandle(b&&b.handle).toLowerCase() &&
      normalizeIdentityPart(a&&a.displayName)===normalizeIdentityPart(b&&b.displayName);
  }
  function ensureVaultIdentityHistory(entry){
    if(!entry)return [];
    if(!Array.isArray(entry.identityHistory))entry.identityHistory=[];
    if(!entry.identityHistory.length&&(entry.handle||entry.displayName)){
      entry.identityHistory.push({handle:normalizeIdentityHandle(entry.handle)||null,displayName:normalizeIdentityPart(entry.displayName)||null,profileUrl:normalizeIdentityHandle(entry.handle)?'https://suno.com/@'+normalizeIdentityHandle(entry.handle):null,firstSeen:entry.createdAt||entry.updatedAt||nowIso(),lastSeen:entry.updatedAt||entry.createdAt||nowIso(),observations:1,source:'existing-vault'});
    }
    return entry.identityHistory;
  }
  function observeVaultIdentity(entry,account,source){
    if(!entry||!account)return {changed:false};
    var handle=normalizeIdentityHandle(account.handle)||normalizeIdentityHandle(entry.handle);
    var displayName=normalizeIdentityPart(account.displayName)||normalizeIdentityPart(entry.displayName)||null;
    var now=nowIso();
    var next={handle:handle||null,displayName:displayName,profileUrl:handle?'https://suno.com/@'+handle:null};
    var history=ensureVaultIdentityHistory(entry);
    var last=history.length?history[history.length-1]:null;
    var changed=!last||!sameIdentitySnapshot(last,next);
    if(changed){
      history.push({handle:next.handle,displayName:next.displayName,profileUrl:next.profileUrl,firstSeen:now,lastSeen:now,observations:1,source:source||'suno'});
      if(history.length>100)history.splice(0,history.length-100);
    }else{
      last.lastSeen=now;last.observations=Math.max(1,Number(last.observations)||1)+1;last.source=source||last.source||'suno';if(next.profileUrl)last.profileUrl=next.profileUrl;
    }
    if(account.userId)entry.userId=String(account.userId);
    if(handle)entry.handle=handle;if(displayName)entry.displayName=displayName;
    entry.profileUrl=handle?'https://suno.com/@'+handle:null;entry.identityUpdatedAt=now;entry.updatedAt=now;
    return {changed:changed,previous:last,current:next};
  }
  function isPrivateProvenanceField(field){return isPrivateDataset()&&PRIVATE_PROVENANCE_FIELDS.has(String(field||''));}
  function assertPrivateFieldEditable(field){if(isPrivateProvenanceField(field))throw new Error('Private Vault provenance is read-only. '+(DBM_FIELDS[field]?DBM_FIELDS[field].label:field)+' can only be refreshed from authoritative Suno data.');}

  async function loadVaultRegistry(){
    var persistedActive=null;
    try{
      var stored=await chrome.storage.local.get([VAULT_REGISTRY_KEY,ACTIVE_VAULT_KEY]);
      state.vaultRegistry=stored&&stored[VAULT_REGISTRY_KEY]&&typeof stored[VAULT_REGISTRY_KEY]==='object'?stored[VAULT_REGISTRY_KEY]:{};
      persistedActive=stored&&typeof stored[ACTIVE_VAULT_KEY]==='string'?stored[ACTIVE_VAULT_KEY]:null;
    }catch(_){state.vaultRegistry={};persistedActive=null;}
    var keys=Object.keys(state.vaultRegistry);
    keys.forEach(function(k){
      var entry=state.vaultRegistry[k];
      if(entry&&Object.prototype.hasOwnProperty.call(entry,'name'))delete entry.name;
      ensureVaultIdentityHistory(entry);
    });
    if(state.activeVaultKey&&!state.vaultRegistry[state.activeVaultKey])state.activeVaultKey=null;
    if(!state.activeVaultKey&&persistedActive&&state.vaultRegistry[persistedActive])state.activeVaultKey=persistedActive;
    if(!state.activeVaultKey&&keys.length){
      var accountKey=keys.find(function(k){var e=state.vaultRegistry[k];return e&&(e.userId||e.handle||e.displayName);});
      state.activeVaultKey=accountKey||keys[0];
    }
    if(keys.length||persistedActive)await saveVaultRegistry();
    return state.vaultRegistry;
  }

  async function saveVaultRegistry(){
    await chrome.storage.local.set({
      [VAULT_REGISTRY_KEY]:state.vaultRegistry,
      [ACTIVE_VAULT_KEY]:state.activeVaultKey||null
    });
  }

  function activeVaultEntry(){
    return state.activeVaultKey?state.vaultRegistry[state.activeVaultKey]||null:null;
  }

  async function ensureVaultRetrievalReady(entry){
    if(!entry||!entry.dbName)return;
    if(state.retrievalReadyVaults.has(entry.dbName))return;
    await openDb(entry.dbName).then(function(db){db.close();});
    await migrateLegacyVault(entry);
    await ensurePrivateGenreMap(entry);
    state.retrievalReadyVaults.add(entry.dbName);
  }

  async function ensureVaultForAccount(account){
    account=account||{};
    var userId=String(account.userId||'').trim();
    var handle=String(account.handle||'').replace(/^@/,'').trim();
    var displayName=String(account.displayName||'').trim()||null;
    if(!userId&&!handle)throw new Error('Could not identify the signed-in Suno account.');

    var key=userId?'uid:'+userId:'handle:'+handle.toLowerCase();
    var entry=state.vaultRegistry[key]||null;

    if(!entry&&userId&&handle){
      var oldKey=Object.keys(state.vaultRegistry).find(function(k){
        var e=state.vaultRegistry[k];
        return e&&e.handle&&String(e.handle).toLowerCase()===handle.toLowerCase();
      });
      if(oldKey){
        entry=state.vaultRegistry[oldKey];
        delete state.vaultRegistry[oldKey];
        entry.key=key;
      }
    }

    if(!entry){
      entry={
        key:key,
        dbName:'graph1ks_suno_vault_'+vaultSafePart(userId||handle.toLowerCase()),
        userId:userId||null,
        handle:handle||null,
        displayName:displayName,
        createdAt:nowIso(),
        updatedAt:nowIso(),
        migratedV413:false,
        identityHistory:[]
      };
    }else{
      if(Object.prototype.hasOwnProperty.call(entry,'name'))delete entry.name;
      if(!entry.dbName)entry.dbName='graph1ks_suno_vault_'+vaultSafePart(userId||handle.toLowerCase());
    }
    var identityObservation=observeVaultIdentity(entry,{userId:userId||entry.userId,handle:handle||entry.handle,displayName:displayName||entry.displayName},'retrieve');

    state.vaultRegistry[key]=entry;
    state.activeVaultKey=key;
    await saveVaultRegistry();
    await ensureVaultRetrievalReady(entry);
    if(identityObservation.changed)await syncOwnedTracksToVaultIdentity(entry,identityObservation.previous);
    return entry;
  }

  async function getLegacyVaultRecords(entry){
    var db=await openDb(entry.dbName);
    if(!db.objectStoreNames.contains(VAULT_RECORD_STORE)){db.close();return [];}
    return new Promise(function(resolve,reject){
      var tx=db.transaction(VAULT_RECORD_STORE,'readonly');
      var req=tx.objectStore(VAULT_RECORD_STORE).getAll();
      req.onsuccess=function(){resolve(req.result||[]);};
      req.onerror=function(){reject(req.error);};
      tx.oncomplete=function(){db.close();};
      tx.onabort=function(){db.close();};
    });
  }

  function genreComparable(value){
    return ' '+String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/[^a-z0-9+#&/.-]+/g,' ').replace(/\s+/g,' ').trim()+' ';
  }

  async function publicGenreVocabulary(){
    if(state.publicGenreVocabulary)return state.publicGenreVocabulary;
    var rows=(!isPrivateDataset()&&state.records.length)
      ? state.records
      : await indexAll(PUBLIC_DB_NAME).catch(function(){return [];});
    var mappings=await mapAll(PUBLIC_DB_NAME).catch(function(){return [];});
    var map=new Map();
    function addGenre(value){
      var genre=String(value||'').trim();
      if(!genre)return;
      var key=genreComparable(genre).trim();
      if(key&&!map.has(key))map.set(key,genre);
    }
    rows.forEach(function(row){addGenre(row.genre);});
    mappings.forEach(function(row){addGenre(row.genre);});
    state.publicGenreVocabulary=Array.from(map.values()).sort(function(a,b){
      var words=genreComparable(b).length-genreComparable(a).length;
      return words||String(a).localeCompare(String(b));
    });
    return state.publicGenreVocabulary;
  }

  async function inferGenreFromStyles(styles){
    var text=genreComparable(styles);
    if(!text.trim())return {genre:'',source:'none',matchedText:''};
    var genres=await publicGenreVocabulary();
    for(var i=0;i<genres.length;i++){
      var genre=genres[i];
      var phrase=genreComparable(genre);
      if(phrase.trim().length<3)continue;
      if(text.indexOf(phrase)>=0)return {genre:genre,source:'auto',matchedText:genre};
    }
    return {genre:'',source:'none',matchedText:''};
  }

  function parseBpmFromStyles(styles){
    var text=String(styles||'');
    // Accept common prompt variants in either direction:
    // 86 BPM, 86bpm, BPM 86, BPM86, BPM: 86, BPM=86, 86-BPM.
    var m=text.match(/\bBPM\s*[:=\-]?\s*(\d{2,3})\b|\b(\d{2,3})\s*[:=\-]?\s*BPM\b/i);
    var n=m?Number(m[1]||m[2]):0;
    return Number.isFinite(n)?n:0;
  }

  function parseKeyFromStyles(styles){
    var m=String(styles||'').match(/\b([A-G](?:#|b)?\s*(?:major|minor|maj|min))\b/i);
    return m?m[1].replace(/\s+/g,' ').trim():'';
  }

  function validIsoYear(value){
    var d=value?new Date(value):null;
    return d&&!Number.isNaN(d.getTime())?d.getUTCFullYear():new Date().getUTCFullYear();
  }

  async function retrievedRecordToTrack(record,id,existing){
    existing=existing||{};
    var owner=record.owner||{};
    var source=record.source||{};
    var styles=String(record.styles||record.structured_prompt||'');
    var createdAt=String(existing.created_at||record.createdAt||source.createdAt||source.retrievedAt||record.retrievedAt||nowIso());
    var inferred=await inferGenreFromStyles(styles);
    var manualGenre=String(existing.genre_source||'')==='manual';
    var genre=manualGenre?String(existing.genre||''):(inferred.genre||String(existing.genre||''));
    var songId=String(record.sunoSongId||existing.suno_song_id||'').trim();
    var songUrl=String(source.songUrl||record.sunoSongUrl||existing.suno_song_url||(songId?'https://suno.com/song/'+songId:'')).trim();
    var artistHandle=String(owner.handle||existing.artist_handle||'').replace(/^@/,'').trim();
    var artistName=String(owner.displayName||existing.artist_name||artistHandle||'').trim();
    var artistProfile=String(source.profileUrl||existing.artist_profile_url||(artistHandle?'https://suno.com/@'+artistHandle:'')).trim();
    var arrangement=normalizeMultiline(record.lyrics||record.instrumental_arrangement||record.prompt||existing.instrumental_arrangement||'');
    var advanced=record.advancedOptions&&typeof record.advancedOptions==='object'?record.advancedOptions:{};
    var bpm=Number(existing.bpm);
    if(!Number.isFinite(bpm)||bpm<=0)bpm=parseBpmFromStyles(styles);
    var displayYear=Number(existing.year);
    if(!Number.isFinite(displayYear))displayYear=validIsoYear(createdAt);

    return {
      id:Number(id),
      title:String(record.title||record.name||existing.title||''),
      genre:genre,
      bpm:bpm||0,
      emotion:String(existing.emotion||''),
      style:String(existing.style||''),
      year:displayYear,
      key:String(existing.key||parseKeyFromStyles(styles)||''),
      reference_artist:artistName||String(existing.reference_artist||''),
      reference_song:songId||String(existing.reference_song||''),
      structured_prompt:styles||String(existing.structured_prompt||''),
      negative_prompt:String(record.exclude||record.negative_prompt||existing.negative_prompt||''),
      instrumental_arrangement:arrangement,
      used:!!existing.used,
      favorite:!!existing.favorite,
      created_at:createdAt,
      artist_name:artistName,
      artist_handle:artistHandle,
      artist_user_id:String(owner.userId||existing.artist_user_id||''),
      artist_profile_url:artistProfile,
      suno_song_id:songId,
      suno_song_url:songUrl,
      record_type:String(record.recordType||record.pageType||existing.record_type||'song'),
      genre_source:manualGenre?'manual':(inferred.genre?'auto':String(existing.genre_source||'none')),
      genre_matched_text:manualGenre?'':(inferred.matchedText||String(existing.genre_matched_text||'')),
      retrieved_at:String(source.retrievedAt||record.retrievedAt||nowIso()),
      source_url:String(source.url||songUrl||existing.source_url||''),
      voice_name:String(advanced.voice_name||record.voice_name||existing.voice_name||''),
      voice_url:String(advanced.voice_url||record.voice_url||existing.voice_url||''),
      vocal_gender:String(advanced.vocal_gender||record.vocal_gender||existing.vocal_gender||''),
      generation_duration:String(advanced.duration||record.generation_duration||existing.generation_duration||''),
      max_mode:String(advanced.max_mode||record.max_mode||existing.max_mode||''),
      weirdness:String(advanced.weirdness??record.weirdness??existing.weirdness??''),
      style_influence:String(advanced.style_influence??record.style_influence??existing.style_influence??''),
      audio_influence:String(advanced.audio_influence??record.audio_influence??existing.audio_influence??''),
      variety:String(advanced.variety||record.variety||existing.variety||''),
      exclude_styles:String(record.exclude||record.negative_prompt||advanced.exclude_styles||existing.exclude_styles||existing.negative_prompt||'')
    };
  }

  async function getFullTrackFromDb(dbName,id){
    var db=await openDb(dbName);
    return new Promise(function(resolve,reject){
      var tx=db.transaction([TRACK_INDEX_STORE,TRACK_CONTENT_STORE],'readonly');
      var ixReq=tx.objectStore(TRACK_INDEX_STORE).get(Number(id));
      var csReq=tx.objectStore(TRACK_CONTENT_STORE).get(Number(id));
      var ix=null,cs=null;
      ixReq.onsuccess=function(){ix=ixReq.result||null;};
      csReq.onsuccess=function(){cs=csReq.result||null;};
      tx.oncomplete=function(){db.close();resolve(ix?mergeTrack(ix,cs):null);};
      tx.onerror=function(){var e=tx.error;db.close();reject(e);};
      tx.onabort=function(){var e=tx.error;db.close();reject(e);};
    });
  }

  async function ensurePrivateGenreMap(entry){
    if(!entry||!entry.dbName)return;
    // v1.3.0: a Vault without the v6 migration marker is atomically converted
    // to the authoritative bundled taxonomy. Once migrated, a user-imported
    // full taxonomy remains untouched until a future bundled taxonomy version.
    try{
      await ensureBundledGenreTaxonomy(entry.dbName,{replace:true});
      return;
    }catch(_){}
    // Offline/legacy fallback.
    var own=await mapAll(entry.dbName).catch(function(){return [];});
    if(own.length)return;
    var publicRows=await mapAll(PUBLIC_DB_NAME).catch(function(){return [];});
    if(!publicRows.length)return;
    await withTx([GENRE_MAP_STORE],'readwrite',function(tx){
      var os=tx.objectStore(GENRE_MAP_STORE);
      publicRows.forEach(function(row){os.put(row);});
    },entry.dbName);
  }

  async function migrateLegacyVault(entry){
    if(!entry||entry.migratedV413)return;
    var legacy=await getLegacyVaultRecords(entry).catch(function(){return [];});
    var current=await indexAll(entry.dbName).catch(function(){return [];});
    var songIds=new Set(current.map(function(r){return String(r.suno_song_id||'');}).filter(Boolean));
    var max=current.reduce(function(m,r){return Math.max(m,Number(r.id)||0);},0);
    var converted=[];
    for(var i=0;i<legacy.length;i++){
      var old=legacy[i];
      var oldSong=String(old.sunoSongId||'');
      if(oldSong&&songIds.has(oldSong))continue;
      var track=await retrievedRecordToTrack(old,++max,null);
      converted.push(track);
      if(track.suno_song_id)songIds.add(track.suno_song_id);
    }
    if(converted.length)await putFullChunk(converted,entry.dbName);
    entry.migratedV413=true;
    entry.updatedAt=nowIso();
    state.vaultRegistry[entry.key]=entry;
    await saveVaultRegistry();
  }

  async function storeRetrievedRecord(entry,record){
    await ensureVaultRetrievalReady(entry);
    var songId=String(record.sunoSongId||'').trim();
    var existingIndex=songId?await findIndexBySunoSongId(entry.dbName,songId):null;
    var existing=existingIndex?await getFullTrackFromDb(entry.dbName,existingIndex.id):null;
    var id=existingIndex?Number(existingIndex.id):(await maxTrackId(entry.dbName))+1;
    var track=await retrievedRecordToTrack(record,id,existing);
    await putFullRecord(track,entry.dbName);
    entry.updatedAt=nowIso();
    state.vaultRegistry[entry.key]=entry;
    await saveVaultRegistry();

    // Persistence is complete at this point, so R can acknowledge immediately.
    // Heavy list refresh/render work is intentionally decoupled from the hotkey.
    if(isPrivateDataset()&&state.activeVaultKey===entry.key){
      setTimeout(function(){refresh().catch(function(){});},0);
    }
    renderVaultNavigation();
    return track;
  }

  async function syncOwnedTracksToVaultIdentity(entry,previousIdentity){
    if(!entry||!entry.dbName)return 0;
    var rows=await indexAll(entry.dbName).catch(function(){return [];});
    var handle=normalizeIdentityHandle(entry.handle);var displayName=normalizeIdentityPart(entry.displayName)||handle;var profileUrl=handle?'https://suno.com/@'+handle:'';
    var previousHandle=normalizeIdentityHandle(previousIdentity&&previousIdentity.handle).toLowerCase();var updates=[];
    rows.forEach(function(row){
      var sameUser=entry.userId&&String(row.artist_user_id||'')===String(entry.userId);
      var legacySelf=!row.artist_user_id&&previousHandle&&normalizeIdentityHandle(row.artist_handle).toLowerCase()===previousHandle;
      if(!sameUser&&!legacySelf)return;
      updates.push(Object.assign({},row,{artist_name:displayName||row.artist_name||'',artist_handle:handle||row.artist_handle||'',artist_user_id:entry.userId||row.artist_user_id||'',artist_profile_url:profileUrl||row.artist_profile_url||'',reference_artist:displayName||row.reference_artist||''}));
    });
    if(updates.length)await putIndexMany(updates,entry.dbName);return updates.length;
  }
  async function updateActivePrivateVaultIdentityFromSuno(){
    if(!isPrivateDataset())throw new Error('Switch to PRIVATE VAULT first.');
    var entry=activeVaultEntry();if(!entry||entry.key==='local:private')throw new Error('This Private Vault is not bound to a Suno account.');
    if(!state.sunoContextActive)throw new Error('Make the signed-in Suno tab active first.');
    var response=await chrome.runtime.sendMessage({type:'GET_ACTIVE_SUNO_ACCOUNT'});
    if(!response||!response.ok||!response.account)throw new Error(response&&response.message||'Could not read the current Suno account identity.');
    var account=response.account;var returnedUserId=normalizeIdentityPart(account.userId);var returnedHandle=normalizeIdentityHandle(account.handle);
    if(entry.userId&&returnedUserId&&String(entry.userId)!==returnedUserId)throw new Error('The active Suno tab is signed into a different account. Select that account Vault or switch Suno accounts first.');
    if(entry.userId&&!returnedUserId)throw new Error('Suno identity could not be verified by stable user ID. No identity data was changed.');
    if(!entry.userId&&returnedUserId){var oldHandle=normalizeIdentityHandle(entry.handle).toLowerCase();if(oldHandle&&returnedHandle&&oldHandle!==returnedHandle.toLowerCase())throw new Error('This legacy Vault has no stable user ID and the active handle differs, so the rename cannot be verified safely.');}
    var previous={handle:entry.handle,displayName:entry.displayName,userId:entry.userId};var oldKey=entry.key;
    observeVaultIdentity(entry,account,'manual-update');if(!entry.userId&&returnedUserId)entry.userId=returnedUserId;
    var newKey=entry.userId?'uid:'+entry.userId:oldKey;if(newKey!==oldKey){delete state.vaultRegistry[oldKey];entry.key=newKey;state.activeVaultKey=newKey;}
    state.vaultRegistry[entry.key]=entry;var affected=await syncOwnedTracksToVaultIdentity(entry,previous);await saveVaultRegistry();if(activeDbName()===entry.dbName)await refresh();renderVaultNavigation();
    return {changed:!sameIdentitySnapshot(previous,entry),affected:affected,entry:entry};
  }

  async function ensureLocalPrivateVault(){
    var key='local:private';
    var entry=state.vaultRegistry[key];
    if(!entry){
      entry={key:key,dbName:'graph1ks_private_vault_local',userId:null,handle:null,displayName:null,createdAt:nowIso(),updatedAt:nowIso(),migratedV413:true,identityHistory:[]};
      state.vaultRegistry[key]=entry;
      await saveVaultRegistry();
    }
    state.activeVaultKey=key;
    await saveVaultRegistry();
    await openDb(entry.dbName).then(function(db){db.close();});
    await ensurePrivateGenreMap(entry);
    return entry;
  }

  function clearActiveRecordState(){
    state.records=[];state.recordById=new Map();state.selectedId=null;state.selectedFull=null;state.selectedIds.clear();
    state.contentCache.clear();state.genreMap=new Map();state.genreIdentityMap=new Map();state.canonicalMap=new Map();state.majorSelection.clear();state.subgenreSelection.clear();state.randomViewIds=null;state.randomViewMeta=null;
    invalidateView(true);invalidateGenreStats();renderAll();renderVaultNavigation();
  }

  async function switchDataset(mode,key){
    if(state.dbManagerOpen)dbmOpen(false);
    state.dbManagerPreview=null;state.dbmPatchLoaded=null;state.dbmNormalizationGroups=[];
    state.activeDataset=mode==='private'?'private':'public';
    try{localStorage.setItem('graph1ks_last_vault_dataset',state.activeDataset);}catch(_){}
    state.selectedId=null;state.selectedFull=null;state.selectedIds.clear();state.contentCache.clear();state.randomViewIds=null;state.randomViewMeta=null;
    if(isPrivateDataset()){
      await loadVaultRegistry();
      if(key&&state.vaultRegistry[key])state.activeVaultKey=key;
      var keys=Object.keys(state.vaultRegistry);
      if(!state.activeVaultKey&&keys.length){
        var accountKey=keys.find(function(k){var e=state.vaultRegistry[k];return e&&(e.userId||e.handle||e.displayName);});
        state.activeVaultKey=accountKey||keys[0];
      }
      var entry=activeVaultEntry();
      if(!entry)entry=await ensureLocalPrivateVault();
      else await saveVaultRegistry();
      await openDb(entry.dbName).then(function(db){db.close();});
      await migrateLegacyVault(entry);
      await ensurePrivateGenreMap(entry);
    }
    await refresh();
    renderVaultNavigation();
  }

  function renderVaultNavigation(){
    var isPrivate=isPrivateDataset();
    var pub=$('#publicVaultTab'),priv=$('#privateVaultTab');
    if(pub)pub.classList.toggle('active',!isPrivate);
    if(priv)priv.classList.toggle('active',isPrivate);
    var controls=$('#privateVaultControls');
    if(controls)controls.classList.toggle('hidden',!isPrivate);
    var keys=Object.keys(state.vaultRegistry).sort(function(a,b){
      return String(state.vaultRegistry[b].updatedAt||'').localeCompare(String(state.vaultRegistry[a].updatedAt||''));
    });
    var select=$('#privateVaultSelect');
    if(select){
      var accountKeys=keys.filter(function(k){var e=state.vaultRegistry[k];return e&&(e.userId||e.handle||e.displayName);});
      select.innerHTML=accountKeys.map(function(k){var e=state.vaultRegistry[k];return '<option value="'+esc(k)+'" '+(k===state.activeVaultKey?'selected':'')+'>'+esc(privateVaultArtistLabel(e,true))+'</option>';}).join('');
      select.disabled=accountKeys.length<2;
      select.classList.toggle('hidden',!isPrivate||accountKeys.length<2);
    }
    var entry=activeVaultEntry();
    var identityWrap=$('#privateIdentityWrap'),identityCurrent=$('#privateIdentityCurrent'),identityHistory=$('#privateIdentityHistory'),identityUpdate=$('#privateIdentityUpdateBtn');
    var identityAvailable=isPrivate&&entry&&entry.key!=='local:private'&&(entry.handle||entry.displayName);
    if(identityWrap)identityWrap.classList.toggle('hidden',!identityAvailable);
    if(identityCurrent){var identityLabel=identityAvailable?((entry.displayName||('@'+entry.handle))+(entry.handle?' · @'+entry.handle:'')):'No Suno identity';identityCurrent.textContent=identityLabel;identityCurrent.href=identityAvailable&&entry.handle?'https://suno.com/@'+encodeURIComponent(entry.handle):'#';}
    if(identityHistory){var history=identityAvailable?ensureVaultIdentityHistory(entry).slice().reverse():[];identityHistory.innerHTML='<div class="identityHistoryHead">SUNO IDENTITY HISTORY · READ-ONLY</div>'+(history.length?history.map(function(item,index){var name=String(item.displayName||'—');var h=item.handle?'@'+item.handle:'—';var range=(item.firstSeen||'unknown')+(item.lastSeen&&item.lastSeen!==item.firstSeen?' → '+item.lastSeen:'');return '<div class="identityHistoryRow '+(index===0?'current':'')+'"><strong>'+esc(name)+'</strong><span>'+esc(h)+'</span><small>'+esc(range)+(index===0?' · CURRENT':'')+'</small></div>';}).join(''):'<div class="identityHistoryRow"><small>No identity history recorded yet.</small></div>');}
    if(identityUpdate)identityUpdate.disabled=!identityAvailable||!state.sunoContextActive;
    var info=$('#activeVaultInfo');
    if(info){
      if(!isPrivate)info.textContent='PUBLIC VAULT · established reference database · '+state.records.length+' tracks';
      else if(entry)info.textContent=(entry.handle?'@'+entry.handle+' · ':'')+(entry.userId||'local identity')+' · '+state.records.length+' tracks';
      else info.textContent='PRIVATE VAULT · no Suno account Vault yet — press R on Suno to create one';
    }
    var editorBtn=$('#vaultEditorBtn');if(editorBtn)editorBtn.disabled=!isPrivate;
    if(!isPrivate&&state.vaultEditorOpen)closeVaultEditor();
    var retrieve=$('#retrieveActiveBtn');if(retrieve)retrieve.disabled=!state.sunoContextActive;
    var importBtn=$('#importDbBtn'),exportBtn=$('#exportDbBtn'),deleteBtn=$('#deleteDbBtn'),restoreBtn=$('#restorePublicVaultBtn');
    if(importBtn)importBtn.textContent='Import '+(isPrivate?'PRIVATE':'PUBLIC')+' Vault DB';
    if(exportBtn)exportBtn.textContent='Export '+(isPrivate?'PRIVATE':'PUBLIC')+' Vault DB';
    if(deleteBtn&&state.deleteDbStage===0)deleteBtn.textContent='Delete '+(isPrivate?'PRIVATE':'PUBLIC')+' Vault Data';
    if(restoreBtn&&state.restorePublicStage===0)restoreBtn.textContent='Restore Factory PUBLIC Vault';
    var aHead=$('#artistColumnHead'),sHead=$('#songColumnHead'),sunHead=$('#sunoSettingsColumnHead');
    if(aHead)aHead.textContent=isPrivate?'Artist':'Reference Artist';
    if(sHead)sHead.textContent=isPrivate?'Suno Song':'Reference Song';
    if(sunHead)sunHead.textContent=isPrivate?'Suno Settings':'Suno Settings';
    var dbm=$('#dbmManagerStats');
    if(dbm&&state.dbManagerOpen){syncDbmProtectedFields();dbm.textContent=activeVaultLabel()+' · '+state.records.length+' tracks · '+state.canonicalMap.size+' canonical spellings';}
  }

  function showRetrieveTitleModal(record,entry){
    state.pendingRetrieve={record:record,entryKey:entry.key};
    var modal=$('#retrieveTitleModal');
    var input=$('#retrieveTitleInput');
    input.value='';
    $('#retrieveTitleSaveBtn').disabled=true;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden','false');
    setTimeout(function(){input.focus();},40);
  }

  function hideRetrieveTitleModal(){
    state.pendingRetrieve=null;
    var modal=$('#retrieveTitleModal');
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden','true');
    $('#retrieveTitleInput').value='';
    $('#retrieveTitleSaveBtn').disabled=true;
  }

  async function handleRetrievedRecord(record){
    if(!record||typeof record!=='object')return {ok:false,message:'Retrieved Suno record was empty.'};
    var account=record.currentAccount||(record.pageType==='create'?record.owner:null);
    if(!account||(!account.userId&&!account.handle))return {ok:false,message:'Could not identify the signed-in Suno account, so no Private Vault was chosen.'};
    var entry=await ensureVaultForAccount(account);
    var title=String(record.title||record.name||'').trim();
    if(!title){showRetrieveTitleModal(record,entry);return {ok:true,needsTitle:true,vaultName:privateVaultArtistLabel(entry,true)};}
    var saved=await storeRetrievedRecord(entry,record);
    toast('Retrieved to '+privateVaultArtistLabel(entry,true),saved.title+(saved.artist_handle?' · @'+saved.artist_handle:''));
    return {ok:true,saved:true,needsTitle:false,vaultName:privateVaultArtistLabel(entry,true),title:saved.title,id:saved.id};
  }

  async function importDatabase(file){
    if(isPrivateDataset()&&!activeVaultEntry())await ensureLocalPrivateVault();
    setImportStatus('Reading '+file.name+' into '+activeVaultLabel()+'…','working');
    var json=await readJsonFile(file,'Database import');
    setImportStatus('Parsing JSON…','working');
    var arr=unwrapTrackArray(json);
    var max=await maxTrackId();
    var addedIndexes=[];
    var chunkSize=300;

    for(var startIndex=0;startIndex<arr.length;startIndex+=chunkSize){
      var rawChunk=arr.slice(startIndex,startIndex+chunkSize);
      var fullChunk=[];

      rawChunk.forEach(function(x,offset){
        var globalIndex=startIndex+offset;
        try{
          var normalized=applyCanonicalTrack(normalizeTrack(x));
          normalized.id=++max;
          fullChunk.push(normalized);
          addedIndexes.push(toIndexRecord(normalized));
        }catch(error){
          throw new Error('Entry '+(globalIndex+1)+': '+error.message);
        }
      });

      await putFullChunk(fullChunk);
      setImportStatus('Importing… '+Math.min(startIndex+fullChunk.length,arr.length)+' / '+arr.length+' tracks','working');
      await yieldUi();
    }

    state.records=state.records.concat(addedIndexes).sort(function(a,b){return Number(a.id)-Number(b.id);});
    rebuildRecordMap();
    invalidateView(true);
    invalidateGenreStats();
    renderAll();

    var relation=relationshipSummary();
    setImportStatus(
      'Imported '+addedIndexes.length+' tracks. IDs continued through #'+max+'.\n'+
      'Fast metadata index updated; heavy prompts remain in IndexedDB until needed.\n'+
      'Current DB: '+relation.mappedTracks+' mapped / '+relation.unmappedTracks+' unmapped tracks.',
      'ok'
    );
  }

  function buildGenreExport(){
    var stats=genreStats();
    var countByIdentity=new Map();
    stats.collected.forEach(function(g){countByIdentity.set(genreIdentity(g.genre),g.count||0);});

    var rows=Array.from(state.genreMap.values()).map(function(row){
      return {
        genre:String(row.genre||''),
        track_count:countByIdentity.get(genreIdentity(row.genre))||0,
        major_genres:mappingMajors(row)
      };
    }).sort(function(a,b){return a.genre.localeCompare(b.genre);});

    return {
      schema:'graph1ks-genre-map-v2',
      taxonomy:'GRAPH1KS_24',
      taxonomy_version:state.genreTaxonomyVersion||FACTORY_TAXONOMY_VERSION,
      generated_at:nowIso(),
      major_genres:MAJOR_GENRES.slice(),
      genres:rows
    };
  }

  function genreMapRawRows(json){
    if(!json||typeof json!=='object')throw new Error('Genre-map JSON must be an object.');
    if(Array.isArray(json.mappings))return json.mappings;
    if(Array.isArray(json.genres))return json.genres;
    if(json.mappings&&typeof json.mappings==='object'){
      return Object.entries(json.mappings).map(function(pair){
        return {genre:pair[0],major_genres:Array.isArray(pair[1])?pair[1]:[pair[1]]};
      });
    }
    throw new Error('Expected mappings[] or genres[] in genre-map JSON.');
  }

  function parseGenreMap(json,options){
    options=options||{};
    var raw=genreMapRawRows(json);
    var rows=[];
    var errors=[];
    var exactKeys=new Set();
    var identityKeys=new Map();

    raw.forEach(function(item,i){
      var genre=String(item&& (item.genre||item.subgenre) ||'').trim();
      if(!genre){errors.push('Row '+(i+1)+': missing genre');return;}

      var requested=[];
      if(Array.isArray(item.major_genres))requested=requested.concat(item.major_genres);
      if(item.major_genre!=null&&String(item.major_genre).trim())requested.push(item.major_genre);
      if(item.major!=null&&String(item.major).trim())requested.push(item.major);
      if(item.parent_genre!=null&&String(item.parent_genre).trim())requested.push(item.parent_genre);
      requested=requested.map(function(x){return String(x==null?'':x).trim();}).filter(Boolean);

      // Legacy export rows with no relationship remain ignorable in non-strict
      // parsing, but a full taxonomy replacement must never contain them.
      if(!requested.length){
        if(options.requireRelationships)errors.push('Row '+(i+1)+': "'+genre+'" has no Major Genre relationship');
        return;
      }

      var majors=[];
      requested.forEach(function(value){
        var major=canonicalMajor(value);
        if(!major){
          errors.push('Row '+(i+1)+': invalid major genre "'+value+'" for "'+genre+'"');
          return;
        }
        if(!majors.includes(major))majors.push(major);
      });
      if(!majors.length)return;
      if(majors.length>3){
        errors.push('Row '+(i+1)+': "'+genre+'" has '+majors.length+' Major Genres; maximum supported is 3');
        return;
      }

      var exact=normKey(genre);
      if(exactKeys.has(exact)){
        errors.push('Row '+(i+1)+': duplicate genre "'+genre+'"');
        return;
      }
      exactKeys.add(exact);

      var identity=genreIdentity(genre);
      var previousIdentity=identityKeys.get(identity);
      if(previousIdentity&&previousIdentity!==genre){
        errors.push('Row '+(i+1)+': canonical collision "'+previousIdentity+'" / "'+genre+'"');
        return;
      }
      identityKeys.set(identity,genre);

      rows.push({
        genre_key:exact,
        genre:genre,
        major_genres:majors,
        major_genre:majors[0],
        taxonomy_version:Number(json.taxonomy_version)||0,
        taxonomy:String(json.taxonomy||''),
        updated_at:nowIso()
      });
    });

    if(errors.length){
      throw new Error(errors.slice(0,18).join('\n')+(errors.length>18?'\n…':''));
    }
    return rows;
  }

  function validateFullGenreTaxonomyPayload(json){
    if(!json||typeof json!=='object'||Array.isArray(json))throw new Error('Genre taxonomy must be a JSON object.');
    if(String(json.schema||'')!=='graph1ks-genre-map-v2')throw new Error('Genre taxonomy schema must be "graph1ks-genre-map-v2".');
    if(String(json.taxonomy||'')!=='GRAPH1KS_24')throw new Error('Genre taxonomy must declare taxonomy "GRAPH1KS_24".');
    var version=Number(json.taxonomy_version);
    if(!Number.isInteger(version)||version<1)throw new Error('Genre taxonomy needs a positive integer taxonomy_version.');
    if(version<FACTORY_TAXONOMY_VERSION)throw new Error('Genre taxonomy v'+version+' is older than the bundled v'+FACTORY_TAXONOMY_VERSION+' taxonomy and cannot replace it.');
    if(!Array.isArray(json.major_genres))throw new Error('Genre taxonomy needs major_genres[].');

    var provided=json.major_genres.map(function(x){return canonicalMajor(x);});
    if(provided.some(function(x){return !x;})||provided.length!==MAJOR_GENRES.length){
      throw new Error('major_genres[] must contain the complete GRAPH1KS 24 list exactly once.');
    }
    var unique=new Set(provided);
    if(unique.size!==MAJOR_GENRES.length||MAJOR_GENRES.some(function(m){return !unique.has(m);})){
      throw new Error('major_genres[] does not match the fixed GRAPH1KS 24 taxonomy.');
    }

    var rows=parseGenreMap(json,{requireRelationships:true});
    if(rows.length<MAJOR_GENRES.length)throw new Error('Genre taxonomy is too small to safely replace the active map.');

    var represented=new Set();
    rows.forEach(function(row){mappingMajors(row).forEach(function(m){represented.add(m);});});
    var missing=MAJOR_GENRES.filter(function(m){return !represented.has(m);});
    if(missing.length)throw new Error('Genre taxonomy does not represent all 24 Major Genres. Missing: '+missing.join(', '));

    return {rows:rows,version:version,genreCount:rows.length};
  }

  function genreMapFingerprint(rows){
    return (rows||[]).map(function(row){
      return genreIdentity(row&&row.genre)+'='+mappingMajors(row).slice().sort().join('|');
    }).sort().join('\n');
  }

  async function replaceGenreMapVerified(rows,dbName){
    var before=await mapAll(dbName).catch(function(){return [];});
    var expected=genreMapFingerprint(rows);
    await replaceMappingsAtomic(rows,dbName);
    var stored=await mapAll(dbName);
    if(stored.length!==rows.length||genreMapFingerprint(stored)!==expected){
      // IndexedDB transaction should already be atomic, but restore the previous
      // map if a post-write integrity check ever fails.
      await replaceMappingsAtomic(before,dbName).catch(function(){});
      throw new Error('Genre map post-write verification failed; previous map was restored.');
    }
    return stored;
  }

  async function importGenreMap(file){
    var json=await readJsonFile(file,'Genre Map import');
    var checked=validateFullGenreTaxonomyPayload(json);
    var rows=checked.rows;

    // The import is a taxonomy replacement, never an additive merge. The full
    // file is parsed and validated before the first existing mapping is touched.
    await replaceGenreMapVerified(rows,activeDbName());

    state.genreMap=new Map(rows.map(function(row){return [row.genre_key,row];}));
    rebuildGenreIdentityMap();
    state.genreTaxonomyVersion=checked.version;
    invalidateView(true);
    invalidateGenreStats();
    renderAll();

    var relation=relationshipSummary();
    setImportStatus(
      'Genre taxonomy replaced safely: v'+checked.version+' · '+rows.length+' canonical Subgenres.\n'+
      'Preflight verified schema, all 24 Major Genres, unique canonical identities and 1–3 Major relationships per Subgenre.\n'+
      'Track records were not rewritten; separator variants resolve through canonical identity matching.\n'+
      'Current DB: '+relation.mappedTracks+' mapped / '+relation.unmappedTracks+' unmapped tracks across '+
      relation.mappedGenres+' mapped / '+relation.unmappedGenres+' unmapped collected genres.',
      'ok'
    );
  }

  function factoryAssetUrl(relativePath){
    return chrome.runtime.getURL(relativePath);
  }

  function bytesAreGzip(bytes){
    return !!(bytes&&bytes.length>=2&&bytes[0]===0x1f&&bytes[1]===0x8b);
  }

  async function decodeJsonBytes(buffer,label){
    var bytes=new Uint8Array(buffer);
    var text='';
    if(bytesAreGzip(bytes)){
      if(typeof DecompressionStream!=='function'){
        throw new Error((label||'JSON')+' is gzip-compressed, but this browser does not support native gzip decompression. Chrome 116+ is required.');
      }
      try{
        var stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        text=await new Response(stream).text();
      }catch(error){
        throw new Error('Could not decompress '+(label||'JSON')+': '+error.message);
      }
    }else{
      text=new TextDecoder('utf-8').decode(bytes);
    }
    try{return JSON.parse(text);}
    catch(error){throw new Error((label||'JSON')+' is not valid JSON: '+error.message);}
  }

  async function readJsonFile(file,label){
    if(!file)throw new Error('No JSON file selected.');
    return decodeJsonBytes(await file.arrayBuffer(),label||file.name||'JSON file');
  }

  async function fetchFactoryJson(relativePath,label){
    var response=await fetch(factoryAssetUrl(relativePath),{cache:'no-store'});
    if(!response.ok)throw new Error('Bundled '+label+' could not be read (HTTP '+response.status+').');
    return decodeJsonBytes(await response.arrayBuffer(),'Bundled '+label);
  }

  function prepareFactoryTracks(json){
    var arr=unwrapTrackArray(json);
    if(!arr.length)throw new Error('Bundled Public Vault contains no tracks.');
    var seen=new Set();
    return arr.map(function(raw,index){
      var normalized=normalizeTrack(raw);
      var source=raw&&raw.source&&typeof raw.source==='object'?raw.source:raw;
      var id=Number(raw&&raw.id!=null?raw.id:(source&&source.id));
      if(!Number.isInteger(id)||id<1)throw new Error('Factory track '+(index+1)+' has an invalid id.');
      if(seen.has(id))throw new Error('Bundled Public Vault contains duplicate track id #'+id+'.');
      seen.add(id);
      normalized.id=id;
      return normalized;
    }).sort(function(a,b){return Number(a.id)-Number(b.id);});
  }

  function setFactorySeedMarker(mode,trackCount,mappingCount){
    localStorage.setItem(FACTORY_SEED_KEY,JSON.stringify({
      release:FACTORY_RELEASE,
      mode:mode,
      tracks:Number(trackCount)||0,
      mappings:Number(mappingCount)||0,
      at:nowIso()
    }));
  }

  async function loadBundledGenreTaxonomyRows(){
    var payload=await fetchFactoryJson(FACTORY_GENRE_ASSET,'Genre Map');
    return validateFullGenreTaxonomyPayload(payload).rows;
  }

  async function ensureBundledGenreTaxonomy(dbName,options){
    options=options||{};
    var markerKey=FACTORY_TAXONOMY_MARKER_PREFIX+String(dbName||PUBLIC_DB_NAME);
    var marker='';
    try{marker=localStorage.getItem(markerKey)||'';}catch(_){}
    if(marker===String(FACTORY_TAXONOMY_VERSION)&&options.force!==true)return {updated:false,version:FACTORY_TAXONOMY_VERSION};
    var rows=await loadBundledGenreTaxonomyRows();
    if(options.replace===true)await replaceGenreMapVerified(rows,dbName);
    else await putMappings(rows,dbName);
    try{localStorage.setItem(markerKey,String(FACTORY_TAXONOMY_VERSION));}catch(_){}
    if(dbName===PUBLIC_DB_NAME)state.publicGenreVocabulary=null;
    return {updated:true,version:FACTORY_TAXONOMY_VERSION,mappings:rows.length};
  }

  async function restoreFactoryPublicVault(options){
    options=options||{};
    var quiet=options.quiet===true;
    if(!quiet)setImportStatus('Loading bundled GRAPH1KS Public Vault + Genre Map…','working');

    // Parse and validate both assets completely before clearing any user data.
    var payloads=await Promise.all([
      fetchFactoryJson(FACTORY_PUBLIC_ASSET,'Public Vault'),
      fetchFactoryJson(FACTORY_GENRE_ASSET,'Genre Map')
    ]);
    var tracks=prepareFactoryTracks(payloads[0]);
    var mappings=validateFullGenreTaxonomyPayload(payloads[1]).rows;
    if(!mappings.length)throw new Error('Bundled Genre Map contains no usable mappings.');

    if(!quiet)setImportStatus('Factory assets verified · restoring '+tracks.length+' tracks…','working');
    await clearTracks(PUBLIC_DB_NAME);
    await clearGenreMappings(PUBLIC_DB_NAME);

    var chunkSize=300;
    for(var start=0;start<tracks.length;start+=chunkSize){
      var chunk=tracks.slice(start,start+chunkSize);
      await putFullChunk(chunk,PUBLIC_DB_NAME);
      if(!quiet)setImportStatus('Restoring Public Vault… '+Math.min(start+chunk.length,tracks.length)+' / '+tracks.length,'working');
      await yieldUi();
    }
    await putMappings(mappings,PUBLIC_DB_NAME);
    setFactorySeedMarker(options.mode||'manual-restore',tracks.length,mappings.length);

    if(!isPrivateDataset()){
      state.selectedId=null;
      state.selectedFull=null;
      state.selectedIds.clear();
      state.randomViewIds=null;
      state.randomViewMeta=null;
      await refresh();
    }

    if(!quiet)setImportStatus('Factory Public Vault restored · '+tracks.length+' tracks · '+mappings.length+' genre mappings. Private Vaults were not changed.','ok');
    return {tracks:tracks.length,mappings:mappings.length};
  }

  async function migrateAllRegisteredGenreTaxonomies(){
    var dbNames=new Set([PUBLIC_DB_NAME]);
    Object.keys(state.vaultRegistry||{}).forEach(function(key){
      var entry=state.vaultRegistry[key];
      if(entry&&entry.dbName)dbNames.add(entry.dbName);
    });
    for(const dbName of dbNames){
      await ensureBundledGenreTaxonomy(dbName,{replace:true}).catch(function(error){
        console.warn('GRAPH1KS taxonomy migration failed for '+dbName,error);
      });
      await yieldUi();
    }
  }

  async function maybeSeedFactoryPublicVault(){
    if(localStorage.getItem(FACTORY_SEED_KEY))return {seeded:false,reason:'marker'};
    var count=await storeCount(TRACK_INDEX_STORE,PUBLIC_DB_NAME);
    if(count>0){
      // Existing users keep their Public Vault exactly as-is. The marker also
      // prevents a later deletion from silently triggering a factory reinstall.
      setFactorySeedMarker('existing-public-vault',count,await storeCount(GENRE_MAP_STORE,PUBLIC_DB_NAME));
      return {seeded:false,reason:'existing'};
    }
    var result=await restoreFactoryPublicVault({quiet:false,mode:'first-install'});
    return {seeded:true,result:result};
  }

  async function syncFeedbackConfig(){
    var response=await chrome.runtime.sendMessage({
      type:'SET_FEEDBACK_CONFIG',
      config:{
        sound:state.soundFeedback,
        radial:state.radialFeedback,
        fillHotkey:state.fillHotkeyEnabled,
        retrieveHotkey:state.retrieveHotkeyEnabled
      }
    });

    if(response&&response.ok&&response.config){
      state.soundFeedback=response.config.sound!==false;
      state.radialFeedback=response.config.radial!==false;
      state.fillHotkeyEnabled=response.config.fillHotkey!==false;
      state.retrieveHotkeyEnabled=response.config.retrieveHotkey!==false;
    }

    return response;
  }

  async function syncAutoFillConfig(){
    var response=await chrome.runtime.sendMessage({
      type:'SET_AUTO_FILL_CONFIG',
      config:{
        enabled:state.autoFillEnabled,
        seconds:state.autoFillSeconds
      }
    });

    if(response&&response.ok&&response.config){
      state.autoFillEnabled=response.config.enabled===true;
      state.autoFillSeconds=Math.max(1,Math.min(99,Number.parseInt(response.config.seconds,10)||8));
    }

    return response;
  }

  async function applyAutoActionsForRecord(recordId,nextId){
    var meta=state.recordById.get(Number(recordId));
    if(!meta)return {ok:false,message:'Filled track no longer exists in the database.'};

    var actions=[];

    if(state.autoUsedAfterAutofill&&!meta.used){
      var updated=Object.assign({},meta,{used:true});
      await putIndexRecord(updated);
      replaceIndexRecord(updated);
      if(state.selectedFull&&state.selectedFull.id===meta.id)state.selectedFull.used=true;
      invalidateView(false);
      actions.push('Used ✓');
    }

    if(state.autoNextAfterAutofill){
      if(nextId==null){
        return {ok:true,actions:actions,hasNext:false,message:'No next visible track.'};
      }
      await selectTrack(nextId,{followAuto:true,smooth:true});
      actions.push('Next #'+nextId);
    }

    return {ok:true,actions:actions,hasNext:nextId!=null,nextId:nextId};
  }

  async function completeAutoFillPostClick(){
    if(!state.sunoContextActive){state.autoFillPending=null;return {ok:false,message:'Suno must be the active browser tab.'};}
    var pending=state.autoFillPending;
    if(!pending)return {ok:false,message:'No verified Auto Fill is waiting for a click.'};

    if(!state.autoFillEnabled||!state.autoUsedAfterAutofill||!state.autoNextAfterAutofill){
      state.autoFillPending=null;
      return {ok:false,message:'AUTO FILL requires AUTO USED and AUTO NEXT to remain enabled.'};
    }

    state.autoFillPending=null;
    var result=await applyAutoActionsForRecord(pending.recordId,pending.nextId);
    renderTable();renderStats();renderInspector();
    if(result.ok){
      toast('Auto Fill click accepted',result.actions&&result.actions.length?result.actions.join(' · '):result.message||'Ready.');
    }
    return result;
  }

  async function runAutofill(options){
    options=options||{};
    if(!state.sunoContextActive&&!options.directTarget){toast('Suno inactive','Make Suno the active browser tab first.');return {ok:false,message:'Suno must be the active browser tab.'};}
    var meta=Number.isFinite(Number(options.recordId))?state.recordById.get(Number(options.recordId)):selectedRecord();
    if(!meta||state.autofilling)return;
    var r=selectedFullRecord()||await getFullTrack(meta.id);
    if(!r)return;
    state.selectedFull=r;

    if(!options.skipAutoActions&&(options.deferAutoActions||state.autoNextAfterAutofill)){
      followTrackNearTop(r.id,{smooth:true});
    }

    var vis=visibleRecords();
    var idx=vis.findIndex(function(x){return x.id===r.id;});
    var nextId=idx>=0&&idx<vis.length-1?vis[idx+1].id:null;

    state.autofilling=true;
    state.autofillError=null;
    renderInspector();

    try{
      var result=await chrome.runtime.sendMessage({type:'AUTOFILL_TRACK',track:clone(r),recordId:r.id,sourceTabId:Number.isInteger(options.sourceTabId)?options.sourceTabId:state.sunoTabId,directTarget:options.directTarget===true,fillMoreOptions:state.fillMoreOptionsEnabled===true});
      if(!result||!result.ok){
        state.autofillError=result&&result.diagnosticText?result.diagnosticText:JSON.stringify(result||{message:'No response'},null,2);
        toast('Autofill stopped',result&&result.message?result.message:'Autofill failed.');
        return {ok:false,message:result&&result.message?result.message:'Autofill failed.',diagnosticText:state.autofillError};
      }else{
        state.autofillError=null;

        if(options.deferAutoActions){
          if(!state.autoFillEnabled||!state.autoUsedAfterAutofill||!state.autoNextAfterAutofill){
            state.autoFillPending=null;
            return {ok:false,message:'AUTO FILL was disabled while Autofill was running.'};
          }
          state.autoFillPending={recordId:r.id,nextId:nextId};
          toast('Auto Fill verified','Click once in Suno to apply AUTO USED + AUTO NEXT and start the next countdown.');
          return {ok:true,recordId:r.id,nextId:nextId,deferred:true};
        }

        if(options.skipAutoActions){
          toast('Direct fill complete','Song was inserted into Suno and verified.');
          return {ok:true,recordId:r.id,nextId:nextId,deferred:false,direct:true};
        }
        var actionResult=await applyAutoActionsForRecord(r.id,nextId);
        var autoActions=actionResult.actions||[];
        toast('Autofill verified',autoActions.length?'Suno verified · '+autoActions.join(' · '):'Suno fields were filled and verified.');
        return {ok:true,recordId:r.id,nextId:nextId,deferred:false};
      }
    }catch(e){
      state.autofillError=String(e.stack||e.message||e);
      toast('Autofill failed',e.message||String(e));
      return {ok:false,message:e.message||String(e),diagnosticText:state.autofillError};
    }finally{
      state.autofilling=false;
      renderTable();
      renderStats();
      renderInspector();
    }
  }

  function showVaultDirectFillIndicator(x,y,label,kind){
    var node=document.getElementById('vaultDirectFillIndicator');
    if(!node){
      node=document.createElement('div');
      node.id='vaultDirectFillIndicator';
      document.body.appendChild(node);
    }
    node.className='vaultDirectFillIndicator '+String(kind||'triggered');
    node.textContent=String(label||'DBL ✓');
    var px=Number.isFinite(Number(x))?Number(x)+14:18;
    var py=Number.isFinite(Number(y))?Number(y)+14:18;
    node.style.left=Math.max(8,px)+'px';
    node.style.top=Math.max(8,py)+'px';
    node.hidden=false;
    if(vaultDirectClick.indicatorTimer)clearTimeout(vaultDirectClick.indicatorTimer);
    vaultDirectClick.indicatorTimer=setTimeout(function(){
      var live=document.getElementById('vaultDirectFillIndicator');
      if(live)live.hidden=true;
    },1200);
    return node;
  }

  function updateVaultDirectFillIndicator(label,kind){
    var node=document.getElementById('vaultDirectFillIndicator');
    if(!node)return;
    node.className='vaultDirectFillIndicator '+String(kind||'triggered');
    node.textContent=String(label||'DBL ✓');
    node.hidden=false;
    if(vaultDirectClick.indicatorTimer)clearTimeout(vaultDirectClick.indicatorTimer);
    vaultDirectClick.indicatorTimer=setTimeout(function(){
      var live=document.getElementById('vaultDirectFillIndicator');
      if(live)live.hidden=true;
    },1200);
  }

  async function triggerVaultDirectFill(id,x,y){
    id=Number(id);
    if(!Number.isFinite(id))return {ok:false,message:'Invalid track id.'};
    if(vaultDirectClick.inFlight||state.autofilling){
      showVaultDirectFillIndicator(x,y,'FILL …','busy');
      return {ok:false,message:'Another fill is already running.'};
    }
    var meta=state.recordById.get(id);
    if(!meta)return {ok:false,message:'Track not found.'};

    vaultDirectClick.inFlight=true;
    vaultDirectClick.lastTriggeredId=id;
    vaultDirectClick.lastTriggeredAt=Date.now();
    showVaultDirectFillIndicator(x,y,'DBL ✓ · FILL','triggered');
    toast('Double-click detected','Direct fill started for “'+String(meta.title||('Track #'+id))+'”.');

    try{
      await selectTrack(id);
      var result=await runAutofill({
        recordId:id,
        skipAutoActions:true,
        directTarget:true,
        sourceTabId:Number.isInteger(state.sunoTabId)?state.sunoTabId:null
      });
      if(result&&result.ok)updateVaultDirectFillIndicator('SUNO ✓','success');
      else updateVaultDirectFillIndicator('FILL ×','error');
      return result||{ok:false,message:'Direct fill returned no result.'};
    }catch(error){
      updateVaultDirectFillIndicator('FILL ×','error');
      toast('Direct Fill failed',error.message||String(error));
      return {ok:false,message:error.message||String(error)};
    }finally{
      vaultDirectClick.inFlight=false;
    }
  }

  async function saveEdited(){
    var r=selectedFullRecord();
    if(!r)return;
    var updated=clone(r);
    $$('[data-field]',$('#inspector')).forEach(function(el){updated[el.dataset.field]=el.value;});
    updated.bpm=Number(updated.bpm);
    updated.year=Number(updated.year);
    MULTILINE_FIELDS.forEach(function(k){updated[k]=normalizeMultiline(updated[k]);});
    if(isPrivateDataset()&&String(updated.genre||'')!==String(r.genre||'')){
      updated.genre_source='manual';
      updated.genre_matched_text='';
    }

    await putFullRecord(updated);
    replaceIndexRecord(updated);
    state.selectedFull=updated;
    state.editUnlocked=false;
    invalidateView(true);
    invalidateGenreStats();
    renderAll();
    toast('Saved','Track #'+updated.id+' updated.');
  }

  async function setSelectedUsed(desired){
    var ids=new Set(state.selectedIds);
    if(!ids.size)return;
    var changed=[];

    state.records.forEach(function(r){
      if(ids.has(r.id)&&r.used!==desired){
        var updated=Object.assign({},r,{used:desired,used_flag:desired?1:0});
        changed.push(updated);
        replaceIndexRecord(updated);
      }
    });

    if(changed.length)await putIndexMany(changed);
    invalidateView(false);
    renderTable();
    renderStats();
    renderInspector();
    toast(desired?'Marked used':'Marked unused',changed.length+' tracks updated.');
  }

  async function setSelectedFavorite(desired){
    var ids=new Set(state.selectedIds);
    if(!ids.size)return;

    var changed=[];

    state.records.forEach(function(r){
      if(ids.has(r.id)&&r.favorite!==desired){
        var updated=Object.assign({},r,{
          favorite:desired,
          favorite_flag:desired?1:0
        });
        changed.push(updated);
        replaceIndexRecord(updated);
      }
    });

    if(changed.length)await putIndexMany(changed);

    invalidateView(false);
    renderTable();
    renderStats();
    renderInspector();

    toast(
      desired?'Favorited':'Unfavorited',
      changed.length+' tracks updated.'
    );
  }

  async function setTrackUsed(id,desired){
    var r=state.recordById.get(Number(id));
    if(!r)return;
    var updated=Object.assign({},r,{used:!!desired,used_flag:desired?1:0});
    await putIndexRecord(updated);
    replaceIndexRecord(updated);
    invalidateView(false);
    renderTable();
    renderStats();
    renderInspector();
  }

  async function setTrackFavorite(id,desired){
    var r=state.recordById.get(Number(id));
    if(!r)return;
    var updated=Object.assign({},r,{favorite:!!desired,favorite_flag:desired?1:0});
    await putIndexRecord(updated);
    replaceIndexRecord(updated);
    invalidateView(false);
    renderTable();
    renderStats();
    renderInspector();
  }


  // ---------------------------------------------------------------------------
  // DATABASE MANAGER
  // ---------------------------------------------------------------------------

  function dbmSetStatus(text,kind){
    var el=$('#dbmStatus');
    if(!el)return;
    el.textContent=uiText(text||'');
    el.dataset.kind=kind||'';
  }

  function dbmSetTab(tab){
    state.dbManagerTab=tab;
    $$('.dbmTab').forEach(function(btn){
      btn.classList.toggle('active',btn.dataset.dbmTab===tab);
    });
    $$('.dbmPane').forEach(function(pane){pane.classList.remove('active');});
    var target=$('#dbm'+tab.charAt(0).toUpperCase()+tab.slice(1)+'Pane');
    if(target)target.classList.add('active');
    if(tab==='history')dbmRenderHistoryRules().catch(function(error){dbmSetStatus(error.message||String(error),'error');});
  }

  function syncDbmProtectedFields(){
    var privateMode=isPrivateDataset();
    ['#dbmField','#dbmNormalizeField'].forEach(function(selector){var select=$(selector);if(!select)return;Array.from(select.options).forEach(function(option){var locked=privateMode&&PRIVATE_PROVENANCE_FIELDS.has(option.value);option.disabled=locked;option.hidden=locked;});if(privateMode&&PRIVATE_PROVENANCE_FIELDS.has(select.value)){var first=select.querySelector('option:not(:disabled)');select.value=first?first.value:'genre';}});
  }

  function dbmOpen(open){
    if(!open&&state.dbManagerApplying){
      dbmSetStatus('Database operation is running. Cancel it first or wait for completion.','warning');
      return;
    }
    state.dbManagerOpen=!!open;
    if(state.dbManagerOpen){
      var genrePicker=$('#genrePicker');
      if(genrePicker)genrePicker.classList.add('hidden');
    }
    var panel=$('#dbManager');
    panel.classList.toggle('hidden',!state.dbManagerOpen);
    deckRoot.classList.toggle('managerMode',state.dbManagerOpen);
    $('#dbmManagerStats').textContent=
      activeVaultLabel()+' · '+state.records.length+' tracks · '+
      state.canonicalMap.size+' canonical spellings';
    if(state.dbManagerOpen){
      syncDbmProtectedFields();
      dbmSetTab(state.dbManagerTab||'replace');
      dbmRenderPreview();
    }
  }

  function dbmScopeRecords(scope){
    if(scope==='visible')return visibleRecords().slice();

    if(scope==='selected'){
      var ids=state.selectedIds;
      return state.records.filter(function(r){return ids.has(r.id);});
    }

    if(scope==='used')return state.records.filter(function(r){return r.used;});
    if(scope==='unused')return state.records.filter(function(r){return !r.used;});
    if(scope==='favorite')return state.records.filter(function(r){return r.favorite;});

    return state.records.slice();
  }

  async function dbmReadFieldRows(field,scope){
    var meta=DBM_FIELDS[field];
    if(!meta)throw new Error('Unknown database field: '+field);
    assertPrivateFieldEditable(field);

    var indexRows=dbmScopeRecords(scope);
    if(!indexRows.length)return [];

    if(meta.store==='index'){
      return indexRows.map(function(r){
        return {
          id:Number(r.id),
          title:r.title,
          value:r[field]
        };
      });
    }

    var ids=indexRows.map(function(r){return Number(r.id);});
    var contents;

    if(scope==='all'&&ids.length>2500){
      contents=await getAllContentRecords();
    }else{
      contents=await getContentRecordsByIds(ids);
    }

    var allowed=new Set(ids);
    return contents
      .filter(function(c){return allowed.has(Number(c.id));})
      .map(function(c){
        var metaRec=state.recordById.get(Number(c.id));
        return {
          id:Number(c.id),
          title:metaRec?metaRec.title:'',
          value:c[field]==null?'':c[field]
        };
      });
  }

  function dbmValueText(value,type){
    if(type==='boolean')return value?'true':'false';
    return String(value==null?'':value);
  }

  function dbmCoerceValue(field,value){
    var meta=DBM_FIELDS[field];
    if(!meta)return value;

    if(meta.type==='number'){
      var n=Number(String(value).trim());
      if(!Number.isFinite(n))throw new Error(meta.label+' replacement must be a number.');
      return n;
    }

    if(meta.type==='boolean'){
      var k=String(value).trim().toLowerCase();
      if(['true','1','yes','used','favorite','on'].includes(k))return true;
      if(['false','0','no','unused','unfavorite','off',''].includes(k))return false;
      throw new Error(meta.label+' replacement must be true/false.');
    }

    return String(value==null?'':value);
  }

  function dbmEscapeRegex(v){
    return String(v).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  }

  function dbmBuildMatcher(config){
    var find=String(config.find==null?'':config.find);
    var mode=config.matchMode;
    var sensitive=!!config.caseSensitive;

    if(mode==='regex'){
      var flags=sensitive?'g':'gi';
      var regex;
      try{regex=new RegExp(find,flags);}catch(error){
        throw new Error('Invalid regular expression: '+error.message);
      }
      return {
        test:function(value){
          regex.lastIndex=0;
          return regex.test(value);
        },
        replace:function(value,replacement){
          regex.lastIndex=0;
          return value.replace(regex,replacement);
        }
      };
    }

    if(mode==='exact'){
      return {
        test:function(value){return value===find;},
        replace:function(){return config.replace;}
      };
    }

    if(mode==='exact_ci'){
      var fk=find.toLocaleLowerCase();
      return {
        test:function(value){return value.toLocaleLowerCase()===fk;},
        replace:function(){return config.replace;}
      };
    }

    var needle=sensitive?find:find.toLocaleLowerCase();

    function indexOfNeedle(value){
      var hay=sensitive?value:value.toLocaleLowerCase();
      if(mode==='starts')return hay.startsWith(needle)?0:-1;
      if(mode==='ends'){
        return hay.endsWith(needle)?Math.max(0,value.length-find.length):-1;
      }
      return hay.indexOf(needle);
    }

    return {
      test:function(value){return indexOfNeedle(value)>=0;},
      replace:function(value,replacement){
        if(find==='')return value;
        if(mode==='starts'){
          var i=indexOfNeedle(value);
          return i===0?replacement+value.slice(find.length):value;
        }
        if(mode==='ends'){
          var j=indexOfNeedle(value);
          return j>=0?value.slice(0,j)+replacement:value;
        }
        var flags=sensitive?'g':'gi';
        return value.replace(new RegExp(dbmEscapeRegex(find),flags),replacement);
      }
    };
  }

  function dbmComputeReplacement(oldValue,config){
    var meta=DBM_FIELDS[config.field];
    var oldText=dbmValueText(oldValue,meta.type);
    var matcher=dbmBuildMatcher(config);
    if(!matcher.test(oldText))return {matched:false,value:oldValue};

    var replacement=String(config.replace==null?'':config.replace);
    var nextText;

    if(config.replaceMode==='clear'){
      nextText='';
    }else if(config.replaceMode==='prepend'){
      nextText=replacement+oldText;
    }else if(config.replaceMode==='append'){
      nextText=oldText+replacement;
    }else if(config.replaceMode==='matched'){
      nextText=matcher.replace(oldText,replacement);
    }else{
      nextText=replacement;
    }

    var coerced=dbmCoerceValue(config.field,nextText);
    var same=meta.type==='text'
      ? String(coerced)===String(oldValue==null?'':oldValue)
      : coerced===oldValue;

    return {
      matched:true,
      changed:!same,
      value:coerced
    };
  }

  function dbmGetReplaceConfig(){
    return {
      operation:'replace',
      field:$('#dbmField').value,
      scope:$('#dbmScope').value,
      matchMode:$('#dbmMatchMode').value,
      replaceMode:$('#dbmReplaceMode').value,
      find:$('#dbmFind').value,
      replace:$('#dbmReplace').value,
      caseSensitive:$('#dbmCaseSensitive').checked,
      moveGenreRelationships:$('#dbmMoveGenreRelationships').checked,
      rememberCanonical:$('#dbmRememberCanonical').checked
    };
  }

  function dbmDescribeConfig(config){
    var field=DBM_FIELDS[config.field]?DBM_FIELDS[config.field].label:config.field;
    if(config.operation==='normalize')return 'Normalize '+field;
    if(config.operation==='patch')return 'Patch '+field+' · '+String(config.matchBy||'id');
    return field+': "'+String(config.find).slice(0,60)+'" → "'+String(config.replace).slice(0,60)+'"';
  }

  function dbmPatchFieldAlias(value){
    var key=String(value||'').trim().toLowerCase();
    var aliases={
      arrangement:'instrumental_arrangement',lyrics:'instrumental_arrangement',instrumental_arrangement:'instrumental_arrangement',
      creation_date:'created_at',created_at:'created_at',artist:'artist_name',artist_name:'artist_name',
      styles:'structured_prompt',style_prompt:'structured_prompt',structured_prompt:'structured_prompt',
      exclude:'negative_prompt',negative:'negative_prompt',negative_prompt:'negative_prompt'
    };
    return aliases[key]||key;
  }

  function dbmPatchValue(update,field){
    if(Object.prototype.hasOwnProperty.call(update,'value'))return update.value;
    if(Object.prototype.hasOwnProperty.call(update,field))return update[field];
    if(update.fields&&Object.prototype.hasOwnProperty.call(update.fields,field))return update.fields[field];
    var aliases={instrumental_arrangement:['arrangement','lyrics'],structured_prompt:['styles','style_prompt'],negative_prompt:['exclude','negative']};
    var list=aliases[field]||[];
    for(var i=0;i<list.length;i++){
      if(Object.prototype.hasOwnProperty.call(update,list[i]))return update[list[i]];
      if(update.fields&&Object.prototype.hasOwnProperty.call(update.fields,list[i]))return update.fields[list[i]];
    }
    return undefined;
  }

  async function dbmLoadPatchJson(json,fileName){
    if(!json||typeof json!=='object')throw new Error('Patch JSON must be an object.');
    var field=dbmPatchFieldAlias(json.field||(Array.isArray(json.fields)&&json.fields.length===1?json.fields[0]:''));
    var updates=Array.isArray(json.updates)?json.updates:(Array.isArray(json.records)?json.records:(Array.isArray(json.tracks)?json.tracks:null));
    if(!updates)throw new Error('Patch JSON needs an updates[], records[] or tracks[] array.');
    if(!field){
      var candidates=new Set();
      updates.slice(0,20).forEach(function(update){
        Object.keys(update||{}).forEach(function(k){var f=dbmPatchFieldAlias(k);if(DBM_FIELDS[f])candidates.add(f);});
        Object.keys(update&&update.fields||{}).forEach(function(k){var f=dbmPatchFieldAlias(k);if(DBM_FIELDS[f])candidates.add(f);});
      });
      if(candidates.size===1)field=Array.from(candidates)[0];
    }
    if(!DBM_FIELDS[field])throw new Error('Patch field is missing or unsupported. Use one DB field such as instrumental_arrangement.');
    assertPrivateFieldEditable(field);
    var matchBy=String(json.match_by||json.matchBy||'id').trim().toLowerCase();
    if(matchBy==='suno_song_id'||matchBy==='suno-song-id')matchBy='suno_song_id';
    else matchBy='id';
    if(matchBy==='suno_song_id'&&!isPrivateDataset())throw new Error('suno_song_id matching is available in a Private Vault. Public Vault patches should match by id.');

    var rows=await dbmReadFieldRows(field,'all');
    var beforeById=new Map(rows.map(function(row){return [Number(row.id),row];}));
    var bySong=new Map();
    if(matchBy==='suno_song_id')state.records.forEach(function(r){if(r.suno_song_id)bySong.set(String(r.suno_song_id),r);});
    var changes=[];
    var missing=[];
    var invalid=[];

    updates.forEach(function(update,index){
      if(!update||typeof update!=='object'){invalid.push(index+1);return;}
      var meta=null;
      if(matchBy==='id')meta=state.recordById.get(Number(update.id));
      else meta=bySong.get(String(update.suno_song_id||update.sunoSongId||''));
      if(!meta){missing.push(matchBy==='id'?String(update.id):String(update.suno_song_id||update.sunoSongId||''));return;}
      var next=dbmPatchValue(update,field);
      if(next===undefined){invalid.push(index+1);return;}
      try{next=dbmCoerceValue(field,next);}catch(error){invalid.push((index+1)+': '+error.message);return;}
      if(DBM_FIELDS[field].store==='content')next=normalizeMultiline(next);
      var row=beforeById.get(Number(meta.id));
      var before=row?row.value:'';
      var same=DBM_FIELDS[field].type==='text'?String(before==null?'':before)===String(next==null?'':next):before===next;
      if(!same)changes.push({id:Number(meta.id),title:meta.title,before:before,after:next});
    });

    state.dbmPatchLoaded={fileName:fileName||'patch.json',field:field,matchBy:matchBy,updates:updates.length,missing:missing,invalid:invalid};
    state.dbManagerPreview={
      operation:'patch',field:field,store:DBM_FIELDS[field].store,
      config:{operation:'patch',field:field,matchBy:matchBy,fileName:fileName||'patch.json',moveGenreRelationships:false,rememberCanonical:false},
      scanned:updates.length,changes:changes,created_at:nowIso()
    };
    $('#dbmPatchSummary').textContent=
      (fileName||'patch.json')+'\n'+
      'Field: '+DBM_FIELDS[field].label+' · Match: '+matchBy+'\n'+
      updates.length+' update row(s) · '+changes.length+' actual change(s) · '+missing.length+' unmatched · '+invalid.length+' invalid'+
      (missing.length?'\nUnmatched: '+missing.slice(0,8).join(', ')+(missing.length>8?' …':''):'')+
      (invalid.length?'\nInvalid rows: '+invalid.slice(0,8).join(', ')+(invalid.length>8?' …':''):'');
    dbmRenderPreview();
    dbmSetStatus(changes.length?'Patch loaded. Review the dry-run preview before applying.':'Patch loaded; no values would change.',changes.length?'ok':'');
  }

  function dbmClearLoadedPatch(){
    state.dbmPatchLoaded=null;
    $('#dbmPatchSummary').textContent='No patch loaded.';
    if(state.dbManagerPreview&&state.dbManagerPreview.operation==='patch')dbmClearPreview('Patch cleared.');
  }

  function dbmClearPreview(message,force){
    if(state.dbManagerApplying&&!force)return;
    state.dbManagerPreview=null;
    $('#dbmApplyBtn').disabled=true;
    $('#dbmCancelBtn').disabled=true;
    $('#dbmPreviewSummary').textContent=message||'No preview calculated.';
    $('#dbmPreviewTableWrap').innerHTML='<div class="dbmEmpty">Run a preview before applying any database change.</div>';
    $('#dbmProgressWrap').classList.add('hidden');
    dbmSetStatus('');
  }

  function dbmRenderPreview(){
    var preview=state.dbManagerPreview;
    var wrap=$('#dbmPreviewTableWrap');

    if(!preview){
      dbmClearPreview(null,true);
      return;
    }

    $('#dbmPreviewSummary').textContent=
      preview.changes.length+' changes · '+
      preview.scanned+' records scanned · '+
      DBM_FIELDS[preview.field].label;

    $('#dbmApplyBtn').disabled=!preview.changes.length||state.dbManagerApplying;

    var rows=preview.changes.slice(0,250);
    var html='<table class="dbmPreviewTable"><thead><tr><th>ID</th><th>Track</th><th>Before</th><th>After</th></tr></thead><tbody>';

    rows.forEach(function(change){
      html+='<tr>'+
        '<td>#'+change.id+'</td>'+
        '<td>'+esc(change.title||'')+'</td>'+
        '<td><div class="dbmClip">'+esc(dbmValueText(change.before,DBM_FIELDS[preview.field].type))+'</div></td>'+
        '<td><div class="dbmClip after">'+esc(dbmValueText(change.after,DBM_FIELDS[preview.field].type))+'</div></td>'+
      '</tr>';
    });

    html+='</tbody></table>';

    if(preview.changes.length>rows.length){
      html+='<div class="dbmPreviewMore">Showing first '+rows.length+' of '+preview.changes.length+' changes.</div>';
    }

    if(preview.field==='genre'&&preview.changes.length){
      var pairs=new Map();
      preview.changes.forEach(function(c){
        var key=normKey(c.before)+'→'+normKey(c.after);
        if(!pairs.has(key))pairs.set(key,{before:c.before,after:c.after});
      });
      html+='<div class="dbmRelationshipNote">'+
        '<strong>Genre relationships:</strong> '+
        (preview.config.moveGenreRelationships
          ? 'Major Genre mappings will be merged/moved for '+pairs.size+' rename pair(s).'
          : 'Track genres will change; Major Genre mapping rows will not be modified.')+
      '</div>';
    }

    wrap.innerHTML=html;
  }

  async function dbmPreviewReplace(){
    var config=dbmGetReplaceConfig();

    if(config.replaceMode!=='clear'&&config.matchMode!=='regex'&&String(config.find)===''){
      throw new Error('Enter a Find value.');
    }
    if(config.matchMode==='regex'&&String(config.find)===''){
      throw new Error('Enter a regular expression.');
    }

    dbmSetStatus('Scanning database…','working');
    var rows=await dbmReadFieldRows(config.field,config.scope);
    var changes=[];

    rows.forEach(function(row){
      var result=dbmComputeReplacement(row.value,config);
      if(result.matched&&result.changed){
        changes.push({
          id:row.id,
          title:row.title,
          before:row.value,
          after:result.value
        });
      }
    });

    state.dbManagerPreview={
      operation:'replace',
      field:config.field,
      store:DBM_FIELDS[config.field].store,
      config:config,
      scanned:rows.length,
      changes:changes,
      created_at:nowIso()
    };

    dbmRenderPreview();
    dbmSetStatus(
      changes.length
        ? 'Dry run complete. Nothing has been written yet.'
        : 'Dry run complete. No values would change.',
      changes.length?'ok':''
    );
  }

  async function dbmAnalyzeValues(){
    var field=$('#dbmField').value;
    var meta=DBM_FIELDS[field];

    if(meta.store==='content'){
      $('#dbmDistinctSummary').textContent='Heavy text fields are previewed directly; distinct-value browsing is disabled.';
      $('#dbmDistinctList').innerHTML='<div class="dbmEmpty">Use PREVIEW CHANGES for heavy prompt / arrangement fields.</div>';
      return;
    }

    dbmSetStatus('Analyzing distinct values…','working');
    var rows=await dbmReadFieldRows(field,$('#dbmScope').value);
    var counts=new Map();

    rows.forEach(function(row){
      var value=dbmValueText(row.value,meta.type);
      counts.set(value,(counts.get(value)||0)+1);
    });

    var values=Array.from(counts.entries()).map(function(pair){
      return {value:pair[0],count:pair[1]};
    }).sort(function(a,b){
      return b.count-a.count||a.value.localeCompare(b.value);
    });

    $('#dbmDistinctSummary').textContent=
      values.length+' distinct values across '+rows.length+' tracks';

    var list=$('#dbmDistinctList');
    list.innerHTML='';

    values.slice(0,1000).forEach(function(item){
      var row=document.createElement('button');
      row.type='button';
      row.className='dbmValueRow';
      row.dataset.value=item.value;
      row.innerHTML=
        '<span>'+esc(item.value||'(blank)')+'</span>'+
        '<strong>'+item.count+'</strong>';
      list.appendChild(row);
    });

    if(values.length>1000){
      var note=document.createElement('div');
      note.className='dbmPreviewMore';
      note.textContent='Showing first 1000 of '+values.length+' distinct values.';
      list.appendChild(note);
    }

    dbmSetStatus('Value analysis complete. Click a value to use it as Find.','ok');
  }

  function dbmAnalyzeVariantGroups(){
    var field=$('#dbmNormalizeField').value;
    assertPrivateFieldEditable(field);
    var scope=$('#dbmNormalizeScope').value;
    var rows=dbmScopeRecords(scope);
    var exactCounts=new Map();

    rows.forEach(function(r){
      var value=String(r[field]==null?'':r[field]);
      if(!value.trim())return;
      exactCounts.set(value,(exactCounts.get(value)||0)+1);
    });

    var grouped=new Map();

    exactCounts.forEach(function(count,value){
      var key=dbmVariantKey(value);
      if(!grouped.has(key))grouped.set(key,[]);
      grouped.get(key).push({value:value,count:count});
    });

    var groups=[];

    grouped.forEach(function(variants,key){
      variants.sort(function(a,b){return b.count-a.count||a.value.localeCompare(b.value);});
      var canonical=dbmSuggestCanonical(field,variants);
      var total=variants.reduce(function(sum,v){return sum+v.count;},0);
      var storedCanonical=state.canonicalMap.get(field+'|'+key);
      var builtInCanonical=dbmBuiltInCanonical(field,key);
      var soleGenreNormalization=
        field==='genre' &&
        variants.length===1 &&
        variants[0].value!==canonical;

      if(variants.length>1||storedCanonical||builtInCanonical||soleGenreNormalization){
        groups.push({
          key:key,
          field:field,
          variants:variants,
          canonical:canonical,
          count:total,
          selected:true
        });
      }
    });

    groups.sort(function(a,b){return b.count-a.count||a.canonical.localeCompare(b.canonical);});
    state.dbmNormalizationGroups=groups;
    dbmRenderVariantGroups();
    dbmSetStatus(
      groups.length
        ? groups.length+' safe normalization group(s) found.'
        : 'No safe case/whitespace variants found.',
      groups.length?'ok':''
    );
  }

  function dbmRenderVariantGroups(){
    var wrap=$('#dbmVariantGroups');
    var groups=state.dbmNormalizationGroups||[];

    if(!groups.length){
      wrap.innerHTML='<div class="dbmEmpty">No variant groups to review.</div>';
      return;
    }

    wrap.innerHTML='';

    groups.forEach(function(group,index){
      var row=document.createElement('div');
      row.className='dbmVariantGroup';
      row.dataset.groupIndex=index;

      var variants=group.variants.map(function(v){
        return '<span>'+esc(v.value)+' <b>'+v.count+'</b></span>';
      }).join('');

      row.innerHTML=
        '<label class="dbmVariantCheck"><input type="checkbox" class="dbmVariantSelect" '+(group.selected?'checked':'')+'></label>'+
        '<div class="dbmVariantSource"><strong>'+group.count+' tracks</strong><div>'+variants+'</div></div>'+
        '<div class="dbmVariantArrow">→</div>'+
        '<label class="dbmCanonicalInput">Canonical<input type="text" value="'+esc(group.canonical)+'"></label>';

      wrap.appendChild(row);
    });
  }

  function dbmCollectNormalizationSelection(){
    var field=$('#dbmNormalizeField').value;
    var groups=[];

    $$('.dbmVariantGroup').forEach(function(row){
      var index=Number(row.dataset.groupIndex);
      var group=state.dbmNormalizationGroups[index];
      if(!group||!row.querySelector('.dbmVariantSelect').checked)return;

      var canonical=dbmWhitespace(row.querySelector('.dbmCanonicalInput input').value);
      if(!canonical)return;

      groups.push({
        key:group.key,
        field:field,
        variants:group.variants,
        canonical:canonical,
        count:group.count
      });
    });

    return groups;
  }

  async function dbmPreviewNormalization(){
    var field=$('#dbmNormalizeField').value;
    assertPrivateFieldEditable(field);
    var scope=$('#dbmNormalizeScope').value;
    var groups=dbmCollectNormalizationSelection();

    if(!groups.length)throw new Error('Select at least one normalization group.');

    var canonicalByKey=new Map(groups.map(function(g){return [g.key,g.canonical];}));
    var rows=await dbmReadFieldRows(field,scope);
    var changes=[];

    rows.forEach(function(row){
      var old=String(row.value==null?'':row.value);
      var canonical=canonicalByKey.get(dbmVariantKey(old));
      if(canonical!=null&&old!==canonical){
        changes.push({
          id:row.id,
          title:row.title,
          before:row.value,
          after:canonical
        });
      }
    });

    var canonicalRows=groups.map(function(group){
      return {
        key:dbmCanonicalKey(field,group.canonical),
        field:field,
        norm_key:group.key,
        canonical:group.canonical,
        updated_at:nowIso()
      };
    });

    // The canonical key is based on the normalized variant key, not the
    // chosen capitalization.
    canonicalRows.forEach(function(row,index){
      row.key=field+'|'+groups[index].key;
    });

    state.dbManagerPreview={
      operation:'normalize',
      field:field,
      store:'index',
      config:{
        operation:'normalize',
        field:field,
        scope:scope,
        moveGenreRelationships:field==='genre'
      },
      scanned:rows.length,
      changes:changes,
      canonicalRows:canonicalRows,
      created_at:nowIso()
    };

    dbmRenderPreview();
    dbmSetStatus(
      changes.length
        ? 'Normalization dry run complete. Canonical spellings will also be remembered for future imports.'
        : 'No records need normalization.',
      changes.length?'ok':''
    );
  }

  function dbmCanonicalSnapshots(rows){
    return (rows||[]).map(function(row){
      return {
        key:row.key,
        before:state.canonicalMap.has(row.key)?clone(state.canonicalMap.get(row.key)):null
      };
    });
  }

  async function dbmRestoreCanonicalSnapshots(snapshots){
    if(!snapshots||!snapshots.length)return;
    var keys=snapshots.map(function(s){return s.key;});
    await withTx([DBM_CANONICAL_STORE],'readwrite',function(tx){
      var os=tx.objectStore(DBM_CANONICAL_STORE);
      keys.forEach(function(key){os.delete(key);});
      snapshots.forEach(function(s){if(s.before)os.put(s.before);});
    });

    snapshots.forEach(function(s){
      if(s.before)state.canonicalMap.set(s.key,s.before);
      else state.canonicalMap.delete(s.key);
    });
  }

  function dbmGenrePairs(changes){
    var map=new Map();

    (changes||[]).forEach(function(c){
      var before=String(c.before==null?'':c.before).trim();
      var after=String(c.after==null?'':c.after).trim();
      if(!before||!after||before===after)return;

      var key=before+'→'+after;
      if(!map.has(key))map.set(key,{before:before,after:after});
    });

    return Array.from(map.values());
  }

  function dbmGenreMapSnapshots(pairs){
    var keys=new Set();

    (pairs||[]).forEach(function(pair){
      keys.add(normKey(pair.before));
      keys.add(normKey(pair.after));
    });

    return Array.from(keys).map(function(key){
      return {
        key:key,
        before:state.genreMap.has(key)?clone(state.genreMap.get(key)):null
      };
    });
  }

  async function dbmApplyGenreRelationships(pairs,deleteSource){
    if(!pairs||!pairs.length)return [];

    var snapshots=dbmGenreMapSnapshots(pairs);
    var puts=new Map();
    var deletes=new Set();

    pairs.forEach(function(pair){
      var oldKey=normKey(pair.before);
      var newKey=normKey(pair.after);
      if(!oldKey||!newKey)return;

      var source=state.genreMap.get(oldKey);
      var target=state.genreMap.get(newKey);
      var majors=[];

      mappingMajors(target).concat(mappingMajors(source)).forEach(function(major){
        if(!majors.includes(major))majors.push(major);
      });

      if(majors.length){
        puts.set(newKey,{
          genre_key:newKey,
          genre:pair.after,
          major_genres:majors,
          major_genre:majors[0],
          updated_at:nowIso()
        });
      }

      if(deleteSource&&oldKey!==newKey)deletes.add(oldKey);
    });

    if(deletes.size)await deleteMappings(Array.from(deletes));
    if(puts.size)await putMappings(Array.from(puts.values()));

    deletes.forEach(function(key){state.genreMap.delete(key);});
    puts.forEach(function(row,key){state.genreMap.set(key,row);});

    invalidateGenreStats();
    return snapshots;
  }

  async function dbmRestoreGenreSnapshots(snapshots){
    if(!snapshots||!snapshots.length)return;

    var keys=snapshots.map(function(s){return s.key;});
    await deleteMappings(keys);

    var rows=snapshots.filter(function(s){return !!s.before;}).map(function(s){return s.before;});
    if(rows.length)await putMappings(rows);

    snapshots.forEach(function(s){
      if(s.before)state.genreMap.set(s.key,s.before);
      else state.genreMap.delete(s.key);
    });

    invalidateGenreStats();
  }

  async function dbmWriteIndexChunk(changes,field,valueKey){
    valueKey=valueKey||'after';
    var updates=[];

    changes.forEach(function(change){
      var current=state.recordById.get(Number(change.id));
      if(!current)return;

      var updated=Object.assign({},current);
      updated[field]=dbmCoerceValue(field,change[valueKey]);

      if(field==='used')updated.used_flag=updated.used?1:0;
      if(field==='favorite')updated.favorite_flag=updated.favorite?1:0;
      if(field==='genre'){updated.genre_key=normKey(updated.genre);if(isPrivateDataset()){updated.genre_source='manual';updated.genre_matched_text='';}}

      updates.push(updated);
    });

    if(updates.length)await putIndexMany(updates);
    updates.forEach(replaceIndexRecord);
  }

  async function dbmApplyPreview(){
    var preview=state.dbManagerPreview;
    if(!preview||!preview.changes.length||state.dbManagerApplying)return;
    assertPrivateFieldEditable(preview.field);

    state.dbManagerApplying=true;
    state.dbManagerCancel=false;
    $('#dbmApplyBtn').disabled=true;
    $('#dbmCancelBtn').disabled=false;
    $('#dbmProgressWrap').classList.remove('hidden');

    var changes=preview.changes;
    var applied=[];
    var chunkSize=250;
    var progress=$('#dbmProgress');
    var progressText=$('#dbmProgressText');
    progress.max=changes.length;
    progress.value=0;

    dbmSetStatus('Applying previewed changes…','working');

    var mapSnapshots=[];
    var canonicalSnapshots=[];

    try{
      for(var i=0;i<changes.length;i+=chunkSize){
        if(state.dbManagerCancel)break;

        var chunk=changes.slice(i,i+chunkSize);

        if(preview.store==='content'){
          await updateContentFieldBatch(chunk,preview.field,'after');
        }else{
          await dbmWriteIndexChunk(chunk,preview.field,'after');
        }

        applied=applied.concat(chunk);
        progress.value=applied.length;
        progressText.textContent=applied.length+' / '+changes.length;
        await yieldUi();
      }

      var completed=applied.length===changes.length;

      if(preview.field==='genre'&&preview.config.moveGenreRelationships&&applied.length){
        mapSnapshots=await dbmApplyGenreRelationships(
          dbmGenrePairs(applied),
          completed
        );
      }

      var canonicalRowsToStore=[];

      if(preview.operation==='normalize'&&completed&&preview.canonicalRows&&preview.canonicalRows.length){
        canonicalRowsToStore=preview.canonicalRows.slice();
      }else if(
        preview.operation==='replace' &&
        completed &&
        preview.config.rememberCanonical &&
        DBM_CANONICAL_FIELDS.includes(preview.field) &&
        ['exact','exact_ci'].includes(preview.config.matchMode) &&
        preview.config.replaceMode==='whole' &&
        String(preview.config.find).trim() &&
        String(preview.config.replace).trim()
      ){
        canonicalRowsToStore=[{
          key:preview.field+'|'+dbmVariantKey(preview.config.find),
          field:preview.field,
          norm_key:dbmVariantKey(preview.config.find),
          canonical:dbmWhitespace(preview.config.replace),
          updated_at:nowIso()
        }];
      }

      if(canonicalRowsToStore.length){
        canonicalSnapshots=dbmCanonicalSnapshots(canonicalRowsToStore);
        await putCanonicalRows(canonicalRowsToStore);
      }

      if(applied.length){
        await dbmHistoryAdd({
          created_at:nowIso(),
          label:dbmDescribeConfig(preview.config),
          operation:preview.operation,
          field:preview.field,
          store:preview.store,
          affected_count:applied.length,
          changes:applied.map(function(c){
            return {id:c.id,before:c.before};
          }),
          map_before:mapSnapshots,
          canonical_before:canonicalSnapshots,
          complete:completed
        });
        await dbmHistoryTrim();
      }

      if(preview.store==='content'&&state.selectedId){
        var selectedChange=applied.find(function(c){return c.id===state.selectedId;});
        if(selectedChange&&state.selectedFull)state.selectedFull[preview.field]=selectedChange.after;
      }

      invalidateView(false);
      if(preview.field==='genre')invalidateGenreStats();
      renderAll();

      state.dbManagerPreview=null;
      dbmRenderPreview();

      dbmSetStatus(
        state.dbManagerCancel
          ? 'Cancelled after '+applied.length+' changes. Applied chunks were recorded in Undo History.'
          : 'Applied '+applied.length+' changes successfully.',
        state.dbManagerCancel?'warning':'ok'
      );

      if(preview.operation==='normalize'){
        await dbmRenderHistoryRules();
        dbmAnalyzeVariantGroups();
      }
    }catch(error){
      dbmSetStatus('DATABASE MANAGER ERROR: '+(error.message||String(error)),'error');
      throw error;
    }finally{
      state.dbManagerApplying=false;
      $('#dbmCancelBtn').disabled=true;
      $('#dbmProgressWrap').classList.add('hidden');
      $('#dbmManagerStats').textContent=
        activeVaultLabel()+' · '+state.records.length+' tracks · '+
        state.canonicalMap.size+' canonical spellings';
    }
  }

  async function dbmUndoHistory(id){
    var rows=await dbmHistoryAll();
    var item=rows.find(function(row){return Number(row.id)===Number(id);});
    if(!item)return;
    assertPrivateFieldEditable(item.field);

    dbmSetStatus('Undoing '+item.affected_count+' changes…','working');

    var changes=(item.changes||[]).map(function(c){
      return {id:Number(c.id),before:c.before};
    });

    for(var i=0;i<changes.length;i+=250){
      var chunk=changes.slice(i,i+250);
      if(item.store==='content'){
        await updateContentFieldBatch(chunk,item.field,'before');
      }else{
        await dbmWriteIndexChunk(chunk,item.field,'before');
      }
      await yieldUi();
    }

    if(item.map_before&&item.map_before.length){
      await dbmRestoreGenreSnapshots(item.map_before);
    }

    if(item.canonical_before&&item.canonical_before.length){
      await dbmRestoreCanonicalSnapshots(item.canonical_before);
    }

    await dbmHistoryDelete(item.id);

    if(item.store==='content'&&state.selectedId){
      state.selectedFull=await getFullTrack(state.selectedId);
    }

    invalidateView(false);
    if(item.field==='genre')invalidateGenreStats();
    renderAll();
    await dbmRenderHistoryRules();

    dbmSetStatus('Undo complete: '+item.label,'ok');
  }

  async function dbmSaveCurrentRule(){
    var config=dbmGetReplaceConfig();

    if(String(config.find)===''&&config.replaceMode!=='clear'){
      throw new Error('Enter a Find value before saving a rule.');
    }

    await dbmRuleAdd({
      created_at:nowIso(),
      name:dbmDescribeConfig(config),
      field:config.field,
      matchMode:config.matchMode,
      replaceMode:config.replaceMode,
      find:config.find,
      replace:config.replace,
      caseSensitive:config.caseSensitive,
      moveGenreRelationships:config.moveGenreRelationships,
      rememberCanonical:config.rememberCanonical,
      scope:'all'
    });

    await dbmRenderHistoryRules();
    dbmSetStatus('Cleanup rule saved.','ok');
  }

  function dbmLoadRule(rule){
    $('#dbmField').value=rule.field||'genre';
    $('#dbmScope').value=rule.scope||'all';
    $('#dbmMatchMode').value=rule.matchMode||'exact_ci';
    $('#dbmReplaceMode').value=rule.replaceMode||'whole';
    $('#dbmFind').value=rule.find||'';
    $('#dbmReplace').value=rule.replace||'';
    $('#dbmCaseSensitive').checked=!!rule.caseSensitive;
    $('#dbmMoveGenreRelationships').checked=rule.moveGenreRelationships!==false;
    $('#dbmRememberCanonical').checked=rule.rememberCanonical!==false;
    dbmSetTab('replace');
    dbmClearPreview('Loaded rule. Preview it before applying.');
    dbmSetStatus('Rule loaded into Replace / Merge.','ok');
  }

  async function dbmRenderHistoryRules(){
    var history=await dbmHistoryAll();
    var rules=await dbmRulesAll();

    var historyWrap=$('#dbmHistoryList');
    var rulesWrap=$('#dbmRulesList');

    historyWrap.innerHTML='';
    rulesWrap.innerHTML='';

    if(!history.length){
      historyWrap.innerHTML='<div class="dbmEmpty">No reversible manager operations yet.</div>';
    }else{
      history.forEach(function(item){
        var row=document.createElement('div');
        row.className='dbmHistoryRow';
        row.dataset.historyId=item.id;
        row.innerHTML=
          '<div><strong>'+esc(item.label||item.field)+'</strong>'+
          '<span>'+esc(item.created_at||'')+' · '+Number(item.affected_count||0)+' tracks'+(item.complete===false?' · partial':'')+'</span></div>'+
          '<button class="dbmUndoBtn">UNDO</button>';
        historyWrap.appendChild(row);
      });
    }

    if(!rules.length){
      rulesWrap.innerHTML='<div class="dbmEmpty">No saved cleanup rules.</div>';
    }else{
      rules.forEach(function(rule){
        var row=document.createElement('div');
        row.className='dbmRuleRow';
        row.dataset.ruleId=rule.id;
        row.innerHTML=
          '<div><strong>'+esc(rule.name||rule.field)+'</strong>'+
          '<span>'+esc(DBM_FIELDS[rule.field]?DBM_FIELDS[rule.field].label:rule.field)+' · '+esc(rule.matchMode||'')+'</span></div>'+
          '<div><button class="dbmLoadRuleBtn">LOAD</button><button class="dbmDeleteRuleBtn dangerGhost">DELETE</button></div>';
        rulesWrap.appendChild(row);
      });
    }
  }

  async function dbmExportRules(){
    var rules=await dbmRulesAll();
    downloadJson({
      schema:'graph1ks-db-manager-rules-v1',
      version:APP_VERSION,
      exported_at:nowIso(),
      rules:rules.map(function(rule){
        var copy=clone(rule);
        delete copy.id;
        return copy;
      })
    },'GRAPH1KS_DB_MANAGER_RULES_'+new Date().toISOString().slice(0,10)+'.json');
  }

  async function dbmImportRules(file){
    var json=await readJsonFile(file,'Database Manager rules');
    var rules=Array.isArray(json)?json:json.rules;
    if(!Array.isArray(rules))throw new Error('Rules JSON must contain a rules[] array.');

    var imported=0;
    for(var i=0;i<rules.length;i++){
      var rule=rules[i];
      if(!rule||!DBM_FIELDS[rule.field])continue;
      await dbmRuleAdd(rule);
      imported++;
    }

    await dbmRenderHistoryRules();
    dbmSetStatus('Imported '+imported+' cleanup rules.','ok');
  }

  function requestTopmostFromOverlay(){
    return new Promise(function(resolve,reject){
      if(window.top===window){reject(new Error('Overlay host context is unavailable.'));return;}
      var requestId='g1-topmost-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
      var finished=false;
      var timer=setTimeout(function(){finish(new Error('Always-on-Top request timed out.'));},5000);
      function finish(error,result){
        if(finished)return;
        finished=true;
        clearTimeout(timer);
        window.removeEventListener('message',onMessage);
        if(error)reject(error);else resolve(result||{ok:true});
      }
      function onMessage(event){
        if(event.source!==window.parent)return;
        var data=event.data;
        if(!data||data.type!=='GRAPH1KS_TOPMOST_RESULT'||data.requestId!==requestId)return;
        if(data.ok===true)finish(null,data);
        else finish(new Error(data.error||'Always-on-Top could not be opened.'));
      }
      window.addEventListener('message',onMessage);
      // postMessage remains in the direct click path so the top-level Suno
      // context can consume the same transient user activation.
      window.parent.postMessage({type:'GRAPH1KS_TOPMOST_REQUEST',requestId:requestId},'*');
    });
  }

  async function toggleTopmost(){
    // There is deliberately only one Always-on-Top implementation: the
    // top-level Suno page owns Document Picture-in-Picture. A standalone
    // extension popup cannot safely create a second PiP window-of-a-window.
    if(DECK_SURFACE!=='overlay')return;
    var overlayBtn=$('#topmostBtn');
    if(overlayBtn)overlayBtn.disabled=true;
    persistSurfaceHandoff();
    try{
      await requestTopmostFromOverlay();
    }catch(e){
      if(overlayBtn)overlayBtn.disabled=false;
      toast('Topmost failed',e.message||String(e));
    }
  }

  // Static control wiring.
  $('#dbManagerBtn').addEventListener('click',function(){dbmOpen(true);});
  $('#dbmCloseBtn').addEventListener('click',function(){dbmOpen(false);});
  $$('.dbmTab').forEach(function(btn){
    btn.addEventListener('click',function(){dbmSetTab(btn.dataset.dbmTab);});
  });

  $('#dbmAnalyzeValuesBtn').addEventListener('click',function(){
    dbmAnalyzeValues().catch(function(error){dbmSetStatus(error.message||String(error),'error');});
  });

  $('#dbmDistinctList').addEventListener('click',function(e){
    var row=e.target.closest('.dbmValueRow');
    if(!row)return;
    $('#dbmFind').value=row.dataset.value||'';
    $('#dbmMatchMode').value='exact';
    dbmClearPreview('Find value changed. Run a new preview.');
    $('#dbmReplace').focus();
  });

  $('#dbmPreviewBtn').addEventListener('click',function(){
    dbmPreviewReplace().catch(function(error){dbmSetStatus(error.message||String(error),'error');});
  });

  $('#dbmSaveRuleBtn').addEventListener('click',function(){
    dbmSaveCurrentRule().catch(function(error){dbmSetStatus(error.message||String(error),'error');});
  });

  $('#dbmAnalyzeVariantsBtn').addEventListener('click',function(){
    try{dbmAnalyzeVariantGroups();}catch(error){dbmSetStatus(error.message||String(error),'error');}
  });

  $('#dbmSelectVariantGroupsBtn').addEventListener('click',function(){
    $$('.dbmVariantSelect').forEach(function(box){box.checked=true;});
  });

  $('#dbmClearVariantGroupsBtn').addEventListener('click',function(){
    $$('.dbmVariantSelect').forEach(function(box){box.checked=false;});
  });

  $('#dbmPreviewNormalizeBtn').addEventListener('click',function(){
    dbmPreviewNormalization().catch(function(error){dbmSetStatus(error.message||String(error),'error');});
  });

  $('#dbmLoadPatchBtn').addEventListener('click',function(){$('#dbmPatchFileInput').click();});
  $('#dbmPatchFileInput').addEventListener('change',async function(e){
    var file=e.target.files&&e.target.files[0];if(!file)return;
    try{await dbmLoadPatchJson(await readJsonFile(file,'Database Manager patch'),file.name);}catch(error){dbmSetStatus(error.message||String(error),'error');}
    e.target.value='';
  });
  $('#dbmClearPatchBtn').addEventListener('click',dbmClearLoadedPatch);
  $('#dbmPatchHelpBtn').addEventListener('click',function(){var m=$('#dbmPatchHelpModal');m.classList.remove('hidden');m.setAttribute('aria-hidden','false');});
  $('#dbmPatchHelpCloseBtn').addEventListener('click',function(){var m=$('#dbmPatchHelpModal');m.classList.add('hidden');m.setAttribute('aria-hidden','true');});

  $('#dbmAutoNormalizeImports').addEventListener('change',function(e){
    state.autoNormalizeImports=!!e.target.checked;
    localStorage.setItem('graph1ks_auto_normalize_imports',state.autoNormalizeImports?'1':'0');
    dbmSetStatus(
      state.autoNormalizeImports
        ? 'Future imports will use saved canonical spellings.'
        : 'Automatic canonical spelling on future imports is disabled.',
      'ok'
    );
  });

  $('#dbmApplyBtn').addEventListener('click',function(){
    dbmApplyPreview().catch(function(error){dbmSetStatus(error.message||String(error),'error');});
  });

  $('#dbmCancelBtn').addEventListener('click',function(){
    if(!state.dbManagerApplying)return;
    state.dbManagerCancel=true;
    dbmSetStatus('Cancel requested. Current database chunk will finish safely…','warning');
  });

  $('#dbmClearPreviewBtn').addEventListener('click',function(){dbmClearPreview();});
  $('#dbmRefreshHistoryBtn').addEventListener('click',function(){
    dbmRenderHistoryRules().catch(function(error){dbmSetStatus(error.message||String(error),'error');});
  });

  $('#dbmHistoryList').addEventListener('click',function(e){
    var btn=e.target.closest('.dbmUndoBtn');
    if(!btn)return;
    var row=btn.closest('[data-history-id]');
    if(!row)return;
    btn.disabled=true;
    btn.textContent='UNDOING…';
    dbmUndoHistory(Number(row.dataset.historyId)).catch(function(error){
      btn.disabled=false;
      btn.textContent='UNDO';
      dbmSetStatus(error.message||String(error),'error');
    });
  });

  $('#dbmRulesList').addEventListener('click',async function(e){
    var row=e.target.closest('[data-rule-id]');
    if(!row)return;
    var id=Number(row.dataset.ruleId);
    var rules=await dbmRulesAll();
    var rule=rules.find(function(r){return Number(r.id)===id;});
    if(!rule)return;

    if(e.target.closest('.dbmLoadRuleBtn')){
      dbmLoadRule(rule);
      return;
    }

    if(e.target.closest('.dbmDeleteRuleBtn')){
      await dbmRuleDelete(id);
      await dbmRenderHistoryRules();
      dbmSetStatus('Cleanup rule deleted.','ok');
    }
  });

  $('#dbmExportRulesBtn').addEventListener('click',function(){
    dbmExportRules().catch(function(error){dbmSetStatus(error.message||String(error),'error');});
  });

  $('#dbmImportRulesBtn').addEventListener('click',function(){$('#dbmRulesFileInput').click();});
  $('#dbmRulesFileInput').addEventListener('change',function(e){
    var file=e.target.files&&e.target.files[0];
    if(!file)return;
    dbmImportRules(file).catch(function(error){dbmSetStatus(error.message||String(error),'error');});
    e.target.value='';
  });

  [
    '#dbmField','#dbmScope','#dbmMatchMode','#dbmReplaceMode',
    '#dbmFind','#dbmReplace','#dbmCaseSensitive','#dbmMoveGenreRelationships','#dbmRememberCanonical'
  ].forEach(function(selector){
    var el=$(selector);
    if(!el)return;
    el.addEventListener(el.tagName==='SELECT'||el.type==='checkbox'?'change':'input',function(){
      if(state.dbManagerPreview)dbmClearPreview('Manager settings changed. Run a new preview.');
    });
  });

  $('#dbmNormalizeField').addEventListener('change',function(){
    state.dbmNormalizationGroups=[];
    dbmRenderVariantGroups();
    if(state.dbManagerPreview)dbmClearPreview('Normalization field changed. Analyze again.');
  });

  $('#dbmNormalizeScope').addEventListener('change',function(){
    state.dbmNormalizationGroups=[];
    dbmRenderVariantGroups();
    if(state.dbManagerPreview)dbmClearPreview('Normalization scope changed. Analyze again.');
  });

  function closeTopMenus(except){
    document.querySelectorAll('details.topMenu[open]').forEach(function(menu){
      if(menu!==except)menu.open=false;
    });
  }

  function initTopMenus(){
    var menus=Array.from(document.querySelectorAll('details.topMenu'));
    menus.forEach(function(menu){
      menu.addEventListener('toggle',function(){
        if(menu.open)closeTopMenus(menu);
      });
      var panel=menu.querySelector('.topMenuPanel');
      if(panel){
        panel.addEventListener('click',function(e){
          if(e.target.closest('button')){
            // Let the button's own click handler run, then close the menu.
            queueMicrotask(function(){menu.open=false;});
          }
        });
      }
    });

    document.addEventListener('pointerdown',function(e){
      if(!e.target.closest('details.topMenu'))closeTopMenus(null);
    });
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape')closeTopMenus(null);
    });
    window.addEventListener('blur',function(){closeTopMenus(null);});
  }

  initTopMenus();

  $('#importDbBtn').addEventListener('click',function(){$('#dbFileInput').click();});
  $('#dbFileInput').addEventListener('change',async function(e){var f=e.target.files&&e.target.files[0];if(!f)return;try{await importDatabase(f);}catch(err){setImportStatus('IMPORT ERROR\n'+(err.stack||err.message||String(err)),'error');}e.target.value='';});
  $('#exportDbBtn').addEventListener('click',async function(){
    try{
      setImportStatus('Preparing full database export…','working');
      var contents=await getAllContentRecords();
      var byId=new Map(contents.map(function(c){return [Number(c.id),c];}));
      var tracks=state.records.map(function(indexRec){return exportTrack(mergeTrack(indexRec,byId.get(Number(indexRec.id))));});
      var entry=activeVaultEntry();
      var schema=isPrivateDataset()?'graph1ks-private-vault-v1':'graph1ks-prompt-control-deck-v1';
      var label=isPrivateDataset()?privateVaultArtistLabel(entry,false):'PUBLIC_VAULT';
      var vaultMeta=isPrivateDataset()&&entry?Object.assign({},entry):null;if(vaultMeta)delete vaultMeta.name;
      downloadJson({schema:schema,version:APP_VERSION,exported_at:nowIso(),vault:vaultMeta,tracks:tracks},'GRAPH1KS_'+vaultFilePart(label)+'_'+new Date().toISOString().slice(0,10)+'.json');
      setImportStatus('Exported '+tracks.length+' tracks from '+activeVaultLabel()+'.','ok');
    }catch(error){setImportStatus('EXPORT ERROR\n'+(error.stack||error.message||String(error)),'error');}
  });
  $('#exportGenresBtn').addEventListener('click',function(){downloadJson(buildGenreExport(),'GRAPH1KS_GENRES_'+new Date().toISOString().slice(0,10)+'.json');});
  $('#importGenreMapBtn').addEventListener('click',function(){$('#genreMapFileInput').click();});
  $('#genreMapFileInput').addEventListener('change',async function(e){var f=e.target.files&&e.target.files[0];if(!f)return;try{await importGenreMap(f);}catch(err){setImportStatus('GENRE MAP IMPORT ERROR\n'+(err.stack||err.message||String(err)),'error');}e.target.value='';});
  $('#topmostBtn').addEventListener('click',toggleTopmost);
  $('#sideBtn').addEventListener('click',function(){state.sidebarSide=state.sidebarSide==='left'?'right':'left';localStorage.setItem('graph1ks_sidebar_side',state.sidebarSide);applySidebar();});
  $('#surfaceSwitchBtn').addEventListener('click',function(){switchDeckSurface().catch(function(error){toast('Surface switch failed',error.message||String(error));});});
  $('#overlayAutoHideBtn').addEventListener('click',function(){toggleOverlayAutoHide().catch(function(error){toast('Auto-hide failed',error.message||String(error));});});
  $('#overlayOpacityRange').addEventListener('input',function(e){
    var value=clampOverlayOpacity(e.target.value);
    syncOverlayOpacityUi(value);
    if(overlayOpacitySendTimer)clearTimeout(overlayOpacitySendTimer);
    overlayOpacitySendTimer=setTimeout(function(){setOverlayOpacity(value,false).catch(function(){});},35);
  });
  $('#overlayOpacityRange').addEventListener('change',function(e){
    if(overlayOpacitySendTimer){clearTimeout(overlayOpacitySendTimer);overlayOpacitySendTimer=null;}
    setOverlayOpacity(e.target.value,true).catch(function(){});
  });
  $('#publicVaultTab').addEventListener('click',function(){
    switchDataset('public').catch(function(error){toast('Public Vault failed',error.message||String(error));});
  });
  $('#privateVaultTab').addEventListener('click',function(){
    switchDataset('private').catch(function(error){toast('Private Vault failed',error.message||String(error));});
  });
  $('#privateVaultSelect').addEventListener('change',function(e){
    switchDataset('private',e.target.value||null).catch(function(error){toast('Private Vault failed',error.message||String(error));});
  });
  $('#privateIdentityUpdateBtn').addEventListener('click',async function(){
    var btn=$('#privateIdentityUpdateBtn');
    try{btn.disabled=true;btn.textContent='CHECKING…';var result=await updateActivePrivateVaultIdentityFromSuno();toast(result.changed?'Suno identity updated':'Suno identity verified',(result.entry.displayName||'')+(result.entry.handle?' · @'+result.entry.handle:'')+' · '+result.affected+' owned track(s) synchronized.');}
    catch(error){toast('Identity update blocked',error.message||String(error));}
    finally{btn.textContent='UPDATE FROM SUNO';renderVaultNavigation();}
  });
  $('#vaultEditorBtn').addEventListener('click',openVaultEditor);
  $('#guidedTourBtn').addEventListener('click',function(){document.querySelectorAll('.topMenu[open]').forEach(function(d){d.removeAttribute('open');});startGuidedTour({auto:false});});
  $('#themeToggle').addEventListener('click',toggleTheme);
  $('#vaultEditorCloseBtn').addEventListener('click',closeVaultEditor);
  $('#vaultEditorCancelBtn').addEventListener('click',closeVaultEditor);
  $('#vaultEditorSaveBtn').addEventListener('click',async function(){
    var btn=$('#vaultEditorSaveBtn'),status=$('#vaultEditorStatus');
    try{btn.disabled=true;if(status)status.textContent='SAVING…';await saveVaultEditorSong();}
    catch(error){if(status)status.textContent=error.message||String(error);toast('Vault Editor failed',error.message||String(error));updateVaultEditorCounters();}
  });
  $('#vaultEditorModal').addEventListener('click',function(e){if(e.target===$('#vaultEditorModal'))closeVaultEditor();});
  $('#vaultEditorModal').addEventListener('input',function(e){
    if(!e.target||!e.target.matches('input,textarea,select'))return;
    if(e.target.id==='vaultEditorBpm')state.vaultEditorBpmDirty=true;
    if(e.target.id==='vaultEditorYear')state.vaultEditorYearDirty=true;
    if(e.target.id==='vaultEditorStyle')inferVaultEditorMetadataFromStyle();
    updateVaultEditorCounters();
  });
  $('#vaultEditorSubgenre').addEventListener('input',function(e){
    renderVaultEditorGenreSuggestions(e.target.value);
    syncVaultEditorMajorGenreFromSubgenre();
  });
  $('#vaultEditorSubgenre').addEventListener('change',function(e){
    var canonical=canonicalizeEditorGenre(e.target.value);
    if(canonical!==e.target.value)e.target.value=canonical;
    syncVaultEditorMajorGenreFromSubgenre();
  });
  $('#vaultEditorSubgenre').addEventListener('blur',function(e){
    setTimeout(function(){
      var canonical=canonicalizeEditorGenre(e.target.value);
      if(canonical!==e.target.value)e.target.value=canonical;
      syncVaultEditorMajorGenreFromSubgenre();
      hideVaultEditorGenreSuggestions();
    },90);
  });
  $('#retrieveActiveBtn').addEventListener('click',async function(){
    if(!state.sunoContextActive){toast('Suno inactive','Make Suno the active browser tab first.');return;}
    try{
      var response=await chrome.runtime.sendMessage({type:'RETRIEVE_ACTIVE_SUNO'});
      if(!response||!response.ok||!response.record)throw new Error(response&&response.message||'Retrieve returned no record.');
      await handleRetrievedRecord(response.record);
    }catch(error){toast('Retrieve failed',error.message||String(error));}
  });
  $('#retrieveTitleInput').addEventListener('input',function(e){$('#retrieveTitleSaveBtn').disabled=!String(e.target.value||'').trim();});
  $('#retrieveTitleCancelBtn').addEventListener('click',hideRetrieveTitleModal);
  $('#retrieveTitleSaveBtn').addEventListener('click',async function(){
    var pending=state.pendingRetrieve;if(!pending)return;
    var title=String($('#retrieveTitleInput').value||'').trim();if(!title)return;
    var entry=state.vaultRegistry[pending.entryKey];if(!entry){toast('Vault missing','The target Suno Vault no longer exists.');return;}
    var record=clone(pending.record);record.title=title;record.name=title;
    try{
      var saved=await storeRetrievedRecord(entry,record);
      hideRetrieveTitleModal();
      toast('Retrieved to '+privateVaultArtistLabel(entry,true),saved.title);
    }catch(error){toast('Private Vault save failed',error.message||String(error));}
  });

  $('#searchInput').addEventListener('input',function(e){
    state.query=e.target.value;syncSearchClear();clearTimeout(state.searchTimer);
    state.searchTimer=setTimeout(function(){invalidateView(true);renderTable();renderStats();renderGenrePicker();},120);
  });
  $('#searchInput').addEventListener('keydown',function(e){if(e.key==='Escape'){e.target.value='';state.query='';invalidateView(true);renderAll();}});
  $('#clearSearchBtn').addEventListener('click',function(){state.query='';$('#searchInput').value='';invalidateView(true);renderAll();$('#searchInput').focus();});
  $('#searchField').addEventListener('change',function(e){state.searchField=e.target.value;invalidateView(true);renderTable();renderStats();renderGenrePicker();});
  $('#sortSelect').addEventListener('change',function(e){state.sort=e.target.value;invalidateView(true);renderTable();renderStats();});
  $('#statusFilter').addEventListener('change',function(e){state.status=e.target.value;invalidateView(true);renderTable();renderStats();renderGenrePicker();});

  $('#genrePickerBtn').addEventListener('click',function(e){
    e.stopPropagation();

    var picker=$('#genrePicker');
    picker.classList.toggle('hidden');

    if(!picker.classList.contains('hidden')){
      renderGenrePicker();
      positionGenrePicker();
      $('#genreSearchInput').focus();
    }
  });

  // IMPORTANT: renderGenrePicker() rebuilds Major Genre buttons. Without this
  // propagation guard, the original clicked button can be detached before the
  // deckRoot outside-click handler runs, making an INTERNAL click look like an
  // outside click and closing the picker after the first Major selection.
  $('#genrePicker').addEventListener('click',function(e){
    e.stopPropagation();
  });

  deckRoot.addEventListener('click',function(e){
    var p=$('#genrePicker');
    if(!p.classList.contains('hidden')){
      p.classList.add('hidden');
    }
  });
  $('#genreAllBtn').addEventListener('click',function(){
    state.majorSelection.clear();
    state.subgenreSelection.clear();
    state.randomViewIds=null;
    state.randomViewMeta=null;
    state.genreFilter={type:'all',value:null,values:[]};
    invalidateView(true);
    persistLastListState();
    renderAll();
  });

  $('#genreRandomToggleBtn').addEventListener('click',function(){
    state.genreRandomExpanded=!state.genreRandomExpanded;
    renderGenrePicker();
    positionGenrePicker();
  });

  $('#genreOpenSelectedBtn').addEventListener('click',function(){
    var majors=Array.from(state.majorSelection);
    var genres=Array.from(state.subgenreSelection);
    if(!majors.length&&!genres.length)return;

    state.randomViewIds=null;
    state.randomViewMeta=null;
    if(genres.length){
      // Explicit subgenre selections are exact; they take precedence over the
      // broader Major Genre scope used to discover them.
      state.genreFilter={type:'genres',value:null,values:genres};
    }else{
      state.genreFilter={type:'majors',value:null,values:majors};
    }

    invalidateView(true);
    persistLastListState();
    renderAll();
    $('#genrePicker').classList.add('hidden');
  });

  $('#majorGenreGrid').addEventListener('click',function(e){
    var b=e.target.closest('[data-major]');
    if(!b)return;
    var major=b.dataset.major;
    if(state.majorSelection.has(major))state.majorSelection.delete(major);
    else state.majorSelection.add(major);
    // Keep already chosen subgenres only if they still belong to one of the
    // selected majors; with no majors selected all subgenres remain available.
    if(state.majorSelection.size){
      state.subgenreSelection=new Set(Array.from(state.subgenreSelection).filter(function(g){return genreBelongsToAnyMajor(g,Array.from(state.majorSelection));}));
    }
    persistLastListState();
    renderGenrePicker();
    positionGenrePicker();
  });

  $('#collectedGenreList').addEventListener('click',function(e){
    var row=e.target.closest('.genreRow');
    if(!row||row.dataset.unmapped)return;
    var genre=row.dataset.genre;
    if(state.subgenreSelection.has(genre))state.subgenreSelection.delete(genre);
    else state.subgenreSelection.add(genre);
    persistLastListState();
    renderGenrePicker();
  });
  $('#genreRandomAddBtn').addEventListener('click',function(){
    runGenreRandomView();
  });

  $('#clearRandomViewBtn').addEventListener('click',function(){
    clearRandomView({
      clearSelection:false,
      silent:false
    });
  });

  ['genreRandomFromYear','genreRandomToYear','genreRandomPerYear'].forEach(function(id){
    var el=$('#'+id);
    if(!el)return;

    el.addEventListener('keydown',function(e){
      if(e.key==='Enter'){
        e.preventDefault();
        runGenreRandomView();
      }
    });
  });

  $('#genreRandomPerYear').addEventListener('change',function(){
    clampRandomPerYear();
  });

  $('#genreSearchInput').addEventListener('input',function(e){state.genreSearch=e.target.value;renderGenrePicker();});
  $('#clearGenreSearchBtn').addEventListener('click',function(){state.genreSearch='';$('#genreSearchInput').value='';renderGenrePicker();$('#genreSearchInput').focus();});

  var genrePickerView=(deckRoot&&deckRoot.ownerDocument&&deckRoot.ownerDocument.defaultView)||window;
  genrePickerView.addEventListener('resize',function(){
    positionGenrePicker();
  });

  $('#trackBody').addEventListener('pointerdown',function(e){
    if(e.button!==0)return;
    if(e.target.closest('button,input,a,select,textarea'))return;
    var tr=e.target.closest('tr[data-id]');
    if(!tr)return;
    var id=Number(tr.dataset.id);
    if(!Number.isFinite(id))return;

    var now=Date.now();
    var isDouble=vaultDirectClick.lastId===id&&(now-vaultDirectClick.lastAt)<=480;
    vaultDirectClick.lastId=id;
    vaultDirectClick.lastAt=now;

    if(!isDouble)return;

    vaultDirectClick.lastId=null;
    vaultDirectClick.lastAt=0;
    vaultDirectClick.suppressId=id;
    vaultDirectClick.suppressUntil=now+750;
    e.preventDefault();
    triggerVaultDirectFill(id,e.clientX,e.clientY);
  });

  $('#trackBody').addEventListener('click',async function(e){
    var tr=e.target.closest('tr[data-id]');
    if(!tr)return;

    var id=Number(tr.dataset.id);
    if(vaultDirectClick.suppressId===id&&Date.now()<vaultDirectClick.suppressUntil){
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    var idx=Number(tr.dataset.index);
    var usedCheck=e.target.closest('.usedCheck');
    var favoriteToggle=e.target.closest('.favoriteToggle');
    var check=e.target.closest('.rowCheck');

    if(usedCheck){
      await setTrackUsed(id,!!usedCheck.checked);
      return;
    }

    if(favoriteToggle){
      var favRecord=state.recordById.get(id);
      if(favRecord)await setTrackFavorite(id,!favRecord.favorite);
      return;
    }

    if(check){
      if(e.shiftKey&&state.lastClickedVisibleIndex!=null){
        var vis=visibleRecords();
        var a=Math.min(idx,state.lastClickedVisibleIndex);
        var b=Math.max(idx,state.lastClickedVisibleIndex);

        for(var i=a;i<=b;i++)state.selectedIds.add(vis[i].id);
      }else if(state.selectedIds.has(id)){
        state.selectedIds.delete(id);
      }else{
        state.selectedIds.add(id);
      }

      state.lastClickedVisibleIndex=idx;
      renderTable();
      renderStats();
      return;
    }

    if(e.ctrlKey||e.metaKey){
      if(state.selectedIds.has(id))state.selectedIds.delete(id);
      else state.selectedIds.add(id);

      state.lastClickedVisibleIndex=idx;
      renderTable();
      renderStats();
      return;
    }

    if(e.shiftKey&&state.lastClickedVisibleIndex!=null){
      var vr=visibleRecords();
      var lo=Math.min(idx,state.lastClickedVisibleIndex);
      var hi=Math.max(idx,state.lastClickedVisibleIndex);

      for(var j=lo;j<=hi;j++)state.selectedIds.add(vr[j].id);

      renderTable();
      renderStats();
      return;
    }

    // Normal single click ends any existing mass-selection. This is the
    // standard list/table behavior: Shift/Ctrl are required to extend it.
    if(state.selectedIds.size)state.selectedIds.clear();

    state.lastClickedVisibleIndex=idx;
    await selectTrack(id);
    renderTable();
    renderStats();
  });

  $('#trackBody').addEventListener('dblclick',function(e){
    // Native dblclick remains only as a compatibility fallback. The primary
    // detector is pointerdown-based because selecting a track re-renders rows.
    if(e.target.closest('button,input,a,select,textarea'))return;
    var tr=e.target.closest('tr[data-id]');
    if(!tr)return;
    e.preventDefault();
    e.stopPropagation();
    var id=Number(tr.dataset.id);
    if(!Number.isFinite(id))return;
    if(vaultDirectClick.lastTriggeredId===id&&Date.now()-vaultDirectClick.lastTriggeredAt<900)return;
    triggerVaultDirectFill(id,e.clientX,e.clientY);
  });

  $('#selectVisibleBtn').addEventListener('click',function(){visibleRecords().forEach(function(r){state.selectedIds.add(r.id);});renderTable();renderStats();toast('Selected',state.selectedIds.size+' tracks selected.');});
  $('#clearSelectionBtn').addEventListener('click',function(){var n=state.selectedIds.size;state.selectedIds.clear();renderTable();renderStats();if(n)toast('Selection cleared',n+' tracks deselected.');});
  $('#markSelectedUsedBtn').addEventListener('click',async function(){await setSelectedUsed(true);});
  $('#markSelectedUnusedBtn').addEventListener('click',async function(){await setSelectedUsed(false);});
  $('#markSelectedFavoriteBtn').addEventListener('click',async function(){await setSelectedFavorite(true);});
  $('#markSelectedUnfavoriteBtn').addEventListener('click',async function(){await setSelectedFavorite(false);});
  $('#deleteSelectedBtn').addEventListener('click',async function(e){
    if(!state.selectedIds.size)return;
    if(e.currentTarget.dataset.confirm!=='1'){
      e.currentTarget.dataset.confirm='1';e.currentTarget.textContent='CONFIRM DELETE';e.currentTarget.classList.add('confirming');
      setTimeout(function(){if(e.currentTarget){e.currentTarget.dataset.confirm='';e.currentTarget.textContent='Delete Selected';e.currentTarget.classList.remove('confirming');}},4500);
      return;
    }
    var ids=Array.from(state.selectedIds);
    await deleteIds(ids);
    var idSet=new Set(ids);
    state.records=state.records.filter(function(r){return !idSet.has(r.id);});
    rebuildRecordMap();
    if(idSet.has(state.selectedId)){state.selectedId=null;state.selectedFull=null;}
    state.selectedIds.clear();
    invalidateView(false);invalidateGenreStats();
    e.currentTarget.dataset.confirm='';e.currentTarget.textContent='Delete Selected';e.currentTarget.classList.remove('confirming');
    renderAll();toast('Deleted',ids.length+' tracks removed.');
  });

  $('#restorePublicVaultBtn').addEventListener('click',async function(e){
    var btn=e.currentTarget;
    if(state.restorePublicStage===0){
      state.restorePublicStage=1;
      btn.textContent='CONFIRM REPLACE PUBLIC VAULT';
      btn.classList.add('confirming');
      setTimeout(function(){
        if(state.restorePublicStage===1){
          state.restorePublicStage=0;
          if(btn){btn.textContent='Restore Factory PUBLIC Vault';btn.classList.remove('confirming');}
        }
      },6000);
      return;
    }

    state.restorePublicStage=0;
    btn.disabled=true;
    btn.textContent='RESTORING FACTORY DATA…';
    try{
      var restored=await restoreFactoryPublicVault({mode:'manual-restore'});
      await switchDataset('public');
      toast('PUBLIC VAULT restored',restored.tracks+' tracks · '+restored.mappings+' genre mappings.');
    }catch(error){
      setImportStatus('FACTORY RESTORE ERROR\n'+(error.stack||error.message||String(error)),'error');
      toast('Restore failed',error.message||String(error));
    }finally{
      btn.disabled=false;
      btn.textContent='Restore Factory PUBLIC Vault';
      btn.classList.remove('confirming');
      state.restorePublicStage=0;
    }
  });

  $('#deleteDbBtn').addEventListener('click',async function(e){
    if(!activeDbName()){toast('No Private Vault','Retrieve from Suno or select an existing Private Vault first.');return;}
    state.deleteDbStage++;
    if(state.deleteDbStage===1){e.currentTarget.textContent='CONFIRM DELETE ALL';e.currentTarget.classList.add('confirming');return;}
    if(state.deleteDbStage===2){e.currentTarget.textContent='ARE YOU REALLY SURE!?';return;}
    await clearTracks();
    state.records=[];rebuildRecordMap();state.selectedFull=null;state.deleteDbStage=0;state.selectedId=null;state.selectedIds.clear();
    invalidateView(true);invalidateGenreStats();
    e.currentTarget.textContent='Delete Active Vault Data';e.currentTarget.classList.remove('confirming');renderAll();toast(activeVaultLabel()+' cleared','Genre relationship map was preserved.');
  });

  deckRoot.addEventListener('click',async function(e){
    var genreSuggestion=e.target.closest('.vaultEditorGenreSuggestion');
    if(genreSuggestion){
      e.preventDefault();
      var subInput=$('#vaultEditorSubgenre');
      if(subInput){subInput.value=genreSuggestion.dataset.editorGenre||'';syncVaultEditorMajorGenreFromSubgenre();updateVaultEditorCounters();}
      hideVaultEditorGenreSuggestions();
      return;
    }
    var autoFitButton=e.target.closest('[data-autofit-key]');if(autoFitButton){e.preventDefault();toggleAutoFit(autoFitButton.dataset.autofitKey);return;}
    if(e.target.closest('#autofillBtn')){await runAutofill();return;}
    if(e.target.closest('#fillMoreOptionsBtn')){
      state.fillMoreOptionsEnabled=!state.fillMoreOptionsEnabled;
      localStorage.setItem('graph1ks_fill_more_options',state.fillMoreOptionsEnabled?'1':'0');
      renderInspector();return;
    }
    if(e.target.closest('#autoUsedBtn')){
      state.autoUsedAfterAutofill=!state.autoUsedAfterAutofill;
      localStorage.setItem('graph1ks_auto_used_after_autofill',state.autoUsedAfterAutofill?'1':'0');
      if(!state.autoUsedAfterAutofill&&state.autoFillEnabled){
        state.autoFillEnabled=false;state.autoFillPending=null;await syncAutoFillConfig();
        toast('AUTO FILL disabled','AUTO FILL requires AUTO USED + AUTO NEXT.');
      }
      renderInspector();return;
    }
    if(e.target.closest('#autoNextBtn')){
      state.autoNextAfterAutofill=!state.autoNextAfterAutofill;
      localStorage.setItem('graph1ks_auto_next_after_autofill',state.autoNextAfterAutofill?'1':'0');
      if(!state.autoNextAfterAutofill&&state.autoFillEnabled){
        state.autoFillEnabled=false;state.autoFillPending=null;await syncAutoFillConfig();
        toast('AUTO FILL disabled','AUTO FILL requires AUTO USED + AUTO NEXT.');
      }
      renderInspector();return;
    }
    if(e.target.closest('#autoFillBtn')){
      if(!state.autoFillEnabled&&(!state.autoUsedAfterAutofill||!state.autoNextAfterAutofill)){
        toast('AUTO FILL requires both','Turn on AUTO USED and AUTO NEXT first.');
        return;
      }
      state.autoFillEnabled=!state.autoFillEnabled;
      if(!state.autoFillEnabled){state.autoFillPending=null;state.autoFillRuntimePhase='paused';state.autoFillRemaining=null;}
      try{await syncAutoFillConfig();}catch(error){toast('AUTO FILL setting failed',error.message||String(error));}
      renderInspector();return;
    }
    if(e.target.closest('#fillHotkeyBtn')){
      state.fillHotkeyEnabled=!state.fillHotkeyEnabled;
      if(!state.fillHotkeyEnabled){state.autoFillRuntimePhase='paused';state.autoFillRemaining=null;}
      try{await syncFeedbackConfig();}catch(error){toast('F shortcut setting failed',error.message||String(error));}
      renderInspector();
      return;
    }
    if(e.target.closest('#retrieveHotkeyBtn')){
      state.retrieveHotkeyEnabled=!state.retrieveHotkeyEnabled;
      try{await syncFeedbackConfig();}catch(error){toast('R shortcut setting failed',error.message||String(error));}
      renderInspector();
      return;
    }
    if(e.target.closest('#soundFeedbackBtn')){
      state.soundFeedback=!state.soundFeedback;
      try{await syncFeedbackConfig();}catch(error){toast('Sound setting failed',error.message||String(error));}
      renderInspector();
      return;
    }
    if(e.target.closest('#radialFeedbackBtn')){
      state.radialFeedback=!state.radialFeedback;
      try{await syncFeedbackConfig();}catch(error){toast('Pointer effect setting failed',error.message||String(error));}
      renderInspector();
      return;
    }
    if(e.target.closest('#usedCheckbox')){var r=selectedRecord();if(r)await setTrackUsed(r.id,!!e.target.closest('#usedCheckbox').checked);return;}
    if(e.target.closest('#favoriteBtn')){var f=selectedRecord();if(f)await setTrackFavorite(f.id,!f.favorite);return;}
    if(e.target.closest('#editLockBtn')){state.editUnlocked=!state.editUnlocked;renderInspector();return;}
    if(e.target.closest('#saveEditBtn')){await saveEdited();return;}
    var copy=e.target.closest('[data-copy]');if(copy){var rec=selectedFullRecord();if(rec){await navigator.clipboard.writeText(String(rec[copy.dataset.copy]??''));copy.textContent='✓ COPIED';copy.classList.add('copied');setTimeout(function(){if(copy.isConnected){copy.textContent='Copy';copy.classList.remove('copied');}},1300);}return;}
    if(e.target.closest('#copyErrorBtn')&&state.autofillError){await navigator.clipboard.writeText(state.autofillError);toast('Copied','Autofill diagnostic copied.');return;}
    if(e.target.closest('#deleteEntryBtn')){var rec2=selectedRecord();if(!rec2)return;if(!state.deleteConfirmStage){state.deleteConfirmStage=1;renderInspector();return;}await deleteIds([rec2.id]);state.records=state.records.filter(function(x){return x.id!==rec2.id;});rebuildRecordMap();state.selectedId=null;state.selectedFull=null;state.deleteConfirmStage=0;invalidateView(false);invalidateGenreStats();renderAll();toast('Deleted','Track #'+rec2.id+' removed.');return;}
  });

  deckRoot.addEventListener('input',function(e){
    if(e.target&&e.target.matches('textarea[data-autofit-field]')&&autoFitEnabled(e.target.dataset.autofitField))fitTextarea(e.target);
    if(!e.target||e.target.id!=='autoFillSeconds')return;
    var raw=String(e.target.value||'').replace(/\D+/g,'').slice(0,2);
    if(raw!==String(e.target.value||''))e.target.value=raw;
  });

  deckRoot.addEventListener('change',async function(e){
    if(!e.target||e.target.id!=='autoFillSeconds')return;
    var value=Math.max(1,Math.min(99,Number.parseInt(e.target.value,10)||8));
    state.autoFillSeconds=value;
    e.target.value=value;
    try{await syncAutoFillConfig();}catch(error){toast('AUTO FILL seconds failed',error.message||String(error));}
    renderInspector();
  });

  $('.tableScroll').addEventListener('scroll',scheduleVirtualRender,{passive:true});

  chrome.runtime.onMessage.addListener(function(message,sender,sendResponse){
    if(!message||!message.type)return;

    if(message.type==='GRAPH1KS_RETRIEVED_RECORD'){
      handleRetrievedRecord(message.record).then(sendResponse).catch(function(error){sendResponse({ok:false,message:error.message||String(error)});});
      return true;
    }

    if(message.type==='GRAPH1KS_BROWSER_CONTEXT'){
      var context=message.state||{};
      state.sunoContextActive=context.deckOpen===true&&context.sunoActive===true&&context.enabled===true;
      if(state.sunoContextActive&&Number.isInteger(context.activeTabId))state.sunoTabId=context.activeTabId;
      if(!state.sunoContextActive){
        state.autoFillRuntimePhase='paused';
        state.autoFillRemaining=null;
        state.autoFillPending=null;
      }
      renderInspector();
      renderVaultNavigation();
      return;
    }

    if(message.type==='GRAPH1KS_F_HOTKEY_TRIGGER'){
      if(!state.fillHotkeyEnabled||!state.sunoContextActive||state.autofilling)return;
      if(!state.selectedId){toast('F fill skipped','No track is selected.');return;}
      runAutofill({sourceTabId:Number.isInteger(message.sourceTabId)?message.sourceTabId:state.sunoTabId}).catch(function(error){toast('F fill failed',error.message||String(error));});
      return;
    }

    if(message.type==='GRAPH1KS_AUTO_FILL_STATUS'){
      if(!state.sunoContextActive)return;
      var status=message.status||{};
      state.autoFillRuntimePhase=String(status.phase||'paused');
      state.autoFillRemaining=Number.isFinite(status.remaining)?status.remaining:null;
      renderInspector();
      return;
    }

    if(message.type==='GRAPH1KS_AUTO_FILL_EXECUTE'){
      if(!state.sunoContextActive){sendResponse({ok:false,message:'Suno must be the active browser tab.'});return;}
      if(!state.autoFillEnabled||!state.autoUsedAfterAutofill||!state.autoNextAfterAutofill){
        sendResponse({ok:false,message:'AUTO FILL requires AUTO USED + AUTO NEXT and must be enabled.'});
        return;
      }
      if(!state.selectedId){sendResponse({ok:false,message:'No track is selected.'});return;}
      runAutofill({deferAutoActions:true,sourceTabId:Number.isInteger(message.sourceTabId)?message.sourceTabId:state.sunoTabId}).then(sendResponse).catch(function(error){sendResponse({ok:false,message:error.message||String(error)});});
      return true;
    }

    if(message.type==='GRAPH1KS_AUTO_FILL_POST_VERIFY_CLICK'){
      if(!state.sunoContextActive){sendResponse({ok:false,message:'Suno must be the active browser tab.'});return;}
      completeAutoFillPostClick().then(sendResponse).catch(function(error){sendResponse({ok:false,message:error.message||String(error)});});
      return true;
    }
  });

  window.addEventListener('keydown',function(e){if(e.key==='Escape'&&tourState&&tourState.active){e.preventDefault();endGuidedTour(true);return;}if(e.key==='Escape'&&state.vaultEditorOpen){e.preventDefault();closeVaultEditor();}});

  window.addEventListener('pagehide',function(){
    try{chrome.runtime.sendMessage({type:'DECK_CLOSING',surface:DECK_SURFACE}).catch(function(){});}catch(_){}
  });


  // v1.3.4 — interactive guided onboarding. Runs once per installed release and can be replayed from TOOLS.
  var ONBOARDING_SEEN_KEY='graph1ks_onboarding_seen_version';
  var tourState={active:false,index:0,auto:false,openedGenre:false,raf:0,layer:null,focusRect:null};
  var TOUR_COPY={
    en:{
      step:'STEP',of:'OF',skip:'SKIP TOUR',back:'BACK',next:'NEXT',finish:'FINISH',close:'Close tutorial',
      steps:[
        ['Welcome to Prompt Control Deck','This extension is your bridge between the <strong>Vault</strong> and Suno. This quick tour shows the normal workflow without explaining every tiny switch.'],
        ['Language & appearance','Use the language control for <strong>DE / EN</strong> and switch between <strong>Dark</strong> and the Suno-inspired <strong>Light</strong> appearance here. Your choice is remembered.'],
        ['Public vs. Private Vault','Use <strong>PUBLIC VAULT</strong> to browse the reference database. <strong>PRIVATE VAULT</strong> stores your own retrieved or manually created songs and Suno settings.'],
        ['Find the right track','Search by text or field and use the genre system to narrow the database. The genre picker understands Major Genres, canonical Subgenres and random selection.'],
        ['Genre discovery','Pick one or more Major Genres, then drill into Subgenres. Different spellings such as Synth Pop / Synth-Pop / Synthpop resolve to the same canonical genre.'],
        ['Track list & details','Click a track to inspect it. Double-click a Vault row to send that track directly to Suno. The detail panel contains Style, Lyrics/Arrangement, metadata and Autofill controls.'],
        ['Retrieve from Suno','<strong>R · RETRIEVE</strong> pulls the current Suno song back into your Private Vault — including title, lyrics, style, Voice link and supported Advanced Options.'],
        ['Manual Editor','<strong>EDITOR MODE</strong> creates or edits a Private Vault draft manually. Genre suggestions automatically attach the correct Major Genre relationships.'],
        ['Autofill workflow','Select a track and use Autofill to send it to Suno. <strong>FILL MORE OPTIONS</strong> can additionally restore supported Advanced Options, including the fast slider controls.'],
        ['You are ready','That is the core workflow: <strong>find → fill → create → retrieve → reuse</strong>. You can replay this tour any time from <strong>TOOLS → GUIDED TOUR</strong>.']
      ]
    },
    de:{
      step:'SCHRITT',of:'VON',skip:'TOUR ÜBERSPRINGEN',back:'ZURÜCK',next:'WEITER',finish:'FERTIG',close:'Tutorial schließen',
      steps:[
        ['Willkommen im Prompt Control Deck','Die Extension ist deine Brücke zwischen <strong>Vault</strong> und Suno. Diese kurze Tour zeigt den normalen Workflow, ohne jeden kleinen Schalter einzeln zu erklären.'],
        ['Sprache & Darstellung','Hier wechselst du zwischen <strong>DE / EN</strong> sowie zwischen <strong>Dark</strong> und dem Suno-inspirierten <strong>Light Mode</strong>. Deine Auswahl wird gespeichert.'],
        ['Public vs. Private Vault','Die <strong>PUBLIC VAULT</strong> ist die Referenzdatenbank. In der <strong>PRIVATE VAULT</strong> landen deine eigenen abgerufenen oder manuell erstellten Songs samt Suno-Einstellungen.'],
        ['Den richtigen Track finden','Suche frei oder nach einzelnen Feldern und grenze die Datenbank über das Genre-System ein. Der Genre-Picker unterstützt Major Genres, kanonische Subgenres und Zufallsauswahl.'],
        ['Genre Discovery','Wähle ein oder mehrere Major Genres und gehe anschließend in die Subgenres. Schreibweisen wie Synth Pop / Synth-Pop / Synthpop führen zum selben kanonischen Genre.'],
        ['Trackliste & Details','Klicke einen Track für die Detailansicht an. Ein Doppelklick auf eine Vault-Zeile schickt den Track direkt zu Suno. Rechts findest du Style, Lyrics/Arrangement, Metadaten und Autofill.'],
        ['Aus Suno übernehmen','<strong>R · RETRIEVE</strong> holt den aktuellen Suno-Song zurück in deine Private Vault — inklusive Titel, Lyrics, Style, Voice-Link und unterstützten Advanced Options.'],
        ['Manueller Editor','Im <strong>EDITOR MODE</strong> kannst du einen Private-Vault-Draft manuell anlegen oder bearbeiten. Genre-Vorschläge übernehmen automatisch die passenden Major-Genre-Beziehungen.'],
        ['Autofill Workflow','Wähle einen Track und schicke ihn per Autofill zu Suno. <strong>FILL MORE OPTIONS</strong> kann zusätzlich die unterstützten Advanced Options inklusive der schnellen Slider wiederherstellen.'],
        ['Du bist startklar','Der Kern-Workflow ist: <strong>finden → füllen → erstellen → abrufen → wiederverwenden</strong>. Die Tour kannst du jederzeit unter <strong>TOOLS → GUIDED TOUR</strong> erneut starten.']
      ]
    }
  };
  var TOUR_STEPS=[
    {target:'.brand',pad:8},
    {target:'#themeToggle',fallback:'.topActions',pad:8},
    {target:'.vaultBar',pad:6},
    {target:'.toolbar',pad:5},
    {target:'#genrePickerBtn',pad:7},
    {target:'#mainLayout',pad:4},
    {target:'#retrieveActiveBtn',pad:8},
    {target:'#vaultEditorBtn',pad:8},
    {target:'#inspector',fallback:'#mainLayout',pad:5},
    {target:'.topActions',pad:6}
  ];
  function tourLang(){try{return window.G1I18N&&G1I18N.getLanguage()==='de'?'de':'en';}catch(_){return 'en';}}
  function tourCopy(){return TOUR_COPY[tourLang()]||TOUR_COPY.en;}
  function tourTarget(step){var el=document.querySelector(step.target);if((!el||el.offsetParent===null)&&step.fallback)el=document.querySelector(step.fallback);return el||document.querySelector('#deckRoot')||document.body;}
  function ensureTourLayer(){
    if(tourState.layer&&tourState.layer.isConnected)return tourState.layer;
    var layer=document.createElement('div');layer.className='g1TourLayer';layer.id='g1TourLayer';layer.setAttribute('aria-live','polite');
    layer.innerHTML='<div class="g1TourShade g1TourShadeTop"></div><div class="g1TourShade g1TourShadeLeft"></div><div class="g1TourShade g1TourShadeRight"></div><div class="g1TourShade g1TourShadeBottom"></div><div class="g1TourSpotlight"></div><div class="g1TourPointer"></div><section class="g1TourCard" role="dialog" aria-modal="true" aria-label="Guided tour"><button class="g1TourClose" type="button">×</button><div class="g1TourMeta"><span class="g1TourBadge"></span><span class="g1TourCount"></span></div><h3></h3><p></p><div class="g1TourProgress"><i></i></div><div class="g1TourActions"><button class="g1TourSkip" type="button"></button><button class="g1TourBack" type="button"></button><button class="g1TourNext" type="button"></button></div></section>';
    document.body.appendChild(layer);tourState.layer=layer;
    layer.querySelector('.g1TourClose').addEventListener('click',function(){endGuidedTour(true);});
    layer.querySelector('.g1TourSkip').addEventListener('click',function(){endGuidedTour(true);});
    layer.querySelector('.g1TourBack').addEventListener('click',function(){showTourStep(tourState.index-1);});
    layer.querySelector('.g1TourNext').addEventListener('click',function(){if(tourState.index>=TOUR_STEPS.length-1)endGuidedTour(false);else showTourStep(tourState.index+1);});
    return layer;
  }
  function markTourSeen(){try{chrome.storage.local.set({[ONBOARDING_SEEN_KEY]:APP_VERSION});}catch(_){}}
  function tourRectFor(el,pad){var r=el.getBoundingClientRect(),vw=window.innerWidth,vh=window.innerHeight,p=Number(pad)||6;return {left:Math.max(6,r.left-p),top:Math.max(6,r.top-p),right:Math.min(vw-6,r.right+p),bottom:Math.min(vh-6,r.bottom+p)};}
  function setRect(el,rect){el.style.left=rect.left+'px';el.style.top=rect.top+'px';el.style.width=Math.max(0,rect.right-rect.left)+'px';el.style.height=Math.max(0,rect.bottom-rect.top)+'px';}
  function positionTour(){
    if(!tourState.active||!tourState.layer)return;
    var step=TOUR_STEPS[tourState.index],target=tourTarget(step),rect=tourRectFor(target,step.pad),vw=window.innerWidth,vh=window.innerHeight,layer=tourState.layer;
    tourState.focusRect=rect;
    setRect(layer.querySelector('.g1TourSpotlight'),rect);
    setRect(layer.querySelector('.g1TourShadeTop'),{left:0,top:0,right:vw,bottom:rect.top});
    setRect(layer.querySelector('.g1TourShadeBottom'),{left:0,top:rect.bottom,right:vw,bottom:vh});
    setRect(layer.querySelector('.g1TourShadeLeft'),{left:0,top:rect.top,right:rect.left,bottom:rect.bottom});
    setRect(layer.querySelector('.g1TourShadeRight'),{left:rect.right,top:rect.top,right:vw,bottom:rect.bottom});
    var card=layer.querySelector('.g1TourCard'),cw=Math.min(420,vw-28),gap=14,ch=card.offsetHeight||190;
    var left=Math.min(Math.max(14,rect.left),Math.max(14,vw-cw-14)),top;
    if(rect.bottom+gap+ch<=vh-10)top=rect.bottom+gap;
    else if(rect.top-gap-ch>=10)top=rect.top-gap-ch;
    else {top=Math.min(Math.max(10,(vh-ch)/2),Math.max(10,vh-ch-10));left=Math.min(Math.max(14,rect.right+gap),Math.max(14,vw-cw-14));if(left<rect.right&&rect.left>cw+gap)left=rect.left-cw-gap;}
    card.style.left=left+'px';card.style.top=top+'px';
    var pointer=layer.querySelector('.g1TourPointer');pointer.style.display='none';
  }
  function showTourStep(index){
    if(!tourState.active)return;index=Math.max(0,Math.min(TOUR_STEPS.length-1,index));tourState.index=index;
    var layer=ensureTourLayer(),copy=tourCopy(),data=copy.steps[index],card=layer.querySelector('.g1TourCard');
    layer.querySelector('.g1TourBadge').textContent='GRAPH1KS TOUR';
    layer.querySelector('.g1TourCount').textContent=copy.step+' '+(index+1)+' '+copy.of+' '+TOUR_STEPS.length;
    card.querySelector('h3').textContent=data[0];card.querySelector('p').innerHTML=data[1];
    layer.querySelector('.g1TourProgress i').style.width=(((index+1)/TOUR_STEPS.length)*100)+'%';
    layer.querySelector('.g1TourSkip').textContent=copy.skip;layer.querySelector('.g1TourBack').textContent=copy.back;layer.querySelector('.g1TourBack').disabled=index===0;
    layer.querySelector('.g1TourNext').textContent=index===TOUR_STEPS.length-1?copy.finish:copy.next;layer.querySelector('.g1TourClose').title=copy.close;
    requestAnimationFrame(function(){positionTour();});
  }
  function startGuidedTour(options){
    options=options||{};if(tourState.active)return;tourState.active=true;tourState.auto=options.auto===true;tourState.index=0;
    if(tourState.auto)markTourSeen();
    document.body.classList.add('g1TourOpen');var layer=ensureTourLayer();layer.classList.add('active');showTourStep(0);
    window.addEventListener('resize',positionTour);window.addEventListener('scroll',positionTour,true);
  }
  function endGuidedTour(skipped){
    if(!tourState.active)return;markTourSeen();tourState.active=false;document.body.classList.remove('g1TourOpen');window.removeEventListener('resize',positionTour);window.removeEventListener('scroll',positionTour,true);
    if(tourState.layer){tourState.layer.classList.remove('active');var old=tourState.layer;setTimeout(function(){if(!tourState.active&&old.isConnected)old.remove();if(tourState.layer===old)tourState.layer=null;},190);}
  }
  async function maybeStartGuidedTour(){
    try{var saved=await chrome.storage.local.get(ONBOARDING_SEEN_KEY);if(saved&&saved[ONBOARDING_SEEN_KEY]===APP_VERSION)return;}catch(_){ }
    setTimeout(function(){startGuidedTour({auto:true});},650);
  }
  window.addEventListener('graph1ks-language-changed',function(){syncThemeToggle();if(tourState.active)showTourStep(tourState.index);});

  async function init(){
    applyTheme(currentTheme(),false);
    var surfaceHandoff=consumeSurfaceHandoff();
    state.sidebarSide=localStorage.getItem('graph1ks_sidebar_side')==='left'?'left':'right';
    state.autoUsedAfterAutofill=localStorage.getItem('graph1ks_auto_used_after_autofill')==='1';
    state.autoNextAfterAutofill=localStorage.getItem('graph1ks_auto_next_after_autofill')==='1';
    state.fillMoreOptionsEnabled=localStorage.getItem('graph1ks_fill_more_options')!=='0';
    state.autoNormalizeImports=localStorage.getItem('graph1ks_auto_normalize_imports')!=='0';
    loadAutoFitSettings();
    $('#dbmAutoNormalizeImports').checked=state.autoNormalizeImports;
    await loadVaultRegistry();
    try{
      var fb=await chrome.runtime.sendMessage({type:'GET_FEEDBACK_CONFIG'});
      if(fb&&fb.ok&&fb.config){
        state.soundFeedback=fb.config.sound!==false;
        state.radialFeedback=fb.config.radial!==false;
        state.fillHotkeyEnabled=fb.config.fillHotkey!==false;
        state.retrieveHotkeyEnabled=fb.config.retrieveHotkey!==false;
      }
      await syncFeedbackConfig();
      var af=await chrome.runtime.sendMessage({type:'GET_AUTO_FILL_CONFIG'});
      if(af&&af.ok&&af.config){
        state.autoFillEnabled=af.config.enabled===true;
        state.autoFillSeconds=Math.max(1,Math.min(99,Number.parseInt(af.config.seconds,10)||8));
      }
      if(state.autoFillEnabled&&(!state.autoUsedAfterAutofill||!state.autoNextAfterAutofill)){
        state.autoFillEnabled=false;
        await syncAutoFillConfig();
      }
    }catch(_){}
    try{
      var ready=await chrome.runtime.sendMessage({type:'DECK_READY',surface:DECK_SURFACE,dockTabId:DOCK_TAB_ID});
      if(ready&&ready.ok&&ready.state){
        state.sunoContextActive=ready.state.deckOpen===true&&ready.state.sunoActive===true&&ready.state.enabled===true;
        state.sunoTabId=state.sunoContextActive&&Number.isInteger(ready.state.activeTabId)?ready.state.activeTabId:null;
      }else{
        var ctx=await chrome.runtime.sendMessage({type:'GET_EXTENSION_CONTEXT'});
        if(ctx&&ctx.ok&&ctx.state){state.sunoContextActive=ctx.state.deckOpen===true&&ctx.state.sunoActive===true&&ctx.state.enabled===true;state.sunoTabId=state.sunoContextActive&&Number.isInteger(ctx.state.activeTabId)?ctx.state.activeTabId:null;}
      }
    }catch(_){state.sunoContextActive=false;state.sunoTabId=null;}
    await maybeSeedFactoryPublicVault();
    // Upgrade every known Vault to the bundled authoritative taxonomy. Mapping
    // stores are replaced atomically; track records remain untouched.
    await migrateAllRegisteredGenreTaxonomies();
    var rememberedDataset='public';
    try{rememberedDataset=localStorage.getItem('graph1ks_last_vault_dataset')==='private'?'private':'public';}catch(_){}
    if(rememberedDataset==='private')await switchDataset('private');
    else await refresh();
    restoreLastListState();
    await restoreSurfaceHandoff(surfaceHandoff);
    await configureSurfaceControls();

    if(state.records.length){
      setImportStatus('Fast database ready · '+state.records.length+' lightweight index records loaded. Heavy prompt text is fetched only when needed.','ok');
    }
    maybeStartGuidedTour();
  }
  init().catch(function(error){setImportStatus('DATABASE STARTUP ERROR\nVersion: '+APP_VERSION+'\n'+(error.stack||error.message||String(error)),'error');});
})();
