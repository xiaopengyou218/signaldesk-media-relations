# SignalDesk

SignalDesk 是一个轻量媒体关系工作台，用于集中管理科技媒体编辑、近期文章、X 互动机会和关系进度。

## MVP 能力

- 编辑与媒体分类数据库
- 最近文章和关注领域追踪
- 每日少量 X 互动机会队列
- 从观察到建联的关系阶段记录
- 公开互动、回应和关注事件记录
- OpenAI、Anthropic、Gemini 与 OpenAI-compatible 模型连接测试
- D1 持久化存储

系统不会自动在 X 发布内容，也不会保存完整模型 API Key。

## 本地运行

macOS 日常使用：双击上一级目录中的 `启动 SignalDesk.command`。第一次启动会要求输入 MiniMax API Key，并保存到 macOS 钥匙串。可使用同目录中的停止和更新密钥入口。

本地地址为 `http://127.0.0.1:3000`，本地数据库保存在项目的 Wrangler 状态目录中，不会与云端 D1 自动同步。

开发模式：

```bash
npm install
npm run dev
```

发布前检查：

```bash
npm run lint
npm run build
```
