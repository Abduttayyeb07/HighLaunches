import * as fs from "fs";
import * as path from "path";
import { Bot, InlineKeyboard, InputFile } from "grammy";
import { config } from "./config";
import { getSubscribers } from "./subscribers";
import { maybeUnsubscribeOnForbidden } from "./utils";
import { getDecimals, formatWithDecimals } from "./decimals";
import {
    formatUsd,
    getTokenPriceUsd,
    getUsdValue,
    getZigPriceUsd,
} from "./pricing";

// Shared bot instance — set by index.ts
let botInstance: Bot | null = null;

export function setBotInstance(bot: Bot): void {
    botInstance = bot;
}

export interface HighBuyAlertParams {
    txHash: string;
    sender: string;
    receiver: string;
    offerAsset: string;
    offerAmount: string;
    askAsset: string;
    returnAmount: string;
    pairAddr: string;
}

/**
 * Extract a clean token symbol from a denom string.
 * "coin.zig15nes6ctvl...karakchai" → "KARAKCHAI"
 * "uzig" → "ZIG"
 */
function cleanSymbol(denom: string): string {
    if (denom === "uzig") return "ZIG";

    if (denom.includes(".")) {
        const parts = denom.split(".");
        return parts[parts.length - 1].toUpperCase();
    }

    if (denom.startsWith("ibc/")) {
        return `IBC-${denom.slice(4, 10).toUpperCase()}`;
    }

    return denom.toUpperCase();
}

/**
 * Format and send a high-buy alert to all subscribers.
 */
export async function sendHighBuyAlert(params: HighBuyAlertParams): Promise<void> {
    const {
        txHash,
        sender,
        receiver,
        offerAsset,
        offerAmount,
        askAsset,
        returnAmount,
        pairAddr,
    } = params;

    if (!botInstance) {
        console.error("❌ Bot instance not set — cannot send alert");
        return;
    }

    const boughtSymbol = cleanSymbol(askAsset);
    const spentSymbol = cleanSymbol(offerAsset);

    // Get correct decimals for each asset
    const offerDecimals = await getDecimals(offerAsset);
    const askDecimals = await getDecimals(askAsset);

    const spentFormatted = formatWithDecimals(offerAmount, offerDecimals);
    const gotFormatted = formatWithDecimals(returnAmount, askDecimals);
    const [zigPriceUsd, offerTokenPriceUsd, askTokenPriceUsd] = await Promise.all([
        getZigPriceUsd(),
        getTokenPriceUsd(offerAsset),
        getTokenPriceUsd(askAsset),
    ]);

    const spentUnitPriceUsd = offerAsset === "uzig" ? zigPriceUsd : offerTokenPriceUsd;
    const spentTotalUsd = getUsdValue(offerAmount, offerDecimals, spentUnitPriceUsd);
    const gotTotalUsd = getUsdValue(returnAmount, askDecimals, askTokenPriceUsd);
    const spentUsdSuffix = spentTotalUsd === null ? "" : ` (${formatUsd(spentTotalUsd)})`;
    const gotUsdSuffix = gotTotalUsd === null ? "" : ` (${formatUsd(gotTotalUsd)})`;

    const text = [
        `🚀 <b>HIGH BUY — ${boughtSymbol}</b>`,
        ``,
        `💸 Spent: <b>${spentFormatted} ${spentSymbol}</b>${spentUsdSuffix}`,
        `💰 Got: <b>${gotFormatted} ${boughtSymbol}</b>${gotUsdSuffix}`,
        ``,
        `👤 Buyer: <code>${sender}</code>`,
        `📥 Receiver: <code>${receiver}</code>`,
        `🔗 Pool: <code>${pairAddr}</code>`,
    ].join("\n");

    const keyboard = new InlineKeyboard()
        .url("🔍 View TX", `https://www.zigscan.org/tx/${txHash}`)
        .url("📊 Pools", `https://app.degenter.io/token/${askAsset}`);

    const bannerPath = path.resolve(config.DEFAULT_BANNER);
    const subscribers = getSubscribers();

    for (const chatId of subscribers) {
        try {
            if (fs.existsSync(bannerPath)) {
                await botInstance.api.sendPhoto(
                    chatId,
                    new InputFile(bannerPath),
                    {
                        caption: text,
                        parse_mode: "HTML",
                        reply_markup: keyboard,
                    }
                );
            } else {
                await botInstance.api.sendMessage(chatId, text, {
                    parse_mode: "HTML",
                    reply_markup: keyboard,
                });
            }
        } catch (err) {
            if (!maybeUnsubscribeOnForbidden(chatId, err)) {
                console.error(`❌ Send fail to ${chatId}:`, err);
            }
        }
    }

    const zigValue = parseFloat(offerAmount) / 1_000_000;
    console.log(
        `📣 Alert sent: ${boughtSymbol} | ${zigValue.toFixed(2)} ZIG`
    );
}
