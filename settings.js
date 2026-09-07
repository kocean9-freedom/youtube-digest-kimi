/**
 * Shared, non-secret configuration helpers.
 *
 * API keys are stored in chrome.storage.local by options.js. This file contains
 * provider metadata, defaults, migration, and validation only.
 */
var YTD_SETTINGS = (() => {
  const STORAGE_KEY = "ytd_settings";
  const CONFIG_VERSION = 2;
  const KIMI_PROVIDER_ID = "kimi-code";

  const providerEntries = {
    "kimi-code": {
      name: "Kimi Coding Plan",
      mode: "kimi",
      protocol: "openai-compatible",
      baseUrl: "https://api.kimi.com/coding/v1",
      defaultModel: "kimi-for-coding",
      editableBaseUrl: false,
      editableModel: false,
      docsUrl: "https://www.kimi.com/code/docs/",
      keyUrl: "https://www.kimi.com/code/console",
    },
    openrouter: {
      name: "OpenRouter",
      mode: "openrouter",
      protocol: "openai-compatible",
      baseUrl: "https://openrouter.ai/api/v1",
      defaultModel: "",
      editableBaseUrl: false,
      editableModel: true,
      docsUrl: "https://openrouter.ai/docs/quickstart",
      keyUrl: "https://openrouter.ai/settings/keys",
    },
    openai: {
      name: "OpenAI",
      mode: "advanced",
      protocol: "openai-compatible",
      baseUrl: "https://api.openai.com/v1",
      defaultModel: "gpt-5",
      editableBaseUrl: false,
      editableModel: true,
      docsUrl: "https://platform.openai.com/docs/api-reference",
      keyUrl: "https://platform.openai.com/api-keys",
    },
    deepseek: {
      name: "DeepSeek",
      mode: "advanced",
      protocol: "openai-compatible",
      baseUrl: "https://api.deepseek.com",
      defaultModel: "deepseek-v4-flash",
      editableBaseUrl: false,
      editableModel: true,
      docsUrl: "https://api-docs.deepseek.com/",
      keyUrl: "https://platform.deepseek.com/api_keys",
    },
    "kimi-open": {
      name: "Kimi Open Platform",
      mode: "advanced",
      protocol: "openai-compatible",
      baseUrl: "https://api.moonshot.cn/v1",
      defaultModel: "kimi-k2.6",
      editableBaseUrl: false,
      editableModel: true,
      docsUrl: "https://platform.kimi.com/docs/api/overview",
      keyUrl: "https://platform.kimi.com/console/api-keys",
    },
    qwen: {
      name: "Alibaba Cloud Model Studio (Qwen)",
      mode: "advanced",
      protocol: "openai-compatible",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      defaultModel: "qwen3.8-max",
      editableBaseUrl: true,
      editableModel: true,
      docsUrl: "https://help.aliyun.com/en/model-studio/first-api-call-to-qwen",
      keyUrl: "https://bailian.console.aliyun.com/",
    },
    glm: {
      name: "Zhipu GLM",
      mode: "advanced",
      protocol: "openai-compatible",
      baseUrl: "https://open.bigmodel.cn/api/paas/v4",
      defaultModel: "glm-5.2",
      editableBaseUrl: false,
      editableModel: true,
      docsUrl: "https://docs.bigmodel.cn/cn/api/introduction",
      keyUrl: "https://open.bigmodel.cn/usercenter/apikeys",
    },
    siliconflow: {
      name: "SiliconFlow",
      mode: "advanced",
      protocol: "openai-compatible",
      baseUrl: "https://api.siliconflow.cn/v1",
      defaultModel: "deepseek-ai/DeepSeek-V4-Flash",
      editableBaseUrl: false,
      editableModel: true,
      docsUrl: "https://docs.siliconflow.cn/docs/userguide/quickstart",
      keyUrl: "https://cloud.siliconflow.cn/account/ak",
    },
    anthropic: {
      name: "Anthropic Claude",
      mode: "advanced",
      protocol: "anthropic",
      baseUrl: "https://api.anthropic.com",
      defaultModel: "",
      editableBaseUrl: false,
      editableModel: true,
      docsUrl: "https://docs.anthropic.com/en/api/messages",
      keyUrl: "https://console.anthropic.com/settings/keys",
    },
    gemini: {
      name: "Google Gemini",
      mode: "advanced",
      protocol: "gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      defaultModel: "",
      editableBaseUrl: false,
      editableModel: true,
      docsUrl: "https://ai.google.dev/api/generate-content",
      keyUrl: "https://aistudio.google.com/apikey",
    },
    custom: {
      name: "Custom OpenAI Compatible",
      mode: "advanced",
      protocol: "openai-compatible",
      baseUrl: "",
      defaultModel: "",
      editableBaseUrl: true,
      editableModel: true,
      docsUrl: "",
      keyUrl: "",
    },
  };

  const PROVIDERS = Object.freeze(
    Object.fromEntries(
      Object.entries(providerEntries).map(([id, provider]) => [
        id,
        Object.freeze({ id, ...provider }),
      ]),
    ),
  );
  const PROVIDER_IDS = Object.freeze(Object.keys(PROVIDERS));
  const ADVANCED_PROVIDER_IDS = Object.freeze(
    PROVIDER_IDS.filter((id) => PROVIDERS[id].mode === "advanced"),
  );

  function trim(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function validateCustomBaseUrl(value) {
    const rawValue = trim(value);
    if (!rawValue) throw new Error("Base URL is required.");

    let url;
    try {
      url = new URL(rawValue);
    } catch (_error) {
      throw new Error("Base URL is invalid.");
    }
    if (url.username || url.password) {
      throw new Error("Base URL must not contain credentials.");
    }
    if (url.hash) throw new Error("Base URL must not contain a fragment.");
    if (url.search) throw new Error("Base URL must not contain a query string.");

    const isLoopback =
      url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (
      url.protocol !== "https:" &&
      !(url.protocol === "http:" && isLoopback)
    ) {
      throw new Error(
        "Base URL must use HTTPS, except for localhost or 127.0.0.1.",
      );
    }
    if (url.pathname === "/") url.pathname = "";
    return url.toString().replace(/\/$/, "");
  }

  function buildChatCompletionsUrl(baseUrl) {
    const normalized = validateCustomBaseUrl(baseUrl);
    return /\/chat\/completions$/i.test(normalized)
      ? normalized
      : `${normalized}/chat/completions`;
  }

  function createDefaultProfiles() {
    return Object.fromEntries(
      PROVIDER_IDS.map((id) => {
        const provider = PROVIDERS[id];
        const profile = {
          apiKey: "",
          model: provider.defaultModel,
        };
        if (provider.editableBaseUrl) profile.baseUrl = provider.baseUrl;
        return [id, profile];
      }),
    );
  }

  function normalizeProfile(id, input = {}) {
    const provider = PROVIDERS[id];
    const profile = {
      apiKey: trim(input?.apiKey),
      model: provider.editableModel
        ? trim(input?.model) || provider.defaultModel
        : provider.defaultModel,
    };
    if (provider.editableBaseUrl) {
      const candidate = trim(input?.baseUrl) || provider.baseUrl;
      profile.baseUrl = candidate ? validateCustomBaseUrl(candidate) : "";
    }
    return profile;
  }

  function isVersion2(input) {
    return (
      input?.aiConfigVersion === CONFIG_VERSION &&
      input.providers &&
      typeof input.providers === "object"
    );
  }

  function normalize(input = {}) {
    const profiles = createDefaultProfiles();
    if (isVersion2(input)) {
      for (const id of PROVIDER_IDS) {
        profiles[id] = normalizeProfile(id, input.providers[id]);
      }
    } else if (!input.provider || input.provider === KIMI_PROVIDER_ID) {
      profiles[KIMI_PROVIDER_ID] = normalizeProfile(KIMI_PROVIDER_ID, {
        apiKey: input.aiApiKey,
      });
    }

    const requestedProvider = isVersion2(input)
      ? input.activeProvider
      : KIMI_PROVIDER_ID;
    const activeProvider = Object.hasOwn(PROVIDERS, requestedProvider)
      ? requestedProvider
      : KIMI_PROVIDER_ID;
    const activeDefinition = PROVIDERS[activeProvider];
    const activeProfile = profiles[activeProvider];
    const activeBaseUrl = activeDefinition.editableBaseUrl
      ? activeProfile.baseUrl
      : activeDefinition.baseUrl;

    return {
      aiConfigVersion: CONFIG_VERSION,
      activeProvider,
      providers: profiles,
      supadataApiKey: trim(input.supadataApiKey),
      // Derived compatibility fields keep existing callers functional while
      // they migrate to provider-aware helpers.
      provider: activeProvider,
      aiApiKey: activeProfile.apiKey,
      aiBaseUrl: activeBaseUrl,
      aiModel: activeProfile.model,
    };
  }

  function migrateProviderSettings(input = {}) {
    return {
      settings: normalize(input),
      migrated: !isVersion2(input),
    };
  }

  function getActiveProvider(settings) {
    const providerId = Object.hasOwn(PROVIDERS, settings?.activeProvider)
      ? settings.activeProvider
      : KIMI_PROVIDER_ID;
    return PROVIDERS[providerId];
  }

  function getActiveProfile(settings) {
    const normalized = normalize(settings);
    return { ...normalized.providers[normalized.activeProvider] };
  }

  function getActiveCredential(settings) {
    return getActiveProfile(settings).apiKey;
  }

  function chatCompletionsUrl() {
    return buildChatCompletionsUrl(PROVIDERS[KIMI_PROVIDER_ID].baseUrl);
  }

  function canonicalYouTubeUrl(videoId) {
    const normalized = String(videoId || "").trim();
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(normalized)) {
      throw new Error("Invalid YouTube video ID.");
    }
    return `https://www.youtube.com/watch?v=${normalized}`;
  }

  const DEFAULTS = Object.freeze(normalize());

  return {
    STORAGE_KEY,
    CONFIG_VERSION,
    KIMI_PROVIDER_ID,
    DEFAULTS,
    PROVIDERS,
    PROVIDER_IDS,
    ADVANCED_PROVIDER_IDS,
    normalize,
    migrateProviderSettings,
    getActiveProvider,
    getActiveProfile,
    getActiveCredential,
    validateCustomBaseUrl,
    buildChatCompletionsUrl,
    chatCompletionsUrl,
    canonicalYouTubeUrl,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = YTD_SETTINGS;
}
