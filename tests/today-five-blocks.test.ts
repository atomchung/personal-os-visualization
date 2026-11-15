import test, { after, before } from "node:test"
import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MutationObserver, QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query"
import { createServer, type ViteDevServer } from "vite"
import { setInvestmentProvider, type TodayUpdate, type TodayUpdateStatus } from "../src/lib/investment.ts"
import { createSyntheticTodayUpdateRun, demoInvestmentProvider, resetSyntheticTodayUpdate } from "../src/demo/investmentProvider.ts"
import { createDemoRequest } from "../src/demo/transport.ts"
import { DATE, investment as demoInvestment, todayUpdate as sample } from "../src/demo/fixtures.ts"

let server: ViteDevServer
let previousLocation: PropertyDescriptor | undefined
before(async () => {
  previousLocation = Object.getOwnPropertyDescriptor(globalThis, "location")
  Object.defineProperty(globalThis, "location", { value: { origin: "http://localhost", hostname: "localhost" }, configurable: true })
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
})
after(async () => {
  await server.close()
  if (previousLocation) Object.defineProperty(globalThis, "location", previousLocation)
  else Reflect.deleteProperty(globalThis, "location")
})

const DEMO_NOW = new Date(`${DATE}T12:00:00+08:00`)

const status = (over: Partial<TodayUpdateStatus> = {}): TodayUpdateStatus => ({
  state: "ok", started_at: `${DATE}T22:07:00+08:00`, finished_at: `${DATE}T22:10:00+08:00`, message: null, latest: sample, ...over,
})

async function render(update: TodayUpdateStatus | undefined, props: Record<string, unknown> = {}): Promise<string> {
  const { TodayFiveBlocks } = await server.ssrLoadModule("/src/components/investment/TodayFiveBlocks.tsx")
  // The clock is fixed to the demo's day so a brief-less render keeps the demo update.
  return renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(TodayFiveBlocks, { update, now: DEMO_NOW, ...props })))
}

test("five blocks render blocks 1-4 and the market note from the synthetic update", async () => {
  const html = await render(status())
  // block 1
  assert.match(html, /今天不調整星島設備（虛構）的研究判斷/)
  assert.match(html, /和上一版的差別/)
  assert.match(html, /前一版只寫等產品發表/)
  assert.match(html, /什麼會改變這個看法/)
  assert.doesNotMatch(html, /檢查過，看法不變/, "checked_at equals as_of, so there is no extra caption")
  assert.doesNotMatch(html, /更新沒有成功/)
  // block 2
  assert.match(html, /星島設備（虛構）發表新一代儲能產品/)
  assert.equal((html.match(/當時預期/g) ?? []).length, 1)
  assert.doesNotMatch(html, /改變了今天的看法/)
  assert.doesNotMatch(html, /沒有新的結論/)
  // block 3: link through safeUrl, caption, tickers + effect
  assert.match(html, /<a href="https:\/\/example\.com\/synthetic\/launch"[^>]*target="_blank"[^>]*>星島設備（虛構）公布新一代儲能產品規格<\/a>/)
  assert.match(html, /合成新聞 · 21:58/)
  assert.match(html, /DEMO、DEMO-C/)
  assert.match(html, /需求面加分，交付面仍是空白/)
  assert.ok(html.indexOf("公布新一代儲能產品規格") < html.indexOf("範例指數收高"))
  // block 4
  assert.match(html, /未來事件/)
  assert.match(html, /9\/23/)
  assert.match(html, /為什麼看/)
  assert.match(html, /研究選題/)
  assert.ok(html.indexOf("未來事件") < html.indexOf("研究選題"))
  // block 5 note
  assert.match(html, /合成盤面：範例指數上漲/)
  assert.doesNotMatch(html, /<details/)
})

test("five blocks: block 1 header shows the update time", async () => {
  const html = await render(status())
  assert.match(html, /今天怎麼做<\/h\d>?[\s\S]*?22:10/)
})

test("five blocks: a later check shows the no-new-facts line; unsafe links are not linked", async () => {
  const latest: TodayUpdate = {
    ...sample,
    view: { ...sample.view, checked_at: `${DATE}T23:05:00+08:00`, changed: false, change_note: null, overturn: null },
    news: [{ ...sample.news[0], source_url: "javascript:alert(1)" }],
    conclusions: [], watch: [], market_note: null,
  }
  const html = await render(status({ latest }))
  assert.match(html, /23:05 檢查過，看法不變/)
  assert.doesNotMatch(html, /和上一版的差別/)
  assert.doesNotMatch(html, /javascript:/)
  assert.match(html, /沒有新的結論/)
  assert.match(html, /目前沒有要追蹤的事/)
})

test("five blocks: empty news shows its own empty line", async () => {
  const html = await render(status({ latest: { ...sample, news: [] } }))
  assert.match(html, /沒有新的消息/)
})

const previousDay = new Date(Date.parse(`${DATE}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
const briefProps = () => ({ b: demoInvestment.brief, today: demoInvestment.today })

/** Brief-derived content of the demo fixture in blocks 1, 3 and 4. */
function assertBriefFallback(html: string) {
  // block 1: the brief's judgment
  assert.match(html, /整理兩個待查問題，不由新聞直接形成交易。/)
  // block 2 has no brief source by design
  assert.match(html, /沒有新的結論/)
  // block 3: the brief's story and the later update summary
  assert.match(html, /星島設備發表新一代儲能產品（虛構）/)
  assert.match(html, /範例價格上漲 1\.2%/)
  // block 4: the brief's risk and upcoming check
  assert.match(html, /展示案例尚無交付證據/)
  assert.match(html, /09\/23 · 交付說明會（虛構）/)
  assert.doesNotMatch(html, /今天不調整星島設備（虛構）的研究判斷/)
  assert.doesNotMatch(html, /當時預期/)
}

test("five blocks: without an update, blocks fall back to the brief rendering", async () => {
  for (const update of [undefined, status({ state: "idle", latest: null, started_at: null, finished_at: null })]) {
    const html = await render(update, briefProps())
    assertBriefFallback(html)
    assert.doesNotMatch(html, /更新沒有成功/)
  }
})

/** The time shown in one block's header. */
function headerTime(html: string, title: string): string | null {
  const match = new RegExp(`aria-label="${title}"[\\s\\S]*?<span class="shrink-0[^"]*">([^<]*)</span>`).exec(html)
  return match ? match[1] : null
}

const monthDay = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`
const NEXT_DAY = new Date(DEMO_NOW.getTime() + 86_400_000)
const BRIEF_BLOCKS = ["今天怎麼做", "之前關注的事，結論", "今天發生了什麼", "未來要關注的事"]

test("five blocks: a brief from an earlier day still gives block 1 its view, and every block names the day", async () => {
  const stale = { ...demoInvestment.brief, state: "stale" }
  const html = await render(undefined, { ...briefProps(), b: stale, now: NEXT_DAY })
  assert.match(html, /整理兩個待查問題，不由新聞直接形成交易。/, "the last view is shown instead of a dash")
  for (const title of BRIEF_BLOCKS) assert.equal(headerTime(html, title), `${monthDay(DATE)} 21:30`, title)
  // read on its own day, the same content keeps the bare clock (block 3 takes its newest row's time instead)
  const sameDay = await render(undefined, briefProps())
  for (const title of BRIEF_BLOCKS.filter(title => title !== "今天發生了什麼")) assert.equal(headerTime(sameDay, title), "21:30", title)
  // a brief the page could not read gives no view
  for (const state of ["missing", "invalid"]) {
    const unreadable = await render(undefined, { ...briefProps(), b: { ...demoInvestment.brief, state }, now: NEXT_DAY })
    assert.doesNotMatch(unreadable, /整理兩個待查問題，不由新聞直接形成交易。/)
  }
})

test("five blocks: a stale brief's stories are not relabelled by a newer update row, and rows name their day", async () => {
  const stale = { ...demoInvestment.brief, state: "stale" }
  const row = demoInvestment.today.updates[0]
  const newer = { ...row, update_kind: "scan", scan_completed_at: `${NEXT_DAY.toISOString().slice(0, 10)}T09:10:00+08:00`, observed_at: `${NEXT_DAY.toISOString().slice(0, 10)}T09:10:00+08:00` }
  const older = { ...row, id: `${row.id}-older`, update_kind: "scan", scan_completed_at: `${DATE}T22:15:00+08:00`, observed_at: `${DATE}T22:15:00+08:00` }
  const html = await render(undefined, { b: stale, today: { ...demoInvestment.today, updates: [newer, older] }, now: NEXT_DAY })
  assert.equal(headerTime(html, "今天發生了什麼"), `${monthDay(DATE)} 21:30`, "the block is labelled with the stale brief's time")
  assert.match(html, />09:10</, "a row from today keeps the bare clock")
  assert.match(html, new RegExp(`>${monthDay(DATE)} 22:15<`), "a row from the earlier day names its day")
})

test("five blocks: news items from different days each name their own day", async () => {
  const item = sample.news[0]
  const news = [
    { ...item, added_at: `${DATE}T10:00:00+08:00` },
    { ...item, source_url: "https://example.com/earlier-day", added_at: `${previousDay}T22:15:00+08:00` },
  ]
  const html = await render(status({ latest: { ...sample, news } }))
  assert.equal(headerTime(html, "今天發生了什麼"), "10:00")
  assert.match(html, / · 10:00</)
  assert.match(html, new RegExp(` · ${monthDay(previousDay)} 22:15<`))
})

test("five blocks: the failure line names the day of both of its times when they are not today", async () => {
  const failed = status({ state: "failed", latest: null, finished_at: `${DATE}T23:10:00+08:00`, message: "合成工具沒有回應" })
  const html = await render(failed, { ...briefProps(), b: { ...demoInvestment.brief, state: "stale" }, now: NEXT_DAY })
  assert.match(html, new RegExp(`${monthDay(DATE)} 23:10 的更新沒有成功：合成工具沒有回應。以下是 ${monthDay(DATE)} 21:30 的內容。`))
})

test("five blocks: dayClock is HH:MM on today's Taipei date and M/D HH:MM on any other day", async () => {
  const { dayClock } = await server.ssrLoadModule("/src/components/investment/TodayFiveBlocks.tsx")
  const now = new Date("2026-03-05T09:00:00+08:00")
  assert.equal(dayClock("2026-03-05T08:05:00+08:00", now), "08:05")
  assert.equal(dayClock("2026-03-04T21:18:00+08:00", now), "3/4 21:18")
  // 23:30 UTC on the 4th is 07:30 on the 5th in Taipei
  assert.equal(dayClock("2026-03-04T23:30:00Z", now), "07:30")
  for (const unreadable of ["2026-03-04", "2026-03-04T21:18:00", "not a time", "", null, undefined]) assert.equal(dayClock(unreadable, now), null, String(unreadable))
})

/** Class names on the card that carries one block's label. */
function blockClasses(html: string, title: string): string[] {
  const tag = new RegExp(`<[^>]*aria-label="${title}"[^>]*>`).exec(html)?.[0] ?? ""
  return (/class="([^"]*)"/.exec(tag)?.[1] ?? "").split(/\s+/)
}

test("five blocks: blocks 1-4 flow in two columns that fill the page width, block 5 spans it below", async () => {
  const html = await render(status(), briefProps())
  const flow = /<div[^>]*data-slot="today-five-blocks-flow"[^>]*>/.exec(html)?.[0] ?? ""
  assert.match(flow, /lg:columns-2/, "two columns from the lg breakpoint")
  assert.doesNotMatch(html, /data-slot="reading-column"/, "no 800px reading column around the blocks")
  const titles = ["今天怎麼做", "之前關注的事，結論", "今天發生了什麼", "未來要關注的事", "盤面整理"]
  // each of blocks 1-4 stays whole inside one column; block 5 is outside the flow
  for (const title of titles.slice(0, 4)) assert.ok(blockClasses(html, title).includes("lg:break-inside-avoid"), title)
  assert.ok(!blockClasses(html, "盤面整理").includes("lg:break-inside-avoid"))
  assert.ok(html.indexOf('aria-label="盤面整理"') > html.indexOf("</div>", html.indexOf('aria-label="未來要關注的事"')))
  // DOM order is reading order, so a narrow screen stacks blocks 1-5 as they are.
  const position = (title: string) => html.indexOf(`aria-label="${title}"`)
  assert.deepEqual([...titles].sort((left, right) => position(left) - position(right)), titles)
})

const marketData = (over: Record<string, unknown> = {}) => ({
  twValue: 1234.5, twChange: 10.25, twChangePct: 0.84,
  usItems: [{ symbol: "DEMO-US", label: "範例美股指數", value: 980, change_percent: -0.3, quoted_at: `${DATE}T05:00:00+08:00` }],
  holdings: [
    { symbol: "DEMO", holding: true, price: 101.5, today: 1.2, return20d: 4.8, vs20ma: 2.1, vs50ma: -3.4, rsi: 55.5, relativeStrength: 6.3, vsSemis: -1.1, macdBearish: false },
    { symbol: "DEMO-B.TW", holding: false, price: 88, today: -2.5, return20d: -7.25, vs20ma: -4, vs50ma: null, rsi: 31.2, relativeStrength: null, vsSemis: null, macdBearish: true },
  ],
  reading: { strong: 1, as_of: DATE },
  coverage: { candidate_count: 2, holding_count: 1 },
  pulse: {
    as_of: DATE,
    breadth: { combined: { up: 900, down: 300, flat: 50, limit_up: 12, limit_down: 3 }, advancer_ratio: 0.72 },
    themes: { strongest: [{ theme: "範例族群甲", avg_change_pct: 3.2 }], weakest: [{ theme: "範例族群乙", avg_change_pct: -1.5 }] },
    flow: {
      as_of: DATE, turnover_ntd: 350_000_000_000, turnover_vs_prev_pct: -9.96, turnover_vs_avg20_pct: 2.5,
      institutional: { status: "published", foreign_net_ntd: 12_300_000_000, trust_net_ntd: -2_000_000_000, dealer_net_ntd: 500_000_000, total_net_ntd: 10_800_000_000 },
    },
  },
  exploreMarkets: [{
    market: "tw", as_of: DATE, buckets: [
      { key: "fast", items: [{ symbol: "DEMO-F", label: "範例公司甲", change_1d_pct: 9.9, change_7d_pct: 14.2, activity: { label: null, value: null }, rs_benchmark_1m_pp: null, vs_50ma_pct: null }] },
      { key: "active", items: [{ symbol: "DEMO-A", label: "範例公司乙", change_1d_pct: 1, change_7d_pct: null, activity: { label: "turnover", value: 73_000_000_000 }, rs_benchmark_1m_pp: null, vs_50ma_pct: null }] },
      { key: "sustained", items: [] },
    ],
  }],
  timeAt: `${DATE}T13:30:00+08:00`,
  ...over,
})

async function renderMarket(data: Record<string, unknown>, now: Date = DEMO_NOW): Promise<string> {
  const { MarketBlockView } = await server.ssrLoadModule("/src/components/investment/TodayFiveBlocks.tsx")
  return renderToStaticMarkup(createElement(MarketBlockView, { data, now }))
}

test("five blocks: block 5 shows breadth, turnover, institutions, themes, money flow and the full holdings table", async () => {
  const html = await renderMarket(marketData())
  assert.equal(headerTime(html, "盤面整理"), "13:30")
  assert.match(html, />市場廣度</)
  assert.match(html, /漲方 72%/)
  assert.match(html, /漲停 12 · 跌停 3/)
  assert.match(html, />上市成交額</)
  assert.match(html, />3,500 億</)
  assert.match(html, /比前一日 <span[^>]*>-9\.96%<\/span>/)
  assert.match(html, />三大法人</)
  assert.match(html, />\+108\.00 億</)
  assert.match(html, /外資 <span[^>]*>\+123\.00 億<\/span>/)
  assert.match(html, /投信 <span[^>]*text-bad[^>]*>-20\.00 億<\/span>/)
  assert.match(html, />族群熱度</)
  assert.match(html, /範例族群甲<\/span><span[^>]*text-ok[^>]*>\+3\.20%/)
  assert.match(html, /範例族群乙<\/span><span[^>]*text-bad[^>]*>-1\.50%/)
  assert.match(html, />市場資金在哪 · 台股</)
  assert.match(html, /範例公司甲<span[^>]*>DEMO-F<\/span>/)
  assert.match(html, /1 日 <span[^>]*>\+9\.90%<\/span> · 7 日 <span[^>]*>\+14\.20%<\/span>/)
  assert.match(html, /成交額 730 億/)
  assert.match(html, />持倉與觀察 · 2 檔（持倉 1） · 強勢 1 檔</)
  assert.match(html, /MACD 偏空：DEMO-B\.TW/)
  for (const column of ["價格", "今天", "20 日", "距 20 日線", "距 50 日線", "RSI", "對大盤", "對半導體"]) assert.match(html, new RegExp(`>${column}<`), column)
  assert.match(html, /DEMO-B\.TW<span[^>]*>觀察<\/span>/, "a watchlist row is marked")
  assert.doesNotMatch(html, />DEMO<span[^>]*>觀察/, "a holding is not")
  assert.match(html, />55\.5</, "RSI")
  assert.doesNotMatch(html, /<details/, "nothing is folded away")
})

test("five blocks: block 5 names the day of daily readings that are not from today", async () => {
  const html = await renderMarket(marketData(), NEXT_DAY)
  const day = monthDay(DATE)
  assert.equal(headerTime(html, "盤面整理"), `${day} 13:30`)
  for (const label of ["市場廣度", "上市成交額", "三大法人", "族群熱度", "市場資金在哪 · 台股"]) assert.match(html, new RegExp(`>${label} · ${day}<`), label)
  assert.match(html, new RegExp(`強勢 1 檔 · ${day}<`))
})

test("five blocks: block 5 leaves out what its sources did not give", async () => {
  const bare = await renderMarket(marketData({ pulse: undefined, exploreMarkets: undefined, reading: undefined, coverage: undefined }))
  for (const label of ["市場廣度", "上市成交額", "三大法人", "族群熱度", "市場資金在哪"]) assert.doesNotMatch(bare, new RegExp(label), label)
  assert.match(bare, />持倉與觀察</)
  const base = marketData()
  const unpublished = await renderMarket({ ...base, pulse: { ...base.pulse, flow: { ...base.pulse.flow, institutional: { ...base.pulse.flow.institutional, status: "not_published" } } } })
  assert.doesNotMatch(unpublished, /三大法人/)
  assert.match(unpublished, />上市成交額</)
  const empty = await renderMarket(marketData({ exploreMarkets: [{ market: "us", as_of: DATE, buckets: [{ key: "fast", items: [] }] }] }))
  assert.doesNotMatch(empty, /市場資金在哪/, "a market with no names is not shown")
})

test("five blocks: an update older than the brief does not replace it", async () => {
  const stale = status({ latest: { ...sample, date: previousDay } })
  const html = await render(stale, briefProps())
  assertBriefFallback(html)
  assert.doesNotMatch(html, /合成盤面：範例指數上漲/, "the stale market note is dropped too")
  const failed = await render(status({ ...stale, state: "failed", finished_at: `${DATE}T23:10:00+08:00`, message: "合成工具沒有回應" }), briefProps())
  assert.match(failed, /23:10 的更新沒有成功：合成工具沒有回應。以下是 21:30 的內容。/, "content time is the brief's, not the stale update's")
})

test("five blocks: on the same day the newer of update and brief wins by time", async () => {
  const brief = demoInvestment.brief
  const updateAt = (generated_at: string) => status({ latest: { ...sample, generated_at, view: { ...sample.view, as_of: generated_at, checked_at: generated_at } } })
  // update 09:00, brief 21:30: the brief is newer
  assertBriefFallback(await render(updateAt(`${DATE}T09:00:00+08:00`), briefProps()))
  // brief 08:00, update 15:00: the update is newer
  const later = await render(updateAt(`${DATE}T15:00:00+08:00`), { ...briefProps(), b: { ...brief, generated_at: `${DATE}T08:00:00+08:00` } })
  assert.match(later, /今天不調整星島設備（虛構）的研究判斷/)
  // unreadable brief time: only the dates are compared, so the same-day update is shown
  const unreadable = await render(updateAt(`${DATE}T09:00:00+08:00`), { ...briefProps(), b: { ...brief, generated_at: "unknown", source_cutoff: "unknown" } })
  assert.match(unreadable, /今天不調整星島設備（虛構）的研究判斷/)
})

test("five blocks: an update from the brief's day is shown", async () => {
  const html = await render(status(), briefProps())
  assert.match(html, /今天不調整星島設備（虛構）的研究判斷/)
  assert.match(html, /合成盤面：範例指數上漲/)
})

test("five blocks: without a brief date, only an update for today's Taipei date is shown", async () => {
  const shown = await render(status(), { now: DEMO_NOW })
  assert.match(shown, /今天不調整星島設備（虛構）的研究判斷/)
  const nextDay = new Date(`${DATE}T12:00:00+08:00`)
  nextDay.setUTCDate(nextDay.getUTCDate() + 1)
  const hidden = await render(status(), { now: nextDay })
  assert.doesNotMatch(hidden, /今天不調整星島設備（虛構）的研究判斷/)
  assert.doesNotMatch(hidden, /合成盤面：範例指數上漲/)
  const undated = await render(status(), { now: DEMO_NOW, b: { ...demoInvestment.brief, date: "" } })
  assert.match(undated, /今天不調整星島設備（虛構）的研究判斷/, "a brief without a date uses the same rule")
})

test("five blocks: a changed view checked later has no unchanged-view caption", async () => {
  const latest: TodayUpdate = { ...sample, view: { ...sample.view, changed: true, checked_at: `${DATE}T23:05:00+08:00` } }
  const html = await render(status({ latest }))
  assert.doesNotMatch(html, /檢查過，看法不變/)
  assert.match(html, /和上一版的差別/)
})

test("five blocks: a failed run shows one line at the top of block 1 with both times", async () => {
  const html = await render(status({ state: "failed", finished_at: `${DATE}T23:10:00+08:00`, message: "合成工具沒有回應" }))
  assert.match(html, /23:10 的更新沒有成功：合成工具沒有回應。以下是 22:10 的內容。/)
  assert.equal((html.match(/更新沒有成功/g) ?? []).length, 1)
  assert.ok(html.indexOf("更新沒有成功") < html.indexOf("今天不調整星島設備"))
  assert.ok(html.indexOf("更新沒有成功") > html.indexOf("今天怎麼做"))
  assert.match(html, /星島設備（虛構）發表新一代儲能產品/, "the previous successful update stays on screen")
})

test("five blocks: a failed run without any content still names its time", async () => {
  const html = await render(status({ state: "failed", latest: null, finished_at: null, message: "更新工具位置未設定。" }))
  assert.match(html, /22:07 的更新沒有成功：更新工具位置未設定。以下是 — 的內容。/)
})

test("five blocks: elapsed label is m:ss", async () => {
  const { elapsedLabel } = await server.ssrLoadModule("/src/lib/investmentTodayUpdate.ts")
  const start = `${DATE}T22:07:00+08:00`
  const at = (seconds: number) => Date.parse(start) + seconds * 1000
  assert.equal(elapsedLabel(start, at(0)), "0:00")
  assert.equal(elapsedLabel(start, at(75)), "1:15")
  assert.equal(elapsedLabel(start, at(-5)), "0:00")
  assert.equal(elapsedLabel(null, at(5)), null)
})

test("five blocks: market payload carries index, US indicators and holding rows", async () => {
  const { buildTodayMarketPayload } = await server.ssrLoadModule("/src/lib/investmentTodayMarket.ts")
  const payload = buildTodayMarketPayload({
    twValue: 1234, twChange: 10, twChangePct: 0.8,
    usItems: [{ symbol: "DEMO-US", label: "範例美股指數", value: 980, change_percent: -0.3 }],
    holdings: [{ symbol: "DEMO", today: 1.2, return20d: 4.8, relativeStrength: null }],
  })
  assert.deepEqual(payload, {
    taiwan_index: { value: 1234, change: 10, change_pct: 0.8 },
    us_indicators: [{ symbol: "DEMO-US", label: "範例美股指數", value: 980, change_pct: -0.3 }],
    holdings: [{ ticker: "DEMO", today_pct: 1.2, return_20d_pct: 4.8, relative_strength: null }],
  })
})

test("synthetic today-update run goes running, then ok with a changed fictional update", async () => {
  let clock = Date.parse(`${DATE}T23:00:00+08:00`)
  const run = createSyntheticTodayUpdateRun(3_000, () => clock)
  const initial = await run.get()
  assert.equal(initial.state, "ok")
  assert.equal(initial.latest?.date, DATE)
  const started = await run.start()
  assert.equal(started.state, "running")
  assert.equal(started.started_at, new Date(clock).toISOString())
  assert.equal(started.finished_at, null)
  assert.deepEqual(started.latest, initial.latest, "the previous content stays while running")
  clock += 1_000
  assert.equal((await run.start()).started_at, started.started_at, "a second start while running does not restart")
  assert.equal((await run.get()).state, "running")
  clock += 2_000
  const done = await run.get()
  assert.equal(done.state, "ok")
  assert.equal(done.finished_at, new Date(clock).toISOString())
  assert.equal(done.latest?.date, DATE)
  assert.equal(done.latest?.view.changed, true)
  assert.match(done.latest?.view.change_note ?? "", /通路商/)
  assert.equal(done.latest?.news.length, (initial.latest?.news.length ?? 0) + 1)
  await run.start()
  clock += 3_000
  const again = await run.get()
  assert.equal(again.latest?.view.changed, false, "a run with nothing new keeps the view and records the check")
  assert.equal(again.latest?.view.change_note, null)
  assert.equal(again.latest?.view.as_of, done.latest?.view.as_of)
  assert.equal(again.latest?.view.checked_at, new Date(clock).toISOString())
})

test("demo transport serves today-update GET and POST without network", async () => {
  setInvestmentProvider(demoInvestmentProvider)
  resetSyntheticTodayUpdate()
  const original = globalThis.fetch
  globalThis.fetch = () => { throw new Error("Unexpected network request") }
  try {
    const request = createDemoRequest()
    const read = await request("/api/investment/today-update")
    assert.equal(read.status, 200)
    const body = await read.json() as TodayUpdateStatus
    assert.equal(body.latest?.date, DATE)
    assert.equal((await request("/api/investment/today-update", { method: "POST", body: JSON.stringify({ market: { taiwan_index: null } }) })).status, 422)
    const start = await request("/api/investment/today-update", { method: "POST", body: JSON.stringify({ market: { taiwan_index: null, us_indicators: [], holdings: [] } }) })
    assert.equal(start.status, 200)
    assert.equal((await start.json() as TodayUpdateStatus).state, "running")
  } finally {
    globalThis.fetch = original
    resetSyntheticTodayUpdate()
  }
})

test("demo transport rejects malformed nested market snapshots", async () => {
  setInvestmentProvider(demoInvestmentProvider)
  resetSyntheticTodayUpdate()
  try {
    const request = createDemoRequest()
    const post = (market: unknown) => request("/api/investment/today-update", { method: "POST", body: JSON.stringify({ market }) })
    const index = { value: 1234, change: 10, change_pct: 0.8 }
    const indicator = { symbol: "DEMO-US", label: "範例美股指數", value: 980, change_pct: -0.3 }
    const holding = { ticker: "DEMO", today_pct: 1.2, return_20d_pct: null, relative_strength: null }
    const valid = { taiwan_index: index, us_indicators: [indicator], holdings: [holding] }
    for (const market of [
      [],
      { ...valid, taiwan_index: [] },
      { ...valid, taiwan_index: { ...index, value: "1234" } },
      { ...valid, taiwan_index: { change: 10, change_pct: 0.8 } },
      { taiwan_index: { value: null, change: 10, change_pct: 0.8 }, us_indicators: [], holdings: [] },
      { ...valid, us_indicators: [null] },
      { ...valid, us_indicators: [{ ...indicator, symbol: 1 }] },
      { ...valid, us_indicators: [{ ...indicator, label: null }] },
      { ...valid, us_indicators: [{ ...indicator, change_pct: "-0.3" }] },
      { ...valid, holdings: [[]] },
      { ...valid, holdings: [{ ...holding, ticker: null }] },
      { ...valid, holdings: [{ ...holding, today_pct: {} }] },
    ]) assert.equal((await post(market)).status, 422, JSON.stringify(market))
    assert.equal((await request("/api/investment/today-update", { method: "POST", body: JSON.stringify({ market: { ...valid, taiwan_index: null } }) })).status, 200)
  } finally { resetSyntheticTodayUpdate() }
})

test("demo mode: the five-block view renders the synthetic update read through the showcase transport", async () => {
  // `src/lib/transport.ts` is a generated boundary that differs per checkout; the
  // synthetic transport itself is shared, so the test builds its request from it.
  const request = (await server.ssrLoadModule("/src/demo/transport.ts")).createDemoRequest()
  ;(await server.ssrLoadModule("/src/demo/investmentProvider.ts")).resetSyntheticTodayUpdate()
  const update = await (await request("/api/investment/today-update")).json() as TodayUpdateStatus
  assert.equal(update.latest?.date, DATE)
  const html = await render(update)
  assert.match(html, /今天不調整星島設備（虛構）的研究判斷/)
  assert.match(html, /星島設備（虛構）公布新一代儲能產品規格/)
})

test("the investment page opens on the five-block view and keeps the legacy Today view behind its own tab", async () => {
  const { InvestmentPage } = await server.ssrLoadModule("/src/components/investment/InvestmentPage.tsx")
  const client = new QueryClient()
  const page = (props?: { initialView: "today" }) => renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(InvestmentPage, props)))

  const html = page()
  assert.match(html, /id="investment-tab-five"[^>]*aria-selected="true"[^>]*>Today</)
  assert.match(html, /id="investment-tab-today"[^>]*aria-selected="false"[^>]*>舊版 Today</)
  assert.ok(html.indexOf('id="investment-tab-five"') < html.indexOf('id="investment-tab-today"'), "the five-block tab comes first")
  assert.doesNotMatch(html, /五塊樣稿|Today 五塊/)
  assert.match(html, /更新看法與消息/)
  assert.doesNotMatch(html, />更新消息</)
  assert.doesNotMatch(html, /更新台股與美股消息，結果集中在盤中更新。/)
  assert.match(html, /<div id="investment-panel-five"[^>]*class="flex[^>]*>/)
  assert.doesNotMatch(html, /<div id="investment-panel-five"[^>]*hidden=""/)
  assert.match(html, /<div id="investment-panel-today"[^>]*hidden=""/)
  assert.match(html, /data-slot="today-five-blocks"/)

  const legacy = page({ initialView: "today" })
  assert.match(legacy, /id="investment-tab-today"[^>]*aria-selected="true"/)
  assert.match(legacy, /id="investment-tab-five"[^>]*aria-selected="false"/)
  assert.match(legacy, />更新消息</)
  assert.doesNotMatch(legacy, /更新看法與消息/)
  assert.match(legacy, /更新台股與美股消息，結果集中在盤中更新。/)
  assert.match(legacy, /<div id="investment-panel-five"[^>]*hidden=""[^>]*><\/div>/)
  client.clear()
})

test("five blocks: the index tile uses the exchange's published close once it exists for the live quote's day", async () => {
  const { taiwanIndexReading } = await server.ssrLoadModule("/src/lib/investmentTodayMarket.ts")
  const live = { value: 1240, change: 16, change_percent: 1.31, quoted_at: `${DATE}T05:29:00+00:00` }
  const pulse = (asOf: string, statusValue: "confirmed" | "needs_review" = "confirmed") => ({
    as_of: asOf, source_cutoff: `${asOf}T14:30:00+08:00`,
    index: { label: "範例指數", value: 1234, change: 10, change_pct: 0.82, direction_check: { status: statusValue, as_of: asOf } },
  })
  const yesterday = new Date(Date.parse(`${DATE}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
  // Same day, close published: the official figure replaces the live last bar.
  assert.deepEqual(taiwanIndexReading(live, pulse(DATE)), { value: 1234, change: 10, changePct: 0.82, time: `${DATE}T14:30:00+08:00` })
  // The published close is still yesterday's: keep the live quote.
  assert.deepEqual(taiwanIndexReading(live, pulse(yesterday)), { value: 1240, change: 16, changePct: 1.31, time: live.quoted_at })
  // A close whose direction check did not pass is not preferred over the live quote.
  assert.equal(taiwanIndexReading(live, pulse(DATE, "needs_review")).value, 1240)
  // The live quote's day cannot be read: keep the live quote rather than guess.
  assert.equal(taiwanIndexReading({ ...live, quoted_at: null }, pulse(DATE)).value, 1240)
  assert.equal(taiwanIndexReading({ ...live, quoted_at: "not-a-time" }, pulse(DATE)).value, 1240)
  // No live quote: the published reading is all there is; nothing at all gives nulls.
  assert.equal(taiwanIndexReading(undefined, pulse(yesterday)).value, 1234)
  assert.deepEqual(taiwanIndexReading(undefined, undefined), { value: null, change: null, changePct: null, time: null })
})

const ok = (over: Partial<TodayUpdateStatus> = {}) => status(over)

test("presented status: read errors become one failed status unless a running poll failed briefly", async () => {
  const { presentTodayUpdate } = await server.ssrLoadModule("/src/lib/investmentTodayUpdate.ts")
  const at = Date.parse(`${DATE}T23:00:00+08:00`)
  const error = new Error("合成讀取失敗")
  assert.deepEqual(presentTodayUpdate({ data: ok(), error: null, dataUpdatedAt: at, errorUpdatedAt: 0 }), ok())
  assert.equal(presentTodayUpdate({ data: undefined, error: null, dataUpdatedAt: 0, errorUpdatedAt: 0 }), undefined)
  assert.deepEqual(presentTodayUpdate({ data: undefined, error, dataUpdatedAt: 0, errorUpdatedAt: at }),
    { started_at: null, latest: null, state: "failed", finished_at: new Date(at).toISOString(), message: "合成讀取失敗" })
  const failedOk = presentTodayUpdate({ data: ok(), error, dataUpdatedAt: at - 1_000, errorUpdatedAt: at })
  assert.equal(failedOk.state, "failed")
  assert.equal(failedOk.latest, sample, "cached content stays")
  const running = ok({ state: "running", finished_at: null })
  assert.equal(presentTodayUpdate({ data: running, error, dataUpdatedAt: at - 60_000, errorUpdatedAt: at }), running, "a poll failure within 60 s keeps the run")
  assert.equal(presentTodayUpdate({ data: running, error, dataUpdatedAt: at - 60_001, errorUpdatedAt: at }).state, "failed")
})

/** Runs `body` with a provider selected in the Vite module graph, restoring the demo provider after. */
async function withViteProvider(override: Record<string, unknown>, body: () => Promise<void>) {
  await server.ssrLoadModule("/src/lib/transport.ts")
  const { setInvestmentProvider: select } = await server.ssrLoadModule("/src/lib/investment.ts")
  const { demoInvestmentProvider: demo } = await server.ssrLoadModule("/src/demo/investmentProvider.ts")
  select({ ...demo, ...override })
  try { await body() } finally { select(demo) }
}

test("five blocks: a provider without the read shows its message once, with the brief below", async () => {
  await withViteProvider({ getTodayUpdate: undefined }, async () => {
    const { presentTodayUpdate, todayUpdateQueryOptions } = await server.ssrLoadModule("/src/lib/investmentTodayUpdate.ts")
    const client = new QueryClient()
    const observer = new QueryObserver(client, todayUpdateQueryOptions(client, true))
    await observer.refetch()
    const presented = presentTodayUpdate(observer.getCurrentResult())
    const html = await render(presented, briefProps())
    assert.equal((html.match(/更新沒有成功/g) ?? []).length, 1)
    assert.match(html, /的更新沒有成功：更新狀態暫時無法讀取（這個資料來源沒有提供看法與消息更新）。以下是 21:30 的內容。/)
    assertBriefFallback(html)
    client.clear()
  })
})

test("five blocks: an errored read with cached content shows the failure line and the cached content", async () => {
  let calls = 0
  await withViteProvider({ async getTodayUpdate() { calls += 1; if (calls > 1) throw new Error("合成讀取失敗"); return ok() } }, async () => {
    const { presentTodayUpdate, todayUpdateQueryOptions } = await server.ssrLoadModule("/src/lib/investmentTodayUpdate.ts")
    const client = new QueryClient()
    const observer = new QueryObserver(client, todayUpdateQueryOptions(client, true))
    await observer.refetch()
    await observer.refetch()
    const html = await render(presentTodayUpdate(observer.getCurrentResult()), briefProps())
    assert.match(html, /的更新沒有成功：合成讀取失敗。以下是 22:10 的內容。/)
    assert.match(html, /今天不調整星島設備（虛構）的研究判斷/)
    client.clear()
  })
})

test("today-update read stays enabled only when asked or while a cached run is running", async () => {
  const { todayUpdateQueryOptions, TODAY_UPDATE_KEY } = await server.ssrLoadModule("/src/lib/investmentTodayUpdate.ts")
  const client = new QueryClient()
  assert.equal(todayUpdateQueryOptions(client, false).enabled, false, "nothing is read before the view is opened")
  assert.equal(todayUpdateQueryOptions(client, true).enabled, true)
  client.setQueryData(TODAY_UPDATE_KEY, ok())
  assert.equal(todayUpdateQueryOptions(client, false).enabled, false)
  client.setQueryData(TODAY_UPDATE_KEY, ok({ state: "running", finished_at: null }))
  assert.equal(todayUpdateQueryOptions(client, false).enabled, true, "a running run keeps polling on other views")
  client.clear()
})

test("starting a run cancels an older in-flight read so it cannot overwrite running", async () => {
  let resolveRead: (value: TodayUpdateStatus) => void = () => undefined
  const running = ok({ state: "running", started_at: `${DATE}T23:00:00+08:00`, finished_at: null })
  await withViteProvider({
    getTodayUpdate: () => new Promise<TodayUpdateStatus>(resolve => { resolveRead = resolve }),
    async startTodayUpdate() { return running },
  }, async () => {
    const { todayUpdateQueryOptions, todayUpdateStartOptions, TODAY_UPDATE_KEY } = await server.ssrLoadModule("/src/lib/investmentTodayUpdate.ts")
    const client = new QueryClient()
    const read = client.fetchQuery(todayUpdateQueryOptions(client, true)).catch(() => undefined)
    await new MutationObserver(client, todayUpdateStartOptions(client)).mutate(undefined)
    resolveRead(ok())
    await read
    assert.equal(client.getQueryData<TodayUpdateStatus>(TODAY_UPDATE_KEY)?.state, "running")
    client.clear()
  })
})

test("a failed start keeps the error's own message and falls back only when it has none", async () => {
  const { startFailureMessage, todayUpdateStartOptions, TODAY_UPDATE_KEY } = await server.ssrLoadModule("/src/lib/investmentTodayUpdate.ts")
  assert.equal(startFailureMessage(new Error("合成工具忙碌中")), "合成工具忙碌中")
  assert.equal(startFailureMessage(new Error("")), "更新要求沒有送出")
  assert.equal(startFailureMessage("not an error"), "更新要求沒有送出")
  await withViteProvider({ async startTodayUpdate() { throw new Error("合成工具忙碌中") } }, async () => {
    const client = new QueryClient()
    client.setQueryData(TODAY_UPDATE_KEY, ok())
    await new MutationObserver(client, todayUpdateStartOptions(client)).mutate(undefined).catch(() => undefined)
    const after = client.getQueryData<TodayUpdateStatus>(TODAY_UPDATE_KEY)
    assert.equal(after?.state, "failed")
    assert.equal(after?.message, "合成工具忙碌中")
    assert.equal(after?.latest, sample)
    client.clear()
  })
})

test("a status read that starts while the start is pending cannot overwrite running", async () => {
  let resolveRead: (value: TodayUpdateStatus) => void = () => undefined
  let resolveStart: (value: TodayUpdateStatus) => void = () => undefined
  let readStarted = false
  const running = ok({ state: "running", started_at: `${DATE}T23:00:00+08:00`, finished_at: null })
  await withViteProvider({
    getTodayUpdate: () => { readStarted = true; return new Promise<TodayUpdateStatus>(resolve => { resolveRead = resolve }) },
    startTodayUpdate: () => new Promise<TodayUpdateStatus>(resolve => { resolveStart = resolve }),
  }, async () => {
    const { todayUpdateQueryOptions, todayUpdateStartOptions, TODAY_UPDATE_KEY } = await server.ssrLoadModule("/src/lib/investmentTodayUpdate.ts")
    const client = new QueryClient()
    const started = new MutationObserver(client, todayUpdateStartOptions(client)).mutate(undefined)
    await new Promise(resolve => setTimeout(resolve, 0))
    // The read begins after onMutate, while the POST is still pending.
    const read = client.fetchQuery(todayUpdateQueryOptions(client, true)).catch(() => undefined)
    await new Promise(resolve => setTimeout(resolve, 0))
    assert.equal(readStarted, true)
    resolveStart(running)
    await started
    resolveRead(ok())
    await read
    assert.equal(client.getQueryData<TodayUpdateStatus>(TODAY_UPDATE_KEY)?.state, "running")
    client.clear()
  })
})

test("polling stops once failed polls outlast the grace period", async () => {
  await withViteProvider({ async getTodayUpdate() { throw new Error("合成讀取失敗") } }, async () => {
    const { todayUpdateQueryOptions, TODAY_UPDATE_KEY } = await server.ssrLoadModule("/src/lib/investmentTodayUpdate.ts")
    const running = ok({ state: "running", finished_at: null })
    for (const [age, polling] of [[1_000, true], [61_000, false]] as const) {
      const client = new QueryClient()
      client.setQueryData(TODAY_UPDATE_KEY, running, { updatedAt: Date.now() - age })
      const options = todayUpdateQueryOptions(client, true)
      await client.fetchQuery(options).catch(() => undefined)
      const query = client.getQueryCache().find({ queryKey: TODAY_UPDATE_KEY })!
      assert.ok(query.state.error, "the poll failed")
      assert.equal(options.refetchInterval(query), polling ? 5_000 : false, `age ${age}`)
      assert.equal(todayUpdateQueryOptions(client, false).enabled, polling, `keep-alive at age ${age}`)
      client.clear()
    }
  })
})
