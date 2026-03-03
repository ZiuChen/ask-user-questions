import { exec, execSync, spawn } from 'node:child_process'
import { platform } from 'node:os'
import notifier from 'node-notifier'

/**
 * Chromium-based browsers supported for JXA tab reuse on macOS.
 * Order matters — first match wins when checking `ps cax` output.
 * (From Vite / create-react-app)
 */
const CHROMIUM_BROWSERS = [
  'Google Chrome Canary',
  'Google Chrome Dev',
  'Google Chrome Beta',
  'Google Chrome',
  'Microsoft Edge',
  'Brave Browser',
  'Vivaldi',
  'Chromium'
]

/**
 * Send a system notification using node-notifier.
 * When the user clicks the notification, the optional `onClick` callback is invoked.
 */
export function notify(message: string, title = 'Ask User Questions', onClick?: () => void): void {
  notifier.notify({
    title,
    message,
    sound: true,
    wait: !!onClick
  })

  if (onClick) {
    notifier.once('click', onClick)
  }
}

/**
 * Open a URL in the user's default browser (cross-platform fallback).
 */
function openDefault(url: string): void {
  const os = platform()
  try {
    if (os === 'darwin') {
      exec(`open ${JSON.stringify(url)}`)
    } else if (os === 'win32') {
      exec(`start "" ${JSON.stringify(url)}`)
    } else {
      exec(`xdg-open ${JSON.stringify(url)}`)
    }
  } catch {
    // best-effort
  }
}

/**
 * JXA (JavaScript for Automation) script to find and reuse an existing tab
 * in a Chromium-based browser on macOS, or open a new tab if not found.
 *
 * Adapted from Vite / create-react-app's openChrome.js approach.
 */
function chromiumJxaScript(url: string, browser: string): string {
  const safeUrl = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const safeBrowser = browser.replace(/"/g, '\\"')
  return `
    var browser = Application("${safeBrowser}");
    browser.activate();
    var found = false;
    var windows = browser.windows();
    for (var i = 0; i < windows.length; i++) {
      var tabs = windows[i].tabs();
      for (var j = 0; j < tabs.length; j++) {
        if (tabs[j].url().includes("${safeUrl}")) {
          windows[i].activeTabIndex = j + 1;
          windows[i].index = 1;
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (!found) {
      if (windows.length === 0) {
        browser.Window().make();
      }
      var newTab = browser.Tab({ url: "${safeUrl}" });
      browser.windows[0].tabs.push(newTab);
      browser.windows[0].activeTabIndex = browser.windows[0].tabs.length;
    }
  `
}

/**
 * Try to reuse an existing Chromium browser tab on macOS.
 *
 * 1. Check running processes via `ps cax` to find a Chromium browser
 * 2. If found, run a JXA script that searches for a matching tab and focuses it
 * 3. If no matching tab, opens a new tab in that browser
 *
 * Returns true if a Chromium browser was found (tab reuse attempted).
 *
 * Reference: Vite's `startBrowserProcess` implementation
 * https://github.com/vitejs/vite/blob/main/packages/vite/src/node/server/openBrowser.ts
 */
function tryReuseChromiumTab(url: string): boolean {
  if (platform() !== 'darwin') return false

  try {
    const ps = execSync('ps cax', { encoding: 'utf-8' })
    const browser = CHROMIUM_BROWSERS.find((b) => ps.includes(b))
    if (!browser) return false

    // Run JXA via osascript, piping the script to stdin
    const script = chromiumJxaScript(url, browser)
    const child = spawn('osascript', ['-l', 'JavaScript'], {
      stdio: ['pipe', 'ignore', 'ignore'],
      detached: true
    })
    child.stdin.write(script)
    child.stdin.end()
    child.unref()
    return true
  } catch {
    return false
  }
}

/**
 * Open the browser, attempting to reuse an existing tab.
 *
 * On macOS: try Chromium JXA tab reuse → fallback to `open`.
 * On other platforms: use system default opener.
 */
export function openOrFocusBrowser(url: string): void {
  const reused = tryReuseChromiumTab(url)
  if (!reused) {
    openDefault(url)
  }
}
