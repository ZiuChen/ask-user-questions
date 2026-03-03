import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { startMcp } from './mcp.js'

const PORT = 13390

async function isServerAlive(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/api/health`, {
      signal: AbortSignal.timeout(2000)
    })
    return res.ok
  } catch {
    return false
  }
}

function spawnDaemon(port: number): void {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  const daemonPath = join(__dirname, 'daemon.mjs')

  const child = spawn(process.execPath, [daemonPath, String(port)], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env }
  })
  child.unref()
}

async function ensureServer(port: number): Promise<string> {
  const url = `http://localhost:${port}`

  if (await isServerAlive(url)) {
    return url
  }

  spawnDaemon(port)

  for (let attempt = 0; attempt < 50; attempt++) {
    await new Promise((r) => setTimeout(r, 100))
    if (await isServerAlive(url)) {
      return url
    }
  }

  throw new Error(`Server failed to start on ${url} after 5s`)
}

async function main() {
  const url = await ensureServer(PORT)
  await startMcp(url)
}

main().catch((err) => {
  console.error('[ask-user-questions] Fatal error:', err)
  process.exit(1)
})
