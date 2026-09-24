import { useState } from "react"
import type { KeyboardEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, SectionHeading } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { ACTIVE_POLL_MS, IDLE_POLL_MS, SESSION_LABELS, getInvestmentMarket, getInvestmentPulse, getMarketExplore, type InvestmentMarket, type InvestmentMarketPulse } from "@/lib/investment"
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
  return <Card className="flex min-w-0 flex-col gap-1 p-2">
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
    <p className="text-micro leading-body text-ink-3">報價時間 {quoteTime(item.quoted_at)}</p>
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
      <h3 className="text-body font-medium text-ink">主要指標報價</h3>
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
  const sourceDateSummary = data?.source_dates
    ? `TWSE ${sourceTimestamp(data.source_dates.twse)} · TPEx ${sourceTimestamp(data.source_dates.tpex)}`
    : ""
  return <section className="flex min-w-0 flex-col gap-3" aria-label="台股整體盤感" aria-busy={pending}>
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
      <div className="flex min-w-0 flex-wrap items-baseline gap-2"><h3 className="text-body font-medium text-ink">整體盤感</h3>{data ? <Chip tone={data.state === "ready" ? "ok" : "warn"}>{data.state === "ready" ? "完整" : data.state === "partial" ? "部分" : "無法取得"}</Chip> : null}</div>
      {data ? <span className="text-caption text-ink-3">資料交易日 {sourceTimestamp(data.as_of)}{data.requested_date ? ` · 要求日期 ${sourceTimestamp(data.requested_date)}` : ""} · 本頁讀取於 {sourceTimestamp(readAt)} · 產出於 {sourceTimestamp(data.generated_at)}</span> : null}
    </div>
    <p className="text-caption text-ink-3">TWSE／TPEx 日結統計；盤中刷新不會讓資料日變成今天，也不代表盤中報價。</p>
    {data?.source_dates ? <p className="text-caption text-ink-3">各來源行情日：{sourceDateSummary}</p> : null}
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
    {data ? <details className="border-t border-line-soft pt-2 text-caption text-ink-3"><summary className="cursor-pointer py-1">資料覆蓋、來源日期與方向核對</summary><div className="flex flex-col gap-1 pt-1"><p>產出：{data.producer || "未提供"}</p><p>來源截止：{sourceTimestamp(data.source_cutoff)}</p><p>TWSE 行情日：{sourceTimestamp(data.source_dates?.twse)} · TPEx 行情日：{sourceTimestamp(data.source_dates?.tpex)}</p><p>方向核對：{direction?.state === "confirmed" ? "來源已確認" : direction?.state === "needs_review" ? "待核對" : "未提供可確認狀態"}{directionCheck?.session_flow_status ? ` · 盤後來源狀態 ${directionCheck.session_flow_status}` : ""}</p>{directionCheck?.reason ? <p>{directionCheck.reason}</p> : null}{directionCheck ? <div className="grid grid-cols-1 gap-1 rounded border border-line-soft p-2 sm:grid-cols-2"><p>TWSE 日結原值：{number(directionCheck.twse_close)} 點；漲跌 {number(directionCheck.twse_change)} 點（{pct(directionCheck.twse_change_pct)}）</p><p>盤後量價原值：{number(directionCheck.session_flow_close ?? data.flow?.index_close)} 點；漲跌 {number(directionCheck.session_flow_change ?? data.flow?.index_change)} 點</p></div> : null}{data.limitations.map((item, index) => <p key={index}>{item}</p>)}</div></details> : null}
  </section>
}

function UnitedStatesOverview() {
  return <div className="flex min-w-0 flex-col gap-2" aria-label="美股整體盤感">
    <h3 className="text-body font-medium text-ink">整體盤感</h3>
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
  const pulseQuery = useQuery({ queryKey: ["investment-pulse"], queryFn: ({ signal }) => getInvestmentPulse(signal), staleTime: 60_000, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false })
  async function refreshMarketData() {
    setRefreshing(true)
    setRefreshNotice("")
    const results = await Promise.all([
      client.fetchQuery({ queryKey: ["investment-market"], queryFn: () => getInvestmentMarket(undefined, true), staleTime: 0, retry: false }).then(() => null, () => "指數報價"),
      client.fetchQuery({ queryKey: ["investment-explore"], queryFn: () => getMarketExplore(undefined, true), staleTime: 0, retry: false }).then(() => null, () => "市場探索"),
      client.fetchQuery({ queryKey: ["investment-pulse"], queryFn: () => getInvestmentPulse(), staleTime: 0, retry: false }).then(() => null, () => "台股整體盤感"),
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
    <Card className="min-w-0 overflow-hidden p-4 shadow-sm sm:p-5">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-3">
        <div><SectionHeading>市場現在怎麼走</SectionHeading><p className="mt-1 text-caption text-ink-3">先看整體狀態，再看資金流向；各資料保留自己的日期和刷新狀態。</p></div>
        <div role="tablist" aria-label="市場" className="flex min-w-0 gap-3 border-b border-line-soft">
          {MARKETS.map(item => <Button key={item.key} id={`market-tab-${item.key}`} role="tab" aria-controls={`market-panel-${item.key}`} aria-selected={market === item.key} tabIndex={market === item.key ? 0 : -1} variant="link" className={`rounded-none border-b-2 px-0 py-2 text-body ${market === item.key ? "border-accent text-ink" : "border-transparent text-ink-3"}`} onClick={() => setMarket(item.key)} onKeyDown={selectByKey}>{item.label}</Button>)}
        </div>
        <Button disabled={refreshing} onClick={() => void refreshMarketData()}>{refreshing ? "更新中…" : "更新市場資料"}</Button>
      </div>
      {refreshNotice ? <p role="status" aria-live="polite" className="text-caption text-ink-3">{refreshNotice}</p> : null}
      <div id={`market-panel-${market}`} role="tabpanel" aria-labelledby={`market-tab-${market}`} className="flex min-w-0 flex-col gap-4 pt-4">
        {market === "tw" ? <TaiwanOverview data={pulseQuery.data} pending={pulseQuery.isPending} failed={pulseQuery.isError} readAt={pulseQuery.dataUpdatedAt ? new Date(pulseQuery.dataUpdatedAt).toISOString() : null} /> : <UnitedStatesOverview />}
        <QuoteContext market={market} data={quoteQuery.data} pending={quoteQuery.isPending} failed={quoteQuery.isError} />
        <div className="border-t border-line-soft pt-4"><MarketExplore market={market} embedded /></div>
      </div>
    </Card>
  </section>
}
