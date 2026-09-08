const test = require("node:test");
const assert = require("node:assert/strict");

const settings = require("../settings.js");
const options = require("../options.js");

test("editing OpenRouter preserves credentials for every other provider", () => {
  const current = settings.normalize({
    aiConfigVersion: 2,
    activeProvider: "kimi-code",
    providers: {
      "kimi-code": { apiKey: "kimi-key" },
      anthropic: { apiKey: "claude-key", model: "claude-model" },
    },
    supadataApiKey: "supadata-key",
  });

  const next = options.buildSettingsFromForm(current, {
    activeProvider: "openrouter",
    apiKey: " router-key ",
    model: " openai/gpt-5 ",
    supadataApiKey: "supadata-key",
  });

  assert.equal(next.activeProvider, "openrouter");
  assert.equal(next.providers.openrouter.apiKey, "router-key");
  assert.equal(next.providers.openrouter.model, "openai/gpt-5");
  assert.equal(next.providers["kimi-code"].apiKey, "kimi-key");
  assert.equal(next.providers.anthropic.apiKey, "claude-key");
});

test("deleting one provider key preserves only persisted settings", () => {
  const persisted = settings.normalize({
    aiConfigVersion: 2,
    activeProvider: "kimi-code",
    providers: {
      "kimi-code": { apiKey: "saved-kimi" },
      openrouter: { apiKey: "saved-router", model: "openai/gpt-5" },
      custom: {
        apiKey: "saved-custom",
        model: "persisted-model",
        baseUrl: "https://persisted.example/v1",
      },
    },
    supadataApiKey: "persisted-supadata",
  });

  const next = options.clearProviderKey(persisted, "openrouter");

  assert.equal(next.activeProvider, "kimi-code");
  assert.equal(next.providers.openrouter.apiKey, "");
  assert.equal(next.providers.openrouter.model, "openai/gpt-5");
  assert.equal(next.providers["kimi-code"].apiKey, "saved-kimi");
  assert.equal(next.providers.custom.apiKey, "saved-custom");
  assert.equal(next.providers.custom.baseUrl, "https://persisted.example/v1");
  assert.equal(next.supadataApiKey, "persisted-supadata");
});

test("provider mode selection resolves to stable provider IDs", () => {
  assert.equal(options.providerIdForMode("kimi", "anthropic"), "kimi-code");
  assert.equal(options.providerIdForMode("openrouter", "anthropic"), "openrouter");
  assert.equal(options.providerIdForMode("advanced", "anthropic"), "anthropic");
  assert.equal(options.providerIdForMode("advanced", "unknown"), "openai");
});

test("optional permission patterns are limited to the selected exact origin", () => {
  const openrouter = settings.normalize({
    aiConfigVersion: 2,
    activeProvider: "openrouter",
    providers: {
      openrouter: { apiKey: "router-key", model: "openai/gpt-5" },
    },
  });
  assert.equal(
    options.requiredOriginPattern(openrouter),
    "https://openrouter.ai/*",
  );

  const local = settings.normalize({
    aiConfigVersion: 2,
    activeProvider: "custom",
    providers: {
      custom: {
        apiKey: "local-key",
        model: "local-model",
        baseUrl: "http://localhost:11434/v1",
      },
    },
  });
  assert.equal(
    options.requiredOriginPattern(local),
    "http://localhost:11434/*",
  );
});

test("permission helper requests one exact origin directly from the user gesture", async () => {
  const calls = [];
  const chromeApi = {
    permissions: {
      request: async (value) => {
        calls.push(["request", value]);
        return true;
      },
    },
  };

  assert.equal(
    await options.requestProviderPermission(
      chromeApi,
      "https://openrouter.ai/*",
    ),
    true,
  );
  assert.deepEqual(calls, [
    ["request", { origins: ["https://openrouter.ai/*"] }],
  ]);
});

test("reset removes optional origins even when their names resemble required hosts", () => {
  assert.deepEqual(
    options.optionalOriginsToRemove([
      "https://www.youtube.com/*",
      "https://api.supadata.ai/*",
      "https://api.kimi.com/*",
      "https://youtube.com.evil.example/*",
      "https://api.kimi.com.proxy.example/*",
      "https://openrouter.ai/*",
    ]),
    [
      "https://youtube.com.evil.example/*",
      "https://api.kimi.com.proxy.example/*",
      "https://openrouter.ai/*",
    ],
  );
});

test("OpenRouter model filtering is safe, searchable, and bounded", () => {
  const models = [
    { id: "openai/gpt-5", name: "GPT 5" },
    { id: "anthropic/claude-model", name: "Claude Model" },
    { id: "invalid", name: "<img onerror=alert(1)>" },
  ];
  assert.deepEqual(options.filterOpenRouterModels(models, "claude"), [
    { id: "anthropic/claude-model", name: "Claude Model" },
  ]);
  assert.equal(options.filterOpenRouterModels(models, "", 2).length, 2);
});

test("OpenRouter cache expires at exactly 24 hours", () => {
  const day = 24 * 60 * 60 * 1000;
  assert.equal(options.isModelCacheFresh(1_000, 1_000 + day - 1), true);
  assert.equal(options.isModelCacheFresh(1_000, 1_000 + day), false);
  assert.equal(options.isModelCacheFresh(0, day), false);
});

test("OpenRouter model fetch returns sanitized ID and name pairs", async () => {
  const requests = [];
  const models = await options.fetchOpenRouterModels(
    async (url, request) => {
      requests.push({ url, request });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: "openai/gpt-5", name: "GPT 5", pricing: { prompt: "1" } },
            { id: "", name: "missing" },
            { id: "anthropic/claude-model", name: null },
          ],
        }),
      };
    },
    "router-key",
  );

  assert.equal(requests[0].url, "https://openrouter.ai/api/v1/models");
  assert.deepEqual(requests[0].request.headers, {
    Authorization: "Bearer router-key",
  });
  assert.deepEqual(models, [
    { id: "openai/gpt-5", name: "GPT 5" },
    { id: "anthropic/claude-model", name: "anthropic/claude-model" },
  ]);
});

test("OpenRouter model fetch rejects malformed or failed responses", async () => {
  await assert.rejects(
    options.fetchOpenRouterModels(
      async () => ({ ok: false, status: 401, json: async () => ({}) }),
      "router-key",
    ),
    /HTTP 401/,
  );
  await assert.rejects(
    options.fetchOpenRouterModels(
      async () => ({ ok: true, status: 200, json: async () => ({ data: {} }) }),
      "router-key",
    ),
    /model list/i,
  );
});

test("settings page exposes three modes and protected provider fields", () => {
  const html = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "..", "options.html"),
    "utf8",
  );
  assert.match(html, /role="radiogroup"/);
  assert.match(html, /value="kimi"/);
  assert.match(html, /value="openrouter"/);
  assert.match(html, /value="advanced"/);
  assert.match(html, /id="openrouterModelSearch"/);
  assert.match(html, /id="advancedProvider"/);
  assert.match(html, /id="advancedBaseUrl"/);
  assert.match(html, /id="testConnectionBtn"/);
  assert.match(html, /id="deleteCurrentAiKeyBtn"/);
  assert.match(html, /type="password"/);
});
