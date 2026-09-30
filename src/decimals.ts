import axios from "axios";
import { config } from "./config";
import { ZIG_DENOM, ZIG_DECIMALS, parseRaw } from "./zig";

/**
 * In-memory cache: denom → number of decimals.
 * Known defaults pre-seeded.
 */
const decimalsCache = new Map<string, number>([
    [ZIG_DENOM, ZIG_DECIMALS],
]);

/**
 * Get the number of decimals for a token denom.
 * Queries the chain's REST API for DenomMetadata and caches the result.
 * Returns 0 as safe default if query fails (shows raw value).
 */
export async function getDecimals(denom: string): Promise<number> {
    // Check cache first
    if (decimalsCache.has(denom)) {
        return decimalsCache.get(denom)!;
    }

    // Query REST API for denom metadata
    if (config.REST_URL) {
        try {
            const encodedDenom = encodeURIComponent(denom);
            const url = `${config.REST_URL}/cosmos/bank/v1beta1/denoms_metadata/${encodedDenom}`;
            const { data } = await axios.get(url, { timeout: 10_000 });

            const denomUnits: Array<{ denom: string; exponent: number }> =
                data?.metadata?.denom_units ?? [];

            // Find the highest exponent (that's the display exponent)
            let exponent = 0;
            for (const unit of denomUnits) {
                if (unit.exponent > exponent) {
                    exponent = unit.exponent;
                }
            }

            decimalsCache.set(denom, exponent);
            console.log(`🔢 Cached decimals for ${cleanDenomLog(denom)}: ${exponent}`);
            return exponent;
        } catch (err: any) {
            console.warn(
                `⚠️ Could not fetch decimals for ${cleanDenomLog(denom)}: ${err.message}`
            );
        }
    }

    // Default: 0 decimals (show raw value — safer than wrong division)
    decimalsCache.set(denom, 0);
    return 0;
}

/**
 * Format a raw amount using the correct decimals for the denom.
 * e.g. "30000000" with 6 decimals → "30.00"
 *      "29024932" with 0 decimals → "29,024,932"
 */
export function formatWithDecimals(rawAmount: string, decimals: number): string {
    const raw = parseRaw(rawAmount);
    if (raw === null) return "0";

    // Exact BigInt math (18-decimal amounts exceed Number's safe range)
    const scale = 10n ** BigInt(decimals);
    const intPart = (raw / scale).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    if (decimals > 0) {
        // Show 2 decimal places for divisible tokens (rounded half up)
        const unit = scale / 100n;
        let cents = unit > 0n ? (raw % scale + unit / 2n) / unit : (raw % scale) * 100n / scale;
        let whole = raw / scale;
        if (cents >= 100n) {
            cents -= 100n;
            whole += 1n;
        }
        const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return `${wholeStr}.${cents.toString().padStart(2, "0")}`;
    }
    return intPart;
}

/** Short denom for logging (just the symbol part). */
function cleanDenomLog(denom: string): string {
    if (denom.includes(".")) {
        return denom.split(".").pop()!.toUpperCase();
    }
    return denom.toUpperCase();
}
