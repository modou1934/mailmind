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
  created_at TEXT NOT NULL,
  error_message TEXT DEFAULT ''
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
  message_subject TEXT DEFAULT '',
  is_read INTEGER NOT NULL DEFAULT 1,
  internet_message_id TEXT DEFAULT '',
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
  provider_draft_id TEXT DEFAULT '',
  provider_message_id TEXT DEFAULT '',
  provider_push_status TEXT NOT NULL DEFAULT 'local_only',
  provider_last_error TEXT DEFAULT '',
  provider_pushed_at TEXT DEFAULT '',
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

CREATE UNIQUE INDEX IF NOT EXISTS mail_threads_external_thread_id_idx
ON mail_threads(user_id, connected_account_id, external_thread_id)
WHERE external_thread_id <> '';

CREATE UNIQUE INDEX IF NOT EXISTS mail_messages_external_message_id_idx
ON mail_messages(thread_id, external_message_id)
WHERE external_message_id <> '';

CREATE UNIQUE INDEX IF NOT EXISTS calendar_events_external_event_id_idx
ON calendar_events(user_id, connected_account_id, external_event_id);
