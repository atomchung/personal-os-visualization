import test from "node:test"
import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createServer } from "vite"
import { readFileSync } from "node:fs"
import { judgmentDesignFixture } from "./fixtures/judgment-design.ts"

test("judgment progressive disclosure retains all directions and announces later adverse claims", async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
  try {
    const { ClaimEvidence } = await server.ssrLoadModule("/src/components/investment/ClaimEvidence.tsx")
    const evidence = judgmentDesignFixture().data.narratives[0].thesis_evidence
    const second = { ...evidence.claim_registry!.claims[0], claim_id: "other-garden-claim", title: "第二個獨立主張" }
    evidence.claim_registry!.claims.push(second)
    const opposing = { ...evidence.evidence_claim_relations!.relations[1], claim_id: second.claim_id }
    evidence.evidence_claim_relations!.relations.push(opposing)
    const html = renderToStaticMarkup(createElement(ClaimEvidence, { evidence }))
    const secondAt = html.indexOf('data-claim-id="other-garden-claim"')
    const summary = html.slice(secondAt, html.indexOf('</summary>', secondAt))
    assert.match(summary, /挑戰此主張 1 筆/)
    assert.doesNotMatch(html.slice(html.lastIndexOf('<details', secondAt), secondAt), / open=/)
    assert.match(html, /歷史資料，來源已過期/)
    assert.match(html, /對此主張有混合影響/)
    assert.match(html, /synthetic\/garden-relations.md/)
    assert.match(html, /demo-garden-early-trial/)
    assert.doesNotMatch(html, /line-clamp|truncate/)
  } finally { await server.close() }
})

test("pending source review remains visible outside the folded layers", async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
  try {
    const { InvestmentNarrativeSection } = await server.ssrLoadModule("/src/components/investment/InvestmentNarrative.tsx")
    const data = judgmentDesignFixture().data
    data.narratives[0].thesis_evidence.scorecard_update = { status: "evidence_pending_review", updated_at: "2001-02-03" } as never
    const client = new QueryClient(); client.setQueryData(["investment-narrative"], data)
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(InvestmentNarrativeSection, { enabled: false, onOpenHistory: () => undefined })))
    assert.ok(html.indexOf('新證據待覆核') < html.indexOf('data-testid="judgment-layers"'))
    assert.match(html, /未列出不代表不存在/)
    assert.match(html, /資料狀態，不代表論點成立/)
  } finally { await server.close() }
})

test("judgment direction colors have AA normal-text contrast on white", () => {
  const css = readFileSync(new URL('../src/components/investment/judgment.css', import.meta.url), 'utf8')
  const colors = [...css.matchAll(/--judgment-(?:support|challenge|mixed|unknown): (#[\da-f]{6})/g)].map(match => match[1])
  assert.equal(colors.length, 4)
  for (const hex of colors) {
    const rgb = [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
    const luminance = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722
    assert.ok(1.05 / (luminance + .05) >= 4.5, hex)
  }
})
