import { investment, investmentNarrative } from "./extended-ui.ts"
import { syntheticClaimEvidence } from "./claim-evidence.ts"

/** Normal, wholly fictional reference content. Stress text is added separately. */
export function judgmentDesignFixture() {
  const data = structuredClone(investmentNarrative)
  const brief = structuredClone(investment.brief)
  const narrative = data.narratives[0]
  data.state = "ready"
  data.source_cutoff = "2001-02-03T08:00:00+08:00"
  data.limitations = []
  narrative.title = "雲庭花園 · 節水改造"
  narrative.state = "ready"
  narrative.state_reason = null
  narrative.updated = "2001-02-03"
  narrative.current_tension = { state: "ready", text: "滴灌減少日常用水，但清洗與維修能否抵銷節省，仍要驗證。", source: { path: "synthetic/garden-reading.md" } }
  narrative.what_i_bet = { state: "ready", reason: null, narrative: { state: "ready", text: "在相同種植面積下，滴灌應能降低雲庭花園的總用水。", source: { path: "synthetic/garden-thesis.md" } }, owner_thesis: { state: "unknown", text: null } }
  narrative.thesis_evidence = syntheticClaimEvidence()
  narrative.thesis_evidence.latest_recorded_change = { date: "2001-02-01", judgment: "保留節水假設，先觀察完整維護週期。", key_evidence: "滴灌試驗減少澆水，維護用水尚未計完。", later_verification: "第二次試驗已納入清洗用水，總節省仍待季末彙整。", state: "ready", missing: [], source: { path: "synthetic/garden-review.md" } }
  narrative.thesis_evidence.directional_signals = [
    { direction: "supports", indicator: "日常用水", dispute: "不同季節能否維持", text: "連續兩次試驗的澆水量均低於原方式。", layer_id: null, priority: "normal", source_channels: "虛構花園試验記錄", source_date: "2001-02-02", document_updated: "2001-02-03", source: { path: "synthetic/garden-signals.md", line: 1 } },
    { direction: "challenges", indicator: "維護需求", dispute: "總用水是否仍減少", text: "較細的管線需要更頻繁清洗，完整維護成本尚待記錄。", layer_id: null, priority: "normal", source_channels: "虛構花園維護記錄", source_date: "2001-02-02", document_updated: "2001-02-03", source: { path: "synthetic/garden-signals.md", line: 2 } },
  ]
  const first = narrative.thesis_evidence.layers[0]
  first.label = "用水與維護"
  first.state = "ready"
  first.current_reading = { state: "partial", text: "日常灌溉已減量，維護週期的資料仍不完整。", as_of: "2001-02-03", authored_by: "合成來源", basis: "兩次虛構試驗", layer_revision: "demo-r1", current_layer_revision: "demo-r1", limitations: ["尚未涵蓋雨季。"], source: { path: "synthetic/garden-layer-reading.md" } }
  first.players = [{ entity_id: "demo-garden-plot", player: "雲庭花圃", recorded_at: "2001-02-03", source: { path: "synthetic/garden-players.md" } }]
  narrative.thesis_evidence.layers.push(...["灌溉設備", "土壤條件", "季節變化", "營運支出"].map((label, i) => ({ ...structuredClone(first), layer_id: `demo-garden-layer-${i + 2}`, label, state: "unknown" as const, direction_state: "unknown" as const, players: [], evidence: [], current_reading: null, opposing_coverage: null, unknown_reason: "此層仍缺完整觀察記錄。" })))
  narrative.references = [{ path: "synthetic/garden-thesis.md" }]
  brief.date = "2001-02-03"
  brief.source_cutoff = data.source_cutoff
  brief.thesis_changes = [{ thesis: "節水效果是否涵蓋維護週期", change: "→ 保留假設，等待完整用水記錄。", reason: "新試驗補上清洗用水；目前還不足以改變原判斷。", event_index: null }]
  brief.thesis_notes = []
  brief.risks = [{ risk: "維護次數高於原先預期", status: "持續觀察，尚未解除。", event_index: null }]
  brief.risk_notes = []
  return { data, brief }
}
