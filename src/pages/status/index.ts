import type { Request, Response } from 'express';
import express from 'express';

const router = express.Router();

router.get(
  '/',
  (_: Request, res: Response): Response => {
    return res.status(200).json({
      status: 'ok',
    });
  },
);

module.exports = router;
