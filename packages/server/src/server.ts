import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createNodeWebSocket } from '@hono/node-ws'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
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

/** Track connected browser clients */
let browserClientCount = 0

export function hasBrowserClients(): boolean {
  return browserClientCount > 0
}

export function createApp() {
  const app = new Hono()
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

  // CORS for development (Vue dev server on different port)
  app.use(
    '/api/*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
      allowHeaders: ['Content-Type']
    })
  )

  // --- API Routes ---

  // List all questions
  app.get('/api/questions', (c) => {
    return c.json({ questions: store.getQuestions() })
  })

  // Get a single question
  app.get('/api/questions/:id', (c) => {
    const question = store.getQuestion(c.req.param('id'))
    if (!question) {
      return c.json({ error: 'Question not found' }, 404)
    }
    return c.json(question)
  })

  // Create a question group (used by MCP instances)
  app.post('/api/questions', async (c) => {
    const body = await c.req.json<{
      questions: {
        question: string
        multiSelect?: boolean
        options?: { label: string; description?: string; recommended?: boolean }[]
      }[]
    }>()
    if (!body.questions || !Array.isArray(body.questions)) {
      return c.json({ error: 'Questions array is required' }, 400)
    }
    const subQuestions = body.questions.map((q) => ({
      question: q.question,
      multiSelect: q.multiSelect ?? false,
      options: q.options
    }))
    const question = store.createQuestion(subQuestions)
    return c.json(question, 201)
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

  // Long-poll: wait for a question to be answered (used by MCP proxy)
  app.get('/api/questions/:id/wait', async (c) => {
    const id = c.req.param('id')
    const q = store.getQuestion(id)
    if (!q) {
      return c.json({ error: 'Question not found' }, 404)
    }
    if (q.status !== 'pending') {
      return c.json({ answers: q.answers })
    }
    const answers = await store.waitForAnswer(id)
    return c.json({ answers })
  })

  // --- Config API ---

  app.get('/api/config', (c) => {
    return c.json(getConfig())
  })

  app.put('/api/config', async (c) => {
    const body = await c.req.json()
    const updated = updateConfig(body)
    store.emitConfigUpdate(updated)
    return c.json(updated)
  })

  // --- WebSocket for real-time updates ---
  app.get(
    '/api/ws',
    upgradeWebSocket(() => {
      return {
        onOpen(_event, ws) {
          browserClientCount++
          console.error(
            `[ask-user-questions] Browser client connected (total: ${browserClientCount})`
          )

          // Send initial state
          ws.send(
            JSON.stringify({
              event: 'init',
              data: { questions: store.getQuestions(), config: getConfig() }
            })
          )

          // Subscribe to store events
          const unsubscribe = store.subscribe((event, data) => {
            try {
              ws.send(JSON.stringify({ event, data }))
            } catch {
              // Connection closed
            }
          })

          // Attach unsubscribe to ws for cleanup in onClose
          ;(ws as unknown as Record<string, unknown>).__unsubscribe = unsubscribe
        },
        onClose(_event, ws) {
          browserClientCount = Math.max(0, browserClientCount - 1)
          console.error(
            `[ask-user-questions] Browser client disconnected (total: ${browserClientCount})`
          )
          const unsubscribe = (ws as unknown as Record<string, unknown>).__unsubscribe as
            | (() => void)
            | undefined
          unsubscribe?.()
        },
        onError(_event, ws) {
          browserClientCount = Math.max(0, browserClientCount - 1)
          const unsubscribe = (ws as unknown as Record<string, unknown>).__unsubscribe as
            | (() => void)
            | undefined
          unsubscribe?.()
        }
      }
    })
  )

  // Health check (also reports browser client count)
  app.get('/api/health', (c) => {
    return c.json({
      status: 'ok',
      browserClients: browserClientCount,
      timestamp: new Date().toISOString()
    })
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

  return { app, injectWebSocket }
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

export async function startServer(port: number): Promise<{ url: string; isLocal: boolean }> {
  const { app, injectWebSocket } = createApp()
  const url = `http://localhost:${port}`

  const available = await isPortAvailable(port)
  if (!available) {
    console.error(`[ask-user-questions] Port ${port} is already in use.`)
    console.error(`[ask-user-questions] Another instance may be running. Attempting to reuse.`)
    return { url, isLocal: false }
  }

  const server = createServer(async (req, res) => {
    const response = await app.fetch(
      new Request(`http://localhost:${port}${req.url}`, {
        method: req.method,
        headers: req.headers as unknown as Record<string, string>,
        body:
          req.method !== 'GET' && req.method !== 'HEAD'
            ? (req as unknown as ReadableStream)
            : undefined,
        duplex: 'half'
      } as RequestInit)
    )
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()))
    if (response.body) {
      const reader = response.body.getReader()
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(value)
        }
        res.end()
      }
      pump().catch(() => res.end())
    } else {
      res.end()
    }
  })

  injectWebSocket(server)

  // Disable default timeouts — long-poll requests (e.g. /api/questions/:id/wait)
  // can last indefinitely when timeout=0 is configured.
  server.requestTimeout = 0
  server.headersTimeout = 0

  await new Promise<void>((resolve) => {
    server.listen(port, () => resolve())
  })

  console.error(`[ask-user-questions] Server running on ${url}`)
  return { url, isLocal: true }
}
