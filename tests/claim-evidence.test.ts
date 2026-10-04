import test, { after, before } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer, type ViteDevServer } from "vite"
import { claimEvidenceSourceUrl, claimEvidenceView } from "../src/lib/investmentClaimEvidence.ts"
import type { InvestmentNarrativeThesisEvidence } from "../src/lib/investment.ts"
import { syntheticClaimEvidence } from "./fixtures/claim-evidence.ts"

let server: ViteDevServer
before(async () => { server = await createServer({ server: { middlewareMode: true }, appType: "custom" }) })
after(async () => { await server.close() })

async function renderEvidence(evidence: InvestmentNarrativeThesisEvidence, snapshotState?: "available" | "cached" | "stale") {
  const { ClaimEvidence } = await server.ssrLoadModule("/src/components/investment/ClaimEvidence.tsx")
  return renderToStaticMarkup(createElement(ClaimEvidence, { evidence, snapshotState }))
}

test("exact claim relations retain support, challenge and mixed reasons with their source evidence", async () => {
  const evidence = syntheticClaimEvidence()
  const view = claimEvidenceView(evidence)
  assert.equal(view.state, "ready")
  assert.equal(view.claims[0].claim, evidence.claim_registry!.claims[0])
  assert.deepEqual(view.claims[0].rows.map(row => row.direction), ["supports", "challenges", "mixed"])
  assert.equal(view.claims[0].rows.every(row => row.evidence?.polarity === "supports"), true, "layer polarity stays independent")
  assert.equal(view.claims[0].rows[2].relation.reason, evidence.evidence_claim_relations!.relations[2].reason)
  assert.equal(view.claims[0].rows[2].sourceUrl, "https://example.invalid/garden/demo-garden-maintenance")
  const html = await renderEvidence(evidence)
  for (const phrase of ["雲庭花園的節水主張", "同樣面積的花圃會減少總用水", "支持此主張", "挑戰此主張", "對此主張有混合影響", "管線清洗用水增加", "synthetic/garden-claims.md:2", "synthetic/garden-relations.md:4", "synthetic/garden-observations.md:4"]) assert.ok(html.includes(phrase), phrase)
  assert.match(html, /href="https:\/\/example.invalid\/garden\/demo-garden-maintenance"/)
  assert.match(html, /列出的關係不代表反方已完整檢查/)
  assert.doesNotMatch(html, /反方完整|沒有反方證據[。<]/)
})

test("one evidence ID can support one claim and independently mix with or challenge another", async () => {
  for (const direction of ["mixed", "challenges"] as const) {
    const evidence = syntheticClaimEvidence()
    const original = evidence.evidence_claim_relations!.relations[0]
    const secondClaimId = "demo-garden-maintenance-effort"
    evidence.claim_registry!.claims.push({ ...evidence.claim_registry!.claims[0], claim_id: secondClaimId, title: "雲庭花園的維護主張", claim_statement: "虛構花園的滴灌維護工作會減少。" })
    const secondRelation = { ...original, claim_id: secondClaimId, direction, reason: "同一筆虛構試驗對維護工作的影響另由來源判定。" }
    evidence.evidence_claim_relations!.relations.push(secondRelation)
    const view = claimEvidenceView(evidence)
    assert.equal(view.state, "ready")
    const firstRow = view.claims[0].rows.find(row => row.relation.evidence_id === original.evidence_id)!
    const secondRow = view.claims[1].rows[0]
    assert.equal(firstRow.direction, "supports")
    assert.equal(secondRow.direction, direction)
    assert.equal(secondRow.relation, secondRelation)
    assert.equal(firstRow.evidence, secondRow.evidence, "both exact relations link to the same evidence record")
    assert.equal(firstRow.sourceUrl, secondRow.sourceUrl)
    assert.equal(view.issues.length, 0, "distinct claim IDs are not a relation conflict")
    const html = await renderEvidence(evidence)
    assert.ok(html.includes(original.reason))
    assert.ok(html.includes(secondRelation.reason))
    assert.match(html, /雲庭花園的維護主張/)
  }
})

test("ready relation never makes a stale challenge current, and later support does not erase it", async () => {
  const evidence = syntheticClaimEvidence()
  const rows = claimEvidenceView(evidence).claims[0].rows
  assert.equal(rows[0].timing, "current")
  assert.equal(rows[1].relation.state, "ready")
  assert.equal(rows[1].direction, "challenges")
  assert.equal(rows[1].timing, "historical")
  assert.equal(rows.length, 3)
  const html = await renderEvidence(evidence)
  assert.match(html, /data-claim-direction="challenges" data-evidence-timing="historical"/)
  assert.match(html, /歷史資料，來源已過期/)
  assert.match(html, /不代表目前仍然成立/)
  assert.match(html, /後一次花圃試驗的用水減少/)
  assert.match(html, /較早的黏土花圃試驗出現漏水/)
})

test("failed cached rereads and stale parent snapshots retain direction without claiming current validity", async () => {
  const evidence = syntheticClaimEvidence()
  for (const snapshot of ["cached", "stale"] as const) {
    const html = await renderEvidence(evidence, snapshot)
    assert.ok(html.includes(`data-claim-evidence-snapshot="${snapshot}"`))
    assert.match(html, /尚未重新確認目前狀態/)
    assert.match(html, /data-claim-direction="supports" data-evidence-timing="snapshot"/)
    assert.match(html, /data-claim-direction="mixed" data-evidence-timing="snapshot"/)
    assert.match(html, /data-claim-direction="challenges" data-evidence-timing="historical"/)
    assert.match(html, /歷史資料，來源已過期/)
    assert.doesNotMatch(html, /來源標示目前有效|data-evidence-timing="current"/)
    for (const relation of evidence.evidence_claim_relations!.relations) assert.ok(html.includes(relation.reason), "source reasons remain unchanged")
  }
  evidence.state = "stale"
  assert.match(await renderEvidence(evidence), /data-claim-evidence-snapshot="stale"/)
  assert.doesNotMatch(await renderEvidence(evidence), /來源標示目前有效/)
  const narrative = readFileSync(new URL("../src/components/investment/InvestmentNarrative.tsx", import.meta.url), "utf8")
  assert.match(narrative, /snapshotState=\{!readable \? "cached" : narrative\.state === "stale" \|\| evidence\.state === "stale" \? "stale" : "available"\}/)
})

test("absent fields and explicitly empty global or embedded arrays have different meanings", async () => {
  const absent = syntheticClaimEvidence()
  delete absent.evidence_claim_relations
  for (const row of absent.layers[0].evidence!) { delete row.claim_relations; delete row.claim_link_state }
  assert.equal(claimEvidenceView(absent).state, "unavailable")
  assert.match(await renderEvidence(absent), /來源尚未提供證據與主張的關係資料/)
  const empty = syntheticClaimEvidence()
  empty.evidence_claim_relations!.relations = []
  assert.equal(claimEvidenceView(empty).state, "empty")
  assert.equal(claimEvidenceView(empty).claims[0].rows.length, 0, "global empty declaration is not backfilled from embedded rows")
  assert.match(await renderEvidence(empty), /來源明確列出零筆已對應的關係/)
  assert.match(await renderEvidence(empty), /不代表沒有反方證據/)
  delete empty.evidence_claim_relations
  for (const row of empty.layers[0].evidence!) row.claim_relations = []
  assert.equal(claimEvidenceView(empty).state, "empty")
  empty.layers[0].evidence![0].claim_link_state = "unlinked"
  assert.equal(claimEvidenceView(empty).state, "partial")
  assert.match(claimEvidenceView(empty).notice, /來源明確列出零筆已對應的關係/)
  const partial = syntheticClaimEvidence()
  partial.evidence_claim_relations!.state = "partial"
  assert.equal(claimEvidenceView(partial).state, "partial")
  assert.equal(claimEvidenceView(partial).claims[0].rows[0].direction, "supports")
  delete partial.evidence_claim_relations
  delete partial.layers[0].evidence![0].claim_relations
  assert.equal(claimEvidenceView(partial).state, "partial")
  assert.match(claimEvidenceView(partial).reasons.join(" "), /部分證據未提供關係欄位/)
})

test("embedded relation IDs must match their owning evidence row", () => {
  const evidence = syntheticClaimEvidence()
  delete evidence.evidence_claim_relations
  evidence.layers[0].evidence![0].claim_relations![0].evidence_id = "demo-garden-maintenance"
  const view = claimEvidenceView(evidence)
  assert.equal(view.state, "partial")
  assert.equal(view.claims[0].rows.length, 2)
  assert.match(view.issues[0].message, /證據列與關係列的 ID 不一致/)
})

test("unknown relation or receipt keeps generic risk text unclassified rather than observed challenge", async () => {
  const evidence = syntheticClaimEvidence()
  const relation = evidence.evidence_claim_relations!.relations[2]
  relation.state = "unknown"
  relation.direction = "challenges"
  relation.reason = "虛構一般風險揭露：管線可能堵塞，尚無花圃觀察確認。"
  const view = claimEvidenceView(evidence)
  assert.equal(view.state, "partial")
  assert.equal(view.claims[0].rows[2].direction, "unknown")
  const html = await renderEvidence(evidence)
  assert.match(html, /關係尚待確認/)
  assert.match(html, /不能視為已成立的支持或挑戰/)
  assert.match(html, /虛構一般風險揭露/)
  evidence.evidence_claim_relations!.state = "unknown"
  assert.equal(claimEvidenceView(evidence).state, "unknown")
  assert.equal(claimEvidenceView(evidence).claims[0].rows.every(row => row.direction === "unknown"), true)
})

test("declared conflicts and duplicate evidence IDs never choose a relationship or source URL", async () => {
  const evidence = syntheticClaimEvidence()
  const relation = evidence.evidence_claim_relations!.relations[0]
  evidence.evidence_claim_relations!.state = "conflict"
  evidence.evidence_claim_relations!.conflicts = [{ evidence_id: relation.evidence_id, claim_id: relation.claim_id, state: "conflict", rows: [relation, { ...relation, direction: "challenges", reason: "虛構衝突版本保留。", source: { path: "synthetic/garden-conflict.md", line: 2 } }] }]
  let view = claimEvidenceView(evidence)
  assert.equal(view.state, "conflict")
  assert.equal(view.claims[0].rows.some(row => row.relation.evidence_id === relation.evidence_id), false)
  const html = await renderEvidence(evidence)
  assert.match(html, /虛構衝突版本保留/)
  assert.match(html, /synthetic\/garden-conflict.md:2/)
  assert.doesNotMatch(html, /href="https:\/\/example.invalid\/garden\/demo-garden-later-trial"/)

  const ambiguous = syntheticClaimEvidence()
  ambiguous.layers[0].evidence!.push({ ...ambiguous.layers[0].evidence![0], source_url: "https://example.invalid/wrong-record" })
  view = claimEvidenceView(ambiguous)
  assert.equal(view.claims[0].rows[0].sourceUrl, null)
  assert.equal(view.claims[0].rows[0].evidence, null)
  assert.equal(view.claims[0].rows[0].direction, "unknown")
  assert.equal(view.claims[0].rows[0].timing, "unknown")
  assert.match((await renderEvidence(ambiguous)), /證據 ID 對應多筆不同資料/)
  ambiguous.layers[0].evidence!.pop()
  ambiguous.layers[0].supporting = [...ambiguous.layers[0].evidence!]
  assert.equal(claimEvidenceView(ambiguous).claims[0].rows[0].sourceUrl, "https://example.invalid/garden/demo-garden-later-trial", "identical repeated branch rows are not ambiguous")
})

test("claim identity conflicts, missing identities and malformed relation rows remain explicit", async () => {
  const evidence = syntheticClaimEvidence()
  evidence.claim_registry!.claims.push({ ...evidence.claim_registry!.claims[0], claim_statement: "虛構同 ID 的另一個主張。" })
  let view = claimEvidenceView(evidence)
  assert.equal(view.state, "conflict")
  assert.equal(view.claims.length, 0)
  assert.match(await renderEvidence(evidence), /虛構同 ID 的另一個主張/)
  const missing = syntheticClaimEvidence()
  delete missing.claim_registry
  view = claimEvidenceView(missing)
  assert.equal(view.claims.length, 0)
  assert.equal(view.issues.length, 3)
  assert.match(await renderEvidence(missing), /主張清單與文字/)
  const malformed = syntheticClaimEvidence()
  malformed.evidence_claim_relations!.unlinked_relations = [{ evidence_id: "demo-unlinked", direction: "sideways", reason: "虛構關係缺少主張 ID。", state: "unlinked", limitations: ["虛構欄位不完整。"], source: { path: "synthetic/garden-unlinked.md", line: 8 } }]
  malformed.evidence_claim_relations!.unlinked_evidence_ids = ["demo-unlinked"]
  const html = await renderEvidence(malformed)
  assert.match(html, /虛構關係缺少主張 ID/)
  assert.match(html, /虛構欄位不完整/)
  assert.match(html, /synthetic\/garden-unlinked.md:8/)
  assert.match(html, /demo-unlinked/)
})

test("safe links require exact IDs and never use matching title, player, layer direction or prose", () => {
  const evidence = syntheticClaimEvidence()
  evidence.evidence_claim_relations!.relations[0].evidence_id = "demo-missing-id"
  const row = claimEvidenceView(evidence).claims[0].rows[0]
  assert.equal(row.sourceUrl, null)
  assert.equal(row.evidence, null)
  assert.equal(row.direction, "unknown")
  for (const url of ["javascript:alert(1)", "https://user:password@example.invalid/", "http://example.invalid/", "/relative", "not a url"]) assert.equal(claimEvidenceSourceUrl(url), null)
  assert.equal(claimEvidenceSourceUrl("https://example.invalid/garden"), "https://example.invalid/garden")
})

test("long source reasons remain complete and wrappable near the narrative judgment", async () => {
  const evidence = syntheticClaimEvidence()
  const longText = `虛構長理由起點${"花園滴灌觀察".repeat(150)}虛構長理由終點`
  evidence.evidence_claim_relations!.relations[2].reason = longText
  const html = await renderEvidence(evidence)
  assert.ok(html.includes(longText))
  assert.match(html, /min-w-0 break-words \[overflow-wrap:anywhere\]/)
  assert.doesNotMatch(html, /line-clamp|truncate/)
  const narrative = readFileSync(new URL("../src/components/investment/InvestmentNarrative.tsx", import.meta.url), "utf8")
  assert.ok(narrative.indexOf('<ClaimEvidence evidence={evidence}') > narrative.indexOf('aria-label="目前判斷"'))
  assert.ok(narrative.indexOf('<ClaimEvidence evidence={evidence}') < narrative.indexOf('aria-label="長期論點"'))
})
