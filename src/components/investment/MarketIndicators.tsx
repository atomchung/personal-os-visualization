import { useState } from "react"
import type { KeyboardEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, SectionHeading, SubsectionHeading } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { ACTIVE_POLL_MS, IDLE_POLL_MS, SESSION_LABELS, getInvestmentMarket, getInvestmentPulse, getTwRelativeStrength, getMarketExplore, type InvestmentMarket, type InvestmentMarketPulse, type TwRelativeStrength } from "@/lib/investment"
import { formatNumber, marketIndexDirectionDisplay, quoteTime, sourceTimestamp } from "@/lib/investmentFormat"
import { DEMO_MODE } from "@/lib/transport"
import { MarketExplore } from "./MarketExplore"

const MARKETS = [
  { key: "tw", label: "台股" },
  { key: "us", label: "美股" },
] as const
type MarketKey = typeof MARKETS[number]["key"]
const NUM = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 })

function number(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : NUM.format(value)
}

function pct(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : `${formatNumber(value, true)}%`
}

function ratio(value: number | null): string {
  return value == null || !Number.isFinite(value) ? "—" : `${NUM.format(value * 100)}%`
}

function tone(value: number | null): string {
  return value == null ? "text-ink-3" : value > 0 ? "text-ok" : value < 0 ? "text-bad" : "text-ink-2"
}

function turnover(value: number | null): string {
  return value == null || !Number.isFinite(value) ? "—" : `${NUM.format(value / 100_000_000)} 億`
}

function quoteLink(value: string): string | undefined {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.hostname === "finance.yahoo.com" ? url.href : undefined
  } catch {
    return undefined
  }
}

function QuoteRow({ item }: { item: InvestmentMarket["items"][number] }) {
  const up = item.change !== null && item.change > 0
  const down = item.change !== null && item.change < 0
  const link = quoteLink(item.source_url)
  return <Card density="compact" className="flex min-w-0 flex-col gap-1">
    <div className="flex flex-wrap items-center justify-between gap-1 text-label font-semibold leading-body text-ink-2">
      <span className="min-w-0">{link ? <a href={link} target="_blank" rel="noreferrer" className="hover:underline">{item.label}</a> : item.label}{item.code ? <span className="font-normal text-ink-3"> {item.code}</span> : null}</span>
      {item.session ? <Chip tone={item.session === "regular" ? "ok" : "mute"}>{SESSION_LABELS[item.session]}</Chip> : null}
    </div>
    <p className="flex min-w-0 flex-wrap items-baseline gap-1 text-body font-semibold leading-body tabular-nums text-ink">
      <span className="min-w-0 break-words">{formatNumber(item.value)}</span>
      {item.value !== null && item.unit ? <span className="text-caption font-normal text-ink-3">{item.unit}</span> : null}
    </p>
    <p className={`flex flex-wrap gap-1 text-caption leading-body tabular-nums ${up ? "text-ok" : down ? "text-bad" : "text-ink-3"}`}>
      <span>{formatNumber(item.change, true)}</span>
      <span>({item.change_percent === null ? "—" : `${formatNumber(item.change_percent, true)}%`})</span>
    </p>
    <p className="metadata">資料日期／報價 {sourceTimestamp(item.quoted_at)}</p>
    {item.state !== "available" ? <div><Chip tone="warn">{item.state === "stale" ? "較早報價" : "未取得"}</Chip></div> : null}
  </Card>
}

function QuoteContext({ market, data, pending, failed }: {
  market: MarketKey
  data?: InvestmentMarket
  pending: boolean
  failed: boolean
}) {
  const items = data?.items.filter(item => item.market === market) ?? []
  const unclassified = data?.items.some(item => !item.market) ?? false
  return <section className="flex min-w-0 flex-col gap-2" aria-label={`${market === "tw" ? "台股" : "美股"}指數報價`} aria-busy={pending}>
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
      <SubsectionHeading>主要指標報價</SubsectionHeading>
      <span className="text-caption text-ink-3">{data ? `行情讀取於 ${quoteTime(data.fetched_at)}` : ""}</span>
    </div>
    {pending && !data ? <p role="status" className="text-body text-ink-3">正在讀取市場報價…</p> : null}
    {failed ? <p role={data ? "status" : "alert"} className="text-caption leading-body text-warn">{data ? "行情更新失敗，以下保留上次取得的報價；不是最新結果。" : "這次讀不到市場報價；不影響市場探索結果。"}</p> : null}
    {data?.state === "partial" ? <p role="status" className="text-caption leading-body text-warn">部分指標未取得或已過時；各項報價時間分開標示。</p> : null}
    {data?.state === "unavailable" ? <p role="status" className="text-body text-warn">{items.length ? "市場報價目前無法更新；以下保留先前報價，不是最新結果。" : "目前無法取得這個市場的指數報價。"}</p> : null}
    {unclassified && !items.length ? <p role="status" className="text-body text-warn">行情來源沒有標明市場，不能安全地放入這個分頁。</p> : null}
    {data && data.state !== "unavailable" && !items.length && !unclassified ? <p className="text-body text-ink-3">行情來源這次沒有提供此市場的指數。</p> : null}
    {items.length ? <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">{items.map(item => <QuoteRow key={item.symbol} item={item} />)}</div> : null}
    {data ? <p className="text-micro text-ink-3">{DEMO_MODE ? "數字全部由展示資料提供，沒有查詢行情供應商。" : "Yahoo Finance 報價可能延遲；漲跌較前一交易日收盤。各指數的報價時間如上。"}</p> : null}
  </section>
}

function ThemeList({ title, rows }: { title: string; rows: InvestmentMarketPulse["themes"]["strongest"] }) {
  return <div className="flex min-w-0 flex-col gap-1">
    <h4 className="text-caption font-medium text-ink-3">{title}</h4>
    {rows.length ? <ul className="flex flex-col gap-1">{rows.slice(0, 3).map(row => <li key={`${title}-${row.theme}`} className="flex min-w-0 flex-wrap items-baseline justify-between gap-2 text-body text-ink-2"><span className="min-w-0">{row.theme}</span><span className={`shrink-0 tabular-nums ${tone(row.avg_change_pct)}`}>{pct(row.avg_change_pct)}</span></li>)}</ul> : <p className="text-body text-ink-3">未提供</p>}
  </div>
}

function TaiwanOverview({ data, pending, failed, readAt }: {
  data?: InvestmentMarketPulse
  pending: boolean
  failed: boolean
  readAt: string | null
}) {
  const direction = data ? marketIndexDirectionDisplay(
    data.index.direction_check?.status,
    data.index.change,
    data.index.change_pct,
  ) : null
  const directionCheck = data?.index.direction_check
  return <section className="flex min-w-0 flex-col gap-3" aria-label="台股整體盤感" aria-busy={pending}>
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
      <div className="flex min-w-0 flex-wrap items-baseline gap-2"><SubsectionHeading>整體盤感</SubsectionHeading>{data ? <Chip tone={data.state === "ready" ? "ok" : "warn"}>{data.state === "ready" ? "完整" : data.state === "partial" ? "部分" : "無法取得"}</Chip> : null}</div>
      {data ? <span className="metadata">最近可用交易日 {sourceTimestamp(data.as_of)} · 收盤／休市狀態未提供</span> : null}
    </div>
    <p className="text-caption text-ink-3">TWSE／TPEx 日結統計；盤中刷新不會讓資料日變成今天，也不代表盤中報價。</p>
    {pending && !data ? <p role="status" className="text-body text-ink-3">正在讀取台股整體盤感…</p> : null}
    {failed ? <p role={data ? "status" : "alert"} className="text-body text-warn">{data ? "台股盤感更新失敗，以下保留上次資料；資料日仍以原標示為準。" : "這次無法取得台股盤感；缺資料不代表沒有市場變化。"}</p> : null}
    {data?.state === "unavailable" ? <p role="status" className="text-body text-warn">這次沒有取得台股盤感；不以空值代表市場平靜。</p> : null}
    {data && data.state !== "unavailable" ? <>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0"><p className="text-caption text-ink-3">{data.index.label}</p><p className="text-display font-semibold tabular-nums text-ink">{number(data.index.value)}</p>{direction?.state === "confirmed" ? <p className={`text-body tabular-nums ${tone(direction.changePercent)}`}>{number(direction.change)} 點 · {pct(direction.changePercent)}</p> : <div className="flex flex-wrap items-center gap-2 pt-1"><Chip tone="mute">{direction?.state === "needs_review" ? "漲跌方向待核對" : "漲跌方向狀態未知"}</Chip>{direction?.state === "needs_review" && directionCheck?.reason ? <span className="text-caption leading-body text-ink-3">{directionCheck.reason}</span> : null}</div>}</div>
        <div className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 text-caption">
          <span className="text-ink-3">漲方比例</span><span className="text-right tabular-nums text-ink-2">{ratio(data.breadth.advancer_ratio)}</span>
          <span className="text-ink-3">漲停 / 跌停</span><span className="text-right tabular-nums text-ink-2">{number(data.breadth.combined.limit_up)} / {number(data.breadth.combined.limit_down)}</span>
          <span className="text-ink-3">上市櫃個股成交額</span><span className="text-right tabular-nums text-ink-2">{turnover(data.turnover.combined_stock)}</span>
          <div aria-label="台股漲跌家數" className="col-span-2 grid grid-cols-3 gap-2 border-t border-line-soft pt-2 text-center">
            <div><p className="text-ink-3">上漲家數</p><p className="tabular-nums text-ink-2">{number(data.breadth.combined.up)}</p></div>
            <div><p className="text-ink-3">下跌家數</p><p className="tabular-nums text-ink-2">{number(data.breadth.combined.down)}</p></div>
            <div><p className="text-ink-3">平盤家數</p><p className="tabular-nums text-ink-2">{number(data.breadth.combined.flat)}</p></div>
          </div>
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2"><ThemeList title={`${data.themes.label} · 強`} rows={data.themes.strongest} /><ThemeList title={`${data.themes.label} · 弱`} rows={data.themes.weakest} /></div>
    </> : null}
    {data ? <details className="border-t border-line-soft pt-2 text-caption text-ink-3"><summary className="cursor-pointer py-1">資料覆蓋、時間與方向核對</summary><div className="flex flex-col gap-1 pt-1"><p className="metadata">要求日期：{sourceTimestamp(data.requested_date)} · 本頁讀取：{sourceTimestamp(readAt)} · 資料產出：{sourceTimestamp(data.generated_at)}</p><p className="metadata">產出：{data.producer || "未提供"}</p><p className="metadata">來源截止：{sourceTimestamp(data.source_cutoff)}</p><p className="metadata">TWSE 行情日：{sourceTimestamp(data.source_dates?.twse)} · TPEx 行情日：{sourceTimestamp(data.source_dates?.tpex)}</p><p>方向核對：{direction?.state === "confirmed" ? "來源已確認" : direction?.state === "needs_review" ? "待核對" : "未提供可確認狀態"}{directionCheck?.session_flow_status ? ` · 盤後來源狀態 ${directionCheck.session_flow_status}` : ""}</p>{directionCheck?.reason ? <p>{directionCheck.reason}</p> : null}{directionCheck ? <div className="grid grid-cols-1 gap-1 rounded border border-line-soft p-2 sm:grid-cols-2"><p>TWSE 日結原值：{number(directionCheck.twse_close)} 點；漲跌 {number(directionCheck.twse_change)} 點（{pct(directionCheck.twse_change_pct)}）</p><p>盤後量價原值：{number(directionCheck.session_flow_close ?? data.flow?.index_close)} 點；漲跌 {number(directionCheck.session_flow_change ?? data.flow?.index_change)} 點</p></div> : null}{data.limitations.map((item, index) => <p key={index}>{item}</p>)}</div></details> : null}
  </section>
}

function TaiwanRelativeStrength({ data, pending, failed }: { data?: TwRelativeStrength; pending: boolean; failed: boolean }) {
  return <section aria-label="台股持倉相對大盤強弱" className="flex min-w-0 flex-col gap-3" aria-busy={pending}>
    <SubsectionHeading>台股持倉相對大盤強弱</SubsectionHeading>
    <p className="text-caption text-ink-3">台股持倉使用獨立的來源比較；與美股清單、全市場探索分開。數值由來源計算，這裡依原始 symbol 逐列呈現。</p>
    {pending && !data ? <p role="status" className="text-body text-ink-3">讀取台股相對強弱中…</p> : null}
    {failed ? <p role={data ? "status" : "alert"} className="text-body text-warn">台股相對強弱本次讀取失敗；{data ? "保留上次資料與原日期。" : "目前無法確認數值。"}</p> : null}
    {data ? <>
      <p className="text-caption text-ink-3">完整交易日 {sourceTimestamp(data.as_of)} · 要求日期 {sourceTimestamp(data.requested_date)} · {data.window_trading_days} 個交易日比較 · {data.state === "partial" ? "資料部分可用" : "目前無法取得"}</p>
      {data.state === "unavailable" ? <p role="status" className="text-body text-warn">來源標示相對強弱不可用；不是零，也不代表沒有台股持倉。</p> : null}
      {data.holdings.length ? <ul className="flex min-w-0 flex-col divide-y divide-line-soft">{data.holdings.map(row => <li key={row.symbol} data-tw-rs-symbol={row.symbol} className="flex min-w-0 flex-col gap-1 py-3">
        <p className="text-body font-medium text-ink">{row.symbol} · {row.exchange || "交易所未確認"} · {row.state === "partial" ? "部分可用" : "不可用"}</p>
        <p className="text-body text-ink-2">相對大盤：{row.market_rs_pp === null ? "未取得" : `${formatNumber(row.market_rs_pp, true)} 個百分點`} · 同業比較：未提供（來源為空值）</p>
        <p className="text-caption text-ink-3">Benchmark：{row.market_benchmark.id} · {row.market_benchmark.label}</p>
        <p className="text-caption text-ink-3">比較窗口 {sourceTimestamp(row.window_start)} 至 {sourceTimestamp(row.as_of)} · {row.window_trading_days} 個交易日；觀察點 {row.coverage.holding_sessions}/{row.coverage.expected_sessions}</p>
        {row.limitations.map((limitation, index) => <p key={index} className="text-caption text-warn">{limitation}</p>)}
        <details className="text-caption text-ink-3"><summary className="cursor-pointer py-1">資料代號與原因</summary><div className="flex min-w-0 flex-col gap-1 pt-1"><p>Provider symbol：{row.provider_symbol || "未確認"}</p><p>來源原因：{row.reason_codes.join("、") || "未提供"}</p><p>同業籃子：{row.peer_group === null ? "未提供" : row.peer_group}</p><p>個股資料：{row.price_source}</p><p className="break-all">大盤資料：{row.benchmark_source}</p></div></details>
      </li>)}</ul> : <p className="text-body text-warn">來源未列出台股持倉比較列；保留來源狀態，不推論沒有持倉。</p>}
      {data.limitations.map((limitation, index) => <p key={index} className="text-caption text-warn">{limitation}</p>)}
      <details className="text-caption text-ink-3"><summary className="cursor-pointer py-1">相對強弱的來源時間</summary><p>產出 {sourceTimestamp(data.generated_at)} · 來源截至 {sourceTimestamp(data.source_cutoff)} · 讀取 {sourceTimestamp(data.read_at)}</p><p>Producer：{data.producer}</p></details>
    </> : null}
  </section>
}

function UnitedStatesOverview() {
  return <div className="flex min-w-0 flex-col gap-2" aria-label="美股整體盤感">
    <SubsectionHeading>整體盤感</SubsectionHeading>
    <p className="text-caption text-ink-3">目前顯示可取得的主要指數；美股 breadth、成交額與 sector／theme 摘要未提供，不用台股資料補位。</p>
  </div>
}

export function MarketIndicators() {
  const [market, setMarket] = useState<MarketKey>("tw")
  const [refreshing, setRefreshing] = useState(false)
  const [refreshNotice, setRefreshNotice] = useState("")
  const client = useQueryClient()
  const quoteQuery = useQuery({
    queryKey: ["investment-market"],
    queryFn: ({ signal }) => getInvestmentMarket(signal),
    staleTime: 15_000,
    retry: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: (q) => DEMO_MODE ? false : (q.state.data?.active === false ? IDLE_POLL_MS : ACTIVE_POLL_MS),
    refetchIntervalInBackground: false,
  })
  const rsQuery = useQuery({ queryKey: ["investment-tw-relative-strength"], queryFn: ({ signal }) => getTwRelativeStrength(signal), staleTime: 300_000, retry: false, refetchOnWindowFocus: false })
  const pulseQuery = useQuery({ queryKey: ["investment-pulse"], queryFn: ({ signal }) => getInvestmentPulse(signal), staleTime: 60_000, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false })
  async function refreshMarketData() {
    setRefreshing(true)
    setRefreshNotice("")
    const results = await Promise.all([
      client.fetchQuery({ queryKey: ["investment-market"], queryFn: () => getInvestmentMarket(undefined, true), staleTime: 0, retry: false }).then(() => null, () => "指數報價"),
      client.fetchQuery({ queryKey: ["investment-explore"], queryFn: () => getMarketExplore(undefined, true), staleTime: 0, retry: false }).then(() => null, () => "市場探索"),
      client.fetchQuery({ queryKey: ["investment-pulse"], queryFn: () => getInvestmentPulse(), staleTime: 0, retry: false }).then(() => null, () => "台股整體盤感"),
      client.fetchQuery({ queryKey: ["investment-tw-relative-strength"], queryFn: () => getTwRelativeStrength(), staleTime: 0, retry: false }).then(() => null, () => "台股持倉相對強弱"),
    ])
    const failed = results.filter((label): label is string => label !== null)
    setRefreshNotice(failed.length ? `更新完成，但${failed.join("、")}本次未取得；原內容仍按各自日期顯示。` : "市場資料已重新讀取；資料日期仍以各區標示為準。")
    setRefreshing(false)
  }
  function selectByKey(event: KeyboardEvent<HTMLButtonElement>) {
    const focusedMarket = event.currentTarget.id.replace("market-tab-", "")
    const index = MARKETS.findIndex(item => item.key === focusedMarket)
    const next = event.key === "ArrowRight" ? (index + 1) % MARKETS.length : event.key === "ArrowLeft" ? (index + MARKETS.length - 1) % MARKETS.length : event.key === "Home" ? 0 : event.key === "End" ? MARKETS.length - 1 : null
    if (next !== null) { event.preventDefault(); const selected = MARKETS[next].key; setMarket(selected); document.getElementById(`market-tab-${selected}`)?.focus() }
  }
  return <section className="flex min-w-0 flex-col gap-2" aria-label="現在盤面與市場資金">
    <Card density="normal" className="min-w-0 overflow-hidden">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-3">
        <div><SectionHeading>市場現在怎麼走</SectionHeading><p className="mt-1 text-caption text-ink-3">先看整體狀態，再看資金流向；各資料保留自己的日期和刷新狀態。</p></div>
        <div role="tablist" aria-label="市場" className="flex min-w-0 gap-3 border-b border-line-soft">
          {MARKETS.map(item => <Button key={item.key} id={`market-tab-${item.key}`} role="tab" aria-controls={`market-panel-${item.key}`} aria-selected={market === item.key} tabIndex={market === item.key ? 0 : -1} variant="link" className={`rounded-none border-b-2 px-0 py-2 text-body ${market === item.key ? "border-accent text-ink" : "border-transparent text-ink-3"}`} onClick={() => setMarket(item.key)} onKeyDown={selectByKey}>{item.label}</Button>)}
        </div>
        <Button disabled={refreshing} onClick={() => void refreshMarketData()}>{refreshing ? "更新中…" : "更新市場資料"}</Button>
      </div>
      <div aria-label="各市場資料日期" className="mt-3 grid min-w-0 gap-2 border-t border-line-soft pt-3 sm:grid-cols-2">
        <p className="text-caption text-ink-2">台股日結資料日：{sourceTimestamp(pulseQuery.data?.as_of)} · {pulseQuery.isError ? "讀取失敗" : pulseQuery.data?.state ?? "讀取中"}；休市狀態未提供。 台股 RS 資料日：{sourceTimestamp(rsQuery.data?.as_of)}。</p>
        <div className="min-w-0 text-caption text-ink-2"><p>美股各指標資料日期：</p>{quoteQuery.data?.items.filter(item => item.market === "us").map(item => <p key={item.symbol}>{item.label} · {sourceTimestamp(item.quoted_at)} · {item.session ? SESSION_LABELS[item.session] : "交易階段未提供"} · {item.state === "available" ? "已取得" : item.state === "stale" ? "較早報價" : "未取得報價"}</p>)}{!quoteQuery.data?.items.some(item => item.market === "us") ? <p>目前無法確認；日期未提供。</p> : null}</div>
      </div>
      {refreshNotice ? <p role="status" aria-live="polite" className="text-caption text-ink-3">{refreshNotice}</p> : null}
      <div id={`market-panel-${market}`} role="tabpanel" aria-labelledby={`market-tab-${market}`} className="flex min-w-0 flex-col gap-4 pt-4">
        {market === "tw" ? <TaiwanOverview data={pulseQuery.data} pending={pulseQuery.isPending} failed={pulseQuery.isError} readAt={pulseQuery.dataUpdatedAt ? new Date(pulseQuery.dataUpdatedAt).toISOString() : null} /> : <UnitedStatesOverview />}
        {market === "tw" ? <TaiwanRelativeStrength data={rsQuery.data} pending={rsQuery.isPending} failed={rsQuery.isError} /> : null}
        <QuoteContext market={market} data={quoteQuery.data} pending={quoteQuery.isPending} failed={quoteQuery.isError} />
        <div className="border-t border-line-soft pt-4"><MarketExplore market={market} embedded /></div>
      </div>
    </Card>
  </section>
}
