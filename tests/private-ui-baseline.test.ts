import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { setTimeout as delay } from "node:timers/promises"
import { createDemoRequest } from "./fixtures/extended-transport.ts"
import { investment, investmentHistory, investmentHistorySources, investmentNarrative, investmentResearch, watch } from "./fixtures/extended-ui.ts"
import { investmentScenario } from "../src/demo/generated/investment-scenario.ts"
import { buildTimeline, splitCatalyst } from "../src/lib/investmentDates.ts"
import { buildTodayStories, catalystDateGroups, todayCheckpoint, todayStoryHeadline } from "../src/lib/investmentToday.ts"
import { NAV_GROUPS, isTabKey } from "../src/lib/informationArchitecture.ts"
import type { InvestmentActionItem, InvestmentBrief } from "../src/lib/investment.ts"
import { actionStatusLabel, actionStatusNote, currentOpenActionItems, currentTodayActionPlan, followupTexts, groupBriefRows, historyChainDetailLinked, historyChainLinked, historyDetailLookupId, historyReadingOrder, investmentReminderIsForToday, RESEARCH_EVENT_LINKAGE_COPY, RESEARCH_ROLE_COPY, researchDirectionView, reusableLearningItems, recentActions, remainingActions, sourceTimestamp, quoteTime, taipeiCalendarToday, todayActionKindLabel, currentTodayActionEntries as todayActionPlan, todayGlobalDecisionSummary, workPanelView } from "../src/lib/investmentFormat.ts"

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
    for (const path of ["home", "cockpit", "focus", "time", "goals", "ideal", "health", "todos", "investment", "investment/narrative", "investment/actions", "investment/explore", "investment/market", "investment/watch", "investment/watch/read-model", "investment/research", `investment/research/detail?id=source%3Aresearch%2Fsynthetic.md`, "investment/history", "investment/context", "investment/pending", "investment/pending/read-model", "investment/work", "investment/momentum/universe", "investment/momentum/leaders", "investment/tw-relative-strength", `investment/quote?symbol=${investmentScenario.symbol}`, `investment/momentum?symbol=${investmentScenario.symbol}`, `investment/source?id=${investmentScenario.source_id}`, `investment/history/source?id=learning%3A${investmentScenario.history[0].id}`]) {
      const result = await request(`/api/${path}`)
      assert.equal(result.status, 200, path)
      assert.equal(typeof await result.json(), "object", path)
    }
    const leaders = await (await request("/api/investment/momentum/leaders")).json()
    assert.equal(leaders.rows[0].return_20d_pct, 4.8)
    assert.equal(leaders.rows[0].vs_20ma_pct, 2.6)
    assert.equal(leaders.rows[0].holding, true)
    assert.equal(leaders.coverage.lagging_symbols.length, 1)
    const twRs = await (await request("/api/investment/tw-relative-strength")).json()
    assert.equal(twRs.artifact, "tw-holdings-relative-strength")
    assert.equal(twRs.holdings[0].peer_rs_pp, null)
    for (const path of ["/api/not-implemented", "/api/investment/momentum?symbol=REAL", "/api/investment/source?id=private", "/api/investment/history/source?id=private", "http://localhost:8000/api/home", "https://example.com/api/home", "//localhost/api/home"]) assert.equal((await request(path)).status, 404, path)
    assert.equal((await request("/api/not-implemented", write({}))).status, 404)
  } finally { globalThis.fetch = original }
})

test("formal Research demo index and detail preserve the typed producer contract", async () => {
  const request = createDemoRequest()
  const index = await (await request("/api/investment/research")).json()
  assert.equal(index.artifact, "investment-research-index")
  assert.equal(index.state, "partial")
  assert.equal(index.research.count, 7)
  const item = index.research.items[0]
  const detail = await (await request(`/api/investment/research/detail?id=${encodeURIComponent(item.id)}`)).json()
  assert.equal(detail.artifact, "investment-research-detail")
  assert.equal(detail.research.item.id, item.id)
  assert.equal(typeof detail.research.detail.text, "string")
  assert.equal(detail.state, "partial")
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

test("Today stories merge only on producer-owned story identity", async () => {
  const data = await (await createDemoRequest()("/api/investment")).json()
  const stories = buildTodayStories(data.brief.date, data.brief.events, data.today.updates)
  assert.equal(stories.length, 1)
  assert.equal(stories[0].story_id, "demo-storage-event")
  assert.equal(stories[0].updates.length, 1)
  const unlinked = buildTodayStories(data.brief.date, data.brief.events, [{ ...data.today.updates[0], story_id: null }])
  assert.equal(unlinked.length, 2)
})

test("Today stories keep same-identity brief events and updates together and mark an empty latest summary", async () => {
  const data = await (await createDemoRequest()("/api/investment")).json()
  const event = { ...data.brief.events[0], story_id: " shared-story " }
  const secondEvent = { ...event, event: `${event.event} (second brief row)` }
  const newest = { ...data.today.updates[0], id: "newest", story_id: "shared-story", summary: "  " }
  const older = { ...data.today.updates[0], id: "older", story_id: "shared-story", summary: "Earlier update" }
  const stories = buildTodayStories(data.brief.date, [event, secondEvent], [newest, older])

  assert.equal(stories.length, 1)
  assert.equal(stories[0].story_id, "shared-story")
  assert.deepEqual(stories[0].events.map(({ event_index }) => event_index), [0, 1])
  assert.deepEqual(stories[0].updates.map(({ id }) => id), ["newest", "older"])
  assert.equal(todayStoryHeadline(stories[0]), "最新摘要未提供")
})

test("Today refresh actions expose explicit demo terminal states", async () => {
  const request = createDemoRequest()
  const pulse = await (await request("/api/investment/pulse")).json()
  assert.equal(pulse.breadth.advancer_ratio, 0.61)

  const marketStart = await (await request("/api/investment/refresh", write({ action: "market" }))).json()
  assert.equal(marketStart.state, "running")
  await delay(400)
  const marketDone = await (await request("/api/investment/refresh/status?action=market")).json()
  assert.equal(marketDone.state, "success")
  assert.equal(marketDone.discovery_state, "ready")

  const newsStart = await (await request("/api/investment/refresh", write({ action: "news", market: "us" }))).json()
  assert.equal(newsStart.state, "running")
  assert.equal(newsStart.scan_mode, "quick")
  assert.equal(newsStart.market_scope, "us")
  await delay(400)
  const newsDone = await (await request("/api/investment/refresh/status?action=news")).json()
  assert.equal(newsDone.state, "no-change")
  assert.match(newsDone.message, /無影響當前判斷的新消息/)
  assert.equal(newsDone.market_scope, "us")
  assert.equal(newsDone.duration_seconds, null)
  assert.equal((await request("/api/investment/refresh", write({ action: "shell" }))).status, 422)
  assert.equal((await request("/api/investment/refresh", write({ action: "market", market: "us" }))).status, 422)
})

test("Today layout contract keeps decision content visible on narrow screens", () => {
  const source = readFileSync(new URL("../src/components/investment/InvestmentPage.tsx", import.meta.url), "utf8")
  const timeline = readFileSync(new URL("../src/components/investment/DayTimeline.tsx", import.meta.url), "utf8")
  const pulseSource = readFileSync(new URL("../src/components/investment/MarketPulse.tsx", import.meta.url), "utf8")
  assert.match(source, /buildTodayStories/)
  assert.match(source, /現在盤面/)
  assert.match(source, /<MarketPulse \/>/)
  assert.match(source, /更新消息/)
  assert.doesNotMatch(source, />台股消息快掃<|>美股消息快掃</)
  assert.match(source, /總耗時/)
  assert.match(timeline, /版本與來源時間/)
  assert.match(timeline, /實際產出/)
  assert.match(timeline, /資訊截至/)
  assert.doesNotMatch(timeline, /目標班次分別為/)
  assert.doesNotMatch(source, /<InvestmentReminderPanel mode="today"/)
  assert.match(source, /<ThesisAttention\s+\n?\s*b=\{b\}/)
  assert.match(source, /import \{ StockMomentum \} from "\.\/StockMomentum"/)
  assert.match(source, /<StockMomentum \/>/)
  assert.match(pulseSource, /ratio\(pulse\.breadth\.advancer_ratio\)/)
  assert.match(source, /marketRefresh\.data\?\.discovery_state/)
  assert.match(source, /refetchType: "active"/)
  assert.match(source, /overflow-x-auto/)
  assert.match(source, /className="[^"]*min-w-0[^"]*"/)
})

test("history and Context expose one coherent scenario with explicit unknown results", async () => {
  const request = createDemoRequest()
  const history = await (await request("/api/investment/history")).json()
  const context = await (await request("/api/investment/context")).json()
  assert.equal(history.artifact, "investment-history-index")
  assert.equal(history.state, "partial")
  assert.equal(history.history.items[0].date, "2026-09-13")
  assert.equal(history.history.items[0].outcome_state, "unknown")
  assert.equal(context.read_only, true)
  assert.equal(context.task.slug, investmentScenario.context.task_slug)
  assert.equal(context.current_state.next_action, investmentScenario.context.next_action)
  assert.equal(context.evidence[0].source.line_start, investmentScenario.context.evidence[0].line_start)
  const unindexed = history.history.items.find((item: { id: string | null }) => item.id === null)
  assert.ok(unindexed)
  assert.equal(unindexed.state, "partial")
  assert.equal(historyDetailLookupId(unindexed), null)

  const detail = await (await request(`/api/investment/history/source?id=${encodeURIComponent(history.history.items[0].id)}`)).json()
  assert.equal(detail.history.item.id, history.history.items[0].id)
  assert.equal(detail.history.source_text, investmentScenario.history[0].detail)
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

test("a watch note round-trips through the demo transport with its own expiry", async () => {
  const request = createDemoRequest()
  const defaulted = await (await request("/api/investment/work", write({ kind: "watch", text: "留意合成的到期通知" }))).json()
  assert.equal(defaulted.kind, "watch")
  assert.match(defaulted.expires_on, /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(defaulted.promoted_to_today, false)
  const explicit = await (await request("/api/investment/work", write({ kind: "watch", text: "指定到期日", expires_on: "2026-12-25" }))).json()
  assert.equal(explicit.expires_on, "2026-12-25")
  assert.equal(explicit.promoted_to_today, false)
  assert.equal((await request("/api/investment/work", write({ kind: "watch", text: "壞日期", expires_on: "2026/12/25" }))).status, 422)
  const done = await (await request(`/api/investment/work/${explicit.id}`, write({ version: 1, status: "done", kind: "watch", conclusion: "" }, "PATCH"))).json()
  assert.equal(done.status, "done")
  assert.equal(done.version, 2)
  assert.equal(done.expires_on, "2026-12-25", "resolving a watch note must not change its deadline")
  const items = await (await request("/api/investment/work")).json()
  assert.ok(items.items.some((w: { id: string }) => w.id === explicit.id))
})

test("private reminder projection uses Taipei today or an explicit promotion only", async () => {
  const today = "2026-09-25"
  assert.equal(taipeiCalendarToday(new Date("2026-09-24T16:30:00Z")), today)
  const base = { kind: "watch" as const, status: "open" as const, expires_on: today, promoted_to_today: false }
  assert.equal(investmentReminderIsForToday(base, today), true)
  assert.equal(investmentReminderIsForToday({...base, expires_on: "2026-09-26"}, today), false)
  assert.equal(investmentReminderIsForToday({...base, expires_on: "2026-09-26", promoted_to_today: true}, today), true)
  assert.equal(investmentReminderIsForToday({...base, status: "watching"}, today), false)
  assert.equal(investmentReminderIsForToday({...base, status: "watching", promoted_to_today: true}, today), false)
  assert.equal(investmentReminderIsForToday({...base, status: "done", promoted_to_today: true}, today), false)
  assert.equal(investmentReminderIsForToday({...base, kind: "research"}, today), false)

  const request = createDemoRequest()
  const item = await (await request("/api/investment/work", write({kind: "watch", text: "合成待關注", expires_on: "2026-10-01"}))).json()
  const promoted = await (await request(`/api/investment/work/${item.id}`, write({version: 1, status: "open", kind: "watch", conclusion: "", promoted_to_today: true}, "PATCH"))).json()
  assert.equal(promoted.promoted_to_today, true)
  assert.equal(promoted.expires_on, "2026-10-01")
  assert.equal((await request(`/api/investment/work/${item.id}`, write({version: 2, status: "open", kind: "research", conclusion: ""}, "PATCH"))).status, 422)
})

test("demo transport follows the real API's watch-note rules", async () => {
  const request = createDemoRequest()
  const body = { kind: "watch", text: "合成重複提醒", expires_on: "2026-12-01" }
  const first = await (await request("/api/investment/work", write(body))).json()
  assert.equal((await (await request("/api/investment/work", write(body))).json()).id, first.id, "a double click is a retry")
  const otherDate = await (await request("/api/investment/work", write({ ...body, expires_on: "2026-12-02" }))).json()
  assert.notEqual(otherDate.id, first.id, "a new date is a new note")
  assert.equal((await request(`/api/investment/work/${first.id}`, write({ version: 1, status: "done", kind: "watch", conclusion: "" }, "PATCH"))).status, 200)
  assert.notEqual((await (await request("/api/investment/work", write(body))).json()).id, first.id, "a done note can be written again")
  for (const bad of ["20261001", "2026-02-30"]) assert.equal((await request("/api/investment/work", write({ ...body, text: `壞 ${bad}`, expires_on: bad }))).status, 422, bad)
  assert.equal((await request("/api/investment/work", write({ kind: "research", text: "x".repeat(501) }))).status, 422)
  // Python counts code points; 500 emoji are valid, 501 are not.
  assert.equal((await request("/api/investment/work", write({ kind: "research", text: "📈".repeat(500) }))).status, 200)
  assert.equal((await request("/api/investment/work", write({ kind: "research", text: "📉".repeat(501) }))).status, 422)
  const question = await (await request("/api/investment/work", write({ kind: "decision", text: "合成決策" }))).json()
  assert.equal((await request(`/api/investment/work/${question.id}`, write({ version: 1, status: "open", kind: "watch", conclusion: "" }, "PATCH"))).status, 422)
  assert.equal((await request(`/api/investment/work/${otherDate.id}`, write({ version: 1, status: "open", kind: "research", conclusion: "" }, "PATCH"))).status, 422)
})

test("today followups put intraday updates first, keep only action/watch kinds, dedup by trimmed text, and fall back to actions text when nothing is classified", () => {
  const classified: InvestmentActionItem[] = [
    { id: "a1", text: "夜盤觀察半導體核心開盤", status: "open", kind: "watch", tickers: [], evidence: [], artifact_id: "", source: "", date: "" },
    { id: "a2", text: "今天不需要因新聞做交易調整。", status: "unknown", kind: "no_change", tickers: [], evidence: [], artifact_id: "", source: "", date: "" },
    { id: "a3", text: "CXMT 供給是否可量化，持續追蹤。", status: "has-canonical-home", kind: "research", tickers: [], evidence: [], artifact_id: "", source: "", date: "" },
  ]
  const originalClassified = [...classified]
  assert.deepEqual(followupTexts(["先看開盤 30 分鐘量能"], classified, []), ["先看開盤 30 分鐘量能", "夜盤觀察半導體核心開盤"])
  assert.deepEqual(followupTexts(["夜盤觀察半導體核心開盤", " 夜盤觀察半導體核心開盤 "], classified, []), ["夜盤觀察半導體核心開盤"])
  assert.deepEqual(classified, originalClassified, "presentation must not mutate the source")

  // No action_items carry a `kind` (older payload, or a demo fixture written before
  // the field existed) -> the action/watch filter would silently go empty, so this
  // falls back to the plain-string `actions` list instead of showing nothing.
  const unclassified: InvestmentActionItem[] = classified.map(item => ({ ...item, kind: undefined }))
  assert.deepEqual(followupTexts([], unclassified, ["還是原本的行動文字"]), ["還是原本的行動文字"])
  assert.deepEqual(followupTexts([], [], ["純字串行動"]), ["純字串行動"])
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

test("work panel view does not treat a failed fetch as an empty list", () => {
  assert.equal(workPanelView({ isPending: true, isError: false }), "loading")
  assert.equal(workPanelView({ isPending: false, isError: true }), "error")
  assert.equal(workPanelView({ isPending: false, isError: true, data: { items: [] }, dataUpdatedAt: 1 }), "stale")
  assert.equal(workPanelView({ isPending: false, isError: false, data: { items: [] }, dataUpdatedAt: 1 }), "empty")
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

test("today next steps preserve producer kinds and status, and do not infer a checkpoint", () => {
  const brief: InvestmentBrief = structuredClone(investment.brief)
  const template = brief.action_items![0]
  brief.actions = []
  brief.action_items = [
    { ...template, id: "ai:demo-action", kind: "action", text: "依明確門檻處理已確認項目。", status: "open", evidence: ["來源列出的理由一", " 來源列出的理由二 "] },
    { ...template, id: "ai:demo-watch", kind: "watch", text: "等待下一份來源更新。", status: "has-canonical-home", evidence: [] },
    { ...template, id: "ai:demo-research", kind: "research", text: "補上交付證據。", status: "open", evidence: [] },
    { ...template, id: "ai:demo-closed", kind: "action", text: "已結案項目。", status: "closed" },
  ]
  const today = { ...structuredClone(investment.today), updates: [] }
  const plan = todayActionPlan(brief, today)
  assert.deepEqual(plan.map(item => [item.kind, item.status]), [
    ["action", "open"], ["watch", "has-canonical-home"], ["research", "open"],
  ])
  assert.deepEqual(plan.map(item => item.reason), ["來源列出的理由一；來源列出的理由二", null, null], "each brief action keeps its own producer evidence as why-now text")
  assert.deepEqual(plan.map(item => item.text), ["依明確門檻處理已確認項目。", "等待下一份來源更新。", "補上交付證據。"])
  assert.equal(plan.some(item => "checkpoint" in item || "next_check" in item), false)
  assert.equal(todayActionKindLabel("research", "brief"), "補研究")
  assert.equal(todayActionKindLabel("watch", "brief"), "等待／觀察")
  assert.match(readFileSync(new URL("../src/components/investment/InvestmentPage.tsx", import.meta.url), "utf8"), /下一個明確檢查點未知/)
})

test("Today presents ready updates and retains date-stale brief actions", () => {
  const brief = structuredClone(investment.brief)
  const template = brief.action_items![0]
  brief.actions = []
  brief.action_items = [{ ...template, id: "ai:current", text: "正式來源的目前行動。", kind: "action", status: "open" }]
  const update = structuredClone(investment.today.updates[0])
  assert.ok(update)
  const today = { ...structuredClone(investment.today), state: "ready" as const, updates: [{ ...update, id: "update:current", action: "正式來源的盤中提醒。" }] }

  assert.deepEqual(currentTodayActionPlan(brief, today).map(item => item.text), ["正式來源的盤中提醒。", "正式來源的目前行動。"])
  const staleBrief = { ...brief, state: "stale" as const }
  assert.deepEqual(currentTodayActionPlan(staleBrief, today).map(item => item.text), ["正式來源的盤中提醒。", "正式來源的目前行動。"], "date-stale brief rows remain visible alongside ready updates")
  for (const state of ["missing", "invalid"] as const) {
    const nonCurrentBrief = { ...brief, state }
    assert.deepEqual(currentTodayActionPlan(nonCurrentBrief, today).map(item => item.text), ["正式來源的盤中提醒。"], `${state} brief rows are not current, while ready update rows remain independently visible`)
  }
  for (const state of ["partial", "unavailable"] as const) {
    const nonCurrentToday = { ...today, state }
    assert.deepEqual(currentTodayActionPlan(brief, nonCurrentToday).map(item => item.text), ["正式來源的目前行動。"], `${state} update rows are not presented as confirmed current work`)
  }
  const page = readFileSync(new URL("../src/components/investment/InvestmentPage.tsx", import.meta.url), "utf8")
  assert.match(page, /currentTodayActionPlan\(b, today\)/)
  assert.match(page, /尚未取得正式簡報；不將舊快取或殘留欄位當作今天已確認的工作。/)
  assert.match(page, /正式簡報無法完整辨識；其中的行動不列為今天已確認的工作。/)
  assert.match(page, /以下保留上次成功讀到的簡報與行動/)
})

test("Today retains the same last-available brief across midnight and atomically switches to a newer brief", () => {
  const template = structuredClone(investment.brief.action_items![0]!)
  const previous = {
    ...structuredClone(investment.brief),
    state: "stale" as const,
    date: "2026-09-29",
    generated_at: "2026-09-29T21:40:00+08:00",
    source_cutoff: "2026-09-29T21:20:00+08:00",
    session: "us-open-prep",
    actions: [],
    judgment: null,
    action_items: [{ ...template, id: "ai:previous", text: "前一份晚報的正式行動。", date: "2026-09-29" }],
  }
  const noUpdates = { ...structuredClone(investment.today), updates: [] }
  const originalProvenance = [previous.date, previous.session, previous.generated_at, previous.source_cutoff]
  const previousSteps = currentTodayActionPlan(previous, noUpdates)
  assert.deepEqual(previousSteps.map(item => [item.id, item.text, item.date]), [
    ["ai:previous", "前一份晚報的正式行動。", "2026-09-29"],
  ])
  assert.deepEqual([previous.date, previous.session, previous.generated_at, previous.source_cutoff], originalProvenance)

  const sameSnapshotAfterMidnight = { ...previous, state: "current" as const }
  assert.deepEqual(currentTodayActionPlan(sameSnapshotAfterMidnight, noUpdates).map(item => [item.id, item.text, item.date]), [
    ["ai:previous", "前一份晚報的正式行動。", "2026-09-29"],
  ])

  const nextBrief = {
    ...previous,
    state: "current" as const,
    date: "2026-09-30",
    session: "tw-open-prep",
    generated_at: "2026-09-30T08:10:00+08:00",
    source_cutoff: "2026-09-30T08:00:00+08:00",
    action_items: [{ ...template, id: "ai:next", text: "下一份早報的正式行動。", date: "2026-09-30" }],
  }
  const nextSteps = currentTodayActionPlan(nextBrief, noUpdates)
  assert.deepEqual(nextSteps.map(item => [item.id, item.text, item.date]), [
    ["ai:next", "下一份早報的正式行動。", "2026-09-30"],
  ])
})

test("Today keeps exact cross-source copy separate unless producer IDs explicitly link it", () => {
  const brief = structuredClone(investment.brief)
  const template = brief.action_items![0]
  const exactText = "等待同一個明確觸發點後再檢查。"
  brief.actions = []
  brief.action_items = [{ ...template, id: "ai:brief-copy", kind: "action", text: exactText, status: "open", evidence: ["簡報自己的理由"] }]
  const update = structuredClone(investment.today.updates[0])
  assert.ok(update)
  const today = { ...structuredClone(investment.today), updates: [{ ...update, id: "update-copy", action: exactText, portfolio_impact: "更新自己的理由" }] }

  const plan = todayActionPlan(brief, today)
  assert.equal(plan.length, 2, "identical wording from separate producer records does not imply a relationship")
  assert.deepEqual(plan.map(item => [item.origin, item.id, item.reason]), [
    ["update", "update-copy", "更新自己的理由"],
    ["brief", "ai:brief-copy", "簡報自己的理由"],
  ])
  const page = readFileSync(new URL("../src/components/investment/InvestmentPage.tsx", import.meta.url), "utf8")
  assert.match(page, /盤中補充觀察/)
  assert.match(page, /沒有可確認的下一步；來源未明示「今天不用動」，已知檢查點保留在來源明細。/)
})

test("Today keeps the global summary once and never reuses it as an action-specific reason", () => {
  const summary = "DEMO 整體判斷仍維持原狀。"
  assert.equal(todayGlobalDecisionSummary(summary, [{ text: "依交付門檻處理。" }]), summary)
  assert.equal(todayGlobalDecisionSummary(summary, [{ text: summary }]), null, "the step itself already shows the exact summary")
  assert.equal(todayGlobalDecisionSummary("   ", [{ text: "行動" }]), null)
  const page = readFileSync(new URL("../src/components/investment/InvestmentPage.tsx", import.meta.url), "utf8")
  assert.equal((page.match(/整體判斷/g) ?? []).length, 1, "the global summary label has one rendering site")
  assert.doesNotMatch(page, /為什麼現在：[\s\S]{0,100}decisionSummary/)
  assert.doesNotMatch(page, /原因未知/, "a missing reason is omitted, never asserted as unknown")
  assert.doesNotMatch(page, /來源未提供此項目的 producer 理由/, "no main-level 'producer' wording")
  assert.match(page, /checkpoint \? "來源未列出獨立行動；行動狀態未明示，下一個已知檢查點如下。"/)
  assert.match(page, /checkpoint \? "沒有可確認的下一步；來源未明示「今天不用動」，已知檢查點保留在來源明細。"/)
})

test("failed action reads do not present cached formal work as current, and Research copy matches its behavior", () => {
  const open = investment.brief.action_items![0]
  const items: InvestmentActionItem[] = [open, { ...open, id: "ai:closed", status: "closed" }]
  assert.deepEqual(currentOpenActionItems(items, false).map(item => item.id), [open.id])
  assert.deepEqual(currentOpenActionItems(items, true), [], "a failed read hides cached formal actions from the current to-do list")
  assert.match(RESEARCH_ROLE_COPY, /深入尚未解決的公司、事件或問題/)
  assert.match(RESEARCH_ROLE_COPY, /研究工作、等待／檢查點與系統可計算狀態分開呈現/)
  assert.match(RESEARCH_EVENT_LINKAGE_COPY, /相同日期或標的本身不代表同一事件/)
  const researchWatch = readFileSync(new URL("../src/components/investment/ResearchWatch.tsx", import.meta.url), "utf8")
  assert.doesNotMatch(researchWatch, /同一天同一檔只列一次/)
  // The 待處理 header keeps one intro line (owner decision 2026-09-27), so the
  // Research role copy is rendered once, by the research-direction section.
  assert.match(researchWatch, /\{RESEARCH_ROLE_COPY\}/)
})

test("Today checkpoint uses a canonical exact 30-day catalyst only when the brief has none", () => {
  const brief: InvestmentBrief = { ...structuredClone(investment.brief), upcoming: [] }
  const projection = structuredClone(investmentNarrative.catalysts_30d!)
  const checkpoint = todayCheckpoint(brief, projection)
  assert.deepEqual(checkpoint, {
    source: "catalyst",
    relationship: "unlinked",
    date: "2026-10-05",
    text: "DEMO · event · 2026-10-05 合成交付檢查：比對交期與出貨節奏",
    check: null,
    sourceLocation: "synthetic/catalysts.md:12",
  })

  const explicit = { date_label: "09/24", event: "簡報明示檢查點", check: "比較原始來源" }
  brief.upcoming = [explicit]
  assert.deepEqual(todayCheckpoint(brief, projection), {
    source: "brief", relationship: "unlinked", date: explicit.date_label, text: explicit.event, check: explicit.check, sourceLocation: null,
  }, "brief checkpoint stays ahead of the catalyst fallback")

  brief.upcoming = []
  projection.items[0].date_precision = "approximate_day"
  assert.equal(todayCheckpoint(brief, projection), null, "approximate catalyst dates do not become an exact next checkpoint")
  projection.items[0].date_precision = "day"
  projection.items[0].window_membership = "possible"
  assert.equal(todayCheckpoint(brief, projection), null, "possible window membership is not treated as exact")
})

test("timeline keeps same-date matching prose as separate producer records", () => {
  const watchFixture = structuredClone(watch)
  watchFixture.watch.catalysts.push({
    ...watchFixture.watch.catalysts[0], id: "demo-same-day", topic: "DEMO same event", label: "DEMO same event",
    raw: "2026-09-23 DEMO same event", date: "2026-09-23", date_precision: "day", estimated: false,
  })
  const brief: InvestmentBrief = { ...structuredClone(investment.brief), upcoming: [
    { date_label: "09/23", event: "DEMO same event", check: "同一合成檢查" },
  ] }
  const timeline = buildTimeline(watchFixture, brief, "2026-09-20", "2026-10-20")
  const sameLabel = timeline.filter(item => item.title === "DEMO same event")
  assert.equal(sameLabel.length, 2)
  assert.deepEqual(new Set(sameLabel.map(item => item.key)), new Set(["watch:demo-same-day", "brief:0"]))
  assert.deepEqual(new Set(sameLabel.map(item => item.date_label)), new Set(["2026-09-23", "09/23"]))
})

test("history reading order puts dated records first", () => {
  const items = [
    { id: "u", date: null, title: "undated" },
    { id: "a", date: "2026-05-01", title: "old" },
    { id: "b", date: "2026-09-14", title: "new" },
    { id: null, date: "2026-09-14", title: "unindexed" },
  ] as Parameters<typeof historyReadingOrder>[0]
  assert.deepEqual(historyReadingOrder(items).map(item => item.id), [null, "b", "a", "u"])
  assert.equal(historyDetailLookupId({ id: null }), null)
  assert.deepEqual(reusableLearningItems([
    { kind: "mistake", title: "reusable framework in prose" },
    { kind: "learning", learning_role: "historical_case" },
    { kind: "unknown", learning_role: "reusable_framework" },
  ]).map(item => item.learning_role), ["reusable_framework"])
})

test("investment narrative demo preserves unknown mappings and separates status from coverage", async () => {
  const narrative = await (await createDemoRequest()("/api/investment/narrative")).json()
  const narrativeUi = readFileSync(new URL("../src/components/investment/InvestmentNarrative.tsx", import.meta.url), "utf8")
  const item = narrative.narratives[0]
  assert.equal(item.state, "drift")
  assert.equal(item.thesis_evidence.state, "partial")
  assert.deepEqual(item.thesis_evidence.layers.map((layer: { layer_id: string; direction_state: string }) => [layer.layer_id, layer.direction_state]), [
    ["L0", "unknown"], ["L1", "unknown"], ["L2", "unknown"], ["L2.5", "unknown"], ["L3", "unknown"],
  ])
  const challenge = item.thesis_evidence.directional_signals.find((signal: { direction: string }) => signal.direction === "challenges")
  assert.equal(challenge.source_date, null)
  assert.equal(challenge.document_updated, "2026-09-19")
  assert.equal(item.thesis_evidence.latest_recorded_change.date, null)
  assert.equal(item.latest_change.item, null)
  assert.deepEqual(item.thesis_evidence.layers.map((layer: { opposing_coverage?: { state: string } }) => layer.opposing_coverage?.state ?? "missing"), [
    "sufficient", "insufficient", "unavailable", "unknown", "missing",
  ])
  assert.equal(item.thesis_evidence.layers[0].evidence[0].polarity, "challenges")
  assert.equal(item.thesis_evidence.layers[1].evidence.length, 0)
  assert.equal(item.thesis_evidence.layers[3].link_state, "unlinked")
  const catalystGroups = catalystDateGroups(investmentNarrative.catalysts_30d)
  assert.deepEqual(catalystGroups.exact.map(item => item.date), ["2026-10-05"])
  assert.deepEqual(catalystGroups.uncertain.map(item => item.window_membership), ["possible"])
  const twRs = await (await createDemoRequest()("/api/investment/tw-relative-strength")).json()
  assert.equal(twRs.holdings[0].exchange, "TWSE")
  assert.equal(twRs.holdings[0].peer_rs_pp, null)
  assert.match(narrativeUi, /本層方向判斷/)
  assert.match(narrativeUi, /尚無明確的本層方向判斷/)
  assert.match(narrativeUi, /證據連結/)
  assert.match(narrativeUi, /沒有明確連結不代表沒有相關證據/)
  assert.match(narrativeUi, /反方涵蓋/)
  assert.match(readFileSync(new URL("../src/components/investment/MarketIndicators.tsx", import.meta.url), "utf8"), /資料時間/)
})

test("Research directions use exact producer member IDs and preserve unlinked or unknown items", () => {
  const view = researchDirectionView(investmentResearch)
  assert.deepEqual(view.groups.map(group => group.id), [
    "ai-economics-capex", "compute-tsm-capacity", "memory-supply-cycle",
    "interconnect-optical-power", "cross-cycle-capex-credit",
  ])
  assert.equal(view.groups.length, 5)
  assert.equal(view.groups.every(group => group.items.length === 1), true)
  assert.deepEqual(view.other.map(item => item.direction?.state), ["unlinked", "unknown"])
  assert.equal(view.other.every(item => item.ticker === "TSM"), true, "title, ticker, and prose never assign a direction")
  assert.deepEqual(new Set([...view.groups.flatMap(group => group.items), ...view.other].map(item => item.id)),
    new Set(investmentResearch.research.items.map(item => item.id)))

  const legacy = structuredClone(investmentResearch)
  delete legacy.research.direction_groups
  assert.equal(researchDirectionView(legacy).groups.length, 0)
  assert.deepEqual(researchDirectionView(legacy).other, legacy.research.items)
  const unsupported = structuredClone(investmentResearch)
  unsupported.research.direction_groups!.schema_version = 2
  assert.equal(researchDirectionView(unsupported).state, "unavailable")
  assert.equal(researchDirectionView(unsupported).other.length, 7)
})

test("historical chain requires episode identity, a recorded outcome, and exact provenance", () => {
  const detail = investmentHistorySources["episode:synthetic-linked-20260901"]
  const linked = detail.history.item!
  assert.equal(historyChainLinked(linked, investmentHistory.history.items), true)
  assert.equal(historyChainDetailLinked(linked, investmentHistory.history.items), true)
  assert.equal(historyChainDetailLinked(linked, investmentHistory.history.items, [{ ...linked }]), false)
  assert.equal(investmentHistory.state, "partial", "one explicit chain does not upgrade overall coverage")

  const { reason, decision_source, learning, learning_source, checkpoints, ...summary } = linked
  assert.equal(historyChainLinked(summary), true)
  assert.equal(historyChainDetailLinked(summary), false)
  const historicalCase = { ...linked, learning_role: "historical_case" as const }
  assert.equal(historyChainLinked(historicalCase), true, "a complete canonical historical case is a linked history chain")
  assert.equal(historyChainLinked({ ...historicalCase, decision_id: null }), false, "historical case role does not repair an incomplete canonical chain")
  assert.ok(reason && decision_source && learning && learning_source && checkpoints)
  for (const patch of [
    { id: null }, { decision_id: null }, { chain_state: "unknown" },
    { outcome_state: "unknown" }, { checkpoints: [] }, { decision_source: null },
    { learning_source: null }, { learning_role: "unknown" }, { state: "partial" },
    { state: "conflict" },
  ]) {
    assert.equal(historyChainDetailLinked({ ...linked, ...patch } as typeof linked), false)
  }
  assert.equal(historyChainLinked(linked, [linked, { ...linked }]), false, "duplicate identities remain unlinked")
  assert.equal(historyChainDetailLinked(linked, investmentHistory.history.items, [{ ...linked }]), false,
    "detail-envelope conflicts fail closed")
  assert.equal(historyChainDetailLinked({ ...linked, checkpoints: [{ ...linked.checkpoints![0], relation_state: "unknown" }] }), false)
  const detailOutcomeOnly = { ...linked, outcome_state: undefined }
  assert.equal(historyChainLinked(detailOutcomeOnly), true, "detail may expose recorded status on outcome.state")
  assert.equal(historyChainDetailLinked(detailOutcomeOnly), true)
  assert.equal(historyChainLinked({ ...linked, outcome_state: "unknown" }), false, "an explicit unknown status remains fail-closed")
  const oneLine = {
    ...linked,
    decision_source: { ...linked.decision_source!, line_end: undefined },
    learning_source: { ...linked.learning_source!, line_end: undefined },
    checkpoints: linked.checkpoints!.map((point, index) => index === 0 && point.source
      ? { ...point, source: { ...point.source, line_end: undefined } }
      : point),
  }
  assert.equal(historyChainDetailLinked(oneLine), true, "an explicit source line does not need a range end")
  assert.equal(historyChainDetailLinked({ ...oneLine, decision_source: { path: linked.decision_source!.path } }), false)
  assert.equal(historyChainDetailLinked({ ...oneLine, learning_source: { ...linked.learning_source!, line_end: linked.learning_source!.line! - 1 } }), false)
})
