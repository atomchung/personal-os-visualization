import type { InvestmentBrief, InvestmentTodayUpdate, InvestmentTodayView } from "../../src/lib/investment.ts"

const formalAction = {
  id: "synthetic-formal-action-1",
  text: "合成正式簡報行動：保留觀察，待來源條件確認後再評估。",
  status: "open" as const,
  kind: "watch" as const,
  tickers: [],
  evidence: ["合成正式依據原文"],
  artifact_id: "synthetic-brief-artifact-1",
  source: "synthetic-brief.md",
  date: "2001-02-03",
}

export const syntheticPresentationBrief = (): InvestmentBrief => ({
  state: "current",
  date: "2001-02-03",
  generated_at: "2001-02-03T08:01:00+08:00",
  source_cutoff: "2001-02-03T08:00:00+08:00",
  session: null,
  headline: "合成正式簡報基線。",
  market_pulse: [],
  market_pulse_notes: [],
  events: [],
  market_observations: [],
  event_notes: [],
  thesis_changes: [],
  thesis_notes: [],
  upcoming: [],
  upcoming_notes: [],
  actions: [],
  action_items: [{ ...formalAction }],
  judgment: {
    class: "watch",
    judgment: "合成正式判斷原文：目前維持觀察。",
    why_now: "合成正式簡報依據原文。",
    revisit: "合成來源更新後重新檢視。",
    decision_effect: "合成條件成立後才重新評估。",
    provenance: { artifact: "synthetic-brief.md", source_cutoff: "2001-02-03T08:00:00+08:00" },
    same_action_id: formalAction.id,
  },
  risks: [],
  risk_notes: [],
  source: null,
})

export const syntheticIntradayUpdate = (): InvestmentTodayUpdate => ({
  id: "synthetic-update-1",
  story_id: "synthetic-story-1",
  observed_at: "2001-02-03T09:15:00+08:00",
  scan_mode: "quick",
  market_scope: "all",
  market_date: "unknown",
  source_cutoff: "2001-02-03T09:10:00+08:00",
  scan_completed_at: "2001-02-03T09:15:00+08:00",
  coverage_state: "complete",
  information_kind: "event",
  event: "合成盤中來源事件原文。",
  event_title: "合成盤中事件",
  declared_decision_transition: false,
  summary: "合成盤中補充觀察摘要。",
  portfolio_impact: "合成盤中更新原因原文。",
  action: "合成盤中提醒原文。",
  relevance: [],
  source_path: "synthetic-update.json",
})

export const syntheticPresentationToday = (): InvestmentTodayView => {
  const update = syntheticIntradayUpdate()
  return {
    state: "ready",
    decision_summary: null,
    updates: [update],
    market_observations: [],
    timeline: [
      {
        kind: "brief",
        at: "2001-02-03T08:00:00+08:00",
        timeline_at: "2001-02-03T08:01:00+08:00",
        date: "2001-02-03",
        session: null,
        generated_at: "2001-02-03T08:01:00+08:00",
        source_cutoff: "2001-02-03T08:00:00+08:00",
        path: "synthetic-brief.md",
        headline: "合成正式簡報基線。",
        events: [],
        market_observations: [],
      },
      {
        ...update,
        kind: "update",
        at: "2001-02-03T09:10:00+08:00",
        timeline_at: update.observed_at,
      },
    ],
    limitations: [],
  }
}

export const syntheticBriefWithSameWording = (): InvestmentBrief => {
  const brief = syntheticPresentationBrief()
  const update = syntheticIntradayUpdate()
  brief.action_items = [
    ...(brief.action_items ?? []),
    { ...formalAction, id: "synthetic-independent-formal-action", text: update.action, artifact_id: "synthetic-brief-artifact-2" },
  ]
  return brief
}


/** Entirely fictional irrigation-system research. No live ticker, portfolio or source content. */
export function syntheticJudgmentUpdate(state: "reassessed" | "unchanged" | "preserved" | "pending" = "reassessed") {
  const brief = syntheticPresentationBrief()
  brief.session = "tw-open-prep"
  brief.judgment = {
    class: "watch", judgment: "合成灌溉設備：訂單能否變成持續收入，仍需確認。",
    why_now: "原先只有單季設備出貨資料，還沒有維護服務續約的證據。",
    revisit: "下一次服務續約資料公布時", decision_effect: "若續約持續且維修成本沒有上升，再覆核收入的持續性。",
    provenance: { artifact: "synthetic/irrigation-brief.md", source_revision: "sha256:synthetic-brief-v1", source_cutoff: brief.source_cutoff },
    same_action_id: "synthetic-formal-action-1",
  }
  const assessedAt = "2001-02-03T10:00:00+08:00"
  const delta = {
    ...brief.judgment,
    judgment: "合成灌溉設備：續約增加，短期收入的持續性比原先更有依據；長期維修成本仍未知。",
    why_now: "新公布的服務續約支持當季收入延續；只涵蓋一個季度，還不能回答未來三年的維修成本。",
    provenance: { artifact: "synthetic/irrigation-update.md", source_revision: "sha256:synthetic-update-v2", source_cutoff: assessedAt,
      baseline_revision: "sha256:synthetic-brief-v1", baseline_cutoff_at: brief.source_cutoff, assessed_at: assessedAt,
      validated_story_ids: ["synthetic-irrigation-renewals"] },
  }
  const latest = {
    state, reason_code: state === "pending" ? "baseline_mismatch" : null,
    reason: state === "reassessed" ? "這次提高了對當季收入的把握，但長期成本還沒回答，因此仍先觀察。"
      : state === "unchanged" ? "有新增續約資料，但觀察時間仍短；覆核後維持原先判斷。"
        : state === "preserved" ? "本次查核範圍內沒有重要增量，沿用先前判斷。" : "本次來源版本未能核對，暫時不能採用新判斷。",
    baseline_cutoff_at: brief.source_cutoff, assessed_at: assessedAt, source_revision: "sha256:synthetic-update-v2",
  }
  const currentDelta = state === "reassessed" ? delta : null
  const today: InvestmentTodayView = {
    ...syntheticPresentationToday(), updates: [], timeline: [],
    current_judgment: { market: "tw", state,
      baseline: { artifact: "synthetic/irrigation-brief.md", revision: "sha256:synthetic-brief-v1", source_cutoff: brief.source_cutoff },
      formal_judgment: brief.judgment, effective_judgment: currentDelta ?? brief.judgment,
      current_delta: currentDelta, effective_source: currentDelta ? "last_successful_reassessment" : "formal_baseline", latest_assessment: latest },
    intraday_refresh: { schema_version: "1.0", markets: { tw: {
      state: state === "preserved" ? "no_material_update" : "updated", freshness: "fresh",
      baseline_cutoff: brief.source_cutoff, baseline_revision: "sha256:synthetic-brief-v1",
      input_cutoff: assessedAt, last_successful_cutoff: assessedAt, last_successful_refresh: null,
      latest_receipt: { result: state === "preserved" ? "no_material_update" : "updated", coverage_state: "complete",
        finished_at: assessedAt, baseline_generated_at: brief.generated_at, baseline_cutoff_at: brief.source_cutoff,
        baseline_artifact_sha256: "synthetic-brief-v1" },
      current_judgment: { state, current_delta: currentDelta, latest_assessment: { ...latest } }, story_states: [], limitations: [],
    } }, timeline_updates: [], updates: [], market_observations: [], limitations: [] },
  }
  return { brief, today }
}
