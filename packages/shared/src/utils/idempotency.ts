/**
 * Idempotency key utilities.
 *
 * Rules:
 *   - 8–255 characters
 *   - Alphanumeric, dashes, underscores only
 *   - Scoped per organization (same key in two orgs = two separate intents)
 */

const IDEMPOTENCY_KEY_REGEX = /^[\w\-]{8,255}$/;

export function isValidIdempotencyKey(key: string): boolean {
    return IDEMPOTENCY_KEY_REGEX.test(key);
}

export function validateIdempotencyKey(key: string | undefined): string {
    if (!key) {
        throw new Error("Idempotency-Key header is required for this operation");
    }
    if (!isValidIdempotencyKey(key)) {
        throw new Error(
            "Idempotency-Key must be 8–255 characters and contain only letters, numbers, dashes, or underscores",
        );
    }
    return key;
}

/**
 * Generate a random idempotency key for client-side use.
 * Format: <timestamp_ms>-<random_8_chars>
 */
export function generateIdempotencyKey(): string {
    const rand = Math.random().toString(36).slice(2, 10);
    return `${Date.now()}-${rand}`;
}
