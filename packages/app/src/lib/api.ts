export interface QuestionOption {
  label: string
  description?: string
  recommended?: boolean
}

export interface SubQuestion {
  question: string
  multiSelect: boolean
  options?: QuestionOption[]
}

export interface SubQuestionAnswer {
  selected: string[]
  freeText?: string
}

export interface Question {
  id: string
  questions: SubQuestion[]
  status: 'pending' | 'answered' | 'timeout'
  answers?: SubQuestionAnswer[]
  createdAt: string
  answeredAt?: string
}

export interface AppConfig {
  timeout: number
  notification: boolean
  autoOpenBrowser: boolean
}

const API_BASE = '/api'

/**
 * Fetch all questions from the server.
 */
export async function fetchQuestions(): Promise<Question[]> {
  const res = await fetch(`${API_BASE}/questions`)
  const data = await res.json()
  return data.questions
}

/**
 * Fetch a single question by ID.
 */
export async function fetchQuestion(id: string): Promise<Question> {
  const res = await fetch(`${API_BASE}/questions/${id}`)
  if (!res.ok) throw new Error('Question not found')
  return res.json()
}

/**
 * Submit answers for a question group.
 */
export async function submitAnswer(
  questionId: string,
  answers: SubQuestionAnswer[]
): Promise<Question> {
  const res = await fetch(`${API_BASE}/questions/${questionId}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers })
  })
  return res.json()
}

/**
 * Fetch current config from the server.
 */
export async function fetchConfig(): Promise<AppConfig> {
  const res = await fetch(`${API_BASE}/config`)
  return res.json()
}

/**
 * Update config on the server.
 */
export async function updateConfig(config: Partial<AppConfig>): Promise<AppConfig> {
  const res = await fetch(`${API_BASE}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  })
  return res.json()
}

export interface WSMessage {
  event: string
  data: unknown
}

/**
 * Connect to the WebSocket for real-time updates.
 * Automatically reconnects on close/error.
 */
export function connectWS(handlers: {
  onInit?: (questions: Question[], config: AppConfig) => void
  onCreated?: (question: Question) => void
  onAnswered?: (question: Question) => void
  onRemind?: (question: Question) => void
  onConfigUpdated?: (config: AppConfig) => void
  onConnected?: () => void
  onDisconnected?: () => void
}): { close: () => void } {
  let ws: WebSocket | null = null
  let closed = false
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined

  function getWsUrl(): string {
    const loc = window.location
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${loc.host}${API_BASE}/ws`
  }

  function connect() {
    if (closed) return

    ws = new WebSocket(getWsUrl())

    ws.onopen = () => {
      handlers.onConnected?.()
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage
        switch (msg.event) {
          case 'init': {
            const { questions, config } = msg.data as {
              questions: Question[]
              config: AppConfig
            }
            handlers.onInit?.(questions, config)
            break
          }
          case 'question:created':
            handlers.onCreated?.(msg.data as Question)
            break
          case 'question:answered':
            handlers.onAnswered?.(msg.data as Question)
            break
          case 'question:remind':
            handlers.onRemind?.(msg.data as Question)
            break
          case 'config:updated':
            handlers.onConfigUpdated?.(msg.data as AppConfig)
            break
        }
      } catch {
        // Ignore malformed messages
      }
    }

    ws.onclose = () => {
      handlers.onDisconnected?.()
      scheduleReconnect()
    }

    ws.onerror = () => {
      ws?.close()
    }
  }

  function scheduleReconnect() {
    if (closed) return
    reconnectTimer = setTimeout(() => {
      connect()
    }, 3000)
  }

  connect()

  return {
    close() {
      closed = true
      clearTimeout(reconnectTimer)
      ws?.close()
    }
  }
}
