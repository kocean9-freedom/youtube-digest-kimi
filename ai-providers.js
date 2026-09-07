/**
 * Provider protocol adapters.
 *
 * This module only builds request data and parses untrusted provider output.
 * Network lifecycle, timeouts, and Chrome messaging remain in background.js.
 */
var YTD_AI_PROVIDERS = (() => {
  const settingsApi =
    typeof YTD_SETTINGS !== "undefined"
      ? YTD_SETTINGS
      : typeof require === "function"
        ? require("./settings.js")
        : null;

  function providerError(provider, code, message, status) {
    const error = new Error(message);
    error.code = code;
    error.provider = provider?.id || "unknown";
    if (Number.isInteger(status)) error.status = status;
    return error;
  }

  function requiredText(value, provider, code, label) {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized) {
      throw providerError(provider, code, `${provider.name} ${label} is required.`);
    }
    return normalized;
  }

  function normalizeMessages(messages) {
    if (!Array.isArray(messages)) return [];
    return messages
      .filter(
        (message) =>
          message &&
          ["system", "user", "assistant"].includes(message.role) &&
          typeof message.content === "string" &&
          message.content.trim(),
      )
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));
  }

  function splitSystem(input) {
    const messages = normalizeMessages(input?.messages);
    const systemParts = [];
    if (typeof input?.system === "string" && input.system.trim()) {
      systemParts.push(input.system.trim());
    }
    for (const message of messages) {
      if (message.role === "system") systemParts.push(message.content);
    }
    return {
      system: systemParts.join("\n\n"),
      messages: messages.filter((message) => message.role !== "system"),
    };
  }

  function normalizedBaseUrl(provider, profile) {
    const candidate = provider.editableBaseUrl
      ? profile.baseUrl
      : provider.baseUrl;
    return settingsApi.validateCustomBaseUrl(candidate);
  }

  function buildOpenAiCompatible(provider, profile, input) {
    const apiKey = requiredText(profile.apiKey, provider, "NO_AI_KEY", "API key");
    const model = requiredText(profile.model, provider, "NO_AI_MODEL", "model ID");
    const separated = splitSystem(input);
    const messages = separated.system
      ? [{ role: "system", content: separated.system }, ...separated.messages]
      : separated.messages;
    const body = {
      model,
      max_tokens: input.maxTokens,
      messages,
    };
    if (typeof input.temperature === "number") {
      body.temperature = input.temperature;
    }

    return {
      url: settingsApi.buildChatCompletionsUrl(
        normalizedBaseUrl(provider, profile),
      ),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    };
  }

  function buildAnthropic(provider, profile, input) {
    const apiKey = requiredText(profile.apiKey, provider, "NO_AI_KEY", "API key");
    const model = requiredText(profile.model, provider, "NO_AI_MODEL", "model ID");
    const separated = splitSystem(input);
    const body = {
      model,
      max_tokens: input.maxTokens,
      messages: separated.messages.map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
      })),
    };
    if (separated.system) body.system = separated.system;

    return {
      url: `${normalizedBaseUrl(provider, profile)}/v1/messages`,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body,
    };
  }

  function buildGemini(provider, profile, input) {
    const apiKey = requiredText(profile.apiKey, provider, "NO_AI_KEY", "API key");
    const model = requiredText(profile.model, provider, "NO_AI_MODEL", "model ID")
      .replace(/^models\//, "");
    const separated = splitSystem(input);
    const body = {
      contents: separated.messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
      generationConfig: { maxOutputTokens: input.maxTokens },
    };
    if (separated.system) {
      body.systemInstruction = { parts: [{ text: separated.system }] };
    }
    if (typeof input.temperature === "number") {
      body.generationConfig.temperature = input.temperature;
    }

    return {
      url: `${normalizedBaseUrl(provider, profile)}/models/${encodeURIComponent(model)}:generateContent`,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body,
    };
  }

  function buildRequest(provider, profile, input = {}) {
    if (!provider || !profile) {
      throw new Error("Provider configuration is unavailable.");
    }
    if (!Number.isInteger(input.maxTokens) || input.maxTokens < 1) {
      throw providerError(
        provider,
        "INVALID_AI_REQUEST",
        `${provider.name} max token limit is invalid.`,
      );
    }
    if (provider.protocol === "anthropic") {
      return buildAnthropic(provider, profile, input);
    }
    if (provider.protocol === "gemini") {
      return buildGemini(provider, profile, input);
    }
    if (provider.protocol === "openai-compatible") {
      return buildOpenAiCompatible(provider, profile, input);
    }
    throw providerError(
      provider,
      "UNSUPPORTED_AI_PROTOCOL",
      `${provider.name} uses an unsupported protocol.`,
    );
  }

  function textFromOpenAiContent(content) {
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";
    return content
      .filter((part) => part?.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("");
  }

  function parseResponse(provider, data) {
    let text = "";
    if (provider.protocol === "anthropic") {
      text = Array.isArray(data?.content)
        ? data.content
            .filter(
              (part) => part?.type === "text" && typeof part.text === "string",
            )
            .map((part) => part.text)
            .join("")
        : "";
    } else if (provider.protocol === "gemini") {
      if (data?.promptFeedback?.blockReason) {
        throw providerError(
          provider,
          "AI_BLOCKED",
          `${provider.name} blocked this request for safety reasons.`,
        );
      }
      const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
      text = candidates
        .flatMap((candidate) =>
          Array.isArray(candidate?.content?.parts)
            ? candidate.content.parts
            : [],
        )
        .filter((part) => typeof part?.text === "string")
        .map((part) => part.text)
        .join("");
    } else {
      text = textFromOpenAiContent(data?.choices?.[0]?.message?.content);
    }

    if (!text.trim()) {
      throw providerError(
        provider,
        "EMPTY_AI_RESPONSE",
        `${provider.name} returned an empty response.`,
      );
    }
    return text;
  }

  function safeServerMessage(data) {
    const candidate = data?.error?.message || data?.message;
    if (typeof candidate !== "string") return "";
    return candidate.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 300);
  }

  function createHttpError(provider, status, data) {
    let code = "PROVIDER_HTTP_ERROR";
    let summary = `returned HTTP ${status}`;
    if (status === 401 || status === 403) {
      code = "INVALID_AI_KEY";
      summary = "rejected the API key";
    } else if (status === 429) {
      code = "RATE_LIMITED";
      summary = "rate-limited this request or reported insufficient quota";
    }
    const detail = safeServerMessage(data);
    return providerError(
      provider,
      code,
      `${provider.name} ${summary}.${detail ? ` ${detail}` : ""}`,
      status,
    );
  }

  function normalizeError(provider, error) {
    if (error?.code && error?.provider) return error;
    return providerError(
      provider,
      "AI_REQUEST_FAILED",
      `${provider.name} request failed. Check the network and provider status.`,
      error?.status,
    );
  }

  return {
    buildRequest,
    parseResponse,
    createHttpError,
    normalizeError,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = YTD_AI_PROVIDERS;
}
