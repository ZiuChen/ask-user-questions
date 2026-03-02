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

export interface SSEEvent {
  event: string
  data: string
}
