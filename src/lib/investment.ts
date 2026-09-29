import {
  getSelectedModuleProvider,
  selectModuleProvider,
  type ModuleCapabilityDescriptor,
  type ModuleProviderBinding,
} from "./moduleProvider.ts"

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

export type InvestmentBriefJudgmentClass = "trade" | "watch" | "ignore"
export type InvestmentBriefJudgment = {
  class: InvestmentBriefJudgmentClass
  judgment: string | null
  why_now: string | null
  revisit: string | null
  decision_effect: string | null
  provenance?: {
    story_id?: string | null
    revision?: string | null
    source_ref?: string | null
    source_cutoff?: string | null
  } | null
}

export type InvestmentBrief = {
  state: InvestmentSourceState
  date: string | null
  generated_at: string | null
  source_cutoff: string | null
  session: string | null
  headline: string
  /** Producer-authored decision summary. Consumers must fall back to legacy actions if incomplete. */
  judgment?: InvestmentBriefJudgment | null
  market_pulse: { variable: string; latest: string; meaning: string }[]
  market_pulse_notes: string[]
  events: {
    /** Producer-owned identity for joining a formal event to its intraday updates. */
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
  envelope?: InvestmentEnvelope | null
  risks: { risk: string; event_ref: string; event_index: number | null; status: string }[]
  risk_notes: string[]
  source: InvestmentSource | null
}

export type InvestmentTodayUpdate = {
  id: string
  /** Producer-owned identity; absent IDs must remain unlinked in the UI. */
  story_id?: string | null
  observed_at: string
  summary: string
  portfolio_impact: string
  action: string
  relevance: ("decision-change" | "action-watch-change" | "new-price-discovery" | "ai-infra-readthrough")[]
  source_path: string
}

export type InvestmentTodayView = {
  state: "ready" | "partial" | "unavailable"
  decision_summary: string | null
  /** Source date for relative wording in decision_summary; null when the producer cannot establish it. */
  decision_summary_date?: string | null
  updates: InvestmentTodayUpdate[]
  limitations: string[]
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
export type InvestmentNarrativeLayerPlayer = {
  entity_id: string
  player: string
  recorded_at: string
  source: InvestmentNarrativeSource | null
}
export type InvestmentNarrativeLayerEvidenceItem = string | InvestmentNarrativeLayerRow
export type InvestmentOpposingCoverage = {
  state: "sufficient" | "insufficient" | "unavailable" | "unknown"
  checked_at: string | null
  scope: string | null
  reason: string
  source: InvestmentNarrativeSource
}
export type InvestmentNarrativeLayerReadingState = "ready" | "partial" | "unknown" | "conflict" | "drift"
export type InvestmentNarrativeLayerReading = {
  state: InvestmentNarrativeLayerReadingState
  text: string | null
  as_of: string | null
  basis: string | null
  authored_by: string
  layer_revision: string | null
  current_layer_revision: string | null
  limitations: string[]
  source: InvestmentNarrativeSource | null
}
export type InvestmentNarrativeLayerGap = {
  gap_id: string
  pillar_id: string
  missing: string
  closes_when: string
  expected_by: string | null
  expected_by_precision: "day" | "month" | null
  overdue: boolean
  state: InvestmentNarrativeEvidenceState | "drift"
  source: InvestmentNarrativeSource | null
}
export type InvestmentNarrativeEvidenceLayer = {
  layer_id: string
  pillar_id?: string | null
  label: string
  who_earns: string
  evidence_examples: string
  what_it_proves: string
  direction_state: "supports" | "challenges" | "mixed" | "unknown"
  link_state?: "linked" | "unlinked"
  state?: InvestmentNarrativeEvidenceState
  players?: InvestmentNarrativeLayerPlayer[]
  evidence?: InvestmentNarrativeLayerRow[]
  supporting?: InvestmentNarrativeLayerEvidenceItem[]
  opposing?: InvestmentNarrativeLayerEvidenceItem[]
  opposing_coverage?: InvestmentOpposingCoverage | null
  current_reading?: InvestmentNarrativeLayerReading | null
  gaps?: InvestmentNarrativeLayerGap[]
  challenging?: InvestmentNarrativeLayerEvidenceItem[]
  unknown?: InvestmentNarrativeLayerEvidenceItem[]
  conflicts?: InvestmentNarrativeLayerRow[]
  unlinked_evidence?: InvestmentNarrativeLayerRow[]
  unlinked_players?: InvestmentNarrativeLayerRow[]
  limitations?: string[]
  unknown_reason: string | null
  source_date: string | null
  document_updated: string | null
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
export type InvestmentNarrativeScorecardUpdate = {
  updated_at: string | null
  status: "evidence_updated_thesis_changed" | "evidence_updated_thesis_unchanged" | "reviewed_thesis_changed" | "reviewed_thesis_unchanged" | "evidence_pending_review" | "not_reviewed" | "unknown"
  scope: string[]
  document_updated_at: string | null
  state: InvestmentNarrativeState
  reason: string | null
  source: InvestmentNarrativeSource | null
}
export type InvestmentCatalystItem = {
  ticker: string
  type: string
  raw: string
  date_precision: "day" | "month" | "approximate_day" | "imprecise"
  date: string | null
  date_label: string | null
  source_qualifiers: string[] | string | null
  source: { path: string; line: number | null }
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
export type InvestmentNarrative = {
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

export type InvestmentSourceText = {
  title: string
  date: string | null
  text: string
}

export type InvestmentReadState = "ready" | "empty" | "unknown" | "partial" | "stale" | "unavailable" | "conflict"

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

/** Capability coverage is reported by the selected module provider, never inferred by UI. */
export type InvestmentCapabilityStatus = "available" | "partial" | "unavailable"
export type InvestmentCapabilityName =
  | "today"
  | "judgment"
  | "research"
  | "history"
  | "market"
  | "watch"
  | "pending"
  | "actions"
  | "quote"
  | "tw-relative-strength"

export type InvestmentCapability = {
  status: InvestmentCapabilityStatus
  limitations: string[]
}

export type InvestmentCapabilityManifest = Record<InvestmentCapabilityName, InvestmentCapability>

export type InvestmentOptionalPayloads = {
  market: InvestmentMarket
  watch: InvestmentWatch
  pending: InvestmentPending
  actions: InvestmentActions
}
export type InvestmentOptionalCapability = keyof InvestmentOptionalPayloads
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

/** The shared Investment module boundary. Implementations provide typed read models and lookups. */
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
  getMarketData?<K extends InvestmentMarketResource>(resource: K, params?: { symbol?: string; refresh?: boolean; signal?: AbortSignal }): Promise<InvestmentMarketPayloads[K]>
}

declare global {
  interface Window {
    /** Test-only hook installed by browser regression harnesses; absent in normal use. */
    __investmentReadHook?: (value: unknown) => unknown | Promise<unknown>
  }
}

export interface InvestmentProviderBase {
  readonly id: string
  readonly capabilities: InvestmentCapabilityManifest
}

export type InvestmentProviderRuntime = InvestmentProviderBase & Partial<InvestmentProvider>

export function unavailableCapability(limitations: string[]): InvestmentCapability {
  return { status: "unavailable", limitations: [...limitations] }
}

export function requireInvestmentCapability(
  provider: InvestmentProviderRuntime,
  capability: InvestmentCapabilityName,
): void {
  const declared = provider.capabilities[capability]
  if (declared.status === "unavailable") {
    throw new Error(declared.limitations.join(" ") || `Investment capability '${capability}' is ${declared.status}.`)
  }
}

export function requireAvailableCapability(capability: InvestmentCapabilityName): void {
  const status = getSelectedInvestmentProvider().capabilities[capability].status
  if (status !== "available") requireInvestmentCapability(getSelectedInvestmentProvider(), capability)
}

const INVESTMENT_MODULE_ID = "investment" as const
const INVESTMENT_MODULE_SURFACES = ["today", "judgment", "research", "history"] as const

/** Bind the existing Investment provider to the common metadata/selection shell. */
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

/** Explicit browser-test seam for exercising degraded read models after provider selection. */
async function applyInvestmentReadHook<T>(payload: T): Promise<T> {
  if (typeof window === "undefined") return payload
  const hook = (window as Window & { __investmentReadHook?: (value: unknown) => unknown | Promise<unknown> }).__investmentReadHook
  return hook ? await hook(structuredClone(payload)) as T : payload
}

export function setInvestmentProvider(provider: InvestmentProviderRuntime): void {
  selectModuleProvider(bindInvestmentProvider(provider))
}

export function getSelectedInvestmentProvider(): InvestmentProviderRuntime {
  return getSelectedModuleProvider<InvestmentProviderRuntime>(INVESTMENT_MODULE_ID).provider
}

function optionalCapability<K extends InvestmentOptionalCapability>(
  capability: K,
  signal?: AbortSignal,
): Promise<InvestmentOptionalPayloads[K]> {
  const provider = getSelectedInvestmentProvider()
  const declared = provider.capabilities[capability]
  if (declared.status === "unavailable") {
    return Promise.reject(new Error(declared.limitations.join(" ") || `Investment capability '${capability}' is unavailable.`))
  }
  if (!provider.getOptional) return Promise.reject(new Error(`Investment capability '${capability}' has no provider implementation.`))
  return provider.getOptional(capability, signal).then(applyInvestmentReadHook)
}

function marketData<K extends InvestmentMarketResource>(
  resource: K,
  params?: { symbol?: string; refresh?: boolean; signal?: AbortSignal },
): Promise<InvestmentMarketPayloads[K]> {
  const provider = getSelectedInvestmentProvider()
  const declared = provider.capabilities.market
  if (declared.status === "unavailable") {
    return Promise.reject(new Error(declared.limitations.join(" ") || "Investment market capability is unavailable."))
  }
  if (!provider.getMarketData) return Promise.reject(new Error("Investment market capability has no provider implementation."))
  return provider.getMarketData(resource, params).then(applyInvestmentReadHook)
}

function coreRead<T>(
  capability: "today" | "judgment" | "research" | "history",
  read: () => Promise<T> | undefined,
  unavailableMessage: string,
): Promise<T> {
  const provider = getSelectedInvestmentProvider()
  try {
    requireInvestmentCapability(provider, capability)
  } catch (error) {
    return Promise.reject(error)
  }
  return (read() ?? Promise.reject(new Error(unavailableMessage))).then(applyInvestmentReadHook)
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

export type InvestmentResearch = InvestmentReadModelEnvelope & {
  artifact: "investment-research-index"
  id: "research-index"
  research: { items: InvestmentResearchItem[]; count: number; direction_groups?: InvestmentResearchDirectionGroups }
}

export type InvestmentResearchDetail = InvestmentReadModelEnvelope & {
  artifact: "investment-research-detail"
  research: {
    item: InvestmentResearchItem | null
    detail: { text?: string; what?: string; due?: string } | null
    conflicts?: InvestmentResearchItem[]
  }
}

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

export type InvestmentHistory = InvestmentReadModelEnvelope & {
  artifact: "investment-history-index"
  id: "history-index"
  history: { items: InvestmentHistoryItem[]; count: number }
}

export type InvestmentHistoryDetail = InvestmentReadModelEnvelope & {
  artifact: "investment-history-detail"
  history: {
    item: InvestmentHistoryDetailItem | null
    source_text?: string | null
    conflicts?: InvestmentHistoryDetailItem[]
  }
}

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

export type TwRelativeStrengthHolding = {
  symbol: string
  market: "tw"
  exchange: "TWSE" | "TPEx" | null
  provider_symbol: string | null
  as_of: string | null
  window_start: string | null
  window_trading_days: number
  state: "partial" | "unavailable"
  reason_codes: string[]
  limitations: string[]
  market_rs_pp: number | null
  market_benchmark: { id: string; label: string }
  peer_rs_pp: null
  peer_group: null
  coverage: { expected_sessions: number; holding_sessions: number }
  price_source: string
  benchmark_source: string
}
export type TwRelativeStrength = {
  schema_version: string
  artifact: "tw-holdings-relative-strength"
  id: string
  market: "tw"
  state: "partial" | "unavailable"
  as_of: string
  requested_date: string | null
  read_at: string | null
  generated_at: string
  source_cutoff: string
  producer: string
  window_trading_days: number
  limitations: string[]
  sources: string[]
  holdings: TwRelativeStrengthHolding[]
}

export type InvestmentMarket = {
  fetched_at: string
  state: "ready" | "partial" | "unavailable"
  cached: boolean
  active: boolean
  items: {
    symbol: string
    /** Producer-owned market membership; the UI must not infer it from a ticker or label. */
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
    state: "available" | "stale" | "unavailable"
    error: string | null
    source_url: string
  }[]
}

export type InvestmentMarketPulse = {
  as_of: string | null
  /** Requested market session; the producer owns trading-calendar resolution. */
  requested_date?: string | null
  /** Independently reported source dates; do not infer a shared session. */
  source_dates?: { twse?: string | null; tpex?: string | null } | null
  generated_at: string | null
  source_cutoff: string | null
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
  /** Producer diagnostics from the separate after-close feed. */
  flow?: {
    as_of?: string | null
    index_close?: number | null
    index_change?: number | null
    limitations?: string[]
  } | null
  breadth: {
    combined: { up: number | null; down: number | null; flat: number | null; limit_up: number | null; limit_down: number | null }
    advancer_ratio: number | null
  }
  turnover: { combined_stock: number | null }
  themes: {
    label: string
    strongest: { theme: string; avg_change_pct: number | null }[]
    weakest: { theme: string; avg_change_pct: number | null }[]
  }
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

export type InvestmentWatch = InvestmentReadModelEnvelope & {
  artifact: "investment-watch"
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

export const getInvestmentActions = (signal?: AbortSignal) =>
  optionalCapability("actions", signal)

export const getInvestmentMarket = (signal?: AbortSignal, refresh = false) =>
  marketData("indicators", {signal, refresh})

/** Canonical Taiwan session-aligned holdings RS; never calculated by the consumer. */
export const getTwRelativeStrength = (signal?: AbortSignal) =>
  (requireAvailableCapability("tw-relative-strength"), marketData("tw-relative-strength", {signal}))

export const getInvestmentPulse = (signal?: AbortSignal) =>
  marketData("pulse", {signal})

/** Explore scans can be slow; only this getter uses the longer bound. */
export const getMarketExplore = (signal?: AbortSignal, refresh = false) =>
  marketData("explore", {signal, refresh})

export const getMomentumUniverse = (signal?: AbortSignal) =>
  marketData("momentum-universe", {signal})

export const getMomentumLeaders = (signal?: AbortSignal, refresh = false) =>
  marketData("momentum-leaders", {signal, refresh})

export async function getStockMomentum(symbol: string, signal?: AbortSignal, refresh = false): Promise<StockMomentumData> {
  const release = await acquireMomentumSlot(signal)
  try {
    const provider = getSelectedInvestmentProvider()
    requireInvestmentCapability(provider, "market")
    if (!provider.getMarketData) throw new Error("Investment market capability has no implementation.")
    return await provider.getMarketData("momentum", {symbol, signal, refresh}).then(applyInvestmentReadHook)
  } finally {
    release()
  }
}

export async function getStockQuote(symbol: string, signal?: AbortSignal, refresh = false): Promise<StockQuote> {
  const release = await acquireMomentumSlot(signal)
  try {
    const provider = getSelectedInvestmentProvider()
    requireInvestmentCapability(provider, "quote")
    if (!provider.getMarketData) throw new Error("Investment market capability has no implementation.")
    return await provider.getMarketData("quote", {symbol, signal, refresh}).then(applyInvestmentReadHook)
  } finally {
    release()
  }
}

export const getInvestmentCapability = (capability: InvestmentCapabilityName): InvestmentCapability =>
  getSelectedInvestmentProvider().capabilities[capability]

export const getInvestmentWatch = (signal?: AbortSignal) =>
  optionalCapability("watch", signal)

export const getInvestmentResearch = (signal?: AbortSignal) =>
  coreRead("research", () => getSelectedInvestmentProvider().getResearch?.(signal), "Investment research capability has no provider implementation.")

export const getInvestmentResearchDetail = (itemId: string, signal?: AbortSignal) =>
  coreRead("research", () => getSelectedInvestmentProvider().getResearchDetail?.(itemId, signal), "Investment research detail capability is unavailable.")

export const getInvestmentSource = (id: string, signal?: AbortSignal) =>
  getSelectedInvestmentProvider().getSource?.(id, signal)
    ?? Promise.reject(new Error("Investment source detail capability is unavailable."))

export const getInvestmentHistory = (signal?: AbortSignal) =>
  coreRead("history", () => getSelectedInvestmentProvider().getHistory?.(signal), "Investment history capability has no provider implementation.")

export const getInvestmentHistorySource = (id: string, signal?: AbortSignal) =>
  coreRead("history", () => getSelectedInvestmentProvider().getHistoryDetail?.(id, signal), "Investment history detail capability is unavailable.")

export const getInvestmentContext = (signal?: AbortSignal) =>
  getSelectedInvestmentProvider().getContext?.(signal)
    ?? Promise.reject(new Error("Investment context capability is unavailable."))

/** Optional pending read model; each block retains its producer-owned status. */
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

export type InvestmentPending = InvestmentReadModelEnvelope & {
  artifact: "investment-pending"
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
  /** Only manual reminders use an expiry; legacy rows may omit it. */
  expires_on?: string;
  /** Explicitly promoted personal reminders remain visible on Today. */
  promoted_to_today?: boolean;
}
export const getInvestmentWork = () =>
  (getSelectedInvestmentProvider().getPersonalWork?.() ?? Promise.reject(new Error("Investment work capability is unavailable.")))
    .then(applyInvestmentReadHook)
export const addInvestmentWork = (data: {kind: InvestmentWork["kind"]; text: string; source_id?: string; source_label?: string; expires_on?: string}) =>
  getSelectedInvestmentProvider().addPersonalWork?.(data) ?? Promise.reject(new Error("Investment work writes are unavailable."))
export const saveInvestmentWork = (data: InvestmentWork) =>
  getSelectedInvestmentProvider().updatePersonalWork?.(data) ?? Promise.reject(new Error("Investment work writes are unavailable."))
