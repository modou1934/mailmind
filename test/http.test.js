import test from "node:test"
import assert from "node:assert/strict"
import { Readable } from "node:stream"

import { readJson } from "../server/http.js"

test("readJson returns 400 for malformed JSON", async () => {
  const req = Readable.from(["{invalid json"])

  await assert.rejects(
    () => readJson(req),
    (error) => error?.status === 400 && error.message === "Invalid JSON body",
  )
})

test("readJson returns 413 when body exceeds maxBytes", async () => {
  const req = Readable.from([JSON.stringify({ payload: "abcdef" })])

  await assert.rejects(
    () => readJson(req, { maxBytes: 5 }),
    (error) => error?.status === 413 && error.message === "Request body too large",
  )
})
