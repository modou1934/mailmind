import test from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import {
  askMeetingSessionQuestionRuntime,
  createMeetingSessionRuntime,
  db,
  getOrCreateDevUser,
  listMeetingSessionChatMessagesRuntime,
  processMeetingSessionRuntime,
  setScopedSettingRuntime,
  shareMeetingSessionRuntime,
} from "../server/db.js"

function ensureDemoConnectedAccount(userId, workspaceId, accountId) {
  db.prepare(`
    INSERT OR REPLACE INTO connected_accounts (
      id, workspace_id, user_id, provider, email, display_name, external_account_id,
      encrypted_access_token, encrypted_refresh_token, expires_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    accountId,
    workspaceId,
    userId,
    'google',
    'owner@mailmind.local',
    'MailMind Owner',
    `demo-${accountId}`,
    '',
    '',
    '',
    new Date().toISOString(),
    new Date().toISOString(),
  )
}

test('meeting chat stores conversation and returns an assistant answer', async (t) => {
  const { user } = getOrCreateDevUser()
  const session = await createMeetingSessionRuntime(user.id, {
    sourceType: 'record',
    title: 'Kickoff prodotto',
    transcriptText: 'Abbiamo deciso di inviare la proposta venerdi e Luca prepara il recap finale.',
    language: 'it',
  })

  t.after(() => {
    db.prepare('DELETE FROM meeting_session_chat_messages WHERE session_id = ?').run(session.id)
    db.prepare('DELETE FROM meeting_sessions WHERE id = ?').run(session.id)
  })

  const result = await askMeetingSessionQuestionRuntime(user.id, session.id, 'Quali sono i prossimi passi?')
  assert.ok(result?.answer)

  const messages = await listMeetingSessionChatMessagesRuntime(user.id, session.id)
  assert.equal(messages.length, 2)
  assert.ok(messages.some((message) => message.role === 'user' && message.content.includes('Quali sono i prossimi passi')))
  assert.ok(messages.some((message) => message.role === 'assistant'))
})

test('meeting share prepares local share results for demo account', async (t) => {
  const { user, workspace } = getOrCreateDevUser()
  const accountId = `demo-share-${randomUUID()}`
  ensureDemoConnectedAccount(user.id, workspace.id, accountId)

  const session = await createMeetingSessionRuntime(user.id, {
    sourceType: 'record',
    title: 'Recap commerciale',
    transcriptText: 'Chiara invia il preventivo aggiornato e Marco conferma il budget entro lunedi.',
    language: 'it',
  })

  db.prepare('UPDATE meeting_sessions SET connected_account_id = ? WHERE id = ?').run(accountId, session.id)

  t.after(() => {
    db.prepare('DELETE FROM meeting_sessions WHERE id = ?').run(session.id)
    db.prepare('DELETE FROM notifications WHERE user_id = ? AND link = ?').run(user.id, '/notetaker')
    db.prepare('DELETE FROM connected_accounts WHERE id = ?').run(accountId)
  })

  const result = await shareMeetingSessionRuntime(user.id, session.id, {
    recipients: ['cliente@example.com'],
    template: 'concise',
  })

  assert.equal(result.shareResults.length, 1)
  assert.equal(result.shareResults[0].status, 'local_only')
  assert.equal(result.session.share_status, 'local_only')
  assert.ok(Array.isArray(result.session.shared_recipients))
  assert.equal(result.template, 'concise')
})

test('meeting processing derives participants and auto-shares when enabled', async (t) => {
  const { user, workspace } = getOrCreateDevUser()
  const accountId = `demo-auto-${randomUUID()}`
  ensureDemoConnectedAccount(user.id, workspace.id, accountId)

  const eventId = `event-${randomUUID()}`
  db.prepare(`
    INSERT INTO calendar_events (
      id, user_id, connected_account_id, provider, external_event_id, calendar_id, title,
      organizer_name, organizer_email, meeting_url, join_provider, location, status,
      start_at, end_at, timezone, attendee_count, attendees_json, is_all_day, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    eventId,
    user.id,
    accountId,
    'google',
    `ext-${eventId}`,
    'primary',
    'Sync clienti',
    'Founder',
    'founder@example.com',
    'https://meet.google.com/abc-defg-hij',
    'google_meet',
    '',
    'confirmed',
    new Date().toISOString(),
    new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    'Europe/Rome',
    2,
    JSON.stringify([{ email: 'founder@example.com', name: 'Founder', organizer: true }, { email: 'ops@example.com', name: 'Ops' }]),
    0,
    new Date().toISOString(),
    new Date().toISOString(),
  )

  const session = await createMeetingSessionRuntime(user.id, {
    sourceType: 'join',
    calendarEventId: eventId,
    title: 'Sync clienti',
    language: 'it',
  })

  t.after(() => {
    db.prepare('DELETE FROM meeting_sessions WHERE id = ?').run(session.id)
    db.prepare('DELETE FROM notifications WHERE user_id = ? AND link = ?').run(user.id, '/notetaker')
    db.prepare('DELETE FROM calendar_events WHERE id = ?').run(eventId)
    db.prepare('DELETE FROM connected_accounts WHERE id = ?').run(accountId)
    db.prepare('DELETE FROM settings WHERE key = ?').run(`workspace:${workspace.id}:notetaker`)
  })

  await setScopedSettingRuntime(workspace.id, 'notetaker', {
    autoShareRecaps: true,
    shareWithOrganizer: true,
    autoShareRecipients: ['opslead@example.com'],
  })

  const processed = await processMeetingSessionRuntime(user.id, session.id, 'Founder presenta lo stato, Ops prepara il recap e il cliente attende una conferma finale.')

  assert.ok(processed.participants.some((participant) => participant.email === 'founder@example.com'))
  assert.ok(processed.participants.some((participant) => participant.email === 'ops@example.com'))
  assert.equal(processed.share_status, 'local_only')
  assert.ok(processed.shared_recipients.some((item) => item.recipient === 'founder@example.com'))
  assert.ok(processed.shared_recipients.some((item) => item.recipient === 'ops@example.com'))
  assert.ok(processed.shared_recipients.some((item) => item.recipient === 'opslead@example.com'))
})
