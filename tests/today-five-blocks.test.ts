import test, { after, before } from "node:test"
import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MutationObserver, QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query"
import { createServer, type ViteDevServer } from "vite"
import { setInvestmentProvider, type TodayUpdate, type TodayUpdateStatus } from "../src/lib/investment.ts"
import { createSyntheticTodayUpdateRun, demoInvestmentProvider, resetSyntheticTodayUpdate } from "../src/demo/investmentProvider.ts"
import { createDemoRequest } from "../src/demo/transport.ts"
import { DATE, investment as demoInvestment, leaders as demoLeaders, relativeStrength as demoRelativeStrength, todayUpdate as sample, twRelativeStrength as demoTwRelativeStrength } from "../src/demo/fixtures.ts"

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
  // one column title for wide screens, one label in the row for narrow ones
  assert.equal((html.match(/當時預期/g) ?? []).length, 2)
  assert.doesNotMatch(html, /改變了今天的看法/)
  assert.doesNotMatch(html, /沒有新的結論/)
  // block 3: link through safeUrl, caption, tickers + effect
  assert.match(html, /<a href="https:\/\/example\.com\/synthetic\/launch"[^>]*target="_blank"[^>]*>星島設備（虛構）公布新一代儲能產品規格<\/a>/)
  assert.match(html, /合成新聞 · 21:58/)
  assert.match(html, />DEMO<\/span><span[^>]*>DEMO-C<\/span>/, "affected holdings are separate chips")
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
  assert.doesNotMatch(html.slice(0, html.indexOf('aria-label="盤面整理"')), /<details/, "blocks 1-4 fold nothing away")
})

test("five blocks: a news item's effect is shown even when it names no holding", async () => {
  const news = [{ ...sample.news[0], affects: [], effect: "合成：這則只改變對產業的理解。" }]
  const html = await render(status({ latest: { ...sample, news } }))
  assert.match(html, /合成：這則只改變對產業的理解。/)
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
  assert.match(html, />09\/23<\/p>/)
  assert.match(html, /交付說明會（虛構）/)
  assert.ok(html.indexOf("未來事件") < html.indexOf("研究選題"), "dated events come before research topics")
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
const TITLES = ["今天怎麼做", "之前關注的事，結論", "今天發生了什麼", "未來要關注的事", "盤面整理"]

test("five blocks: each block is its own full-width section with a large title, in reading order", async () => {
  const html = await render(status(), briefProps())
  assert.doesNotMatch(html, /data-slot="reading-column"/, "no 800px reading column around the blocks")
  assert.doesNotMatch(html, /columns-2/, "no side-by-side columns of blocks")
  const sections = [...html.matchAll(/<section data-slot="today-block" aria-label="([^"]*)"[^>]*>/g)].map(match => match[1])
  assert.deepEqual(sections, TITLES)
  // the block title is the largest text in the block; the number leads it
  TITLES.forEach((title, index) => assert.match(html, new RegExp(`<h2 class="[^"]*text-metric font-bold[^"]*"><span[^>]*>${index + 1}</span>${title}</h2>`), title))
  // the view itself is set larger than body text
  assert.match(html, /<p class="text-num font-semibold[^"]*">今天不調整星島設備（虛構）的研究判斷/)
})

test("splitSentences: a sentence ends at 。！？ outside brackets or at a line break, and inline markup stays whole", async () => {
  const { splitSentences } = await server.ssrLoadModule("/src/components/investment/ReadingText.tsx")
  assert.deepEqual(splitSentences("第一句。第二句？第三句！"), ["第一句。", "第二句？", "第三句！"])
  assert.deepEqual(splitSentences("他說「先等。再看。」然後離開。下一句"), ["他說「先等。再看。」然後離開。", "下一句"])
  assert.deepEqual(splitSentences("括號（內部。不切）外面。"), ["括號（內部。不切）外面。"])
  assert.deepEqual(splitSentences("**粗體。不切**後面。[連結。文字](https://example.com/a)結尾。"), ["**粗體。不切**後面。", "[連結。文字](https://example.com/a)結尾。"])
  assert.deepEqual(splitSentences("第一行\n第二行<br>第三行"), ["第一行", "第二行", "第三行"])
  assert.deepEqual(splitSentences("真的嗎？！下一句。"), ["真的嗎？！", "下一句。"])
  assert.deepEqual(splitSentences("上漲 1.2%，收在 3.5 元。"), ["上漲 1.2%，收在 3.5 元。"], "a half-width full stop is not a sentence end")
  assert.deepEqual(splitSentences("  "), [])
})

/** The bullet lists inside one block, each as its marker colour class and its items' text. */
function pointLists(html: string, title: string): { marker: string; items: string[] }[] {
  const start = html.indexOf(`aria-label="${title}"`)
  const end = html.indexOf('<section data-slot="today-block"', start)
  const block = html.slice(start, end === -1 ? undefined : end)
  return [...block.matchAll(/<ul data-slot="points" class="([^"]*)">([\s\S]*?)<\/ul>/g)].map(match => ({
    marker: /marker:text-[a-z0-9-]+/.exec(match[1])?.[0] ?? "",
    items: [...match[2].matchAll(/<li>([\s\S]*?)<\/li>/g)].map(item => item[1].replace(/<[^>]+>/g, "")),
  }))
}

test("five blocks: the view's first sentence leads and the rest follow as bullet points", async () => {
  const view = { ...sample.view, text: "合成：今天不調整判斷。理由一是交付還沒有證據。理由二是價格已反映消息。", change_note: "合成：理由換了。傾向不變。", overturn: "合成：交期落空。" }
  const html = await render(status({ latest: { ...sample, view } }))
  assert.match(html, /<p class="text-num font-semibold[^"]*">合成：今天不調整判斷。<\/p>/)
  const lists = pointLists(html, "今天怎麼做")
  assert.deepEqual(lists, [
    { marker: "marker:text-accent", items: ["理由一是交付還沒有證據。", "理由二是價格已反映消息。"] },
    { marker: "marker:text-accent", items: ["合成：理由換了。", "傾向不變。"] },
    { marker: "marker:text-warn", items: ["合成：交期落空。"] },
  ])
  assert.match(html, /<span class="[^"]*text-accent[^"]*">和上一版的差別<\/span>/)
  assert.match(html, /<span class="[^"]*text-warn[^"]*">什麼會改變這個看法<\/span>/)
})

test("five blocks: a one-sentence view is the lead alone, and a one-sentence market note stays a paragraph", async () => {
  const html = await render(status({ latest: { ...sample, view: { ...sample.view, text: "合成：今天不調整判斷。", change_note: null, overturn: null }, market_note: "合成盤面：只有一句。" } }))
  assert.deepEqual(pointLists(html, "今天怎麼做"), [])
  assert.match(html, /<p class="[^"]*text-section[^"]*">合成盤面：只有一句。<\/p>/)
})

test("five blocks: every cell of blocks 2-4 is a bullet list, and the conclusion columns carry the orange marker", async () => {
  const conclusions = [{ ...sample.conclusions[0], expected: null, result: "合成：規格公布。沒有出貨數量。", conclusion: "合成：問題維持待驗證。" }]
  const html = await render(status({ latest: { ...sample, conclusions } }))
  assert.deepEqual(pointLists(html, "之前關注的事，結論"), [
    { marker: "marker:text-ink-4", items: ["合成：規格公布。", "沒有出貨數量。"] },
    { marker: "marker:text-accent", items: ["合成：問題維持待驗證。"] },
  ], "a missing expectation is a dash, not an empty list")
  // the column that carries the conclusion is marked in its title and in its narrow-screen label
  for (const [title, label] of [["之前關注的事，結論", "結論"], ["今天發生了什麼", "對持倉的影響"], ["未來要關注的事", "為什麼看"]]) {
    const start = html.indexOf(`aria-label="${title}"`)
    const block = html.slice(start, html.indexOf('<section data-slot="today-block"', start))
    assert.equal((block.match(new RegExp(`<span class="text-caption font-semibold text-ink[^"]*">${label}</span>`, "g")) ?? []).length >= 2, true, `${title}: ${label}`)
  }
  const news = pointLists(html, "今天發生了什麼")
  assert.deepEqual(news.map(list => list.marker), ["marker:text-ink-4", "marker:text-accent", "marker:text-ink-4"], "summary, effect, then the second story's summary")
  const ahead = pointLists(html, "未來要關注的事")
  assert.deepEqual(ahead.map(list => list.marker), ["marker:text-ink-4", "marker:text-accent", "marker:text-accent"], "event expectation and reason, then the research reason")
  assert.match(html, /未來事件<span[^>]*>1 項<\/span>/)
  assert.match(html, /研究選題<span[^>]*>1 項<\/span>/)
})

test("five blocks: an event due today carries an orange chip, one whose date has passed an amber one", async () => {
  const event = sample.watch[0]
  const tomorrow = new Date(Date.parse(`${DATE}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
  const watch = [
    { ...event, id: "demo-due-today", due: DATE },
    { ...event, id: "demo-due-passed", due: previousDay },
    { ...event, id: "demo-due-ahead", due: tomorrow },
    { ...event, id: "demo-due-none", due: null },
  ]
  const html = await render(status({ latest: { ...sample, watch } }))
  // the date keeps its ink; the state is the chip after it
  const chip = (date: string) => new RegExp(`<p class="[^"]*text-ink">${monthDay(date)}</p>(?:<span class="[^"]*(text-accent|text-warn)[^"]*">([^<]*)</span>)?`).exec(html)?.slice(1, 3)
  assert.deepEqual(chip(DATE), ["text-accent", "今天"])
  assert.deepEqual(chip(previousDay), ["text-warn", "已過"])
  assert.deepEqual(chip(tomorrow), [undefined, undefined])
  assert.doesNotMatch(html, /<p class="[^"]*text-warn[^"]*">\d/, "a date is never set in the warning colour, which the app restyles as status copy")
  assert.ok(html.indexOf(`>${monthDay(previousDay)}<`) < html.indexOf(`>${monthDay(DATE)}<`), "events stay in date order")
  assert.match(html, /未來事件<span[^>]*>4 項<\/span>/)
})

/** Renders the five blocks with the market and momentum readings already in the query cache. */
async function renderWithMarket(leaders: unknown = demoLeaders): Promise<string> {
  const { TodayFiveBlocks } = await server.ssrLoadModule("/src/components/investment/TodayFiveBlocks.tsx")
  const client = new QueryClient()
  client.setQueryData(["investment-momentum-leaders"], leaders)
  client.setQueryData(["investment-relative-strength"], demoRelativeStrength)
  client.setQueryData(["investment-tw-relative-strength"], demoTwRelativeStrength)
  try {
    return renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(TodayFiveBlocks, { update: status(), now: DEMO_NOW })))
  } finally { client.clear() }
}

test("five blocks: block 5 is the market card and the momentum table, with the market switch, the market filter and the sort order", async () => {
  const html = await renderWithMarket()
  const block = html.slice(html.indexOf('aria-label="盤面整理"'))
  // the update's note leads the block
  assert.ok(block.indexOf("合成盤面：範例指數上漲") < block.indexOf("市場現在怎麼走"))
  // market card: Taiwan / US switch
  assert.match(block, /<h3 class="text-num font-semibold[^"]*">市場現在怎麼走<\/h3>/)
  assert.match(block, /role="tablist" aria-label="市場"/)
  assert.match(block, /role="tab" aria-selected="true"[^>]*>台股</)
  assert.match(block, /role="tab" aria-selected="false"[^>]*>美股</)
  // momentum table: market filter and sort order
  assert.ok(block.indexOf("市場現在怎麼走") < block.indexOf("行情與均線位置"))
  assert.match(block, /<h3 class="text-num font-semibold[^"]*">行情與均線位置<\/h3>/)
  const group = (label: string) => new RegExp(`role="group" aria-label="${label}"[^>]*>(.*?)</div>`).exec(block)?.[1] ?? ""
  const options = (label: string) => [...group(label).matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*>([^<]*)<\/button>/g)].map(match => `${match[2]}:${match[1]}`)
  assert.deepEqual(options("市場篩選"), ["全部:true", "台股:false", "美股:false"])
  assert.deepEqual(options("排序方式"), ["依市值（預設）:true", "依 20 日報酬:false", "依相對強度（對各自大盤）:false"])
  // the whole roster is listed; nothing waits behind a "show the rest" button
  for (const row of demoLeaders.rows) assert.ok(block.includes(`>${row.symbol}<`), row.symbol)
  assert.doesNotMatch(block, /顯示其餘/)
})

test("five blocks: a roster longer than eight rows is listed in full, and can be shortened", async () => {
  const template = demoLeaders.rows[0]
  const rows = Array.from({ length: 10 }, (_, index) => ({ ...template, symbol: `DEMO-R${index}` }))
  const html = await renderWithMarket({ ...demoLeaders, rows })
  for (const row of rows) assert.ok(html.includes(`>${row.symbol}<`), row.symbol)
  assert.match(html, /收起其他持倉/)
})

test("momentum table: the market filter keeps one market, and strength sorts each row against its own market", async () => {
  const { filterRows, sortRows } = await server.ssrLoadModule("/src/components/investment/StockMomentum.tsx")
  const template = demoLeaders.rows[0]
  const row = (symbol: string, return20d: number | null) => ({ ...template, symbol, return_20d_pct: return20d })
  const rows = [row("DEMO-B", 1), row("DEMO-TW-A.TW", 3), row("SYNTH", 2), row("DEMO-TW-B.TWO", null), row("DEMO-C", 5)]
  const symbols = (list: { symbol: string }[]) => list.map(item => item.symbol)
  assert.deepEqual(symbols(filterRows(rows, "all")), symbols(rows))
  assert.deepEqual(symbols(filterRows(rows, "tw")), ["DEMO-TW-A.TW", "DEMO-TW-B.TWO"])
  assert.deepEqual(symbols(filterRows(rows, "us")), ["DEMO-B", "SYNTH", "DEMO-C"])

  const us = new Map(demoRelativeStrength.rows.map(item => [item.ticker, item] as const))
  // book order is the roster's own order
  assert.deepEqual(symbols(sortRows(rows, "value", us, demoTwRelativeStrength)), symbols(rows))
  // 20-day return, highest first; a row without one goes last
  assert.deepEqual(symbols(sortRows(rows, "return", us, demoTwRelativeStrength)), ["DEMO-C", "DEMO-TW-A.TW", "SYNTH", "DEMO-B", "DEMO-TW-B.TWO"])
  // strength: SYNTH +5.2 vs SPY, DEMO-TW-A +3.25 vs the Taiwan index, DEMO-B -2.4 vs SPY; no reading goes last
  assert.deepEqual(symbols(sortRows(rows, "rs", us, demoTwRelativeStrength)), ["SYNTH", "DEMO-TW-A.TW", "DEMO-B", "DEMO-TW-B.TWO", "DEMO-C"])
  // a Taiwan source that is unavailable gives no Taiwan reading at all
  assert.deepEqual(symbols(sortRows(rows, "rs", us, { ...demoTwRelativeStrength, state: "unavailable" })), ["SYNTH", "DEMO-B", "DEMO-TW-A.TW", "DEMO-TW-B.TWO", "DEMO-C"])
  assert.deepEqual(symbols(sortRows(rows, "rs", us, undefined)), ["SYNTH", "DEMO-B", "DEMO-TW-A.TW", "DEMO-TW-B.TWO", "DEMO-C"])
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
