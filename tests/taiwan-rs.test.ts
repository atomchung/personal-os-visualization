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
    const row = { symbol: "DEMO-TW-A", exchange: "TWSE", state: "partial", market_rs_pp: 1.28, as_of: "2026-09-24", window_start: "2026-07-01", window_trading_days: 60, market_benchmark: { id: "^TWII", label: "加權指數" }, peer_rs_pp: null, peer_group: null, coverage: { holding_sessions: 61, expected_sessions: 61 }, limitations: ["同業籃子未提供"], reason_codes: [], provider_symbol: "DEMO-TW-A.TW", price_source: "synthetic", benchmark_source: "synthetic" }
    const data = { state: "partial", holdings: [row], limitations: [], sources: [], requested_date: "2026-09-27", generated_at: "2026-09-27", source_cutoff: "2026-09-24", read_at: "2026-09-27", producer: "synthetic", id: "synthetic", cached: true }
    const props = { symbol: "DEMO-TW-A.TW", data, pending: false, failed: false }
    const cell = (p = props) => renderToStaticMarkup(createElement(TaiwanRsCell, p))
    assert.match(cell(), /\+1\.28%/)
    assert.match(cell(), /\^TWII/)
    assert.match(cell(), /60 交易日.*2026-09-24/)
    assert.match(cell(), /快取資料/)
    assert.match(cell({ ...props, failed: true }), /更新失敗，保留上次資料/)
    assert.doesNotMatch(cell({ ...props, symbol: "OTHER.TW" }), /1\.28/)
    assert.doesNotMatch(cell({ ...props, data: { ...data, holdings: [{ ...row, exchange: "TPEx" }] } }), /1\.28/)
    assert.doesNotMatch(cell({ ...props, data: { ...data, holdings: [{ ...row, provider_symbol: "OTHER.TW" }] } }), /1\.28/, "a different provider symbol must not join")
    assert.doesNotMatch(cell({ ...props, data: { ...data, state: "unavailable" } }), /1\.28/)
    assert.doesNotMatch(cell({ ...props, data: { ...data, holdings: [{ ...row, state: "unavailable" }] } }), /1\.28/)
    assert.match(cell({ ...props, data: { ...data, holdings: [{ ...row, market_rs_pp: null }] } }), /未取得/)
    assert.match(cell({ ...props, data: undefined, pending: true }), /讀取中/)
    assert.match(cell({ ...props, data: undefined, failed: true }), /讀取失敗，來源狀態未知/)
    assert.match(cell({ ...props, data: { ...data, holdings: [{ ...row, exchange: null, market_rs_pp: 99 }] } }), /交易所身分未確認/)
    assert.doesNotMatch(cell({ ...props, data: { ...data, holdings: [{ ...row, exchange: null, market_rs_pp: 99 }] } }), /99/)
    const unmatched = { ...props, data: { ...data, holdings: [{ ...row, provider_symbol: null, exchange: null, market_rs_pp: 99 }] } }
    assert.match(cell(unmatched), /基準未提供/,
      "without the producer provider-symbol bridge, a same-canonical-ticker row remains unmatched")
    assert.doesNotMatch(cell(unmatched), /99/)
    const detail = renderToStaticMarkup(createElement(TaiwanRsDetails, props))
    assert.match(detail, /同業相對強度：未取得/)
    assert.match(detail, /61\/61/)
    assert.match(detail, /同業籃子未提供/)
    assert.match(detail, /要求日期 2026-09-27.*來源截止 2026-09-24/)
    assert.match(renderToStaticMarkup(createElement(TaiwanRsDetails, unmatched)), /來源未提供此標的的比較資料/)
    const initialFailureDetail = renderToStaticMarkup(createElement(TaiwanRsDetails, { ...props, data: undefined, failed: true }))
    assert.match(initialFailureDetail, /讀取失敗，來源狀態未知/)
    assert.doesNotMatch(initialFailureDetail, /來源未提供此標的的比較資料/)
    const unknownExchangeDetail = renderToStaticMarkup(createElement(TaiwanRsDetails, { ...props, data: { ...data, holdings: [{ ...row, exchange: null, market_rs_pp: 99, reason_codes: ["exchange_unverified"] }] } }))
    assert.match(unknownExchangeDetail, /交易所身分未確認/)
    assert.match(unknownExchangeDetail, /exchange_unverified/)
    assert.doesNotMatch(unknownExchangeDetail, /99/)
  } finally { await server.close(); if (previousLocation) Object.defineProperty(globalThis, "location", previousLocation); else Reflect.deleteProperty(globalThis, "location") }
})
