import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import type { InvestmentResearch, InvestmentResearchItem, InvestmentWatch, InvestmentBrief, InvestmentReadState } from "@/lib/investment"
import { getInvestmentResearchDetail } from "@/lib/investment"
import { researchDirectionView } from "@/lib/investmentFormat"
import { buildTimeline, watchDateWindow } from "@/lib/investmentDates"
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

function ResearchDirection({group}: {group: ReturnType<typeof researchDirectionView>["groups"][number]}) {
  return <details data-testid="research-direction" className="min-w-0 rounded-sm border border-line-soft p-3">
    <summary className="cursor-pointer break-words text-body font-medium">{group.title} · {group.items.length} 項</summary>
    <div className="flex min-w-0 flex-col gap-3 pt-3">
      <p className="text-caption text-ink-3">{readStateLabel(group.state)}。此方向只包含來源明示的研究；主要問題、持倉關係與下一個 checkpoint 尚無方向摘要欄位。</p>
      {group.limitations.map((note,index)=><p key={index} className="break-words text-caption text-warn">{note}</p>)}
      {group.missingItemIds.length?<p role="status" className="break-words text-caption text-warn">部分明示成員不可用：{group.missingItemIds.join("、")}</p>:null}
      {group.items.map(item=><div key={item.id} className="flex min-w-0 flex-col gap-1"><ResearchCard item={item}/><details><summary className="cursor-pointer text-caption text-ink-3">方向關聯來源</summary>{group.relations.filter(relation=>relation.item_id===item.id).map((relation,index)=><p key={index} className="break-words text-caption text-ink-3">{relation.source.path}:{relation.source.line ?? "unknown"} · {relation.source.expect ?? "明示成員"}</p>)}</details></div>)}
      {!group.items.length?<p className="text-caption text-warn">此方向目前沒有可讀的明示研究成員。</p>:null}
      <details><summary className="cursor-pointer text-caption text-ink-3">方向定義來源</summary><p className="break-words text-caption text-ink-3">{group.source.path}:{group.source.line ?? "unknown"} · {group.source.expect}</p></details>
    </div>
  </details>
}

export function ResearchLibrary({data}: {data: InvestmentResearch}) {
  const view=researchDirectionView(data)
  return <section className="flex min-w-0 flex-col gap-2" aria-label="正式 Research">
    <SectionHeading>主要研究方向</SectionHeading>
    <p className="text-caption text-ink-3">從研究方向展開到個別問題與來源。</p>
    {view.state!=="ready"?<p role="status" className="text-caption text-warn">方向分類{readStateLabel(view.state)}；未能確認方向的研究保留在其他研究。</p>:null}
    {view.groups.map(group=><ResearchDirection key={group.id} group={group}/>)}
    {view.other.length?<details className="min-w-0 rounded-sm border border-line-soft p-3" data-testid="research-other"><summary className="cursor-pointer text-body font-medium">其他研究（Other） · {view.other.length} 項</summary><div className="flex min-w-0 flex-col gap-3 pt-3"><p className="text-caption text-ink-3">未連結或方向未知的研究，不依標題、ticker 或內文推定分類。</p>{view.other.map(item=><div key={item.id}><p className="text-caption text-ink-3">方向：{item.direction?.state==="unlinked"?"未連結":item.direction?.state==="linked"?"明示分類無可用方向，待核對":"未知"}</p><ResearchCard item={item}/></div>)}</div></details>:null}
    <details><summary className="cursor-pointer text-caption text-ink-3">研究來源與讀取狀況 · {data.research.count} 項</summary><div className="flex flex-col gap-1 pt-2"><p className="break-words text-caption text-ink-3">{readStateLabel(data.state)} · producer：{data.producer} · as_of：{data.as_of} · source_cutoff：{data.source_cutoff} · generated_at：{data.generated_at}</p>{[...data.limitations,...view.limitations].map((note,index)=><p key={index} className="break-words text-caption text-warn">{note}</p>)}</div></details>
    {!data.research.items.length&&(data.state==="ready"||data.state==="empty")?<p className="text-body text-ink-3">正式 Research index 已讀取，來源確認目前沒有項目。</p>:null}
    {!data.research.items.length&&data.state!=="ready"&&data.state!=="empty"?<p className="text-body text-warn">目前沒有可確認的 Research 項目；來源狀態不完整，不能判定為空。</p>:null}
  </section>
}

export function ResearchWatch({data,brief}: {data: InvestmentWatch; brief?:InvestmentBrief}) {
  const window=watchDateWindow(data.generated_at)
  const events=window?buildTimeline(data,brief,window.start,window.end):[]
  const months=window?data.watch.catalysts.filter(e=>e.date_precision==="month"&&e.date!==null&&e.date>=window.start.slice(0,7)&&e.date<=window.end.slice(0,7)):[]
  return <section className="flex min-w-0 flex-col gap-3" aria-label="Watch 來源日期">
    <SectionHeading>Watch 來源日期</SectionHeading><p className="text-body text-ink-3">{window?`未來 30 天（${window.start} 至 ${window.end}）Watch 索引提取的來源日期與正式簡報提及事項。這是日期讀取清單，和正式 Research index、個人待辦各自分開。`:"無法由 Watch producer timestamp 確定日期範圍；目前不推定未來日期事件。"}</p>
    <p className="break-words text-caption text-ink-3">producer：{data.producer} · 狀態：{readStateLabel(data.state)} · as_of：{data.as_of} · source_cutoff：{data.source_cutoff} · generated_at：{data.generated_at}</p>
    {data.state!=="ready"&&data.state!=="empty"?<div role="status" className="flex flex-col gap-1 text-caption text-warn">{data.limitations.map((note,index)=><p key={index}>{note}</p>)}</div>:null}
    {!window?<p role="status" className="text-body text-warn">generated_at 未提供可驗證的日期或時區時間；Watch 日期事件範圍未知，不能當作空清單。</p>:null}
    {data.watch.coverage.errors.map((error,index)=><p key={`${index}:${error.path}`} role="status" className="break-words text-caption text-warn">{error.path}：{error.message}</p>)}
    {window&&events.length===0&&(data.state==="ready"||data.state==="empty")?<p className="text-body text-ink-3">Watch 與簡報來源已讀取；目前沒有列出這段期間的日期事件。</p>:null}
    {window&&events.length===0&&data.state!=="ready"&&data.state!=="empty"?<p className="text-body text-warn">目前沒有可確認的日期事件；來源狀態不完整時，不把空列表當成沒有事件。</p>:null}
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
