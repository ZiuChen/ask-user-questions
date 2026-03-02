# Architecture Guide

> This document is intended for first-time contributors to help them quickly understand the project architecture and core design decisions.

## Project Overview

`ask-user-questions` is a Human-in-the-loop tool based on MCP (Model Context Protocol). It allows AI models to ask users **batch questions** (1–4 sub-questions) during execution and wait for answers submitted through a Web UI before returning results to the model.

### Core Principles

- **Local-first**: All data is stored in memory, no cloud services required
- **Zero-config**: Users just install the npm package and configure their MCP client
- **Real-time**: Uses SSE (Server-Sent Events) for real-time browser-server synchronization
- **Internationalized**: Built-in support for 5 languages (en, zh-CN, ko, ja, ru), auto-detected from browser

## Overall Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    User's Machine (localhost)                   │
│                                                                │
│  ┌──────────┐   stdio    ┌──────────────────────────────────┐  │
│  │ AI Model │◄──────────►│         Server Process            │  │
│  │ (Claude, │            │                                  │  │
│  │  GPT...) │            │  ┌────────┐    ┌─────────────┐  │  │
│  └──────────┘            │  │  MCP   │    │  HTTP Server │  │  │
│                          │  │ Server │    │  (Hono+srvx) │  │  │
│                          │  │(stdio) │    │  :13390      │  │  │
│                          │  └───┬────┘    └──────┬───────┘  │  │
│                          │      │    ┌───────┐   │          │  │
│                          │      └───►│ Store │◄──┘          │  │
│                          │           │(memory)│              │  │
│                          │           └───┬───┘              │  │
│                          │               │                  │  │
│                          │         ┌─────▼─────┐            │  │
│                          │         │  Config   │            │  │
│                          │         │(~/.ask-*) │            │  │
│                          │         └───────────┘            │  │
│                          └──────────────────────────────────┘  │
│                                          │                     │
│                                   HTTP + SSE + REST            │
│                                          │                     │
│                          ┌───────────────▼──────────────────┐  │
│                          │        Browser (Web App)          │  │
│                          │   Vue 3 + ShadcnVue + i18n       │  │
│                          │   Dark Mode · Browser Notifs     │  │
│                          └──────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

## Monorepo Structure

The project uses pnpm workspaces and contains two packages:

### `packages/server` — MCP Shell

- **Role**: MCP server + local HTTP server
- **Published to npm**: Yes (users run via `npx ask-user-questions`)
- **Tech Stack**:
  - [hono](https://hono.dev/) — HTTP framework
  - [srvx](https://srvx.unjs.io/) — Universal HTTP server
  - [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) — MCP SDK
  - [zod v4](https://zod.dev/) — Schema validation
  - TypeScript 5.9

### `packages/app` — Web UI

- **Role**: User interaction interface
- **Published to npm**: No (build output is embedded in server package)
- **Tech Stack**:
  - [Vue 3](https://vuejs.org/) — UI framework
  - [radix-vue](https://www.radix-vue.com/) + [ShadcnVue](https://www.shadcn-vue.com/) — UI component library
  - [Tailwind CSS v4](https://tailwindcss.com/) (`@tailwindcss/vite`) — CSS framework
  - [Vite 7](https://vitejs.dev/) — Build tool

## Core Modules

### 1. Entry Point (`bin.ts`)

Starts both the MCP stdio server and the HTTP server (port 13390).

### 2. MCP Server (`mcp.ts`)

Registers the `ask_user` tool with a Copilot-style batch question schema:

```typescript
// MCP Tool Input Schema
{
  questions: [                    // 1–4 sub-questions
    {
      question: string,           // Question text
      multiSelect: boolean,       // Allow multiple selections (default: false)
      options?: [                 // Optional list of choices
        {
          label: string,          // Option label
          description?: string,   // Option description
          recommended?: boolean   // Whether recommended
        }
      ]
    }
  ]
}
// Note: "Other" free-text input is always available — no need for the AI to add it
```

```typescript
server.tool('ask_user', { questions }, async () => {
  // 1. Create question → store.createQuestion(questions)
  // 2. Send system notification
  // 3. Open/focus browser
  // 4. Block waiting for user answer (Promise)
  // 5. Return SubQuestionAnswer[] to model
})
```

**Response format**:

```typescript
// SubQuestionAnswer[]
[
  {
    selected: string[],    // Labels of selected options
    freeText?: string      // Free-text input from "Other" field
  }
]
```

**Key Design**: The tool call blocks (`await store.waitForAnswer(id)`) until the user submits an answer in the Web UI. This ensures the model doesn't continue until it has the answer.

### 3. HTTP Server (`server.ts`)

Provides the following API:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/questions` | List all questions |
| GET | `/api/questions/pending` | List pending questions |
| GET | `/api/questions/:id` | Get a single question |
| POST | `/api/questions/:id/answer` | Submit answers (`{ answers: SubQuestionAnswer[] }`) |
| GET | `/api/config` | Get config |
| PUT | `/api/config` | Update config |
| GET | `/api/events` | SSE event stream |
| GET | `/api/health` | Health check |
| GET | `/*` | Static files (Web App) |

### 4. Store (`store.ts`)

In-memory state management with these core mechanisms:

- **Question storage**: `Map<string, Question>`
- **Wait mechanism**: `Map<string, (answers: SubQuestionAnswer[]) => void>` — Stores the Promise resolve function when MCP tool awaits an answer
- **Event subscriptions**: `Set<Listener>` — SSE connections subscribe to this event stream

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
[MCP call]                              [User answers]
    │                                        │
    ▼                                        ▼
createQuestion(subQuestions)       answerQuestion(id, answers)
    │                                        │
    ├─► Store in questions Map               ├─► Update question status
    ├─► emit('question:created')             ├─► Call waiter resolve(answers)
    └─► waitForAnswer(id)                    └─► emit('question:answered')
         │                                            │
         ▼                                            ▼
    Returns Promise<SubQuestionAnswer[]>         SSE push to browser
         ◄──────── resolve(answers) ──────────
```

### 5. Config (`config.ts`)

Configuration file management. Config file path: `~/.ask-user-questions/config.json`.

```typescript
interface Config {
  timeout: number            // Timeout in ms, 0 = no timeout (default)
  notification: boolean      // Show system notifications (default: true)
  autoOpenBrowser: boolean   // Auto-open browser (default: true)
}
```

Config can be modified via:
- **REST API**: `GET/PUT /api/config`
- **Web UI**: Settings panel (SettingsPanel)

### 6. Notify (`notify.ts`)

System notifications and browser management:

- **System notifications**: Sends desktop notifications when new questions are created
- **Browser singleton**: On macOS, uses AppleScript to find and focus an existing browser tab (Chrome/Safari/Edge); falls back to opening a new tab if none is found

### 7. Web App

**New features**:

- **i18n**: Supports 5 languages (en, zh-CN, ko, ja, ru), auto-detected from browser, language preference persisted in localStorage
- **Dark mode**: System/light/dark modes, persisted in localStorage, with FOUC prevention
- **REST fallback**: Frontend fetches questions via REST API on mount before SSE connects
- **Browser notifications**: Notification API + title flash when tab is unfocused

**Data flow**:

1. On page load, fetch initial data via REST (`/api/questions`)
2. Connect to SSE (`/api/events`) and listen for real-time events
3. SSE pushes new question events → page updates in real-time
4. User answers sub-questions and submits → POST to API (`{ answers: SubQuestionAnswer[] }`)
5. SSE pushes answer-completed event → page updates status

**Component tree**:

```
App.vue (header: logo, tabs, language-select, theme-toggle, connection-dot)
 ├── QuestionList.vue
 │    └── QuestionCard.vue (× N) — batch sub-questions with options/multiSelect/"Other"
 └── SettingsPanel.vue — timeout, notification, autoOpenBrowser, language, theme
```

## Project Structure

```
packages/
├── server/
│   └── src/
│       ├── bin.ts       # Entry: start server + MCP
│       ├── server.ts    # Hono + srvx HTTP server
│       ├── mcp.ts       # MCP stdio + tool definition
│       ├── store.ts     # In-memory state + event pub/sub
│       ├── config.ts    # Config file management
│       ├── notify.ts    # System notification + browser management
│       ├── types.ts     # Type definitions
│       └── index.ts     # Public API exports
└── app/
    └── src/
        ├── App.vue
        ├── components/
        │   ├── QuestionCard.vue   # Question card (batch sub-questions)
        │   ├── QuestionList.vue   # Question list
        │   ├── SettingsPanel.vue  # Settings panel
        │   └── ui/                # ShadcnVue components
        ├── composables/
        │   ├── useQuestions.ts    # Question state + SSE
        │   └── useDarkMode.ts    # Dark mode management
        └── lib/
            ├── api.ts             # API client + types
            ├── i18n.ts            # i18n (5 languages)
            └── utils.ts           # Utility functions
```

## Build & Distribution

### Build Pipeline

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

When published, the `ask-user-questions` npm package contains:

```
dist/
├── bin.mjs          # Server entry (with shebang)
├── index.mjs        # Public API
├── index.d.mts      # Type declarations
└── public/          # Embedded Web App static files
    ├── index.html
    ├── assets/
    └── ...
```

## CI/CD

### GitHub Actions

- **CI** (`ci.yml`): Runs type checking and build on every push/PR
- **Publish** (`publish.yml`): Automatically publishes to npm when a `v*` tag is pushed
  - Uses OIDC (OpenID Connect) for npm provenance
  - Ensures package origin is verifiable

### Release Process

```bash
cd packages/server
npm version patch    # Update version
git add -A && git commit -m "release: v0.1.1"
git tag v0.1.1
git push --follow-tags
# → GitHub Actions automatically builds and publishes
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

The App's Vite dev server proxies `/api/*` requests to `localhost:13390`, ensuring seamless frontend-backend integration during development.

### Adding ShadcnVue Components

```bash
cd packages/app
npx shadcn-vue@latest add [component-name]
```

## FAQ

**Q: Why not WebSocket?**
A: SSE is sufficient for this use case (server-side push + client HTTP POST) and simpler to implement.

**Q: Why store state in memory instead of files?**
A: Questions and answers are ephemeral session data that don't need persistence after the process ends. In-memory storage avoids the complexity of file I/O and serialization.

**Q: What if the port is already in use?**
A: Use the `--port` flag: `npx ask-user-questions --port 8080`.

**Q: Where is the config file?**
A: `~/.ask-user-questions/config.json`. It can also be edited from the Web UI settings panel.

**Q: How do I change the language?**
A: The Web UI header has a language selector supporting en, zh-CN, ko, ja, and ru. The selection is persisted in localStorage.
