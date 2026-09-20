import { useState } from "react"
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query"
import { DEMO_MODE } from "@/lib/transport"
import { Button } from "@/components/ui/button"
import { Card, SectionHeading } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { MarketIndicators } from "./MarketIndicators"
import { quoteTime } from "@/lib/investmentFormat"
import { StockMomentum } from "./StockMomentum"
import { ResearchWatch, ResearchLibrary } from "./ResearchWatch"
import { ReadingText, InlineText } from "./ReadingText"
import { InvestmentWorkPanel } from "./InvestmentWork"
import { PendingBoard } from "./InvestmentPending"
import { BRIEF_SESSION_LABELS, getInvestment, getInvestmentWatch, getInvestmentMarket, getInvestmentPending, getMomentumUniverse, getStockMomentum, getStockQuote, getInvestmentSource, getInvestmentWork, type InvestmentBrief, type InvestmentSource } from "@/lib/investment"

function SourceText({source}: {source: InvestmentSource}) {
  const [open,setOpen]=useState(false)
  const query=useQuery({queryKey:["investment-source",source.id,source.generated_at],queryFn:({signal})=>getInvestmentSource(source.id,signal),enabled:open,staleTime:0,retry:false,refetchOnWindowFocus:false})
  return <details onToggle={e=>setOpen(e.currentTarget.open)}><summary className="cursor-pointer text-body font-medium">閱讀完整簡報 · {source.date}</summary><div className="max-w-[900px] pt-3">{query.isPending?<p className="text-body text-ink-3">載入原文中…</p>:query.isError?<p role="alert" className="text-body text-warn">簡報原文讀取失敗，請按更新全部。</p>:query.data?<ReadingText text={query.data.text}/>:null}</div></details>
}

const ACTION_TONE: Record<string, "ok" | "warn" | "info" | "mute"> = {"不動":"mute","觀察":"info","補研究":"warn","需評估":"warn"}
function actionTone(today: string) { const hit=Object.keys(ACTION_TONE).find(k=>today.includes(k)); return hit?ACTION_TONE[hit]:"mute" }

/** The whole day's judgment in one block, in the order the brief itself argues it. */
function TodayBrief({b}: {b: InvestmentBrief}) {
  const version=b.session?BRIEF_SESSION_LABELS[b.session]??b.session:null
  const stale=b.state==="stale"
  // The brief names, per judgment and per risk, which event it came from, and the
  // reader resolves that to one event or to none. Show each row under its event
  // instead of repeating the same driver in three sections; a row that resolved
  // to nothing — including every row on a brief written before the column
  // existed — keeps its own section, exactly as before.
  const looseTheses=b.thesis_changes.filter(x=>x.event_index===null)
  const looseRisks=b.risks.filter(x=>x.event_index===null)
  return <section className="flex flex-col gap-4" aria-label="今日簡報">
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-2"><SectionHeading>今日簡報</SectionHeading><span className="text-caption text-ink-3">{b.date??"尚未收到"}{version?` · ${version}`:""}{b.generated_at?` · ${quoteTime(b.generated_at)} 產出`:""}{stale?" · 還沒收到今天的版本":""}</span></div>
      {b.headline?<ReadingText text={b.headline}/>:<p className="text-body text-warn">{b.state==="invalid"?"這份簡報部分格式無法辨識，仍可展開原文閱讀。":"本機尚無可讀簡報。"}</p>}
      {b.source?.limitations.length?<p role="status" className="text-caption text-warn">{b.source.limitations.join(" ")}</p>:null}
    </div>
    {b.actions.length?<div className="flex flex-col gap-2 rounded-lg border-l-2 border-accent bg-bg-3 p-3"><h3 className="text-num font-bold text-ink">今天怎麼做</h3><ReadingText text={b.actions.join("\n\n")}/></div>:null}
    {b.events.length>0||b.event_notes.length>0?<div className="flex flex-col gap-2"><h3 className="text-section font-semibold text-ink">市場在交易什麼</h3>
      {b.events.map((e,i)=><Card key={`${b.date}:${i}`} className="flex flex-col gap-2 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2"><p className="min-w-0 text-body font-medium leading-relaxed"><InlineText text={e.event}/></p><Chip tone={actionTone(e.today)}>{e.today}</Chip></div>
        <div className="text-body leading-relaxed text-ink-2"><span className="font-medium">對持倉：</span><InlineText text={e.impact}/></div>
        {b.thesis_changes.filter(x=>x.event_index===i).map((x,j)=><div key={`t${j}`} className="text-body leading-relaxed text-ink-2"><span className="font-medium">打到的判斷：</span><InlineText text={x.thesis}/> {x.change}<span className="text-ink-3"> — <InlineText text={x.reason}/></span></div>)}
        {b.risks.filter(x=>x.event_index===i).map((x,j)=><div key={`r${j}`} className="text-body leading-relaxed text-warn"><span className="font-medium">風險：</span><InlineText text={x.risk}/><span> — <InlineText text={x.status}/></span></div>)}
        <details><summary className="cursor-pointer text-caption text-ink-3">市場反應與解讀</summary><div className="flex flex-col gap-2 pt-2 text-body text-ink-2"><p><span className="font-medium">市場反應：</span><InlineText text={e.market_reaction}/></p><p><span className="font-medium">市場可能在定價：</span><InlineText text={e.interpretation}/></p></div></details>
      </Card>)}
      {b.event_notes.length?<ReadingText text={b.event_notes.join("\n\n")}/>:null}
    </div>:null}
    {looseTheses.length>0||b.thesis_notes.length>0?<div className="flex flex-col gap-1"><h3 className="text-section font-semibold text-ink">組合判斷</h3><ul className="flex flex-col gap-1">{looseTheses.map((t,i)=><li key={i} className="text-body text-ink-2"><span className="font-medium text-ink"><InlineText text={t.thesis}/></span> {t.change}<span className="text-ink-3"> — <InlineText text={t.reason}/></span></li>)}</ul>{b.thesis_notes.length?<ReadingText text={b.thesis_notes.join("\n\n")}/>:null}</div>:null}
    {looseRisks.length>0||b.risk_notes.length>0?<div className="flex flex-col gap-1"><h3 className="text-section font-semibold text-warn">風險警報</h3><ul className="flex flex-col gap-1">{looseRisks.map((r,i)=><li key={i} className="text-body text-ink-2"><span className="font-medium text-ink"><InlineText text={r.risk}/></span><span className="text-ink-3"> — <InlineText text={r.status}/></span></li>)}</ul>{b.risk_notes.length?<ReadingText text={b.risk_notes.join("\n\n")}/>:null}</div>:null}
    {b.source?<SourceText key={b.source.id} source={b.source}/>:null}
  </section>
}

export function InvestmentPage() {
  const [view,setView]=useState<"today"|"work"|"month">("today")
  const [refreshing,setRefreshing]=useState(false)
  const [notice,setNotice]=useState("")
  const client=useQueryClient()
  const fetching=useIsFetching({predicate:q=>String(q.queryKey[0]).startsWith("investment")})
  const query=useQuery({queryKey:["investment"],queryFn:({signal})=>getInvestment(signal),retry:false,refetchOnWindowFocus:true,staleTime:60_000})
  const watch=useQuery({queryKey:["investment-watch"],queryFn:({signal})=>getInvestmentWatch(signal),retry:false,refetchOnWindowFocus:false})
  const b=query.data?.brief
  async function refresh() {
    setRefreshing(true);setNotice("正在更新簡報、研究、持倉與市場行情…")
    const failures:string[]=[]
    async function run<T>(label:string, key:readonly unknown[], fn:()=>Promise<T>):Promise<T|undefined> {
      try {return await client.fetchQuery({queryKey:key,queryFn:fn,staleTime:0,retry:false})} catch {failures.push(label);return undefined}
    }
    try {
      const [brief,research,market,universe,,pending]=await Promise.all([
        run("簡報",["investment"],()=>getInvestment()),run("研究",["investment-watch"],()=>getInvestmentWatch()),
        run("市場行情",["investment-market"],()=>getInvestmentMarket(undefined,true)),run("股票清單",["investment-momentum-universe"],()=>getMomentumUniverse()),
        run("我自己記的事項",["investment-work"],()=>getInvestmentWork()),
        run("待處理掃描",["investment-pending"],()=>getInvestmentPending()),
      ])
      if (brief?.brief.state==="invalid"||brief?.brief.state==="missing") failures.push("簡報內容")
      if (research?.coverage.errors.length) failures.push("部分研究來源")
      if (brief?.brief.source?.limitations.length) failures.push("簡報部分段落")
      if (market?.state==="unavailable"||market?.state==="partial") failures.push("部分市場報價")
      // 三個來源各自有狀態；只報哪一個讀不到，不把整塊說成失敗。
      if (pending) failures.push(...([["對帳掃描",pending.revisit],["pending 閘門",pending.gate],["每週觀察",pending.weekly]] as const).filter(([,b])=>b.state==="unavailable").map(([label])=>label))
      if (universe?.state==="unavailable") failures.push("股票清單")
      if (universe?.state==="ready") {
        const results=await Promise.all(universe.symbols.map(s=>run(s,["investment-momentum",s],()=>getStockMomentum(s,undefined,true))))
        results.forEach((r,i)=>{if(r?.daily.state==="unavailable")failures.push(`${universe.symbols[i]} 日線`)})
        const quotes=await Promise.all(universe.symbols.map(s=>run(`${s} 最新價`,["investment-quote",s],()=>getStockQuote(s,undefined,true))))
        quotes.forEach((q,i)=>{if(q&&q.state!=="available")failures.push(`${universe.symbols[i]} 最新價`)})
      }
      await client.invalidateQueries({queryKey:["investment-source"],refetchType:"active"})
      if (client.getQueryCache().findAll({queryKey:["investment-source"],type:"active"}).some(q=>q.state.status==="error")) failures.push("簡報原文")
      const at=new Date().toLocaleTimeString("zh-TW",{hour12:false})
      setNotice(`${at} ${failures.length?`更新完成，仍有未取得項目：${[...new Set(failures)].join("、")}`:"更新完成"}。${brief?.brief.date?`本機最新簡報：${brief.brief.date}。`:""}簡報從本機讀取，不會重新生成報告。`)
    } finally {setRefreshing(false)}
  }
  return <div className="flex min-w-0 flex-col gap-4">
    <header className="flex items-start justify-between gap-3"><div className="flex flex-col gap-1"><h1 className="text-display font-bold text-ink">投資</h1><p className="text-caption text-ink-3">看今天的判斷，答到期的對帳，知道什麼時候要看什麼。{DEMO_MODE ? "此處展示固定的虛構案例。" : "行情開著就自動更新。"}</p></div><Button disabled={refreshing||fetching>0} onClick={()=>void refresh()}>{refreshing?"更新全部中…":fetching>0?"資料載入中…":"更新全部"}</Button></header>
    {notice?<p role="status" aria-live="polite" className="text-caption text-ink-3">{notice}</p>:null}
    <nav aria-label="投資內容" className="flex flex-wrap gap-2">{([['today','今天'],['work','待處理'],['month','什麼時候看什麼']] as const).map(([key,label])=><Button key={key} aria-pressed={view===key} variant={view===key?"selected":"ghost"} onClick={()=>setView(key)}>{label}</Button>)}</nav>
    <div hidden={view!=="today"} className={view==="today"?"flex min-w-0 flex-col gap-5":"hidden"}>
      {query.isError?<p role="alert" className="text-body text-warn">簡報讀取失敗。{b?"目前保留上次內容。":""}請按更新全部重試。</p>:null}
      {query.isPending?<p className="text-body text-ink-3">讀取簡報中…</p>:null}
      {b?<TodayBrief b={b}/>:null}
      <MarketIndicators/><StockMomentum/>
    </div>
    <div hidden={view!=="work"} className={view==="work"?"flex min-w-0 flex-col gap-5":"hidden"}>
      <PendingBoard/>
      <section className="flex min-w-0 flex-col gap-3" aria-label="我自己記的投資事項">
        <div className="flex flex-col gap-1"><SectionHeading>我自己記的</SectionHeading><p className="text-caption text-ink-3">你在看板上手記的問題與結論，只存在本機，跟上面系統掃出來的是兩回事。</p></div>
        <InvestmentWorkPanel research={watch.data?.research??[]}/>
      </section>
      {watch.data?<ResearchLibrary data={watch.data}/>:null}
    </div>
    <div hidden={view!=="month"} className={view==="month"?"flex flex-col gap-4":"hidden"}>{watch.data?<ResearchWatch data={watch.data} brief={b}/>:<p className="text-body text-ink-3">{watch.isError?"日期資料讀取失敗，請按更新全部。":"正在讀取重要日期…"}</p>}</div>
    {watch.isError?<p role="alert" className="text-body text-warn">研究與重要日期本次讀取失敗。{watch.data?"仍顯示上次內容。":""}</p>:null}
    <details className="border-t border-line-soft pt-3"><summary className="cursor-pointer text-caption text-ink-3">資料來源與讀取狀況{watch.data?.coverage.errors.length?` · ${watch.data.coverage.errors.length} 項異常`:""}</summary><div className="flex flex-col gap-2 pt-2 text-caption text-ink-3">
      <p>{DEMO_MODE ? "簡報、研究、日期與行情全由合成資料提供。更新全部只重讀範例，不連接帳戶或外部資料。" : "簡報、研究和日期讀取本機 investment_note；行情向 Yahoo Finance 查詢，分頁開著時自動更新。更新全部不會同步 Git 或重跑 AI 簡報。"}</p>
      <p>每週觀察：{query.data?.weekly_watch.date??"本機未找到"}。目前僅提供日期；不代表已做本週對帳。</p>
      <p>判準核對尚未接入；没有顯示警報不代表投資論點通過檢查。</p>
      {watch.data?<><p>已讀 {watch.data.coverage.scanned_files} 份相關來源；{watch.data.coverage.missing_catalysts.length} 份未填下次事件日期。未填日期不算讀取故障。</p>{watch.data.coverage.errors.map((e,i)=><p key={i}>{e.path}：{e.message}</p>)}{watch.data.coverage.omissions.length?<p>另有 {watch.data.coverage.omissions.length} 份相關來源未納入：{watch.data.coverage.omissions.slice(0,5).map(e=>`${e.path}（${e.reason}）`).join("、")}</p>:null}</>:null}
    </div></details>
  </div>
}
