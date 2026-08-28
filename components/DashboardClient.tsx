"use client";

import { useMemo, useState } from "react";
import type { AppState, Editor, Opportunity } from "@/lib/types";

type Tab = "today" | "editors" | "articles" | "review" | "models";

const navItems: Array<{ id: Tab; icon: string; label: string }> = [
  { id: "today", icon: "⌁", label: "今日行动" },
  { id: "editors", icon: "◎", label: "编辑关系" },
  { id: "articles", icon: "▤", label: "文章动态" },
  { id: "review", icon: "↗", label: "四周复盘" },
  { id: "models", icon: "◇", label: "模型设置" },
];

const stageOptions = ["观察中", "首次公开互动", "多次有效互动", "对方回应", "私信/邮件联系", "稳定关系"];

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

function dateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

export default function DashboardClient({ initialState }: { initialState: AppState }) {
  const [state, setState] = useState(initialState);
  const [tab, setTab] = useState<Tab>("today");
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [interactionEditor, setInteractionEditor] = useState<Editor | null>(null);
  const [showModelForm, setShowModelForm] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const xEditors = state.editors.filter((editor) => editor.priority === "X优先");
  const effectiveInteractions = state.interactions.filter((item) => ["公开回复", "转发并补充"].includes(item.interaction_type)).length;
  const responses = state.interactions.filter((item) => item.response_received).length;
  const completed = state.opportunities.filter((item) => item.status === "已回复").length;

  async function mutate(payload: Record<string, unknown>) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as AppState & { error?: string };
      if (!response.ok) throw new Error(result.error || "保存失败");
      setState(result);
      setNotice("已保存");
      window.setTimeout(() => setNotice(""), 1800);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "保存失败");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const filteredEditors = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return state.editors.filter((editor) => !keyword || [editor.name, editor.media, editor.role, editor.topics].join(" ").toLowerCase().includes(keyword));
  }, [search, state.editors]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setTab("today")}>
          <span className="brand-mark">S</span><span>SignalDesk</span>
        </button>
        <nav aria-label="主要导航">
          {navItems.map((item) => (
            <button className={`nav-item ${tab === item.id ? "active" : ""}`} key={item.id} onClick={() => setTab(item.id)}>
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="import-badge"><span>✓</span><div><strong>Excel 数据已导入</strong><small>{state.editors.length} 位编辑 · 13 家媒体</small></div></div>
        <div className="sidebar-foot"><div className="mode-dot" /><div><strong>演示模式</strong><small>可连接任意 LLM API</small></div></div>
      </aside>

      <section className="workspace">
        <Header tab={tab} />
        {notice && <div className={`toast ${notice === "已保存" ? "success" : ""}`}>{notice}</div>}
        {tab === "today" && (
          <TodayView state={state} xEditors={xEditors} effectiveInteractions={effectiveInteractions} responses={responses} completed={completed} onSelect={setSelectedOpportunity} />
        )}
        {tab === "editors" && (
          <EditorsView editors={filteredEditors} search={search} setSearch={setSearch} busy={busy} onStage={(id, stage) => mutate({ type: "update_editor_stage", id, stage })} onLog={setInteractionEditor} />
        )}
        {tab === "articles" && <ArticlesView state={state} />}
        {tab === "review" && <ReviewView state={state} effective={effectiveInteractions} responses={responses} />}
        {tab === "models" && <ModelsView state={state} onAdd={() => setShowModelForm(true)} />}
      </section>

      {selectedOpportunity && (
        <OpportunityDrawer
          opportunity={selectedOpportunity}
          busy={busy}
          onClose={() => setSelectedOpportunity(null)}
          onUpdate={async (status, xPostStatus, xPostUrl) => {
            const ok = await mutate({ type: "update_opportunity", id: selectedOpportunity.id, status, xPostStatus, xPostUrl });
            if (ok) setSelectedOpportunity(null);
          }}
          onLog={() => {
            const editor = state.editors.find((item) => item.id === selectedOpportunity.editor_id) || null;
            setSelectedOpportunity(null);
            setInteractionEditor(editor);
          }}
        />
      )}
      {interactionEditor && (
        <InteractionModal editor={interactionEditor} busy={busy} onClose={() => setInteractionEditor(null)} onSave={async (payload) => {
          const ok = await mutate({ type: "add_interaction", editorId: interactionEditor.id, ...payload });
          if (ok) setInteractionEditor(null);
        }} />
      )}
      {showModelForm && (
        <ModelModal busy={busy} onClose={() => setShowModelForm(false)} onSave={async (payload) => {
          const ok = await mutate({ type: "save_model_connection", ...payload });
          if (ok) setShowModelForm(false);
        }} />
      )}
    </main>
  );
}

function Header({ tab }: { tab: Tab }) {
  const titles: Record<Tab, [string, string]> = {
    today: ["媒体关系工作台", "今天只需要做 3 件事"],
    editors: ["关系数据库", "编辑关系"],
    articles: ["内容雷达", "近期文章与关注点"],
    review: ["关系效果", "四周复盘"],
    models: ["供应商无关", "模型与 API 设置"],
  };
  const today = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
  return <header className="topbar"><div><span className="eyebrow">{titles[tab][0]}</span><h1>{titles[tab][1]}</h1></div><div className="date-chip">{today}</div></header>;
}

function Metric({ label, value, note }: { label: string; value: string | number; note: string }) {
  return <article><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function TodayView({ state, xEditors, effectiveInteractions, responses, completed, onSelect }: {
  state: AppState; xEditors: Editor[]; effectiveInteractions: number; responses: number; completed: number; onSelect: (item: Opportunity) => void;
}) {
  const queue = state.opportunities.filter((item) => item.status !== "跳过").slice(0, 3);
  return <>
    <div className="metrics" aria-label="本周概览">
      <Metric label="X 优先编辑" value={xEditors.length} note="全部有公开职业账号" />
      <Metric label="本周互动上限" value="5" note={`还剩 ${Math.max(0, 5 - completed)} 次`} />
      <Metric label="有效公开互动" value={effectiveInteractions} note="点赞不计入" />
      <Metric label="编辑回应" value={responses} note={responses ? "关系正在升温" : "等待第一次真实回应"} />
    </div>
    <div className="content-grid">
      <section className="panel action-panel">
        <div className="panel-heading"><div><span className="eyebrow">X 行动队列</span><h2>高相关机会</h2></div><span className="subtle-count">本周 {state.opportunities.length} 个</span></div>
        <div className="action-list">
          {queue.map((action, index) => <ActionCard action={action} index={index} key={action.id} onSelect={onSelect} />)}
        </div>
      </section>
      <aside className="side-stack">
        <section className="panel focus-card"><span className="eyebrow">今日节奏</span><div className="timer">10<span>分钟</span></div><p>找不到作者原帖，或没有真正能增加的信息，就直接跳过。</p><div className="progress"><span style={{ width: `${Math.min(100, completed / 3 * 100)}%` }} /></div><small>{Math.min(completed, 3)} / 3 项完成</small></section>
        <section className="panel relationship-card"><div className="panel-heading compact"><div><span className="eyebrow">关系温度</span><h2>{responses ? `${responses} 位已有回应` : "从观察开始"}</h2></div></div>{xEditors.slice(0, 3).map((editor) => <div className="relationship-row" key={editor.id}><span>{initials(editor.name)}</span><div><strong>{editor.name}</strong><small>{editor.topics.split("；").slice(0, 2).join(" · ")}</small></div><em>{editor.stage}</em></div>)}</section>
      </aside>
    </div>
  </>;
}

function ActionCard({ action, index, onSelect }: { action: Opportunity; index: number; onSelect: (item: Opportunity) => void }) {
  const handle = action.x_url?.split("/").pop();
  return <article className="action-card"><div className="action-number">0{index + 1}</div><div className="action-main"><div className="person-line"><span className={`priority ${action.priority === "紧急" ? "urgent" : ""}`}>{action.priority}</span><strong>{action.editor_name}</strong><span>{action.media}</span>{handle && <a href={action.x_url || "#"} target="_blank" rel="noreferrer">@{handle}</a>}</div><h3>{action.article_title}</h3><p>{action.suggested_angle}</p></div><div className="action-controls"><span>{dateLabel(action.due_date)}</span><button onClick={() => onSelect(action)}>{action.status === "已回复" ? "查看记录" : "查看建议"}</button></div></article>;
}

function EditorsView({ editors, search, setSearch, busy, onStage, onLog }: { editors: Editor[]; search: string; setSearch: (value: string) => void; busy: boolean; onStage: (id: string, stage: string) => void; onLog: (editor: Editor) => void }) {
  return <section className="panel table-panel"><div className="toolbar"><div><span className="eyebrow">已导入数据库</span><h2>{editors.length} 位编辑</h2></div><input aria-label="搜索编辑" placeholder="搜索姓名、媒体或关注点" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="editor-table"><div className="table-row table-head"><span>编辑</span><span>媒体与职位</span><span>关注领域</span><span>关系阶段</span><span>互动</span><span /></div>{editors.map((editor) => <div className="table-row" key={editor.id}><span className="editor-identity"><i>{initials(editor.name)}</i><span><strong>{editor.name}</strong>{editor.x_url ? <a href={editor.x_url} target="_blank" rel="noreferrer">@{editor.x_url.split("/").pop()}</a> : <small>暂无 X 账号</small>}</span></span><span><strong>{editor.media}</strong><small>{editor.role}</small></span><span className="topic-cell">{editor.topics}</span><span><select disabled={busy} value={editor.stage} onChange={(event) => onStage(editor.id, event.target.value)}>{stageOptions.map((stage) => <option key={stage}>{stage}</option>)}</select></span><span><strong>{editor.effective_interactions}</strong><small>{editor.responses} 次回应</small></span><span><button className="row-button" onClick={() => onLog(editor)}>记录互动</button></span></div>)}</div></section>;
}

function ArticlesView({ state }: { state: AppState }) {
  return <div className="article-layout"><section className="panel article-feed"><div className="panel-heading"><div><span className="eyebrow">最近更新</span><h2>{state.articles.length} 篇重点文章</h2></div><span className="source-pill">RSS / 作者页</span></div>{state.articles.map((article) => <article className="article-item" key={article.id}><div className="article-date">{dateLabel(article.published_at)}</div><div><div className="person-line"><strong>{article.editor_name}</strong><span>{article.media}</span></div><a className="article-title" href={article.url} target="_blank" rel="noreferrer">{article.title}</a><p>{article.summary}</p><div className="tag-row">{article.topics.split("；").map((tag) => <span key={tag}>{tag}</span>)}</div></div></article>)}</section><aside className="panel method-card"><span className="eyebrow">低成本流程</span><h2>只把必要内容交给模型</h2><ol><li><strong>采集</strong><span>RSS 和作者页</span></li><li><strong>去重</strong><span>URL 与正文指纹</span></li><li><strong>初筛</strong><span>关键词和规则</span></li><li><strong>分析</strong><span>仅处理高相关内容</span></li></ol></aside></div>;
}

function ReviewView({ state, effective, responses }: { state: AppState; effective: number; responses: number }) {
  const progress = Math.min(100, effective / 5 * 100);
  return <div className="review-grid"><section className="panel review-hero"><span className="eyebrow">第一周 · 8月26日至9月1日</span><h2>互动质量比数量重要</h2><div className="review-meter"><span style={{ width: `${progress}%` }} /></div><div className="review-stats"><div><strong>{effective}</strong><span>有效公开互动</span></div><div><strong>{responses}</strong><span>编辑回应</span></div><div><strong>{state.editors.filter((item) => item.stage !== "观察中").length}</strong><span>关系升级</span></div></div></section><section className="panel weekly-table"><div className="panel-heading"><div><span className="eyebrow">四周试运行</span><h2>成功标准</h2></div></div>{["建议机会被采纳","回复草稿可直接使用","获得编辑真实回应","连续四周仍愿意使用"].map((item, index) => <div className="goal-row" key={item}><span>0{index + 1}</span><strong>{item}</strong><em>{index === 0 ? `${Math.round(progress)}%` : "待观察"}</em></div>)}</section><section className="panel boundary-card"><span className="eyebrow">精力边界</span><h2>系统应该帮你减少动作</h2><ul><li>每天只检查一次，最多10分钟</li><li>每周最多3–5次有效互动</li><li>找不到原帖就跳过</li><li>点赞不推动关系阶段</li><li>不自动发布、不批量触达</li></ul></section></div>;
}

function ModelsView({ state, onAdd }: { state: AppState; onAdd: () => void }) {
  return <div className="models-grid"><section className="panel model-connections"><div className="panel-heading"><div><span className="eyebrow">模型连接</span><h2>供应商可以随时切换</h2></div><button className="primary-button" onClick={onAdd}>添加连接</button></div>{state.modelConnections.map((connection) => <div className="connection-row" key={connection.id}><span className={`provider-logo ${connection.provider}`}>{connection.provider === "demo" ? "D" : connection.provider[0].toUpperCase()}</span><div><strong>{connection.label}</strong><small>{connection.model}{connection.base_url ? ` · ${connection.base_url}` : ""}</small></div><span className="status-dot">{connection.status}</span>{connection.is_default ? <em>默认</em> : <em>备用</em>}</div>)}</section><section className="panel router-card"><span className="eyebrow">统一任务接口</span><h2>业务逻辑不绑定模型</h2><div className="router-flow"><span>文章分类</span><span>相关性评分</span><span>互动建议</span><span>周报生成</span></div><p>系统统一处理任务、结构化输出、重试与费用记录；每个供应商只负责把统一任务翻译成自己的 API 格式。</p></section><section className="panel provider-matrix"><div className="panel-heading"><div><span className="eyebrow">当前支持</span><h2>四类连接方式</h2></div></div>{[["OpenAI","原生 Responses API"],["Anthropic","原生 Messages API"],["Gemini","原生 GenerateContent API"],["兼容端点","OpenAI-compatible / 私有网关"]].map(([name, note]) => <div className="matrix-row" key={name}><strong>{name}</strong><span>{note}</span><em>可连接</em></div>)}</section></div>;
}

function OpportunityDrawer({ opportunity, busy, onClose, onUpdate, onLog }: { opportunity: Opportunity; busy: boolean; onClose: () => void; onUpdate: (status: string, xPostStatus: string, xPostUrl?: string) => void; onLog: () => void }) {
  const [xPostUrl, setXPostUrl] = useState(opportunity.x_post_url || "");
  // The dialog backdrop is pointer-only; the labelled close button remains the keyboard path.
  // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
  return <dialog open className="overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="drawer"><button className="close-button" onClick={onClose} aria-label="关闭">×</button><span className="eyebrow">{opportunity.editor_name} · {opportunity.media}</span><h2>{opportunity.article_title}</h2><div className="drawer-links"><a href={opportunity.article_url} target="_blank" rel="noreferrer">阅读文章</a>{opportunity.x_url && <a href={opportunity.x_url} target="_blank" rel="noreferrer">打开 X 主页</a>}</div><div className="advice-box"><small>建议回复角度</small><p>{opportunity.suggested_angle}</p></div><label>X 原帖链接<input value={xPostUrl} onChange={(event) => setXPostUrl(event.target.value)} placeholder="找到原帖后粘贴链接" /></label><div className="drawer-actions"><button disabled={busy} className="secondary-button" onClick={() => onUpdate("跳过", "无相关原帖")}>没有原帖，跳过</button><button disabled={busy || !xPostUrl} className="secondary-button" onClick={() => onUpdate("待读原帖", "已找到", xPostUrl)}>保存原帖</button><button disabled={busy} className="primary-button" onClick={onLog}>记录互动</button></div><p className="privacy-note">系统不会替你在 X 发布内容。所有互动必须由你阅读后人工完成。</p></aside></dialog>;
}

function InteractionModal({ editor, busy, onClose, onSave }: { editor: Editor; busy: boolean; onClose: () => void; onSave: (payload: Record<string, unknown>) => void }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), interactionType: "公开回复", xPostUrl: "", replyUrl: "", summary: "", responseReceived: false, followedByEditor: false });
  // The dialog backdrop is pointer-only; the labelled close button remains the keyboard path.
  // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
  return <dialog open className="overlay center" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal" onSubmit={(event) => { event.preventDefault(); onSave(form); }}><button type="button" className="close-button" onClick={onClose}>×</button><span className="eyebrow">记录真实行动</span><h2>{editor.name}</h2><div className="form-grid"><label>日期<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label><label>互动类型<select value={form.interactionType} onChange={(event) => setForm({ ...form, interactionType: event.target.value })}><option>点赞</option><option>公开回复</option><option>转发并补充</option></select></label><label className="wide">X 原帖链接<input value={form.xPostUrl} onChange={(event) => setForm({ ...form, xPostUrl: event.target.value })} placeholder="https://x.com/..." /></label><label className="wide">我的回复链接<input value={form.replyUrl} onChange={(event) => setForm({ ...form, replyUrl: event.target.value })} placeholder="发布后粘贴；点赞可留空" /></label><label className="wide">互动摘要<textarea required value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} placeholder="我补充了什么信息或提出了什么问题？" /></label></div><div className="check-row"><label><input type="checkbox" checked={form.responseReceived} onChange={(event) => setForm({ ...form, responseReceived: event.target.checked })} /> 对方已经回应</label><label><input type="checkbox" checked={form.followedByEditor} onChange={(event) => setForm({ ...form, followedByEditor: event.target.checked })} /> 对方已经关注我</label></div><button disabled={busy} className="primary-button full">保存互动</button></form></dialog>;
}

function ModelModal({ busy, onClose, onSave }: { busy: boolean; onClose: () => void; onSave: (payload: Record<string, unknown>) => void }) {
  const [form, setForm] = useState({ label: "", provider: "openai", model: "", baseUrl: "", apiKey: "" });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState("");
  async function testConnection() {
    setTesting(true); setTestResult("");
    try {
      const response = await fetch("/api/model-test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json() as { ok?: boolean; latencyMs?: number; error?: string };
      if (!response.ok) throw new Error(result.error || "连接失败");
      setTestResult(`连接成功 · ${result.latencyMs}ms`);
    } catch (error) { setTestResult(error instanceof Error ? error.message : "连接失败"); }
    finally { setTesting(false); }
  }
  // The dialog backdrop is pointer-only; the labelled close button remains the keyboard path.
  // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
  return <dialog open className="overlay center" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal" onSubmit={(event) => { event.preventDefault(); onSave({ ...form, keyHint: form.apiKey ? `••••${form.apiKey.slice(-4)}` : "", status: testResult.startsWith("连接成功") ? "已测试" : "未测试" }); }}><button type="button" className="close-button" onClick={onClose}>×</button><span className="eyebrow">BYOK · 用户自带密钥</span><h2>添加模型连接</h2><div className="form-grid"><label>连接名称<input required value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="例如：我的内容分析模型" /></label><label>供应商<select value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })}><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="gemini">Gemini</option><option value="compatible">OpenAI 兼容端点</option></select></label><label>模型名称<input required value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} placeholder="使用供应商提供的模型 ID" /></label>{form.provider === "compatible" && <label>Base URL<input required value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} placeholder="https://api.example.com/v1" /></label>}<label className="wide">API Key<input required type="password" autoComplete="off" value={form.apiKey} onChange={(event) => setForm({ ...form, apiKey: event.target.value })} placeholder="只用于本次连接测试" /></label></div><p className="privacy-note">MVP 不会保存完整 API Key，只保存供应商、模型、端点和密钥后四位。</p>{testResult && <div className={`test-result ${testResult.startsWith("连接成功") ? "ok" : ""}`}>{testResult}</div>}<div className="modal-actions"><button type="button" className="secondary-button" disabled={testing} onClick={testConnection}>{testing ? "测试中…" : "测试连接"}</button><button disabled={busy || !form.label || !form.model || !form.apiKey} className="primary-button">保存配置</button></div></form></dialog>;
}
