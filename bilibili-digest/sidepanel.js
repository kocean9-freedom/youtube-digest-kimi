/* Personal learning interface. Original subtitles are never sent to AI automatically. */
(() => {
  const C = BD_CORE; const $ = id => document.getElementById(id);
  let generation = 0, aiOperation = 0, tabId = null, signature = '';
  let video = null, tracks = [], selectedTrack = null, segments = [], translations = {}, summary = '', notes = [], selection = null;
  let aiReady = false, aiBusy = false, loading = false, persistQueue = Promise.resolve();
  function status(text = '', error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
  async function call(action, extra = {}) {
    let result;
    try { result = await chrome.runtime.sendMessage({ action, ...extra }); } catch { throw new Error('插件后台暂未连接。请重新加载扩展，并刷新 B 站视频页面。'); }
    if (!result?.ok) throw new Error(result?.error || '操作未完成，请稍后重试。');
    return result;
  }
  function active(token, op) { return token === generation && (op === undefined || op === aiOperation); }
  function sourceLabel(track) { return `${track?.label || track?.language || 'B 站字幕'}${track?.isAi ? '（站方 AI 字幕）' : '（站方字幕）'}`; }
  function setTab(name) {
    for (const button of document.querySelectorAll('[data-tab]')) { const yes = button.dataset.tab === name; button.classList.toggle('active', yes); button.setAttribute('aria-pressed', String(yes)); }
    for (const id of ['transcript', 'overview', 'notes']) $(`${id}Panel`).hidden = id !== name;
  }
  function buttons() {
    const available = Boolean(video && segments.length && !loading);
    for (const id of ['copyTranscript', 'exportTranscript', 'saveNote', 'useCurrentTime']) $(id).disabled = !available;
    for (const id of ['generateSummary', 'translate', 'polishNote']) $(id).disabled = !available || !aiReady || aiBusy;
    $('explainSelection').disabled = !available || !aiReady || aiBusy || !selection;
    $('noteSelection').disabled = !available || !selection;
    $('exportNotes').disabled = !notes.length;
    $('cancelAi').hidden = !aiBusy;
    $('track').disabled = loading || !tracks.length;
    const chunks = C.chunkSegments(segments, 12000, 2000);
    $('summaryHint').textContent = available ? `预计 ${chunks.length > 1 ? chunks.length + 1 : 1} 次模型请求。内容发送到你选定的服务商；不自动重试。` : '先提取字幕，再生成概览。';
    $('translate').textContent = Object.keys(translations).length === segments.length && segments.length ? '中文翻译已完成' : '生成中文翻译';
  }
  function clear() {
    video = null; tracks = []; selectedTrack = null; segments = []; translations = {}; summary = ''; notes = []; selection = null;
    aiOperation++; aiBusy = false; loading = true;
    $('videoTitle').textContent = '正在识别当前视频…'; $('videoMeta').textContent = ''; $('sourceLabel').textContent = '';
    $('track').replaceChildren(); $('subtitleList').replaceChildren(); $('notesList').replaceChildren(); $('summary').textContent = ''; $('copySummary').hidden = true;
    $('explanation').hidden = true; $('explanation').textContent = ''; $('segmentCount').textContent = '0'; $('noteCount').textContent = '0'; $('translationProgress').textContent = ''; $('noteText').value = ''; $('noteTime').value = '0';
    $('selectionHint').textContent = '选中字幕，可以讲解或摘录。'; buttons();
  }
  async function refreshSettings(token = generation) {
    const result = await call('getSettings'); if (!active(token)) return;
    aiReady = result.hasAiKey;
    $('aiNotice').textContent = aiReady ? `模型：${result.provider} · 仅在你点击时调用` : '字幕提取无需 AI Key。模型功能可在设置中开启。'; buttons();
  }
  async function load(refresh = false) {
    const token = ++generation; clear(); status('正在获取视频信息和字幕来源…');
    try {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); if (!active(token)) return;
      const tab = tabs[0]; const parsed = C.parseVideoUrl(tab?.url);
      tabId = tab?.id || null; signature = `${tabId}:${parsed?.bvid}:${parsed?.page}`;
      if (!parsed) { loading = false; $('videoTitle').textContent = '打开一个 B 站视频'; $('videoMeta').textContent = '支持普通 BV 视频和当前分 P'; status('请在 B 站普通视频页面打开此插件。'); buttons(); return; }
      await refreshSettings(token); if (!active(token)) return;
      const result = await call('getVideo', { tabId, refresh }); if (!active(token)) return;
      video = result.video; tracks = result.tracks;
      if (!video || !Array.isArray(tracks) || !tracks.length) throw new Error('未取得可用字幕，请确认登录和视频字幕状态。');
      $('videoTitle').textContent = video.title || '未命名视频'; $('videoMeta').textContent = `${video.author || 'B 站视频'} · P${video.page}/${video.totalParts} · ${video.part || ''}`;
      for (const [i, track] of tracks.entries()) { const option = document.createElement('option'); option.value = String(i); option.textContent = sourceLabel(track); $('track').appendChild(option); }
      const preferred = tracks.findIndex(t => !t.isAi && /^(zh|zh-CN|zh-Hans)/i.test(t.language));
      const fallback = tracks.findIndex(t => /^ai-zh|^zh/i.test(t.language));
      const index = preferred >= 0 ? preferred : fallback >= 0 ? fallback : 0;
      $('track').value = String(index); await loadTrack(index, token, refresh);
    } catch (e) { if (active(token)) { loading = false; status(e.message, true); if (!video) $('videoTitle').textContent = '还没有取得字幕'; buttons(); } }
  }
  async function loadTrack(index, token = generation, refresh = false) {
    const track = tracks[index]; if (!track || !video) return;
    const snapshot = { ...video, source: sourceLabel(track) }; selectedTrack = track; video = snapshot;
    segments = []; translations = {}; summary = ''; selection = null; aiOperation++; aiBusy = false; loading = true;
    $('summary').textContent = ''; $('copySummary').hidden = true; $('explanation').hidden = true; $('translationProgress').textContent = ''; $('subtitleList').replaceChildren(); buttons(); status('正在下载字幕…');
    $('sourceLabel').textContent = snapshot.source;
    const result = await call('fetchSubtitle', { video: snapshot, track, refresh }); if (!active(token) || selectedTrack !== track) return;
    segments = result.segments; loading = false; $('segmentCount').textContent = String(segments.length);
    await loadResults(token); if (!active(token) || selectedTrack !== track) return;
    renderTranscript(); renderSummary(); await loadNotes(token); if (!active(token)) return;
    buttons(); status(`已取得 ${segments.length} 段字幕${result.cached ? ' · 本地缓存' : ''}。${result.cacheWarning ? '这份字幕未写入缓存，仍可阅读和导出。' : '可复制或导出给 Codex 阅读。'}`);
  }
  async function loadResults(token) {
    const key = C.cacheKey(video, selectedTrack.language); const stored = await chrome.storage.local.get('bili_results'); if (!active(token)) return;
    const result = stored.bili_results?.[key]; const hash = await fingerprint(); if (!active(token)) return;
    if (result && result.fingerprint === hash) { summary = typeof result.summary === 'string' ? result.summary : ''; translations = result.translations && typeof result.translations === 'object' ? result.translations : {}; }
  }
  async function fingerprint() {
    const bytes = new TextEncoder().encode(JSON.stringify(segments.map(s => [s.start, s.end, s.text])));
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  }
  async function persistResults() {
    if (!video || !selectedTrack) return false;
    const key = C.cacheKey(video, selectedTrack.language), token = generation;
    const value = { summary, translations: { ...translations }, updatedAt: Date.now() };
    value.fingerprint = await fingerprint(); if (!active(token)) return false;
    const pending = persistQueue.then(async () => {
      if (!active(token)) return false;
      try {
        const data = await chrome.storage.local.get('bili_results'); if (!active(token)) return false;
        const entries = C.boundedEntries({ ...(data.bili_results || {}), [key]: value }, 'updatedAt');
        await chrome.storage.local.set({ bili_results: entries }); return Object.hasOwn(entries, key);
      } catch { return false; }
    }); persistQueue = pending.catch(() => false); return pending;
  }
  function renderTranscript() {
    const container = $('subtitleList'); container.replaceChildren(); selection = null;
    const mode = $('displayMode').value, query = $('search').value.trim().toLocaleLowerCase(); let found = 0;
    segments.forEach((segment, index) => {
      const translated = translations[index];
      const matches = !query || `${segment.text}\n${translated || ''}`.toLocaleLowerCase().includes(query);
      const row = document.createElement('div'); row.className = 'subtitle-row'; row.dataset.index = String(index); row.hidden = !matches; if (matches) found++;
      const seek = document.createElement('button'); seek.type = 'button'; seek.className = 'seek'; seek.textContent = C.time(segment.start); seek.title = '跳转到 ' + C.time(segment.start); seek.addEventListener('click', () => seekTo(segment.start));
      const copy = document.createElement('div'); copy.className = 'subtitle-copy';
      if (mode !== 'zh' || !translated) { const original = document.createElement('div'); original.textContent = segment.text; original.className = 'original'; copy.appendChild(original); }
      if (mode !== 'original' && translated) { const translation = document.createElement('div'); translation.textContent = translated; translation.className = 'translated'; copy.appendChild(translation); }
      row.append(seek, copy); container.appendChild(row);
    });
    $('searchCount').textContent = query ? `${found} 段` : '';
    if (query && !found) { const empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = '没有找到匹配字幕，试试其他关键词。'; container.appendChild(empty); }
    buttons();
  }
  async function seekTo(seconds) { try { await call('seekTo', { tabId, seconds }); } catch (e) { status(e.message, true); } }
  function renderTimestampText(container, text) {
    container.replaceChildren(); const regex = /\[((?:\d{1,2}:)?\d{1,3}:\d{2})\]/g; let at = 0;
    for (const match of text.matchAll(regex)) {
      container.appendChild(document.createTextNode(text.slice(at, match.index)));
      const time = match[1].split(':').reduce((n, p) => n * 60 + Number(p), 0);
      const button = document.createElement('button'); button.type = 'button'; button.className = 'timestamp-link'; button.textContent = match[0]; button.addEventListener('click', () => seekTo(time)); container.appendChild(button); at = match.index + match[0].length;
    }
    container.appendChild(document.createTextNode(text.slice(at)));
  }
  function renderSummary() { renderTimestampText($('summary'), summary); $('copySummary').hidden = !summary; }
  async function loadNotes(token = generation) {
    if (!video) return;
    const snapshot = video; const result = await call('getNotes', { video: snapshot }); if (!active(token) || video.cid !== snapshot.cid || video.bvid !== snapshot.bvid) return;
    notes = result.notes; renderNotes();
  }
  function renderNotes() {
    $('notesList').replaceChildren(); $('noteCount').textContent = String(notes.length);
    for (const note of notes) {
      const card = document.createElement('article'); card.className = 'note-card';
      const actions = document.createElement('div'); actions.className = 'note-actions';
      const seek = document.createElement('button'); seek.type = 'button'; seek.textContent = C.time(note.seconds) + ' ↗'; seek.addEventListener('click', () => seekTo(note.seconds));
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'delete-note'; remove.textContent = '删除'; remove.addEventListener('click', async () => {
        const token = generation, snapshot = video;
        try { const result = await call('deleteNote', { video: snapshot, id: note.id }); if (active(token)) { notes = result.notes; renderNotes(); } } catch (e) { if (active(token)) status(e.message, true); }
      });
      const text = document.createElement('p'); text.textContent = note.text; actions.append(seek, remove); card.append(actions, text); $('notesList').appendChild(card);
    }
    buttons();
  }
  async function saveNote(text = $('noteText').value, seconds = Number($('noteTime').value)) {
    if (!video || !text.trim()) { status('先写下一条笔记。', true); return; }
    const token = generation; const snapshot = video;
    try { const result = await call('saveNote', { video: snapshot, text, seconds }); if (!active(token)) return; notes = result.notes; $('noteText').value = ''; renderNotes(); status('笔记已保存在本地。'); } catch (e) { if (active(token)) status(e.message, true); }
  }
  function download(text, name) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function displayedSegments() { const mode = $('displayMode').value; return segments.map((s, i) => ({ ...s, text: mode === 'zh' && translations[i] ? translations[i] : mode === 'bilingual' && translations[i] ? `${s.text}\n${translations[i]}` : s.text })); }
  async function copy(text) { try { await navigator.clipboard.writeText(text); status('已复制，可以粘贴给 Codex。'); } catch { status('无法写入剪贴板，请使用导出文件。', true); } }
  function startAi() { if (aiBusy || !aiReady) return null; aiBusy = true; const op = ++aiOperation; buttons(); return { token: generation, op }; }
  function endAi(job) { if (active(job.token, job.op)) { aiBusy = false; buttons(); } }
  async function ai(kind, text, job) { if (!active(job.token, job.op)) return null; const result = await call('ai', { input: { kind, text } }); return active(job.token, job.op) ? result.text : null; }
  async function generateSummary() {
    const job = startAi(); if (!job) return;
    const snapshot = video, batches = C.chunkSegments(segments, 12000, 2000); const pieces = [];
    try {
      for (const [i, batch] of batches.entries()) {
        if (!active(job.token, job.op)) return; status(`正在整理字幕 ${i + 1}/${batches.length}…`);
        const text = await ai('summary', `视频：${snapshot.title}\n分 P：${snapshot.page}\n${batch.map(s => `[${C.time(s.start)}] ${s.text}`).join('\n')}`, job); if (text === null) return; pieces.push(text);
      }
      let output = pieces[0];
      if (pieces.length > 1) { status('正在合并各段概览…'); const combined = pieces.join('\n\n'); if (combined.length > 60000) throw new Error('分段概览过长，建议导出字幕交给 Codex 分析。'); output = await ai('combine', combined, job); }
      if (!active(job.token, job.op) || output === null) return; summary = output; renderSummary(); const saved = await persistResults(); if (active(job.token, job.op)) status(saved ? '概览已生成；点击时间戳可以回看。' : '概览已生成，但未写入本地缓存；请及时复制。');
    } catch (e) { if (active(job.token, job.op)) status(e.message, true); } finally { endAi(job); }
  }
  async function translate() {
    const job = startAi(); if (!job) return;
    const batches = C.chunkSegments(segments, 5000, 32); let allCached = true;
    try {
      for (const [i, batch] of batches.entries()) {
        if (!active(job.token, job.op)) return; if (batch.every(s => translations[s.id])) continue;
        $('translationProgress').textContent = `${i + 1}/${batches.length} 批`; status('正在翻译字幕，已完成的译文会保留。');
        const raw = await ai('translation', JSON.stringify(batch.map(s => ({ id: s.id, text: s.text }))), job); if (raw === null) return;
        for (const row of C.parseTranslation(raw, batch)) translations[row.id] = row.text;
        $('displayMode').value = 'bilingual'; renderTranscript(); allCached = await persistResults() && allCached;
      }
      if (active(job.token, job.op)) { $('translationProgress').textContent = '完成'; status(allCached ? '中文翻译已完成。' : '中文翻译已完成，但未全部写入缓存；请及时导出。'); }
    } catch (e) { if (active(job.token, job.op)) status(e.message, true); } finally { endAi(job); }
  }
  function captureSelection() {
    const selected = window.getSelection(); const node = selected?.anchorNode; const element = node?.nodeType === 1 ? node : node?.parentElement; const row = element?.closest('.subtitle-row');
    const focusNode = selected?.focusNode; const focus = focusNode?.nodeType === 1 ? focusNode : focusNode?.parentElement;
    if (!row || !focus?.closest('#subtitleList') || !selected.toString().trim()) return;
    const index = Number(row.dataset.index); if (!segments[index]) return;
    selection = { text: selected.toString().trim().slice(0, 10000), seconds: segments[index].start, index };
    $('selectionHint').textContent = `已选中 ${selection.text.length} 字 · ${C.time(selection.seconds)}`; buttons();
  }
  document.addEventListener('mouseup', captureSelection); document.addEventListener('keyup', captureSelection);
  for (const button of document.querySelectorAll('[data-tab]')) button.addEventListener('click', () => setTab(button.dataset.tab));
  $('settings').addEventListener('click', () => chrome.runtime.openOptionsPage()); $('refresh').addEventListener('click', () => load(true));
  $('track').addEventListener('change', async () => { const token = ++generation; try { await loadTrack(Number($('track').value), token); } catch (e) { if (active(token)) { loading = false; status(e.message, true); buttons(); } } });
  $('search').addEventListener('input', renderTranscript); $('displayMode').addEventListener('change', () => { renderTranscript(); if ($('displayMode').value !== 'original' && !Object.keys(translations).length) status('还没有中文译文，请先点击“生成中文翻译”。'); });
  $('copyTranscript').addEventListener('click', () => copy(C.transcriptExport(video, displayedSegments(), 'txt')));
  $('exportTranscript').addEventListener('click', () => { const format = $('exportFormat').value; const label = $('displayMode').value === 'original' ? video.source : `${video.source} · ${$('displayMode').value === 'zh' ? 'AI 中文译文（未完成段保留原文）' : '原文与 AI 译文'} `; download(C.transcriptExport({ ...video, source: label }, displayedSegments(), format), `${C.filename(video.title)}-P${video.page}-字幕.${format}`); });
  $('copySummary').addEventListener('click', () => copy(summary)); $('generateSummary').addEventListener('click', generateSummary); $('translate').addEventListener('click', translate);
  $('cancelAi').addEventListener('click', () => { aiOperation++; aiBusy = false; buttons(); status('已停止后续请求。已发送的模型请求仍可能计费，已完成内容已保留。'); });
  $('saveNote').addEventListener('click', () => saveNote()); $('noteSelection').addEventListener('click', () => { if (selection) void saveNote(selection.text, selection.seconds); });
  $('useCurrentTime').addEventListener('click', async () => { const token = generation; try { const result = await call('getTime', { tabId }); if (active(token)) $('noteTime').value = String(Math.round(result.time * 1000) / 1000); } catch (e) { if (active(token)) status(e.message, true); } });
  $('explainSelection').addEventListener('click', async () => {
    if (!selection) return; const job = startAi(); if (!job) return; const picked = selection;
    try { const text = await ai('explain', `视频：${video.title}\n选中：${picked.text}\n上下文：\n${segments.slice(Math.max(0, picked.index - 2), picked.index + 3).map(s => `[${C.time(s.start)}] ${s.text}`).join('\n')}`, job); if (text !== null) { $('explanation').textContent = text; $('explanation').hidden = false; status('片段讲解已生成。'); } } catch (e) { if (active(job.token, job.op)) status(e.message, true); } finally { endAi(job); }
  });
  $('polishNote').addEventListener('click', async () => {
    const original = $('noteText').value; if (!original.trim()) { status('先写下一条笔记。', true); return; } const job = startAi(); if (!job) return;
    try { const text = await ai('cleanup', original, job); if (text !== null && $('noteText').value === original) { $('noteText').value = text; status('笔记已润色，点击保存即可留下。'); } } catch (e) { if (active(job.token, job.op)) status(e.message, true); } finally { endAi(job); }
  });
  $('exportNotes').addEventListener('click', () => download(`# ${C.markdown(video.title)} · P${video.page} 学习笔记\n\n视频：${video.url}\n\n${notes.map(n => `## [${C.time(n.seconds)}](${C.timestampUrl(video, n.seconds)})\n\n${C.markdown(n.text)}\n`).join('\n')}`, `${C.filename(video.title)}-P${video.page}-笔记.md`));
  chrome.runtime.onMessage.addListener(message => { if (message.action === 'frontVideoChanged' && message.tabId === tabId) void load(); });
  chrome.tabs.onActivated.addListener(() => load());
  chrome.tabs.onUpdated.addListener((id, change, tab) => { if (id !== tabId || !change.url) return; const p = C.parseVideoUrl(tab.url); if (`${id}:${p?.bvid}:${p?.page}` !== signature) void load(); });
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.bili_settings) void refreshSettings().catch(() => {}); });
  window.addEventListener('focus', () => refreshSettings().catch(() => {}));
  void load();
})();
