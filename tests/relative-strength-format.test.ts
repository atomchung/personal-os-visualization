import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createServer } from "vite"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

// issue #49: US and Taiwan relative-strength figures are both percentage-point
// differences (own return minus benchmark return) and must read identically --
// a signed number, two decimals, a trailing "%" -- with no leftover "個百分點"
// wording and no invented 0 for a value the source never provided.
test("relative-strength values format identically across US and Taiwan; missing stays missing", async () => {
  const previousLocation = Object.getOwnPropertyDescriptor(globalThis, "location")
  Object.defineProperty(globalThis, "location", { value: { origin: "http://localhost", hostname: "localhost" }, configurable: true })
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
  try {
    const stockMomentum = await server.ssrLoadModule("/src/components/investment/StockMomentum.tsx")
    const taiwanRs = await server.ssrLoadModule("/src/components/investment/TaiwanRs.tsx")
    const usFormat = stockMomentum.formatRsPercent
    const twFormat = taiwanRs.formatRsPercent

    for (const format of [usFormat, twFormat]) {
      assert.equal(format(10.345), "+10.35%")
      assert.equal(format(-3.049), "-3.05%")
      assert.equal(format(0), "0.00%")
      assert.doesNotMatch(format(10.345), /個百分點/)
    }

    // Each file keeps its own pre-existing "no value" wording -- neither
    // invents a 0.
    for (const missing of [null, undefined, NaN]) {
      assert.equal(usFormat(missing), "—")
      assert.equal(twFormat(missing), "未取得")
    }
  } finally {
    await server.close()
    if (previousLocation) Object.defineProperty(globalThis, "location", previousLocation)
    else Reflect.deleteProperty(globalThis, "location")
  }
})

test("the relative-strength table warning names which visible symbols lack a reading instead of a vague sentence", async () => {
  const previousLocation = Object.getOwnPropertyDescriptor(globalThis, "location")
  Object.defineProperty(globalThis, "location", { value: { origin: "http://localhost", hostname: "localhost" }, configurable: true })
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
  try {
    const { relativeStrengthGapMessage } = await server.ssrLoadModule("/src/components/investment/StockMomentum.tsx")
    const rows = [{ symbol: "AAPL" }, { symbol: "MSFT" }, { symbol: "NVDA.TW" }]

    // A real fetch failure keeps its own, more urgent wording regardless of rs.
    assert.equal(relativeStrengthGapMessage(rows, new Map(), undefined, true), "相對強度這次沒有取得。")

    // Ready, or not yet loaded: no message.
    const ready = { state: "ready", coverage: { rows: 2, scored: 2 } }
    assert.equal(relativeStrengthGapMessage(rows, new Map([["AAPL", { rs_spy: 1 }], ["MSFT", { rs_spy: 1 }]]), ready, false), null)
    assert.equal(relativeStrengthGapMessage(rows, new Map(), undefined, false), null)

    // Partial: name the specific visible US symbol missing a reading (the
    // Taiwan row is out of scope -- it has its own separate source).
    const partial = { state: "partial", coverage: { rows: 2, scored: 1 } }
    const rsByTicker = new Map([["AAPL", { rs_spy: 4.2 }], ["MSFT", { rs_spy: null }]])
    assert.equal(relativeStrengthGapMessage(rows, rsByTicker, partial, false), "1 檔沒有相對強度資料（MSFT）；原因見各列")

    // A source-wide shortfall that does not land on any symbol shown in this
    // roster still surfaces a count -- real unavailability is never hidden.
    const allScoredHere = new Map([["AAPL", { rs_spy: 4.2 }], ["MSFT", { rs_spy: 1.1 }]])
    const partialElsewhere = { state: "partial", coverage: { rows: 3, scored: 2 } }
    assert.equal(relativeStrengthGapMessage(rows, allScoredHere, partialElsewhere, false), "相對強度來源有 1 檔沒有讀數；原因見各列")
  } finally {
    await server.close()
    if (previousLocation) Object.defineProperty(globalThis, "location", previousLocation)
    else Reflect.deleteProperty(globalThis, "location")
  }
})

test("the relative-strength column header and mobile label carry no unit suffix", async () => {
  const source = await readFile(new URL("../src/components/investment/StockMomentum.tsx", import.meta.url), "utf8")
  assert.match(source, /相對強度<span className="block text-micro text-ink-3">依各列基準與日期<\/span>/)
  assert.match(source, /"相對強度 "/)
  assert.doesNotMatch(source, /相對強度（百分點）/)
  assert.doesNotMatch(source, /相對強度\(百分點\)/)
  const taiwan = await readFile(new URL("../src/components/investment/TaiwanRs.tsx", import.meta.url), "utf8")
  assert.match(taiwan, />相對強度<\/span>/)
  assert.doesNotMatch(taiwan, /相對強度（百分點）/)
})

test("a row explains a missing reading and shows its own window end; lookup results keep the same format", async () => {
  const previousLocation = Object.getOwnPropertyDescriptor(globalThis, "location")
  Object.defineProperty(globalThis, "location", { value: { origin: "http://localhost", hostname: "localhost" }, configurable: true })
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
  try {
    const { UsRsCell, RsLookupResults, relativeStrengthGapMessage } = await server.ssrLoadModule("/src/components/investment/StockMomentum.tsx")
    const { relativeStrengthLookup } = await server.ssrLoadModule("/src/demo/fixtures.ts")
    const text = (element: ReturnType<typeof createElement>) => renderToStaticMarkup(element).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    const window = { trading_days: 60, start_date: "2026-08-12", end_date: "2026-11-05" }

    const earlier = { rs_spy: 1.5, rs_soxx: 2.5, group: null, group_label: null, rs_group: null, diagnostic: { reason_code: null, effective_window: window } }
    assert.equal(text(createElement(UsRsCell, { rs: earlier, rsWindow: 60, rsDate: "2026-11-06" })), "對 SPY +1.50% 對半導體 +2.50% 60 交易日 · 2026-11-05")

    for (const [reason_code, words] of [["ticker_data_unavailable", "查不到"], ["insufficient_history", "上市時間不足"], ["stale", "落後"], ["something_new", "來源未說明"]]) {
      const none = { rs_spy: null, rs_soxx: null, diagnostic: { reason_code, effective_window: window } }
      assert.match(text(createElement(UsRsCell, { rs: none, rsWindow: 60, rsDate: "2026-11-06" })), new RegExp(`^沒有讀數：.*${words}`))
    }

    const lookup = relativeStrengthLookup("synth，nope  SYNTH")
    assert.deepEqual(lookup.rows.map((row: { ticker: string }) => row.ticker), ["SYNTH", "NOPE"])
    assert.equal(lookup.state, "partial")
    assert.deepEqual(lookup.coverage, { rows: 2, scored: 1, stale: 0, no_reading: 1 })
    const rendered = text(createElement(RsLookupResults, { data: { ...lookup, rejected: [{ input: "2330", reason: "目前只支援美股代號" }] } }))
    assert.match(rendered, /2330：目前只支援美股代號/)
    assert.match(rendered, /SYNTH 60 日報酬 9\.4% 對 SPY \+5\.20% 對合成族群 \+3\.10%/)
    assert.match(rendered, /NOPE 60 日報酬 — 沒有讀數：查不到這個代號的日線/)

    assert.equal(relativeStrengthGapMessage([], new Map(), { state: "partial", message: "這次抓價失敗，顯示 11/06 的資料。", coverage: { rows: 1, scored: 1 } }, false), "這次抓價失敗，顯示 11/06 的資料。")
  } finally {
    await server.close()
    if (previousLocation) Object.defineProperty(globalThis, "location", previousLocation)
    else Reflect.deleteProperty(globalThis, "location")
  }
})

// A figure and its benchmark must sit together: with the SPY label below the
// semiconductor line, the headline number read as if it were against either one.
test("each relative-strength figure names its benchmark immediately before the number", async () => {
  const previousLocation = Object.getOwnPropertyDescriptor(globalThis, "location")
  Object.defineProperty(globalThis, "location", { value: { origin: "http://localhost", hostname: "localhost" }, configurable: true })
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
  try {
    const { UsRsCell } = await server.ssrLoadModule("/src/components/investment/StockMomentum.tsx")
    const { TaiwanRsCell } = await server.ssrLoadModule("/src/components/investment/TaiwanRs.tsx")
    const text = (element: ReturnType<typeof createElement>) => renderToStaticMarkup(element).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()

    const semis = { rs_spy: -11.83, rs_soxx: 8.51, group: null, group_label: null, rs_group: null }
    assert.equal(text(createElement(UsRsCell, { rs: semis, rsWindow: 60, rsDate: "2026-11-06" })), "對 SPY -11.83% 對半導體 +8.51% 60 交易日 · 2026-11-06")

    const grouped = { ...semis, group: "demo", group_label: "合成族群", rs_group: 3.1 }
    assert.equal(text(createElement(UsRsCell, { rs: grouped, rsWindow: 60, rsDate: "2026-11-06" })), "對 SPY -11.83% 對合成族群 +3.10% 60 交易日 · 2026-11-06")

    const row = { symbol: "DEMO-TW-A", exchange: "TWSE", state: "partial", market_rs_pp: 1.28, as_of: "2026-09-24", window_start: "2026-07-01", window_trading_days: 60, market_benchmark: { id: "^TWII", label: "加權指數" }, peer_rs_pp: null, peer_group: null, coverage: { holding_sessions: 61, expected_sessions: 61 }, limitations: [], reason_codes: [], provider_symbol: "DEMO-TW-A.TW", price_source: "synthetic", benchmark_source: "synthetic" }
    const data = { state: "partial", holdings: [row], limitations: [], sources: [], requested_date: "2026-09-27", generated_at: "2026-09-27", source_cutoff: "2026-09-24", read_at: "2026-09-27", producer: "synthetic", id: "synthetic", cached: false }
    assert.match(text(createElement(TaiwanRsCell, { symbol: "DEMO-TW-A.TW", data, pending: false, failed: false })), /對 \^TWII \+1\.28% 60 交易日 · 2026-09-24/)
  } finally {
    await server.close()
    if (previousLocation) Object.defineProperty(globalThis, "location", previousLocation)
    else Reflect.deleteProperty(globalThis, "location")
  }
})
