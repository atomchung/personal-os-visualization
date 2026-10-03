import test from "node:test"
import assert from "node:assert/strict"
import { createServer } from "vite"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { EventCheckResult, NewsEvent } from "../src/lib/investment.ts"

test("event cards preserve ticker effects, candidate status, checks and degraded states", async () => {
  const previousLocation = Object.getOwnPropertyDescriptor(globalThis, "location")
  Object.defineProperty(globalThis, "location", { value: { origin: "http://localhost", hostname: "localhost" }, configurable: true })
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
  try {
    const { EventNews } = await server.ssrLoadModule("/src/components/investment/EventNews.tsx")
    const { FutureContent } = await server.ssrLoadModule("/src/components/investment/InvestmentNarrative.tsx")
    const source = { path: "wiki/SYNTH/index.md", line: 4, source_cutoff: "2026-09-30T08:09:00+08:00" }
    const checks = [{ scope: "SYNTH", check: "公司執行檢查", state: "registered", result_state: "unknown", source }, { scope: "POOL", check: "共享供需檢查", state: "registered", result_state: "unknown", source }]
    const event = { key: "earnings", story_id: "earnings", title: "合成財報結果", state: "conflict", ticker_link_state: "linked", thesis_link_state: "candidate", affected_tickers: ["SYNTH", "ETF"], ticker_effects: [{ ticker: "SYNTH", effect: "公司影響", state: "candidate", sources: [source] }], thesis_effects: [{ narrative_id: "synthetic-demand", thesis_ref: null, direction: "supports", reason: "新增需求證據", state: "candidate", sources: [source] }], canonical_claim_effects: [], occurrences: [{ kind: "brief", title: "合成財報結果", market_reaction: null, interpretation: null, impact: "原文影響", source }], checkpoint: { state: "linked", story_id: "earnings", checks }, limitations: [] }
    const html = renderToStaticMarkup(createElement(EventNews, { projection: { state: "partial", items: [event], limitations: [] } }))
    assert.match(html, /影響標的：SYNTH、ETF/)
    assert.match(html, /候選判讀/)
    assert.match(html, /來源影響有分歧/)
    assert.match(html, /結果尚未逐項驗證/)
    assert.match(html, /原文影響/)
    const scopedResults: EventCheckResult[] = [
      { scope: "SYNTH", outcome: "follow_up", summary: "合成本季供應揭露已完成，產品認證仍需下一個事件。", follow_up_story_id: "synthetic-product-qualification" },
      { scope: "POOL", outcome: "resolved", summary: "合成共享判準已完成查核。" },
      { scope: "QUIET", outcome: "no_new_disclosure", summary: "合成來源沒有新增項目揭露。" },
    ]
    const verifiedEvent: NewsEvent = { ...event, state: "ready", checkpoint: {
      state: "linked", story_id: "earnings", result_state: "resolved",
      checks: scopedResults.map(result => ({ scope: result.scope, check: `合成 ${result.scope} 檢查`, state: "registered", result_state: result.outcome, source, result })),
      event_result: { state: "verified", schema_version: 1, story_id: "earnings", status: "result_received",
        verification_state: "verified", source_type: "primary", source_url: "https://example.com/synthetic-result",
        source_date: "2026-09-29", verified_at: "2026-09-30T11:19:00+08:00", check_results: scopedResults,
        source: { path: "synthetic/event-results/earnings.json", line: 7, source_revision: `sha256:${"1".repeat(64)}` }, limitations: [] },
    } }
    const renderResults = (value: NewsEvent, extra: NewsEvent[] = []) => renderToStaticMarkup(createElement(EventNews, { projection: { state: "ready", items: [value, ...extra], limitations: [] } }))
    const resultHtml = renderResults(verifiedEvent)
    assert.match(resultHtml, /原事件結果已核實/)
    assert.ok(resultHtml.indexOf("原事件結果已核實") < resultHtml.indexOf("<details"), "parent verification is visible before opening details")
    assert.match(resultHtml, /檢查已完成/)
    assert.match(resultHtml, /另有後續驗證點/)
    assert.match(resultHtml, /本次沒有新增揭露/)
    for (const result of scopedResults) assert.ok(resultHtml.includes(result.summary))
    assert.match(resultHtml, /後續事件 · synthetic-product-qualification/)
    assert.match(resultHtml, /class="break-all">後續事件 · synthetic-product-qualification/)
    assert.match(resultHtml, /href="https:\/\/example\.com\/synthetic-result"[^>]*>查看結果一手來源/)
    assert.match(resultHtml, /一手來源日期 2026-09-29/)
    assert.match(resultHtml, /結果核實時間 2026\/09\/30 11:19 台北/)
    assert.match(resultHtml, /synthetic\/event-results\/earnings\.json:7/)
    assert.ok(resultHtml.includes(`結果來源修訂：sha256:${"1".repeat(64)}`))
    assert.match(resultHtml, /來源資訊截至 2026\/09\/30 08:09 台北/)
    const checkpointDetails = resultHtml.slice(resultHtml.indexOf("<details"), resultHtml.indexOf("</details>"))
    for (const label of ["查看結果一手來源", "一手來源日期", "結果核實時間", "結果來源修訂"]) assert.ok(checkpointDetails.includes(label))
    assert.doesNotMatch(resultHtml, /來源資訊截至 2026\/09\/30 11:19/)
    assert.doesNotMatch(resultHtml, /結果尚未逐項驗證|結果來源部分可用|等待來源回報/)

    const followUpEvent: NewsEvent = { ...event, key: "qualification", story_id: "synthetic-product-qualification", title: "合成產品量產認證", checkpoint: { state: "unlinked", story_id: null, checks: [] } }
    assert.match(renderResults(verifiedEvent, [followUpEvent]), /後續事件 · 合成產品量產認證 · synthetic-product-qualification/)
    const unrelatedEvent = { ...followUpEvent, story_id: "different-explicit-story", title: "不應使用的相似標題" }
    assert.doesNotMatch(renderResults(verifiedEvent, [unrelatedEvent]), /後續事件 · 不應使用/)
    const ambiguousTitle = { ...followUpEvent, key: "qualification-other", title: "另一份不一致標題" }
    assert.match(renderResults(verifiedEvent, [followUpEvent, ambiguousTitle]), /後續事件 · synthetic-product-qualification/)
    assert.doesNotMatch(renderResults(verifiedEvent, [followUpEvent, ambiguousTitle]), /後續事件 · (合成產品量產認證|另一份不一致標題)/)
    for (const outcome of ["resolved", "no_new_disclosure"] as const) {
      const result = { ...scopedResults[0], outcome }
      const noFollowUp = renderResults({ ...verifiedEvent, checkpoint: { ...verifiedEvent.checkpoint,
        checks: [{ ...verifiedEvent.checkpoint.checks[0], result_state: outcome, result }],
        event_result: { ...verifiedEvent.checkpoint.event_result!, check_results: [result] },
      } }, [followUpEvent])
      assert.ok(noFollowUp.includes(result.summary))
      assert.doesNotMatch(noFollowUp, /後續事件 ·|後續事件身份未提供|另有後續驗證點/)
    }
    const unsafeLink = renderResults({ ...verifiedEvent, checkpoint: { ...verifiedEvent.checkpoint,
      event_result: { ...verifiedEvent.checkpoint.event_result!, source_url: "javascript:synthetic-only" },
    } })
    assert.doesNotMatch(unsafeLink, /href="javascript:/)
    assert.match(unsafeLink, /結果一手來源連結未提供或無法開啟/)

    const partial = structuredClone(verifiedEvent)
    partial.checkpoint.event_result!.state = "partial"
    partial.checkpoint.event_result!.verification_state = "partial"
    const partialHtml = renderResults(partial)
    assert.match(partialHtml, /結果來源部分可用，尚未確認完成/)
    assert.doesNotMatch(partialHtml, /原事件結果已核實|合成共享判準已完成查核|後續事件 ·/)
    assert.doesNotMatch(partialHtml, /查看結果一手來源|結果核實時間|結果來源修訂|synthetic\/event-results/)
    for (const changed of [
      { ...verifiedEvent.checkpoint, story_id: "another-explicit-story" },
      { ...verifiedEvent.checkpoint, event_result: { ...verifiedEvent.checkpoint.event_result!, story_id: "another-explicit-story" } },
      { ...verifiedEvent.checkpoint, event_result: { ...verifiedEvent.checkpoint.event_result!, state: "unknown" as const } },
      { ...verifiedEvent.checkpoint, result_state: "partial" },
    ]) {
      const degraded = renderResults({ ...verifiedEvent, checkpoint: changed })
      assert.match(degraded, /結果尚未逐項驗證/)
      assert.doesNotMatch(degraded, /原事件結果已核實|合成共享判準已完成查核|後續事件 ·/)
    }
    for (const changed of [
      { ...verifiedEvent.checkpoint.checks[1], result_state: "unknown" },
      { ...verifiedEvent.checkpoint.checks[1], state: "unknown" },
      { ...verifiedEvent.checkpoint.checks[1], result: { ...scopedResults[1], scope: "OTHER" } },
      { ...verifiedEvent.checkpoint.checks[1], result: { ...scopedResults[1], summary: "不是此 scope proof 的摘要" } },
    ]) {
      const unmatched = renderResults({ ...verifiedEvent, checkpoint: { ...verifiedEvent.checkpoint, checks: [changed] } })
      assert.match(unmatched, /結果尚未逐項驗證/)
      assert.doesNotMatch(unmatched, /合成共享判準已完成查核|不是此 scope proof 的摘要/)
    }
    const missingScope = renderResults({ ...verifiedEvent, checkpoint: { ...verifiedEvent.checkpoint, checks: [checks[0], ...verifiedEvent.checkpoint.checks] } })
    assert.match(missingScope, /原事件結果已核實/)
    assert.match(missingScope, /結果尚未逐項驗證/)
    const row = { story_id: "earnings", title: "合成下一季財報", state: "ready", date: "2026-09-30", date_label: "2026-09-30", date_precision: "day", window_membership: "within", source_qualifiers: ["一手"], affected_tickers: ["SYNTH", "ETF"], affected_scopes: ["POOL"], checks, sources: [source], limitations: [] }
    const future = renderToStaticMarkup(createElement(FutureContent, { projection: { state: "partial", window_start: "2026-09-27", window_end: "2026-10-27", items: [row], uncertain_items: [{ ...row, story_id: "uncertain", title: "未確認月份", state: "unlinked", date: null, date_label: "2026-10", date_precision: "month", window_membership: "possible" }], past_items: [{ ...row, title: "已過事件" }], coverage_gaps: [], limitations: [] } }))
    assert.match(future, /公司近期事件/)
    assert.match(future, /公司執行檢查/)
    assert.match(future, /共享供需檢查/)
    assert.match(future, /日期未定/)
    assert.doesNotMatch(future, /已過事件/)
    const overdue = renderToStaticMarkup(createElement(EventNews, { projection: {
      state: "partial", items: [], limitations: [], overdue_checkpoints: [{
        story_id: "synthetic-due", title: "合成到期事件", state: "result_pending", result_state: "pending",
        due_date: "2026-09-29", affected_tickers: ["SYNTH"], affected_scopes: ["POOL"], checks, sources: [],
        limitations: ["合成來源限制"],
      }, {
        story_id: "synthetic-unknown", title: "合成結果來源不完整", state: "result_pending", result_state: "unknown",
        due_date: "2026-09-29", affected_tickers: [], affected_scopes: [], checks: [], sources: [],
        limitations: ["來源時間未提供，無法確認是否已有結果。"],
      }],
    } }))
    assert.match(overdue, /synthetic-due/)
    assert.match(overdue, /合成來源限制/)
    assert.match(overdue, /等待來源回報/)
    assert.match(overdue, /來源結果未確認/)
    assert.match(overdue, /無需手動確認/)
    assert.match(overdue, /公司執行檢查/)
    assert.match(overdue, /共享供需檢查/)
    assert.match(overdue, /來源時間未提供/)
    assert.doesNotMatch(overdue, /已到期檢查點 · 尚無結果|>結果待確認</)
    const { uniqueMarketObservations } = await server.ssrLoadModule("/src/components/investment/MarketObservations.tsx")
    const first = { information_kind: "market_observation", market: "tw", event: "Synthetic index reading",
      observation_value: "0.6%", observation_as_of: "2026-09-30T09:00:00+08:00", source_path: "synthetic/reading.md",
      source_revision: "r1", interpretation: "First authored reading", source_cutoff: "2026-09-30T09:00:00+08:00" }
    assert.equal(uniqueMarketObservations([first, { ...first }]).length, 1)
    assert.equal(uniqueMarketObservations([first, { ...first, kind: "update", at: first.observation_as_of, summary: "Timeline wrapper" }]).length, 1)
    assert.equal(uniqueMarketObservations([{ ...first, source: { path: first.source_path, line: 1 } },
      { ...first, source: { path: first.source_path, line: 2 } }]).length, 2)
    for (const difference of [{ interpretation: "Revised reading" }, { source_revision: "r2" }, { source_cutoff: "2026-09-30T09:10:00+08:00" }]) {
      assert.equal(uniqueMarketObservations([first, { ...first, ...difference }]).length, 2)
    }
    assert.equal(uniqueMarketObservations([
      { information_kind: "market_observation", summary: "A", source_revision: "r1" },
      { information_kind: "market_observation", summary: "B", source_revision: "r2" },
    ]).length, 2)

  } finally { await server.close(); if (previousLocation) Object.defineProperty(globalThis, "location", previousLocation); else Reflect.deleteProperty(globalThis, "location") }
})
