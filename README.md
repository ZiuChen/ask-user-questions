# ask-user-questions

An MCP (Model Context Protocol) tool that allows AI models to ask users questions via a local web interface, enabling human-in-the-loop interactions.

[中文文档](README.zh-CN.md)

## Features

- **Daemon architecture**: Independent background process for HTTP/WS, supports multiple MCP clients simultaneously
- **Batch questions**: Up to 4 sub-questions per call, with single/multi-select and free text
- **Rich options**: Options support label, description, and recommended flags
- **Free text**: Every sub-question always includes an "Other" free text input
- **Routed navigation**: Home page with pending questions + history; detail page for each question
- **Internationalization**: 5 languages (English, 中文, 한국어, 日本語, Русский)
- **Dark mode**: System / Light / Dark themes
- **Responsive**: Desktop and mobile friendly
- **Configurable**: Timeout, notification toggle, auto-open browser toggle

## Quick Start

### 1. Configure MCP Client

`ask-user-questions` provides an MCP STDIO server as a tool interface, which can connect to any MCP client you prefer, such as Claude Desktop or VS Code.

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "ask-user-questions": {
      "command": "npx",
      "args": ["ask-user-questions"]
    }
  }
}
```

### 2. Get Started

1. When the model invokes the `ask_user` tool during a conversation, the browser interface will **automatically open to display the question**.
2. Use the browser interface to view pending questions, history, and details for each question, then submit your answers.
3. The model receives your responses in real time, enabling seamless human-in-the-loop interaction.

## MCP Tool

### `ask_user`

Ask the user questions and wait for their response. Supports batch questions (1–4 sub-questions), each with configurable options and multi-select mode. An "Other" free text input is always available—no need to add it manually.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `questions` | `SubQuestion[]` | ✅ | Array of 1–4 sub-questions |

**SubQuestion**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `question` | `string` | ✅ | Question text |
| `multiSelect` | `boolean` | ❌ | Allow multiple selections (default `false`) |
| `options` | `Option[]` | ❌ | Preset options (omit for free text only) |

**Option**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | `string` | ✅ | Option label |
| `description` | `string` | ❌ | Option description |
| `recommended` | `boolean` | ❌ | Mark as recommended |

**Example**:

```json
{
  "name": "ask_user",
  "arguments": {
    "questions": [
      {
        "question": "Which API style do you prefer?",
        "options": [
          { "label": "Composition API", "recommended": true },
          { "label": "Options API" }
        ]
      },
      {
        "question": "Which features do you need?",
        "multiSelect": true,
        "options": [
          { "label": "TypeScript", "description": "Add type support" },
          { "label": "i18n", "description": "Internationalization" },
          { "label": "Dark Mode" }
        ]
      }
    ]
  }
}
```

## Configuration

Config file: `~/.ask-user-questions/config.json` (also editable via the Web UI settings panel).

```json
{
  "timeout": 0,
  "notification": true,
  "autoOpenBrowser": true
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timeout` | `number` | `0` | Timeout for waiting (ms), 0 = no timeout |
| `notification` | `boolean` | `true` | Show desktop notifications |
| `autoOpenBrowser` | `boolean` | `true` | Auto-open browser |

## How It Works

```
┌──────────┐  stdio  ┌──────────┐  HTTP   ┌────────────────┐  WebSocket  ┌──────────┐
│ AI Model │◄───────►│ MCP STDIO│────────►│ Daemon Server  │◄───────────►│ Web App  │
│ (Claude, │         │ (bin.mjs)│ proxy   │ (daemon.mjs)   │             │ (Browser)│
│  GPT...) │         └──────────┘         │ localhost:13390│             └──────────┘
└──────────┘                              └────────────────┘
                                          ▲ HTTP proxy  ▲
┌──────────┐  stdio  ┌──────────┐         │             │
│ AI Model │◄───────►│ MCP STDIO│─────────┘             │
│ (another) │         │ (bin.mjs)│                       │
└──────────┘         └──────────┘               ┌───────┴──────┐
                                                │    Store     │
                                                │  (in-memory) │
                                                └──────────────┘
```

1. **First MCP launch**: `bin.mjs` auto-spawns a background daemon `daemon.mjs` (HTTP + WebSocket server on port 13390)
2. **Subsequent MCP launches**: Detects the daemon is already running and reuses it
3. All MCP instances proxy to the daemon's Store via HTTP API (create questions + long-poll for answers)
4. The daemon pushes real-time events to the browser via WebSocket
5. The daemon detects browser presence via WebSocket connection count—only opens the browser when no clients are connected

## Development

### Prerequisites

- Node.js >= 20
- pnpm >= 9

### Local Development

```bash
# Install dependencies
pnpm install

# Start App dev server (with HMR)
pnpm dev

# Start Server dev server (HTTP only)
pnpm dev:server

# Build all packages
pnpm build

# Type checking
pnpm typecheck
```

### Project Structure

```
ask-user-questions/
├── packages/
│   ├── server/       # Daemon + MCP Shell + HTTP Server
│   │   └── src/
│   │       ├── bin.ts       # MCP entry: ensure daemon + start MCP STDIO
│   │       ├── daemon.ts    # Daemon entry: background HTTP+WS server
│   │       ├── server.ts    # Hono + @hono/node-ws HTTP/WS server
│   │       ├── mcp.ts       # MCP stdio + tool definitions (HTTP API proxy)
│   │       ├── store.ts     # In-memory state + event pub/sub
│   │       ├── config.ts    # Config file management
│   │       ├── notify.ts    # Desktop notifications + browser management
│   │       ├── types.ts     # Type definitions
│   │       └── index.ts     # Public API exports
│   └── app/          # Vue 3 Web UI
│       └── src/
│           ├── App.vue              # Shell layout (header + router-view)
│           ├── router.ts            # Vue Router config
│           ├── pages/               # Page components
│           │   ├── home.vue         # Home: pending list + history
│           │   └── question-detail.vue # Question detail page
│           ├── components/          # UI components
│           │   ├── question-card.vue  # Question card (batch sub-questions)
│           │   └── settings-panel.vue # Settings panel
│           ├── composables/         # Vue composables
│           │   ├── use-questions.ts  # Question state + WebSocket
│           │   └── use-dark-mode.ts  # Dark mode
│           └── lib/
│               ├── api.ts           # API client + WebSocket
│               └── i18n.ts          # i18n (5 languages)
├── docs/             # Architecture docs
├── .github/workflows # CI/CD
└── pnpm-workspace.yaml
```

See [Architecture (English)](docs/architecture-en.md) | [架构文档 (中文)](docs/architecture-zh.md) for details.

## Publishing

This project uses GitHub Actions + npm provenance (OIDC):

```bash
# 1. Bump version
cd packages/server
npm version patch  # or minor / major

# 2. Push tag
git push --follow-tags

# 3. GitHub Actions auto-builds and publishes to npm
```

## License

MIT
