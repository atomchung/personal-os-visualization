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

test("a verified explicit ticker leads the compact event title, without inferring a company from title prose", () => {
  const item = checkpoint()
  const heading = futureCheckpointHeading(item)
  assert.equal(heading.date, "2026-10-12")
  assert.deepEqual(heading.tickers, ["SYNTH"])
  assert.equal(heading.title, "15:00 合成公司 Q3 線上法說")
  const html = render([item])
  assert.match(html, /aria-label="已登記事件檢查點"/)
  assert.match(html, /2026-10-12 · SYNTH · 15:00 合成公司 Q3 線上法說/)
  assert.doesNotMatch(html, /2026-10-12 · SYNTH · 2026-10-12/)
  assert.match(html, /正式簡報另列的「近期檢查」收在「今天怎麼做」→「檢查點與來源」/)
})

test("multiple explicit affected tickers all remain in the title and relation status stays visible", () => {
  const item = checkpoint({ affected_tickers: ["SYNTH-A", "SYNTH-B"] })
  const heading = futureCheckpointHeading(item)
  assert.deepEqual(heading.tickers, ["SYNTH-A", "SYNTH-B"])
  const html = render([item])
  assert.match(html, /2026-10-12 · SYNTH-A、SYNTH-B · 15:00 合成公司 Q3 線上法說/)
  assert.match(html, /來源尚未登記事件關聯，保留為獨立項目。/)
})

test("raw producer title and source qualifiers stay available in collapsed provenance", () => {
  const item = checkpoint()
  const html = render([item])
  assert.match(html, /<details class="text-caption text-ink-3"><summary class="cursor-pointer py-1">原始事件標題與來源 · 1<\/summary>/)
  assert.match(html, /來源事件標題：2026-10-12 15:00 合成公司 Q3 線上法說（公司 2026-09-18 公告）/)
  assert.match(html, /出處註記：合成公司公告/)
  assert.match(html, /synthetic\/future-checkpoints\.md:2/)
})

test("an unparsed date label leaves the producer title text unchanged", () => {
  const rawTitle = "2026-10-?? 15:00 Q3 線上法說（公告時間仍待確認）"
  const item = checkpoint({ title: rawTitle, date: null, date_label: null })
  assert.equal(futureCheckpointHeading(item).title, rawTitle)
  const html = render([item])
  assert.match(html, /日期未確認 · SYNTH · 2026-10-\?\? 15:00 Q3 線上法說（公告時間仍待確認）/)
  assert.match(html, /來源事件標題：2026-10-\?\? 15:00 Q3 線上法說（公告時間仍待確認）/)
})
