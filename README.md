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
2. Server 创建提问并发送系统通知，自动打开/聚焦浏览器标签页
3. 用户在 Web 界面看到问题并提交回答
4. 回答通过 HTTP API 回传给 Server，Server 再通过 stdio 返回给模型

## 特性

- **批量提问**：一次最多发送 4 个子问题，支持单选/多选/自由文本
- **丰富选项**：选项支持 label、description、recommended 标记
- **自由文本**：每个子问题始终附带 "Other" 自由文本输入
- **实时通信**：SSE 实时推送 + REST API 降级
- **浏览器单例**：macOS 上通过 AppleScript 聚焦已有标签页
- **系统通知**：跨平台系统通知（macOS / Windows / Linux）
- **国际化**：支持 5 种语言（English、中文、한국어、日本語、Русский）
- **深色模式**：跟随系统 / 浅色 / 深色三种主题
- **响应式**：适配桌面和移动端
- **可配置**：超时、通知开关、浏览器自动打开开关

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
| `notification` | `boolean` | `true` | 是否显示系统通知 |
| `autoOpenBrowser` | `boolean` | `true` | 是否自动打开浏览器 |

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
│   │       ├── bin.ts       # 入口：启动 Server + MCP
│   │       ├── server.ts    # Hono + srvx HTTP 服务
│   │       ├── mcp.ts       # MCP stdio 服务 + 工具定义
│   │       ├── store.ts     # 内存状态管理 + 事件订阅
│   │       ├── config.ts    # 配置文件管理
│   │       ├── notify.ts    # 系统通知 + 浏览器管理
│   │       ├── types.ts     # 类型定义
│   │       └── index.ts     # 公共 API 导出
│   └── app/          # Vue 3 Web UI
│       └── src/
│           ├── App.vue              # 主布局
│           ├── components/          # UI 组件
│           │   ├── QuestionCard.vue # 问题卡片（批量子问题）
│           │   ├── QuestionList.vue # 问题列表
│           │   └── SettingsPanel.vue # 设置面板
│           ├── composables/         # Vue composables
│           │   ├── useQuestions.ts   # 问题状态 + SSE
│           │   └── useDarkMode.ts   # 深色模式
│           └── lib/
│               ├── api.ts           # API 客户端
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
