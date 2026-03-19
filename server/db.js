import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { classifyMailThreads } from "./mailClassifier.js";
import { generateJsonWithGemini, generateTextWithGemini, hasGeminiCredentials } from "./gemini.js";
import {
  deletePostgresRecords,
  deletePostgresRecordsByColumnValues,
  isPostgresMirrorEnabled,
  isPostgresPrimaryEnabled,
  queryPostgres,
  queuePostgresMirror,
  upsertPostgresRecord,
  withPostgresTransaction,
} from "./postgres.js";
import { deleteStoredObject, putStoredObject } from "./storage.js";
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
    capabilities_json TEXT NOT NULL DEFAULT '[]',
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
    attendees_json TEXT NOT NULL DEFAULT '[]',
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
    participants_json TEXT NOT NULL DEFAULT '[]',
    share_status TEXT DEFAULT '',
    shared_at TEXT DEFAULT '',
    shared_recipients_json TEXT NOT NULL DEFAULT '[]',
    error_message TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS meeting_session_chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
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
ensureColumn("connected_accounts", "capabilities_json", "TEXT NOT NULL DEFAULT '[]'");
ensureColumn("calendar_events", "attendees_json", "TEXT NOT NULL DEFAULT '[]'");
ensureColumn("meeting_sessions", "participants_json", "TEXT NOT NULL DEFAULT '[]'");
ensureColumn("meeting_sessions", "share_status", "TEXT DEFAULT ''");
ensureColumn("meeting_sessions", "shared_at", "TEXT DEFAULT ''");
ensureColumn("meeting_sessions", "shared_recipients_json", "TEXT NOT NULL DEFAULT '[]'");

db.exec(`
  CREATE TABLE IF NOT EXISTS meeting_session_chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

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
  draftVariants: 3,
  enableFollowUps: true,
  followUpDays: 3,
  customTone: false,
  customToneText: "",
  fontFamily: "Gmail/Outlook default",
  fontSize: 0,
  fontColor: "#111111",
  includeSignature: true,
  defaultSignature: "",
  schedulingSignature: "",
  includeSchedulingLink: false,
  showThreadingGmail: false,
  showThreadingOutlook: false,
};

const defaultEmailRules = [];
const CATEGORY_OPTIONS = new Set(["todo", "fyi", "notification", "marketing", "followUp"]);
const INBOX_ACTION_OPTIONS = new Set(["keep_default", "keep_inbox", "move_out"]);

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
  customWords: [],
  autoShareRecaps: false,
  shareWithOrganizer: true,
  autoShareRecipients: [],
  recapTemplate: "standard",
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
  planName: "STARTER",
  badge: "7 giorni gratis",
  price: "EUR20",
  cadence: "mese",
  teamSize: "1 seat",
  nextPayment: "-",
  billingInterval: "Mensile",
  cardMasked: "**** **** **** ****",
  monthlyPrice: "EUR20",
  annualPrice: "EUR192",
  professionalMonthlyPrice: "EUR40",
  professionalAnnualPrice: "EUR384",
  trialDays: 7,
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

function queuePostgresUpsert(label, tableName, record, conflictColumns = ["id"]) {
  if (!record) {
    return;
  }

  queuePostgresMirror(label, (postgres) => upsertPostgresRecord(postgres, tableName, record, conflictColumns));
}

function queuePostgresDelete(label, tableName, filters = {}) {
  queuePostgresMirror(label, (postgres) => deletePostgresRecords(postgres, tableName, filters));
}

async function queryPostgresRow(sql, values = []) {
  const result = await queryPostgres(sql, values);
  return result.rows[0] || null;
}

async function queryPostgresRows(sql, values = []) {
  const result = await queryPostgres(sql, values);
  return result.rows;
}

async function upsertPostgresNow(tableName, record, conflictColumns = ["id"]) {
  if (!record) {
    return;
  }

  await withPostgresTransaction(async (postgres) => {
    await upsertPostgresRecord(postgres, tableName, record, conflictColumns);
  });
}

function postgresPrimaryEnabled() {
  return isPostgresPrimaryEnabled();
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
  }

  if (typeof value === "string") {
    return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
  }

  return [];
}

function normalizeAccountCapabilities(value) {
  return [...new Set(normalizeStringArray(value).map((item) => item.toLowerCase()))];
}

function accountCapabilities(account) {
  const explicit = normalizeAccountCapabilities(safeJsonParse(account?.capabilities_json || "[]", []));
  if (explicit.length > 0) {
    return explicit;
  }

  if (account?.provider === "google" || account?.provider === "microsoft") {
    return ["mail", "calendar"];
  }

  if (account?.provider === "zoom") {
    return ["meetings"];
  }

  return [];
}

function normalizeEmailRule(rule = {}, index = 0) {
  const category = CATEGORY_OPTIONS.has(rule.category) ? rule.category : "todo";
  const inboxAction = INBOX_ACTION_OPTIONS.has(rule.inboxAction) ? rule.inboxAction : "keep_default";

  return {
    id: String(rule.id || `rule-${index + 1}`).trim() || `rule-${index + 1}`,
    name: String(rule.name || "").trim() || `Regola ${index + 1}`,
    enabled: rule.enabled !== false,
    match: rule.match === "all" ? "all" : "any",
    senders: normalizeStringArray(rule.senders),
    domains: normalizeStringArray(rule.domains).map((item) => item.replace(/^@+/, "").toLowerCase()),
    keywords: normalizeStringArray(rule.keywords),
    category,
    inboxAction,
  };
}

function normalizeEmailRules(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((rule, index) => normalizeEmailRule(rule, index));
}

function normalizeCategoryOverrides(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([threadId, override]) => {
        if (!override || typeof override !== "object") {
          return null;
        }

        const category = CATEGORY_OPTIONS.has(override.category) ? override.category : "";
        if (!category) {
          return null;
        }

        const inboxAction = INBOX_ACTION_OPTIONS.has(override.inboxAction)
          ? override.inboxAction
          : "keep_default";

        return [threadId, {
          category,
          inboxAction,
          reason: String(override.reason || "Classificazione aggiornata manualmente.").trim(),
          updatedAt: String(override.updatedAt || nowIso()).trim(),
        }];
      })
      .filter(Boolean),
  );
}

function threadMatchesEmailRule(thread, rule) {
  const checks = [];
  const fromEmail = String(thread.from_email || "").toLowerCase();
  const searchableText = [thread.subject, thread.snippet, thread.from_name, thread.from_email]
    .map((item) => String(item || "").toLowerCase())
    .join(" ");

  if (rule.senders.length > 0) {
    checks.push(rule.senders.some((sender) => fromEmail === sender.toLowerCase()));
  }

  if (rule.domains.length > 0) {
    checks.push(rule.domains.some((domain) => fromEmail.endsWith(`@${domain}`)));
  }

  if (rule.keywords.length > 0) {
    checks.push(rule.keywords.some((keyword) => searchableText.includes(keyword.toLowerCase())));
  }

  if (checks.length === 0) {
    return false;
  }

  return rule.match === "all" ? checks.every(Boolean) : checks.some(Boolean);
}

function applyEmailRulesToClassification(thread, classification, rules = []) {
  for (const rule of rules) {
    if (!rule.enabled || !threadMatchesEmailRule(thread, rule)) {
      continue;
    }

    return {
      ...classification,
      category: rule.category,
      inboxAction: rule.inboxAction || classification.inboxAction,
      reason: `Regola inbox "${rule.name}" applicata automaticamente.`,
      confidence: 0.99,
      matchedRuleId: rule.id,
      matchedRuleName: rule.name,
    };
  }

  return classification;
}

function applyManualOverrideToClassification(threadId, classification, overrides = {}) {
  const override = overrides[threadId];
  if (!override) {
    return classification;
  }

  return {
    ...classification,
    category: override.category,
    inboxAction: override.inboxAction || classification.inboxAction,
    reason: override.reason || "Classificazione aggiornata manualmente.",
    confidence: 1,
    manualOverride: true,
  };
}

function applyThreadClassificationPolicies(thread, classification, emailRules = [], categoryOverrides = {}) {
  const ruled = applyEmailRulesToClassification(thread, classification, emailRules);
  return applyManualOverrideToClassification(thread.id, ruled, categoryOverrides);
}

function listSqliteRowsByValues(tableName, columnName, values = []) {
  const filteredValues = values.filter((value) => value !== undefined && value !== null && value !== "");
  if (filteredValues.length === 0) {
    return [];
  }

  const placeholders = filteredValues.map(() => "?").join(", ");
  return db.prepare(`
    SELECT *
    FROM ${tableName}
    WHERE ${columnName} IN (${placeholders})
  `).all(...filteredValues);
}

function queueCorePostgresSnapshot() {
  if (!isPostgresMirrorEnabled() && !postgresPrimaryEnabled()) {
    return;
  }

  const snapshots = [
    { tableName: "users", rows: db.prepare("SELECT * FROM users").all(), conflictColumns: ["id"] },
    { tableName: "workspaces", rows: db.prepare("SELECT * FROM workspaces").all(), conflictColumns: ["id"] },
    { tableName: "workspace_members", rows: db.prepare("SELECT * FROM workspace_members").all(), conflictColumns: ["id"] },
    { tableName: "sessions", rows: db.prepare("SELECT * FROM sessions").all(), conflictColumns: ["id"] },
    { tableName: "teams", rows: db.prepare("SELECT * FROM teams").all(), conflictColumns: ["id"] },
    { tableName: "team_members", rows: db.prepare("SELECT * FROM team_members").all(), conflictColumns: ["id"] },
    { tableName: "invites", rows: db.prepare("SELECT * FROM invites").all(), conflictColumns: ["id"] },
    { tableName: "connected_accounts", rows: db.prepare("SELECT * FROM connected_accounts").all(), conflictColumns: ["id"] },
    { tableName: "mail_sync_state", rows: db.prepare("SELECT * FROM mail_sync_state").all(), conflictColumns: ["connected_account_id"] },
    { tableName: "webhook_subscriptions", rows: db.prepare("SELECT * FROM webhook_subscriptions").all(), conflictColumns: ["connected_account_id"] },
    { tableName: "oauth_states", rows: db.prepare("SELECT * FROM oauth_states").all(), conflictColumns: ["state"] },
    { tableName: "settings", rows: db.prepare("SELECT * FROM settings").all(), conflictColumns: ["key"] },
    { tableName: "notifications", rows: db.prepare("SELECT * FROM notifications").all(), conflictColumns: ["id"] },
    { tableName: "audit_logs", rows: db.prepare("SELECT * FROM audit_logs").all(), conflictColumns: ["id"] },
  ];

  queuePostgresMirror("startup.core_snapshot", async (postgres) => {
    for (const snapshot of snapshots) {
      for (const row of snapshot.rows) {
        await upsertPostgresRecord(postgres, snapshot.tableName, row, snapshot.conflictColumns);
      }
    }
  });
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
    const updatedAt = nowIso();
    db.prepare("INSERT INTO settings (key, json_value, updated_at) VALUES (?, ?, ?)")
      .run(key, JSON.stringify(value), updatedAt);
    queuePostgresUpsert("settings.seed", "settings", {
      key,
      json_value: JSON.stringify(value),
      updated_at: updatedAt,
    }, ["key"]);
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
    queuePostgresUpsert("users.seed", "users", user, ["id"]);
  }

  let workspace = db.prepare("SELECT * FROM workspaces WHERE owner_user_id = ?").get(user.id);
  if (!workspace) {
    const workspaceId = randomUUID();
    db.prepare("INSERT INTO workspaces (id, owner_user_id, name, email_domain, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(workspaceId, user.id, defaultOrganization.orgName, defaultOrganization.orgDomain, "personal", now, now);
    db.prepare("INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(randomUUID(), workspaceId, user.id, "owner", now);
    workspace = db.prepare("SELECT * FROM workspaces WHERE id = ?").get(workspaceId);
    const workspaceMember = db.prepare("SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?").get(workspaceId, user.id);
    queuePostgresMirror("workspaces.seed", async (postgres) => {
      await upsertPostgresRecord(postgres, "workspaces", workspace, ["id"]);
      await upsertPostgresRecord(postgres, "workspace_members", workspaceMember, ["id"]);
    });
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
      const notificationId = randomUUID();
      insert.run(notificationId, user.id, item.title, item.body, item.link, "", now);
      queuePostgresUpsert("notifications.seed", "notifications", {
        id: notificationId,
        user_id: user.id,
        title: item.title,
        body: item.body,
        link: item.link,
        read_at: "",
        created_at: now,
      }, ["id"]);
    }
  }
}

ensureDefaultData();
queueCorePostgresSnapshot();

export function listNotifications(userId) {
  return db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC").all(userId);
}

function createNotification(userId, { title, body, link = "" }) {
  const id = randomUUID();
  const row = {
    id,
    user_id: userId,
    title: String(title || "").trim(),
    body: String(body || "").trim(),
    link: String(link || "").trim(),
    read_at: "",
    created_at: nowIso(),
  };
  db.prepare(
    "INSERT INTO notifications (id, user_id, title, body, link, read_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(row.id, row.user_id, row.title, row.body, row.link, row.read_at, row.created_at);
  queuePostgresUpsert("notifications.create", "notifications", row, ["id"]);
  return row;
}

export async function createNotificationRuntime(userId, payload) {
  const row = createNotification(userId, payload);
  if (!postgresPrimaryEnabled()) {
    return row;
  }

  try {
    await upsertPostgresNow("notifications", row, ["id"]);
  } catch {
    return row;
  }

  return row;
}

export async function listNotificationsRuntime(userId) {
  if (!postgresPrimaryEnabled()) {
    return listNotifications(userId);
  }

  try {
    return await queryPostgresRows(
      "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC",
      [userId],
    );
  } catch {
    return listNotifications(userId);
  }
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

function buildScopedSettingKey(scope, key) {
  const normalizedScope = String(scope || "").trim();
  const normalizedKey = String(key || "").trim();

  if (!normalizedScope || !normalizedKey) {
    throw new Error("Setting scope and key are required");
  }

  return `workspace:${normalizedScope}:${normalizedKey}`;
}

export function setSetting(key, value) {
  const now = nowIso();
  const jsonValue = JSON.stringify(value);
  db.prepare(`
    INSERT INTO settings (key, json_value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET json_value = excluded.json_value, updated_at = excluded.updated_at
  `).run(key, jsonValue, now);
  queuePostgresUpsert("settings.upsert", "settings", {
    key,
    json_value: jsonValue,
    updated_at: now,
  }, ["key"]);
  return value;
}

export function createSession(userId) {
  const id = randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);
  db.prepare("INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .run(id, userId, expires.toISOString(), now.toISOString());
  queuePostgresUpsert("sessions.create", "sessions", {
    id,
    user_id: userId,
    expires_at: expires.toISOString(),
    created_at: now.toISOString(),
  }, ["id"]);
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
    queuePostgresDelete("sessions.expire", "sessions", { id: sessionId });
    return null;
  }
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(session.user_id);
  const workspace = db.prepare("SELECT * FROM workspaces WHERE owner_user_id = ?").get(user.id);
  return { session, user, workspace };
}

export function deleteSession(sessionId) {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  queuePostgresDelete("sessions.delete", "sessions", { id: sessionId });
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
  const row = db.prepare("SELECT * FROM audit_logs WHERE id = ?").get(id);
  queuePostgresUpsert("audit_logs.create", "audit_logs", row, ["id"]);

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

async function findCalendarEventByIdRuntime(userId, calendarEventId) {
  if (!calendarEventId) {
    return null;
  }

  if (!postgresPrimaryEnabled()) {
    return findCalendarEventById(userId, calendarEventId);
  }

  try {
    const row = await queryPostgresRow(`
      SELECT ce.*, ca.email AS account_email, ca.display_name AS account_display_name
      FROM calendar_events ce
      LEFT JOIN connected_accounts ca ON ca.id = ce.connected_account_id
      WHERE ce.user_id = $1 AND ce.id = $2
    `, [userId, calendarEventId]);
    return row || findCalendarEventById(userId, calendarEventId);
  } catch {
    return findCalendarEventById(userId, calendarEventId);
  }
}

export function listMailSyncStates(userId) {
  return db.prepare("SELECT * FROM mail_sync_state WHERE user_id = ? ORDER BY updated_at DESC").all(userId);
}

export async function listMailSyncStatesRuntime(userId) {
  if (!postgresPrimaryEnabled()) {
    return listMailSyncStates(userId);
  }

  try {
    return await queryPostgresRows(
      "SELECT * FROM mail_sync_state WHERE user_id = $1 ORDER BY updated_at DESC",
      [userId],
    );
  } catch {
    return listMailSyncStates(userId);
  }
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

export async function listWebhookSubscriptionsRuntime(userId) {
  if (!postgresPrimaryEnabled()) {
    return listWebhookSubscriptions(userId);
  }

  try {
    return await queryPostgresRows(`
      SELECT ws.*
      FROM webhook_subscriptions ws
      JOIN connected_accounts ca ON ca.id = ws.connected_account_id
      WHERE ca.user_id = $1
      ORDER BY ws.updated_at DESC
    `, [userId]);
  } catch {
    return listWebhookSubscriptions(userId);
  }
}

export function listSyncRuns(userId) {
  return db.prepare(`
    SELECT *
    FROM sync_runs
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId);
}

export async function listSyncRunsRuntime(userId) {
  if (!postgresPrimaryEnabled()) {
    return listSyncRuns(userId);
  }

  try {
    return await queryPostgresRows(`
      SELECT *
      FROM sync_runs
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [userId]);
  } catch {
    return listSyncRuns(userId);
  }
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
  capabilities = [],
}) {
  const existing = db.prepare(
    "SELECT * FROM connected_accounts WHERE user_id = ? AND provider = ? AND email = ?",
  ).get(userId, provider, email);

  const now = nowIso();
  const normalizedCapabilities = normalizeAccountCapabilities(capabilities);

  if (existing) {
    const mergedCapabilities = [...new Set([
      ...normalizeAccountCapabilities(safeJsonParse(existing.capabilities_json || "[]", [])),
      ...normalizedCapabilities,
    ])];
    db.prepare(`
      UPDATE connected_accounts
      SET display_name = ?, external_account_id = ?, encrypted_access_token = ?, encrypted_refresh_token = ?, expires_at = ?, capabilities_json = ?, updated_at = ?
      WHERE id = ?
    `).run(displayName, externalAccountId, encryptedAccessToken, encryptedRefreshToken, expiresAt, JSON.stringify(mergedCapabilities), now, existing.id);
    const row = db.prepare("SELECT * FROM connected_accounts WHERE id = ?").get(existing.id);
    queuePostgresUpsert("connected_accounts.update", "connected_accounts", row, ["id"]);
    return row;
  }

  const id = randomUUID();
  db.prepare(`
    INSERT INTO connected_accounts (
      id, workspace_id, user_id, provider, email, display_name, external_account_id,
      encrypted_access_token, encrypted_refresh_token, expires_at, capabilities_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    JSON.stringify(normalizedCapabilities),
    now,
    now,
  );
  const row = db.prepare("SELECT * FROM connected_accounts WHERE id = ?").get(id);
  queuePostgresUpsert("connected_accounts.create", "connected_accounts", row, ["id"]);
  return row;
}

export function updateConnectedAccountTokens(accountId, { encryptedAccessToken, encryptedRefreshToken, expiresAt }) {
  db.prepare(`
    UPDATE connected_accounts
    SET encrypted_access_token = ?, encrypted_refresh_token = ?, expires_at = ?, updated_at = ?
    WHERE id = ?
  `).run(encryptedAccessToken, encryptedRefreshToken, expiresAt || "", nowIso(), accountId);

  const row = db.prepare("SELECT * FROM connected_accounts WHERE id = ?").get(accountId);
  queuePostgresUpsert("connected_accounts.tokens", "connected_accounts", row, ["id"]);
  return row;
}

export async function updateConnectedAccountTokensRuntime(accountId, patch) {
  if (!postgresPrimaryEnabled()) {
    return updateConnectedAccountTokens(accountId, patch);
  }

  try {
    const existing = await queryPostgresRow("SELECT * FROM connected_accounts WHERE id = $1", [accountId]);
    if (!existing) {
      return updateConnectedAccountTokens(accountId, patch);
    }

    const row = {
      ...existing,
      encrypted_access_token: patch.encryptedAccessToken ?? existing.encrypted_access_token ?? "",
      encrypted_refresh_token: patch.encryptedRefreshToken ?? existing.encrypted_refresh_token ?? "",
      expires_at: patch.expiresAt ?? existing.expires_at ?? "",
      updated_at: nowIso(),
    };
    await upsertPostgresNow("connected_accounts", row, ["id"]);
    return row;
  } catch {
    return updateConnectedAccountTokens(accountId, patch);
  }
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

async function createSyncRunRuntime({
  userId,
  connectedAccountId,
  status,
  processedThreads = 0,
  processedMessages = 0,
  errorMessage = "",
}) {
  if (!postgresPrimaryEnabled()) {
    createSyncRun({
      userId,
      connectedAccountId,
      status,
      processedThreads,
      processedMessages,
      errorMessage,
    });
    return;
  }

  try {
    await upsertPostgresNow("sync_runs", {
      id: randomUUID(),
      user_id: userId,
      connected_account_id: connectedAccountId,
      status,
      processed_threads: processedThreads,
      processed_messages: processedMessages,
      error_message: errorMessage,
      created_at: nowIso(),
    }, ["id"]);
  } catch {
    createSyncRun({
      userId,
      connectedAccountId,
      status,
      processedThreads,
      processedMessages,
      errorMessage,
    });
  }
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

export async function findConnectedAccountByWebhookSubscriptionIdRuntime(provider, externalSubscriptionId) {
  if (!postgresPrimaryEnabled()) {
    return findConnectedAccountByWebhookSubscriptionId(provider, externalSubscriptionId);
  }

  try {
    const row = await queryPostgresRow(`
      SELECT ca.*
      FROM webhook_subscriptions ws
      JOIN connected_accounts ca ON ca.id = ws.connected_account_id
      WHERE ws.provider = $1 AND ws.external_subscription_id = $2
      LIMIT 1
    `, [provider, externalSubscriptionId]);
    return row || findConnectedAccountByWebhookSubscriptionId(provider, externalSubscriptionId);
  } catch {
    return findConnectedAccountByWebhookSubscriptionId(provider, externalSubscriptionId);
  }
}

export function getMailSyncState(accountId) {
  return db.prepare("SELECT * FROM mail_sync_state WHERE connected_account_id = ?").get(accountId);
}

export async function getMailSyncStateRuntime(accountId) {
  if (!postgresPrimaryEnabled()) {
    return getMailSyncState(accountId);
  }

  try {
    const row = await queryPostgresRow(
      "SELECT * FROM mail_sync_state WHERE connected_account_id = $1",
      [accountId],
    );
    return row || getMailSyncState(accountId);
  } catch {
    return getMailSyncState(accountId);
  }
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

  const row = getMailSyncState(accountId);
  queuePostgresUpsert("mail_sync_state.upsert", "mail_sync_state", row, ["connected_account_id"]);
  return row;
}

export async function upsertMailSyncStateRuntime(accountId, patch) {
  if (!postgresPrimaryEnabled()) {
    return upsertMailSyncState(accountId, patch);
  }

  try {
    const account = await findConnectedAccountByIdRuntime(accountId);
    if (!account) {
      return upsertMailSyncState(accountId, patch);
    }

    const existing = await queryPostgresRow(
      "SELECT * FROM mail_sync_state WHERE connected_account_id = $1",
      [accountId],
    );
    const row = {
      connected_account_id: accountId,
      user_id: account.user_id,
      provider: account.provider,
      sync_cursor: patch.syncCursor ?? existing?.sync_cursor ?? "",
      delta_link: patch.deltaLink ?? existing?.delta_link ?? "",
      last_full_sync_at: patch.lastFullSyncAt ?? existing?.last_full_sync_at ?? "",
      last_delta_sync_at: patch.lastDeltaSyncAt ?? existing?.last_delta_sync_at ?? "",
      last_webhook_at: patch.lastWebhookAt ?? existing?.last_webhook_at ?? "",
      updated_at: nowIso(),
    };
    await upsertPostgresNow("mail_sync_state", row, ["connected_account_id"]);
    return row;
  } catch {
    return upsertMailSyncState(accountId, patch);
  }
}

export function getWebhookSubscription(accountId) {
  return db.prepare("SELECT * FROM webhook_subscriptions WHERE connected_account_id = ?").get(accountId);
}

export async function getWebhookSubscriptionRuntime(accountId) {
  if (!postgresPrimaryEnabled()) {
    return getWebhookSubscription(accountId);
  }

  try {
    const row = await queryPostgresRow(
      "SELECT * FROM webhook_subscriptions WHERE connected_account_id = $1",
      [accountId],
    );
    return row || getWebhookSubscription(accountId);
  } catch {
    return getWebhookSubscription(accountId);
  }
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

  const row = getWebhookSubscription(accountId);
  queuePostgresUpsert("webhook_subscriptions.upsert", "webhook_subscriptions", row, ["connected_account_id"]);
  return row;
}

export async function upsertWebhookSubscriptionRuntime(accountId, patch) {
  if (!postgresPrimaryEnabled()) {
    return upsertWebhookSubscription(accountId, patch);
  }

  try {
    const account = await findConnectedAccountByIdRuntime(accountId);
    if (!account) {
      return upsertWebhookSubscription(accountId, patch);
    }

    const existing = await queryPostgresRow(
      "SELECT * FROM webhook_subscriptions WHERE connected_account_id = $1",
      [accountId],
    );
    const now = nowIso();
    const row = {
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
    await upsertPostgresNow("webhook_subscriptions", row, ["connected_account_id"]);
    return row;
  } catch {
    return upsertWebhookSubscription(accountId, patch);
  }
}

export function deleteConnectedAccount(userId, accountId) {
  const existing = db.prepare("SELECT id FROM connected_accounts WHERE id = ? AND user_id = ?").get(accountId, userId);
  if (!existing) {
    return false;
  }

  const threadIds = db.prepare("SELECT id FROM mail_threads WHERE user_id = ? AND connected_account_id = ?").all(userId, accountId)
    .map((row) => row.id);

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
    queuePostgresMirror("connected_accounts.delete", async (postgres) => {
      await deletePostgresRecords(postgres, "draft_records", { user_id: userId, connected_account_id: accountId });
      await deletePostgresRecords(postgres, "meeting_sessions", { user_id: userId, connected_account_id: accountId });
      await deletePostgresRecords(postgres, "calendar_events", { user_id: userId, connected_account_id: accountId });
      await deletePostgresRecordsByColumnValues(postgres, "thread_classifications", "thread_id", threadIds);
      await deletePostgresRecordsByColumnValues(postgres, "mail_messages", "thread_id", threadIds);
      await deletePostgresRecords(postgres, "mail_threads", { user_id: userId, connected_account_id: accountId });
      await deletePostgresRecords(postgres, "sync_runs", { user_id: userId, connected_account_id: accountId });
      await deletePostgresRecords(postgres, "mail_sync_state", { connected_account_id: accountId });
      await deletePostgresRecords(postgres, "webhook_subscriptions", { connected_account_id: accountId });
      await deletePostgresRecords(postgres, "connected_accounts", { id: accountId, user_id: userId });
    });
    return true;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function createOauthState({ workspaceId, userId, provider, redirectUri, state, expiresAt }) {
  const createdAt = nowIso();
  db.prepare(`
    INSERT INTO oauth_states (state, workspace_id, user_id, provider, redirect_uri, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(state, workspaceId, userId, provider, redirectUri, expiresAt, createdAt);
  queuePostgresUpsert("oauth_states.create", "oauth_states", {
    state,
    workspace_id: workspaceId,
    user_id: userId,
    provider,
    redirect_uri: redirectUri,
    expires_at: expiresAt,
    created_at: createdAt,
  }, ["state"]);
}

export function consumeOauthState(state, provider) {
  const row = db.prepare("SELECT * FROM oauth_states WHERE state = ? AND provider = ?").get(state, provider);
  if (!row) {
    return null;
  }
  db.prepare("DELETE FROM oauth_states WHERE state = ?").run(state);
  queuePostgresDelete("oauth_states.consume", "oauth_states", { state });
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
  const updatedWorkspace = db.prepare("SELECT * FROM workspaces WHERE id = ?").get(workspace.id);
  queuePostgresUpsert("workspaces.update", "workspaces", updatedWorkspace, ["id"]);
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
  const row = db.prepare("SELECT * FROM teams WHERE id = ?").get(id);
  queuePostgresUpsert("teams.create", "teams", row, ["id"]);
  return row;
}

export function listInvites(workspaceId) {
  return db.prepare("SELECT * FROM invites WHERE workspace_id = ? ORDER BY created_at DESC").all(workspaceId);
}

export function createInvite(workspaceId, email, role = "member") {
  const id = randomUUID();
  db.prepare("INSERT INTO invites (id, workspace_id, email, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, workspaceId, email, role, "pending", nowIso());
  const row = db.prepare("SELECT * FROM invites WHERE id = ?").get(id);
  queuePostgresUpsert("invites.create", "invites", row, ["id"]);
  return row;
}

export async function getOrCreateDevUserRuntime() {
  const local = getOrCreateDevUser();
  if (!postgresPrimaryEnabled()) {
    return local;
  }

  try {
    let user = await queryPostgresRow("SELECT * FROM users WHERE email = $1", [local.user.email]);
    let workspace = user
      ? await queryPostgresRow("SELECT * FROM workspaces WHERE owner_user_id = $1", [user.id])
      : null;

    if (!user || !workspace) {
      const workspaceMember = db.prepare("SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
        .get(local.workspace.id, local.user.id);
      const organizationSetting = db.prepare("SELECT * FROM settings WHERE key = ?").get("organization");

      await withPostgresTransaction(async (postgres) => {
        await upsertPostgresRecord(postgres, "users", local.user, ["id"]);
        await upsertPostgresRecord(postgres, "workspaces", local.workspace, ["id"]);
        if (workspaceMember) {
          await upsertPostgresRecord(postgres, "workspace_members", workspaceMember, ["id"]);
        }
        if (organizationSetting) {
          await upsertPostgresRecord(postgres, "settings", organizationSetting, ["key"]);
        }
      });

      user = local.user;
      workspace = local.workspace;
    }

    return {
      user: user || local.user,
      workspace: workspace || local.workspace,
    };
  } catch {
    return local;
  }
}

export async function getSettingRuntime(key, fallback = null) {
  if (!postgresPrimaryEnabled()) {
    return getSetting(key, fallback);
  }

  try {
    const row = await queryPostgresRow("SELECT json_value FROM settings WHERE key = $1", [key]);
    if (!row) {
      return fallback;
    }
    return safeJsonParse(row.json_value, fallback);
  } catch {
    return getSetting(key, fallback);
  }
}

export async function getScopedSettingRuntime(scope, key, fallback = null) {
  const scopedKey = buildScopedSettingKey(scope, key);
  const missing = Symbol("missing_setting");
  const scopedValue = await getSettingRuntime(scopedKey, missing);
  if (scopedValue !== missing) {
    return scopedValue;
  }

  return getSettingRuntime(key, fallback);
}

export async function setSettingRuntime(key, value) {
  const next = setSetting(key, value);
  if (!postgresPrimaryEnabled()) {
    return next;
  }

  const row = db.prepare("SELECT * FROM settings WHERE key = ?").get(key);
  try {
    await upsertPostgresNow("settings", row, ["key"]);
  } catch {
    return next;
  }

  return next;
}

export async function setScopedSettingRuntime(scope, key, value) {
  return setSettingRuntime(buildScopedSettingKey(scope, key), value);
}

export async function listEmailRulesRuntime(scope) {
  const rules = await getScopedSettingRuntime(scope, "email-rules", defaultEmailRules);
  return normalizeEmailRules(rules);
}

export async function setEmailRulesRuntime(scope, rules) {
  const normalized = normalizeEmailRules(rules);
  await setScopedSettingRuntime(scope, "email-rules", normalized);
  return normalized;
}

async function listThreadCategoryOverridesRuntime(scope) {
  const overrides = await getScopedSettingRuntime(scope, "thread-category-overrides", {});
  return normalizeCategoryOverrides(overrides);
}

function findMailThread(userId, threadId) {
  return db.prepare("SELECT * FROM mail_threads WHERE id = ? AND user_id = ?").get(threadId, userId) || null;
}

async function findMailThreadRuntime(userId, threadId) {
  if (!postgresPrimaryEnabled()) {
    return findMailThread(userId, threadId);
  }

  try {
    const row = await queryPostgresRow(
      "SELECT * FROM mail_threads WHERE id = $1 AND user_id = $2",
      [threadId, userId],
    );
    return row || findMailThread(userId, threadId);
  } catch {
    return findMailThread(userId, threadId);
  }
}

export async function setThreadCategoryOverrideRuntime(userId, scope, threadId, patch = {}) {
  const thread = await findMailThreadRuntime(userId, threadId);
  if (!thread) {
    return null;
  }

  const overrides = await listThreadCategoryOverridesRuntime(scope);
  if (patch.clearOverride) {
    delete overrides[threadId];
    await setScopedSettingRuntime(scope, "thread-category-overrides", overrides);
    return { cleared: true };
  }

  const category = CATEGORY_OPTIONS.has(patch.category) ? patch.category : "";
  if (!category) {
    const error = new Error("Unsupported category");
    error.status = 400;
    throw error;
  }

  overrides[threadId] = {
    category,
    inboxAction: INBOX_ACTION_OPTIONS.has(patch.inboxAction) ? patch.inboxAction : "keep_default",
    reason: String(patch.reason || `Classificazione aggiornata manualmente in ${category}.`).trim(),
    updatedAt: nowIso(),
  };

  await setScopedSettingRuntime(scope, "thread-category-overrides", overrides);

  const existingClassification = await getThreadClassificationRuntime(threadId);
  const nextReason = overrides[threadId].reason;
  const nextInboxAction = overrides[threadId].inboxAction || existingClassification?.inbox_action || "keep_default";
  const nextTopicLabel = existingClassification?.topic_label || "";
  const nextUpdatedAt = overrides[threadId].updatedAt;

  db.prepare("UPDATE mail_threads SET category = ? WHERE id = ?").run(category, threadId);
  db.prepare(`
    INSERT INTO thread_classifications (thread_id, user_id, category, topic_label, inbox_action, reason, confidence, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(thread_id) DO UPDATE SET
      category = excluded.category,
      topic_label = excluded.topic_label,
      inbox_action = excluded.inbox_action,
      reason = excluded.reason,
      confidence = excluded.confidence,
      updated_at = excluded.updated_at
  `).run(threadId, userId, category, nextTopicLabel, nextInboxAction, nextReason, 1, nextUpdatedAt);

  if (postgresPrimaryEnabled()) {
    try {
      await withPostgresTransaction(async (postgres) => {
        await postgres.query("UPDATE mail_threads SET category = $1 WHERE id = $2", [category, threadId]);
        await upsertPostgresRecord(postgres, "thread_classifications", {
          thread_id: threadId,
          user_id: userId,
          category,
          topic_label: nextTopicLabel,
          inbox_action: nextInboxAction,
          reason: nextReason,
          confidence: 1,
          updated_at: nextUpdatedAt,
        }, ["thread_id"]);
      });
    } catch {
      return overrides[threadId];
    }
  }

  return overrides[threadId];
}

export async function createSessionRuntime(userId) {
  const session = createSession(userId);
  if (!postgresPrimaryEnabled()) {
    return session;
  }

  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(session.id);
  try {
    await upsertPostgresNow("sessions", row, ["id"]);
  } catch {
    return session;
  }

  return session;
}

export async function getSessionRuntime(sessionId) {
  if (!postgresPrimaryEnabled()) {
    return getSession(sessionId);
  }

  if (!sessionId) {
    return null;
  }

  try {
    const session = await queryPostgresRow("SELECT * FROM sessions WHERE id = $1", [sessionId]);
    if (!session) {
      return getSession(sessionId);
    }

    if (new Date(session.expires_at) <= new Date()) {
      db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
      await queryPostgres("DELETE FROM sessions WHERE id = $1", [sessionId]);
      return null;
    }

    const user = await queryPostgresRow("SELECT * FROM users WHERE id = $1", [session.user_id]);
    const workspace = user
      ? await queryPostgresRow("SELECT * FROM workspaces WHERE owner_user_id = $1", [user.id])
      : null;

    if (!user || !workspace) {
      return getSession(sessionId);
    }

    return { session, user, workspace };
  } catch {
    return getSession(sessionId);
  }
}

export async function deleteSessionRuntime(sessionId) {
  deleteSession(sessionId);
  if (!postgresPrimaryEnabled()) {
    return;
  }

  try {
    await queryPostgres("DELETE FROM sessions WHERE id = $1", [sessionId]);
  } catch {
    // Local deletion has already happened; keep runtime resilient.
  }
}

export async function createOauthStateRuntime(payload) {
  createOauthState(payload);
  if (!postgresPrimaryEnabled()) {
    return;
  }

  const row = db.prepare("SELECT * FROM oauth_states WHERE state = ?").get(payload.state);
  try {
    await upsertPostgresNow("oauth_states", row, ["state"]);
  } catch {
    // OAuth can still proceed through the SQLite fallback path.
  }
}

export async function consumeOauthStateRuntime(state, provider) {
  if (!postgresPrimaryEnabled()) {
    return consumeOauthState(state, provider);
  }

  try {
    const row = await queryPostgresRow(
      "SELECT * FROM oauth_states WHERE state = $1 AND provider = $2",
      [state, provider],
    );
    if (!row) {
      return consumeOauthState(state, provider);
    }

    await queryPostgres("DELETE FROM oauth_states WHERE state = $1", [state]);
    db.prepare("DELETE FROM oauth_states WHERE state = ?").run(state);

    if (new Date(row.expires_at) <= new Date()) {
      return null;
    }

    return row;
  } catch {
    return consumeOauthState(state, provider);
  }
}

export async function getOauthStateRuntime(state, provider) {
  if (!postgresPrimaryEnabled()) {
    const row = db.prepare("SELECT * FROM oauth_states WHERE state = ? AND provider = ?").get(state, provider);
    if (!row || new Date(row.expires_at) <= new Date()) {
      return null;
    }
    return row;
  }

  try {
    const row = await queryPostgresRow(
      "SELECT * FROM oauth_states WHERE state = $1 AND provider = $2",
      [state, provider],
    );
    if (!row) {
      return db.prepare("SELECT * FROM oauth_states WHERE state = ? AND provider = ?").get(state, provider) || null;
    }
    if (new Date(row.expires_at) <= new Date()) {
      return null;
    }
    return row;
  } catch {
    const row = db.prepare("SELECT * FROM oauth_states WHERE state = ? AND provider = ?").get(state, provider);
    if (!row || new Date(row.expires_at) <= new Date()) {
      return null;
    }
    return row;
  }
}

export async function getWorkspaceSummaryRuntime(userId) {
  if (!postgresPrimaryEnabled()) {
    return getWorkspaceSummary(userId);
  }

  try {
    const workspace = await queryPostgresRow("SELECT * FROM workspaces WHERE owner_user_id = $1", [userId]);
    if (!workspace) {
      return getWorkspaceSummary(userId);
    }

    const organization = await getSettingRuntime("organization", defaultOrganization);
    return {
      id: workspace.id,
      type: workspace.type,
      ownerUserId: workspace.owner_user_id,
      orgName: organization.orgName,
      orgDomain: organization.orgDomain,
      settings: organization.settings,
    };
  } catch {
    return getWorkspaceSummary(userId);
  }
}

export async function updateWorkspaceSummaryRuntime(userId, patch) {
  const updated = updateWorkspaceSummary(userId, patch);
  if (!postgresPrimaryEnabled()) {
    return updated;
  }

  const workspace = db.prepare("SELECT * FROM workspaces WHERE owner_user_id = ?").get(userId);
  const settingRow = db.prepare("SELECT * FROM settings WHERE key = ?").get("organization");

  try {
    await withPostgresTransaction(async (postgres) => {
      await upsertPostgresRecord(postgres, "workspaces", workspace, ["id"]);
      await upsertPostgresRecord(postgres, "settings", settingRow, ["key"]);
    });
  } catch {
    return updated;
  }

  return getWorkspaceSummaryRuntime(userId);
}

export async function listWorkspaceMembersRuntime(workspaceId) {
  if (!postgresPrimaryEnabled()) {
    return listWorkspaceMembers(workspaceId);
  }

  try {
    const rows = await queryPostgresRows(`
      SELECT wm.role, u.id, u.email, u.full_name, u.created_at
      FROM workspace_members wm
      JOIN users u ON u.id = wm.user_id
      WHERE wm.workspace_id = $1
      ORDER BY u.created_at ASC
    `, [workspaceId]);
    return rows;
  } catch {
    return listWorkspaceMembers(workspaceId);
  }
}

export async function listTeamsRuntime(workspaceId) {
  if (!postgresPrimaryEnabled()) {
    return listTeams(workspaceId);
  }

  try {
    return await queryPostgresRows(
      "SELECT * FROM teams WHERE workspace_id = $1 ORDER BY created_at ASC",
      [workspaceId],
    );
  } catch {
    return listTeams(workspaceId);
  }
}

export async function createTeamRuntime(workspaceId, name) {
  const row = createTeam(workspaceId, name);
  if (!postgresPrimaryEnabled()) {
    return row;
  }

  try {
    await upsertPostgresNow("teams", row, ["id"]);
  } catch {
    return row;
  }

  return row;
}

export async function listInvitesRuntime(workspaceId) {
  if (!postgresPrimaryEnabled()) {
    return listInvites(workspaceId);
  }

  try {
    return await queryPostgresRows(
      "SELECT * FROM invites WHERE workspace_id = $1 ORDER BY created_at DESC",
      [workspaceId],
    );
  } catch {
    return listInvites(workspaceId);
  }
}

export async function createInviteRuntime(workspaceId, email, role = "member") {
  const row = createInvite(workspaceId, email, role);
  if (!postgresPrimaryEnabled()) {
    return row;
  }

  try {
    await upsertPostgresNow("invites", row, ["id"]);
  } catch {
    return row;
  }

  return row;
}

export async function listConnectedAccountsRuntime(userId) {
  if (!postgresPrimaryEnabled()) {
    return listConnectedAccounts(userId);
  }

  try {
    return await queryPostgresRows(
      "SELECT * FROM connected_accounts WHERE user_id = $1 ORDER BY created_at DESC",
      [userId],
    );
  } catch {
    return listConnectedAccounts(userId);
  }
}

async function listAllConnectedAccountsRuntime() {
  if (!postgresPrimaryEnabled()) {
    return db.prepare(`
      SELECT *
      FROM connected_accounts
      WHERE provider IN ('google', 'microsoft')
      ORDER BY created_at DESC
    `).all();
  }

  try {
    return await queryPostgresRows(`
      SELECT *
      FROM connected_accounts
      WHERE provider IN ('google', 'microsoft')
      ORDER BY created_at DESC
    `);
  } catch {
    return db.prepare(`
      SELECT *
      FROM connected_accounts
      WHERE provider IN ('google', 'microsoft')
      ORDER BY created_at DESC
    `).all();
  }
}

export async function findConnectedAccountByIdRuntime(accountId) {
  if (!postgresPrimaryEnabled()) {
    return findConnectedAccountById(accountId);
  }

  try {
    const row = await queryPostgresRow("SELECT * FROM connected_accounts WHERE id = $1", [accountId]);
    return row || findConnectedAccountById(accountId);
  } catch {
    return findConnectedAccountById(accountId);
  }
}

export async function findConnectedAccountByProviderEmailRuntime(provider, email) {
  if (!postgresPrimaryEnabled()) {
    return findConnectedAccountByProviderEmail(provider, email);
  }

  try {
    const row = await queryPostgresRow(`
      SELECT *
      FROM connected_accounts
      WHERE provider = $1 AND lower(email) = lower($2)
      ORDER BY created_at DESC
      LIMIT 1
    `, [provider, email]);
    return row || findConnectedAccountByProviderEmail(provider, email);
  } catch {
    return findConnectedAccountByProviderEmail(provider, email);
  }
}

export async function upsertConnectedAccountRuntime(payload) {
  const row = upsertConnectedAccount(payload);
  if (!postgresPrimaryEnabled()) {
    return row;
  }

  try {
    await upsertPostgresNow("connected_accounts", row, ["id"]);
  } catch {
    return row;
  }

  return row;
}

export async function deleteConnectedAccountRuntime(userId, accountId) {
  const threadIds = db.prepare("SELECT id FROM mail_threads WHERE user_id = ? AND connected_account_id = ?").all(userId, accountId)
    .map((row) => row.id);
  const deleted = deleteConnectedAccount(userId, accountId);
  if (!deleted || !postgresPrimaryEnabled()) {
    return deleted;
  }

  try {
    await withPostgresTransaction(async (postgres) => {
      await deletePostgresRecords(postgres, "draft_records", { user_id: userId, connected_account_id: accountId });
      await deletePostgresRecords(postgres, "meeting_sessions", { user_id: userId, connected_account_id: accountId });
      await deletePostgresRecords(postgres, "calendar_events", { user_id: userId, connected_account_id: accountId });
      await deletePostgresRecordsByColumnValues(postgres, "thread_classifications", "thread_id", threadIds);
      await deletePostgresRecordsByColumnValues(postgres, "mail_messages", "thread_id", threadIds);
      await deletePostgresRecords(postgres, "mail_threads", { user_id: userId, connected_account_id: accountId });
      await deletePostgresRecords(postgres, "sync_runs", { user_id: userId, connected_account_id: accountId });
      await deletePostgresRecords(postgres, "mail_sync_state", { connected_account_id: accountId });
      await deletePostgresRecords(postgres, "webhook_subscriptions", { connected_account_id: accountId });
      await deletePostgresRecords(postgres, "connected_accounts", { id: accountId, user_id: userId });
    });
  } catch {
    return deleted;
  }

  return deleted;
}

async function syncCalendarRowsToPostgres(userId, accountId = null) {
  if (!postgresPrimaryEnabled()) {
    return;
  }

  const filters = ["user_id = ?"];
  const params = [userId];
  const deleteFilters = { user_id: userId };
  if (accountId) {
    filters.push("connected_account_id = ?");
    params.push(accountId);
    deleteFilters.connected_account_id = accountId;
  }

  const rows = db.prepare(`
    SELECT *
    FROM calendar_events
    WHERE ${filters.join(" AND ")}
  `).all(...params);

  await withPostgresTransaction(async (postgres) => {
    await deletePostgresRecords(postgres, "calendar_events", deleteFilters);
    for (const row of rows) {
      await upsertPostgresRecord(postgres, "calendar_events", row, ["id"]);
    }
  });
}

async function syncMeetingSessionsToPostgres(userId, sessionId = "") {
  if (!postgresPrimaryEnabled()) {
    return;
  }

  const filters = ["user_id = ?"];
  const params = [userId];
  if (sessionId) {
    filters.push("id = ?");
    params.push(sessionId);
  }

  const rows = db.prepare(`
    SELECT *
    FROM meeting_sessions
    WHERE ${filters.join(" AND ")}
  `).all(...params);

  await withPostgresTransaction(async (postgres) => {
    if (sessionId) {
      await deletePostgresRecords(postgres, "meeting_sessions", { id: sessionId, user_id: userId });
    } else {
      await deletePostgresRecords(postgres, "meeting_sessions", { user_id: userId });
    }

    for (const row of rows) {
      await upsertPostgresRecord(postgres, "meeting_sessions", row, ["id"]);
    }
  });
}

async function syncMailDomainToPostgres(userId, { accountId = null, threadId = null } = {}) {
  if (!postgresPrimaryEnabled()) {
    return;
  }

  const threadFilters = ["user_id = ?"];
  const threadParams = [userId];
  if (accountId) {
    threadFilters.push("connected_account_id = ?");
    threadParams.push(accountId);
  }
  if (threadId) {
    threadFilters.push("id = ?");
    threadParams.push(threadId);
  }

  const threadRows = db.prepare(`
    SELECT *
    FROM mail_threads
    WHERE ${threadFilters.join(" AND ")}
  `).all(...threadParams);
  const threadIds = threadRows.map((row) => row.id);
  const messageRows = listSqliteRowsByValues("mail_messages", "thread_id", threadIds);
  const classificationRows = listSqliteRowsByValues("thread_classifications", "thread_id", threadIds);

  const draftFilters = ["user_id = ?"];
  const draftParams = [userId];
  if (accountId) {
    draftFilters.push("connected_account_id = ?");
    draftParams.push(accountId);
  }
  const draftRows = db.prepare(`
    SELECT *
    FROM draft_records
    WHERE ${draftFilters.join(" AND ")}
  `).all(...draftParams);

  const syncRunFilters = ["user_id = ?"];
  const syncRunParams = [userId];
  if (accountId) {
    syncRunFilters.push("connected_account_id = ?");
    syncRunParams.push(accountId);
  }
  const syncRunRows = db.prepare(`
    SELECT *
    FROM sync_runs
    WHERE ${syncRunFilters.join(" AND ")}
  `).all(...syncRunParams);

  const syncStateFilters = ["user_id = ?"];
  const syncStateParams = [userId];
  if (accountId) {
    syncStateFilters.push("connected_account_id = ?");
    syncStateParams.push(accountId);
  }
  const syncStateRows = db.prepare(`
    SELECT *
    FROM mail_sync_state
    WHERE ${syncStateFilters.join(" AND ")}
  `).all(...syncStateParams);

  const classificationRunRows = db.prepare(`
    SELECT *
    FROM classification_runs
    WHERE user_id = ?
  `).all(userId);

  const webhookRows = accountId
    ? db.prepare("SELECT * FROM webhook_subscriptions WHERE connected_account_id = ?").all(accountId)
    : db.prepare(`
      SELECT ws.*
      FROM webhook_subscriptions ws
      JOIN connected_accounts ca ON ca.id = ws.connected_account_id
      WHERE ca.user_id = ?
    `).all(userId);

  const accountIds = [...new Set([
    ...threadRows.map((row) => row.connected_account_id),
    ...draftRows.map((row) => row.connected_account_id),
    ...syncRunRows.map((row) => row.connected_account_id),
    ...syncStateRows.map((row) => row.connected_account_id),
    ...webhookRows.map((row) => row.connected_account_id),
  ].filter(Boolean))];

  await withPostgresTransaction(async (postgres) => {
    await deletePostgresRecords(
      postgres,
      "mail_threads",
      accountId ? { user_id: userId, connected_account_id: accountId } : { user_id: userId },
    );
    await deletePostgresRecords(
      postgres,
      "draft_records",
      accountId ? { user_id: userId, connected_account_id: accountId } : { user_id: userId },
    );
    await deletePostgresRecords(
      postgres,
      "sync_runs",
      accountId ? { user_id: userId, connected_account_id: accountId } : { user_id: userId },
    );
    await deletePostgresRecords(
      postgres,
      "mail_sync_state",
      accountId ? { connected_account_id: accountId } : { user_id: userId },
    );
    await deletePostgresRecords(postgres, "classification_runs", { user_id: userId });

    await deletePostgresRecordsByColumnValues(postgres, "mail_messages", "thread_id", threadIds);
    await deletePostgresRecordsByColumnValues(postgres, "thread_classifications", "thread_id", threadIds);
    await deletePostgresRecordsByColumnValues(postgres, "webhook_subscriptions", "connected_account_id", accountIds);

    for (const row of threadRows) {
      await upsertPostgresRecord(postgres, "mail_threads", row, ["id"]);
    }
    for (const row of messageRows) {
      await upsertPostgresRecord(postgres, "mail_messages", row, ["id"]);
    }
    for (const row of classificationRows) {
      await upsertPostgresRecord(postgres, "thread_classifications", row, ["thread_id"]);
    }
    for (const row of draftRows) {
      await upsertPostgresRecord(postgres, "draft_records", row, ["id"]);
    }
    for (const row of syncRunRows) {
      await upsertPostgresRecord(postgres, "sync_runs", row, ["id"]);
    }
    for (const row of syncStateRows) {
      await upsertPostgresRecord(postgres, "mail_sync_state", row, ["connected_account_id"]);
    }
    for (const row of webhookRows) {
      await upsertPostgresRecord(postgres, "webhook_subscriptions", row, ["connected_account_id"]);
    }
    for (const row of classificationRunRows) {
      await upsertPostgresRecord(postgres, "classification_runs", row, ["id"]);
    }
  });
}

async function listCalendarRowsRuntime(userId, {
  from = "",
  to = "",
  accountId = null,
  includeCancelled = false,
  limit = 100,
} = {}) {
  if (!postgresPrimaryEnabled()) {
    return listCalendarRows(userId, {
      from,
      to,
      accountId,
      includeCancelled,
      limit,
    });
  }

  const filters = ["ce.user_id = $1"];
  const params = [userId];

  if (accountId) {
    params.push(accountId);
    filters.push(`ce.connected_account_id = $${params.length}`);
  }

  if (!includeCancelled) {
    filters.push("ce.status != 'cancelled'");
  }

  if (from) {
    params.push(from);
    filters.push(`ce.end_at >= $${params.length}`);
  }

  if (to) {
    params.push(to);
    filters.push(`ce.start_at <= $${params.length}`);
  }

  params.push(Number(limit));

  try {
    return await queryPostgresRows(`
      SELECT ce.*, ca.email AS account_email, ca.display_name AS account_display_name
      FROM calendar_events ce
      LEFT JOIN connected_accounts ca ON ca.id = ce.connected_account_id
      WHERE ${filters.join(" AND ")}
      ORDER BY ce.start_at ASC, ce.id ASC
      LIMIT $${params.length}
    `, params);
  } catch {
    return listCalendarRows(userId, {
      from,
      to,
      accountId,
      includeCancelled,
      limit,
    });
  }
}

async function calendarEventsSummaryRuntime(userId, rows) {
  if (!postgresPrimaryEnabled()) {
    return calendarEventsSummary(userId, rows);
  }

  const upcoming = rows.filter((event) => new Date(event.end_at).getTime() >= Date.now());
  const recentEvents = (await listCalendarRowsRuntime(userId, {
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    to: nowIso(),
    includeCancelled: false,
    limit: 500,
  })).filter((event) => new Date(event.end_at).getTime() <= Date.now());

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

export function getBillingSummary() {
  return getSetting("billing", defaultBilling);
}

export async function getBillingSummaryRuntime(workspaceId = "") {
  if (workspaceId) {
    return getScopedSettingRuntime(workspaceId, "billing", defaultBilling);
  }

  return getSettingRuntime("billing", defaultBilling);
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

export async function getDashboardRuntime(userId) {
  if (!postgresPrimaryEnabled()) {
    return getDashboard(userId);
  }

  try {
    const [processedPayload, draftPayload] = await Promise.all([
      queryPostgres("SELECT COUNT(*)::int AS count FROM mail_threads WHERE user_id = $1", [userId]),
      queryPostgres("SELECT COUNT(*)::int AS count FROM draft_records WHERE user_id = $1", [userId]),
    ]);
    const recentCalendarRows = (await listCalendarRowsRuntime(userId, {
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      to: nowIso(),
      includeCancelled: false,
      limit: 500,
    })).filter((event) => new Date(event.end_at).getTime() <= Date.now());
    const meetingMinutes = recentCalendarRows.reduce((sum, event) => sum + meetingDurationMinutes(event), 0);

    return {
      stats: [
        { label: "Email elaborate", value: String(processedPayload.rows[0]?.count || 0) },
        { label: "Bozze create", value: String(draftPayload.rows[0]?.count || 0) },
        { label: "Tempo riunioni", value: meetingDurationLabel(meetingMinutes) },
      ],
      meetings: await dashboardMeetingsRuntime(userId),
      notifications: await listNotificationsRuntime(userId),
    };
  } catch {
    return getDashboard(userId);
  }
}

export function listConversations(userId) {
  return db.prepare("SELECT * FROM chat_conversations WHERE user_id = ? ORDER BY updated_at DESC").all(userId);
}

async function syncChatDomainToPostgres(userId, conversationId = "") {
  if (!postgresPrimaryEnabled()) {
    return;
  }

  const conversationFilters = ["user_id = ?"];
  const conversationParams = [userId];
  if (conversationId) {
    conversationFilters.push("id = ?");
    conversationParams.push(conversationId);
  }

  const conversations = db.prepare(`
    SELECT *
    FROM chat_conversations
    WHERE ${conversationFilters.join(" AND ")}
  `).all(...conversationParams);
  const conversationIds = conversations.map((row) => row.id);
  const messages = listSqliteRowsByValues("chat_messages", "conversation_id", conversationIds);

  await withPostgresTransaction(async (postgres) => {
    await deletePostgresRecords(postgres, "chat_conversations", conversationId ? { id: conversationId, user_id: userId } : { user_id: userId });
    await deletePostgresRecordsByColumnValues(postgres, "chat_messages", "conversation_id", conversationIds);

    for (const row of conversations) {
      await upsertPostgresRecord(postgres, "chat_conversations", row, ["id"]);
    }
    for (const row of messages) {
      await upsertPostgresRecord(postgres, "chat_messages", row, ["id"]);
    }
  });
}

export async function listConversationsRuntime(userId) {
  if (!postgresPrimaryEnabled()) {
    return listConversations(userId);
  }

  try {
    return await queryPostgresRows(
      "SELECT * FROM chat_conversations WHERE user_id = $1 ORDER BY updated_at DESC",
      [userId],
    );
  } catch {
    return listConversations(userId);
  }
}

export function createConversation(userId, title = "Nuova chat") {
  const id = randomUUID();
  const now = nowIso();
  db.prepare("INSERT INTO chat_conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, userId, title, now, now);
  return db.prepare("SELECT * FROM chat_conversations WHERE id = ?").get(id);
}

export async function createConversationRuntime(userId, title = "Nuova chat") {
  const conversation = createConversation(userId, title);
  if (!postgresPrimaryEnabled()) {
    return conversation;
  }

  try {
    await syncChatDomainToPostgres(userId, conversation.id);
  } catch {
    return conversation;
  }

  return conversation;
}

export function listConversationMessages(conversationId) {
  return db.prepare("SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC").all(conversationId);
}

function findConversationForUser(userId, conversationId) {
  return db.prepare("SELECT * FROM chat_conversations WHERE id = ? AND user_id = ?").get(conversationId, userId);
}

export async function findConversationForUserRuntime(userId, conversationId) {
  if (!postgresPrimaryEnabled()) {
    return findConversationForUser(userId, conversationId);
  }

  try {
    const row = await queryPostgresRow(
      "SELECT * FROM chat_conversations WHERE id = $1 AND user_id = $2",
      [conversationId, userId],
    );
    return row || findConversationForUser(userId, conversationId);
  } catch {
    return findConversationForUser(userId, conversationId);
  }
}

export async function listConversationMessagesRuntime(userId, conversationId) {
  const conversation = await findConversationForUserRuntime(userId, conversationId);
  if (!conversation) {
    return null;
  }

  if (!postgresPrimaryEnabled()) {
    return listConversationMessages(conversationId);
  }

  try {
    return await queryPostgresRows(
      "SELECT * FROM chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC",
      [conversationId],
    );
  } catch {
    return listConversationMessages(conversationId);
  }
}

export function addConversationMessage(conversationId, role, content) {
  const id = randomUUID();
  const now = nowIso();
  db.prepare("INSERT INTO chat_messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, conversationId, role, content, now);
  db.prepare("UPDATE chat_conversations SET updated_at = ? WHERE id = ?").run(now, conversationId);
  return db.prepare("SELECT * FROM chat_messages WHERE id = ?").get(id);
}

export async function addConversationMessageRuntime(userId, conversationId, role, content) {
  const conversation = await findConversationForUserRuntime(userId, conversationId);
  if (!conversation) {
    return null;
  }

  const message = addConversationMessage(conversationId, role, content);
  if (!message || !postgresPrimaryEnabled() || !conversation?.user_id) {
    return message;
  }

  try {
    await syncChatDomainToPostgres(conversation.user_id, conversationId);
  } catch {
    return message;
  }

  return message;
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
  if (account.external_account_id?.startsWith("demo-")) {
    return true;
  }

  if (account.provider === "zoom") {
    return false;
  }

  return !account.encrypted_access_token?.includes(".");
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
    JSON.stringify(event.attendees || []),
    event.isAllDay ? 1 : 0,
    now,
  ];

  if (existing) {
    db.prepare(`
      UPDATE calendar_events
      SET user_id = ?, connected_account_id = ?, provider = ?, external_event_id = ?, calendar_id = ?, title = ?,
      organizer_name = ?, organizer_email = ?, meeting_url = ?, join_provider = ?, location = ?, status = ?,
          start_at = ?, end_at = ?, timezone = ?, attendee_count = ?, attendees_json = ?, is_all_day = ?, updated_at = ?
      WHERE id = ?
    `).run(...payload, existing.id);
    return existing.id;
  }

  const id = randomUUID();
  db.prepare(`
    INSERT INTO calendar_events (
      id, user_id, connected_account_id, provider, external_event_id, calendar_id, title, organizer_name,
      organizer_email, meeting_url, join_provider, location, status, start_at, end_at, timezone,
      attendee_count, attendees_json, is_all_day, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    ...payload,
    now,
  );
  return id;
}

function deleteStaleCalendarEventsSqlite(userId, accountId, window, externalEventIds = []) {
  if (externalEventIds.length === 0) {
    db.prepare(`
      DELETE FROM calendar_events
      WHERE user_id = ? AND connected_account_id = ? AND end_at >= ? AND start_at <= ?
    `).run(userId, accountId, window.timeMin, window.timeMax);
    return;
  }

  const placeholders = externalEventIds.map(() => "?").join(", ");
  db.prepare(`
    DELETE FROM calendar_events
    WHERE user_id = ? AND connected_account_id = ? AND end_at >= ? AND start_at <= ?
      AND external_event_id NOT IN (${placeholders})
  `).run(userId, accountId, window.timeMin, window.timeMax, ...externalEventIds);
}

async function syncCalendarWindowPostgresPrimary(userId, account, events, window) {
  const validEvents = events.filter((event) => event?.externalEventId && event.startAt);
  const externalEventIds = validEvents.map((event) => event.externalEventId);

  await withPostgresTransaction(async (postgres) => {
    if (externalEventIds.length === 0) {
      await postgres.query(`
        DELETE FROM calendar_events
        WHERE user_id = $1 AND connected_account_id = $2 AND end_at >= $3 AND start_at <= $4
      `, [userId, account.id, window.timeMin, window.timeMax]);
    } else {
      const deletePlaceholders = externalEventIds.map((_, index) => `$${index + 5}`).join(", ");
      await postgres.query(`
        DELETE FROM calendar_events
        WHERE user_id = $1 AND connected_account_id = $2 AND end_at >= $3 AND start_at <= $4
          AND external_event_id NOT IN (${deletePlaceholders})
      `, [userId, account.id, window.timeMin, window.timeMax, ...externalEventIds]);
    }

    const existingRows = externalEventIds.length === 0
      ? []
      : (await postgres.query(`
        SELECT id, external_event_id, created_at
        FROM calendar_events
        WHERE user_id = $1 AND connected_account_id = $2 AND external_event_id = ANY($3::text[])
      `, [userId, account.id, externalEventIds])).rows;
    const existingByExternalId = new Map(existingRows.map((row) => [row.external_event_id, row]));

    for (const event of validEvents) {
      const existing = existingByExternalId.get(event.externalEventId);
      const now = nowIso();
      await upsertPostgresRecord(postgres, "calendar_events", {
        id: existing?.id || randomUUID(),
        user_id: userId,
        connected_account_id: account.id,
        provider: account.provider,
        external_event_id: event.externalEventId,
        calendar_id: event.calendarId || "primary",
        title: event.title || "(senza titolo)",
        organizer_name: event.organizerName || "",
        organizer_email: event.organizerEmail || "",
        meeting_url: event.meetingUrl || "",
        join_provider: event.joinProvider || "",
        location: event.location || "",
        status: event.status || "confirmed",
        start_at: event.startAt,
        end_at: event.endAt || event.startAt,
        timezone: event.timezone || "",
        attendee_count: Number(event.attendeeCount || 0),
        attendees_json: JSON.stringify(event.attendees || []),
        is_all_day: event.isAllDay ? 1 : 0,
        created_at: existing?.created_at || now,
        updated_at: now,
      }, ["id"]);
    }
  });
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

async function dashboardMeetingsRuntime(userId) {
  if (!postgresPrimaryEnabled()) {
    return dashboardMeetings(userId);
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 48 * 60 * 60 * 1000);
  const rows = await listCalendarRowsRuntime(userId, {
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
        await updateConnectedAccountTokensRuntime(account.id, tokenUpdate);
      },
    });

  const validEvents = events.filter((event) => event?.externalEventId && event.startAt);

  if (postgresPrimaryEnabled()) {
    await syncCalendarWindowPostgresPrimary(userId, account, validEvents, window);
    return {
      accountId: account.id,
      provider: account.provider,
      source: isDemoConnectedAccount(account) ? "demo" : "provider",
      importedEvents: validEvents.length,
    };
  }

  db.exec("BEGIN");
  try {
    deleteStaleCalendarEventsSqlite(userId, account.id, window, validEvents.map((event) => event.externalEventId));

    for (const event of validEvents) {
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
    importedEvents: validEvents.length,
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

export async function syncCalendarRuntime(userId, accountId = null, options = {}) {
  const accounts = accountId
    ? (await listConnectedAccountsRuntime(userId)).filter((account) => account.id === accountId)
    : await listConnectedAccountsRuntime(userId);

  const supportedAccounts = accounts.filter((account) => ["google", "microsoft"].includes(account?.provider) && accountCapabilities(account).includes("calendar"));
  if (accountId && supportedAccounts.length === 0) {
    const error = new Error("Calendar sync not supported for this provider");
    error.status = 400;
    throw error;
  }

  if (supportedAccounts.length === 0) {
    return {
      syncedAccounts: 0,
      importedEvents: 0,
      accounts: [],
    };
  }

  const results = [];
  for (const account of supportedAccounts) {
    results.push(await syncAccountCalendar(userId, account, options));
  }

  const result = {
    syncedAccounts: supportedAccounts.length,
    importedEvents: results.reduce((sum, item) => sum + item.importedEvents, 0),
    accounts: results,
  };
  return result;
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

export async function listCalendarEventsRuntime(userId, options = {}) {
  if (!postgresPrimaryEnabled()) {
    return listCalendarEvents(userId, options);
  }

  const window = calendarSyncWindow(options);
  try {
    const rows = await listCalendarRowsRuntime(userId, {
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
      summary: await calendarEventsSummaryRuntime(userId, rows),
    };
  } catch {
    return listCalendarEvents(userId, options);
  }
}

function normalizeMeetingSessionRow(row) {
  return {
    ...row,
    participants: safeJsonParse(row.participants_json || "[]", []),
    utterances: safeJsonParse(row.utterances_json || "[]", []),
    key_points: safeJsonParse(row.key_points_json || "[]", []),
    action_items: safeJsonParse(row.action_items_json || "[]", []),
    shared_recipients: safeJsonParse(row.shared_recipients_json || "[]", []),
  };
}

function normalizeEventAttendees(value) {
  return safeJsonParse(value || "[]", [])
    .map((item) => ({
      email: String(item?.email || "").trim().toLowerCase(),
      name: String(item?.name || item?.displayName || "").trim(),
      responseStatus: String(item?.responseStatus || "").trim(),
      organizer: Boolean(item?.organizer),
      self: Boolean(item?.self),
    }))
    .filter((item) => item.email)
}

function deriveMeetingParticipants(session, calendarEvent) {
  const attendees = normalizeEventAttendees(calendarEvent?.attendees_json || "[]")
  const speakerNames = [...new Set((session.utterances || []).map((item) => String(item?.speaker || "").trim()).filter(Boolean))]
  const participants = [...attendees]

  for (const speakerName of speakerNames) {
    const alreadyPresent = participants.some((item) => item.name.toLowerCase() === speakerName.toLowerCase())
    if (!alreadyPresent) {
      participants.push({ email: "", name: speakerName, responseStatus: "", organizer: false, self: false })
    }
  }

  if (session.calendar_event_organizer_email && !participants.some((item) => item.email === session.calendar_event_organizer_email)) {
    participants.unshift({
      email: String(session.calendar_event_organizer_email).trim().toLowerCase(),
      name: session.calendar_event_organizer_email,
      responseStatus: "accepted",
      organizer: true,
      self: false,
    })
  }

  return participants
}

async function getMeetingSessionRuntime(userId, sessionId) {
  if (!postgresPrimaryEnabled()) {
    const row = db.prepare("SELECT * FROM meeting_sessions WHERE id = ? AND user_id = ?").get(sessionId, userId);
    return row ? normalizeMeetingSessionRow(row) : null;
  }

  try {
    const row = await queryPostgresRow(`
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
      WHERE ms.user_id = $1 AND ms.id = $2
      LIMIT 1
    `, [userId, sessionId]);

    return row ? normalizeMeetingSessionRow(row) : null;
  } catch {
    const row = db.prepare("SELECT * FROM meeting_sessions WHERE id = ? AND user_id = ?").get(sessionId, userId);
    return row ? normalizeMeetingSessionRow(row) : null;
  }
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

async function updateMeetingSessionArtifactsRuntime(userId, sessionId, patch) {
  if (!postgresPrimaryEnabled()) {
    updateMeetingSessionArtifacts(sessionId, patch);
    return getMeetingSessionRuntime(userId, sessionId);
  }

  await queryPostgres(`
    UPDATE meeting_sessions
    SET status = $1, transcript_text = $2, utterances_json = $3, summary_text = $4, key_points_json = $5, action_items_json = $6,
        follow_up_email = $7, error_message = $8, duration_minutes = $9, transcription_provider = $10, updated_at = $11
    WHERE id = $12 AND user_id = $13
  `, [
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
    userId,
  ]);

  return getMeetingSessionRuntime(userId, sessionId);
}

async function updateMeetingSessionParticipantsRuntime(userId, sessionId, participants = []) {
  const participantsJson = JSON.stringify(participants || [])
  db.prepare("UPDATE meeting_sessions SET participants_json = ?, updated_at = ? WHERE id = ? AND user_id = ?")
    .run(participantsJson, nowIso(), sessionId, userId)

  if (postgresPrimaryEnabled()) {
    try {
      await queryPostgres(
        "UPDATE meeting_sessions SET participants_json = $1, updated_at = $2 WHERE id = $3 AND user_id = $4",
        [participantsJson, nowIso(), sessionId, userId],
      )
    } catch {
      return getMeetingSessionRuntime(userId, sessionId)
    }
  }

  return getMeetingSessionRuntime(userId, sessionId)
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

export async function listMeetingSessionsRuntime(userId) {
  if (!postgresPrimaryEnabled()) {
    return listMeetingSessions(userId);
  }

  try {
    const rows = await queryPostgresRows(`
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
      WHERE ms.user_id = $1
      ORDER BY ms.updated_at DESC, ms.id DESC
    `, [userId]);

    return rows.map(normalizeMeetingSessionRow);
  } catch {
    return listMeetingSessions(userId);
  }
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
      action_items_json, follow_up_email, participants_json, share_status, shared_at, shared_recipients_json, error_message, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    JSON.stringify(normalizeEventAttendees(calendarEvent?.attendees_json || "[]")),
    "",
    "",
    "[]",
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

export async function createMeetingSessionRuntime(userId, payload = {}) {
  if (!postgresPrimaryEnabled()) {
    return createMeetingSession(userId, payload);
  }

  const calendarEvent = await findCalendarEventByIdRuntime(userId, payload.calendarEventId || "");
  const title = String(payload.title || calendarEvent?.title || "Riunione senza titolo").trim();
  const meetingUrl = String(payload.meetingUrl || calendarEvent?.meeting_url || "").trim();
  const transcriptText = String(payload.transcriptText || "").trim();
  const sourceType = payload.sourceType || "record";
  const status = transcriptText ? "processing" : (sourceType === "join" ? "scheduled" : "recording_requested");
  const id = randomUUID();
  const now = nowIso();

  await upsertPostgresNow("meeting_sessions", {
    id,
    user_id: userId,
    calendar_event_id: calendarEvent?.id || "",
    connected_account_id: calendarEvent?.connected_account_id || "",
    source_type: sourceType,
    status,
    title,
    meeting_url: meetingUrl,
    join_provider: calendarEvent?.join_provider || inferJoinProviderFromUrl(meetingUrl),
    language: payload.language || defaultNotetaker.language,
    source_file_name: payload.sourceFileName || "",
    source_file_type: payload.sourceFileType || "",
    source_file_size: Number(payload.sourceFileSize || 0),
    source_object_key: payload.sourceObjectKey || "",
    source_storage_provider: payload.sourceStorageProvider || "",
    transcription_provider: payload.transcriptionProvider || "",
    started_at: payload.startedAt || calendarEvent?.start_at || "",
    ended_at: payload.endedAt || calendarEvent?.end_at || "",
    duration_minutes: 0,
    transcript_text: transcriptText,
    utterances_json: JSON.stringify(payload.utterances || []),
    summary_text: "",
    key_points_json: "[]",
    action_items_json: "[]",
    follow_up_email: "",
    participants_json: JSON.stringify(normalizeEventAttendees(calendarEvent?.attendees_json || "[]")),
    share_status: "",
    shared_at: "",
    shared_recipients_json: "[]",
    error_message: "",
    created_at: now,
    updated_at: now,
  }, ["id"]);

  if (!transcriptText) {
    return getMeetingSessionRuntime(userId, id);
  }

  const created = await getMeetingSessionRuntime(userId, id);

  try {
    const analysis = await analyzeMeetingSession({
      session: created,
      calendarEvent,
      transcriptText,
    });
    const durationMinutes = created?.started_at && created?.ended_at
      ? Math.max(0, meetingDurationMinutes({ start_at: created.started_at, end_at: created.ended_at }))
      : 0;

    const updated = await updateMeetingSessionArtifactsRuntime(userId, id, {
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
    const withParticipants = await updateMeetingSessionParticipantsRuntime(userId, id, deriveMeetingParticipants(updated, calendarEvent));
    return maybeAutoShareMeetingSessionRuntime(userId, withParticipants);
  } catch (error) {
    await updateMeetingSessionArtifactsRuntime(userId, id, {
      status: "failed",
      transcriptText,
      utterances: payload.utterances || [],
      summaryText: "",
      keyPoints: [],
      actionItems: [],
      followUpEmail: "",
      durationMinutes: 0,
      transcriptionProvider: payload.transcriptionProvider || "",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
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
    const withParticipants = await updateMeetingSessionParticipantsRuntime(
      userId,
      sessionId,
      deriveMeetingParticipants(normalizeMeetingSessionRow(db.prepare("SELECT * FROM meeting_sessions WHERE id = ?").get(sessionId)), calendarEvent),
    );
    return maybeAutoShareMeetingSessionRuntime(userId, withParticipants);
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

export async function processMeetingSessionRuntime(userId, sessionId, transcriptText = "") {
  if (!postgresPrimaryEnabled()) {
    return processMeetingSession(userId, sessionId, transcriptText);
  }

  const existing = await getMeetingSessionRuntime(userId, sessionId);
  if (!existing) {
    return null;
  }

  const nextTranscript = String(transcriptText || existing.transcript_text || "").trim();
  const calendarEvent = await findCalendarEventByIdRuntime(userId, existing.calendar_event_id || "");

  await queryPostgres(`
    UPDATE meeting_sessions
    SET status = $1, transcript_text = $2, updated_at = $3
    WHERE id = $4 AND user_id = $5
  `, ["processing", nextTranscript, nowIso(), sessionId, userId]);

  try {
    const analysis = await analyzeMeetingSession({
      session: { ...existing, transcript_text: nextTranscript },
      calendarEvent,
      transcriptText: nextTranscript,
    });

    const durationMinutes = existing.started_at && existing.ended_at
      ? Math.max(0, meetingDurationMinutes({ start_at: existing.started_at, end_at: existing.ended_at }))
      : Number(existing.duration_minutes || 0);

    const updated = await updateMeetingSessionArtifactsRuntime(userId, sessionId, {
      status: "ready",
      transcriptText: nextTranscript,
      utterances: existing.utterances || [],
      summaryText: analysis.summary,
      keyPoints: analysis.keyPoints,
      actionItems: analysis.actionItems,
      followUpEmail: analysis.followUpEmail,
      durationMinutes,
      transcriptionProvider: existing.transcription_provider || "",
      errorMessage: "",
    });
    const withParticipants = await updateMeetingSessionParticipantsRuntime(userId, sessionId, deriveMeetingParticipants(updated, calendarEvent));
    return maybeAutoShareMeetingSessionRuntime(userId, withParticipants);
  } catch (error) {
    await updateMeetingSessionArtifactsRuntime(userId, sessionId, {
      status: "failed",
      transcriptText: nextTranscript,
      utterances: existing.utterances || [],
      summaryText: existing.summary_text || "",
      keyPoints: existing.key_points || [],
      actionItems: existing.action_items || [],
      followUpEmail: existing.follow_up_email || "",
      durationMinutes: Number(existing.duration_minutes || 0),
      transcriptionProvider: existing.transcription_provider || "",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function fallbackMeetingChatAnswer(session, question = "") {
  const summary = String(session.summary_text || "").trim()
  const actionItems = Array.isArray(session.action_items) ? session.action_items : []
  return [
    summary ? `Recap: ${summary}` : `Non ho ancora un recap completo per "${session.title}".`,
    actionItems.length
      ? `Action items principali: ${actionItems.slice(0, 3).map((item) => `${item.owner || 'Da assegnare'} - ${item.task}`).join('; ')}`
      : "Non risultano action item confermati.",
    question ? `Domanda ricevuta: ${question}` : "",
  ].filter(Boolean).join('\n\n')
}

export async function listMeetingSessionChatMessagesRuntime(userId, sessionId) {
  const session = await getMeetingSessionRuntime(userId, sessionId)
  if (!session) {
    return null
  }

  if (!postgresPrimaryEnabled()) {
    return db.prepare(`
      SELECT * FROM meeting_session_chat_messages
      WHERE session_id = ? AND user_id = ?
      ORDER BY datetime(created_at) ASC, id ASC
    `).all(sessionId, userId)
  }

  try {
    return await queryPostgresRows(`
      SELECT * FROM meeting_session_chat_messages
      WHERE session_id = $1 AND user_id = $2
      ORDER BY created_at ASC, id ASC
    `, [sessionId, userId])
  } catch {
    return db.prepare(`
      SELECT * FROM meeting_session_chat_messages
      WHERE session_id = ? AND user_id = ?
      ORDER BY datetime(created_at) ASC, id ASC
    `).all(sessionId, userId)
  }
}

async function appendMeetingSessionChatMessageRuntime(userId, sessionId, role, content) {
  const row = {
    id: randomUUID(),
    session_id: sessionId,
    user_id: userId,
    role,
    content: String(content || "").trim(),
    created_at: nowIso(),
  }

  db.prepare(`
    INSERT INTO meeting_session_chat_messages (id, session_id, user_id, role, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(row.id, row.session_id, row.user_id, row.role, row.content, row.created_at)

  if (postgresPrimaryEnabled()) {
    try {
      await upsertPostgresNow("meeting_session_chat_messages", row, ["id"])
    } catch {
      return row
    }
  }

  return row
}

export async function askMeetingSessionQuestionRuntime(userId, sessionId, question = "") {
  const session = await getMeetingSessionRuntime(userId, sessionId)
  if (!session) {
    return null
  }

  const trimmedQuestion = String(question || "").trim()
  if (!trimmedQuestion) {
    const error = new Error("Question content required")
    error.status = 400
    throw error
  }

  await appendMeetingSessionChatMessageRuntime(userId, sessionId, "user", trimmedQuestion)

  let answer = fallbackMeetingChatAnswer(session, trimmedQuestion)
  if (hasGeminiCredentials()) {
    try {
      const prompt = [
        "Rispondi a una domanda su una riunione in modo conciso e utile.",
        `Titolo: ${session.title}`,
        `Summary: ${session.summary_text || ''}`,
        `Key points: ${(session.key_points || []).join(' | ')}`,
        `Action items: ${(session.action_items || []).map((item) => `${item.owner || 'Da assegnare'}:${item.task}`).join(' | ')}`,
        `Follow-up email: ${session.follow_up_email || ''}`,
        `Transcript: ${trimTranscript(session.transcript_text || '').slice(0, 4000)}`,
        `Domanda utente: ${trimmedQuestion}`,
      ].join('\n')
      const result = await generateTextWithGemini({
        model: process.env.GEMINI_CHAT_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash",
        systemInstruction: "Sei un assistente executive per note riunione. Rispondi in italiano, in modo operativo e preciso.",
        prompt,
        temperature: 0.2,
        maxOutputTokens: 500,
      })
      if (result.text.trim()) {
        answer = result.text.trim()
      }
    } catch {
      answer = fallbackMeetingChatAnswer(session, trimmedQuestion)
    }
  }

  const assistantMessage = await appendMeetingSessionChatMessageRuntime(userId, sessionId, "assistant", answer)
  return {
    answer,
    assistantMessage,
    messages: await listMeetingSessionChatMessagesRuntime(userId, sessionId),
  }
}

function defaultMeetingShareRecipients(session) {
  const recipients = []
  if (session.calendar_event_organizer_email) {
    recipients.push(session.calendar_event_organizer_email)
  }
  return [...new Set(recipients.filter(Boolean))]
}

function resolveAutoMeetingShareRecipients(session, notetakerSettings = {}) {
  const recipients = []
  if (notetakerSettings.shareWithOrganizer !== false && session.calendar_event_organizer_email) {
    recipients.push(session.calendar_event_organizer_email)
  }

  if (Array.isArray(session.participants)) {
    for (const participant of session.participants) {
      if (!participant?.email) {
        continue
      }
      if (participant.self) {
        continue
      }
      recipients.push(String(participant.email).trim().toLowerCase())
    }
  }

  for (const recipient of normalizeStringArray(notetakerSettings.autoShareRecipients)) {
    recipients.push(recipient.toLowerCase())
  }

  return [...new Set(recipients.filter(Boolean))]
}

function buildMeetingRecapEmail(session, note = "", template = "standard") {
  const keyPoints = (session.key_points || []).slice(0, 5).map((item) => `- ${item}`)
  const actionItems = (session.action_items || []).slice(0, 5).map((item) => `- ${item.owner || 'Da assegnare'}: ${item.task}`)
  const intro = {
    standard: `ti condivido il recap della riunione "${session.title}".`,
    concise: `ecco il recap rapido di "${session.title}".`,
    action: `ti invio il recap operativo di "${session.title}", con focus sui prossimi step.`,
  }[template] || `ti condivido il recap della riunione "${session.title}".`

  const summaryBlock = template === 'concise'
    ? (session.summary_text || session.follow_up_email || "Recap non ancora disponibile.")
    : (session.summary_text || session.follow_up_email || "Recap non ancora disponibile.")
  return [
    `Ciao,`,
    "",
    intro,
    "",
    summaryBlock,
    template !== 'concise' && keyPoints.length ? "\nKey points:\n" + keyPoints.join("\n") : "",
    actionItems.length ? "\nAction items:\n" + actionItems.join("\n") : "",
    note ? `\nNota aggiuntiva:\n${note}` : "",
  ].filter(Boolean).join("\n")
}

export async function shareMeetingSessionRuntime(userId, sessionId, payload = {}) {
  const session = await getMeetingSessionRuntime(userId, sessionId)
  if (!session) {
    return null
  }

  const accountForSettings = session.connected_account_id
    ? await findConnectedAccountByIdRuntime(session.connected_account_id)
    : null
  const notetakerSettings = accountForSettings?.workspace_id
    ? await getScopedSettingRuntime(accountForSettings.workspace_id, "notetaker", defaultNotetaker)
    : await getSettingRuntime("notetaker", defaultNotetaker)

  const recipients = [...new Set([
    ...normalizeStringArray(payload.recipients),
    ...(payload.includeOrganizer === false ? [] : defaultMeetingShareRecipients(session)),
  ])]
  if (!recipients.length) {
    const error = new Error("At least one recipient is required")
    error.status = 400
    throw error
  }

  const subject = payload.subject || `Recap riunione: ${session.title}`
  const recapTemplate = String(payload.template || notetakerSettings.recapTemplate || 'standard')
  const content = buildMeetingRecapEmail(session, payload.note || "", recapTemplate)
  let shareStatus = "prepared"
  const shareResults = []

  const account = session.connected_account_id
    ? await findConnectedAccountByIdRuntime(session.connected_account_id)
    : (await listConnectedAccountsRuntime(userId))[0] || null

  if (account) {
    for (const recipient of recipients) {
      if (isDemoConnectedAccount(account)) {
        shareResults.push({ recipient, status: "local_only" })
        shareStatus = "local_only"
        continue
      }

      try {
        const result = await upsertProviderDraft(account, {
          providerDraftId: "",
          providerMessageId: "",
          threadExternalId: "",
          replyToExternalMessageId: "",
          replyToInternetMessageId: "",
          toEmail: recipient,
          subject,
          content,
        }, {
          onTokenRefresh: async (tokenUpdate) => {
            await updateConnectedAccountTokensRuntime(account.id, tokenUpdate)
          },
        })
        shareResults.push({
          recipient,
          status: "draft_created",
          providerDraftId: result.providerDraftId || "",
        })
        shareStatus = "draft_created"
      } catch (error) {
        shareResults.push({ recipient, status: "failed", error: error instanceof Error ? error.message : String(error) })
        if (shareStatus !== "draft_created") {
          shareStatus = "failed"
        }
      }
    }
  }

  const sharedAt = nowIso()
  const recipientsJson = JSON.stringify(shareResults)
  db.prepare(`
    UPDATE meeting_sessions
    SET share_status = ?, shared_at = ?, shared_recipients_json = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).run(shareStatus, sharedAt, recipientsJson, sharedAt, sessionId, userId)

  if (postgresPrimaryEnabled()) {
    try {
      await queryPostgres(`
        UPDATE meeting_sessions
        SET share_status = $1, shared_at = $2, shared_recipients_json = $3, updated_at = $4
        WHERE id = $5 AND user_id = $6
      `, [shareStatus, sharedAt, recipientsJson, sharedAt, sessionId, userId])
    } catch {}
  }

  await createNotificationRuntime(userId, {
    title: `Recap ${shareStatus === 'draft_created' ? 'preparato' : 'aggiornato'}`,
    body: `${session.title}: ${recipients.length} destinatari gestiti dal notetaker.`,
    link: "/notetaker",
  })

  return {
    session: await getMeetingSessionRuntime(userId, sessionId),
    shareResults,
    subject,
    content,
    template: recapTemplate,
  }
}

async function maybeAutoShareMeetingSessionRuntime(userId, session) {
  if (!session) {
    return session
  }

  const account = session.connected_account_id
    ? await findConnectedAccountByIdRuntime(session.connected_account_id)
    : null
  const notetakerSettings = account?.workspace_id
    ? await getScopedSettingRuntime(account.workspace_id, "notetaker", defaultNotetaker)
    : await getSettingRuntime("notetaker", defaultNotetaker)

  if (!notetakerSettings.autoShareRecaps) {
    return session
  }

  const recipients = resolveAutoMeetingShareRecipients(session, notetakerSettings)
  if (!recipients.length) {
    return session
  }

  try {
    const result = await shareMeetingSessionRuntime(userId, session.id, {
      recipients,
      includeOrganizer: false,
      note: "Recap preparato automaticamente dal notetaker.",
      template: notetakerSettings.recapTemplate || 'standard',
    })
    return result.session || session
  } catch {
    return session
  }
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

  try {
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
  } catch (error) {
    await deleteStoredObject(storedObject.objectKey);
    throw error;
  }
}

export async function createMeetingUploadSessionRuntime(userId, payload = {}) {
  if (!postgresPrimaryEnabled()) {
    return createMeetingUploadSession(userId, payload);
  }

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

  try {
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

    return createMeetingSessionRuntime(userId, {
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
  } catch (error) {
    await deleteStoredObject(storedObject.objectKey);
    throw error;
  }
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

async function findMailboxThreadByExternalThreadIdPostgres(postgres, userId, accountId, externalThreadId) {
  if (!externalThreadId) {
    return null;
  }

  const result = await postgres.query(`
    SELECT *
    FROM mail_threads
    WHERE user_id = $1 AND connected_account_id = $2 AND external_thread_id = $3
    LIMIT 1
  `, [userId, accountId, externalThreadId]);
  return result.rows[0] || null;
}

async function deleteThreadArtifactsPostgres(postgres, threadId, userId = "") {
  if (userId) {
    await postgres.query("DELETE FROM draft_records WHERE user_id = $1 AND thread_id = $2", [userId, threadId]);
  } else {
    await postgres.query("DELETE FROM draft_records WHERE thread_id = $1", [threadId]);
  }
  await postgres.query("DELETE FROM thread_classifications WHERE thread_id = $1", [threadId]);
  await postgres.query("DELETE FROM mail_messages WHERE thread_id = $1", [threadId]);
  await postgres.query("DELETE FROM mail_threads WHERE id = $1", [threadId]);
}

async function listThreadMessagesPostgres(postgres, threadId) {
  const result = await postgres.query(`
    SELECT *
    FROM mail_messages
    WHERE thread_id = $1
    ORDER BY created_at ASC, id ASC
  `, [threadId]);
  return result.rows;
}

async function rebuildThreadFromMessagesPostgres(postgres, threadId) {
  const threadResult = await postgres.query("SELECT * FROM mail_threads WHERE id = $1 LIMIT 1", [threadId]);
  const thread = threadResult.rows[0] || null;
  if (!thread) {
    return null;
  }

  const messages = await listThreadMessagesPostgres(postgres, threadId);
  if (messages.length === 0) {
    await deleteThreadArtifactsPostgres(postgres, threadId, thread.user_id);
    return null;
  }

  const latestMessage = messages.at(-1);
  const latestIncomingMessage = [...messages].reverse().find((message) => message.role === "incoming") || latestMessage;
  await postgres.query(`
    UPDATE mail_threads
    SET subject = $1, from_name = $2, from_email = $3, snippet = $4, category = $5, status = $6, last_message_at = $7, needs_reply = $8
    WHERE id = $9
  `, [
    latestMessage.message_subject || thread.subject || "(senza oggetto)",
    latestIncomingMessage.sender_name || thread.from_name,
    latestIncomingMessage.sender_email || thread.from_email,
    threadSnippet(latestMessage.content || thread.snippet),
    latestMessage.role === "incoming" ? "todo" : "fyi",
    latestMessage.role === "incoming" && Number(latestMessage.is_read) === 0 ? "nuovo" : "archiviata",
    latestMessage.created_at || thread.last_message_at,
    latestMessage.role === "incoming" ? 1 : 0,
    threadId,
  ]);

  const updated = await postgres.query("SELECT * FROM mail_threads WHERE id = $1 LIMIT 1", [threadId]);
  return updated.rows[0] || null;
}

async function persistThreadMessagesPostgres(postgres, threadId, messages, source) {
  await postgres.query("DELETE FROM mail_messages WHERE thread_id = $1", [threadId]);

  let processedMessages = 0;
  for (const message of messages) {
    await postgres.query(`
      INSERT INTO mail_messages (
        id, thread_id, external_message_id, role, sender_name, sender_email, message_source, message_subject, is_read, internet_message_id, content, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
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
    ]);
    processedMessages += 1;
  }

  return processedMessages;
}

async function upsertMailboxThreadPostgres(postgres, userId, account, thread, source) {
  const existing = await findMailboxThreadByExternalThreadIdPostgres(
    postgres,
    userId,
    account.id,
    thread.externalThreadId || "",
  );

  const threadId = existing?.id || randomUUID();
  const row = {
    id: threadId,
    user_id: userId,
    connected_account_id: account.id,
    external_thread_id: thread.externalThreadId || "",
    thread_source: source,
    subject: thread.subject,
    from_name: thread.fromName,
    from_email: thread.fromEmail,
    snippet: thread.snippet,
    category: thread.category,
    status: thread.status,
    last_message_at: thread.lastMessageAt || nowIso(),
    needs_reply: thread.needsReply,
  };
  await upsertPostgresRecord(postgres, "mail_threads", row, ["id"]);
  const processedMessages = await persistThreadMessagesPostgres(postgres, threadId, thread.messages || [], source);
  return { threadId, processedMessages };
}

async function upsertDeltaMessagePostgres(postgres, userId, account, message, source) {
  let thread = await findMailboxThreadByExternalThreadIdPostgres(postgres, userId, account.id, message.externalThreadId || "");
  if (!thread) {
    const threadId = randomUUID();
    await upsertPostgresRecord(postgres, "mail_threads", {
      id: threadId,
      user_id: userId,
      connected_account_id: account.id,
      external_thread_id: message.externalThreadId || "",
      thread_source: source,
      subject: message.messageSubject || "(senza oggetto)",
      from_name: message.senderName || account.display_name || account.email,
      from_email: message.senderEmail || account.email,
      snippet: threadSnippet(message.content || ""),
      category: message.role === "incoming" ? "todo" : "fyi",
      status: message.role === "incoming" && message.isRead === false ? "nuovo" : "archiviata",
      last_message_at: message.createdAt || nowIso(),
      needs_reply: message.role === "incoming" ? 1 : 0,
    }, ["id"]);
    const created = await postgres.query("SELECT * FROM mail_threads WHERE id = $1 LIMIT 1", [threadId]);
    thread = created.rows[0] || null;
  }

  const existingMessageResult = await postgres.query(`
    SELECT *
    FROM mail_messages
    WHERE thread_id = $1 AND external_message_id = $2
    LIMIT 1
  `, [thread.id, message.externalMessageId || ""]);
  const existingMessage = existingMessageResult.rows[0] || null;

  await upsertPostgresRecord(postgres, "mail_messages", {
    id: existingMessage?.id || randomUUID(),
    thread_id: thread.id,
    external_message_id: message.externalMessageId || "",
    role: message.role,
    sender_name: message.senderName || "",
    sender_email: message.senderEmail || "",
    message_source: source,
    message_subject: message.messageSubject || "",
    is_read: message.isRead === false ? 0 : 1,
    internet_message_id: message.internetMessageId || "",
    content: message.content,
    created_at: message.createdAt || existingMessage?.created_at || nowIso(),
  }, ["id"]);

  await rebuildThreadFromMessagesPostgres(postgres, thread.id);
  return thread.id;
}

async function deleteMessageByExternalIdPostgres(postgres, userId, accountId, externalMessageId) {
  const result = await postgres.query(`
    SELECT mm.id AS message_id, mm.thread_id
    FROM mail_messages mm
    JOIN mail_threads mt ON mt.id = mm.thread_id
    WHERE mt.user_id = $1 AND mt.connected_account_id = $2 AND mm.external_message_id = $3
    LIMIT 1
  `, [userId, accountId, externalMessageId]);
  const row = result.rows[0] || null;
  if (!row) {
    return false;
  }

  await postgres.query("DELETE FROM mail_messages WHERE id = $1", [row.message_id]);
  await rebuildThreadFromMessagesPostgres(postgres, row.thread_id);
  return true;
}

async function deleteMailboxThreadByExternalThreadIdPostgres(postgres, userId, accountId, externalThreadId) {
  const thread = await findMailboxThreadByExternalThreadIdPostgres(postgres, userId, accountId, externalThreadId);
  if (!thread) {
    return false;
  }

  await deleteThreadArtifactsPostgres(postgres, thread.id, userId);
  return true;
}

async function cleanupLegacyThreadsForAccountPostgres(postgres, userId, accountId) {
  const result = await postgres.query(`
    SELECT id
    FROM mail_threads
    WHERE user_id = $1 AND connected_account_id = $2 AND external_thread_id = ''
  `, [userId, accountId]);

  for (const row of result.rows) {
    await deleteThreadArtifactsPostgres(postgres, row.id, userId);
  }
}

async function syncAccountMailbox(userId, account, options = {}) {
  const source = isDemoConnectedAccount(account) ? "demo" : "provider";
  const syncState = await getMailSyncStateRuntime(account.id);
  const webhookSubscription = await getWebhookSubscriptionRuntime(account.id);
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
          await updateConnectedAccountTokensRuntime(account.id, tokenUpdate);
        },
      });

    if (postgresPrimaryEnabled()) {
      await withPostgresTransaction(async (postgres) => {
        await cleanupLegacyThreadsForAccountPostgres(postgres, userId, account.id);

        for (const deletedThreadId of remoteState.deletedThreadIds || []) {
          if (await deleteMailboxThreadByExternalThreadIdPostgres(postgres, userId, account.id, deletedThreadId)) {
            processedThreads += 1;
          }
        }

        for (const deletedMessageId of remoteState.deletedMessageIds || []) {
          if (await deleteMessageByExternalIdPostgres(postgres, userId, account.id, deletedMessageId)) {
            processedMessages += 1;
          }
        }

        for (const thread of remoteState.threads || []) {
          const result = await upsertMailboxThreadPostgres(postgres, userId, account, thread, source);
          processedThreads += 1;
          processedMessages += result.processedMessages;
        }

        for (const message of remoteState.upsertMessages || []) {
          await upsertDeltaMessagePostgres(postgres, userId, account, message, source);
          processedThreads += 1;
          processedMessages += 1;
        }
      });

      await createSyncRunRuntime({
        userId,
        connectedAccountId: account.id,
        status: "completed",
        processedThreads,
        processedMessages,
      });

      await upsertMailSyncStateRuntime(account.id, {
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
            await updateConnectedAccountTokensRuntime(account.id, tokenUpdate);
          },
        });

        if (subscription) {
          await upsertWebhookSubscriptionRuntime(account.id, subscription);
          if (subscription.syncCursor) {
            await upsertMailSyncStateRuntime(account.id, {
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
    }

    cleanupLegacyThreadsForAccount(userId, account.id);

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

    await createSyncRunRuntime({
      userId,
      connectedAccountId: account.id,
      status: "completed",
      processedThreads,
      processedMessages,
    });

    await upsertMailSyncStateRuntime(account.id, {
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
          await updateConnectedAccountTokensRuntime(account.id, tokenUpdate);
        },
      });

      if (subscription) {
        await upsertWebhookSubscriptionRuntime(account.id, subscription);
        if (subscription.syncCursor) {
          await upsertMailSyncStateRuntime(account.id, {
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
    await createSyncRunRuntime({
      userId,
      connectedAccountId: account.id,
      status: "failed",
      processedThreads,
      processedMessages,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    if (source !== "demo") {
      await upsertWebhookSubscriptionRuntime(account.id, {
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

  const categorization = await categorizeMailbox(userId, {
    ...(accountId ? { accountId } : {}),
    workspaceId: accounts[0]?.workspace_id || "",
  });

  return {
    syncedAccounts: accounts.length,
    processedThreads,
    processedMessages,
    categorizedThreads: categorization.processedThreads,
  };
}

export async function syncMailboxRuntime(userId, accountId = null, options = {}) {
  const accounts = accountId
    ? (await listConnectedAccountsRuntime(userId)).filter((account) => account.id === accountId)
    : await listConnectedAccountsRuntime(userId);

  const supportedAccounts = accounts.filter((account) => ["google", "microsoft"].includes(account?.provider) && accountCapabilities(account).includes("mail"));
  if (accountId && supportedAccounts.length === 0) {
    const error = new Error("Mail sync not supported for this provider");
    error.status = 400;
    throw error;
  }

  if (supportedAccounts.length === 0) {
    return {
      syncedAccounts: 0,
      processedThreads: 0,
      processedMessages: 0,
      categorizedThreads: 0,
    };
  }

  let processedThreads = 0;
  let processedMessages = 0;

  for (const account of supportedAccounts) {
    const item = await syncAccountMailbox(userId, account, options);
    processedThreads += item.processedThreads;
    processedMessages += item.processedMessages;
  }

  const categorization = await categorizeMailboxRuntime(userId, {
    ...(accountId ? { accountId } : {}),
    workspaceId: supportedAccounts[0]?.workspace_id || "",
  });
  const result = {
    syncedAccounts: supportedAccounts.length,
    processedThreads,
    processedMessages,
    categorizedThreads: categorization.processedThreads,
  };
  return result;
}

export async function maintainWebhookSubscriptions() {
  const accounts = await listAllConnectedAccountsRuntime();

  let checkedAccounts = 0;
  let renewedSubscriptions = 0;
  let failedSubscriptions = 0;

  for (const account of accounts) {
    if (!["google", "microsoft"].includes(account.provider) || !accountCapabilities(account).includes("mail")) {
      continue;
    }

    if (isDemoConnectedAccount(account)) {
      continue;
    }

    checkedAccounts += 1;
    const existingSubscription = await getWebhookSubscriptionRuntime(account.id);

    try {
      const subscription = await ensureMailboxSubscription(account, existingSubscription, {
        onTokenRefresh: async (tokenUpdate) => {
          await updateConnectedAccountTokensRuntime(account.id, tokenUpdate);
        },
      });

      if (!subscription) {
        continue;
      }

      await upsertWebhookSubscriptionRuntime(account.id, subscription);
      if (subscription.syncCursor) {
        await upsertMailSyncStateRuntime(account.id, {
          syncCursor: subscription.syncCursor,
        });
      }
      renewedSubscriptions += 1;
    } catch (error) {
      failedSubscriptions += 1;
      await upsertWebhookSubscriptionRuntime(account.id, {
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

export async function listMailThreads(userId, { workspaceId = "" } = {}) {
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

  const [emailRules, categoryOverrides] = workspaceId
    ? await Promise.all([
      listEmailRulesRuntime(workspaceId),
      listThreadCategoryOverridesRuntime(workspaceId),
    ])
    : [defaultEmailRules, {}];

  return rows.map((thread) => {
    const resolved = applyThreadClassificationPolicies(thread, {
      category: thread.category,
      topicLabel: thread.topic_label || "",
      inboxAction: thread.inbox_action || "keep_default",
      reason: thread.category_reason || "",
      confidence: Number(thread.confidence || 0.7),
    }, emailRules, categoryOverrides);
    const eligibility = evaluateDraftEligibility(thread, thread);
    return {
      ...thread,
      category: resolved.category,
      inbox_action: resolved.inboxAction,
      category_reason: resolved.reason,
      manual_override: Boolean(resolved.manualOverride),
      matched_rule_id: resolved.matchedRuleId || "",
      matched_rule_name: resolved.matchedRuleName || "",
      draft_eligible: eligibility.eligible,
      draft_eligibility_reason: eligibility.reason,
    };
  });
}

export async function listMailThreadsRuntime(userId, { workspaceId = "" } = {}) {
  if (!postgresPrimaryEnabled()) {
    return listMailThreads(userId, { workspaceId });
  }

  try {
    const rows = await queryPostgresRows(`
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
      WHERE mt.user_id = $1
      ORDER BY mt.last_message_at DESC
    `, [userId]);

    const [emailRules, categoryOverrides] = workspaceId
      ? await Promise.all([
        listEmailRulesRuntime(workspaceId),
        listThreadCategoryOverridesRuntime(workspaceId),
      ])
      : [defaultEmailRules, {}];

    return rows.map((thread) => {
      const resolved = applyThreadClassificationPolicies(thread, {
        category: thread.category,
        topicLabel: thread.topic_label || "",
        inboxAction: thread.inbox_action || "keep_default",
        reason: thread.category_reason || "",
        confidence: Number(thread.confidence || 0.7),
      }, emailRules, categoryOverrides);
      const eligibility = evaluateDraftEligibility(thread, thread);
      return {
        ...thread,
        category: resolved.category,
        inbox_action: resolved.inboxAction,
        category_reason: resolved.reason,
        manual_override: Boolean(resolved.manualOverride),
        matched_rule_id: resolved.matchedRuleId || "",
        matched_rule_name: resolved.matchedRuleName || "",
        draft_eligible: eligibility.eligible,
        draft_eligibility_reason: eligibility.reason,
      };
    });
  } catch {
    return listMailThreads(userId, { workspaceId });
  }
}

export async function listAwaitingReplyThreadsRuntime(userId, { workspaceId = "" } = {}) {
  const draftsSettings = workspaceId
    ? await getScopedSettingRuntime(workspaceId, "drafts", defaultDrafts)
    : await getSettingRuntime("drafts", defaultDrafts);
  if (!draftsSettings.enableFollowUps) {
    return [];
  }

  const threads = await listMailThreadsRuntime(userId, { workspaceId });
  const threadIds = threads.map((thread) => thread.id);
  const messageRows = listSqliteRowsByValues("mail_messages", "thread_id", threadIds);
  const messagesByThread = new Map();

  for (const message of messageRows) {
    const bucket = messagesByThread.get(message.thread_id) || [];
    bucket.push(message);
    messagesByThread.set(message.thread_id, bucket);
  }

  const followUpDays = Math.max(1, Number(draftsSettings.followUpDays || 3));
  const followUpMs = followUpDays * 24 * 60 * 60 * 1000;

  return threads
    .map((thread) => {
      const messages = (messagesByThread.get(thread.id) || []).sort(
        (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
      );
      const latestOutgoing = messages.find((message) => message.role === "outgoing");
      if (!latestOutgoing) {
        return null;
      }

      const outgoingTime = new Date(latestOutgoing.created_at).getTime();
      if (!Number.isFinite(outgoingTime)) {
        return null;
      }

      const latestIncomingAfterReply = messages.find((message) => {
        if (message.role !== "incoming") {
          return false;
        }

        const incomingTime = new Date(message.created_at).getTime();
        return Number.isFinite(incomingTime) && incomingTime > outgoingTime;
      });
      if (latestIncomingAfterReply) {
        return null;
      }

      if (Date.now() - outgoingTime < followUpMs) {
        return null;
      }

      return {
        id: thread.id,
        subject: thread.subject,
        from_name: thread.from_name,
        from_email: thread.from_email,
        account_email: thread.account_email || "",
        category: thread.category,
        last_message_at: thread.last_message_at,
        awaiting_reply_since: latestOutgoing.created_at,
        follow_up_due_at: new Date(outgoingTime + followUpMs).toISOString(),
        waiting_days: Math.max(1, Math.floor((Date.now() - outgoingTime) / (24 * 60 * 60 * 1000))),
        snippet: thread.snippet,
      };
    })
    .filter(Boolean)
    .sort((left, right) => new Date(left.follow_up_due_at).getTime() - new Date(right.follow_up_due_at).getTime());
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

async function listThreadsForCategorizationRuntime(userId, { accountId = null, threadId = null } = {}) {
  if (!postgresPrimaryEnabled()) {
    return listThreadsForCategorization(userId, { accountId, threadId });
  }

  const filters = ["user_id = $1"];
  const params = [userId];

  if (accountId) {
    params.push(accountId);
    filters.push(`connected_account_id = $${params.length}`);
  }

  if (threadId) {
    params.push(threadId);
    filters.push(`id = $${params.length}`);
  }

  try {
    return await queryPostgresRows(`
      SELECT *
      FROM mail_threads
      WHERE ${filters.join(" AND ")}
      ORDER BY last_message_at DESC
    `, params);
  } catch {
    return listThreadsForCategorization(userId, { accountId, threadId });
  }
}

export async function categorizeMailbox(userId, { accountId = null, threadId = null, workspaceId = "" } = {}) {
  const threads = listThreadsForCategorization(userId, { accountId, threadId });
  const settings = workspaceId
    ? await getScopedSettingRuntime(workspaceId, "categorization", defaultCategorization)
    : getSetting("categorization", defaultCategorization);
  const emailRules = workspaceId ? await listEmailRulesRuntime(workspaceId) : defaultEmailRules;
  const categoryOverrides = workspaceId ? await listThreadCategoryOverridesRuntime(workspaceId) : {};
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
    const resolved = applyThreadClassificationPolicies(thread, classification, emailRules, categoryOverrides);

    db.prepare("UPDATE mail_threads SET category = ? WHERE id = ?").run(resolved.category, thread.id);

    if (existing) {
      db.prepare(`
        UPDATE thread_classifications
        SET category = ?, topic_label = ?, inbox_action = ?, reason = ?, confidence = ?, updated_at = ?
        WHERE thread_id = ?
      `).run(
        resolved.category,
        resolved.topicLabel,
        resolved.inboxAction,
        resolved.reason,
        resolved.confidence,
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
        resolved.category,
        resolved.topicLabel,
        resolved.inboxAction,
        resolved.reason,
        resolved.confidence,
        now,
      );
    }

    updatedThreads += 1;
    counts[resolved.category] = (counts[resolved.category] || 0) + 1;
    if (resolved.topicLabel) {
      topics[resolved.topicLabel] = (topics[resolved.topicLabel] || 0) + 1;
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

export async function categorizeMailboxRuntime(userId, { accountId = null, threadId = null, workspaceId = "" } = {}) {
  if (!postgresPrimaryEnabled()) {
    return categorizeMailbox(userId, { accountId, threadId, workspaceId });
  }

  const threads = await listThreadsForCategorizationRuntime(userId, { accountId, threadId });
  const settings = workspaceId
    ? await getScopedSettingRuntime(workspaceId, "categorization", defaultCategorization)
    : await getSettingRuntime("categorization", defaultCategorization);
  const emailRules = workspaceId ? await listEmailRulesRuntime(workspaceId) : defaultEmailRules;
  const categoryOverrides = workspaceId ? await listThreadCategoryOverridesRuntime(workspaceId) : {};
  const counts = {};
  const topics = {};
  let updatedThreads = 0;
  const now = nowIso();
  const classifications = await classifyMailThreads(threads, settings);

  await withPostgresTransaction(async (postgres) => {
    for (const thread of threads) {
      const classification = classifications.get(thread.id);
      if (!classification) {
        continue;
      }
      const resolved = applyThreadClassificationPolicies(thread, classification, emailRules, categoryOverrides);

      await postgres.query("UPDATE mail_threads SET category = $1 WHERE id = $2", [
        resolved.category,
        thread.id,
      ]);

      await upsertPostgresRecord(postgres, "thread_classifications", {
        thread_id: thread.id,
        user_id: userId,
        category: resolved.category,
        topic_label: resolved.topicLabel,
        inbox_action: resolved.inboxAction,
        reason: resolved.reason,
        confidence: resolved.confidence,
        updated_at: now,
      }, ["thread_id"]);

      updatedThreads += 1;
      counts[resolved.category] = (counts[resolved.category] || 0) + 1;
      if (resolved.topicLabel) {
        topics[resolved.topicLabel] = (topics[resolved.topicLabel] || 0) + 1;
      }
    }

    await upsertPostgresRecord(postgres, "classification_runs", {
      id: randomUUID(),
      user_id: userId,
      processed_threads: threads.length,
      updated_threads: updatedThreads,
      created_at: now,
    }, ["id"]);
  });

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

export async function listDraftRecordsRuntime(userId) {
  if (!postgresPrimaryEnabled()) {
    return listDraftRecords(userId);
  }

  try {
    return await queryPostgresRows(`
      SELECT dr.*, mt.subject AS thread_subject, mt.from_name, mt.from_email, ca.provider AS account_provider, ca.email AS account_email
      FROM draft_records dr
      JOIN mail_threads mt ON mt.id = dr.thread_id
      JOIN connected_accounts ca ON ca.id = dr.connected_account_id
      WHERE dr.user_id = $1
      ORDER BY dr.updated_at DESC
    `, [userId]);
  } catch {
    return listDraftRecords(userId);
  }
}

function listThreadMessages(threadId) {
  return db.prepare(`
    SELECT *
    FROM mail_messages
    WHERE thread_id = ?
    ORDER BY datetime(created_at) ASC, id ASC
  `).all(threadId);
}

async function listThreadMessagesRuntime(threadId) {
  if (!postgresPrimaryEnabled()) {
    return listThreadMessages(threadId);
  }

  try {
    return await queryPostgresRows(`
      SELECT *
      FROM mail_messages
      WHERE thread_id = $1
      ORDER BY created_at ASC, id ASC
    `, [threadId]);
  } catch {
    return listThreadMessages(threadId);
  }
}

function trimPromptChunk(value = "", limit = 1200) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

function fallbackDraftContent(thread, account, preferences) {
  const signature = preferences.includeSignature && preferences.defaultSignature
    ? `\n\n${preferences.defaultSignature}`
    : "";
  const schedulingBlock = preferences.includeSchedulingLink && preferences.schedulingSignature
    ? `\n\n${preferences.schedulingSignature.replaceAll("{{scheduling_link}}", preferences.schedulingLink || "[link pianificazione]")}`
    : "";

  return [
    `Ciao ${thread.from_name.split(" ")[0]},`,
    "",
    `grazie per il messaggio su "${thread.subject}". Ho ricevuto tutto e ti rispondo dal backend privato di MailMind.`,
    "Procedo con una proposta di risposta chiara e professionale, pronta per essere rifinita prima dell'invio.",
    "",
    "A presto,",
    account.display_name || account.email || "MailMind",
  ].join("\n") + schedulingBlock + signature;
}

function fallbackDraftVariants(thread, account, preferences) {
  const recipientName = String(thread.from_name || thread.from_email || "").split(" ")[0] || "team"
  const signature = preferences.includeSignature && preferences.defaultSignature
    ? `\n\n${preferences.defaultSignature}`
    : ""

  const variants = [
    {
      label: "Diretta",
      description: "Conferma ricezione e propone il prossimo passo in modo conciso.",
      content: [
        `Ciao ${recipientName},`,
        "",
        `grazie per il messaggio su "${thread.subject}". Ho preso in carico la richiesta e ti confermo che ti aggiorno a breve con il prossimo passo operativo.`,
        "",
        "A presto,",
        account.display_name || account.email || "MailMind",
      ].join("\n") + signature,
    },
    {
      label: "Collaborativa",
      description: "Tono piu' aperto, utile quando vuoi mantenere dialogo e disponibilita'.",
      content: [
        `Ciao ${recipientName},`,
        "",
        `grazie per avermi scritto. Ho visto il thread "${thread.subject}" e sono allineato sul contesto: se per te va bene, procedo con una risposta operativa o con i dettagli mancanti per chiudere il punto rapidamente.`,
        "",
        "Resto volentieri a disposizione,",
        account.display_name || account.email || "MailMind",
      ].join("\n") + signature,
    },
    {
      label: "Formale",
      description: "Versione piu' istituzionale, adatta a clienti o stakeholder esterni.",
      content: [
        `Gentile ${thread.from_name || recipientName},`,
        "",
        `La ringrazio per il messaggio relativo a "${thread.subject}". Confermo la presa in carico e Le inviero' un aggiornamento puntuale con il prossimo passo da parte mia nel piu' breve tempo possibile.`,
        "",
        "Cordiali saluti,",
        account.display_name || account.email || "MailMind",
      ].join("\n") + signature,
    },
  ]

  return variants.slice(0, Math.max(1, Number(preferences.draftVariants || 3)))
}

function cleanVariantBody(value = "") {
  return String(value || "").trim().replace(/^```\w*\s*/i, "").replace(/\s*```$/i, "").trim()
}

async function generateDraftVariants(thread, account, preferences, messageRows = null) {
  const fallback = fallbackDraftVariants(thread, account, preferences)
  if (!hasGeminiCredentials()) {
    return fallback
  }

  const messages = (messageRows || listThreadMessages(thread.id))
    .slice(-8)
    .map((message) => [
      `[${message.role} | ${message.sender_name || message.sender_email || "sconosciuto"} | ${message.created_at}]`,
      trimPromptChunk(message.content, 1200),
    ].join("\n"))
    .join("\n\n")

  const toneLabel = preferences.customTone && preferences.customToneText
    ? preferences.customToneText
    : "professionale, conciso e naturale"
  const signature = preferences.includeSignature && preferences.defaultSignature
    ? preferences.defaultSignature.trim()
    : ""
  const schedulingBlock = preferences.includeSchedulingLink && preferences.schedulingSignature
    ? preferences.schedulingSignature.replaceAll("{{scheduling_link}}", preferences.schedulingLink || "[link pianificazione]").trim()
    : ""
  const variantCount = Math.max(1, Math.min(3, Number(preferences.draftVariants || 3)))

  const prompt = [
    `Genera ${variantCount} varianti di risposta email in JSON.`,
    "Restituisci un oggetto con chiave variants e array di oggetti { label, description, content }.",
    "Le varianti devono essere tra loro diverse per taglio: una piu diretta, una piu collaborativa, una piu formale se richiesta.",
    "Non inventare fatti non presenti nel thread.",
    signature ? "Non includere la firma nel contenuto: verra aggiunta dal sistema." : "Ogni variante puo chiudersi con un saluto naturale.",
    schedulingBlock ? `Quando opportuno, includi questa chiusura di scheduling: ${schedulingBlock}` : "",
    `Tono richiesto: ${toneLabel}`,
    `Mittente account: ${account.display_name || account.email}`,
    `Subject thread: ${thread.subject}`,
    `Contatto principale: ${thread.from_name} <${thread.from_email}>`,
    "Conversazione:",
    messages || "(nessun messaggio disponibile)",
  ].join("\n")

  try {
    const result = await generateJsonWithGemini({
      model: process.env.GEMINI_DRAFT_MODEL || process.env.GEMINI_MODEL || "gemini-2.0-flash",
      systemInstruction: "Sei un assistente email per professionisti italiani. Restituisci solo JSON valido.",
      prompt,
      maxOutputTokens: 1200,
    })

    const variants = Array.isArray(result.json?.variants)
      ? result.json.variants.map((variant, index) => ({
        label: String(variant?.label || fallback[index]?.label || `Variante ${index + 1}`).trim(),
        description: String(variant?.description || fallback[index]?.description || "").trim(),
        content: cleanVariantBody(variant?.content || fallback[index]?.content || ""),
      })).filter((variant) => variant.content)
      : []

    if (!variants.length) {
      return fallback
    }

    return variants.slice(0, variantCount).map((variant) => ({
      ...variant,
      content: [variant.content, schedulingBlock, signature].filter(Boolean).join('\n\n'),
    }))
  } catch {
    return fallback
  }
}

async function generateDraftContent(thread, account, preferences, messageRows = null) {
  const fallback = fallbackDraftContent(thread, account, preferences);
  if (!hasGeminiCredentials()) {
    return fallback;
  }

  const messages = (messageRows || listThreadMessages(thread.id))
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
  const schedulingBlock = preferences.includeSchedulingLink && preferences.schedulingSignature
    ? preferences.schedulingSignature.replaceAll("{{scheduling_link}}", preferences.schedulingLink || "[link pianificazione]").trim()
    : "";

  const prompt = [
    "Scrivi il corpo di una email di risposta.",
    "Restituisci solo il testo finale dell'email, in plain text, senza markdown e senza subject.",
    "Non inventare fatti non presenti nel thread.",
    "Se mancano dettagli, usa una risposta prudente che confermi ricezione e proponga il passo successivo.",
    "Mantieni il tono richiesto.",
    signature ? "Non aggiungere la firma: verra appesa dal sistema." : "Chiudi con un saluto naturale.",
    schedulingBlock ? `Se la conversazione riguarda appuntamenti o disponibilita, integra anche questa nota: ${schedulingBlock}` : "",
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

    return [body, schedulingBlock, signature].filter(Boolean).join("\n\n");
  } catch {
    return fallback;
  }
}

function getDraftRecordById(userId, draftId) {
  return db.prepare("SELECT * FROM draft_records WHERE id = ? AND user_id = ?").get(draftId, userId);
}

async function getDraftRecordByIdRuntime(userId, draftId) {
  if (!postgresPrimaryEnabled()) {
    return getDraftRecordById(userId, draftId);
  }

  try {
    const row = await queryPostgresRow(
      "SELECT * FROM draft_records WHERE id = $1 AND user_id = $2",
      [draftId, userId],
    );
    return row || getDraftRecordById(userId, draftId);
  } catch {
    return getDraftRecordById(userId, draftId);
  }
}

function getThreadClassification(threadId) {
  return db.prepare("SELECT * FROM thread_classifications WHERE thread_id = ?").get(threadId) || null;
}

async function getThreadClassificationRuntime(threadId) {
  if (!postgresPrimaryEnabled()) {
    return getThreadClassification(threadId);
  }

  try {
    const row = await queryPostgresRow(
      "SELECT * FROM thread_classifications WHERE thread_id = $1",
      [threadId],
    );
    return row || getThreadClassification(threadId);
  } catch {
    return getThreadClassification(threadId);
  }
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

async function getLatestReplyTargetMessageRuntime(threadId) {
  if (!postgresPrimaryEnabled()) {
    return getLatestReplyTargetMessage(threadId);
  }

  try {
    const latestIncoming = await queryPostgresRow(`
      SELECT *
      FROM mail_messages
      WHERE thread_id = $1 AND role = 'incoming' AND external_message_id != ''
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `, [threadId]);
    if (latestIncoming) {
      return latestIncoming;
    }

    return await queryPostgresRow(`
      SELECT *
      FROM mail_messages
      WHERE thread_id = $1 AND external_message_id != ''
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `, [threadId]);
  } catch {
    return getLatestReplyTargetMessage(threadId);
  }
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

async function updateDraftProviderStateRuntime(userId, draftId, patch) {
  if (!postgresPrimaryEnabled()) {
    return updateDraftProviderState(draftId, patch);
  }

  try {
    const existing = await getDraftRecordByIdRuntime(userId, draftId);
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

    await queryPostgres(`
      UPDATE draft_records
      SET provider_draft_id = $1, provider_message_id = $2, provider_push_status = $3, provider_last_error = $4, provider_pushed_at = $5, updated_at = $6
      WHERE id = $7 AND user_id = $8
    `, [
      next.provider_draft_id,
      next.provider_message_id,
      next.provider_push_status,
      next.provider_last_error,
      next.provider_pushed_at,
      next.updated_at,
      draftId,
      userId,
    ]);

    return getDraftRecordByIdRuntime(userId, draftId);
  } catch {
    return updateDraftProviderState(draftId, patch);
  }
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

async function writeDraftToProviderRuntime(userId, draftId) {
  if (!postgresPrimaryEnabled()) {
    return writeDraftToProvider(userId, draftId);
  }

  const draft = await getDraftRecordByIdRuntime(userId, draftId);
  if (!draft) {
    return null;
  }

  const thread = await queryPostgresRow(
    "SELECT * FROM mail_threads WHERE id = $1 AND user_id = $2",
    [draft.thread_id, userId],
  );
  if (!thread) {
    return null;
  }

  const account = await findConnectedAccountByIdRuntime(draft.connected_account_id);
  if (!account || account.user_id !== userId) {
    return null;
  }

  if (isDemoConnectedAccount(account)) {
    return updateDraftProviderStateRuntime(userId, draft.id, {
      providerPushStatus: "local_only",
      providerLastError: "",
      providerPushedAt: "",
    });
  }

  const replyTarget = await getLatestReplyTargetMessageRuntime(thread.id);

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
        await updateConnectedAccountTokensRuntime(account.id, tokenUpdate);
      },
    });

    return updateDraftProviderStateRuntime(userId, draft.id, {
      providerDraftId: result.providerDraftId,
      providerMessageId: result.providerMessageId,
      providerPushStatus: "synced",
      providerLastError: "",
      providerPushedAt: result.pushedAt || nowIso(),
    });
  } catch (error) {
    await updateDraftProviderStateRuntime(userId, draft.id, {
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

  const preferences = account.workspace_id
    ? await getScopedSettingRuntime(account.workspace_id, "drafts", defaultDrafts)
    : getSetting("drafts", defaultDrafts);
  const existing = db.prepare("SELECT * FROM draft_records WHERE thread_id = ? AND user_id = ?").get(threadId, userId);
  const now = nowIso();
  const toneLabel = preferences.customTone && preferences.customToneText
    ? preferences.customToneText
    : "Tono professionale e conciso";
  const content = options.customContent || await generateDraftContent(thread, account, preferences);

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

export async function createDraftForThreadRuntime(userId, threadId, options = {}) {
  if (!postgresPrimaryEnabled()) {
    return createDraftForThread(userId, threadId, options);
  }

  const thread = await queryPostgresRow(
    "SELECT * FROM mail_threads WHERE id = $1 AND user_id = $2",
    [threadId, userId],
  );
  if (!thread) {
    return null;
  }

  const account = await findConnectedAccountByIdRuntime(thread.connected_account_id);
  if (!account) {
    return null;
  }

  const classification = await getThreadClassificationRuntime(thread.id);
  const eligibility = evaluateDraftEligibility(thread, classification);
  if (!eligibility.eligible && options.force !== true) {
    const error = new Error(eligibility.reason);
    error.status = 400;
    throw error;
  }

  const preferences = account.workspace_id
    ? await getScopedSettingRuntime(account.workspace_id, "drafts", defaultDrafts)
    : await getSettingRuntime("drafts", defaultDrafts);
  const existing = await queryPostgresRow(
    "SELECT * FROM draft_records WHERE thread_id = $1 AND user_id = $2",
    [threadId, userId],
  );
  const now = nowIso();
  const toneLabel = preferences.customTone && preferences.customToneText
    ? preferences.customToneText
    : "Tono professionale e conciso";
  const messages = await listThreadMessagesRuntime(thread.id);
  const content = options.customContent || await generateDraftContent(thread, account, preferences, messages);

  if (existing) {
    await queryPostgres(`
      UPDATE draft_records
      SET subject = $1, content = $2, tone = $3, status = $4, updated_at = $5
      WHERE id = $6 AND user_id = $7
    `, [`Re: ${thread.subject}`, content, toneLabel, "generated", now, existing.id, userId]);
    const updated = await getDraftRecordByIdRuntime(userId, existing.id);
    if (options.pushToProvider === false) {
      return updated;
    }

    try {
      return await writeDraftToProviderRuntime(userId, updated.id);
    } catch {
      return getDraftRecordByIdRuntime(userId, updated.id);
    }
  }

  const id = randomUUID();
  await upsertPostgresNow("draft_records", {
    id,
    user_id: userId,
    connected_account_id: thread.connected_account_id,
    thread_id: threadId,
    subject: `Re: ${thread.subject}`,
    content,
    tone: toneLabel,
    status: "generated",
    provider_draft_id: "",
    provider_message_id: "",
    provider_push_status: isDemoConnectedAccount(account) ? "local_only" : "pending",
    provider_last_error: "",
    provider_pushed_at: "",
    created_at: now,
    updated_at: now,
  }, ["id"]);

  const created = await getDraftRecordByIdRuntime(userId, id);
  if (options.pushToProvider === false) {
    return created;
  }

  try {
    return await writeDraftToProviderRuntime(userId, created.id);
  } catch {
    return getDraftRecordByIdRuntime(userId, created.id);
  }
}

export async function generateDraftOptionsForThreadRuntime(userId, threadId, { workspaceId = "" } = {}) {
  const thread = await findMailThreadRuntime(userId, threadId)
  if (!thread) {
    return null
  }

  const account = await findConnectedAccountByIdRuntime(thread.connected_account_id)
  if (!account) {
    return null
  }

  const classification = await getThreadClassificationRuntime(thread.id)
  const eligibility = evaluateDraftEligibility(thread, classification)
  if (!eligibility.eligible) {
    const error = new Error(eligibility.reason)
    error.status = 400
    throw error
  }

  const preferences = workspaceId
    ? await getScopedSettingRuntime(workspaceId, "drafts", defaultDrafts)
    : await getSettingRuntime("drafts", defaultDrafts)
  const messages = await listThreadMessagesRuntime(thread.id)
  const variants = await generateDraftVariants(thread, account, preferences, messages)

  return {
    thread: {
      id: thread.id,
      subject: thread.subject,
      from_name: thread.from_name,
      from_email: thread.from_email,
    },
    variants,
  }
}

export async function pushDraftRecord(userId, draftId) {
  const draft = getDraftRecordById(userId, draftId);
  if (!draft) {
    return null;
  }

  return writeDraftToProvider(userId, draftId);
}

export async function pushDraftRecordRuntime(userId, draftId) {
  if (!postgresPrimaryEnabled()) {
    return pushDraftRecord(userId, draftId);
  }

  return writeDraftToProviderRuntime(userId, draftId);
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

export async function deleteDraftRecordRuntime(userId, draftId, options = {}) {
  if (!postgresPrimaryEnabled()) {
    return deleteDraftRecord(userId, draftId, options);
  }

  const draft = await getDraftRecordByIdRuntime(userId, draftId);
  if (!draft) {
    return null;
  }

  const account = await findConnectedAccountByIdRuntime(draft.connected_account_id);
  if (
    options.deleteProvider !== false
    && account
    && account.user_id === userId
    && !isDemoConnectedAccount(account)
    && (draft.provider_draft_id || draft.provider_message_id)
  ) {
    try {
      await deleteProviderDraft(account, {
        providerDraftId: draft.provider_draft_id || "",
        providerMessageId: draft.provider_message_id || "",
      }, {
        onTokenRefresh: async (tokenUpdate) => {
          await updateConnectedAccountTokensRuntime(account.id, tokenUpdate);
        },
      });
    } catch (error) {
      await updateDraftProviderStateRuntime(userId, draft.id, {
        providerPushStatus: "push_failed",
        providerLastError: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  await queryPostgres("DELETE FROM draft_records WHERE id = $1 AND user_id = $2", [draftId, userId]);
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

export async function generateDraftsForPendingThreadsRuntime(userId, options = {}) {
  if (!postgresPrimaryEnabled()) {
    return generateDraftsForPendingThreads(userId, options);
  }

  const threads = await queryPostgresRows(`
    SELECT *
    FROM mail_threads
    WHERE user_id = $1 AND needs_reply = 1 AND category = 'todo'
    ORDER BY last_message_at DESC
  `, [userId]);

  const createdDrafts = [];
  for (const thread of threads) {
    const classification = await getThreadClassificationRuntime(thread.id);
    if (!evaluateDraftEligibility(thread, classification).eligible) {
      continue;
    }

    const draft = await createDraftForThreadRuntime(userId, thread.id, options);
    if (draft) {
      createdDrafts.push(draft);
    }
  }

  return createdDrafts;
}
