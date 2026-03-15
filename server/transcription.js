const DEEPGRAM_ENDPOINT = "https://api.deepgram.com/v1/listen";

function configuredDeepgramApiKey() {
  return process.env.DEEPGRAM_API_KEY || "";
}

export function hasDeepgramCredentials() {
  return Boolean(configuredDeepgramApiKey());
}

function languageParams(language = "it") {
  if (!language || language === "auto") {
    return {
      detect_language: "true",
    };
  }

  return {
    language,
  };
}

function normalizeUtterances(payload) {
  const utterances = payload?.results?.utterances || [];
  return utterances.map((item) => ({
    start: Number(item?.start || 0),
    end: Number(item?.end || 0),
    speaker: Number.isInteger(item?.speaker) ? item.speaker : 0,
    transcript: String(item?.transcript || "").trim(),
  })).filter((item) => item.transcript);
}

export async function transcribeAudioBuffer({ audioBuffer, mimeType = "audio/wav", language = "it" }) {
  const apiKey = configuredDeepgramApiKey();
  if (!apiKey) {
    throw new Error("Missing Deepgram API key");
  }

  if (!audioBuffer || !Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
    throw new Error("Missing audio payload");
  }

  const url = new URL(DEEPGRAM_ENDPOINT);
  url.searchParams.set("model", "nova-3");
  url.searchParams.set("smart_format", "true");
  url.searchParams.set("punctuate", "true");
  url.searchParams.set("diarize", "true");
  url.searchParams.set("utterances", "true");

  for (const [key, value] of Object.entries(languageParams(language))) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": mimeType || "application/octet-stream",
    },
    body: audioBuffer,
  });

  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload?.err_msg || payload?.error || "Deepgram transcription failed");
    error.status = response.status;
    throw error;
  }

  const transcript = String(
    payload?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "",
  ).trim();

  return {
    transcript,
    utterances: normalizeUtterances(payload),
    metadata: payload?.metadata || {},
    raw: payload,
  };
}
