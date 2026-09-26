import assert from "node:assert/strict"
import { test } from "node:test"
import { createDemoRequest } from "../src/demo/transport.ts"
import { investment as syntheticInvestment, investmentHistory, investmentHistorySources, investmentResearch, pulseIntegrityScenarios } from "../src/demo/fixtures.ts"
import { investmentScenario } from "../src/demo/generated/investment-scenario.ts"
import { researchForToday, splitCatalyst, watchDateWindow } from "../src/lib/investmentDates.ts"
import { NAV_GROUPS, isTabKey } from "../src/lib/informationArchitecture.ts"
import type { InvestmentActionItem } from "../src/lib/investment.ts"
import { anchorRelativeDay, buildTodayStories, staleBriefStatusText, taipeiCalendarDate, todayStoryHeadline } from "../src/lib/investmentToday.ts"
import { researchDirectionView, actionStatusLabel, actionStatusNote, briefActions, briefSessionRows, groupBriefRows, historyChainDetailLinked, historyChainLinked, historyDetailLookupId, historyReadingOrder, reusableLearningItems, marketIndexDirectionDisplay, narrativeDisplayState, narrativeSignalSections, NARRATIVE_FALSIFIER_UNAVAILABLE_COPY, numberedTargets, recentActions, remainingActions, sourceTimestamp, quoteTime, taipeiCalendarToday, todayActionPlan, todayActionSection, unlinkedRowsWithoutLayerCard, workPanelView } from "../src/lib/investmentFormat.ts"

const write = (body: unknown, method = "POST") => ({ method, body: JSON.stringify(body) })

test("the shared information architecture keeps frequent entry points and domain ownership clear", () => {
  assert.equal(isTabKey("today"), true)
  assert.equal(isTabKey("guide"), true)
  assert.equal(isTabKey("not-a-page"), false)
  assert.deepEqual(NAV_GROUPS.map((group) => group.label), ["常用", "推進", "回看"])
  assert.deepEqual(NAV_GROUPS[0].items.map((item) => item.key), ["today", "investment"])
  assert.equal(NAV_GROUPS[0].items.every((item) => item.frequent === true), true)
})

test("Taiwan index direction stays neutral unless the producer confirms it", () => {
  const { confirmed, needsReview, previousSessionPartial } = pulseIntegrityScenarios
  assert.equal(confirmed.index.direction_check?.status, "confirmed")
  assert.deepEqual(marketIndexDirectionDisplay("confirmed", confirmed.index.change, confirmed.index.change_pct), {
    state: "confirmed", change: 120, changePercent: 0.55,
  })
  assert.equal(needsReview.index.change, 120, "synthetic raw value is intentionally still positive")
  assert.deepEqual(marketIndexDirectionDisplay(needsReview.index.direction_check?.status, needsReview.index.change, needsReview.index.change_pct), {
    state: "needs_review", change: null, changePercent: null,
  })
  assert.deepEqual(marketIndexDirectionDisplay(undefined, 120, 0.55), {
    state: "unknown", change: null, changePercent: null,
  })
  assert.notEqual(previousSessionPartial.as_of, previousSessionPartial.requested_date)
  assert.equal(previousSessionPartial.source_dates?.twse, previousSessionPartial.as_of)
  assert.equal(previousSessionPartial.source_dates?.tpex, null)
  assert.equal(previousSessionPartial.state, "partial")
})

test("every page runs with no network; unknown routes and real symbols fail closed", async () => {
  const original = globalThis.fetch
  globalThis.fetch = () => { throw new Error("Unexpected network request") }
  try {
    const request = createDemoRequest()
    for (const path of ["home", "cockpit", "focus", "time", "goals", "ideal", "health", "todos", "investment", "investment/narrative", "investment/actions", "investment/explore", "investment/market", "investment/pulse", "investment/research", `investment/research/detail?id=${encodeURIComponent(investmentResearch.research.items[0].id)}`, "investment/watch/read-model", "investment/history", "investment/context", "investment/pending/read-model", "investment/work", "investment/momentum/universe", "investment/momentum/leaders", `investment/quote?symbol=${investmentScenario.symbol}`, `investment/momentum?symbol=${investmentScenario.symbol}`, `investment/source?id=${investmentScenario.source_id}`, `investment/history/source?id=${encodeURIComponent(investmentHistory.history.items[0].id)}`]) {
      const result = await request(`/api/${path}`)
      assert.equal(result.status, 200, path)
      assert.equal(typeof await result.json(), "object", path)
    }
    const leaders = await (await request("/api/investment/momentum/leaders")).json()
    assert.equal(leaders.leaders[0].return_20d_pct, 4.8)
    assert.equal(leaders.leaders[0].vs_20ma_pct, 2.6)
    for (const path of ["/api/not-implemented", "/api/investment/momentum?symbol=REAL", "/api/investment/source?id=private", "/api/investment/history/source?id=private", "http://localhost:8000/api/home", "https://example.com/api/home", "//localhost/api/home"]) assert.equal((await request(path)).status, 404, path)
    assert.equal((await request("/api/not-implemented", write({}))).status, 404)
  } finally { globalThis.fetch = original }
})

test("formal Research and legacy Watch retain separate typed producer envelopes", async () => {
  const request = createDemoRequest()
  const research = await (await request("/api/investment/research")).json()
  assert.equal(research.artifact, "investment-research-index")
  assert.equal(research.producer, "tools/research_view.py")
  assert.equal(research.state, "partial")
  assert.equal(research.source_cutoff, "unknown")
  assert.equal(research.research.count, 7)
  assert.equal(research.research.items[0].narrative_id, null)
  assert.equal(research.research.items[0].decision_id, null)

  const itemId = research.research.items[0].id
  const detail = await (await request(`/api/investment/research/detail?id=${encodeURIComponent(itemId)}`)).json()
  assert.equal(detail.artifact, "investment-research-detail")
  assert.equal(detail.research.item.id, itemId)
  assert.equal(typeof detail.research.detail.text, "string")
  for (const id of ["source:research/private.md", "__proto__", "constructor"]) {
    assert.equal((await request(`/api/investment/research/detail?id=${encodeURIComponent(id)}`)).status, 404, id)
  }

  const watch = await (await request("/api/investment/watch/read-model")).json()
  assert.equal(watch.artifact, "investment-watch")
  assert.equal(watch.state, "partial")
  assert.equal(watch.source_cutoff, "unknown")
  assert.ok(watch.watch.catalysts.length)
  assert.notEqual(watch.artifact, research.artifact)

  const pending = await (await request("/api/investment/pending/read-model")).json()
  assert.equal(pending.artifact, "investment-pending")
  assert.equal(pending.state, "partial")
  assert.equal(pending.source_cutoff, "unknown")
  assert.equal(typeof pending.pending.scope, "string")
})

test("Today projection keeps intraday delta inside the daily flow", async () => {
  const request = createDemoRequest()
  const data = await (await request("/api/investment")).json()
  assert.equal(data.today.state, "ready")
  assert.equal(data.today.decision_summary, "今天不需要因這則新訊號調整部位。")
  assert.equal(data.today.decision_summary_date, data.brief.date)
  assert.equal(data.today.updates.length, 1)
  assert.equal(data.today.updates[0].relevance.includes("new-price-discovery"), true)
  assert.match(data.today.updates[0].source_path, /^wiki\/morning\//)
})

test("personal reminder dates and promotion remain stored under Research & Strategy", async () => {
  const today = "2026-09-25"
  assert.equal(taipeiCalendarToday(new Date("2026-09-24T16:30:00Z")), today, "UTC evening maps to the next Taipei calendar day")

  const request = createDemoRequest()
  const sourceWatch = await (await request("/api/investment/watch/read-model")).json()
  assert.ok(sourceWatch.watch.catalysts.length, "source-derived events remain in their separate watch response")
  assert.deepEqual((await (await request("/api/investment/work")).json()).items, [], "the empty personal list stays a confirmed empty list")
  const input = {kind: "watch", text: "合成個人提醒", expires_on: "2026-10-02"}
  const created = await (await request("/api/investment/work", write(input))).json()
  assert.equal(created.kind, "watch")
  assert.equal(created.expires_on, input.expires_on)
  assert.equal(created.promoted_to_today, false)
  assert.equal((await (await request("/api/investment/work", write(input))).json()).id, created.id, "retry does not duplicate an open reminder")
  assert.equal((await request("/api/investment/work", write({...input, text: "bad date", expires_on: "2026-02-30"}))).status, 422)
  const promoted = await (await request(`/api/investment/work/${created.id}`, write({version: 1, status: "open", kind: "watch", conclusion: "", promoted_to_today: true}, "PATCH"))).json()
  assert.equal(promoted.promoted_to_today, true)
  assert.equal(promoted.expires_on, input.expires_on, "promotion does not rewrite the reminder deadline")
  assert.equal(promoted.version, 2)
  assert.equal((await request(`/api/investment/work/${created.id}`, write({version: 2, status: "open", kind: "research", conclusion: ""}, "PATCH"))).status, 422, "source/research work cannot be converted into a personal reminder")
})

test("Today prose uses the source session date across midnight and preserves unknown dates", () => {
  assert.equal(anchorRelativeDay("台股今天收盤後再確認；今天不追價。", "2026-09-24"), "2026-09-24 台股交易日收盤後再確認；2026-09-24 當日不追價。")
  assert.equal(anchorRelativeDay("美股今天盤前留意指引。", "2026-09-24"), "2026-09-24 美股交易日盤前留意指引。")
  assert.equal(anchorRelativeDay("台股今日收盤後再確認；今日不追價。", "2026-09-24"), "2026-09-24 台股交易日收盤後再確認；2026-09-24 當日不追價。")
  assert.equal(anchorRelativeDay("今天觀察市場。", null), "今天觀察市場。")
  assert.equal(anchorRelativeDay("今日觀察市場。", null), "今日觀察市場。")
  assert.equal(anchorRelativeDay("今天觀察市場。", "2026-02-30"), "今天觀察市場。")
  assert.equal(anchorRelativeDay("今日觀察市場。", "2026-02-30"), "今日觀察市場。")
  assert.equal(taipeiCalendarDate("2026-09-24T18:30:00Z"), "2026-09-25", "UTC evening timestamps must use the Taiwan calendar date")
  assert.equal(taipeiCalendarDate("2026-09-24T23:00:00-04:00"), "2026-09-25")
  assert.equal(taipeiCalendarDate("2026-09-24T18:30:00"), null, "a timezone-free timestamp must not invent a Taiwan date")
  assert.equal(staleBriefStatusText("2026-09-24", "美股盤前注意", "2026/09/24 21:15 台北"), "目前沿用 2026-09-24 · 美股盤前注意；資訊截至 2026/09/24 21:15 台北。")
})

test("brief session rows expose provenance only for the producer-declared session", () => {
  const brief = syntheticInvestment.brief
  const usRows = briefSessionRows(brief)
  assert.deepEqual(usRows.map(({ label, targetTime, matches }) => ({ label, targetTime, matches })), [
    { label: "台股盤前注意 · 正式版", targetTime: "08:00", matches: false },
    { label: "美股盤前注意 · 正式版", targetTime: "21:15", matches: true },
  ])
  assert.deepEqual(usRows[0], {
    session: "tw-open-prep", label: "台股盤前注意 · 正式版", targetTime: "08:00", matches: false,
    state: null, date: null, generatedAt: null, sourceCutoff: null,
  })
  assert.equal(usRows[1]?.date, brief.date)
  assert.equal(usRows[1]?.generatedAt, brief.generated_at)
  assert.equal(usRows[1]?.sourceCutoff, brief.source_cutoff)

  const twRows = briefSessionRows({ ...brief, session: "tw-open-prep", state: "stale" })
  assert.equal(twRows[0]?.matches, true)
  assert.equal(twRows[0]?.state, "stale")
  assert.equal(twRows[1]?.matches, false)

  const missingSessionRows = briefSessionRows({ ...brief, session: null })
  assert.equal(missingSessionRows.some(row => row.matches), false)
  assert(missingSessionRows.every(row => row.date === null && row.generatedAt === null && row.sourceCutoff === null))
})

test("stale Today action heading names the inherited report, while a current brief keeps its action heading", () => {
  const brief = syntheticInvestment.brief
  assert.deepEqual(todayActionSection({ ...brief, state: "stale" }), {
    heading: "目前可用行動",
    context: "沿用 2026-09-20 · 美股盤前注意 · 正式版；今日正式版尚未產出。",
  })
  assert.deepEqual(todayActionSection({ ...brief, state: "current" }), {
    heading: "今天怎麼做",
    context: null,
  })
  assert.deepEqual(todayActionSection({ ...brief, state: "stale", date: null, session: null }), {
    heading: "目前可用行動",
    context: "沿用 日期未提供 · 版次未標示；今日正式版尚未產出。",
  })
})

test("synthetic formal brief and later update keep their Taiwan-time chronology across midnight", () => {
  assert.equal(syntheticInvestment.brief.session, "us-open-prep")
  assert.equal(sourceTimestamp(syntheticInvestment.brief.generated_at), "2026/09/20 21:30 台北")
  assert.equal(sourceTimestamp(syntheticInvestment.brief.source_cutoff), "2026/09/20 21:15 台北")
  assert.equal(sourceTimestamp(syntheticInvestment.today?.updates[0]?.observed_at), "2026/09/21 00:27 台北")
})

test("explicitly numbered target impacts become readable bullets without dropping evidence", () => {
  assert.deepEqual(numberedTargets("兩項關注：① A 上調，仍待財報；② B 未觸及 -5% 門檻。"), {
    intro: "兩項關注：",
    items: ["A 上調，仍待財報；", "B 未觸及 -5% 門檻。"],
  })
  assert.equal(numberedTargets("A 上調，但 B 未觸及 -5% 門檻。"), null)
})

test("Today groups brief events and updates only by producer-owned story identity", async () => {
  const data = await (await createDemoRequest()("/api/investment")).json()
  const stories = buildTodayStories(data.brief.date, data.brief.events, data.today.updates)
  assert.equal(stories.length, 1)
  assert.equal(stories[0].story_id, "demo-storage-event")
  assert.equal(stories[0].events.length, 1)
  assert.equal(stories[0].updates.length, 1)
  assert.equal(todayStoryHeadline(stories[0]), data.today.updates[0].summary)
  assert.equal(stories[0].events[0].event.event, data.brief.events[0].event)

  const missingIdentity = buildTodayStories(data.brief.date, data.brief.events, [{
    ...data.today.updates[0], story_id: null,
  }])
  assert.equal(missingIdentity.length, 2)
  assert.equal(missingIdentity[0].updates.length, 0)
  assert.equal(missingIdentity[1].events.length, 0)
})

test("Today keeps same-story evidence together and preserves producer update order", () => {
  const event = {
    story_id: "shared-story",
    event: "Brief event",
    market_reaction: "",
    interpretation: "",
    impact: "",
    today: "",
  }
  const stories = buildTodayStories("2026-09-21", [event], [
    { id: "newest", story_id: "shared-story", observed_at: "2026-09-21T15:00:00+08:00", summary: "new", portfolio_impact: "", action: "", relevance: [], source_path: "new.md" },
    { id: "older", story_id: "shared-story", observed_at: "2026-09-21T14:00:00+08:00", summary: "older", portfolio_impact: "", action: "", relevance: [], source_path: "old.md" },
  ])
  assert.equal(stories.length, 1)
  assert.deepEqual(stories[0].updates.map(item => item.id), ["newest", "older"])
  assert.equal(todayStoryHeadline(stories[0]), "new")
  assert.equal(stories[0].events[0].event.event, "Brief event")

  const duplicateBriefEvents = buildTodayStories("2026-09-21", [event, { ...event, event: "Second brief row" }], [])
  assert.equal(duplicateBriefEvents.length, 1)
  assert.deepEqual(duplicateBriefEvents[0].events.map(item => item.event.event), ["Brief event", "Second brief row"])
})

test("Today does not present a brief baseline as current when the latest update has no summary", () => {
  const event = {
    story_id: "shared-story",
    event: "Brief baseline",
    market_reaction: "",
    interpretation: "",
    impact: "",
    today: "",
  }
  for (const summary of ["", "   "]) {
    const stories = buildTodayStories("2026-09-21", [event], [
      { id: "newest", story_id: "shared-story", observed_at: "2026-09-21T15:00:00+08:00", summary, portfolio_impact: "更正為 2%，原判斷需下修。", action: "", relevance: [], source_path: "new.md" },
    ])
    assert.equal(todayStoryHeadline(stories[0]), "最新摘要未提供")
    assert.equal(stories[0].events[0].event.event, "Brief baseline")
  }
  const baselineOnly = buildTodayStories("2026-09-21", [event], [])
  assert.equal(todayStoryHeadline(baselineOnly[0]), "Brief baseline")
})

test("the showcase keeps personal content unknown while preserving aggregate narrative status", async () => {
  const request = createDemoRequest()
  const response = await request("/api/investment/narrative")
  const data = await response.json()
  assert.equal(data.state, "unavailable")
  assert.equal(data.narratives[0].state, "drift")
  assert.equal(data.narratives[0].expressions.state, "unknown")
  assert.equal(data.narratives[0].expressions.items.length, 0)
  const evidence = data.narratives[0].thesis_evidence
  assert.deepEqual(evidence.layers.map((layer: { layer_id: string }) => layer.layer_id), ["L0", "L1", "L2", "L2.5", "L3"])
  const hardware = evidence.layers[0]
  assert.equal(hardware.direction_state, "supports")
  assert.equal(hardware.supporting[0].evidence_date, "2026-09-18")
  assert.equal(hardware.supporting[0].source_url, "https://example.com/synthetic/hardware-shipment")
  const cloud = evidence.layers[1]
  assert.equal(cloud.players[0].player, "合成雲端服務商甲")
  assert.equal(cloud.evidence.length, 0)
  assert.equal(cloud.link_state, "unlinked")
  assert.equal(cloud.state, "unknown")
  assert.equal(cloud.unlinked_players.length, 1, "a malformed player row with a known pillar stays in its layer")
  const model = evidence.layers[2]
  assert.equal(model.opposing[0].polarity, "challenges")
  assert.equal(model.opposing[0].state, "stale")
  const app = evidence.layers[3]
  assert.equal(app.unknown[0].polarity, "unknown")
  const endUser = evidence.layers[4]
  assert.equal(endUser.conflicts.length, 4)
  assert.equal(endUser.players.length, 0, "ambiguous player names stay suppressed from linked relations")
  assert.equal(endUser.evidence.length, 0, "conflicting evidence is not promoted into a directional group")
  assert.equal(endUser.conflicts.filter((row: { evidence_id?: string }) => row.evidence_id === "synthetic-duplicate-evidence").length, 2)
  assert.equal(endUser.unlinked_evidence.length, 1)
  assert.equal(endUser.unlinked_evidence[0].state, "unlinked")
  assert.equal(evidence.unlinked_evidence.length, 2, "the producer may repeat a layer-linked gap in its top-level index")
  assert.deepEqual(unlinkedRowsWithoutLayerCard(evidence.unlinked_evidence, evidence.layers).map(row => row.evidence_id), ["synthetic-unmapped-evidence"])
  assert.deepEqual(unlinkedRowsWithoutLayerCard(evidence.unlinked_evidence, evidence.layers.slice(0, 4)).map(row => row.evidence_id), ["synthetic-unmapped-evidence", "synthetic-invalid-player-link"], "a known pillar remains in the global data section if its layer card is missing")
  assert.equal(evidence.unlinked_players.length, 2, "the producer may repeat a layer-linked player gap in its top-level index")
  assert.deepEqual(unlinkedRowsWithoutLayerCard(evidence.unlinked_players, evidence.layers).map(row => row.player), ["合成參與者"])
  assert.deepEqual(unlinkedRowsWithoutLayerCard(evidence.unlinked_players, evidence.layers.filter(layer => layer.layer_id !== "L1")).map(row => row.player), ["合成參與者", "合成雲端服務商"], "a player gap remains visible if its layer card is missing")
  assert.equal(evidence.scorecard_update.status, "evidence_pending_review")
  assert.equal(evidence.scorecard_update.updated_at, "2026-09-20")
  assert.equal(evidence.scorecard_update.document_updated_at, "2026-09-20")
  assert.equal(evidence.scorecard_update.state, "partial", "same-day review and evidence remain unordered at date precision")
  assert.equal(evidence.scorecard_update.scope.length, 5)
  assert.equal(evidence.state, "partial")
  assert.match(data.narratives[0].state_reason, /合成狀態示例/)
  assert.equal(narrativeDisplayState(data.narratives[0].state, evidence.state, data.state), "drift")
  assert.equal(narrativeDisplayState("stale", "partial", "ready"), "stale")
  assert.equal(narrativeDisplayState(undefined, evidence.state, data.state), "partial")
  assert.deepEqual(new Set(evidence.directional_signals.map((signal: { direction: string }) => signal.direction)), new Set(["supports", "challenges"]))
  const signalSections = narrativeSignalSections(evidence.directional_signals)
  assert.equal(signalSections.challengeSignals.length, 1)
  assert.equal(signalSections.supportSignals.length, 1)
  assert.deepEqual(signalSections.explicitFalsifiers, [], "a challenge signal is not a recorded falsifier")
  assert.match(NARRATIVE_FALSIFIER_UNAVAILABLE_COPY, /此讀取資料未提供獨立的明確推翻條件欄位/)
  assert.match(NARRATIVE_FALSIFIER_UNAVAILABLE_COPY, /挑戰訊號不等同於推翻條件/)
  const withRecordedFalsifier = narrativeSignalSections(evidence.directional_signals, ["Synthetic explicit invalidation rule"])
  assert.equal(withRecordedFalsifier.challengeSignals.length, 1)
  assert.deepEqual(withRecordedFalsifier.explicitFalsifiers, ["Synthetic explicit invalidation rule"])
  const [supportSignal, challengeSignal] = evidence.directional_signals
  assert.notEqual(supportSignal.source.path, challengeSignal.source.path)
  assert.equal(supportSignal.source_date, "2026-09-18")
  assert.equal(supportSignal.document_updated, "2026-09-20")
  assert.equal(challengeSignal.source_date, null)
  assert.equal(challengeSignal.document_updated, "2026-09-19")
  assert.equal(sourceTimestamp(challengeSignal.source_date), "未提供")
  assert.equal(evidence.directional_signals.every((signal: { layer_id: string | null }) => signal.layer_id === null), true)
  assert.equal(evidence.latest_recorded_change.state, "unknown")
  assert.equal(evidence.latest_recorded_change.date, null)
  assert.match(data.limitations[0], /不展示或推測個人論點與持倉/)
})

test("history exposes the producer envelope and exact typed detail without inferring reusable learning", async () => {
  const request = createDemoRequest()
  const history = await (await request("/api/investment/history")).json()
  const context = await (await request("/api/investment/context")).json()
  assert.equal(history.artifact, "investment-history-index")
  assert.equal(history.id, "history-index")
  assert.equal(history.state, "partial")
  assert.equal(history.as_of, "unknown")
  assert.equal(history.source_cutoff, "unknown")
  assert.equal(history.history.count, 4)
  assert.equal(history.history.items[0].date, "2026-09-13")
  assert.equal(history.history.items[0].outcome_state, "unknown")
  assert.equal(history.history.items[0].learning_state, "unknown")
  assert.equal(reusableLearningItems(history.history.items).length, 1)
  const unindexed = history.history.items.find((item: { id: string | null }) => item.id === null)
  assert.ok(unindexed)
  assert.equal(unindexed.state, "partial")
  assert.match(unindexed.missing[0], /no explicit learning_id/)
  assert.equal(historyDetailLookupId(unindexed), null)
  assert.equal(historyDetailLookupId(history.history.items[0]), history.history.items[0].id)
  const itemId = history.history.items[0].id
  const detailResponse = await request(`/api/investment/history/source?id=${encodeURIComponent(itemId)}`)
  assert.equal(detailResponse.status, 200)
  const detail = await detailResponse.json()
  assert.equal(detail.artifact, "investment-history-detail")
  assert.equal(detail.history.item.id, itemId)
  assert.equal(detail.history.item.outcome.state, "unknown")
  assert.equal(detail.history.source_text, investmentScenario.history[0].detail)
  for (const id of ["private", "__proto__", "constructor"]) {
    assert.equal((await request(`/api/investment/history/source?id=${encodeURIComponent(id)}`)).status, 404, id)
  }
  const episode = history.history.items.find((item: { kind: string }) => item.kind === "decision_episode")
  const episodeDetail = await (await request(`/api/investment/history/source?id=${encodeURIComponent(episode.id)}`)).json()
  assert.equal(episodeDetail.history.item.id, episode.id)
  assert.deepEqual(episodeDetail.history.item.evidence, [{ path: investmentScenario.source_path, line: investmentScenario.history[2].source.line_start }])
  assert.equal(episodeDetail.history.item.checkpoints[0].outcome.state, "unknown")
  assert.equal(episodeDetail.history.source_text, null)
  assert.equal(context.read_only, true)
  assert.equal(context.task.slug, investmentScenario.context.task_slug)
  assert.equal(context.current_state.next_action, investmentScenario.context.next_action)
  assert.equal(context.evidence[0].source.path, investmentScenario.source_path)
})

test("registered event labels use source wording instead of a generic topic directory", () => {
  const event = splitCatalyst("2026-09-30 MU Q4 FY26（Micron IR 公告）— guidance 門檻首個檢查點")
  assert.equal(event.event, "MU Q4 FY26")
  assert.equal(event.verify, "guidance 門檻首個檢查點")
})

test("todo writes update the shared home projection and remain isolated per visitor", async () => {
  const request = createDemoRequest()
  const otherVisitor = createDemoRequest()
  const created = await (await request("/api/todos", write({ text: "Only in this browser", category: "輸出" }))).json()
  let home = await (await request("/api/home")).json()
  assert(home.todos.some((t: {id: string}) => t.id === created.id))
  await request(`/api/todos/${created.id}/toggle`, write({ done: true }))
  home = await (await request("/api/home")).json()
  assert(!home.todos.some((t: {id: string}) => t.id === created.id))
  const items = await (await request("/api/todos")).json()
  assert.equal(items.done_count, 2)
  assert.equal((await (await otherVisitor("/api/todos")).json()).done_count, 1)
  await request(`/api/todos/${created.id}`, { method: "DELETE" })
  assert.equal((await request(`/api/todos/${created.id}/toggle`, write({ done: false }))).status, 409)
})

test("milestones, feedback, and nominations preserve their shared projections", async () => {
  const request = createDemoRequest()
  await request("/api/goals/demo-build/milestones/1", write({ done: true }))
  const goals = await (await request("/api/goals")).json()
  assert.equal(goals.groups[0].done_milestones, 2)
  assert.equal((await (await request("/api/todos")).json()).month_milestones[1].done, true)
  await request("/api/cockpit/feedback", write({ task_slug: "demo-paper-plane", verdict: "accept" }))
  let home = await (await request("/api/home")).json()
  assert.equal(home.cockpit.suggestions[0].human_verdict, "accept")
  const expected_text = home.threads.items[0].nomination
  assert.equal((await request("/api/nominations/demo-paper-plane/accept", write({ expected_text: "stale" }))).status, 409)
  await request("/api/nominations/demo-paper-plane/accept", write({ expected_text }))
  home = await (await request("/api/home")).json()
  assert.equal(home.threads.items[0].next_action, expected_text)
  assert.equal(home.threads.pending_nominations, 0)
})

test("investment writes honor versions; malformed and cancelled requests are visible", async () => {
  const request = createDemoRequest()
  const item = await (await request("/api/investment/work", write({ kind: "research", text: "Synthetic question" }))).json()
  const update = { version: 1, status: "done", kind: "research", conclusion: "Example result" }
  assert.equal((await request(`/api/investment/work/${item.id}`, write(update, "PATCH"))).status, 200)
  assert.equal((await request(`/api/investment/work/${item.id}`, write(update, "PATCH"))).status, 409)
  assert.equal((await request("/api/todos", { method: "POST", body: "invalid" })).status, 422)
  assert.equal((await request("/api/todos", write({ text: "" }))).status, 422)
  assert.equal((await request("/api/goals/demo-build/milestones/1", write({ done: "true" }))).status, 422)
  await assert.rejects(request("/api/home", { signal: AbortSignal.abort() }), { name: "AbortError" })
})

test("synthetic watch notes retain expiry and promotion metadata", async () => {
  const request = createDemoRequest()
  const body = {kind:"watch",text:"Synthetic personal reminder",expires_on:"2026-09-25"}
  const created = await (await request("/api/investment/work", write(body))).json()
  assert.equal(created.kind,"watch")
  assert.equal(created.promoted_to_today,false)
  assert.equal(created.expires_on,"2026-09-25")
  const duplicate = await (await request("/api/investment/work", write(body))).json()
  assert.equal(duplicate.id,created.id,"repeating the same open reminder does not create a duplicate")
  const defaultNote = await (await request("/api/investment/work", write({kind:"watch",text:"Synthetic default expiry"}))).json()
  const expectedDefault = new Date(`${taipeiCalendarToday()}T00:00:00.000Z`)
  expectedDefault.setUTCDate(expectedDefault.getUTCDate()+7)
  assert.equal(defaultNote.expires_on,expectedDefault.toISOString().slice(0,10))
  const beforePromotion = await (await request("/api/investment/work")).json()
  assert.equal(beforePromotion.items.find((item:any)=>item.id===created.id).promoted_to_today,false)
  const promoted = await (await request(`/api/investment/work/${created.id}`, write({version:1,status:"open",kind:"watch",conclusion:"",promoted_to_today:true},"PATCH"))).json()
  assert.equal(promoted.promoted_to_today,true)
  assert.equal(promoted.version,2)
  const afterPromotion = await (await request("/api/investment/work")).json()
  assert.equal(afterPromotion.items.find((item:any)=>item.id===created.id).promoted_to_today,true)
  assert.equal((await request(`/api/investment/work/${created.id}`, write({version:2,status:"open",kind:"watch",conclusion:"",promoted_to_today:false},"PATCH"))).status,200)
  assert.equal((await request("/api/investment/work/nope", write({version:1,status:"open",kind:"watch",conclusion:"",promoted_to_today:true},"PATCH"))).status,409)
  const decision = await (await request("/api/investment/work", write({kind:"decision",text:"Synthetic decision"}))).json()
  assert.equal((await request(`/api/investment/work/${decision.id}`, write({version:1,status:"open",kind:"decision",conclusion:"",promoted_to_today:true},"PATCH"))).status,422)
})

test("brief actions remove only exact duplicates and pure no-information labels", () => {
  const input = ["沒有新資訊。", "觀察 5%", " 觀察 5% ", "觀察 6%", "不加碼", "加碼", "沒有新資訊，但仍需驗證需求。", "", "無新資訊！"]
  const original = [...input]
  assert.deepEqual(briefActions(input), ["觀察 5%", "觀察 6%", "不加碼", "加碼", "沒有新資訊，但仍需驗證需求。"])
  assert.deepEqual(input, original, "presentation must not mutate the source")
})

test("Today action availability distinguishes confirmed empty from missing or incomplete coverage", () => {
  const brief = { ...syntheticInvestment.brief, state: "current" as const, actions: [], action_items: [], source: null, envelope: { ...syntheticInvestment.brief.envelope!, completeness: "ready" as const, limitations: [] } }
  const ready = { state: "ready" as const, decision_summary: null, updates: [], limitations: [] }
  assert.equal(todayActionPlan(brief, ready).coverageMessage, null)
  assert.equal(todayActionPlan(brief, ready).emptyMessage, "已確認本版簡報與今日更新沒有列出下一步行動。")

  const missing = todayActionPlan({ ...brief, state: "missing" }, ready)
  const invalid = todayActionPlan({ ...brief, state: "invalid" }, ready)
  const stale = todayActionPlan({ ...brief, state: "stale" }, ready)
  const partial = todayActionPlan({ ...brief, envelope: { ...brief.envelope!, completeness: "partial" } }, ready)
  const unknown = todayActionPlan(brief)
  assert.match(missing.coverageMessage ?? "", /尚未取得/)
  assert.match(invalid.coverageMessage ?? "", /未能辨識/)
  assert.match(stale.coverageMessage ?? "", /較早/)
  assert.match(partial.coverageMessage ?? "", /不完整/)
  assert.match(unknown.coverageMessage ?? "", /尚未取得今日更新狀態/)
  assert.equal(new Set([missing.coverageMessage, invalid.coverageMessage, stale.coverageMessage, partial.coverageMessage, unknown.coverageMessage]).size, 5)
})

test("Today actions preserve update provenance, keep overflow reachable, and retain research items", () => {
  const brief = { ...syntheticInvestment.brief, state: "current" as const, actions: [], source: null, envelope: { ...syntheticInvestment.brief.envelope!, completeness: "ready" as const, limitations: [] }, action_items: [
    { id: "brief-1", text: "盤後檢查量能", status: "open" as const, tickers: [], evidence: [], artifact_id: "brief-1", source: "daily-brief", date: "2026-09-24" },
    { id: "brief-2", text: "第二項正式行動", status: "open" as const, tickers: [], evidence: [], artifact_id: "brief-2", source: "daily-brief", date: "2026-09-24" },
    { id: "brief-3", text: "第三項正式行動", status: "open" as const, tickers: [], evidence: [], artifact_id: "brief-3", source: "daily-brief", date: "2026-09-24" },
    { id: "brief-4", text: "補研究：核對下一份公開財報", status: "open" as const, tickers: [], evidence: [], artifact_id: "brief-4", source: "daily-brief", date: "2026-09-24" },
  ] }
  const today = { state: "ready" as const, decision_summary: null, limitations: [], updates: [{
    id: "update-1", observed_at: "2026-09-24T15:10:00+08:00", summary: "", portfolio_impact: "", action: "先觀察收盤量能", relevance: [], source_path: "wiki/morning/demo.md",
  }] }
  const plan = todayActionPlan(brief, today)
  assert.deepEqual(plan.actions.map(item => item.text), ["先觀察收盤量能", "盤後檢查量能", "第二項正式行動", "第三項正式行動"])
  assert.equal(plan.actions[0]?.origin, "update")
  assert.equal(plan.actions[0]?.date, "2026-09-24T15:10:00+08:00")
  assert.equal(plan.actions[0]?.source, "wiki/morning/demo.md")
  assert.equal(plan.research.length, 1)
  assert.equal(plan.research[0]?.text, "補研究：核對下一份公開財報")

  const repeatedText = todayActionPlan({ ...brief, action_items: [{
    id: "action-b", text: "行動：核對公告", status: "open", tickers: [], evidence: [], artifact_id: "action-b", source: "formal-brief", date: "2026-09-23",
  }] }, { ...today, updates: [{ ...today.updates[0]!, id: "update-a", action: "觀察：核對公告", observed_at: "2026-09-24T15:10:00+08:00", source_path: "wiki/morning/update-a.md" }] })
  assert.deepEqual(repeatedText.actions.map(item => item.text), ["核對公告", "核對公告"])
  assert.deepEqual(repeatedText.actions.map(item => [item.id, item.source]), [["update-a", "wiki/morning/update-a.md"], ["action-b", "formal-brief"]])

  const researchOnly = todayActionPlan({ ...brief, action_items: [brief.action_items[3]!] }, { ...today, updates: [] })
  assert.equal(researchOnly.actions.length, 0)
  assert.equal(researchOnly.emptyMessage, "已確認沒有列出立即行動；另有 1 項補研究，請展開查看。")
})

test("Today action query failures remain visible even when cached steps exist", () => {
  const brief = { ...syntheticInvestment.brief, state: "current" as const, actions: ["保留快取行動"], action_items: [], source: null, envelope: { ...syntheticInvestment.brief.envelope!, completeness: "ready" as const, limitations: [] } }
  const plan = todayActionPlan(brief, { state: "ready", decision_summary: null, updates: [], limitations: [] }, true)
  assert.equal(plan.actions[0]?.text, "保留快取行動")
  assert.match(plan.coverageMessage ?? "", /這次更新讀取失敗/)
  assert.match(plan.emptyMessage, /未讀到可確認/)
})

test("every thesis and risk survives missing, malformed or out-of-range event references exactly once", () => {
  const rows: { id: string; event_index?: number | null }[] = [
    { id: "linked", event_index: 0 }, { id: "last", event_index: 1 },
    { id: "null", event_index: null }, { id: "omitted" }, { id: "negative", event_index: -1 },
    { id: "too-large", event_index: 2 }, { id: "fraction", event_index: 0.5 }, { id: "nan", event_index: NaN },
    { id: "string", event_index: "0" as unknown as number },
  ]
  const grouped = groupBriefRows(rows, 2)
  assert.deepEqual(grouped.byEvent.map(group => group.map(row => row.id)), [["linked"], ["last"]])
  assert.deepEqual(grouped.unlinked.map(row => row.id), ["null", "omitted", "negative", "too-large", "fraction", "nan", "string"])
  assert.deepEqual([...grouped.byEvent.flat(), ...grouped.unlinked].map(row => row.id).sort(), rows.map(row => row.id).sort())
  assert.equal(grouped.byEvent[0][0], rows[0], "preserve original source objects and meaning")
  assert.deepEqual(groupBriefRows(rows, 0), { byEvent: [], unlinked: rows })
})

test("brief timestamps retain unknown and date-only precision and never invent a cutoff", () => {
  for (const value of [undefined, null, "", "unknown"]) assert.equal(sourceTimestamp(value), "未提供")
  assert.equal(sourceTimestamp("2026-09-21"), "2026-09-21")
  assert.equal(sourceTimestamp("2026-02-30"), "時間未能辨識")
  assert.equal(sourceTimestamp("2026-09-21T99:99:99Z"), "時間未能辨識")
  assert.equal(sourceTimestamp("2026-09-20T18:30:00Z"), "2026/09/21 02:30 台北")
  assert.equal(sourceTimestamp("2026-09-21T08:30:00"), "2026-09-21 08:30:00（未註明時區）")
})

test("quotes from another year cannot look like today's quotes", () => {
  const now = new Date("2026-09-21T01:00:00Z")
  assert.match(quoteTime("2025-09-21T01:00:00Z", now), /2025/)
  assert.doesNotMatch(quoteTime("2026-09-21T01:00:00Z", now), /2026/)
})

test("market explore ranking is independent of holdings and preserves nulls", async () => {
  const request = createDemoRequest()
  const explore = await (await request("/api/investment/explore")).json()
  const universe = await (await request("/api/investment/momentum/universe")).json()
  const held = new Set(universe.symbols)
  const tw = explore.markets.find((market: { market: string }) => market.market === "tw")
  const us = explore.markets.find((market: { market: string }) => market.market === "us")
  assert.equal(tw.state, "ready")
  assert.deepEqual(tw.buckets.map((bucket: { key: string; items: unknown[] }) => [bucket.key, bucket.items.length]), [["fast", 3], ["active", 2], ["sustained", 1]])
  assert.equal(tw.buckets[0].items[0].researched, false)
  assert.equal(tw.buckets[0].items[1].researched, true)
  assert.equal(tw.buckets[0].items[2].change_7d_pct, null)
  assert.equal("rank" in tw.buckets[0].items[1], false)
  assert.equal(us.state, "partial")
  assert.equal(us.buckets[0].items.length, 0)
  assert.equal(us.buckets[1].items.length, 0)
  assert.ok(us.limitations.some((limitation: string) => limitation.includes("2/20 通過門檻")))
  for (const market of explore.markets) {
    for (const bucket of market.buckets) {
      for (const item of bucket.items) {
        assert.equal(held.has(item.symbol), false, item.symbol)
      }
    }
  }
})

test("market context carries explicit market membership and keeps each producer date", async () => {
  const request = createDemoRequest()
  const market = await (await request("/api/investment/market")).json()
  const pulse = await (await request("/api/investment/pulse")).json()
  const explore = await (await request("/api/investment/explore")).json()
  assert.deepEqual(market.items.map((item: { market: string }) => item.market), ["tw", "us"])
  assert.equal(pulse.as_of, explore.markets.find((item: { market: string }) => item.market === "us").as_of)
  assert.notEqual(pulse.as_of, market.items.find((item: { market: string }) => item.market === "tw").quoted_at.slice(0, 10))
  const us = explore.markets.find((item: { market: string }) => item.market === "us")
  assert.equal(us.state, "partial")
  assert.equal(us.buckets.every((bucket: { items: unknown[] }) => bucket.items.length === 0), true)
})

test("work panel view does not treat a failed fetch as an empty list", () => {
  assert.equal(workPanelView({ isPending: true, isError: false }), "loading")
  assert.equal(workPanelView({ isPending: false, isError: true }), "error")
  assert.equal(workPanelView({ isPending: false, isError: true, data: { items: [] }, dataUpdatedAt: 0 }), "error")
  assert.equal(workPanelView({ isPending: false, isError: true, data: { items: [] }, dataUpdatedAt: 1 }), "stale")
  assert.equal(workPanelView({ isPending: false, isError: false, data: { items: [] } }), "empty")
  assert.equal(workPanelView({ isPending: false, isError: false, data: { items: [{ id: "w1" }] } }), "ready")
  const stale = workPanelView({ isPending: false, isError: true, data: { items: [{ status: "done" }] }, dataUpdatedAt: 1 })
  assert.equal(stale, "stale")
  assert.equal(typeof stale === "string", true)
})

test("canonical-home actions are continuation, not completion", () => {
  assert.equal(actionStatusLabel("open"), "尚未結案")
  assert.equal(actionStatusLabel("has-canonical-home"), "已有判斷頁可承接")
  assert.equal(actionStatusLabel("closed"), "正式紀錄已寫下編號")
  assert.doesNotMatch(actionStatusLabel("has-canonical-home"), /已完成|已結束|已結案/)
  assert.match(actionStatusNote("has-canonical-home") ?? "", /不算完成/)
  const today: InvestmentActionItem[] = [{
    id: "ai:today", text: "整理兩個待查問題，不由新聞直接形成交易。", status: "open",
    tickers: [], evidence: [], artifact_id: "brief", source: "daily-brief", date: "2026-09-20",
  }]
  const items: InvestmentActionItem[] = [
    today[0],
    { ...today[0], id: "ai:dup-text", text: "整理兩個待查問題，不由新聞直接形成交易。" },
    { ...today[0], id: "ai:home", text: "把交付證據門檻寫進判斷頁後再決定是否改變假設。", status: "has-canonical-home" },
    { ...today[0], id: "ai:closed", text: "先前已記錄：不因單一產品發布改動持倉。", status: "closed" },
  ]
  assert.deepEqual(remainingActions(items, today).map(item => item.id), ["ai:home"])
  const dated: InvestmentActionItem[] = [
    { ...today[0], id: "ai:old", text: "較早的未結案", date: "2026-09-14" },
    { ...today[0], id: "ai:new", text: "較新的未結案", date: "2026-09-19" },
  ]
  assert.deepEqual(remainingActions(dated, []).map(item => item.id), ["ai:new", "ai:old"])
  assert.deepEqual(recentActions(dated, "2026-09-21", 2).map(item => item.id), ["ai:new"])
})

test("today research prefers topics already named in the brief", () => {
  const research = [
    { topic: "GOOG", title: "舊作業" },
    { topic: "MU", title: "財報檢查" },
    { topic: "AVGO", title: "另一份" },
  ]
  assert.deepEqual(researchForToday(research, "CXMT 與 MU 9/30 是近端裁判").map(item => item.topic), ["MU"])
  assert.deepEqual(researchForToday(research, "今日沒有對應標的").map(item => item.topic), ["GOOG", "MU", "AVGO"])
})

test("Watch date windows require a valid timestamp and use the Taipei calendar day", () => {
  assert.deepEqual(watchDateWindow("2026-09-25T16:30:00Z"), { start: "2026-09-26", end: "2026-10-26" })
  assert.deepEqual(watchDateWindow("2026-09-26"), { start: "2026-09-26", end: "2026-10-26" })
  assert.equal(watchDateWindow("unknown"), null)
  assert.equal(watchDateWindow("2026-02-30T00:00:00Z"), null)
  assert.equal(watchDateWindow("2026-09-26T24:00:00Z"), null)
})

test("history reading order puts dated records first", () => {
  const items = [
    { id: "u", date: null, title: "undated" },
    { id: "a", date: "2026-05-01", title: "old" },
    { id: "b", date: "2026-09-14", title: "new" },
  ] as Parameters<typeof historyReadingOrder>[0]
  assert.deepEqual(historyReadingOrder(items).map(item => item.id), ["b", "a", "u"])
})

test("history items without producer IDs remain unindexed and cannot request details", () => {
  const item = { id: null, date: "2026-09-20", source: { path: "research/history.md", line: 12 } }
  assert.equal(historyDetailLookupId(item), null)
  assert.equal(historyDetailLookupId({ id: "episode:explicit-id" }), "episode:explicit-id")
  assert.deepEqual(historyReadingOrder([item, { id: "episode:explicit-id", date: "2026-09-20" }]).map(row => row.id), [null, "episode:explicit-id"])
})

test("only an explicit producer learning role becomes a reusable framework", () => {
  const items = [
    { id: "framework", learning_role: "reusable_framework", kind: "mistake", heading: "## P1 — Verify the shipment" },
    { id: "unresolved-question", kind: "mistake", heading: "## Q1 — Still open" },
    { id: "dated-case", kind: "mistake", heading: "### 2026-09-20 · A dated case" },
    { id: "historical", learning_role: "historical_case", kind: "mistake", heading: "## P3 — Historical case" },
    { id: "unknown", learning_role: "unknown", kind: "mistake", heading: "## Q2 — Classification unknown" },
  ]
  assert.deepEqual(reusableLearningItems(items).map(item => item.id), ["framework"])
})

test("Research directions consume explicit membership only and preserve every source", () => {
  const view=researchDirectionView(investmentResearch)
  assert.equal(view.groups.length,5)
  assert.deepEqual(view.groups.map(group=>group.id), investmentResearch.research.direction_groups!.groups.map(group=>group.id))
  assert.equal(view.groups.every(group=>group.items.length===1),true)
  assert.deepEqual(view.other.map(item=>item.direction?.state),["unlinked","unknown"])
  assert.equal(view.other.every(item=>item.ticker==="TSM"),true,"title, ticker and prose never assign direction")
  assert.deepEqual(new Set([...view.groups.flatMap(group=>group.items),...view.other].map(item=>item.id)),new Set(investmentResearch.research.items.map(item=>item.id)))
  const explicit=structuredClone(investmentResearch)
  explicit.research.items[5].direction!.group_ids=[view.groups[0].id]
  assert.equal(researchDirectionView(explicit).other.length,2,"item-only hints cannot replace group item_ids")
  explicit.research.direction_groups!.groups[1].item_ids.push(explicit.research.items[0].id)
  assert.equal(researchDirectionView(explicit).groups[1].items.length,2,"explicit memberships can repeat across navigation lenses")
  assert.deepEqual(researchDirectionView(explicit).groups[1].items[0],explicit.research.items[0],"status, identity, source and clocks remain intact")
  const legacy=structuredClone(investmentResearch)
  delete legacy.research.direction_groups
  assert.equal(researchDirectionView(legacy).groups.length,0)
  assert.deepEqual(researchDirectionView(legacy).other,legacy.research.items)
  const degraded=structuredClone(investmentResearch)
  degraded.research.direction_groups!.groups[0].item_ids.push("source:research/unavailable.md")
  assert.deepEqual(researchDirectionView(degraded).groups[0].missingItemIds,["source:research/unavailable.md"])
  degraded.research.direction_groups!.schema_version=2
  assert.equal(researchDirectionView(degraded).state,"unavailable")
  assert.equal(researchDirectionView(degraded).other.length,7)
})

test("historical chain requires explicit identity, recorded outcome and source provenance", () => {
  const linked = Object.values(investmentHistorySources).find(detail => detail.history.item?.chain_state === "linked")!.history.item!
  assert.equal(historyChainLinked(linked, investmentHistory.history.items), true)
  assert.equal(historyChainDetailLinked(linked), true)
  const { reason, decision_source, learning, learning_source, checkpoints, ...summary } = linked
  assert.equal(historyChainLinked(summary), true)
  assert.equal(historyChainDetailLinked(summary), false)
  assert.ok(reason && decision_source && learning && learning_source && checkpoints)
  for (const patch of [{ decision_id: null }, { chain_state: "unknown" }, { outcome_state: "unknown" }, { checkpoints: [] }, { decision_source: null }, { learning_source: null }, { learning_role: "unknown" }, { state: "conflict" }]) {
    assert.equal(historyChainDetailLinked({ ...linked, ...patch } as typeof linked), false)
  }
  assert.equal(historyChainLinked(linked, [linked, { ...linked }]), false)
  assert.equal(historyChainLinked({ ...linked, state: "partial" }), true)
  assert.equal(historyChainDetailLinked({ ...linked, checkpoints: [{ ...linked.checkpoints![0], relation_state: "unknown" }] }), false)
})
