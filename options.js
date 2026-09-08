const YTD_OPTIONS = (() => {
  const LANGUAGE_STORAGE_KEY = "ytd_options_language";
  const PREVIEW_STORAGE_PREFIX = "youtubeDigestPreview:";
  const OPENROUTER_MODELS_CACHE_KEY = "ytd_openrouter_models";
  const OPENROUTER_MODELS_CACHE_MS = 24 * 60 * 60 * 1000;
  const SUPPORTED_LANGUAGES = new Set(["en", "zh-CN"]);
  const REQUIRED_HOST_ORIGINS = new Set([
    "https://www.youtube.com/*",
    "https://api.supadata.ai/*",
    "https://api.kimi.com/*",
  ]);

  function getSettingsApi() {
    if (typeof YTD_SETTINGS !== "undefined") return YTD_SETTINGS;
    if (typeof require === "function") return require("./settings.js");
    throw new Error("Settings helpers are unavailable.");
  }

  function providerIdForMode(mode, advancedProviderId) {
    if (mode === "kimi") return "kimi-code";
    if (mode === "openrouter") return "openrouter";
    const settingsApi = getSettingsApi();
    return settingsApi.ADVANCED_PROVIDER_IDS.includes(advancedProviderId)
      ? advancedProviderId
      : "openai";
  }

  function buildSettingsFromForm(current, formValue) {
    const settingsApi = getSettingsApi();
    const normalized = settingsApi.normalize(current);
    const activeProvider = Object.hasOwn(
      settingsApi.PROVIDERS,
      formValue.activeProvider,
    )
      ? formValue.activeProvider
      : settingsApi.KIMI_PROVIDER_ID;
    const providers = Object.fromEntries(
      Object.entries(normalized.providers).map(([id, profile]) => [
        id,
        { ...profile },
      ]),
    );
    const definition = settingsApi.PROVIDERS[activeProvider];
    const activeProfile = {
      ...providers[activeProvider],
      apiKey: String(formValue.apiKey || "").trim(),
    };
    if (definition.editableModel) {
      activeProfile.model = String(formValue.model || "").trim();
    }
    if (definition.editableBaseUrl) {
      activeProfile.baseUrl = String(formValue.baseUrl || "").trim();
    }
    providers[activeProvider] = activeProfile;
    return settingsApi.normalize({
      aiConfigVersion: settingsApi.CONFIG_VERSION,
      activeProvider,
      providers,
      supadataApiKey: String(formValue.supadataApiKey || "").trim(),
    });
  }

  function clearProviderKey(persisted, providerId) {
    const settingsApi = getSettingsApi();
    const normalized = settingsApi.normalize(persisted);
    if (!Object.hasOwn(settingsApi.PROVIDERS, providerId)) return normalized;
    return settingsApi.normalize({
      ...normalized,
      providers: {
        ...normalized.providers,
        [providerId]: {
          ...normalized.providers[providerId],
          apiKey: "",
        },
      },
    });
  }

  function requiredOriginPattern(settings) {
    const settingsApi = getSettingsApi();
    const normalized = settingsApi.normalize(settings);
    const provider = settingsApi.getActiveProvider(normalized);
    const profile = settingsApi.getActiveProfile(normalized);
    const baseUrl = provider.editableBaseUrl
      ? profile.baseUrl
      : provider.baseUrl;
    const url = new URL(settingsApi.validateCustomBaseUrl(baseUrl));
    return `${url.origin}/*`;
  }

  async function requestProviderPermission(chromeApi, originPattern) {
    if (!chromeApi?.permissions) return true;
    // Call request directly while the save/test click still owns the user
    // gesture. Chrome returns true without another prompt when already granted.
    return chromeApi.permissions.request({ origins: [originPattern] });
  }

  function optionalOriginsToRemove(origins) {
    return (Array.isArray(origins) ? origins : []).filter(
      (origin) => !REQUIRED_HOST_ORIGINS.has(origin),
    );
  }

  function filterOpenRouterModels(models, query, limit = 100) {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 200));
    return (Array.isArray(models) ? models : [])
      .filter(
        (model) =>
          typeof model?.id === "string" &&
          typeof model?.name === "string" &&
          (!normalizedQuery ||
            model.id.toLowerCase().includes(normalizedQuery) ||
            model.name.toLowerCase().includes(normalizedQuery)),
      )
      .slice(0, safeLimit)
      .map((model) => ({ id: model.id, name: model.name }));
  }

  function isModelCacheFresh(cachedAt, now = Date.now()) {
    return (
      Number.isFinite(cachedAt) &&
      cachedAt > 0 &&
      now - cachedAt >= 0 &&
      now - cachedAt < OPENROUTER_MODELS_CACHE_MS
    );
  }

  async function fetchOpenRouterModels(fetchImpl, apiKey) {
    const key = String(apiKey || "").trim();
    if (!key) throw new Error("OpenRouter API key is required.");
    const response = await fetchImpl("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!response.ok) {
      throw new Error(`OpenRouter models request failed with HTTP ${response.status}.`);
    }
    const data = await response.json();
    if (!Array.isArray(data?.data)) {
      throw new Error("OpenRouter returned an invalid model list.");
    }
    return data.data
      .filter((model) => typeof model?.id === "string" && model.id.trim())
      .slice(0, 5000)
      .map((model) => {
        const id = model.id.trim().slice(0, 256);
        const name =
          typeof model.name === "string" && model.name.trim()
            ? model.name.trim().slice(0, 256)
            : id;
        return { id, name };
      });
  }

  const COPY = {
    en: {
      pageTitle: "YouTube Digest Settings",
      languageGroupLabel: "Interface language",
      heading: "Bring your own API keys",
      ledeMulti:
        "Keys stay in this Chrome profile. AI content is sent only to the provider you select.",
      transcriptProvider: "Transcript provider",
      supadataApiKeyLabel: "Supadata API key",
      supadataHelp: "Used to fetch timestamped YouTube subtitles. ",
      supadataLink: "Create a Supadata account and key",
      supadataHelpSuffix:
        ". Supadata generates the key during onboarding.",
      aiProvider: "AI provider",
      providerChoiceHelp:
        "Choose one mode. Saved keys stay separate for every provider.",
      providerModeLabel: "AI provider mode",
      modeKimiTitle: "Kimi Coding Plan",
      modeKimiCopy: "Default and ready with your Kimi Coding Plan key.",
      modeOpenRouterTitle: "OpenRouter simple",
      modeOpenRouterCopy: "Use one key to choose from many hosted models.",
      modeAdvancedTitle: "Official / custom",
      modeAdvancedCopy: "Connect directly with official or compatible APIs.",
      defaultModeBadge: "Default mode",
      kimiApiKeyLabel: "Kimi Code API key",
      kimiLink: "Create a Kimi Code API key",
      kimiFixedHelp:
        "Uses the fixed kimi-for-coding model with Thinking ON. ",
      openrouterApiKeyLabel: "OpenRouter API key",
      modelSearchLabel: "Search model directory",
      refreshModels: "Refresh models",
      modelIdLabel: "Model ID",
      openrouterHelp:
        "The directory is cached for 24 hours. You can always type a model ID manually. ",
      openrouterKeyLink: "Create an OpenRouter key",
      directProviderLabel: "Direct provider",
      providerApiKeyLabel: "Provider API key",
      baseUrlLabel: "Base URL",
      providerDocs: "Official provider documentation",
      selectedProviderPrivacy:
        "Transcripts, selected text, and note-cleanup context go only to the selected provider. OpenRouter may route them to the chosen model's host.",
      testConnection: "Test connection",
      deleteCurrentKey: "Delete current provider key",
      saveSettings: "Save settings",
      localData: "Local data",
      localDataHelp:
        "Digests, translations, notes, provider settings, and keys are stored only in this Chrome profile.",
      clearCache: "Clear cached digests",
      deleteNotes: "Delete all notes",
      resetData: "Reset extension data",
      footer:
        'Read <a href="PRIVACY.md" target="_blank">PRIVACY.md</a> in the repository for the complete data-flow description.',
      saving: "Saving…",
      addSupadataKey: "Add a Supadata API key.",
      saved: "Saved. Reopen YouTube Digest to use these settings.",
      providerKeyRequired: "Add an API key for the selected provider.",
      modelRequired: "Enter the exact model ID for the selected provider.",
      permissionDenied:
        "Chrome access was not granted for the selected provider origin.",
      testingConnection: "Testing connection. This may use a small amount of quota…",
      connectionOk: ({ provider }) => `${provider} connection succeeded.`,
      connectionFailed: ({ provider, message }) =>
        `${provider} connection failed: ${message}`,
      modelsLoading: "Loading the OpenRouter model directory…",
      modelsLoaded: ({ count }) => `Loaded ${count} OpenRouter models.`,
      modelsFailed:
        "Could not load the model directory. Enter a model ID manually.",
      deleteCurrentKeyConfirm: ({ provider }) =>
        `Delete the saved ${provider} API key from this Chrome profile?`,
      currentKeyDeleted: ({ provider }) => `${provider} API key deleted.`,
      clearedDigests: ({ count }) =>
        `Cleared ${count} cached digest${count === 1 ? "" : "s"}.`,
      notesDeleted: "Deleted all saved notes.",
      resetConfirm:
        "Delete API keys, cached digests, translations, and saved notes from this Chrome profile?",
      allDataDeleted: "All YouTube Digest data was deleted.",
      settingsLoadFailed:
        "Could not load saved settings. You can still preview this page.",
    },
    "zh-CN": {
      pageTitle: "YouTube Digest 设置",
      languageGroupLabel: "界面语言",
      heading: "使用你自己的 API 密钥",
      ledeMulti:
        "密钥仅保存在当前 Chrome 个人资料中。AI 内容只会发送给你主动选择的服务。",
      transcriptProvider: "字幕服务",
      supadataApiKeyLabel: "Supadata API 密钥",
      supadataHelp: "用于获取带时间戳的 YouTube 字幕。",
      supadataLink: "创建 Supadata 账号并获取密钥",
      supadataHelpSuffix: "。Supadata 会在引导流程中生成密钥。",
      aiProvider: "AI 服务",
      providerChoiceHelp: "选择一种模式。每个服务已保存的密钥相互独立。",
      providerModeLabel: "AI 服务模式",
      modeKimiTitle: "Kimi Coding Plan",
      modeKimiCopy: "默认模式，填写 Kimi Coding Plan 密钥即可使用。",
      modeOpenRouterTitle: "OpenRouter 简易模式",
      modeOpenRouterCopy: "使用一个密钥选择大量托管模型。",
      modeAdvancedTitle: "官方 / 自定义接口",
      modeAdvancedCopy: "直接连接官方接口或兼容服务。",
      defaultModeBadge: "默认模式",
      kimiApiKeyLabel: "Kimi Code API 密钥",
      kimiLink: "创建 Kimi Code API 密钥",
      kimiFixedHelp: "固定使用 kimi-for-coding，并保持 Thinking ON。",
      openrouterApiKeyLabel: "OpenRouter API 密钥",
      modelSearchLabel: "搜索模型目录",
      refreshModels: "刷新模型",
      modelIdLabel: "模型 ID",
      openrouterHelp: "模型目录缓存 24 小时，也可以随时手动填写模型 ID。",
      openrouterKeyLink: "创建 OpenRouter 密钥",
      directProviderLabel: "直连服务",
      providerApiKeyLabel: "当前服务的 API 密钥",
      baseUrlLabel: "Base URL",
      providerDocs: "当前服务官方文档",
      selectedProviderPrivacy:
        "字幕、选中文本和笔记润色上下文只会发送给当前服务。OpenRouter 可能把内容路由给所选模型的托管方。",
      testConnection: "测试连接",
      deleteCurrentKey: "删除当前服务密钥",
      saveSettings: "保存设置",
      localData: "本地数据",
      localDataHelp:
        "摘要、翻译、笔记、服务设置和密钥仅保存在当前 Chrome 个人资料中。",
      clearCache: "清除缓存的摘要",
      deleteNotes: "删除全部笔记",
      resetData: "重置扩展数据",
      footer:
        '完整数据流说明请参阅仓库中的 <a href="PRIVACY.md" target="_blank">PRIVACY.md</a>。',
      saving: "正在保存…",
      addSupadataKey: "请添加 Supadata API 密钥。",
      saved: "已保存。请重新打开 YouTube Digest 以使用这些设置。",
      providerKeyRequired: "请填写当前所选服务的 API 密钥。",
      modelRequired: "请填写当前所选服务的准确模型 ID。",
      permissionDenied: "未授予访问当前服务接口域名的 Chrome 权限。",
      testingConnection: "正在测试连接，此操作可能消耗少量额度……",
      connectionOk: ({ provider }) => `${provider} 连接成功。`,
      connectionFailed: ({ provider, message }) =>
        `${provider} 连接失败：${message}`,
      modelsLoading: "正在加载 OpenRouter 模型目录……",
      modelsLoaded: ({ count }) => `已加载 ${count} 个 OpenRouter 模型。`,
      modelsFailed: "无法加载模型目录，请手动填写模型 ID。",
      deleteCurrentKeyConfirm: ({ provider }) =>
        `要从当前 Chrome 个人资料中删除 ${provider} API 密钥吗？`,
      currentKeyDeleted: ({ provider }) => `已删除 ${provider} API 密钥。`,
      clearedDigests: ({ count }) => `已清除 ${count} 条缓存摘要。`,
      notesDeleted: "已删除全部已保存的笔记。",
      resetConfirm:
        "要从当前 Chrome 个人资料中删除 API 密钥、缓存摘要、翻译和已保存的笔记吗？",
      allDataDeleted: "已删除全部 YouTube Digest 数据。",
      settingsLoadFailed: "无法加载已保存的设置，但你仍可预览此页面。",
    },
  };

  function normalizeLanguage(language) {
    return SUPPORTED_LANGUAGES.has(language) ? language : "en";
  }

  function translate(language, key, params = {}) {
    const normalizedLanguage = normalizeLanguage(language);
    const value = COPY[normalizedLanguage][key] ?? COPY.en[key] ?? "";
    return typeof value === "function" ? value(params) : value;
  }

  function createStorageAdapter(chromeApi, fallbackStorage) {
    const chromeStorage = chromeApi?.storage?.local;
    const memoryStorage = new Map();

    function fallbackKeys() {
      const keys = [];
      if (!fallbackStorage) return keys;
      try {
        for (let index = 0; index < fallbackStorage.length; index += 1) {
          const key = fallbackStorage.key(index);
          if (key?.startsWith(PREVIEW_STORAGE_PREFIX)) keys.push(key);
        }
      } catch (_error) {
        return [];
      }
      return keys;
    }

    function readFallbackValue(key) {
      try {
        const rawValue = fallbackStorage?.getItem(
          `${PREVIEW_STORAGE_PREFIX}${key}`,
        );
        if (rawValue !== null && rawValue !== undefined) {
          return JSON.parse(rawValue);
        }
      } catch (_error) {
        // Fall through to memory when localStorage is unavailable or malformed.
      }
      return memoryStorage.get(key);
    }

    function writeFallbackValue(key, value) {
      memoryStorage.set(key, value);
      try {
        fallbackStorage?.setItem(
          `${PREVIEW_STORAGE_PREFIX}${key}`,
          JSON.stringify(value),
        );
      } catch (_error) {
        // The in-memory copy keeps a restricted preview functional.
      }
    }

    return {
      async get(keys) {
        if (chromeStorage) return chromeStorage.get(keys);

        const requestedKeys =
          keys === null
            ? [
                ...new Set([
                  ...memoryStorage.keys(),
                  ...fallbackKeys().map((key) =>
                    key.slice(PREVIEW_STORAGE_PREFIX.length),
                  ),
                ]),
              ]
            : Array.isArray(keys)
              ? keys
              : [keys];

        return Object.fromEntries(
          requestedKeys
            .map((key) => [key, readFallbackValue(key)])
            .filter(([, value]) => value !== undefined),
        );
      },

      async set(items) {
        if (chromeStorage) return chromeStorage.set(items);
        for (const [key, value] of Object.entries(items)) {
          writeFallbackValue(key, value);
        }
      },

      async remove(keys) {
        if (chromeStorage) return chromeStorage.remove(keys);
        for (const key of Array.isArray(keys) ? keys : [keys]) {
          memoryStorage.delete(key);
          try {
            fallbackStorage?.removeItem(`${PREVIEW_STORAGE_PREFIX}${key}`);
          } catch (_error) {
            // Memory removal is sufficient for this preview session.
          }
        }
      },

      async clear() {
        if (chromeStorage) return chromeStorage.clear();
        memoryStorage.clear();
        for (const key of fallbackKeys()) {
          try {
            fallbackStorage.removeItem(key);
          } catch (_error) {
            // Continue clearing any remaining preview keys.
          }
        }
      },
    };
  }

  async function readPreferredLanguage(storage) {
    const stored = await storage.get(LANGUAGE_STORAGE_KEY);
    return normalizeLanguage(stored[LANGUAGE_STORAGE_KEY]);
  }

  async function persistPreferredLanguage(storage, language) {
    const normalizedLanguage = normalizeLanguage(language);
    await storage.set({ [LANGUAGE_STORAGE_KEY]: normalizedLanguage });
    return normalizedLanguage;
  }

  function updateLanguageButtonState(buttons, language) {
    const normalizedLanguage = normalizeLanguage(language);
    for (const button of buttons) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.language === normalizedLanguage),
      );
    }
  }

  function getSafeLocalStorage(root) {
    try {
      return root.localStorage;
    } catch (_error) {
      return null;
    }
  }

  function initialize(root = globalThis) {
    const doc = root.document;
    const settingsApi = root.YTD_SETTINGS;
    if (!doc || !settingsApi) return;

    const storage = createStorageAdapter(root.chrome, getSafeLocalStorage(root));
    const form = doc.getElementById("settingsForm");
    const supadataInput = doc.getElementById("supadataApiKey");
    const kimiKeyInput = doc.getElementById("kimiApiKey");
    const openrouterKeyInput = doc.getElementById("openrouterApiKey");
    const openrouterModelInput = doc.getElementById("openrouterModel");
    const modelSearchInput = doc.getElementById("openrouterModelSearch");
    const modelList = doc.getElementById("openrouterModelList");
    const advancedProviderInput = doc.getElementById("advancedProvider");
    const advancedKeyInput = doc.getElementById("advancedApiKey");
    const advancedModelInput = doc.getElementById("advancedModel");
    const advancedBaseUrlInput = doc.getElementById("advancedBaseUrl");
    const advancedBaseUrlGroup = doc.getElementById("advancedBaseUrlGroup");
    const providerDocsLink = doc.getElementById("providerDocsLink");
    const protocolLabel = doc.getElementById("protocolLabel");
    const providerBadge = doc.getElementById("activeProviderBadge");
    const permissionOrigin = doc.getElementById("permissionOrigin");
    const saveStatus = doc.getElementById("saveStatus");
    const dataStatus = doc.getElementById("dataStatus");
    const languageButtons = [...doc.querySelectorAll("[data-language]")];
    const modeInputs = [...doc.querySelectorAll('input[name="providerMode"]')];
    const providerPanels = [...doc.querySelectorAll("[data-provider-panel]")];
    const statusStates = new Map();
    let currentLanguage = "en";
    let currentSettings = settingsApi.normalize();
    let openrouterModels = [];
    let renderedProviderId = null;

    function renderStatus(element) {
      const state = statusStates.get(element);
      element.textContent = state
        ? translate(currentLanguage, state.key, state.params)
        : "";
    }

    function setStatus(element, key, params = {}) {
      statusStates.set(element, { key, params });
      renderStatus(element);
    }

    function applyLanguage(language) {
      currentLanguage = normalizeLanguage(language);
      doc.documentElement.lang = currentLanguage;
      doc.title = translate(currentLanguage, "pageTitle");
      for (const element of doc.querySelectorAll("[data-i18n]")) {
        element.textContent = translate(currentLanguage, element.dataset.i18n);
      }
      for (const element of doc.querySelectorAll("[data-i18n-html]")) {
        element.innerHTML = translate(
          currentLanguage,
          element.dataset.i18nHtml,
        );
      }
      for (const element of doc.querySelectorAll("[data-i18n-aria-label]")) {
        element.setAttribute(
          "aria-label",
          translate(currentLanguage, element.dataset.i18nAriaLabel),
        );
      }
      updateLanguageButtonState(languageButtons, currentLanguage);
      for (const element of statusStates.keys()) renderStatus(element);
    }

    function selectedMode() {
      return modeInputs.find((input) => input.checked)?.value || "kimi";
    }

    function selectedProviderId() {
      return providerIdForMode(selectedMode(), advancedProviderInput.value);
    }

    function setModeForProvider(providerId) {
      const mode = settingsApi.PROVIDERS[providerId]?.mode || "kimi";
      for (const input of modeInputs) input.checked = input.value === mode;
      if (mode === "advanced") advancedProviderInput.value = providerId;
    }

    function activeFieldValues() {
      const providerId = selectedProviderId();
      if (providerId === "kimi-code") {
        return { providerId, apiKey: kimiKeyInput.value, model: "", baseUrl: "" };
      }
      if (providerId === "openrouter") {
        return {
          providerId,
          apiKey: openrouterKeyInput.value,
          model: openrouterModelInput.value,
          baseUrl: "",
        };
      }
      return {
        providerId,
        apiKey: advancedKeyInput.value,
        model: advancedModelInput.value,
        baseUrl: advancedBaseUrlInput.value,
      };
    }

    function captureRenderedProvider() {
      if (!renderedProviderId) return;
      let values;
      if (renderedProviderId === "kimi-code") {
        values = { apiKey: kimiKeyInput.value, model: "", baseUrl: "" };
      } else if (renderedProviderId === "openrouter") {
        values = {
          apiKey: openrouterKeyInput.value,
          model: openrouterModelInput.value,
          baseUrl: "",
        };
      } else {
        values = {
          apiKey: advancedKeyInput.value,
          model: advancedModelInput.value,
          baseUrl: advancedBaseUrlInput.value,
        };
      }
      currentSettings = buildSettingsFromForm(currentSettings, {
        activeProvider: renderedProviderId,
        ...values,
        supadataApiKey: supadataInput.value,
      });
    }

    function draftSettings() {
      const values = activeFieldValues();
      return buildSettingsFromForm(currentSettings, {
        activeProvider: values.providerId,
        apiKey: values.apiKey,
        model: values.model,
        baseUrl: values.baseUrl,
        supadataApiKey: supadataInput.value,
      });
    }

    function renderModelOptions() {
      const filtered = filterOpenRouterModels(
        openrouterModels,
        modelSearchInput.value,
      );
      modelList.replaceChildren();
      for (const model of filtered) {
        const option = doc.createElement("option");
        option.value = model.id;
        option.label = model.name;
        modelList.append(option);
      }
    }

    function renderProvider() {
      const mode = selectedMode();
      for (const panel of providerPanels) {
        panel.hidden = panel.dataset.providerPanel !== mode;
      }

      const providerId = selectedProviderId();
      const provider = settingsApi.PROVIDERS[providerId];
      const profile = currentSettings.providers[providerId];
      providerBadge.textContent = provider.name;
      if (providerId === "kimi-code") {
        kimiKeyInput.value = profile.apiKey;
      } else if (providerId === "openrouter") {
        openrouterKeyInput.value = profile.apiKey;
        openrouterModelInput.value = profile.model;
      } else {
        advancedKeyInput.value = profile.apiKey;
        advancedModelInput.value = profile.model;
        advancedBaseUrlGroup.hidden = !provider.editableBaseUrl;
        advancedBaseUrlInput.value = profile.baseUrl || provider.baseUrl;
        protocolLabel.textContent = `${provider.protocol} ·`;
        providerDocsLink.hidden = !provider.docsUrl;
        if (provider.docsUrl) providerDocsLink.href = provider.docsUrl;
      }
      try {
        permissionOrigin.textContent = `API origin: ${requiredOriginPattern({
          ...currentSettings,
          activeProvider: providerId,
        })}`;
      } catch (_error) {
        permissionOrigin.textContent = "";
      }
      renderedProviderId = providerId;
    }

    function renderDraftPermissionOrigin() {
      try {
        permissionOrigin.textContent = `API origin: ${requiredOriginPattern(
          draftSettings(),
        )}`;
      } catch (_error) {
        permissionOrigin.textContent = "";
      }
    }

    function validateDraft(draft, requireSupadata) {
      const provider = settingsApi.getActiveProvider(draft);
      const profile = settingsApi.getActiveProfile(draft);
      if (requireSupadata && !draft.supadataApiKey) {
        throw new Error(translate(currentLanguage, "addSupadataKey"));
      }
      if (!profile.apiKey) {
        throw new Error(translate(currentLanguage, "providerKeyRequired"));
      }
      if (provider.editableModel && !profile.model) {
        throw new Error(translate(currentLanguage, "modelRequired"));
      }
      return { provider, profile };
    }

    async function ensurePermission(draft) {
      if (draft.activeProvider === "kimi-code") return true;
      return requestProviderPermission(
        root.chrome,
        requiredOriginPattern(draft),
      );
    }

    async function hasPermission(draft) {
      if (draft.activeProvider === "kimi-code") return true;
      if (!root.chrome?.permissions) return true;
      return root.chrome.permissions.contains({
        origins: [requiredOriginPattern(draft)],
      });
    }

    async function saveSettings(event) {
      event.preventDefault();
      setStatus(saveStatus, "saving");
      try {
        const draft = draftSettings();
        validateDraft(draft, true);
        if (!(await ensurePermission(draft))) {
          setStatus(saveStatus, "permissionDenied");
          return;
        }
        await storage.set({ [settingsApi.STORAGE_KEY]: draft });
        currentSettings = draft;
        setStatus(saveStatus, "saved");
        renderProvider();
      } catch (error) {
        saveStatus.textContent = error.message;
      }
    }

    async function testConnection() {
      let provider;
      try {
        const draft = draftSettings();
        ({ provider } = validateDraft(draft, false));
        if (!(await ensurePermission(draft))) {
          setStatus(saveStatus, "permissionDenied");
          return;
        }
        setStatus(saveStatus, "testingConnection");
        const result = await root.chrome.runtime.sendMessage({
          action: "testAiConnection",
          settings: draft,
        });
        if (!result?.success) {
          throw new Error(result?.error || "Unknown provider error");
        }
        setStatus(saveStatus, "connectionOk", { provider: provider.name });
      } catch (error) {
        const providerName = provider?.name || providerBadge.textContent;
        setStatus(saveStatus, "connectionFailed", {
          provider: providerName,
          message: error.message,
        });
      }
    }

    async function loadOpenRouterModels(force = false) {
      let draft;
      if (force) {
        draft = draftSettings();
        if (!(await ensurePermission(draft))) {
          setStatus(saveStatus, "permissionDenied");
          return;
        }
      }
      const cached = await storage.get(OPENROUTER_MODELS_CACHE_KEY);
      const cache = cached[OPENROUTER_MODELS_CACHE_KEY];
      if (
        !force &&
        Array.isArray(cache?.models) &&
        isModelCacheFresh(cache.cachedAt)
      ) {
        openrouterModels = cache.models;
        renderModelOptions();
        return;
      }
      if (!force && selectedProviderId() !== "openrouter") {
        return;
      }
      setStatus(saveStatus, "modelsLoading");
      try {
        draft ||= draftSettings();
        const profile = draft.providers.openrouter;
        if (!force && !(await hasPermission(draft))) {
          return;
        }
        openrouterModels = await fetchOpenRouterModels(root.fetch, profile.apiKey);
        await storage.set({
          [OPENROUTER_MODELS_CACHE_KEY]: {
            models: openrouterModels,
            cachedAt: Date.now(),
          },
        });
        renderModelOptions();
        setStatus(saveStatus, "modelsLoaded", { count: openrouterModels.length });
      } catch (_error) {
        setStatus(saveStatus, "modelsFailed");
      }
    }

    async function deleteCurrentKey() {
      const providerId = selectedProviderId();
      const provider = settingsApi.PROVIDERS[providerId];
      if (
        !root.confirm(
          translate(currentLanguage, "deleteCurrentKeyConfirm", {
            provider: provider.name,
          }),
        )
      ) {
        return;
      }
      const stored = await storage.get(settingsApi.STORAGE_KEY);
      currentSettings = clearProviderKey(
        stored[settingsApi.STORAGE_KEY],
        providerId,
      );
      await storage.set({ [settingsApi.STORAGE_KEY]: currentSettings });
      setModeForProvider(providerId);
      renderProvider();
      setStatus(saveStatus, "currentKeyDeleted", { provider: provider.name });
    }

    async function clearCachedDigests() {
      const all = await storage.get(null);
      const keys = Object.keys(all).filter((key) => key.startsWith("digest_"));
      if (keys.length) await storage.remove(keys);
      setStatus(dataStatus, "clearedDigests", { count: keys.length });
    }

    async function clearNotes() {
      await storage.remove("ytd_notes");
      setStatus(dataStatus, "notesDeleted");
    }

    async function resetAllData() {
      if (!root.confirm(translate(currentLanguage, "resetConfirm"))) return;
      await storage.clear();
      await persistPreferredLanguage(storage, currentLanguage);
      const granted = await root.chrome?.permissions?.getAll?.();
      const origins = optionalOriginsToRemove(granted?.origins);
      if (origins.length) {
        await root.chrome.permissions.remove({ origins }).catch(() => false);
      }
      currentSettings = settingsApi.normalize();
      supadataInput.value = "";
      setModeForProvider("kimi-code");
      renderProvider();
      setStatus(dataStatus, "allDataDeleted");
    }

    async function loadSettings() {
      try {
        const stored = await storage.get(settingsApi.STORAGE_KEY);
        const migration = settingsApi.migrateProviderSettings(
          stored[settingsApi.STORAGE_KEY],
        );
        currentSettings = migration.settings;
        supadataInput.value = currentSettings.supadataApiKey;
        setModeForProvider(currentSettings.activeProvider);
        renderProvider();
        if (migration.migrated) {
          await storage.set({ [settingsApi.STORAGE_KEY]: currentSettings });
        }
        await loadOpenRouterModels(false).catch(() => {});
      } catch (_error) {
        setStatus(saveStatus, "settingsLoadFailed");
      }
    }

    form.addEventListener("submit", saveSettings);
    doc.getElementById("testConnectionBtn").addEventListener("click", testConnection);
    doc.getElementById("deleteCurrentAiKeyBtn").addEventListener("click", deleteCurrentKey);
    doc.getElementById("refreshModelsBtn").addEventListener("click", () => loadOpenRouterModels(true));
    doc.getElementById("clearCacheBtn").addEventListener("click", clearCachedDigests);
    doc.getElementById("clearNotesBtn").addEventListener("click", clearNotes);
    doc.getElementById("resetBtn").addEventListener("click", resetAllData);
    modelSearchInput.addEventListener("input", renderModelOptions);
    advancedBaseUrlInput.addEventListener("input", renderDraftPermissionOrigin);
    for (const input of modeInputs) {
      input.addEventListener("change", () => {
        captureRenderedProvider();
        renderProvider();
        if (input.value === "openrouter") void loadOpenRouterModels(false);
      });
    }
    advancedProviderInput.addEventListener("change", () => {
      captureRenderedProvider();
      renderProvider();
    });
    for (const button of languageButtons) {
      button.addEventListener("click", async () => {
        applyLanguage(button.dataset.language);
        await persistPreferredLanguage(storage, currentLanguage);
      });
    }

    async function loadOptions() {
      try {
        applyLanguage(await readPreferredLanguage(storage));
      } catch (_error) {
        applyLanguage("en");
      }
      await loadSettings();
    }

    if (doc.readyState === "loading") {
      doc.addEventListener("DOMContentLoaded", loadOptions, { once: true });
    } else {
      void loadOptions();
    }
  }

  return {
    COPY,
    LANGUAGE_STORAGE_KEY,
    OPENROUTER_MODELS_CACHE_KEY,
    buildSettingsFromForm,
    clearProviderKey,
    providerIdForMode,
    requiredOriginPattern,
    requestProviderPermission,
    optionalOriginsToRemove,
    filterOpenRouterModels,
    isModelCacheFresh,
    fetchOpenRouterModels,
    createStorageAdapter,
    normalizeLanguage,
    persistPreferredLanguage,
    readPreferredLanguage,
    translate,
    updateLanguageButtonState,
    initialize,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = YTD_OPTIONS;
}

if (typeof document !== "undefined") {
  YTD_OPTIONS.initialize();
}
