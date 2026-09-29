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
  } finally { await server.close(); if (previousLocation) Object.defineProperty(globalThis, "location", previousLocation); else Reflect.deleteProperty(globalThis, "location") }
})
