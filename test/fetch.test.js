import test from "node:test"
import assert from "node:assert/strict"

import { fetchWithTimeout, readJsonResponse } from "../server/fetch.js"

test("fetchWithTimeout returns a 504-style error when upstream hangs", async () => {
  const originalFetch = global.fetch
  global.fetch = (_, options = {}) => new Promise((_, reject) => {
    options.signal?.addEventListener("abort", () => {
      reject(options.signal.reason || new DOMException("Aborted", "AbortError"))
    }, { once: true })
  })

  try {
    await assert.rejects(
      () => fetchWithTimeout("https://example.com", {}, { timeoutMs: 20 }),
      (error) => error?.status === 504 && /timed out/i.test(error.message),
    )
  } finally {
    global.fetch = originalFetch
  }
})

test("readJsonResponse falls back to plain-text message payloads", async () => {
  const response = new Response("not-json", {
    status: 502,
    headers: {
      "Content-Type": "text/plain",
    },
  })

  const payload = await readJsonResponse(response)
  assert.deepEqual(payload, { message: "not-json" })
})
