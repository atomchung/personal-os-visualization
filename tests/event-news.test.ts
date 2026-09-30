import test from "node:test"
import assert from "node:assert/strict"
import { createServer } from "vite"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

test("event cards preserve ticker effects, candidate status, checks and degraded states", async () => {
  const previousLocation = Object.getOwnPropertyDescriptor(globalThis, "location")
  Object.defineProperty(globalThis, "location", { value: { origin: "http://localhost", hostname: "localhost" }, configurable: true })
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
  try {
    const { EventNews } = await server.ssrLoadModule("/src/components/investment/EventNews.tsx")
    const { FutureContent } = await server.ssrLoadModule("/src/components/investment/InvestmentNarrative.tsx")
    const source = { path: "wiki/SYNTH/index.md", line: 4 }
    const checks = [{ scope: "SYNTH", check: "公司執行檢查", state: "registered", result_state: "unknown", source }, { scope: "POOL", check: "共享供需檢查", state: "registered", result_state: "unknown", source }]
    const event = { key: "earnings", story_id: "earnings", title: "合成財報結果", state: "conflict", ticker_link_state: "linked", thesis_link_state: "candidate", affected_tickers: ["SYNTH", "ETF"], ticker_effects: [{ ticker: "SYNTH", effect: "公司影響", state: "candidate", sources: [source] }], thesis_effects: [{ narrative_id: "synthetic-demand", thesis_ref: null, direction: "supports", reason: "新增需求證據", state: "candidate", sources: [source] }], canonical_claim_effects: [], occurrences: [{ kind: "brief", title: "合成財報結果", market_reaction: null, interpretation: null, impact: "原文影響", source }], checkpoint: { state: "linked", story_id: "earnings", checks }, limitations: [] }
    const html = renderToStaticMarkup(createElement(EventNews, { projection: { state: "partial", items: [event], limitations: [] } }))
    assert.match(html, /影響標的：SYNTH、ETF/)
    assert.match(html, /候選判讀/)
    assert.match(html, /來源影響有分歧/)
    assert.match(html, /結果尚未逐項驗證/)
    assert.match(html, /原文影響/)
    const row = { story_id: "earnings", title: "合成下一季財報", state: "ready", date: "2026-09-30", date_label: "2026-09-30", date_precision: "day", window_membership: "within", source_qualifiers: ["一手"], affected_tickers: ["SYNTH", "ETF"], affected_scopes: ["POOL"], checks, sources: [source], limitations: [] }
    const future = renderToStaticMarkup(createElement(FutureContent, { projection: { state: "partial", window_start: "2026-09-27", window_end: "2026-10-27", items: [row], uncertain_items: [{ ...row, story_id: "uncertain", title: "未確認月份", state: "unlinked", date: null, date_label: "2026-10", date_precision: "month", window_membership: "possible" }], past_items: [{ ...row, title: "已過事件" }], coverage_gaps: [], limitations: [] } }))
    assert.match(future, /接下來會改變判斷的事情/)
    assert.match(future, /公司執行檢查/)
    assert.match(future, /共享供需檢查/)
    assert.match(future, /日期未定/)
    assert.doesNotMatch(future, /已過事件/)
    const overdue = renderToStaticMarkup(createElement(EventNews, { projection: {
      state: "partial", items: [], limitations: [], overdue_checkpoints: [{
        story_id: "synthetic-due", title: "合成到期事件", state: "result_pending", result_state: "pending",
        due_date: "2026-09-29", affected_tickers: [], affected_scopes: [], checks: [], sources: [],
        limitations: ["合成來源限制"],
      }],
    } }))
    assert.match(overdue, /synthetic-due/)
    assert.match(overdue, /合成來源限制/)
    const { uniqueMarketObservations } = await server.ssrLoadModule("/src/components/investment/MarketObservations.tsx")
    const first = { information_kind: "market_observation", market: "tw", event: "Synthetic index reading",
      observation_value: "0.6%", observation_as_of: "2026-09-30T09:00:00+08:00", source_path: "synthetic/reading.md",
      source_revision: "r1", interpretation: "First authored reading", source_cutoff: "2026-09-30T09:00:00+08:00" }
    assert.equal(uniqueMarketObservations([first, { ...first }]).length, 1)
    for (const difference of [{ interpretation: "Revised reading" }, { source_revision: "r2" }, { source_cutoff: "2026-09-30T09:10:00+08:00" }]) {
      assert.equal(uniqueMarketObservations([first, { ...first, ...difference }]).length, 2)
    }
    assert.equal(uniqueMarketObservations([
      { information_kind: "market_observation", summary: "A", source_revision: "r1" },
      { information_kind: "market_observation", summary: "B", source_revision: "r2" },
    ]).length, 2)

  } finally { await server.close(); if (previousLocation) Object.defineProperty(globalThis, "location", previousLocation); else Reflect.deleteProperty(globalThis, "location") }
})
