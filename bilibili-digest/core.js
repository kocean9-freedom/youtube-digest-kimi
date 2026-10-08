/* Bilibili Digest — pure subtitle helpers. See THIRD_PARTY_NOTICES.md. */
var BD_CORE = (() => {
  const VIDEO_RE = /^BV[0-9A-Za-z]{10}$/;
  function parseVideoUrl(input) {
    try {
      const u = new URL(input);
      if (u.protocol !== 'https:' || u.hostname !== 'www.bilibili.com' || u.port || u.username || u.password) return null;
      const match = u.pathname.match(/^\/video\/(BV[0-9A-Za-z]{10})\/?$/);
      const pages = u.searchParams.getAll('p');
      if (!match || pages.length > 1 || (pages.length && !/^[1-9]\d{0,4}$/.test(pages[0]))) return null;
      return { bvid: match[1], page: Number(pages[0] || 1) };
    } catch { return null; }
  }
  function cleanText(text, max = 20000) {
    return typeof text === 'string' ? text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max) : '';
  }
  function parseMetadata(data, page) {
    const part = Array.isArray(data?.pages) ? data.pages.find(p => p.page === page) : null;
    if (!VIDEO_RE.test(data?.bvid || '') || !part || !Number.isSafeInteger(part.cid) || part.cid <= 0) throw new Error('无法识别当前分 P，请刷新视频页面。');
    return { bvid: data.bvid, aid: data.aid, cid: part.cid, page, part: cleanText(part.part, 500), title: cleanText(data.title, 500), author: cleanText(data.owner?.name, 300), description: cleanText(data.desc, 5000), duration: Number(part.duration) || 0, totalParts: data.pages.length, url: `https://www.bilibili.com/video/${data.bvid}/?p=${page}` };
  }
  function normalizeSubtitle(body) {
    if (!Array.isArray(body) || body.length > 100000) throw new Error('字幕格式不正确或段数过多。');
    return body.filter(s => typeof s?.from === 'number' && Number.isFinite(s.from) && typeof s.to === 'number' && Number.isFinite(s.to) && s.from >= 0 && s.to > s.from && s.to <= 172800 && typeof s.content === 'string' && s.content.length <= 20000)
      .map(s => ({ start: s.from, end: s.to, text: cleanText(s.content) })).filter(s => s.text).sort((a, b) => a.start - b.start);
  }
  function time(seconds) {
    const n = Math.max(0, Math.floor(Number(seconds) || 0));
    return n >= 3600 ? `${String(Math.floor(n / 3600)).padStart(2, '0')}:${String(Math.floor(n / 60) % 60).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}` : `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  }
  function srtTime(seconds) {
    const ms = Math.max(0, Math.round(seconds * 1000));
    return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
  }
  function markdown(text) {
    return String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/([\\`*_\[\]#|])/g, '\\$1');
  }
  function timestampUrl(video, seconds) {
    return `https://www.bilibili.com/video/${video.bvid}/?p=${video.page}&t=${Math.max(0, Math.floor(Number(seconds) || 0))}`;
  }
  function transcriptExport(video, segments, format = 'md') {
    if (format === 'srt') return segments.map((s, i) => `${i + 1}\n${srtTime(s.start)} --> ${srtTime(s.end)}\n${s.text}\n`).join('\n');
    const md = format === 'md';
    const t = md ? markdown : String;
    const header = `${md ? '# ' : ''}${t(video.title)}\n\nUP 主：${t(video.author)}\n视频：${video.url}\n分 P：${video.page} · ${t(video.part)}\nBV：${video.bvid} · cid：${video.cid}\n字幕来源：${t(video.source || 'B 站字幕')}\n\n${md ? '> ' : ''}以下内容来自字幕，可能包含识别错误；未包含视频画面。\n\n`;
    return header + segments.map(s => md ? `- [${time(s.start)}](${timestampUrl(video, s.start)}) ${t(s.text)}` : `[${time(s.start)}] ${s.text}`).join('\n') + '\n';
  }
  function filename(text) { return cleanText(text, 100).replace(/[\\/:*?"<>|]/g, '_').replace(/^[.\s]+|[.\s]+$/g, '') || 'bilibili-video'; }
  function cacheKey(video, language) { return `bili:${video.bvid}:${video.cid}:${encodeURIComponent(language)}`; }
  function chunkSegments(segments, maxChars = 12000, maxItems = 40) {
    const chunks = []; let batch = []; let size = 0;
    segments.forEach((s, id) => {
      if (batch.length && (size + s.text.length > maxChars || batch.length >= maxItems)) { chunks.push(batch); batch = []; size = 0; }
      batch.push({ ...s, id }); size += s.text.length;
    });
    if (batch.length) chunks.push(batch);
    return chunks;
  }
  function parseTranslation(raw, batch) {
    let data;
    try { data = JSON.parse(String(raw).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); } catch { throw new Error('翻译格式不正确，原文已保留。'); }
    if (!Array.isArray(data) || data.length !== batch.length) throw new Error('翻译无法与字幕对齐，原文已保留。');
    const map = new Map();
    for (const row of data) {
      if (!Number.isInteger(row?.id) || map.has(row.id) || typeof row.text !== 'string' || !row.text.trim() || row.text.length > 20000) throw new Error('翻译无法与字幕对齐，原文已保留。');
      map.set(row.id, cleanText(row.text));
    }
    return batch.map(row => { if (!map.has(row.id)) throw new Error('翻译无法与字幕对齐，原文已保留。'); return { id: row.id, text: map.get(row.id) }; });
  }
  function boundedEntries(raw, field, maxBytes = 2 * 1024 * 1024) {
    const result = {}; const encoder = new TextEncoder();
    const entries = Object.entries(raw || {}).filter(([, value]) => value && typeof value === 'object').sort((a, b) => (Number(b[1][field]) || 0) - (Number(a[1][field]) || 0));
    for (const [key, value] of entries) {
      if (Object.keys(result).length >= 12) break;
      if (encoder.encode(JSON.stringify({ ...result, [key]: value })).byteLength <= maxBytes) result[key] = value;
    }
    return result;
  }
  return { parseVideoUrl, parseMetadata, cleanText, normalizeSubtitle, time, srtTime, markdown, timestampUrl, transcriptExport, filename, cacheKey, chunkSegments, parseTranslation, boundedEntries };
})();
if (typeof module !== 'undefined') module.exports = BD_CORE;
