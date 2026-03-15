import pg from "pg";

const { Client } = pg;

const TABLES = [
  "users",
  "connected_accounts",
  "mail_threads",
  "draft_records",
  "calendar_events",
  "meeting_sessions",
  "audit_logs",
];

function requireDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL || "";
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL");
  }
  return databaseUrl;
}

async function main() {
  const client = new Client({
    connectionString: requireDatabaseUrl(),
  });

  await client.connect();
  try {
    const results = [];
    for (const tableName of TABLES) {
      const payload = await client.query(`SELECT COUNT(*)::int AS count FROM "${tableName}"`);
      results.push({
        table: tableName,
        count: payload.rows[0]?.count || 0,
      });
    }

    console.log(JSON.stringify({
      verified: true,
      tables: results,
    }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
