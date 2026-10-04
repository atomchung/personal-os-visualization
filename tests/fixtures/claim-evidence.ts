import type { InvestmentEvidenceClaimRelation, InvestmentNarrativeLayerEvidence, InvestmentNarrativeThesisEvidence } from "../../src/lib/investment.ts"

/** Entirely fictional garden experiment. No financial/private fixture content. */
export const syntheticClaimEvidence = (): InvestmentNarrativeThesisEvidence => {
  const relation = (id: string, direction: InvestmentEvidenceClaimRelation["direction"], reason: string): InvestmentEvidenceClaimRelation => ({
    evidence_id: id,
    claim_id: "demo-garden-water-use",
    direction,
    reason,
    assessed_at: "2001-02-03",
    relation_state: "linked",
    state: "ready",
    limitations: ["虛構花園測試，未涵蓋其他土壤。"],
    source: { path: "synthetic/garden-relations.md", line: direction === "supports" ? 2 : direction === "challenges" ? 3 : 4, label: "虛構花園關係記錄" },
  })
  const relations = [
    relation("demo-garden-later-trial", "supports", "後一次花圃試驗的用水減少，來源將這筆結果列為支持節水主張。"),
    relation("demo-garden-early-trial", "challenges", "較早的黏土花圃試驗出現漏水，來源當時將此列為對節水主張的挑戰。"),
    relation("demo-garden-maintenance", "mixed", "乾燥天的灌溉量減少，但管線清洗用水增加；來源保留混合影響。"),
  ]
  const row = (item: InvestmentEvidenceClaimRelation, index: number): InvestmentNarrativeLayerEvidence => ({
    evidence_id: item.evidence_id,
    pillar_id: "demo-garden-layer",
    entity_id: "demo-garden-plot",
    entity_ticker: null,
    player: "虛構雲庭花圃",
    evidence_type: "fact",
    numeric_state: "not_applicable",
    numeric_value: null,
    unit: null,
    source_date: index === 1 ? "2000-10-01" : "2001-02-02",
    source_type: "public_research",
    source_url: `https://example.invalid/garden/${item.evidence_id}`,
    // A layer-wide direction must never overwrite the exact claim direction.
    polarity: "supports",
    explanation: `虛構花圃第 ${index + 1} 筆試驗記錄。`,
    as_of: index === 1 ? "2000-10-01" : "2001-02-02",
    recorded_at: "2001-02-03",
    freshness: index === 1 ? "stale" : "current",
    valid_until: index === 1 ? "2000-11-01" : null,
    source: { path: "synthetic/garden-observations.md", line: index + 2, label: "虛構花園試驗" },
    state: "ready",
    limitations: [],
    claim_relations: [item],
    claim_link_state: "linked",
    claim_link_reason: null,
  })
  return {
    state: "ready",
    claim_registry: {
      schema_version: 1,
      state: "ready",
      claims: [{ claim_id: "demo-garden-water-use", title: "雲庭花園的節水主張", claim_statement: "虛構雲庭花園改用滴灌後，同樣面積的花圃會減少總用水。", supersedes: "", state: "ready", source: { path: "synthetic/garden-claims.md", line: 2 } }],
      unlinked_claims: [], conflicts: [], reason: null,
      source: { path: "synthetic/garden-claims.md", line: 1 },
    },
    evidence_claim_relations: {
      schema_version: 1, state: "ready", relations,
      unlinked_relations: [], conflicts: [], unlinked_evidence_ids: [], reason: null,
      source: { path: "synthetic/garden-relations.md", line: 1 },
    },
    layers: [{
      layer_id: "demo-garden-layer", label: "虛構花園層級", who_earns: "虛構測試", evidence_examples: "虛構測試", what_it_proves: "來源範圍內的花園觀察", direction_state: "supports",
      opposing_coverage: { state: "sufficient", checked_at: "2001-02-03", scope: "僅限虛構花園層級", reason: "此收據不表示已檢查所有主張的反方。", source: { path: "synthetic/garden-coverage.md", line: 1 } },
      evidence: relations.map(row), unknown_reason: null, source_date: "2001-02-03", document_updated: "2001-02-03", source: { path: "synthetic/garden-layer.md", line: 1 },
    }],
    directional_signals: [],
    latest_recorded_change: { date: null, judgment: null, key_evidence: null, later_verification: null, state: "unknown", missing: [], source: null },
    reason: null,
  }
}
