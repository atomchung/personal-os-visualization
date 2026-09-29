import { getSelectedModuleProvider, selectModuleProvider, type ModuleCapabilityDescriptor, type ModuleProviderBinding } from "./moduleProvider.ts"
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
/** `unknown` only ever comes from the daily brief's own `action_items` (today_view
 * can't classify a status for e.g. a no-change line); the cross-artifact action
 * list below never emits it. */
export type ActionItemStatus = "open" | "has-canonical-home" | "closed" | "unknown"
/** Only set on the daily brief's `action_items`; the cross-artifact action list
 * reuses this type but never sets `kind`. */
export type ActionItemKind = "no_change" | "watch" | "research" | "action" | "unknown"
export type InvestmentActionItem = {
  id: string
  text: string
  status: ActionItemStatus
  kind?: ActionItemKind
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

export type InvestmentBriefJudgmentClass = "trade" | "watch" | "ignore"
/** today_view's own receipt for its post-judgment projection; shape is
 * producer-owned, so unknown extra keys are kept rather than typed out. */
export type InvestmentBriefJudgmentProvenance = {
  declared_unverified?: string | null
  validated_story_ids?: string[]
  artifact?: string | null
  source_revision?: string | null
  source_cutoff?: string | null
  [key: string]: unknown
}
/** Optional structured "今天怎麼做" projection (personal-os-visualization #56).
 * Absent/null means the brief has no such projection -- present the plain
 * `actions`/`action_items` text instead of inferring one. */
export type InvestmentBriefJudgment = {
  class: InvestmentBriefJudgmentClass
  judgment: string
  why_now: string
  revisit: string | null
  decision_effect: string | null
  provenance: InvestmentBriefJudgmentProvenance | null
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
    /** Explicit identity from the Investment Note producer; absent means do not merge. */
    story_id?: string | null
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
  /** Optional; absent/null on older briefs and briefs today_view did not judge. */
  judgment?: InvestmentBriefJudgment | null
  envelope?: InvestmentEnvelope | null
  risks: { risk: string; event_ref: string; event_index: number | null; status: string }[]
  risk_notes: string[]
  source: InvestmentSource | null
}

export type InvestmentTodayUpdate = {
  id: string
  /** Explicit identity from the Investment Note producer; absent means do not merge. */
  story_id: string | null
  observed_at: string
  scan_mode?: "quick" | "deep" | null
  market_scope?: "tw" | "us" | "all" | null
  market_date?: string | "unknown" | null
  scan_started_at?: string | null
  source_cutoff?: string | null
  scan_completed_at?: string | null
  coverage_state?: "complete" | "partial" | null
  summary: string
  portfolio_impact: string
  action: string
  relevance: ("decision-change" | "action-watch-change" | "new-price-discovery" | "ai-infra-readthrough")[]
  source_path: string
}

/** One point on the trading cycle's line: a formal brief, or an intraday update. */
export type InvestmentTimelineNode =
  | {
      kind: "brief"
      /** The brief's source_cutoff -- when it was cut, not when it was written. */
      at: string
      /** Actual time the point became available; falls back to `at` for old data. */
      timeline_at?: string
      date: string | null
      session: string | null
      /** Actual publication time and information boundary are separate. */
      generated_at?: string | null
      source_cutoff?: string | null
      path: string
      headline: string
      events: InvestmentBrief["events"]
    }
  | ({ kind: "update"; at: string; timeline_at?: string } & InvestmentTodayUpdate)

export type InvestmentTodayView = {
  state: "ready" | "partial" | "unavailable"
  decision_summary: string | null
  decision_summary_date?: string | null
  updates: InvestmentTodayUpdate[]
  /**
   * The whole cycle, oldest first, in the producer's order. Overlaps `updates`
   * by design: that one is the delta the newest brief has not absorbed, this is
   * the day as it happened. Empty from a producer too old to send it.
   */
  timeline?: InvestmentTimelineNode[]
  limitations: string[]
}

export type InvestmentNarrativeState = "ready" | "unknown" | "stale" | "drift" | "partial"
export type InvestmentNarrativeSource = {
  path: string
  line?: number
  label?: string
  expect?: string
}
export type InvestmentNarrativeSection = {
  state: InvestmentNarrativeState
  text: string | null
  source?: InvestmentNarrativeSource | null
  reason?: string | null
}
export type InvestmentNarrativeDecisionView = {
  state: InvestmentNarrativeState
  reason: string | null
  decision_id: string | null
  route: {
    component: "DecisionView"
    route_key: "decision_id"
    ticker: string
    decision_id: string | null
  }
  sources: InvestmentNarrativeSource[]
}
export type InvestmentNarrativeExpression = {
  ticker: string
  holding_state: "ready" | "unknown"
  holding_reason: string | null
  state: InvestmentNarrativeState
  linkage: {
    state: InvestmentNarrativeState
    kind: "direct" | "thesis_home_inherited" | null
    narrative_id: string | null
    source: InvestmentNarrativeSource | null
    reason: string | null
  }
  thesis_source: InvestmentNarrativeSource | null
  decision_view: InvestmentNarrativeDecisionView
}
export type InvestmentNarrativeLatestChangeItem = {
  story_id: string | null
  narrative_id: string
  link_type: "narrative_id" | "story_id" | "conflict"
  text: string | null
  why_important: string | null
  market_reaction: string | null
  interpretation: string | null
  at: string | null
  source: InvestmentNarrativeSource
  state: InvestmentNarrativeState | null
}
export type InvestmentNarrativeLayerPlayer = {
  entity_id: string
  player: string
  recorded_at: string | null
  source: InvestmentNarrativeSource | null
}
export type InvestmentNarrativeLayerEvidence = {
  evidence_id: string
  pillar_id: string
  entity_id: string
  entity_ticker: string | null
  player: string
  evidence_type: "fact" | "calculation" | "analysis" | "ai_assessment" | "unknown"
  numeric_state: "known" | "not_applicable" | "unknown"
  numeric_value: string | null
  unit: string | null
  source_date: string | null
  evidence_date?: string
  source_type: string
  source_url: string | null
  polarity: "supports" | "challenges" | "unknown"
  explanation: string
  as_of: string | null
  recorded_at: string | null
  freshness: "current" | "stale" | "unknown"
  valid_until: string | null
  source: InvestmentNarrativeSource | null
  state: InvestmentNarrativeState | "conflict"
  limitations: string[]
}
export type InvestmentNarrativeEvidenceLayer = {
  layer_id: string
  pillar_id?: string | null
  label: string
  who_earns: string
  evidence_examples: string
  what_it_proves: string
  direction_state: "supports" | "challenges" | "mixed" | "unknown" | InvestmentNarrativeState
  link_state?: "linked" | "unlinked" | "partial" | "conflict"
  state?: InvestmentNarrativeState | "conflict"
  players?: InvestmentNarrativeLayerPlayer[]
  evidence?: InvestmentNarrativeLayerEvidence[]
  /** Canonical producer receipt; absence or unknown never means no opposing case. */
  opposing_coverage?: InvestmentOpposingCoverage | null
  /** AI-written one-sentence reading kept in Investment Note; absent from older producers. */
  current_reading?: InvestmentLayerReading | null
  /** Closable gaps, each with the event that closes it and an expected date. */
  gaps?: InvestmentLayerGap[]
  supporting: Array<InvestmentNarrativeLayerEvidence | string>
  opposing: Array<InvestmentNarrativeLayerEvidence | string>
  unknown?: InvestmentNarrativeLayerEvidence[]
  conflicts?: Array<Record<string, unknown>>
  unlinked_evidence?: Array<Record<string, unknown>>
  unlinked_players?: Array<Record<string, unknown>>
  limitations?: string[]
  unknown_reason: string | null
  source_date: string | null
  document_updated: string | null
  source: InvestmentNarrativeSource | null
}
export type InvestmentLayerReading = {
  state: "ready" | "partial" | "unknown" | "conflict" | "drift"
  text: string | null
  as_of: string | null
  basis: string | null
  authored_by: string
  /** Revision of the layer content the reading was judged against; equals current_layer_revision when ready. */
  layer_revision: string | null
  current_layer_revision: string | null
  limitations: string[]
  source: InvestmentNarrativeSource | null
}
export type InvestmentLayerGap = {
  gap_id: string
  pillar_id: string
  missing: string
  closes_when: string
  expected_by: string | null
  expected_by_precision: "day" | "month" | null
  overdue: boolean
  state: InvestmentNarrativeState | "conflict"
  source: InvestmentNarrativeSource | null
}
export type InvestmentNarrativeLayerReadingState = InvestmentLayerReading["state"]
export type InvestmentNarrativeLayerReading = InvestmentLayerReading
export type InvestmentNarrativeLayerGap = InvestmentLayerGap
export type InvestmentOpposingCoverage = {
  state: "sufficient" | "insufficient" | "unavailable" | "unknown"
  checked_at: string | null
  scope: string | null
  reason: string
  source: InvestmentNarrativeSource | null
}
export type InvestmentNarrativeDirectionalSignal = {
  direction: "supports" | "challenges"
  layer_id: string | null
  priority: string
  indicator: string
  dispute: string
  text: string
  source_channels: string
  source_date: string | null
  document_updated: string | null
  source: InvestmentNarrativeSource | null
}
export type InvestmentNarrativeRecordedChange = {
  date: string | null
  judgment: string | null
  key_evidence: string | null
  later_verification: string | null
  state: InvestmentNarrativeState
  missing: string[]
  source: InvestmentNarrativeSource | null
}
export type InvestmentNarrativeThesisEvidence = {
  state: InvestmentNarrativeState
  layers: InvestmentNarrativeEvidenceLayer[]
  directional_signals: InvestmentNarrativeDirectionalSignal[]
  scorecard_update?: InvestmentNarrativeScorecardUpdate | null
  unlinked_evidence?: InvestmentNarrativeLayerRow[]
  unlinked_players?: InvestmentNarrativeLayerRow[]
  latest_recorded_change: InvestmentNarrativeRecordedChange
  reason: string | null
}
export type InvestmentCatalystItem = {
  ticker: string
  type: string
  raw: string
  date_precision: "day" | "approximate_day" | "month" | "imprecise"
  date: string | null
  date_label: string | null
  source_qualifiers: string[]
  source: { path: string; line: number } | null
  window_membership: "within" | "possible" | "unknown"
}
export type InvestmentCatalysts30d = {
  state: "ready" | "partial" | "unknown"
  window_start: string | null
  window_end: string | null
  items: InvestmentCatalystItem[]
  uncertain_items: InvestmentCatalystItem[]
  coverage_gaps: { ticker: string; reason: string; source?: { path: string; line: number } | null }[]
  limitations: string[]
}
export type EventSource = { path: string | null; line?: number | null; raw?: string; at?: string | null; source_cutoff?: string | null; source_revision?: string | null }
export type FutureCheckpoint = {
  story_id: string | null; title: string; state: string
  date: string | null; date_label: string | null; date_precision: string; window_membership: string
  source_qualifiers?: string[]; affected_tickers: string[]; affected_scopes: string[]
  checks: { scope: string; check: string | null; state: string; result_state: string; source: EventSource }[]
  sources: EventSource[]; limitations: string[]
}
export type FutureCheckpoints = {
  state: string; window_start: string; window_end: string
  items: FutureCheckpoint[]; uncertain_items: FutureCheckpoint[]; past_items: FutureCheckpoint[]
  coverage_gaps: { ticker: string; reason: string; source?: EventSource }[]; limitations: string[]
}
export type NewsEvent = {
  key: string; story_id: string | null; title: string; state: string; ticker_link_state: string; thesis_link_state: string
  affected_tickers: string[]
  ticker_effects: { ticker: string; effect: string; sources: EventSource[]; state: string }[]
  thesis_effects: { narrative_id: string | null; thesis_ref: string | null; direction: string; reason: string | null; sources: EventSource[]; state: string }[]
  canonical_claim_effects: { evidence_id: string; claim_id: string; direction: string; reason: string; source?: EventSource }[]
  occurrences: { kind: string; title: string; market_reaction: string | null; interpretation: string | null; impact: string | null; source: EventSource }[]
  checkpoint: { state: string; story_id: string | null; checks: FutureCheckpoint["checks"]; sources?: EventSource[] }
  limitations: string[]
}
export type NewsEvents = { state: string; items: NewsEvent[]; limitations: string[] }
export type InvestmentNarrative = {
  news_events?: NewsEvents | null
  future_checkpoints?: FutureCheckpoints | null
  /** Bounded projection from canonical next_catalyst registrations. */
  catalysts_30d?: InvestmentCatalysts30d | null
  artifact: "personalos-investment-hub"
  schema_version: string
  id: string
  state: "ready" | "partial" | "unavailable"
  as_of: string
  generated_at: string
  source_cutoff: string
  producer: string
  limitations: string[]
  today: {
    state: "ready" | "partial" | "unavailable" | "unknown"
    baseline: { path: string; source_cutoff: string | null } | null
    limitations: string[]
  }
  narratives: {
    narrative_id: string | null
    title: string | null
    status: string
    updated: string | null
    state: InvestmentNarrativeState
    state_reason: string | null
    source: InvestmentNarrativeSource | null
    what_i_bet: {
      state: InvestmentNarrativeState
      narrative: InvestmentNarrativeSection
      owner_thesis: InvestmentNarrativeSection
      reason: string | null
    }
    current_tension: InvestmentNarrativeSection
    thesis_evidence: InvestmentNarrativeThesisEvidence
    expressions: {
      state: InvestmentNarrativeState
      items: InvestmentNarrativeExpression[]
      reason: string | null
    }
    latest_change: {
      state: InvestmentNarrativeState
      item: InvestmentNarrativeLatestChangeItem | null
      reason: string | null
    }
    references: (InvestmentNarrativeSource | null)[]
  }[]
}

export type InvestmentMarketPulse = {
  artifact: string
  id: string
  as_of: string | null
  generated_at: string | null
  source_cutoff: string | null
  requested_date?: string | null
  source_dates?: { twse?: string | null; tpex?: string | null } | null
  producer: string
  state: "ready" | "partial" | "unavailable"
  limitations: string[]
  index: {
    label: string
    value: number | null
    change: number | null
    change_pct: number | null
    direction_check?: {
      status?: "confirmed" | "needs_review" | "unavailable" | null
      reason?: string | null
      as_of?: string | null
      twse_change?: number | null
      twse_change_pct?: number | null
      session_flow_change?: number | null
      twse_close?: number | null
      session_flow_close?: number | null
      session_flow_status?: string | null
    } | null
  }
  breadth: {
    twse: { up: number | null; down: number | null; flat: number | null; limit_up: number | null; limit_down: number | null }
    tpex: { up: number | null; down: number | null; flat: number | null; limit_up: number | null; limit_down: number | null }
    combined: { up: number | null; down: number | null; flat: number | null; limit_up: number | null; limit_down: number | null }
    advancer_ratio: number | null
  }
  turnover: { twse_common_stock: number | null; tpex_stock: number | null; combined_stock: number | null }
  themes: {
    label: string
    source: "SUPPLY_CHAIN"
    strongest: { theme: string; sample_size: number | null; avg_change_pct: number | null; limit_up: number | null }[]
    weakest: { theme: string; sample_size: number | null; avg_change_pct: number | null; limit_up: number | null }[]
  }
  /** Post-close turnover + 三大法人 (institutional) net buy/sell, facts only.
   * Always present -- every field defaults to null/false/[] rather than the
   * key being omitted, including when the producer predates this field. */
  flow: {
    as_of: string | null
    index_close: number | null
    index_change: number | null
    turnover_ntd: number | null
    prev_turnover_ntd: number | null
    avg20_turnover_ntd: number | null
    turnover_vs_prev_pct: number | null
    turnover_vs_avg20_pct: number | null
    institutional: {
      published: boolean
      /** Authoritative three-way signal; `published` is kept for compatibility. */
      status: "published" | "not_published" | "unavailable"
      foreign_net_ntd: number | null
      trust_net_ntd: number | null
      dealer_net_ntd: number | null
      total_net_ntd: number | null
      prev_foreign_net_ntd: number | null
    }
    basis: string | null
    sources: string[]
    limitations: string[]
  }
}

export type InvestmentRefreshAction = "market" | "news"
export type InvestmentNewsMarket = "tw" | "us"
export type InvestmentRefreshStatus = {
  action: InvestmentRefreshAction
  state: "idle" | "running" | "success" | "failed" | "no-change"
  started_at: string | null
  last_updated: string | null
  message: string
  error: string | null
  discovery_state: "idle" | "running" | "ready" | "partial" | "failed"
  discovery_updated_at: string | null
  trigger: string | null
  new_update_count: number | null
  sync_note: string
  reconciled_at: string | null
  provider: "agy" | "claude" | "codex" | "grok" | null
  model: string | null
  fallback_depth: number | null
  provider_errors: Record<string, string>
  scan_mode?: "quick" | "deep" | null
  market_scope?: InvestmentNewsMarket | null
  duration_seconds?: number | null
  provider_elapsed_seconds?: number | null
}

export type InvestmentData = {
  as_of: string
  brief: InvestmentBrief
  /** Optional current-day projection: latest formal brief + post-cutoff intraday deltas. */
  today?: InvestmentTodayView
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

export type InvestmentReadState = "ready" | "empty" | "unknown" | "partial" | "stale" | "unavailable" | "conflict"

export type InvestmentHistorySourceRef = {
  path: string
  line?: number
  line_end?: number
  label?: string
}

export type InvestmentHistoryEvidence = string | InvestmentHistorySourceRef[]

export type InvestmentHistoryCheckpoint = {
  date: string | null
  what: string | null
  outcome: { text: string | null; state: "unknown" | "recorded" }
  source: InvestmentHistorySourceRef | null
  relation_state?: "linked" | "unknown"
}

export type InvestmentHistoryItem = {
  /** Null when the producer preserves a partial source row without a valid stable ID. */
  id: string | null
  source_id: string | null
  kind: string
  title: string
  date: string | null
  ticker: string | null
  narrative_id: string | null
  story_id: string | null
  evidence_ids: string[]
  decision_id: string | null
  chain_state?: "linked" | "unknown"
  decision_source?: InvestmentHistorySourceRef | null
  learning_source?: InvestmentHistorySourceRef | null
  outcome_state?: "unknown" | "recorded"
  learning_state: "unknown" | "recorded"
  /** Producer-owned classification; absent/unknown items stay unclassified. */
  learning_role?: "reusable_framework" | "historical_case" | "unknown"
  state: "ready" | "partial" | "conflict"
  missing: string[]
  source: InvestmentHistorySourceRef
  reason?: string | null
  evidence?: InvestmentHistoryEvidence | null
  outcome?: { text: string | null; state: "unknown" | "recorded" }
  learning?: string | null
  checkpoints?: InvestmentHistoryCheckpoint[]
}

export type InvestmentHistoryDetailItem = Omit<InvestmentHistoryItem, "id"> & { id: string }

export type InvestmentHistory = InvestmentReadEnvelope & {
  artifact: "investment-history-index"
  id: "history-index"
  history: { items: InvestmentHistoryItem[]; count: number }
}

export type InvestmentHistoryDetail = InvestmentReadEnvelope & {
  artifact: "investment-history-detail"
  history: {
    item: InvestmentHistoryDetailItem | null
    source_text?: string | null
    conflicts?: InvestmentHistoryDetailItem[]
  }
}

/** The detail endpoint keeps its producer envelope; this alias preserves the route helper name. */
export type InvestmentHistorySource = InvestmentHistoryDetail

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
export const BRIEF_SESSION_LABELS: Record<string, string> = { "tw-open-prep": "台股盤前注意", "us-open-prep": "美股盤前注意" }
export const BRIEF_SESSION_SCHEDULES: Record<string, string> = { "tw-open-prep": "目標班次 08:00 台北", "us-open-prep": "目標班次 21:15 台北" }

export type InvestmentMarket = {
  fetched_at: string
  state: "ready" | "partial" | "unavailable"
  cached: boolean
  active: boolean
  items: {
    symbol: string
    market: "tw" | "us"
    label: string
    /** Short ticker printed beside the label, or null when it is not the name the reader uses. */
    code: string | null
    value: number | null
    unit: string
    change: number | null
    change_percent: number | null
    quoted_at: string | null
    session: QuoteSession | null
    /** Bounds of the provider's own regular trading session covering `quoted_at`
     * (Yahoo chart meta `currentTradingPeriod.regular`), or null when the
     * provider did not give usable bounds. Lets a caller decide "session open
     * right now" for itself instead of only getting the derived `session` word. */
    session_start?: string | null
    session_end?: string | null
    state: "available" | "stale" | "unavailable"
    error: string | null
    source_url: string
  }[]
}

export type MarketExploreItem = {
  symbol: string
  label: string
  /** Close from the producer's own snapshot, in the market's currency; null when
   * the source did not report one. Never derived from a live quote -- that would
   * be a different reading than `change_1d_pct`. */
  price?: number | null
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
  session_start?: string | null
  session_end?: string | null
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

/** One row per symbol of the registered research roster (holdings, by book
 * market value, then registered watchlist) -- including a symbol whose daily
 * technicals are unavailable or lagging. `source`/`stored_at` say whether this
 * is today's live read or a resurrected last-known-good snapshot; `lag_sessions`
 * / `missing_dates` say how many trading sessions Yahoo has not published a
 * close for yet. */
export type MomentumRow = {
  symbol: string
  holding: boolean
  state: "available" | "stale" | "unavailable"
  source: "live" | "last_known_good"
  stored_at: string | null
  as_of: string | null
  lag_sessions: number
  missing_dates: string[]
  last_close: number | null
  return_20d_pct: number | null
  vs_5ma_pct: number | null
  vs_20ma_pct: number | null
  vs_50ma_pct: number | null
  rsi14: number | null
  macd: "bullish_cross" | "bearish_cross" | "bullish" | "bearish" | "flat" | null
  distance_high_pct: number | null
  range_252_position_pct: number | null
  range_252_low: number | null
  range_252_high: number | null
  /** The one `_is_strong` rule: 20-day return positive and above both the
   * 20- and 50-session averages. */
  strong: boolean
  notes: string[]
}

/** Counts across the whole scored roster, computed from the same daily rows the
 * table shows. Arithmetic only: no model call and no buy/sell reading. */
export type MomentumReading = {
  scored: number
  /** Latest session across the whole scored roster; the payload's own `as_of`
   * only covers the eight rows in the leaders table. */
  as_of: string | null
  strong: number
  above_20ma: number
  above_20ma_unknown: number
  above_50ma: number
  above_50ma_unknown: number
  rsi_over_70: number
  rsi_under_30: number
  rsi_unknown: number
  macd_bearish: number
  strongest: { symbol: string; return_20d_pct: number } | null
  weakest: { symbol: string; return_20d_pct: number } | null
  definition: string
}

export type MomentumLeadersCoverage = {
  candidate_count: number
  holding_count: number
  watch_count: number
  scored_count: number
  unavailable_count: number
  unavailable_symbols: string[]
  lagging_symbols: string[]
}

export type MomentumLeaders = {
  universe?: MomentumUniverse
  leaders?: MomentumLeader[]
  state: "ready" | "partial" | "unavailable"
  as_of: string | null
  rows: MomentumRow[]
  coverage: MomentumLeadersCoverage
  /** Optional so an older payload still renders the table without the summary. */
  reading?: MomentumReading
  note: string
}

/** One holding's three tiers, as `tools/relative_strength.py` reports them.
 * A null tier means that tool had no reading for it -- never treat it as zero. */
export type RelativeStrengthRow = {
  ticker: string
  stale: boolean
  own_ret: number | null
  rs_spy: number | null
  rs_soxx: number | null
  group: string | null
  group_label: string | null
  rs_group: number | null
}

export type RelativeStrength = {
  state: "ready" | "partial" | "unavailable"
  as_of: string | null
  window_trading_days: number | null
  benchmarks: { market: number | null; sector: number | null }
  rows: RelativeStrengthRow[]
  stale_tickers: string[]
  /** The four buckets always add up to `rows`: a holding is either scored,
   * stale, or had no market-tier reading. */
  coverage: { rows: number; scored: number; stale: number; no_reading: number }
  note: string
  message: string
  fetched_at?: string
  cached?: boolean
}

export type StockMomentumData = {
  premarket?: { state: string; price: number | null; change_percent: number | null; quoted_at: string | null; note: string }
  symbol: string
  fetched_at: string
  cached: boolean
  state: "ready" | "partial" | "unavailable"
  daily: {
    state: "available" | "stale" | "unavailable"
    /** "live" is today's own read; "last_known_good" is a resurrected snapshot
     * from a previous successful read, served because this read failed. */
    source: "live" | "last_known_good"
    /** Set only when `source` is "last_known_good": when that snapshot was taken. */
    stored_at: string | null
    as_of: string | null
    /** Trading sessions Yahoo has not published a close for yet, trailing the
     * series -- stripped from the indicator window rather than treated as a
     * hard failure. 0 when the latest bar is fully published. */
    lag_sessions: number
    missing_dates: string[]
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
  source_url: string
}

export type WatchSource = {
  path: string
  label: string
  section: string
  updated: string | null
  source_id: string
}

export type InvestmentReadEnvelope = {
  schema_version: "1.0"
  artifact: string
  id: string
  as_of: string
  generated_at: string
  source_cutoff: string
  producer: string
  state: InvestmentReadState
  limitations: string[]
  sources: string[]
}

export type InvestmentResearchDirectionSource = { path: string; line?: number; expect?: string }
export type InvestmentResearchDirectionGroup = {
  id: string
  title: string
  state: "ready" | "partial"
  source: InvestmentResearchDirectionSource
  item_ids: string[]
  relations: { item_id: string; source: InvestmentResearchDirectionSource }[]
  limitations: string[]
}
export type InvestmentResearchDirectionGroups = {
  schema_version: number
  state: "ready" | "partial" | "unavailable"
  groups: InvestmentResearchDirectionGroup[]
  source: InvestmentResearchDirectionSource
  limitations: string[]
  unlinked_item_ids: string[]
  unknown_item_ids: string[]
  unlinked_count: number
  unknown_count: number
}

export type InvestmentResearchItem = {
  id: string
  direction?: {
    state: "linked" | "unlinked" | "unknown"
    group_ids: string[]
    sources: (InvestmentResearchDirectionSource & { group_id: string })[]
  }
  kind: string
  title: string | null
  question: string | null
  status: string
  ticker: string | null
  narrative_id: string | null
  decision_id?: string | null
  updated: string | null
  as_of: string | null
  source_cutoff?: string
  state: "ready" | "partial" | "unavailable" | "conflict"
  missing?: string[]
  due?: string
  source: { path: string; line?: number }
}

export type InvestmentResearch = InvestmentReadEnvelope & {
  research: { items: InvestmentResearchItem[]; count: number; direction_groups?: InvestmentResearchDirectionGroups }
}

export type InvestmentResearchDetail = InvestmentReadEnvelope & {
  research: {
    item: InvestmentResearchItem | null
    detail: { text?: string; what?: string; due?: string } | null
    conflicts?: InvestmentResearchItem[]
  }
}

export const getInvestmentResearch = (signal?: AbortSignal) =>
  coreRead("research", () => getSelectedInvestmentProvider().getResearch?.(signal), "Investment research capability has no provider implementation.")

export const getInvestmentResearchDetail = (itemId: string, signal?: AbortSignal) =>
  coreRead("research", () => getSelectedInvestmentProvider().getResearchDetail?.(itemId, signal), "Investment research detail capability is unavailable.")

export type InvestmentWatch = InvestmentReadEnvelope & {
  watch: {
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
}

/** Provider-owned coverage; the UI never guesses capability from returned rows. */
export type InvestmentCapabilityStatus = "available" | "partial" | "unavailable"
export type InvestmentCapabilityName =
  | "today" | "judgment" | "research" | "history" | "market"
  | "watch" | "pending" | "actions" | "quote" | "tw-relative-strength"
export type InvestmentCapability = { status: InvestmentCapabilityStatus; limitations: string[] }
export type InvestmentCapabilityManifest = Record<InvestmentCapabilityName, InvestmentCapability>
export type InvestmentOptionalPayloads = {
  market: InvestmentMarket
  watch: InvestmentWatch
  pending: InvestmentPending
  actions: InvestmentActions
}
export type InvestmentOptionalCapability = keyof InvestmentOptionalPayloads
/** Private projection of the canonical Taiwan RS producer. Fields stay nullable
 * because core/investment_tw_relative_strength.py returns an unavailable
 * envelope instead of guessing; `cached` marks a reuse of its 15-minute cache. */
export type TwRelativeStrengthHolding = {
  symbol: string
  market: "tw"
  exchange: "TWSE" | "TPEx" | null
  provider_symbol: string | null
  as_of: string | null
  window_start: string | null
  window_trading_days: number | null
  state: "partial" | "unavailable"
  reason_codes: string[]
  limitations: string[]
  market_rs_pp: number | null
  market_benchmark: { id: string | null; label: string | null } | null
  peer_rs_pp: number | null
  peer_group: string | null
  coverage: { expected_sessions: number | null; holding_sessions: number | null }
  price_source: string | null
  benchmark_source: string | null
}
export type TwRelativeStrength = {
  artifact: "tw-holdings-relative-strength"
  schema_version: string
  id: string
  state: "partial" | "unavailable"
  as_of: string | null
  generated_at: string
  source_cutoff: string | null
  producer: string
  limitations: string[]
  sources: string[]
  market: "tw"
  requested_date: string
  read_at: string | null
  window_trading_days: number | null
  holdings: TwRelativeStrengthHolding[]
  cached: boolean
}
export type InvestmentMarketPayloads = {
  indicators: InvestmentMarket
  pulse: InvestmentMarketPulse
  explore: MarketExplore
  "tw-relative-strength": TwRelativeStrength
  "momentum-universe": MomentumUniverse
  "momentum-leaders": MomentumLeaders
  quote: StockQuote
  momentum: StockMomentumData
}
export type InvestmentMarketResource = keyof InvestmentMarketPayloads

/** Shared module boundary. Private providers implement this without changing UI callers. */
export interface InvestmentProvider {
  readonly id: string
  readonly capabilities: InvestmentCapabilityManifest
  getToday(signal?: AbortSignal): Promise<InvestmentData>
  getJudgment(signal?: AbortSignal): Promise<InvestmentNarrative>
  getResearch(signal?: AbortSignal): Promise<InvestmentResearch>
  getResearchDetail(itemId: string, signal?: AbortSignal): Promise<InvestmentResearchDetail>
  getHistory(signal?: AbortSignal): Promise<InvestmentHistory>
  getHistoryDetail(itemId: string, signal?: AbortSignal): Promise<InvestmentHistoryDetail>
  getOptional?<K extends InvestmentOptionalCapability>(capability: K, signal?: AbortSignal, refresh?: boolean): Promise<InvestmentOptionalPayloads[K]>
  getPersonalWork?(): Promise<{ items: InvestmentWork[] }>
  addPersonalWork?(data: { kind: InvestmentWork["kind"]; text: string; source_id?: string; source_label?: string; expires_on?: string }): Promise<InvestmentWork>
  updatePersonalWork?(data: InvestmentWork): Promise<InvestmentWork>
  getSource?(sourceId: string, signal?: AbortSignal): Promise<InvestmentSourceText>
  getContext?(signal?: AbortSignal): Promise<InvestmentContext>
  getRelativeStrength?(signal?: AbortSignal, refresh?: boolean): Promise<RelativeStrength>
  getRefreshStatus?(action: InvestmentRefreshAction, signal?: AbortSignal): Promise<InvestmentRefreshStatus>
  startRefresh?(action: InvestmentRefreshAction, market?: InvestmentNewsMarket): Promise<InvestmentRefreshStatus>
  getMarketData?<K extends InvestmentMarketResource>(resource: K, params?: { symbol?: string; refresh?: boolean; signal?: AbortSignal }): Promise<InvestmentMarketPayloads[K]>
}
export interface InvestmentProviderBase {
  readonly id: string
  readonly capabilities: InvestmentCapabilityManifest
}
export type InvestmentProviderRuntime = InvestmentProviderBase & Partial<InvestmentProvider>
export function unavailableCapability(limitations: string[]): InvestmentCapability {
  return { status: "unavailable", limitations: [...limitations] }
}

export const INVESTMENT_MODULE_ID = "investment"
export const INVESTMENT_MODULE_SURFACES = ["today", "judgment", "research", "history"] as const

export function bindInvestmentProvider(provider: InvestmentProviderRuntime): ModuleProviderBinding<InvestmentProviderRuntime> {
  const capabilities = {} as Record<InvestmentCapabilityName, ModuleCapabilityDescriptor>
  for (const [name, capability] of Object.entries(provider.capabilities)) {
    capabilities[name as InvestmentCapabilityName] = {
      status: capability.status === "available" ? "ready" : capability.status,
    }
  }

  return {
    moduleId: INVESTMENT_MODULE_ID,
    providerId: provider.id,
    surfaces: INVESTMENT_MODULE_SURFACES,
    capabilities,
    sourceDetail: { status: provider.getSource ? "ready" : "unavailable" },
    provider,
  }
}

export function setInvestmentProvider(provider: InvestmentProviderRuntime): void {
  selectModuleProvider(bindInvestmentProvider(provider))
}
export function getSelectedInvestmentProvider(): InvestmentProviderRuntime {
  return getSelectedModuleProvider<InvestmentProviderRuntime>(INVESTMENT_MODULE_ID).provider
}
export function requireInvestmentCapability(provider: InvestmentProviderRuntime, capability: InvestmentCapabilityName): void {
  const declared = provider.capabilities[capability]
  if (declared.status === "unavailable") {
    throw new Error(declared.limitations.join(" ") || `Investment capability '${capability}' is unavailable.`)
  }
}
export function requireAvailableCapability(capability: InvestmentCapabilityName): void {
  const provider = getSelectedInvestmentProvider()
  if (provider.capabilities[capability].status !== "available") requireInvestmentCapability(provider, capability)
}
/** Scenario hooks apply only to the fictional reference provider, never private data. */
function applyReferenceReadHook<T>(data: T): T {
  if (getSelectedInvestmentProvider().id !== "synthetic-reference") return data
  const hook = (globalThis as { window?: { __investmentReadHook?: (value: T) => T } }).window?.__investmentReadHook
  return hook ? hook(structuredClone(data)) : data
}

function coreRead<T>(capability: "today" | "judgment" | "research" | "history", read: () => Promise<T> | undefined, unavailableMessage: string): Promise<T> {
  const provider = getSelectedInvestmentProvider()
  try { requireInvestmentCapability(provider, capability) }
  catch (error) { return Promise.reject(error) }
  return (read() ?? Promise.reject(new Error(unavailableMessage))).then(applyReferenceReadHook)
}
function optionalCapability<K extends InvestmentOptionalCapability>(capability: K, signal?: AbortSignal): Promise<InvestmentOptionalPayloads[K]> {
  const provider = getSelectedInvestmentProvider()
  if (provider.capabilities[capability].status === "unavailable") {
    return Promise.reject(new Error(provider.capabilities[capability].limitations.join(" ") || `Investment capability '${capability}' is unavailable.`))
  }
  if (!provider.getOptional) return Promise.reject(new Error(`Investment capability '${capability}' has no provider implementation.`))
  return provider.getOptional(capability, signal).then(applyReferenceReadHook)
}
function marketData<K extends InvestmentMarketResource>(resource: K, params?: { symbol?: string; refresh?: boolean; signal?: AbortSignal }): Promise<InvestmentMarketPayloads[K]> {
  const provider = getSelectedInvestmentProvider()
  const capability = resource === "quote" ? "quote" : resource === "tw-relative-strength" ? "tw-relative-strength" : "market"
  try { requireInvestmentCapability(provider, capability) }
  catch (error) { return Promise.reject(error) }
  if (!provider.getMarketData) return Promise.reject(new Error("Investment market capability has no provider implementation."))
  return provider.getMarketData(resource, params).then(applyReferenceReadHook)
}

type InvestmentRefreshOperations = {
  getRefreshStatus?(action: InvestmentRefreshAction, signal?: AbortSignal): Promise<InvestmentRefreshStatus>
  startRefresh?(action: InvestmentRefreshAction, market?: InvestmentNewsMarket): Promise<InvestmentRefreshStatus>
}
function refreshOperations(): InvestmentRefreshOperations {
  return getSelectedInvestmentProvider() as InvestmentProviderRuntime & InvestmentRefreshOperations
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
  coreRead("today", () => getSelectedInvestmentProvider().getToday?.(signal), "Investment Today capability has no provider implementation.")

export const getInvestmentNarrative = (signal?: AbortSignal) =>
  coreRead("judgment", () => getSelectedInvestmentProvider().getJudgment?.(signal), "Investment judgment capability has no provider implementation.")

/** Canonical Taiwan holding RS. The consumer only renders this producer projection. */
export const getTwRelativeStrength = (signal?: AbortSignal, refresh = false) =>
  marketData("tw-relative-strength", { signal, refresh })

// The server-side producer can take up to its own ~60s subprocess timeout on
// a cache miss (core/investment_pulse.py TIMEOUT_SECONDS); the default 15s
// client timeout would abort before a cold run could ever finish. 75_000
// matches how getMomentumLeaders passes its own longer timeout below.
export const getInvestmentPulse = (signal?: AbortSignal) =>
  marketData("pulse", { signal })

export async function postInvestmentRefresh(
  action: InvestmentRefreshAction,
  market?: InvestmentNewsMarket,
): Promise<InvestmentRefreshStatus> {
  const start = refreshOperations().startRefresh
  if (!start) throw new Error("Investment refresh capability is unavailable.")
  return start(action, market)
}

export const getInvestmentRefreshStatus = (action: InvestmentRefreshAction, signal?: AbortSignal) =>
  refreshOperations().getRefreshStatus?.(action, signal)
    ?? Promise.reject(new Error("Investment refresh status is unavailable."))

export const getInvestmentActions = (signal?: AbortSignal) =>
  optionalCapability("actions", signal)

export const getInvestmentMarket = (signal?: AbortSignal, refresh = false) =>
  marketData("indicators", { signal, refresh })

/** Explore scans can be slow; only this getter uses the longer bound. */
export const getMarketExplore = (signal?: AbortSignal, refresh = false) =>
  marketData("explore", { signal, refresh })

export const getMomentumUniverse = (signal?: AbortSignal) =>
  marketData("momentum-universe", { signal })

export const getRelativeStrength = (signal?: AbortSignal, refresh = false) =>
  (requireAvailableCapability("market"), getSelectedInvestmentProvider().getRelativeStrength?.(signal, refresh))
    ?? Promise.reject(new Error("Investment relative-strength capability is unavailable."))

export const getMomentumLeaders = (signal?: AbortSignal, refresh = false) =>
  marketData("momentum-leaders", { signal, refresh })

export async function getStockMomentum(symbol: string, signal?: AbortSignal, refresh = false): Promise<StockMomentumData> {
  const release = await acquireMomentumSlot(signal)
  try {
    return await marketData("momentum", { symbol, signal, refresh })
  } finally {
    release()
  }
}

export async function getStockQuote(symbol: string, signal?: AbortSignal, refresh = false): Promise<StockQuote> {
  const release = await acquireMomentumSlot(signal)
  try {
    return await marketData("quote", { symbol, signal, refresh })
  } finally {
    release()
  }
}

export const getInvestmentWatch = (signal?: AbortSignal) =>
  optionalCapability("watch", signal)

export const getInvestmentSource = (id: string, signal?: AbortSignal) =>
  (getSelectedInvestmentProvider().getSource?.(id, signal)
    ?? Promise.reject(new Error("Investment source-detail capability is unavailable."))).then(applyReferenceReadHook)

export const getInvestmentHistory = (signal?: AbortSignal) =>
  coreRead("history", () => getSelectedInvestmentProvider().getHistory?.(signal), "Investment history capability has no provider implementation.")

export const getInvestmentHistorySource = (id: string, signal?: AbortSignal) =>
  coreRead("history", () => getSelectedInvestmentProvider().getHistoryDetail?.(id, signal), "Investment history detail capability is unavailable.")

export const getInvestmentContext = (signal?: AbortSignal) =>
  (getSelectedInvestmentProvider().getContext?.(signal)
    ?? Promise.reject(new Error("Investment context capability is unavailable."))).then(applyReferenceReadHook)

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

export type InvestmentPending = InvestmentReadEnvelope & {
  pending: {
    scope: string
    revisit: PendingRevisit
    gate: PendingGate
    weekly: PendingWeekly
  }
}

export const getInvestmentPending = (signal?: AbortSignal) =>
  optionalCapability("pending", signal)

export type InvestmentWork = {
  id: string; kind: "decision" | "research" | "watch"; text: string;
  source_id: string; source_label: string; status: "open" | "watching" | "done";
  conclusion: string; version: number; updated_at: string;
  /** YYYY-MM-DD; only kind "watch" ever sets this. Optional so a row written
   * before this field existed still type-checks. */
  expires_on?: string;
  /** Explicit user choice; missing legacy values are treated as false. */
  promoted_to_today?: boolean;
}
export const getInvestmentWork = () =>
  (getSelectedInvestmentProvider().getPersonalWork?.() ?? Promise.reject(new Error("Investment work capability is unavailable."))).then(applyReferenceReadHook)
export const addInvestmentWork = (data: {kind: InvestmentWork["kind"]; text: string; source_id?: string; source_label?: string; expires_on?: string}) =>
  getSelectedInvestmentProvider().addPersonalWork?.(data) ?? Promise.reject(new Error("Investment work writes are unavailable."))
export const saveInvestmentWork = (data: InvestmentWork) =>
  getSelectedInvestmentProvider().updatePersonalWork?.(data) ?? Promise.reject(new Error("Investment work writes are unavailable."))

export const getInvestmentCapability = (capability: InvestmentCapabilityName): InvestmentCapability =>
  getSelectedInvestmentProvider().capabilities[capability]


// Compatibility surfaces retained from reviewed shared inputs.
export type InvestmentNarrativeEvidenceState = "ready" | "unknown" | "stale" | "partial" | "conflict"

export type InvestmentNarrativeEvidencePolarity = "supports" | "challenges" | "unknown"

export type InvestmentNarrativeLayerRow = {
  evidence_id?: string
  pillar_id?: string | null
  entity_id?: string
  player?: string
  evidence_date?: string
  source_type?: string
  source_url?: string
  polarity?: InvestmentNarrativeEvidencePolarity
  explanation?: string
  as_of?: string
  recorded_at?: string
  freshness?: "current" | "stale" | "unknown"
  valid_until?: string | null
  state?: InvestmentNarrativeEvidenceState | "unlinked"
  limitations?: string[]
  source?: InvestmentNarrativeSource | null
}

export type InvestmentNarrativeLayerEvidenceItem = string | InvestmentNarrativeLayerRow

export type InvestmentNarrativeScorecardUpdate = {
  updated_at: string | null
  status: "evidence_updated_thesis_changed" | "evidence_updated_thesis_unchanged" | "reviewed_thesis_changed" | "reviewed_thesis_unchanged" | "evidence_pending_review" | "not_reviewed" | "unknown"
  scope: string[]
  document_updated_at: string | null
  state: InvestmentNarrativeState
  reason: string | null
  source: InvestmentNarrativeSource | null
}

export type InvestmentReadModelEnvelope = {
  schema_version: string
  artifact: string
  id: string
  as_of: string
  generated_at: string
  source_cutoff: string
  producer: string
  state: InvestmentReadState
  limitations: string[]
  sources: string[]
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
