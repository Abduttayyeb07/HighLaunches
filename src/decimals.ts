import axios from "axios";
import { config } from "./config";

/**
 * In-memory cache: denom → number of decimals.
 * Known defaults pre-seeded.
 */
const decimalsCache = new Map<string, number>([
    ["uzig", 6],
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
    const raw = parseFloat(rawAmount);
    if (isNaN(raw)) return "0";

    const value = raw / Math.pow(10, decimals);

    if (decimals > 0) {
        // Show 2 decimal places for divisible tokens
        const [intPart, decPart] = value.toFixed(2).split(".");
        const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return `${formatted}.${decPart}`;
    } else {
        // Whole number — just add commas
        return Math.floor(value)
            .toString()
            .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
}

/** Short denom for logging (just the symbol part). */
function cleanDenomLog(denom: string): string {
    if (denom.includes(".")) {
        return denom.split(".").pop()!.toUpperCase();
    }
    return denom.toUpperCase();
}
