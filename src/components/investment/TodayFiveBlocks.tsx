import type { ReactNode } from "react"
import { Card, CardSection, Field, FieldList } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { type InvestmentBrief, type InvestmentTodayUpdate, type InvestmentTodayView } from "@/lib/investment"
import type { TodayUpdate, TodayUpdateStatus } from "@/lib/investmentTodayUpdate"
import { taipeiCalendarToday, taipeiClock, validatedBriefJudgment } from "@/lib/investmentFormat"
import { buildTodayStories, todayStoryHeadline } from "@/lib/investmentToday"
import { InlineText, splitSentences } from "./ReadingText"
import { MarketPulse } from "./MarketPulse"
import { StockMomentum } from "./StockMomentum"
import { instant, newestTime, useTodayMarketData } from "@/lib/investmentTodayMarket"

/** Today as five blocks. Blocks 1-4 render from the manual update when one
 * exists for today, otherwise from the daily brief. The only status text is one
 * failure line at the top of block 1. When the newest content is from an earlier
 * day it is still shown, and its time carries the date.
 * Each block is its own full-width section: a large title, then its content
 * across the page width. Block 5 is the market and momentum view with its own
 * market switch and sort order.
 * Text is shown as bullet points, one sentence each. Colour marks state and role
 * only: orange bullets for what a text means for the view or the holdings and
 * for the chip on what is due today, amber for what would overturn the view and
 * for the chip on a date that has passed, blue chips for holdings. */

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

const ROW = "grid min-w-0 grid-cols-1 gap-x-8 gap-y-3 border-t border-line-soft py-5 first:border-0 first:pt-0 last:pb-0"
const BODY = "text-body leading-relaxed text-ink-2"
/** Body text that carries a conclusion: same size, full ink. */
const STRONG = "text-body leading-relaxed text-ink"
/** The line a row or story is about. */
const HEADLINE = "text-section font-semibold leading-relaxed text-ink"

/** What a text is for. `accent` is what it means for the view or the holdings,
 * `warn` is what would overturn the view; everything else is `plain`. */
type Tone = "plain" | "accent" | "warn"
const MARKER: Record<Tone, string> = { plain: "marker:text-ink-4", accent: "marker:text-accent", warn: "marker:text-warn" }
/** A column title or cell label. The column that carries the conclusion is set heavier. */
const LABEL = "text-caption text-ink-3"
const LABEL_STRONG = "text-caption font-semibold text-ink"

function PointList({ sentences, tone, className }: { sentences: string[]; tone: Tone; className?: string }) {
  return <ul data-slot="points" className={`flex min-w-0 list-disc flex-col gap-1.5 pl-5 ${MARKER[tone]} ${className ?? ""}`}>
    {sentences.map((sentence, index) => <li key={index}><InlineText text={sentence} /></li>)}
  </ul>
}

/** Text as bullet points, one sentence each, with markers in the tone's colour.
 * A single sentence stays a paragraph unless `always` is set, which keeps the
 * cells of one column on the same left edge. */
function Points({ text, tone = "plain", always = false, className }: { text: string; tone?: Tone; always?: boolean; className?: string }) {
  const sentences = splitSentences(text)
  if (sentences.length < (always ? 1 : 2)) return <p className={className}><InlineText text={text} /></p>
  return <PointList sentences={sentences} tone={tone} className={className} />
}

/** Column titles for a list of rows, shown from `lg` up, where the rows are laid
 * out in the same columns. `accent` names the column that carries the conclusion. */
function ColumnHeads({ columns, labels, accent }: { columns: string; labels: string[]; accent?: string }) {
  return <div className={`mb-5 hidden gap-x-8 border-b border-line pb-2 lg:grid ${columns}`}>
    {labels.map(label => <span key={label} className={label === accent ? LABEL_STRONG : LABEL}>{label}</span>)}
  </div>
}

/** One cell of a row: its text as bullet points. Below `lg` the column titles
 * are hidden, so the cell carries its own label. */
function Cell({ label, text, tone = "plain" }: { label: string; text: string | null | undefined; tone?: Tone }) {
  const value = text?.trim()
  return <div className="flex min-w-0 flex-col gap-1">
    <span className={`${tone === "accent" ? LABEL_STRONG : LABEL} lg:hidden`}>{label}</span>
    {value ? <Points text={value} tone={tone} always className={tone === "accent" ? STRONG : BODY} /> : <p className="text-body text-ink-4">{DASH}</p>}
  </div>
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

/** The view itself. Its first sentence is the largest text on the page after the
 * block titles; the sentences after it follow as bullet points. */
function Lead({ text }: { text: string | null | undefined }) {
  const [first, ...rest] = splitSentences(text ?? "")
  return <div className="flex min-w-0 flex-col gap-3">
    <p className="text-num font-semibold leading-relaxed text-ink">{first ? <InlineText text={first} /> : DASH}</p>
    {rest.length ? <PointList sentences={rest} tone="accent" className="text-section leading-relaxed text-ink" /> : null}
  </div>
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
        <Lead text={view.text} />
        {view.changed === false && checked !== null && asOf !== null && checked > asOf ? <p className="text-caption leading-relaxed text-ink-2">{dayClock(view.checked_at, now)} 檢查過，看法不變</p> : null}
        {view.change_note || view.overturn ? <FieldList className="grid grid-cols-1 gap-x-8 gap-y-4 border-t border-line-soft pt-4 sm:grid-cols-2">
          {view.change_note ? <Field label={<Chip tone="accent">和上一版的差別</Chip>} className="gap-2"><Points text={view.change_note} tone="accent" always /></Field> : null}
          {view.overturn ? <Field label={<Chip tone="warn">什麼會改變這個看法</Chip>} className="gap-2"><Points text={view.overturn} tone="warn" always /></Field> : null}
        </FieldList> : null}
      </BlockCard>
    </Block>
  }
  const reading = currentJudgmentReading(b, today)
  return <Block index={1} title="今天怎麼做" time={reading ? dayClock(reading.at, now) : null}>
    <BlockCard>
      {failure ? <FailureLine update={failure} shownAt={reading?.at} now={now} /> : null}
      <Lead text={reading?.text} />
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
        <ColumnHeads columns={CONCLUSION_COLUMNS} labels={["之前關注的事", "當時預期", "結果", "結論"]} accent="結論" />
        <ul className="flex min-w-0 flex-col">
          {items.map((item, index) => <li key={`${item.watch_id ?? item.watched}:${index}`} className={`${ROW} ${CONCLUSION_COLUMNS}`}>
            <div className="flex min-w-0 flex-col items-start gap-2">
              <p className={HEADLINE}>{item.watched}</p>
              {item.changes_view ? <Chip tone="accent">改變了今天的看法</Chip> : null}
            </div>
            <Cell label="當時預期" text={item.expected} />
            <Cell label="結果" text={item.result} />
            <Cell label="結論" tone="accent" text={item.conclusion} />
          </li>)}
        </ul>
      </div> : <Empty>沒有新的結論</Empty>}
    </BlockCard>
  </Block>
}

// 3 · 今天發生了什麼 ---------------------------------------------------------

const STORY_COLUMNS = "lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]"
const IMPACT_LABEL = "對持倉的影響"
const HEADLINE_LINK = "underline decoration-ink-5 underline-offset-4 hover:decoration-accent"

function updateTime(update: InvestmentTodayUpdate): string | null {
  return update.update_kind === "source_supplement" ? update.observed_at : update.scan_completed_at || update.observed_at
}

/** One story across the page: what happened on the left, what it means on the
 * right. `impactLabel` names the right side below `lg`, where there are no column titles. */
function Story({ headline, meta, summary, impact, impactLabel }: { headline: ReactNode; meta?: ReactNode; summary?: ReactNode; impact?: ReactNode; impactLabel?: string }) {
  return <li className={`${ROW} ${STORY_COLUMNS}`}>
    <div className="flex min-w-0 flex-col gap-2">
      <p className={HEADLINE}>{headline}</p>
      {summary}
      {meta ? <p className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-caption tabular-nums text-ink-3">{meta}</p> : null}
    </div>
    {impact ? <div className="flex min-w-0 flex-col gap-2">
      {impactLabel ? <span className={`${LABEL_STRONG} lg:hidden`}>{impactLabel}</span> : null}
      {impact}
    </div> : null}
  </li>
}

function NewsFromUpdate({ latest, now }: { latest: TodayUpdate; now: Date }) {
  return <Block index={3} title="今天發生了什麼" time={dayClock(newestTime(latest.news.map(item => item.added_at)), now)}>
    <BlockCard>
      {latest.news.length ? <div className="flex min-w-0 flex-col">
        <ColumnHeads columns={STORY_COLUMNS} labels={["發生了什麼", IMPACT_LABEL]} accent={IMPACT_LABEL} />
        <ul className="flex min-w-0 flex-col">{latest.news.map((item, index) => {
          const url = safeUrl(item.source_url)
          return <Story key={`${item.source_url}:${index}`}
            headline={url ? <a href={url} target="_blank" rel="noreferrer" className={HEADLINE_LINK}>{item.headline}</a> : item.headline}
            summary={item.summary.trim() ? <Points text={item.summary} always className={BODY} /> : undefined}
            meta={<span>{item.source_name} · {dayClock(item.added_at, now) ?? DASH}</span>}
            impactLabel={IMPACT_LABEL}
            impact={item.affects.length || item.effect ? <>
              {item.affects.length ? <p className="flex min-w-0 flex-wrap gap-1">{item.affects.map(ticker => <Chip key={ticker} tone="info">{ticker}</Chip>)}</p> : null}
              {item.effect ? <Points text={item.effect} tone="accent" always className={STRONG} /> : null}
            </> : undefined} />
        })}</ul>
      </div> : <Empty>沒有新的消息</Empty>}
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
            impactLabel={IMPACT_LABEL}
            impact={update.portfolio_impact?.trim() ? <Points text={update.portfolio_impact} tone="accent" always className={STRONG} /> : undefined} />
        })}
        {stories.map(story => {
          const reaction = story.events.map(({ event }) => event.market_reaction?.trim()).find(Boolean)
          return <Story key={story.key}
            headline={<InlineText text={todayStoryHeadline(story)} />}
            impact={reaction ? <Points text={reaction} always className={BODY} /> : undefined} />
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
const DATE_CELL = "text-section font-semibold tabular-nums text-ink"

/** One group of block 4, with its own heading and the number of rows in it. */
function WatchSection({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-4 border-t border-line-soft pt-6 first:border-0 first:pt-0">
    <h3 className="flex min-w-0 items-center gap-2 text-num font-semibold tracking-tight text-ink">{label}<Chip tone="mute">{count} 項</Chip></h3>
    <div className="flex min-w-0 flex-col">{children}</div>
  </div>
}

/** An event's date. One due today carries an orange chip; one whose date has
 * passed without a conclusion carries an amber one. The date itself stays in ink. */
function DueDate({ due, today }: { due: string | null; today: string }) {
  if (!due) return <p className="text-section tabular-nums text-ink-4">{DASH}</p>
  const day = /^\d{4}-\d{2}-\d{2}/.exec(due)?.[0]
  return <div className="flex min-w-0 flex-row flex-wrap items-center gap-2 lg:flex-col lg:items-start lg:gap-1">
    <p className={DATE_CELL}>{monthDay(due)}</p>
    {!day ? null : day === today ? <Chip tone="accent">今天</Chip> : day < today ? <Chip tone="warn">已過</Chip> : null}
  </div>
}

function AheadFromUpdate({ latest, now }: { latest: TodayUpdate; now: Date }) {
  const events = latest.watch.filter(item => item.kind === "event")
    .sort((left, right) => (left.due ?? "9999-99-99").localeCompare(right.due ?? "9999-99-99"))
  const research = latest.watch.filter(item => item.kind === "research")
  const today = taipeiCalendarToday(now)
  return <Block index={4} title="未來要關注的事" time={dayClock(latest.generated_at, now)}>
    <BlockCard>
      {events.length ? <WatchSection label="未來事件" count={events.length}>
        <ColumnHeads columns={EVENT_COLUMNS} labels={["日期", "要看什麼", "預期", "為什麼看"]} accent="為什麼看" />
        <ul className="flex min-w-0 flex-col">{events.map(item => <li key={item.id} className={`${ROW} ${EVENT_COLUMNS}`}>
          <DueDate due={item.due} today={today} />
          <p className={HEADLINE}>{item.question}</p>
          <Cell label="預期" text={item.expected} />
          <Cell label="為什麼看" tone="accent" text={item.why} />
        </li>)}</ul>
      </WatchSection> : null}
      {research.length ? <WatchSection label="研究選題" count={research.length}>
        <ColumnHeads columns={RESEARCH_COLUMNS} labels={["要研究什麼", "預期", "為什麼看"]} accent="為什麼看" />
        <ul className="flex min-w-0 flex-col">{research.map(item => <li key={item.id} className={`${ROW} ${RESEARCH_COLUMNS}`}>
          <p className={HEADLINE}>{item.question}</p>
          <Cell label="預期" text={item.expected} />
          <Cell label="為什麼看" tone="accent" text={item.why} />
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
      {upcoming.length ? <WatchSection label="未來事件" count={upcoming.length}>
        <ColumnHeads columns={BRIEF_EVENT_COLUMNS} labels={["時間", "事件", "要核對什麼"]} />
        <ul className="flex min-w-0 flex-col">{upcoming.map((row, index) => <li key={`upcoming:${index}`} className={`${ROW} ${BRIEF_EVENT_COLUMNS}`}>
          <p className={DATE_CELL}>{row.date_label.trim() || DASH}</p>
          <p className={HEADLINE}><InlineText text={row.event.trim()} /></p>
          <Cell label="要核對什麼" text={row.check} />
        </li>)}</ul>
      </WatchSection> : null}
      {risks.length ? <WatchSection label="研究選題" count={risks.length}>
        <ColumnHeads columns={BRIEF_RISK_COLUMNS} labels={["要研究什麼", "現況"]} />
        <ul className="flex min-w-0 flex-col">{risks.map((row, index) => <li key={`risk:${index}`} className={`${ROW} ${BRIEF_RISK_COLUMNS}`}>
          <p className={HEADLINE}><InlineText text={row.risk} /></p>
          <Cell label="現況" text={row.status} />
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
    {note ? <BlockCard><Points text={note} tone="accent" className="text-section font-medium leading-relaxed text-ink" /></BlockCard> : null}
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
