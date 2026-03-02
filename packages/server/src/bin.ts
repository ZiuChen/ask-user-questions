import { loadConfig } from './config.js'
import { startMcp } from './mcp.js'
import { startServer } from './server.js'

const PORT = 13390

async function main() {
  loadConfig()
  const { url } = await startServer(PORT)
  await startMcp(url)
}

main().catch((err) => {
  console.error('[ask-user-questions] Fatal error:', err)
  process.exit(1)
})
