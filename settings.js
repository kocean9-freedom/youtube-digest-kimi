/**
 * Shared, non-secret configuration helpers.
 *
 * API keys are stored in chrome.storage.local by options.js. This file contains
 * defaults and validation only, so it is safe to publish.
 */
var YTD_SETTINGS = (() => {
  const STORAGE_KEY = "ytd_settings";
  const DEFAULTS = Object.freeze({
    provider: "kimi-code",
    aiApiKey: "",
    aiBaseUrl: "https://api.kimi.com/coding/v1",
    aiModel: "kimi-for-coding",
    supadataApiKey: "",
  });

  function needsProviderMigration(input) {
    return (
      !!input &&
      typeof input.provider === "string" &&
      input.provider !== DEFAULTS.provider
    );
  }

  function normalize(input = {}) {
    return {
      provider: DEFAULTS.provider,
      aiApiKey: needsProviderMigration(input)
        ? ""
        : typeof input.aiApiKey === "string"
          ? input.aiApiKey.trim()
          : "",
      aiBaseUrl: DEFAULTS.aiBaseUrl,
      aiModel: DEFAULTS.aiModel,
      supadataApiKey:
        typeof input.supadataApiKey === "string"
          ? input.supadataApiKey.trim()
          : "",
    };
  }

  function migrateProviderSettings(input = {}) {
    return {
      settings: normalize(input),
      migrated: needsProviderMigration(input),
    };
  }

  function chatCompletionsUrl() {
    return `${DEFAULTS.aiBaseUrl}/chat/completions`;
  }

  function canonicalYouTubeUrl(videoId) {
    const normalized = String(videoId || "").trim();
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(normalized)) {
      throw new Error("Invalid YouTube video ID.");
    }
    return `https://www.youtube.com/watch?v=${normalized}`;
  }

  return {
    STORAGE_KEY,
    DEFAULTS,
    needsProviderMigration,
    normalize,
    migrateProviderSettings,
    chatCompletionsUrl,
    canonicalYouTubeUrl,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = YTD_SETTINGS;
}
