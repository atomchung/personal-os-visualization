import assert from "node:assert/strict"
import test, { after, before } from "node:test"
import { createElement, type ComponentType } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer, type ViteDevServer } from "vite"
import type { FutureCheckpoint, FutureCheckpoints } from "../src/lib/investment.ts"
import { futureCheckpointHeading } from "../src/lib/investmentToday.ts"

let server: ViteDevServer
let FutureContent: ComponentType<{ projection: FutureCheckpoints; heading?: string }>

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
  ;({ FutureContent } = await server.ssrLoadModule("/src/components/investment/InvestmentNarrative.tsx"))
})

after(async () => {
  await server.close()
})

function checkpoint(overrides: Partial<FutureCheckpoint> = {}): FutureCheckpoint {
  const title = "2026-10-12 15:00 合成公司 Q3 線上法說（公司 2026-09-18 公告）"
  const source = { path: "synthetic/future-checkpoints.md", line: 2, raw: title }
  return {
    story_id: null,
    title,
    state: "unlinked",
    date: "2026-10-12",
    date_label: "2026-10-12",
    date_precision: "day",
    window_membership: "within",
    source_qualifiers: ["合成公司公告"],
    affected_tickers: ["SYNTH"],
    affected_scopes: [],
    checks: [{ scope: "SYNTH", check: "檢查合成下一季需求說明。", state: "registered", result_state: "unknown", source }],
    sources: [source],
    limitations: [],
    ...overrides,
  }
}

function projection(items: FutureCheckpoint[]): FutureCheckpoints {
  return { state: "ready", window_start: "2026-10-03", window_end: "2026-11-02", items, uncertain_items: [], past_items: [], coverage_gaps: [], limitations: [] }
}

function render(items: FutureCheckpoint[]): string {
  return renderToStaticMarkup(createElement(FutureContent, { projection: projection(items) }))
}

function compactHeadlineAndDate(html: string): [string, string] {
  const match = html.match(/<p class="text-body font-medium leading-relaxed text-ink-2">([\s\S]*?)<\/p>\s*<p class="text-caption text-ink-3">([\s\S]*?)<\/p>/)
  assert.ok(match, "exact event rows show a headline followed by a secondary date")
  return [match[1], match[2]]
}

test("a verified explicit ticker leads the compact event title, without inferring a company from title prose", () => {
  const item = checkpoint()
  const heading = futureCheckpointHeading(item)
  assert.equal(heading.date, "2026-10-12")
  assert.deepEqual(heading.tickers, ["SYNTH"])
  assert.equal(heading.title, "15:00 合成公司 Q3 線上法說")
  const html = render([item])
  assert.match(html, /aria-label="公司近期事件"/)
  const [headline, date] = compactHeadlineAndDate(html)
  assert.equal(headline, "SYNTH · 15:00 合成公司 Q3 線上法說")
  assert.equal(date, "2026-10-12")
  assert.equal(`${headline} ${date}`.split("2026-10-12").length - 1, 1, "the compact visible row contains the date once")
  assert.match(html, /公司近期事件列表；其他市場提醒見「今天怎麼做」→「檢查點與來源」。/)
  assert.match(html, /來源註記：合成公司公告/)
})

test("multiple explicit affected tickers all remain in the title and relation status stays visible", () => {
  const item = checkpoint({ affected_tickers: ["SYNTH-A", "SYNTH-B"] })
  const heading = futureCheckpointHeading(item)
  assert.deepEqual(heading.tickers, ["SYNTH-A", "SYNTH-B"])
  const html = render([item])
  assert.deepEqual(compactHeadlineAndDate(html), ["SYNTH-A、SYNTH-B · 15:00 合成公司 Q3 線上法說", "2026-10-12"])
  assert.match(html, /來源尚未登記事件關聯，保留為獨立項目。/)
})

test("raw producer title and sources stay collapsed while source qualifiers remain visible", () => {
  const item = checkpoint()
  const html = render([item])
  assert.match(html, /<details class="text-caption text-ink-3"><summary class="cursor-pointer py-1">原始事件標題與來源 · 1<\/summary>/)
  assert.match(html, /來源事件標題：2026-10-12 15:00 合成公司 Q3 線上法說（公司 2026-09-18 公告）/)
  const detailsIndex = html.indexOf("<details")
  assert.ok(detailsIndex > -1)
  assert.ok(html.indexOf("來源註記：合成公司公告") < detailsIndex, "source qualifiers remain visible above the collapsed disclosure")
  assert.match(html, /synthetic\/future-checkpoints\.md:2/)
})

test("an uncertainty source qualifier remains visible", () => {
  const html = render([checkpoint({ source_qualifiers: ["公告日期待確認"] })])
  const detailsIndex = html.indexOf("<details")
  assert.ok(detailsIndex > -1)
  assert.ok(html.indexOf("來源註記：公告日期待確認") < detailsIndex)
})

test("an unparsed date label leaves the producer title text unchanged", () => {
  const rawTitle = "2026-10-?? 15:00 Q3 線上法說（公告時間仍待確認）"
  const item = checkpoint({ title: rawTitle, date: null, date_label: null })
  assert.equal(futureCheckpointHeading(item).title, rawTitle)
  const html = render([item])
  assert.deepEqual(compactHeadlineAndDate(html), ["SYNTH · 2026-10-?? 15:00 Q3 線上法說（公告時間仍待確認）", "日期未確認"])
  assert.match(html, /來源事件標題：2026-10-\?\? 15:00 Q3 線上法說（公告時間仍待確認）/)
})
