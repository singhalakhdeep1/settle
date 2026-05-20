/**
 * Cryptographic utilities for PayFlow.
 *
 * - API key generation: pf_live_<48 hex chars>
 * - HMAC-SHA256 webhook signing
 * - AES-256-GCM encryption/decryption (for webhook secrets stored in DB)
 */

import { createHmac, createHash, randomBytes, createCipheriv, createDecipheriv } from "crypto";

// ─── API Key Generation ───────────────────────────────────────────────────────

const KEY_PREFIX = "pf_live_";

/**
 * Generate a new API key: pf_live_<48 random hex chars>
 * Returns { key, keyHash, keyPrefix }
 * ONLY return `key` once — it is never stored in plaintext.
 */
export function generateApiKey(): {
    key: string;
    keyHash: string;
    keyPrefix: string;
} {
    const key = `${KEY_PREFIX}${randomBytes(24).toString("hex")}`;
    return {
        key,
        keyHash: sha256(key),
        keyPrefix: key.slice(0, 12), // "pf_live_xxxx"
    };
}

/**
 * Hash a plaintext API key for storage / lookup.
 */
export function hashApiKey(key: string): string {
    return sha256(key);
}

/**
 * Validate that a string looks like a PayFlow API key.
 */
export function isValidApiKeyFormat(key: string): boolean {
    return /^pf_live_[0-9a-f]{48}$/.test(key);
}

// ─── SHA-256 ──────────────────────────────────────────────────────────────────

export function sha256(input: string): string {
    return createHash("sha256").update(input).digest("hex");
}

// ─── HMAC-SHA256 Webhook Signing ──────────────────────────────────────────────

/**
 * Sign a webhook payload.
 * Returns the signature: "sha256=<hmac_hex>"
 *
 * Matching Stripe's convention: timestamp-prefixed payload to prevent replay.
 * Signature covers: `${timestamp}.${body}`
 */
export function signWebhookPayload(
    body: string,
    secret: string,
    timestamp = Math.floor(Date.now() / 1000),
): { signature: string; timestamp: number } {
    const payload = `${timestamp}.${body}`;
    const signature = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
    return { signature, timestamp };
}

/**
 * Verify an incoming webhook signature.
 * Returns true if valid, false otherwise. Constant-time comparison.
 *
 * @param body       Raw request body string
 * @param signature  "sha256=<hex>" from Payflow-Signature header
 * @param secret     Plaintext webhook secret
 * @param timestamp  Unix timestamp from Payflow-Timestamp header
 * @param toleranceSec Reject if timestamp is older than this (default 300s)
 */
export function verifyWebhookSignature(
    body: string,
    signature: string,
    secret: string,
    timestamp: number,
    toleranceSec = 300,
): boolean {
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > toleranceSec) return false;

    const { signature: expected } = signWebhookPayload(body, secret, timestamp);

    // Constant-time comparison to prevent timing attacks
    if (expected.length !== signature.length) return false;
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return timingSafeEqual(a, b);
}

function timingSafeEqual(a: Buffer, b: Buffer): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a[i]! ^ b[i]!;
    }
    return diff === 0;
}

// ─── AES-256-GCM Encryption ───────────────────────────────────────────────────
// Used to encrypt webhook secrets before storing in DB.
// Encryption key = 32-byte hex from ENCRYPTION_KEY env var.

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV for GCM
const TAG_LENGTH = 16;

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns: "<iv_hex>:<tag_hex>:<ciphertext_hex>"
 */
export function encrypt(plaintext: string, encryptionKey: string): string {
    const key = Buffer.from(encryptionKey, "hex");
    if (key.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt a value encrypted by `encrypt()`.
 */
export function decrypt(ciphertext: string, encryptionKey: string): string {
    const key = Buffer.from(encryptionKey, "hex");
    if (key.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
    const parts = ciphertext.split(":");
    if (parts.length !== 3) throw new Error("Invalid ciphertext format");
    const [ivHex, tagHex, dataHex] = parts as [string, string, string];
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const data = Buffer.from(dataHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// ─── Webhook Secret ───────────────────────────────────────────────────────────

/**
 * Generate a new random webhook secret (32 bytes = 64 hex chars).
 */
export function generateWebhookSecret(): string {
    return `whsec_${randomBytes(32).toString("base64url")}`;
}
