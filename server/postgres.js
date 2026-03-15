import pg from "pg";

const { Pool } = pg;
const POSTGRES_STATUS_TTL_MS = 30_000;

const runtimeState = {
  configured: false,
  mirrorEnabled: false,
  primaryEnabled: false,
  reachable: false,
  lastCheckedAt: "",
  lastError: "",
};

let pool = null;
let mirrorQueue = Promise.resolve();

function databaseUrl() {
  return process.env.DATABASE_URL || "";
}

function mirrorEnabled() {
  return process.env.POSTGRES_MIRROR_ENABLED === "true";
}

function primaryEnabled() {
  return process.env.POSTGRES_PRIMARY_ENABLED === "true";
}

export function isPostgresMirrorEnabled() {
  return mirrorEnabled();
}

export function isPostgresPrimaryEnabled() {
  return primaryEnabled();
}

function writeEnabled() {
  return mirrorEnabled() || primaryEnabled();
}

function ensurePool() {
  const connectionString = databaseUrl();
  if (!connectionString) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 4,
      idleTimeoutMillis: 10_000,
    });
  }

  return pool;
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, "\"\"")}"`;
}

function nowIso() {
  return new Date().toISOString();
}

function markRuntime(update) {
  Object.assign(runtimeState, update, {
    lastCheckedAt: nowIso(),
  });
}

export async function getPostgresRuntimeStatus({ forceRefresh = false } = {}) {
  const configured = Boolean(databaseUrl());
  const enabled = mirrorEnabled();
  const primary = primaryEnabled();

  runtimeState.configured = configured;
  runtimeState.mirrorEnabled = enabled;
  runtimeState.primaryEnabled = primary;

  if (!configured) {
    markRuntime({
      reachable: false,
      lastError: "",
    });
    return { ...runtimeState };
  }

  const lastCheckedAt = runtimeState.lastCheckedAt ? new Date(runtimeState.lastCheckedAt).getTime() : 0;
  if (!forceRefresh && lastCheckedAt && Date.now() - lastCheckedAt < POSTGRES_STATUS_TTL_MS) {
    return { ...runtimeState };
  }

  try {
    const postgres = ensurePool();
    await postgres.query("SELECT 1");
    markRuntime({
      reachable: true,
      lastError: "",
    });
  } catch (error) {
    markRuntime({
      reachable: false,
      lastError: error instanceof Error ? error.message : String(error),
    });
  }

  return { ...runtimeState };
}

function normalizeRecord(record = {}) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      value === undefined ? null : value,
    ]),
  );
}

export function queuePostgresMirror(label, operation) {
  if (!writeEnabled()) {
    return;
  }

  const postgres = ensurePool();
  if (!postgres) {
    return;
  }

  mirrorQueue = mirrorQueue
    .catch(() => {})
    .then(async () => {
      try {
        await operation(postgres);
        markRuntime({
          configured: true,
          mirrorEnabled: mirrorEnabled(),
          primaryEnabled: primaryEnabled(),
          reachable: true,
          lastError: "",
        });
      } catch (error) {
        markRuntime({
          configured: true,
          mirrorEnabled: mirrorEnabled(),
          primaryEnabled: primaryEnabled(),
          reachable: false,
          lastError: `[${label}] ${error instanceof Error ? error.message : String(error)}`,
        });
        console.error("Postgres mirror failed", {
          label,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
}

export async function upsertPostgresRecord(postgres, tableName, record, conflictColumns = ["id"]) {
  const normalized = normalizeRecord(record);
  const columns = Object.keys(normalized);
  if (columns.length === 0) {
    return;
  }

  const values = columns.map((column) => normalized[column]);
  const columnList = columns.map(quoteIdentifier).join(", ");
  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
  const conflictList = conflictColumns.map(quoteIdentifier).join(", ");
  const updateColumns = columns.filter((column) => !conflictColumns.includes(column));
  const updateClause = updateColumns.length
    ? updateColumns.map((column) => `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`).join(", ")
    : `${quoteIdentifier(conflictColumns[0])} = EXCLUDED.${quoteIdentifier(conflictColumns[0])}`;

  await postgres.query(
    `INSERT INTO ${quoteIdentifier(tableName)} (${columnList}) VALUES (${placeholders}) ON CONFLICT (${conflictList}) DO UPDATE SET ${updateClause}`,
    values,
  );
}

export async function deletePostgresRecords(postgres, tableName, filters = {}) {
  const entries = Object.entries(filters).filter(([, value]) => value !== undefined && value !== null);
  if (entries.length === 0) {
    return;
  }

  const whereClause = entries
    .map(([column], index) => `${quoteIdentifier(column)} = $${index + 1}`)
    .join(" AND ");
  const values = entries.map(([, value]) => value);

  await postgres.query(
    `DELETE FROM ${quoteIdentifier(tableName)} WHERE ${whereClause}`,
    values,
  );
}

export async function deletePostgresRecordsByColumnValues(postgres, tableName, columnName, values = []) {
  const filteredValues = values.filter((value) => value !== undefined && value !== null && value !== "");
  if (filteredValues.length === 0) {
    return;
  }

  const placeholders = filteredValues.map((_, index) => `$${index + 1}`).join(", ");
  await postgres.query(
    `DELETE FROM ${quoteIdentifier(tableName)} WHERE ${quoteIdentifier(columnName)} IN (${placeholders})`,
    filteredValues,
  );
}

export async function queryPostgres(sql, values = []) {
  const postgres = ensurePool();
  if (!postgres) {
    throw new Error("Postgres is not configured");
  }

  try {
    const result = await postgres.query(sql, values);
    markRuntime({
      configured: true,
      mirrorEnabled: mirrorEnabled(),
      primaryEnabled: primaryEnabled(),
      reachable: true,
      lastError: "",
    });
    return result;
  } catch (error) {
    markRuntime({
      configured: true,
      mirrorEnabled: mirrorEnabled(),
      primaryEnabled: primaryEnabled(),
      reachable: false,
      lastError: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function withPostgresTransaction(operation) {
  const postgres = ensurePool();
  if (!postgres) {
    throw new Error("Postgres is not configured");
  }

  const client = await postgres.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    markRuntime({
      configured: true,
      mirrorEnabled: mirrorEnabled(),
      primaryEnabled: primaryEnabled(),
      reachable: true,
      lastError: "",
    });
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback errors and surface the original failure.
    }

    markRuntime({
      configured: true,
      mirrorEnabled: mirrorEnabled(),
      primaryEnabled: primaryEnabled(),
      reachable: false,
      lastError: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    client.release();
  }
}
