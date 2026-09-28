import { useState } from "react"
import { useQueries, useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, SectionHeading } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { DEMO_MODE } from "@/lib/transport"
import {
  HOLDING_POLL_MS, IDLE_POLL_MS, SESSION_LABELS, getMomentumLeaders,
  getMomentumUniverse, getStockMomentum, getStockQuote, isRecentQuote,
  type MomentumLeader, type StockMomentumData, type StockQuote,
} from "@/lib/investment"
import { formatNumber, quoteTime } from "@/lib/investmentFormat"

import { TaiwanRsCell, TaiwanRsDetails, useTaiwanRs, type TaiwanRsProps } from "./TaiwanRs"

const NUM = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 })
const MACD = { bullish_cross: "偏多交叉", bearish_cross: "偏空交叉", bullish: "偏多", bearish: "偏空", flat: "持平" }
function num(value: number | null | undefined, pct = false) {
  return value == null || !Number.isFinite(value) ? "—" : `${NUM.format(value)}${pct ? "%" : ""}`
}
function metricTone(value: number | null | undefined) {
  return value == null ? "text-ink-3" : value > 0 ? "text-ok" : value < 0 ? "text-bad" : "text-ink-3"
}

function Row({ symbol, quote, data, busy, error, tw }: { tw: TaiwanRsProps; symbol: string; quote?: StockQuote; data?: StockMomentumData; busy: boolean; error: boolean }) {
  const [open, setOpen] = useState(false)
  const daily = data?.daily
  const change = quote?.change_percent ?? null
  const quoteStatus = quote?.state === "stale" ? "較早報價" : quote?.state === "unavailable" ? "報價未取得" : !quote && !busy ? "報價未取得" : null
  const dailyUnavailable = daily?.state === "unavailable"
  return <li className="min-w-0 border-b border-line-soft last:border-b-0">
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="grid w-full min-w-0 grid-cols-2 items-center gap-x-3 gap-y-2 px-3 py-3 text-left text-label hover:bg-bg-2 sm:grid-cols-7">
      <span className="flex min-w-0 flex-col gap-0.5 font-semibold text-ink"><span className="flex flex-wrap items-center gap-1">{symbol}{quote?.session ? <Chip tone="mute">{SESSION_LABELS[quote.session]}</Chip> : null}</span><span className="text-caption font-normal text-ink-3">{quote?.value != null ? `${formatNumber(quote.value)}${quote.unit ? ` ${quote.unit}` : ""}` : busy ? "讀取價格中…" : "價格未取得"}</span></span>
      <span className={`text-right tabular-nums sm:text-left ${metricTone(change)}`}>{change == null ? "—" : `${formatNumber(change, true)}%`}<span className="block text-micro font-normal text-ink-3 sm:hidden">漲跌</span></span>
      <span className={`tabular-nums ${metricTone(daily?.vs_5ma_pct)}`}><span className="text-caption text-ink-3 sm:hidden">距5日線 </span>{num(daily?.vs_5ma_pct, true)}</span>
      <span className={`tabular-nums ${metricTone(daily?.vs_20ma_pct)}`}><span className="text-caption text-ink-3 sm:hidden">距20日線 </span>{num(daily?.vs_20ma_pct, true)}</span>
      <span className={`tabular-nums ${metricTone(daily?.vs_50ma_pct)}`}><span className="text-caption text-ink-3 sm:hidden">距50日線 </span>{num(daily?.vs_50ma_pct, true)}</span>
      <span className="tabular-nums"><span className="text-caption text-ink-3 sm:hidden">RSI </span>{num(daily?.rsi14)}</span>
      <span className="col-span-2 sm:col-span-1">{/\.(TW|TWO)$/.test(symbol) ? <TaiwanRsCell {...tw} /> : <span className="text-caption text-ink-3">未提供</span>}</span>
      {error || quoteStatus || dailyUnavailable ? <span role="status" className="col-span-2 text-caption text-warn sm:col-span-7">{[error ? "本次更新失敗，已有數值為先前資料" : null, quoteStatus, dailyUnavailable ? "日線未取得" : null].filter(Boolean).join(" · ")}</span> : null}
    </button>
    {open ? <div className="flex flex-col gap-2 border-t border-line-soft bg-bg-2 px-3 py-3 text-caption text-ink-3">
      <p>報價時間：{quote?.quoted_at ? quoteTime(quote.quoted_at) : "未取得"} · 最近完整收盤 {num(daily?.last_close)}（{daily?.as_of ?? "未取得"}）</p>
      <p>20 日報酬：{num(daily?.return_20d_pct, true)} · 距 5／20／50 日線：{num(daily?.vs_5ma_pct, true)} ／ {num(daily?.vs_20ma_pct, true)} ／ {num(daily?.vs_50ma_pct, true)}</p>
      <p>RSI：{num(daily?.rsi14)} · MACD：{daily?.macd ? MACD[daily.macd] : "—"} · 距一年高點：{num(daily?.distance_high_pct, true)}</p>
      <p>一年收盤區間位置：{num(daily?.range_252_position_pct, true)}（低 {num(daily?.range_252_low)} · 高 {num(daily?.range_252_high)}）</p>
      {/\.(TW|TWO)$/.test(symbol) ? <TaiwanRsDetails {...tw} /> : null}
      {busy ? <p>更新中…</p> : null}
      {daily?.notes.map((note, index) => <p key={index}>{note}</p>)}
    </div> : null}
  </li>
}

function LeadersTable({ leaders }: { leaders: MomentumLeader[] }) {
  return <div>
    <div className="hidden overflow-x-auto sm:block"><div className="grid min-w-[560px] grid-cols-[44px_1.3fr_repeat(4,1fr)] gap-2 border-b border-line px-3 py-2 text-caption text-ink-3"><span>排名</span><span>標的</span><span>20日報酬</span><span>距5日線</span><span>距20日線</span><span>距50日線</span></div>
      <ol className="min-w-[560px]">{leaders.map(row => <li key={row.symbol} className="grid grid-cols-[44px_1.3fr_repeat(4,1fr)] gap-2 border-b border-line-soft px-3 py-3 text-label last:border-b-0">
        <span className="font-semibold text-accent">{row.rank}</span><span className="flex flex-col"><span className="font-semibold text-ink">{row.symbol}</span><span className="text-caption text-ink-3">RSI {num(row.rsi14)} · {row.macd ? MACD[row.macd] : "未取得"}{row.state !== "ready" ? " · 資料不完整" : ""}</span></span>
        <span className={`tabular-nums ${metricTone(row.return_20d_pct)}`}>{num(row.return_20d_pct, true)}</span><span className={`tabular-nums ${metricTone(row.vs_5ma_pct)}`}>{num(row.vs_5ma_pct, true)}</span><span className={`tabular-nums ${metricTone(row.vs_20ma_pct)}`}>{num(row.vs_20ma_pct, true)}</span><span className={`tabular-nums ${metricTone(row.vs_50ma_pct)}`}>{num(row.vs_50ma_pct, true)}</span>
      </li>)}</ol>
    </div>
    <ol className="sm:hidden">{leaders.map(row => <li key={row.symbol} className="grid grid-cols-[28px_minmax(0,1fr)_auto] gap-x-2 gap-y-1 border-b border-line-soft px-3 py-3 text-label last:border-b-0">
      <span className="font-semibold text-accent">{row.rank}</span><span className="flex flex-col"><span className="font-semibold text-ink">{row.symbol}</span><span className="text-caption text-ink-3">RSI {num(row.rsi14)} · {row.macd ? MACD[row.macd] : "未取得"}{row.state !== "ready" ? " · 資料不完整" : ""}</span></span><span className={`tabular-nums ${metricTone(row.return_20d_pct)}`}>{num(row.return_20d_pct, true)}<span className="block text-micro text-ink-3">20日</span></span>
      <span className="col-span-3 text-caption text-ink-3">均線位置：<span className={metricTone(row.vs_5ma_pct)}>5日 {num(row.vs_5ma_pct, true)}</span> · <span className={metricTone(row.vs_20ma_pct)}>20日 {num(row.vs_20ma_pct, true)}</span> · <span className={metricTone(row.vs_50ma_pct)}>50日 {num(row.vs_50ma_pct, true)}</span></span>
    </li>)}</ol>
  </div>
}

function MomentumLeaders() {
  const [open, setOpen] = useState(false)
  const query = useQuery({ queryKey: ["investment-momentum-leaders"], queryFn: ({ signal }) => getMomentumLeaders(signal), enabled: open, staleTime: 300_000, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false })
  return <details className="border-t border-line-soft" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer px-3 py-3 text-body font-medium">清單內的相對強弱 · 20日排序</summary>
    <p className="px-3 pb-3 text-caption text-ink-3">只比較已登記的持倉與觀察清單，不代表全市場，也不是買賣建議。</p>
    {query.isPending ? <p className="px-3 py-4 text-body text-ink-3">整理最近完整日線中…</p> : null}
    {query.isError ? <p role="alert" className="px-3 py-4 text-body text-warn">清單動能讀取失敗。{query.data ? "下方保留上次資料。" : ""}請按上方更新資料。</p> : null}
    {query.data?.state === "unavailable" && !query.isError ? <p role="status" className="px-3 py-3 text-body text-warn">清單動能暫時無法取得。</p> : null}
    {query.data?.state === "partial" ? <p role="status" className="px-3 py-2 text-caption text-warn">部分日線不足，排序只涵蓋可讀資料。</p> : null}
    {query.data?.leaders.length ? <LeadersTable leaders={query.data.leaders} /> : null}
    {!query.isError && query.data?.state === "ready" && !query.data.leaders.length ? <p className="px-3 py-4 text-body text-ink-3">這份清單沒有可比較的標的。</p> : null}
    {query.data ? <p className="border-t border-line-soft px-3 py-3 text-micro text-ink-3">{query.data.note} 最近完整日線：{query.data.as_of ?? "未取得"}。可排序 {query.data.coverage.scored_count}/{query.data.coverage.candidate_count} 檔{query.data.coverage.unavailable_count ? `，${query.data.coverage.unavailable_count} 檔資料不足` : ""}。</p> : null}
  </details>
}

export function StockMomentum() {
  const [all, setAll] = useState(false)
  const twQuery = useTaiwanRs()
  const universe = useQuery({ queryKey: ["investment-momentum-universe"], queryFn: ({ signal }) => getMomentumUniverse(signal), staleTime: 300_000, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false })
  const symbols = universe.data?.symbols ?? []
  const visible = all ? symbols : symbols.slice(0, 8)
  const technicals = useQueries({ queries: visible.map(symbol => ({ queryKey: ["investment-momentum", symbol], queryFn: ({ signal }: { signal: AbortSignal }) => getStockMomentum(symbol, signal), staleTime: 300_000, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false })) })
  const quotes = useQueries({ queries: visible.map(symbol => ({ queryKey: ["investment-quote", symbol], queryFn: ({ signal }: { signal: AbortSignal }) => getStockQuote(symbol, signal), staleTime: 15_000, retry: false, refetchOnWindowFocus: true, refetchOnReconnect: true, refetchInterval: (query: { state: { data?: StockQuote } }) => DEMO_MODE ? false : isRecentQuote(query.state.data?.quoted_at) ? HOLDING_POLL_MS : IDLE_POLL_MS, refetchIntervalInBackground: false })) })
  const failed = technicals.filter(query => query.isError || query.data?.daily.state === "unavailable").length
  return <section className="flex min-w-0 flex-col gap-4" aria-label="持倉行情與動能">
    <Card className="min-w-0 overflow-hidden shadow-sm"><div className="flex flex-wrap items-baseline gap-2 border-b border-line-soft bg-bg-2 px-3 py-3 sm:px-4"><SectionHeading>我的持倉</SectionHeading><span className="text-caption text-ink-3">行情與均線位置</span></div>
      <div className="hidden grid-cols-7 gap-x-3 border-b border-line px-3 py-2 text-caption text-ink-3 sm:grid"><span>個股／價格</span><span>漲跌</span><span>距5日線</span><span>距20日線</span><span>距50日線</span><span>RSI</span><span>相對強度<span className="block text-micro">依各列基準與日期</span></span></div>
      {universe.isPending ? <p className="px-3 py-4 text-body text-ink-3">讀取持倉中…</p> : null}
      {universe.isError || universe.data?.state === "unavailable" ? <p role="alert" className="px-3 py-4 text-body text-warn">股票清單暫時讀不到。{symbols.length ? "下方保留上次清單。" : ""}請按上方更新資料。</p> : null}
      {!universe.isError && universe.data?.state === "ready" && symbols.length === 0 ? <p className="px-3 py-4 text-body text-ink-3">這份來源沒有列出持倉。</p> : null}
      {failed > 0 ? <p role="status" className="px-3 py-2 text-caption text-warn">{failed} 檔日線未取得或更新失敗。</p> : null}
      <ul>{visible.map((symbol, index) => <Row key={symbol} tw={{ symbol, data: twQuery.data, pending: twQuery.isPending, failed: twQuery.isError }} symbol={symbol} quote={quotes[index]?.data} data={technicals[index]?.data} busy={technicals[index]?.isFetching || quotes[index]?.isFetching} error={technicals[index]?.isError || quotes[index]?.isError} />)}</ul>
      {symbols.length > 8 ? <div className="border-t border-line-soft px-3 py-3"><Button onClick={() => setAll(!all)}>{all ? "收起其他持倉" : `顯示其餘 ${symbols.length - 8} 檔`}</Button></div> : null}
      <details className="border-t border-line-soft px-3 py-2 text-caption text-ink-3"><summary className="cursor-pointer py-1">報價與指標口徑</summary><p className="py-2">{universe.data?.note || "股票清單來源尚未提供說明。"}{!DEMO_MODE && " 美股最新價含盤前盤後，台股只有盤中；均線與 RSI 使用各自市場最近完整收盤的還原價計算。"}報價與日線的時間可能不同，點開個股可查看。</p></details>
      <MomentumLeaders />
    </Card>
  </section>
}
