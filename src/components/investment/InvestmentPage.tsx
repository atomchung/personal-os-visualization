import { useState } from "react"
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query"
import { DEMO_MODE } from "@/lib/transport"
import { Button } from "@/components/ui/button"
import { Card, SectionHeading } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { MarketIndicators } from "./MarketIndicators"
import { quoteTime } from "@/lib/investmentFormat"
import { briefOverviewActions, isBriefEventReference } from "@/lib/investmentBriefPresentation"
import { StockMomentum } from "./StockMomentum"
import { ResearchWatch, ResearchLibrary } from "./ResearchWatch"
import { ReadingText, InlineText } from "./ReadingText"
import { InvestmentWorkPanel } from "./InvestmentWork"
import { PendingBoard } from "./InvestmentPending"
import { BRIEF_SESSION_LABELS, getInvestment, getInvestmentWatch, getInvestmentMarket, getInvestmentPending, getMomentumUniverse, getStockMomentum, getStockQuote, getInvestmentSource, getInvestmentWork, type InvestmentBrief, type InvestmentSource } from "@/lib/investment"

function SourceText({source}: {source: InvestmentSource}) {
  const [open,setOpen]=useState(false)
  const query=useQuery({queryKey:["investment-source",source.id,source.generated_at],queryFn:({signal})=>getInvestmentSource(source.id,signal),enabled:open,staleTime:0,retry:false,refetchOnWindowFocus:false})
  return <details onToggle={e=>setOpen(e.currentTarget.open)}><summary className="cursor-pointer text-caption text-ink-3">閱讀簡報原文</summary><div className="max-w-[900px] pt-3">{query.isPending?<p className="text-body text-ink-3">載入原文中…</p>:query.isError?<p role="alert" className="text-body text-warn">簡報原文讀取失敗，請按更新全部。</p>:query.data?<ReadingText text={query.data.text}/>:null}</div></details>
}

const ACTION_TONE: Record<string, "ok" | "warn" | "info" | "mute"> = {"不動":"mute","觀察":"info","補研究":"warn","需評估":"warn"}
function actionTone(today: string) { const hit=Object.keys(ACTION_TONE).find(k=>today.includes(k)); return hit?ACTION_TONE[hit]:"mute" }

/** One overview, then event evidence. Original judgments remain available verbatim. */
function TodayBrief({b}: {b: InvestmentBrief}) {
  const version=b.session?BRIEF_SESSION_LABELS[b.session]??b.session:null
  const actions=briefOverviewActions(b.actions,b.headline)
  // A broken reference is not permission to discard a judgment or a risk.
  const looseTheses=b.thesis_changes.filter(x=>!isBriefEventReference(x.event_index,b.events.length))
  const looseRisks=b.risks.filter(x=>!isBriefEventReference(x.event_index,b.events.length))
  const hasOtherTheses=looseTheses.length>0||b.thesis_notes.length>0
  const hasOtherRisks=looseRisks.length>0||b.risk_notes.length>0

  return <section className="flex min-w-0 flex-col gap-5" aria-label="今日簡報">
    <Card className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-section font-bold text-ink">今日重點</h2>
        <p className="text-caption text-ink-3">{b.date??"尚未收到簡報"}{version?` · ${version}`:""}{b.generated_at?` · ${quoteTime(b.generated_at)} 產出`:""}</p>
      </div>
      {b.headline?<ReadingText text={b.headline}/>:<p className="text-body text-warn">{b.state==="invalid"?"這份簡報部分格式無法辨識，仍可展開原文閱讀。":"尚未取得可讀簡報。"}</p>}
      {actions.length>0?<div className="flex flex-col gap-2 border-t border-line-soft pt-3">
        <h3 className="text-body font-semibold text-ink">接下來</h3>
        <ul className="flex list-disc flex-col gap-2 pl-4 text-body leading-relaxed text-ink-2">{actions.map((action,i)=><li key={i}><InlineText text={action}/></li>)}</ul>
      </div>:null}
      {b.state==="stale"?<p role="status" className="text-caption text-warn">尚未收到今天的版本，目前顯示上次簡報。</p>:null}
      {b.state==="invalid"&&b.headline?<p role="status" className="text-caption text-warn">部分格式無法辨識，請一併查看原文。</p>:null}
      {b.source?.limitations.length?<p role="status" className="text-caption text-warn">{b.source.limitations.join(" ")}</p>:null}
    </Card>

    {b.events.length>0||b.event_notes.length>0?<section className="flex min-w-0 flex-col gap-3" aria-label="市場變化與持倉影響">
      <h2 className="text-section font-bold text-ink">市場變化與持倉影響</h2>
      {b.events.map((e,i)=><Card key={`${b.date}:${i}`} className="flex min-w-0 flex-col gap-3 p-4">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <h3 className="min-w-0 break-words text-body font-semibold leading-relaxed text-ink"><InlineText text={e.event}/></h3>
          {e.today.trim()?<Chip tone={actionTone(e.today)}>{e.today}</Chip>:null}
        </div>
        <div className="text-body leading-relaxed text-ink-2"><span className="font-medium">對持倉：</span><InlineText text={e.impact}/></div>
        {b.thesis_changes.filter(x=>x.event_index===i).map((x,j)=><div key={`t${j}`} className="text-body leading-relaxed text-ink-2"><span className="font-medium">相關判斷：</span><InlineText text={x.thesis}/> {x.change}<span className="text-ink-3"> — <InlineText text={x.reason}/></span></div>)}
        {b.risks.filter(x=>x.event_index===i).map((x,j)=><div key={`r${j}`} className="text-body leading-relaxed text-warn"><span className="font-medium">風險：</span><InlineText text={x.risk}/><span> — <InlineText text={x.status}/></span></div>)}
        {e.market_reaction.trim()||e.interpretation.trim()?<details className="border-t border-line-soft pt-2">
          <summary className="cursor-pointer text-caption text-ink-3">查看市場反應與解讀</summary>
          <div className="flex flex-col gap-2 pt-2 text-body text-ink-2">
            {e.market_reaction.trim()?<p><span className="font-medium">市場反應：</span><InlineText text={e.market_reaction}/></p>:null}
            {e.interpretation.trim()?<p><span className="font-medium">市場解讀：</span><InlineText text={e.interpretation}/></p>:null}
          </div>
        </details>:null}
      </Card>)}
      {b.event_notes.length?<ReadingText text={b.event_notes.join("\n\n")}/>:null}
    </section>:null}

    {hasOtherTheses||hasOtherRisks?<section className="flex min-w-0 flex-col gap-3" aria-label="其他判斷與風險">
      <h2 className="text-section font-bold text-ink">其他判斷與風險</h2>
      <Card className="flex min-w-0 flex-col gap-4 p-4">
        {hasOtherTheses?<div className="flex flex-col gap-2">
          <h3 className="text-body font-semibold text-ink">組合判斷</h3>
          <ul className="flex flex-col gap-2">{looseTheses.map((t,i)=><li key={i} className="text-body text-ink-2"><span className="font-medium text-ink"><InlineText text={t.thesis}/></span> {t.change}<span className="text-ink-3"> — <InlineText text={t.reason}/></span></li>)}</ul>
          {b.thesis_notes.length?<ReadingText text={b.thesis_notes.join("\n\n")}/>:null}
        </div>:null}
        {hasOtherRisks?<div className={`flex flex-col gap-2${hasOtherTheses?" border-t border-line-soft pt-3":""}`}>
          <h3 className="text-body font-semibold text-warn">仍需留意的風險</h3>
          <ul className="flex flex-col gap-2">{looseRisks.map((r,i)=><li key={i} className="text-body text-ink-2"><span className="font-medium text-ink"><InlineText text={r.risk}/></span><span className="text-ink-3"> — <InlineText text={r.status}/></span></li>)}</ul>
          {b.risk_notes.length?<ReadingText text={b.risk_notes.join("\n\n")}/>:null}
        </div>:null}
      </Card>
    </section>:null}
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
        run("我的投資事項",["investment-work"],()=>getInvestmentWork()),
        run("系統提醒",["investment-pending"],()=>getInvestmentPending()),
      ])
      if (brief?.brief.state==="invalid"||brief?.brief.state==="missing") failures.push("簡報內容")
      if (research?.coverage.errors.length) failures.push("部分研究來源")
      if (brief?.brief.source?.limitations.length) failures.push("簡報部分段落")
      if (market?.state==="unavailable"||market?.state==="partial") failures.push("部分市場報價")
      // 三個來源各自有狀態；只報哪一個讀不到，不把整塊說成失敗。
      if (pending) failures.push(...([["舊判斷回看",pending.revisit],["待確認事項",pending.gate],["每週觀察",pending.weekly]] as const).filter(([,b])=>b.state==="unavailable").map(([label])=>label))
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
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-display font-bold text-ink">投資</h1><Button disabled={refreshing||fetching>0} onClick={()=>void refresh()}>{refreshing?"更新全部中…":fetching>0?"資料載入中…":"更新全部"}</Button></header>
    {notice?<p role="status" aria-live="polite" className="text-caption text-ink-3">{notice}</p>:null}
    <nav aria-label="投資內容" className="flex flex-wrap gap-2">{([['today','今日'],['work','待處理'],['month','什麼時候看什麼']] as const).map(([key,label])=><Button key={key} aria-pressed={view===key} variant={view===key?"selected":"ghost"} onClick={()=>setView(key)}>{label}</Button>)}</nav>
    <div hidden={view!=="today"} className={view==="today"?"flex min-w-0 flex-col gap-5":"hidden"}>
      {query.isError?<p role="alert" className="text-body text-warn">簡報讀取失敗。{b?"目前保留上次內容。":""}請按更新全部重試。</p>:null}
      {query.isPending?<p className="text-body text-ink-3">讀取簡報中…</p>:null}
      {b?<TodayBrief b={b}/>:null}
      <MarketIndicators/><StockMomentum/>
    </div>
    <div hidden={view!=="work"} className={view==="work"?"flex min-w-0 flex-col gap-5":"hidden"}>
      <section className="flex min-w-0 flex-col gap-3" aria-label="我留下的問題與研究">
        <div className="flex flex-col gap-1"><SectionHeading>我留下的問題與研究</SectionHeading><p className="text-caption text-ink-3">你在看板上留下的問題、研究與結論，只存在本機；系統整理的提醒另列在下方。</p></div>
        <InvestmentWorkPanel research={watch.data?.research??[]}/>
      </section>
      {watch.data?<ResearchLibrary data={watch.data}/>:null}
      <PendingBoard/>
    </div>
    <div hidden={view!=="month"} className={view==="month"?"flex flex-col gap-4":"hidden"}>{watch.data?<ResearchWatch data={watch.data} brief={b}/>:<p className="text-body text-ink-3">{watch.isError?"日期資料讀取失敗，請按更新全部。":"正在讀取重要日期…"}</p>}</div>
    {watch.isError?<p role="alert" className="text-body text-warn">研究與重要日期本次讀取失敗。{watch.data?"仍顯示上次內容。":""}</p>:null}
    <details className="border-t border-line-soft pt-3"><summary className="cursor-pointer text-caption text-ink-3">資料來源與讀取狀況{watch.data?.coverage.errors.length?` · ${watch.data.coverage.errors.length} 項異常`:""}</summary><div className="flex flex-col gap-2 pt-2 text-caption text-ink-3">
      <p>{DEMO_MODE ? "簡報、研究、日期與行情全由合成資料提供。更新全部只重讀範例，不連接帳戶或外部資料。" : "簡報、研究和日期讀取本機 investment_note；行情向 Yahoo Finance 查詢，分頁開著時自動更新。更新全部不會同步 Git 或重跑 AI 簡報。"}</p>
      <p>每週觀察：{query.data?.weekly_watch.date??"本機未找到"}。目前只提供日期，無法據此確認本週回顧是否完成。</p>
      <p>投資論點的檢查功能尚未提供；這裡沒有提醒，不代表論點已通過檢查。</p>
      {watch.data?<><p>已讀 {watch.data.coverage.scanned_files} 份相關來源；{watch.data.coverage.missing_catalysts.length} 份未填下次事件日期。未填日期不算讀取故障。</p>{watch.data.coverage.errors.map((e,i)=><p key={i}>{e.path}：{e.message}</p>)}{watch.data.coverage.omissions.length?<p>另有 {watch.data.coverage.omissions.length} 份相關來源未納入：{watch.data.coverage.omissions.slice(0,5).map(e=>`${e.path}（${e.reason}）`).join("、")}</p>:null}</>:null}
    </div></details>
  </div>
}
