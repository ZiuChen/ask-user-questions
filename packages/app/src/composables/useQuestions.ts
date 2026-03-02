import { onMounted, onUnmounted, ref } from 'vue'
import {
  type AppConfig,
  type Question,
  type SubQuestionAnswer,
  connectSSE,
  fetchQuestions,
  submitAnswer
} from '@/lib/api'

export function useQuestions() {
  const questions = ref<Question[]>([])
  const config = ref<AppConfig>({ timeout: 0 })
  const connected = ref(false)
  const error = ref<string | null>(null)
  let eventSource: EventSource | null = null
  let titleFlashTimer: ReturnType<typeof setInterval> | undefined
  const originalTitle = document.title

  function upsertQuestion(question: Question) {
    const index = questions.value.findIndex((q) => q.id === question.id)
    if (index >= 0) {
      questions.value[index] = question
    } else {
      questions.value.unshift(question)
    }
  }

  function startTitleFlash(text: string) {
    stopTitleFlash()
    let show = true
    titleFlashTimer = setInterval(() => {
      document.title = show ? `🔔 ${text}` : originalTitle
      show = !show
    }, 1000)
  }

  function stopTitleFlash() {
    if (titleFlashTimer !== undefined) {
      clearInterval(titleFlashTimer)
      titleFlashTimer = undefined
      document.title = originalTitle
    }
  }

  function handleVisibilityChange() {
    if (!document.hidden) {
      stopTitleFlash()
    }
  }

  function connect() {
    eventSource = connectSSE({
      onInit(initialQuestions, initialConfig) {
        questions.value = initialQuestions
        config.value = initialConfig
        connected.value = true
        error.value = null
      },
      onCreated(question) {
        upsertQuestion(question)
        // Notify user if tab is not focused
        if (document.hidden) {
          const preview = question.questions[0]?.question.slice(0, 30) || 'New Question'
          startTitleFlash(preview)
          try {
            if (Notification.permission === 'granted') {
              new Notification('New Question', {
                body: question.questions[0]?.question.slice(0, 100),
                tag: 'ask-user-questions'
              })
            }
          } catch {
            // Notification API may not be available
          }
        }
      },
      onAnswered(question) {
        upsertQuestion(question)
      },
      onConfigUpdated(newConfig) {
        config.value = newConfig
      },
      onError() {
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

  async function refresh() {
    try {
      questions.value = await fetchQuestions()
      error.value = null
    } catch {
      // Silently fail - SSE init will provide data
    }
  }

  onMounted(() => {
    // Immediately fetch questions via REST as fallback
    // This ensures questions appear even if SSE init is delayed
    refresh()
    // Then connect SSE for real-time updates
    connect()
    // Request notification permission
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission()
      }
    } catch {
      // Notification API may not be available
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onUnmounted(() => {
    eventSource?.close()
    stopTitleFlash()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })

  return {
    questions,
    config,
    connected,
    error,
    answer,
    refresh
  }
}
