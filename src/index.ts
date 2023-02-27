import type { Application } from 'express'
import dotenv from 'dotenv'

import express from 'express'
import cors from 'cors'
import { loopIndexerQuery } from './chain'

// Load .env
dotenv.config({ path: `${__dirname}/../.env` })

// Config Express.js
const app: Application = express()
app.use(cors()) // Allow all CORS

// Load pages
app.use('/', require('./pages'))
app.use('/status', require('./pages/status'))

// Start server & listen for requests
const PORT = process.env.PORT || 3450
try {
  app.listen(PORT, (): void => {
    console.log(`🎉 Running on *::${PORT}`)
    loopIndexerQuery()
  })
} catch (err) {
  console.error(`Error: ${err}`)
}
