# Architecture Guide

> This document is intended for first-time contributors to help them quickly understand the project architecture and core design decisions.

## Project Overview

`ask-user-questions` is a Human-in-the-loop tool based on MCP (Model Context Protocol). It allows AI models to ask users questions during execution and wait for answers submitted through a Web UI before returning results to the model.

### Core Principles

- **Local-first**: All data is stored in memory, no cloud services required
- **Zero-config**: Users just install the npm package and configure their MCP client
- **Real-time**: Uses SSE (Server-Sent Events) for real-time browser-server synchronization

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
│                          │           └───────┘              │  │
│                          └──────────────────────────────────┘  │
│                                          │                     │
│                                     HTTP + SSE                 │
│                                          │                     │
│                          ┌───────────────▼──────────────────┐  │
│                          │        Browser (Web App)          │  │
│                          │      Vue 3 + ShadcnVue           │  │
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
  - [zod](https://zod.dev/) — Schema validation

### `packages/app` — Web UI

- **Role**: User interaction interface
- **Published to npm**: No (build output is embedded in server package)
- **Tech Stack**:
  - [Vue 3](https://vuejs.org/) — UI framework
  - [ShadcnVue](https://www.shadcn-vue.com/) — UI component library
  - [Tailwind CSS](https://tailwindcss.com/) — CSS framework
  - [Vite](https://vitejs.dev/) — Build tool

## Core Modules

### 1. Entry Point (`bin.ts`)

Starts both the MCP stdio server and the HTTP server (port 13390).

### 2. MCP Server (`mcp.ts`)

Registers the `ask_user` tool:

```typescript
server.tool('ask_user', { question, options }, async () => {
  // 1. Create question → store
  // 2. Send system notification
  // 3. Open browser
  // 4. Block waiting for user answer (Promise)
  // 5. Return answer to model
})
```

**Key Design**: The tool call blocks (`await store.waitForAnswer(id)`) until the user submits an answer in the Web UI. This ensures the model doesn't continue until it has the answer.

### 3. HTTP Server (`server.ts`)

Provides the following API:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/questions` | List all questions |
| GET | `/api/questions/pending` | List pending questions |
| GET | `/api/questions/:id` | Get a single question |
| POST | `/api/questions/:id/answer` | Submit an answer |
| GET | `/api/events` | SSE event stream |
| GET | `/api/health` | Health check |
| GET | `/*` | Static files (Web App) |

### 4. Store (`store.ts`)

In-memory state management with these core mechanisms:

- **Question storage**: `Map<string, Question>`
- **Wait mechanism**: `Map<string, (answer: string) => void>` — Stores the Promise resolve function when MCP tool awaits an answer
- **Event subscriptions**: `Set<Listener>` — SSE connections subscribe to this event stream

```
[MCP call]                    [User answers]
    │                             │
    ▼                             ▼
createQuestion()          answerQuestion()
    │                             │
    ├─► Store in questions Map    ├─► Update question status
    ├─► emit('question:created')  ├─► Call waiter resolve
    └─► waitForAnswer()           └─► emit('question:answered')
         │                                    │
         ▼                                    ▼
    Returns Promise ◄──── resolve ────── SSE push to browser
```

### 5. Web App

**Data flow**:

1. On page load, connect to SSE (`/api/events`) and receive initial data
2. SSE pushes new question events → page updates in real-time
3. User types answer and submits → POST to API
4. SSE pushes answer-completed event → page updates status

**Component tree**:

```
App.vue
 └── QuestionList.vue
      └── QuestionCard.vue (× N)
           ├── Badge (status tag)
           ├── Button (option buttons / submit button)
           └── Textarea (free-form input)
```

## Build & Distribution

### Build Pipeline

```
pnpm build
    │
    ├─ 1. Build App (Vite)
    │       └─ Output to packages/app/dist/
    │
    └─ 2. Build Server (tsdown)
            ├─ Compile TypeScript
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
