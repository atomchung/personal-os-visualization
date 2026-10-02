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
