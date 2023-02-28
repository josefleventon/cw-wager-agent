"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const chain_1 = require("./chain");
// Load .env
dotenv_1.default.config({ path: `${__dirname}/../.env` });
// Config Express.js
const app = (0, express_1.default)();
app.use((0, cors_1.default)()); // Allow all CORS
// Load pages
app.use('/', require('./pages'));
app.use('/status', require('./pages/status'));
app.use('/jobs', require('./pages/jobs'));
// Start server & listen for requests
const PORT = process.env.PORT || 3450;
try {
    app.listen(PORT, () => {
        console.log(`🎉 Running on *::${PORT}`);
        (0, chain_1.loopIndexerQuery)();
    });
}
catch (err) {
    console.error(`Error: ${err}`);
}
