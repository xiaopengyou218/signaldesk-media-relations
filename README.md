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

```bash
npm install
npm run dev
```

发布前检查：

```bash
npm run lint
npm run build
```
