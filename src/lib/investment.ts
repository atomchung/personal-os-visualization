import { request } from "@/lib/transport"

import { WriteRejected } from "@/lib/api"
export type InvestmentSourceState = "current" | "stale" | "missing" | "invalid"

export type InvestmentSource = {
  id: string
  title: string
  date: string | null
  generated_at: string | null
  source_cutoff: string | null
  age_days: number | null
  state: InvestmentSourceState
  limitations: string[]
  url: string | null
}

export type EnvelopeCompleteness = "ready" | "partial" | "unavailable"
export type InvestmentEnvelope = {
  artifact: string
  id: string
  as_of: string
  generated_at: string
  source_cutoff: string
  producer: string
  completeness: EnvelopeCompleteness
  limitations: string[]
}
export type ActionItemStatus = "open" | "has-canonical-home" | "closed"
export type InvestmentActionItem = {
  id: string
  text: string
  status: ActionItemStatus
  tickers: string[]
  evidence: string[]
  artifact_id: string
  source: string
  date: string
}
export type InvestmentActions = {
  as_of: string
  state: "ready" | "partial" | "unavailable"
  message: string
  limitations: string[]
  items: InvestmentActionItem[]
  counts: { open: number; has_canonical_home: number; closed: number }
}

export type InvestmentBrief = {
  state: InvestmentSourceState
  date: string | null
  generated_at: string | null
  source_cutoff: string | null
  session: string | null
  headline: string
  market_pulse: { variable: string; latest: string; meaning: string }[]
  market_pulse_notes: string[]
  events: {
    event: string
    market_reaction: string
    interpretation: string
    impact: string
    today: string
  }[]
  event_notes: string[]
  /** `event_index` is the one event this row belongs to, or null when the reference
   * named none or more than one (and on briefs written before the column existed). */
  thesis_changes: { thesis: string; event_ref: string; event_index: number | null; change: string; reason: string }[]
  thesis_notes: string[]
  upcoming: { date_label: string; event: string; check: string }[]
  upcoming_notes: string[]
  actions: string[]
  /** Optional structured next steps; UI must keep working when this is absent. */
  action_items?: InvestmentActionItem[]
  envelope?: InvestmentEnvelope | null
  risks: { risk: string; event_ref: string; event_index: number | null; status: string }[]
  risk_notes: string[]
  source: InvestmentSource | null
}

export type InvestmentData = {
  as_of: string
  brief: InvestmentBrief
  weekly_watch: {
    state: InvestmentSourceState
    date: string | null
    source: InvestmentSource | null
  }
  conditions: { state: "not_connected"; message: string }
  sources: InvestmentSource[]
}

export type InvestmentSourceText = {
  title: string
  date: string | null
  text: string
}

export type InvestmentHistoryItem = {
  id: string
  title: string
  heading: string
  date: string | null
  kind: string
  excerpt: string
  excerpt_truncated: boolean
  result_state: "known" | "unknown"
  result: string
  detail_state: "available" | "truncated"
  source: {
    id: string
    path: string
    section: string
    line_start: number
    line_end: number
  }
}

export type InvestmentHistory = {
  state: "ready" | "partial" | "unavailable"
  coverage: {
    allowed_sources: { id: string; path: string; kind: string }[]
    available_sources: { id: string; path: string; kind: string; bytes: number; items?: number }[]
    missing_sources: string[]
    items: number
    errors: { source_id: string; path: string; code: string; message: string }[]
  }
  items: InvestmentHistoryItem[]
}

export type InvestmentHistorySource = InvestmentHistoryItem & { text: string }

export type InvestmentContext = {
  schema_version: number
  read_only: true
  task: { slug: string; path: string }
  scope: { mode: string; max_files: number; files_read: string[]; excluded: string[] }
  current_state: Record<string, string | { section: string; line_start: number; line_end: number; text: string; truncated: boolean }>
  requirements: { section: string; line_start: number; line_end: number; text: string; truncated: boolean; source: { path: string; root: string; line_start: number; line_end: number } }[]
  decisions: { kind: "approved" | "rejected" | "pending"; section: string; line_start: number; line_end: number; text: string; truncated: boolean; source: { path: string; root: string; line_start: number; line_end: number } }[]
  evidence: { kind?: string; section: string; line_start: number; line_end: number; text: string; truncated: boolean; source: { path: string; root: string; line_start: number; line_end: number } }[]
  warnings: string[]
}

export type QuoteSession = "pre" | "regular" | "post" | "closed" | "futures"
export const SESSION_LABELS: Record<QuoteSession, string> = { pre: "盤前", regular: "盤中", post: "盤後", closed: "收盤", futures: "期貨" }
export const BRIEF_SESSION_LABELS: Record<string, string> = { "tw-open-prep": "台股開盤前版", "us-open-prep": "美股開盤前版" }

export type InvestmentMarket = {
  fetched_at: string
  state: "ready" | "partial" | "unavailable"
  cached: boolean
  active: boolean
  items: {
    symbol: string
    label: string
    /** Short ticker printed beside the label, or null when it is not the name the reader uses. */
    code: string | null
    value: number | null
    unit: string
    change: number | null
    change_percent: number | null
    quoted_at: string | null
    session: QuoteSession | null
    state: "available" | "stale" | "unavailable"
    error: string | null
    source_url: string
  }[]
}

export type MarketExploreItem = {
  symbol: string
  label: string
  change_1d_pct: number | null
  change_7d_pct: number | null
  activity: { label: string | null; value: number | null }
  rsi14: number | null
  vs_50ma_pct: number | null
  rs_benchmark_1m_pp: number | null
  rs_benchmark_window: string | null
  researched: boolean
}
export type MarketExploreBucket = {
  key: "fast" | "active" | "sustained"
  label: string
  method: string
  items: MarketExploreItem[]
}
export type MarketExploreMarket = {
  market: "tw" | "us"
  artifact: string
  id: string
  as_of: string | null
  generated_at: string | null
  source_cutoff: string | null
  producer: string
  state: "ready" | "partial" | "unavailable"
  limitations: string[]
  universe_size: number
  buckets: MarketExploreBucket[]
}
export type MarketExplore = {
  fetched_at: string
  cached: boolean
  state: "ready" | "partial" | "unavailable"
  message: string
  note: string
  markets: MarketExploreMarket[]
  /** Optional; live adapter may attach scan-level gaps. */
  limitations?: string[]
}

export type StockQuote = {
  symbol: string
  label: string
  value: number | null
  unit: string
  change: number | null
  change_percent: number | null
  quoted_at: string | null
  session: QuoteSession | null
  state: "available" | "stale" | "unavailable"
  error: string | null
  source_url: string
  fetched_at: string
  cached: boolean
}

/** Poll only while the page is open: fast when a quote moved recently, slow when the market is shut. */
export const ACTIVE_POLL_MS = 30_000
export const HOLDING_POLL_MS = 60_000
export const IDLE_POLL_MS = 300_000
export function isRecentQuote(quotedAt: string | null | undefined, now = Date.now()): boolean {
  if (!quotedAt) return false
  const at = new Date(quotedAt).getTime()
  return Number.isFinite(at) && now - at <= 15 * 60_000
}

export type MomentumUniverse = {
  state: "ready" | "unavailable"
  symbols: string[]
  label: string
  note: string
  source: string
  excluded_count: number
}

export type MomentumLeader = {
  symbol: string
  rank: number
  state: "ready" | "partial" | "unavailable"
  as_of: string | null
  last_close: number | null
  return_20d_pct: number | null
  vs_5ma_pct: number | null
  vs_20ma_pct: number | null
  vs_50ma_pct: number | null
  rsi14: number | null
  macd: "bullish_cross" | "bearish_cross" | "bullish" | "bearish" | "flat" | null
  notes: string[]
}

export type MomentumLeaders = {
  state: "ready" | "partial" | "unavailable"
  as_of: string | null
  leaders: MomentumLeader[]
  universe: MomentumUniverse
  coverage: { candidate_count: number; scored_count: number; unavailable_count: number }
  note: string
}

export type StockMomentumData = {
  symbol: string
  fetched_at: string
  cached: boolean
  state: "ready" | "partial" | "unavailable"
  daily: {
    state: "available" | "stale" | "unavailable"
    as_of: string | null
    last_close: number | null
    rsi14: number | null
    macd: "bullish_cross" | "bearish_cross" | "bullish" | "bearish" | "flat" | null
    return_20d_pct: number | null
    vs_5ma_pct: number | null
    vs_20ma_pct: number | null
    vs_50ma_pct: number | null
    range_252_low: number | null
    range_252_high: number | null
    range_252_position_pct: number | null
    distance_high_pct: number | null
    observations: number
    notes: string[]
  }
  premarket: {
    state: "available" | "unavailable"
    price: number | null
    change_percent: number | null
    quoted_at: string | null
    note: string
  }
  source_url: string
}

export type WatchSource = {
  path: string
  label: string
  section: string
  updated: string | null
  source_id: string
}

export type InvestmentWatch = {
  as_of: string
  coverage: {
    scope: string[]
    scanned_files: number
    omissions: { path: string; reason: string }[]
    errors: { path: string; message: string }[]
    missing_catalysts: { topic: string; source: WatchSource }[]
  }
  catalysts: {
    id: string
    topic: string
    label: string
    raw: string
    date: string | null
    date_precision: "day" | "month" | "unknown"
    estimated: boolean
    bucket: "overdue" | "next7" | "later" | "undated"
    source: WatchSource
  }[]
  research: {
    id: string
    topic: string
    title: string
    status: string | null
    purpose: string | null
    excerpt: string
    session_refs: string[]
    source: WatchSource
  }[]
  session_followups: {
    id: string
    title: string
    next_action: string
    last_session: string | null
    task_status: string | null
    provider: string | null
    session_id: string | null
    related_files: string[]
    source: WatchSource
  }[]
}

/** Read only local API data, with bounded requests and no server-body errors. */
async function readInvestment<T>(url: string, signal?: AbortSignal, timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController()
  const cancel = () => controller.abort()
  const timeout = window.setTimeout(cancel, timeoutMs)
  signal?.addEventListener("abort", cancel, { once: true })
  if (signal?.aborted) controller.abort()

  try {
    const response = await request(url, {
      signal: controller.signal,
      cache: "no-store",
    })
    if (!response.ok) {
      throw new Error(`本機資料暫時無法讀取（${response.status}）`)
    }
    return (await response.json()) as T
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) {
      throw new Error("讀取逾時，請稍後重試。")
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener("abort", cancel)
  }
}

let momentumRequests = 0
const momentumQueue: (() => void)[] = []

/** Acquire a request slot before starting the fetch timeout; queued reads cancel cleanly. */
function acquireMomentumSlot(signal?: AbortSignal): Promise<() => void> {
  return new Promise((resolve, reject) => {
    const cancelled = () => new DOMException("Request aborted", "AbortError")
    if (signal?.aborted) {
      reject(cancelled())
      return
    }
    const start = () => {
      signal?.removeEventListener("abort", cancel)
      momentumRequests += 1
      resolve(() => {
        momentumRequests -= 1
        momentumQueue.shift()?.()
      })
    }
    const cancel = () => {
      const index = momentumQueue.indexOf(start)
      if (index !== -1) momentumQueue.splice(index, 1)
      reject(cancelled())
    }
    signal?.addEventListener("abort", cancel, { once: true })
    if (momentumRequests < 4) start()
    else momentumQueue.push(start)
  })
}

export const getInvestment = (signal?: AbortSignal) =>
  readInvestment<InvestmentData>("/api/investment", signal)

export const getInvestmentActions = (signal?: AbortSignal) =>
  readInvestment<InvestmentActions>("/api/investment/actions", signal)

export const getInvestmentMarket = (signal?: AbortSignal, refresh = false) =>
  readInvestment<InvestmentMarket>(`/api/investment/market?refresh=${refresh}`, signal)

/** Explore scans can be slow; only this getter uses the longer bound. */
export const getMarketExplore = (signal?: AbortSignal, refresh = false) =>
  readInvestment<MarketExplore>(
    refresh ? "/api/investment/explore?refresh=true" : "/api/investment/explore",
    signal,
    50_000,
  )

export const getMomentumUniverse = (signal?: AbortSignal) =>
  readInvestment<MomentumUniverse>("/api/investment/momentum/universe", signal)

export const getMomentumLeaders = (signal?: AbortSignal, refresh = false) =>
  readInvestment<MomentumLeaders>(`/api/investment/momentum/leaders?refresh=${refresh}`, signal, 60_000)

export async function getStockMomentum(symbol: string, signal?: AbortSignal, refresh = false): Promise<StockMomentumData> {
  const release = await acquireMomentumSlot(signal)
  try {
    return await readInvestment<StockMomentumData>(
      `/api/investment/momentum?symbol=${encodeURIComponent(symbol)}&refresh=${refresh}`,
      signal,
      25_000,
    )
  } finally {
    release()
  }
}

export async function getStockQuote(symbol: string, signal?: AbortSignal, refresh = false): Promise<StockQuote> {
  const release = await acquireMomentumSlot(signal)
  try {
    return await readInvestment<StockQuote>(`/api/investment/quote?symbol=${encodeURIComponent(symbol)}&refresh=${refresh}`, signal)
  } finally {
    release()
  }
}

export const getInvestmentWatch = (signal?: AbortSignal) =>
  readInvestment<InvestmentWatch>("/api/investment/watch", signal)

export const getInvestmentSource = (id: string, signal?: AbortSignal) =>
  readInvestment<InvestmentSourceText>(
    `/api/investment/source?id=${encodeURIComponent(id)}`,
    signal,
  )

export const getInvestmentHistory = (signal?: AbortSignal) =>
  readInvestment<InvestmentHistory>("/api/investment/history", signal)

export const getInvestmentHistorySource = (id: string, signal?: AbortSignal) =>
  readInvestment<InvestmentHistorySource>(
    `/api/investment/history/source?id=${encodeURIComponent(id)}`,
    signal,
  )

export const getInvestmentContext = (signal?: AbortSignal) =>
  readInvestment<InvestmentContext>("/api/investment/context", signal)

/** 待處理的三個來源全部來自 investment_note 既有工具，看板只顯示、不寫回。
 * 每一塊自己帶狀態：一個工具讀不到時只有那一塊說話，另外兩塊照常。 */
export type PendingBlock = {
  title: string
  /** 這塊是誰算出來的（工具指令或檔案路徑），原樣顯示給讀者對照。 */
  source: string
  note: string
  state: "ready" | "unavailable"
  /** state 為 unavailable 時的中文原因；ready 時是空字串。 */
  message: string
  limitations: string[]
}

export type PendingRevisitItem = {
  decision: string
  ticker: string | null
  horizon: number
  due: string
  overdue_days: number
  status: string
  candidate_runs: string[]
}

export type PendingRevisit = PendingBlock & {
  /** 同一 ticker 的對帳點併成一組（record-trade Step 3.5 的分組規則），逾期最久在上。 */
  groups: { ticker: string | null; label: string; overdue_days: number; items: PendingRevisitItem[] }[]
  counts: { due_unmarked?: number; marked?: number; not_applicable?: number; groups?: number }
}

export type PendingGate = PendingBlock & {
  items: { id: string; what: string; file: string; line: number; due: string; overdue_days: number }[]
  counts: { registered?: number; due?: number; later?: number }
}

export type PendingWeekly = PendingBlock & {
  date: string | null
  path: string | null
  age_days: number | null
  alerts: { title: string; tone: "bad" | "warn" | "info"; body: string }[]
  action_items: { text: string; done: boolean; detail: string[] }[]
}

export type InvestmentPending = {
  as_of: string
  scope: string
  revisit: PendingRevisit
  gate: PendingGate
  weekly: PendingWeekly
}

export const getInvestmentPending = (signal?: AbortSignal) =>
  readInvestment<InvestmentPending>("/api/investment/pending", signal)

export type InvestmentWork = {
  id: string; kind: "decision" | "research"; text: string;
  source_id: string; source_label: string; status: "open" | "watching" | "done";
  conclusion: string; version: number; updated_at: string;
}
export const getInvestmentWork = () => readInvestment<{items: InvestmentWork[]}>("/api/investment/work")
async function writeWork(path: string, method: string, data: unknown): Promise<InvestmentWork> {
  const response = await request(path, {method, headers: {"Content-Type": "application/json"}, body: JSON.stringify(data), signal: AbortSignal.timeout(15_000)})
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new WriteRejected(response.status, typeof error.detail === "string" ? error.detail : "請確認輸入內容後重試。")
  }
  return response.json()
}
export const addInvestmentWork = (data: {kind: InvestmentWork["kind"]; text: string; source_id?: string; source_label?: string}) =>
  writeWork("/api/investment/work", "POST", data)
export const saveInvestmentWork = (data: InvestmentWork) =>
  writeWork(`/api/investment/work/${encodeURIComponent(data.id)}`, "PATCH", {version: data.version, status: data.status, kind: data.kind, conclusion: data.conclusion})
