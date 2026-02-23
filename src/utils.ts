import { GrammyError } from "grammy";
import { getSubscribers, removeSubscriber } from "./subscribers";

/**
 * Format a raw micro-amount (string) into a human-readable number.
 * e.g. "123456789" → "123.456789"
 * For display, we also add thousand-separators to the integer part.
 */
export function fmtAmount(raw: string): string {
    const num = parseFloat(raw) / 1_000_000;
    if (isNaN(num)) return "0";

    const [intPart, decPart] = num.toFixed(2).split(".");
    const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return decPart ? `${formatted}.${decPart}` : formatted;
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
