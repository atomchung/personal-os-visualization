import {
  investmentHistory,
  investmentHistorySources,
  investmentNarrative,
  investmentResearch,
  investmentResearchDetails,
  investment as investmentData,
  investmentActions,
  investmentContext,
  market,
  pulse,
  marketExplore,
  twRelativeStrength,
  universe,
  leaders,
  watch,
  pending,
  momentum,
  quote,
  relativeStrength,
  STAMP,
} from "./fixtures.ts"
import { investmentScenario } from "./generated/investment-scenario.ts"
import type { InvestmentWork } from "../lib/investment.ts"
import { demoWorkState } from "./fixtures.ts"
import type {
  InvestmentCapabilityManifest,
  InvestmentHistory,
  InvestmentHistoryDetail,
  InvestmentNarrative,
  InvestmentProvider,
  InvestmentResearch,
  InvestmentResearchDetail,
  InvestmentData,
  InvestmentOptionalCapability,
  InvestmentOptionalPayloads,
  InvestmentMarketResource,
  InvestmentMarketPayloads,
  InvestmentRefreshAction,
  InvestmentRefreshStatus,
} from "../lib/investment.ts"

const available = { status: "available" as const, limitations: [] as string[] }
const partial = (limitations: string[]) => ({ status: "partial" as const, limitations })
export const demoInvestmentCapabilities: InvestmentCapabilityManifest = {
  today: available,
  judgment: partial(["Synthetic narrative may contain explicit unknown source fields."]),
  research: partial(["Synthetic Research entries preserve missing and unknown links."]),
  history: partial(["Synthetic history preserves incomplete source chains."]),
  market: partial(["Market coverage is limited to the reviewed synthetic fixture."]),
  watch: partial(["Watch data is a fixed synthetic sample."]),
  pending: partial(["Pending data is a fixed synthetic sample."]),
  actions: partial(["Standalone action rows are a fixed synthetic sample, not a canonical live action source."]),
  quote: available,
  "tw-relative-strength": available,
}

function researchDetail(itemId: string): InvestmentResearchDetail {
  const detail = Object.prototype.hasOwnProperty.call(investmentResearchDetails, itemId)
    ? investmentResearchDetails[itemId]
    : undefined
  if (detail) return detail
  return {
    schema_version: "1.0",
    artifact: "investment-research-detail",
    id: `research-detail:${itemId}`,
    as_of: investmentResearch.as_of,
    generated_at: investmentResearch.generated_at,
    source_cutoff: investmentResearch.source_cutoff,
    producer: investmentResearch.producer,
    state: "unavailable",
    limitations: ["找不到這段合成 Research 來源。"],
    sources: [],
    research: { item: null, detail: null },
  }
}

function historyDetail(itemId: string): InvestmentHistoryDetail {
  const source = Object.prototype.hasOwnProperty.call(investmentHistorySources, itemId)
    ? investmentHistorySources[itemId]
    : undefined
  if (source) return source
  return {
    schema_version: "1.0",
    artifact: "investment-history-detail",
    id: `history-detail:${itemId}`,
    as_of: investmentHistory.as_of,
    generated_at: investmentHistory.generated_at,
    source_cutoff: investmentHistory.source_cutoff,
    producer: investmentHistory.producer,
    state: "unavailable",
    limitations: ["找不到這段合成歷史來源。"],
    sources: [],
    history: { item: null },
  }
}

const refreshStates = new Map<InvestmentRefreshAction, InvestmentRefreshStatus>()
function refreshStatus(action: InvestmentRefreshAction): InvestmentRefreshStatus {
  return refreshStates.get(action) ?? { action, state: "idle", started_at: null, last_updated: null, message: "合成範例尚未重讀。", error: null, discovery_state: "idle", discovery_updated_at: null, trigger: null, new_update_count: null, sync_note: "Synthetic reference only", reconciled_at: null, provider: null, model: null, fallback_depth: null, provider_errors: {} }
}

export const demoInvestmentProvider: InvestmentProvider = {
  id: "synthetic-reference",
  capabilities: demoInvestmentCapabilities,
  async getToday(): Promise<InvestmentData> { return investmentData },
  async getJudgment(): Promise<InvestmentNarrative> { return investmentNarrative },
  async getOptional<K extends InvestmentOptionalCapability>(capability: K): Promise<InvestmentOptionalPayloads[K]> {
    switch (capability) {
      case "market": return market as InvestmentOptionalPayloads[K]
      case "watch": return watch as InvestmentOptionalPayloads[K]
      case "pending": return pending as InvestmentOptionalPayloads[K]
      case "actions": return investmentActions as InvestmentOptionalPayloads[K]
    }
  },
  async getResearch(): Promise<InvestmentResearch> { return investmentResearch },
  async getResearchDetail(itemId: string): Promise<InvestmentResearchDetail> { return researchDetail(itemId) },
  async getHistory(): Promise<InvestmentHistory> { return investmentHistory },
  async getHistoryDetail(itemId: string): Promise<InvestmentHistoryDetail> { return historyDetail(itemId) },
  async getMarketData<K extends InvestmentMarketResource>(resource: K, params?: { symbol?: string; refresh?: boolean; signal?: AbortSignal }): Promise<InvestmentMarketPayloads[K]> {
    switch (resource) {
      case "indicators": return market as InvestmentMarketPayloads[K]
      case "pulse": return pulse as InvestmentMarketPayloads[K]
      case "explore": return marketExplore as InvestmentMarketPayloads[K]
      case "tw-relative-strength": return twRelativeStrength as InvestmentMarketPayloads[K]
      case "momentum-universe": return universe as InvestmentMarketPayloads[K]
      case "momentum-leaders": return leaders as InvestmentMarketPayloads[K]
      case "quote":
      case "momentum":
        if (params?.symbol !== investmentScenario.symbol) throw new Error("只有合成標的可用。")
        return (resource === "quote" ? quote : momentum) as InvestmentMarketPayloads[K]
    }
  },
  async getRelativeStrength() { return relativeStrength },
  async getRefreshStatus(action) { return refreshStatus(action) },
  async startRefresh(action, marketScope) {
    const status: InvestmentRefreshStatus = { ...refreshStatus(action), state: action === "news" ? "no-change" : "success", started_at: STAMP, last_updated: STAMP, message: "只重讀合成範例；沒有連接或執行外部服務。", discovery_state: action === "market" ? "ready" : "idle", discovery_updated_at: action === "market" ? STAMP : null, scan_mode: action === "news" ? "quick" : null, market_scope: marketScope ?? null, new_update_count: 0 }
    refreshStates.set(action, status)
    return status
  },
  async getContext() { return investmentContext },
  async getSource(sourceId: string) {
    if (sourceId !== investmentScenario.source_id) throw new Error("NOT_FOUND: 找不到這份合成來源。")
    return { title: investmentScenario.source_title, date: investmentData.brief.date, text: `${investmentScenario.source_text}\n\n此文字由私人端的情境規格重新生成，未取自任何私人筆記、帳戶或市場來源。` }
  },
  async getPersonalWork() { return {items: demoWorkState.investmentWork.map(item => ({...item}))} },
  async addPersonalWork(data) {
    const existing = demoWorkState.investmentWork.find(item => item.kind === data.kind && item.text === data.text && item.source_id === (data.source_id ?? "")
      && (data.kind !== "watch" || (item.expires_on === data.expires_on && item.status !== "done")))
    if (existing) return existing
    const item: InvestmentWork = {id: `demo-work-${++demoWorkState.sequence}`, kind: data.kind, text: data.text.trim(), source_id: data.source_id ?? "", source_label: data.source_label ?? "", status: "open", conclusion: "", ...(data.kind === "watch" ? {expires_on: data.expires_on, promoted_to_today: false} : {}), version: 1, updated_at: investmentData.brief.generated_at ?? "unknown"}
    demoWorkState.investmentWork.push(item)
    return {...item}
  },
  async updatePersonalWork(data) {
    const index = demoWorkState.investmentWork.findIndex(item => item.id === data.id)
    const current = demoWorkState.investmentWork[index]
    if (!current || current.version !== data.version) throw new Error("範例工作版本已變更，請重新讀取。")
    const updated = {...data, version: current.version + 1}
    demoWorkState.investmentWork[index] = updated
    return {...updated}
  },
}
