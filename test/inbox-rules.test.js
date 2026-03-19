import test from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import {
  db,
  generateDraftOptionsForThreadRuntime,
  getOrCreateDevUser,
  listAwaitingReplyThreadsRuntime,
  listMailThreadsRuntime,
  setEmailRulesRuntime,
  setScopedSettingRuntime,
  setThreadCategoryOverrideRuntime,
} from "../server/db.js"

function insertThread(userId, patch = {}) {
  const id = patch.id || randomUUID()
  db.prepare(`
    INSERT INTO mail_threads (
      id, user_id, connected_account_id, external_thread_id, thread_source, subject, from_name, from_email,
      snippet, category, status, last_message_at, needs_reply
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    patch.connectedAccountId || "test-account",
    patch.externalThreadId || `thread-${id}`,
    patch.threadSource || "provider",
    patch.subject || "Test subject",
    patch.fromName || "Test Sender",
    patch.fromEmail || "sender@example.com",
    patch.snippet || "Snippet",
    patch.category || "fyi",
    patch.status || "nuovo",
    patch.lastMessageAt || new Date().toISOString(),
    patch.needsReply ? 1 : 0,
  )
  return id
}

function ensureConnectedAccount(userId, workspaceId, accountId, patch = {}) {
  db.prepare(`
    INSERT OR REPLACE INTO connected_accounts (
      id, workspace_id, user_id, provider, email, display_name, external_account_id,
      encrypted_access_token, encrypted_refresh_token, expires_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    accountId,
    workspaceId,
    userId,
    patch.provider || 'google',
    patch.email || 'owner@mailmind.local',
    patch.displayName || 'MailMind Owner',
    patch.externalAccountId || `ext-${accountId}`,
    '',
    '',
    '',
    new Date().toISOString(),
    new Date().toISOString(),
  )
}

function insertMessage(threadId, patch = {}) {
  db.prepare(`
    INSERT INTO mail_messages (
      id, thread_id, external_message_id, role, sender_name, sender_email, message_source, content, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    patch.id || randomUUID(),
    threadId,
    patch.externalMessageId || "",
    patch.role || "incoming",
    patch.senderName || "Sender",
    patch.senderEmail || "sender@example.com",
    patch.messageSource || "provider",
    patch.content || "Body",
    patch.createdAt || new Date().toISOString(),
  )
}

test("email rules reclassify matching threads", async (t) => {
  const { user, workspace } = getOrCreateDevUser()
  const threadId = insertThread(user.id, {
    subject: "Urgente contratto cliente",
    fromEmail: "ceo@cliente.it",
  })

  t.after(() => {
    db.prepare("DELETE FROM mail_threads WHERE id = ?").run(threadId)
    db.prepare("DELETE FROM settings WHERE key = ?").run(`workspace:${workspace.id}:email-rules`)
  })

  await setEmailRulesRuntime(workspace.id, [{
    id: "vip-client",
    name: "Clienti VIP",
    enabled: true,
    match: "any",
    domains: ["cliente.it"],
    keywords: ["contratto"],
    category: "todo",
    inboxAction: "keep_inbox",
  }])

  const threads = await listMailThreadsRuntime(user.id, { workspaceId: workspace.id })
  const thread = threads.find((item) => item.id === threadId)

  assert.equal(thread?.category, "todo")
  assert.equal(thread?.inbox_action, "keep_inbox")
  assert.equal(thread?.matched_rule_name, "Clienti VIP")
})

test("manual relabel overrides thread category", async (t) => {
  const { user, workspace } = getOrCreateDevUser()
  const threadId = insertThread(user.id, {
    subject: "Newsletter prodotto",
    fromEmail: "updates@example.com",
    category: "notification",
  })

  t.after(() => {
    db.prepare("DELETE FROM thread_classifications WHERE thread_id = ?").run(threadId)
    db.prepare("DELETE FROM mail_threads WHERE id = ?").run(threadId)
    db.prepare("DELETE FROM settings WHERE key = ?").run(`workspace:${workspace.id}:thread-category-overrides`)
  })

  const override = await setThreadCategoryOverrideRuntime(user.id, workspace.id, threadId, {
    category: "marketing",
    reason: "Riclassificato manualmente per test.",
  })

  const threads = await listMailThreadsRuntime(user.id, { workspaceId: workspace.id })
  const thread = threads.find((item) => item.id === threadId)

  assert.equal(override?.category, "marketing")
  assert.equal(thread?.category, "marketing")
  assert.equal(thread?.manual_override, true)
})

test("awaiting reply lists threads with overdue outbound follow-up", async (t) => {
  const { user, workspace } = getOrCreateDevUser()
  const threadId = insertThread(user.id, {
    subject: "Follow up partnership",
    fromEmail: "partner@example.com",
  })
  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()

  insertMessage(threadId, {
    role: "outgoing",
    senderEmail: user.email,
    content: "Ti scrivo per un follow up.",
    createdAt: fourDaysAgo,
  })

  t.after(() => {
    db.prepare("DELETE FROM mail_messages WHERE thread_id = ?").run(threadId)
    db.prepare("DELETE FROM mail_threads WHERE id = ?").run(threadId)
    db.prepare("DELETE FROM settings WHERE key = ?").run(`workspace:${workspace.id}:drafts`)
  })

  await setScopedSettingRuntime(workspace.id, "drafts", {
    enableFollowUps: true,
    followUpDays: 3,
  })

  const threads = await listAwaitingReplyThreadsRuntime(user.id, { workspaceId: workspace.id })
  const thread = threads.find((item) => item.id === threadId)

  assert.ok(thread)
  assert.equal(thread?.subject, "Follow up partnership")
  assert.ok(thread?.waiting_days >= 3)
})

test("draft options return multiple variants for an eligible thread", async (t) => {
  const { user, workspace } = getOrCreateDevUser()
  const accountId = `draft-account-${randomUUID()}`
  ensureConnectedAccount(user.id, workspace.id, accountId, {
    provider: 'google',
    email: user.email,
    displayName: user.full_name,
  })
  const threadId = insertThread(user.id, {
    connectedAccountId: accountId,
    subject: 'Richiesta partnership',
    fromName: 'Giulia Bianchi',
    fromEmail: 'giulia@example.com',
    category: 'todo',
    needsReply: true,
  })
  insertMessage(threadId, {
    role: 'incoming',
    senderName: 'Giulia Bianchi',
    senderEmail: 'giulia@example.com',
    content: 'Fammi sapere se ti interessa una partnership per il prossimo mese.',
  })

  t.after(() => {
    db.prepare('DELETE FROM mail_messages WHERE thread_id = ?').run(threadId)
    db.prepare('DELETE FROM thread_classifications WHERE thread_id = ?').run(threadId)
    db.prepare('DELETE FROM mail_threads WHERE id = ?').run(threadId)
    db.prepare('DELETE FROM connected_accounts WHERE id = ?').run(accountId)
    db.prepare('DELETE FROM settings WHERE key = ?').run(`workspace:${workspace.id}:drafts`)
  })

  db.prepare(`
    INSERT INTO thread_classifications (thread_id, user_id, category, topic_label, inbox_action, reason, confidence, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(threadId, user.id, 'todo', '', 'keep_default', 'Richiede risposta.', 0.9, new Date().toISOString())

  await setScopedSettingRuntime(workspace.id, 'drafts', {
    draftVariants: 3,
    includeSignature: false,
    customTone: false,
  })

  const result = await generateDraftOptionsForThreadRuntime(user.id, threadId, { workspaceId: workspace.id })
  assert.ok(result)
  assert.equal(result.variants.length, 3)
  assert.ok(result.variants.every((variant) => variant.content))
})
