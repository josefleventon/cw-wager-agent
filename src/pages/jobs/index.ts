import type { Request, Response } from 'express'
import express from 'express'

import { activeJobs, activeJobsByToken } from '../../wagers'

const router = express.Router()

router.get(
  '/',
  (_: Request, res: Response): Response => {
    return res.status(200).json({
      jobs: activeJobs(),
    })
  },
)

router.get(
  '/:token_id',
  (req: Request, res: Response): Response => {
    return res.status(200).json({
      job: activeJobsByToken(parseInt(req.params.token_id)),
    })
  },
)

module.exports = router
