importScripts('core.js', 'source.js', 'runtime.js', 'settings.js', 'ai-providers.js', 'ai-client.js');

chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => {});
let notesQueue = Promise.resolve();
const failure = (code, error) => ({ ok: false, code, error });
async function currentTab(tabId) {
  const tab = Number.isInteger(tabId) ? await chrome.tabs.get(tabId) : (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  if (!tab || !BD_CORE.parseVideoUrl(tab.url)) throw Object.assign(new Error('请打开 B 站普通 BV 视频页面。'), { code: 'INVALID_VIDEO' });
  return tab;
}
async function relay(tabId, payload) {
  const tab = await currentTab(tabId);
  try { return await chrome.tabs.sendMessage(tab.id, payload); }
  catch { throw Object.assign(new Error('请刷新 B 站视频页面，再打开插件。'), { code: 'CONTENT_SCRIPT_UNAVAILABLE' }); }
}
async function getSettings() {
  const data = await chrome.storage.local.get(YTD_SETTINGS.STORAGE_KEY);
  return YTD_SETTINGS.normalize(data[YTD_SETTINGS.STORAGE_KEY]);
}
async function saveCache(key, value) {
  // Two MiB per cache leaves room for results, notes and configuration within
  // Chrome's 10 MiB local quota. Caching must never prevent subtitle reading.
  try {
    const stored = await chrome.storage.local.get('bili_cache');
    const cache = BD_CORE.boundedEntries({ ...(stored.bili_cache || {}), [key]: { ...value, savedAt: Date.now() } }, 'savedAt');
    await chrome.storage.local.set({ bili_cache: cache });
    return Object.hasOwn(cache, key);
  } catch { return false; }
}
async function handle(message, sender) {
  if (!BD_RUNTIME.trustedPage(chrome, sender)) return failure('UNTRUSTED_SENDER', '该请求来源不可用。');
  switch (message.action) {
    case 'getSettings': {
      // The side panel needs readiness only, never the actual Key.
      const settings = await getSettings();
      if (sender.url === chrome.runtime.getURL('options.html')) return { ok: true, settings };
      return { ok: true, hasAiKey: Boolean(YTD_SETTINGS.getActiveCredential(settings)), provider: YTD_SETTINGS.getActiveProvider(settings).name };
    }
    case 'getVideo': return relay(message.tabId, { action: 'readVideo', refresh: Boolean(message.refresh) });
    case 'getTime': return relay(message.tabId, { action: 'getTime' });
    case 'seekTo': return relay(message.tabId, { action: 'seekTo', seconds: message.seconds });
    case 'fetchSubtitle': {
      const video = BD_RUNTIME.safeVideo(message.video); const track = message.track;
      const url = BD_SOURCE.subtitleUrl(track?.url);
      const key = BD_CORE.cacheKey(video, BD_CORE.cleanText(track?.language, 40));
      const stored = await chrome.storage.local.get('bili_cache'); const cached = stored.bili_cache?.[key];
      if (!message.refresh && cached?.segments?.length && Date.now() - cached.savedAt < 86400000) return { ok: true, segments: cached.segments, cached: true };
      const segments = await BD_SOURCE.loadSubtitle(url);
      const saved = await saveCache(key, { segments }); return { ok: true, segments, cacheWarning: !saved };
    }
    case 'ai': {
      const text = await BD_AI.complete(message.input, await getSettings(), { hasPermission: origin => chrome.permissions.contains({ origins: [origin] }) });
      return { ok: true, text };
    }
    case 'testAi': {
      if (sender.url !== chrome.runtime.getURL('options.html')) return failure('UNTRUSTED_SENDER', '请在设置页测试连接。');
      const text = await BD_AI.complete({ kind: 'test', text: 'OK' }, message.settings, { hasPermission: origin => chrome.permissions.contains({ origins: [origin] }) });
      return { ok: true, text: text.slice(0, 100) };
    }
    case 'getNotes': {
      const video = BD_RUNTIME.safeVideo(message.video); const stored = await chrome.storage.local.get('bili_notes');
      const notes = (stored.bili_notes || []).filter(n => n.bvid === video.bvid && n.cid === video.cid);
      return { ok: true, notes };
    }
    case 'saveNote':
    case 'deleteNote': {
      const operation = async () => {
        const video = BD_RUNTIME.safeVideo(message.video); const stored = await chrome.storage.local.get('bili_notes'); let notes = Array.isArray(stored.bili_notes) ? stored.bili_notes : [];
        if (message.action === 'deleteNote') notes = notes.filter(n => !(n.id === message.id && n.bvid === video.bvid && n.cid === video.cid));
        else {
          const text = BD_CORE.cleanText(message.text, 10000); const seconds = Number(message.seconds);
          if (!text || !Number.isFinite(seconds) || seconds < 0 || seconds > 172800) return failure('INVALID_NOTE', '请填写有效笔记。');
          if (notes.length >= 1000) return failure('NOTES_FULL', '已有 1000 条笔记，请导出并整理后继续保存。');
          notes.unshift({ ...video, id: crypto.randomUUID(), text, seconds, createdAt: Date.now() });
          if (new TextEncoder().encode(JSON.stringify(notes)).byteLength > 4 * 1024 * 1024) return failure('NOTES_FULL', '笔记已达到 4 MiB 存储上限，请先导出并整理笔记。');
        }
        await chrome.storage.local.set({ bili_notes: notes });
        return { ok: true, notes: notes.filter(n => n.bvid === video.bvid && n.cid === video.cid) };
      };
      const pending = notesQueue.then(operation); notesQueue = pending.catch(() => {}); return pending;
    }
    default: return failure('UNKNOWN_ACTION', '插件暂不支持此操作。');
  }
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  const isVideoPage = sender.id === chrome.runtime.id && sender.frameId === 0 && BD_CORE.parseVideoUrl(sender.tab?.url);
  if (message.action === 'openPanel' && isVideoPage) {
    // Do not await before opening: the content-button click is the user gesture.
    chrome.sidePanel.setOptions({ tabId: sender.tab.id, path: 'sidepanel.html', enabled: true }).catch(() => {});
    chrome.sidePanel.open({ tabId: sender.tab.id }).then(() => respond({ ok: true }), () => respond(failure('PANEL_OPEN_FAILED', '请点击扩展图标打开侧边栏。'))); return true;
  }
  if (message.action === 'videoChanged' && isVideoPage) {
    chrome.runtime.sendMessage({ action: 'frontVideoChanged', tabId: sender.tab.id }).catch(() => {}); respond({ ok: true }); return false;
  }
  if (!BD_RUNTIME.trustedPage(chrome, sender)) { respond(failure('UNTRUSTED_SENDER', '该请求来源不可用。')); return false; }
  handle(message, sender).then(respond, e => {
    const isSource = e instanceof BD_SOURCE.SourceError;
    const known = ['INVALID_VIDEO', 'CONTENT_SCRIPT_UNAVAILABLE'].includes(e?.code);
    respond(failure(e?.code || 'REQUEST_FAILED', isSource || known ? e.message : e?.code?.startsWith('AI_') || e?.provider || e?.code === 'MISSING_AI_KEY' ? BD_AI.userMessage(e) : '操作未完成，请稍后重试。'));
  }); return true;
});
chrome.action.onClicked.addListener(tab => {
  if (!BD_CORE.parseVideoUrl(tab.url)) return;
  chrome.sidePanel.setOptions({ tabId: tab.id, path: 'sidepanel.html', enabled: true }).catch(() => {});
  chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
});
chrome.tabs?.onUpdated?.addListener((tabId, change, tab) => {
  if (!change.url && change.status !== 'complete') return;
  chrome.sidePanel.setOptions({ tabId, path: 'sidepanel.html', enabled: Boolean(BD_CORE.parseVideoUrl(tab.url)) }).catch(() => {});
});
