/* Bilibili Digest content script. No credentials are read or stored. */
(() => {
  let observedUrl = location.href; let lastPromise = null; let lastUrl = ''; let lastAt = 0;
  function send(message) { return chrome.runtime.sendMessage(message).catch(() => null); }
  function notifyChange() {
    if (location.href === observedUrl) return;
    observedUrl = location.href; lastPromise = null; lastUrl = '';
    void send({ action: 'videoChanged' });
  }
  function readVideo() {
    const url = location.href;
    if (lastPromise && lastUrl === url && Date.now() - lastAt < 15000) return lastPromise;
    lastUrl = url; lastAt = Date.now();
    lastPromise = BD_SOURCE.loadVideo(url).then(result => {
      if (location.href !== url) throw new Error('视频已经切换，请重新提取。');
      return result;
    }).catch(e => { if (lastUrl === url) lastPromise = null; throw e; });
    return lastPromise;
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return false;
    if (message.action === 'readVideo') {
      if (message.refresh) lastPromise = null;
      readVideo().then(data => respond({ ok: true, ...data }), e => respond({ ok: false, code: e.code || 'VIDEO_CHANGED', error: e.code ? e.message : '视频已经切换，请重新提取。' })); return true;
    }
    const video = document.querySelector('video');
    if (message.action === 'getTime') { respond({ ok: true, time: video?.currentTime || 0 }); return false; }
    if (message.action === 'seekTo') {
      const seconds = Number(message.seconds);
      if (!video || !Number.isFinite(seconds) || seconds < 0 || seconds > 172800) { respond({ ok: false, error: '播放器暂未就绪，请稍后重试。' }); return false; }
      video.currentTime = Math.min(seconds, Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.05) : seconds);
      respond({ ok: true }); return false;
    }
    return false;
  });
  function mount() {
    const supported = Boolean(BD_CORE.parseVideoUrl(location.href));
    let button = document.getElementById('bili-digest-open');
    if (!supported) { button?.remove(); return; }
    if (button) return;
    button = document.createElement('button'); button.id = 'bili-digest-open'; button.type = 'button'; button.textContent = '字幕笔记';
    button.title = '打开 Bilibili Digest 侧边栏';
    button.style.cssText = 'position:fixed;left:24px;bottom:24px;z-index:9999;border:1px solid #ddbac7;border-radius:24px;padding:11px 18px;background:#fff8f5;color:#85234a;font:600 14px sans-serif;box-shadow:0 3px 16px #4a243022;cursor:pointer';
    button.addEventListener('click', async () => {
      const result = await send({ action: 'openPanel' });
      if (!result?.ok) { button.textContent = '请点扩展图标打开'; button.title = '若刚重新加载扩展，请先刷新此视频页面。'; }
    });
    document.body.appendChild(button);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
  setInterval(() => { notifyChange(); mount(); }, 800);
})();
