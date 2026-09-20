import type { InvestmentWatch, InvestmentBrief } from "@/lib/investment"
import { buildTimeline } from "@/lib/investmentDates"
import { Card, SectionHeading } from "@/components/ui/card"
import { ReadingText, InlineText } from "./ReadingText"
import { SourceQuestion } from "./InvestmentWork"

export function ResearchLibrary({data}: {data: InvestmentWatch}) {
  return <details open className="flex flex-col gap-2"><summary className="cursor-pointer text-body font-medium text-ink">正在研究與待釐清的問題</summary><div className="flex flex-col gap-2 pt-3">
    {data.research.map(r=><Card key={r.id} className="flex flex-col gap-2 p-3"><details><summary className="cursor-pointer text-body font-medium">{r.topic} · {r.title}</summary><div className="flex flex-col gap-3 pt-3"><ReadingText text={r.excerpt}/><p className="text-caption text-ink-3">來源：{r.source.path}{r.source.updated?` · ${r.source.updated}`:""}</p><SourceQuestion source={r}/></div></details></Card>)}
    {data.session_followups.map(r=><Card key={r.id} className="flex flex-col gap-2 p-3"><p className="text-body font-medium">{r.title}</p><ReadingText text={r.next_action}/><p className="text-caption text-ink-3">紀錄日期：{r.last_session}</p></Card>)}
  </div></details>
}

export function ResearchWatch({data,brief}: {data: InvestmentWatch; brief?:InvestmentBrief}) {
  const today=data.as_of.slice(0,10)
  const endDate=new Date(`${today}T00:00:00Z`);endDate.setUTCDate(endDate.getUTCDate()+30)
  const end=endDate.toISOString().slice(0,10)
  const events=buildTimeline(data,brief,today,end)
  const months=data.catalysts.filter(e=>e.date_precision==="month"&&e.date!==null&&e.date>=today.slice(0,7)&&e.date<=end.slice(0,7))
  return <section className="flex flex-col gap-3" aria-label="什麼時候要看什麼">
    <SectionHeading>什麼時候要看什麼</SectionHeading><p className="text-body text-ink-3">未來 30 天（{today} 至 {end}）需要留意的事件：研究筆記記下的日期，以及簡報提到的近期事件；同一天同一檔只列一次。事件名稱沿用來源原文，避免只顯示資料夾代號。</p>
    {events.length===0?<p className="text-body text-ink-3">目前筆記與簡報沒有記下這段期間的確切日期；資料缺日期，不代表這段期間沒有事件。</p>:null}
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
    {months.length>0?<details><summary className="cursor-pointer text-caption text-ink-3">只知道月份的近期事件（{months.length}）</summary><div className="flex flex-col gap-2 pt-2">{months.map(e=><p key={e.id} className="text-body">{e.topic} · <InlineText text={e.raw}/></p>)}</div></details>:null}
  </section>
}
