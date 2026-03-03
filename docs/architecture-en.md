# Architecture

> This document is for developers new to the project, to help quickly understand the project architecture and core design.

## Project Overview

`ask-user-questions` is a Human-in-the-loop tool based on MCP (Model Context Protocol). It allows AI models to ask users **batch questions** (1–4 sub-questions) during execution, wait for the user to answer in a Web UI, and then return the results to the model.

### Core Principles

- **Local-first**: All data stored in memory, no cloud dependencies
- **Zero-config**: Users only need to install the npm package and configure their MCP client
- **Daemon architecture**: Independent background HTTP+WebSocket server, supporting multiple MCP clients simultaneously
- **Real-time communication**: WebSocket for bidirectional real-time data sync between browser and server
- **Internationalization**: Built-in 5 languages (en, zh-CN, ko, ja, ru), auto-detects browser language

## Overall Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        User's Machine (localhost)                   │
│                                                                    │
│  ┌──────────┐  stdio  ┌──────────┐   HTTP proxy                   │
│  │ AI Model │◄───────►│ bin.mjs  │──────────────┐                 │
│  │ (Claude) │         │ (MCP)    │              │                 │
│  └──────────┘         └──────────┘              │                 │
│                                                  ▼                 │
│  ┌──────────┐  stdio  ┌──────────┐     ┌────────────────────┐     │
│  │ AI Model │◄───────►│ bin.mjs  │────►│  Daemon Server     │     │
│  │ (GPT...) │         │ (MCP)    │     │  (daemon.mjs)      │     │
│  └──────────┘         └──────────┘     │  localhost:13390    │     │
│                                         │                    │     │
│                  spawn if not running   │  ┌──────────────┐  │     │
│                  ──────────────────────►│  │    Store     │  │     │
│                                         │  │  (in-memory) │  │     │
│                                         │  └──────┬───────┘  │     │
│                                         │         │          │     │
│                                         │  ┌──────▼───────┐  │     │
│                                         │  │   Config     │  │     │
│                                         │  │ (~/.ask-*)   │  │     │
│                                         │  └──────────────┘  │     │
│                                         └────────────────────┘     │
│                                                  │                 │
│                                           WebSocket + HTTP         │
│                                                  │                 │
│                          ┌───────────────────────▼──────────────┐  │
│                          │         Browser (Web App)             │  │
│                          │  Vue 3 + vue-router + ShadcnVue      │  │
│                          │  WebSocket · i18n · Dark Mode         │  │
│                          └──────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### Key Design: Daemon Architecture

**Problem**: When multiple MCP clients (e.g., Claude Desktop + VS Code Copilot) are used simultaneously, each starts an independent MCP process. If the HTTP server is embedded in the MCP process, only the first process to grab the port can serve the Web UI — questions from other processes won't appear in the frontend.

**Solution**: Extract the HTTP+WebSocket server into an independent daemon process (`daemon.mjs`). All MCP instances proxy to the daemon via HTTP API:

1. `bin.mjs` (MCP entry) checks `http://localhost:13390/api/health` on startup
2. If the daemon is not running, spawns a detached `daemon.mjs` child process
3. Polls until the daemon is ready (up to 5 seconds)
4. MCP tool calls are routed to the daemon's Store via HTTP API
5. The daemon writes a PID file (`~/.ask-user-questions/server.pid`) and cleans up on exit

## Monorepo Structure

The project uses pnpm workspace with two packages:

### `packages/server` — Daemon + MCP Shell

- **Role**: MCP server + background HTTP/WebSocket daemon
- **Published to npm**: Yes (users run `npx ask-user-questions`)
- **Tech stack**:
  - [hono](https://hono.dev/) — HTTP framework
  - [@hono/node-ws](https://github.com/honojs/middleware/tree/main/packages/node-ws) — WebSocket support
  - [ws](https://github.com/websockets/ws) — WebSocket library
  - [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) — MCP SDK
  - [zod v4](https://zod.dev/) — Parameter validation
  - [node-notifier](https://github.com/mikaelbr/node-notifier) — Cross-platform desktop notifications
  - TypeScript 5.9

### `packages/app` — Web UI

- **Role**: User interaction interface
- **Published to npm**: No (build output embedded in Server package)
- **Tech stack**:
  - [Vue 3](https://vuejs.org/) — UI framework
  - [vue-router](https://router.vuejs.org/) — Routing
  - [ShadcnVue](https://www.shadcn-vue.com/) — UI component library
  - [Tailwind CSS v4](https://tailwindcss.com/) (`@tailwindcss/vite`) — CSS framework
  - [Vite 7](https://vitejs.dev/) — Build tool

## Core Modules

### 1. Daemon Entry (`daemon.ts`)

Standalone background daemon entry point. Takes a port argument, starts the HTTP+WebSocket server, and writes a PID file:

```
node daemon.mjs <port>
```

- Calls `loadConfig()` to load configuration
- Calls `startServer(port)` to start HTTP+WS server
- Writes PID file to `~/.ask-user-questions/server.pid`
- Listens for SIGINT/SIGTERM to clean up PID file and exit

### 2. MCP Entry (`bin.ts`)

MCP STDIO service entry point, invoked by MCP clients (e.g., Claude Desktop, VS Code):

1. `isServerAlive(url)` — Check daemon health status
2. `spawnDaemon(port)` — If no daemon running, spawn detached `daemon.mjs`
3. `ensureServer(port)` — Poll until daemon is ready (up to 50 × 100ms)
4. `startMcp(url)` — Start MCP STDIO service (proxy mode)

### 3. MCP Server (`mcp.ts`)

Registers the `ask_user` tool with a Copilot-style batch question schema:

```typescript
// MCP Tool Input Schema
{
  questions: [                    // 1–4 sub-questions
    {
      question: string,           // Question text
      multiSelect: boolean,       // Allow multiple selections (default: false)
      options?: [                 // Optional preset options
        {
          label: string,          // Option label
          description?: string,   // Option description
          recommended?: boolean   // Mark as recommended
        }
      ]
    }
  ]
}
// Note: "Other" free text input is always available — AI should not add it manually
```

```typescript
server.tool('ask_user', { questions }, async () => {
  // 1. HTTP POST to create question → daemon's store.createQuestion(questions)
  // 2. Send system notification
  // 3. Check WebSocket connections (hasBrowserClients), open browser if none
  // 4. HTTP GET long-poll waiting for user answer
  // 5. Return SubQuestionAnswer[] to the model
})
```

**Response format**:

```typescript
// SubQuestionAnswer[]
[
  {
    selected: string[],    // Selected option labels
    freeText?: string      // User's free text input ("Other")
  }
]
```

**Key design**: MCP tools always proxy to the daemon via HTTP API. Question creation uses `POST /api/questions`, waiting for answers uses `GET /api/questions/:id/wait` (long-polling). `GET /api/health` returns `browserClients` count to determine whether a browser needs to be opened.

### 4. HTTP Server (`server.ts`)

Provides the following API:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/questions` | List all questions |
| GET | `/api/questions/:id` | Get a single question |
| POST | `/api/questions` | Create a question (MCP proxy) |
| POST | `/api/questions/:id/answer` | Submit answer (`{ answers: SubQuestionAnswer[] }`) |
| GET | `/api/questions/:id/wait` | Long-poll for answer (MCP proxy) |
| GET | `/api/config` | Get configuration |
| PUT | `/api/config` | Update configuration |
| GET | `/api/ws` | WebSocket connection (real-time events) |
| GET | `/api/health` | Health check (includes `browserClients` count) |
| GET | `/*` | Static files (Web App SPA + fallback routing) |

**WebSocket Events**:

| Event | Direction | Description |
|-------|-----------|-------------|
| `init` | Server → Client | Sends all questions + config on connection |
| `question:created` | Server → Client | New question created |
| `question:answered` | Server → Client | Question answered |
| `question:remind` | Server → Client | Question reminder |
| `config:updated` | Server → Client | Config updated |

**Browser client tracking**: The server maintains a `browserClientCount` counter, auto-incrementing/decrementing on WebSocket connect/disconnect. The Health API returns this count, and MCP uses it to decide whether to open a browser.

### 5. Store (`store.ts`)

In-memory state management with core mechanisms:

- **Question storage**: `Map<string, Question>`
- **Wait mechanism**: `Map<string, (answers: SubQuestionAnswer[]) => void>` — When the MCP tool waits for an answer, the Promise's resolve function is stored here
- **Event subscription**: `Set<Listener>` — WebSocket connections subscribe to this event stream

**Core types**:

```typescript
interface SubQuestion {
  question: string
  multiSelect: boolean
  options?: { label: string; description?: string; recommended?: boolean }[]
}

interface SubQuestionAnswer {
  selected: string[]
  freeText?: string
}

interface Question {
  id: string
  questions: SubQuestion[]       // Batch sub-questions
  status: 'pending' | 'answered'
  answers?: SubQuestionAnswer[]  // Answer array
  createdAt: string
  answeredAt?: string
}
```

**Core methods**:

- `createQuestion(subQuestions: SubQuestion[]): Question`
- `answerQuestion(id, answers: SubQuestionAnswer[]): Question | null`
- `waitForAnswer(id): Promise<SubQuestionAnswer[]>`

```
[MCP Call]                             [User Answer]
    │                                       │
    ▼                                       ▼
createQuestion(subQuestions)       answerQuestion(id, answers)
    │                                       │
    ├─► Store in questions Map              ├─► Update question status
    ├─► emit('question:created')            ├─► Call waiter resolve(answers)
    └─► waitForAnswer(id)                   └─► emit('question:answered')
         │                                           │
         ▼                                           ▼
    Return Promise<SubQuestionAnswer[]>     WebSocket push to browser
         ◄──────────── resolve(answers) ─────────────
```

### 6. Config (`config.ts`)

Configuration file management. Config file path: `~/.ask-user-questions/config.json`.

```typescript
interface Config {
  timeout: number            // Timeout in ms, 0 = no timeout (default)
  notification: boolean      // Show system notifications (default: true)
  autoOpenBrowser: boolean   // Auto-open browser (default: true)
}
```

Configuration can be modified via:
- **REST API**: `GET/PUT /api/config`
- **Web UI**: Settings panel

### 7. Notify (`notify.ts`)

Desktop notifications and browser management:

- **Desktop notifications**: Uses [node-notifier](https://github.com/mikaelbr/node-notifier) for cross-platform desktop notifications (macOS terminal-notifier / Windows Snoretoast / Linux notify-send). Clicking the notification triggers a callback to open/focus the browser
- **Chromium tab reuse**: On macOS, detects running Chromium browsers via `ps cax`, then uses JXA (JavaScript for Automation) to find and focus existing tabs or open a new one (adapted from [Vite's implementation](https://github.com/vitejs/vite/blob/main/packages/vite/src/node/server/openBrowser.ts))
- **Supported Chromium browsers**: Google Chrome (and Canary/Dev/Beta), Microsoft Edge, Brave, Vivaldi, Chromium
- **Cross-platform fallback**: On non-macOS or when no Chromium is running, uses system default commands (`open` / `start` / `xdg-open`)

### 8. Web App

**Features**:

- **vue-router routing**: Home page `/` shows pending questions list + answered history, detail page `/question/:id` shows full sub-questions
- **i18n internationalization**: 5 languages (en, zh-CN, ko, ja, ru), auto-detects browser language, persists to localStorage
- **Dark mode**: System/light/dark modes, persisted to localStorage, includes FOUC prevention
- **WebSocket real-time communication**: Receives full state on connection (`init` event), then incremental updates
- **Browser notifications**: Uses Notification API, title blinks when tab is unfocused

**Data flow**:

1. On page load, connect WebSocket (`/api/ws`)
2. Server sends `init` event with all questions and config
3. WebSocket pushes new question events → page updates in real-time
4. User clicks a pending question → navigates to detail page → answers and submits → POST to API
5. WebSocket pushes answer complete event → page updates status

**Component structure**:

```
App.vue (Shell: logo, settings panel, language selector, theme toggle, connection indicator)
 ├── <router-view>
 │    ├── home.vue — Pending list + answered history
 │    └── question-detail.vue — Single question detail
 │         └── QuestionCard.vue — Batch sub-questions with options/multi-select/"Other" input
 └── SettingsPanel.vue — Timeout, notifications, auto-open browser, language, theme
```

## Project Structure

```
packages/
├── server/
│   └── src/
│       ├── bin.ts       # MCP entry: ensure daemon running + MCP STDIO
│       ├── daemon.ts    # Daemon entry: background HTTP+WS server
│       ├── server.ts    # Hono + @hono/node-ws HTTP/WS server
│       ├── mcp.ts       # MCP stdio + tool definitions (HTTP API proxy)
│       ├── store.ts     # In-memory state + event pub/sub
│       ├── config.ts    # Config file management
│       ├── notify.ts    # Desktop notifications (node-notifier) + browser management
│       ├── types.ts     # Type definitions
│       └── index.ts     # Public API exports
└── app/
    └── src/
        ├── App.vue                    # Shell layout
        ├── router.ts                  # Vue Router config
        ├── pages/
        │   ├── home.vue               # Home page
        │   └── question-detail.vue    # Question detail page
        ├── components/
        │   ├── question-card.vue      # Question card (batch sub-questions)
        │   ├── settings-panel.vue     # Settings panel
        │   └── ui/                    # ShadcnVue components
        ├── composables/
        │   ├── use-questions.ts       # Question state + WebSocket
        │   └── use-dark-mode.ts       # Dark mode management
        └── lib/
            ├── api.ts                 # API client + WebSocket
            ├── i18n.ts                # i18n (5 languages)
            └── shadcn.ts              # ShadcnVue utilities
```

## Build & Distribution

### Build Flow

```
pnpm build
    │
    ├─ 1. Build App (Vite 7)
    │       └─ Output to packages/app/dist/
    │
    └─ 2. Build Server (tsdown)
            ├─ Compile TypeScript → .mjs + .d.mts
            ├─ Copy App dist → Server dist/public/
            └─ Output to packages/server/dist/
```

### npm Package Contents

```
dist/
├── bin.mjs          # MCP Server entry (with shebang)
├── daemon.mjs       # Daemon entry (background HTTP+WS server)
├── index.mjs        # Public API
├── index.d.mts      # Type declarations
└── public/          # Embedded Web App static files
    ├── index.html
    ├── assets/
    └── ...
```

## CI/CD

### GitHub Actions

- **CI** (`ci.yml`): Runs type checking and builds on every push/PR
- **Publish** (`publish.yml`): Auto-publishes to npm when a `v*` tag is pushed
  - Uses OIDC (OpenID Connect) for npm provenance
  - Ensures package origin is trustworthy

### Release Steps

```bash
cd packages/server
npm version patch    # Update version
git add -A && git commit -m "release: v0.1.1"
git tag v0.1.1
git push --follow-tags
# → GitHub Actions auto-builds and publishes
```

## Development Guide

### Prerequisites

```bash
node -v  # >= 20
pnpm -v  # >= 9

pnpm install
```

### Daily Development

```bash
# Terminal 1: Start Server HTTP service (for API debugging)
pnpm dev:server

# Terminal 2: Start App dev server (with HMR & API proxy)
pnpm dev
```

The App's Vite dev server proxies `/api/*` requests (including WebSocket `/api/ws`) to `localhost:13390`, ensuring seamless frontend-backend integration during development.

### Adding ShadcnVue Components

```bash
cd packages/app
npx shadcn-vue@latest add [component-name]
```

## FAQ

**Q: Why use a daemon architecture?**
A: Multiple MCP clients create multiple MCP processes. The daemon architecture extracts the HTTP+WebSocket server into an independent process, with all MCP instances proxying to a unified Store via HTTP API, ensuring all questions appear in the same Web UI.

**Q: Why WebSocket instead of SSE?**
A: WebSocket supports bidirectional communication, allowing the server to track connected browser client count (`browserClientCount`), enabling smart browser management — only auto-opening the browser when no clients are connected.

**Q: Why store state in memory instead of files?**
A: Questions and answers are temporary session data that don't need persistence after process exit. In-memory storage avoids the complexity of file I/O and serialization.

**Q: What if the port is in use?**
A: If port 13390 is already occupied by a non-ask-user-questions process, the daemon won't start. Kill the process using the port and retry.

**Q: Where are daemon logs?**
A: The daemon runs in detached mode with stdio ignored. The PID file is at `~/.ask-user-questions/server.pid`.

**Q: Where is the config file?**
A: `~/.ask-user-questions/config.json`, also configurable via the Web UI settings panel.

**Q: How to switch languages?**
A: The Web UI header has a language selector supporting en, zh-CN, ko, ja, ru. Selection is persisted to localStorage.
