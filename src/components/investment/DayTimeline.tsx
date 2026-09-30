import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { InlineText } from "./ReadingText"
import { sourceTimestamp } from "@/lib/investmentFormat"
import { BRIEF_SESSION_LABELS, BRIEF_SESSION_SCHEDULES, type InvestmentBrief, type InvestmentMarketObservation, type InvestmentTimelineNode } from "@/lib/investment"
import { MarketObservations } from "./MarketObservations"

const CLOCK = new Intl.DateTimeFormat("zh-TW", {
  hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Taipei",
})
const DAY = new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric", timeZone: "Asia/Taipei" })

/** Clock time in Taipei; the full timestamp stays available on hover. */
function clock(at: string): string {
  const parsed = new Date(at)
  return Number.isNaN(parsed.getTime()) ? at : CLOCK.format(parsed)
}

function dayLabel(at: string): string | null {
  const parsed = new Date(at)
  return Number.isNaN(parsed.getTime()) ? null : DAY.format(parsed)
}

function timelineAt(node: InvestmentTimelineNode): string {
  return node.timeline_at || node.at
}

function nodeTitle(node: InvestmentTimelineNode): string {
  if (node.kind === "brief") return node.session ? BRIEF_SESSION_LABELS[node.session] ?? node.session : "定版簡報"
  if (node.scan_mode === "quick" && node.market_scope === "tw") return "台股消息快掃"
  if (node.scan_mode === "quick" && node.market_scope === "us") return "美股消息快掃"
  if (node.scan_mode === "deep") return "持倉深度掃描"
  return "盤中更新"
}

function nodeReceipt(node: InvestmentTimelineNode): string | null {
  if (node.kind === "brief") {
    const schedule = BRIEF_SESSION_SCHEDULES[node.session ?? ""]
    const scheduleLabel = schedule ? `${schedule} · ` : ""
    return node.generated_at
      ? `${scheduleLabel}實際產出 ${clock(node.generated_at)} 台北`
      : `${scheduleLabel}產出時間未記錄`
  }
  if (node.scan_mode !== "quick") return null
  const date = node.market_date === "unknown" || !node.market_date
    ? "市場日期待核對"
    : `${node.market_scope === "tw" ? "台股" : node.market_scope === "us" ? "美股" : "市場"}交易日 ${node.market_date}`
  const completed = node.scan_completed_at || node.observed_at
  const coverage = node.coverage_state === "partial" ? "部分來源" : node.coverage_state === "complete" ? "來源核對完成" : "覆蓋狀態未提供"
  return `${date} · 完成 ${clock(completed)} 台北 · ${coverage}`
}

function nodeKey(node: InvestmentTimelineNode): string {
  return node.kind === "brief" ? `brief:${node.at}:${node.path}` : `update:${node.id}`
}

/** Split only explicit numbered targets, without guessing from ticker mentions. */
export function TargetText({ text }: { text: string }) {
  const markers = [...text.matchAll(/[①②③④⑤⑥⑦⑧⑨⑩]/g)]
  if (markers.length < 2 || markers[0].index === undefined) return <InlineText text={text} />
  const items = markers.map((marker, index) => text.slice(marker.index! + marker[0].length,
    index + 1 < markers.length ? markers[index + 1].index : text.length).trim())
  if (items.some(item => !item)) return <InlineText text={text} />
  const intro = text.slice(0, markers[0].index).trim()
  return <>{intro ? <span><InlineText text={intro} /></span> : null}<ul className="flex list-disc flex-col gap-1 pl-5">{items.map((item, index) => <li key={index}><InlineText text={item} /></li>)}</ul></>
}

/**
 * A brief's events, the four columns the producer writes. One block per event
 * rather than a flat run of bold labels -- the labels were what made a day read
 * as stacked fragments.
 *
 * Thesis/risk rows enter this story only through the brief event's canonical
 * story_id. Rows without a matching story identity stay in the separate source
 * section so no date or wording match is inferred across projections.
 */
type LinkedBriefRows = { thesis: InvestmentBrief["thesis_changes"]; risks: InvestmentBrief["risks"] }

function EventRows({ events, linkedRows }: {
  events: Extract<InvestmentTimelineNode, { kind: "brief" }>['events']
  linkedRows: Map<string, LinkedBriefRows>
}) {
  return <ul className="flex min-w-0 flex-col gap-4">
    {events.map((event, index) => <li key={index} className="flex min-w-0 flex-col gap-1 border-l-2 border-line-soft pl-3">
      <p className="text-body font-medium leading-relaxed text-ink"><InlineText text={event.event} /></p>
      {event.market_reaction ? <p className="text-body leading-relaxed text-ink-2"><span className="text-ink-3">市場反應 · </span><InlineText text={event.market_reaction} /></p> : null}
      {event.interpretation ? <p className="text-body leading-relaxed text-ink-2"><span className="text-ink-3">市場在定價什麼 · </span><InlineText text={event.interpretation} /></p> : null}
      {event.impact ? <div className="text-body leading-relaxed text-ink-2"><span className="text-ink-3">對持倉 · </span><TargetText text={event.impact} /></div> : null}
      {event.today ? <p className="text-body leading-relaxed text-ink-2"><span className="text-ink-3">當下 · </span><InlineText text={event.today} /></p> : null}
      {event.story_id && linkedRows.has(event.story_id) ? <div className="flex min-w-0 flex-col gap-2 border-t border-line-soft pt-2">
        <p className="text-caption font-medium text-ink-3">同一故事的論點與風險</p>
        {linkedRows.get(event.story_id)?.thesis.length ? <ul className="flex list-disc flex-col gap-1 pl-5 text-body leading-relaxed text-ink-2">{linkedRows.get(event.story_id)!.thesis.map((row, rowIndex) => <li key={`thesis-${rowIndex}`}><span className="font-medium text-ink">{row.thesis}</span>{row.change ? <> · {row.change}</> : null}{row.reason ? <p className="text-caption text-ink-3">依據：{row.reason}</p> : null}</li>)}</ul> : null}
        {linkedRows.get(event.story_id)?.risks.length ? <ul className="flex list-disc flex-col gap-1 pl-5 text-body leading-relaxed text-ink-2">{linkedRows.get(event.story_id)!.risks.map((row, rowIndex) => <li key={`risk-${rowIndex}`}><span className="text-warn">{row.risk}</span>{row.status ? <p className="text-caption text-ink-3">{row.status}</p> : null}</li>)}</ul> : null}
      </div> : null}
    </li>)}
  </ul>
}

function NodeBody({ node, linkedRows, showMarketObservations }: { node: InvestmentTimelineNode; linkedRows: Map<string, LinkedBriefRows>; showMarketObservations: boolean }) {
  if (node.kind === "update" && node.information_kind === "market_observation") return showMarketObservations ? <MarketObservations observations={[node as InvestmentMarketObservation]} /> : null
  if (node.kind === "update") return <div className="flex min-w-0 flex-col gap-2">
    <p className="text-body leading-relaxed text-ink-2"><InlineText text={node.summary} /></p>
    {node.portfolio_impact && node.portfolio_impact.trim() !== node.summary.trim() ? <div className="text-body leading-relaxed text-ink-2"><span className="text-ink-3">對持倉 · </span><TargetText text={node.portfolio_impact} /></div> : null}
    {node.action ? <details className="text-body leading-relaxed text-ink-2"><summary className="cursor-pointer text-caption text-ink-3">這筆更新的原始提醒</summary>
      <p className="pt-2"><span className="text-ink-3">當下 · </span><InlineText text={node.action} /></p>
    </details> : null}
  </div>
  return <div className="flex min-w-0 flex-col gap-3">
    {node.headline ? <p className="text-body leading-relaxed text-ink-2"><InlineText text={node.headline} /></p> : null}
    {node.events.length ? <EventRows events={node.events} linkedRows={linkedRows} /> : null}
    {showMarketObservations && node.market_observations?.length ? <MarketObservations observations={node.market_observations} /> : null}
  </div>
}

function TimelineRow({ node, latest, open, showDay, showMarketObservations, onToggle, linkedRows }: {
  node: InvestmentTimelineNode
  latest: boolean
  open: boolean
  showDay: boolean
  showMarketObservations: boolean
  onToggle: () => void
  linkedRows: Map<string, LinkedBriefRows>
}) {
  const displayAt = timelineAt(node)
  const day = showDay ? dayLabel(displayAt) : null
  const receipt = nodeReceipt(node)
  const lede = node.kind === "brief" ? node.headline : node.summary
  return <li className="relative flex min-w-0 gap-3 pb-4 last:pb-0">
    <div className="absolute bottom-0 left-[5px] top-[18px] w-px bg-line-soft" aria-hidden="true" />
    <span aria-hidden="true" className={`relative z-10 mt-[7px] h-[11px] w-[11px] shrink-0 rounded-full border-2 ${latest ? "border-accent bg-accent" : "border-line bg-bg"}`} />
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <button type="button" aria-expanded={open} onClick={onToggle}
        className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-left">
        <span className="shrink-0 text-body font-medium tabular-nums text-ink" title={sourceTimestamp(displayAt)}>{day ? `${day} ` : ""}{clock(displayAt)}</span>
        <span className="shrink-0 text-caption text-ink-3">{nodeTitle(node)}</span>
        {node.kind === "update" && node.scan_mode === "quick" && node.coverage_state === "partial" ? <Chip tone="warn">部分核對</Chip> : null}
        {node.kind === "update" && node.scan_mode === "quick" && node.market_date === "unknown" ? <Chip tone="warn">市場日期待核對</Chip> : null}
        {node.kind === "brief" && node.events.length ? <Chip tone="info">{node.events.length} 則事件</Chip> : null}
        {node.kind === "brief" && node.market_observations?.length ? <Chip tone="mute">{node.market_observations.length} 則市場讀數</Chip> : null}
        {node.kind === "update" && node.information_kind === "market_observation" ? <Chip tone="mute">市場讀數</Chip> : null}
        {latest ? <Chip tone="ok">最新</Chip> : null}
        <span className="shrink-0 text-caption text-ink-3">{open ? "收合" : "展開"}</span>
      </button>
      <p className="text-caption text-ink-3">{node.source_cutoff ? `資訊截至 ${sourceTimestamp(node.source_cutoff)}` : "資訊截止未記錄"}</p>
      {receipt ? <details className="text-caption text-ink-3"><summary className="cursor-pointer py-1">版本與來源時間</summary><p className="pt-1">{receipt}</p></details> : null}
      {open
        ? <div className="min-w-0"><NodeBody node={node} linkedRows={linkedRows} showMarketObservations={showMarketObservations} /></div>
        : lede ? <p className="min-w-0 truncate text-body text-ink-3"><InlineText text={lede} /></p> : null}
    </div>
  </li>
}

/**
 * One trading cycle as one line, newest first.
 *
 * The producer sends the cycle oldest-first because that is the order it
 * happened; this reverses it for reading, since the reader opens the board to
 * find where things stand now and then walks back through how the day got
 * there. Order is the only thing presentation changes -- nothing is merged,
 * re-grouped, or inferred from wording.
 *
 * Open the newest point by default. Older formal baseline content stays one
 * click away instead of repeating a full morning brief below the latest scan.
 * Defaults are recomputed when a new point arrives; user toggles are retained.
 */
export function DayTimeline({ nodes, brief, showMarketObservations = true }: { nodes: InvestmentTimelineNode[]; brief?: InvestmentBrief; showMarketObservations?: boolean }) {
  const [toggled, setToggled] = useState<ReadonlySet<string>>(() => new Set())
  if (!nodes.length) return null
  const newestFirst = [...nodes].reverse()
  const latestBrief = newestFirst.find((node): node is Extract<InvestmentTimelineNode, { kind: "brief" }> => node.kind === "brief")
  const linkedRows = new Map<string, LinkedBriefRows>()
  if (brief) {
    for (const row of brief.thesis_changes) {
      const storyId = typeof row.event_index === "number" ? brief.events[row.event_index]?.story_id?.trim() : ""
      if (!storyId) continue
      const entry = linkedRows.get(storyId) ?? { thesis: [], risks: [] }
      entry.thesis.push(row)
      linkedRows.set(storyId, entry)
    }
    for (const row of brief.risks) {
      const storyId = typeof row.event_index === "number" ? brief.events[row.event_index]?.story_id?.trim() : ""
      if (!storyId) continue
      const entry = linkedRows.get(storyId) ?? { thesis: [], risks: [] }
      entry.risks.push(row)
      linkedRows.set(storyId, entry)
    }
  }
  const days = new Set(nodes.map(node => dayLabel(timelineAt(node))).filter(Boolean))
  const spansDays = days.size > 1
  return <Card className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
      <h3 className="text-body font-medium text-ink">{spansDays ? "這一輪" : "這一天"}</h3>
      <p className="text-caption text-ink-3">{nodes.length} 個時點{spansDays ? `，橫跨 ${days.size} 個日期` : ""}，由新到舊</p>
    </div>
    <ul className="flex min-w-0 flex-col">
      {newestFirst.map((node, index) => {
        const key = nodeKey(node)
        const openByDefault = index === 0
        return <TimelineRow
          key={key}
          node={node}
          latest={index === 0}
          showDay={spansDays}
          showMarketObservations={showMarketObservations}
          linkedRows={node === latestBrief ? linkedRows : new Map()}
          open={toggled.has(key) ? !openByDefault : openByDefault}
          onToggle={() => setToggled(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
          })}
        />
      })}
    </ul>
  </Card>
}
