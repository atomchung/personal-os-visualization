import { useState } from "react"
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query"
import { DEMO_MODE } from "@/lib/transport"
import { Button } from "@/components/ui/button"
import { Card, SectionHeading, SubsectionHeading } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { PageHeader } from "@/components/ui/page-header"
import { MarketIndicators } from "./MarketIndicators"
import { quoteTime } from "@/lib/investmentFormat"
import { StockMomentum } from "./StockMomentum"
import { ResearchWatch, ResearchLibrary } from "./ResearchWatch"
import { ReadingText, InlineText } from "./ReadingText"
import { InvestmentWorkPanel } from "./InvestmentWork"
import { PendingBoard } from "./InvestmentPending"
import { InvestmentHistory } from "./InvestmentHistory"
import { BRIEF_SESSION_LABELS, getInvestment, getInvestmentWatch, getInvestmentMarket, getInvestmentPending, getInvestmentHistory, getInvestmentContext, getMomentumLeaders, getMomentumUniverse, getStockMomentum, getStockQuote, getInvestmentSource, getInvestmentWork, type InvestmentBrief, type InvestmentSource } from "@/lib/investment"

function SourceText({source}: {source: InvestmentSource}) {
  const [open,setOpen]=useState(false)
  const query=useQuery({queryKey:["investment-source",source.id,source.generated_at],queryFn:({signal})=>getInvestmentSource(source.id,signal),enabled:open,staleTime:0,retry:false,refetchOnWindowFocus:false})
  return <details onToggle={e=>setOpen(e.currentTarget.open)}><summary className="cursor-pointer text-body font-medium">閱讀完整簡報 · {source.date}</summary><div className="max-w-[900px] pt-3">{query.isPending?<p className="text-body text-ink-3">載入原文中…</p>:query.isError?<p role="alert" className="text-body text-warn">簡報原文讀取失敗，請按更新全部。</p>:query.data?<ReadingText text={query.data.text}/>:null}</div></details>
}

const ACTION_TONE: Record<string, "ok" | "warn" | "info" | "mute"> = {"不動":"mute","觀察":"info","補研究":"warn","需評估":"warn"}
function actionTone(today: string) { const hit=Object.keys(ACTION_TONE).find(k=>today.includes(k)); return hit?ACTION_TONE[hit]:"mute" }

// Only remove exact, pure no-change labels. A sentence that also contains a
// judgment (for example, why the existing thesis still stands) remains visible.
const PURE_NO_CHANGE_ACTIONS = new Set(["沒有新資訊", "暫無新資訊", "無新資訊", "不重複升級"])
function meaningfulActions(actions: string[]) {
  return actions.filter(action => {
    const normalized = action.trim().replace(/[。．.!！?？]+$/, "")
    return !PURE_NO_CHANGE_ACTIONS.has(normalized)
  })
}

/** One decision surface: headline first, then action and evidence without repeating events. */
function TodayBrief({b}: {b: InvestmentBrief}) {
  const version = b.session ? BRIEF_SESSION_LABELS[b.session] ?? b.session : null
  const stale = b.state === "stale"
  const looseTheses = b.thesis_changes.filter((x) => x.event_index === null)
  const looseRisks = b.risks.filter((x) => x.event_index === null)
  return <section aria-label="今日簡報" className="flex flex-col gap-4">
    <Card className="overflow-hidden border-l-4 border-l-accent shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft bg-bg-2 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-baseline gap-2"><SectionHeading>今日判斷</SectionHeading><span className="text-caption text-ink-3">{b.date ?? "尚未收到"}{version ? ` · ${version}` : ""}</span></div>
        <span className="text-micro text-ink-3">{b.generated_at ? `${quoteTime(b.generated_at)} 產出` : "本機來源"}{stale ? " · 版本較舊" : ""}</span>
      </div>
      <div className="flex flex-col gap-5 p-4 sm:p-5">
        <div className="max-w-[960px] text-section leading-relaxed text-ink">{b.headline ? <ReadingText text={b.headline} /> : <p className="text-body text-warn">{b.state === "invalid" ? "這份簡報部分格式無法辨識，仍可展開原文閱讀。" : "本機尚無可讀簡報。"}</p>}</div>
        {meaningfulActions(b.actions).length ? <div className="border-t border-line-soft pt-4"><SubsectionHeading>下一步</SubsectionHeading><ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-body leading-relaxed text-ink-2">{meaningfulActions(b.actions).map((action, i) => <li key={i}><InlineText text={action} /></li>)}</ul></div> : null}
        {b.events.length > 0 || b.event_notes.length > 0 ? <div className="border-t border-line-soft pt-4"><div className="flex flex-wrap items-baseline justify-between gap-2"><SubsectionHeading>新聞與今天要注意的事</SubsectionHeading><span className="text-micro text-ink-3">新聞 → 影響 → 注意點</span></div><div className="mt-3 flex flex-col divide-y divide-line-soft rounded-md border border-line-soft">
          {b.events.map((e, i) => <div key={`${b.date}:${i}`} className="flex flex-col gap-2 bg-bg-2 p-3 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><p className="min-w-0 text-body font-medium leading-relaxed"><InlineText text={e.event} /></p><Chip tone={actionTone(e.today)}>{e.today}</Chip></div>
            <p className="text-body leading-relaxed text-ink-2"><span className="font-medium text-ink">對持倉：</span><InlineText text={e.impact} /></p>
            {b.thesis_changes.filter((x) => x.event_index === i).map((x, j) => <p key={`t${j}`} className="text-body leading-relaxed text-ink-2"><span className="font-medium text-ink">判斷：</span><InlineText text={x.thesis} /> {x.change}<span className="text-ink-3"> — <InlineText text={x.reason} /></span></p>)}
            {b.risks.filter((x) => x.event_index === i).map((x, j) => <p key={`r${j}`} className="text-body leading-relaxed text-warn"><span className="font-medium">風險：</span><InlineText text={x.risk} /> — <InlineText text={x.status} /></p>)}
            <details><summary className="cursor-pointer text-caption text-ink-3">展開市場反應與判讀</summary><div className="flex flex-col gap-2 pt-2 text-body text-ink-2"><p><span className="font-medium">市場怎麼反應：</span><InlineText text={e.market_reaction} /></p><p><span className="font-medium">接下來看什麼：</span><InlineText text={e.interpretation} /></p></div></details>
          </div>)}
        </div>{b.event_notes.length ? <div className="mt-3"><ReadingText text={b.event_notes.join("\n\n")} /></div> : null}</div> : null}
        {looseTheses.length > 0 || looseRisks.length > 0 || b.thesis_notes.length > 0 || b.risk_notes.length > 0 ? <details className="border-t border-line-soft pt-4"><summary className="cursor-pointer text-body font-medium text-ink">簡報另外保留的判斷與風險</summary><div className="flex flex-col gap-4 pt-3"><p className="text-caption leading-relaxed text-ink-3">這裡是原始晨報另外保留的觀點，不是今天新增的新聞。來源沒有指向單一新聞時，先保留原文，不替它猜測關聯。</p>{looseTheses.length > 0 || b.thesis_notes.length > 0 ? <div><SubsectionHeading>目前仍維持的判斷</SubsectionHeading><ul className="mt-2 flex flex-col gap-1">{looseTheses.map((t, i) => <li key={i} className="text-body text-ink-2"><span className="font-medium text-ink"><InlineText text={t.thesis} /></span> {t.change}<span className="text-ink-3"> — <InlineText text={t.reason} /></span></li>)}</ul>{b.thesis_notes.length ? <ReadingText text={b.thesis_notes.join("\n\n")} /> : null}</div> : null}{looseRisks.length > 0 || b.risk_notes.length > 0 ? <div><SubsectionHeading>需要守住的風險門檻</SubsectionHeading><ul className="mt-2 flex flex-col gap-1">{looseRisks.map((r, i) => <li key={i} className="text-body text-ink-2"><span className="font-medium text-ink"><InlineText text={r.risk} /></span><span className="text-ink-3"> — <InlineText text={r.status} /></span></li>)}</ul>{b.risk_notes.length ? <ReadingText text={b.risk_notes.join("\n\n")} /> : null}</div> : null}</div></details> : null}
        {b.source?.limitations.length ? <p role="status" className="text-caption text-warn">資料限制：{b.source.limitations.join(" ")}</p> : null}
        {b.source ? <SourceText key={b.source.id} source={b.source} /> : null}
      </div>
    </Card>
  </section>
}

export function InvestmentPage() {
  const [view,setView]=useState<"today"|"work"|"month"|"history">("today")
  const [refreshing,setRefreshing]=useState(false)
  const [notice,setNotice]=useState("")
  const client=useQueryClient()
  const fetching=useIsFetching({predicate:q=>String(q.queryKey[0]).startsWith("investment")})
  const query=useQuery({queryKey:["investment"],queryFn:({signal})=>getInvestment(signal),retry:false,refetchOnWindowFocus:true,staleTime:60_000})
  const watch=useQuery({queryKey:["investment-watch"],queryFn:({signal})=>getInvestmentWatch(signal),retry:false,refetchOnWindowFocus:false})
  const history=useQuery({queryKey:["investment-history"],queryFn:({signal})=>getInvestmentHistory(signal),enabled:view==="history",retry:false,refetchOnWindowFocus:false})
  const context=useQuery({queryKey:["investment-context"],queryFn:({signal})=>getInvestmentContext(signal),enabled:view==="history",retry:false,refetchOnWindowFocus:false})
  const b=query.data?.brief
  async function refresh() {
    setRefreshing(true);setNotice("正在更新簡報、研究、持倉與市場行情…")
    const failures:string[]=[]
    async function run<T>(label:string, key:readonly unknown[], fn:()=>Promise<T>):Promise<T|undefined> {
      try {return await client.fetchQuery({queryKey:key,queryFn:fn,staleTime:0,retry:false})} catch {failures.push(label);return undefined}
    }
    try {
      const [brief,research,market,universe,,pending,leaders]=await Promise.all([
        run("簡報",["investment"],()=>getInvestment()),run("研究",["investment-watch"],()=>getInvestmentWatch()),
        run("市場行情",["investment-market"],()=>getInvestmentMarket(undefined,true)),run("股票清單",["investment-momentum-universe"],()=>getMomentumUniverse()),
        run("我的投資事項",["investment-work"],()=>getInvestmentWork()),
        run("系統提醒",["investment-pending"],()=>getInvestmentPending()),
        run("近期動能",["investment-momentum-leaders"],()=>getMomentumLeaders(undefined,true)),
      ])
      if (brief?.brief.state==="invalid"||brief?.brief.state==="missing") failures.push("簡報內容")
      if (research?.coverage.errors.length) failures.push("部分研究來源")
      if (brief?.brief.source?.limitations.length) failures.push("簡報部分段落")
      if (market?.state==="unavailable"||market?.state==="partial") failures.push("部分市場報價")
      // 三個來源各自有狀態；只報哪一個讀不到，不把整塊說成失敗。
      if (pending) failures.push(...([["舊判斷回看",pending.revisit],["待確認事項",pending.gate],["每週觀察",pending.weekly]] as const).filter(([,b])=>b.state==="unavailable").map(([label])=>label))
      if (universe?.state==="unavailable") failures.push("股票清單")
      if (leaders?.state==="unavailable"||leaders?.state==="partial") failures.push("近期動能部分日線")
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
    <PageHeader page="investment" action={<Button disabled={refreshing||fetching>0} onClick={()=>void refresh()}>{refreshing?"更新中…":fetching>0?"資料載入中…":"更新資料"}</Button>} />
    {notice?<p role="status" aria-live="polite" className="text-caption text-ink-3">{notice}</p>:null}
    <nav aria-label="投資內容" className="flex min-w-0 gap-5 overflow-x-auto border-b border-line-soft" role="tablist">{([['today','今日'],['work','正在研究'],['month','近期要留意'],['history','舊判斷回看']] as const).map(([key,label])=><Button key={key} role="tab" aria-selected={view===key} aria-pressed={view===key} variant="link" className={`shrink-0 rounded-none border-b-2 px-0 pb-2 ${view===key?"border-accent text-ink":"border-transparent text-ink-3"}`} onClick={()=>setView(key)}>{label}</Button>)}</nav>
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
    <div hidden={view!=="history"} className={view==="history"?"flex min-w-0 flex-col gap-4":"hidden"}>
      {history.isPending||context.isPending?<p className="text-body text-ink-3">讀取歷史與工作脈絡中…</p>:null}
      {history.isError?<p role="alert" className="text-body text-warn">歷史來源這次無法取得，請稍後重試。</p>:null}
      {context.isError?<p role="alert" className="text-body text-warn">工作脈絡這次無法取得；歷史資料仍可單獨查看。</p>:null}
      {history.data?<InvestmentHistory data={history.data} context={context.data}/>:null}
    </div>
    {watch.isError?<p role="alert" className="text-body text-warn">研究與重要日期本次讀取失敗。{watch.data?"仍顯示上次內容。":""}</p>:null}
    <details className="border-t border-line-soft pt-3"><summary className="cursor-pointer text-caption text-ink-3">資料來源與讀取狀況{watch.data?.coverage.errors.length?` · ${watch.data.coverage.errors.length} 項異常`:""}</summary><div className="flex flex-col gap-2 pt-2 text-caption text-ink-3">
      <p>{DEMO_MODE ? "簡報、研究、日期與行情全由合成資料提供。更新全部只重讀範例，不連接帳戶或外部資料。" : "簡報、研究和日期讀取本機 investment_note；行情向 Yahoo Finance 查詢，分頁開著時自動更新。更新全部不會同步 Git 或重跑 AI 簡報。"}</p>
      <p>每週觀察：{query.data?.weekly_watch.date??"本機未找到"}。目前只提供日期，無法據此確認本週回顧是否完成。</p>
      <p>投資論點的檢查功能尚未提供；這裡沒有提醒，不代表論點已通過檢查。</p>
      {watch.data?<><p>已讀 {watch.data.coverage.scanned_files} 份相關來源；{watch.data.coverage.missing_catalysts.length} 份未填下次事件日期。未填日期不算讀取故障。</p>{watch.data.coverage.errors.map((e,i)=><p key={i}>{e.path}：{e.message}</p>)}{watch.data.coverage.omissions.length?<p>另有 {watch.data.coverage.omissions.length} 份相關來源未納入：{watch.data.coverage.omissions.slice(0,5).map(e=>`${e.path}（${e.reason}）`).join("、")}</p>:null}</>:null}
    </div></details>
  </div>
}
