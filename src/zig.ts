/** Native ZIG denom (EVM-compatible chain: atto-unit, 18 decimals). */
export const ZIG_DENOM = "azig";
export const ZIG_DECIMALS = 18;
export const ZIG_SCALE = 10n ** BigInt(ZIG_DECIMALS);

/** Parse a raw integer amount string into BigInt. Returns null if invalid. */
export function parseRaw(raw: string): bigint | null {
    if (!/^\d+$/.test(raw ?? "")) return null;
    return BigInt(raw);
}

/**
 * Convert a decimal ZIG amount (e.g. env "100" or "0.5") into raw azig, exactly.
 * Falls back to 0n if the input isn't a plain non-negative decimal.
 */
export function zigToRaw(zig: string): bigint {
    const m = /^(\d+)(?:\.(\d*))?$/.exec(zig.trim());
    if (!m) return 0n;
    const frac = (m[2] ?? "").slice(0, ZIG_DECIMALS).padEnd(ZIG_DECIMALS, "0");
    return BigInt(m[1]) * ZIG_SCALE + BigInt(frac || "0");
}

/** Exact raw → fixed-point decimal string (trailing zeros kept to `decimals`). */
export function rawToDecimalString(raw: bigint, decimals: number): string {
    if (decimals <= 0) return raw.toString();
    const s = raw.toString().padStart(decimals + 1, "0");
    return `${s.slice(0, -decimals)}.${s.slice(-decimals)}`;
}
