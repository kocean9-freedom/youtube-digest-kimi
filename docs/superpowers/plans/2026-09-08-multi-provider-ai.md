# Multi-provider AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Kimi Coding Plan as the default while adding OpenRouter simple mode and official/custom direct-provider mode with isolated credentials, protocols, and Chrome permissions.

**Architecture:** `settings.js` owns a versioned provider registry and normalized non-secret configuration shape. A new `ai-providers.js` owns OpenAI-compatible, Anthropic, and Gemini request/response adapters, while `background.js` retains request lifecycle limits and product handlers. `options.js` owns mode selection, exact-origin permission requests, OpenRouter model discovery, connection testing, and local storage.

**Tech Stack:** Chrome Extension Manifest V3, plain JavaScript IIFEs/CommonJS test exports, HTML/CSS, Node.js built-in test runner, Bash release scripts.

**Spec:** `docs/superpowers/specs/2026-09-08-multi-provider-ai-design.md`

## Global Constraints

- Target version is exactly `1.3.0`; minimum Chrome version remains `116`.
- Kimi Coding Plan remains the default provider at `https://api.kimi.com/coding/v1` with model `kimi-for-coding` and no thinking-disable field.
- API keys remain bring-your-own-key values in `chrome.storage.local`; no key may enter source, logs, tests, screenshots, docs, or ZIP artifacts.
- Each provider has an isolated credential slot; switching providers never copies or deletes another provider's key.
- DeepSeek-only fields, errors, and retry behavior stay inside the DeepSeek rule path.
- No automatic provider/model fallback and no automatic retry of paid AI requests.
- Custom endpoints require HTTPS except `http://localhost` and `http://127.0.0.1`.
- Supadata and Kimi retain required host access; all other AI origins use exact-origin runtime requests covered by optional host permissions.
- Do not add a bundler, framework, remote code, arbitrary request headers, or arbitrary request-body scripting.
- Preserve the MIT license and visibly credit Zara Zhang and the upstream repository.

---

### Task 1: Versioned provider configuration and registry

**Files:**
- Modify: `settings.js`
- Modify: `tests/settings.test.js`

**Interfaces:**
- Produces: `YTD_SETTINGS.CONFIG_VERSION`, `PROVIDERS`, `ADVANCED_PROVIDER_IDS`, `normalize(input)`, `migrateProviderSettings(input)`, `getActiveProvider(settings)`, `getActiveProfile(settings)`, `getActiveCredential(settings)`, `validateCustomBaseUrl(value)`, `buildChatCompletionsUrl(baseUrl)`.
- Configuration shape: `{ aiConfigVersion, activeProvider, providers, supadataApiKey }`; each `providers[id]` stores only that provider's editable `apiKey`, `model`, and permitted `baseUrl` fields.

- [ ] **Step 1: Write failing schema, migration, key-isolation, and URL tests**

```js
test("current Kimi settings migrate to version 2 without losing its key", () => {
  const result = settings.migrateProviderSettings({
    provider: "kimi-code",
    aiApiKey: " kimi-key ",
    supadataApiKey: " supadata-key ",
  });
  assert.equal(result.settings.aiConfigVersion, 2);
  assert.equal(result.settings.activeProvider, "kimi-code");
  assert.equal(result.settings.providers["kimi-code"].apiKey, "kimi-key");
  assert.equal(result.settings.supadataApiKey, "supadata-key");
});

test("provider credentials remain isolated when active provider changes", () => {
  const normalized = settings.normalize({
    aiConfigVersion: 2,
    activeProvider: "openrouter",
    providers: {
      "kimi-code": { apiKey: "kimi-key" },
      openrouter: { apiKey: "router-key", model: "openai/gpt-5" },
    },
  });
  assert.equal(settings.getActiveCredential(normalized), "router-key");
  assert.equal(normalized.providers["kimi-code"].apiKey, "kimi-key");
});

test("custom URL validation permits HTTPS and local HTTP only", () => {
  assert.equal(settings.validateCustomBaseUrl("https://ai.example/v1"), "https://ai.example/v1");
  assert.equal(settings.validateCustomBaseUrl("http://localhost:11434/v1/"), "http://localhost:11434/v1");
  assert.throws(() => settings.validateCustomBaseUrl("http://ai.example/v1"), /HTTPS/);
  assert.throws(() => settings.validateCustomBaseUrl("https://user:pass@ai.example/v1"), /credentials/);
});
```

- [ ] **Step 2: Run RED verification**

Run: `node --test tests/settings.test.js`  
Expected: FAIL because version-2 helpers and provider slots do not exist.

- [ ] **Step 3: Implement the registry and normalized schema**

Use stable IDs `kimi-code`, `openrouter`, `openai`, `deepseek`, `kimi-open`, `qwen`, `glm`, `siliconflow`, `anthropic`, `gemini`, and `custom`. Registry entries include `mode`, `protocol`, `name`, `baseUrl`, `defaultModel`, `editableBaseUrl`, `editableModel`, `origin`, `docsUrl`, and `keyUrl`. Freeze published metadata and reconstruct sanitized settings rather than spreading untrusted stored objects.

Migration rules:

```js
if (input.aiConfigVersion === 2) return normalizedV2;
if (input.provider === "kimi-code") {
  providers["kimi-code"].apiKey = trim(input.aiApiKey);
}
// Non-Kimi legacy keys stay cleared; Supadata is always preserved.
```

`getActiveProvider()` falls back to Kimi for unknown IDs. `getActiveProfile()` returns a reconstructed copy of only the active slot. `getActiveCredential()` reads only that slot. `buildChatCompletionsUrl()` strips trailing slashes and avoids duplicating `/chat/completions`.

- [ ] **Step 4: Run GREEN verification**

Run: `node --test tests/settings.test.js`  
Expected: all settings tests pass.

- [ ] **Step 5: Commit the independently working configuration layer**

```bash
git add settings.js tests/settings.test.js docs/superpowers/specs/2026-09-08-multi-provider-ai-design.md docs/superpowers/plans/2026-09-08-multi-provider-ai.md
git commit -m "feat(settings): add isolated provider profiles"
```

### Task 2: Protocol adapters and normalized errors

**Files:**
- Create: `ai-providers.js`
- Create: `tests/ai-providers.test.js`

**Interfaces:**
- Consumes: provider objects returned by `YTD_SETTINGS.getActiveProvider(settings)`.
- Produces: `YTD_AI_PROVIDERS.buildRequest(provider, profile, input)`, `parseResponse(provider, data)`, `createHttpError(provider, status, data)`, and `normalizeError(provider, error)`.
- Input: `{ system, messages, maxTokens, temperature }`; output parsing returns a non-empty string or throws an error with `code`, `provider`, and optional `status`.

- [ ] **Step 1: Write failing adapter contract tests**

```js
test("Kimi request uses OpenAI chat format without provider-only fields", () => {
  const request = adapters.buildRequest(kimi, { apiKey: "test-key" }, {
    system: "System", messages: [{ role: "user", content: "Hello" }], maxTokens: 128,
  });
  assert.equal(request.url, "https://api.kimi.com/coding/v1/chat/completions");
  assert.equal(request.headers.Authorization, "Bearer test-key");
  assert.deepEqual(request.body.messages[0], { role: "system", content: "System" });
  assert.equal(Object.hasOwn(request.body, "thinking"), false);
  assert.equal(Object.hasOwn(request.body, "response_format"), false);
});

test("Anthropic keeps system separate and uses Messages headers", () => {
  const request = adapters.buildRequest(anthropic, { apiKey: "test-key", model: "claude-model" }, {
    system: "System", messages: [{ role: "user", content: "Hello" }], maxTokens: 128, temperature: 0.2,
  });
  assert.equal(request.headers["x-api-key"], "test-key");
  assert.equal(request.headers["anthropic-version"], "2023-06-01");
  assert.equal(request.body.system, "System");
  assert.equal(Object.hasOwn(request.body, "temperature"), false);
});

test("Gemini converts messages and extracts candidate text parts", () => {
  const request = adapters.buildRequest(gemini, { apiKey: "test-key", model: "gemini-model" }, {
    system: "System", messages: [{ role: "user", content: "Hello" }], maxTokens: 128,
  });
  assert.equal(request.headers["x-goog-api-key"], "test-key");
  assert.deepEqual(request.body.contents[0], { role: "user", parts: [{ text: "Hello" }] });
  assert.equal(adapters.parseResponse(gemini, {
    candidates: [{ content: { parts: [{ text: "A" }, { text: "B" }] } }],
  }), "AB");
});
```

- [ ] **Step 2: Run RED verification**

Run: `node --test tests/ai-providers.test.js`  
Expected: FAIL because `ai-providers.js` does not exist.

- [ ] **Step 3: Implement three protocol adapters**

Implement an IIFE exported as `YTD_AI_PROVIDERS` in Chrome and `module.exports` in Node. OpenAI-compatible output accepts either a string or `{type:"text",text}` blocks. Anthropic concatenates only `content` blocks with `type === "text"`. Gemini concatenates text parts and maps `promptFeedback.blockReason` to `AI_BLOCKED`. Reject empty normalized output as `EMPTY_AI_RESPONSE`.

HTTP mapping uses literal codes: `INVALID_AI_KEY` for 401/403, `RATE_LIMITED` for 429, `PROVIDER_HTTP_ERROR` otherwise. Sanitized messages identify the selected provider but never include request headers or keys.

- [ ] **Step 4: Run GREEN verification and mutation checks**

Run: `node --test tests/ai-providers.test.js`  
Expected: all adapter tests pass. Manually confirm changing any adapter endpoint, auth header, system-message placement, or parser path breaks at least one test.

- [ ] **Step 5: Commit adapters**

```bash
git add ai-providers.js tests/ai-providers.test.js
git commit -m "feat(ai): add isolated provider adapters"
```

### Task 3: Route existing AI features through the active adapter

**Files:**
- Modify: `background.js`
- Modify: `tests/translation.test.js`

**Interfaces:**
- Consumes: `YTD_SETTINGS.getActiveProvider`, `getActiveProfile`, and `YTD_AI_PROVIDERS`.
- Produces: `requestAiCompletion({ system, messages, maxTokens, temperature }) -> { text, settings, provider }` while preserving all current product handlers.

- [ ] **Step 1: Add failing background integration tests**

Extend the VM helper to load `settings.js` and `ai-providers.js`. Add literal request assertions for Kimi, OpenRouter, Anthropic, and Gemini, and assert `checkConfig` exposes only `hasAiKey` and `aiProviderName`.

```js
assert.deepEqual(publicStatus, {
  hasSupadataKey: true,
  hasAiKey: true,
  aiProviderName: "OpenRouter",
});
assert.equal(JSON.stringify(publicStatus).includes("router-key"), false);
```

Add tests proving timeout and 2 MiB response limits still apply to every adapter and that no failed paid request is automatically repeated.

- [ ] **Step 2: Run RED verification**

Run: `node --test tests/translation.test.js`  
Expected: FAIL because background still hardcodes Kimi settings, endpoint, parser, and messages.

- [ ] **Step 3: Implement adapter routing without changing product behavior**

Change the service-worker import to:

```js
importScripts("settings.js", "ai-providers.js");
```

Build the selected request once, call `fetch` once, retain the existing idle timer, hard timer, and bounded response reader, then parse through the selected adapter. Convert each AI handler to use provider-neutral missing-key and HTTP error results. Pass the former system message through the `system` property so the Anthropic/Gemini adapters can place it correctly; OpenAI-compatible reconstructs it as the first system message.

- [ ] **Step 4: Run GREEN verification**

Run: `node --test tests/translation.test.js tests/ai-providers.test.js tests/settings.test.js`  
Expected: all selected tests pass, with each captured operation showing exactly one provider fetch.

- [ ] **Step 5: Commit runtime routing**

```bash
git add background.js tests/translation.test.js
git commit -m "feat(ai): route requests by active provider"
```

### Task 4: Three-mode settings UI, permissions, models, and connection test

**Files:**
- Modify: `options.html`
- Modify: `options.css`
- Modify: `options.js`
- Modify: `tests/options-language.test.js`
- Create: `tests/options-providers.test.js`

**Interfaces:**
- Consumes: `YTD_SETTINGS.PROVIDERS`, normalized settings, and Chrome `storage.local`/`permissions`.
- Produces: `requiredOriginPattern(settings)`, `requestProviderPermission(chromeApi, pattern)`, `filterOpenRouterModels(models, query)`, `isModelCacheFresh(cachedAt, now)`, `fetchOpenRouterModels(fetchImpl, apiKey)`, `buildSettingsFromForm(current, formValue)`, and UI event handlers.

- [ ] **Step 1: Write failing pure-helper and DOM-contract tests**

```js
test("permission requests use the exact selected origin", async () => {
  const requested = [];
  const granted = await options.requestProviderPermission({ permissions: {
    request: async (value) => { requested.push(value); return true; },
  }}, "https://openrouter.ai/*");
  assert.equal(granted, true);
  assert.deepEqual(requested, [{ origins: ["https://openrouter.ai/*"] }]);
});

test("OpenRouter cache expires after 24 hours", () => {
  assert.equal(options.isModelCacheFresh(1_000, 1_000 + 86_400_000 - 1), true);
  assert.equal(options.isModelCacheFresh(1_000, 1_000 + 86_400_000), false);
});

test("editing OpenRouter preserves the saved Kimi key", () => {
  const next = options.buildSettingsFromForm(current, {
    activeProvider: "openrouter", apiKey: "router-key", model: "openai/gpt-5",
  });
  assert.equal(next.providers["kimi-code"].apiKey, "kimi-key");
  assert.equal(next.providers.openrouter.apiKey, "router-key");
});
```

Assert HTML contains a radio group with mode IDs `kimi`, `openrouter`, `advanced`, provider/model fields, masked Key input, model search/results, save, test connection, delete-current-key, and reset-all controls. Assert English and Chinese labels exist without emoji.

- [ ] **Step 2: Run RED verification**

Run: `node --test tests/options-language.test.js tests/options-providers.test.js`  
Expected: FAIL because the three-mode controls and helpers do not exist.

- [ ] **Step 3: Implement the accessible settings UI**

Replace the obsolete “Local remix” prompt with the three cards. Use native radios and labels, keep only the active panel visible with `hidden`, and preserve the current warm visual design. Advanced mode uses a provider `<select>`, password Key input, model input, and Base URL input only for `custom`.

On save:

1. Normalize the draft.
2. Validate Key, model, and custom URL.
3. Compute the provider's precise origin pattern.
4. Call `chrome.permissions.contains`, then `request` from the submit user gesture if absent.
5. Save only after permission succeeds.

OpenRouter model discovery fetches `https://openrouter.ai/api/v1/models`, sends Bearer auth, validates `data` as an array of `{id,name}`, stores sanitized entries and timestamp locally, and filters by case-insensitive ID/name. On failure it leaves the manual model field usable.

“Test connection” saves no hidden changes: it validates the visible draft, obtains permission, and sends a `testAiConnection` message. Background performs the standard provider request with `maxTokens: 8` and content `Reply with only OK.` Display the selected provider in success/failure copy and warn that the test may use a small amount of quota.

- [ ] **Step 4: Run GREEN verification**

Run: `node --test tests/options-language.test.js tests/options-providers.test.js tests/settings.test.js tests/translation.test.js`  
Expected: all selected tests pass.

- [ ] **Step 5: Commit settings UI**

```bash
git add options.html options.css options.js tests/options-language.test.js tests/options-providers.test.js background.js
git commit -m "feat(options): add three provider modes"
```

### Task 5: Manifest, release boundary, and package version

**Files:**
- Modify: `manifest.json`
- Modify: `package.json`
- Modify: `scripts/check-release.sh`
- Modify: `tests/release.test.js`

**Interfaces:**
- Consumes: new public runtime file `ai-providers.js`.
- Produces: a 1.3.0 MV3 manifest and release allowlist containing only public files.

- [ ] **Step 1: Change release tests to the new observable contract**

Assert:

```js
assert.equal(manifest.version, "1.3.0");
assert.deepEqual(manifest.host_permissions.sort(), [
  "https://api.kimi.com/*",
  "https://api.supadata.ai/*",
  "https://www.youtube.com/*",
].sort());
assert.ok(manifest.permissions.includes("permissions"));
assert.ok(manifest.optional_host_permissions.includes("https://*/*"));
assert.ok(manifest.optional_host_permissions.includes("http://localhost/*"));
assert.ok(manifest.optional_host_permissions.includes("http://127.0.0.1/*"));
```

Replace obsolete Kimi-only UI assertions with three-mode and attribution assertions. Run the release script in a behavior test and assert `ai-providers.js` is included.

- [ ] **Step 2: Run RED verification**

Run: `node --test tests/release.test.js`  
Expected: FAIL on version, optional permissions, UI scope, and missing release file.

- [ ] **Step 3: Implement manifest and allowlist changes**

Set both manifest and package versions to 1.3.0, add the Chrome `permissions` API permission, declare optional origins, and include `ai-providers.js` in the public and required release lists. Do not add documentation plans, tests, `agent_memory`, `.git`, or `dist` to the ZIP.

- [ ] **Step 4: Run GREEN verification**

Run: `node --test tests/release.test.js`  
Expected: all release tests pass and the release script prints `ai-providers.js` exactly once.

- [ ] **Step 5: Commit release metadata**

```bash
git add manifest.json package.json scripts/check-release.sh tests/release.test.js
git commit -m "build: prepare multi-provider release"
```

### Task 6: Attribution, provider documentation, privacy, and security

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `PRIVACY.md`
- Modify: `SECURITY.md`
- Modify: `tests/release.test.js`

**Interfaces:**
- Produces: user-facing installation, setup, attribution, data-flow, and troubleshooting documentation matching 1.3.0 behavior.

- [ ] **Step 1: Add failing behavioral release documentation checks**

Test stable outcomes rather than exact paragraphs: both READMEs link `https://github.com/zarazhangrui/youtube-digest`, name Zara Zhang, say MIT-derived/remix, describe Kimi default/OpenRouter/advanced modes, and point installation links to `https://github.com/kocean9-freedom/youtube-digest-kimi`. Privacy must distinguish direct providers from OpenRouter routing and state local Key storage. Security must mention optional exact-origin access and custom endpoint risk.

- [ ] **Step 2: Run RED verification**

Run: `node --test tests/release.test.js`  
Expected: FAIL because current docs claim Kimi is the only provider and lack prominent attribution.

- [ ] **Step 3: Rewrite only provider-related documentation sections**

Preserve accurate Supadata, installation, YouTube usage, note, and troubleshooting content. Add setup instructions for each mode, explain OpenRouter's intermediary role, list supported protocol families, explain where users enter each Key, and state that live testing consumes the user's quota. Keep the existing `LICENSE` byte-for-byte unchanged.

- [ ] **Step 4: Run GREEN verification**

Run: `node --test tests/release.test.js`  
Expected: all documentation/release tests pass with no Kimi-only scope claims.

- [ ] **Step 5: Commit documentation**

```bash
git add README.md README.zh-CN.md PRIVACY.md SECURITY.md tests/release.test.js
git commit -m "docs: explain providers and upstream attribution"
```

### Task 7: Full verification, package audit, and GitHub delivery

**Files:**
- Modify: `agent_memory/context.md`
- Modify: `agent_memory/progress.md`
- Modify: `agent_memory/bugs.md`
- Modify: `task_plan.md`
- Generated but not committed: `dist/youtube-digest-v1.3.0.zip`

**Interfaces:**
- Produces: verified source branch, secret-free package, final commit history, and pushed `main` after safe integration.

- [ ] **Step 1: Run the complete automated suite**

Run in order:

```bash
npm test
npm run check
npm run package
```

Expected: zero test failures; release check exits 0; package command creates `dist/youtube-digest-v1.3.0.zip` and prints its SHA-256.

- [ ] **Step 2: Audit the artifact and working tree**

Run:

```bash
unzip -Z1 dist/youtube-digest-v1.3.0.zip
git diff --check
git status --short
```

Confirm the ZIP includes `ai-providers.js`, excludes `agent_memory`, plans, tests, `.git`, `dist`, and all secrets, and contains only release allowlist files.

- [ ] **Step 3: Review requirements line by line**

Compare every section of `docs/superpowers/specs/2026-09-08-multi-provider-ai-design.md` with implementation/tests. Record any unverified live-provider behavior in `agent_memory/bugs.md`; do not claim a real API call passed without a user-entered Key.

- [ ] **Step 4: Update internal project records**

Set `task_plan.md` phases through automated verification to complete, record exact test count/package hash in `agent_memory/progress.md`, and leave only current risks in `agent_memory/bugs.md`. These internal files remain untracked unless the user later asks to publish them.

- [ ] **Step 5: Finish and publish the branch safely**

Verify remote `main`, integrate the feature branch without force, and push only after the full verification evidence is fresh. Never include `dist`, `agent_memory`, `notes.md`, or `task_plan.md` in commits.

```bash
git log --oneline --decorate -8
git diff origin/main...HEAD --stat
git push origin HEAD:main
git ls-remote origin refs/heads/main
```

- [ ] **Step 6: Provide real-browser validation instructions**

Tell the user to open `chrome://extensions`, enable Developer mode, click Reload on YouTube Digest, open Details and Extension options, select a provider, enter the Key themselves, save, run Test connection, then open a real YouTube video and verify Digest, overview, translation, explanation, and note polishing. Explain that Chrome may show a new exact-site permission prompt for non-Kimi providers.
