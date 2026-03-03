import { createI18n } from 'vue-i18n'
import en from '@/locales/en.json'
import zhCN from '@/locales/zh-CN.json'
import ko from '@/locales/ko.json'
import ja from '@/locales/ja.json'
import ru from '@/locales/ru.json'

export type Locale = 'en' | 'zh-CN' | 'ko' | 'ja' | 'ru'

export const ALL_LOCALES: Locale[] = ['en', 'zh-CN', 'ko', 'ja', 'ru']

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  'zh-CN': '中文',
  ko: '한국어',
  ja: '日本語',
  ru: 'Русский'
}

function detectLocale(): Locale {
  const stored = localStorage.getItem('locale')
  if (stored && ALL_LOCALES.includes(stored as Locale)) return stored as Locale

  const lang = navigator.language
  if (lang.startsWith('zh')) return 'zh-CN'
  if (lang.startsWith('ko')) return 'ko'
  if (lang.startsWith('ja')) return 'ja'
  if (lang.startsWith('ru')) return 'ru'
  return 'en'
}

const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'en',
  messages: {
    en,
    'zh-CN': zhCN,
    ko,
    ja,
    ru
  }
})

export default i18n

export function setLocale(locale: Locale) {
  ;(i18n.global.locale as unknown as { value: string }).value = locale
  localStorage.setItem('locale', locale)
  document.documentElement.lang = locale
}
