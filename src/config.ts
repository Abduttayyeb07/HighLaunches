import "dotenv/config";

export interface Config {
    RPC_URL: string;
    REST_URL: string;
    WS_URL: string;
    TELEGRAM_BOT_TOKEN: string;
    TELEGRAM_CHAT_IDS: string[];
    HIGH_BUY_MIN_ZIG: number;
    DEFAULT_BANNER: string;
    SUBSCRIBERS_FILE: string;
}

function requireEnv(key: string): string {
    const val = process.env[key];
    if (!val) {
        console.error(`❌ Missing required env var: ${key}`);
        console.error(`   Copy .env.example → .env and fill in your values.`);
        process.exit(1);
    }
    return val;
}

function optionalEnv(key: string, fallback: string): string {
    return process.env[key] || fallback;
}

/**
 * Convert an HTTP(S) RPC URL to a WebSocket URL.
 * e.g. "https://rpc.example.com" → "wss://rpc.example.com/websocket"
 */
function toWsUrl(rpcUrl: string): string {
    return rpcUrl
        .replace(/^https:\/\//, "wss://")
        .replace(/^http:\/\//, "ws://")
        .replace(/\/$/, "") + "/websocket";
}

const rpcUrl = requireEnv("RPC_URL");

export const config: Config = {
    RPC_URL: rpcUrl,
    REST_URL: optionalEnv("REST_URL", ""),
    WS_URL: toWsUrl(rpcUrl),
    TELEGRAM_BOT_TOKEN: requireEnv("TELEGRAM_BOT_TOKEN"),
    TELEGRAM_CHAT_IDS: optionalEnv("TELEGRAM_CHAT_IDS", "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    HIGH_BUY_MIN_ZIG: Number(optionalEnv("HIGH_BUY_MIN_ZIG", "100")),
    DEFAULT_BANNER: "banner.png",
    SUBSCRIBERS_FILE: "subscribers.json",
};
