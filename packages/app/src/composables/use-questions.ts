import {
  type InjectionKey,
  type Ref,
  computed,
  inject,
  onMounted,
  onUnmounted,
  provide,
  ref,
  watch
} from 'vue'
import {
  type AppConfig,
  type Question,
  type SubQuestionAnswer,
  connectWS,
  submitAnswer
} from '@/lib/api'
import { useTitleFlash } from './use-title-flash'
import { useDocumentVisibility, useFavicon } from '@vueuse/core'

export interface QuestionsContext {
  questions: Ref<Question[]>
  config: Ref<AppConfig>
  connected: Ref<boolean>
  error: Ref<string | null>
  answer: (questionId: string, answers: SubQuestionAnswer[]) => Promise<void>
}

const QUESTIONS_KEY: InjectionKey<QuestionsContext> = Symbol('questions')

/**
 * Initialize the WebSocket connection and global question state.
 * Should be called ONCE in the root component (App.vue).
 * Provides global state via Vue's provide/inject.
 */
export function provideQuestions(): QuestionsContext {
  const questions = ref<Question[]>([])
  const config = ref<AppConfig>({ timeout: 0, notification: true, autoOpenBrowser: true })
  const connected = ref(false)
  const error = ref<string | null>(null)
  let wsConnection: { close: () => void } | null = null

  const visibility = useDocumentVisibility()
  const { start, stop } = useTitleFlash()

  watch(visibility, (visibility) => {
    if (visibility === 'visible') {
      stop()
    }
  })

  useFavicon(
    computed(() => {
      const hasPending = questions.value.some((q) => q.status === 'pending')
      return hasPending ? '/logo-dot.png' : '/logo.png'
    })
  )

  function upsertQuestion(question: Question) {
    const index = questions.value.findIndex((q) => q.id === question.id)
    if (index >= 0) {
      questions.value[index] = question
    } else {
      questions.value.unshift(question)
    }
  }

  function connect() {
    wsConnection = connectWS({
      onInit(initialQuestions, initialConfig) {
        questions.value = initialQuestions
        config.value = initialConfig
        error.value = null
      },
      onCreated(question) {
        upsertQuestion(question)
        if (visibility.value === 'hidden') {
          const preview = question.questions[0]?.question.slice(0, 30) || 'New Question'
          start(preview)
        }
      },
      onAnswered(question) {
        upsertQuestion(question)
        stop()
      },
      onRemind(question) {
        upsertQuestion(question)
        if (visibility.value === 'hidden') {
          const preview = question.questions[0]?.question.slice(0, 30) || 'New Question'
          start(preview)
        }
      },
      onConfigUpdated(newConfig) {
        config.value = newConfig
      },
      onConnected() {
        connected.value = true
        error.value = null
      },
      onDisconnected() {
        connected.value = false
        error.value = 'connectionLost'
      }
    })
  }

  async function answer(questionId: string, answers: SubQuestionAnswer[]) {
    try {
      const updated = await submitAnswer(questionId, answers)
      upsertQuestion(updated)
    } catch (e) {
      error.value = `${e}`
    }
  }

  onMounted(() => {
    connect()
  })

  onUnmounted(() => {
    wsConnection?.close()
  })

  const ctx: QuestionsContext = { questions, config, connected, error, answer }
  provide(QUESTIONS_KEY, ctx)
  return ctx
}

/**
 * Inject the global question state. Must be used in a descendant of App.vue.
 */
export function useQuestions(): QuestionsContext {
  const ctx = inject(QUESTIONS_KEY)
  if (!ctx) {
    throw new Error('useQuestions() must be used inside a component that calls provideQuestions()')
  }
  return ctx
}
