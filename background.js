const DECK_URL = chrome.runtime.getURL('deck.html');
const BOUNDS_KEY = 'graph1ks_deck_window_bounds';
const FEEDBACK_KEY = 'graph1ks_feedback_config';
const AUTO_FILL_KEY = 'graph1ks_auto_fill_config';
const POPUP_SESSION_KEY = 'graph1ks_deck_popup_session';
const POPUP_SUPPRESS_RESTORE_KEY = 'graph1ks_deck_popup_suppress_restore';
const SUNO_API_BASES = ['https://studio-api.prod.suno.com','https://studio-api-prod.suno.com'];

let deckWindowId = null;
let lastNormalWindowId = null;
let suppressedPopupRestoreIds = new Set();

function isSunoUrl(url='') {
  return /^https:\/\/(www\.)?suno\.com\//i.test(url);
}

async function setPopupSession(windowId, dockTabId) {
  const value = {
    windowId: Number.isInteger(windowId) ? windowId : null,
    dockTabId: Number.isInteger(dockTabId) ? dockTabId : null
  };
  try { await chrome.storage.session.set({[POPUP_SESSION_KEY]: value}); } catch (_) {}
  return value;
}

async function getPopupSession() {
  try {
    const value = (await chrome.storage.session.get(POPUP_SESSION_KEY))[POPUP_SESSION_KEY];
    return value && typeof value === 'object' ? value : null;
  } catch (_) {
    return null;
  }
}

async function clearPopupSession(windowId = null) {
  try {
    if (Number.isInteger(windowId)) {
      const current = await getPopupSession();
      if (current && current.windowId !== windowId) return;
    }
    await chrome.storage.session.remove(POPUP_SESSION_KEY);
  } catch (_) {}
}

async function persistSuppressedPopupRestoreIds() {
  try { await chrome.storage.session.set({[POPUP_SUPPRESS_RESTORE_KEY]: Array.from(suppressedPopupRestoreIds)}); } catch (_) {}
}

async function markPopupRestoreSuppressed(windowId) {
  if (!Number.isInteger(windowId)) return;
  suppressedPopupRestoreIds.add(windowId);
  await persistSuppressedPopupRestoreIds();
}

async function consumePopupRestoreSuppressed(windowId) {
  if (!Number.isInteger(windowId)) return false;
  let stored = [];
  try { stored = (await chrome.storage.session.get(POPUP_SUPPRESS_RESTORE_KEY))[POPUP_SUPPRESS_RESTORE_KEY] || []; } catch (_) {}
  stored.forEach(id => { if (Number.isInteger(id)) suppressedPopupRestoreIds.add(id); });
  const suppressed = suppressedPopupRestoreIds.delete(windowId);
  if (suppressed) await persistSuppressedPopupRestoreIds();
  return suppressed;
}

async function resolveSunoRestoreTab(preferredTabId = null) {
  if (Number.isInteger(preferredTabId)) {
    try {
      const tab = await chrome.tabs.get(preferredTabId);
      if (tab && isSunoUrl(tab.url)) return tab;
    } catch (_) {}
  }
  const active = await getActiveBrowserTab();
  if (active && isSunoUrl(active.url)) return active;
  try {
    const tabs = await chrome.tabs.query({url:['https://suno.com/*','https://www.suno.com/*']});
    return tabs[0] || null;
  } catch (_) {
    return null;
  }
}

async function getDeckWindows() {
  try {
    const wins = await chrome.windows.getAll({populate:true});
    return wins.filter(win => win.tabs?.some(tab => {
      const url = tab.url || tab.pendingUrl || '';
      return url.startsWith(DECK_URL);
    }));
  } catch (_) {
    return [];
  }
}

async function findDeckWindow() {
  if (Number.isInteger(deckWindowId)) {
    try {
      const win = await chrome.windows.get(deckWindowId, {populate:true});
      if (win?.tabs?.some(tab => {
        const url = tab.url || tab.pendingUrl || '';
        return url.startsWith(DECK_URL);
      })) return win;
    } catch (_) {}
    deckWindowId = null;
  }

  const wins = await getDeckWindows();
  const found = wins[0] || null;
  if (found) deckWindowId = found.id;
  return found;
}

async function closeDeckWindows(exceptWindowId = null) {
  const wins = await getDeckWindows();
  const closing = wins.filter(win => win.id !== exceptWindowId);
  await Promise.all(closing.map(async win => {
    try {
      await markPopupRestoreSuppressed(win.id);
      await chrome.windows.remove(win.id);
    } catch (_) {}
  }));
  if (closing.some(win => win.id === deckWindowId)) deckWindowId = null;
  if (Number.isInteger(exceptWindowId)) deckWindowId = exceptWindowId;
  return closing.length;
}

async function getActiveBrowserTab() {
  if (Number.isInteger(lastNormalWindowId)) {
    try {
      const win = await chrome.windows.get(lastNormalWindowId);
      if (win?.type === 'normal') {
        const tabs = await chrome.tabs.query({active:true, windowId:lastNormalWindowId});
        if (tabs[0]) return tabs[0];
      }
    } catch (_) {
      lastNormalWindowId = null;
    }
  }

  try {
    const win = await chrome.windows.getLastFocused({populate:true, windowTypes:['normal']});
    if (win?.type === 'normal') {
      lastNormalWindowId = win.id;
      const active = win.tabs?.find(tab => tab.active);
      if (active) return active;
    }
  } catch (_) {}

  try {
    const wins = await chrome.windows.getAll({populate:true, windowTypes:['normal']});
    const win = wins.find(item => item.focused) || wins[0];
    if (!win) return null;
    lastNormalWindowId = win.id;
    return win.tabs?.find(tab => tab.active) || null;
  } catch (_) {
    return null;
  }
}

async function getOverlayStatus(tab) {
  if (!tab || !Number.isInteger(tab.id) || !isSunoUrl(tab.url)) return {open:false, topmostOpen:false, autoHide:false, hidden:false, width:null};
  try {
    const result = await chrome.tabs.sendMessage(tab.id, {type:'GRAPH1KS_OVERLAY_STATUS'});
    if (result && result.ok) return result;
  } catch (_) {}
  return {open:false, topmostOpen:false, autoHide:false, hidden:false, width:null};
}

async function setOverlayForTab(tab, open, options={}) {
  if (!tab || !Number.isInteger(tab.id) || !isSunoUrl(tab.url)) {
    throw new Error('Open Suno in the active tab to use the Control Deck overlay.');
  }
  const result = await chrome.tabs.sendMessage(tab.id, {
    type:'GRAPH1KS_OVERLAY_SET',
    open:open===true,
    reveal:options.reveal!==false
  });
  if (!result || result.ok !== true) throw new Error(result?.message || 'Could not update the Suno overlay.');
  return result;
}

async function getContextState() {
  const [deckWindow, activeTab] = await Promise.all([
    findDeckWindow(),
    getActiveBrowserTab()
  ]);

  const sunoActive = !!(activeTab && isSunoUrl(activeTab.url));
  const overlay = sunoActive ? await getOverlayStatus(activeTab) : {open:false,topmostOpen:false,autoHide:false,hidden:false,width:null};
  const overlayOpen = overlay.open === true;
  const topmostOpen = overlay.topmostOpen === true;
  const deckOpen = !!deckWindow || overlayOpen || topmostOpen;

  return {
    deckOpen,
    deckSurface: topmostOpen ? 'topmost' : (overlayOpen ? 'overlay' : (deckWindow ? 'popup' : null)),
    overlayOpen,
    topmostOpen,
    overlayAutoHide: overlay.autoHide === true,
    overlayHidden: overlay.hidden === true,
    overlayWidth: Number.isFinite(overlay.width) ? overlay.width : null,
    deckWindowId: deckWindow?.id ?? null,
    activeTabId: activeTab?.id ?? null,
    activeUrl: activeTab?.url || '',
    sunoActive,
    enabled: deckOpen && sunoActive
  };
}

async function broadcastContextState() {
  const state = await getContextState();
  let sunoTabs = [];
  try {
    sunoTabs = await chrome.tabs.query({url:['https://suno.com/*','https://www.suno.com/*']});
  } catch (_) {}

  await Promise.all(sunoTabs.map(async tab => {
    const tabState = {
      ...state,
      enabled: state.deckOpen && state.sunoActive && tab.id === state.activeTabId
    };
    try {
      await chrome.tabs.sendMessage(tab.id, {type:'GRAPH1KS_CONTEXT_STATE', state:tabState});
    } catch (_) {}
  }));

  try {
    await chrome.runtime.sendMessage({type:'GRAPH1KS_BROWSER_CONTEXT', state});
  } catch (_) {}

  return state;
}

async function requireActiveSunoTab() {
  const state = await getContextState();
  if (!state.deckOpen) throw new Error('Control Deck is not open.');
  if (!state.sunoActive || !Number.isInteger(state.activeTabId)) {
    throw new Error('Suno must be the active browser tab.');
  }
  const tab = await chrome.tabs.get(state.activeTabId);
  if (!tab || !isSunoUrl(tab.url)) throw new Error('Suno must be the active browser tab.');
  return tab;
}

async function openDeckWindow(sourceTabId = null) {
  let sourceTab = null;
  if (Number.isInteger(sourceTabId)) {
    try {
      const candidate = await chrome.tabs.get(sourceTabId);
      if (candidate && isSunoUrl(candidate.url)) sourceTab = candidate;
    } catch (_) {}
  }
  if (!sourceTab) {
    const active = await getActiveBrowserTab();
    if (active && isSunoUrl(active.url)) sourceTab = active;
  }

  // Strict single popup instance. The Suno overlay is removed only after the
  // popup is created, preventing a visible gap during dock -> popout handoff.
  await closeDeckWindows();

  let saved = {};
  try { saved = (await chrome.storage.local.get(BOUNDS_KEY))[BOUNDS_KEY] || {}; } catch (_) {}
  const params = new URLSearchParams({surface:'popup'});
  if (Number.isInteger(sourceTab?.id)) params.set('dockTabId', String(sourceTab.id));
  const createData = {
    url: DECK_URL + '?' + params.toString(),
    type: 'popup',
    focused: true,
    width: saved.width || 1180,
    height: saved.height || 780
  };
  if (Number.isFinite(saved.left)) createData.left = saved.left;
  if (Number.isFinite(saved.top)) createData.top = saved.top;

  const win = await chrome.windows.create(createData);
  deckWindowId = win.id;
  await setPopupSession(deckWindowId, sourceTab?.id ?? null);

  if (sourceTab) {
    try { await setOverlayForTab(sourceTab, false); } catch (_) {}
  }

  await broadcastContextState();
  return {windowId: deckWindowId, reused:false, closedPrevious:true, surface:'popup', dockTabId:sourceTab?.id ?? null};
}

async function showOverlayForTab(tab, options={}) {
  if (!tab || !Number.isInteger(tab.id) || !isSunoUrl(tab.url)) {
    throw new Error('Open Suno in the active tab to use the Control Deck overlay.');
  }
  const result = await setOverlayForTab(tab, true, {reveal:true});
  if (options.closePopup !== false) await closeDeckWindows();
  await broadcastContextState();
  return {tabId:tab.id, surface:'overlay', ...result};
}

async function toggleDeckOverlay(preferredTab = null) {
  const activeTab = preferredTab && Number.isInteger(preferredTab.id) && isSunoUrl(preferredTab.url) ? preferredTab : await getActiveBrowserTab();
  if (!activeTab || !isSunoUrl(activeTab.url)) {
    throw new Error('GRAPH1KS Control Deck is Suno-only. Open a Suno tab first.');
  }
  const status = await getOverlayStatus(activeTab);
  if (status.topmostOpen) {
    try { await chrome.tabs.sendMessage(activeTab.id, {type:'GRAPH1KS_TOPMOST_CLOSE', restoreOverlay:false}); } catch (_) {}
    await broadcastContextState();
    return {tabId:activeTab.id, surface:'topmost', open:false};
  }
  if (status.open) {
    await setOverlayForTab(activeTab, false);
    await broadcastContextState();
    return {tabId:activeTab.id, surface:'overlay', open:false};
  }
  return await showOverlayForTab(activeTab, {closePopup:true});
}

async function openDeck() {
  return await toggleDeckOverlay();
}

async function getFeedbackConfig() {
  let stored = {};
  try { stored = (await chrome.storage.local.get(FEEDBACK_KEY))[FEEDBACK_KEY] || {}; } catch (_) {}
  return {sound: stored.sound !== false, radial: stored.radial !== false, fillHotkey: stored.fillHotkey !== false, retrieveHotkey: stored.retrieveHotkey !== false};
}

async function broadcastFeedbackConfig(config) {
  const tabs = await chrome.tabs.query({url:['https://suno.com/*','https://www.suno.com/*']});
  await Promise.all(tabs.map(async tab => {
    try { await chrome.tabs.sendMessage(tab.id, {type:'GRAPH1KS_FEEDBACK_CONFIG', config}); } catch (_) {}
  }));
}

async function saveFeedbackConfig(input={}) {
  const current = await getFeedbackConfig();
  const next = {
    sound: typeof input.sound === 'boolean' ? input.sound : current.sound,
    radial: typeof input.radial === 'boolean' ? input.radial : current.radial,
    fillHotkey: typeof input.fillHotkey === 'boolean' ? input.fillHotkey : current.fillHotkey,
    retrieveHotkey: typeof input.retrieveHotkey === 'boolean' ? input.retrieveHotkey : current.retrieveHotkey
  };
  await chrome.storage.local.set({[FEEDBACK_KEY]: next});
  await broadcastFeedbackConfig(next);
  return next;
}

async function getAutoFillConfig() {
  let stored = {};
  try { stored = (await chrome.storage.local.get(AUTO_FILL_KEY))[AUTO_FILL_KEY] || {}; } catch (_) {}
  const seconds = Math.max(1, Math.min(99, Number.parseInt(stored.seconds,10) || 8));
  return {enabled: stored.enabled === true, seconds};
}

async function broadcastAutoFillConfig(config) {
  const tabs = await chrome.tabs.query({url:['https://suno.com/*','https://www.suno.com/*']});
  await Promise.all(tabs.map(async tab => {
    try { await chrome.tabs.sendMessage(tab.id, {type:'GRAPH1KS_AUTO_FILL_CONFIG', config}); } catch (_) {}
  }));
}

async function saveAutoFillConfig(input={}) {
  const current = await getAutoFillConfig();
  const next = {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : current.enabled,
    seconds: Math.max(1, Math.min(99, Number.parseInt(input.seconds,10) || current.seconds || 8))
  };
  await chrome.storage.local.set({[AUTO_FILL_KEY]: next});
  await broadcastAutoFillConfig(next);
  return next;
}


function safeString(value) {
  return value == null ? '' : String(value);
}

async function fetchJsonWithTimeout(url, options={}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: Object.assign({'Accept':'application/json'}, options.headers || {}),
      body: options.body,
      credentials: options.credentials || 'omit',
      cache: 'no-store',
      signal: controller.signal
    });
    if (!response.ok) throw new Error('HTTP '+response.status+' for '+url);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSunoApiPath(path) {
  let lastError = null;
  for (const base of SUNO_API_BASES) {
    try {
      return await fetchJsonWithTimeout(base + path);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Suno API request failed.');
}

async function fetchSunoClip(songId) {
  const id = safeString(songId).trim();
  if (!/^[0-9a-f-]{20,}$/i.test(id)) throw new Error('Invalid Suno song ID.');
  const clip = await fetchSunoApiPath('/api/clip/' + encodeURIComponent(id));
  if (!clip || typeof clip !== 'object') throw new Error('Suno returned no clip metadata.');
  const returnedId = safeString(clip.id || clip.song_id || clip.clip_id || clip.uuid);
  if (returnedId && returnedId !== id) throw new Error('Suno clip ID mismatch.');
  return clip;
}

function findIdentityCandidate(root, wantedHandle) {
  const wanted = safeString(wantedHandle).replace(/^@/,'').toLowerCase();
  if (!root || typeof root !== 'object') return null;
  const stack = [root];
  const seen = new Set();
  let fallback = null;
  while (stack.length) {
    const value = stack.pop();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    const handle = safeString(value.handle || value.username || value.user_handle).replace(/^@/,'');
    const userId = safeString(value.user_id || value.userId || value.account_id || value.id);
    const displayName = safeString(value.display_name || value.displayName || value.name) || null;
    if (handle && (userId || displayName)) {
      const candidate = {userId:userId || null, handle, displayName};
      if (wanted && handle.toLowerCase() === wanted) return candidate;
      if (!fallback) fallback = candidate;
    }
    if (Array.isArray(value)) {
      for (let i=0;i<Math.min(value.length,100);i++) if (value[i] && typeof value[i] === 'object') stack.push(value[i]);
    } else {
      for (const child of Object.values(value).slice(0,150)) if (child && typeof child === 'object') stack.push(child);
    }
  }
  return fallback;
}

async function resolveSunoAccount(handle, displayName) {
  const cleanHandle = safeString(handle).replace(/^@/,'').trim();
  if (!cleanHandle) return null;

  // First try the profile-info endpoint. It is inexpensive and, when Suno
  // returns the full profile shape, gives us the stable user_id directly.
  try {
    const profile = await fetchSunoApiPath('/api/profiles/' + encodeURIComponent(cleanHandle) + '/info');
    const identity = findIdentityCandidate(profile, cleanHandle);
    if (identity && identity.userId) {
      return {
        userId: identity.userId,
        handle: identity.handle || cleanHandle,
        displayName: identity.displayName || displayName || null,
        confidence: 'profile-api'
      };
    }
  } catch (_) {}

  // Public profile HTML contains clip UUIDs. Resolve one exact public clip and
  // use its immutable owner user_id. This keeps the Vault keyed to account ID
  // even if the user later changes their handle.
  try {
    const response = await fetch('https://suno.com/@' + encodeURIComponent(cleanHandle), {
      method:'GET', credentials:'omit', cache:'no-store', headers:{'Accept':'text/html'}
    });
    if (response.ok) {
      const html = await response.text();
      const ids = Array.from(new Set((html.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/ig) || []))).slice(0,12);
      for (const id of ids) {
        try {
          const clip = await fetchSunoClip(id);
          const clipHandle = safeString(clip.handle).replace(/^@/,'');
          if (clipHandle && clipHandle.toLowerCase() === cleanHandle.toLowerCase() && clip.user_id) {
            return {
              userId: safeString(clip.user_id),
              handle: clipHandle,
              displayName: safeString(clip.display_name) || displayName || null,
              confidence: 'public-clip'
            };
          }
        } catch (_) {}
      }
    }
  } catch (_) {}

  return {userId:null, handle:cleanHandle, displayName:displayName || null, confidence:'handle-only'};
}

chrome.action.onClicked.addListener(tab => { toggleDeckOverlay(tab).catch(() => {}); });
chrome.commands.onCommand.addListener(command => {
  if (command === 'open-control-deck') openDeck().catch(() => {});
});

chrome.tabs.onActivated.addListener(async info => {
  try {
    const win = await chrome.windows.get(info.windowId);
    if (win?.type === 'normal') lastNormalWindowId = info.windowId;
  } catch (_) {}
  broadcastContextState().catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete' || tab?.active) {
    broadcastContextState().catch(() => {});
  }
});

chrome.tabs.onRemoved.addListener(() => {
  broadcastContextState().catch(() => {});
});

chrome.windows.onFocusChanged.addListener(async windowId => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    try {
      const win = await chrome.windows.get(windowId);
      if (win?.type === 'normal') lastNormalWindowId = windowId;
    } catch (_) {}
  }
  broadcastContextState().catch(() => {});
});

chrome.windows.onRemoved.addListener(id => {
  (async () => {
    if (id === lastNormalWindowId) lastNormalWindowId = null;

    const suppressed = await consumePopupRestoreSuppressed(id);
    const popupSession = await getPopupSession();
    const removedDeckPopup = id === deckWindowId || popupSession?.windowId === id;
    if (id === deckWindowId) deckWindowId = null;

    if (removedDeckPopup) {
      const dockTabId = Number.isInteger(popupSession?.dockTabId) ? popupSession.dockTabId : null;
      await clearPopupSession(id);

      // Manual X/close of the standalone Deck must never leave the Control
      // Deck closed. Return it to its Suno overlay automatically. Intentional
      // programmatic closes are marked above and do not trigger this fallback.
      if (!suppressed) {
        const target = await resolveSunoRestoreTab(dockTabId);
        if (target) {
          try { await setOverlayForTab(target, true, {reveal:true}); } catch (_) {}
        }
      }
    }

    await broadcastContextState();
  })().catch(() => {});
});

chrome.windows.onBoundsChanged.addListener(async win => {
  const deck = await findDeckWindow();
  if (!deck || win.id !== deck.id) return;
  try {
    await chrome.storage.local.set({[BOUNDS_KEY]: {
      left: win.left, top: win.top, width: win.width, height: win.height
    }});
  } catch (_) {}
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  if (message.type === 'SUNO_READY') {
    (async () => {
      const config = await getFeedbackConfig();
      const autoFill = await getAutoFillConfig();
      const context = await getContextState();
      const senderTabId = sender.tab?.id;
      return {
        tabId: senderTabId,
        config,
        autoFill,
        context: {
          ...context,
          enabled: context.deckOpen && context.sunoActive && senderTabId === context.activeTabId
        }
      };
    })().then(result => sendResponse({ok:true, ...result})).catch(error => sendResponse({ok:false,error:error.message||String(error)}));
    return true;
  }

  if (message.type === 'OPEN_DECK') {
    openDeck().then(result => sendResponse({ok:true,...result})).catch(error => sendResponse({ok:false,error:error.message||String(error)}));
    return true;
  }

  if (message.type === 'DECK_READY') {
    (async () => {
      const surface = message.surface === 'overlay' || message.surface === 'topmost' ? message.surface : 'popup';
      if (surface === 'popup' && Number.isInteger(sender.tab?.windowId) && String(sender.url || '').startsWith(DECK_URL)) {
        deckWindowId = sender.tab.windowId;
        await setPopupSession(deckWindowId, Number.isInteger(message.dockTabId) ? message.dockTabId : null);
        await closeDeckWindows(sender.tab.windowId);
      } else if (surface === 'overlay') {
        // Overlay readiness is reported without tearing down a popup here. The
        // explicit dock/open handoff closes the old surface after this one loads.
      }
      return await broadcastContextState();
    })().then(state => sendResponse({ok:true,state})).catch(error => sendResponse({ok:false,error:error.message||String(error)}));
    return true;
  }

  if (message.type === 'GET_EXTENSION_CONTEXT') {
    getContextState().then(state => sendResponse({ok:true,state})).catch(error => sendResponse({ok:false,error:error.message||String(error)}));
    return true;
  }

  if (message.type === 'DECK_POPOUT') {
    const sourceTabId = Number.isInteger(sender.tab?.id) && isSunoUrl(sender.tab?.url)
      ? sender.tab.id
      : (Number.isInteger(message.sourceTabId) ? message.sourceTabId : null);
    openDeckWindow(sourceTabId)
      .then(result => sendResponse({ok:true,...result}))
      .catch(error => sendResponse({ok:false,error:error.message||String(error)}));
    return true;
  }

  if (message.type === 'DECK_DOCK') {
    (async () => {
      let target = null;
      if (Number.isInteger(message.targetTabId)) {
        try {
          const candidate = await chrome.tabs.get(message.targetTabId);
          if (candidate && isSunoUrl(candidate.url)) target = candidate;
        } catch (_) {}
      }
      if (!target) {
        const active = await getActiveBrowserTab();
        if (active && isSunoUrl(active.url)) target = active;
      }
      if (!target) throw new Error('Open Suno in a browser tab before docking the Control Deck.');
      const result = await showOverlayForTab(target, {closePopup:false});
      // Respond before removing the popup that sent this request.
      setTimeout(() => { closeDeckWindows().catch(() => {}); }, 80);
      return result;
    })().then(result => sendResponse({ok:true,...result})).catch(error => sendResponse({ok:false,error:error.message||String(error)}));
    return true;
  }

  if (message.type === 'GET_OVERLAY_SETTINGS' || message.type === 'SET_OVERLAY_AUTOHIDE' || message.type === 'SET_OVERLAY_OPACITY') {
    (async () => {
      let target = null;
      if (Number.isInteger(sender.tab?.id) && isSunoUrl(sender.tab?.url)) target = sender.tab;
      if (!target && Number.isInteger(message.targetTabId)) {
        try {
          const candidate = await chrome.tabs.get(message.targetTabId);
          if (candidate && isSunoUrl(candidate.url)) target = candidate;
        } catch (_) {}
      }
      if (!target) {
        const active = await getActiveBrowserTab();
        if (active && isSunoUrl(active.url)) target = active;
      }
      if (!target) throw new Error('No Suno tab is available for overlay settings.');
      if (message.type === 'SET_OVERLAY_AUTOHIDE') {
        return await chrome.tabs.sendMessage(target.id, {type:'GRAPH1KS_OVERLAY_SET_AUTOHIDE', autoHide:message.autoHide===true});
      }
      if (message.type === 'SET_OVERLAY_OPACITY') {
        return await chrome.tabs.sendMessage(target.id, {type:'GRAPH1KS_OVERLAY_SET_OPACITY', opacity:message.opacity});
      }
      return await chrome.tabs.sendMessage(target.id, {type:'GRAPH1KS_OVERLAY_GET_SETTINGS'});
    })().then(result => sendResponse(result?.ok===false?result:{ok:true,...(result||{})})).catch(error => sendResponse({ok:false,error:error.message||String(error)}));
    return true;
  }

  if (message.type === 'OVERLAY_STATE_CHANGED') {
    setTimeout(() => { broadcastContextState().catch(() => {}); }, 0);
    sendResponse({ok:true});
    return;
  }

  if (message.type === 'DECK_CLOSING') {
    setTimeout(() => { broadcastContextState().catch(() => {}); }, 120);
    sendResponse({ok:true});
    return;
  }

  if (message.type === 'SUNO_FETCH_CLIP') {
    fetchSunoClip(message.songId)
      .then(clip => sendResponse({ok:true,clip}))
      .catch(error => sendResponse({ok:false,message:error.message||String(error)}));
    return true;
  }

  if (message.type === 'SUNO_RESOLVE_ACCOUNT') {
    resolveSunoAccount(message.handle, message.displayName)
      .then(account => sendResponse({ok:true,account}))
      .catch(error => sendResponse({ok:false,message:error.message||String(error)}));
    return true;
  }

  if (message.type === 'RETRIEVE_TO_DECK') {
    (async () => {
      // The content script only exposes R while its runtime is active. Avoid a
      // second full context/window resolution here; validate the sender only.
      if (!sender.tab || !Number.isInteger(sender.tab.id) || !isSunoUrl(sender.tab.url || sender.url || '')) {
        return {ok:false,message:'Retrieve ignored: invalid Suno source tab.'};
      }
      const target=sender.tab;
      let result;
      try {
        result = await chrome.runtime.sendMessage({
          type:'GRAPH1KS_RETRIEVED_RECORD',
          sourceTabId:sender.tab.id,
          record:message.record
        });
      } catch (_) {
        return {ok:false,message:'Control Deck is not open.'};
      }
      if (result && result.needsTitle) {
        const context = await getContextState();
        if (context.overlayOpen && context.activeTabId === target.id) {
          try { await chrome.tabs.sendMessage(target.id, {type:'GRAPH1KS_OVERLAY_REVEAL'}); } catch (_) {}
        } else {
          const deck = await findDeckWindow();
          if (deck) {
            try { await chrome.windows.update(deck.id,{focused:true}); } catch (_) {}
          }
        }
      }
      return result || {ok:false,message:'Control Deck returned no retrieval result.'};
    })().then(result => sendResponse(result)).catch(error => sendResponse({ok:false,message:error.message||String(error)}));
    return true;
  }

  if (message.type === 'GET_ACTIVE_SUNO_ACCOUNT') {
    (async () => {
      const tab = await requireActiveSunoTab();
      return await chrome.tabs.sendMessage(tab.id,{type:'GRAPH1KS_GET_CURRENT_ACCOUNT'});
    })().then(result => sendResponse(result)).catch(error => sendResponse({ok:false,message:error.message||String(error)}));
    return true;
  }

  if (message.type === 'RETRIEVE_ACTIVE_SUNO') {
    (async () => {
      const tab = await requireActiveSunoTab();
      return await chrome.tabs.sendMessage(tab.id,{type:'GRAPH1KS_RETRIEVE_CURRENT'});
    })().then(result => sendResponse(result)).catch(error => sendResponse({ok:false,message:error.message||String(error)}));
    return true;
  }

  if (message.type === 'AUTOFILL_TRACK') {
    (async () => {
      // Hotkey/Deck context already knows the active Suno tab. Route straight
      // back to that content script; fall back to the full resolver for older
      // manual callers without a source tab id.
      let tabId=Number.isInteger(message.sourceTabId)?message.sourceTabId:null;
      if(tabId){
        try {
          const candidate=await chrome.tabs.get(tabId);
          if(!candidate||!isSunoUrl(candidate.url||''))tabId=null;
        } catch (_) { tabId=null; }
      }
      if(!tabId&&message.directTarget===true){
        const tab=await resolveSunoRestoreTab();
        if(!tab)throw new Error('No Suno tab is available for direct fill.');
        tabId=tab.id;
      }
      if(!tabId){
        const tab=await requireActiveSunoTab();
        tabId=tab.id;
      }
      return await chrome.tabs.sendMessage(tabId, {
        type:'GRAPH1KS_AUTOFILL_TRACK',
        track: message.track,
        recordId: message.recordId,
        directFill: message.directTarget===true,
        fillMoreOptions: message.fillMoreOptions===true
      });
    })().then(result => sendResponse(result)).catch(error => sendResponse({ok:false,errorField:'Suno connection',message:error.message||String(error)}));
    return true;
  }

  if (message.type === 'F_HOTKEY_TRIGGER') {
    (async () => {
      // content.js already enforces runtime + F toggle state. Re-reading
      // storage and rebuilding browser context here only added hotkey latency.
      if (!sender.tab || !Number.isInteger(sender.tab.id) || !isSunoUrl(sender.tab.url || sender.url || '')) {
        return {ignored:true, reason:'invalid-suno-source'};
      }
      try {
        await chrome.runtime.sendMessage({type:'GRAPH1KS_F_HOTKEY_TRIGGER', sourceTabId:sender.tab.id});
        return {triggered:true};
      } catch (_) {
        return {ignored:true, reason:'deck-not-open'};
      }
    })().then(result => sendResponse({ok:true,result})).catch(error => sendResponse({ok:false,error:error.message||String(error)}));
    return true;
  }

  if (message.type === 'GET_AUTO_FILL_CONFIG') {
    getAutoFillConfig().then(config => sendResponse({ok:true,config})).catch(error => sendResponse({ok:false,error:error.message||String(error)}));
    return true;
  }

  if (message.type === 'SET_AUTO_FILL_CONFIG') {
    saveAutoFillConfig(message.config || {}).then(config => sendResponse({ok:true,config})).catch(error => sendResponse({ok:false,error:error.message||String(error)}));
    return true;
  }

  if (message.type === 'AUTO_FILL_STATUS') {
    (async () => {
      const state = await getContextState();
      if (!state.enabled || sender.tab?.id !== state.activeTabId) return;
      try {
        await chrome.runtime.sendMessage({
          type:'GRAPH1KS_AUTO_FILL_STATUS',
          sourceTabId:sender.tab?.id,
          status:message.status||{}
        });
      } catch (_) {}
    })().finally(() => sendResponse({ok:true}));
    return true;
  }

  if (message.type === 'AUTO_FILL_EXECUTE') {
    (async () => {
      const target = await requireActiveSunoTab();
      if (!sender.tab || sender.tab.id !== target.id) return {ok:false,message:'Auto Fill ignored: Suno is not the active browser tab.'};
      try {
        return await chrome.runtime.sendMessage({
          type:'GRAPH1KS_AUTO_FILL_EXECUTE',
          sourceTabId:sender.tab.id
        });
      } catch (_) {
        return {ok:false,message:'Control Deck is not open.'};
      }
    })().then(result => sendResponse(result||{ok:false,message:'No deck response.'})).catch(error => sendResponse({ok:false,message:error.message||String(error)}));
    return true;
  }

  if (message.type === 'AUTO_FILL_POST_VERIFY_CLICK') {
    (async () => {
      const target = await requireActiveSunoTab();
      if (!sender.tab || sender.tab.id !== target.id) return {ok:false,message:'Auto Fill click ignored: Suno is not the active browser tab.'};
      try {
        return await chrome.runtime.sendMessage({
          type:'GRAPH1KS_AUTO_FILL_POST_VERIFY_CLICK',
          sourceTabId:sender.tab.id
        });
      } catch (_) {
        return {ok:false,message:'Control Deck is not open.'};
      }
    })().then(result => sendResponse(result||{ok:false,message:'No deck response.'})).catch(error => sendResponse({ok:false,message:error.message||String(error)}));
    return true;
  }

  if (message.type === 'GET_FEEDBACK_CONFIG') {
    getFeedbackConfig().then(config => sendResponse({ok:true,config})).catch(error => sendResponse({ok:false,error:error.message||String(error)}));
    return true;
  }

  if (message.type === 'SET_FEEDBACK_CONFIG') {
    saveFeedbackConfig(message.config || {}).then(config => sendResponse({ok:true,config})).catch(error => sendResponse({ok:false,error:error.message||String(error)}));
    return true;
  }
});
