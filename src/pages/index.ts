import type { Request, Response } from 'express'
import express from 'express'

const router = express.Router()

router.get(
  '/',
  (req: Request, res: Response): Response => {
    return res.status(200).send(`
    <h2>PixelWizards Wager Agent</h2>
    <ul>
      <li><a href="/status">/status</a></li>
      <li><a href="/jobs">/jobs</a></li>
      <li><a href="/jobs/[token_id]">/jobs/[token_id]</a></li>
    </ul>
  `)
  },
)

module.exports = router
