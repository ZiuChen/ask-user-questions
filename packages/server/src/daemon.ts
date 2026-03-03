/**
 * Daemon entry point — runs ONLY the HTTP server as a detached background process.
 * Launched automatically by bin.ts when no server is already running.
 *
 * Usage: node daemon.mjs <port>
 */
import { loadConfig } from './config.js'
import { startServer } from './server.js'

const port = parseInt(process.argv[2] || '13390', 10)

loadConfig()
startServer(port).then(({ url, isLocal }) => {
  if (!isLocal) {
    // Another server already has the port — nothing for us to do
    console.error(`[ask-user-questions] Daemon: port ${port} already in use, exiting.`)
    process.exit(0)
  }
  console.error(`[ask-user-questions] Daemon server running on ${url} (pid: ${process.pid})`)

  // Write PID file so other processes can find us
  writePidFile(process.pid)

  // Clean up PID file on exit
  const cleanup = () => {
    removePidFile()
    process.exit(0)
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
})

// --- PID file helpers ---
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const PID_DIR = join(homedir(), '.ask-user-questions')
const PID_FILE = join(PID_DIR, 'server.pid')

function writePidFile(pid: number): void {
  try {
    if (!existsSync(PID_DIR)) {
      mkdirSync(PID_DIR, { recursive: true })
    }
    writeFileSync(PID_FILE, String(pid), 'utf-8')
  } catch {
    // best-effort
  }
}

function removePidFile(): void {
  try {
    if (existsSync(PID_FILE)) {
      unlinkSync(PID_FILE)
    }
  } catch {
    // best-effort
  }
}
