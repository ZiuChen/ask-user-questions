# ask-user-questions

一个 MCP (Model Context Protocol) 工具，允许 AI 模型通过本地 Web 界面向用户发起提问，实现 Human-in-the-loop 的交互模式。

[English](README.md)

## 特性

- **守护进程架构**：独立后台进程管理 HTTP/WS 服务，支持多个 MCP Client 同时连接
- **批量提问**：一次最多发送 4 个子问题，支持单选/多选/自由文本
- **丰富选项**：选项支持 label、description、recommended 标记
- **自由文本**：每个子问题始终附带 "Other" 自由文本输入
- **路由导航**：首页显示待回答问题列表 + 历史记录，详情页展示完整子问题
- **国际化**：支持 5 种语言（English、中文、한국어、日本語、Русский）
- **深色模式**：跟随系统 / 浅色 / 深色三种主题
- **响应式**：适配桌面和移动端
- **可配置**：超时、通知开关、浏览器自动打开开关

## 快速开始

### 1. 配置 MCP 客户端

`ask-user-questions` 提供一个 MCP STDIO 服务器作为工具接口，可以连接到任何你喜欢的 MCP Client 上，如 Claude Desktop、VS Code 等。

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

### 2. 开始使用

1. 模型在对话中调用 `ask_user` 工具向用户发起提问时，会**自动打开浏览器界面展示问题**。
2. 你可以通过浏览器界面查看待回答问题、历史记录以及每个问题的详情，并提交你的回答。
3. 模型实时接收你的回答结果，实现人机交互闭环。

## MCP 工具

### `ask_user`

向用户发起提问并等待回答。支持批量提问（1-4 个子问题），每个子问题可配置选项和多选模式。"Other" 自由文本输入始终可用，无需手动添加。

**参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `questions` | `SubQuestion[]` | ✅ | 1-4 个子问题的数组 |

**SubQuestion 结构**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `question` | `string` | ✅ | 问题文本 |
| `multiSelect` | `boolean` | ❌ | 是否允许多选（默认 `false`） |
| `options` | `Option[]` | ❌ | 预设选项（省略则仅显示自由文本输入） |

**Option 结构**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `label` | `string` | ✅ | 选项标签 |
| `description` | `string` | ❌ | 选项描述 |
| `recommended` | `boolean` | ❌ | 标记为推荐选项 |

**示例调用**:

```json
{
  "name": "ask_user",
  "arguments": {
    "questions": [
      {
        "question": "你希望使用哪种 API 风格？",
        "options": [
          { "label": "Composition API", "recommended": true },
          { "label": "Options API" }
        ]
      },
      {
        "question": "需要支持哪些功能？",
        "multiSelect": true,
        "options": [
          { "label": "TypeScript", "description": "添加类型支持" },
          { "label": "i18n", "description": "国际化支持" },
          { "label": "Dark Mode" }
        ]
      }
    ]
  }
}
```

## 配置

配置文件位于 `~/.ask-user-questions/config.json`，也可通过 Web 界面的设置页修改。

```json
{
  "timeout": 0,
  "notification": true,
  "autoOpenBrowser": true
}
```

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `timeout` | `number` | `0` | 等待回答的超时时间（毫秒），0 = 无超时 |
| `notification` | `boolean` | `true` | 是否显示桌面通知 |
| `autoOpenBrowser` | `boolean` | `true` | 是否自动打开浏览器 |

## 工作原理

```
┌──────────┐  stdio  ┌──────────┐  HTTP   ┌────────────────┐  WebSocket  ┌──────────┐
│ AI Model │◄───────►│ MCP STDIO│────────►│ Daemon Server  │◄───────────►│ Web App  │
│ (Claude, │         │ (bin.mjs)│ proxy   │ (daemon.mjs)   │             │ (Browser)│
│  GPT...) │         └──────────┘         │ localhost:13390│             └──────────┘
└──────────┘                              └────────────────┘
                                          ▲ HTTP proxy  ▲
┌──────────┐  stdio  ┌──────────┐         │             │
│ AI Model │◄───────►│ MCP STDIO│─────────┘             │
│ (另一个)  │         │ (bin.mjs)│                       │
└──────────┘         └──────────┘               ┌───────┴──────┐
                                                │    Store     │
                                                │   (内存)      │
                                                └──────────────┘
```

1. **首个 MCP 启动**时，`bin.mjs` 自动 spawn 后台守护进程 `daemon.mjs`（HTTP + WebSocket 服务，端口 13390）
2. **后续 MCP 启动**时，检测到守护进程已在运行，直接复用
3. 所有 MCP 实例通过 HTTP API 代理到守护进程的 Store（创建问题 + 长轮询等待回答）
4. 守护进程通过 WebSocket 将实时事件推送到浏览器
5. 守护进程通过 WebSocket 连接数检测浏览器是否已打开，未打开时自动打开

## 开发

### 前置要求

- Node.js >= 20
- pnpm >= 9

### 本地开发

```bash
# 安装依赖
pnpm install

# 启动 App 开发服务器 (带 HMR)
pnpm dev

# 启动 Server 开发服务器 (仅 HTTP 服务)
pnpm dev:server

# 构建所有包
pnpm build

# 类型检查
pnpm typecheck
```

### 项目结构

```
ask-user-questions/
├── packages/
│   ├── server/       # Daemon + MCP Shell + HTTP Server
│   │   └── src/
│   │       ├── bin.ts       # MCP 入口：确保 Daemon 运行 + 启动 MCP STDIO
│   │       ├── daemon.ts    # Daemon 入口：后台 HTTP+WS 服务
│   │       ├── server.ts    # Hono + @hono/node-ws HTTP/WS 服务
│   │       ├── mcp.ts       # MCP stdio 服务 + 工具定义（HTTP API 代理）
│   │       ├── store.ts     # 内存状态管理 + 事件订阅
│   │       ├── config.ts    # 配置文件管理
│   │       ├── notify.ts    # 桌面通知 + 浏览器管理
│   │       ├── types.ts     # 类型定义
│   │       └── index.ts     # 公共 API 导出
│   └── app/          # Vue 3 Web UI
│       └── src/
│           ├── App.vue              # Shell 布局（顶栏 + router-view）
│           ├── router.ts            # Vue Router 路由配置
│           ├── pages/               # 页面组件
│           │   ├── home.vue         # 首页：待回答列表 + 历史记录
│           │   └── question-detail.vue # 问题详情页
│           ├── components/          # UI 组件
│           │   ├── question-card.vue  # 问题卡片（批量子问题）
│           │   └── settings-panel.vue # 设置面板
│           ├── composables/         # Vue composables
│           │   ├── use-questions.ts  # 问题状态 + WebSocket
│           │   └── use-dark-mode.ts  # 深色模式
│           └── lib/
│               ├── api.ts           # API 客户端 + WebSocket
│               └── i18n.ts          # 国际化（5 种语言）
├── docs/             # 架构文档
├── .github/workflows # CI/CD
└── pnpm-workspace.yaml
```

更多细节请参考 [架构文档 (中文)](docs/architecture-zh.md) | [Architecture (English)](docs/architecture-en.md)

## 发布

本项目使用 GitHub Actions + npm provenance (OIDC) 发布：

```bash
# 1. 更新版本号
cd packages/server
npm version patch  # 或 minor / major

# 2. 推送 tag
git push --follow-tags

# 3. GitHub Actions 自动构建并发布到 npm
```

## License

MIT
