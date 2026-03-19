import test from "node:test"
import assert from "node:assert/strict"

import { decryptString, encryptString } from "../server/crypto.js"

test("crypto round-trips with an explicit encryption key", () => {
  const previousKey = process.env.ENCRYPTION_KEY
  const previousEnv = process.env.APP_ENV

  process.env.APP_ENV = "production"
  process.env.ENCRYPTION_KEY = "test-secret-key"

  try {
    const encrypted = encryptString("ciao")
    assert.ok(encrypted)
    assert.equal(decryptString(encrypted), "ciao")
  } finally {
    if (previousEnv === undefined) {
      delete process.env.APP_ENV
    } else {
      process.env.APP_ENV = previousEnv
    }
    if (previousKey === undefined) {
      delete process.env.ENCRYPTION_KEY
    } else {
      process.env.ENCRYPTION_KEY = previousKey
    }
  }
})

test("crypto refuses to encrypt in production without ENCRYPTION_KEY", () => {
  const previousKey = process.env.ENCRYPTION_KEY
  const previousEnv = process.env.APP_ENV

  process.env.APP_ENV = "production"
  delete process.env.ENCRYPTION_KEY

  try {
    assert.throws(() => encryptString("ciao"), /Missing ENCRYPTION_KEY/)
  } finally {
    if (previousEnv === undefined) {
      delete process.env.APP_ENV
    } else {
      process.env.APP_ENV = previousEnv
    }
    if (previousKey === undefined) {
      delete process.env.ENCRYPTION_KEY
    } else {
      process.env.ENCRYPTION_KEY = previousKey
    }
  }
})
