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

const SOURCE_TITLE = "2026-10-12 15:00 SYNTH Q3 線上法說（公司 2026-09-18 公告）"

function checkpoint(overrides: Partial<FutureCheckpoint> = {}): FutureCheckpoint {
  const title = overrides.title ?? SOURCE_TITLE
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
    affected_companies: [{ ticker: "SYNTH", display_name: "虛構記憶體" }],
    affected_scopes: [],
    checks: [{ scope: "SYNTH", check: "檢查合成下一季需求說明。", state: "registered", result_state: "unknown", source }],
    sources: [source],
    limitations: [],
    ...overrides,
  }
}

function projection(items: FutureCheckpoint[], uncertainItems: FutureCheckpoint[] = []): FutureCheckpoints {
  return { state: "ready", window_start: "2026-10-03", window_end: "2026-11-02", items, uncertain_items: uncertainItems, past_items: [], coverage_gaps: [], limitations: [] }
}

function render(items: FutureCheckpoint[], uncertainItems: FutureCheckpoint[] = []): string {
  return renderToStaticMarkup(createElement(FutureContent, { projection: projection(items, uncertainItems) }))
}

function compactHeadline(html: string): string {
  const match = html.match(/<p class="min-w-0 break-words text-body font-medium leading-relaxed text-ink-2">([\s\S]*?)<\/p>/)
  assert.ok(match, "future event rows render a primary title line")
  return match[1].replace(/<[^>]*>/g, "")
}

test("an exact source date leads once, source company and ticker are explicit, and source time is secondary", () => {
  const item = checkpoint()
  const heading = futureCheckpointHeading(item)
  assert.equal(heading.date, "10/12")
  assert.equal(heading.time, "15:00")
  assert.deepEqual(heading.companies.map(company => company.label), ["虛構記憶體（SYNTH）"])
  assert.equal(heading.title, "Q3 線上法說")

  const html = render([item])
  const headline = compactHeadline(html)
  assert.equal(headline, "10/12｜虛構記憶體（SYNTH）｜Q3 線上法說")
  assert.equal(headline.split("10/12").length - 1, 1)
  assert.equal(headline.split("SYNTH").length - 1, 1)
  assert.doesNotMatch(headline, /15:00/)
  assert.match(html, /<p class="text-caption text-ink-3">時間 15:00<\/p>/)
  assert.match(html, /來源註記：合成公司公告/)
  assert.match(html, /來源事件標題：2026-10-12 15:00 SYNTH Q3 線上法說（公司 2026-09-18 公告）/)
})

test("all explicit affected tickers stay paired with their source display names", () => {
  const item = checkpoint({
    title: "2026-10-12 15:00 SYNTH-A、SYNTH-B Q3 線上法說",
    affected_tickers: ["SYNTH-A", "SYNTH-B"],
    affected_companies: [
      { ticker: "SYNTH-A", display_name: "虛構甲公司" },
      { ticker: "SYNTH-B", display_name: "虛構乙公司" },
    ],
  })
  const heading = futureCheckpointHeading(item)
  assert.deepEqual(heading.companies.map(company => company.label), ["虛構甲公司（SYNTH-A）", "虛構乙公司（SYNTH-B）"])
  const headline = compactHeadline(render([item]))
  assert.equal(headline, "10/12｜虛構甲公司（SYNTH-A）、虛構乙公司（SYNTH-B）｜Q3 線上法說")
  assert.equal(headline.split("SYNTH-A").length - 1, 1)
  assert.equal(headline.split("SYNTH-B").length - 1, 1)
})

test("a missing Chinese name falls back to the original ticker without inventing a label", () => {
  const item = checkpoint({ affected_companies: [{ ticker: "SYNTH", display_name: null }] })
  const heading = futureCheckpointHeading(item)
  assert.deepEqual(heading.companies.map(company => company.label), ["SYNTH"])
  assert.equal(compactHeadline(render([item])), "10/12｜SYNTH｜Q3 線上法說")
})

test("month precision stays literal and is not expanded to an exact day", () => {
  const item = checkpoint({
    state: "partial",
    date: null,
    date_label: "2026-10",
    date_precision: "month",
    title: "2026-10 15:00 SYNTH Q3 線上法說",
  })
  const heading = futureCheckpointHeading(item)
  assert.equal(heading.date, "2026-10")
  assert.equal(heading.time, "15:00")
  assert.equal(heading.title, "Q3 線上法說")
  assert.equal(compactHeadline(render([item])), "2026-10｜虛構記憶體（SYNTH）｜Q3 線上法說")
})

test("conflicting dates remain in the source title without selecting one", () => {
  const rawTitle = "2026-10-12 / 2026-10-13 15:00 SYNTH Q3 線上法說"
  const heading = futureCheckpointHeading(checkpoint({
    state: "conflict",
    date: null,
    date_label: null,
    date_precision: "imprecise",
    title: rawTitle,
  }))
  assert.equal(heading.date, "日期衝突")
  assert.equal(heading.time, null)
  assert.equal(heading.title, rawTitle)
})

test("an unparsed date remains unchanged", () => {
  const rawTitle = "2026-10-?? 15:00 Q3 線上法說（公告時間仍待確認）"
  const heading = futureCheckpointHeading(checkpoint({
    state: "partial",
    date: null,
    date_label: null,
    date_precision: "imprecise",
    title: rawTitle,
  }))
  assert.equal(heading.date, "日期未確認")
  assert.equal(heading.time, null)
  assert.equal(heading.title, rawTitle)
})

test("long source titles remain intact and the rendered heading can wrap", () => {
  const longEventTitle = `Q3 線上法說 ${"QuarterlyDisclosure".repeat(8)}`
  const item = checkpoint({ title: `2026-10-12 15:00 SYNTH ${longEventTitle}` })
  const heading = futureCheckpointHeading(item)
  assert.equal(heading.title, longEventTitle)
  const html = render([item])
  assert.match(html, /min-w-0 break-words text-body font-medium/)
  assert.ok(html.includes(longEventTitle))
})

test("source title and source references remain available in the collapsed disclosure", () => {
  const html = render([checkpoint()])
  assert.match(html, /<details class="text-caption text-ink-3"><summary class="cursor-pointer py-1">原始事件標題與來源 · 1<\/summary>/)
  assert.match(html, /來源事件標題：2026-10-12 15:00 SYNTH Q3 線上法說（公司 2026-09-18 公告）/)
  const detailsIndex = html.indexOf("<details")
  assert.ok(detailsIndex > -1)
  assert.ok(html.indexOf("來源註記：合成公司公告") < detailsIndex)
  assert.match(html, /synthetic\/future-checkpoints\.md:2/)
})
