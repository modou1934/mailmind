import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function getKeyMaterial() {
  const configured = process.env.ENCRYPTION_KEY || "";
  const appEnv = process.env.APP_ENV || "development";
  const raw = configured || (appEnv === "development" ? "mailmind-local-development-key" : "");

  if (!raw) {
    throw new Error("Missing ENCRYPTION_KEY");
  }

  return createHash("sha256").update(raw).digest();
}

export function encryptString(value) {
  if (!value) {
    return "";
  }

  const iv = randomBytes(12);
  const key = getKeyMaterial();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptString(payload) {
  if (!payload) {
    return "";
  }

  const [ivEncoded, tagEncoded, encryptedEncoded] = payload.split(".");
  if (!ivEncoded || !tagEncoded || !encryptedEncoded) {
    return "";
  }

  try {
    const key = getKeyMaterial();
    const iv = Buffer.from(ivEncoded, "base64url");
    const tag = Buffer.from(tagEncoded, "base64url");
    const encrypted = Buffer.from(encryptedEncoded, "base64url");

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch (error) {
    const decryptionError = new Error("Unsupported state or unable to authenticate data");
    decryptionError.original = error;
    throw decryptionError;
  }
}
