"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueWagerResolution = exports.activeJobByToken = exports.activeJobs = exports.jobs = void 0;
const proto_signing_1 = require("@cosmjs/proto-signing");
const chain_1 = require("./chain");
const node_schedule_1 = require("node-schedule");
const api_1 = require("./api");
exports.jobs = new Map();
function activeJobs() {
    return [...exports.jobs];
}
exports.activeJobs = activeJobs;
async function activeJobByToken(token_id) {
    const arr = [...exports.jobs].filter((job) => job[0].includes(token_id)).map((job) => job[1]);
    if (arr.length < 1)
        return null;
    else {
        const job = arr[0];
        const token_1_price = await (0, api_1.fetchPriceData)(job.wager.wagers[0].currency);
        const token_2_price = await (0, api_1.fetchPriceData)(job.wager.wagers[1].currency);
        const token_1_change = token_1_price.price / job.prices[0].price - 1;
        const token_2_change = token_2_price.price / job.prices[1].price - 1;
        let winner;
        if (token_1_change > token_2_change) {
            winner = job.wager.wagers[0].token;
        }
        else if (token_2_change > token_1_change) {
            winner = job.wager.wagers[1].token;
        }
        else {
            winner = null;
        }
        return {
            ...job.wager,
            prev_prices: job.prices,
            current_prices: [
                {
                    denom: token_1_price.symbol,
                    price: token_1_price.price,
                },
                {
                    denom: token_2_price.symbol,
                    price: token_2_price.price,
                },
            ],
            change: [
                {
                    denom: token_1_price.symbol,
                    change: token_1_change,
                },
                {
                    denom: token_2_price.symbol,
                    change: token_2_change,
                },
            ],
            current_winner: winner,
        };
    }
}
exports.activeJobByToken = activeJobByToken;
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
        // Add job to queue
        exports.jobs.set([wager.wagers[0].token.token_id, wager.wagers[1].token.token_id], {
            wager,
            prices: [
                {
                    denom: token_1_price.symbol,
                    price: token_1_price.price,
                },
                {
                    denom: token_2_price.symbol,
                    price: token_2_price.price,
                },
            ],
        });
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
    await client
        .execute(account.address, process.env.WAGER_CONTRACT, {
        set_winner: {
            wager_key: [
                [wager.wagers[0].token.collection, wager.wagers[0].token.token_id],
                [wager.wagers[1].token.collection, wager.wagers[1].token.token_id],
            ],
            prev_prices: [priceInfo[0].price.toString(), priceInfo[1].price.toString()],
            current_prices: [token_1_price.toString(), token_2_price.toString()],
        },
    }, chain_1.GAS_FEE_CONFIG)
        .then(() => {
        // Remove job from queue
        exports.jobs.delete([wager.wagers[0].token.token_id, wager.wagers[1].token.token_id]);
    });
}
