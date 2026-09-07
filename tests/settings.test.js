const test = require("node:test");
const assert = require("node:assert/strict");

const settings = require("../settings.js");

test("Kimi Coding Plan remains the version 2 default", () => {
  const normalized = settings.normalize();

  assert.equal(settings.CONFIG_VERSION, 2);
  assert.equal(normalized.aiConfigVersion, 2);
  assert.equal(normalized.activeProvider, "kimi-code");
  assert.equal(settings.getActiveProvider(normalized).baseUrl, "https://api.kimi.com/coding/v1");
  assert.equal(settings.getActiveProfile(normalized).model, "kimi-for-coding");
  assert.equal(settings.getActiveCredential(normalized), "");
});

test("current Kimi settings migrate to version 2 without losing either key", () => {
  const first = settings.migrateProviderSettings({
    provider: "kimi-code",
    aiApiKey: "  kimi-key  ",
    aiBaseUrl: "https://api.kimi.com/coding/v1",
    aiModel: "kimi-for-coding",
    supadataApiKey: "  supadata-key  ",
  });

  assert.equal(first.migrated, true);
  assert.equal(first.settings.aiConfigVersion, 2);
  assert.equal(first.settings.activeProvider, "kimi-code");
  assert.equal(first.settings.providers["kimi-code"].apiKey, "kimi-key");
  assert.equal(first.settings.supadataApiKey, "supadata-key");

  const second = settings.migrateProviderSettings(first.settings);
  assert.equal(second.migrated, false);
  assert.deepEqual(second.settings, first.settings);
});

test("legacy non-Kimi migration clears only the old AI key", () => {
  const legacy = {
    provider: "deepseek",
    aiApiKey: "deepseek-secret",
    aiBaseUrl: "https://api.deepseek.com",
    aiModel: "deepseek-v4-flash",
    supadataApiKey: " supadata-secret ",
  };
  const first = settings.migrateProviderSettings(legacy);

  assert.equal(first.migrated, true);
  assert.equal(first.settings.activeProvider, "kimi-code");
  assert.equal(first.settings.providers["kimi-code"].apiKey, "");
  assert.equal(first.settings.supadataApiKey, "supadata-secret");
});

test("provider credentials remain isolated when the active provider changes", () => {
  const normalized = settings.normalize({
    aiConfigVersion: 2,
    activeProvider: "openrouter",
    providers: {
      "kimi-code": { apiKey: " kimi-key " },
      openrouter: { apiKey: " router-key ", model: " openai/gpt-5 " },
      anthropic: { apiKey: " claude-key ", model: " claude-model " },
    },
    supadataApiKey: "supadata-key",
  });

  assert.equal(settings.getActiveCredential(normalized), "router-key");
  assert.equal(settings.getActiveProfile(normalized).model, "openai/gpt-5");
  assert.equal(normalized.providers["kimi-code"].apiKey, "kimi-key");
  assert.equal(normalized.providers.anthropic.apiKey, "claude-key");

  const switched = settings.normalize({
    ...normalized,
    activeProvider: "anthropic",
  });
  assert.equal(settings.getActiveCredential(switched), "claude-key");
  assert.equal(switched.providers.openrouter.apiKey, "router-key");
});

test("unknown providers fall back to Kimi without importing unknown settings", () => {
  const normalized = settings.normalize({
    aiConfigVersion: 2,
    activeProvider: "attacker-provider",
    providers: {
      "kimi-code": { apiKey: "safe-key" },
      "attacker-provider": { apiKey: "wrong-key", baseUrl: "https://evil.example" },
    },
  });

  assert.equal(normalized.activeProvider, "kimi-code");
  assert.equal(settings.getActiveCredential(normalized), "safe-key");
  assert.equal(Object.hasOwn(normalized.providers, "attacker-provider"), false);
});

test("custom URL validation permits HTTPS and loopback HTTP only", () => {
  assert.equal(
    settings.validateCustomBaseUrl("https://ai.example/v1/"),
    "https://ai.example/v1",
  );
  assert.equal(
    settings.validateCustomBaseUrl("http://localhost:11434/v1/"),
    "http://localhost:11434/v1",
  );
  assert.equal(
    settings.validateCustomBaseUrl("http://127.0.0.1:8000/v1"),
    "http://127.0.0.1:8000/v1",
  );
  assert.throws(
    () => settings.validateCustomBaseUrl("http://ai.example/v1"),
    /HTTPS/,
  );
  assert.throws(
    () => settings.validateCustomBaseUrl("https://user:pass@ai.example/v1"),
    /credentials/,
  );
  assert.throws(
    () => settings.validateCustomBaseUrl("https://ai.example/v1#secret"),
    /fragment/,
  );
});

test("chat completion URL normalization does not duplicate the endpoint", () => {
  assert.equal(
    settings.buildChatCompletionsUrl("https://api.example/v1/"),
    "https://api.example/v1/chat/completions",
  );
  assert.equal(
    settings.buildChatCompletionsUrl("https://api.example/v1/chat/completions"),
    "https://api.example/v1/chat/completions",
  );
});

test("provider registry separates protocols and advanced providers", () => {
  assert.equal(settings.PROVIDERS.openrouter.protocol, "openai-compatible");
  assert.equal(settings.PROVIDERS.anthropic.protocol, "anthropic");
  assert.equal(settings.PROVIDERS.gemini.protocol, "gemini");
  assert.ok(settings.ADVANCED_PROVIDER_IDS.includes("openai"));
  assert.ok(settings.ADVANCED_PROVIDER_IDS.includes("custom"));
  assert.equal(settings.ADVANCED_PROVIDER_IDS.includes("openrouter"), false);
});

test("Supadata receives a canonical YouTube URL", () => {
  assert.equal(
    settings.canonicalYouTubeUrl("ydTeb_I0b94"),
    "https://www.youtube.com/watch?v=ydTeb_I0b94",
  );
  assert.throws(
    () => settings.canonicalYouTubeUrl('"><script>'),
    /Invalid YouTube video ID/,
  );
});
