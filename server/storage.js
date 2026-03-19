import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverRoot = __dirname;

function sanitizeFilename(filename = "") {
  return String(filename || "file.bin")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    || "file.bin";
}

function storageProvider() {
  return (process.env.STORAGE_PROVIDER || "local").trim().toLowerCase() || "local";
}

function localStorageRoot() {
  const configured = process.env.LOCAL_STORAGE_PATH || "data/objects";
  return join(serverRoot, configured.replace(/^\/+/, ""));
}

function ensureLocalDirectory(pathname) {
  mkdirSync(pathname, { recursive: true });
}

export function getStorageRuntimeStatus() {
  const provider = storageProvider();
  return {
    provider,
    localPath: provider === "local" ? localStorageRoot() : "",
    ready: provider === "local",
  };
}

export async function putStoredObject({
  keyPrefix = "uploads",
  filename = "",
  contentType = "application/octet-stream",
  buffer,
}) {
  const provider = storageProvider();
  if (provider !== "local") {
    throw new Error(`Unsupported storage provider in current runtime: ${provider}`);
  }

  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("Storage payload missing");
  }

  const now = new Date();
  const objectKey = [
    keyPrefix.replace(/^\/+|\/+$/g, ""),
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    `${randomUUID()}-${sanitizeFilename(filename)}`,
  ].join("/");

  const absolutePath = join(localStorageRoot(), objectKey);
  ensureLocalDirectory(dirname(absolutePath));
  writeFileSync(absolutePath, buffer);

  return {
    provider,
    objectKey,
    absolutePath,
    size: buffer.length,
    contentType,
  };
}

export async function deleteStoredObject(objectKey = "") {
  const provider = storageProvider();
  if (provider !== "local" || !objectKey) {
    return false;
  }

  const absolutePath = join(localStorageRoot(), String(objectKey).replace(/^\/+/, ""));
  try {
    unlinkSync(absolutePath);
    return true;
  } catch {
    return false;
  }
}
