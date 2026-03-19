import test from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import {
  addConversationMessageRuntime,
  createConversationRuntime,
  db,
  getScopedSettingRuntime,
  listConversationMessagesRuntime,
  setScopedSettingRuntime,
  setSetting,
} from "../server/db.js"

test("chat messages are scoped to the owning user", async (t) => {
  const ownerUserId = `test-owner-${randomUUID()}`
  const otherUserId = `test-other-${randomUUID()}`
  const conversation = await createConversationRuntime(ownerUserId, "Test chat")

  t.after(() => {
    db.prepare("DELETE FROM chat_messages WHERE conversation_id = ?").run(conversation.id)
    db.prepare("DELETE FROM chat_conversations WHERE id = ?").run(conversation.id)
  })

  const ownerMessage = await addConversationMessageRuntime(ownerUserId, conversation.id, "user", "ciao")
  assert.ok(ownerMessage)

  const ownerMessages = await listConversationMessagesRuntime(ownerUserId, conversation.id)
  assert.equal(ownerMessages.length, 1)
  assert.equal(ownerMessages[0].content, "ciao")

  const foreignMessages = await listConversationMessagesRuntime(otherUserId, conversation.id)
  assert.equal(foreignMessages, null)

  const foreignWrite = await addConversationMessageRuntime(otherUserId, conversation.id, "user", "intrusione")
  assert.equal(foreignWrite, null)
})

test("workspace scoped settings fall back to legacy values and isolate writes", async (t) => {
  const workspaceA = `workspace-a-${randomUUID()}`
  const workspaceB = `workspace-b-${randomUUID()}`
  const scopedKeyA = `workspace:${workspaceA}:scheduling`
  const scopedKeyB = `workspace:${workspaceB}:scheduling`

  t.after(() => {
    db.prepare("DELETE FROM settings WHERE key IN (?, ?, ?)").run("scheduling", scopedKeyA, scopedKeyB)
  })

  setSetting("scheduling", { legacy: true })

  const fallbackValue = await getScopedSettingRuntime(workspaceA, "scheduling")
  assert.deepEqual(fallbackValue, { legacy: true })

  await setScopedSettingRuntime(workspaceA, "scheduling", { scoped: true })

  const scopedValue = await getScopedSettingRuntime(workspaceA, "scheduling")
  const untouchedWorkspaceValue = await getScopedSettingRuntime(workspaceB, "scheduling")

  assert.deepEqual(scopedValue, { scoped: true })
  assert.deepEqual(untouchedWorkspaceValue, { legacy: true })
})
