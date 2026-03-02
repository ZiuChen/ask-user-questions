import { computed, ref } from 'vue'

export type Locale = 'en' | 'zh-CN' | 'ko' | 'ja' | 'ru'

export interface Messages {
  // General
  appTitle: string
  questions: string
  settings: string
  connected: string
  disconnected: string

  // Question status
  aiQuestion: string
  answered: string
  timedOut: string
  pending: string

  // Question card
  freeText: string
  typeYourAnswer: string
  pressToSubmit: string
  submitAnswer: string
  submitting: string
  selectOneOrMore: string
  yourAnswer: string
  timedOutLabel: string
  answeredAt: string
  timedOutAt: string

  // Question list
  pendingQuestions: string
  history: string

  // Empty state
  noQuestionsYet: string
  noQuestionsDescription: string

  // Settings
  notification: string
  notificationDescription: string
  autoOpenBrowser: string
  autoOpenBrowserDescription: string
  timeout: string
  timeoutDescription: string
  noTimeout: string
  secondsUnit: string
  minutesUnit: string
  timeoutHint: string
  saveSettings: string
  saving: string
  saved: string
  language: string

  // Error
  connectionLost: string
  failedToSubmit: string

  // Theme
  theme: string
  light: string
  dark: string
  system: string
}

const allMessages: Record<Locale, Messages> = {
  en: {
    appTitle: 'Ask User Questions',
    questions: 'Questions',
    settings: 'Settings',
    connected: 'Connected',
    disconnected: 'Disconnected',

    aiQuestion: '🤖 AI Question',
    answered: '✅ Answered',
    timedOut: '⏰ Timed Out',
    pending: 'Pending',

    freeText: 'Free Text',

    typeYourAnswer: 'Type your answer...',
    pressToSubmit: 'Press {shortcut} to submit',
    submitAnswer: 'Submit Answer',
    submitting: 'Submitting...',
    selectOneOrMore: 'Select one or more options',
    yourAnswer: 'Your answer:',
    timedOutLabel: 'Timed out',
    answeredAt: 'Answered at',
    timedOutAt: 'Timed out at',

    pendingQuestions: 'Pending Questions',
    history: 'History',

    noQuestionsYet: 'No questions yet',
    noQuestionsDescription:
      'When an AI model needs clarification, questions will appear here. Keep this page open to respond in real time.',

    notification: 'System Notifications',
    notificationDescription: 'Show a system notification when the AI model asks a question.',
    autoOpenBrowser: 'Auto Open Browser',
    autoOpenBrowserDescription:
      'Automatically open the web page when the AI model asks a question.',
    timeout: 'Timeout',
    timeoutDescription:
      "How long to wait for the user's answer before auto-responding with a timeout message.",
    noTimeout: 'No timeout',
    secondsUnit: 's',
    minutesUnit: 'min',
    timeoutHint: '0 = wait forever. Range: 0 – 10 minutes.',
    saveSettings: 'Save Settings',
    saving: 'Saving...',
    saved: 'Saved!',
    language: 'Language',

    connectionLost: 'Connection lost. Retrying...',
    failedToSubmit: 'Failed to submit answer',

    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    system: 'System'
  },

  'zh-CN': {
    appTitle: '询问用户',
    questions: '问题',
    settings: '设置',
    connected: '已连接',
    disconnected: '未连接',

    aiQuestion: '🤖 AI 提问',
    answered: '✅ 已回答',
    timedOut: '⏰ 已超时',
    pending: '待回答',

    freeText: '自由文本',

    typeYourAnswer: '输入你的回答...',
    pressToSubmit: '按 {shortcut} 提交',
    submitAnswer: '提交回答',
    submitting: '提交中...',
    selectOneOrMore: '选择一个或多个选项',
    yourAnswer: '你的回答：',
    timedOutLabel: '已超时',
    answeredAt: '回答于',
    timedOutAt: '超时于',

    pendingQuestions: '待回答问题',
    history: '历史记录',

    noQuestionsYet: '暂无问题',
    noQuestionsDescription: '当 AI 模型需要确认时，问题将显示在这里。请保持页面开启以实时回复。',

    notification: '系统通知',
    notificationDescription: '当 AI 模型提问时，显示系统通知。',
    autoOpenBrowser: '自动打开浏览器',
    autoOpenBrowserDescription: '当 AI 模型提问时，自动打开前端页面。',
    timeout: '超时时间',
    timeoutDescription: '等待用户回答的最长时间，超时后将自动返回超时消息。',
    noTimeout: '无超时',
    secondsUnit: '秒',
    minutesUnit: '分钟',
    timeoutHint: '0 = 永不超时。范围：0 – 10 分钟。',
    saveSettings: '保存设置',
    saving: '保存中...',
    saved: '已保存！',
    language: '语言',

    connectionLost: '连接已断开，正在重试...',
    failedToSubmit: '提交回答失败',

    theme: '主题',
    light: '浅色',
    dark: '深色',
    system: '跟随系统'
  },

  ko: {
    appTitle: '사용자에게 질문',
    questions: '질문',
    settings: '설정',
    connected: '연결됨',
    disconnected: '연결 끊김',

    aiQuestion: '🤖 AI 질문',
    answered: '✅ 답변 완료',
    timedOut: '⏰ 시간 초과',
    pending: '대기 중',

    freeText: '자유 텍스트',

    typeYourAnswer: '답변을 입력하세요...',
    pressToSubmit: '{shortcut}로 제출',
    submitAnswer: '답변 제출',
    submitting: '제출 중...',
    selectOneOrMore: '하나 이상의 옵션을 선택하세요',
    yourAnswer: '답변:',
    timedOutLabel: '시간 초과',
    answeredAt: '답변 시각',
    timedOutAt: '초과 시각',

    pendingQuestions: '대기 중인 질문',
    history: '기록',

    noQuestionsYet: '아직 질문이 없습니다',
    noQuestionsDescription:
      'AI 모델이 확인이 필요할 때 질문이 여기에 표시됩니다. 실시간으로 응답하려면 이 페이지를 열어 두세요.',

    notification: '시스템 알림',
    notificationDescription: 'AI 모델이 질문할 때 시스템 알림을 표시합니다.',
    autoOpenBrowser: '자동 브라우저 열기',
    autoOpenBrowserDescription: 'AI 모델이 질문할 때 자동으로 웹 페이지를 엽니다.',
    timeout: '시간 제한',
    timeoutDescription:
      '사용자의 답변을 기다리는 최대 시간. 시간 초과 시 자동으로 시간 초과 메시지가 전송됩니다.',
    noTimeout: '제한 없음',
    secondsUnit: '초',
    minutesUnit: '분',
    timeoutHint: '0 = 무제한. 범위: 0 – 10분.',
    saveSettings: '설정 저장',
    saving: '저장 중...',
    saved: '저장됨!',
    language: '언어',

    connectionLost: '연결이 끊겼습니다. 재시도 중...',
    failedToSubmit: '답변 제출 실패',

    theme: '테마',
    light: '라이트',
    dark: '다크',
    system: '시스템'
  },

  ja: {
    appTitle: 'ユーザーに質問',
    questions: '質問',
    settings: '設定',
    connected: '接続済み',
    disconnected: '切断',

    aiQuestion: '🤖 AI質問',
    answered: '✅ 回答済み',
    timedOut: '⏰ タイムアウト',
    pending: '回答待ち',

    freeText: 'フリーテキスト',

    typeYourAnswer: '回答を入力...',
    pressToSubmit: '{shortcut}で送信',
    submitAnswer: '回答を送信',
    submitting: '送信中...',
    selectOneOrMore: '1つ以上のオプションを選択してください',
    yourAnswer: 'あなたの回答：',
    timedOutLabel: 'タイムアウト',
    answeredAt: '回答時刻',
    timedOutAt: 'タイムアウト時刻',

    pendingQuestions: '回答待ちの質問',
    history: '履歴',

    noQuestionsYet: 'まだ質問はありません',
    noQuestionsDescription:
      'AIモデルが確認を必要とする場合、ここに質問が表示されます。リアルタイムで応答するには、このページを開いたままにしてください。',

    notification: 'システム通知',
    notificationDescription: 'AIモデルが質問した時にシステム通知を表示します。',
    autoOpenBrowser: 'ブラウザ自動起動',
    autoOpenBrowserDescription: 'AIモデルが質問した時に自動的にWebページを開きます。',
    timeout: 'タイムアウト',
    timeoutDescription:
      'ユーザーの回答を待つ最大時間。タイムアウト時にタイムアウトメッセージが自動返信されます。',
    noTimeout: 'タイムアウトなし',
    secondsUnit: '秒',
    minutesUnit: '分',
    timeoutHint: '0 = 無制限。範囲：0 – 10分。',
    saveSettings: '設定を保存',
    saving: '保存中...',
    saved: '保存しました！',
    language: '言語',

    connectionLost: '接続が切れました。再試行中...',
    failedToSubmit: '回答の送信に失敗しました',

    theme: 'テーマ',
    light: 'ライト',
    dark: 'ダーク',
    system: 'システム'
  },

  ru: {
    appTitle: 'Вопросы пользователю',
    questions: 'Вопросы',
    settings: 'Настройки',
    connected: 'Подключено',
    disconnected: 'Отключено',

    aiQuestion: '🤖 Вопрос AI',
    answered: '✅ Отвечено',
    timedOut: '⏰ Время истекло',
    pending: 'Ожидание',

    freeText: 'Свободный текст',

    typeYourAnswer: 'Введите ваш ответ...',
    pressToSubmit: '{shortcut} для отправки',
    submitAnswer: 'Отправить ответ',
    submitting: 'Отправка...',
    selectOneOrMore: 'Выберите один или несколько вариантов',
    yourAnswer: 'Ваш ответ:',
    timedOutLabel: 'Время истекло',
    answeredAt: 'Отвечено в',
    timedOutAt: 'Время истекло в',

    pendingQuestions: 'Ожидающие вопросы',
    history: 'История',

    noQuestionsYet: 'Пока нет вопросов',
    noQuestionsDescription:
      'Когда модели AI потребуется уточнение, вопросы появятся здесь. Оставьте эту страницу открытой для ответов в реальном времени.',

    notification: 'Системные уведомления',
    notificationDescription: 'Показывать системное уведомление, когда модель AI задаёт вопрос.',
    autoOpenBrowser: 'Автооткрытие браузера',
    autoOpenBrowserDescription:
      'Автоматически открывать веб-страницу, когда модель AI задаёт вопрос.',
    timeout: 'Тайм-аут',
    timeoutDescription:
      'Максимальное время ожидания ответа пользователя. При тайм-ауте автоматически отправляется сообщение о тайм-ауте.',
    noTimeout: 'Без тайм-аута',
    secondsUnit: 'с',
    minutesUnit: 'мин',
    timeoutHint: '0 = бессрочно. Диапазон: 0 – 10 минут.',
    saveSettings: 'Сохранить настройки',
    saving: 'Сохранение...',
    saved: 'Сохранено!',
    language: 'Язык',

    connectionLost: 'Соединение потеряно. Повторная попытка...',
    failedToSubmit: 'Не удалось отправить ответ',

    theme: 'Тема',
    light: 'Светлая',
    dark: 'Тёмная',
    system: 'Системная'
  }
}

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  'zh-CN': '中文',
  ko: '한국어',
  ja: '日本語',
  ru: 'Русский'
}

export const ALL_LOCALES: Locale[] = ['en', 'zh-CN', 'ko', 'ja', 'ru']

function detectLocale(): Locale {
  const stored = localStorage.getItem('locale')
  if (stored && stored in allMessages) return stored as Locale

  const lang = navigator.language
  if (lang.startsWith('zh')) return 'zh-CN'
  if (lang.startsWith('ko')) return 'ko'
  if (lang.startsWith('ja')) return 'ja'
  if (lang.startsWith('ru')) return 'ru'
  return 'en'
}

const currentLocale = ref<Locale>(detectLocale())

export function useI18n() {
  const t = computed(() => allMessages[currentLocale.value])

  function setLocale(locale: Locale) {
    currentLocale.value = locale
    localStorage.setItem('locale', locale)
    document.documentElement.lang = locale
  }

  return {
    t,
    locale: currentLocale,
    setLocale,
    locales: ALL_LOCALES,
    localeNames: LOCALE_NAMES
  }
}
