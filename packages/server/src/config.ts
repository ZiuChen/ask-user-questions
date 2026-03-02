import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface AppConfig {
  /** Timeout in ms for waiting for an answer. 0 = no timeout (default) */
  timeout: number
  /** Whether to show system notifications when the model asks a question. Default: true */
  notification: boolean
  /** Whether to automatically open the browser when the model asks a question. Default: true */
  autoOpenBrowser: boolean
}

const DEFAULT_CONFIG: AppConfig = {
  timeout: 0,
  notification: true,
  autoOpenBrowser: true
}

const CONFIG_DIR = join(homedir(), '.ask-user-questions')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

let currentConfig: AppConfig = { ...DEFAULT_CONFIG }

/** Load config from ~/.ask-user-questions/config.json, merge with defaults */
export function loadConfig(): AppConfig {
  try {
    if (existsSync(CONFIG_FILE)) {
      const raw = readFileSync(CONFIG_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      currentConfig = mergeConfig(parsed)
      console.error(`[ask-user-questions] Config loaded from ${CONFIG_FILE}`)
    } else {
      currentConfig = { ...DEFAULT_CONFIG }
      console.error(`[ask-user-questions] Using default config (no config file found)`)
    }
  } catch (err) {
    console.error(`[ask-user-questions] Failed to load config, using defaults:`, err)
    currentConfig = { ...DEFAULT_CONFIG }
  }
  return currentConfig
}

/** Save current config to disk */
export function saveConfig(config: Partial<AppConfig>): AppConfig {
  currentConfig = mergeConfig(config)
  try {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true })
    }
    writeFileSync(CONFIG_FILE, JSON.stringify(currentConfig, null, 2), 'utf-8')
    console.error(`[ask-user-questions] Config saved to ${CONFIG_FILE}`)
  } catch (err) {
    console.error(`[ask-user-questions] Failed to save config:`, err)
  }
  return currentConfig
}

/** Get current config (in-memory) */
export function getConfig(): AppConfig {
  return { ...currentConfig }
}

/** Update config in-memory and persist */
export function updateConfig(partial: Partial<AppConfig>): AppConfig {
  return saveConfig({ ...currentConfig, ...partial })
}

function mergeConfig(partial: Partial<AppConfig>): AppConfig {
  return {
    timeout:
      typeof partial.timeout === 'number' && partial.timeout >= 0
        ? partial.timeout
        : DEFAULT_CONFIG.timeout,
    notification:
      typeof partial.notification === 'boolean'
        ? partial.notification
        : DEFAULT_CONFIG.notification,
    autoOpenBrowser:
      typeof partial.autoOpenBrowser === 'boolean'
        ? partial.autoOpenBrowser
        : DEFAULT_CONFIG.autoOpenBrowser
  }
}
