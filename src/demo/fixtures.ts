/** Synthetic showcase fixture; never generated from a real API or private vault. */
import type { Cockpit, FocusData, GoalsData, HealthData, Home, IdealData, TimeData, TimePeriod, TodosData } from "../lib/api"
import type { TwRelativeStrength, InvestmentActionItem, InvestmentActions, InvestmentContext, InvestmentData, InvestmentHistory, InvestmentHistoryDetail, InvestmentHistoryItem, InvestmentMarket, InvestmentMarketPulse, InvestmentMarketObservation, InvestmentNarrative, InvestmentNarrativeDirectionalSignal, InvestmentNarrativeEvidenceLayer, InvestmentNarrativeSource, InvestmentNarrativeThesisEvidence, InvestmentPending, InvestmentResearch, InvestmentResearchDetail, InvestmentWatch, InvestmentWork, MarketExplore, MarketExploreItem, MomentumLeaders, MomentumUniverse, RelativeStrength, StockMomentumData, StockQuote } from "../lib/investment"
import { investmentScenario } from "./generated/investment-scenario.ts"

export const DATE = investmentScenario.as_of
export const STAMP = `${DATE}T12:00:00+08:00`
const PREVIOUS_DATE = new Date(Date.parse(`${DATE}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
const NEXT_DATE = new Date(Date.parse(`${DATE}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
const BRIEF_GENERATED_AT = `${DATE}T21:30:00+08:00`
const BRIEF_SOURCE_CUTOFF = `${DATE}T21:15:00+08:00`
const UPDATE_OBSERVED_AT = `${NEXT_DATE}T00:27:00+08:00`
const syntheticFormalMarketObservation: InvestmentMarketObservation = {
  information_kind: "market_observation", market: "us", event: "合成正式簡報市場讀數",
  observation_value: "虛構基準讀數 0.4%", source_published_at: "2026-09-24T01:07:00Z",
  source_category: "synthetic", is_price_or_proxy_observation: true,
  source: { path: "synthetic/market-observation.md", at: "2026-09-24T01:07:00Z", source_cutoff: "2026-09-24T01:07:00Z" },
}
const syntheticIntradayMarketObservation: InvestmentMarketObservation = {
  information_kind: "market_observation", market: "us", event: "合成盤中增量市場讀數",
  observation_value: "虛構增量讀數 1.1%", source_published_at: "2026-09-24T01:07:00Z",
  source_category: "synthetic", is_price_or_proxy_observation: true,
  source_path: "synthetic/intraday-market-observation.md",
}
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
/** Shared in-memory state for the selected synthetic Investment provider. */
export const demoWorkState = createState()
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
    ccstory_mcp: { available: false, error: "展示模式不連接 CCStory；沒有用量快照。", recap: null, trend: null, comparison: null },
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

const source = { id: investmentScenario.source_id, title: investmentScenario.source_title, date: DATE, generated_at: BRIEF_GENERATED_AT, source_cutoff: BRIEF_SOURCE_CUTOFF, age_days: 0, state: "current" as const, limitations: ["由私人情境規格重新生成，並非市場資訊"], url: null }
const openActionItem: InvestmentActionItem = {
  id: "ai:demo-deliver-questions",
  text: investmentScenario.action,
  status: "open",
  kind: "watch",
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
  as_of: UPDATE_OBSERVED_AT,
  today: {
    state: "ready",
    decision_summary: "今天不需要因這則新訊號調整部位。",
    decision_summary_date: DATE,
    limitations: [],
    intraday_refresh: {
      schema_version: "1.0",
      markets: {
        tw: {
          state: "no_material_update", freshness: "fresh", baseline_cutoff: BRIEF_SOURCE_CUTOFF,
          input_cutoff: BRIEF_SOURCE_CUTOFF, last_successful_cutoff: "2026-09-24T01:05:00Z",
          last_successful_refresh: { market: "tw", started_at: "2026-09-24T01:00:00Z", finished_at: "2026-09-24T01:05:00Z", baseline_cutoff_at: BRIEF_SOURCE_CUTOFF, input_cutoff: BRIEF_SOURCE_CUTOFF, source_cutoff: "2026-09-24T01:04:00Z", output_cutoff: "2026-09-24T01:04:00Z", baseline_path: "synthetic/brief.md", baseline_artifact_sha256: "synthetic-baseline-revision", discovery_scope: ["post_cutoff_news"], stop_stage: "L1", calls: { discovery: 2, verification: 0 }, candidate_count: 0, updated_story_ids: [], story_statuses: [], result: "no_material_update", coverage_state: "complete", limitations: [] },
          latest_receipt: { market: "tw", started_at: "2026-09-24T01:00:00Z", finished_at: "2026-09-24T01:05:00Z", baseline_cutoff_at: BRIEF_SOURCE_CUTOFF, input_cutoff: BRIEF_SOURCE_CUTOFF, source_cutoff: "2026-09-24T01:04:00Z", output_cutoff: "2026-09-24T01:04:00Z", baseline_path: "synthetic/brief.md", baseline_artifact_sha256: "synthetic-baseline-revision", discovery_scope: ["post_cutoff_news"], stop_stage: "L1", calls: { discovery: 2, verification: 0 }, candidate_count: 0, updated_story_ids: [], story_statuses: [], result: "no_material_update", coverage_state: "complete", limitations: [] },
          story_states: [], limitations: [],
        },
        us: {
          state: "partial", freshness: "stale", baseline_cutoff: "2026-09-23T21:00:00Z",
          input_cutoff: "2026-09-24T01:05:00Z", last_successful_cutoff: "2026-09-24T01:04:00Z",
          last_successful_refresh: { market: "us", started_at: "2026-09-24T01:00:00Z", finished_at: "2026-09-24T01:05:00Z", baseline_cutoff_at: "2026-09-23T21:00:00Z", input_cutoff: "2026-09-23T21:00:00Z", source_cutoff: "2026-09-24T01:04:00Z", output_cutoff: "2026-09-24T01:04:00Z", calls: { discovery: 2, verification: 0 }, candidate_count: 0, updated_story_ids: [], story_statuses: [], result: "no_material_update", coverage_state: "complete", limitations: [] },
          latest_receipt: { market: "us", started_at: "2026-09-24T01:06:00Z", finished_at: "2026-09-24T01:08:00Z", baseline_cutoff_at: "2026-09-23T21:00:00Z", input_cutoff: "2026-09-24T01:04:00Z", source_cutoff: "2026-09-24T01:07:00Z", output_cutoff: null, stop_stage: "L1", calls: { discovery: 4, verification: 0 }, candidate_count: 0, updated_story_ids: [], story_statuses: [], market_observations: [syntheticIntradayMarketObservation], result: "partial", coverage_state: "partial", limitations: ["合成情境：本次覆蓋不完整，未推進成功截止。"] },
          story_states: [], limitations: ["合成情境：以最近一次成功 cutoff 為增量基準。"],
        },
      },
      timeline_updates: [], updates: [],
      market_observations: [syntheticIntradayMarketObservation],
      limitations: ["展示用合成回執；沒有連接外部來源。"],
    },
    updates: [{
      id: "news:demo-intraday-1",
      story_id: "demo-storage-event",
      observed_at: UPDATE_OBSERVED_AT,
      summary: "隔夜價格反應確認前一版事件有被市場交易，但幅度仍不足以改變原判斷。",
      portfolio_impact: "原本的核心假設不變；這次更新只提高對後續量能確認的優先級。",
      action: "收盤前再看一次量能是否延續，不因單一盤中波動追價。",
      relevance: ["new-price-discovery", "action-watch-change"],
      source_path: `wiki/morning/${DATE}_news.md`,
    }],
  },
  brief: { state: "current", date: DATE, generated_at: BRIEF_GENERATED_AT, source_cutoff: BRIEF_SOURCE_CUTOFF, session: "us-open-prep",
    headline: investmentScenario.headline,
    market_pulse: [{ variable: investmentScenario.market_index.label, latest: `${investmentScenario.market_index.value.toLocaleString()} · +${investmentScenario.market_index.change_percent}%`, meaning: investmentScenario.market_index.meaning }], market_pulse_notes: [],
    events: [{ story_id: "demo-storage-event", event: investmentScenario.event_text, market_reaction: investmentScenario.market_reaction, interpretation: investmentScenario.interpretation, impact: "新增待查證事項", today: `先讀${investmentScenario.next_check}說明` }], event_notes: [],
    thesis_changes: [{ thesis: investmentScenario.thesis, event_ref: "範例事件", event_index: 0, change: investmentScenario.thesis_change, reason: investmentScenario.thesis_reason }], thesis_notes: [],
    upcoming: [{ date_label: investmentScenario.next_check_date.slice(5).replace("-", "/"), event: investmentScenario.upcoming_event, check: investmentScenario.evidence_to_check }], upcoming_notes: [], actions: [investmentScenario.action],
    action_items: [openActionItem],
    judgment: {
      class: "watch",
      judgment: investmentScenario.action,
      why_now: "合成示例：此判斷與下一步來自同一個來源段落。",
      revisit: "收到下一次合成資料後",
      decision_effect: "只有來源更新時才重新檢視。",
      provenance: null,
      same_action_id: openActionItem.id,
    },
    envelope: {
      artifact: "daily-brief",
      id: investmentScenario.source_id,
      as_of: DATE,
      generated_at: BRIEF_GENERATED_AT,
      source_cutoff: BRIEF_SOURCE_CUTOFF,
      producer: "synthetic-demo",
      completeness: "ready",
      limitations: [],
    },
    risks: [{ risk: investmentScenario.risk, event_ref: "範例事件", event_index: 0, status: investmentScenario.risk_status }], risk_notes: [], source },
  weekly_watch: { state: "missing", date: null, source: null }, conditions: { state: "not_connected", message: "展示版未連接交易、帳戶或研究來源。" }, sources: [source],
}

const demoEvidenceSource: InvestmentNarrativeSource = {
  path: "demo/synthetic-scorecard.md",
  line: 1,
  label: "合成範例",
}
const demoSupportSignalSource: InvestmentNarrativeSource = {
  path: "demo/synthetic-support-signal.md",
  line: 8,
  label: "合成支持訊號",
}
const demoChallengeSignalSource: InvestmentNarrativeSource = {
  path: "demo/synthetic-challenge-signal.md",
  line: 15,
  label: "合成挑戰訊號",
}

const demoEvidenceLayers: InvestmentNarrativeEvidenceLayer[] = [
  {
    opposing_coverage: { state: "insufficient", checked_at: DATE, scope: "虛構案例的兩份公開文件", reason: "此合成示例只檢查兩份文件，尚不足以確認反方涵蓋。", source: { path: "synthetic/coverage.md", line: 1 } },
    layer_id: "L0", pillar_id: "l0_hardware", label: "硬體供應",
    who_earns: "合成硬體供應商", evidence_examples: "例如：已出貨的設備數量",
    what_it_proves: "只說明硬體需求已反映在出貨，不代表下游已獲利。", direction_state: "supports",
    link_state: "linked", state: "ready",
    current_reading: {
      state: "partial", text: "合成層的目前認知。", as_of: "2026-09-27", basis: "合成依據（2026-09-20）",
      authored_by: "ai_scorecard", layer_revision: "0123456789abcdef", current_layer_revision: "0123456789abcdef",
      limitations: ["合成案例示範 partial reading 仍可直接閱讀。"], source: demoEvidenceSource,
    },
    gaps: [{
      gap_id: "gap-synthetic", pillar_id: "l0_hardware", missing: "合成缺口", closes_when: "合成季報",
      expected_by: "2026-10", expected_by_precision: "month", overdue: false, state: "ready", source: demoEvidenceSource,
    }],
    players: [{
      entity_id: "synthetic-hardware-provider", player: "合成硬體供應商甲",
      recorded_at: "2026-09-19", source: demoEvidenceSource,
    }],
    evidence: [{
      evidence_id: "synthetic-hardware-shipment", pillar_id: "l0_hardware",
      entity_id: "synthetic-hardware-provider", player: "合成硬體供應商甲",
      evidence_type: "unknown", entity_ticker: null, numeric_state: "unknown", numeric_value: null, unit: null,
      source_date: "2026-09-18",
      evidence_date: "2026-09-18", source_type: "public_research",
      source_url: "https://example.com/synthetic/hardware-shipment", polarity: "supports",
      explanation: "合成示例：已出貨容量增加，支持硬體需求正在實現；不能單獨證明下游獲利。",
      as_of: "2026-09-19", recorded_at: "2026-09-20", freshness: "current",
      valid_until: "2026-12-31", state: "ready", limitations: [], source: demoSupportSignalSource,
    }],
    supporting: [{
      evidence_id: "synthetic-hardware-shipment", pillar_id: "l0_hardware",
      entity_id: "synthetic-hardware-provider", player: "Synthetic hardware provider",
      evidence_type: "unknown", entity_ticker: null, numeric_state: "unknown", numeric_value: null, unit: null,
      source_date: "2026-09-18",
      evidence_date: "2026-09-18", source_type: "public_research",
      source_url: "https://example.com/synthetic/hardware-shipment", polarity: "supports",
      explanation: "合成示例：已出貨容量增加，支持硬體需求正在實現；不能單獨證明下游獲利。",
      as_of: "2026-09-19", recorded_at: "2026-09-20", freshness: "current",
      valid_until: "2026-12-31", state: "ready", limitations: [], source: demoSupportSignalSource,
    }],
    opposing: [], unknown: [], conflicts: [], unlinked_evidence: [], unlinked_players: [],
    limitations: [], unknown_reason: null, source_date: null,
    document_updated: "2026-09-20", source: demoEvidenceSource,
  },
  {
    layer_id: "L1", pillar_id: "l1_cloud", label: "雲端算力",
    who_earns: "合成雲端服務商", evidence_examples: "例如：客戶付費使用的算力",
    what_it_proves: "只說明雲端工作負載的使用情況。", direction_state: "unknown",
    link_state: "unlinked", state: "unknown", players: [{
      entity_id: "synthetic-cloud-operator", player: "合成雲端服務商甲",
      recorded_at: "2026-09-19", source: demoEvidenceSource,
    }],
    evidence: [], supporting: [], opposing: [], unknown: [], conflicts: [],
    unlinked_evidence: [],
    unlinked_players: [{
      pillar_id: "l1_cloud", entity_id: "TICKER", player: "合成雲端服務商",
      recorded_at: "2026-09-19", state: "unlinked",
      limitations: ["合成例：玩家 ID 不符合穩定識別格式。"], source: demoEvidenceSource,
    }],
    limitations: ["此層已有明確玩家關係，但尚無明確連結的日期化公開證據。"],
    unknown_reason: "已記錄這一層的參與者，但沒有明確連結的公開證據。",
    source_date: null, document_updated: "2026-09-20", source: demoEvidenceSource,
  },
  {
    layer_id: "L2", pillar_id: "l2_models", label: "基礎模型",
    who_earns: "合成模型服務商", evidence_examples: "例如：持續付費使用模型",
    what_it_proves: "只說明模型需求，不單獨證明服務商有獲利。", direction_state: "challenges",
    link_state: "linked", state: "stale", players: [{
      entity_id: "synthetic-model-provider", player: "合成模型服務商甲",
      recorded_at: "2026-09-18", source: demoEvidenceSource,
    }],
    evidence: [{
      evidence_id: "synthetic-model-retention", pillar_id: "l2_models",
      entity_id: "synthetic-model-provider", player: "合成模型服務商甲",
      evidence_type: "unknown", entity_ticker: null, numeric_state: "unknown", numeric_value: null, unit: null,
      source_date: "2026-08-30",
      evidence_date: "2026-08-30", source_type: "company_ir",
      source_url: "https://example.com/synthetic/model-retention", polarity: "challenges",
      explanation: "合成示例：付費使用留存下降，挑戰模型需求持續的假設。",
      as_of: "2026-09-01", recorded_at: "2026-09-02", freshness: "stale",
      valid_until: "2026-09-10", state: "stale", limitations: ["來源超過 valid_until"], source: demoChallengeSignalSource,
    }],
    supporting: [],
    opposing: [{
      evidence_id: "synthetic-model-retention", pillar_id: "l2_models",
      entity_id: "synthetic-model-provider", player: "Synthetic model provider",
      evidence_type: "unknown", entity_ticker: null, numeric_state: "unknown", numeric_value: null, unit: null,
      source_date: "2026-08-30",
      evidence_date: "2026-08-30", source_type: "company_ir",
      source_url: "https://example.com/synthetic/model-retention", polarity: "challenges",
      explanation: "合成示例：付費使用留存下降，挑戰模型需求持續的假設。",
      as_of: "2026-09-01", recorded_at: "2026-09-02", freshness: "stale",
      valid_until: "2026-09-10", state: "stale", limitations: ["來源超過 valid_until"], source: demoChallengeSignalSource,
    }],
    unknown: [], conflicts: [], unlinked_evidence: [], unlinked_players: [],
    limitations: ["來源超過 valid_until"], unknown_reason: "來源較舊，需重新確認。",
    source_date: null, document_updated: "2026-09-20", source: demoEvidenceSource,
  },
  {
    layer_id: "L2.5", pillar_id: "l2_5_application_software", label: "應用軟體",
    who_earns: "合成軟體公司", evidence_examples: "例如：持續付費的使用者",
    what_it_proves: "只說明應用有被採用，尚未證明付費留存。", direction_state: "unknown",
    link_state: "linked", state: "unknown", players: [{
      entity_id: "synthetic-app-vendor", player: "合成軟體公司甲",
      recorded_at: "2026-09-19", source: demoEvidenceSource,
    }],
    evidence: [{
      evidence_id: "synthetic-app-adoption", pillar_id: "l2_5_application_software",
      entity_id: "synthetic-app-vendor", player: "合成軟體公司甲",
      evidence_type: "unknown", entity_ticker: null, numeric_state: "unknown", numeric_value: null, unit: null,
      source_date: "2026-09-18",
      evidence_date: "2026-09-18", source_type: "public_research",
      source_url: "https://example.com/synthetic/app-adoption", polarity: "unknown",
      explanation: "合成示例：使用者數據已記錄，但此來源未能判斷付費留存方向。",
      as_of: "2026-09-18", recorded_at: "2026-09-20", freshness: "unknown",
      valid_until: null, state: "unknown", limitations: ["來源新鮮度尚未確認"], source: demoEvidenceSource,
    }],
    supporting: [], opposing: [],
    unknown: [{
      evidence_id: "synthetic-app-adoption", pillar_id: "l2_5_application_software",
      entity_id: "synthetic-app-vendor", player: "合成軟體公司甲",
      evidence_type: "unknown", entity_ticker: null, numeric_state: "unknown", numeric_value: null, unit: null,
      source_date: "2026-09-18",
      evidence_date: "2026-09-18", source_type: "public_research",
      source_url: "https://example.com/synthetic/app-adoption", polarity: "unknown",
      explanation: "合成示例：使用者數據已記錄，但此來源未能判斷付費留存方向。",
      as_of: "2026-09-18", recorded_at: "2026-09-20", freshness: "unknown",
      valid_until: null, state: "unknown", limitations: ["來源新鮮度尚未確認"], source: demoEvidenceSource,
    }],
    conflicts: [], unlinked_evidence: [], unlinked_players: [],
    limitations: ["來源新鮮度尚未確認"], unknown_reason: "來源新鮮度尚未確認；方向仍未知。",
    source_date: null, document_updated: "2026-09-20", source: demoEvidenceSource,
  },
  {
    layer_id: "L3", pillar_id: "l3_end_buyers", label: "終端買方",
    who_earns: "合成企業客戶", evidence_examples: "例如：客戶投資報酬",
    what_it_proves: "只說明客戶是否獲得價值。", direction_state: "unknown",
    link_state: "unlinked", state: "conflict", players: [], evidence: [],
    supporting: [], opposing: [], unknown: [],
    conflicts: [
      {
        pillar_id: "l3_end_buyers", entity_id: "synthetic-end-user", player: "合成買方甲",
        recorded_at: "2026-09-18", state: "conflict",
        limitations: ["同一 pillar/entity_id 對應多個 player 名稱"], source: demoEvidenceSource,
      },
      {
        pillar_id: "l3_end_buyers", entity_id: "synthetic-end-user", player: "合成買方乙",
        recorded_at: "2026-09-18", state: "conflict",
        limitations: ["同一 pillar/entity_id 對應多個 player 名稱"], source: demoChallengeSignalSource,
      },
      {
        evidence_id: "synthetic-duplicate-evidence", pillar_id: "l3_end_buyers",
        entity_id: "synthetic-end-user", player: "合成企業客戶",
        explanation: "合成衝突例：同一證據 ID 出現互相矛盾的內容；未選任一版本。",
        recorded_at: "2026-09-18", state: "conflict",
        limitations: ["相同 evidence_id 對應互相衝突的資料列"], source: demoEvidenceSource,
      },
      {
        evidence_id: "synthetic-duplicate-evidence", pillar_id: "l3_end_buyers",
        entity_id: "synthetic-end-user", player: "合成企業客戶",
        explanation: "合成衝突例：同一證據 ID 出現互相矛盾的內容；未選任一版本。",
        recorded_at: "2026-09-18", state: "conflict",
        limitations: ["相同 evidence_id 對應互相衝突的資料列"], source: demoChallengeSignalSource,
      },
    ],
    unlinked_evidence: [{
      evidence_id: "synthetic-invalid-player-link", pillar_id: "l3_end_buyers",
      entity_id: "TICKER", player: "合成買方", source_url: "https://example.com/synthetic/unlinked",
      state: "unlinked", limitations: ["entity_id 不是穩定小寫 ID"], source: demoEvidenceSource,
    }],
    unlinked_players: [],
    limitations: ["此層存在互相矛盾的玩家識別與證據關聯。"],
    unknown_reason: "合成範例：玩家身份互相衝突；未任選一個。",
    source_date: null, document_updated: "2026-09-20", source: demoEvidenceSource,
  },
]

const demoDirectionalSignals: InvestmentNarrativeDirectionalSignal[] = [
  {
    direction: "supports", layer_id: null, priority: "示範", indicator: "付費使用持續性",
    dispute: "需求能否持續", text: "合成例：付費使用持續增加，支持需求具有持續性。",
    source_channels: "合成資料", source_date: "2026-09-18", document_updated: "2026-09-20", source: demoSupportSignalSource,
  },
  {
    direction: "challenges", layer_id: null, priority: "示範", indicator: "客戶獲得的回報",
    dispute: "終端客戶是否受益", text: "合成例：來源指出客戶獲得的回報偏弱，挑戰終端價值假設。",
    source_channels: "合成資料", source_date: null, document_updated: "2026-09-19", source: demoChallengeSignalSource,
  },
]

const demoThesisEvidence: InvestmentNarrativeThesisEvidence = {
  state: "partial",
  layers: demoEvidenceLayers,
  directional_signals: demoDirectionalSignals,
  unlinked_evidence: [{
    evidence_id: "synthetic-unmapped-evidence", pillar_id: "unmapped_pillar",
    entity_id: "synthetic-unmapped-company", player: "合成公司", evidence_date: "2026-09-18",
    state: "unlinked", limitations: ["pillar_id 不在既定五層內；保留為全域未連結資料。"],
    source: demoEvidenceSource,
  }, {
    evidence_id: "synthetic-invalid-player-link", pillar_id: "l3_end_buyers",
    entity_id: "TICKER", player: "合成買方", source_url: "https://example.com/synthetic/unlinked",
    state: "unlinked", limitations: ["合成回歸：此列雖在頂層陣列重複回傳，但屬 L3，應只在 L3 顯示。"],
    source: demoEvidenceSource,
  }],
  unlinked_players: [{
    pillar_id: "unmapped_pillar", entity_id: "synthetic-unmapped-player",
    player: "合成參與者", recorded_at: "2026-09-18", state: "unlinked",
    limitations: ["pillar_id 不在既定五層內；不猜測對應層級。"], source: demoEvidenceSource,
  }, {
    pillar_id: "l1_cloud", entity_id: "TICKER", player: "合成雲端服務商",
    recorded_at: "2026-09-19", state: "unlinked",
    limitations: ["合成回歸：此列屬 L1，應只在 L1 顯示。"], source: demoEvidenceSource,
  }],
  scorecard_update: {
    updated_at: "2026-09-20",
    status: "evidence_pending_review",
    scope: ["l0_hardware", "l1_cloud", "l2_models", "l2_5_application_software", "l3_end_buyers"],
    document_updated_at: "2026-09-20",
    state: "partial",
    reason: "合成例：覆核與新證據只有日期、沒有時間，先後順序不明。",
    source: demoEvidenceSource,
  },
  latest_recorded_change: {
    date: null, judgment: null, key_evidence: null, later_verification: null,
    state: "unknown", missing: ["展示資料沒有正式的日期化判斷與驗證記錄。"], source: null,
  },
  reason: "合成測試：證據尚未映射到五層，僅示範證據覆蓋狀態。",
}

export const investmentNarrative: InvestmentNarrative = {
  news_events: {
    state: "partial", items: [], retired_items: [],
    market_observations: [syntheticFormalMarketObservation],
    overdue_checkpoints: [{
      story_id: "synthetic-market-reopen", title: "虛構市場重開檢查點", state: "result_pending", result_state: "pending", due_date: "2026-09-23",
      affected_tickers: [], affected_scopes: ["synthetic-market"],
      checks: [{ scope: "synthetic-market", check: "等候虛構來源確認重開結果", state: "registered", result_state: "unknown" }],
      sources: [{ path: "synthetic/checkpoints.md", line: 1, raw: "虛構檢查點；不是實際市場事件。" }],
      limitations: ["合成資料仍待結果。"],
    }],
    limitations: ["展示用合成事件資料。"],
  },
  catalysts_30d: {
    state: "ready", window_start: DATE, window_end: "2026-10-20",
    items: [{ ticker: "DEMO", type: "虛構財報", raw: "2026-10-05 公布虛構公司財報，核對需求是否延續。", date_precision: "day", date: "2026-10-05", date_label: "2026-10-05", source_qualifiers: [], source: { path: "synthetic/catalysts.md", line: 1 }, window_membership: "within" }],
    uncertain_items: [],
    coverage_gaps: [], limitations: [],
  },
  artifact: "personalos-investment-hub",
  schema_version: "1.0",
  id: "investment-hub:demo",
  state: "unavailable",
  as_of: "unknown",
  generated_at: STAMP,
  source_cutoff: "unknown",
  producer: "synthetic-demo",
  limitations: ["展示版沒有連接 Investment Note；不展示或推測個人論點與持倉。"],
  today: { state: "unavailable", baseline: null, limitations: ["沒有合成事件關聯資料。"] },
  narratives: [{
    narrative_id: "ai-infrastructure-economics",
    title: "合成 AI 基礎設施案例",
    status: "unknown",
    updated: null,
    state: "drift",
    state_reason: "合成狀態示例：論點來源關聯互相衝突；僅用來示範 aggregate 狀態優先於證據覆蓋。",
    source: null,
    what_i_bet: {
      state: "unknown",
      narrative: { state: "unknown", text: null, source: null, reason: "沒有已連接的 scorecard。" },
      owner_thesis: { state: "unknown", text: null, source: null, reason: "沒有已連接的 owner thesis。" },
      reason: "展示資料不包含個人論點。",
    },
    current_tension: { state: "unknown", text: null, source: null, reason: "沒有已連接的 scorecard。" },
    thesis_evidence: demoThesisEvidence,
    expressions: { state: "unknown", items: [], reason: "展示資料不包含個人持倉或 thesis links。" },
    latest_change: { state: "unknown", item: null, reason: "展示資料沒有 narrative_id/story_id 關聯。" },
    references: [null, null, null],
  }],
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
      market: "us", artifact: "market-explore-us", id: "demo-explore-us", as_of: PREVIOUS_DATE,
      generated_at: STAMP, source_cutoff: `${PREVIOUS_DATE}T13:00:00+08:00`, producer: "synthetic-demo", state: "partial",
      limitations: ["2/20 通過門檻"], universe_size: 20,
      buckets: [
        { key: "fast", label: "漲得快", method: "1 日漲幅，並附 7 日對照", items: [] },
        { key: "active", label: "量能熱", method: "相對成交量，不是周轉率", items: [] },
        { key: "sustained", label: "持續強", method: "相對範例指數 1 個月超額", items: [] },
      ],
    },
  ],
}

const demoHistoryRow = investmentScenario.history[0]
const investmentHistoryItem: InvestmentHistoryItem = {
  id: `learning:${demoHistoryRow.id}`,
  source_id: demoHistoryRow.id,
  kind: "thesis_learning",
  title: demoHistoryRow.title,
  date: demoHistoryRow.date,
  ticker: null,
  narrative_id: null,
  story_id: null,
  evidence_ids: [],
  decision_id: null,
  outcome_state: "unknown",
  learning_state: "unknown",
  state: "partial",
  missing: ["後續結果尚未記錄，結果保持未知。", "合成來源未提供 learning_role；分類保持未知。"],
  source: {
    path: investmentScenario.source_path,
    line: demoHistoryRow.source.line_start,
    line_end: demoHistoryRow.source.line_end,
    label: "Scorecard 時間線項目（合成）",
  },
  reason: demoHistoryRow.excerpt,
  evidence: null,
  outcome: { text: null, state: "unknown" },
  learning: null,
}
const demoEpisodeRow = investmentScenario.history[2]
const investmentDecisionEpisode: InvestmentHistoryItem = {
  id: `episode:${demoEpisodeRow.id}`,
  source_id: demoEpisodeRow.id,
  kind: "decision_episode",
  title: demoEpisodeRow.title,
  date: demoEpisodeRow.date,
  ticker: null,
  narrative_id: null,
  story_id: null,
  evidence_ids: [],
  decision_id: null,
  outcome_state: "unknown",
  learning_state: "unknown",
  state: "partial",
  missing: ["No recorded checkpoint outcome; outcome is unknown.", "No separate learning field is recorded; learning is unknown."],
  source: { path: investmentScenario.source_path, label: "Decision View sidecar (synthetic)" },
  reason: demoEpisodeRow.excerpt,
  evidence: [{ path: investmentScenario.source_path, line: demoEpisodeRow.source.line_start }],
  outcome: { text: null, state: "unknown" },
  learning: null,
  checkpoints: [{ date: null, what: null, outcome: { text: null, state: "unknown" }, source: null }],
}
const investmentUnindexedHistoryItem: InvestmentHistoryItem = {
  id: null,
  source_id: null,
  kind: "thesis_learning",
  title: "未建立穩定識別的時間線列（合成）",
  date: null,
  ticker: null,
  narrative_id: null,
  story_id: null,
  evidence_ids: [],
  decision_id: null,
  outcome_state: "unknown",
  learning_state: "unknown",
  state: "partial",
  missing: ["source row has no explicit learning_id; detail lookup is unavailable"],
  source: { path: investmentScenario.source_path, line: 9, label: "Scorecard 時間線項目（合成）" },
}

const investmentLinkedHistoryItem: InvestmentHistoryItem = {
  ...investmentDecisionEpisode,
  id: "episode:synthetic-linked-20260901", source_id: "synthetic-linked-20260901",
  title: "範例研究 B：判斷、後續結果與心得", date: "2026-09-01",
  decision_id: "decision:synthetic-episode-20260901", chain_state: "linked",
  reason: "合成案例：先等待需求證據，再評估假設。",
  decision_source: { path: "synthetic/history-chain.md", line: 2, line_end: 2 },
  outcome_state: "recorded", outcome: { state: "recorded", text: null },
  checkpoints: [{ date: "2026-09-08", what: "檢查原先假設", outcome: { state: "recorded", text: "合成案例：後續觀察未支持原先需求假設。" }, source: { path: "synthetic/history-chain.md", line: 4, line_end: 4 }, relation_state: "linked" }],
  learning_state: "recorded", learning_role: "reusable_framework",
  learning: "合成心得：把可檢查的需求證據與假設分開記錄。",
  learning_source: { path: "synthetic/history-chain.md", line: 6, line_end: 6 },
  state: "ready", missing: [], source: { path: "synthetic/history-chain.md", line: 1, line_end: 6 },
}

export const investmentHistory: InvestmentHistory = {
  schema_version: "1.0",
  artifact: "investment-history-index",
  id: "history-index",
  as_of: "unknown",
  generated_at: STAMP,
  source_cutoff: "unknown",
  producer: "tools/history_view.py",
  state: "partial",
  limitations: ["合成歷史沒有共同 source_cutoff；部分紀錄仍缺身份、結果或學習分類。"],
  sources: [investmentScenario.source_path],
  history: { items: [investmentHistoryItem, investmentDecisionEpisode, investmentUnindexedHistoryItem, { ...investmentLinkedHistoryItem, reason: undefined, decision_source: undefined, learning: undefined, learning_source: undefined, checkpoints: undefined }], count: 4 },
}

export const investmentHistorySources: Record<string, InvestmentHistoryDetail> = Object.fromEntries(
  [
    [investmentLinkedHistoryItem.id, { ...investmentHistory, artifact: "investment-history-detail", id: "history-detail:synthetic-linked", state: "ready", limitations: [], history: { item: investmentLinkedHistoryItem, source_text: null } }],
    [investmentHistoryItem.id, {
      schema_version: "1.0",
      artifact: "investment-history-detail",
      id: `history-detail:${investmentHistoryItem.id}`,
      as_of: investmentHistoryItem.date ?? "unknown",
      generated_at: STAMP,
      source_cutoff: "unknown",
      producer: "tools/history_view.py",
      state: "partial",
      limitations: investmentHistoryItem.missing,
      sources: [investmentScenario.source_path],
      history: { item: investmentHistoryItem, source_text: demoHistoryRow.detail },
    }],
    [investmentDecisionEpisode.id, {
      schema_version: "1.0",
      artifact: "investment-history-detail",
      id: `history-detail:${investmentDecisionEpisode.id}`,
      as_of: investmentDecisionEpisode.date ?? "unknown",
      generated_at: STAMP,
      source_cutoff: "unknown",
      producer: "tools/history_view.py",
      state: "partial",
      limitations: investmentDecisionEpisode.missing,
      sources: [investmentScenario.source_path],
      history: { item: investmentDecisionEpisode, source_text: null },
    }],
  ],
) as Record<string, InvestmentHistoryDetail>

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
  items: [
    { symbol: investmentScenario.symbol, market: "tw", label: investmentScenario.market_index.label, code: investmentScenario.symbol, value: investmentScenario.market_index.value, unit: "點", change: investmentScenario.market_index.change, change_percent: investmentScenario.market_index.change_percent, quoted_at: STAMP, session: "closed", state: "available", error: null, source_url: "#demo-source" },
    { symbol: "DEMO-US-INDEX", market: "us", label: "合成美股指數", code: null, value: 5200, unit: "點", change: -18, change_percent: -0.35, quoted_at: `${DATE}T09:30:00-04:00`, session: "regular", state: "available", error: null, source_url: "#demo-source" },
  ] }
const basePulse: InvestmentMarketPulse = {
  as_of: PREVIOUS_DATE, requested_date: DATE, source_dates: { twse: PREVIOUS_DATE, tpex: PREVIOUS_DATE },
  generated_at: STAMP, source_cutoff: `${PREVIOUS_DATE}T13:30:00+08:00`, producer: "synthetic-demo", state: "partial",
  limitations: ["全部數字都是合成展示資料；這份日結統計不是盤中報價。", `合成狀態：要求 ${DATE}，來源只回傳 ${PREVIOUS_DATE}。`],
  index: { label: "合成台股指數", value: 21880, change: 120, change_pct: 0.55, direction_check: { status: "confirmed", as_of: PREVIOUS_DATE } },
  artifact: "tw-market-pulse", id: "synthetic-pulse",
  breadth: { twse: {up: 620, down: 310, flat: 90, limit_up: 12, limit_down: 3}, tpex: {up: 430, down: 210, flat: 60, limit_up: 8, limit_down: 2}, combined: { up: 1050, down: 520, flat: 150, limit_up: 20, limit_down: 5 }, advancer_ratio: 0.61 },
  turnover: { twse_common_stock: 285000000000, tpex_stock: 135000000000, combined_stock: 420_000_000_000 },
  themes: {
    label: "科技鏈熱度（合成關注清單）", source: "SUPPLY_CHAIN",
    strongest: [{ theme: "合成晶圓代工鏈", sample_size: null, limit_up: null, avg_change_pct: 2.1 }, { theme: "合成 AI 伺服器鏈", sample_size: null, limit_up: null, avg_change_pct: 1.6 }],
    weakest: [{ theme: "合成顯示鏈", sample_size: null, limit_up: null, avg_change_pct: -1.2 }],
  },
  flow: { as_of: null, index_close: null, index_change: null, turnover_ntd: null, prev_turnover_ntd: null, avg20_turnover_ntd: null, turnover_vs_prev_pct: null, turnover_vs_avg20_pct: null, institutional: { published: false, status: "not_published", foreign_net_ntd: null, trust_net_ntd: null, dealer_net_ntd: null, total_net_ntd: null, prev_foreign_net_ntd: null }, basis: "合成範例未提供盤後量價。", sources: [], limitations: [] },
}
export const pulseIntegrityScenarios = {
  confirmed: {
    ...basePulse,
    as_of: DATE,
    source_dates: { twse: DATE, tpex: DATE },
    source_cutoff: `${DATE}T13:30:00+08:00`,
    state: "ready",
    limitations: ["全部數字都是合成展示資料；這份日結統計不是盤中報價。"],
    index: { ...basePulse.index, direction_check: { status: "confirmed", as_of: DATE } },
  } satisfies InvestmentMarketPulse,
  needsReview: {
    ...basePulse,
    state: "partial",
    limitations: [...basePulse.limitations, "合成衝突：方向未確認，保留來源數值供查看。"],
    index: {
      ...basePulse.index,
      direction_check: {
        status: "needs_review",
        reason: "合成衝突：兩個來源的同日漲跌方向不一致；未選定方向。",
        as_of: PREVIOUS_DATE,
        twse_change: 120,
        twse_change_pct: 0.55,
        session_flow_change: -120,
        twse_close: 21880,
        session_flow_close: 21880,
        session_flow_status: "close_matched",
      },
    },
  } satisfies InvestmentMarketPulse,
  previousSessionPartial: {
    ...basePulse,
    as_of: PREVIOUS_DATE,
    requested_date: DATE,
    source_dates: { twse: PREVIOUS_DATE, tpex: null },
    source_cutoff: `${PREVIOUS_DATE}T13:30:00+08:00`,
    state: "partial",
    limitations: [...basePulse.limitations, `合成狀態：要求 ${DATE}，來源只回傳 ${PREVIOUS_DATE}。`],
  } satisfies InvestmentMarketPulse,
}
export const pulse: InvestmentMarketPulse = pulseIntegrityScenarios.needsReview
export const relativeStrength: RelativeStrength = {
  state: "ready", as_of: DATE, window_trading_days: 60,
  benchmarks: { market: 4.2, sector: -3.1 },
  rows: [
    { ticker: "SYNTH", stale: false, own_ret: 9.4, rs_spy: 5.2, rs_soxx: 12.5, group: "demo", group_label: "合成族群", rs_group: 3.1 },
    { ticker: "DEMO-B", stale: false, own_ret: 1.8, rs_spy: -2.4, rs_soxx: 4.9, group: null, group_label: null, rs_group: null },
  ],
  stale_tickers: [], coverage: { rows: 2, scored: 2, stale: 0, no_reading: 0 },
  note: "合成資料；不是真實的相對強度。", message: "",
}


export const twRelativeStrength: TwRelativeStrength = {
  schema_version: "1.0", artifact: "tw-holdings-relative-strength", id: "tw-rs:synthetic",
  cached: true, market: "tw", state: "partial", as_of: PREVIOUS_DATE, requested_date: DATE,
  read_at: null, generated_at: STAMP, source_cutoff: PREVIOUS_DATE,
  producer: "tools/tw_relative_strength.py", window_trading_days: 60,
  limitations: ["合成資料示範已核實的前一交易日；同業籃子尚未提供。"], sources: ["synthetic/tw-rs"],
  holdings: [
    { symbol: "DEMO-TW-A", market: "tw", exchange: "TWSE", provider_symbol: "DEMO-TW-A.TW", as_of: PREVIOUS_DATE,
      window_start: "2026-06-24", window_trading_days: 60, state: "partial", reason_codes: ["peer_group_unavailable"], limitations: ["同業籃子尚未提供，不以大盤代替。"],
      market_rs_pp: 3.25, market_benchmark: { id: "^TWII", label: "臺灣證交所發行量加權股價指數" }, peer_rs_pp: null, peer_group: null,
      coverage: { expected_sessions: 61, holding_sessions: 61 }, price_source: "Synthetic adjusted daily close", benchmark_source: "synthetic/official-calendar" },
    { symbol: "DEMO-TW-B", market: "tw", exchange: "TPEx", provider_symbol: "DEMO-TW-B.TWO", as_of: PREVIOUS_DATE,
      window_start: "2026-06-24", window_trading_days: 60, state: "unavailable", reason_codes: ["holding_endpoint_mismatch", "peer_group_unavailable"], limitations: ["個股與大盤收盤日不同。", "同業籃子尚未提供。"],
      market_rs_pp: null, market_benchmark: { id: "^TWII", label: "臺灣證交所發行量加權股價指數" }, peer_rs_pp: null, peer_group: null,
      coverage: { expected_sessions: 61, holding_sessions: 60 }, price_source: "Synthetic adjusted daily close", benchmark_source: "synthetic/official-calendar" },
    { symbol: "DEMO-TW-C", market: "tw", exchange: null, provider_symbol: null, as_of: null, window_start: null,
      window_trading_days: 60, state: "unavailable", reason_codes: ["exchange_unverified", "peer_group_unavailable"], limitations: ["交易所身分尚未核實。", "同業籃子尚未提供。"],
      market_rs_pp: null, market_benchmark: { id: "^TWII", label: "臺灣證交所發行量加權股價指數" }, peer_rs_pp: null, peer_group: null,
      coverage: { expected_sessions: 61, holding_sessions: 0 }, price_source: "Synthetic adjusted daily close", benchmark_source: "synthetic/official-calendar" },
  ],
}

export const universe: MomentumUniverse = { state: "ready", symbols: [investmentScenario.symbol], label: "虛構標的", note: `${investmentScenario.symbol} 為展示代號，沒有真實持倉。`, source: "合成資料", excluded_count: 0 }
export const quote: StockQuote = { symbol: investmentScenario.symbol, label: investmentScenario.label, value: investmentScenario.price.value, unit: "範例幣", change: investmentScenario.price.change, change_percent: investmentScenario.price.change_percent, quoted_at: STAMP, session: "closed", state: "available", error: null, source_url: "#demo-source", fetched_at: STAMP, cached: true }
export const momentum: StockMomentumData = { symbol: investmentScenario.symbol, fetched_at: STAMP, cached: true, state: "ready",
  daily: { source: "live", stored_at: null, lag_sessions: 0, missing_dates: [], state: "available", as_of: DATE, last_close: 42, rsi14: 55, macd: "flat", return_20d_pct: 4.8, vs_5ma_pct: 1.2, vs_20ma_pct: 2.6, vs_50ma_pct: 2, range_252_low: 30, range_252_high: 50, range_252_position_pct: 60, distance_high_pct: -16, observations: 252, notes: ["所有指標均為合成數字"] },
  premarket: { state: "unavailable", price: null, change_percent: null, quoted_at: null, note: "範例未提供盤前資料" }, source_url: "#demo-source" }
const enrichedLeaderReference: MomentumLeaders = { state: "ready", as_of: DATE,
  coverage: { candidate_count: 3, holding_count: 1, watch_count: 2, scored_count: 3, unavailable_count: 0, unavailable_symbols: [], lagging_symbols: ["DEMO-C"] },
  reading: { scored: 3, as_of: DATE, strong: 2, above_20ma: 3, above_20ma_unknown: 0, above_50ma: 3, above_50ma_unknown: 0,
    rsi_over_70: 0, rsi_under_30: 0, rsi_unknown: 0, macd_bearish: 0,
    strongest: { symbol: investmentScenario.symbol, return_20d_pct: 4.8 }, weakest: { symbol: "DEMO-C", return_20d_pct: 1.4 },
    definition: "強勢＝最近 20 個完整交易日報酬為正，且收盤在 20／50 日線上方。這是合成清單。" },
  note: "強勢＝最近 20 個完整交易日報酬為正，且收盤在 20／50 日線上方；涵蓋持倉與已登記觀察清單全部標的，不是全市場掃描。",
  rows: [
    { symbol: investmentScenario.symbol, holding: true, state: "available", source: "live", stored_at: null, as_of: DATE, lag_sessions: 0, missing_dates: [],
      last_close: 42, return_20d_pct: 4.8, vs_5ma_pct: 1.2, vs_20ma_pct: 2.6, vs_50ma_pct: 2, rsi14: 55, macd: "bullish",
      distance_high_pct: -16, range_252_position_pct: 60, range_252_low: 30, range_252_high: 50, strong: true, notes: ["所有指標均為合成數字"] },
    { symbol: "DEMO-B", holding: false, state: "available", source: "live", stored_at: null, as_of: DATE, lag_sessions: 0, missing_dates: [],
      last_close: 88, return_20d_pct: 3.1, vs_5ma_pct: 0.8, vs_20ma_pct: 1.7, vs_50ma_pct: 2.2, rsi14: 62, macd: "bullish_cross",
      distance_high_pct: -8, range_252_position_pct: 72, range_252_low: 60, range_252_high: 96, strong: true, notes: [] },
    { symbol: "DEMO-C", holding: false, state: "stale", source: "last_known_good", stored_at: `${DATE}T09:00:00+00:00`, as_of: "2026-09-19", lag_sessions: 1, missing_dates: ["2026-09-20"],
      last_close: 17, return_20d_pct: 1.4, vs_5ma_pct: -0.2, vs_20ma_pct: 0.9, vs_50ma_pct: 1.1, rsi14: 58, macd: "flat",
      distance_high_pct: -30, range_252_position_pct: 40, range_252_low: 12, range_252_high: 24, strong: false,
      notes: ["本次行情來源失敗（合成示範）；沿用 2026/09/20 17:00 取得、截至 2026-09-19 的日線。"] },
  ] }
export const leaders: MomentumLeaders = { rows: enrichedLeaderReference.rows, state: "ready", as_of: DATE, universe,
  coverage: { holding_count: 1, watch_count: 0, unavailable_symbols: [], lagging_symbols: [], candidate_count: 3, scored_count: 3, unavailable_count: 0 },
  note: "強勢＝最近 20 個完整交易日報酬為正，且收盤在 20／50 日線上方；這是合成研究清單，不是全市場掃描。",
  leaders: [
    { symbol: "SYNTH", rank: 1, state: "ready", as_of: DATE, last_close: 42, return_20d_pct: 4.8, vs_5ma_pct: 1.2, vs_20ma_pct: 2.6, vs_50ma_pct: 2, rsi14: 55, macd: "bullish", notes: [] },
    { symbol: "DEMO-B", rank: 2, state: "ready", as_of: DATE, last_close: 88, return_20d_pct: 3.1, vs_5ma_pct: 0.8, vs_20ma_pct: 1.7, vs_50ma_pct: 2.2, rsi14: 62, macd: "bullish_cross", notes: [] },
    { symbol: "DEMO-C", rank: 3, state: "partial", as_of: DATE, last_close: 17, return_20d_pct: 1.4, vs_5ma_pct: -0.2, vs_20ma_pct: 0.9, vs_50ma_pct: 1.1, rsi14: 58, macd: "flat", notes: [] },
  ] }
const watchSource = { path: investmentScenario.source_path, label: "合成研究", section: "待查問題", updated: DATE, source_id: investmentScenario.source_id }
export const investmentResearchItem = {
  id: "source:research/synthetic_capacity_question.md",
  kind: "research_note",
  title: investmentScenario.research_title,
  question: investmentScenario.question,
  status: "open",
  ticker: null,
  narrative_id: null,
  decision_id: null,
  updated: DATE,
  as_of: DATE,
  state: "partial",
  missing: ["Synthetic item has no canonical narrative or decision link."],
  source: { path: investmentScenario.source_path, line: 4 },
} satisfies InvestmentResearch["research"]["items"][number]
const researchDirectionDefinitions = [
  ["ai-economics-capex", "AI 經濟、CapEx 回報與 L3 買方 ROI（目前最重要的共享主線）"],
  ["compute-tsm-capacity", "運算／TSM 共同依賴與容量"],
  ["memory-supply-cycle", "記憶體供需與週期"],
  ["interconnect-optical-power", "互連、光學與電力供應"],
  ["cross-cycle-capex-credit", "跨線週期缺口：CapEx → WFE／容量 → 供給 → ASP／毛利 → FCF／信用"],
] as const
const syntheticDirectionItems = researchDirectionDefinitions.map(([id], index) => ({
  ...investmentResearchItem,
  id: index===0 ? investmentResearchItem.id : `source:research/synthetic-direction-${index}.md`,
  title: `合成研究問題 ${index+1}`,
  source: { path: `synthetic/research-direction-${index}`, line: 4 },
  direction: { state: "linked" as const, group_ids: [id], sources: [{ group_id: id, path: "synthetic/research-index", line: index+1, expect: "synthetic explicit membership" }] },
}))
const syntheticOtherItems = (["unlinked", "unknown"] as const).map((state,index)=>({
  ...investmentResearchItem, id: `source:research/synthetic-other-${index}.md`,
  title: "Memory CapEx 光學 TSM：同名也不推定方向", ticker: "TSM",
  direction: { state, group_ids: [], sources: [] },
}))
export const investmentResearch: InvestmentResearch = {
  schema_version: "1.0", artifact: "investment-research-index", id: "research-index",
  as_of: DATE, generated_at: STAMP, source_cutoff: "unknown", producer: "tools/research_view.py",
  state: "partial", limitations: ["Synthetic Research fixture has no producer cutoff."],
  sources: [investmentScenario.source_path],
  research: { items: [...syntheticDirectionItems,...syntheticOtherItems], count: 7,
    direction_groups: { schema_version: 1, state: "partial", source: { path: "synthetic/research-index" }, limitations: ["Synthetic unknown classification is preserved."],
      groups: researchDirectionDefinitions.map(([id,title],index)=>({ id,title,state: "ready", source: { path: "synthetic/research-index", line: index+1, expect: "synthetic direction marker" },
        item_ids: [syntheticDirectionItems[index].id], relations: [{ item_id: syntheticDirectionItems[index].id, source: { path: "synthetic/research-index", line: index+1, expect: "synthetic explicit membership" } }], limitations: [] })),
      unlinked_item_ids: [syntheticOtherItems[0].id], unknown_item_ids: [syntheticOtherItems[1].id], unlinked_count: 1, unknown_count: 1,
    },
  },
}
export const investmentResearchDetails: Record<string, InvestmentResearchDetail> = {
  ...Object.fromEntries([...syntheticDirectionItems,...syntheticOtherItems].map(item=>[item.id,{
    schema_version: "1.0", artifact: "investment-research-detail" as const, id: `research-detail:${item.id}`,
    as_of: DATE, generated_at: STAMP, source_cutoff: "unknown", producer: "tools/research_view.py", state: "partial" as const,
    limitations: item.missing, sources: [item.source.path], research: { item, detail: { text: "完全虛構的研究明細。", what: item.question } },
  }])),
  [investmentResearchItem.id]: {
    schema_version: "1.0", artifact: "investment-research-detail", id: `research-detail:${investmentResearchItem.id}`,
    as_of: DATE, generated_at: STAMP, source_cutoff: "unknown", producer: "tools/research_view.py",
    state: "partial", limitations: investmentResearchItem.missing, sources: [investmentScenario.source_path],
    research: { item: syntheticDirectionItems[0], detail: { text: investmentScenario.research_excerpt, what: investmentScenario.next_check } },
  },
}
export const watch: InvestmentWatch = {
  schema_version: "1.0", artifact: "investment-watch", id: "investment-watch:synthetic",
  as_of: STAMP, generated_at: STAMP, source_cutoff: "unknown", producer: "PersonalOS.core.investment_watch",
  state: "partial", limitations: ["Synthetic Watch fixture has no source cutoff."], sources: [investmentScenario.source_path],
  watch: {
    coverage: { scope: ["合成範例"], scanned_files: 1, omissions: [], errors: [], missing_catalysts: [] },
    catalysts: [{ id: "demo-catalyst", topic: investmentScenario.label, label: investmentScenario.next_check, raw: `${investmentScenario.next_check_date}（合成日期）`, date: investmentScenario.next_check_date.slice(0, 7), date_precision: "month", estimated: true, bucket: "undated", source: watchSource }],
    research: [{ id: "demo-research", topic: investmentScenario.label, title: investmentScenario.research_title, status: "觀察", purpose: "整理待查問題", excerpt: investmentScenario.research_excerpt, session_refs: [], source: watchSource }],
    session_followups: [],
  },
}
const block = { source: "合成資料", note: "展示案例", state: "ready" as const, message: "", limitations: ["未呼叫外部工具"] }
export const pending: InvestmentPending = {
  schema_version: "1.0", artifact: "investment-pending", id: "investment-pending:synthetic",
  as_of: STAMP, generated_at: STAMP, source_cutoff: "unknown", producer: "PersonalOS.core.investment_pending",
  state: "partial", limitations: ["Synthetic pending fixture has no source cutoff."], sources: [investmentScenario.source_path],
  pending: { scope: "全合成展示",
    revisit: { ...block, title: "待回顧", groups: [{ ticker: investmentScenario.symbol, label: investmentScenario.label, overdue_days: 0, items: [{ decision: investmentScenario.question, ticker: investmentScenario.symbol, horizon: 7, due: DATE, overdue_days: 0, status: "待查", candidate_runs: [] }] }], counts: { due_unmarked: 1, groups: 1 } },
    gate: { ...block, title: "待決定", items: [], counts: { registered: 0, due: 0, later: 0 } },
    weekly: { ...block, title: "範例週回顧", date: DATE, path: "synthetic/weekly", age_days: 0, alerts: [], action_items: [{ text: "整理兩個產品交付問題", done: false, detail: ["全合成案例"] }] },
  },
}
