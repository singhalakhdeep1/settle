/**
 * Money arithmetic utilities — integer paise only. NO FLOATS.
 *
 * INR: 1 rupee = 100 paise   (e.g. ₹999 = 99900 paise)
 * USD: 1 dollar = 100 cents  (e.g. $9.99 = 999 cents)
 *
 * All amounts stored and manipulated as BigInt.
 * Only convert to number/string at display boundaries.
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
};

const CURRENCY_SUBUNITS: Record<string, number> = {
    INR: 100,
    USD: 100,
    EUR: 100,
    GBP: 100,
};

// ─── Parse ────────────────────────────────────────────────────────────────────

/**
 * Convert a decimal amount string to paise/cents BigInt.
 * formatAmount("999.99", "INR") → 99999n
 * formatAmount("9.99", "USD")   → 999n
 */
export function toPaise(decimalAmount: string | number, currency = "INR"): bigint {
    const subunit = CURRENCY_SUBUNITS[currency] ?? 100;
    // Avoid floating point: split on decimal point
    const str = String(decimalAmount).trim();
    const [whole, frac = ""] = str.split(".");
    const fracPadded = frac.padEnd(String(subunit - 1).length, "0").slice(0, String(subunit - 1).length);
    return BigInt(whole) * BigInt(subunit) + BigInt(fracPadded || "0");
}

// ─── Format ───────────────────────────────────────────────────────────────────

/**
 * Format paise/cents to human-readable currency string.
 * formatMoney(99900n, "INR") → "₹999.00"
 * formatMoney(999n, "USD")   → "$9.99"
 */
export function formatMoney(paise: bigint, currency = "INR"): string {
    const subunit = BigInt(CURRENCY_SUBUNITS[currency] ?? 100);
    const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
    const whole = paise / subunit;
    const frac = paise % subunit;
    const fracStr = frac.toString().padStart(String(subunit - 1n).length, "0");
    return `${symbol}${whole}.${fracStr}`;
}

export function formatINR(paise: bigint): string {
    return formatMoney(paise, "INR");
}

export function formatUSD(cents: bigint): string {
    return formatMoney(cents, "USD");
}

// ─── Arithmetic (safe) ────────────────────────────────────────────────────────

export function addPaise(a: bigint, b: bigint): bigint {
    return a + b;
}

export function subtractPaise(a: bigint, b: bigint): bigint {
    if (b > a) throw new RangeError("Cannot subtract: result would be negative");
    return a - b;
}

export function multiplyPaise(paise: bigint, multiplier: number): bigint {
    // multiplier can be a float (e.g., 0.18 for GST)
    // We handle this by scaling: 0.18 * 10000 = 1800 / 10000
    const scale = 10_000n;
    const scaledMultiplier = BigInt(Math.round(multiplier * Number(scale)));
    return (paise * scaledMultiplier) / scale;
}

// ─── Currency Conversion ──────────────────────────────────────────────────────

/**
 * Convert paise from one currency to another using an exchange rate.
 * Exchange rate is decimal: rate = 0.012 means 1 INR paise = 0.012 USD cents
 */
export function convertCurrency(
    amount: bigint,
    fromCurrency: string,
    toCurrency: string,
    rateDecimal: string, // e.g. "0.012" — string to avoid float errors
): bigint {
    if (fromCurrency === toCurrency) return amount;
    // Parse rate as integer numerator/denominator
    const [rateWhole, rateFrac = ""] = rateDecimal.split(".");
    const precision = rateFrac.length;
    const denominator = BigInt(10 ** precision);
    const numerator = BigInt(rateWhole + rateFrac);
    return (amount * numerator) / denominator;
}

// ─── Serialization ────────────────────────────────────────────────────────────

/** BigInt → string for JSON serialization (Prisma returns BigInt). */
export function paise_to_string(paise: bigint): string {
    return paise.toString();
}

/** string → BigInt for reading from JSON/DB responses. */
export function string_to_paise(str: string): bigint {
    return BigInt(str);
}
