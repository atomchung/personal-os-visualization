import test, { after, before } from "node:test"
import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createServer, type ViteDevServer } from "vite"
import { setInvestmentProvider, type TodayUpdate, type TodayUpdateStatus } from "../src/lib/investment.ts"
import { createSyntheticTodayUpdateRun, demoInvestmentProvider } from "../src/demo/investmentProvider.ts"
import { createDemoRequest } from "../src/demo/transport.ts"
import { DATE, todayUpdate as sample } from "../src/demo/fixtures.ts"

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

const status = (over: Partial<TodayUpdateStatus> = {}): TodayUpdateStatus => ({
  state: "ok", started_at: `${DATE}T22:07:00+08:00`, finished_at: `${DATE}T22:10:00+08:00`, message: null, latest: sample, ...over,
})

async function render(update: TodayUpdateStatus | undefined, props: Record<string, unknown> = {}): Promise<string> {
  const { TodayFiveBlocks } = await server.ssrLoadModule("/src/components/investment/TodayFiveBlocks.tsx")
  return renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(TodayFiveBlocks, { update, ...props })))
}

test("five blocks render blocks 1-4 and the market note from the synthetic update", async () => {
  const html = await render(status())
  // block 1
  assert.match(html, /今天不調整星島設備（虛構）的研究判斷/)
  assert.match(html, /和上一版的差別/)
  assert.match(html, /前一版只寫等產品發表/)
  assert.match(html, /什麼會改變這個看法/)
  assert.doesNotMatch(html, /檢查過，沒有新事實/, "checked_at equals as_of, so there is no extra caption")
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
    view: { ...sample.view, checked_at: `${DATE}T23:05:00+08:00`, change_note: null, overturn: null },
    news: [{ ...sample.news[0], source_url: "javascript:alert(1)" }],
    conclusions: [], watch: [], market_note: null,
  }
  const html = await render(status({ latest }))
  assert.match(html, /23:05 檢查過，沒有新事實/)
  assert.doesNotMatch(html, /和上一版的差別/)
  assert.doesNotMatch(html, /javascript:/)
  assert.match(html, /沒有新的結論/)
  assert.match(html, /目前沒有要追蹤的事/)
})

test("five blocks: empty news shows its own empty line", async () => {
  const html = await render(status({ latest: { ...sample, news: [] } }))
  assert.match(html, /沒有新的消息/)
})

test("five blocks: without an update, blocks fall back to the brief rendering", async () => {
  for (const update of [undefined, status({ state: "idle", latest: null, started_at: null, finished_at: null })]) {
    const html = await render(update)
    assert.match(html, /沒有新的結論/)
    assert.doesNotMatch(html, /當時預期/)
    assert.doesNotMatch(html, /更新沒有成功/)
  }
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
  } finally { globalThis.fetch = original }
})

test("demo mode: the five-block view renders the synthetic update read through the showcase transport", async () => {
  const { request } = await server.ssrLoadModule("/src/lib/transport.ts")
  const update = await (await request("/api/investment/today-update")).json() as TodayUpdateStatus
  assert.equal(update.latest?.date, DATE)
  const html = await render(update)
  assert.match(html, /今天不調整星島設備（虛構）的研究判斷/)
  assert.match(html, /星島設備（虛構）公布新一代儲能產品規格/)
})

test("the investment page keeps Today as the default view and adds the five-block tab", async () => {
  const { InvestmentPage } = await server.ssrLoadModule("/src/components/investment/InvestmentPage.tsx")
  const client = new QueryClient()
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(InvestmentPage)))
  assert.match(html, /id="investment-tab-today"[^>]*aria-selected="true"/)
  assert.match(html, /id="investment-tab-five"[^>]*aria-selected="false"[^>]*>Today 五塊</)
  assert.doesNotMatch(html, /五塊樣稿/)
  assert.match(html, />更新消息</)
  assert.doesNotMatch(html, /更新看法與消息/)
  assert.match(html, /更新台股與美股消息，結果集中在盤中更新。/)
  assert.match(html, /<div id="investment-panel-five"[^>]*hidden=""[^>]*><\/div>/)
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
  // No live quote: the published reading is all there is; nothing at all gives nulls.
  assert.equal(taiwanIndexReading(undefined, pulse(yesterday)).value, 1234)
  assert.deepEqual(taiwanIndexReading(undefined, undefined), { value: null, change: null, changePct: null, time: null })
})
