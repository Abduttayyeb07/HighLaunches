import { Bot, InlineKeyboard } from "grammy";
import { config } from "./config";
import { loadSubscribers, addSubscriber, removeSubscriber } from "./subscribers";
import { setBotInstance } from "./alert";
import { startSwapSubscription } from "./ws";

async function main(): Promise<void> {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  🔍 HighBuy Monitor — ZigChain Swap Alerts");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`  RPC:       ${config.RPC_URL}`);
    console.log(`  WS:        ${config.WS_URL}`);
    console.log(`  Min ZIG:   ${config.HIGH_BUY_MIN_ZIG}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // ─── Load subscribers ───
    loadSubscribers();

    // ─── Initialize Telegram bot ───
    const bot = new Bot(config.TELEGRAM_BOT_TOKEN);
    setBotInstance(bot);

    // /start command — show welcome message with Subscribe button
    bot.command("start", async (ctx) => {
        const keyboard = new InlineKeyboard().text("Subscribe 🔔", "subscribe");
        await ctx.reply(
            [
                `🔍 <b>Welcome to HighBuy Monitor!</b>`,
                ``,
                `I monitor ZigChain for large swap events`,
                `and send you real-time alerts.`,
                ``,
                `💰 Min threshold: <b>${config.HIGH_BUY_MIN_ZIG} ZIG</b>`,
                ``,
                `Tap the button below to subscribe:`,
            ].join("\n"),
            { parse_mode: "HTML", reply_markup: keyboard }
        );
    });

    // Callback: Subscribe button clicked
    bot.callbackQuery("subscribe", async (ctx) => {
        const chatId = String(ctx.chat?.id);
        const added = addSubscriber(chatId);
        await ctx.answerCallbackQuery(
            added ? "✅ Subscribed!" : "ℹ️ Already subscribed"
        );
        await ctx.editMessageText(
            [
                `🔍 <b>HighBuy Monitor</b>`,
                ``,
                `✅ <b>You are subscribed!</b>`,
                ``,
                `You'll receive alerts for swaps ≥ <b>${config.HIGH_BUY_MIN_ZIG} ZIG</b>.`,
                ``,
                `Use /stop to unsubscribe.`,
                `Use /status to check monitor health.`,
            ].join("\n"),
            { parse_mode: "HTML" }
        );
        if (added) console.log(`➕ Subscriber added: ${chatId}`);
    });

    // /stop command — show confirmation with Unsubscribe button
    bot.command("stop", async (ctx) => {
        const keyboard = new InlineKeyboard().text("Unsubscribe 🔕", "unsubscribe");
        await ctx.reply(
            [
                `⚠️ <b>Unsubscribe from alerts?</b>`,
                ``,
                `You will stop receiving high-buy notifications.`,
                `You can always re-subscribe with /start.`,
            ].join("\n"),
            { parse_mode: "HTML", reply_markup: keyboard }
        );
    });

    // Callback: Unsubscribe button clicked
    bot.callbackQuery("unsubscribe", async (ctx) => {
        const chatId = String(ctx.chat?.id);
        const removed = removeSubscriber(chatId);
        await ctx.answerCallbackQuery(
            removed ? "🛑 Unsubscribed" : "ℹ️ You weren't subscribed"
        );
        await ctx.editMessageText(
            [
                `🛑 <b>Unsubscribed</b>`,
                ``,
                `You will no longer receive high-buy alerts.`,
                `Use /start to subscribe again anytime.`,
            ].join("\n"),
            { parse_mode: "HTML" }
        );
        if (removed) console.log(`➖ Subscriber removed: ${chatId}`);
    });

    // /status command — show current status
    bot.command("status", async (ctx) => {
        await ctx.reply(
            [
                `🔍 <b>HighBuy Monitor Status</b>`,
                ``,
                `🌐 RPC: <code>${config.RPC_URL}</code>`,
                `🔌 WS: <code>${config.WS_URL}</code>`,
                `💰 Min ZIG: <b>${config.HIGH_BUY_MIN_ZIG}</b>`,
                `📡 Mode: <b>WebSocket (real-time)</b>`,
            ].join("\n"),
            { parse_mode: "HTML" }
        );
    });

    // ─── Start WebSocket swap subscription ───
    startSwapSubscription();

    // ─── Start Telegram bot polling ───
    console.log("🤖 Telegram bot polling started...\n");
    bot.start({
        onStart: () => console.log("✅ Bot is live and listening for commands"),
    });
}

// ─── Run ───
main().catch((err) => {
    console.error("💀 Fatal error:", err);
    process.exit(1);
});
