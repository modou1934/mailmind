import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { classifyMailThreads } from "./mailClassifier.js";
import { generateJsonWithGemini, generateTextWithGemini, hasGeminiCredentials } from "./gemini.js";
import { putStoredObject } from "./storage.js";
import { transcribeAudioBuffer } from "./transcription.js";
import {
  deleteProviderDraft,
  ensureMailboxSubscription,
  fetchCalendarRemoteState,
  fetchMailboxRemoteState,
  upsertProviderDraft,
} from "./providerMail.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "data");
mkdirSync(dataDir, { recursive: true });

const dbPath = join(dataDir, "mailmind-private.db");
export const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email_domain TEXT DEFAULT '',
    type TEXT NOT NULL DEFAULT 'personal',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS workspace_members (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invites (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS connected_accounts (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    email TEXT NOT NULL,
    display_name TEXT DEFAULT '',
    external_account_id TEXT DEFAULT '',
    encrypted_access_token TEXT DEFAULT '',
    encrypted_refresh_token TEXT DEFAULT '',
    expires_at TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sync_runs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    connected_account_id TEXT NOT NULL,
    status TEXT NOT NULL,
    processed_threads INTEGER NOT NULL DEFAULT 0,
    processed_messages INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mail_threads (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    connected_account_id TEXT NOT NULL,
    external_thread_id TEXT DEFAULT '',
    thread_source TEXT NOT NULL DEFAULT 'demo',
    subject TEXT NOT NULL,
    from_name TEXT NOT NULL,
    from_email TEXT NOT NULL,
    snippet TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL,
    last_message_at TEXT NOT NULL,
    needs_reply INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS mail_messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL,
    external_message_id TEXT DEFAULT '',
    role TEXT NOT NULL,
    sender_name TEXT DEFAULT '',
    sender_email TEXT DEFAULT '',
    message_source TEXT NOT NULL DEFAULT 'demo',
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS draft_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    connected_account_id TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    tone TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS thread_classifications (
    thread_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    topic_label TEXT DEFAULT '',
    inbox_action TEXT NOT NULL,
    reason TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS classification_runs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    processed_threads INTEGER NOT NULL DEFAULT 0,
    updated_threads INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mail_sync_state (
    connected_account_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    sync_cursor TEXT DEFAULT '',
    delta_link TEXT DEFAULT '',
    last_full_sync_at TEXT DEFAULT '',
    last_delta_sync_at TEXT DEFAULT '',
    last_webhook_at TEXT DEFAULT '',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id TEXT PRIMARY KEY,
    connected_account_id TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL,
    external_subscription_id TEXT DEFAULT '',
    resource TEXT DEFAULT '',
    client_state TEXT DEFAULT '',
    notification_url TEXT DEFAULT '',
    expiration_at TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS oauth_states (
    state TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    json_value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    link TEXT DEFAULT '',
    read_at TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT '',
    workspace_id TEXT DEFAULT '',
    event_type TEXT NOT NULL,
    actor_email TEXT DEFAULT '',
    ip_address TEXT DEFAULT '',
    user_agent TEXT DEFAULT '',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    connected_account_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    external_event_id TEXT NOT NULL,
    calendar_id TEXT DEFAULT '',
    title TEXT NOT NULL,
    organizer_name TEXT DEFAULT '',
    organizer_email TEXT DEFAULT '',
    meeting_url TEXT DEFAULT '',
    join_provider TEXT DEFAULT '',
    location TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'confirmed',
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    timezone TEXT DEFAULT '',
    attendee_count INTEGER NOT NULL DEFAULT 0,
    is_all_day INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS meeting_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    calendar_event_id TEXT DEFAULT '',
    connected_account_id TEXT DEFAULT '',
    source_type TEXT NOT NULL,
    status TEXT NOT NULL,
    title TEXT NOT NULL,
    meeting_url TEXT DEFAULT '',
    join_provider TEXT DEFAULT '',
    language TEXT DEFAULT 'it',
    source_file_name TEXT DEFAULT '',
    source_file_type TEXT DEFAULT '',
    source_file_size INTEGER NOT NULL DEFAULT 0,
    source_object_key TEXT DEFAULT '',
    source_storage_provider TEXT DEFAULT '',
    transcription_provider TEXT DEFAULT '',
    started_at TEXT DEFAULT '',
    ended_at TEXT DEFAULT '',
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    transcript_text TEXT DEFAULT '',
    utterances_json TEXT NOT NULL DEFAULT '[]',
    summary_text TEXT DEFAULT '',
    key_points_json TEXT NOT NULL DEFAULT '[]',
    action_items_json TEXT NOT NULL DEFAULT '[]',
    follow_up_email TEXT DEFAULT '',
    error_message TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

function ensureColumn(tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

ensureColumn("mail_threads", "external_thread_id", "TEXT DEFAULT ''");
ensureColumn("mail_threads", "thread_source", "TEXT NOT NULL DEFAULT 'demo'");
ensureColumn("mail_messages", "external_message_id", "TEXT DEFAULT ''");
ensureColumn("mail_messages", "sender_name", "TEXT DEFAULT ''");
ensureColumn("mail_messages", "sender_email", "TEXT DEFAULT ''");
ensureColumn("mail_messages", "message_source", "TEXT NOT NULL DEFAULT 'demo'");
ensureColumn("mail_messages", "message_subject", "TEXT DEFAULT ''");
ensureColumn("mail_messages", "is_read", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("mail_messages", "internet_message_id", "TEXT DEFAULT ''");
ensureColumn("sync_runs", "error_message", "TEXT DEFAULT ''");
ensureColumn("draft_records", "provider_draft_id", "TEXT DEFAULT ''");
ensureColumn("draft_records", "provider_message_id", "TEXT DEFAULT ''");
ensureColumn("draft_records", "provider_push_status", "TEXT NOT NULL DEFAULT 'local_only'");
ensureColumn("draft_records", "provider_last_error", "TEXT DEFAULT ''");
ensureColumn("draft_records", "provider_pushed_at", "TEXT DEFAULT ''");
ensureColumn("meeting_sessions", "source_file_name", "TEXT DEFAULT ''");
ensureColumn("meeting_sessions", "source_file_type", "TEXT DEFAULT ''");
ensureColumn("meeting_sessions", "source_file_size", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("meeting_sessions", "source_object_key", "TEXT DEFAULT ''");
ensureColumn("meeting_sessions", "source_storage_provider", "TEXT DEFAULT ''");
ensureColumn("meeting_sessions", "transcription_provider", "TEXT DEFAULT ''");
ensureColumn("meeting_sessions", "utterances_json", "TEXT NOT NULL DEFAULT '[]'");

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS mail_threads_external_thread_id_idx
  ON mail_threads(user_id, connected_account_id, external_thread_id)
  WHERE external_thread_id != '';

  CREATE UNIQUE INDEX IF NOT EXISTS mail_messages_external_message_id_idx
  ON mail_messages(thread_id, external_message_id)
  WHERE external_message_id != '';

  CREATE UNIQUE INDEX IF NOT EXISTS calendar_events_external_event_id_idx
  ON calendar_events(user_id, connected_account_id, external_event_id);
`);

const defaultCategorization = {
  moveOut: { notification: true, followUp: true, marketing: true },
  keepIn: { todo: false, fyi: false },
  respectExisting: true,
  topicLabels: true,
  enableCategorization: true,
  marketingFilter: "cold_unknown",
  topicStates: {
    accounts: true,
    coldOutreach: false,
    comment: true,
    contract: true,
    event: true,
    notetaker: true,
    meeting: true,
    newsletter: true,
    orders: true,
    payment: true,
    promotion: false,
    submission: true,
    toolAlert: true,
    pec: true,
    burocrazia: true,
  },
};

const defaultDrafts = {
  enableDrafts: true,
  unusedDraftsDays: 14,
  responseStyle: "everything",
  enableFollowUps: true,
  followUpDays: 3,
  customTone: false,
  customToneText: "",
  fontFamily: "Gmail/Outlook default",
  fontSize: 0,
  fontColor: "#111111",
  includeSignature: true,
  defaultSignature: "",
  showThreadingGmail: false,
  showThreadingOutlook: false,
};

const DRAFT_BLOCKED_SENDER_HINTS = [
  "noreply",
  "no-reply",
  "no_reply",
  "donotreply",
  "do-not-reply",
  "notification",
  "notifications",
  "alert",
  "alerts",
  "newsletter",
  "digest",
  "mailer-daemon",
  "account-security",
  "accountprotection",
];

const DRAFT_BLOCKED_TOPIC_LABELS = new Set([
  "newsletter",
  "event",
  "toolalert",
  "accounts",
  "promotion",
  "coldoutreach",
]);

const DRAFT_BLOCKED_TEXT_HINTS = [
  "unsubscribe",
  "annulla la sottoscrizione",
  "manage preferences",
  "gestisci le impostazioni email",
  "privacy policy",
  "informativa sulla privacy",
  "terms",
  "termini",
  "download app",
  "download our app",
  "view post",
  "view messages",
  "watch more",
  "hourly updates",
  "job alert",
  "new post",
  "daily credits",
  "new videos",
  "you missed messages",
  "upgrade to",
  "free skill test",
  "annual run rate",
  "series b",
];

const DRAFT_REPLY_SIGNAL_HINTS = [
  "let me know",
  "please reply",
  "please confirm",
  "could you",
  "can you",
  "would you",
  "what do you think",
  "what are you curious about",
  "which option",
  "when are you available",
  "are you available",
  "fammi sapere",
  "mi fai sapere",
  "potresti",
  "puoi",
  "confermi",
];

const defaultScheduling = {
  link: "mailmind.ai/e/utente",
  stats: [
    { label: "Riunioni prenotate", value: "0" },
    { label: "Partecipanti medi", value: "0.0" },
    { label: "Durata media", value: "0m" },
  ],
  settings: { includeLink: true, generateDrafts: true, confirmation: true },
  availability: {
    timezone: "Ora dell'Europa Centrale",
    weeklyHours: {
      0: [9, 10, 11, 12, 14, 15, 16],
      1: [9, 10, 11, 12, 14, 15, 16],
      2: [9, 10, 11, 12, 14, 15, 16],
      3: [9, 10, 11, 12, 14, 15, 16],
      4: [9, 10, 11, 12, 14, 15, 16],
    },
  },
};

const defaultNotetaker = {
  autoJoin: "all",
  language: "it",
  sendFailureEmails: true,
  hideNotetakerImage: true,
  recordingRetention: "manual",
  sendPrereads: true,
  disablePrereadSharing: false,
};

const defaultOrganization = {
  orgName: "Il mio Studio",
  orgDomain: "",
  settings: { autoAdd: true, discoverable: true },
};

const defaultBilling = {
  planName: "PIANO PRO",
  badge: "+ Prova",
  price: "EUR39",
  cadence: "mese",
  teamSize: "1 seat",
  nextPayment: "-",
  billingInterval: "Mensile",
  cardMasked: "**** **** **** ****",
};

const defaultDashboardNotifications = [
  {
    title: "Email configurata",
    body: "MailMind AI ha completato la configurazione per il tuo account privato.",
    link: "/impostazioni/integrazioni",
  },
  {
    title: "Invita un collega",
    body: "Ottieni giorni extra di prova per ogni collega che inviti nel tuo workspace privato.",
    link: "/impostazioni/persone",
  },
];

const CALENDAR_SYNC_LOOKBACK_DAYS = Number(process.env.CALENDAR_SYNC_LOOKBACK_DAYS || 7);
const CALENDAR_SYNC_LOOKAHEAD_DAYS = Number(process.env.CALENDAR_SYNC_LOOKAHEAD_DAYS || 30);
const CALENDAR_SYNC_MAX_RESULTS = Number(process.env.CALENDAR_SYNC_MAX_RESULTS || 100);
const DASHBOARD_MEETING_TIMEZONE = process.env.CALENDAR_DASHBOARD_TIMEZONE || "Europe/Rome";

function nowIso() {
  return new Date().toISOString();
}

function calendarSyncWindow({ timeMin = "", timeMax = "", maxResults } = {}) {
  return {
    timeMin: timeMin || new Date(Date.now() - CALENDAR_SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    timeMax: timeMax || new Date(Date.now() + CALENDAR_SYNC_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    maxResults: Number(maxResults || CALENDAR_SYNC_MAX_RESULTS),
  };
}

function calendarDayKey(dateValue) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DASHBOARD_MEETING_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(dateValue));
}

function meetingTimeLabel(event) {
  if (event.is_all_day) {
    return "Tutto il giorno";
  }

  const formatter = new Intl.DateTimeFormat("it-IT", {
    timeZone: DASHBOARD_MEETING_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${formatter.format(new Date(event.start_at))} - ${formatter.format(new Date(event.end_at))}`;
}

function meetingDurationMinutes(event) {
  const durationMs = new Date(event.end_at).getTime() - new Date(event.start_at).getTime();
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return 0;
  }
  return Math.round(durationMs / 60000);
}

function meetingDurationLabel(totalMinutes) {
  if (!totalMinutes) {
    return "0 h";
  }

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = totalMinutes / 60;
  return Number.isInteger(hours) ? `${hours} h` : `${hours.toFixed(1)} h`;
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function trimTranscript(value = "", limit = 8000) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

function inferJoinProviderFromUrl(meetingUrl = "") {
  const normalized = String(meetingUrl || "").toLowerCase();
  if (!normalized) {
    return "";
  }
  if (normalized.includes("meet.google.com")) {
    return "google_meet";
  }
  if (normalized.includes("teams.microsoft.com") || normalized.includes("teams.live.com")) {
    return "microsoft_teams";
  }
  if (normalized.includes("zoom.us")) {
    return "zoom";
  }
  if (normalized.includes("webex.com")) {
    return "webex";
  }
  return "external";
}

function normalizeDraftSignal(value = "") {
  return String(value || "").trim().toLowerCase();
}

function countDraftHintMatches(text, hints) {
  return hints.reduce((count, hint) => count + (text.includes(hint) ? 1 : 0), 0);
}

function evaluateDraftEligibility(thread, classification = null) {
  if (!thread) {
    return { eligible: false, reason: "Thread non trovato." };
  }

  if (!thread.needs_reply) {
    return { eligible: false, reason: "Il thread non richiede risposta." };
  }

  if (thread.category !== "todo") {
    return { eligible: false, reason: "Il thread non e classificato come da gestire." };
  }

  const sender = [thread.from_email, thread.from_name]
    .map((value) => normalizeDraftSignal(value))
    .filter(Boolean)
    .join(" ");
  const content = [
    thread.subject,
    thread.snippet,
    classification?.reason || thread.category_reason || "",
    thread.from_email,
    thread.from_name,
  ]
    .map((value) => normalizeDraftSignal(value))
    .filter(Boolean)
    .join(" ");

  if (DRAFT_BLOCKED_SENDER_HINTS.some((hint) => sender.includes(hint))) {
    return { eligible: false, reason: "Mittente automatizzato o di notifica: salto la bozza automatica." };
  }

  const topicLabel = normalizeDraftSignal(classification?.topic_label || thread.topic_label || "");
  if (topicLabel && DRAFT_BLOCKED_TOPIC_LABELS.has(topicLabel)) {
    return { eligible: false, reason: `Topic ${topicLabel} escluso dalle bozze automatiche.` };
  }

  const blockedTextMatches = countDraftHintMatches(content, DRAFT_BLOCKED_TEXT_HINTS);
  const directReplySignals = countDraftHintMatches(content, DRAFT_REPLY_SIGNAL_HINTS) + (content.includes("?") ? 1 : 0);
  if (blockedTextMatches >= 2 && directReplySignals === 0) {
    return { eligible: false, reason: "Broadcast promozionale o digest: nessuna bozza automatica." };
  }

  return { eligible: true, reason: "" };
}

function ensureSetting(key, value) {
  const row = db.prepare("SELECT key FROM settings WHERE key = ?").get(key);
  if (!row) {
    db.prepare("INSERT INTO settings (key, json_value, updated_at) VALUES (?, ?, ?)")
      .run(key, JSON.stringify(value), nowIso());
  }
}

function ensureDefaultData() {
  const email = process.env.PRIVATE_DEV_USER_EMAIL || "owner@mailmind.local";
  const fullName = process.env.PRIVATE_DEV_USER_NAME || "MailMind Owner";
  const now = nowIso();

  let user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user) {
    const userId = randomUUID();
    db.prepare("INSERT INTO users (id, email, full_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(userId, email, fullName, now, now);
    user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  }

  let workspace = db.prepare("SELECT * FROM workspaces WHERE owner_user_id = ?").get(user.id);
  if (!workspace) {
    const workspaceId = randomUUID();
    db.prepare("INSERT INTO workspaces (id, owner_user_id, name, email_domain, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(workspaceId, user.id, defaultOrganization.orgName, defaultOrganization.orgDomain, "personal", now, now);
    db.prepare("INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(randomUUID(), workspaceId, user.id, "owner", now);
    workspace = db.prepare("SELECT * FROM workspaces WHERE id = ?").get(workspaceId);
  }

  ensureSetting("organization", defaultOrganization);
  ensureSetting("categorization", defaultCategorization);
  ensureSetting("drafts", defaultDrafts);
  ensureSetting("scheduling", defaultScheduling);
  ensureSetting("notetaker", defaultNotetaker);
  ensureSetting("billing", defaultBilling);

  const notificationCount = db.prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ?").get(user.id).count;
  if (notificationCount === 0) {
    const insert = db.prepare(
      "INSERT INTO notifications (id, user_id, title, body, link, read_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    for (const item of defaultDashboardNotifications) {
      insert.run(randomUUID(), user.id, item.title, item.body, item.link, "", now);
    }
  }
}

ensureDefaultData();

export function listNotifications(userId) {
  return db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC").all(userId);
}

export function getOrCreateDevUser() {
  const email = process.env.PRIVATE_DEV_USER_EMAIL || "owner@mailmind.local";
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  const workspace = db.prepare("SELECT * FROM workspaces WHERE owner_user_id = ?").get(user.id);
  return { user, workspace };
}

export function getSetting(key, fallback = null) {
  const row = db.prepare("SELECT json_value FROM settings WHERE key = ?").get(key);
  if (!row) {
    return fallback;
  }
  try {
    return JSON.parse(row.json_value);
  } catch {
    return fallback;
  }
}

export function setSetting(key, value) {
  const now = nowIso();
  db.prepare(`
    INSERT INTO settings (key, json_value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET json_value = excluded.json_value, updated_at = excluded.updated_at
  `).run(key, JSON.stringify(value), now);
  return value;
}

export function createSession(userId) {
  const id = randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);
  db.prepare("INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .run(id, userId, expires.toISOString(), now.toISOString());
  return { id, expiresAt: expires.toISOString() };
}

export function getSession(sessionId) {
  if (!sessionId) {
    return null;
  }
  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId);
  if (!session) {
    return null;
  }
  if (new Date(session.expires_at) <= new Date()) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
    return null;
  }
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(session.user_id);
  const workspace = db.prepare("SELECT * FROM workspaces WHERE owner_user_id = ?").get(user.id);
  return { session, user, workspace };
}

export function deleteSession(sessionId) {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

export function createAuditLog({
  userId = "",
  workspaceId = "",
  eventType,
  actorEmail = "",
  ipAddress = "",
  userAgent = "",
  metadata = {},
}) {
  if (!eventType) {
    return null;
  }

  const id = randomUUID();
  db.prepare(`
    INSERT INTO audit_logs (
      id, user_id, workspace_id, event_type, actor_email, ip_address, user_agent, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId || "",
    workspaceId || "",
    eventType,
    actorEmail || "",
    ipAddress || "",
    userAgent || "",
    JSON.stringify(metadata || {}),
    nowIso(),
  );

  return id;
}

export function listConnectedAccounts(userId) {
  return db.prepare("SELECT * FROM connected_accounts WHERE user_id = ? ORDER BY created_at DESC").all(userId);
}

function findCalendarEventById(userId, calendarEventId) {
  if (!calendarEventId) {
    return null;
  }

  return db.prepare(`
    SELECT ce.*, ca.email AS account_email, ca.display_name AS account_display_name
    FROM calendar_events ce
    LEFT JOIN connected_accounts ca ON ca.id = ce.connected_account_id
    WHERE ce.user_id = ? AND ce.id = ?
  `).get(userId, calendarEventId);
}

export function listMailSyncStates(userId) {
  return db.prepare("SELECT * FROM mail_sync_state WHERE user_id = ? ORDER BY updated_at DESC").all(userId);
}

export function listWebhookSubscriptions(userId) {
  return db.prepare(`
    SELECT ws.*
    FROM webhook_subscriptions ws
    JOIN connected_accounts ca ON ca.id = ws.connected_account_id
    WHERE ca.user_id = ?
    ORDER BY ws.updated_at DESC
  `).all(userId);
}

export function listSyncRuns(userId) {
  return db.prepare(`
    SELECT *
    FROM sync_runs
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId);
}

export function upsertConnectedAccount({
  workspaceId,
  userId,
  provider,
  email,
  displayName,
  externalAccountId,
  encryptedAccessToken,
  encryptedRefreshToken,
  expiresAt,
}) {
  const existing = db.prepare(
    "SELECT * FROM connected_accounts WHERE user_id = ? AND provider = ? AND email = ?",
  ).get(userId, provider, email);

  const now = nowIso();

  if (existing) {
    db.prepare(`
      UPDATE connected_accounts
      SET display_name = ?, external_account_id = ?, encrypted_access_token = ?, encrypted_refresh_token = ?, expires_at = ?, updated_at = ?
      WHERE id = ?
    `).run(displayName, externalAccountId, encryptedAccessToken, encryptedRefreshToken, expiresAt, now, existing.id);
    return db.prepare("SELECT * FROM connected_accounts WHERE id = ?").get(existing.id);
  }

  const id = randomUUID();
  db.prepare(`
    INSERT INTO connected_accounts (
      id, workspace_id, user_id, provider, email, display_name, external_account_id,
      encrypted_access_token, encrypted_refresh_token, expires_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    workspaceId,
    userId,
    provider,
    email,
    displayName,
    externalAccountId,
    encryptedAccessToken,
    encryptedRefreshToken,
    expiresAt || "",
    now,
    now,
  );
  return db.prepare("SELECT * FROM connected_accounts WHERE id = ?").get(id);
}

export function updateConnectedAccountTokens(accountId, { encryptedAccessToken, encryptedRefreshToken, expiresAt }) {
  db.prepare(`
    UPDATE connected_accounts
    SET encrypted_access_token = ?, encrypted_refresh_token = ?, expires_at = ?, updated_at = ?
    WHERE id = ?
  `).run(encryptedAccessToken, encryptedRefreshToken, expiresAt || "", nowIso(), accountId);

  return db.prepare("SELECT * FROM connected_accounts WHERE id = ?").get(accountId);
}

function createSyncRun({
  userId,
  connectedAccountId,
  status,
  processedThreads = 0,
  processedMessages = 0,
  errorMessage = "",
}) {
  db.prepare(`
    INSERT INTO sync_runs (
      id, user_id, connected_account_id, status, processed_threads, processed_messages, error_message, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    userId,
    connectedAccountId,
    status,
    processedThreads,
    processedMessages,
    errorMessage,
    nowIso(),
  );
}

export function findConnectedAccountById(accountId) {
  return db.prepare("SELECT * FROM connected_accounts WHERE id = ?").get(accountId);
}

export function findConnectedAccountByProviderEmail(provider, email) {
  return db.prepare(`
    SELECT *
    FROM connected_accounts
    WHERE provider = ? AND lower(email) = lower(?)
    ORDER BY created_at DESC
    LIMIT 1
  `).get(provider, email);
}

export function findConnectedAccountByWebhookSubscriptionId(provider, externalSubscriptionId) {
  return db.prepare(`
    SELECT ca.*
    FROM webhook_subscriptions ws
    JOIN connected_accounts ca ON ca.id = ws.connected_account_id
    WHERE ws.provider = ? AND ws.external_subscription_id = ?
    LIMIT 1
  `).get(provider, externalSubscriptionId);
}

export function getMailSyncState(accountId) {
  return db.prepare("SELECT * FROM mail_sync_state WHERE connected_account_id = ?").get(accountId);
}

export function upsertMailSyncState(accountId, patch) {
  const account = findConnectedAccountById(accountId);
  if (!account) {
    return null;
  }

  const existing = getMailSyncState(accountId);
  const now = nowIso();
  const next = {
    connected_account_id: accountId,
    user_id: account.user_id,
    provider: account.provider,
    sync_cursor: patch.syncCursor ?? existing?.sync_cursor ?? "",
    delta_link: patch.deltaLink ?? existing?.delta_link ?? "",
    last_full_sync_at: patch.lastFullSyncAt ?? existing?.last_full_sync_at ?? "",
    last_delta_sync_at: patch.lastDeltaSyncAt ?? existing?.last_delta_sync_at ?? "",
    last_webhook_at: patch.lastWebhookAt ?? existing?.last_webhook_at ?? "",
    updated_at: now,
  };

  db.prepare(`
    INSERT INTO mail_sync_state (
      connected_account_id, user_id, provider, sync_cursor, delta_link, last_full_sync_at,
      last_delta_sync_at, last_webhook_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(connected_account_id) DO UPDATE SET
      sync_cursor = excluded.sync_cursor,
      delta_link = excluded.delta_link,
      last_full_sync_at = excluded.last_full_sync_at,
      last_delta_sync_at = excluded.last_delta_sync_at,
      last_webhook_at = excluded.last_webhook_at,
      updated_at = excluded.updated_at
  `).run(
    next.connected_account_id,
    next.user_id,
    next.provider,
    next.sync_cursor,
    next.delta_link,
    next.last_full_sync_at,
    next.last_delta_sync_at,
    next.last_webhook_at,
    next.updated_at,
  );

  return getMailSyncState(accountId);
}

export function getWebhookSubscription(accountId) {
  return db.prepare("SELECT * FROM webhook_subscriptions WHERE connected_account_id = ?").get(accountId);
}

export function upsertWebhookSubscription(accountId, patch) {
  const account = findConnectedAccountById(accountId);
  if (!account) {
    return null;
  }

  const existing = getWebhookSubscription(accountId);
  const now = nowIso();
  const next = {
    id: existing?.id || randomUUID(),
    connected_account_id: accountId,
    provider: account.provider,
    external_subscription_id: patch.externalId ?? existing?.external_subscription_id ?? "",
    resource: patch.resource ?? existing?.resource ?? "",
    client_state: patch.clientState ?? existing?.client_state ?? "",
    notification_url: patch.notificationUrl ?? existing?.notification_url ?? "",
    expiration_at: patch.expirationAt ?? existing?.expiration_at ?? "",
    status: patch.status ?? existing?.status ?? "pending",
    created_at: existing?.created_at || now,
    updated_at: now,
  };

  db.prepare(`
    INSERT INTO webhook_subscriptions (
      id, connected_account_id, provider, external_subscription_id, resource, client_state,
      notification_url, expiration_at, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(connected_account_id) DO UPDATE SET
      external_subscription_id = excluded.external_subscription_id,
      resource = excluded.resource,
      client_state = excluded.client_state,
      notification_url = excluded.notification_url,
      expiration_at = excluded.expiration_at,
      status = excluded.status,
      updated_at = excluded.updated_at
  `).run(
    next.id,
    next.connected_account_id,
    next.provider,
    next.external_subscription_id,
    next.resource,
    next.client_state,
    next.notification_url,
    next.expiration_at,
    next.status,
    next.created_at,
    next.updated_at,
  );

  return getWebhookSubscription(accountId);
}

export function deleteConnectedAccount(userId, accountId) {
  const existing = db.prepare("SELECT id FROM connected_accounts WHERE id = ? AND user_id = ?").get(accountId, userId);
  if (!existing) {
    return false;
  }

  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM draft_records WHERE user_id = ? AND connected_account_id = ?").run(userId, accountId);
    db.prepare("DELETE FROM meeting_sessions WHERE user_id = ? AND connected_account_id = ?").run(userId, accountId);
    db.prepare("DELETE FROM calendar_events WHERE user_id = ? AND connected_account_id = ?").run(userId, accountId);
    db.prepare("DELETE FROM thread_classifications WHERE thread_id IN (SELECT id FROM mail_threads WHERE user_id = ? AND connected_account_id = ?)")
      .run(userId, accountId);
    db.prepare("DELETE FROM mail_messages WHERE thread_id IN (SELECT id FROM mail_threads WHERE user_id = ? AND connected_account_id = ?)")
      .run(userId, accountId);
    db.prepare("DELETE FROM mail_threads WHERE user_id = ? AND connected_account_id = ?").run(userId, accountId);
    db.prepare("DELETE FROM sync_runs WHERE user_id = ? AND connected_account_id = ?").run(userId, accountId);
    db.prepare("DELETE FROM mail_sync_state WHERE connected_account_id = ?").run(accountId);
    db.prepare("DELETE FROM webhook_subscriptions WHERE connected_account_id = ?").run(accountId);
    db.prepare("DELETE FROM connected_accounts WHERE id = ? AND user_id = ?").run(accountId, userId);
    db.exec("COMMIT");
    return true;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function createOauthState({ workspaceId, userId, provider, redirectUri, state, expiresAt }) {
  db.prepare(`
    INSERT INTO oauth_states (state, workspace_id, user_id, provider, redirect_uri, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(state, workspaceId, userId, provider, redirectUri, expiresAt, nowIso());
}

export function consumeOauthState(state, provider) {
  const row = db.prepare("SELECT * FROM oauth_states WHERE state = ? AND provider = ?").get(state, provider);
  if (!row) {
    return null;
  }
  db.prepare("DELETE FROM oauth_states WHERE state = ?").run(state);
  if (new Date(row.expires_at) <= new Date()) {
    return null;
  }
  return row;
}

export function getWorkspaceSummary(userId) {
  const workspace = db.prepare("SELECT * FROM workspaces WHERE owner_user_id = ?").get(userId);
  const org = getSetting("organization", defaultOrganization);
  return {
    id: workspace.id,
    type: workspace.type,
    ownerUserId: workspace.owner_user_id,
    orgName: org.orgName,
    orgDomain: org.orgDomain,
    settings: org.settings,
  };
}

export function updateWorkspaceSummary(userId, patch) {
  const workspace = db.prepare("SELECT * FROM workspaces WHERE owner_user_id = ?").get(userId);
  const next = {
    ...getSetting("organization", defaultOrganization),
    ...patch,
    settings: {
      ...getSetting("organization", defaultOrganization).settings,
      ...(patch.settings || {}),
    },
  };

  db.prepare("UPDATE workspaces SET name = ?, email_domain = ?, updated_at = ? WHERE id = ?")
    .run(next.orgName, next.orgDomain, nowIso(), workspace.id);
  setSetting("organization", next);
  return getWorkspaceSummary(userId);
}

export function listWorkspaceMembers(workspaceId) {
  return db.prepare(`
    SELECT wm.role, u.id, u.email, u.full_name, u.created_at
    FROM workspace_members wm
    JOIN users u ON u.id = wm.user_id
    WHERE wm.workspace_id = ?
    ORDER BY u.created_at ASC
  `).all(workspaceId);
}

export function listTeams(workspaceId) {
  return db.prepare("SELECT * FROM teams WHERE workspace_id = ? ORDER BY created_at ASC").all(workspaceId);
}

export function createTeam(workspaceId, name) {
  const id = randomUUID();
  db.prepare("INSERT INTO teams (id, workspace_id, name, created_at) VALUES (?, ?, ?, ?)")
    .run(id, workspaceId, name, nowIso());
  return db.prepare("SELECT * FROM teams WHERE id = ?").get(id);
}

export function listInvites(workspaceId) {
  return db.prepare("SELECT * FROM invites WHERE workspace_id = ? ORDER BY created_at DESC").all(workspaceId);
}

export function createInvite(workspaceId, email, role = "member") {
  const id = randomUUID();
  db.prepare("INSERT INTO invites (id, workspace_id, email, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, workspaceId, email, role, "pending", nowIso());
  return db.prepare("SELECT * FROM invites WHERE id = ?").get(id);
}

export function getBillingSummary() {
  return getSetting("billing", defaultBilling);
}

export function getDashboard(userId) {
  const processedCount = db.prepare("SELECT COUNT(*) as count FROM mail_threads WHERE user_id = ?").get(userId).count;
  const draftCount = db.prepare("SELECT COUNT(*) as count FROM draft_records WHERE user_id = ?").get(userId).count;
  const recentCalendarRows = listCalendarRows(userId, {
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    to: nowIso(),
    includeCancelled: false,
    limit: 500,
  }).filter((event) => new Date(event.end_at).getTime() <= Date.now());
  const meetingMinutes = recentCalendarRows.reduce((sum, event) => sum + meetingDurationMinutes(event), 0);

  return {
    stats: [
      { label: "Email elaborate", value: String(processedCount) },
      { label: "Bozze create", value: String(draftCount) },
      { label: "Tempo riunioni", value: meetingDurationLabel(meetingMinutes) },
    ],
    meetings: dashboardMeetings(userId),
    notifications: listNotifications(userId),
  };
}

export function listConversations(userId) {
  return db.prepare("SELECT * FROM chat_conversations WHERE user_id = ? ORDER BY updated_at DESC").all(userId);
}

export function createConversation(userId, title = "Nuova chat") {
  const id = randomUUID();
  const now = nowIso();
  db.prepare("INSERT INTO chat_conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, userId, title, now, now);
  return db.prepare("SELECT * FROM chat_conversations WHERE id = ?").get(id);
}

export function listConversationMessages(conversationId) {
  return db.prepare("SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC").all(conversationId);
}

export function addConversationMessage(conversationId, role, content) {
  const id = randomUUID();
  const now = nowIso();
  db.prepare("INSERT INTO chat_messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, conversationId, role, content, now);
  db.prepare("UPDATE chat_conversations SET updated_at = ? WHERE id = ?").run(now, conversationId);
  return db.prepare("SELECT * FROM chat_messages WHERE id = ?").get(id);
}

function demoThreadsForAccount(account) {
  const displayName = account.display_name || account.email.split("@")[0];
  return [
    {
      externalThreadId: `demo:${account.id}:commerciale`,
      subject: `Revisione proposta commerciale per ${displayName}`,
      fromName: "Giulia Bianchi",
      fromEmail: "giulia.bianchi@example.com",
      snippet: "Ti mando la nuova proposta commerciale. Fammi sapere se vuoi procedere entro venerdi.",
      category: "todo",
      status: "nuovo",
      needsReply: 1,
      lastMessageAt: nowIso(),
      messages: [
        {
          externalMessageId: `demo:${account.id}:commerciale:1`,
          internetMessageId: `<demo-${account.id}-commerciale-1@mailmind.local>`,
          role: "incoming",
          senderName: "Giulia Bianchi",
          senderEmail: "giulia.bianchi@example.com",
          content: "Ti mando la nuova proposta commerciale. Fammi sapere se vuoi procedere entro venerdi.",
          createdAt: nowIso(),
          messageSubject: `Revisione proposta commerciale per ${displayName}`,
          isRead: false,
        },
      ],
    },
    {
      externalThreadId: `demo:${account.id}:meeting`,
      subject: "Invito riunione settimanale",
      fromName: "Studio Legale Verdi",
      fromEmail: "agenda@studioverdi.it",
      snippet: "Confermiamo la riunione di coordinamento di martedi alle 14.",
      category: "todo",
      status: "nuovo",
      needsReply: 1,
      lastMessageAt: nowIso(),
      messages: [
        {
          externalMessageId: `demo:${account.id}:meeting:1`,
          internetMessageId: `<demo-${account.id}-meeting-1@mailmind.local>`,
          role: "incoming",
          senderName: "Studio Legale Verdi",
          senderEmail: "agenda@studioverdi.it",
          content: "Confermiamo la riunione di coordinamento di martedi alle 14.",
          createdAt: nowIso(),
          messageSubject: "Invito riunione settimanale",
          isRead: false,
        },
      ],
    },
    {
      externalThreadId: `demo:${account.id}:billing`,
      subject: "Aggiornamento fatturazione marzo",
      fromName: "Contabilita",
      fromEmail: "billing@example.com",
      snippet: "Ti inviamo il riepilogo delle fatture del mese. Nessuna azione necessaria.",
      category: "notification",
      status: "archiviata",
      needsReply: 0,
      lastMessageAt: nowIso(),
      messages: [
        {
          externalMessageId: `demo:${account.id}:billing:1`,
          internetMessageId: `<demo-${account.id}-billing-1@mailmind.local>`,
          role: "incoming",
          senderName: "Contabilita",
          senderEmail: "billing@example.com",
          content: "Ti inviamo il riepilogo delle fatture del mese. Nessuna azione necessaria.",
          createdAt: nowIso(),
          messageSubject: "Aggiornamento fatturazione marzo",
          isRead: true,
        },
      ],
    },
  ];
}

function isDemoConnectedAccount(account) {
  return account.external_account_id?.startsWith("demo-") || !account.encrypted_access_token?.includes(".");
}

function demoCalendarEventsForAccount(account, options = {}) {
  const window = calendarSyncWindow(options);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const events = [
    {
      externalEventId: `demo:${account.id}:standup`,
      calendarId: "primary",
      title: "Standup operativo",
      organizerName: account.display_name || account.email,
      organizerEmail: account.email,
      meetingUrl: "https://meet.google.com/demo-standup-room",
      joinProvider: "google_meet",
      location: "",
      status: "confirmed",
      startAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 30).toISOString(),
      endAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0).toISOString(),
      timezone: DASHBOARD_MEETING_TIMEZONE,
      attendeeCount: 3,
      isAllDay: 0,
    },
    {
      externalEventId: `demo:${account.id}:cliente`,
      calendarId: "primary",
      title: "Allineamento cliente",
      organizerName: "Studio Verdi",
      organizerEmail: "agenda@studioverdi.it",
      meetingUrl: "https://teams.microsoft.com/l/meetup-join/demo-cliente",
      joinProvider: "microsoft_teams",
      location: "",
      status: "confirmed",
      startAt: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 14, 0).toISOString(),
      endAt: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 14, 45).toISOString(),
      timezone: DASHBOARD_MEETING_TIMEZONE,
      attendeeCount: 5,
      isAllDay: 0,
    },
    {
      externalEventId: `demo:${account.id}:planning`,
      calendarId: "primary",
      title: "Planning settimanale",
      organizerName: account.display_name || account.email,
      organizerEmail: account.email,
      meetingUrl: "",
      joinProvider: "",
      location: "Studio",
      status: "confirmed",
      startAt: new Date(nextWeek.getFullYear(), nextWeek.getMonth(), nextWeek.getDate(), 11, 0).toISOString(),
      endAt: new Date(nextWeek.getFullYear(), nextWeek.getMonth(), nextWeek.getDate(), 12, 0).toISOString(),
      timezone: DASHBOARD_MEETING_TIMEZONE,
      attendeeCount: 4,
      isAllDay: 0,
    },
  ];

  return events.filter((event) => event.endAt >= window.timeMin && event.startAt <= window.timeMax);
}

function upsertCalendarEvent(userId, account, event) {
  const existing = db.prepare(`
    SELECT id
    FROM calendar_events
    WHERE user_id = ? AND connected_account_id = ? AND external_event_id = ?
  `).get(userId, account.id, event.externalEventId);

  const now = nowIso();
  const payload = [
    userId,
    account.id,
    account.provider,
    event.externalEventId,
    event.calendarId || "primary",
    event.title || "(senza titolo)",
    event.organizerName || "",
    event.organizerEmail || "",
    event.meetingUrl || "",
    event.joinProvider || "",
    event.location || "",
    event.status || "confirmed",
    event.startAt,
    event.endAt || event.startAt,
    event.timezone || "",
    Number(event.attendeeCount || 0),
    event.isAllDay ? 1 : 0,
    now,
  ];

  if (existing) {
    db.prepare(`
      UPDATE calendar_events
      SET user_id = ?, connected_account_id = ?, provider = ?, external_event_id = ?, calendar_id = ?, title = ?,
          organizer_name = ?, organizer_email = ?, meeting_url = ?, join_provider = ?, location = ?, status = ?,
          start_at = ?, end_at = ?, timezone = ?, attendee_count = ?, is_all_day = ?, updated_at = ?
      WHERE id = ?
    `).run(...payload, existing.id);
    return existing.id;
  }

  const id = randomUUID();
  db.prepare(`
    INSERT INTO calendar_events (
      id, user_id, connected_account_id, provider, external_event_id, calendar_id, title, organizer_name,
      organizer_email, meeting_url, join_provider, location, status, start_at, end_at, timezone,
      attendee_count, is_all_day, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    ...payload,
    now,
  );
  return id;
}

function listCalendarRows(userId, {
  from = "",
  to = "",
  accountId = null,
  includeCancelled = false,
  limit = 100,
} = {}) {
  const filters = ["ce.user_id = ?"];
  const params = [userId];

  if (accountId) {
    filters.push("ce.connected_account_id = ?");
    params.push(accountId);
  }

  if (!includeCancelled) {
    filters.push("ce.status != 'cancelled'");
  }

  if (from) {
    filters.push("ce.end_at >= ?");
    params.push(from);
  }

  if (to) {
    filters.push("ce.start_at <= ?");
    params.push(to);
  }

  params.push(Number(limit));

  return db.prepare(`
    SELECT ce.*, ca.email AS account_email, ca.display_name AS account_display_name
    FROM calendar_events ce
    LEFT JOIN connected_accounts ca ON ca.id = ce.connected_account_id
    WHERE ${filters.join(" AND ")}
    ORDER BY datetime(ce.start_at) ASC, ce.id ASC
    LIMIT ?
  `).all(...params);
}

function calendarEventsSummary(userId, rows) {
  const upcoming = rows.filter((event) => new Date(event.end_at).getTime() >= Date.now());
  const windowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const recentEvents = listCalendarRows(userId, {
    from: windowStart,
    to: nowIso(),
    includeCancelled: false,
    limit: 500,
  }).filter((event) => new Date(event.end_at).getTime() <= Date.now());

  const totalMinutes = recentEvents.reduce((sum, event) => sum + meetingDurationMinutes(event), 0);
  const averageAttendees = recentEvents.length
    ? (recentEvents.reduce((sum, event) => sum + Number(event.attendee_count || 0), 0) / recentEvents.length)
    : 0;
  const averageDurationMinutes = recentEvents.length
    ? Math.round(totalMinutes / recentEvents.length)
    : 0;
  const todayKey = calendarDayKey(new Date().toISOString());
  const tomorrowKey = calendarDayKey(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());

  return {
    upcomingCount: upcoming.length,
    todayCount: rows.filter((event) => calendarDayKey(event.start_at) === todayKey).length,
    tomorrowCount: rows.filter((event) => calendarDayKey(event.start_at) === tomorrowKey).length,
    bookedMeetings30d: recentEvents.length,
    averageAttendees,
    averageDurationMinutes,
    totalMeetingMinutes30d: totalMinutes,
  };
}

function dashboardMeetings(userId) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 48 * 60 * 60 * 1000);
  const rows = listCalendarRows(userId, {
    from: start.toISOString(),
    to: end.toISOString(),
    includeCancelled: false,
    limit: 50,
  });
  const todayKey = calendarDayKey(start.toISOString());
  const tomorrowKey = calendarDayKey(new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString());

  const mapped = rows.map((event) => ({
    id: event.id,
    title: event.title,
    time: meetingTimeLabel(event),
    provider: event.provider,
    joinProvider: event.join_provider,
    meetingUrl: event.meeting_url,
    accountEmail: event.account_email || "",
  }));

  return {
    today: mapped.filter((event, index) => calendarDayKey(rows[index].start_at) === todayKey),
    tomorrow: mapped.filter((event, index) => calendarDayKey(rows[index].start_at) === tomorrowKey),
  };
}

async function syncAccountCalendar(userId, account, options = {}) {
  const window = calendarSyncWindow(options);
  const events = isDemoConnectedAccount(account)
    ? demoCalendarEventsForAccount(account, window)
    : await fetchCalendarRemoteState(account, window, {
      onTokenRefresh: async (tokenUpdate) => {
        updateConnectedAccountTokens(account.id, tokenUpdate);
      },
    });

  db.exec("BEGIN");
  try {
    db.prepare(`
      DELETE FROM calendar_events
      WHERE user_id = ? AND connected_account_id = ? AND end_at >= ? AND start_at <= ?
    `).run(userId, account.id, window.timeMin, window.timeMax);

    for (const event of events) {
      if (!event?.externalEventId || !event.startAt) {
        continue;
      }
      upsertCalendarEvent(userId, account, event);
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return {
    accountId: account.id,
    provider: account.provider,
    source: isDemoConnectedAccount(account) ? "demo" : "provider",
    importedEvents: events.length,
  };
}

export async function syncCalendar(userId, accountId = null, options = {}) {
  const accounts = accountId
    ? listConnectedAccounts(userId).filter((account) => account.id === accountId)
    : listConnectedAccounts(userId);

  const results = [];
  for (const account of accounts) {
    results.push(await syncAccountCalendar(userId, account, options));
  }

  return {
    syncedAccounts: results.length,
    importedEvents: results.reduce((sum, item) => sum + item.importedEvents, 0),
    accounts: results,
  };
}

export function listCalendarEvents(userId, options = {}) {
  const window = calendarSyncWindow(options);
  const rows = listCalendarRows(userId, {
    from: options.from || window.timeMin,
    to: options.to || window.timeMax,
    accountId: options.accountId || null,
    includeCancelled: options.includeCancelled === true,
    limit: options.limit || window.maxResults,
  });

  return {
    events: rows.map((event) => ({
      ...event,
      time_label: meetingTimeLabel(event),
      duration_minutes: meetingDurationMinutes(event),
    })),
    summary: calendarEventsSummary(userId, rows),
  };
}

function normalizeMeetingSessionRow(row) {
  return {
    ...row,
    utterances: safeJsonParse(row.utterances_json || "[]", []),
    key_points: safeJsonParse(row.key_points_json || "[]", []),
    action_items: safeJsonParse(row.action_items_json || "[]", []),
  };
}

function fallbackMeetingAnalysis({ session, calendarEvent, transcriptText }) {
  const transcript = trimTranscript(transcriptText || "");
  const eventTime = calendarEvent?.start_at ? meetingTimeLabel(calendarEvent) : "";
  const summary = transcript
    ? `Recap rapido: ${transcript.slice(0, 220)}${transcript.length > 220 ? "..." : ""}`
    : `Sessione creata per "${session.title}". ${eventTime ? `Evento collegato: ${eventTime}. ` : ""}In attesa di una trascrizione reale per produrre note complete.`;

  const keyPoints = transcript
    ? transcript.split(/[.!?]/).map((chunk) => chunk.trim()).filter(Boolean).slice(0, 3)
    : [
      session.meeting_url ? "Riunione online collegata al link fornito." : "Riunione creata dal backend privato.",
      calendarEvent?.organizer_email ? `Organizer: ${calendarEvent.organizer_email}.` : "Nessun organizer disponibile.",
    ].filter(Boolean);

  const actionItems = transcript
    ? [{
      owner: "Da assegnare",
      task: "Rivedere il recap automatico e confermare i prossimi step.",
    }]
    : [{
      owner: "Tu",
      task: "Aggiungi una trascrizione o registra l'audio per ottenere action items affidabili.",
    }];

  const followUpEmail = [
    "Ciao,",
    "",
    `ti condivido un recap iniziale della riunione "${session.title}".`,
    summary,
    "",
    "Prossimi passi:",
    ...actionItems.map((item) => `- ${item.task}`),
  ].join("\n");

  return {
    summary,
    keyPoints,
    actionItems,
    followUpEmail,
    model: "fallback-local",
  };
}

async function analyzeMeetingSession({ session, calendarEvent, transcriptText }) {
  const transcript = trimTranscript(transcriptText || session.transcript_text || "");
  if (!hasGeminiCredentials()) {
    return fallbackMeetingAnalysis({ session, calendarEvent, transcriptText: transcript });
  }

  const prompt = [
    "Analizza una riunione e restituisci JSON valido.",
    "Campi richiesti: summary string, keyPoints array di stringhe, actionItems array di oggetti { owner, task }, followUpEmail string.",
    "Non inventare dettagli non presenti. Se il transcript e insufficiente, sii prudente e segnala le assunzioni minime.",
    "",
    `Titolo riunione: ${session.title}`,
    `Fonte: ${session.source_type}`,
    `Lingua preferita: ${session.language || "it"}`,
    calendarEvent?.organizer_email ? `Organizer: ${calendarEvent.organizer_email}` : "",
    calendarEvent?.start_at ? `Orario evento: ${calendarEvent.start_at} -> ${calendarEvent.end_at}` : "",
    session.meeting_url ? `Meeting URL: ${session.meeting_url}` : "",
    "",
    "Transcript o note:",
    transcript || "Nessun transcript disponibile. Genera un recap prudente e segnala che manca la trascrizione.",
  ].filter(Boolean).join("\n");

  try {
    const result = await generateJsonWithGemini({
      model: process.env.GEMINI_CHAT_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash",
      systemInstruction: "Sei un assistente executive per note riunione. Rispondi in italiano con JSON rigoroso e conciso.",
      prompt,
      temperature: 0.2,
      maxOutputTokens: 900,
    });

    return {
      summary: String(result.json?.summary || "").trim(),
      keyPoints: Array.isArray(result.json?.keyPoints) ? result.json.keyPoints.map((item) => String(item).trim()).filter(Boolean) : [],
      actionItems: Array.isArray(result.json?.actionItems)
        ? result.json.actionItems.map((item) => ({
          owner: String(item?.owner || "Da assegnare").trim() || "Da assegnare",
          task: String(item?.task || "").trim(),
        })).filter((item) => item.task)
        : [],
      followUpEmail: String(result.json?.followUpEmail || "").trim(),
      model: result.model,
    };
  } catch {
    return fallbackMeetingAnalysis({ session, calendarEvent, transcriptText: transcript });
  }
}

function updateMeetingSessionArtifacts(sessionId, patch) {
  db.prepare(`
    UPDATE meeting_sessions
    SET status = ?, transcript_text = ?, utterances_json = ?, summary_text = ?, key_points_json = ?, action_items_json = ?,
        follow_up_email = ?, error_message = ?, duration_minutes = ?, transcription_provider = ?, updated_at = ?
    WHERE id = ?
  `).run(
    patch.status,
    patch.transcriptText,
    JSON.stringify(patch.utterances || []),
    patch.summaryText,
    JSON.stringify(patch.keyPoints || []),
    JSON.stringify(patch.actionItems || []),
    patch.followUpEmail || "",
    patch.errorMessage || "",
    Number(patch.durationMinutes || 0),
    patch.transcriptionProvider || "",
    nowIso(),
    sessionId,
  );
}

export function listMeetingSessions(userId) {
  const rows = db.prepare(`
    SELECT
      ms.*,
      ce.title AS calendar_event_title,
      ce.start_at AS calendar_event_start_at,
      ce.end_at AS calendar_event_end_at,
      ce.organizer_email AS calendar_event_organizer_email,
      ce.account_email AS calendar_account_email
    FROM meeting_sessions ms
    LEFT JOIN (
      SELECT ce.*, ca.email AS account_email
      FROM calendar_events ce
      LEFT JOIN connected_accounts ca ON ca.id = ce.connected_account_id
    ) ce ON ce.id = ms.calendar_event_id
    WHERE ms.user_id = ?
    ORDER BY datetime(ms.updated_at) DESC, ms.id DESC
  `).all(userId);

  return rows.map(normalizeMeetingSessionRow);
}

export async function createMeetingSession(userId, payload = {}) {
  const calendarEvent = findCalendarEventById(userId, payload.calendarEventId || "");
  const title = String(payload.title || calendarEvent?.title || "Riunione senza titolo").trim();
  const meetingUrl = String(payload.meetingUrl || calendarEvent?.meeting_url || "").trim();
  const transcriptText = String(payload.transcriptText || "").trim();
  const sourceType = payload.sourceType || "record";
  const status = transcriptText ? "processing" : (sourceType === "join" ? "scheduled" : "recording_requested");
  const id = randomUUID();
  const now = nowIso();

  db.prepare(`
    INSERT INTO meeting_sessions (
      id, user_id, calendar_event_id, connected_account_id, source_type, status, title, meeting_url,
      join_provider, language, source_file_name, source_file_type, source_file_size, source_object_key,
      source_storage_provider, transcription_provider,
      started_at, ended_at, duration_minutes, transcript_text, utterances_json, summary_text, key_points_json,
      action_items_json, follow_up_email, error_message, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    calendarEvent?.id || "",
    calendarEvent?.connected_account_id || "",
    sourceType,
    status,
    title,
    meetingUrl,
    calendarEvent?.join_provider || inferJoinProviderFromUrl(meetingUrl),
    payload.language || defaultNotetaker.language,
    payload.sourceFileName || "",
    payload.sourceFileType || "",
    Number(payload.sourceFileSize || 0),
    payload.sourceObjectKey || "",
    payload.sourceStorageProvider || "",
    payload.transcriptionProvider || "",
    payload.startedAt || calendarEvent?.start_at || "",
    payload.endedAt || calendarEvent?.end_at || "",
    0,
    transcriptText,
    JSON.stringify(payload.utterances || []),
    "",
    "[]",
    "[]",
    "",
    "",
    now,
    now,
  );

  const created = db.prepare("SELECT * FROM meeting_sessions WHERE id = ?").get(id);
  if (!transcriptText) {
    return normalizeMeetingSessionRow(created);
  }

  const analysis = await analyzeMeetingSession({
    session: created,
    calendarEvent,
    transcriptText,
  });

  const durationMinutes = created.started_at && created.ended_at
    ? Math.max(0, meetingDurationMinutes({ start_at: created.started_at, end_at: created.ended_at }))
    : 0;

  updateMeetingSessionArtifacts(id, {
    status: "ready",
    transcriptText,
    utterances: payload.utterances || [],
    summaryText: analysis.summary,
    keyPoints: analysis.keyPoints,
    actionItems: analysis.actionItems,
    followUpEmail: analysis.followUpEmail,
    durationMinutes,
    transcriptionProvider: payload.transcriptionProvider || "",
    errorMessage: "",
  });

  return normalizeMeetingSessionRow(db.prepare("SELECT * FROM meeting_sessions WHERE id = ?").get(id));
}

export async function processMeetingSession(userId, sessionId, transcriptText = "") {
  const existing = db.prepare("SELECT * FROM meeting_sessions WHERE id = ? AND user_id = ?").get(sessionId, userId);
  if (!existing) {
    return null;
  }

  const nextTranscript = String(transcriptText || existing.transcript_text || "").trim();
  const calendarEvent = findCalendarEventById(userId, existing.calendar_event_id || "");

  db.prepare("UPDATE meeting_sessions SET status = ?, transcript_text = ?, updated_at = ? WHERE id = ?")
    .run("processing", nextTranscript, nowIso(), sessionId);

  try {
    const analysis = await analyzeMeetingSession({
      session: { ...existing, transcript_text: nextTranscript },
      calendarEvent,
      transcriptText: nextTranscript,
    });

    const durationMinutes = existing.started_at && existing.ended_at
      ? Math.max(0, meetingDurationMinutes({ start_at: existing.started_at, end_at: existing.ended_at }))
      : Number(existing.duration_minutes || 0);

    updateMeetingSessionArtifacts(sessionId, {
      status: "ready",
      transcriptText: nextTranscript,
      utterances: safeJsonParse(existing.utterances_json || "[]", []),
      summaryText: analysis.summary,
      keyPoints: analysis.keyPoints,
      actionItems: analysis.actionItems,
      followUpEmail: analysis.followUpEmail,
      durationMinutes,
      transcriptionProvider: existing.transcription_provider || "",
      errorMessage: "",
    });
  } catch (error) {
    updateMeetingSessionArtifacts(sessionId, {
      status: "failed",
      transcriptText: nextTranscript,
      utterances: safeJsonParse(existing.utterances_json || "[]", []),
      summaryText: existing.summary_text || "",
      keyPoints: safeJsonParse(existing.key_points_json || "[]", []),
      actionItems: safeJsonParse(existing.action_items_json || "[]", []),
      followUpEmail: existing.follow_up_email || "",
      durationMinutes: Number(existing.duration_minutes || 0),
      transcriptionProvider: existing.transcription_provider || "",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  return normalizeMeetingSessionRow(db.prepare("SELECT * FROM meeting_sessions WHERE id = ?").get(sessionId));
}

export async function createMeetingUploadSession(userId, payload = {}) {
  const audioBuffer = payload.audioBuffer;
  if (!audioBuffer || !Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
    const error = new Error("Audio payload required");
    error.status = 400;
    throw error;
  }

  const storedObject = await putStoredObject({
    keyPrefix: "meeting-recordings",
    filename: payload.sourceFileName || "recording.bin",
    contentType: payload.sourceFileType || "application/octet-stream",
    buffer: audioBuffer,
  });

  const transcription = await transcribeAudioBuffer({
    audioBuffer,
    mimeType: payload.sourceFileType || "application/octet-stream",
    language: payload.language || defaultNotetaker.language,
  });

  if (!transcription.transcript) {
    const error = new Error("Deepgram returned an empty transcript");
    error.status = 422;
    throw error;
  }

  return createMeetingSession(userId, {
    sourceType: "upload",
    calendarEventId: payload.calendarEventId || "",
    title: payload.title || payload.sourceFileName || "Registrazione caricata",
    meetingUrl: payload.meetingUrl || "",
    transcriptText: transcription.transcript,
    language: payload.language || defaultNotetaker.language,
    sourceFileName: payload.sourceFileName || "",
    sourceFileType: payload.sourceFileType || "",
    sourceFileSize: Number(payload.sourceFileSize || audioBuffer.length || 0),
    sourceObjectKey: storedObject.objectKey,
    sourceStorageProvider: storedObject.provider,
    transcriptionProvider: "deepgram",
    utterances: transcription.utterances || [],
  });
}

function threadSnippet(content = "") {
  return content.replace(/\s+/g, " ").trim().slice(0, 240);
}

function deleteThreadArtifacts(threadId, userId = "") {
  if (userId) {
    db.prepare("DELETE FROM draft_records WHERE user_id = ? AND thread_id = ?").run(userId, threadId);
  } else {
    db.prepare("DELETE FROM draft_records WHERE thread_id = ?").run(threadId);
  }
  db.prepare("DELETE FROM thread_classifications WHERE thread_id = ?").run(threadId);
  db.prepare("DELETE FROM mail_messages WHERE thread_id = ?").run(threadId);
  db.prepare("DELETE FROM mail_threads WHERE id = ?").run(threadId);
}

function findMailboxThreadByExternalThreadId(userId, accountId, externalThreadId) {
  return db.prepare(`
    SELECT *
    FROM mail_threads
    WHERE user_id = ? AND connected_account_id = ? AND external_thread_id = ?
  `).get(userId, accountId, externalThreadId);
}

function deleteMailboxThreadByExternalThreadId(userId, accountId, externalThreadId) {
  const thread = findMailboxThreadByExternalThreadId(userId, accountId, externalThreadId);
  if (!thread) {
    return false;
  }

  deleteThreadArtifacts(thread.id, userId);
  return true;
}

function persistThreadMessages(threadId, messages, source) {
  db.prepare("DELETE FROM mail_messages WHERE thread_id = ?").run(threadId);

  let processedMessages = 0;

  for (const message of messages) {
    db.prepare(`
      INSERT INTO mail_messages (
        id, thread_id, external_message_id, role, sender_name, sender_email, message_source, message_subject, is_read, internet_message_id, content, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      threadId,
      message.externalMessageId || "",
      message.role,
      message.senderName || "",
      message.senderEmail || "",
      source,
      message.messageSubject || "",
      message.isRead === false ? 0 : 1,
      message.internetMessageId || "",
      message.content,
      message.createdAt || nowIso(),
    );

    processedMessages += 1;
  }

  return processedMessages;
}

function rebuildThreadFromMessages(threadId) {
  const thread = db.prepare("SELECT * FROM mail_threads WHERE id = ?").get(threadId);
  if (!thread) {
    return null;
  }

  const messages = db.prepare(`
    SELECT *
    FROM mail_messages
    WHERE thread_id = ?
    ORDER BY datetime(created_at) ASC, id ASC
  `).all(threadId);

  if (messages.length === 0) {
    deleteThreadArtifacts(threadId, thread.user_id);
    return null;
  }

  const latestMessage = messages.at(-1);
  const latestIncomingMessage = [...messages].reverse().find((message) => message.role === "incoming") || latestMessage;

  db.prepare(`
    UPDATE mail_threads
    SET subject = ?, from_name = ?, from_email = ?, snippet = ?, category = ?, status = ?, last_message_at = ?, needs_reply = ?
    WHERE id = ?
  `).run(
    latestMessage.message_subject || thread.subject || "(senza oggetto)",
    latestIncomingMessage.sender_name || thread.from_name,
    latestIncomingMessage.sender_email || thread.from_email,
    threadSnippet(latestMessage.content || thread.snippet),
    latestMessage.role === "incoming" ? "todo" : "fyi",
    latestMessage.role === "incoming" && Number(latestMessage.is_read) === 0 ? "nuovo" : "archiviata",
    latestMessage.created_at || thread.last_message_at,
    latestMessage.role === "incoming" ? 1 : 0,
    threadId,
  );

  return db.prepare("SELECT * FROM mail_threads WHERE id = ?").get(threadId);
}

function upsertDeltaMessage(userId, account, message, source) {
  let thread = findMailboxThreadByExternalThreadId(userId, account.id, message.externalThreadId || "");
  if (!thread) {
    const threadId = randomUUID();
    db.prepare(`
      INSERT INTO mail_threads (
        id, user_id, connected_account_id, external_thread_id, thread_source, subject, from_name, from_email,
        snippet, category, status, last_message_at, needs_reply
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      threadId,
      userId,
      account.id,
      message.externalThreadId || "",
      source,
      message.messageSubject || "(senza oggetto)",
      message.senderName || account.display_name || account.email,
      message.senderEmail || account.email,
      threadSnippet(message.content || ""),
      message.role === "incoming" ? "todo" : "fyi",
      message.role === "incoming" && message.isRead === false ? "nuovo" : "archiviata",
      message.createdAt || nowIso(),
      message.role === "incoming" ? 1 : 0,
    );
    thread = db.prepare("SELECT * FROM mail_threads WHERE id = ?").get(threadId);
  }

  const existingMessage = db.prepare(`
    SELECT *
    FROM mail_messages
    WHERE thread_id = ? AND external_message_id = ?
  `).get(thread.id, message.externalMessageId || "");

  if (existingMessage) {
    db.prepare(`
      UPDATE mail_messages
      SET role = ?, sender_name = ?, sender_email = ?, message_source = ?, message_subject = ?, is_read = ?, internet_message_id = ?, content = ?, created_at = ?
      WHERE id = ?
    `).run(
      message.role,
      message.senderName || "",
      message.senderEmail || "",
      source,
      message.messageSubject || "",
      message.isRead === false ? 0 : 1,
      message.internetMessageId || "",
      message.content,
      message.createdAt || existingMessage.created_at,
      existingMessage.id,
    );
  } else {
    db.prepare(`
      INSERT INTO mail_messages (
        id, thread_id, external_message_id, role, sender_name, sender_email, message_source, message_subject, is_read, internet_message_id, content, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      thread.id,
      message.externalMessageId || "",
      message.role,
      message.senderName || "",
      message.senderEmail || "",
      source,
      message.messageSubject || "",
      message.isRead === false ? 0 : 1,
      message.internetMessageId || "",
      message.content,
      message.createdAt || nowIso(),
    );
  }

  rebuildThreadFromMessages(thread.id);
  return thread.id;
}

function deleteMessageByExternalId(userId, accountId, externalMessageId) {
  const row = db.prepare(`
    SELECT mm.id AS message_id, mm.thread_id
    FROM mail_messages mm
    JOIN mail_threads mt ON mt.id = mm.thread_id
    WHERE mt.user_id = ? AND mt.connected_account_id = ? AND mm.external_message_id = ?
  `).get(userId, accountId, externalMessageId);

  if (!row) {
    return false;
  }

  db.prepare("DELETE FROM mail_messages WHERE id = ?").run(row.message_id);
  rebuildThreadFromMessages(row.thread_id);
  return true;
}

function cleanupLegacyThreadsForAccount(userId, accountId) {
  const legacyThreadIds = db.prepare(`
    SELECT id
    FROM mail_threads
    WHERE user_id = ? AND connected_account_id = ? AND external_thread_id = ''
  `).all(userId, accountId).map((row) => row.id);

  if (legacyThreadIds.length === 0) {
    return;
  }

  for (const threadId of legacyThreadIds) {
    deleteThreadArtifacts(threadId, userId);
  }
}

function upsertMailboxThread(userId, account, thread, source) {
  const externalThreadId = thread.externalThreadId || "";
  const existing = externalThreadId
    ? db.prepare(`
      SELECT *
      FROM mail_threads
      WHERE user_id = ? AND connected_account_id = ? AND external_thread_id = ?
    `).get(userId, account.id, externalThreadId)
    : null;

  const threadId = existing?.id || randomUUID();
  const payload = [
    externalThreadId,
    source,
    thread.subject,
    thread.fromName,
    thread.fromEmail,
    thread.snippet,
    thread.category,
    thread.status,
    thread.lastMessageAt || nowIso(),
    thread.needsReply,
  ];

  if (existing) {
    db.prepare(`
      UPDATE mail_threads
      SET external_thread_id = ?, thread_source = ?, subject = ?, from_name = ?, from_email = ?, snippet = ?,
          category = ?, status = ?, last_message_at = ?, needs_reply = ?
      WHERE id = ?
    `).run(...payload, threadId);
  } else {
    db.prepare(`
      INSERT INTO mail_threads (
        id, user_id, connected_account_id, external_thread_id, thread_source, subject, from_name, from_email,
        snippet, category, status, last_message_at, needs_reply
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      threadId,
      userId,
      account.id,
      ...payload,
    );
  }

  const processedMessages = persistThreadMessages(threadId, thread.messages || [], source);
  return { threadId, processedMessages };
}

async function syncAccountMailbox(userId, account, options = {}) {
  const source = isDemoConnectedAccount(account) ? "demo" : "provider";
  cleanupLegacyThreadsForAccount(userId, account.id);
  const syncState = getMailSyncState(account.id);
  const webhookSubscription = getWebhookSubscription(account.id);
  let processedThreads = 0;
  let processedMessages = 0;

  try {
    const remoteState = source === "demo"
      ? {
        mode: "full",
        threads: demoThreadsForAccount(account),
        upsertMessages: [],
        deletedMessageIds: [],
        deletedThreadIds: [],
        syncStatePatch: {
          lastFullSyncAt: nowIso(),
          lastDeltaSyncAt: nowIso(),
        },
      }
      : await fetchMailboxRemoteState(account, syncState, {
        onTokenRefresh: async (tokenUpdate) => {
          updateConnectedAccountTokens(account.id, tokenUpdate);
        },
      });

    for (const deletedThreadId of remoteState.deletedThreadIds || []) {
      if (deleteMailboxThreadByExternalThreadId(userId, account.id, deletedThreadId)) {
        processedThreads += 1;
      }
    }

    for (const deletedMessageId of remoteState.deletedMessageIds || []) {
      if (deleteMessageByExternalId(userId, account.id, deletedMessageId)) {
        processedMessages += 1;
      }
    }

    for (const thread of remoteState.threads || []) {
      const result = upsertMailboxThread(userId, account, thread, source);
      processedThreads += 1;
      processedMessages += result.processedMessages;
    }

    for (const message of remoteState.upsertMessages || []) {
      upsertDeltaMessage(userId, account, message, source);
      processedThreads += 1;
      processedMessages += 1;
    }

    createSyncRun({
      userId,
      connectedAccountId: account.id,
      status: "completed",
      processedThreads,
      processedMessages,
    });

    upsertMailSyncState(account.id, {
      syncCursor: remoteState.syncStatePatch?.syncCursor,
      deltaLink: remoteState.syncStatePatch?.deltaLink,
      lastFullSyncAt: remoteState.mode === "full"
        ? (remoteState.syncStatePatch?.lastFullSyncAt || nowIso())
        : (syncState?.last_full_sync_at || ""),
      lastDeltaSyncAt: remoteState.syncStatePatch?.lastDeltaSyncAt || nowIso(),
      lastWebhookAt: options.webhookAt || syncState?.last_webhook_at || "",
    });

    if (source !== "demo") {
      const subscription = await ensureMailboxSubscription(account, webhookSubscription, {
        onTokenRefresh: async (tokenUpdate) => {
          updateConnectedAccountTokens(account.id, tokenUpdate);
        },
      });

      if (subscription) {
        upsertWebhookSubscription(account.id, subscription);
        if (subscription.syncCursor) {
          upsertMailSyncState(account.id, {
            syncCursor: subscription.syncCursor,
          });
        }
      }
    }

    return {
      processedThreads,
      processedMessages,
      source,
    };
  } catch (error) {
    createSyncRun({
      userId,
      connectedAccountId: account.id,
      status: "failed",
      processedThreads,
      processedMessages,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    if (source !== "demo") {
      upsertWebhookSubscription(account.id, {
        status: error?.name === "ProviderAuthError" ? "auth_error" : "error",
      });
    }

    throw error;
  }
}

export async function syncMailbox(userId, accountId = null, options = {}) {
  const accounts = accountId
    ? listConnectedAccounts(userId).filter((account) => account.id === accountId)
    : listConnectedAccounts(userId);

  let processedThreads = 0;
  let processedMessages = 0;

  for (const account of accounts) {
    const result = await syncAccountMailbox(userId, account, options);
    processedThreads += result.processedThreads;
    processedMessages += result.processedMessages;
  }

  const categorization = await categorizeMailbox(userId, accountId ? { accountId } : {});

  return {
    syncedAccounts: accounts.length,
    processedThreads,
    processedMessages,
    categorizedThreads: categorization.processedThreads,
  };
}

export async function maintainWebhookSubscriptions() {
  const accounts = db.prepare(`
    SELECT *
    FROM connected_accounts
    WHERE provider IN ('google', 'microsoft')
    ORDER BY created_at DESC
  `).all();

  let checkedAccounts = 0;
  let renewedSubscriptions = 0;
  let failedSubscriptions = 0;

  for (const account of accounts) {
    if (isDemoConnectedAccount(account)) {
      continue;
    }

    checkedAccounts += 1;
    const existingSubscription = getWebhookSubscription(account.id);

    try {
      const subscription = await ensureMailboxSubscription(account, existingSubscription, {
        onTokenRefresh: async (tokenUpdate) => {
          updateConnectedAccountTokens(account.id, tokenUpdate);
        },
      });

      if (!subscription) {
        continue;
      }

      upsertWebhookSubscription(account.id, subscription);
      if (subscription.syncCursor) {
        upsertMailSyncState(account.id, {
          syncCursor: subscription.syncCursor,
        });
      }
      renewedSubscriptions += 1;
    } catch (error) {
      failedSubscriptions += 1;
      upsertWebhookSubscription(account.id, {
        status: error?.name === "ProviderAuthError" ? "auth_error" : "error",
      });
    }
  }

  return {
    checkedAccounts,
    renewedSubscriptions,
    failedSubscriptions,
  };
}

export function listMailThreads(userId) {
  const rows = db.prepare(`
    SELECT
      mt.*,
      ca.email AS account_email,
      tc.topic_label,
      tc.inbox_action,
      tc.reason AS category_reason,
      tc.confidence,
      tc.updated_at AS categorized_at
    FROM mail_threads mt
    LEFT JOIN connected_accounts ca ON ca.id = mt.connected_account_id
    LEFT JOIN thread_classifications tc ON tc.thread_id = mt.id
    WHERE mt.user_id = ?
    ORDER BY mt.last_message_at DESC
  `).all(userId);

  return rows.map((thread) => {
    const eligibility = evaluateDraftEligibility(thread, thread);
    return {
      ...thread,
      draft_eligible: eligibility.eligible,
      draft_eligibility_reason: eligibility.reason,
    };
  });
}

function listThreadsForCategorization(userId, { accountId = null, threadId = null } = {}) {
  const filters = ["user_id = ?"];
  const params = [userId];

  if (accountId) {
    filters.push("connected_account_id = ?");
    params.push(accountId);
  }

  if (threadId) {
    filters.push("id = ?");
    params.push(threadId);
  }

  const query = `
    SELECT *
    FROM mail_threads
    WHERE ${filters.join(" AND ")}
    ORDER BY last_message_at DESC
  `;

  return db.prepare(query).all(...params);
}

export async function categorizeMailbox(userId, { accountId = null, threadId = null } = {}) {
  const threads = listThreadsForCategorization(userId, { accountId, threadId });
  const settings = getSetting("categorization", defaultCategorization);
  const counts = {};
  const topics = {};
  let updatedThreads = 0;
  const now = nowIso();
  const classifications = await classifyMailThreads(threads, settings);

  for (const thread of threads) {
    const classification = classifications.get(thread.id);
    if (!classification) {
      continue;
    }
    const existing = db.prepare("SELECT * FROM thread_classifications WHERE thread_id = ?").get(thread.id);

    db.prepare("UPDATE mail_threads SET category = ? WHERE id = ?").run(classification.category, thread.id);

    if (existing) {
      db.prepare(`
        UPDATE thread_classifications
        SET category = ?, topic_label = ?, inbox_action = ?, reason = ?, confidence = ?, updated_at = ?
        WHERE thread_id = ?
      `).run(
        classification.category,
        classification.topicLabel,
        classification.inboxAction,
        classification.reason,
        classification.confidence,
        now,
        thread.id,
      );
    } else {
      db.prepare(`
        INSERT INTO thread_classifications (
          thread_id, user_id, category, topic_label, inbox_action, reason, confidence, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        thread.id,
        userId,
        classification.category,
        classification.topicLabel,
        classification.inboxAction,
        classification.reason,
        classification.confidence,
        now,
      );
    }

    updatedThreads += 1;
    counts[classification.category] = (counts[classification.category] || 0) + 1;
    if (classification.topicLabel) {
      topics[classification.topicLabel] = (topics[classification.topicLabel] || 0) + 1;
    }
  }

  db.prepare(`
    INSERT INTO classification_runs (id, user_id, processed_threads, updated_threads, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(randomUUID(), userId, threads.length, updatedThreads, now);

  return {
    processedThreads: threads.length,
    updatedThreads,
    counts,
    topics,
    lastRunAt: now,
  };
}

export function listDraftRecords(userId) {
  return db.prepare(`
    SELECT dr.*, mt.subject AS thread_subject, mt.from_name, mt.from_email, ca.provider AS account_provider, ca.email AS account_email
    FROM draft_records dr
    JOIN mail_threads mt ON mt.id = dr.thread_id
    JOIN connected_accounts ca ON ca.id = dr.connected_account_id
    WHERE dr.user_id = ?
    ORDER BY dr.updated_at DESC
  `).all(userId);
}

function listThreadMessages(threadId) {
  return db.prepare(`
    SELECT *
    FROM mail_messages
    WHERE thread_id = ?
    ORDER BY datetime(created_at) ASC, id ASC
  `).all(threadId);
}

function trimPromptChunk(value = "", limit = 1200) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

function fallbackDraftContent(thread, account, preferences) {
  const signature = preferences.includeSignature && preferences.defaultSignature
    ? `\n\n${preferences.defaultSignature}`
    : "";

  return [
    `Ciao ${thread.from_name.split(" ")[0]},`,
    "",
    `grazie per il messaggio su "${thread.subject}". Ho ricevuto tutto e ti rispondo dal backend privato di MailMind.`,
    "Procedo con una proposta di risposta chiara e professionale, pronta per essere rifinita prima dell'invio.",
    "",
    "A presto,",
    account.display_name || account.email || "MailMind",
    signature,
  ].join("\n");
}

async function generateDraftContent(thread, account, preferences) {
  const fallback = fallbackDraftContent(thread, account, preferences);
  if (!hasGeminiCredentials()) {
    return fallback;
  }

  const messages = listThreadMessages(thread.id)
    .slice(-8)
    .map((message) => [
      `[${message.role} | ${message.sender_name || message.sender_email || "sconosciuto"} | ${message.created_at}]`,
      trimPromptChunk(message.content, 1400),
    ].join("\n"))
    .join("\n\n");

  const toneLabel = preferences.customTone && preferences.customToneText
    ? preferences.customToneText
    : "professionale, conciso e naturale";
  const signature = preferences.includeSignature && preferences.defaultSignature
    ? preferences.defaultSignature.trim()
    : "";

  const prompt = [
    "Scrivi il corpo di una email di risposta.",
    "Restituisci solo il testo finale dell'email, in plain text, senza markdown e senza subject.",
    "Non inventare fatti non presenti nel thread.",
    "Se mancano dettagli, usa una risposta prudente che confermi ricezione e proponga il passo successivo.",
    "Mantieni il tono richiesto.",
    signature ? "Non aggiungere la firma: verra appesa dal sistema." : "Chiudi con un saluto naturale.",
    "",
    `Tono richiesto: ${toneLabel}`,
    `Mittente account: ${account.display_name || account.email}`,
    `Subject thread: ${thread.subject}`,
    `Contatto principale: ${thread.from_name} <${thread.from_email}>`,
    "",
    "Conversazione:",
    messages || "(nessun messaggio disponibile)",
  ].join("\n");

  try {
    const response = await generateTextWithGemini({
      model: process.env.GEMINI_DRAFT_MODEL || process.env.GEMINI_MODEL || "gemini-2.0-flash",
      systemInstruction: "Sei un assistente email per professionisti italiani. Produci solo il corpo finale dell'email, senza spiegazioni.",
      prompt,
      temperature: 0.35,
      maxOutputTokens: 700,
    });

    const body = response.text.trim();
    if (!body) {
      return fallback;
    }

    return signature ? `${body}\n\n${signature}` : body;
  } catch {
    return fallback;
  }
}

function getDraftRecordById(userId, draftId) {
  return db.prepare("SELECT * FROM draft_records WHERE id = ? AND user_id = ?").get(draftId, userId);
}

function getThreadClassification(threadId) {
  return db.prepare("SELECT * FROM thread_classifications WHERE thread_id = ?").get(threadId) || null;
}

function getLatestReplyTargetMessage(threadId) {
  const latestIncoming = db.prepare(`
    SELECT *
    FROM mail_messages
    WHERE thread_id = ? AND role = 'incoming' AND external_message_id != ''
    ORDER BY datetime(created_at) DESC, id DESC
    LIMIT 1
  `).get(threadId);

  if (latestIncoming) {
    return latestIncoming;
  }

  return db.prepare(`
    SELECT *
    FROM mail_messages
    WHERE thread_id = ? AND external_message_id != ''
    ORDER BY datetime(created_at) DESC, id DESC
    LIMIT 1
  `).get(threadId);
}

function updateDraftProviderState(draftId, patch) {
  const existing = db.prepare("SELECT * FROM draft_records WHERE id = ?").get(draftId);
  if (!existing) {
    return null;
  }

  const next = {
    provider_draft_id: patch.providerDraftId ?? existing.provider_draft_id ?? "",
    provider_message_id: patch.providerMessageId ?? existing.provider_message_id ?? "",
    provider_push_status: patch.providerPushStatus ?? existing.provider_push_status ?? "local_only",
    provider_last_error: patch.providerLastError ?? existing.provider_last_error ?? "",
    provider_pushed_at: patch.providerPushedAt ?? existing.provider_pushed_at ?? "",
    updated_at: patch.updatedAt ?? nowIso(),
  };

  db.prepare(`
    UPDATE draft_records
    SET provider_draft_id = ?, provider_message_id = ?, provider_push_status = ?, provider_last_error = ?, provider_pushed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(
    next.provider_draft_id,
    next.provider_message_id,
    next.provider_push_status,
    next.provider_last_error,
    next.provider_pushed_at,
    next.updated_at,
    draftId,
  );

  return db.prepare("SELECT * FROM draft_records WHERE id = ?").get(draftId);
}

async function writeDraftToProvider(userId, draftId) {
  const draft = getDraftRecordById(userId, draftId);
  if (!draft) {
    return null;
  }

  const thread = db.prepare("SELECT * FROM mail_threads WHERE id = ? AND user_id = ?").get(draft.thread_id, userId);
  if (!thread) {
    return null;
  }

  const account = db.prepare("SELECT * FROM connected_accounts WHERE id = ? AND user_id = ?").get(draft.connected_account_id, userId);
  if (!account) {
    return null;
  }

  if (isDemoConnectedAccount(account)) {
    return updateDraftProviderState(draft.id, {
      providerPushStatus: "local_only",
      providerLastError: "",
      providerPushedAt: "",
    });
  }

  const replyTarget = getLatestReplyTargetMessage(thread.id);

  try {
    const result = await upsertProviderDraft(account, {
      providerDraftId: draft.provider_draft_id || "",
      providerMessageId: draft.provider_message_id || "",
      threadExternalId: thread.external_thread_id || "",
      replyToExternalMessageId: replyTarget?.external_message_id || "",
      replyToInternetMessageId: replyTarget?.internet_message_id || "",
      toEmail: thread.from_email || replyTarget?.sender_email || "",
      subject: draft.subject,
      content: draft.content,
    }, {
      onTokenRefresh: async (tokenUpdate) => {
        updateConnectedAccountTokens(account.id, tokenUpdate);
      },
    });

    return updateDraftProviderState(draft.id, {
      providerDraftId: result.providerDraftId,
      providerMessageId: result.providerMessageId,
      providerPushStatus: "synced",
      providerLastError: "",
      providerPushedAt: result.pushedAt || nowIso(),
    });
  } catch (error) {
    updateDraftProviderState(draft.id, {
      providerPushStatus: "push_failed",
      providerLastError: error instanceof Error ? error.message : String(error),
      providerPushedAt: draft.provider_pushed_at || "",
    });
    throw error;
  }
}

export async function createDraftForThread(userId, threadId, options = {}) {
  const thread = db.prepare("SELECT * FROM mail_threads WHERE id = ? AND user_id = ?").get(threadId, userId);
  if (!thread) {
    return null;
  }

  const account = db.prepare("SELECT * FROM connected_accounts WHERE id = ?").get(thread.connected_account_id);
  if (!account) {
    return null;
  }

  const classification = getThreadClassification(thread.id);
  const eligibility = evaluateDraftEligibility(thread, classification);
  if (!eligibility.eligible && options.force !== true) {
    const error = new Error(eligibility.reason);
    error.status = 400;
    throw error;
  }

  const preferences = getSetting("drafts", defaultDrafts);
  const existing = db.prepare("SELECT * FROM draft_records WHERE thread_id = ? AND user_id = ?").get(threadId, userId);
  const now = nowIso();
  const toneLabel = preferences.customTone && preferences.customToneText
    ? preferences.customToneText
    : "Tono professionale e conciso";
  const content = await generateDraftContent(thread, account, preferences);

  if (existing) {
    db.prepare(`
      UPDATE draft_records
      SET subject = ?, content = ?, tone = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(`Re: ${thread.subject}`, content, toneLabel, "generated", now, existing.id);
    const updated = db.prepare("SELECT * FROM draft_records WHERE id = ?").get(existing.id);
    if (options.pushToProvider === false) {
      return updated;
    }

    try {
      return await writeDraftToProvider(userId, updated.id);
    } catch {
      return db.prepare("SELECT * FROM draft_records WHERE id = ?").get(updated.id);
    }
  }

  const id = randomUUID();
  db.prepare(`
    INSERT INTO draft_records (
      id, user_id, connected_account_id, thread_id, subject, content, tone, status, provider_push_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    thread.connected_account_id,
    threadId,
    `Re: ${thread.subject}`,
    content,
    toneLabel,
    "generated",
    isDemoConnectedAccount(account) ? "local_only" : "pending",
    now,
    now,
  );

  const created = db.prepare("SELECT * FROM draft_records WHERE id = ?").get(id);
  if (options.pushToProvider === false) {
    return created;
  }

  try {
    return await writeDraftToProvider(userId, created.id);
  } catch {
    return db.prepare("SELECT * FROM draft_records WHERE id = ?").get(created.id);
  }
}

export async function pushDraftRecord(userId, draftId) {
  const draft = getDraftRecordById(userId, draftId);
  if (!draft) {
    return null;
  }

  return writeDraftToProvider(userId, draftId);
}

export async function deleteDraftRecord(userId, draftId, options = {}) {
  const draft = getDraftRecordById(userId, draftId);
  if (!draft) {
    return null;
  }

  const account = db.prepare("SELECT * FROM connected_accounts WHERE id = ? AND user_id = ?").get(draft.connected_account_id, userId);
  if (
    options.deleteProvider !== false
    && account
    && !isDemoConnectedAccount(account)
    && (draft.provider_draft_id || draft.provider_message_id)
  ) {
    try {
      await deleteProviderDraft(account, {
        providerDraftId: draft.provider_draft_id || "",
        providerMessageId: draft.provider_message_id || "",
      }, {
        onTokenRefresh: async (tokenUpdate) => {
          updateConnectedAccountTokens(account.id, tokenUpdate);
        },
      });
    } catch (error) {
      updateDraftProviderState(draft.id, {
        providerPushStatus: "push_failed",
        providerLastError: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  db.prepare("DELETE FROM draft_records WHERE id = ? AND user_id = ?").run(draftId, userId);
  return {
    id: draft.id,
    subject: draft.subject,
    providerDeleted: Boolean(draft.provider_draft_id || draft.provider_message_id),
  };
}

export async function generateDraftsForPendingThreads(userId, options = {}) {
  const threads = db.prepare(`
    SELECT * FROM mail_threads
    WHERE user_id = ? AND needs_reply = 1 AND category = 'todo'
    ORDER BY last_message_at DESC
  `).all(userId);

  const createdDrafts = [];
  for (const thread of threads) {
    const classification = getThreadClassification(thread.id);
    if (!evaluateDraftEligibility(thread, classification).eligible) {
      continue;
    }

    const draft = await createDraftForThread(userId, thread.id, options);
    if (draft) {
      createdDrafts.push(draft);
    }
  }
  return createdDrafts;
}
