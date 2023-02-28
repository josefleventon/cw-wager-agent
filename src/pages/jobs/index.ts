import type { Request, Response } from 'express'
import express from 'express'

import { activeJobs } from 'src/wagers'

const router = express.Router()

router.get(
  '/',
  (_: Request, res: Response): Response => {
    return res.status(200).json({
      jobs: activeJobs(),
    })
  },
)

module.exports = router
