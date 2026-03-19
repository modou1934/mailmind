import { fetchWithTimeout, readJsonResponse } from "./fetch.js"

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";
const FALLBACK_GEMINI_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-2.0-flash-lite",
];
const DEFAULT_RETRY_AFTER_MS = 60_000;

const geminiRuntimeState = {
  lastError: "",
  lastModel: "",
  lastCheckedAt: "",
  retryAt: "",
  status: "idle",
};

function configuredGeminiApiKey() {
  return process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
}

function normalizeModelName(value = "") {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }

  const withoutPrefix = trimmed.replace(/^models\//, "");
  if (!withoutPrefix.includes("/")) {
    return withoutPrefix;
  }

  return withoutPrefix.split("/").at(-1) || withoutPrefix;
}

function candidateModelNames(preferredModel = "") {
  const configured = normalizeModelName(process.env.GEMINI_MODEL || "");
  const preferred = normalizeModelName(preferredModel);

  return [...new Set([
    preferred,
    configured,
    DEFAULT_GEMINI_MODEL,
    ...FALLBACK_GEMINI_MODELS,
  ].filter(Boolean))];
}

function extractGeminiText(payload) {
  const candidate = payload?.candidates?.find((item) => Array.isArray(item?.content?.parts));
  if (!candidate) {
    return "";
  }

  return candidate.content.parts
    .map((part) => part?.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function stripJsonFences(value = "") {
  return value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function nowIso() {
  return new Date().toISOString();
}

function parseRetryAfterMs(message = "") {
  const match = String(message || "").match(/retry in ([\d.]+)s/i);
  if (!match) {
    return DEFAULT_RETRY_AFTER_MS;
  }

  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return DEFAULT_RETRY_AFTER_MS;
  }

  return Math.ceil(seconds * 1000);
}

function shouldTryNextModel(error) {
  const status = error?.status || 0;
  const message = error instanceof Error ? error.message : String(error);

  if (status === 404 || /not found|unsupported|not supported/i.test(message)) {
    return true;
  }

  return status === 429 && /quota exceeded|resource exhausted/i.test(message);
}

function retryDateFromMessage(message = "") {
  return new Date(Date.now() + parseRetryAfterMs(message)).toISOString();
}

function isCooldownActive(retryAt = geminiRuntimeState.retryAt) {
  if (!retryAt) {
    return false;
  }

  const retryDate = new Date(retryAt);
  return Number.isFinite(retryDate.valueOf()) && retryDate.getTime() > Date.now();
}

function markGeminiSuccess(model) {
  geminiRuntimeState.lastError = "";
  geminiRuntimeState.lastModel = model;
  geminiRuntimeState.lastCheckedAt = nowIso();
  geminiRuntimeState.retryAt = "";
  geminiRuntimeState.status = "ready";
}

function markGeminiFailure(error, model = "") {
  const status = error?.status || 0;
  const message = error instanceof Error ? error.message : String(error);
  geminiRuntimeState.lastError = message;
  geminiRuntimeState.lastModel = model || geminiRuntimeState.lastModel;
  geminiRuntimeState.lastCheckedAt = nowIso();

  if (status === 429) {
    geminiRuntimeState.retryAt = retryDateFromMessage(message);
    geminiRuntimeState.status = "cooldown";
    return;
  }

  geminiRuntimeState.retryAt = "";
  geminiRuntimeState.status = "error";
}

function createCooldownError() {
  const retryAt = geminiRuntimeState.retryAt || retryDateFromMessage("");
  const error = new Error(`Gemini quota cooldown active until ${retryAt}`);
  error.status = 429;
  error.retryAt = retryAt;
  return error;
}

async function requestGemini({
  model,
  systemInstruction = "",
  prompt,
  responseMimeType = "",
  temperature = 0.2,
  maxOutputTokens = 1200,
}) {
  const apiKey = configuredGeminiApiKey();
  if (!apiKey) {
    throw new Error("Missing Gemini API key");
  }

  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: systemInstruction
          ? {
            parts: [{ text: systemInstruction }],
          }
          : undefined,
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens,
          ...(responseMimeType ? { responseMimeType } : {}),
        },
      }),
    },
  );

  const payload = await readJsonResponse(response);
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Gemini request failed");
    error.status = response.status;
    throw error;
  }

  const text = extractGeminiText(payload);
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  return {
    text,
    payload,
  };
}

export function hasGeminiCredentials() {
  return Boolean(configuredGeminiApiKey());
}

export function getGeminiRuntimeStatus() {
  const configured = hasGeminiCredentials();
  const cooldownActive = isCooldownActive();

  return {
    configured,
    available: configured && !cooldownActive,
    status: !configured
      ? "not_configured"
      : cooldownActive
        ? "cooldown"
        : geminiRuntimeState.status === "error"
          ? "error"
          : "ready",
    retryAt: cooldownActive ? geminiRuntimeState.retryAt : "",
    lastError: geminiRuntimeState.lastError,
    lastModel: geminiRuntimeState.lastModel,
    lastCheckedAt: geminiRuntimeState.lastCheckedAt,
  };
}

export async function generateTextWithGemini(options) {
  const models = candidateModelNames(options.model);
  let lastError;

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];

    if (index === 0 && isCooldownActive()) {
      throw createCooldownError();
    }

    try {
      const result = await requestGemini({
        ...options,
        model,
      });
      markGeminiSuccess(model);
      return {
        ...result,
        model,
      };
    } catch (error) {
      lastError = error;
      if (!shouldTryNextModel(error)) {
        markGeminiFailure(error, model);
        throw error;
      }
    }
  }

  if (lastError) {
    markGeminiFailure(lastError, "");
  }
  throw lastError || new Error("Gemini model not available");
}

export async function generateJsonWithGemini(options) {
  const result = await generateTextWithGemini({
    ...options,
    responseMimeType: "application/json",
  });

  const raw = stripJsonFences(result.text);
  return {
    ...result,
    json: JSON.parse(raw),
  };
}
