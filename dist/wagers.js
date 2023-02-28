"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueWagerResolution = void 0;
const proto_signing_1 = require("@cosmjs/proto-signing");
const chain_1 = require("./chain");
const node_schedule_1 = require("node-schedule");
const api_1 = require("./api");
async function queueWagerResolution({ expires_at, collection, token_id, }) {
    const client = await (0, chain_1.getCosmWasmClient)(process.env.RPC);
    try {
        // Get wager info
        const { wager } = await client.queryContractSmart(process.env.WAGER_CONTRACT, {
            wager: { token: [collection, token_id] },
        });
        // Fetch price data
        const token_1_price = await (0, api_1.fetchPriceData)(wager.wagers[0].currency);
        const token_2_price = await (0, api_1.fetchPriceData)(wager.wagers[1].currency);
        // Get date for resolution
        const expiry_date = new Date(parseInt(expires_at) * 1000 + 12000);
        const date = expiry_date.getTime() < Date.now() ? new Date(Date.now() + 1000) : expiry_date;
        console.log(`🧮 Wager resolution between #${wager.wagers[0].token.token_id} & #${wager.wagers[1].token.token_id} scheduled for`, date.toLocaleTimeString('en-US', { timeZone: 'America/New_York' }));
        console.log(`\t${wager.wagers[0].currency}: $${token_1_price.price}`);
        console.log(`\t${wager.wagers[1].currency}: $${token_2_price.price}`);
        // Schedule cron job
        (0, node_schedule_1.scheduleJob)(date, () => resolveWager(wager, [token_1_price, token_2_price]));
    }
    catch (e) {
        console.error('❌ ERROR: ', e.message);
    }
}
exports.queueWagerResolution = queueWagerResolution;
async function resolveWager(wager, priceInfo) {
    const wallet = await proto_signing_1.DirectSecp256k1HdWallet.fromMnemonic(process.env.MNEMONIC, { prefix: 'stars' });
    const [account] = await wallet.getAccounts();
    const client = await (0, chain_1.getSigningCosmWasmClient)(process.env.RPC, wallet);
    // Fetch price data
    const { price: token_1_price } = await (0, api_1.fetchPriceData)(wager.wagers[0].currency);
    const { price: token_2_price } = await (0, api_1.fetchPriceData)(wager.wagers[1].currency);
    console.log(`✅ Wager resolved between #${wager.wagers[0].token.token_id} & #${wager.wagers[1].token.token_id}`);
    console.log(`\t${wager.wagers[0].currency}: $${token_1_price}`);
    console.log(`\t${wager.wagers[1].currency}: $${token_2_price}`);
    // Set the winner
    // The contract will determine the winner based on price data
    await client.execute(account.address, process.env.WAGER_CONTRACT, {
        set_winner: {
            wager_key: [
                [wager.wagers[0].token.collection, wager.wagers[0].token.token_id],
                [wager.wagers[1].token.collection, wager.wagers[1].token.token_id],
            ],
            prev_prices: [priceInfo[0].price.toString(), priceInfo[1].price.toString()],
            current_prices: [token_1_price.toString(), token_2_price.toString()],
        },
    }, chain_1.GAS_FEE_CONFIG);
}
