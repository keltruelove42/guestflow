import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

/**
 * AES-256-GCM encrypt/decrypt for Integration.credentials (docs/08).
 * CREDENTIALS_KEY: 64-char hex (32 bytes) or any string (sha256-hashed to 32 bytes).
 */

function keyBytes(): Buffer {
  const raw = process.env.CREDENTIALS_KEY?.trim();
  if (!raw) {
    throw new Error("CREDENTIALS_KEY is not set");
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return createHash("sha256").update(raw).digest();
}

export type EncryptedBlob = {
  v: 1;
  iv: string;
  tag: string;
  data: string;
};

export function isEncryptedBlob(value: unknown): value is EncryptedBlob {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return o.v === 1 && typeof o.iv === "string" && typeof o.tag === "string" && typeof o.data === "string";
}

export function encryptJson(payload: unknown): EncryptedBlob {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  };
}

export function decryptJson<T = Record<string, unknown>>(blob: unknown): T {
  if (!isEncryptedBlob(blob)) {
    // Back-compat: plain JSON already stored (e.g. early Twilio tests)
    if (blob && typeof blob === "object") return blob as T;
    throw new Error("Invalid credentials blob");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyBytes(),
    Buffer.from(blob.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(blob.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(blob.data, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8")) as T;
}
