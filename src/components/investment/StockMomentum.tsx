import { useState } from "react"
import { useQueries, useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { SectionHeading } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { HOLDING_POLL_MS, IDLE_POLL_MS, SESSION_LABELS, getMomentumUniverse, getStockMomentum, getStockQuote, isRecentQuote, type StockMomentumData, type StockQuote } from "@/lib/investment"
import { formatNumber, quoteTime } from "@/lib/investmentFormat"
import { DEMO_MODE } from "@/lib/transport"

const NUM = new Intl.NumberFormat("zh-TW", {maximumFractionDigits: 2})
const MACD = {bullish_cross:"偏多交叉", bearish_cross:"偏空交叉", bullish:"偏多", bearish:"偏空", flat:"持平"}
function num(v: number | null | undefined, pct=false) { return v == null || !Number.isFinite(v) ? "—" : `${NUM.format(v)}${pct ? "%" : ""}` }

function Row({symbol, quote, data, busy, error}: {symbol: string; quote?: StockQuote; data?:StockMomentumData; busy:boolean; error:boolean}) {
  const [open,setOpen]=useState(false)
  const d=data?.daily
  const change=quote?.change_percent??null
  const tone=change===null?"text-ink-3":change>0?"text-ok":change<0?"text-bad":"text-ink-3"
  return <li className="border-b border-line-soft">
    <button type="button" onClick={()=>setOpen(!open)} aria-expanded={open} className="grid w-full grid-cols-[1fr_1fr_1fr_1fr] items-center gap-2 px-2 py-2 text-left text-label sm:grid-cols-[1fr_1fr_1fr_1fr_1fr] hover:bg-bg-2">
      <span className="flex flex-wrap items-center gap-1 font-semibold text-ink">{symbol}{quote?.session?<Chip tone={quote.session==="regular"?"ok":"mute"}>{SESSION_LABELS[quote.session]}</Chip>:null}</span>
      <span className="tabular-nums">{quote?.value!=null?formatNumber(quote.value):"—"}</span>
      <span className={`tabular-nums ${tone}`}>{change===null?"—":`${formatNumber(change,true)}%`}</span>
      <span className="tabular-nums">{num(d?.vs_50ma_pct,true)}</span>
      <span className="hidden tabular-nums sm:block">{num(d?.rsi14)}</span>
    </button>
    {open ? <div className="flex flex-col gap-2 bg-bg-2 p-3 text-caption text-ink-3">
      <p>報價時間：{quote?.quoted_at?quoteTime(quote.quoted_at):"未取得"}{quote?.state==="unavailable"&&quote.error?`（${quote.error}）`:""} · 最近完整收盤 {num(d?.last_close)}（{d?.as_of??"未取得"}）</p>
      <p>RSI：{num(d?.rsi14)} · MACD：{d?.macd?MACD[d.macd]:"—"} · 距一年高點：{num(d?.distance_high_pct,true)}</p>
      <p>一年收盤區間位置：{num(d?.range_252_position_pct,true)}（低 {num(d?.range_252_low)} · 高 {num(d?.range_252_high)}；0% 在區間底、100% 在區間頂）</p>
      {busy?<p>更新中…</p>:null}
      {error ? <p role="alert" className="text-warn">本次更新失敗；有數值時顯示的是先前資料。</p> : null}
      {d?.notes.map((n,i)=><p key={i}>{n}</p>)}
    </div>:null}
  </li>
}

export function StockMomentum() {
  const [all,setAll]=useState(false)
  const universe=useQuery({queryKey:["investment-momentum-universe"],queryFn:({signal})=>getMomentumUniverse(signal),staleTime:300_000,retry:false,refetchOnWindowFocus:false,refetchOnReconnect:false})
  const symbols=universe.data?.symbols??[]
  const visible=all?symbols:symbols.slice(0,8)
  const technicals=useQueries({queries:visible.map(symbol=>({queryKey:["investment-momentum",symbol],queryFn:({signal}:{signal:AbortSignal})=>getStockMomentum(symbol,signal),staleTime:300_000,retry:false,refetchOnWindowFocus:false,refetchOnReconnect:false}))})
  const quotes=useQueries({queries:visible.map(symbol=>({
    queryKey:["investment-quote",symbol],
    queryFn:({signal}:{signal:AbortSignal})=>getStockQuote(symbol,signal),
    staleTime:15_000,retry:false,refetchOnWindowFocus:true,refetchOnReconnect:true,
    refetchInterval:(q:{state:{data?:StockQuote}})=>DEMO_MODE?false:isRecentQuote(q.state.data?.quoted_at)?HOLDING_POLL_MS:IDLE_POLL_MS,
    refetchIntervalInBackground:false,
  }))})
  const failed=technicals.filter(q=>q.isError||q.data?.daily.state==="unavailable").length
  return <section className="flex min-w-0 flex-col gap-2" aria-label="我的持倉">
    <div className="flex flex-wrap items-baseline gap-2"><SectionHeading>我的持倉</SectionHeading><span className="text-caption text-ink-3">{DEMO_MODE ? "虛構標的與固定範例數字" : "最新價開著就每分鐘更新，休市每 5 分鐘確認"}</span></div>
    {universe.isError||universe.data?.state==="unavailable"?<p role="alert" className="text-body text-warn">股票清單暫時讀不到，請按上方「更新全部」。</p>:null}
    {failed>0?<p role="status" className="text-caption text-warn">{failed} 檔日線未取得或更新失敗；點開該列查看原因。</p>:null}
    <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-2 border-b border-line px-2 py-2 text-caption text-ink-3 sm:grid-cols-[1fr_1fr_1fr_1fr_1fr]"><span>個股</span><span>最新價</span><span>漲跌</span><span>距 50 日線</span><span className="hidden sm:block">RSI</span></div>
    <ul>{visible.map((symbol,i)=><Row key={symbol} symbol={symbol} quote={quotes[i].data} data={technicals[i].data} busy={technicals[i].isFetching||quotes[i].isFetching} error={technicals[i].isError||quotes[i].isError}/>)}</ul>
    {symbols.length>8?<div><Button onClick={()=>setAll(!all)}>{all?"收起其他持倉":`顯示其餘 ${symbols.length-8} 檔`}</Button></div>:null}
    <p className="text-micro text-ink-3">{universe.data?.note||"依帳上持倉市值排序。"}{!DEMO_MODE && "美股最新價含盤前盤後，台股只有盤中；漲跌都是較各自市場前一交易日收盤。距 50 日線與 RSI 用還原價、以各自市場最近一個完整收盤為止的日 K 計算（點開該列看是哪一天）。台股大盤型 ETF 不列在這裡——市場指標那排的台股大盤就是它們。"}</p>
  </section>
}
