import type { InvestmentBrief, InvestmentWatch } from "@/lib/investment"

/** Read only explicit day/range labels; preserve unknown precision in source text. */
export function briefEventRange(label: string, briefDate: string): { start: string; end: string } | null {
  const absolute=label.match(/^(\d{4})-(\d{2})-(\d{2})(?:[–—~～](?:(\d{4})-)?(?:(\d{2})-)?(\d{2}))?$/)
  const short=label.match(/^(\d{2})\/(\d{2})(?:[–—~～](?:(\d{2})\/)?(\d{2}))?$/)
  if (!absolute&&!short) return null
  const briefMonth=Number(briefDate.slice(5,7))
  const month=Number(absolute?.[2]??short?.[1])
  // A short MM/DD in a brief's "next 7 days" is never months in the past: a
  // January date inside a December brief belongs to the coming year.
  const year=Number(absolute?.[1]??(Number(briefDate.slice(0,4))+(short&&month<briefMonth?1:0)))
  const day=Number(absolute?.[3]??short?.[2])
  const endMonth=Number(absolute?.[5]??short?.[3]??month)
  const endDay=Number(absolute?.[6]??short?.[4]??day)
  const endYear=Number(absolute?.[4]??(year+(endMonth<month?1:0)))
  function iso(y:number,m:number,d:number):string|null {
    const date=new Date(Date.UTC(y,m-1,d))
    return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d?date.toISOString().slice(0,10):null
  }
  const start=iso(year,month,day), finish=iso(endYear,endMonth,endDay)
  return start!==null&&finish!==null&&finish>=start?{start,end:finish}:null
}

export function briefEventInWindow(label: string, briefDate: string, today: string, end: string): boolean {
  const range=briefEventRange(label,briefDate)
  return range!==null&&range.end>=today&&range.start<=end
}

/** Whole-token match on the canonical ticker (e.g. MU must not match MUSK; 2330.TW matches 2330). */
export function mentionsTicker(upperText: string, topic: string): boolean {
  const ticker=topic.toUpperCase().replace(/\.TWO?$/,"")
  if (!ticker) return false
  const escaped=ticker.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")
  return new RegExp(`(^|[^A-Z0-9])${escaped}(?=$|[^A-Z0-9])`).test(upperText)
}

/** Prefer research whose topic already appears in today's brief; otherwise keep source order. */
export function researchForToday<T extends { topic: string }>(research: readonly T[], haystack: string, limit = 3): T[] {
  const upper = haystack.toUpperCase()
  const hits = research.filter(item => mentionsTicker(upper, item.topic))
  return (hits.length ? hits : [...research]).slice(0, limit)
}

/** Split a registered `next_catalyst` string into the event and what it should answer. */
export function splitCatalyst(raw: string): { event: string; verify: string } {
  const body=raw.replace(/^~?\d{4}-\d{2}(?:-\d{2})?\s*/,"").replace(/^\([A-Za-z]{3}\)\s*/,"")
  const dash=body.search(/\s[—–-]\s|—/)
  const head=dash===-1?body:body.slice(0,dash)
  const tail=dash===-1?"":body.slice(dash).replace(/^\s*[—–-]\s*/,"")
  return { event: head.split(/[（(;；]/)[0].trim().slice(0,120), verify: tail.trim().slice(0,160) }
}

type TimelineItem = { key: string; date: string; estimated: boolean; topic: string; title: string; verify: string; raw: string; sources: string[] }

/** One list: registered events from the wiki and the brief's next-7-days rows, same day + same ticker folded into one line. */
export function buildTimeline(data: InvestmentWatch, brief: InvestmentBrief | undefined, today: string, end: string): TimelineItem[] {
  const items: TimelineItem[] = data.catalysts
    .filter(e=>e.date_precision==="day"&&e.date!==null&&e.date>=today&&e.date<=end)
    .map(e=>{const parts=splitCatalyst(e.raw); return {key:e.id,date:e.date!,estimated:e.estimated,topic:e.topic,title:parts.event||e.topic,verify:parts.verify||parts.event,raw:e.raw,sources:[`${e.source.path}${e.source.updated?` · ${e.source.updated}`:""}`]}})
  if (brief?.date) {
    for (const [i,e] of brief.upcoming.entries()) {
      const range=briefEventRange(e.date_label,brief.date)
      if (!range||range.end<today||range.start>end) continue
      // A range that began before today still matters today; list it on today, keep the label in the raw text.
      const shown=range.start<today?today:range.start
      const text=`${e.event} ${e.check}`.toUpperCase()
      const match=items.find(item=>item.date===shown&&item.sources.length===1&&mentionsTicker(text,item.title))
      if (match) { match.verify=match.verify?`${match.verify}；簡報：${e.check}`:e.check; match.sources.push(`簡報 ${brief.date}`); continue }
      items.push({key:`brief:${i}`,date:shown,estimated:false,topic:e.event,title:e.event,verify:e.check,raw:`${e.date_label} ${e.event}`,sources:[`簡報 ${brief.date}`]})
    }
  }
  return items.sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title))
}
