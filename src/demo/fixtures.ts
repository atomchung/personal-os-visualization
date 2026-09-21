/** Synthetic showcase fixture; never generated from a real API or private vault. */
import type { Cockpit, FocusData, GoalsData, HealthData, Home, IdealData, TimeData, TimePeriod, TodosData } from "../lib/api"
import type { InvestmentActionItem, InvestmentActions, InvestmentContext, InvestmentData, InvestmentHistory, InvestmentHistorySource, InvestmentMarket, InvestmentPending, InvestmentWatch, InvestmentWork, MarketExplore, MarketExploreItem, MomentumLeaders, MomentumUniverse, StockMomentumData, StockQuote } from "../lib/investment"
import { investmentScenario } from "./generated/investment-scenario.ts"

export const DATE = investmentScenario.as_of
export const STAMP = `${DATE}T12:00:00+08:00`
export const WEEK = "2026-W38"

export function createState() {
  return {
    sequence: 10,
    todos: [
      { id: "demo-todo-1", text: "為紙飛機筆記測試搜尋流程", category: "輸出", done: false, due: DATE, goal_id: "demo-build", goal_title: "完成紙飛機筆記原型" },
      { id: "demo-todo-2", text: "整理星島產業的研究問題", category: "投資", done: false, due: DATE, goal_id: "", goal_title: "" },
      { id: "demo-todo-3", text: "完成本週閱讀摘要", category: "學習", done: true, due: "2026-09-18", goal_id: "", goal_title: "" },
    ],
    milestones: [true, false],
    verdict: "" as Cockpit["suggestions"][number]["human_verdict"],
    nomination: "先讓一位測試者找到上週的筆記",
    nextAction: "",
    investmentWork: [] as InvestmentWork[],
  }
}
export type DemoState = ReturnType<typeof createState>

export function cockpit(state: DemoState): Cockpit {
  return {
    week_id: WEEK, focus_goal_title: "完成紙飛機筆記原型", focus_goal_target: "驗證筆記能否快速找回",
    focus_milestone: "完成一次搜尋體驗測試", focus_proposed_milestone: "",
    suggestions: [{ task_slug: "demo-paper-plane", title: "紙飛機筆記：第一輪測試", next_action: "用三篇範例筆記走一次搜尋流程",
      goal_title: "完成紙飛機筆記原型", goal_target: "驗證筆記能否快速找回", goal_attributed: true,
      current_milestone: "完成一次搜尋體驗測試", proposed_milestone: "", expected_benefit: "知道搜尋入口是否容易理解",
      benefit_defined: true, why_now: "範例原型已完成，可以驗證使用方式", next_actor: "自己", action_kind: "驗證",
      evidence_ref: "demo:paper-plane-prototype", human_verdict: state.verdict }],
  }
}

export function home(state: DemoState): Home {
  const active = state.todos.filter(t => !t.done)
  return {
    hero: { greeting: "你好，", name: "範例使用者", week_label: "合成範例 · 2026 年第 38 週", usage_missing: false,
      diagnosis: [{ label: "本週投入", value: "12h", note: "合成活動" }, { label: "活躍工作", value: "2", note: "示範專案" }, { label: "下一步", value: "已備妥", note: "可直接試用" }] },
    pillars: [
      { label: "原型", value: "1", unit: "個", sub: "紙飛機筆記", pct: 0.5, tone: "accent", delta: "完成第一版", delta_tone: "ok", spark: [0, 1, 1, 2, 3, 4, 5] },
      { label: "研究", value: "3", unit: "篇", sub: "虛構產業案例", pct: 0.6, tone: "info", delta: "新增 1 篇", delta_tone: "ok", spark: [1, 1, 2, 2, 2, 3, 3] },
      { label: "活動", value: "4", unit: "次", sub: "範例週紀錄", pct: 0.8, tone: "ok", delta: "步調穩定", delta_tone: "mute", spark: [2, 3, 2, 4, 3, 4, 4] },
      { label: "學習", value: "2", unit: "篇", sub: "閱讀摘要", pct: 0.5, tone: "info", delta: "已有整理", delta_tone: "mute", spark: [0, 1, 0, 1, 1, 2, 2] },
    ],
    threads: { supply_rate: state.nextAction ? 1 : 0.5, supplied: state.nextAction ? 2 : 1, total: 2,
      pending_nominations: state.nomination ? 1 : 0, items: [
        { slug: "demo-paper-plane", title: "紙飛機筆記", emoji: "", days_label: "本週", next_action: state.nextAction, supplied: !!state.nextAction, nomination: state.nomination },
        { slug: "demo-reading", title: "閱讀與筆記", emoji: "", days_label: "本週", next_action: "整理下一篇摘要", supplied: true, nomination: "" },
      ] },
    todos: active.map(t => ({ id: t.id, text: t.text, category: t.category, tone: "info" })), todo_total: active.length,
    categories: [{ category: "輸出", hours: 7, commits: 4, cloud_sessions: 0, cloud_commits: 0 }, { category: "學習", hours: 3, commits: 1, cloud_sessions: 0, cloud_commits: 0 }, { category: "投資", hours: 2, commits: 1, cloud_sessions: 0, cloud_commits: 0 }],
    categories_note: "全部為合成活動，未連接任何帳戶。",
    inbox: { pending: 1, stale: 0, health_label: "範例來源", health_tone: "mute", rows: [{ time_label: "週五", cwd: "紙飛機筆記", text: "搜尋流程完成，下一步是使用測試。", heavy: false }], hidden: 0 },
    cockpit: cockpit(state),
  }
}

export function todos(state: DemoState): TodosData {
  const active = state.todos.filter(t => !t.done).length
  return { month_milestones: state.milestones.map((done, i) => ({ goal_title: "完成紙飛機筆記原型", text: i ? "完成搜尋體驗測試" : "建立範例原型", done, auto_done: false })),
    active_count: active, done_count: state.todos.length - active, rate: state.todos.length ? Math.round(100 * (state.todos.length - active) / state.todos.length) : 0,
    categories: [...new Set(state.todos.map(t => t.category))].map(name => {
      const items = state.todos.filter(t => t.category === name)
      return { name, active_count: items.filter(t => !t.done).length, total_count: items.length, items }
    }), category_options: ["輸出", "投資", "學習", "其他"], goal_options: [{ id: "demo-build", title: "完成紙飛機筆記原型" }], archivable_count: 0 }
}

export function goals(state: DemoState): GoalsData {
  const done = state.milestones.filter(Boolean).length
  return {
    quarter_label: "2026 Q3 · 合成範例", ai_evidence: null,
    effect_lens: { total_tasks: 2, linked_tasks: 1, pct_linked: 50, unlinked_tasks: 1,
      by_goal: [{ goal_title: "完成紙飛機筆記原型", count: 1, active: 1, zombie: 0 }],
      by_cluster: [{ cluster: "筆記工具", count: 2, active: 2, zombie: 0, pct_linked: "50%", shipped: "1 個合成原型" }], unlinked_slugs: ["demo-reading"] },
    roadmap_months: [{ ym: "2026-09", label: "9 月", groups: [{ parent_id: "demo-product", parent_title: "做一個有用的小工具", items: state.milestones.map((value, i) => ({ goal_title: "紙飛機筆記", text: i ? "完成搜尋體驗測試" : "建立範例原型", done: value, auto_done: false })) }] }],
    groups: [{ parent_id: "demo-product", title: "做一個有用的小工具", subtitle: "先驗證能否找回筆記", done_milestones: done, total_milestones: 2,
      goals: [{ id: "demo-build", title: "完成紙飛機筆記原型", target: "完成一次搜尋體驗測試", goal_type: "sprint", type_badge: "短期專案", progress_type: "milestone", current: `${done}/2`, metric: null,
        milestones: state.milestones.map((value, i) => ({ text: i ? "完成搜尋體驗測試" : "建立範例原型", done: value, auto_done: false, is_current_month: true })),
        milestone_done_count: done, milestone_total_count: 2, open_todos: state.todos.filter(t => t.goal_id === "demo-build" && !t.done).map(t => t.text), done_todos: state.todos.filter(t => t.goal_id === "demo-build" && t.done).map(t => t.text), week_hours: 7, note: "完全虛構的目標範例。" }] }],
    paused_groups: [], uncategorized: [], total_active_goals: 1,
  }
}

export function focus(days: number): FocusData {
  return { days, period_label: `合成範例 · ${days} 天視窗（固定樣本）`, overall: { available: true, period_key: WEEK, headline: "先把原型交到使用者手上", n_threads: 2, narrative: "這組虛構資料展示投入如何連到目標，不代表任何真實活動。" },
    kpis: { total_active_hhmm: "12h 00m", total_active_min: 720, linked_hhmm: "7h 00m", linked_min: 420, linked_pct: "58%", orphan_hhmm: "5h 00m", orphan_min: 300, stale_goals_count: 0 },
    rows: [{ goal_category: "輸出", active_hhmm: "7h 00m", active_min: 420, share_pct: "58%", session_count: 5, goals_updated: 1, goals_total: 1,
      sub_buckets: [{ time_category: "輸出", active_hhmm: "7h 00m", active_min: 420, share_pct: "58%", session_count: 5, top_session_text: "搜尋原型" }], hint: null, top_session_text: "搜尋原型", top_session_category: "輸出", goals: [{ id: "demo-build", title: "完成紙飛機筆記原型", category: "輸出", target: "完成體驗測試", current: "原型備妥", progress_type: "milestone", is_updated: true }] }],
    orphan_time: [{ category: "學習與研究", active_hhmm: "5h 00m", active_min: 300, share_pct: "42%", sessions: 4 }], stale_goals: [] }
}

export function timeData(period: TimePeriod): TimeData {
  const rows = ["2026-08-24", "2026-08-31", "2026-09-07", "2026-09-14"].map((week_start, i) => ({ week_start, label: `${i + 1} 週`, agents: { demo: { output_tokens: (i + 1) * 120000, cost_usd: null } }, output_tokens: (i + 1) * 120000, cost_usd: null, turns: 20 + i * 5, active_hours: 6 + i * 2, is_current: i === 3, truncated_agents: [], unknown_agents: [] }))
  return { period, period_label: `合成範例 · ${period === "4w" ? "四週" : period === "last_week" ? "上週" : "本週"}`, cycle_caption: "固定合成樣本", as_of_note: "期間按鈕僅切換展示視窗；下方摘要使用同一組虛構樣本。",
    snapshot: { age_label: "合成範例", is_stale: false, missing: false },
    kpis: { output: { label: "輸出 token", value: "0.48M", delta: "合成數字", sub: null }, cost: { label: "成本", value: "—", sub: "未提供", caveat: "未連接帳單" }, sessions: { label: "Sessions", value: "9", delta: "合成活動" }, active_hours: { label: "活動時數", value: "12h", sub: "示範時數" } },
    verdict: { available: false, tone: "mute", text: "" }, summary_lines: ["範例顯示原型開發、閱讀及研究三類活動。"],
    weekly_trend: { available: true, agents: [{ key: "demo", label: "範例 Agent" }], rows: period === "4w" ? rows : rows.slice(period === "last_week" ? 2 : 3, period === "last_week" ? 3 : 4), coverage_note: "所有週資料均為手工合成。", hint: "" },
    worth_rows: [], narrative_state: { available: true, period_key: WEEK, source_window: "2026-09-14_2026-09-20", window_note: "固定範例週", hint: "" },
    activity_blocks: [{ category: "輸出", hours: 7, session_count: 5, sub_breakdown: "原型與測試", narrative: "完成紙飛機筆記的搜尋流程。", fallback_bullets: [] }, { category: "學習", hours: 3, session_count: 2, sub_breakdown: "閱讀", narrative: "把兩篇虛構閱讀材料整理成摘要。", fallback_bullets: [] }],
    agent_rows: [{ agent: "demo", agent_label: "範例 Agent", session_count: 9, active_hhmm: "12h", median_min: 45, output_m: 0.48, longest_min: 100, longest_topic: "紙飛機搜尋原型" }],
    category_rows: [{ category: "輸出", active_hhmm: "7h", active_hours: 7, share_pct: "58%", commits: 4, cloud_sessions: 0, cloud_commits: 0 }, { category: "學習", active_hhmm: "3h", active_hours: 3, share_pct: "25%", commits: 1, cloud_sessions: 0, cloud_commits: 0 }, { category: "投資", active_hhmm: "2h", active_hours: 2, share_pct: "17%", commits: 1, cloud_sessions: 0, cloud_commits: 0 }],
    daily_active: ["2026-09-14", "2026-09-16", "2026-09-18"].flatMap(date => [{ date, category: "輸出", minutes: 140 }, { date, category: "學習", minutes: 60 }, { date, category: "投資", minutes: 40 }]),
    daily_models: ["2026-09-14", "2026-09-16", "2026-09-18"].map(date => ({ date, model: "範例模型", out_m: 0.16 })),
    top_sessions: [{ date: "2026-09-18", agent: "demo", category: "輸出", active_hhmm: "1h 40m", topic: "紙飛機搜尋原型", session_id: "demo-session-1" }],
  }
}

export const ideal: IdealData = {
  kpis: { total_cards: 2, exploring: 1, validated: 1, high_fit: 1 }, source_snapshot: {}, themes: ["筆記", "閱讀"], status_labels: { exploring: "探索中", validated: "已驗證" }, goal_fit_labels: { high: "高關聯", medium: "中關聯" },
  items: [{ id: "demo-idea-1", title: "筆記寫完後找不到", status: "exploring", status_label: "探索中", theme: "筆記", goal_fit: "high", goal_fit_label: "高關聯", problem: "範例使用者記得內容，卻忘記放在哪裡。", user_story: "想從一句關鍵字找到上週筆記。", minimum_execution_unit: "三篇範例筆記與一個搜尋入口", cheapest_test: "請測試者找一篇指定筆記", success_signal: "能在一分鐘內找到", confidence: "待驗證", next_action: "走一次搜尋測試", quantification: [], evidence: [{ note: "虛構研究案例" }] },
    { id: "demo-idea-2", title: "閱讀摘要太長", status: "validated", status_label: "已驗證", theme: "閱讀", goal_fit: "medium", goal_fit_label: "中關聯", problem: "想回顧時需要重讀全文。", user_story: "用三句話找回文章重點。", minimum_execution_unit: "一張摘要卡", cheapest_test: "比較短摘要與原文", success_signal: "能說出核心問題", confidence: "範例已驗證", next_action: "保留簡短格式", quantification: [], evidence: [{ note: "所有驗證描述均為虛構" }] }],
}

export const health: HealthData = {
  goals_status: [{ id: "demo-move", title: "維持活動節奏", sub: "合成範例：本週 4 次", pct: 80, start_label: "0 次", goal_label: "5 次", status_text: "範例進度", status_tone: "ok", note: "非真實健康資料", marker_pct: null, marker_label: "", signed: false }],
  data_gaps: [{ icon: "", text: "全部數字為合成資料，未連接穿戴裝置。" }],
  coach: { week_start: "2026-09-14", intent: "範例週：呈現跑步與力量活動的安排", notes: [{ icon: "", text: "僅展示介面，不提供個人化訓練建議。" }], plan_version: 1, age_days: 0 },
  cards: {
    vo2: { title: "跑步", target_badge: "範例", kpis: [{ label: "本週跑步", value: "2 次" }, { label: "總時間", value: "75 分" }], caption: "虛構跑步紀錄", run_mix_caption: "範例強度分布", intensity_mix: { low_pct: 80, mid_pct: 20, high_pct: 0, calibrated: false, total_min: 75 }, runs_table: [{ date: "09-16", kind: "輕鬆跑", duration: "40 分", pace: "6:40", hr: "135", z2_endurance: "—", drift: "—" }, { date: "09-19", kind: "輕鬆跑", duration: "35 分", pace: "6:45", hr: "132", z2_endurance: "—", drift: "—" }] },
    body: { title: "身體趨勢", target_badge: "範例", kpis: [{ label: "體重", value: "70 kg" }, { label: "體脂", value: "20%" }], caption: "僅用於顯示圖表", gap_parts: [], projection_text: "不由範例資料推估健康結果。", trends_table: [{ metric: "體重", m1: "穩定", m3: "穩定" }] },
    pullup: { title: "引體向上", target_badge: "範例", kpis: [{ label: "輔助重量", value: "25 kg" }], caption: "虛構紀錄", best_text: "25 kg 輔助 × 6 下", suggestion: "範例不產生訓練處方", history_points: [{ date: "2026-09-10", assist_kg: 30, max_reps: 6 }, { date: "2026-09-17", assist_kg: 25, max_reps: 6 }], back_count: 2 },
    bench: { title: "臥推", target_badge: "範例", kpis: [{ label: "範例重量", value: "40 kg" }], caption: "虛構紀錄", gap_text: "", best_text: "40 kg × 8 下", history_points: [{ date: "2026-09-10", e1rm: 48, weight: 40, reps: 6 }, { date: "2026-09-17", e1rm: 50.7, weight: 40, reps: 8 }] },
  },
  annual: { kpis: [{ label: "合成活動", value: "120 次" }], month_summary: { this_month: 12, projected: 18, mom_arrow: "→", mom_color: "var(--color-ink-3)", prev_month: 18 }, monthly_table: [{ month: "8 月", count: 18, per_week: "4", vs_goal: "範例", runs: 10, strength: 8, hours: "12" }, { month: "9 月", count: 12, per_week: "4", vs_goal: "範例", runs: 6, strength: 6, hours: "8" }] },
  recovery: { data_date: DATE, hrv_status: "範例狀態", sample_nights: "7", sleep_7d_avg: "7.5 小時", readiness_score: "—", action: "僅供展示", action_level: "info", reasons: ["無真實感測來源"], caveat: "不能用作健康判斷" },
  charts: { weekly_body: ["2026-08-31", "2026-09-07", "2026-09-14"].map((week_start, i) => ({ week_start, weight: 70.4 - i * 0.2, body_fat: 20.4 - i * 0.2, lean_mass: 55.9 })), weekly_parts: ["2026-08-31", "2026-09-07", "2026-09-14"].map(week_start => ({ week_start, chest: 1, back: 1, legs: 1, running: 2, other: 0 })) },
  running_annual: { total_km: 180, runs_n: 30, avg_km_per_run: 6, avg_pace_str: "6:40", avg_hr_val: 135, longest_km: 10, total_hours: 20, peak_hr: 160, monthly_trend: [{ ym: "2026-07", km: 55, runs: 9, pace_min: 6.8 }, { ym: "2026-08", km: 65, runs: 11, pace_min: 6.7 }, { ym: "2026-09", km: 60, runs: 10, pace_min: 6.6 }] },
  history: { strength_log: [{ date: "2026-09-17", exercise: "臥推（虛構）", set_number: 1, weight_kg: 40, assist_kg: null, reps: 8, rpe: null, slow_negative: false, notes: "合成範例" }], pullup_assist_trend: [{ date: "2026-09-10", assist_kg: 30, max_reps: 6 }, { date: "2026-09-17", assist_kg: 25, max_reps: 6 }] },
}

const source = { id: investmentScenario.source_id, title: investmentScenario.source_title, date: DATE, generated_at: STAMP, source_cutoff: STAMP, age_days: 0, state: "current" as const, limitations: ["由私人情境規格重新生成，並非市場資訊"], url: null }
const openActionItem: InvestmentActionItem = {
  id: "ai:demo-deliver-questions",
  text: investmentScenario.action,
  status: "open",
  tickers: [investmentScenario.symbol],
  evidence: [investmentScenario.evidence_to_check],
  artifact_id: investmentScenario.source_id,
  source: "daily-brief",
  date: DATE,
}
const homeActionItem: InvestmentActionItem = {
  id: "ai:demo-canonical-home",
  text: "把交付證據門檻寫進判斷頁後再決定是否改變假設。",
  status: "has-canonical-home",
  tickers: [investmentScenario.symbol],
  evidence: ["判斷頁已有交付問題"],
  artifact_id: "demo-thesis-page",
  source: "thesis-page",
  date: "2026-09-18",
}
const closedActionItem: InvestmentActionItem = {
  id: "ai:demo-closed-prior",
  text: "先前已記錄：不因單一產品發布改動持倉。",
  status: "closed",
  tickers: [investmentScenario.symbol],
  evidence: ["synthetic/investment-research-loop-v1"],
  artifact_id: investmentScenario.source_id,
  source: "decision-review",
  date: "2026-09-13",
}
export const investment: InvestmentData = {
  as_of: STAMP,
  brief: { state: "current", date: DATE, generated_at: STAMP, source_cutoff: STAMP, session: null,
    headline: investmentScenario.headline,
    market_pulse: [{ variable: investmentScenario.market_index.label, latest: `${investmentScenario.market_index.value.toLocaleString()} · +${investmentScenario.market_index.change_percent}%`, meaning: investmentScenario.market_index.meaning }], market_pulse_notes: [],
    events: [{ event: investmentScenario.event_text, market_reaction: investmentScenario.market_reaction, interpretation: investmentScenario.interpretation, impact: "新增待查證事項", today: `先讀${investmentScenario.next_check}說明` }], event_notes: [],
    thesis_changes: [{ thesis: investmentScenario.thesis, event_ref: "範例事件", event_index: 0, change: investmentScenario.thesis_change, reason: investmentScenario.thesis_reason }], thesis_notes: [],
    upcoming: [{ date_label: investmentScenario.next_check_date.slice(5).replace("-", "/"), event: investmentScenario.upcoming_event, check: investmentScenario.evidence_to_check }], upcoming_notes: [], actions: [investmentScenario.action],
    action_items: [openActionItem],
    envelope: {
      artifact: "daily-brief",
      id: investmentScenario.source_id,
      as_of: DATE,
      generated_at: STAMP,
      source_cutoff: STAMP,
      producer: "synthetic-demo",
      completeness: "ready",
      limitations: [],
    },
    risks: [{ risk: investmentScenario.risk, event_ref: "範例事件", event_index: 0, status: investmentScenario.risk_status }], risk_notes: [], source },
  weekly_watch: { state: "missing", date: null, source: null }, conditions: { state: "not_connected", message: "展示版未連接交易、帳戶或研究來源。" }, sources: [source],
}

export const investmentActions: InvestmentActions = {
  as_of: STAMP,
  state: "ready",
  message: "",
  limitations: [],
  items: [openActionItem, homeActionItem, closedActionItem],
  counts: { open: 1, has_canonical_home: 1, closed: 1 },
}

function exploreItem(partial: Partial<MarketExploreItem> & Pick<MarketExploreItem, "symbol" | "label">): MarketExploreItem {
  return {
    change_1d_pct: null, change_7d_pct: null, activity: { label: null, value: null },
    rsi14: null, vs_50ma_pct: null, rs_benchmark_1m_pp: null, rs_benchmark_window: null,
    researched: false, ...partial,
  }
}

export const marketExplore: MarketExplore = {
  fetched_at: STAMP,
  cached: true,
  state: "partial",
  message: "美股僅部分標的通過流動性門檻。",
  note: "市場線索，不是持倉強弱，也不是交易建議。",
  markets: [
    {
      market: "tw", artifact: "market-explore-tw", id: "demo-explore-tw", as_of: DATE,
      generated_at: STAMP, source_cutoff: STAMP, producer: "synthetic-demo", state: "ready",
      limitations: [], universe_size: 50,
      buckets: [
        {
          key: "fast", label: "漲得快", method: "1 日漲幅，並附 7 日對照",
          items: [
            exploreItem({ symbol: "ISLE-A", label: "島嶼設備甲", change_1d_pct: 8.2, change_7d_pct: 12.1 }),
            exploreItem({ symbol: "ISLE-B", label: "島嶼設備乙", change_1d_pct: 6.4, change_7d_pct: 4.0, researched: true }),
            exploreItem({ symbol: "ISLE-C", label: "島嶼設備丙", change_1d_pct: 5.1, change_7d_pct: null }),
          ],
        },
        {
          key: "active", label: "量能熱", method: "相對成交量，不是周轉率",
          items: [
            exploreItem({ symbol: "HARBOR-1", label: "港灣材料", change_1d_pct: 2.4, activity: { label: "相對成交量", value: 3.2 } }),
            exploreItem({ symbol: "HARBOR-2", label: "港灣零件", change_1d_pct: 1.1, activity: { label: "相對成交量", value: 2.1 } }),
          ],
        },
        {
          key: "sustained", label: "持續強", method: "相對範例指數 1 個月超額",
          items: [
            exploreItem({ symbol: "RIDGE-1", label: "山脊儲能", vs_50ma_pct: 8.5, rs_benchmark_1m_pp: 6.2, rs_benchmark_window: "1M vs 範例指數", rsi14: 62 }),
          ],
        },
      ],
    },
    {
      market: "us", artifact: "market-explore-us", id: "demo-explore-us", as_of: DATE,
      generated_at: STAMP, source_cutoff: STAMP, producer: "synthetic-demo", state: "partial",
      limitations: ["2/20 通過門檻"], universe_size: 20,
      buckets: [
        { key: "fast", label: "漲得快", method: "1 日漲幅，並附 7 日對照", items: [] },
        { key: "active", label: "量能熱", method: "相對成交量，不是周轉率", items: [] },
        { key: "sustained", label: "持續強", method: "相對範例指數 1 個月超額", items: [] },
      ],
    },
  ],
}

export const investmentHistory: InvestmentHistory = {
  state: "ready",
  coverage: {
    allowed_sources: [{ id: investmentScenario.source_id, path: investmentScenario.source_path, kind: "synthetic_story" }],
    available_sources: [{ id: investmentScenario.source_id, path: investmentScenario.source_path, kind: "synthetic_story", bytes: investmentScenario.source_text.length, items: investmentScenario.history.length }],
    missing_sources: [],
    items: investmentScenario.history.length,
    errors: [],
  },
  items: [...investmentScenario.history],
}

export const investmentHistorySources: Record<string, InvestmentHistorySource> = Object.fromEntries(
  investmentScenario.history.map((item) => [item.id, { ...item, text: item.detail }]),
) as Record<string, InvestmentHistorySource>

export const investmentContext: InvestmentContext = {
  schema_version: 1,
  read_only: true,
  task: { slug: investmentScenario.context.task_slug, path: "synthetic/context/investment-research-loop-v1" },
  scope: { mode: "synthetic_task_and_declared_evidence", max_files: 4, files_read: ["synthetic/context/investment-research-loop-v1", investmentScenario.source_path], excluded: ["private vault", "credentials", "network"] },
  current_state: { status: investmentScenario.context.status, next_action: investmentScenario.context.next_action, last_session: investmentScenario.context.updated_at },
  requirements: [{ section: "研究問題", line_start: 1, line_end: 1, text: investmentScenario.problem, truncated: false, source: { path: investmentScenario.source_path, root: "synthetic", line_start: 1, line_end: 1 } }],
  decisions: [
    ...investmentScenario.context.approved.map((text, index) => ({ kind: "approved" as const, section: "已核可方向", line_start: index + 1, line_end: index + 1, text, truncated: false, source: { path: "synthetic/context/investment-research-loop-v1", root: "synthetic", line_start: index + 1, line_end: index + 1 } })),
    ...investmentScenario.context.rejected.map((text, index) => ({ kind: "rejected" as const, section: "已否決方向", line_start: index + 1, line_end: index + 1, text, truncated: false, source: { path: "synthetic/context/investment-research-loop-v1", root: "synthetic", line_start: index + 1, line_end: index + 1 } })),
  ],
  evidence: investmentScenario.context.evidence.map((item) => ({ ...item, truncated: false, source: { path: item.path, root: "synthetic", line_start: item.line_start, line_end: item.line_end } })),
  warnings: ["這是合成 Context；沒有連接私人 vault 或外部工具。"],
}

export const market: InvestmentMarket = { fetched_at: STAMP, state: "ready", cached: true, active: false,
  items: [{ symbol: investmentScenario.symbol, label: investmentScenario.market_index.label, code: investmentScenario.symbol, value: investmentScenario.market_index.value, unit: "點", change: investmentScenario.market_index.change, change_percent: investmentScenario.market_index.change_percent, quoted_at: STAMP, session: "closed", state: "available", error: null, source_url: "#demo-source" }] }
export const universe: MomentumUniverse = { state: "ready", symbols: [investmentScenario.symbol], label: "虛構標的", note: `${investmentScenario.symbol} 為展示代號，沒有真實持倉。`, source: "合成資料", excluded_count: 0 }
export const quote: StockQuote = { symbol: investmentScenario.symbol, label: investmentScenario.label, value: investmentScenario.price.value, unit: "範例幣", change: investmentScenario.price.change, change_percent: investmentScenario.price.change_percent, quoted_at: STAMP, session: "closed", state: "available", error: null, source_url: "#demo-source", fetched_at: STAMP, cached: true }
export const momentum: StockMomentumData = { symbol: investmentScenario.symbol, fetched_at: STAMP, cached: true, state: "ready",
  daily: { state: "available", as_of: DATE, last_close: 42, rsi14: 55, macd: "flat", return_20d_pct: 4.8, vs_5ma_pct: 1.2, vs_20ma_pct: 2.6, vs_50ma_pct: 2, range_252_low: 30, range_252_high: 50, range_252_position_pct: 60, distance_high_pct: -16, observations: 252, notes: ["所有指標均為合成數字"] },
  premarket: { state: "unavailable", price: null, change_percent: null, quoted_at: null, note: "範例未提供盤前資料" }, source_url: "#demo-source" }
export const leaders: MomentumLeaders = { state: "ready", as_of: DATE, universe,
  coverage: { candidate_count: 3, scored_count: 3, unavailable_count: 0 },
  note: "強勢＝最近 20 個完整交易日報酬為正，且收盤在 20／50 日線上方；這是合成研究清單，不是全市場掃描。",
  leaders: [
    { symbol: "SYNTH", rank: 1, state: "ready", as_of: DATE, last_close: 42, return_20d_pct: 4.8, vs_5ma_pct: 1.2, vs_20ma_pct: 2.6, vs_50ma_pct: 2, rsi14: 55, macd: "bullish", notes: [] },
    { symbol: "DEMO-B", rank: 2, state: "ready", as_of: DATE, last_close: 88, return_20d_pct: 3.1, vs_5ma_pct: 0.8, vs_20ma_pct: 1.7, vs_50ma_pct: 2.2, rsi14: 62, macd: "bullish_cross", notes: [] },
    { symbol: "DEMO-C", rank: 3, state: "partial", as_of: DATE, last_close: 17, return_20d_pct: 1.4, vs_5ma_pct: -0.2, vs_20ma_pct: 0.9, vs_50ma_pct: 1.1, rsi14: 58, macd: "flat", notes: [] },
  ] }
const watchSource = { path: investmentScenario.source_path, label: "合成研究", section: "待查問題", updated: DATE, source_id: investmentScenario.source_id }
export const watch: InvestmentWatch = { as_of: STAMP,
  coverage: { scope: ["合成範例"], scanned_files: 1, omissions: [], errors: [], missing_catalysts: [] },
  catalysts: [{ id: "demo-catalyst", topic: investmentScenario.label, label: investmentScenario.next_check, raw: `${investmentScenario.next_check_date}（合成日期）`, date: investmentScenario.next_check_date.slice(0, 7), date_precision: "month", estimated: true, bucket: "undated", source: watchSource }],
  research: [{ id: "demo-research", topic: investmentScenario.label, title: investmentScenario.research_title, status: "觀察", purpose: "整理待查問題", excerpt: investmentScenario.research_excerpt, session_refs: [], source: watchSource }], session_followups: [] }
const block = { source: "合成資料", note: "展示案例", state: "ready" as const, message: "", limitations: ["未呼叫外部工具"] }
export const pending: InvestmentPending = { as_of: STAMP, scope: "全合成展示",
  revisit: { ...block, title: "待回顧", groups: [{ ticker: investmentScenario.symbol, label: investmentScenario.label, overdue_days: 0, items: [{ decision: investmentScenario.question, ticker: investmentScenario.symbol, horizon: 7, due: DATE, overdue_days: 0, status: "待查", candidate_runs: [] }] }], counts: { due_unmarked: 1, groups: 1 } },
  gate: { ...block, title: "待決定", items: [], counts: { registered: 0, due: 0, later: 0 } },
  weekly: { ...block, title: "範例週回顧", date: DATE, path: "synthetic/weekly", age_days: 0, alerts: [], action_items: [{ text: "整理兩個產品交付問題", done: false, detail: ["全合成案例"] }] } }
