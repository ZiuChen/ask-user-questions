# ask-user-questions

一个 MCP (Model Context Protocol) 工具，允许 AI 模型通过本地 Web 界面向用户发起提问，实现 Human-in-the-loop 的交互模式。

An MCP tool that allows AI models to ask users questions via a local web interface, enabling human-in-the-loop interactions.

## 工作原理

```
┌──────────────┐    stdio     ┌─────────────────┐    HTTP     ┌──────────────┐
│  AI Model    │◄────────────►│  Server (MCP)    │◄───────────►│  Web App UI  │
│  (e.g. Claude)│              │  localhost:13390 │             │  (Browser)   │
└──────────────┘              └─────────────────┘              └──────────────┘
```

1. AI 模型通过 MCP 协议调用 `ask_user` 工具
2. Server 创建提问并发送系统通知，自动打开浏览器
3. 用户在 Web 界面看到问题并提交回答
4. 回答通过 HTTP API 回传给 Server，Server 再通过 stdio 返回给模型

## 快速开始

### 安装

```bash
npm install -g ask-user-questions
# 或
npx ask-user-questions
```

### 配置 MCP 客户端

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

**VS Code** (`.vscode/mcp.json`):

```json
{
  "servers": {
    "ask-user-questions": {
      "command": "npx",
      "args": ["ask-user-questions"]
    }
  }
}
```

### 自定义端口

```json
{
  "mcpServers": {
    "ask-user-questions": {
      "command": "npx",
      "args": ["ask-user-questions", "--port", "8080"]
    }
  }
}
```

## MCP 工具

### `ask_user`

向用户发起提问并等待回答。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `question` | `string` | ✅ | 要向用户提的问题 |
| `options` | `string[]` | ❌ | 可选的预设回答选项 |

**示例调用**:
```json
{
  "name": "ask_user",
  "arguments": {
    "question": "你希望这个组件使用 Composition API 还是 Options API？",
    "options": ["Composition API", "Options API"]
  }
}
```

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
│   ├── server/       # MCP Shell + HTTP Server
│   │   └── src/
│   │       ├── bin.ts       # MCP Server 入口
│   │       ├── server.ts    # Hono + srvx HTTP 服务
│   │       ├── mcp.ts       # MCP stdio 服务
│   │       ├── store.ts     # 内存状态管理
│   │       ├── notify.ts    # 系统通知 + 浏览器打开
│   │       └── index.ts     # 公共 API 导出
│   └── app/          # Vue 3 Web UI
│       └── src/
│           ├── App.vue
│           ├── components/  # UI 组件
│           ├── composables/ # Vue composables
│           └── lib/         # API 客户端
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
