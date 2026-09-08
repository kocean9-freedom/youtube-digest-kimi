const test = require("node:test");
const assert = require("node:assert/strict");

const settings = require("../settings.js");

function loadAdapters() {
  delete require.cache[require.resolve("../ai-providers.js")];
  return require("../ai-providers.js");
}

const baseInput = {
  system: "Follow the requested output format.",
  messages: [{ role: "user", content: "Hello" }],
  maxTokens: 128,
  temperature: 0.2,
};

test("Kimi uses OpenAI chat format without provider-only controls", () => {
  const adapters = loadAdapters();
  const provider = settings.PROVIDERS["kimi-code"];
  const request = adapters.buildRequest(
    provider,
    { apiKey: "test-key", model: "kimi-for-coding" },
    baseInput,
  );

  assert.equal(
    request.url,
    "https://api.kimi.com/coding/v1/chat/completions",
  );
  assert.deepEqual(request.headers, {
    "Content-Type": "application/json",
    Authorization: "Bearer test-key",
  });
  assert.equal(request.body.model, "kimi-for-coding");
  assert.deepEqual(request.body.messages, [
    { role: "system", content: "Follow the requested output format." },
    { role: "user", content: "Hello" },
  ]);
  assert.equal(request.body.max_tokens, 128);
  assert.equal(request.body.temperature, 0.2);
  assert.equal(Object.hasOwn(request.body, "thinking"), false);
  assert.equal(Object.hasOwn(request.body, "response_format"), false);
});

test("custom OpenAI-compatible providers use only their own profile", () => {
  const adapters = loadAdapters();
  const request = adapters.buildRequest(
    settings.PROVIDERS.custom,
    {
      apiKey: "custom-key",
      baseUrl: "https://gateway.example/v1",
      model: "vendor/model",
    },
    { ...baseInput, temperature: undefined },
  );

  assert.equal(request.url, "https://gateway.example/v1/chat/completions");
  assert.equal(request.headers.Authorization, "Bearer custom-key");
  assert.equal(request.body.model, "vendor/model");
  assert.equal(Object.hasOwn(request.body, "temperature"), false);
});

test("official OpenAI GPT-5 requests use supported token and sampling fields", () => {
  const adapters = loadAdapters();
  const request = adapters.buildRequest(
    settings.PROVIDERS.openai,
    { apiKey: "openai-key", model: "gpt-5" },
    baseInput,
  );

  assert.equal(request.body.max_completion_tokens, 128);
  assert.equal(Object.hasOwn(request.body, "max_tokens"), false);
  assert.equal(Object.hasOwn(request.body, "temperature"), false);
});

test("Anthropic keeps system separate and omits temperature", () => {
  const adapters = loadAdapters();
  const request = adapters.buildRequest(
    settings.PROVIDERS.anthropic,
    { apiKey: "claude-key", model: "claude-model" },
    baseInput,
  );

  assert.equal(request.url, "https://api.anthropic.com/v1/messages");
  assert.deepEqual(request.headers, {
    "Content-Type": "application/json",
    "x-api-key": "claude-key",
    "anthropic-version": "2023-06-01",
  });
  assert.deepEqual(request.body, {
    model: "claude-model",
    max_tokens: 128,
    system: "Follow the requested output format.",
    messages: [{ role: "user", content: "Hello" }],
  });
});

test("Gemini converts system and messages to generateContent", () => {
  const adapters = loadAdapters();
  const request = adapters.buildRequest(
    settings.PROVIDERS.gemini,
    { apiKey: "gemini-key", model: "models/gemini-model" },
    {
      ...baseInput,
      messages: [
        { role: "user", content: "Question" },
        { role: "assistant", content: "Previous answer" },
      ],
    },
  );

  assert.equal(
    request.url,
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-model:generateContent",
  );
  assert.deepEqual(request.headers, {
    "Content-Type": "application/json",
    "x-goog-api-key": "gemini-key",
  });
  assert.deepEqual(request.body, {
    systemInstruction: {
      parts: [{ text: "Follow the requested output format." }],
    },
    contents: [
      { role: "user", parts: [{ text: "Question" }] },
      { role: "model", parts: [{ text: "Previous answer" }] },
    ],
    generationConfig: { maxOutputTokens: 128, temperature: 0.2 },
  });
});

test("all three adapters extract only supported text output", () => {
  const adapters = loadAdapters();

  assert.equal(
    adapters.parseResponse(settings.PROVIDERS.openrouter, {
      choices: [{ message: { content: [{ type: "text", text: "A" }, { type: "image", url: "ignored" }, { type: "text", text: "B" }] } }],
    }),
    "AB",
  );
  assert.equal(
    adapters.parseResponse(settings.PROVIDERS.anthropic, {
      content: [
        { type: "thinking", thinking: "ignored" },
        { type: "text", text: "Claude answer" },
      ],
    }),
    "Claude answer",
  );
  assert.equal(
    adapters.parseResponse(settings.PROVIDERS.gemini, {
      candidates: [
        { content: { parts: [{ text: "Gemini " }, { text: "answer" }] } },
      ],
    }),
    "Gemini answer",
  );
});

test("empty and blocked responses have stable provider-aware errors", () => {
  const adapters = loadAdapters();

  assert.throws(
    () =>
      adapters.parseResponse(settings.PROVIDERS.openai, {
        choices: [{ message: { content: "  " } }],
      }),
    (error) =>
      error.code === "EMPTY_AI_RESPONSE" && error.provider === "openai",
  );
  assert.throws(
    () =>
      adapters.parseResponse(settings.PROVIDERS.gemini, {
        promptFeedback: { blockReason: "SAFETY" },
      }),
    (error) => error.code === "AI_BLOCKED" && error.provider === "gemini",
  );
  assert.throws(
    () =>
      adapters.parseResponse(settings.PROVIDERS.gemini, {
        candidates: [{ finishReason: "SAFETY", content: { parts: [] } }],
      }),
    (error) => error.code === "AI_BLOCKED" && error.provider === "gemini",
  );
  assert.throws(
    () =>
      adapters.parseResponse(settings.PROVIDERS.gemini, {
        candidates: [
          {
            finishReason: "MAX_TOKENS",
            content: { parts: [{ text: "partial output" }] },
          },
        ],
      }),
    (error) =>
      error.code === "AI_RESPONSE_TRUNCATED" && error.provider === "gemini",
  );
});

test("HTTP errors normalize authentication, rate limits, and provider failures", () => {
  const adapters = loadAdapters();
  const provider = settings.PROVIDERS.openrouter;

  const unauthorized = adapters.createHttpError(provider, 401, {
    error: { message: "Invalid token" },
  });
  assert.equal(unauthorized.code, "INVALID_AI_KEY");
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.provider, "openrouter");
  assert.match(unauthorized.message, /OpenRouter/);

  const limited = adapters.createHttpError(provider, 429, {
    error: { message: "Too many requests" },
  });
  assert.equal(limited.code, "RATE_LIMITED");

  const failed = adapters.createHttpError(provider, 503, {
    message: "Upstream unavailable",
  });
  assert.equal(failed.code, "PROVIDER_HTTP_ERROR");
  assert.doesNotMatch(failed.message, /Upstream unavailable/);
});

test("invalid requests fail before any network request can be built", () => {
  const adapters = loadAdapters();

  assert.throws(
    () =>
      adapters.buildRequest(
        settings.PROVIDERS.openrouter,
        { apiKey: "", model: "openai/gpt-5" },
        baseInput,
      ),
    (error) => error.code === "NO_AI_KEY",
  );
  assert.throws(
    () =>
      adapters.buildRequest(
        settings.PROVIDERS.openrouter,
        { apiKey: "router-key", model: "" },
        baseInput,
      ),
    (error) => error.code === "NO_AI_MODEL",
  );
});
