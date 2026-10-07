import test, { after, before } from "node:test"
import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createServer, type ViteDevServer } from "vite"
import { currentTodayActionPlan, newsRefreshResultsConfirmed, newsScanNote } from "../src/lib/investmentFormat.ts"
import { getInvestmentRefreshStatus, postInvestmentRefresh, getSelectedInvestmentProvider, rereadInvestmentRefreshStatuses, setInvestmentProvider, type InvestmentTodayView, type InvestmentRefreshStatus } from "../src/lib/investment.ts"
import { demoInvestmentProvider } from "../src/demo/investmentProvider.ts"
import { syntheticBriefWithSameWording, syntheticJudgmentUpdate, syntheticIntradayUpdate, syntheticPresentationBrief, syntheticPresentationToday, syntheticIntradayReading, syntheticBothRefresh } from "./fixtures/today-presentation.ts"
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

function receiptFor(latest: { assessed_at: string | null; baseline_cutoff_at: string | null }, revision: string, result = "updated") {
  return { result, coverage_state: "complete", finished_at: latest.assessed_at,
    baseline_cutoff_at: latest.baseline_cutoff_at, baseline_artifact_sha256: revision.replace(/^sha256:/, "") }
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
  assert.match(html, /跨市場 · 消息快掃 · 完成 2001\/02\/03 09:15 台北/)
  assert.match(html, /來源標記：正式判斷不變/)
  assert.match(html, /版本與來源時間/)
  assert.match(html, /更新 ID synthetic-update-1/)
  assert.match(html, /story_id synthetic-story-1/)
  assert.match(html, /來源標記：正式判斷不變/)
  assert.match(html, /aria-label="盤中更新"/)
  assert.doesNotMatch(html, /更新 ID：synthetic-update-1/)
  assert.match(html, /正式簡報 · 版次未標示/)
  assert.doesNotMatch(html, /盤中補充觀察取代正式判斷/)
})

test("refresh status reads show request failures instead of presenting them as idle", async () => {
  const { refreshStateLabel } = await server.ssrLoadModule("/src/components/investment/InvestmentPage.tsx")
  assert.match(refreshStateLabel("news", undefined), /狀態讀取中/)
  assert.match(refreshStateLabel("news", undefined, new Error("本機資料暫時無法讀取（503）")), /狀態讀取失敗：本機資料暫時無法讀取（503）/)
  assert.match(refreshStateLabel("market", { action: "market", state: "partial", started_at: null, last_updated: "2001-02-03T09:00:00+08:00",
    message: "7 項報價可用；另有來源未完成", error: null, discovery_state: "partial", discovery_updated_at: null,
    trigger: null, new_update_count: null, sync_note: "", reconciled_at: null, provider: null, model: null,
    fallback_depth: null, provider_errors: {} }), /盤面部分完成：7 項報價可用；另有來源未完成/)
  assert.match(refreshStateLabel("news", { action: "news", state: "failed", started_at: null, last_updated: "2001-02-03T09:00:00+08:00",
    message: "Antigravity 權限遭拒", error: "permission_denied", discovery_state: "failed", discovery_updated_at: null,
    trigger: null, new_update_count: null, sync_note: "", reconciled_at: null, provider: "agy", model: "gemini-3.7-flash-high",
    fallback_depth: 0, provider_errors: { agy: "permission_denied" } }), /更新失敗：Antigravity 權限遭拒.*由 Antigravity 執行失敗/)
  const partialNewsStatus = (model_work_state: "failed" | "completed" | null): InvestmentRefreshStatus => ({
    action: "news", state: "partial", started_at: null, last_updated: "2026-10-06T21:20:00+08:00",
    message: "合成快掃部分完成，來源覆蓋仍不完整", error: null, discovery_state: "idle", discovery_updated_at: null,
    trigger: null, new_update_count: null, sync_note: "", reconciled_at: null, provider: "agy", model: "gemini-3.7-flash-high",
    fallback_depth: 0, provider_errors: {}, model_work_state, market_scope: "us", scan_mode: "quick",
  })
  const failedPartial = refreshStateLabel("news", partialNewsStatus("failed"))
  assert.match(failedPartial, /部分完成：合成快掃部分完成，來源覆蓋仍不完整.*由 Antigravity 執行失敗/)
  assert.doesNotMatch(failedPartial, /由 Antigravity 完成/)
  const unknownPartial = refreshStateLabel("news", partialNewsStatus(null))
  assert.match(unknownPartial, /由 Antigravity 執行狀態未知/)
  assert.doesNotMatch(unknownPartial, /由 Antigravity 完成/)
  assert.match(refreshStateLabel("news", partialNewsStatus("completed")), /由 Antigravity 已回傳結果，更新未完成/)
  assert.match(refreshStateLabel("news", { action: "news", state: "idle", started_at: null, last_updated: null,
    message: "", error: null, discovery_state: "idle", discovery_updated_at: null, trigger: null,
    new_update_count: null, sync_note: "", reconciled_at: null, provider: null, model: null,
    fallback_depth: null, provider_errors: {} }), /尚未更新/)
})

test("operational refresh details stay folded while running and degraded outcomes use one short indicator", async () => {
  const { InvestmentRefreshDetails } = await server.ssrLoadModule("/src/components/investment/InvestmentPage.tsx")
  const rawMessage = "Synthetic internal partial/null reconciliation and source adapter explanation."
  const status: InvestmentRefreshStatus = {
    action: "news", state: "no-change", started_at: "2001-02-03T09:30:12+08:00", last_updated: "2001-02-03T10:00:34+08:00",
    message: rawMessage, error: null, discovery_state: "idle", discovery_updated_at: null, trigger: null,
    new_update_count: 0, sync_note: "Synthetic sync receipt", reconciled_at: null, provider: "agy", model: "synthetic-model",
    fallback_depth: 0, provider_errors: { agy: "synthetic-provider-error" }, market_scope: "tw", scan_mode: "quick", duration_seconds: 90,
  }
  const { today } = syntheticJudgmentUpdate("preserved")
  for (const state of [undefined, "idle", "running", "failed", "partial", "no-change"] as const) {
    const newsStatus = state ? { ...status, state, error: state === "failed" ? "synthetic-failure-code" : null } : undefined
    const html = renderToStaticMarkup(createElement(InvestmentRefreshDetails, { newsStatus, refresh: today.intraday_refresh, readFailed: false }))
    const collapsed = html.slice(0, html.indexOf("<details"))
    assert.match(html, /<summary[^>]*>更新紀錄與來源回執<\/summary>/)
    assert.doesNotMatch(collapsed, /partial\/null|synthetic-model|synthetic-provider-error|合成.*增量|總耗時|Antigravity|2001-/)
    assert.equal((collapsed.match(/role="status"/g) ?? []).length, state === "running" || state === "failed" || state === "partial" ? 1 : 0)
    if (state === "running") assert.match(collapsed, /進行中/)
    if (state === "failed") assert.match(collapsed, /台股快掃失敗/)
    if (state === "partial") assert.match(collapsed, /台股快掃部分完成/)
    if (newsStatus) {
      assert.ok(html.includes(rawMessage))
      assert.ok(html.includes(status.started_at!))
      assert.ok(html.includes(status.last_updated!))
      assert.match(html, /synthetic-model|synthetic-provider-error/)
    }
  }
  const failureHtml = renderToStaticMarkup(createElement(InvestmentRefreshDetails, { newsStatus: status,
    newsError: new Error("Synthetic raw status-read diagnostic"), operationError: "Synthetic raw start diagnostic", readFailed: false }))
  const failureMain = failureHtml.slice(0, failureHtml.indexOf("<details"))
  assert.match(failureMain, /更新操作失敗 · 台股快掃狀態讀取失敗/)
  assert.doesNotMatch(failureMain, /Synthetic raw/)
  assert.match(failureHtml, /Synthetic raw status-read diagnostic|Synthetic raw start diagnostic/)
  for (const result of ["failed", "partial"] as const) {
    const refresh = structuredClone(today.intraday_refresh!)
    refresh.markets.tw!.latest_receipt!.coverage_state = result
    const html = renderToStaticMarkup(createElement(InvestmentRefreshDetails, { newsStatus: status, refresh, readFailed: false }))
    assert.match(html.slice(0, html.indexOf("<details")), result === "failed" ? /台股快掃失敗/ : /台股快掃部分完成/)
  }
  for (const state of ["not_requested", "failed", "partial"] as const) {
    const refresh = structuredClone(today.intraday_refresh!)
    refresh.markets.us = { ...structuredClone(refresh.markets.tw!), state, freshness: "stale" }
    if (state === "not_requested") refresh.markets.us.latest_receipt!.coverage_state = "failed"
    else refresh.markets.us.latest_receipt = null
    const html = renderToStaticMarkup(createElement(InvestmentRefreshDetails, { newsStatus: status, refresh, readFailed: false }))
    assert.doesNotMatch(html.slice(0, html.indexOf("<details")), /role="status"|美股快掃/)
  }
})

test("manual refresh-status reread invokes both read getters and never starts a refresh", async () => {
  const originalProvider = getSelectedInvestmentProvider()
  const reads: string[] = []
  let writes = 0
  setInvestmentProvider({
    ...demoInvestmentProvider,
    async getRefreshStatus(action) {
      reads.push(`status:${action}`)
      return { action, state: "failed" } as InvestmentRefreshStatus
    },
    async startRefresh() {
      writes += 1
      throw new Error("status reread must not start refresh")
    },
  })
  try {
    await rereadInvestmentRefreshStatuses(
      () => getInvestmentRefreshStatus("market"),
      () => getInvestmentRefreshStatus("news"),
    )
    assert.deepEqual(reads, ["status:market", "status:news"])
    assert.equal(writes, 0)
  } finally {
    setInvestmentProvider(originalProvider)
  }
})

test("a both-market completion requires each supplied result and saved receipt, without amending parent state", () => {
  for (const fault of ["none", "missing", "unknown", "unavailable", "invalid", "unsaved", "wrong-scope", "mixed"] as const) {
    const status = syntheticBothRefresh()
    if (fault === "missing") delete status.markets!.us
    if (fault === "unknown" || fault === "unavailable") status.markets!.us!.state = fault
    if (fault === "invalid") Object.assign(status.markets!.us!, { state: "unrecognized" })
    if (fault === "unsaved") status.markets!.us!.receipt_write_state = "unchanged"
    if (fault === "wrong-scope") status.markets!.us!.market_scope = "tw"
    if (fault === "mixed") status.markets!.us!.state = "success"
    assert.equal(newsRefreshResultsConfirmed(status), fault === "none", fault)
    assert.equal(status.state, "no-change")
    assert.match(newsScanNote(status, "2001-02-03T08:00:00+08:00")!, fault === "none" ? /台美消息快掃/ : /結果未完整確認/)
  }
  const success = syntheticBothRefresh()
  success.state = "success"
  success.markets!.us!.state = "success"
  success.markets!.us!.news_write_state = "already_present"
  success.markets!.tw!.receipt_write_state = "already_present"
  assert.equal(newsRefreshResultsConfirmed(success), true)
  success.markets!.us!.news_write_state = "unknown"
  assert.equal(newsRefreshResultsConfirmed(success), false)
})

test("one-job details preserve mixed outcomes, market clocks and cached-read warnings without old receipt inference", async () => {
  const { InvestmentRefreshDetails } = await server.ssrLoadModule("/src/components/investment/InvestmentPage.tsx")
  for (const scenario of ["running", "partial", "failed", "malformed", "read-failed"] as const) {
    const status = syntheticBothRefresh()
    if (scenario === "running") { status.state = "running"; status.markets!.us!.state = "running" }
    if (scenario === "partial") { status.state = "partial"; status.markets!.us!.state = "unavailable" }
    if (scenario === "failed") { status.state = "failed"; status.markets!.tw!.state = "failed"; status.markets!.us!.state = "failed" }
    if (scenario === "malformed") delete status.markets!.us
    const { today } = syntheticJudgmentUpdate("preserved")
    const html = renderToStaticMarkup(createElement(InvestmentRefreshDetails, { newsStatus: status,
      newsError: scenario === "read-failed" ? new Error("Synthetic status read failure") : null, refresh: today.intraday_refresh, readFailed: false }))
    const main = html.slice(0, html.indexOf("<details"))
    assert.doesNotMatch(main, /資料截止時間已更新|重要增量|2001-/)
    assert.match(main, scenario === "running" ? /消息更新進行中.*台股未發現重要新事件.*美股更新中/
      : scenario === "partial" ? /消息更新部分完成/ : scenario === "failed" ? /消息更新失敗/
        : scenario === "malformed" ? /消息更新結果未完整確認/ : /狀態讀取失敗/)
    if (scenario !== "failed") assert.match(html, /台股 · 未發現重要新事件/)
    if (scenario === "partial") assert.match(html, /美股 · 來源無法取得/)
    if (scenario === "read-failed") assert.match(html, /上次回報的分市場結果，目前尚未確認/)
    if (scenario !== "malformed") assert.ok(html.includes("2001/02/02 21:15 台北"))
    assert.ok(html.includes("2001/02/03 08:00 台北"))
  }
})

test("saved candidate results remain pending in completed and mixed progress without overriding unknown or cached states", async () => {
  const { InvestmentRefreshDetails } = await server.ssrLoadModule("/src/components/investment/InvestmentPage.tsx")
  for (const scenario of ["completed", "running", "unknown", "unsaved", "read-failed", "verified"] as const) {
    const status = syntheticBothRefresh()
    status.state = "success"
    status.new_update_count = 1
    Object.assign(status.markets!.tw!, { state: "success", intraday_result: "needs_deeper_analysis", news_write_state: "written",
      current_judgment_readback: { state: "pending" } })
    if (scenario === "running") { status.state = "running"; status.markets!.us!.state = "running" }
    if (scenario === "unknown") status.markets!.us!.state = "unknown"
    if (scenario === "unsaved") status.markets!.tw!.receipt_write_state = "unchanged"
    if (scenario === "verified") Object.assign(status.markets!.tw!, {
      intraday_result: "updated", message: "Synthetic prose mentions needs_deeper_analysis; it is not a result field.",
    })
    const source = structuredClone(status)
    const html = renderToStaticMarkup(createElement(InvestmentRefreshDetails, { newsStatus: status,
      newsError: scenario === "read-failed" ? new Error("Synthetic cached read failure") : null, readFailed: false }))
    const main = html.slice(0, html.indexOf("<details"))
    if (scenario === "completed") assert.match(main, /消息已保存，仍有候選待確認/)
    if (scenario === "running") assert.match(main, /消息更新進行中.*台股已保存，仍有候選待確認.*美股更新中/)
    if (scenario === "unknown" || scenario === "unsaved") {
      assert.match(main, /消息更新結果未完整確認/)
      assert.doesNotMatch(main, /消息已保存/)
    }
    if (scenario === "read-failed") {
      assert.match(main, /消息更新狀態讀取失敗/)
      assert.match(html, /上次回報的分市場結果，目前尚未確認/)
    }
    if (scenario === "verified") {
      assert.doesNotMatch(html, /仍有候選待確認/)
      assert.match(html, /台股 · 更新完成/)
    } else if (scenario === "unsaved") assert.match(html, /台股 · 結果未確認/)
    else assert.match(html, /台股 · 已保存，仍有候選待確認/)
    const note = newsScanNote(status, "2001-02-03T08:00:00+08:00")
    if (scenario === "completed") assert.match(note!, /已保存，仍有候選待確認/)
    if (scenario === "unknown" || scenario === "unsaved") assert.match(note!, /結果未完整確認/)
    if (scenario === "verified") assert.match(note!, /有 1 則新消息/)
    assert.deepEqual(status, source, "presentation must not amend raw source state or readback")
  }
})

test("the selected reference provider receives one both-market operation with two explicit synthetic results", async () => {
  const original = getSelectedInvestmentProvider()
  const calls: unknown[] = []
  setInvestmentProvider({ ...demoInvestmentProvider, async startRefresh(action, market) {
    calls.push([action, market])
    return demoInvestmentProvider.startRefresh!(action, market)
  } })
  try {
    const status = await postInvestmentRefresh("news", "both")
    assert.deepEqual(calls, [["news", "both"]])
    assert.deepEqual(status.requested_markets, ["tw", "us"])
    assert.equal(newsRefreshResultsConfirmed(status), true)
    assert.equal(status.markets!.tw!.market_scope, "tw")
    assert.equal(status.markets!.us!.market_scope, "us")
  } finally { setInvestmentProvider(original) }
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
      input_cutoff: null, last_successful_cutoff: null, latest_receipt: receiptFor(latest, "sha256:brief-v2"), last_successful_refresh: null,
      current_judgment: { state: "reassessed", current_delta: delta, latest_assessment: latest }, story_states: [], limitations: [] } },
      timeline_updates: [], updates: [], market_observations: [], limitations: [] },
  }
  const html = await renderTodayBrief(today, false, brief)
  assert.match(html, /判斷已更新 · 行動仍是觀察/)
  assert.match(html, /合成盤中重評：等待來源驗證。/)
  assert.match(html, /aria-label="原先判斷"[\s\S]*合成正式判斷原文：目前維持觀察。/)
  assert.match(html, /已核對簡報內容版本：sha256:brief-v2/)
  assert.match(html, /重評完成：2001\/02\/03 09:30 台北/)

  const mismatch = structuredClone(today)
  mismatch.intraday_refresh!.markets.tw!.baseline_revision = "sha256:brief-v3"
  const mismatchHtml = await renderTodayBrief(mismatch, false, brief)
  assert.match(mismatchHtml, /本次無法確認，保留既有判斷/)
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
      baseline_revision: "sha256:us-brief", input_cutoff: null, last_successful_cutoff: null, last_successful_refresh: null, latest_receipt: receiptFor(latest, "sha256:us-brief"),
      current_judgment: { state, current_delta: pendingDelta, latest_assessment: latest }, story_states: [], limitations: [] } },
      timeline_updates: [], updates: [], market_observations: [], limitations: [] } }
    const html = await renderTodayBrief(today, false, brief)
    assert.match(html, state === "unchanged" ? /已重評，判斷維持不變/ : /本次無法確認/)
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
      last_successful_cutoff: null, last_successful_refresh: null, latest_receipt: receiptFor(latest, "sha256:brief-v2"),
      current_judgment: { state, current_delta: delta, latest_assessment: latest }, story_states: [], limitations: [] } },
      timeline_updates: [], updates: [], market_observations: [], limitations: [] } }
    const html = await renderTodayBrief(today, false, brief)
    assert.match(html, /合成先前有效重評/)
    assert.match(html, state === "unchanged" ? /已重評，判斷維持不變/ : /沿用既有判斷/)
    assert.match(html, /aria-label="原先判斷"[\s\S]*合成正式判斷原文：目前維持觀察。/)
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
    last_successful_cutoff: null, last_successful_refresh: null, latest_receipt: receiptFor(latest, "sha256:brief-v2", "no_material_update"),
    current_judgment: { state: "preserved", current_delta: null, latest_assessment: latest }, story_states: [], limitations: [] } },
    timeline_updates: [], updates: [], market_observations: [], limitations: [] } }
  const html = await renderTodayBrief(today, false, brief)
  assert.match(html, /沿用既有判斷/)
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
  assert.match(html, /本次無法確認，保留既有判斷/)
  assert.doesNotMatch(html, /已重評，判斷維持不變/)
  assert.doesNotMatch(html, /不得套用缺 identity 的 delta/)

  const missing = structuredClone(today)
  missing.current_judgment!.baseline!.source_cutoff = null
  missing.intraday_refresh!.markets.tw!.baseline_cutoff = null
  const missingHtml = await renderTodayBrief(missing, false, brief)
  assert.doesNotMatch(missingHtml, /盤中新聞已完成重評/)
  assert.match(missingHtml, /本次無法確認，保留既有判斷/)
})

test("the same update impact appears once in the intraday reading area and as a reference in its timeline point", async () => {
  const html = await renderTodayBrief(syntheticPresentationToday())
  const reasonOccurrences = html.match(/合成盤中更新原因原文。/g) ?? []
  assert.equal(reasonOccurrences.length, 1)
  assert.match(html, /同一筆更新的影響已在上方盤中更新列出。/)
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
    assert.doesNotMatch(html, /同一筆更新的影響已在上方盤中更新列出。/)
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
  assert.match(html, /本次盤中資料未確認；保留上次可讀內容。/)
  assert.match(html, /上次成功讀取的正式簡報行動/)
  assert.match(html, /合成正式簡報行動：保留觀察，待來源條件確認後再評估。/)
  assert.match(html, /合成盤中提醒原文。/)
  assert.match(html, /上次讀取的判斷（目前未確認）/)
})


test("a confirmed judgment change reads before/after and why while the action remains watch", async () => {
  const { brief, today } = syntheticJudgmentUpdate()
  const html = await renderTodayBrief(today, false, brief)
  assert.match(html, /判斷已更新 · 行動仍是觀察/)
  assert.match(html, /原先判斷 · 正式簡報/)
  assert.match(html, /現在判斷/)
  assert.match(html, /相較原先，多知道什麼/)
  assert.match(html, /這次提高了對當季收入的把握/)
  assert.match(html, /未來三年的維修成本/)
  assert.ok(html.indexOf(today.current_judgment!.current_delta!.judgment) < html.indexOf(brief.judgment!.judgment))
  assert.match(html, /synthetic-irrigation-renewals/)
})

test("actual scan outcomes remain explicit while a formal-only brief needs no reassessment status", async () => {
  const unchanged = syntheticJudgmentUpdate("unchanged")
  const unchangedHtml = await renderTodayBrief(unchanged.today, false, unchanged.brief)
  assert.match(unchangedHtml, /已重評，判斷維持不變/)
  assert.match(unchangedHtml, /有新增續約資料，但觀察時間仍短/)
  assert.doesNotMatch(unchangedHtml, /此次掃描範圍內沒有重要增量/)
  const quiet = syntheticJudgmentUpdate("preserved")
  const quietHtml = await renderTodayBrief(quiet.today, false, quiet.brief)
  const { TodayIntradayReceipts } = await server.ssrLoadModule("/src/components/investment/InvestmentPage.tsx")
  const receiptHtml = renderToStaticMarkup(createElement(TodayIntradayReceipts, { refresh: quiet.today.intraday_refresh, readFailed: false }))
  assert.match(receiptHtml, /此次掃描範圍內沒有重要增量/)
  assert.match(quietHtml, /本次查核範圍內沒有重要增量，沿用先前判斷/)
  assert.doesNotMatch(quietHtml, /判斷已更新|本次無法確認/)
  const uncheckedHtml = await renderTodayBrief(undefined, false, quiet.brief)
  assert.match(uncheckedHtml, /合成灌溉設備：訂單能否變成持續收入，仍需確認。/)
  assert.doesNotMatch(uncheckedHtml, /這次判斷更新|尚未取得新的重評結果|尚不能確認這次有沒有重要新資訊|沒有重要增量|已重評/)
})

test("unrequested scans stay silent for structured and legacy formal briefs", async () => {
  const { brief, today } = syntheticJudgmentUpdate("preserved")
  const market = today.intraday_refresh!.markets.tw!
  market.state = "not_requested"
  market.freshness = "baseline"
  market.latest_receipt = null
  market.last_successful_refresh = null
  market.current_judgment = { state: "baseline_only", current_delta: null, latest_assessment: null }
  today.current_judgment = { ...today.current_judgment!, state: "baseline_only", latest_assessment: null }
  const { TodayIntradayReceipts } = await server.ssrLoadModule("/src/components/investment/InvestmentPage.tsx")
  for (const refresh of [undefined, today.intraday_refresh]) {
    for (const readFailed of [false, true]) {
      assert.equal(renderToStaticMarkup(createElement(TodayIntradayReceipts, { refresh, readFailed })), "")
    }
  }
  for (const source of [brief, { ...brief, judgment: null }]) {
    const html = await renderTodayBrief(today, false, source)
    assert.match(html, /合成灌溉設備|合成.*觀察/)
    assert.doesNotMatch(html, /這次判斷更新|尚未取得新的重評結果|尚不能確認這次有沒有重要新資訊/)
  }
  // A new formal publication is sufficient to update the reading without a scan.
  const next = { ...brief, generated_at: "2001-02-03T10:00:00+08:00", judgment: {
    ...brief.judgment!, judgment: "合成新正式判斷：新增訂單支持本季收入。",
  } }
  const html = await renderTodayBrief(undefined, false, next)
  assert.match(html, /合成新正式判斷：新增訂單支持本季收入。/)
  assert.doesNotMatch(html, /這次判斷更新|尚未取得新的重評結果/)
})

test("Today leads with the authored judgment and keeps scan receipts out of the collapsed main card", async () => {
  for (const scenario of ["formal", "preserved", "partial", "failed", "reassessed"] as const) {
    for (const sourceOnly of [false, true]) {
      const { brief, today } = syntheticJudgmentUpdate(scenario === "reassessed" ? "reassessed" : "preserved")
      const market = today.intraday_refresh!.markets.tw!
      // This is deliberately execution prose, never an investment judgment.
      today.current_judgment!.latest_assessment!.reason = "No material story change; preserve current Today judgment."
      market.current_judgment!.latest_assessment!.reason = today.current_judgment!.latest_assessment!.reason
      if (scenario === "formal") {
        today.current_judgment!.state = "baseline_only"
        today.current_judgment!.latest_assessment = null
        market.state = "not_requested"
        market.latest_receipt = null
        market.current_judgment!.latest_assessment = null
      } else if (scenario === "partial" || scenario === "failed") {
        market.state = scenario
        market.latest_receipt!.result = scenario
        market.latest_receipt!.coverage_state = scenario
      }
      if (sourceOnly) {
        brief.judgment = null
        today.current_judgment!.formal_judgment = null
        today.current_judgment!.effective_judgment = null
        today.current_judgment!.current_delta = null
        market.current_judgment!.current_delta = null
      }
      const html = await renderTodayBrief(today, false, brief)
      const main = html.slice(0, html.indexOf("<details"))
      const authored = scenario === "reassessed" && !sourceOnly
        ? today.current_judgment!.current_delta!.judgment : sourceOnly ? brief.action_items![0].text : brief.judgment!.judgment
      assert.ok(main.includes(authored), `${scenario}/${sourceOnly}: preserve the entire authored text`)
      assert.ok(main.indexOf(authored) < main.indexOf('aria-label="正式判斷時間與後續快掃"'))
      assert.equal((main.match(/aria-label="正式判斷時間與後續快掃"/g) ?? []).length, 1)
      assert.doesNotMatch(main, /current Today judgment|material story change|資料截至|來源修訂|本次查核：|沿用既有判斷<\/p>/)
      if (scenario === "formal") assert.doesNotMatch(main, / · \d{2}:\d{2} 快掃|本次無法確認/)
      if (scenario === "preserved") assert.match(main, /08:01 台股晨報判斷 · 10:00 台股快掃未發現重要新事件/)
      if (scenario === "partial") assert.match(main, /快掃僅部分完成，沿用判斷/)
      if (scenario === "failed") assert.match(main, /快掃失敗，沿用判斷/)
      if (scenario === "reassessed" && !sourceOnly) assert.match(main, /10:00 重評判斷 · 10:00 台股快掃有新增事件/)
      assert.match(html, /資料截至/)
      if (scenario !== "formal") assert.match(html, /current Today judgment/)
    }
  }
})

test("a source-only formal action precedes a newer supplement without rewriting its words", async () => {
  const brief = { ...syntheticPresentationBrief(), judgment: null }
  const today = syntheticPresentationToday()
  const html = await renderTodayBrief(today, false, brief)
  assert.ok(html.indexOf(brief.action_items![0].text) < html.indexOf(today.updates[0].action))
  assert.match(html, /aria-label="盤中更新"/)
})

test("one intraday reading area preserves independent scan modes and source reminders without replacing the formal judgment", async () => {
  const { brief, today } = syntheticIntradayReading()
  const html = await renderTodayBrief(today, false, brief)
  assert.equal((html.match(/aria-label="盤中更新"/g) ?? []).length, 1)
  assert.equal((html.match(/aria-label="盤中市場讀數"/g) ?? []).length, 1)
  assert.doesNotMatch(html, /aria-label="盤中補充觀察"|盤中增量市場讀數|判斷已更新|狀態未提供/)
  assert.ok(html.indexOf(brief.judgment!.judgment) < html.indexOf(today.updates[1].summary))
  assert.ok(html.indexOf(today.updates[1].summary) < html.indexOf("較早盤中紀錄"))
  assert.ok(html.indexOf("較早盤中紀錄") < html.indexOf(today.updates[0].summary))
  assert.match(html, /台股 · 來源標示持倉深掃 · 完成 2001\/02\/03 11:30 台北/)
  assert.match(html, /美股 · 消息快掃 · 完成 2001\/02\/03 11:30 台北/)
  for (const update of today.updates) for (const field of [update.summary, update.portfolio_impact, update.action]) assert.ok(html.includes(field))
  assert.match(html, /來源將這筆更新標為持倉深掃/)
  assert.match(html, /未發現重要新事件不代表每個持倉均已重新分析/)
  assert.match(html, /合成來源解讀：價格變化不代表成本已確認/)
})

test("unknown mode or unqualified time stays visible without a scan or age claim", async () => {
  const { brief, today } = syntheticIntradayReading()
  today.updates[0] = { ...today.updates[0], scan_mode: null, market_scope: null,
    observed_at: "2001-02-03", scan_completed_at: "2001-02-03", summary: "合成時間與模式未知的來源內容。" }
  const html = await renderTodayBrief(today, false, brief)
  assert.ok(html.indexOf(today.updates[0].summary) < html.indexOf("盤中市場讀數"))
  assert.doesNotMatch(html, /較早盤中紀錄/)
  assert.match(html, /盤中來源更新（模式未提供）/)
  assert.match(html, /來源未標明快掃或深掃，不推定掃描範圍/)
})

test("partial and failed reads retain intraday source content beside an explicit limitation", async () => {
  for (const state of ["partial", "unavailable", "read-failed"] as const) {
    const { brief, today } = syntheticIntradayReading()
    today.state = state === "read-failed" ? "ready" : state
    today.updates[1].coverage_state = "partial"
    today.limitations = ["Synthetic missing cost source"]
    const html = await renderTodayBrief(today, state === "read-failed", brief)
    assert.ok(html.includes(today.updates[1].action))
    assert.ok(html.includes(today.updates[1].portfolio_impact))
    assert.match(html, /部分來源完成/)
    assert.match(html, state === "partial" ? /盤中資料部分可用/ : /本次盤中資料未確認/)
    assert.match(html, /Synthetic missing cost source/)
  }
})

test("usable intraday reminders survive a missing or invalid formal brief without becoming its primary action", async () => {
  for (const state of ["missing", "invalid"] as const) {
    const { brief, today } = syntheticIntradayReading()
    brief.state = state
    const html = await renderTodayBrief(today, false, brief)
    assert.match(html, /盤中更新/)
    assert.ok(html.includes(today.updates[1].action))
    assert.match(html, state === "missing" ? /尚未取得正式簡報/ : /正式簡報無法完整辨識/)
    const formal = html.slice(0, html.indexOf('aria-label="盤中更新"'))
    assert.ok(!formal.includes(today.updates[1].action))
  }
})

test("a cached complete quiet receipt cannot certify an unavailable, unknown, or failed reread", async () => {
  for (const scenario of ["unavailable", "unknown", "failed-market", "failed-read"] as const) {
    const { brief, today } = syntheticJudgmentUpdate("preserved")
    if (scenario === "unavailable") today.state = "unavailable"
    if (scenario === "unknown") today.intraday_refresh!.markets.tw!.state = "unknown"
    if (scenario === "failed-market") today.intraday_refresh!.markets.tw!.state = "failed"
    const html = await renderTodayBrief(today, scenario === "failed-read", brief)
    const main = html.slice(0, html.indexOf("<details"))
    assert.match(main, /合成灌溉設備：訂單能否變成持續收入，仍需確認。/)
    assert.doesNotMatch(main, /快掃未發現重要新事件/)
    assert.match(main, scenario === "failed-market" ? /快掃結果未確認，沿用判斷/ : /上次快掃結果，本次未確認/)
  }
})

test("one requested market does not advertise the other unrequested market", async () => {
  const { today } = syntheticJudgmentUpdate("preserved")
  today.intraday_refresh!.markets.us = { ...today.intraday_refresh!.markets.tw!,
    state: "not_requested", freshness: "baseline", latest_receipt: null, last_successful_refresh: null,
    current_judgment: { state: "baseline_only", current_delta: null, latest_assessment: null },
  }
  const { TodayIntradayReceipts } = await server.ssrLoadModule("/src/components/investment/InvestmentPage.tsx")
  const html = renderToStaticMarkup(createElement(TodayIntradayReceipts, { refresh: today.intraday_refresh, readFailed: false }))
  assert.match(html, /台股：此次掃描範圍內沒有重要增量/)
  assert.doesNotMatch(html, /美股|尚無可採用的盤中更新/)
})

test("failed, stale, baseline-mismatched and contradictory receipts never claim a fresh assessment", async () => {
  for (const fault of ["failed", "stale", "baseline", "reason", "state", "cutoff", "unavailable"] as const) {
    const { brief, today } = syntheticJudgmentUpdate("unchanged")
    const market = today.intraday_refresh!.markets.tw!
    if (fault === "failed") { market.state = "failed"; market.latest_receipt!.result = "failed" }
    if (fault === "stale") market.freshness = "stale"
    if (fault === "baseline") market.baseline_revision = "sha256:other-baseline"
    if (fault === "reason") market.current_judgment!.latest_assessment!.reason = "另一份回執的理由"
    if (fault === "state") market.current_judgment!.latest_assessment!.state = "pending"
    if (fault === "cutoff") market.current_judgment!.latest_assessment!.baseline_cutoff_at = "2000-01-01T00:00:00Z"
    if (fault === "unavailable") today.state = "unavailable"
    const html = await renderTodayBrief(today, false, brief)
    assert.match(html, /本次無法確認，保留既有判斷/, fault)
    assert.match(html, /合成灌溉設備：訂單能否變成持續收入，仍需確認。/, fault)
    assert.doesNotMatch(html, /已重評，判斷維持不變|判斷已更新|本次查核：/, fault)
  }
  const snapshot = syntheticJudgmentUpdate()
  for (const readFailed of [false, true]) {
    const brief = { ...snapshot.brief, state: "stale" as const }
    const html = await renderTodayBrief(snapshot.today, readFailed, brief)
    assert.match(html, /上次讀取的判斷（目前未確認）/)
    assert.match(html, /合成灌溉設備：訂單能否變成持續收入，仍需確認。/)
    assert.doesNotMatch(html, /判斷已更新|本次查核：/)
  }
})

test("no-material result needs complete same-assessment receipt before claiming a fresh confirmation", async () => {
  const { TodayIntradayReceipts } = await server.ssrLoadModule("/src/components/investment/InvestmentPage.tsx")
  for (const coverage of ["partial", "failed", "unknown", undefined]) {
    const { brief, today } = syntheticJudgmentUpdate("preserved")
    today.intraday_refresh!.markets.tw!.latest_receipt!.coverage_state = coverage
    const receiptHtml = renderToStaticMarkup(createElement(TodayIntradayReceipts, { refresh: today.intraday_refresh, readFailed: false }))
    assert.match(receiptHtml, coverage === "partial" ? /僅部分完成，不能確認/ : coverage === "failed" ? /掃描失敗，不能確認/ : /完整度未確認，不能判定/)
    assert.doesNotMatch(receiptHtml, /此次掃描範圍內沒有重要增量|完成，沒有重大更新/)
    const html = await renderTodayBrief(today, false, brief)
    assert.match(html, /本次無法確認，保留既有判斷/)
    assert.doesNotMatch(html, /本次查核：|判斷已更新|完成，沒有重大更新|此次掃描範圍內沒有重要增量/)
  }
  for (const field of ["finished_at", "baseline_cutoff_at", "baseline_artifact_sha256"] as const) {
    const { brief, today } = syntheticJudgmentUpdate("unchanged")
    today.intraday_refresh!.markets.tw!.latest_receipt![field] = "another-assessment"
    const html = await renderTodayBrief(today, false, brief)
    assert.match(html, /本次無法確認，保留既有判斷/)
    assert.doesNotMatch(html, /本次查核：|已重評，判斷維持不變/)
  }
})
