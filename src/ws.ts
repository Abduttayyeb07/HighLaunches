import WebSocket from "ws";
import { config } from "./config";
import { sendHighBuyAlert } from "./alert";

const SUBSCRIBE_QUERY = `tm.event='Tx'`;
const MAX_RECONNECT_DELAY = 30_000;

export function startSwapSubscription(): void {
    let reconnectDelay = 1000;

    function connect() {
        console.log(`🔌 Connecting to WebSocket: ${config.WS_URL}`);

        const ws = new WebSocket(config.WS_URL);
        let subscriptionConfirmed = false;

        ws.on("open", () => {
            console.log("✅ WebSocket connected");
            reconnectDelay = 1000;
            subscriptionConfirmed = false;

            const subscribeMsg = {
                jsonrpc: "2.0",
                method: "subscribe",
                id: 1,
                params: {
                    query: SUBSCRIBE_QUERY,
                },
            };
            ws.send(JSON.stringify(subscribeMsg));
            console.log(`📡 Subscribing to: ${SUBSCRIBE_QUERY}`);
        });

        ws.on("message", async (raw: WebSocket.Data) => {
            try {
                const msg = JSON.parse(raw.toString());

                // 1. Check if this is an actual event message
                // Tendermint events have result.data or result.events
                const resultEvents = msg?.result?.events;
                const resultData = msg?.result?.data;

                if (resultEvents || resultData) {
                    // This is a data message!
                    // If we haven't confirmed yet, mark it as confirmed now
                    if (!subscriptionConfirmed) {
                        subscriptionConfirmed = true;
                        console.log("✅ Subscription confirmed (first event received)");
                    }

                    if (!resultEvents) return; // Need events map to parse

                    const get = (key: string): string => {
                        const arr = resultEvents[key];
                        return Array.isArray(arr) && arr.length > 0 ? arr[0] : "";
                    };

                    const action = get("wasm.action");
                    if (action !== "swap" && action !== "Swap") return;

                    const offerAsset = get("wasm.offer_asset");
                    if (offerAsset !== "uzig") return;

                    const offerAmount = get("wasm.offer_amount");
                    let zigValue: number;
                    try {
                        zigValue = parseFloat(offerAmount) / 1_000_000;
                    } catch {
                        zigValue = 0;
                    }

                    if (isNaN(zigValue) || zigValue < config.HIGH_BUY_MIN_ZIG) return;

                    const sender = get("wasm.sender");
                    const receiver = get("wasm.receiver");
                    const returnAmount = get("wasm.return_amount");
                    const askAsset = get("wasm.ask_asset");
                    const contract = get("wasm._contract_address");
                    const txHash = get("tx.hash");

                    const symbol = askAsset.includes(".")
                        ? askAsset.split(".").pop()!.toUpperCase()
                        : askAsset.toUpperCase();

                    console.log(
                        `🚀 High buy: ${zigValue.toFixed(2)} ZIG → ${symbol} | tx: ${txHash?.slice(0, 12)}...`
                    );

                    await sendHighBuyAlert({
                        txHash,
                        sender,
                        receiver,
                        offerAsset,
                        offerAmount,
                        askAsset,
                        returnAmount,
                        pairAddr: contract,
                    });
                }
                // 2. Otherwise check if it's the subscription confirmation response
                else if (msg.id === 1 && !subscriptionConfirmed) {
                    subscriptionConfirmed = true;
                    console.log("✅ Subscription confirmed by RPC");
                }
            } catch (err) {
                console.error("⚠️ Error processing WebSocket message:", err);
            }
        });

        ws.on("error", (err) => {
            console.error("❌ WebSocket error:", err.message);
        });

        ws.on("close", (code, reason) => {
            console.warn(
                `🔌 WebSocket closed (code=${code}). Reconnecting in ${reconnectDelay / 1000}s...`
            );
            setTimeout(connect, reconnectDelay);
            reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
        });
    }

    connect();
}
