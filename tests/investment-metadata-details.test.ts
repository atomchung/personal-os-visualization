import test from "node:test"
import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createServer } from "vite"
import { watch, investmentHistory } from "./fixtures/extended-ui.ts"

// issue #59: producer/as_of/source_cutoff/generated_at (and the per-limitation
// lines) used to sit at the main reading level of "研究與事件" and "復盤與學習".
// They now live inside a collapsed "資料來源與讀取狀況" details, with at most
// one plain status line left on the main level.
test("ResearchWatch and InvestmentHistory move producer metadata into a collapsed details and keep one plain status line", async () => {
  const previousLocation = Object.getOwnPropertyDescriptor(globalThis, "location")
  Object.defineProperty(globalThis, "location", { value: { origin: "http://localhost", hostname: "localhost" }, configurable: true })
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
  try {
    const { ResearchWatch } = await server.ssrLoadModule("/src/components/investment/ResearchWatch.tsx")
    const { InvestmentHistory } = await server.ssrLoadModule("/src/components/investment/InvestmentHistory.tsx")
    const withClient = (element: unknown) => renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, element))

    // Both demo fixtures are `state: "partial"` with a non-empty `limitations`,
    // so both code paths (the status line and the details contents) render.
    assert.equal(watch.state, "partial")
    assert.ok(watch.limitations.length > 0)
    assert.equal(investmentHistory.state, "partial")
    assert.ok(investmentHistory.limitations.length > 0)

    const researchWatchHtml = withClient(createElement(ResearchWatch, { data: watch }))
    assert.match(researchWatchHtml, /資料來源與讀取狀況/)
    assert.match(researchWatchHtml, /Watch producer：synthetic-demo/)
    assert.match(researchWatchHtml, /source_cutoff：unknown/)
    assert.match(researchWatchHtml, new RegExp(watch.limitations[0]))
    assert.match(researchWatchHtml, /來源涵蓋與登記限制（1 項），展開看明細/)

    const historyHtml = withClient(createElement(InvestmentHistory, { data: investmentHistory }))
    assert.match(historyHtml, /資料來源與讀取狀況/)
    assert.match(historyHtml, /producer：tools\/history_view\.py/)
    assert.match(historyHtml, /source_cutoff：unknown/)
    assert.match(historyHtml, new RegExp(investmentHistory.limitations[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))

    // Ready/empty state: no limitations, so no plain status line -- but the
    // details itself (and its metadata) still renders.
    const readyWatch = { ...watch, state: "ready" as const, limitations: [] }
    const readyHtml = withClient(createElement(ResearchWatch, { data: readyWatch }))
    assert.match(readyHtml, /資料來源與讀取狀況/)
    assert.doesNotMatch(readyHtml, /來源涵蓋與登記限制/)
  } finally {
    await server.close()
    if (previousLocation) Object.defineProperty(globalThis, "location", previousLocation)
    else Reflect.deleteProperty(globalThis, "location")
  }
})
