import { GrammyError } from "grammy";
import { getSubscribers, removeSubscriber } from "./subscribers";
import { formatWithDecimals } from "./decimals";
import { ZIG_DECIMALS } from "./zig";

/**
 * Format a raw azig amount (string, 18 decimals) into a human-readable number
 * with thousand-separators and 2 decimal places.
 */
export function fmtAmount(raw: string): string {
    return formatWithDecimals(raw, ZIG_DECIMALS);
}

/**
 * Check if a Telegram send error is "Forbidden" (user blocked bot).
 * If so, auto-unsubscribe the user.
 * Returns true if the user was unsubscribed.
 */
export function maybeUnsubscribeOnForbidden(
    chatId: string,
    err: unknown
): boolean {
    if (err instanceof GrammyError) {
        const desc = err.description?.toLowerCase() ?? "";
        if (
            desc.includes("forbidden") ||
            desc.includes("blocked") ||
            desc.includes("deactivated")
        ) {
            console.log(
                `🚫 Auto-unsubscribing ${chatId} (bot was blocked/deactivated)`
            );
            removeSubscriber(chatId);
            return true;
        }
    }
    return false;
}

/**
 * Delay helper.
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
