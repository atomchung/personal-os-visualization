import type { ReactNode } from "react"
import { Card, CardSection, Field, FieldList } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { type InvestmentBrief, type InvestmentTodayUpdate, type InvestmentTodayView } from "@/lib/investment"
import type { TodayUpdate, TodayUpdateStatus } from "@/lib/investmentTodayUpdate"
import { taipeiCalendarToday, taipeiClock, validatedBriefJudgment } from "@/lib/investmentFormat"
import { buildTodayStories, todayStoryHeadline } from "@/lib/investmentToday"
import { InlineText } from "./ReadingText"
import { MarketPulse } from "./MarketPulse"
import { StockMomentum } from "./StockMomentum"
import { instant, newestTime, useTodayMarketData } from "@/lib/investmentTodayMarket"

/** Today as five blocks. Blocks 1-4 render from the manual update when one
 * exists for today, otherwise from the daily brief. The only status text is one
 * failure line at the top of block 1. When the newest content is from an earlier
 * day it is still shown, and its time carries the date.
 * Each block is its own full-width section: a large title, then its content
 * across the page width. Block 5 is the market and momentum view with its own
 * market switch and sort order. */

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

/** One block: a large numbered title on the page background, then its content across the full width. */
function Block({ index, title, time, children }: { index: number; title: string; time: string | null; children: ReactNode }) {
  return <section data-slot="today-block" aria-label={title} className="flex min-w-0 flex-col gap-3">
    <header className="flex min-w-0 items-baseline justify-between gap-3">
      <h2 className="flex min-w-0 items-baseline gap-3 text-metric font-bold tracking-tight text-ink"><span className="tabular-nums text-accent">{index}</span>{title}</h2>
      <span className="shrink-0 text-caption tabular-nums text-ink-3">{time ?? DASH}</span>
    </header>
    {children}
  </section>
}

function BlockCard({ children }: { children: ReactNode }) {
  return <Card className="min-w-0"><CardSection className="gap-4 sm:p-6">{children}</CardSection></Card>
}

const ROW = "grid min-w-0 grid-cols-1 gap-x-8 gap-y-2 border-t border-line-soft py-4 first:border-0 first:pt-0 last:pb-0"

/** Column titles for a list of rows. Shown from `lg` up, where the rows are laid out in the same columns. */
function ColumnHeads({ columns, labels }: { columns: string; labels: string[] }) {
  return <div className={`hidden gap-x-8 border-b border-line pb-2 text-caption text-ink-3 lg:grid ${columns}`}>{labels.map(label => <span key={label}>{label}</span>)}</div>
}

/** One cell of a row. Below `lg` the column titles are hidden, so the cell carries its own label. */
function Cell({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-1">
    <span className="text-caption text-ink-3 lg:hidden">{label}</span>
    <div className="text-body leading-relaxed text-ink-2">{children}</div>
  </div>
}

function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-section font-semibold tracking-tight text-ink">{children}</h3>
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-body text-ink-3">{children}</p>
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

/** The view itself: the largest text on the page after the block titles. */
function Lead({ children }: { children: ReactNode }) {
  return <p className="text-num font-medium leading-relaxed text-ink">{children}</p>
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
    return <Block index={1} title="今天怎麼做" time={dayClock(view.as_of, now)}>
      <BlockCard>
        {failure ? <FailureLine update={failure} shownAt={view.checked_at} now={now} /> : null}
        <Lead><InlineText text={view.text} /></Lead>
        {view.changed === false && checked !== null && asOf !== null && checked > asOf ? <p className="text-caption leading-relaxed text-ink-2">{dayClock(view.checked_at, now)} 檢查過，看法不變</p> : null}
        {view.change_note || view.overturn ? <FieldList className="grid grid-cols-1 gap-x-8 gap-y-3 border-t border-line-soft pt-4 sm:grid-cols-2">
          {view.change_note ? <Field label="和上一版的差別">{view.change_note}</Field> : null}
          {view.overturn ? <Field label="什麼會改變這個看法">{view.overturn}</Field> : null}
        </FieldList> : null}
      </BlockCard>
    </Block>
  }
  const reading = currentJudgmentReading(b, today)
  return <Block index={1} title="今天怎麼做" time={reading ? dayClock(reading.at, now) : null}>
    <BlockCard>
      {failure ? <FailureLine update={failure} shownAt={reading?.at} now={now} /> : null}
      <Lead>{reading ? <InlineText text={reading.text} /> : DASH}</Lead>
    </BlockCard>
  </Block>
}

// 2 · 之前關注的事，結論 -----------------------------------------------------

const CONCLUSION_COLUMNS = "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.3fr)]"

// Block 2 has no brief source by design: without an update it says there is no new conclusion.
function ConclusionsBlock({ b, update, now }: { b?: InvestmentBrief; update?: TodayUpdateStatus; now: Date }) {
  const latest = update?.latest ?? null
  const items = latest?.conclusions ?? []
  const time = latest ? dayClock(latest.generated_at, now) : b ? dayClock(b.generated_at ?? b.source_cutoff, now) : null
  return <Block index={2} title="之前關注的事，結論" time={time}>
    <BlockCard>
      {items.length ? <div className="flex min-w-0 flex-col">
        <ColumnHeads columns={CONCLUSION_COLUMNS} labels={["之前關注的事", "當時預期", "結果", "結論"]} />
        <ul className="flex min-w-0 flex-col">
          {items.map((item, index) => <li key={`${item.watch_id ?? item.watched}:${index}`} className={`${ROW} ${CONCLUSION_COLUMNS}`}>
            <div className="flex min-w-0 flex-col items-start gap-2">
              <p className="text-body font-medium leading-relaxed text-ink">{item.watched}</p>
              {item.changes_view ? <Chip tone="accent">改變了今天的看法</Chip> : null}
            </div>
            <Cell label="當時預期">{item.expected ?? DASH}</Cell>
            <Cell label="結果">{item.result}</Cell>
            <Cell label="結論">{item.conclusion}</Cell>
          </li>)}
        </ul>
      </div> : <Empty>沒有新的結論</Empty>}
    </BlockCard>
  </Block>
}

// 3 · 今天發生了什麼 ---------------------------------------------------------

const STORY_COLUMNS = "lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]"
const HEADLINE = "text-section font-semibold leading-relaxed text-ink"
const HEADLINE_LINK = "underline decoration-ink-5 underline-offset-4 hover:decoration-accent"

function updateTime(update: InvestmentTodayUpdate): string | null {
  return update.update_kind === "source_supplement" ? update.observed_at : update.scan_completed_at || update.observed_at
}

/** One story across the page: what happened on the left, what it means for the holdings on the right. */
function Story({ headline, meta, summary, impact }: { headline: ReactNode; meta?: ReactNode; summary?: ReactNode; impact?: ReactNode }) {
  return <li className={`${ROW} ${STORY_COLUMNS}`}>
    <div className="flex min-w-0 flex-col gap-1">
      <p className={HEADLINE}>{headline}</p>
      {summary ? <p className="text-body leading-relaxed text-ink-2">{summary}</p> : null}
      {meta ? <p className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-caption tabular-nums text-ink-3">{meta}</p> : null}
    </div>
    {impact ? <div className="flex min-w-0 flex-col gap-2">{impact}</div> : null}
  </li>
}

function NewsFromUpdate({ latest, now }: { latest: TodayUpdate; now: Date }) {
  return <Block index={3} title="今天發生了什麼" time={dayClock(newestTime(latest.news.map(item => item.added_at)), now)}>
    <BlockCard>
      {latest.news.length ? <ul className="flex min-w-0 flex-col">
        {latest.news.map((item, index) => {
          const url = safeUrl(item.source_url)
          return <Story key={`${item.source_url}:${index}`}
            headline={url ? <a href={url} target="_blank" rel="noreferrer" className={HEADLINE_LINK}>{item.headline}</a> : item.headline}
            summary={item.summary}
            meta={<span>{item.source_name} · {dayClock(item.added_at, now) ?? DASH}</span>}
            impact={item.affects.length || item.effect ? <>
              {item.affects.length ? <p className="flex min-w-0 flex-wrap gap-1">{item.affects.map(ticker => <Chip key={ticker} tone="info">{ticker}</Chip>)}</p> : null}
              {item.effect ? <p className="text-body leading-relaxed text-ink-2">{item.effect}</p> : null}
            </> : undefined} />
        })}
      </ul> : <Empty>沒有新的消息</Empty>}
    </BlockCard>
  </Block>
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
  return <Block index={3} title="今天發生了什麼" time={contentClock}>
    <BlockCard>
      {updates.length || stories.length ? <ul className="flex min-w-0 flex-col">
        {updates.map((update, index) => {
          const url = safeUrl(update.source_url)
          return <Story key={`${update.id}:${index}`}
            headline={<InlineText text={update.summary} />}
            meta={<>
              <span>{dayClock(updateTime(update), now) ?? DASH}</span>
              {url ? <a href={url} target="_blank" rel="noreferrer" className="break-all text-accent underline underline-offset-2">{new URL(url).hostname} ↗</a> : null}
            </>}
            impact={update.portfolio_impact?.trim() ? <p className="text-body leading-relaxed text-ink-2"><InlineText text={update.portfolio_impact} /></p> : undefined} />
        })}
        {stories.map(story => {
          const reaction = story.events.map(({ event }) => event.market_reaction?.trim()).find(Boolean)
          return <Story key={story.key}
            headline={<InlineText text={todayStoryHeadline(story)} />}
            impact={reaction ? <p className="text-body leading-relaxed text-ink-2"><InlineText text={reaction} /></p> : undefined} />
        })}
      </ul> : <Empty>{DASH}</Empty>}
    </BlockCard>
  </Block>
}

// 4 · 未來要關注的事 ---------------------------------------------------------

const EVENT_COLUMNS = "lg:grid-cols-[4rem_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]"
const RESEARCH_COLUMNS = "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]"
const BRIEF_EVENT_COLUMNS = "lg:grid-cols-[minmax(0,12rem)_minmax(0,1.2fr)_minmax(0,1.4fr)]"
const BRIEF_RISK_COLUMNS = "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)]"
const QUESTION = "text-body font-medium leading-relaxed text-ink"
const DATE_CELL = "text-section font-semibold tabular-nums text-ink"

function WatchSection({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-3 border-t border-line-soft pt-5 first:border-0 first:pt-0">
    <SubHeading>{label}</SubHeading>
    <div className="flex min-w-0 flex-col">{children}</div>
  </div>
}

function AheadFromUpdate({ latest, now }: { latest: TodayUpdate; now: Date }) {
  const events = latest.watch.filter(item => item.kind === "event")
    .sort((left, right) => (left.due ?? "9999-99-99").localeCompare(right.due ?? "9999-99-99"))
  const research = latest.watch.filter(item => item.kind === "research")
  return <Block index={4} title="未來要關注的事" time={dayClock(latest.generated_at, now)}>
    <BlockCard>
      {events.length ? <WatchSection label="未來事件">
        <ColumnHeads columns={EVENT_COLUMNS} labels={["日期", "要看什麼", "預期", "為什麼看"]} />
        <ul className="flex min-w-0 flex-col">{events.map(item => <li key={item.id} className={`${ROW} ${EVENT_COLUMNS}`}>
          <p className={DATE_CELL}>{item.due ? monthDay(item.due) : DASH}</p>
          <p className={QUESTION}>{item.question}</p>
          <Cell label="預期">{item.expected ?? DASH}</Cell>
          <Cell label="為什麼看">{item.why ?? DASH}</Cell>
        </li>)}</ul>
      </WatchSection> : null}
      {research.length ? <WatchSection label="研究選題">
        <ColumnHeads columns={RESEARCH_COLUMNS} labels={["要研究什麼", "預期", "為什麼看"]} />
        <ul className="flex min-w-0 flex-col">{research.map(item => <li key={item.id} className={`${ROW} ${RESEARCH_COLUMNS}`}>
          <p className={QUESTION}>{item.question}</p>
          <Cell label="預期">{item.expected ?? DASH}</Cell>
          <Cell label="為什麼看">{item.why ?? DASH}</Cell>
        </li>)}</ul>
      </WatchSection> : null}
      {events.length || research.length ? null : <Empty>目前沒有要追蹤的事</Empty>}
    </BlockCard>
  </Block>
}

function AheadBlock({ b, update, now }: { b?: InvestmentBrief; update?: TodayUpdateStatus; now: Date }) {
  if (update?.latest) return <AheadFromUpdate latest={update.latest} now={now} />
  const risks = (b?.risks ?? []).filter(row => row.risk.trim())
  const upcoming = (b?.upcoming ?? []).filter(row => row.event.trim())
  return <Block index={4} title="未來要關注的事" time={dayClock(b?.generated_at ?? b?.source_cutoff, now)}>
    <BlockCard>
      {upcoming.length ? <WatchSection label="未來事件">
        <ColumnHeads columns={BRIEF_EVENT_COLUMNS} labels={["時間", "事件", "要核對什麼"]} />
        <ul className="flex min-w-0 flex-col">{upcoming.map((row, index) => <li key={`upcoming:${index}`} className={`${ROW} ${BRIEF_EVENT_COLUMNS}`}>
          <p className={DATE_CELL}>{row.date_label.trim() || DASH}</p>
          <p className={QUESTION}><InlineText text={row.event.trim()} /></p>
          <Cell label="要核對什麼">{row.check.trim() ? <InlineText text={row.check} /> : DASH}</Cell>
        </li>)}</ul>
      </WatchSection> : null}
      {risks.length ? <WatchSection label="研究選題">
        <ColumnHeads columns={BRIEF_RISK_COLUMNS} labels={["要研究什麼", "現況"]} />
        <ul className="flex min-w-0 flex-col">{risks.map((row, index) => <li key={`risk:${index}`} className={`${ROW} ${BRIEF_RISK_COLUMNS}`}>
          <p className={QUESTION}><InlineText text={row.risk} /></p>
          <Cell label="現況">{row.status.trim() ? <InlineText text={row.status} /> : DASH}</Cell>
        </li>)}</ul>
      </WatchSection> : null}
      {upcoming.length || risks.length ? null : <Empty>{DASH}</Empty>}
    </BlockCard>
  </Block>
}

// 5 · 盤面整理 ---------------------------------------------------------------

/** The market and momentum view the Investment page already had: the market
 * card switches between Taiwan and US, the holdings table sorts by market value,
 * 20-day return or relative strength. The update's note on the market leads it. */
function MarketBlock({ note, now }: { note?: string | null; now: Date }) {
  const { timeAt } = useTodayMarketData()
  return <Block index={5} title="盤面整理" time={dayClock(timeAt, now)}>
    {note ? <BlockCard><p className="text-section font-medium leading-relaxed text-ink">{note}</p></BlockCard> : null}
    <MarketPulse />
    <StockMomentum defaultAll />
  </Block>
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
  return <div data-slot="today-five-blocks" className="flex min-w-0 flex-col gap-10 break-words">
    <JudgmentBlock b={b} today={today} update={update} now={now} />
    <ConclusionsBlock b={b} update={update} now={now} />
    <StoriesBlock b={b} today={today} update={update} now={now} />
    <AheadBlock b={b} update={update} now={now} />
    <MarketBlock note={update?.latest?.market_note} now={now} />
  </div>
}
