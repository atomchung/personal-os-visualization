import assert from "node:assert/strict"
import test, { after, before } from "node:test"
import { createElement, type ComponentType } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer, type ViteDevServer } from "vite"
import type { FutureCheckpoint, FutureCheckpoints } from "../src/lib/investment.ts"
import { partitionPastByHoldings, pastCheckpointStatus, recentPastCheckpoints } from "../src/lib/investmentToday.ts"
import { investmentNarrative } from "../src/demo/fixtures.ts"
import { taipeiCalendarToday } from "../src/lib/investmentFormat.ts"

type Props = { projection: FutureCheckpoints; showPast?: boolean; today?: string; holdings?: ReadonlySet<string> | null }
let server: ViteDevServer
let FutureContent: ComponentType<Props>

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
  ;({ FutureContent } = await server.ssrLoadModule("/src/components/investment/InvestmentNarrative.tsx"))
})
after(async () => { await server.close() })

const TODAY = "2026-11-10"

function past(date: string, overrides: Partial<FutureCheckpoint> = {}): FutureCheckpoint {
  return {
    event_id: `evt-${date}-${overrides.title ?? "x"}`, story_id: null, title: overrides.title ?? `${date} 合成財報`, state: "ready",
    date, date_label: date, date_precision: "day", window_membership: "past",
    affected_tickers: ["SYNTH"], affected_scopes: ["SYNTH"], checks: [], sources: [], limitations: [],
    calendar_status: "occurred", ...overrides,
  }
}

function render(items: FutureCheckpoint[], holdings: ReadonlySet<string> | null = null, showPast = true): string {
  const projection: FutureCheckpoints = { state: "ready", window_start: TODAY, window_end: "2026-12-10", items: [], uncertain_items: [], past_items: items, coverage_gaps: [], limitations: [] }
  return renderToStaticMarkup(createElement(FutureContent, { projection, showPast, today: TODAY, holdings }))
}

test("keeps only the last seven days up to today, newest first", () => {
  const rows = recentPastCheckpoints([
    past("2026-11-02", { title: "八天前" }), past("2026-11-03", { title: "七天前" }),
    past("2026-11-09", { title: "昨天" }), past("2026-11-10", { title: "今天" }), past("2026-11-11", { title: "明天" }),
  ], TODAY)
  assert.deepEqual(rows.map(row => row.title), ["今天", "昨天", "七天前"])
})

test("renders recent rows with status wording and omits older ones", () => {
  const html = render([
    past("2026-11-09", { title: "2026-11-09 已發生事件", calendar_status: "occurred" }),
    past("2026-11-08", { title: "2026-11-08 日期過了事件", calendar_status: "scheduled" }),
    past("2026-11-07", { title: "2026-11-07 未知事件", calendar_status: "unknown" }),
    past("2026-10-01", { title: "2026-10-01 太舊事件" }),
  ])
  assert.match(html, /過去 7 天已發生/)
  assert.match(html, /已發生事件/); assert.match(html, />已發生</)
  assert.match(html, /日期已過，結果未確認/); assert.match(html, /狀態未知/)
  assert.doesNotMatch(html, /太舊事件/)
  assert.ok(html.indexOf("已發生事件") < html.indexOf("日期過了事件"), "newest first")
})

test("status wording helper", () => {
  assert.equal(pastCheckpointStatus({ calendar_status: "occurred" }), "已發生")
  assert.equal(pastCheckpointStatus({ calendar_status: "scheduled" }), "日期已過，結果未確認")
  assert.equal(pastCheckpointStatus({ calendar_status: "unknown" }), "狀態未知")
  assert.equal(pastCheckpointStatus({}), "狀態未知")
})

test("empty state is one muted line", () => {
  assert.match(render([past("2026-09-01")]), /過去 7 天沒有已發生的事件/)
})

test("not shown unless showPast is set", () => {
  assert.doesNotMatch(render([past("2026-11-09")], null, false), /過去 7 天已發生/)
})

test("check results appear only when the result is resolved; links only for https", () => {
  const check = { scope: "SYNTH", check: "需求", state: "pending", result_state: "resolved", source: { path: null }, result: { scope: "SYNTH", outcome: "resolved" as const, summary: "合成結果摘要" } }
  const resolved = render([past("2026-11-09", { result_state: "resolved", checks: [check], source_refs: ["https://example.com/a", "javascript:alert(1)"] })])
  assert.match(resolved, /合成結果摘要/)
  assert.match(resolved, /href="https:\/\/example\.com\/a"/)
  assert.doesNotMatch(resolved, /href="javascript:/)
  assert.doesNotMatch(render([past("2026-11-09", { checks: [check] })]), /合成結果摘要/)
})

test("holdings come first and other tracked companies are collapsed", () => {
  const rows = [
    past("2026-11-09", { title: "2026-11-09 持倉事件", affected_tickers: ["2330.TW"] }),
    past("2026-11-09", { title: "2026-11-09 觀察事件", affected_tickers: ["ANET"] }),
  ]
  const split = partitionPastByHoldings(rows, new Set(["2330"]))
  assert.equal(split.held.length, 1); assert.equal(split.other.length, 1)
  const html = render(rows, new Set(["2330"]))
  assert.match(html, /其他追蹤公司（1）/)
  assert.ok(html.indexOf("持倉事件") < html.indexOf("其他追蹤公司"))
  assert.ok(html.indexOf("其他追蹤公司") < html.indexOf("觀察事件"))
  assert.doesNotMatch(render(rows, null), /其他追蹤公司/)
})

test("demo fixture carries recent past rows and an excluded old one", () => {
  const rows = recentPastCheckpoints(investmentNarrative.future_checkpoints?.past_items ?? [], taipeiCalendarToday())
  assert.deepEqual(rows.map(row => row.event_id), ["synthetic-past-resolved", "synthetic-past-missed"])
})
