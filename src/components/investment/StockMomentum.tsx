import { useState } from "react"
import { useQueries, useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, SectionHeading } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { DEMO_MODE } from "@/lib/transport"
import {
  HOLDING_POLL_MS,
  IDLE_POLL_MS,
  SESSION_LABELS,
  getMomentumLeaders,
  getMomentumUniverse,
  getStockMomentum,
  getStockQuote,
  isRecentQuote,
  type MomentumLeader,
  type StockMomentumData,
  type StockQuote,
} from "@/lib/investment"
import { formatNumber, quoteTime } from "@/lib/investmentFormat"

const NUM = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 })
const MACD = { bullish_cross: "偏多交叉", bearish_cross: "偏空交叉", bullish: "偏多", bearish: "偏空", flat: "持平" }
function num(v: number | null | undefined, pct = false) {
  return v == null || !Number.isFinite(v) ? "—" : `${NUM.format(v)}${pct ? "%" : ""}`
}
function metricTone(value: number | null | undefined) {
  return value == null ? "text-ink-3" : value > 0 ? "text-ok" : value < 0 ? "text-bad" : "text-ink-3"
}

function Row({ symbol, quote, data, busy, error }: { symbol: string; quote?: StockQuote; data?: StockMomentumData; busy: boolean; error: boolean }) {
  const [open, setOpen] = useState(false)
  const d = data?.daily
  const change = quote?.change_percent ?? null
  return <li className="border-b border-line-soft last:border-b-0">
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="grid w-full grid-cols-2 items-center gap-x-3 gap-y-1 px-3 py-3 text-left text-label hover:bg-bg-2 sm:grid-cols-6">
      <span className="flex min-w-0 flex-col gap-0.5 font-semibold text-ink"><span className="flex flex-wrap items-center gap-1">{symbol}{quote?.session ? <Chip tone={quote.session === "regular" ? "ok" : "mute"}>{SESSION_LABELS[quote.session]}</Chip> : null}</span><span className="text-caption font-normal text-ink-3">{quote?.value != null ? formatNumber(quote.value) : "價格未取得"}</span></span>
      <span className={`tabular-nums ${metricTone(change)}`}>{change == null ? "—" : `${formatNumber(change, true)}%`}</span>
      <span className={`tabular-nums ${metricTone(d?.vs_5ma_pct)}`}><span className="sm:hidden">5日線 </span>{num(d?.vs_5ma_pct, true)}</span>
      <span className={`tabular-nums ${metricTone(d?.vs_20ma_pct)}`}><span className="sm:hidden">20日線 </span>{num(d?.vs_20ma_pct, true)}</span>
      <span className={`tabular-nums ${metricTone(d?.vs_50ma_pct)}`}><span className="sm:hidden">50日線 </span>{num(d?.vs_50ma_pct, true)}</span>
      <span className="tabular-nums"><span className="sm:hidden">RSI </span>{num(d?.rsi14)}</span>
    </button>
    {open ? <div className="flex flex-col gap-2 border-t border-line-soft bg-bg-2 px-3 py-3 text-caption text-ink-3">
      <p>報價時間：{quote?.quoted_at ? quoteTime(quote.quoted_at) : "未取得"}{quote?.state === "unavailable" && quote.error ? `（${quote.error}）` : ""} · 最近完整收盤 {num(d?.last_close)}（{d?.as_of ?? "未取得"}）</p>
      <p>20 日報酬：{num(d?.return_20d_pct, true)} · 距 5／20／50 日線：{num(d?.vs_5ma_pct, true)} ／ {num(d?.vs_20ma_pct, true)} ／ {num(d?.vs_50ma_pct, true)}</p>
      <p>RSI：{num(d?.rsi14)} · MACD：{d?.macd ? MACD[d.macd] : "—"} · 距一年高點：{num(d?.distance_high_pct, true)}</p>
      <p>一年收盤區間位置：{num(d?.range_252_position_pct, true)}（低 {num(d?.range_252_low)} · 高 {num(d?.range_252_high)}）</p>
      {busy ? <p>更新中…</p> : null}
      {error ? <p role="alert" className="text-warn">本次更新失敗；有數值時顯示的是先前資料。</p> : null}
      {d?.notes.map((note, index) => <p key={index}>{note}</p>)}
    </div> : null}
  </li>
}

function LeadersTable({ leaders }: { leaders: MomentumLeader[] }) {
  return <div>
    <div className="hidden overflow-x-auto sm:block"><div className="grid min-w-[560px] grid-cols-[44px_1.3fr_repeat(4,1fr)] gap-2 border-b border-line px-3 py-2 text-caption text-ink-3"><span>排名</span><span>標的</span><span>20日報酬</span><span>距5日線</span><span>距20日線</span><span>距50日線</span></div>
    <ol className="min-w-[560px]">{leaders.map((row) => <li key={row.symbol} className="grid grid-cols-[44px_1.3fr_repeat(4,1fr)] gap-2 border-b border-line-soft px-3 py-3 text-label last:border-b-0">
      <span className="font-semibold text-accent">{row.rank}</span><span className="flex flex-col"><span className="font-semibold text-ink">{row.symbol}</span><span className="text-caption text-ink-3">RSI {num(row.rsi14)} · {row.macd ? MACD[row.macd] : "未取得"}</span></span>
      <span className={`tabular-nums ${metricTone(row.return_20d_pct)}`}>{num(row.return_20d_pct, true)}</span><span className={`tabular-nums ${metricTone(row.vs_5ma_pct)}`}>{num(row.vs_5ma_pct, true)}</span><span className={`tabular-nums ${metricTone(row.vs_20ma_pct)}`}>{num(row.vs_20ma_pct, true)}</span><span className={`tabular-nums ${metricTone(row.vs_50ma_pct)}`}>{num(row.vs_50ma_pct, true)}</span>
    </li>)}</ol></div>
    <ol className="sm:hidden">{leaders.map((row) => <li key={row.symbol} className="grid grid-cols-[28px_1fr_auto] gap-x-2 gap-y-1 border-b border-line-soft px-3 py-3 text-label last:border-b-0">
      <span className="font-semibold text-accent">{row.rank}</span><span className="flex flex-col"><span className="font-semibold text-ink">{row.symbol}</span><span className="text-caption text-ink-3">RSI {num(row.rsi14)} · {row.macd ? MACD[row.macd] : "未取得"}</span></span><span className={`tabular-nums ${metricTone(row.return_20d_pct)}`}>{num(row.return_20d_pct, true)}<span className="block text-micro text-ink-3">20日</span></span>
      <span className="col-span-2 text-caption text-ink-3">均線位置：<span className={metricTone(row.vs_5ma_pct)}>5日 {num(row.vs_5ma_pct, true)}</span> · <span className={metricTone(row.vs_20ma_pct)}>20日 {num(row.vs_20ma_pct, true)}</span> · <span className={metricTone(row.vs_50ma_pct)}>50日 {num(row.vs_50ma_pct, true)}</span></span>
    </li>)}</ol>
  </div>
}

function MomentumLeaders() {
  const query = useQuery({ queryKey: ["investment-momentum-leaders"], queryFn: ({ signal }) => getMomentumLeaders(signal), staleTime: 300_000, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false })
  return <Card className="overflow-hidden border-l-4 border-l-accent shadow-sm">
    <div className="flex flex-col gap-1 bg-bg-2 px-3 py-3 sm:px-4"><div className="flex flex-wrap items-baseline gap-2"><SectionHeading>近期動能強勢股</SectionHeading><Chip tone="accent">20日排序</Chip></div><p className="text-caption text-ink-3">只在已登記的持倉與 watchlist 中找；不是全市場推薦，也不會改動投資帳。</p></div>
    {query.isPending ? <p className="px-3 py-4 text-body text-ink-3">整理最近完整日線中…</p> : null}
    {query.isError ? <p role="alert" className="px-3 py-4 text-body text-warn">近期動能資料讀取失敗，請按上方更新資料。</p> : null}
    {query.data?.leaders.length ? <LeadersTable leaders={query.data.leaders} /> : null}
    {query.data && !query.data.leaders.length ? <p className="px-3 py-4 text-body text-ink-3">目前沒有足夠完整日線，暫不把標的稱為強勢。</p> : null}
    {query.data ? <p className="border-t border-line-soft px-3 py-3 text-micro text-ink-3">{query.data.note} 最近完整日線：{query.data.as_of ?? "未取得"}。可排序 {query.data.coverage.scored_count}/{query.data.coverage.candidate_count} 檔{query.data.coverage.unavailable_count ? `，${query.data.coverage.unavailable_count} 檔資料不足` : ""}。</p> : null}
  </Card>
}

export function StockMomentum() {
  const [all, setAll] = useState(false)
  const universe = useQuery({ queryKey: ["investment-momentum-universe"], queryFn: ({ signal }) => getMomentumUniverse(signal), staleTime: 300_000, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false })
  const symbols = universe.data?.symbols ?? []
  const visible = all ? symbols : symbols.slice(0, 8)
  const technicals = useQueries({ queries: visible.map((symbol) => ({ queryKey: ["investment-momentum", symbol], queryFn: ({ signal }: { signal: AbortSignal }) => getStockMomentum(symbol, signal), staleTime: 300_000, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false })) })
  const quotes = useQueries({ queries: visible.map((symbol) => ({ queryKey: ["investment-quote", symbol], queryFn: ({ signal }: { signal: AbortSignal }) => getStockQuote(symbol, signal), staleTime: 15_000, retry: false, refetchOnWindowFocus: true, refetchOnReconnect: true, refetchInterval: (q: { state: { data?: StockQuote } }) => DEMO_MODE ? false : isRecentQuote(q.state.data?.quoted_at) ? HOLDING_POLL_MS : IDLE_POLL_MS, refetchIntervalInBackground: false })) })
  const failed = technicals.filter((query) => query.isError || query.data?.daily.state === "unavailable").length
  return <section className="flex min-w-0 flex-col gap-4" aria-label="投資動能">
    <Card className="min-w-0 overflow-hidden shadow-sm"><div className="flex flex-wrap items-baseline gap-2 border-b border-line-soft bg-bg-2 px-3 py-3 sm:px-4"><SectionHeading>我的持倉</SectionHeading><span className="text-caption text-ink-3">5／20／50 日線位置與 RSI</span></div>
      <div className="grid grid-cols-2 gap-x-3 border-b border-line px-3 py-2 text-caption text-ink-3 sm:grid-cols-6"><span>個股／價格</span><span>漲跌</span><span>距 5 日線</span><span>距 20 日線</span><span>距 50 日線</span><span>RSI</span></div>
      {universe.isError || universe.data?.state === "unavailable" ? <p role="alert" className="px-3 py-4 text-body text-warn">股票清單暫時讀不到，請按上方更新資料。</p> : null}
      {failed > 0 ? <p role="status" className="px-3 py-2 text-caption text-warn">{failed} 檔日線未取得或更新失敗；點開該列查看原因。</p> : null}
      <ul>{visible.map((symbol, index) => <Row key={symbol} symbol={symbol} quote={quotes[index]?.data} data={technicals[index]?.data} busy={technicals[index]?.isFetching || quotes[index]?.isFetching} error={technicals[index]?.isError || quotes[index]?.isError} />)}</ul>
      {symbols.length > 8 ? <div className="border-t border-line-soft px-3 py-3"><Button onClick={() => setAll(!all)}>{all ? "收起其他持倉" : `顯示其餘 ${symbols.length - 8} 檔`}</Button></div> : null}
      <p className="border-t border-line-soft px-3 py-3 text-micro text-ink-3">{universe.data?.note || "依帳上持倉市值排序。"}{!DEMO_MODE && " 美股最新價含盤前盤後，台股只有盤中；均線與 RSI 使用各自市場最近完整收盤的還原價計算。"}</p>
    </Card>
    <MomentumLeaders />
  </section>
}
