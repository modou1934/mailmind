const DEFAULT_REQUEST_TIMEOUT_MS = Number(process.env.OUTBOUND_REQUEST_TIMEOUT_MS || 15_000)

function buildAbortSignal(signal, timeoutMs) {
  const timeoutController = new AbortController()
  const timer = setTimeout(() => {
    timeoutController.abort(new Error(`Request timed out after ${timeoutMs}ms`))
  }, timeoutMs)

  let combinedSignal = timeoutController.signal
  if (signal) {
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.any === "function") {
      combinedSignal = AbortSignal.any([signal, timeoutController.signal])
    } else if (signal.aborted) {
      timeoutController.abort(signal.reason)
    } else {
      signal.addEventListener("abort", () => timeoutController.abort(signal.reason), { once: true })
    }
  }

  return {
    signal: combinedSignal,
    cleanup: () => clearTimeout(timer),
  }
}

export async function fetchWithTimeout(url, options = {}, { timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS } = {}) {
  const { signal, cleanup } = buildAbortSignal(options.signal, timeoutMs)

  try {
    return await fetch(url, {
      ...options,
      signal,
    })
  } catch (error) {
    if (timeoutMs > 0 && (error?.name === "AbortError" || signal.aborted)) {
      const timeoutError = new Error(`Request timed out after ${timeoutMs}ms`)
      timeoutError.status = 504
      throw timeoutError
    }

    throw error
  } finally {
    cleanup()
  }
}

export async function readJsonResponse(response) {
  const bodyText = await response.text()
  if (!bodyText) {
    return {}
  }

  try {
    return JSON.parse(bodyText)
  } catch {
    return {
      message: bodyText,
    }
  }
}

export { DEFAULT_REQUEST_TIMEOUT_MS }
