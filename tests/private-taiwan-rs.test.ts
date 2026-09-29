import test from "node:test"
import assert from "node:assert/strict"
import { createServer } from "vite"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

test("Taiwan RS renders in the holding cell with exact identity, truthful dates and missing states", async () => {
  const previousLocation = Object.getOwnPropertyDescriptor(globalThis, "location")
  Object.defineProperty(globalThis, "location", { value: { origin: "http://localhost", hostname: "localhost" }, configurable: true })
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
  try {
    const { TaiwanRsCell, TaiwanRsDetails } = await server.ssrLoadModule("/src/components/investment/TaiwanRs.tsx")
    const row = { symbol: "DEMO.TW", exchange: "TWSE", state: "partial", market_rs_pp: 1.28, as_of: "2026-09-24", window_start: "2026-07-01", window_trading_days: 60, market_benchmark: { id: "^TWII", label: "加權指數" }, peer_rs_pp: null, peer_group: null, coverage: { holding_sessions: 61, expected_sessions: 61 }, limitations: ["同業籃子未提供"], reason_codes: [], provider_symbol: "DEMO.TW", price_source: "synthetic", benchmark_source: "synthetic" }
    const data = { state: "partial", holdings: [row], limitations: [], sources: [], requested_date: "2026-09-27", generated_at: "2026-09-27", source_cutoff: "2026-09-24", read_at: "2026-09-27", producer: "synthetic", id: "synthetic", cached: true }
    const props = { symbol: row.symbol, data, pending: false, failed: false }
    const cell = (p = props) => renderToStaticMarkup(createElement(TaiwanRsCell, p))
    assert.match(cell(), /\+1\.28%/)
    assert.match(cell(), /\^TWII/)
    assert.match(cell(), /60 交易日.*2026-09-24/)
    assert.match(cell(), /快取資料/)
    // The producer's canonical holding code can differ from the Yahoo quote symbol.
    assert.match(cell({ ...props, data: { ...data, holdings: [{ ...row, symbol: "DEMO" }] } }), /\+1\.28%/)
    assert.doesNotMatch(cell({ ...props, data: { ...data, holdings: [{ ...row, provider_symbol: "OTHER.TW" }] } }), /1\.28/)
    const unverified = cell({ ...props, data: { ...data, holdings: [{ ...row, exchange: null }] } })
    assert.match(unverified, /交易所身分未確認/)
    assert.doesNotMatch(unverified, /1\.28/)
    assert.match(cell({ ...props, failed: true }), /更新失敗，保留(?:原|上次)資料/)
    assert.doesNotMatch(cell({ ...props, symbol: "OTHER.TW" }), /1\.28/)
    assert.doesNotMatch(cell({ ...props, data: { ...data, holdings: [{ ...row, exchange: "TPEx" }] } }), /1\.28/)
    assert.doesNotMatch(cell({ ...props, data: { ...data, state: "unavailable" } }), /1\.28/)
    assert.doesNotMatch(cell({ ...props, data: { ...data, holdings: [{ ...row, state: "unavailable" }] } }), /1\.28/)
    assert.match(cell({ ...props, data: { ...data, holdings: [{ ...row, market_rs_pp: null }] } }), /未取得/)
    assert.match(cell({ ...props, data: undefined, pending: true }), /讀取中/)
    const detail = renderToStaticMarkup(createElement(TaiwanRsDetails, props))
    assert.match(detail, /同業相對強度：未取得/)
    assert.match(detail, /61\/61/)
    assert.match(detail, /同業籃子未提供/)
  } finally { await server.close(); if (previousLocation) Object.defineProperty(globalThis, "location", previousLocation); else Reflect.deleteProperty(globalThis, "location") }
})
