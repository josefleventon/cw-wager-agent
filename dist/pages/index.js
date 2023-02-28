"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
router.get('/', (req, res) => {
    return res.status(200).send(`
    <h2>PixelWizards Wager Agent</h2>
    <ul>
      <li><a href="/status">/status</a></li>
      <li><a href="/jobs">/jobs</a></li>
      <li><a href="/jobs/[token_id]">/jobs/[token_id]</a></li>
    </ul>
  `);
});
module.exports = router;
