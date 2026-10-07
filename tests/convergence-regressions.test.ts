import test, { before, after } from "node:test"
import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createServer, type ViteDevServer } from "vite"
import { investment, investmentNarrative } from "./fixtures/extended-ui.ts"
import { investment as syntheticInvestment } from "../src/demo/fixtures.ts"
import { layerEvidenceGroups } from "../src/lib/investmentFormat.ts"
import type { InvestmentNarrativeEvidenceLayer } from "../src/lib/investment.ts"
let server: ViteDevServer
let oldLocation: PropertyDescriptor | undefined
before(async () => {
  oldLocation = Object.getOwnPropertyDescriptor(globalThis, "location")
  Object.defineProperty(globalThis, "location", { value: { origin: "http://localhost", hostname: "localhost" }, configurable: true })
  server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
})
after(async () => { await server.close(); if (oldLocation) Object.defineProperty(globalThis, "location", oldLocation); else Reflect.deleteProperty(globalThis, "location") })
test("optional legacy evidence arrays and explicit challenging/unknown branches remain readable", () => {
  const layer: InvestmentNarrativeEvidenceLayer = { ...investmentNarrative.narratives[0].thesis_evidence.layers[0], supporting: undefined, opposing: undefined, evidence: undefined,
    challenging: [{ evidence_id: "legacy-challenge", player: "合成舊版反方", evidence_date: "2001-02-03", source: { path: "synthetic-old.md", line: 7, label: "合成來源" } }],
    unknown: [{ evidence_id: "legacy-unknown", player: "合成舊版未知" }, "合成舊版方向未明原文"],
  }
  const groups = layerEvidenceGroups(layer)
  assert.equal(groups.challenging.length, 1)
  assert.equal(groups.unknown.length, 1)
  assert.deepEqual(groups.legacyUnknown, ["合成舊版方向未明原文"])
  assert.equal(groups.challenging[0].source_date, "2001-02-03")
  assert.equal(groups.challenging[0].numeric_state, "unknown")
  assert.equal(groups.challenging[0].source?.line, 7)
  const evidenceOnly = layerEvidenceGroups({ evidence: [{ evidence_id: "legacy-evidence", polarity: "supports", player: "合成舊版支持" }] })
  assert.equal(evidenceOnly.supporting.length, 1)
  assert.deepEqual(evidenceOnly.legacySupporting, [])
  const mixed = layerEvidenceGroups({ evidence: [{ evidence_id: "one", polarity: "unknown" }], unknown: [{ evidence_id: "extra", player: "合成額外未知" }, "合成額外未知原文"] })
  assert.equal(mixed.unknown.length, 2)
  assert.deepEqual(mixed.legacyUnknown, ["合成額外未知原文"])

})
test("a failed reread keeps the last successful action visible and warns that it may be old", async () => {
  const { TodayBrief } = await server.ssrLoadModule("/src/components/investment/InvestmentPage.tsx")
  const client = new QueryClient()
  const b = { ...investment.brief, state: "current", judgment: { class: "watch", judgment: "合成上次判斷", why_now: "合成原因", revisit: null, decision_effect: "合成影響", provenance: { validated_story_ids: [], source_cutoff: null } } }
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(TodayBrief, { b, today: investment.today, readFailed: true, onOpenThesis: () => undefined })))
  assert.match(html, /本次簡報讀取失敗；以下保留上次成功讀到的簡報與行動/)
  assert.match(html, /aria-label="主要下一步"/)
  assert.match(html, /收盤前再看一次量能是否延續/)
  assert.match(html, /上次讀取的判斷（目前未確認）/)
  assert.match(html, /合成上次判斷/)
})

test("incomplete Today data keeps the current formal judgment and uses plain status wording", async () => {
  const { TodayNextSteps } = await server.ssrLoadModule("/src/components/investment/InvestmentPage.tsx")
  for (const state of ["partial", "unavailable"] as const) {
    const client = new QueryClient()
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(TodayNextSteps, {
      b: { ...investment.brief, state: "current" }, today: { ...investment.today, state },
    })))
    assert.match(html, state === "partial" ? /今日資料只更新了一部分/ : /今日更新資料目前無法取得/)
    assert.match(html, /空白欄位不能確認沒有新行動/)
    assert.ok(html.includes(investment.brief.judgment!.judgment))
    assert.doesNotMatch(html, /今日更新狀態為/)
    client.clear()
  }
})

test("a missing admissible receipt never claims no scan ran and keeps a failed scan visible", async () => {
  const { InvestmentPage } = await server.ssrLoadModule("/src/components/investment/InvestmentPage.tsx")
  const data = structuredClone(syntheticInvestment)
  const tw = data.today!.intraday_refresh!.markets.tw
  tw.state = "not_requested"
  tw.freshness = "baseline"
  tw.latest_receipt = null
  tw.last_successful_refresh = null
  tw.last_successful_cutoff = null
  data.today!.intraday_refresh!.limitations = ["Synthetic receipt does not bind to its formal baseline."]
  const client = new QueryClient()
  client.setQueryData(["investment"], data)
  client.setQueryData(["investment-refresh-status", "news"], {
    state: "failed", market_scope: "tw", scan_mode: "quick", message: "合成來源覆蓋未完成，已保留上一版。",
  })
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(InvestmentPage)))
  assert.doesNotMatch(html, /台股：尚無可採用的盤中更新；沿用正式簡報/)
  assert.match(html, /台股消息快掃更新失敗/)
  assert.match(html, /美股：部分來源完成 · 本次未能更新資料截止時間/)
  assert.match(html, /Synthetic receipt does not bind to its formal baseline/)
  assert.doesNotMatch(html, /尚未執行；沿用正式簡報/)
  client.clear()
})

test("stale and failed-read no-change rows are labeled as prior brief judgments", async () => {
  const { TodayNextSteps } = await server.ssrLoadModule("/src/components/investment/InvestmentPage.tsx")
  const client = new QueryClient()
  const template = investment.brief.action_items![0]!
  const b = {
    ...investment.brief,
    state: "stale" as const,
    date: "2026-09-29",
    session: "us-open-prep",
    actions: [],
    judgment: null,
    action_items: [{ ...template, id: "stale-no-change", kind: "no_change" as const, status: "closed" as const, text: "當時沒有因消息調整部位。", date: "2026-09-29" }],
  }
  const today = { ...investment.today, state: "ready" as const, updates: [] }
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(TodayNextSteps, { b, today })))
  assert.match(html, /前版：不調整/)
  assert.match(html, /不代表今天新產生的決定/)
  assert.doesNotMatch(html, />今天不用動</)

  const failedReadHtml = renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(TodayNextSteps, { b: { ...b, state: "current" as const }, today, readFailed: true })))
  assert.match(failedReadHtml, /本次簡報讀取失敗/)
  assert.match(failedReadHtml, /前版：不調整/)
  assert.doesNotMatch(failedReadHtml, />今天不用動</)
})

test("global-only rows survive an existing layer card, with original unknown strings", async () => {
  const { InvestmentNarrativeSection } = await server.ssrLoadModule("/src/components/investment/InvestmentNarrative.tsx")
  const data = structuredClone(investmentNarrative)
  const layer = data.narratives[0].thesis_evidence.layers[0]
  layer.evidence = []; layer.supporting = undefined; layer.opposing = undefined
  layer.unknown = ["合成舊版方向未明原文"]; layer.unlinked_evidence = []; layer.unlinked_players = []
  data.narratives[0].thesis_evidence.unlinked_evidence = [{ evidence_id: "global-only-row", pillar_id: layer.pillar_id, player: "合成同層全域列", limitations: ["合成全域列仍未連結"], source: { path: "synthetic-global-only.md", line: 13, label: "合成來源" } }]
  data.narratives[0].thesis_evidence.unlinked_players = [{ entity_id: "global-only-player", pillar_id: layer.pillar_id, player: "合成同層全域玩家", source: { path: "synthetic-global-only.md", line: 14, label: "合成來源" } }]
  const client = new QueryClient(); client.setQueryData(["investment-narrative"], data)
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(InvestmentNarrativeSection, { enabled: false, onOpenHistory: () => {} })))
  assert.match(html, /合成舊版方向未明原文/)
  assert.match(html, /global-only-row/)
  assert.match(html, /合成同層全域列/)
  assert.match(html, /合成全域列仍未連結/)
  assert.match(html, /合成同層全域玩家/)
  assert.match(html, /synthetic-global-only.md/)
})
