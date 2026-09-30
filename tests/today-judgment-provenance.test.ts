import test, { after, before } from "node:test"
import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createServer, type ViteDevServer } from "vite"
import { investment } from "./fixtures/extended-ui.ts"
import type { InvestmentBrief, InvestmentTodayView } from "../src/lib/investment.ts"
import { todayJudgmentTimeMetadata } from "../src/lib/investmentFormat.ts"

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

const formalBrief = (overrides: Partial<InvestmentBrief> = {}): InvestmentBrief => ({
  ...structuredClone(investment.brief),
  state: "current",
  date: "2026-10-01",
  generated_at: "2026-10-01T21:12:00+08:00",
  source_cutoff: "2026-10-01T21:09:00+08:00",
  session: "us-open-prep",
  ...overrides,
})

const failedLaterScan = (generatedAt: string, receiptOverrides: Record<string, unknown> = {}) => ({
  ...structuredClone(investment.today),
  intraday_refresh: {
    ...structuredClone(investment.today.intraday_refresh!),
    markets: {
      us: {
        state: "failed",
        freshness: "stale",
        baseline_cutoff: "2026-10-01T21:09:00+08:00",
        input_cutoff: "2026-10-01T21:35:00+08:00",
        last_successful_cutoff: "2026-10-01T21:09:00+08:00",
        last_successful_refresh: null,
        latest_receipt: {
          market: "us" as const,
          baseline_generated_at: generatedAt,
          started_at: "2026-10-01T21:35:00+08:00",
          finished_at: "2026-10-01T21:36:00+08:00",
          result: "failed",
          coverage_state: "failed",
          ...receiptOverrides,
        },
        story_states: [],
        limitations: [],
      },
    },
  },
}) as InvestmentTodayView

async function renderCard(brief: InvestmentBrief, today: InvestmentTodayView): Promise<string> {
  const { TodayNextSteps } = await server.ssrLoadModule("/src/components/investment/InvestmentPage.tsx")
  const client = new QueryClient()
  return renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(TodayNextSteps, { b: brief, today })))
}

test("same-class TW-open to US-open substantive change remains visible in the source-authored judgment", async () => {
  const tw = formalBrief({
    session: "tw-open-prep",
    judgment: { ...investment.brief.judgment!, why_now: "台股開盤前尚未有本地現貨確認，行動維持觀察。" },
  })
  const us = formalBrief({
    judgment: { ...investment.brief.judgment!, why_now: "PCE 低於預期，因此折現率風險緩和一階；目前仍不追價，行動不變。" },
  })
  assert.equal(tw.judgment?.class, "watch")
  assert.equal(us.judgment?.class, "watch")
  const html = await renderCard(us, structuredClone(investment.today))
  assert.match(html, /這次新資訊與判斷/)
  assert.match(html, /PCE 低於預期，因此折現率風險緩和一階；目前仍不追價，行動不變。/)
  assert.match(html, /什麼結果會改變判斷/)
})

test("formal time, source cutoff, and a later failed quick scan remain separate", async () => {
  const brief = formalBrief()
  const today = failedLaterScan(brief.generated_at!)
  const metadata = todayJudgmentTimeMetadata(brief, today)
  assert.equal(metadata.judgmentLine, "美股開盤前判斷 · 更新 21:12")
  assert.equal(metadata.sourceCutoffLine, "資料截至 2026/10/01 21:09 台北")
  assert.equal(metadata.laterScanLine, "後續美股快掃 21:36 失敗；保留 21:12 最新成功判斷")

  const html = await renderCard(brief, today)
  assert.match(html, /美股開盤前判斷 · 更新 21:12/)
  assert.match(html, /資料截至 2026\/10\/01 21:09 台北/)
  assert.match(html, /後續美股快掃 21:36 失敗；保留 21:12 最新成功判斷/)
})

test("a failed projection state still preserves the formal judgment when receipt outcome fields are absent", () => {
  const brief = formalBrief()
  const today = failedLaterScan(brief.generated_at!, { result: undefined, coverage_state: undefined })
  assert.equal(
    todayJudgmentTimeMetadata(brief, today).laterScanLine,
    "後續美股快掃 21:36 失敗；保留 21:12 最新成功判斷",
  )
})

test("a cross-day stale brief is identified as the carried latest snapshot", async () => {
  const brief = formalBrief({
    state: "stale",
    date: "2026-09-30",
    generated_at: "2026-09-30T21:12:00+08:00",
    source_cutoff: "2026-09-30T21:09:00+08:00",
  })
  const html = await renderCard(brief, structuredClone(investment.today))
  assert.match(html, /沿用 9\/30 美股開盤前判斷 · 更新 21:12/)
  assert.match(html, /不代表今天新產生的決定/)
})

test("generated_at is never substituted with source_cutoff", () => {
  const metadata = todayJudgmentTimeMetadata(formalBrief({ generated_at: null }))
  assert.equal(metadata.judgmentLine, "美股開盤前判斷 · 更新 時間未提供")
  assert.equal(metadata.sourceCutoffLine, "資料截至 2026/10/01 21:09 台北")
  assert.equal(metadata.laterScanLine, null)
})

test("a receipt for another formal baseline is not presented as a later scan of this judgment", () => {
  const brief = formalBrief()
  const today = failedLaterScan("2026-10-01T08:00:00+08:00")
  assert.equal(todayJudgmentTimeMetadata(brief, today).laterScanLine, null)
})
