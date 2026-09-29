import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import type { InvestmentResearch, InvestmentResearchItem, InvestmentWatch, InvestmentBrief, InvestmentReadState, InvestmentCatalysts30d, InvestmentCatalystItem } from "@/lib/investment"
import { getInvestmentResearchDetail } from "@/lib/investment"
import { RESEARCH_EVENT_LINKAGE_COPY, RESEARCH_ROLE_COPY, researchDirectionView } from "@/lib/investmentFormat"
import { catalystDateGroups } from "@/lib/investmentToday"
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
  return <Card density="compact" className="flex flex-col gap-2">
    <button data-testid="investment-research-item" className="text-left text-body font-medium" aria-expanded={open} onClick={()=>setOpen(!open)}>{title}</button>
    <p className="break-words text-caption text-ink-3">{readStateLabel(item.state)} · {item.kind} · 登記狀態：{item.status} · 更新：{item.updated||item.as_of||"unknown"} · 來源：{location}</p>
    {item.question?<p className="text-body text-ink-2">待回答：{item.question}</p>:null}
    {item.narrative_id?<p className="break-words text-caption text-ink-3">來源明示 narrative_id：{item.narrative_id}</p>:null}
    {!item.narrative_id && !item.decision_id ? <p className="text-caption text-ink-3">此研究與論點／決策：未連結；來源未提供關係 ID。</p> : null}
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
  const listedItems = data.research.items.length
  const unlinkedCount = view.other.filter(item => item.direction?.state === "unlinked").length
  const unresolvedDirectionCount = view.other.length - unlinkedCount
  return <section className="flex min-w-0 flex-col gap-2" aria-label="正式 Research">
    <SectionHeading>主要研究方向</SectionHeading>
    <p className="text-caption text-ink-3">{RESEARCH_ROLE_COPY}</p>
    <p className="text-caption text-ink-3">以下只列出來源明示的方向；未連結或分類未知的項目留在 Other，不作為第六個方向。</p>
    {view.state!=="ready"?<p role="status" className="text-caption text-warn">方向分類{readStateLabel(view.state)}；未能確認方向的研究保留在其他研究。</p>:null}
    {view.groups.map(group=><ResearchDirection key={group.id} group={group}/>)}
    {view.other.length?<details className="min-w-0 rounded-sm border border-line-soft p-3" data-testid="research-other"><summary className="cursor-pointer text-body font-medium">未列入明示方向（Other coverage） · {view.other.length} / {listedItems} 項</summary><div className="flex min-w-0 flex-col gap-3 pt-3"><p className="text-caption text-ink-3">這些來源項目沒有落在明示方向群組，不代表第六個研究方向。來源標記未連結 {unlinkedCount} 項；其餘 {unresolvedDirectionCount} 項的方向未知、未提供，或明示分類沒有可用群組。項目仍全部保留，不依標題、ticker 或內文推定分類。</p>{view.other.map(item=><div key={item.id}><p className="text-caption text-ink-3">方向：{item.direction?.state==="unlinked"?"未連結":item.direction?.state==="linked"?"明示分類無可用方向，待核對":"未知"}</p><ResearchCard item={item}/></div>)}</div></details>:null}
    <details><summary className="cursor-pointer text-caption text-ink-3">研究來源與讀取狀況 · {data.research.count} 項</summary><div className="flex flex-col gap-1 pt-2"><p className="break-words metadata">{readStateLabel(data.state)} · producer：{data.producer} · as_of：{data.as_of} · source_cutoff：{data.source_cutoff} · generated_at：{data.generated_at}</p>{[...data.limitations,...view.limitations].map((note,index)=><p key={index} className="break-words text-caption text-warn">{note}</p>)}</div></details>
    {!data.research.items.length&&(data.state==="ready"||data.state==="empty")?<p className="text-body text-ink-3">正式 Research index 已讀取，來源確認目前沒有項目。</p>:null}
    {!data.research.items.length&&data.state!=="ready"&&data.state!=="empty"?<p className="text-body text-warn">目前沒有可確認的 Research 項目；來源狀態不完整，不能判定為空。</p>:null}
  </section>
}

export function ResearchWatch({data,brief}: {data: InvestmentWatch; brief?:InvestmentBrief}) {
  const window=watchDateWindow(data.generated_at)
  const events=window?buildTimeline(data,brief,window.start,window.end):[]
  const months=window?data.watch.catalysts.filter(e=>e.date_precision==="month"&&e.date!==null&&e.date>=window.start.slice(0,7)&&e.date<=window.end.slice(0,7)):[]
  return <section className="flex min-w-0 flex-col gap-3" aria-label="接下來會改變判斷的事情">
    <SectionHeading>接下來會改變判斷的事情</SectionHeading><p className="text-body text-ink-3">{window?`日期篩選範圍 ${window.start} 至 ${window.end}；目前可讀 Watch 登記日期與簡報的未來 7 天事項。這不是完整 30 天催化劑覆蓋；缺少事件不代表沒有催化劑。`:"無法由 Watch producer timestamp 確定日期範圍；目前不推定未來日期事件。"}</p>
    <p className="text-caption text-ink-3">{RESEARCH_EVENT_LINKAGE_COPY}</p>
    {data.limitations.length>0?<p role="status" className="text-caption text-ink-3">部分來源讀取不完整（{data.limitations.length} 項），展開看明細</p>:null}
    {!window?<p role="status" className="text-body text-warn">generated_at 未提供可驗證的日期或時區時間；Watch 日期事件範圍未知，不能當作空清單。</p>:null}
    {window&&events.length===0&&(data.state==="ready"||data.state==="empty")?<p className="text-body text-ink-3">Watch 與簡報來源已讀取；目前沒有列出這段期間的日期事件。</p>:null}
    {window&&events.length===0&&data.state!=="ready"&&data.state!=="empty"?<p className="text-body text-warn">目前沒有可確認的日期事件；來源狀態不完整時，不把空列表當成沒有事件。</p>:null}
    <ul className="divide-y divide-line-soft">{events.map(e=>{
      const raw=e.raw.trim()
      const rawIsAdditional=Boolean(raw && raw!==e.title.trim() && raw!==e.verify.trim())
      const hasAdditionalInfo=rawIsAdditional||e.sources.some(source=>source.trim().length>0)
      return <li key={e.key} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 py-2">
        <span className="row-span-2 shrink-0 pt-px text-label tabular-nums text-ink-3">{e.date_label}{e.estimated?" 約":""}</span>
        <span className="min-w-0 text-body font-medium"><InlineText text={e.title}/></span>
        {e.verify?<p className="min-w-0 text-caption leading-relaxed text-ink-2">要看什麼：<InlineText text={e.verify}/></p>:null}
        {hasAdditionalInfo?<details className="col-start-2 min-w-0"><summary className="cursor-pointer text-right text-caption text-ink-3">原文與來源</summary><div className="flex min-w-0 flex-col gap-2 break-words pt-2 text-caption text-ink-3">{rawIsAdditional?<ReadingText text={raw}/>:null}{e.sources.length?<p className="break-words">{e.sources.join("；")}</p>:null}</div></details>:null}
      </li>
    })}</ul>
    {months.length>0?<details><summary className="cursor-pointer text-caption text-ink-3">只知道月份的 Watch 日期（{months.length}）</summary><div className="flex flex-col gap-2 pt-2">{months.map(e=><p key={e.id} className="text-body">{e.topic} · <InlineText text={e.raw}/></p>)}</div></details>:null}
    <details><summary className="cursor-pointer text-caption text-ink-3">資料來源與讀取狀況</summary><div className="flex min-w-0 flex-col gap-1 pt-2">
      <p className="break-words metadata">Watch producer：{data.producer} · as_of：{data.as_of} · source_cutoff：{data.source_cutoff} · generated_at：{data.generated_at} · 狀態：{readStateLabel(data.state)}</p>
      {data.limitations.map((note,index)=><p key={index} className="break-words text-caption text-warn">{note}</p>)}
      {data.watch.coverage.errors.map((error,index)=><p key={`${index}:${error.path}`} className="break-words text-caption text-warn">{error.path}：{error.message}</p>)}
    </div></details>
  </section>
}

function ProjectedCatalyst({ item }: { item: InvestmentCatalystItem }) {
  const qualifiers = Array.isArray(item.source_qualifiers) ? item.source_qualifiers.join("；") : item.source_qualifiers
  return <li className="flex min-w-0 flex-col gap-1 border-t border-line-soft py-2 first:border-0">
    <p className="text-body font-medium text-ink">{item.date_precision === "day" && item.window_membership === "within" ? item.date : item.date_label || "日期未確定"} · {item.ticker} · {item.type}</p>
    <p className="text-body text-ink-2"><InlineText text={item.raw} /></p>
    <p className="text-caption text-ink-3">與今日行動／論點的關係：未連結；來源未提供關係 ID。</p>
    {item.date_precision !== "day" || item.window_membership !== "within" ? <p className="text-caption text-warn">日期精度：{item.date_precision} · 範圍關係：{item.window_membership === "possible" ? "可能在範圍內" : item.window_membership === "unknown" ? "未知（未確認是否在範圍內）" : "來源確認在範圍內"}；不轉成確定的日期。</p> : null}
    {qualifiers ? <p className="text-caption text-ink-3">來源限定：{qualifiers}</p> : null}
    <details className="text-caption text-ink-3"><summary className="cursor-pointer py-1">催化劑來源</summary><p className="break-all">{item.source?.path ?? "來源未提供"} · {item.source?.line ?? "行數未提供"}</p></details>
  </li>
}

export function CatalystProjection({ data, pending = false, failed = false, heading = "接下來會改變判斷的事情" }: { data?: InvestmentCatalysts30d | null; pending?: boolean; failed?: boolean; heading?: string }) {
  const view = catalystDateGroups(data)
  return <section aria-label="來源投影的未來 30 天催化劑" className="flex min-w-0 flex-col gap-2">
    <SectionHeading>{heading}</SectionHeading>
    <p className="text-caption text-ink-3">Investment Note 的 30 天來源投影；事件不自動成為 owner 待辦，也不依 ticker 連到今日行動。</p>
    {failed ? <p role="status" className="text-caption text-warn">催化劑來源本次讀取失敗；{data ? "保留上次投影與原日期。" : "涵蓋未知。"}</p> : null}
    {pending && !data ? <p role="status" className="text-caption text-ink-3">讀取催化劑投影…</p> : null}
    {!data && !pending ? <p role="status" className="text-body text-warn">來源尚未提供 30 天投影；涵蓋未知，不能把空列表當作沒有事件。</p> : null}
    {data ? <>
      <p className="text-caption text-ink-3">投影範圍：{data.window_start || "起日未知"} 至 {data.window_end || "迄日未知"} · {view.state === "ready" ? "來源投影已讀取" : view.state === "partial" ? "部分涵蓋" : "涵蓋未知"}</p>
      {view.exact.length ? <ul className="flex min-w-0 flex-col">{view.exact.map((item, index) => <ProjectedCatalyst key={index} item={item} />)}</ul> : <p className="text-body text-ink-3">來源未列出此範圍內的確定日期事件；不代表沒有催化劑。</p>}
      {view.uncertain.length ? <div className="flex min-w-0 flex-col gap-1"><p className="text-caption font-medium text-warn">日期或範圍關係未確定 · {view.uncertain.length} 項</p><ul>{view.uncertain.map((item, index) => <ProjectedCatalyst key={index} item={item} />)}</ul></div> : null}
      {data.coverage_gaps.length ? <div className="text-caption text-warn"><p>來源涵蓋缺口</p>{data.coverage_gaps.map((gap, index) => <p key={index}>{gap.ticker}：{gap.reason}</p>)}</div> : null}
      {data.limitations.map((note, index) => <p key={index} className="text-caption text-warn">{note}</p>)}
    </> : null}
  </section>
}
