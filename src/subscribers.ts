import * as fs from "fs";
import * as path from "path";
import { config } from "./config";

const subscribersPath = path.resolve(config.SUBSCRIBERS_FILE);

/** In-memory subscriber set (chat ID strings). */
let subscribers: Set<string> = new Set();

/**
 * Load subscribers from disk. Called once at startup.
 */
export function loadSubscribers(): void {
    // Seed from TELEGRAM_CHAT_IDS env var
    for (const id of config.TELEGRAM_CHAT_IDS) {
        if (id) subscribers.add(id);
    }

    // Merge with persisted file
    if (fs.existsSync(subscribersPath)) {
        try {
            const raw = fs.readFileSync(subscribersPath, "utf-8");
            const arr: string[] = JSON.parse(raw);
            for (const id of arr) {
                subscribers.add(id);
            }
        } catch (err) {
            console.warn("⚠️ Could not parse subscribers.json:", err);
        }
    }

    persist();
    console.log(`👥 ${subscribers.size} subscriber(s) loaded`);
}

/**
 * Persist current subscribers to disk.
 */
function persist(): void {
    try {
        fs.writeFileSync(
            subscribersPath,
            JSON.stringify([...subscribers], null, 2),
            "utf-8"
        );
    } catch (err) {
        console.error("❌ Failed to save subscribers:", err);
    }
}

/**
 * Add a subscriber.
 */
export function addSubscriber(chatId: string): boolean {
    if (subscribers.has(chatId)) return false;
    subscribers.add(chatId);
    persist();
    return true;
}

/**
 * Remove a subscriber.
 */
export function removeSubscriber(chatId: string): boolean {
    const removed = subscribers.delete(chatId);
    if (removed) persist();
    return removed;
}

/**
 * Get all current subscriber chat IDs.
 */
export function getSubscribers(): string[] {
    return [...subscribers];
}
