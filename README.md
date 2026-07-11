# Agent Avatar

自定义 QwenPaw 所有智能体的头像和昵称展示。

[![QwenPaw](https://img.shields.io/badge/QwenPaw-%3E%3D2.0.0-blue)](https://github.com/agentscope-ai/QwenPaw)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## 功能

- ✅ 为每个 Agent **单独设置** 头像
- ✅ 支持 **上传本地图片** 或 **输入远程 URL**
- ✅ 切换 Agent 时 **自动切换** 对应头像
- ✅ 数据 **本地存储**（`localStorage`），无外部依赖
- ✅ 纯前端插件，兼容 QwenPaw Tauri 桌面端

## 安装

将 `agent-avatar` 文件夹复制到 QwenPaw 插件目录：

```
~/.qwenpaw/plugins/agent-avatar/
```

重启 QwenPaw 即可自动加载。

## 使用

1. 打开 QwenPaw 控制台
2. 左侧菜单 → **Plugins** → **Agent头像设置**
3. 选择 Agent，上传图片或输入 URL
4. 回到聊天窗口，头像即刻生效

## 目录结构

```
agent-avatar/
├── plugin.json       # 插件清单
├── dist/
│   └── index.js      # 运行时加载的 JS 文件
├── src/
│   └── index.tsx     # TypeScript 源码（可选）
└── README.md
```

## 数据存储

头像配置保存在浏览器 `localStorage`：

| Key | 内容 |
|-----|------|
| `agent-avatar-config` | JSON 映射：`agentId → {type, url/data}` |
| `agent-avatar-agents` | Agent 名称缓存 |

清除浏览器数据会导致头像丢失，建议定期导出。

## 兼容性

| QwenPaw 版本 | 支持 |
|-------------|------|
| ≥ 2.0.0 (Tauri 桌面端) | ✅ |
| < 2.0.0 | ❌ |

## 开发

```bash
# 可选：如需修改源码后重新构建
cd agent-avatar
npm install
npm run build
```

不改源码可直接编辑 `dist/index.js`，刷新控制台即可生效。

## 许可

MIT
