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

/**
 * Connect to the SSE event stream for real-time updates.
 */
export function connectSSE(handlers: {
  onInit?: (questions: Question[], config: AppConfig) => void
  onCreated?: (question: Question) => void
  onAnswered?: (question: Question) => void
  onConfigUpdated?: (config: AppConfig) => void
  onError?: (error: Event) => void
}): EventSource {
  const source = new EventSource(`${API_BASE}/events`)

  source.addEventListener('init', (e: MessageEvent) => {
    const data = JSON.parse(e.data)
    handlers.onInit?.(data.questions, data.config)
  })

  source.addEventListener('question:created', (e: MessageEvent) => {
    const question = JSON.parse(e.data)
    handlers.onCreated?.(question)
  })

  source.addEventListener('question:answered', (e: MessageEvent) => {
    const question = JSON.parse(e.data)
    handlers.onAnswered?.(question)
  })

  source.addEventListener('config:updated', (e: MessageEvent) => {
    const config = JSON.parse(e.data)
    handlers.onConfigUpdated?.(config)
  })

  source.onerror = (e) => {
    handlers.onError?.(e)
  }

  return source
}
