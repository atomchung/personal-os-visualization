import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import type { InvestmentResearch, InvestmentResearchItem, InvestmentWatch, InvestmentBrief, InvestmentReadState } from "@/lib/investment"
import { getInvestmentResearchDetail } from "@/lib/investment"
import { buildTimeline } from "@/lib/investmentDates"
import { Card, SectionHeading } from "@/components/ui/card"
import { ReadingText, InlineText } from "./ReadingText"
import { SourceQuestion } from "./InvestmentWork"

function readStateLabel(state: InvestmentReadState) {
  switch (state) {
    case "ready": return "來源完整"
    case "empty": return "來源確認為空"
    case "unknown": return "狀態未知"
    case "partial": return "來源部分可讀"
    case "stale": return "來源已過期"
    case "unavailable": return "來源不可用"
    case "conflict": return "來源互相矛盾"
  }
}

function ResearchCard({item}: {item: InvestmentResearchItem}) {
  const [open,setOpen]=useState(false)
  const detail=useQuery({queryKey:["investment-research-detail",item.id],queryFn:({signal})=>getInvestmentResearchDetail(item.id,signal),enabled:open,retry:false,refetchOnWindowFocus:false})
  const title=item.title||item.question||item.id
  const location=`${item.source.path}${item.source.line ? `:${item.source.line}` : ""}`
  return <Card className="flex flex-col gap-2 p-3">
    <button data-testid="investment-research-item" className="text-left text-body font-medium" aria-expanded={open} onClick={()=>setOpen(!open)}>{title}</button>
    <p className="break-words text-caption text-ink-3">{readStateLabel(item.state)} · {item.kind} · 登記狀態：{item.status} · 更新：{item.updated||item.as_of||"unknown"} · 來源：{location}</p>
    {item.question?<p className="text-body text-ink-2">待回答：{item.question}</p>:null}
    {item.narrative_id?<p className="break-words text-caption text-ink-3">來源明示 narrative_id：{item.narrative_id}</p>:null}
    {item.decision_id?<p className="break-words text-caption text-ink-3">來源明示 decision_id：{item.decision_id}</p>:null}
    {item.missing?.map((reason,index)=><p key={index} className="text-caption text-warn">未知／缺少：{reason}</p>)}
    {open?<div className="flex flex-col gap-3 border-t border-line-soft pt-2">
      {detail.isPending?<p role="status" className="text-body text-ink-3">讀取正式 Research 明細…</p>:null}
      {detail.isError?<p role="alert" className="text-body text-warn">正式 Research 明細讀取失敗。</p>:null}
      {detail.data?<>
        {detail.data.state!=="ready"?<div role="status" className="flex flex-col gap-1 text-caption text-warn"><p>明細狀態：{readStateLabel(detail.data.state)}</p>{detail.data.limitations.map((note,index)=><p key={index}>{note}</p>)}</div>:null}
        {detail.data.research.item===null?<p className="text-body text-warn">這筆正式 Research 明細沒有可用項目；不以空白代替成功讀取。</p>:null}
        {detail.data.research.detail?.text?<ReadingText text={detail.data.research.detail.text}/>:null}
        {detail.data.research.detail?.what?<p className="text-body text-ink-2">待確認事項：{detail.data.research.detail.what}{detail.data.research.detail.due?` · 到期 ${detail.data.research.detail.due}`:""}</p>:null}
      </>:null}
      <SourceQuestion source={item}/>
    </div>:null}
  </Card>
}

export function ResearchLibrary({data}: {data: InvestmentResearch}) {
  return <section className="flex min-w-0 flex-col gap-2" aria-label="正式 Research">
    <div className="flex flex-wrap items-baseline gap-2"><SectionHeading>正式 Research · {data.research.count} 項</SectionHeading><span className="text-caption text-ink-3">{readStateLabel(data.state)}</span></div>
    <p className="break-words text-caption text-ink-3">producer：{data.producer} · as_of：{data.as_of} · source_cutoff：{data.source_cutoff} · generated_at：{data.generated_at}</p>
    {data.state!=="ready"&&data.state!=="empty"?<div role="status" className="flex flex-col gap-1 text-caption text-warn">{data.limitations.map((note,index)=><p key={index}>{note}</p>)}</div>:null}
    {data.research.items.map(item=><ResearchCard key={item.id} item={item}/>)}
    {!data.research.items.length&&(data.state==="ready"||data.state==="empty")?<p className="text-body text-ink-3">正式 Research index 已讀取，來源確認目前沒有項目。</p>:null}
    {!data.research.items.length&&data.state!=="ready"&&data.state!=="empty"?<p className="text-body text-warn">目前沒有可確認的 Research 項目；來源狀態不完整，不能判定為空。</p>:null}
  </section>
}

export function ResearchWatch({data,brief}: {data: InvestmentWatch; brief?:InvestmentBrief}) {
  const today=data.generated_at.slice(0,10)
  const endDate=new Date(`${today}T00:00:00Z`);endDate.setUTCDate(endDate.getUTCDate()+30)
  const end=endDate.toISOString().slice(0,10)
  const events=buildTimeline(data,brief,today,end)
  const months=data.watch.catalysts.filter(e=>e.date_precision==="month"&&e.date!==null&&e.date>=today.slice(0,7)&&e.date<=end.slice(0,7))
  return <section className="flex min-w-0 flex-col gap-3" aria-label="Watch 來源日期">
    <SectionHeading>Watch 來源日期</SectionHeading><p className="text-body text-ink-3">未來 30 天（{today} 至 {end}）Watch 索引提取的來源日期與正式簡報提及事項。這是日期讀取清單，和正式 Research index、個人待辦各自分開。</p>
    <p className="break-words text-caption text-ink-3">producer：{data.producer} · 狀態：{readStateLabel(data.state)} · as_of：{data.as_of} · source_cutoff：{data.source_cutoff} · generated_at：{data.generated_at}</p>
    {data.state!=="ready"&&data.state!=="empty"?<div role="status" className="flex flex-col gap-1 text-caption text-warn">{data.limitations.map((note,index)=><p key={index}>{note}</p>)}</div>:null}
    {data.watch.coverage.errors.map((error,index)=><p key={`${index}:${error.path}`} role="status" className="break-words text-caption text-warn">{error.path}：{error.message}</p>)}
    {events.length===0&&(data.state==="ready"||data.state==="empty")?<p className="text-body text-ink-3">Watch 與簡報來源已讀取；目前沒有列出這段期間的日期事件。</p>:null}
    {events.length===0&&data.state!=="ready"&&data.state!=="empty"?<p className="text-body text-warn">目前沒有可確認的日期事件；來源狀態不完整時，不把空列表當成沒有事件。</p>:null}
    <ul className="divide-y divide-line-soft">{events.map(e=>{
      const raw=e.raw.trim()
      const rawIsAdditional=Boolean(raw && raw!==e.title.trim() && raw!==e.verify.trim())
      const hasAdditionalInfo=rawIsAdditional||e.sources.some(source=>source.trim().length>0)
      return <li key={e.key} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 py-2">
        <span className="row-span-2 shrink-0 pt-px text-label tabular-nums text-ink-3">{e.date.slice(5)}{e.estimated?" 約":""}</span>
        <span className="min-w-0 text-body font-medium"><InlineText text={e.title}/></span>
        {e.verify?<p className="min-w-0 text-caption leading-relaxed text-ink-2">要看什麼：<InlineText text={e.verify}/></p>:null}
        {hasAdditionalInfo?<details className="col-start-2 min-w-0"><summary className="cursor-pointer text-right text-caption text-ink-3">原文與來源</summary><div className="flex min-w-0 flex-col gap-2 break-words pt-2 text-caption text-ink-3">{rawIsAdditional?<ReadingText text={raw}/>:null}{e.sources.length?<p className="break-words">{e.sources.join("；")}</p>:null}</div></details>:null}
      </li>
    })}</ul>
    {months.length>0?<details><summary className="cursor-pointer text-caption text-ink-3">只知道月份的 Watch 日期（{months.length}）</summary><div className="flex flex-col gap-2 pt-2">{months.map(e=><p key={e.id} className="text-body">{e.topic} · <InlineText text={e.raw}/></p>)}</div></details>:null}
  </section>
}
