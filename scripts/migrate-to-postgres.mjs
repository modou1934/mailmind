import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { db } from "../server/db.js";

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const TABLES = [
  "users",
  "workspaces",
  "workspace_members",
  "sessions",
  "teams",
  "team_members",
  "invites",
  "connected_accounts",
  "sync_runs",
  "mail_threads",
  "mail_messages",
  "draft_records",
  "thread_classifications",
  "classification_runs",
  "mail_sync_state",
  "webhook_subscriptions",
  "oauth_states",
  "settings",
  "notifications",
  "audit_logs",
  "chat_conversations",
  "chat_messages",
  "calendar_events",
  "meeting_sessions",
];

function requireDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL || "";
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL");
  }
  return databaseUrl;
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, "\"\"")}"`;
}

function tableColumns(tableName) {
  return db.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name);
}

async function ensureSchema(client) {
  const schemaPath = join(__dirname, "..", "postgres", "001_init.sql");
  const sql = readFileSync(schemaPath, "utf8");
  await client.query(sql);
}

async function migrateTable(client, tableName) {
  const columns = tableColumns(tableName);
  if (columns.length === 0) {
    return 0;
  }

  const rows = db.prepare(`SELECT * FROM ${tableName}`).all();
  if (rows.length === 0) {
    return 0;
  }

  const columnList = columns.map(quoteIdentifier).join(", ");
  let inserted = 0;

  for (const row of rows) {
    const values = columns.map((column) => row[column]);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
    const sql = `INSERT INTO ${quoteIdentifier(tableName)} (${columnList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
    await client.query(sql, values);
    inserted += 1;
  }

  return inserted;
}

async function main() {
  const client = new Client({
    connectionString: requireDatabaseUrl(),
  });

  await client.connect();
  try {
    await client.query("BEGIN");
    await ensureSchema(client);

    const results = [];
    for (const tableName of TABLES) {
      const inserted = await migrateTable(client, tableName);
      results.push({ table: tableName, inserted });
    }

    await client.query("COMMIT");
    console.log(JSON.stringify({
      migrated: true,
      tables: results,
    }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
