/* Bilibili subtitle source. Browser-managed sessions; never read cookies. */
var BD_SOURCE = (() => {
  const C = typeof BD_CORE !== 'undefined' ? BD_CORE : require('./core.js');
  const MAX_BYTES = 2 * 1024 * 1024;
  const MESSAGES = {
    LOGIN_REQUIRED: '这些字幕需要登录 B 站。请在视频页面自行登录，然后重新提取。',
    NO_SUBTITLE: '暂未取得字幕。请确认已登录且播放器有可用字幕；只有画面内字幕的视频无法直接提取。',
    ACCESS_RESTRICTED: 'B 站暂时限制了这次请求。请确认视频能正常播放，稍后手动重试。',
    HTTP_ERROR: '字幕服务请求失败，请稍后重试。', NETWORK_ERROR: '无法连接字幕服务，请检查网络后重试。',
    INVALID_RESPONSE: '字幕服务返回了无法识别的内容，请刷新页面重试。',
    RESPONSE_TOO_LARGE: '字幕数据超过 2 MiB，已停止读取。', EMPTY_SUBTITLE: '字幕文件为空或没有有效字幕段。',
    UNSAFE_SUBTITLE_URL: '字幕文件来源不符合要求，已停止下载。', INVALID_VIDEO: '请打开 B 站普通 BV 视频页面。',
    REQUEST_TIMEOUT: '字幕服务超过 15 秒未响应，请稍后手动重试。',
  };
  class SourceError extends Error { constructor(code) { super(MESSAGES[code] || MESSAGES.INVALID_RESPONSE); this.code = code; } }
  function subtitleUrl(raw) {
    try {
      const u = new URL(String(raw).startsWith('//') ? `https:${raw}` : raw);
      if (u.protocol !== 'https:' || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.hdslb\.com$/i.test(u.hostname) || u.port || u.username || u.password || !/^\/bfs\/(?:ai_)?subtitle\//.test(u.pathname)) throw new Error();
      u.hash = ''; return u.href;
    } catch { throw new SourceError('UNSAFE_SUBTITLE_URL'); }
  }
  async function readJson(response) {
    if (!response.ok) throw new SourceError('HTTP_ERROR');
    if (Number(response.headers?.get('content-length')) > MAX_BYTES) throw new SourceError('RESPONSE_TOO_LARGE');
    const reader = response.body?.getReader?.();
    let text = '';
    if (reader) {
      const decoder = new TextDecoder(); let size = 0;
      try {
        while (true) {
          const { value, done } = await reader.read(); if (done) break;
          size += value.byteLength;
          if (size > MAX_BYTES) { await reader.cancel(); throw new SourceError('RESPONSE_TOO_LARGE'); }
          text += decoder.decode(value, { stream: true });
        }
        text += decoder.decode();
      } finally { reader.releaseLock(); }
    } else {
      text = await response.text();
      if (new TextEncoder().encode(text).length > MAX_BYTES) throw new SourceError('RESPONSE_TOO_LARGE');
    }
    try { return JSON.parse(text); } catch { throw new SourceError('INVALID_RESPONSE'); }
  }
  async function request(url, fetchImpl, credentials) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try { return await readJson(await fetchImpl(url, { credentials, redirect: 'error', signal: controller.signal, headers: { Accept: 'application/json' } })); }
    catch (e) { if (e instanceof SourceError) throw e; throw new SourceError(controller.signal.aborted ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR'); }
    finally { clearTimeout(timer); }
  }
  function unwrap(result) {
    if (result?.code === -101) throw new SourceError('LOGIN_REQUIRED');
    if ([-352, -412, -403].includes(result?.code)) throw new SourceError('ACCESS_RESTRICTED');
    if (result?.code !== 0 || !result.data) throw new SourceError('INVALID_RESPONSE');
    return result.data;
  }
  async function loadVideo(input, fetchImpl = fetch) {
    const parsed = C.parseVideoUrl(input); if (!parsed) throw new SourceError('INVALID_VIDEO');
    const meta = unwrap(await request(`https://api.bilibili.com/x/web-interface/view?bvid=${parsed.bvid}`, fetchImpl, 'include'));
    let video;
    try { video = C.parseMetadata(meta, parsed.page); } catch { throw new SourceError('INVALID_VIDEO'); }
    if (video.bvid !== parsed.bvid) throw new SourceError('INVALID_RESPONSE');
    const info = unwrap(await request(`https://api.bilibili.com/x/player/wbi/v2?bvid=${parsed.bvid}&cid=${video.cid}`, fetchImpl, 'include'));
    const tracks = (Array.isArray(info.subtitle?.subtitles) ? info.subtitle.subtitles : []).slice(0, 50).map((t, i) => {
      try { return { id: String(t.id_str || t.id || i), language: C.cleanText(t.lan, 40), label: C.cleanText(t.lan_doc || t.lan, 100), url: subtitleUrl(t.subtitle_url), isAi: String(t.lan || '').startsWith('ai-') }; } catch { return null; }
    }).filter(t => t?.language);
    if (!tracks.length) throw new SourceError(info.need_login_subtitle ? 'LOGIN_REQUIRED' : 'NO_SUBTITLE');
    return { video, tracks };
  }
  async function loadSubtitle(raw, fetchImpl = fetch) {
    const data = await request(subtitleUrl(raw), fetchImpl, 'omit');
    let segments;
    try { segments = C.normalizeSubtitle(data.body); } catch { throw new SourceError('INVALID_RESPONSE'); }
    if (!segments.length) throw new SourceError('EMPTY_SUBTITLE');
    return segments;
  }
  return { SourceError, subtitleUrl, readJson, loadVideo, loadSubtitle, MAX_BYTES };
})();
if (typeof module !== 'undefined') module.exports = BD_SOURCE;
