import { randomUUID } from 'node:crypto'
import type { AppConfig } from './config.js'
import { getConfig } from './config.js'
import type { Question, SubQuestion, SubQuestionAnswer } from './types.js'

type Listener = (event: string, data: unknown) => void

class Store {
  private questions = new Map<string, Question>()
  private waiters = new Map<string, (answers: SubQuestionAnswer[]) => void>()
  private listeners = new Set<Listener>()

  createQuestion(subQuestions: SubQuestion[]): Question {
    const q: Question = {
      id: randomUUID(),
      questions: subQuestions,
      status: 'pending',
      createdAt: new Date().toISOString()
    }
    this.questions.set(q.id, q)
    this.emit('question:created', q)
    return q
  }

  answerQuestion(id: string, answers: SubQuestionAnswer[]): Question | null {
    const q = this.questions.get(id)
    if (!q || q.status !== 'pending') return null

    q.answers = answers
    q.status = 'answered'
    q.answeredAt = new Date().toISOString()

    const waiter = this.waiters.get(id)
    if (waiter) {
      waiter(answers)
      this.waiters.delete(id)
    }

    this.emit('question:answered', q)
    return q
  }

  waitForAnswer(id: string): Promise<SubQuestionAnswer[]> {
    const q = this.questions.get(id)
    if (q?.answers) return Promise.resolve(q.answers)

    const config = getConfig()
    return new Promise<SubQuestionAnswer[]>((resolve) => {
      this.waiters.set(id, resolve)

      if (config.timeout > 0) {
        setTimeout(() => {
          if (this.waiters.has(id)) {
            this.waiters.delete(id)
            const question = this.questions.get(id)
            if (question && question.status === 'pending') {
              question.status = 'timeout'
              question.answers = question.questions.map(() => ({
                selected: [],
                freeText: '[Timeout: No response from user]'
              }))
              question.answeredAt = new Date().toISOString()
              this.emit('question:answered', question)
            }
            resolve(
              question?.answers ?? [{ selected: [], freeText: '[Timeout: No response from user]' }]
            )
          }
        }, config.timeout)
      }
    })
  }

  getQuestions(): Question[] {
    return Array.from(this.questions.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  getPendingQuestions(): Question[] {
    return this.getQuestions().filter((q) => q.status === 'pending')
  }

  getQuestion(id: string): Question | null {
    return this.questions.get(id) ?? null
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  emitConfigUpdate(config: AppConfig): void {
    this.emit('config:updated', config)
  }

  private emit(event: string, data: unknown): void {
    for (const listener of this.listeners) {
      listener(event, data)
    }
  }
}

export const store = new Store()
