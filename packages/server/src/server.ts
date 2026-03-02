import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { serve } from 'srvx'
import { getConfig, updateConfig } from './config.js'
import { store } from './store.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const PUBLIC_DIR = join(__dirname, 'public')

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
}

export function createApp(): Hono {
  const app = new Hono()

  // CORS for development (Vue dev server on different port)
  app.use(
    '/api/*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type']
    })
  )

  // --- API Routes ---

  // List all questions
  app.get('/api/questions', (c) => {
    return c.json({ questions: store.getQuestions() })
  })

  // List pending questions
  app.get('/api/questions/pending', (c) => {
    return c.json({ questions: store.getPendingQuestions() })
  })

  // Get a single question
  app.get('/api/questions/:id', (c) => {
    const question = store.getQuestion(c.req.param('id'))
    if (!question) {
      return c.json({ error: 'Question not found' }, 404)
    }
    return c.json(question)
  })

  // Answer a question group
  app.post('/api/questions/:id/answer', async (c) => {
    const body = await c.req.json<{ answers: { selected: string[]; freeText?: string }[] }>()
    if (!body.answers || !Array.isArray(body.answers)) {
      return c.json({ error: 'Answers array is required' }, 400)
    }
    const question = store.answerQuestion(c.req.param('id'), body.answers)
    if (!question) {
      return c.json({ error: 'Question not found or already answered' }, 404)
    }
    return c.json(question)
  })

  // --- Config API ---

  // Get current config
  app.get('/api/config', (c) => {
    return c.json(getConfig())
  })

  // Update config (partial)
  app.put('/api/config', async (c) => {
    const body = await c.req.json()
    const updated = updateConfig(body)
    // Notify connected clients
    store.emitConfigUpdate(updated)
    return c.json(updated)
  })

  // SSE event stream for real-time updates
  app.get('/api/events', (c) => {
    return streamSSE(c, async (stream) => {
      // Send initial data
      await stream.writeSSE({
        event: 'init',
        data: JSON.stringify({ questions: store.getQuestions(), config: getConfig() })
      })

      const unsubscribe = store.subscribe(async (event, data) => {
        try {
          await stream.writeSSE({
            event,
            data: JSON.stringify(data)
          })
        } catch {
          // Stream closed
        }
      })

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(async () => {
        try {
          await stream.writeSSE({ event: 'heartbeat', data: '' })
        } catch {
          clearInterval(heartbeat)
        }
      }, 15000)

      // Wait for client disconnect
      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          clearInterval(heartbeat)
          unsubscribe()
          resolve()
        })
      })
    })
  })

  // Health check
  app.get('/api/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // --- Static File Serving (SPA) ---
  app.get('/*', async (c) => {
    const reqPath = c.req.path === '/' ? '/index.html' : c.req.path

    try {
      const filePath = join(PUBLIC_DIR, reqPath)
      const content = await readFile(filePath)
      const ext = extname(reqPath)
      const contentType = MIME_TYPES[ext] || 'application/octet-stream'
      return new Response(content, {
        headers: { 'Content-Type': contentType }
      })
    } catch {
      // SPA fallback: serve index.html for non-file routes
      try {
        const content = await readFile(join(PUBLIC_DIR, 'index.html'), 'utf-8')
        return c.html(content)
      } catch {
        return c.text('App not built. Run `pnpm build` first.', 404)
      }
    }
  })

  return app
}

/** Check if a port is available */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = createServer()
    s.once('error', () => resolve(false))
    s.once('listening', () => {
      s.close(() => resolve(true))
    })
    s.listen(port)
  })
}

export async function startServer(port: number): Promise<{ url: string }> {
  const app = createApp()
  const url = `http://localhost:${port}`

  const available = await isPortAvailable(port)
  if (!available) {
    console.error(`[ask-user-questions] Port ${port} is already in use.`)
    console.error(`[ask-user-questions] Another instance may be running. Attempting to reuse.`)
    return { url }
  }

  const server = serve({
    port,
    fetch: app.fetch,
    silent: true
  })

  await server.ready()
  console.error(`[ask-user-questions] Server running on ${url}`)

  return { url }
}
