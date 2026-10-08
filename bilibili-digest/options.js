/* Settings UI; never copy credentials between providers. */
(() => {
  const S = YTD_SETTINGS, $ = id => document.getElementById(id); let persisted = S.normalize(), busy = false;
  function status(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
  function render(providerId = persisted.activeProvider) {
    const definition = S.PROVIDERS[providerId], profile = persisted.providers[providerId];
    $('provider').value = providerId; $('apiKey').value = profile.apiKey; $('model').value = profile.model; $('baseUrl').value = definition.editableBaseUrl ? profile.baseUrl : definition.baseUrl;
    $('model').readOnly = !definition.editableModel; $('baseUrl').readOnly = !definition.editableBaseUrl;
    $('providerDocs').replaceChildren();
    for (const [label, url] of [['官方文档', definition.docsUrl], ['获取 Key', definition.keyUrl]]) {
      if (!url) continue; const a = document.createElement('a'); a.textContent = label + ' ↗'; a.href = url; a.target = '_blank'; a.rel = 'noreferrer'; a.style.marginRight = '14px'; $('providerDocs').appendChild(a);
    }
    $('providerHint').textContent = providerId === 'kimi-code' ? '使用固定 kimi-for-coding，保留默认思考行为。' : providerId === 'openrouter' ? '输入完整模型 ID；首版采用手动填写，不自动下载模型目录。' : '以服务商当前文档为准，填写准确模型 ID。';
  }
  function candidate() {
    const id = $('provider').value, definition = S.PROVIDERS[id];
    const next = S.normalize({ ...persisted, activeProvider: id, providers: { ...persisted.providers, [id]: { ...persisted.providers[id], apiKey: $('apiKey').value.trim(), model: definition.editableModel ? $('model').value.trim() : definition.defaultModel, ...(definition.editableBaseUrl ? { baseUrl: $('baseUrl').value.trim() } : {}) } } });
    const profile = S.getActiveProfile(next);
    const base = S.validateCustomBaseUrl(definition.editableBaseUrl ? profile.baseUrl : definition.baseUrl);
    if (profile.apiKey) YTD_AI_PROVIDERS.buildRequest(definition, profile, { messages: [{ role: 'user', content: 'OK' }], maxTokens: 8 });
    return { settings: next, origin: `${new URL(base).origin}/*`, hasKey: Boolean(profile.apiKey) };
  }
  function setBusy(value) {
    busy = value;
    for (const id of ['provider', 'apiKey', 'model', 'baseUrl', 'saveSettings', 'testConnection', 'deleteKey']) $(id).disabled = value;
  }
  async function reload() { const data = await chrome.storage.local.get(S.STORAGE_KEY); persisted = S.normalize(data[S.STORAGE_KEY]); }
  async function submit(test) {
    if (busy) return;
    try {
      const form = candidate();
      if (test && !form.hasKey) { status('先填入当前服务的 API Key。', true); return; }
      // request must run synchronously within the click gesture, before awaits.
      const permission = form.hasKey ? chrome.permissions.request({ origins: [form.origin] }) : Promise.resolve(true);
      setBusy(true); status('正在确认模型连接权限…');
      if (!await permission) { status('未获得连接权限，设置未保存。可以再次点击保存并允许连接。', true); return; }
      if (!test) { await chrome.storage.local.set({ [S.STORAGE_KEY]: form.settings }); persisted = form.settings; render(); status('已保存。返回视频侧边栏即可使用。'); }
      else {
        const result = await chrome.runtime.sendMessage({ action: 'testAi', settings: form.settings });
        if (!result?.ok) throw Object.assign(new Error(result?.error || '后台暂未连接，请重新加载扩展后再测试。'), { code: 'CONTROLLED_BACKGROUND_ERROR' });
        status('连接成功。测试不会保存草稿，请点击“保存设置”。');
      }
    } catch (e) {
      // Adapter/URL validation messages are deterministic and contain no Key.
      status(e.code === 'CONTROLLED_BACKGROUND_ERROR' ? e.message : e.code ? '请检查 API Key、模型 ID 和接口地址是否填写完整。' : '配置或连接未完成，请检查模型 ID、接口地址、权限及后台状态。', true);
    } finally { setBusy(false); }
  }
  for (const id of S.PROVIDER_IDS) { const option = document.createElement('option'); option.value = id; option.textContent = S.PROVIDERS[id].name; $('provider').appendChild(option); }
  $('provider').addEventListener('change', () => { render($('provider').value); status('已切换服务，填写后点击保存。'); });
  $('saveSettings').addEventListener('click', () => submit(false)); $('testConnection').addEventListener('click', () => submit(true));
  $('deleteKey').addEventListener('click', async () => {
    if (busy) return; const target = $('provider').value; setBusy(true);
    try { await reload(); persisted.providers[target].apiKey = ''; await chrome.storage.local.set({ [S.STORAGE_KEY]: persisted }); render(target); status('此服务的 Key 已删除，其他服务设置保持不变。'); }
    catch { status('Key 删除未完成，请稍后重试。', true); } finally { setBusy(false); }
  });
  reload().then(() => render()).catch(() => status('无法读取本地设置，请重新加载扩展。', true));
})();
