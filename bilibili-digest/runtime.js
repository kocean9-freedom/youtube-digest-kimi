var BD_RUNTIME = (() => {
  const C = typeof BD_CORE !== 'undefined' ? BD_CORE : require('./core.js');
  function trustedPage(api, sender) {
    return sender?.id === api.runtime.id && ['sidepanel.html', 'options.html'].some(p => sender.url === api.runtime.getURL(p));
  }
  function safeVideo(raw) {
    if (!/^BV[0-9A-Za-z]{10}$/.test(raw?.bvid || '') || !Number.isSafeInteger(raw.cid) || raw.cid < 1 || !Number.isSafeInteger(raw.page) || raw.page < 1 || raw.page > 99999) throw new Error('视频信息不正确，请重新提取。');
    return { bvid: raw.bvid, cid: raw.cid, page: raw.page, part: C.cleanText(raw.part, 500), title: C.cleanText(raw.title, 500), author: C.cleanText(raw.author, 300), description: C.cleanText(raw.description, 5000), source: C.cleanText(raw.source, 150), duration: Math.max(0, Math.min(Number(raw.duration) || 0, 172800)), totalParts: Math.max(1, Math.min(Number(raw.totalParts) || 1, 99999)), url: `https://www.bilibili.com/video/${raw.bvid}/?p=${raw.page}` };
  }
  return { trustedPage, safeVideo };
})();
if (typeof module !== 'undefined') module.exports = BD_RUNTIME;
