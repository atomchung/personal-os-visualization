import test from "node:test"
import assert from "node:assert/strict"
import type { InvestmentNarrativeEvidenceLayer, InvestmentNarrativeLayerEvidence, InvestmentNarrativeLayerPlayer } from "../src/lib/investment.ts"
import { filterLayerEntityGroups, layerEntityEvidenceGroups, LAYER_ENTITY_PAGE_SIZE, paginateLayerEntityGroups } from "../src/lib/investmentFormat.ts"

function syntheticEvidence(index: number, polarity: InvestmentNarrativeLayerEvidence["polarity"]): InvestmentNarrativeLayerEvidence {
  return {
    evidence_id: `synthetic-evidence-${index}-${polarity}`,
    pillar_id: "L0",
    entity_id: `synthetic-company-${index}`,
    entity_ticker: `SYN${index}`,
    player: "Synthetic company",
    evidence_type: "fact",
    numeric_state: index === 1 ? "not_applicable" : "known",
    numeric_value: index === 1 ? null : "12",
    unit: index === 1 ? null : "percent",
    source_date: "2026-10-01",
    source_type: "public_research",
    source_url: "https://example.invalid/synthetic-source",
    polarity,
    explanation: `Synthetic explanation for company ${index}`,
    as_of: "2026-10-01",
    recorded_at: "2026-10-02",
    freshness: "current",
    valid_until: null,
    source: { path: "synthetic/evidence.md", line: index + 1 },
    state: "ready",
    limitations: ["Synthetic limitation retained"],
  }
}

function syntheticLayer(): InvestmentNarrativeEvidenceLayer {
  const players: InvestmentNarrativeLayerPlayer[] = Array.from({ length: 125 }, (_, index) => ({
    entity_id: `synthetic-company-${index + 1}`,
    player: index < 2 ? "Synthetic shared display name" : `Synthetic company ${index + 1}`,
    recorded_at: "2026-10-02",
    source: { path: "synthetic/players.md", line: index + 1 },
  }))
  players.push({ entity_id: "synthetic-company-1", player: "Synthetic second alias", recorded_at: null, source: null })
  players.push({ entity_id: "", player: "Synthetic unlinked player", recorded_at: null, source: { path: "synthetic/unlinked.md", line: 1 } })
  const evidence = Array.from({ length: 125 }, (_, index) => [
    syntheticEvidence(index + 1, "supports"),
    syntheticEvidence(index + 1, "challenges"),
    syntheticEvidence(index + 1, "unknown"),
  ]).flat()
  evidence.push({ ...syntheticEvidence(1, "unknown"), evidence_id: "synthetic-unlinked-evidence", entity_id: "" })
  return {
    layer_id: "L0",
    label: "Synthetic layer",
    who_earns: "Synthetic only",
    evidence_examples: "Synthetic only",
    what_it_proves: "Synthetic only",
    direction_state: "unknown",
    unknown_reason: null,
    source_date: null,
    document_updated: null,
    source: null,
    players,
    evidence,
  }
}

test("explicit ID groups retain 125 companies, split same-name IDs, and keep unlinked rows visible", () => {
  const { groups, unlinkedPlayers, unlinkedEvidence } = layerEntityEvidenceGroups(syntheticLayer())
  assert.equal(groups.length, 125)
  assert.equal(groups.find(group => group.entityId === "synthetic-company-1")?.players.length, 2)
  assert.notEqual(groups.find(group => group.entityId === "synthetic-company-1"), groups.find(group => group.entityId === "synthetic-company-2"), "the same producer-authored name under distinct IDs remains separate")
  assert.deepEqual(unlinkedPlayers.map(player => player.player), ["Synthetic unlinked player"])
  assert.deepEqual(unlinkedEvidence.map(item => item.evidence_id), ["synthetic-unlinked-evidence"])
})

test("search and pagination make every explicit entity reachable without changing evidence provenance", () => {
  const layer = syntheticLayer()
  const { groups } = layerEntityEvidenceGroups(layer)
  const firstPage = paginateLayerEntityGroups(groups, 1)
  assert.equal(LAYER_ENTITY_PAGE_SIZE, 20)
  assert.equal(firstPage.items.length, 20)
  assert.equal(firstPage.pageCount, 7)
  const allVisible = Array.from({ length: firstPage.pageCount }, (_, index) => paginateLayerEntityGroups(groups, index + 1).items).flat()
  assert.deepEqual(allVisible.map(group => group.entityId), groups.map(group => group.entityId))
  assert.equal(new Set(allVisible.map(group => group.entityId)).size, 125)
  assert.deepEqual(filterLayerEntityGroups(groups, "SYN125").map(group => group.entityId), ["synthetic-company-125"])
  assert.deepEqual(filterLayerEntityGroups(groups, "synthetic-evidence-125-challenges").map(group => group.entityId), ["synthetic-company-125"])
  assert.deepEqual(filterLayerEntityGroups(groups, "synthetic shared display name").map(group => group.entityId), ["synthetic-company-1", "synthetic-company-2"])
  assert.equal(paginateLayerEntityGroups(groups, 99).page, 7, "requested pages clamp to the available range")

  const preserved = allVisible[0]!.evidence[0]!
  assert.equal(preserved.source?.path, "synthetic/evidence.md")
  assert.equal(preserved.source?.line, 2)
  assert.equal(preserved.polarity, "supports")
  assert.equal(preserved.explanation, "Synthetic explanation for company 1")
  assert.deepEqual(preserved.limitations, ["Synthetic limitation retained"])
  assert.equal(preserved.numeric_state, "not_applicable")
  assert.equal(preserved.numeric_value, null)
  assert.equal(preserved.unit, null)
})
