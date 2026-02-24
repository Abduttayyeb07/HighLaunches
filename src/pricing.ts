import axios from "axios";
import { config } from "./config";

const PRICE_TTL_MS = 30_000;

interface CacheEntry {
    value: number | null;
    expiresAt: number;
}

const priceCache = new Map<string, CacheEntry>();

function getCached(key: string): number | null | undefined {
    const hit = priceCache.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expiresAt) {
        priceCache.delete(key);
        return undefined;
    }
    return hit.value;
}

function setCached(key: string, value: number | null): void {
    priceCache.set(key, { value, expiresAt: Date.now() + PRICE_TTL_MS });
}

function toFiniteNumber(value: unknown): number | null {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
}

function extractPriceUsd(payload: any): number | null {
    const direct = toFiniteNumber(payload?.priceUsd);
    if (direct !== null) return direct;

    if (Array.isArray(payload) && payload.length > 0) {
        const firstArr = toFiniteNumber(payload[0]?.priceUsd);
        if (firstArr !== null) return firstArr;
    }

    const firstDataArr = toFiniteNumber(payload?.data?.[0]?.priceUsd);
    if (firstDataArr !== null) return firstDataArr;

    const firstPoolArr = toFiniteNumber(payload?.pools?.[0]?.priceUsd);
    if (firstPoolArr !== null) return firstPoolArr;

    return null;
}

export async function getTokenPriceUsd(denom: string): Promise<number | null> {
    const key = `token:${denom}`;
    const cached = getCached(key);
    if (cached !== undefined) return cached;

    try {
        const url = `https://dev-api.degenter.io/tokens/${encodeURIComponent(denom)}/pools`;
        const { data } = await axios.get(url, { timeout: 10_000 });
        const price = extractPriceUsd(data);
        setCached(key, price);
        return price;
    } catch {
        setCached(key, null);
        return null;
    }
}

function extractCmcQuote(data: any): number | null {
    const root = data?.data;
    if (!root || typeof root !== "object") return null;

    const firstKey = Object.keys(root)[0];
    if (!firstKey) return null;

    const rawEntry = root[firstKey];
    const entry = Array.isArray(rawEntry) ? rawEntry[0] : rawEntry;
    return toFiniteNumber(entry?.quote?.USD?.price);
}

export async function getZigPriceUsd(): Promise<number | null> {
    const key = "cmc:zig";
    const cached = getCached(key);
    if (cached !== undefined) return cached;

    if (!config.CMC_API_KEY) {
        setCached(key, null);
        return null;
    }

    try {
        const params: Record<string, string> = { convert: "USD" };
        if (config.CMC_ZIG_ID) {
            params.id = config.CMC_ZIG_ID;
        } else {
            params.symbol = config.CMC_ZIG_SYMBOL;
        }

        const { data } = await axios.get(
            `${config.CMC_BASE_URL}/v1/cryptocurrency/quotes/latest`,
            {
                params,
                timeout: 10_000,
                headers: {
                    "X-CMC_PRO_API_KEY": config.CMC_API_KEY,
                    Accept: "application/json",
                },
            }
        );

        const price = extractCmcQuote(data);
        setCached(key, price);
        return price;
    } catch {
        setCached(key, null);
        return null;
    }
}

export function getUsdValue(
    rawAmount: string,
    decimals: number,
    priceUsd: number | null
): number | null {
    if (priceUsd === null) return null;
    const raw = Number(rawAmount);
    if (!Number.isFinite(raw)) return null;
    const units = raw / Math.pow(10, decimals);
    if (!Number.isFinite(units)) return null;
    return units * priceUsd;
}

export function formatUsd(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return "n/a";

    if (value >= 1) {
        return `$${value.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    }

    if (value >= 0.01) {
        return `$${value.toLocaleString("en-US", {
            minimumFractionDigits: 4,
            maximumFractionDigits: 4,
        })}`;
    }

    return `$${value.toLocaleString("en-US", {
        minimumFractionDigits: 6,
        maximumFractionDigits: 8,
    })}`;
}
