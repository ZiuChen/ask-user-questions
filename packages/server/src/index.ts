// Public API for programmatic usage
export { createApp, startServer } from './server.js'
export { startMcp } from './mcp.js'
export { store } from './store.js'
export { notify, openBrowser, openOrFocusBrowser } from './notify.js'
export { getConfig, loadConfig, saveConfig, updateConfig } from './config.js'
export type { AppConfig } from './config.js'
export type { Question, QuestionOption, SubQuestion, SubQuestionAnswer, SSEEvent } from './types.js'
