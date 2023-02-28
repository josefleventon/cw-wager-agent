"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchPriceData = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
async function fetchPriceData(token) {
    return (0, node_fetch_1.default)(process.env.KNOWLEDGE_API + '/' + token.toUpperCase()).then((res) => {
        return res.json();
    });
}
exports.fetchPriceData = fetchPriceData;
