# 架构文档

> 本文档面向第一次参与此项目开发的同学，帮助快速理解项目架构与核心设计。

## 项目概述

`ask-user-questions` 是一个基于 MCP (Model Context Protocol) 的 Human-in-the-loop 工具。它允许 AI 模型在运行过程中向用户发起**批量提问**（1–4 个子问题），并等待用户在 Web 界面中给出回答后，再将结果返回给模型。

### 核心理念

- **本地优先**：所有数据存储在内存中，不依赖任何云服务
- **零配置**：用户只需安装 npm 包并配置 MCP 客户端即可使用
- **实时通信**：使用 SSE (Server-Sent Events) 实现浏览器与服务端的实时数据同步
- **国际化**：内置 5 种语言（en、zh-CN、ko、ja、ru），自动检测浏览器语言

## 整体架构

```
┌────────────────────────────────────────────────────────────────┐
│                       用户的电脑 (localhost)                     │
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
│                          │           │(内存)  │              │  │
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
│                          │   Dark Mode · 浏览器通知           │  │
│                          └──────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

## Monorepo 结构

项目采用 pnpm workspace 管理，包含两个子包：

### `packages/server` — MCP Shell

- **角色**：MCP 服务端 + 本地 HTTP 服务端
- **发布到 npm**：是（用户通过 `npx ask-user-questions` 使用）
- **技术栈**：
  - [hono](https://hono.dev/) — HTTP 框架
  - [srvx](https://srvx.unjs.io/) — 通用 HTTP 服务器
  - [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) — MCP SDK
  - [zod v4](https://zod.dev/) — 参数校验
  - TypeScript 5.9

### `packages/app` — Web UI

- **角色**：用户交互界面
- **发布到 npm**：否（构建产物嵌入 Server 包）
- **技术栈**：
  - [Vue 3](https://vuejs.org/) — UI 框架
  - [radix-vue](https://www.radix-vue.com/) + [ShadcnVue](https://www.shadcn-vue.com/) — UI 组件库
  - [Tailwind CSS v4](https://tailwindcss.com/)（`@tailwindcss/vite`）— CSS 框架
  - [Vite 7](https://vitejs.dev/) — 构建工具

## 核心模块详解

### 1. 启动入口 (`bin.ts`)

启动 MCP stdio 服务 + HTTP 服务（端口 13390）。

### 2. MCP Server (`mcp.ts`)

注册 `ask_user` 工具，采用 Copilot 风格的批量提问 Schema：

```typescript
// MCP Tool 输入 Schema
{
  questions: [                    // 1–4 个子问题
    {
      question: string,           // 问题文本
      multiSelect: boolean,       // 是否多选（默认 false）
      options?: [                 // 可选的选项列表
        {
          label: string,          // 选项标签
          description?: string,   // 选项描述
          recommended?: boolean   // 是否推荐
        }
      ]
    }
  ]
}
// 注意："其他" 自由文本输入始终可用，AI 无需手动添加
```

```typescript
server.tool('ask_user', { questions }, async () => {
  // 1. 创建问题 → store.createQuestion(questions)
  // 2. 发送系统通知
  // 3. 打开/聚焦浏览器
  // 4. 阻塞等待用户回答 (Promise)
  // 5. 返回 SubQuestionAnswer[] 给模型
})
```

**响应格式**：

```typescript
// SubQuestionAnswer[]
[
  {
    selected: string[],    // 用户选中的选项标签
    freeText?: string      // 用户输入的自由文本（"其他"输入）
  }
]
```

**关键设计**：工具调用会一直阻塞（`await store.waitForAnswer(id)`），直到用户在 Web 界面提交回答。这确保了模型获得回答前不会继续执行。

### 3. HTTP Server (`server.ts`)

提供以下 API：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/questions` | 获取所有问题 |
| GET | `/api/questions/pending` | 获取待回答问题 |
| GET | `/api/questions/:id` | 获取单个问题 |
| POST | `/api/questions/:id/answer` | 提交回答（`{ answers: SubQuestionAnswer[] }`） |
| GET | `/api/config` | 获取配置 |
| PUT | `/api/config` | 更新配置 |
| GET | `/api/events` | SSE 事件流 |
| GET | `/api/health` | 健康检查 |
| GET | `/*` | 静态文件（Web App） |

### 4. Store (`store.ts`)

基于内存的状态管理，核心机制：

- **问题存储**：`Map<string, Question>`
- **等待机制**：`Map<string, (answers: SubQuestionAnswer[]) => void>` — 当 MCP 工具等待回答时，将 Promise 的 resolve 函数存入此 Map
- **事件订阅**：`Set<Listener>` — SSE 连接订阅此事件流

**核心类型**：

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
  questions: SubQuestion[]       // 批量子问题
  status: 'pending' | 'answered'
  answers?: SubQuestionAnswer[]  // 回答数组
  createdAt: string
  answeredAt?: string
}
```

**核心方法**：

- `createQuestion(subQuestions: SubQuestion[]): Question`
- `answerQuestion(id, answers: SubQuestionAnswer[]): Question | null`
- `waitForAnswer(id): Promise<SubQuestionAnswer[]>`

```
[MCP 调用]                           [用户回答]
    │                                     │
    ▼                                     ▼
createQuestion(subQuestions)     answerQuestion(id, answers)
    │                                     │
    ├─► 存入 questions Map                ├─► 更新 question 状态
    ├─► emit('question:created')          ├─► 调用 waiter resolve(answers)
    └─► waitForAnswer(id)                 └─► emit('question:answered')
         │                                         │
         ▼                                         ▼
    返回 Promise<SubQuestionAnswer[]>         SSE 推送到浏览器
         ◄──────── resolve(answers) ──────────
```

### 5. Config (`config.ts`)

配置文件管理，配置文件路径：`~/.ask-user-questions/config.json`。

```typescript
interface Config {
  timeout: number            // 超时时间（毫秒），0 = 不超时（默认）
  notification: boolean      // 是否显示系统通知（默认 true）
  autoOpenBrowser: boolean   // 是否自动打开浏览器（默认 true）
}
```

配置可通过以下方式修改：
- **REST API**：`GET/PUT /api/config`
- **Web UI**：设置面板（SettingsPanel）

### 6. Notify (`notify.ts`)

系统通知与浏览器管理：

- **系统通知**：当新问题创建时发送桌面通知
- **浏览器单例**：macOS 下通过 AppleScript 查找并聚焦已有的浏览器标签页（支持 Chrome/Safari/Edge），若无已有标签则打开新标签

### 7. Web App

**新特性**：

- **i18n 国际化**：支持 5 种语言（en、zh-CN、ko、ja、ru），自动检测浏览器语言，语言偏好持久化到 localStorage
- **暗色模式**：支持系统/浅色/深色三种模式，持久化到 localStorage，包含 FOUC 防闪烁处理
- **REST 回退**：前端挂载时先通过 REST API 获取问题列表，再连接 SSE
- **浏览器通知**：使用 Notification API，标签未聚焦时标题闪烁提醒

**数据流**：

1. 页面加载时，通过 REST（`/api/questions`）获取初始数据
2. 连接 SSE（`/api/events`），监听实时事件
3. SSE 推送新问题事件 → 页面实时显示
4. 用户回答子问题并提交 → POST 到 API（`{ answers: SubQuestionAnswer[] }`）
5. SSE 推送回答完成事件 → 页面更新状态

**组件结构**：

```
App.vue (顶栏: logo, 标签切换, 语言选择, 主题切换, 连接状态点)
 ├── QuestionList.vue
 │    └── QuestionCard.vue (× N) — 批量子问题，支持选项/多选/"其他"自由输入
 └── SettingsPanel.vue — 超时、通知、自动打开浏览器、语言、主题
```

## 项目结构

```
packages/
├── server/
│   └── src/
│       ├── bin.ts       # 入口: 启动 Server + MCP
│       ├── server.ts    # Hono + srvx HTTP 服务
│       ├── mcp.ts       # MCP stdio + 工具定义
│       ├── store.ts     # 内存状态 + 事件发布/订阅
│       ├── config.ts    # 配置文件管理
│       ├── notify.ts    # 系统通知 + 浏览器管理
│       ├── types.ts     # 类型定义
│       └── index.ts     # 公共 API 导出
└── app/
    └── src/
        ├── App.vue
        ├── components/
        │   ├── QuestionCard.vue   # 问题卡片（批量子问题）
        │   ├── QuestionList.vue   # 问题列表
        │   ├── SettingsPanel.vue  # 设置面板
        │   └── ui/                # ShadcnVue 组件
        ├── composables/
        │   ├── useQuestions.ts    # 问题状态 + SSE
        │   └── useDarkMode.ts    # 暗色模式管理
        └── lib/
            ├── api.ts             # API 客户端 + 类型
            ├── i18n.ts            # 国际化（5 种语言）
            └── utils.ts           # 工具函数
```

## 构建与分发

### 构建流程

```
pnpm build
    │
    ├─ 1. 构建 App (Vite 7)
    │       └─ 输出到 packages/app/dist/
    │
    └─ 2. 构建 Server (tsdown)
            ├─ 编译 TypeScript → .mjs + .d.mts
            ├─ 复制 App dist → Server dist/public/
            └─ 输出到 packages/server/dist/
```

### npm 包内容

发布时，`ask-user-questions` npm 包包含：

```
dist/
├── bin.mjs          # MCP Server 入口 (带 shebang)
├── index.mjs        # 公共 API
├── index.d.mts      # 类型声明
└── public/          # 内嵌的 Web App 静态文件
    ├── index.html
    ├── assets/
    └── ...
```

## CI/CD

### GitHub Actions

- **CI** (`ci.yml`)：每次 push/PR 时运行类型检查和构建
- **Publish** (`publish.yml`)：推送 `v*` tag 时自动发布到 npm
  - 使用 OIDC (OpenID Connect) 生成 npm provenance
  - 确保包来源可信

### 发布步骤

```bash
cd packages/server
npm version patch    # 更新版本
git add -A && git commit -m "release: v0.1.1"
git tag v0.1.1
git push --follow-tags
# → GitHub Actions 自动构建并发布
```

## 开发指南

### 环境准备

```bash
node -v  # >= 20
pnpm -v  # >= 9

pnpm install
```

### 日常开发

```bash
# 终端 1: 启动 Server HTTP 服务 (用于 API 调试)
pnpm dev:server

# 终端 2: 启动 App 开发服务器 (带 HMR & API 代理)
pnpm dev
```

App 的 Vite 开发服务器会将 `/api/*` 请求代理到 `localhost:13390`，确保开发时前后端无缝对接。

### 添加 ShadcnVue 组件

```bash
cd packages/app
npx shadcn-vue@latest add [component-name]
```

## 常见问题

**Q: 为什么不用 WebSocket？**
A: SSE 对于此场景（服务端单向推送 + 客户端 HTTP POST）完全够用，且实现更简单。

**Q: 为什么状态存在内存而不是文件？**
A: 问题和回答是临时的会话数据，进程结束后不需要持久化。内存存储避免了文件 I/O 和序列化的复杂性。

**Q: 端口被占用怎么办？**
A: 使用 `--port` 参数指定其他端口：`npx ask-user-questions --port 8080`。

**Q: 配置文件在哪里？**
A: `~/.ask-user-questions/config.json`，也可以通过 Web UI 的设置面板修改。

**Q: 如何切换语言？**
A: Web UI 顶栏有语言选择器，支持 en、zh-CN、ko、ja、ru，选择后会持久化到 localStorage。
