"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const wagers_1 = require("../../wagers");
const router = express_1.default.Router();
router.get('/', (_, res) => {
    return res.status(200).json({
        jobs: (0, wagers_1.activeJobs)(),
    });
});
router.get('/:token_id', async (req, res) => {
    const job = await (0, wagers_1.activeJobByToken)(parseInt(req.params.token_id));
    return res.status(200).json({
        job,
    });
});
module.exports = router;
