import { exec, spawn } from 'node:child_process'
import { platform } from 'node:os'

let browserOpened = false

/**
 * Send a system notification to the user.
 */
export function notify(message: string, title = 'Ask User Questions'): void {
  const os = platform()

  try {
    if (os === 'darwin') {
      const escaped = message.replace(/"/g, '\\"')
      exec(`osascript -e 'display notification "${escaped}" with title "${title}"'`)
    } else if (os === 'win32') {
      const escaped = message.replace(/'/g, "''")
      exec(
        `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('${escaped}','${title}')" `
      )
    } else {
      exec(`notify-send "${title}" "${message}"`)
    }
  } catch {
    // Notification is best-effort, ignore errors
  }
}

/**
 * Open a URL in the user's default browser.
 */
export function openBrowser(url: string): void {
  const os = platform()

  try {
    if (os === 'darwin') {
      exec(`open "${url}"`)
    } else if (os === 'win32') {
      exec(`start "" "${url}"`)
    } else {
      exec(`xdg-open "${url}"`)
    }
  } catch {
    // Best-effort
  }
}

/**
 * Try to find and focus an existing browser tab on macOS.
 * Supports Google Chrome, Safari, and Microsoft Edge.
 * Falls back to opening a new browser tab if no existing tab is found.
 */
function focusBrowserTabMac(url: string): void {
  const urlSafe = url.replace(/"/g, '\\"')
  const script = `set targetURL to "${urlSafe}"
set found to false

try
  tell application "System Events"
    if exists (process "Google Chrome") then
      tell application "Google Chrome"
        repeat with w in windows
          set tabIdx to 0
          repeat with t in tabs of w
            set tabIdx to tabIdx + 1
            if URL of t contains targetURL then
              set active tab index of w to tabIdx
              set index of w to 1
              activate
              set found to true
              exit repeat
            end if
          end repeat
          if found then exit repeat
        end repeat
      end tell
    end if
  end tell
end try

if not found then
  try
    tell application "System Events"
      if exists (process "Safari") then
        tell application "Safari"
          repeat with w in windows
            repeat with t in tabs of w
              if URL of t contains targetURL then
                set current tab of w to t
                set index of w to 1
                activate
                set found to true
                exit repeat
              end if
            end repeat
            if found then exit repeat
          end repeat
        end tell
      end if
    end tell
  end try
end if

if not found then
  try
    tell application "System Events"
      if exists (process "Microsoft Edge") then
        tell application "Microsoft Edge"
          repeat with w in windows
            set tabIdx to 0
            repeat with t in tabs of w
              set tabIdx to tabIdx + 1
              if URL of t contains targetURL then
                set active tab index of w to tabIdx
                set index of w to 1
                activate
                set found to true
                exit repeat
              end if
            end repeat
            if found then exit repeat
          end repeat
        end tell
      end if
    end tell
  end try
end if

if not found then
  do shell script "open " & quoted form of "${urlSafe}"
end if
`
  const child = spawn('osascript', ['-'], {
    stdio: ['pipe', 'ignore', 'ignore'],
    detached: true
  })
  child.stdin.write(script)
  child.stdin.end()
  child.unref()
}

/**
 * Open the browser on first call, then try to focus the existing tab on subsequent calls.
 * On macOS, uses AppleScript to find and activate the browser tab.
 * On other platforms, falls back to opening the URL again.
 */
export function openOrFocusBrowser(url: string): void {
  if (!browserOpened) {
    openBrowser(url)
    browserOpened = true
    return
  }

  const os = platform()
  try {
    if (os === 'darwin') {
      focusBrowserTabMac(url)
    } else {
      // On Windows/Linux, open again (may or may not reuse tab)
      openBrowser(url)
    }
  } catch {
    openBrowser(url)
  }
}
