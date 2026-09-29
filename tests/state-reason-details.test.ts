import test from "node:test"
import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

// The producer's non-ready explanation ("部分 evidence 未連到 claim…") used to
// sit as an orange main-level line under 我的判斷 even though the state chip
// already says 資料部分可用. It now stays available inside a folded details.
test("a producer state reason renders folded under 資料狀態說明, and nothing when absent", async () => {
  const previousLocation = Object.getOwnPropertyDescriptor(globalThis, "location")
  Object.defineProperty(globalThis, "location", { value: { origin: "http://localhost", hostname: "localhost" }, configurable: true })
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
  try {
    const { StateReasonDetails } = await server.ssrLoadModule("/src/components/investment/InvestmentNarrative.tsx")
    const reason = "部分 evidence 未連到 claim，或明確 relation 的方向仍為 unknown"
    const html = renderToStaticMarkup(createElement(StateReasonDetails, { reason }))
    assert.match(html, /^<details/)
    assert.match(html, /<summary[^>]*>資料狀態說明<\/summary>/)
    assert.ok(html.includes(reason), "the producer's wording is kept, only folded")
    assert.equal(renderToStaticMarkup(createElement(StateReasonDetails, { reason: null })), "")
    assert.equal(renderToStaticMarkup(createElement(StateReasonDetails, { reason: "   " })), "")
  } finally {
    await server.close()
    if (previousLocation) Object.defineProperty(globalThis, "location", previousLocation)
    else delete (globalThis as { location?: unknown }).location
  }
})
