# Agent Avatar

为 QwenPaw 所有智能体自定义头像。

[![QwenPaw](https://img.shields.io/badge/QwenPaw-%3E%3D2.0.0-blue)](https://github.com/agentscope-ai/QwenPaw)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## 功能

- ✅ 为每个 Agent **单独设置** 头像
- ✅ 三种模式：**上传图片** / **远程 URL** / **本地文件引用**
- ✅ 切换 Agent 时**自动切换**对应头像
- ✅ 本地文件模式支持**跨浏览器**持久化（手动放置文件）
- ✅ 纯前端插件，兼容 QwenPaw Tauri 桌面端

## 安装

将 `agent-avatar` 文件夹复制到 QwenPaw 插件目录：

```
~/.qwenpaw/plugins/agent-avatar/
```

重启 QwenPaw 即可自动加载。

## 使用

### 设置页面

1. 打开 QwenPaw 控制台
2. 左侧菜单 → **Plugins** → **Agent头像设置**
3. 选择 Agent，可通过以下三种方式设置头像：

| 方式     | 优先级            | 跨浏览器    | 操作                |
| ------ | -------------- | ------- | ----------------- |
| 上传图片   | 高              | ❌ 存于浏览器 | 点「上传图片」选择本地文件     |
| 远程 URL | 中              | ✅       | 输入图片 URL → 点「设置」  |
| 本地文件   | 低（自动 fallback） | ✅       | 手动放文件 → 点「启用文件路径」 |

### 跨浏览器持久化（本地文件模式）

在系统插件目录下手动放置 PNG 图片：

```
~/.qwenpaw/plugins/agent-avatar/assets/avatars/{agent_id}.png
```

例如为 `default` agent 设置头像：

```
~/.qwenpaw/plugins/agent-avatar/assets/avatars/default.png
```

然后在设置页面中对应 agent 点击「**启用文件路径**」即可。

> 图片建议规格：512×512 PNG，正方形。

### 生效

设置后回到聊天窗口，头像即刻生效。如未生效，强制刷新页面（`Ctrl+Shift+R`）。

## 目录结构

```
agent-avatar/
├── plugin.json          # 插件清单
├── index.js             # 运行时入口文件
├── assets/
│   └── avatars/         # 手动放置的头像文件（{agent_id}.png）
├── src/
│   └── index.tsx        # TypeScript 源码（可选）
└── README.md
```

## 数据存储

| 存储位置                                   | 内容                     | 持久性    |
| -------------------------------------- | ---------------------- | ------ |
| `localStorage` → `agent-avatar-config` | 上传的图片(base64) / URL 配置 | 同浏览器   |
| `localStorage` → `agent-avatar-agents` | Agent 名称缓存             | 同浏览器   |
| 插件 `assets/avatars/`                   | 手动放置的图片文件              | ✅ 跨浏览器 |

清除浏览器数据会导致上传的图片和 URL 配置丢失，建议重要头像使用本地文件模式。

## 兼容性

| QwenPaw 版本          | 支持  |
| ------------------- | --- |
| ≥ 2.0.0 (Tauri 桌面端) | ✅   |
| < 2.0.0             | ❌   |

## 开发

```bash
# 可选：如需修改源码后重新构建
cd agent-avatar
npm install
npm run build
```

不改源码可直接编辑 `index.js`，强制刷新控制台即可生效。

## 许可

MIT
