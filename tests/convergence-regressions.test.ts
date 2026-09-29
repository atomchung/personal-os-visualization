import test, { before, after } from "node:test"
import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createServer, type ViteDevServer } from "vite"
import { investment, investmentNarrative } from "./fixtures/extended-ui.ts"
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
    unknown: [{ evidence_id: "legacy-unknown", player: "合成舊版未知" }],
  }
  const groups = layerEvidenceGroups(layer)
  assert.equal(groups.challenging.length, 1)
  assert.equal(groups.unknown.length, 1)
  assert.equal(groups.challenging[0].source_date, "2001-02-03")
  assert.equal(groups.challenging[0].numeric_state, "unknown")
  assert.equal(groups.challenging[0].source?.line, 7)
  const evidenceOnly = layerEvidenceGroups({ evidence: [{ evidence_id: "legacy-evidence", polarity: "supports", player: "合成舊版支持" }] })
  assert.equal(evidenceOnly.supporting.length, 1)
  assert.deepEqual(evidenceOnly.legacySupporting, [])
})
test("a failed reread removes current action and judgment while retaining source history", async () => {
  const { TodayNextSteps } = await server.ssrLoadModule("/src/components/investment/InvestmentPage.tsx")
  const client = new QueryClient()
  const b = { ...investment.brief, state: "current", judgment: { class: "watch", judgment: "合成上次判斷", why_now: "合成原因", revisit: null, decision_effect: "合成影響", provenance: { validated_story_ids: [], source_cutoff: null } } }
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(TodayNextSteps, { b, today: investment.today, readFailed: true })))
  assert.match(html, /本次簡報讀取失敗；下一步尚未確認/)
  assert.doesNotMatch(html, /aria-label="主要下一步"|aria-label="其他行動"/)
  assert.match(html, /上次讀取的判斷（目前未確認）/)
  assert.match(html, /合成上次判斷/)
})
