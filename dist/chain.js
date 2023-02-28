"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loopIndexerQuery = exports.GAS_FEE_CONFIG = exports.getSigningCosmWasmClient = exports.getCosmWasmClient = void 0;
const proto_signing_1 = require("@cosmjs/proto-signing");
const cosmwasm_stargate_1 = require("@cosmjs/cosmwasm-stargate");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const apollo_client_1 = __importDefault(require("apollo-client"));
const apollo_link_http_1 = require("apollo-link-http");
const apollo_cache_inmemory_1 = require("apollo-cache-inmemory");
const node_schedule_1 = require("node-schedule");
const node_fetch_1 = __importDefault(require("node-fetch"));
const wagers_1 = require("./wagers");
async function getCosmWasmClient(rpc) {
    if (!rpc)
        throw new Error('No RPC provided to connect CosmWasmClient.');
    return await cosmwasm_stargate_1.CosmWasmClient.connect(rpc);
}
exports.getCosmWasmClient = getCosmWasmClient;
async function getSigningCosmWasmClient(rpc, wallet) {
    if (!rpc)
        throw new Error('No RPC provided to connect CosmWasmClient.');
    if (!wallet)
        throw new Error('No wallet provided to connect CosmWasmClient.');
    return await cosmwasm_stargate_1.SigningCosmWasmClient.connectWithSigner(rpc, wallet);
}
exports.getSigningCosmWasmClient = getSigningCosmWasmClient;
exports.GAS_FEE_CONFIG = {
    amount: (0, proto_signing_1.coins)(0, 'ustars'),
    gas: '666666',
};
const defaultOptions = {
    watchQuery: {
        fetchPolicy: 'no-cache',
        errorPolicy: 'ignore',
    },
    query: {
        fetchPolicy: 'no-cache',
        errorPolicy: 'all',
    },
};
function loopIndexerQuery() {
    const client = new apollo_client_1.default({
        link: (0, apollo_link_http_1.createHttpLink)({
            uri: process.env.GRAPHQL_API,
            fetch: node_fetch_1.default,
        }),
        cache: new apollo_cache_inmemory_1.InMemoryCache(),
        defaultOptions,
    });
    console.log('🚀 Apollo client running');
    let prev_edges = [];
    (0, node_schedule_1.scheduleJob)('*/6 * * * * *', async () => {
        const { data, } = await client.query({
            query: (0, graphql_tag_1.default) `
        query Events {
          events(
            sortBy: BLOCK_HEIGHT_DESC
            contractFilters: [{ contractType: "crates.io:cw-wager", events: [{ name: "wasm", action: "wager" }] }]
          ) {
            edges {
              node {
                id
                data
                contractAddr
                createdAt
              }
            }
          }
        }
      `,
        });
        const edges = data.events.edges.filter(({ node }) => !prev_edges.some(({ node: prev_node }) => prev_node.id === node.id) &&
            node.contractAddr === process.env.WAGER_CONTRACT &&
            new Date(node.createdAt) > new Date(Date.now() - 12000));
        const node_data = edges.map(({ node }) => node.data);
        // Clear previous edges if they exceed 255 items to prevent memory leak
        if (prev_edges.length > 255)
            prev_edges = [];
        prev_edges.push(...data.events.edges);
        node_data.forEach(({ collection, tokenId, expiresAt }) => (0, wagers_1.queueWagerResolution)({
            expires_at: expiresAt,
            collection,
            token_id: parseInt(tokenId),
        }));
    });
}
exports.loopIndexerQuery = loopIndexerQuery;
