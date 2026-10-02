import test, { after, before } from "node:test"
import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createServer, type ViteDevServer } from "vite"
import { currentTodayActionPlan } from "../src/lib/investmentFormat.ts"
import { syntheticBriefWithSameWording, syntheticIntradayUpdate, syntheticPresentationBrief, syntheticPresentationToday } from "./fixtures/today-presentation.ts"
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

test("a valid projection keeps the formal judgment primary and labels the update with source identity and time", async () => {
  const brief = syntheticPresentationBrief()
  const today = syntheticPresentationToday()
  assert.equal(currentTodayActionPlan(brief, today).some(item => item.id === "synthetic-formal-action-1"), false,
    "the producer-declared same_action_id keeps the linked formal row represented by its judgment")
  const html = await renderTodayBrief(today, false, brief)
  assert.match(html, /aria-label="主要下一步"/)
  assert.match(html, /合成正式判斷原文：目前維持觀察。/)
  assert.match(html, /盤中補充觀察/)
  assert.match(html, /更新時間 2001\/02\/03 09:15 台北/)
  assert.match(html, /來源表示正式判斷不變/)
  assert.match(html, /版本與來源時間/)
  assert.match(html, /更新 ID synthetic-update-1/)
  assert.match(html, /story_id synthetic-story-1/)
  assert.match(html, /來源標記：正式判斷不變/)
  assert.match(html, /<p class="text-caption font-medium text-ink-2">盤中補充觀察<\/p>/)
  assert.doesNotMatch(html, /更新 ID：synthetic-update-1/)
  assert.match(html, /正式簡報 · 版次未標示/)
  assert.doesNotMatch(html, /盤中補充觀察取代正式判斷/)
})

test("a missing Today projection leaves the formal source judgment readable without claiming there was no update", async () => {
  const html = await renderTodayBrief(undefined)
  assert.match(html, /合成正式判斷原文：目前維持觀察。/)
  assert.match(html, /正式簡報判斷 · 更新 08:01/)
  assert.doesNotMatch(html, /盤中補充觀察/)
  assert.doesNotMatch(html, /今天沒有新更新/)
})

test("the same update reason appears once on the action card and as a reference in its timeline point", async () => {
  const html = await renderTodayBrief(syntheticPresentationToday())
  const reasonOccurrences = html.match(/合成盤中更新原因原文。/g) ?? []
  assert.equal(reasonOccurrences.length, 1)
  assert.match(html, /同一筆更新的原因已在上方行動列出。/)
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
    assert.doesNotMatch(html, /同一筆更新的原因已在上方行動列出。/)
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
  assert.match(html, /上次成功讀取的盤中補充觀察 · 更新時間 2001\/02\/03 09:15 台北/)
  assert.match(html, /上次成功讀取的正式簡報行動/)
  assert.match(html, /合成正式簡報行動：保留觀察，待來源條件確認後再評估。/)
  assert.match(html, /合成盤中提醒原文。/)
  assert.match(html, /上次讀取的判斷（目前未確認）/)
})
