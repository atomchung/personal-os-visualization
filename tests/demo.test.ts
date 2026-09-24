import assert from "node:assert/strict"
import { test } from "node:test"
import { createDemoRequest } from "../src/demo/transport.ts"
import { investmentScenario } from "../src/demo/generated/investment-scenario.ts"
import { researchForToday, splitCatalyst } from "../src/lib/investmentDates.ts"
import { NAV_GROUPS, isTabKey } from "../src/lib/informationArchitecture.ts"
import type { InvestmentActionItem } from "../src/lib/investment.ts"
import { buildTodayStories, todayStoryHeadline } from "../src/lib/investmentToday.ts"
import { actionStatusLabel, actionStatusNote, briefActions, groupBriefRows, historyReadingOrder, narrativeDisplayState, narrativeSignalSections, NARRATIVE_FALSIFIER_UNAVAILABLE_COPY, recentActions, remainingActions, sourceTimestamp, quoteTime, workPanelView } from "../src/lib/investmentFormat.ts"

const write = (body: unknown, method = "POST") => ({ method, body: JSON.stringify(body) })

test("the shared information architecture keeps frequent entry points and domain ownership clear", () => {
  assert.equal(isTabKey("today"), true)
  assert.equal(isTabKey("guide"), true)
  assert.equal(isTabKey("not-a-page"), false)
  assert.deepEqual(NAV_GROUPS.map((group) => group.label), ["常用", "推進", "回看"])
  assert.deepEqual(NAV_GROUPS[0].items.map((item) => item.key), ["today", "investment"])
  assert.equal(NAV_GROUPS[0].items.every((item) => item.frequent === true), true)
})

test("every page runs with no network; unknown routes and real symbols fail closed", async () => {
  const original = globalThis.fetch
  globalThis.fetch = () => { throw new Error("Unexpected network request") }
  try {
    const request = createDemoRequest()
    for (const path of ["home", "cockpit", "focus", "time", "goals", "ideal", "health", "todos", "investment", "investment/narrative", "investment/actions", "investment/explore", "investment/market", "investment/pulse", "investment/watch", "investment/history", "investment/context", "investment/pending", "investment/work", "investment/momentum/universe", "investment/momentum/leaders", `investment/quote?symbol=${investmentScenario.symbol}`, `investment/momentum?symbol=${investmentScenario.symbol}`, `investment/source?id=${investmentScenario.source_id}`, `investment/history/source?id=${investmentScenario.history[0].id}`]) {
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

test("Today projection keeps intraday delta inside the daily flow", async () => {
  const request = createDemoRequest()
  const data = await (await request("/api/investment")).json()
  assert.equal(data.today.state, "ready")
  assert.equal(data.today.decision_summary, "今天不需要因這則新訊號調整部位。")
  assert.equal(data.today.updates.length, 1)
  assert.equal(data.today.updates[0].relevance.includes("new-price-discovery"), true)
  assert.match(data.today.updates[0].source_path, /^wiki\/morning\//)
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
  assert.equal(evidence.layers.every((layer: { direction_state: string; supporting: string[]; opposing: string[] }) => layer.direction_state === "unknown" && !layer.supporting.length && !layer.opposing.length), true)
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

test("history and Context expose one coherent scenario with explicit unknown results", async () => {
  const request = createDemoRequest()
  const history = await (await request("/api/investment/history")).json()
  const context = await (await request("/api/investment/context")).json()
  assert.equal(history.items[0].date, "2026-09-13")
  assert.equal(history.items[0].result_state, "unknown")
  assert.equal(context.read_only, true)
  assert.equal(context.task.slug, investmentScenario.context.task_slug)
  assert.equal(context.current_state.next_action, investmentScenario.context.next_action)
  assert.equal(context.evidence[0].source.line_start, history.items[1].source.line_start)
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

test("brief actions remove only exact duplicates and pure no-information labels", () => {
  const input = ["沒有新資訊。", "觀察 5%", " 觀察 5% ", "觀察 6%", "不加碼", "加碼", "沒有新資訊，但仍需驗證需求。", "", "無新資訊！"]
  const original = [...input]
  assert.deepEqual(briefActions(input), ["觀察 5%", "觀察 6%", "不加碼", "加碼", "沒有新資訊，但仍需驗證需求。"])
  assert.deepEqual(input, original, "presentation must not mutate the source")
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
  assert.equal(workPanelView({ isPending: false, isError: true, data: { items: [] } }), "stale")
  assert.equal(workPanelView({ isPending: false, isError: false, data: { items: [] } }), "empty")
  assert.equal(workPanelView({ isPending: false, isError: false, data: { items: [{ id: "w1" }] } }), "ready")
  const stale = workPanelView({ isPending: false, isError: true, data: { items: [{ status: "done" }] } })
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

test("history reading order puts dated records first", () => {
  const items = [
    { id: "u", date: null, title: "undated" },
    { id: "a", date: "2026-05-01", title: "old" },
    { id: "b", date: "2026-09-14", title: "new" },
  ] as Parameters<typeof historyReadingOrder>[0]
  assert.deepEqual(historyReadingOrder(items).map(item => item.id), ["b", "a", "u"])
})
