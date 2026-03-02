# 架构文档

> 本文档面向第一次参与此项目开发的同学，帮助快速理解项目架构与核心设计。

## 项目概述

`ask-user-questions` 是一个基于 MCP (Model Context Protocol) 的 Human-in-the-loop 工具。它允许 AI 模型在运行过程中向用户发起提问，并等待用户在 Web 界面中给出回答后，再将结果返回给模型。

### 核心理念

- **本地优先**：所有数据存储在内存中，不依赖任何云服务
- **零配置**：用户只需安装 npm 包并配置 MCP 客户端即可使用
- **实时通信**：使用 SSE (Server-Sent Events) 实现浏览器与服务端的实时数据同步

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

## Monorepo 结构

项目采用 pnpm workspace 管理，包含两个子包：

### `packages/server` — MCP Shell

- **角色**：MCP 服务端 + 本地 HTTP 服务端
- **发布到 npm**：是（用户通过 `npx ask-user-questions` 使用）
- **技术栈**：
  - [hono](https://hono.dev/) — HTTP 框架
  - [srvx](https://srvx.unjs.io/) — 通用 HTTP 服务器
  - [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) — MCP SDK
  - [zod](https://zod.dev/) — 参数校验

### `packages/app` — Web UI

- **角色**：用户交互界面
- **发布到 npm**：否（构建产物嵌入 Server 包）
- **技术栈**：
  - [Vue 3](https://vuejs.org/) — UI 框架
  - [ShadcnVue](https://www.shadcn-vue.com/) — UI 组件库
  - [Tailwind CSS](https://tailwindcss.com/) — CSS 框架
  - [Vite](https://vitejs.dev/) — 构建工具

## 核心模块详解

### 1. 启动入口 (`bin.ts`)

启动 MCP stdio 服务 + HTTP 服务（端口 13390）。

### 2. MCP Server (`mcp.ts`)

注册 `ask_user` 工具：

```typescript
server.tool('ask_user', { question, options }, async () => {
  // 1. 创建问题 → store
  // 2. 发送系统通知
  // 3. 打开浏览器
  // 4. 阻塞等待用户回答 (Promise)
  // 5. 返回回答给模型
})
```

**关键设计**：工具调用会一直阻塞（`await store.waitForAnswer(id)`），直到用户在 Web 界面提交回答。这确保了模型获得回答前不会继续执行。

### 3. HTTP Server (`server.ts`)

提供以下 API：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/questions` | 获取所有问题 |
| GET | `/api/questions/pending` | 获取待回答问题 |
| GET | `/api/questions/:id` | 获取单个问题 |
| POST | `/api/questions/:id/answer` | 提交回答 |
| GET | `/api/events` | SSE 事件流 |
| GET | `/api/health` | 健康检查 |
| GET | `/*` | 静态文件（Web App） |

### 4. Store (`store.ts`)

基于内存的状态管理，核心机制：

- **问题存储**：`Map<string, Question>`
- **等待机制**：`Map<string, (answer: string) => void>` — 当 MCP 工具等待回答时，将 Promise 的 resolve 函数存入此 Map
- **事件订阅**：`Set<Listener>` — SSE 连接订阅此事件流

```
[MCP 调用]                    [用户回答]
    │                             │
    ▼                             ▼
createQuestion()          answerQuestion()
    │                             │
    ├─► 存入 questions Map        ├─► 更新 question 状态
    ├─► emit('question:created')  ├─► 调用 waiter resolve
    └─► waitForAnswer()           └─► emit('question:answered')
         │                                    │
         ▼                                    ▼
    返回 Promise ◄────── resolve ────── SSE 推送到浏览器
```

### 5. Web App

**数据流**：

1. 页面加载时，连接 SSE（`/api/events`），获取初始数据
2. SSE 推送新问题事件 → 页面实时显示
3. 用户输入回答并提交 → POST 到 API
4. SSE 推送回答完成事件 → 页面更新状态

**组件结构**：

```
App.vue
 └── QuestionList.vue
      └── QuestionCard.vue (× N)
           ├── Badge (状态标签)
           ├── Button (选项按钮 / 提交按钮)
           └── Textarea (自由输入)
```

## 构建与分发

### 构建流程

```
pnpm build
    │
    ├─ 1. 构建 App (Vite)
    │       └─ 输出到 packages/app/dist/
    │
    └─ 2. 构建 Server (tsdown)
            ├─ 编译 TypeScript
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
