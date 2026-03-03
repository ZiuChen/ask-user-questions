import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadConfig } from './config.js'
import { startMcp } from './mcp.js'

const PORT = 13390

/** Check if the HTTP server is alive */
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

/** Spawn the daemon process (detached) to run the HTTP server */
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
  console.error(`[ask-user-questions] Spawned daemon server (pid: ${child.pid})`)
}

/** Ensure the HTTP server daemon is running, then return the URL */
async function ensureServer(port: number): Promise<string> {
  const url = `http://localhost:${port}`

  // Already running?
  if (await isServerAlive(url)) {
    console.error(`[ask-user-questions] Server already running on ${url}`)
    return url
  }

  // Not running — spawn daemon
  spawnDaemon(port)

  // Wait for daemon to become ready
  for (let attempt = 0; attempt < 50; attempt++) {
    await new Promise((r) => setTimeout(r, 100))
    if (await isServerAlive(url)) {
      console.error(`[ask-user-questions] Server is ready on ${url}`)
      return url
    }
  }

  throw new Error(`Server failed to start on ${url} after 5s`)
}

async function main() {
  loadConfig()
  const url = await ensureServer(PORT)
  // MCP always uses proxy mode — the daemon owns the store
  await startMcp(url)
}

main().catch((err) => {
  console.error('[ask-user-questions] Fatal error:', err)
  process.exit(1)
})
