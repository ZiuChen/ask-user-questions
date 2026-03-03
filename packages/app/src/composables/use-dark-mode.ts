import { ref, watch } from 'vue'

export type Theme = 'light' | 'dark' | 'system'

const theme = ref<Theme>((localStorage.getItem('theme') as Theme) || 'system')

function applyTheme(t: Theme) {
  const isDark =
    t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
}

// Apply on ref change
watch(
  theme,
  (newTheme) => {
    localStorage.setItem('theme', newTheme)
    applyTheme(newTheme)
  },
  { immediate: true }
)

// React to system preference changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (theme.value === 'system') {
    applyTheme('system')
  }
})

export function useDarkMode() {
  function setTheme(newTheme: Theme) {
    theme.value = newTheme
  }

  function cycleTheme() {
    const order: Theme[] = ['system', 'light', 'dark']
    const idx = order.indexOf(theme.value)
    theme.value = order[(idx + 1) % order.length]
  }

  return {
    theme,
    setTheme,
    cycleTheme
  }
}
