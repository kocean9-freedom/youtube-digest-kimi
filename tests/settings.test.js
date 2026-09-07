const test = require("node:test");
const assert = require("node:assert/strict");

const settings = require("../settings.js");

test("Kimi Coding Plan defaults use K2.7 Code", () => {
  const normalized = settings.normalize({
    provider: "kimi-code",
    aiApiKey: "  example-key  ",
    aiBaseUrl: "https://api.example.com/v1",
    aiModel: "example-model",
    supadataApiKey: "  example-supadata  ",
  });

  assert.equal(normalized.provider, "kimi-code");
  assert.equal(normalized.aiBaseUrl, "https://api.kimi.com/coding/v1");
  assert.equal(normalized.aiModel, "kimi-for-coding");
  assert.equal(normalized.aiApiKey, "example-key");
  assert.equal(normalized.supadataApiKey, "example-supadata");
  assert.equal(
    settings.chatCompletionsUrl(),
    "https://api.kimi.com/coding/v1/chat/completions",
  );
});

test("provider migration clears only the old AI key and is idempotent", () => {
  const legacy = {
    provider: "deepseek",
    aiApiKey: "deepseek-secret",
    aiBaseUrl: "https://api.deepseek.com",
    aiModel: "deepseek-v4-flash",
    supadataApiKey: " supadata-secret ",
  };
  const first = settings.migrateProviderSettings(legacy);

  assert.equal(first.migrated, true);
  assert.equal(first.settings.provider, "kimi-code");
  assert.equal(first.settings.aiBaseUrl, settings.DEFAULTS.aiBaseUrl);
  assert.equal(first.settings.aiModel, settings.DEFAULTS.aiModel);
  assert.equal(first.settings.aiApiKey, "");
  assert.equal(first.settings.supadataApiKey, "supadata-secret");

  const second = settings.migrateProviderSettings(first.settings);
  assert.equal(second.migrated, false);
  assert.deepEqual(second.settings, first.settings);

  const configuredKimi = settings.normalize({
    ...first.settings,
    aiApiKey: "new-kimi-key",
  });
  assert.equal(configuredKimi.aiApiKey, "new-kimi-key");
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
