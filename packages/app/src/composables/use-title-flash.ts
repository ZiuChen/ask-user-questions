import { onScopeDispose } from 'vue'

export function useTitleFlash() {
  let titleFlashTimer: ReturnType<typeof setInterval> | undefined
  const originalTitle = document.title

  onScopeDispose(() => {
    stop()
  })

  const start = (text: string) => {
    stop()
    let show = true
    titleFlashTimer = setInterval(() => {
      document.title = show ? `🔔 ${text}` : originalTitle
      show = !show
    }, 1000)
  }

  const stop = () => {
    if (titleFlashTimer !== undefined) {
      clearInterval(titleFlashTimer)
      titleFlashTimer = undefined
      document.title = originalTitle
    }
  }

  return {
    start,
    stop
  }
}
