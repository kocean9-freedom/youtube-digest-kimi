const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const settingsApi = require("../settings.js");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function loadSidepanelHelpers({
  sendMessage = () => Promise.resolve({}),
  setTimeoutImpl = () => 0,
  clearTimeoutImpl = () => {},
} = {}) {
  const listeners = { addListener() {} };
  const sessionStorage = {};
  const localStorage = {};
  const sandbox = {
    console,
    URL,
    TextDecoder,
    TextEncoder,
    setTimeout: setTimeoutImpl,
    clearTimeout: clearTimeoutImpl,
    setInterval() {},
    clearInterval() {},
    IntersectionObserver: class {},
    CSS: { escape: (value) => value },
    window: { getSelection: () => null, close() {} },
    document: {
      addEventListener() {},
      querySelectorAll: () => [],
      querySelector: () => null,
      getElementById: () => null,
      createElement: () => {
        let value = "";
        return {
          set textContent(text) {
            value = String(text);
          },
          get innerHTML() {
            return value
              .replaceAll("&", "&amp;")
              .replaceAll("<", "&lt;")
              .replaceAll(">", "&gt;")
              .replaceAll('"', "&quot;");
          },
        };
      },
    },
    chrome: {
      runtime: { onMessage: listeners, sendMessage },
      storage: {
        local: {
          get: async (key) => ({ [key]: localStorage[key] }),
          set: async (values) => Object.assign(localStorage, values),
        },
        session: {
          get: async (key) => ({ [key]: sessionStorage[key] }),
          set: async (values) => Object.assign(sessionStorage, values),
        },
      },
      windows: { getCurrent: () => Promise.resolve({ id: 1 }) },
      tabs: { onUpdated: listeners, onActivated: listeners },
    },
    YTD_SETTINGS: {},
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(read("sidepanel.js"), sandbox);
  return sandbox.__YTD_TRANSCRIPT_TESTING__;
}

function loadBackgroundHelpers({
  settings = {
    provider: "kimi-code",
    aiApiKey: "test-key",
    aiBaseUrl: "https://api.kimi.com/coding/v1",
    aiModel: "kimi-for-coding",
  },
  fetchImpl = fetch,
  setTimeoutImpl = () => 0,
  clearTimeoutImpl = () => {},
  consoleImpl = console,
  permissions,
  sidePanel = {
    setPanelBehavior() {},
    setOptions: () => Promise.resolve(),
  },
} = {}) {
  const listeners = { addListener() {} };
  const runtimeMessageListeners = [];
  const localStorage = { ytd_settings: settings };
  const sandbox = {
    console: consoleImpl,
    URL,
    TextDecoder,
    TextEncoder,
    fetch: fetchImpl,
    AbortController,
    setTimeout: setTimeoutImpl,
    clearTimeout: clearTimeoutImpl,
    importScripts() {},
    chrome: {
      storage: {
        local: {
          setAccessLevel: () => Promise.resolve(),
          get: async (key) => {
            if (key === null) return { ...localStorage };
            if (Array.isArray(key)) {
              return Object.fromEntries(key.map((item) => [item, localStorage[item]]));
            }
            return { [key]: localStorage[key] };
          },
          set: async (values) => Object.assign(localStorage, values),
          remove: async (keys) => {
            for (const key of Array.isArray(keys) ? keys : [keys]) {
              delete localStorage[key];
            }
          },
        },
      },
      action: { onClicked: listeners },
      sidePanel,
      runtime: {
        onInstalled: listeners,
        onMessage: {
          addListener(listener) {
            runtimeMessageListeners.push(listener);
          },
        },
        openOptionsPage() {},
        getURL: (resourcePath) => `chrome-extension://test/${resourcePath}`,
        sendMessage: () => Promise.resolve({ success: true }),
      },
      tabs: { onUpdated: listeners, onActivated: listeners },
    },
  };
  if (permissions) sandbox.chrome.permissions = permissions;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(read("settings.js"), sandbox);
  vm.runInNewContext(read("ai-providers.js"), sandbox);
  vm.runInNewContext(read("background.js"), sandbox);
  return {
    ...sandbox.__YTD_TRANSLATION_TESTING__,
    dispatchRuntimeMessage(message, sender = {}) {
      return new Promise((resolve) => {
        const handled = runtimeMessageListeners.some(
          (listener) => listener(message, sender, resolve) === true,
        );
        if (!handled) resolve(undefined);
      });
    },
  };
}

test("non-YouTube tabs explicitly close before their panel is disabled", async () => {
  const calls = [];
  const background = loadBackgroundHelpers({
    sidePanel: {
      setPanelBehavior() {},
      close: async (options) => calls.push(["close", options]),
      setOptions: async (options) => calls.push(["setOptions", options]),
    },
  });

  await background.updatePanelForTab(17, "https://example.com/page", 4);

  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ["close", { tabId: 17 }],
    ["setOptions", { tabId: 17, enabled: false }],
  ]);
});

test("a global panel closes by window when the tab close is rejected", async () => {
  const calls = [];
  const background = loadBackgroundHelpers({
    sidePanel: {
      setPanelBehavior() {},
      close: async (options) => {
        calls.push(["close", options]);
        if (options.tabId) throw new Error("Global panel");
      },
      setOptions: async (options) => calls.push(["setOptions", options]),
    },
  });

  await background.updatePanelForTab(17, "https://example.com/page", 4);

  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ["close", { tabId: 17 }],
    ["close", { windowId: 4 }],
    ["setOptions", { tabId: 17, enabled: false }],
  ]);
});

function createFakeTimers() {
  let nextId = 1;
  const timers = new Map();
  return {
    setTimeout(callback, delay) {
      const id = nextId++;
      timers.set(id, { callback, delay, active: true });
      return id;
    },
    clearTimeout(id) {
      const timer = timers.get(id);
      if (timer) timer.active = false;
    },
    fireActive(delay) {
      const match = [...timers.entries()].find(
        ([, timer]) => timer.active && timer.delay === delay,
      );
      assert.ok(match, `Expected an active ${delay}ms timer`);
      match[1].active = false;
      match[1].callback();
    },
    activeCount(delay) {
      return [...timers.values()].filter(
        (timer) => timer.active && timer.delay === delay,
      ).length;
    },
    createdCount(delay) {
      return [...timers.values()].filter((timer) => timer.delay === delay).length;
    },
  };
}

function streamingResponse(chunks, { ok = true, status = 200 } = {}) {
  let index = 0;
  return {
    ok,
    status,
    body: {
      getReader() {
        return {
          async read() {
            if (index >= chunks.length) return { done: true };
            return { done: false, value: chunks[index++] };
          },
          async cancel() {},
        };
      },
    },
  };
}

const encode = (value) => new TextEncoder().encode(value);
const nextTurn = () => new Promise((resolve) => setImmediate(resolve));

test("the header exposes one universal language control for all result tabs", () => {
  const html = read("sidepanel.html");
  const js = read("sidepanel.js");
  assert.match(html, /id="transcriptModeControl"[\s\S]*aria-label="Content language"/);
  assert.match(html, /id="transcriptModeControl"[\s\S]*id="tabsNav"/);
  assert.match(html, /data-transcript-mode="original"[\s\S]*?>Original</);
  assert.match(html, /data-transcript-mode="zh"[\s\S]*?>\u4e2d\u6587</);
  assert.match(html, /data-transcript-mode="bilingual"[\s\S]*?>\u53cc\u8bed</);
  assert.match(js, /handleDisplayLanguageModeChange\(button\.dataset\.transcriptMode\)/);
  assert.match(js, /contentType: "transcriptBatch"/);
  assert.match(js, /contentType: "interfaceBatch"/);
  assert.match(js, /translateOverviewContent/);
  assert.match(js, /translateNotesContent/);
  assert.doesNotMatch(js, /English \+ Chinese/);
  assert.doesNotMatch(`${html}\n${js}`, /From video subtitles/);
});

test("new videos default to Original while returning videos restore their choice", async () => {
  const { loadDisplayLanguageMode, saveDisplayLanguageMode } =
    loadSidepanelHelpers();

  await saveDisplayLanguageMode("video-a", "bilingual");
  assert.equal(await loadDisplayLanguageMode("video-a"), "bilingual");
  assert.equal(await loadDisplayLanguageMode("unseen-video"), "original");
});

test("Overview shares the Transcript batch generation and retries when opened", () => {
  const js = read("sidepanel.js");
  const transcriptFunction = js.match(
    /async function translateTranscript\(\)[\s\S]*?\n}\n\nfunction setTranslatingSpinner/,
  )?.[0];

  assert.ok(transcriptFunction);
  assert.doesNotMatch(transcriptFunction, /translationGeneration \+= 1/);
  assert.match(js, /const TRANSLATION_BATCH_SIZE = 3/);
  assert.match(
    js,
    /const batch = missing\.slice\(start, start \+ TRANSLATION_BATCH_SIZE\)[\s\S]*?rerender\(\);[\s\S]*?await updateCache\(\)/,
  );
  assert.match(
    js,
    /tabName === "overview"[\s\S]*?currentAnalysis[\s\S]*?currentTranscriptMode !== "original"[\s\S]*?translateOverviewContent\(\)/,
  );
  assert.match(
    js,
    /Translate only the visible tab[\s\S]*?tabName === "notes"[\s\S]*?translateNotesContent\(\)/,
  );
  assert.match(
    js,
    /activeTabName === "overview"[\s\S]*?translateOverviewContent\(\)[\s\S]*?activeTabName === "notes"[\s\S]*?translateNotesContent\(\)[\s\S]*?activeTabName === "transcript"[\s\S]*?translateTranscript\(\)/,
  );
});

test("transcript reading position survives a side panel close", async () => {
  const { saveTranscriptViewState, loadTranscriptViewState } =
    loadSidepanelHelpers();

  await saveTranscriptViewState("video-a", 427.5);
  const restored = await loadTranscriptViewState("video-a");

  assert.deepEqual(JSON.parse(JSON.stringify(restored)), {
    videoId: "video-a",
    scrollTop: 427.5,
  });
});

test("selected transcript notes keep exact text and row timestamp", async () => {
  const providerMustNotRun = async () => {
    throw new Error("Selected note must not call a provider");
  };
  const { handleSaveNote } = loadBackgroundHelpers({
    fetchImpl: providerMustNotRun,
  });

  const result = await handleSaveNote(
    "video123",
    92.9,
    "Test video",
    "Test channel",
    "  The selected words stay exact.  ",
  );

  assert.equal(result.success, true);
  assert.equal(result.note.text, "The selected words stay exact.");
  assert.equal(result.note.rawText, "The selected words stay exact.");
  assert.equal(result.note.timestamp, "1:32");
  assert.equal(result.note.timestampSeconds, 92);
  assert.equal(
    result.note.timestampedUrl,
    "https://www.youtube.com/watch?v=video123&t=92s",
  );
});

test("semantic segmentation rebuilds sentences across caption boundaries", () => {
  const { groupTranscriptEntries } = loadSidepanelHelpers();
  const segments = groupTranscriptEntries(
    [
      { start: 0, text: "Caption boundaries should" },
      { start: 2, text: "not break a complete sentence." },
      { start: 5, text: "The next thought also" },
      { start: 7, text: "stays together!" },
    ],
    { minChars: 1, idealChars: 100, maxChars: 320, maxSeconds: 20 },
  );
  assert.equal(segments.length, 2);
  assert.equal(
    segments[0].text,
    "Caption boundaries should not break a complete sentence.",
  );
  assert.equal(segments[0].start, 0);
  assert.equal(segments[1].text, "The next thought also stays together!");
  assert.equal(segments[1].start, 5);
});

test("a huge raw Supadata entry is split into seekable bounded segments", () => {
  const { groupTranscriptEntries } = loadSidepanelHelpers();
  const text = Array.from({ length: 900 }, (_, index) => `word${index}`).join(" ");
  const segments = groupTranscriptEntries([
    { start: 12, duration: 90, text },
  ]);
  assert.ok(segments.length > 8);
  assert.ok(segments.every((segment) => segment.text.length <= 384));
  assert.equal(segments[0].start, 12);
  assert.ok(segments.at(-1).start > segments[0].start);
  assert.ok(segments.every((segment) => /^segment-\d+-\d+$/.test(segment.id)));
});

test("Chinese sentence and clause punctuation creates semantic guardrails", () => {
  const { groupTranscriptEntries } = loadSidepanelHelpers();
  const segments = groupTranscriptEntries(
    [
      { start: 0, text: "这是一个被字幕切开的" },
      { start: 2, text: "完整句子。这是第二个想法，" },
      { start: 5, text: "也应该保持语义完整！" },
    ],
    { minChars: 1, idealChars: 100, maxChars: 320, maxSeconds: 20 },
  );
  assert.equal(segments.length, 2);
  assert.equal(segments[0].text, "这是一个被字幕切开的完整句子。");
  assert.equal(segments[1].text, "这是第二个想法，也应该保持语义完整！");
});

test("structured translation batches align by stable ID and expose missing fallback", () => {
  const sidepanel = loadSidepanelHelpers();
  const background = loadBackgroundHelpers();
  const source = [
    { id: "segment-0-0", text: "A complete first sentence." },
    { id: "segment-1-5000", text: "A complete second sentence." },
  ];
  assert.deepEqual(
    JSON.parse(JSON.stringify(background.validateTranscriptBatchRequest({ segments: source }))),
    source,
  );

  const normalized = background.normalizeTranslatedSegmentBatch(
    {
      segments: [
        { id: "unknown", text: "\u5ffd\u7565" },
        { id: "segment-1-5000", text: "\u7b2c\u4e8c\u4e2a\u5b8c\u6574\u53e5\u5b50\u3002" },
      ],
    },
    source,
  );
  const aligned = sidepanel.alignTranslatedSegmentBatch(
    source,
    normalized.segments,
  );
  assert.equal(aligned[0].id, source[0].id);
  assert.equal(aligned[0].text, "");
  assert.match(aligned[0].error, /unavailable/i);
  assert.equal(aligned[1].text, "\u7b2c\u4e8c\u4e2a\u5b8c\u6574\u53e5\u5b50\u3002");
});

test("translated-only omits English while bilingual renders aligned English and Chinese", () => {
  const { renderTranscriptSegmentContent } = loadSidepanelHelpers();
  const segment = { id: "segment-0-0", text: "Original English sentence." };
  const translatedOnly = renderTranscriptSegmentContent(
    segment,
    "zh",
    "\u4e2d\u6587\u8bd1\u6587\u3002",
    "",
  );
  const bilingual = renderTranscriptSegmentContent(
    segment,
    "bilingual",
    "\u4e2d\u6587\u8bd1\u6587\u3002",
    "",
  );
  assert.doesNotMatch(translatedOnly, /Original English sentence/);
  assert.match(translatedOnly, /\u4e2d\u6587\u8bd1\u6587/);
  assert.match(bilingual, /transcript-original/);
  assert.match(bilingual, /Original English sentence/);
  assert.match(bilingual, /\u4e2d\u6587\u8bd1\u6587/);
});

test("subtitle formatting tags render in original and translated segment text", () => {
  const { renderTranscriptSegmentContent } = loadSidepanelHelpers();
  const html = renderTranscriptSegmentContent(
    {
      id: "segment-0-0",
      text: "Think <i>deeply</i>, <b>carefully</b>, and <u>clearly</u>.<br>Next line.",
    },
    "bilingual",
    "\u5b57\u5730<i>\u601d\u8003</i>\u7684\u3002<strong>\u91cd\u70b9</strong>",
    "",
  );

  assert.match(html, /Think <i>deeply<\/i>/);
  assert.match(html, /<b>carefully<\/b>/);
  assert.match(html, /<u>clearly<\/u>\.<br>Next line/);
  assert.match(html, /\u5b57\u5730<i>\u601d\u8003<\/i>\u7684\u3002<strong>\u91cd\u70b9<\/strong>/);
});

test("subtitle markup renderer keeps attributed and arbitrary HTML escaped", () => {
  const { renderSubtitleInlineMarkup } = loadSidepanelHelpers();
  const html = renderSubtitleInlineMarkup(
    '<img src=x onerror="alert(1)"><i onclick="alert(2)">unsafe</i><script>alert(3)</script>',
  );

  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /&lt;i onclick=&quot;alert\(2\)&quot;&gt;unsafe<\/i>/);
  assert.match(html, /&lt;script&gt;alert\(3\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<img\b|<i\s+onclick|<script\b/);
});

test("background rejects unsupported language fallthrough and malformed batches", () => {
  const source = read("background.js");
  const { validateTranscriptBatchRequest } = loadBackgroundHelpers();
  assert.match(source, /targetLanguage !== "zh"/);
  assert.match(source, /\["transcriptBatch", "interfaceBatch"\]/);
  assert.throws(
    () => validateTranscriptBatchRequest({ segments: [] }),
    /1 to 4 segments/,
  );
  assert.throws(
    () =>
      validateTranscriptBatchRequest({
        segments: [
          { id: "duplicate", text: "first" },
          { id: "duplicate", text: "second" },
        ],
      }),
    /unique and stable/,
  );
});

test("the default AI request uses Kimi without provider-only fields", async () => {
  const kimiRequests = [];
  const successfulFetch = (requests) => async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "translated" } }],
      }),
    };
  };

  const kimi = loadBackgroundHelpers({
    fetchImpl: successfulFetch(kimiRequests),
  });
  const kimiResult = await kimi.requestAiCompletion({
    system: "Translate accurately.",
    maxTokens: 128,
    messages: [{ role: "user", content: "Hello." }],
  });
  assert.equal(kimiResult.text, "translated");
  assert.equal(
    kimiRequests[0].url,
    "https://api.kimi.com/coding/v1/chat/completions",
  );
  assert.equal(kimiRequests[0].body.model, "kimi-for-coding");
  assert.deepEqual(kimiRequests[0].body.messages[0], {
    role: "system",
    content: "Translate accurately.",
  });
  assert.equal(Object.hasOwn(kimiRequests[0].body, "thinking"), false);
  assert.equal(Object.hasOwn(kimiRequests[0].body, "response_format"), false);

  const backgroundSource = read("background.js");
  assert.doesNotMatch(backgroundSource, /disableThinking/);
  for (const callPath of [
    "handleAnalyzeTranscript",
    "cleanupNoteText",
    "handleExplainSelection",
    "callAiTranslation",
  ]) {
    assert.match(
      backgroundSource,
      new RegExp(`async function ${callPath}\\([\\s\\S]*?requestAiCompletion\\(\\{`),
    );
  }
});

test("OpenRouter, Anthropic, and Gemini each use their isolated runtime contract", async () => {
  const cases = [
    {
      providerId: "openrouter",
      profile: { apiKey: "router-key", model: "openai/gpt-5" },
      response: { choices: [{ message: { content: "router answer" } }] },
      expectedUrl: "https://openrouter.ai/api/v1/chat/completions",
      expectedHeader: ["Authorization", "Bearer router-key"],
      expectedText: "router answer",
    },
    {
      providerId: "anthropic",
      profile: { apiKey: "claude-key", model: "claude-model" },
      response: { content: [{ type: "text", text: "claude answer" }] },
      expectedUrl: "https://api.anthropic.com/v1/messages",
      expectedHeader: ["x-api-key", "claude-key"],
      expectedText: "claude answer",
    },
    {
      providerId: "gemini",
      profile: { apiKey: "gemini-key", model: "gemini-model" },
      response: {
        candidates: [{ content: { parts: [{ text: "gemini answer" }] } }],
      },
      expectedUrl:
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-model:generateContent",
      expectedHeader: ["x-goog-api-key", "gemini-key"],
      expectedText: "gemini answer",
    },
  ];

  for (const current of cases) {
    const requests = [];
    const stored = settingsApi.normalize({
      aiConfigVersion: 2,
      activeProvider: current.providerId,
      providers: { [current.providerId]: current.profile },
      supadataApiKey: "supadata-key",
    });
    const helpers = loadBackgroundHelpers({
      settings: stored,
      fetchImpl: async (url, options) => {
        requests.push({
          url,
          headers: options.headers,
          body: JSON.parse(options.body),
        });
        return { ok: true, status: 200, json: async () => current.response };
      },
    });

    const result = await helpers.requestAiCompletion({
      system: "System instructions",
      messages: [{ role: "user", content: "Hello" }],
      maxTokens: 64,
      temperature: 0.2,
    });

    assert.equal(result.text, current.expectedText);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, current.expectedUrl);
    assert.equal(
      requests[0].headers[current.expectedHeader[0]],
      current.expectedHeader[1],
    );
  }
});

test("public configuration status identifies the provider without exposing keys", async () => {
  const stored = settingsApi.normalize({
    aiConfigVersion: 2,
    activeProvider: "openrouter",
    providers: {
      openrouter: { apiKey: "router-key", model: "openai/gpt-5" },
    },
    supadataApiKey: "supadata-key",
  });
  const helpers = loadBackgroundHelpers({ settings: stored });

  const status = await helpers.dispatchRuntimeMessage({ action: "checkConfig" });
  assert.deepEqual(JSON.parse(JSON.stringify(status)), {
    hasSupadataKey: true,
    hasAiKey: true,
    aiProviderName: "OpenRouter",
  });
  assert.equal(JSON.stringify(status).includes("router-key"), false);
});

test("product errors name the selected provider instead of Kimi", async () => {
  const missingKeySettings = settingsApi.normalize({
    aiConfigVersion: 2,
    activeProvider: "openrouter",
    providers: {
      openrouter: { apiKey: "", model: "openai/gpt-5" },
    },
  });
  const missing = await loadBackgroundHelpers({
    settings: missingKeySettings,
  }).handleTranslateContent(
    { segments: [{ id: "segment-0-0", text: "English source sentence." }] },
    "transcriptBatch",
    "zh",
    "Video",
  );
  assert.equal(missing.success, false);
  assert.match(missing.error, /OpenRouter/);
  assert.doesNotMatch(missing.error, /Kimi/);

  let requests = 0;
  const limitedSettings = settingsApi.normalize({
    aiConfigVersion: 2,
    activeProvider: "openrouter",
    providers: {
      openrouter: { apiKey: "router-key", model: "openai/gpt-5" },
    },
  });
  const limited = await loadBackgroundHelpers({
    settings: limitedSettings,
    fetchImpl: async () => {
      requests += 1;
      return {
        ok: false,
        status: 429,
        json: async () => ({ error: { message: "Quota exceeded" } }),
      };
    },
  }).callAiTranslation("Translate accurately.", "Hello.", {
    maxTokens: 32,
  });
  assert.equal(limited.success, false);
  assert.equal(limited.code, "RATE_LIMITED");
  assert.match(limited.error, /OpenRouter/);
  assert.equal(requests, 1);
});

test("non-JSON provider failures retain authentication and rate-limit codes", async () => {
  const providerSettings = settingsApi.normalize({
    aiConfigVersion: 2,
    activeProvider: "openrouter",
    providers: {
      openrouter: { apiKey: "router-key", model: "openai/gpt-5" },
    },
  });
  for (const [status, code] of [[401, "INVALID_AI_KEY"], [429, "RATE_LIMITED"]]) {
    const helpers = loadBackgroundHelpers({
      settings: providerSettings,
      fetchImpl: async () =>
        streamingResponse([encode("upstream returned plain text")], {
          ok: false,
          status,
        }),
    });
    const result = await helpers.callAiTranslation("Translate.", "Hello.");
    assert.equal(result.success, false);
    assert.equal(result.code, code);
    assert.match(result.error, /OpenRouter/);
  }
});

test("provider failure logging never includes reflected server secrets", () => {
  const calls = [];
  const helpers = loadBackgroundHelpers({
    consoleImpl: {
      log() {},
      warn() {},
      error(...args) {
        calls.push(args);
      },
    },
  });
  const error = new Error("reflected-private-transcript-and-key");
  error.code = "RATE_LIMITED";
  error.provider = "openrouter";
  error.status = 429;

  helpers.logProviderFailure("Translation error", error);

  assert.equal(JSON.stringify(calls).includes("reflected-private"), false);
  assert.match(JSON.stringify(calls), /RATE_LIMITED/);
  assert.match(JSON.stringify(calls), /openrouter/);
});

test("Supadata failures do not expose reflected response text", async () => {
  const calls = [];
  const storedSettings = settingsApi.normalize({
    aiConfigVersion: 2,
    activeProvider: "kimi-code",
    providers: { "kimi-code": { apiKey: "kimi-test" } },
    supadataApiKey: "supa-test",
  });
  const helpers = loadBackgroundHelpers({
    settings: storedSettings,
    consoleImpl: {
      log() {},
      warn() {},
      error(...args) {
        calls.push(args);
      },
    },
    fetchImpl: async () => ({
      ok: false,
      status: 500,
      json: async () => ({ message: "reflected-private-transcript" }),
    }),
  });

  const result = await helpers.handleFetchTranscript("dQw4w9WgXcQ");
  const visible = JSON.stringify({ result, calls });

  assert.equal(result.success, false);
  assert.equal(result.error, "SUPADATA_HTTP_ERROR");
  assert.match(result.message, /HTTP 500/);
  assert.equal(visible.includes("reflected-private"), false);
});

test("malformed OpenRouter output keeps provider-aware product errors", async () => {
  const storedSettings = settingsApi.normalize({
    aiConfigVersion: 2,
    activeProvider: "openrouter",
    providers: {
      openrouter: { apiKey: "router-test", model: "openai/gpt-5" },
    },
  });
  const fetchImpl = async (url) => {
    if (url.startsWith("chrome-extension://")) {
      const promptName = url.split("/").at(-1);
      return { ok: true, text: async () => read(`prompts/${promptName}`) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "not valid product json" } }],
      }),
    };
  };

  const analysis = await loadBackgroundHelpers({
    settings: storedSettings,
    fetchImpl,
  }).handleAnalyzeTranscript(
    "[0:00] Example transcript.",
    "Video",
    "Channel",
    "Description",
    10,
  );
  const translation = await loadBackgroundHelpers({
    settings: storedSettings,
    fetchImpl,
  }).handleTranslateContent(
    { segments: [{ id: "segment-0", text: "English source sentence." }] },
    "transcriptBatch",
    "zh",
    "Video",
  );

  for (const result of [analysis, translation]) {
    assert.equal(result.success, false);
    assert.equal(result.code, "INVALID_AI_RESPONSE");
    assert.equal(result.provider, "openrouter");
    assert.match(result.error, /OpenRouter/);
  }
});

test("note cleanup parse warnings never log model output", () => {
  const source = read("background.js");
  assert.doesNotMatch(
    source,
    /console\.warn\([\s\S]{0,200}JSON parse failed[\s\S]{0,200}parseError/,
  );
  assert.match(source, /NOTE_CLEANUP_PARSE_FAILED/);
});

test("a revoked optional host permission stops before provider fetch", async () => {
  let fetchCalls = 0;
  const providerSettings = settingsApi.normalize({
    aiConfigVersion: 2,
    activeProvider: "openrouter",
    providers: {
      openrouter: { apiKey: "router-key", model: "openai/gpt-5" },
    },
  });
  const helpers = loadBackgroundHelpers({
    settings: providerSettings,
    permissions: { contains: async () => false },
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error("must not fetch");
    },
  });

  const result = await helpers.callAiTranslation("Translate.", "Hello.");

  assert.equal(result.success, false);
  assert.equal(result.code, "AI_HOST_PERMISSION_REQUIRED");
  assert.match(result.error, /OpenRouter/);
  assert.equal(fetchCalls, 0);
});

test("connection testing accepts settings only from the trusted options page", async () => {
  const requests = [];
  const draft = settingsApi.normalize({
    aiConfigVersion: 2,
    activeProvider: "openrouter",
    providers: {
      openrouter: { apiKey: "router-key", model: "openai/gpt-5" },
    },
  });
  const helpers = loadBackgroundHelpers({
    fetchImpl: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: "OK" } }] }),
      };
    },
  });

  const rejected = await helpers.dispatchRuntimeMessage(
    { action: "testAiConnection", settings: draft },
    { url: "https://www.youtube.com/watch?v=test" },
  );
  assert.equal(rejected.success, false);
  assert.equal(rejected.error, "UNTRUSTED_SETTINGS_TEST");
  assert.equal(requests.length, 0);

  const accepted = await helpers.dispatchRuntimeMessage(
    { action: "testAiConnection", settings: draft },
    { url: "chrome-extension://test/options.html" },
  );
  assert.equal(accepted.success, true);
  assert.equal(accepted.provider, "OpenRouter");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(requests[0].body.max_tokens, 8);
  assert.deepEqual(requests[0].body.messages, [
    { role: "user", content: "Reply with only OK." },
  ]);
});

test("blank-line chunks reset provider idle timeout and valid JSON succeeds", async () => {
  const timers = createFakeTimers();
  const helpers = loadBackgroundHelpers({
    setTimeoutImpl: timers.setTimeout,
    clearTimeoutImpl: timers.clearTimeout,
    fetchImpl: async () =>
      streamingResponse([
        encode("\n"),
        encode("\n"),
        encode('{"choices":[{"message":{"content":"translated"}}]}'),
      ]),
  });

  const result = await helpers.callAiTranslation("Translate.", "Hello.");
  assert.equal(result.success, true);
  assert.equal(result.text, "translated");
  assert.equal(timers.createdCount(50_000), 5);
  assert.equal(timers.activeCount(50_000), 0);
  assert.equal(timers.activeCount(120_000), 0);
});

test("provider idle silence aborts with a distinct Retry-able error", async () => {
  const timers = createFakeTimers();
  const helpers = loadBackgroundHelpers({
    setTimeoutImpl: timers.setTimeout,
    clearTimeoutImpl: timers.clearTimeout,
    fetchImpl: async (_url, { signal }) => ({
      ok: true,
      status: 200,
      body: {
        getReader: () => ({
          read: () =>
            new Promise((_resolve, reject) => {
              signal.addEventListener("abort", () => {
                const error = new Error("aborted");
                error.name = "AbortError";
                reject(error);
              });
            }),
        }),
      },
    }),
  });

  const request = helpers.callAiTranslation("Translate.", "Hello.");
  await nextTurn();
  timers.fireActive(50_000);
  const result = await request;
  assert.equal(result.success, false);
  assert.equal(result.code, "AI_IDLE_TIMEOUT");
  assert.match(result.error, /inactive for 50 seconds.*Retry/i);
  assert.equal(timers.activeCount(120_000), 0);
});

test("blank-line keepalives cannot evade the provider hard cap", async () => {
  const timers = createFakeTimers();
  let releaseRead;
  let signal;
  const helpers = loadBackgroundHelpers({
    setTimeoutImpl: timers.setTimeout,
    clearTimeoutImpl: timers.clearTimeout,
    fetchImpl: async (_url, options) => {
      signal = options.signal;
      return {
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: () =>
              new Promise((resolve, reject) => {
                releaseRead = () => resolve({ done: false, value: encode("\n") });
                signal.addEventListener("abort", () => {
                  const error = new Error("aborted");
                  error.name = "AbortError";
                  reject(error);
                }, { once: true });
              }),
          }),
        },
      };
    },
  });

  const request = helpers.callAiTranslation("Translate.", "Hello.");
  await nextTurn();
  releaseRead();
  await nextTurn();
  releaseRead();
  await nextTurn();
  assert.equal(timers.activeCount(50_000), 1);
  timers.fireActive(120_000);
  const result = await request;
  assert.equal(result.success, false);
  assert.equal(result.code, "AI_HARD_TIMEOUT");
  assert.match(result.error, /120-second limit.*Retry/i);
  assert.equal(timers.activeCount(50_000), 0);
});

test("provider response reader accepts leading whitespace before JSON", async () => {
  const helpers = loadBackgroundHelpers({
    fetchImpl: async () =>
      streamingResponse([
        encode('  \n\t{"choices":[{"message":{"content":"ok"}}]}'),
      ]),
  });
  const result = await helpers.callAiTranslation("Translate.", "Hello.");
  assert.equal(result.success, true);
  assert.equal(result.text, "ok");
});

test("provider response reader rejects bodies over 2 MiB", async () => {
  const helpers = loadBackgroundHelpers({
    fetchImpl: async () =>
      streamingResponse([new Uint8Array(2 * 1024 * 1024 + 1)]),
  });
  const result = await helpers.callAiTranslation("Translate.", "Hello.");
  assert.equal(result.success, false);
  assert.equal(result.code, "AI_RESPONSE_TOO_LARGE");
  assert.match(result.error, /2 MiB limit/);
});

test("Kimi transcript translation sends one provider-compatible JSON request", async () => {
  const requests = [];
  const helpers = loadBackgroundHelpers({
    fetchImpl: async (url, options) => {
      if (url.startsWith("chrome-extension://")) {
        return { ok: true, text: async () => read("prompts/translation.md") };
      }
      requests.push(JSON.parse(options.body));
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '{"segments":[{"id":"segment-0-0","text":"\u4e2d\u6587\u8bd1\u6587\u3002"}]}',
            },
          }],
        }),
      };
    },
  });
  const result = await helpers.handleTranslateContent(
    { segments: [{ id: "segment-0-0", text: "English source sentence." }] },
    "transcriptBatch",
    "zh",
    "Video",
  );
  assert.equal(result.success, true);
  assert.equal(requests.length, 1);
  assert.equal(Object.hasOwn(requests[0], "response_format"), false);
  assert.equal(Object.hasOwn(requests[0], "thinking"), false);
  assert.equal(requests[0].max_tokens, 1536);
});

test("interface batches use the dedicated Overview and Notes translation prompt", async () => {
  const requests = [];
  const helpers = loadBackgroundHelpers({
    fetchImpl: async (url, options) => {
      if (url.startsWith("chrome-extension://")) {
        return { ok: true, text: async () => read("prompts/translation.md") };
      }
      requests.push(JSON.parse(options.body));
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '{"segments":[{"id":"note-1","text":"\u4e2d\u6587\u7b14\u8bb0\u3002"}]}',
            },
          }],
        }),
      };
    },
  });

  const result = await helpers.handleTranslateContent(
    { segments: [{ id: "note-1", text: "Saved note." }] },
    "interfaceBatch",
    "zh",
    "Video",
  );

  assert.equal(result.success, true);
  assert.equal(result.translatedContent.segments[0].text, "\u4e2d\u6587\u7b14\u8bb0\u3002");
  assert.match(
    requests[0].messages[0].content,
    /chapter titles, summaries, quotes, and saved notes/,
  );
});

test("translation message watchdog rejects, clears its timer, and ignores late replies", async () => {
  let timeoutCallback;
  let timeoutDelay;
  let resolveMessage;
  let clearCount = 0;
  const helpers = loadSidepanelHelpers({
    sendMessage: () =>
      new Promise((resolve) => {
        resolveMessage = resolve;
      }),
    setTimeoutImpl(callback, delay) {
      timeoutCallback = callback;
      timeoutDelay = delay;
      return 73;
    },
    clearTimeoutImpl(id) {
      assert.equal(id, 73);
      clearCount += 1;
    },
  });

  const request = helpers.sendTranslationMessage({
    action: "translateContent",
  });
  assert.equal(timeoutDelay, 130_000);
  timeoutCallback();
  await assert.rejects(request, /timed out after 130 seconds.*Retry/i);
  assert.equal(clearCount, 1);

  resolveMessage({ success: true });
  await Promise.resolve();
  assert.equal(clearCount, 1);

  let successTimeoutCallback;
  let successClearCount = 0;
  const successfulHelpers = loadSidepanelHelpers({
    sendMessage: () => Promise.resolve({ success: true }),
    setTimeoutImpl(callback) {
      successTimeoutCallback = callback;
      return 91;
    },
    clearTimeoutImpl(id) {
      assert.equal(id, 91);
      successClearCount += 1;
    },
  });
  assert.deepEqual(
    await successfulHelpers.sendTranslationMessage({
      action: "translateContent",
    }),
    { success: true },
  );
  assert.equal(successClearCount, 1);
  successTimeoutCallback();
  assert.equal(successClearCount, 1);
});

test("Chinese prompt preserves natural bilingual-learning style rules", () => {
  const prompt = read("prompts/translation.md");
  assert.match(prompt, /Translate the complete thought/);
  assert.match(prompt, /Use 你, never 您/);
  assert.match(prompt, /spaces between Chinese and adjacent English words or digits/);
  assert.match(prompt, /source-language `text`/);
});
