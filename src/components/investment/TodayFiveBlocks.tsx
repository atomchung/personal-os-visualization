import type { ReactNode } from "react"
import { Card, CardSection, ReadingColumn, SectionHeading } from "@/components/ui/card"
import {
  type InvestmentBrief, type InvestmentTodayUpdate, type InvestmentTodayView,
} from "@/lib/investment"
import type { TodayUpdate, TodayUpdateStatus } from "@/lib/investmentTodayUpdate"
import { formatNumber, taipeiCalendarToday, taipeiClock, validatedBriefJudgment } from "@/lib/investmentFormat"
import { buildTodayStories, todayStoryHeadline } from "@/lib/investmentToday"
import { InlineText } from "./ReadingText"
import { instant, newestTime, useTodayMarketData } from "@/lib/investmentTodayMarket"

/** A second reading of Today as five blocks. Blocks 1-4 render from the
 * manual update when one exists for today, otherwise from the daily brief. The
 * only status text is one failure line at the top of block 1. When the newest
 * content is from an earlier day it is still shown, and its time carries the date. */

const DASH = "—"

function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null
  } catch {
    return null
  }
}

function monthDay(value: string): string {
  const match = /^\d{4}-(\d{2})-(\d{2})/.exec(value)
  return match ? `${Number(match[1])}/${Number(match[2])}` : value
}

/** `HH:MM` for a time on today's Taipei date and `M/D HH:MM` for any other day,
 * so content carried over from an earlier day says which day it is from. */
export function dayClock(value: string | null | undefined, now: Date): string | null {
  const at = instant(value)
  if (at === null) return null
  const day = taipeiCalendarToday(new Date(at))
  return day === taipeiCalendarToday(now) ? taipeiClock(value) : `${monthDay(day)} ${taipeiClock(value)}`
}

function signedPct(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? DASH : `${formatNumber(value, true)}%`
}

function BlockCard({ index, title, time, children }: { index: number; title: string; time: string | null; children: ReactNode }) {
  return <Card className="min-w-0" aria-label={title}>
    <CardSection>
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <SectionHeading><span className="pr-2 text-caption font-normal tabular-nums text-ink-3">{index}</span>{title}</SectionHeading>
        <span className="shrink-0 text-caption tabular-nums text-ink-3">{time ?? DASH}</span>
      </div>
      {children}
    </CardSection>
  </Card>
}

function Row({ title, secondary, links }: { title: ReactNode; secondary?: ReactNode; links?: string[] }) {
  return <li className="flex min-w-0 flex-col gap-1 border-t border-line-soft py-2 first:border-0 first:pt-0">
    <p className="text-body leading-relaxed text-ink">{title}</p>
    {secondary || links?.length ? <p className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-caption leading-relaxed text-ink-3">
      {secondary ? <span className="min-w-0">{secondary}</span> : null}
      {links?.map(url => <a key={url} href={url} target="_blank" rel="noreferrer" className="break-all text-accent underline underline-offset-2">{new URL(url).hostname} ↗</a>)}
    </p> : null}
  </li>
}

function SubLabel({ children }: { children: ReactNode }) {
  return <p className="text-caption font-medium text-ink-3">{children}</p>
}

// 1 · 今天怎麼做 ------------------------------------------------------------

function currentJudgmentReading(b: InvestmentBrief | undefined, today: InvestmentTodayView | undefined) {
  if (!b) return null
  const current = today?.current_judgment
  if (b.state === "current" && current?.effective_source === "last_successful_reassessment") {
    const delta = current.current_delta ?? current.effective_judgment
    if (delta?.judgment?.trim()) return { text: delta.judgment.trim(), at: delta.provenance?.assessed_at ?? current.latest_assessment?.assessed_at ?? null }
  }
  // A stale brief is the newest view the page has; it is shown with its own date.
  const formal = b.state === "current" || b.state === "stale" ? validatedBriefJudgment(b) : null
  if (formal) return { text: formal.judgment.trim(), at: b.generated_at ?? b.source_cutoff }
  return null
}

function FollowupLine({ label, text }: { label: string; text: string }) {
  return <p className="text-caption leading-relaxed text-ink-2"><span className="pr-2 text-ink-3">{label}</span>{text}</p>
}

/** `HH:MM 的更新沒有成功：<message>。以下是 HH:MM 的內容。` */
function FailureLine({ update, shownAt, now }: { update: TodayUpdateStatus; shownAt: string | null | undefined; now: Date }) {
  const message = (update.message?.trim() || "原因不明").replace(/[。.]+$/, "")
  const failedClock = dayClock(update.finished_at ?? update.started_at, now) ?? DASH
  return <p role="status" className="text-caption text-warn">{failedClock} 的更新沒有成功：{message}。以下是 {dayClock(shownAt, now) ?? DASH} 的內容。</p>
}

function JudgmentBlock({ b, today, update, now }: { b?: InvestmentBrief; today?: InvestmentTodayView; update?: TodayUpdateStatus; now: Date }) {
  const latest = update?.latest ?? null
  const failure = update?.state === "failed" ? update : null
  if (latest) {
    const { view } = latest
    const asOf = instant(view.as_of)
    const checked = instant(view.checked_at)
    return <BlockCard index={1} title="今天怎麼做" time={dayClock(view.as_of, now)}>
      {failure ? <FailureLine update={failure} shownAt={view.checked_at} now={now} /> : null}
      <p className="text-body font-medium leading-relaxed text-ink"><InlineText text={view.text} /></p>
      {view.changed === false && checked !== null && asOf !== null && checked > asOf ? <p className="text-caption leading-relaxed text-ink-2">{dayClock(view.checked_at, now)} 檢查過，看法不變</p> : null}
      {view.change_note ? <FollowupLine label="和上一版的差別" text={view.change_note} /> : null}
      {view.overturn ? <FollowupLine label="什麼會改變這個看法" text={view.overturn} /> : null}
    </BlockCard>
  }
  const reading = currentJudgmentReading(b, today)
  return <BlockCard index={1} title="今天怎麼做" time={reading ? dayClock(reading.at, now) : null}>
    {failure ? <FailureLine update={failure} shownAt={reading?.at} now={now} /> : null}
    <p className="text-body font-medium leading-relaxed text-ink">{reading ? <InlineText text={reading.text} /> : DASH}</p>
  </BlockCard>
}

// 2 · 之前關注的事，結論 -----------------------------------------------------

// Block 2 has no brief source by design: without an update it says there is no new conclusion.
function ConclusionsBlock({ b, update, now }: { b?: InvestmentBrief; update?: TodayUpdateStatus; now: Date }) {
  const latest = update?.latest ?? null
  const items = latest?.conclusions ?? []
  const time = latest ? dayClock(latest.generated_at, now) : b ? dayClock(b.generated_at ?? b.source_cutoff, now) : null
  return <BlockCard index={2} title="之前關注的事，結論" time={time}>
    {items.length ? <ul className="flex min-w-0 flex-col">
      {items.map((item, index) => <li key={`${item.watch_id ?? item.watched}:${index}`} className="flex min-w-0 flex-col gap-1 border-t border-line-soft py-2 first:border-0 first:pt-0">
        <p className="text-body leading-relaxed text-ink">{item.watched}{item.changes_view ? <span className="pl-2 text-caption text-accent">改變了今天的看法</span> : null}</p>
        {item.expected ? <FollowupLine label="當時預期" text={item.expected} /> : null}
        <FollowupLine label="結果" text={item.result} />
        <FollowupLine label="結論" text={item.conclusion} />
      </li>)}
    </ul> : <p className="text-body text-ink-2">沒有新的結論</p>}
  </BlockCard>
}

// 3 · 今天發生了什麼 ---------------------------------------------------------

function updateTime(update: InvestmentTodayUpdate): string | null {
  return update.update_kind === "source_supplement" ? update.observed_at : update.scan_completed_at || update.observed_at
}

function NewsFromUpdate({ latest, now }: { latest: TodayUpdate; now: Date }) {
  return <BlockCard index={3} title="今天發生了什麼" time={dayClock(newestTime(latest.news.map(item => item.added_at)), now)}>
    {latest.news.length ? <ul className="flex min-w-0 flex-col">
      {latest.news.map((item, index) => {
        const url = safeUrl(item.source_url)
        return <li key={`${item.source_url}:${index}`} className="flex min-w-0 flex-col gap-1 border-t border-line-soft py-2 first:border-0 first:pt-0">
          <p className="text-body leading-relaxed text-ink">{url ? <a href={url} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">{item.headline}</a> : item.headline}</p>
          <p className="text-caption tabular-nums text-ink-3">{item.source_name} · {dayClock(item.added_at, now) ?? DASH}</p>
          <p className="text-body leading-relaxed text-ink-2">{item.summary}</p>
          {item.affects.length ? <p className="text-caption leading-relaxed text-ink-3">{item.affects.join("、")}{item.effect ? <span className="pl-2 text-ink-2">{item.effect}</span> : null}</p> : null}
        </li>
      })}
    </ul> : <p className="text-body text-ink-2">沒有新的消息</p>}
  </BlockCard>
}

function StoriesBlock({ b, today, update, now }: { b?: InvestmentBrief; today?: InvestmentTodayView; update?: TodayUpdateStatus; now: Date }) {
  if (update?.latest) return <NewsFromUpdate latest={update.latest} now={now} />
  const updates = [...(today?.updates ?? [])]
    .filter(update => update.summary?.trim())
    .sort((left, right) => (instant(updateTime(right)) ?? -Infinity) - (instant(updateTime(left)) ?? -Infinity))
  const stories = b ? buildTodayStories(b.date, b.events, []) : []
  // Brief stories carry no time of their own. A brief that is not current labels
  // the block with its own time, so a newer update row cannot make its stories look newer.
  const briefAt = b?.generated_at ?? b?.source_cutoff
  const contentClock = dayClock(b && b.state !== "current" ? briefAt : newestTime([...updates.map(updateTime), briefAt]), now)
  return <BlockCard index={3} title="今天發生了什麼" time={contentClock}>
    {updates.length || stories.length ? <ul className="flex min-w-0 flex-col">
      {updates.map((update, index) => {
        const url = safeUrl(update.source_url)
        return <Row key={`${update.id}:${index}`}
          title={<><span className="pr-2 text-caption tabular-nums text-ink-3">{dayClock(updateTime(update), now) ?? DASH}</span><InlineText text={update.summary} /></>}
          secondary={update.portfolio_impact?.trim() ? <InlineText text={update.portfolio_impact} /> : undefined}
          links={url ? [url] : undefined} />
      })}
      {stories.map(story => {
        const reaction = story.events.map(({ event }) => event.market_reaction?.trim()).find(Boolean)
        return <Row key={story.key} title={<InlineText text={todayStoryHeadline(story)} />} secondary={reaction ? <InlineText text={reaction} /> : undefined} />
      })}
    </ul> : <p className="text-body text-ink-3">{DASH}</p>}
  </BlockCard>
}

// 4 · 未來要關注的事 ---------------------------------------------------------

function WatchItem({ item, showDue }: { item: TodayUpdate["watch"][number]; showDue: boolean }) {
  return <li className="flex min-w-0 flex-col gap-1 border-t border-line-soft py-2 first:border-0 first:pt-0">
    <p className="text-body leading-relaxed text-ink">{showDue && item.due ? <span className="pr-2 text-caption tabular-nums text-ink-3">{monthDay(item.due)}</span> : null}{item.question}</p>
    {item.expected ? <FollowupLine label="預期" text={item.expected} /> : null}
    {item.why ? <FollowupLine label="為什麼看" text={item.why} /> : null}
  </li>
}

function AheadFromUpdate({ latest, now }: { latest: TodayUpdate; now: Date }) {
  const events = latest.watch.filter(item => item.kind === "event")
    .sort((left, right) => (left.due ?? "9999-99-99").localeCompare(right.due ?? "9999-99-99"))
  const research = latest.watch.filter(item => item.kind === "research")
  const sections = [["未來事件", events, true], ["研究選題", research, false]] as const
  const shown = sections.filter(([, items]) => items.length)
  return <BlockCard index={4} title="未來要關注的事" time={dayClock(latest.generated_at, now)}>
    {shown.length ? shown.map(([label, items, showDue], index) => <div key={label} className={`flex min-w-0 flex-col gap-2 ${index > 0 ? "border-t border-line-soft pt-3" : ""}`}>
      <SubLabel>{label}</SubLabel>
      <ul className="flex min-w-0 flex-col">{items.map(item => <WatchItem key={item.id} item={item} showDue={showDue} />)}</ul>
    </div>) : <p className="text-body text-ink-2">目前沒有要追蹤的事</p>}
  </BlockCard>
}

function AheadBlock({ b, update, now }: { b?: InvestmentBrief; update?: TodayUpdateStatus; now: Date }) {
  if (update?.latest) return <AheadFromUpdate latest={update.latest} now={now} />
  const risks = (b?.risks ?? []).filter(row => row.risk.trim())
  const upcoming = (b?.upcoming ?? []).filter(row => row.event.trim())
  return <BlockCard index={4} title="未來要關注的事" time={dayClock(b?.generated_at ?? b?.source_cutoff, now)}>
    <div className="flex min-w-0 flex-col gap-2">
      <SubLabel>研究選題</SubLabel>
      {risks.length ? <ul className="flex min-w-0 flex-col">{risks.map((row, index) => <Row key={`risk:${index}`} title={<InlineText text={row.risk} />} secondary={row.status.trim() ? <InlineText text={row.status} /> : undefined} />)}</ul>
        : <p className="text-body text-ink-3">{DASH}</p>}
    </div>
    <div className="flex min-w-0 flex-col gap-2 border-t border-line-soft pt-3">
      <SubLabel>未來事件</SubLabel>
      {upcoming.length ? <ul className="flex min-w-0 flex-col">{upcoming.map((row, index) => <Row key={`upcoming:${index}`} title={<InlineText text={[row.date_label.trim(), row.event.trim()].filter(Boolean).join(" · ")} />} secondary={row.check.trim() ? <InlineText text={row.check} /> : undefined} />)}</ul>
        : <p className="text-body text-ink-3">{DASH}</p>}
    </div>
  </BlockCard>
}

// 5 · 盤面整理 ---------------------------------------------------------------

function Tile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="flex min-w-0 flex-col gap-1 rounded-lg border-[0.5px] border-line-soft p-3">
    <p className="text-caption text-ink-3">{label}</p>
    <p className="text-body font-semibold tabular-nums text-ink">{value}</p>
    {detail ? <p className="text-caption tabular-nums text-ink-2">{detail}</p> : null}
  </div>
}

const HOLDING_GRID = "grid grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] gap-x-3"

function MarketBlock({ note, now }: { note?: string | null; now: Date }) {
  const { twValue, twChange, twChangePct, usItems, holdings, reading, coverage, timeAt } = useTodayMarketData()
  return <BlockCard index={5} title="盤面整理" time={dayClock(timeAt, now)}>
    {note ? <p className="text-body leading-relaxed text-ink">{note}</p> : null}
    <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
      {twValue != null ? <Tile label="台股加權指數" value={formatNumber(twValue)} detail={`${formatNumber(twChange, true)} 點 · ${signedPct(twChangePct)}`} /> : null}
      {usItems.length ? <div className="flex min-w-0 flex-col gap-1 rounded-lg border-[0.5px] border-line-soft p-3">
        <p className="text-caption text-ink-3">美股</p>
        {usItems.map(item => <p key={item.symbol} className="flex min-w-0 justify-between gap-2 text-caption tabular-nums text-ink-2"><span className="min-w-0 truncate">{item.label}</span><span className="shrink-0">{signedPct(item.change_percent)}</span></p>)}
      </div> : null}
      {coverage && reading ? <Tile label="持倉與觀察" value={`${coverage.candidate_count} 檔`} detail={`強勢 ${reading.strong} 檔 · 持倉 ${coverage.holding_count} 檔`} /> : null}
    </div>
    {holdings.length ? <div className="flex min-w-0 flex-col">
      <div className={`${HOLDING_GRID} border-b border-line pb-2 text-caption text-ink-3`}><span>標的</span><span className="text-right">今天</span><span className="text-right">20 日</span><span className="text-right">相對強度</span></div>
      {holdings.map(row => <div key={row.symbol} className={`${HOLDING_GRID} border-b border-line-soft py-2 text-body tabular-nums text-ink-2 last:border-b-0`}>
        <span className="min-w-0 truncate font-medium text-ink">{row.symbol}</span>
        <span className="text-right">{signedPct(row.today)}</span>
        <span className="text-right">{signedPct(row.return20d)}</span>
        <span className="text-right">{signedPct(row.relativeStrength)}</span>
      </div>)}
    </div> : null}
  </BlockCard>
}

/** The status with `latest` dropped when it is older than the brief being shown,
 * so the newest content wins in every block: an earlier day's update, or a
 * same-day update generated before the brief. When either instant cannot be
 * read, only the calendar dates are compared. Without a brief date, only an
 * update for today's Taipei date is kept. */
export function currentTodayUpdate(b: InvestmentBrief | undefined, update: TodayUpdateStatus | undefined, now = new Date()): TodayUpdateStatus | undefined {
  const latest = update?.latest
  if (!update || !latest) return update
  if (!b?.date) return latest.date === taipeiCalendarToday(now) ? update : { ...update, latest: null }
  if (latest.date < b.date) return { ...update, latest: null }
  const updateAt = instant(latest.generated_at)
  const briefAt = instant(b.generated_at ?? b.source_cutoff)
  if (updateAt !== null && briefAt !== null && updateAt < briefAt) return { ...update, latest: null }
  return update
}

/** `now` fixes the clock for the date checks and the time labels; it defaults to the current time. */
export function TodayFiveBlocks({ b, today, update: received, now = new Date() }: { b?: InvestmentBrief; today?: InvestmentTodayView; update?: TodayUpdateStatus; now?: Date }) {
  const update = currentTodayUpdate(b, received, now)
  return <ReadingColumn className="flex min-w-0 flex-col gap-4 break-words">
    <JudgmentBlock b={b} today={today} update={update} now={now} />
    <ConclusionsBlock b={b} update={update} now={now} />
    <StoriesBlock b={b} today={today} update={update} now={now} />
    <AheadBlock b={b} update={update} now={now} />
    <MarketBlock note={update?.latest?.market_note} now={now} />
  </ReadingColumn>
}
