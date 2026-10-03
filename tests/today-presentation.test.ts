import test, { after, before } from "node:test"
import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createServer, type ViteDevServer } from "vite"
import { currentTodayActionPlan } from "../src/lib/investmentFormat.ts"
import type { InvestmentTodayView } from "../src/lib/investment.ts"
import { syntheticBriefWithSameWording, syntheticIntradayUpdate, syntheticPresentationBrief, syntheticPresentationToday } from "./fixtures/today-presentation.ts"
import type { InvestmentTimelineNode } from "../src/lib/investment.ts"

let server: ViteDevServer
let previousLocation: PropertyDescriptor | undefined

before(async () => {
  previousLocation = Object.getOwnPropertyDescriptor(globalThis, "location")
  Object.defineProperty(globalThis, "location", { value: { origin: "http://localhost", hostname: "localhost" }, configurable: true })
  server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
})

after(async () => {
  await server.close()
  if (previousLocation) Object.defineProperty(globalThis, "location", previousLocation)
  else Reflect.deleteProperty(globalThis, "location")
})

async function renderTodayBrief(today: ReturnType<typeof syntheticPresentationToday> | undefined, readFailed = false, brief = syntheticPresentationBrief()): Promise<string> {
  const { TodayBrief } = await server.ssrLoadModule("/src/components/investment/InvestmentPage.tsx")
  const client = new QueryClient()
  client.setQueryData(["investment-narrative"], { news_events: null, catalysts_30d: null })
  return renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(TodayBrief, {
    b: brief,
    today,
    onOpenThesis: () => undefined,
    readFailed,
  })))
}

test("a valid projection keeps the formal judgment primary and labels the update with source identity and time", async () => {
  const brief = syntheticPresentationBrief()
  const today = syntheticPresentationToday()
  assert.equal(currentTodayActionPlan(brief, today).some(item => item.id === "synthetic-formal-action-1"), false,
    "the producer-declared same_action_id keeps the linked formal row represented by its judgment")
  const html = await renderTodayBrief(today, false, brief)
  assert.match(html, /aria-label="主要下一步"/)
  assert.match(html, /合成正式判斷原文：目前維持觀察。/)
  assert.match(html, /盤中補充觀察/)
  assert.match(html, /更新時間 2001\/02\/03 09:15 台北/)
  assert.match(html, /來源表示正式判斷不變/)
  assert.match(html, /版本與來源時間/)
  assert.match(html, /更新 ID synthetic-update-1/)
  assert.match(html, /story_id synthetic-story-1/)
  assert.match(html, /來源標記：正式判斷不變/)
  assert.match(html, /<p class="text-caption font-medium text-ink-2">盤中補充觀察<\/p>/)
  assert.doesNotMatch(html, /更新 ID：synthetic-update-1/)
  assert.match(html, /正式簡報 · 版次未標示/)
  assert.doesNotMatch(html, /盤中補充觀察取代正式判斷/)
})

test("refresh status reads show request failures instead of presenting them as idle", async () => {
  const { refreshStateLabel } = await server.ssrLoadModule("/src/components/investment/InvestmentPage.tsx")
  assert.match(refreshStateLabel("news", undefined), /狀態讀取中/)
  assert.match(refreshStateLabel("news", undefined, new Error("本機資料暫時無法讀取（503）")), /狀態讀取失敗：本機資料暫時無法讀取（503）/)
  assert.match(refreshStateLabel("news", { action: "news", state: "failed", started_at: null, last_updated: "2001-02-03T09:00:00+08:00",
    message: "Antigravity 權限遭拒", error: "permission_denied", discovery_state: "failed", discovery_updated_at: null,
    trigger: null, new_update_count: null, sync_note: "", reconciled_at: null, provider: "agy", model: "gemini-3.7-flash-high",
    fallback_depth: 0, provider_errors: { agy: "permission_denied" } }), /更新失敗：Antigravity 權限遭拒.*由 Antigravity 執行失敗/)
  assert.match(refreshStateLabel("news", { action: "news", state: "idle", started_at: null, last_updated: null,
    message: "", error: null, discovery_state: "idle", discovery_updated_at: null, trigger: null,
    new_update_count: null, sync_note: "", reconciled_at: null, provider: null, model: null,
    fallback_depth: null, provider_errors: {} }), /尚未更新/)
})

test("a missing Today projection leaves the formal source judgment readable without claiming there was no update", async () => {
  const html = await renderTodayBrief(undefined)
  assert.match(html, /合成正式判斷原文：目前維持觀察。/)
  assert.match(html, /正式簡報判斷 · 更新 08:01/)
  assert.doesNotMatch(html, /盤中補充觀察/)
  assert.doesNotMatch(html, /今天沒有新更新/)
})

test("only the exact per-market receipt readback can replace the formal Today judgment", async () => {
  const brief = { ...syntheticPresentationBrief(), session: "tw-open-prep" }
  const delta = {
    class: "watch" as const, judgment: "合成盤中重評：等待來源驗證。", why_now: "合成 verified event 改變短期判斷。",
    revisit: "下一份公開資料發布時", decision_effect: "若來源反轉則取消觀察。", provenance: { validated_story_ids: ["synthetic-story-1"],
      assessed_at: "2001-02-03T09:30:00+08:00", source_revision: "sha256:feed-v2", baseline_revision: "sha256:brief-v2",
      baseline_cutoff_at: "2001-02-03T08:00:00+08:00" },
  }
  const latest = { state: "reassessed", reason_code: null, reason: "合成重評", baseline_cutoff_at: "2001-02-03T08:00:00+08:00",
    assessed_at: "2001-02-03T09:30:00+08:00", source_revision: "sha256:feed-v2" }
  const today: InvestmentTodayView = {
    ...syntheticPresentationToday(),
    current_judgment: { market: "tw", state: "reassessed", baseline: { artifact: "wiki/morning/briefs/2001-02-03.md",
      revision: "sha256:brief-v2", source_cutoff: "2001-02-03T08:00:00+08:00" }, formal_judgment: brief.judgment!,
      effective_judgment: delta, current_delta: delta, effective_source: "last_successful_reassessment", latest_assessment: latest },
    intraday_refresh: { schema_version: "1.0", markets: { tw: { state: "ready", freshness: "current",
      baseline_cutoff: "2001-02-03T08:00:00+08:00", baseline_revision: "sha256:brief-v2", baseline_path: "wiki/morning/briefs/2001-02-03.md",
      input_cutoff: null, last_successful_cutoff: null, latest_receipt: null, last_successful_refresh: null,
      current_judgment: { state: "reassessed", current_delta: delta, latest_assessment: latest }, story_states: [], limitations: [] } },
      timeline_updates: [], updates: [], market_observations: [], limitations: [] },
  }
  const html = await renderTodayBrief(today, false, brief)
  assert.match(html, /已通過正式簡報版次與來源校驗/)
  assert.match(html, /合成盤中重評：等待來源驗證。/)
  assert.doesNotMatch(html, /合成正式判斷原文：目前維持觀察。/)
  assert.match(html, /已核對簡報內容版本：sha256:brief-v2/)
  assert.match(html, /重評完成：2001\/02\/03 09:30 台北/)

  const mismatch = structuredClone(today)
  mismatch.intraday_refresh!.markets.tw!.baseline_revision = "sha256:brief-v3"
  const mismatchHtml = await renderTodayBrief(mismatch, false, brief)
  assert.match(mismatchHtml, /回讀或判斷來源不完整/)
  assert.match(mismatchHtml, /合成正式判斷原文：目前維持觀察。/)
  assert.doesNotMatch(mismatchHtml, /合成盤中重評：等待來源驗證。/)
})

test("unchanged or pending current judgments preserve the formal brief", async () => {
  const brief = { ...syntheticPresentationBrief(), session: "us-open-prep" }
  const formal = brief.judgment!
  const pendingDelta = { class: "trade" as const, judgment: "不可套用的舊 delta", why_now: "舊版理由", revisit: null,
    decision_effect: null, provenance: null }
  for (const state of ["unchanged", "pending"] as const) {
    const latest = { state, reason_code: state === "pending" ? "baseline_mismatch" : null, reason: "合成測試", baseline_cutoff_at: "2001-02-03T08:00:00+00:00",
      assessed_at: "2001-02-03T09:30:00+00:00", source_revision: "sha256:feed" }
    const today: InvestmentTodayView = { ...syntheticPresentationToday(), current_judgment: {
      market: "us", state, baseline: { artifact: null, revision: "sha256:us-brief", source_cutoff: latest.baseline_cutoff_at },
      formal_judgment: formal, effective_judgment: formal, effective_source: "formal_baseline", current_delta: null, latest_assessment: latest,
    }, intraday_refresh: { schema_version: "1.0", markets: { us: { state: "ready", freshness: "current", baseline_cutoff: latest.baseline_cutoff_at,
      baseline_revision: "sha256:us-brief", input_cutoff: null, last_successful_cutoff: null, last_successful_refresh: null, latest_receipt: null,
      current_judgment: { state, current_delta: pendingDelta, latest_assessment: latest }, story_states: [], limitations: [] } },
      timeline_updates: [], updates: [], market_observations: [], limitations: [] } }
    const html = await renderTodayBrief(today, false, brief)
    assert.match(html, state === "unchanged" ? /目前資料不足以改變判斷/ : /待重新確認/)
    assert.match(html, /合成正式判斷原文：目前維持觀察。/)
    assert.doesNotMatch(html, /不可套用的舊 delta/)
  }
})

test("later quiet/unchanged scan states keep the last successful reassessment when source identity still matches", async () => {
  const brief = { ...syntheticPresentationBrief(), session: "tw-open-prep" }
  const delta = { class: "watch" as const, judgment: "合成先前有效重評", why_now: "合成先前來源理由",
    revisit: "下一個驗證點", decision_effect: "反證後回到基線", provenance: { assessed_at: "2001-02-03T09:30:00+08:00",
      source_revision: "sha256:feed-prior", baseline_revision: "sha256:brief-v2", baseline_cutoff_at: "2001-02-03T08:00:00+08:00",
      source_cutoff: "2001-02-03T09:00:00+08:00", validated_story_ids: ["prior-story"] } }
  for (const state of ["unchanged", "preserved"] as const) {
    const latest = { state, reason_code: null, reason: "合成後續快掃", baseline_cutoff_at: "2001-02-03T08:00:00+08:00",
      assessed_at: "2001-02-03T10:00:00+08:00", source_revision: "sha256:feed-latest" }
    const today: InvestmentTodayView = { ...syntheticPresentationToday(), current_judgment: {
      market: "tw", state, baseline: { artifact: null, revision: "sha256:brief-v2", source_cutoff: latest.baseline_cutoff_at },
      formal_judgment: brief.judgment!, effective_judgment: delta, effective_source: "last_successful_reassessment",
      current_delta: delta, latest_assessment: latest,
    }, intraday_refresh: { schema_version: "1.0", markets: { tw: { state: "ready", freshness: "current",
      baseline_cutoff: latest.baseline_cutoff_at, baseline_revision: "sha256:brief-v2", input_cutoff: null,
      last_successful_cutoff: null, last_successful_refresh: null, latest_receipt: null,
      current_judgment: { state, current_delta: delta, latest_assessment: latest }, story_states: [], limitations: [] } },
      timeline_updates: [], updates: [], market_observations: [], limitations: [] } }
    const html = await renderTodayBrief(today, false, brief)
    assert.match(html, /合成先前有效重評/)
    assert.match(html, state === "unchanged" ? /本次盤中重評維持原判斷/ : /未產生新的判斷變更/)
    assert.doesNotMatch(html, /合成正式判斷原文：目前維持觀察。/)
  }
})

test("a healthy quiet scan with no prior delta keeps the formal judgment without a false warning", async () => {
  const brief = { ...syntheticPresentationBrief(), session: "tw-open-prep" }
  const assessedAt = "2001-02-03T10:00:00+08:00"
  const sourceRevision = "sha256:quiet-feed"
  const baselineCutoff = "2001-02-03T08:00:00+08:00"
  const latest = { state: "preserved" as const, reason_code: null, reason: "No material change",
    baseline_cutoff_at: baselineCutoff, assessed_at: assessedAt, source_revision: sourceRevision }
  const today: InvestmentTodayView = { ...syntheticPresentationToday(), current_judgment: {
    market: "tw", state: "preserved", baseline: { artifact: null, revision: "sha256:brief-v2", source_cutoff: baselineCutoff },
    formal_judgment: brief.judgment!, effective_judgment: brief.judgment!, effective_source: "formal_baseline",
    current_delta: null, latest_assessment: latest,
  }, intraday_refresh: { schema_version: "1.0", markets: { tw: { state: "ready", freshness: "current",
    baseline_cutoff: baselineCutoff, baseline_revision: "sha256:brief-v2", input_cutoff: null,
    last_successful_cutoff: null, last_successful_refresh: null, latest_receipt: null,
    current_judgment: { state: "preserved", current_delta: null, latest_assessment: latest }, story_states: [], limitations: [] } },
    timeline_updates: [], updates: [], market_observations: [], limitations: [] } }
  const html = await renderTodayBrief(today, false, brief)
  assert.match(html, /本次掃描未產生新的判斷變更；沿用正式簡報判斷/)
  assert.match(html, /合成正式判斷原文：目前維持觀察。/)
  assert.doesNotMatch(html, /缺少可核對的來源版次/)
  assert.doesNotMatch(html, /盤中判斷未確認/)
})

test("missing receipt or delta identity fails closed without claiming reassessment", async () => {
  const brief = { ...syntheticPresentationBrief(), session: "tw-open-prep" }
  const base = syntheticPresentationToday()
  const delta = { class: "watch" as const, judgment: "不得套用缺 identity 的 delta", why_now: "缺少來源版次",
    revisit: "下一個驗證點", decision_effect: "反證後回到基線", provenance: { assessed_at: "2001-02-03T09:30:00+08:00",
      source_revision: "sha256:feed-v2", baseline_revision: "sha256:brief-v2", baseline_cutoff_at: "2001-02-03T08:00:00+08:00" } }
  const latest = { state: "unchanged" as const, reason_code: null, reason: "合成測試", baseline_cutoff_at: "2001-02-03T08:00:00+08:00",
    assessed_at: "2001-02-03T10:00:00+08:00", source_revision: "sha256:feed-latest" }
  const today: InvestmentTodayView = { ...base, current_judgment: { market: "tw", state: "unchanged",
    baseline: { artifact: null, revision: "sha256:brief-v2", source_cutoff: latest.baseline_cutoff_at },
    formal_judgment: brief.judgment!, effective_judgment: delta, current_delta: delta,
    effective_source: "last_successful_reassessment", latest_assessment: latest },
    intraday_refresh: { schema_version: "1.0", markets: { tw: { state: "ready", freshness: "current",
      baseline_cutoff: latest.baseline_cutoff_at, baseline_revision: "sha256:brief-v2", input_cutoff: null,
      last_successful_cutoff: null, last_successful_refresh: null, latest_receipt: null,
      current_judgment: { state: "unchanged", current_delta: structuredClone(delta), latest_assessment: latest },
      story_states: [], limitations: [] } }, timeline_updates: [], updates: [], market_observations: [], limitations: [] } }
  delete (today.current_judgment!.current_delta!.provenance as Record<string, unknown>).baseline_revision
  const html = await renderTodayBrief(today, false, brief)
  assert.match(html, /回讀或判斷來源不完整/)
  assert.doesNotMatch(html, /本次盤中重評維持原判斷/)
  assert.doesNotMatch(html, /不得套用缺 identity 的 delta/)

  const missing = structuredClone(today)
  missing.current_judgment!.baseline!.source_cutoff = null
  missing.intraday_refresh!.markets.tw!.baseline_cutoff = null
  const missingHtml = await renderTodayBrief(missing, false, brief)
  assert.doesNotMatch(missingHtml, /盤中新聞已完成重評/)
  assert.match(missingHtml, /回讀或判斷來源不完整/)
})

test("the same update reason appears once on the action card and as a reference in its timeline point", async () => {
  const html = await renderTodayBrief(syntheticPresentationToday())
  const reasonOccurrences = html.match(/合成盤中更新原因原文。/g) ?? []
  assert.equal(reasonOccurrences.length, 1)
  assert.match(html, /同一筆更新的原因已在上方行動列出。/)
  assert.match(html, /合成盤中補充觀察摘要。/)
})

test("the reason handoff requires an exact update ID and exact reason value", async () => {
  const { DayTimeline } = await server.ssrLoadModule("/src/components/investment/DayTimeline.tsx")
  const update = syntheticIntradayUpdate()
  const otherId: InvestmentTimelineNode = { ...update, id: "synthetic-other-update", kind: "update", at: update.source_cutoff! }
  const sameIdDifferentReason: InvestmentTimelineNode = { ...update, portfolio_impact: "合成另一個原因。", kind: "update", at: update.source_cutoff! }
  for (const node of [otherId, sameIdDifferentReason]) {
    const client = new QueryClient()
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(DayTimeline, {
      nodes: [node], hiddenUpdateReasons: new Map([[update.id, update.portfolio_impact]]),
    })))
    assert.match(html, /合成盤中更新原因原文。|合成另一個原因。/)
    assert.doesNotMatch(html, /同一筆更新的原因已在上方行動列出。/)
    client.clear()
  }
})

test("same wording from independent formal and intraday identities stays as two source rows", () => {
  const brief = syntheticBriefWithSameWording()
  const today = syntheticPresentationToday()
  const copiedText = syntheticIntradayUpdate().action
  const matchingRows = currentTodayActionPlan(brief, today).filter(item => item.text === copiedText)
  assert.deepEqual(matchingRows.map(item => [item.origin, item.id]), [
    ["update", "synthetic-update-1"],
    ["brief", "synthetic-independent-formal-action"],
  ])
})

test("a failed read labels and preserves the last-good formal and intraday rows", async () => {
  const brief = syntheticPresentationBrief()
  const html = await renderTodayBrief(syntheticPresentationToday(), true, brief)
  assert.match(html, /本次簡報讀取失敗；以下保留上次成功讀到的簡報與行動/)
  assert.match(html, /上次成功讀取的盤中補充觀察 · 更新時間 2001\/02\/03 09:15 台北/)
  assert.match(html, /上次成功讀取的正式簡報行動/)
  assert.match(html, /合成正式簡報行動：保留觀察，待來源條件確認後再評估。/)
  assert.match(html, /合成盤中提醒原文。/)
  assert.match(html, /上次讀取的判斷（目前未確認）/)
})
