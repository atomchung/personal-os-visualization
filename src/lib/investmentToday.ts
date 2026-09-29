import type { InvestmentBrief, InvestmentCatalysts30d, InvestmentTodayUpdate } from "./investment"

export type TodayStoryEvent = {
  event: InvestmentBrief["events"][number]
  event_index: number
}

export type TodayStory = {
  key: string
  story_id: string | null
  events: TodayStoryEvent[]
  updates: InvestmentTodayUpdate[]
}

/**
 * Merge only on the identity supplied by the Investment Note producer.
 * Missing identities deliberately stay as separate stories; presentation must
 * never infer equivalence from tickers, headlines, or similar wording.
 */
export function buildTodayStories(
  date: string | null,
  events: InvestmentBrief["events"],
  updates: InvestmentTodayUpdate[],
): TodayStory[] {
  const stories: TodayStory[] = []
  const byStoryId = new Map<string, TodayStory>()

  function findOrCreate(storyId: string | null, fallbackKey: string): TodayStory {
    const normalized = storyId?.trim() || null
    if (normalized) {
      const existing = byStoryId.get(normalized)
      if (existing) return existing
    }
    const story: TodayStory = {
      key: normalized ? `story:${normalized}` : fallbackKey,
      story_id: normalized,
      events: [],
      updates: [],
    }
    stories.push(story)
    if (normalized) byStoryId.set(normalized, story)
    return story
  }

  events.forEach((event, eventIndex) => {
    findOrCreate(event.story_id ?? null, `brief:${date ?? "unknown"}:${eventIndex}`)
      .events.push({ event, event_index: eventIndex })
  })

  updates.forEach((update) => {
    findOrCreate(update.story_id ?? null, `update:${update.id}`).updates.push(update)
  })

  return stories
}

/** The newest producer-ordered update is the current story state. */
export function todayStoryHeadline(story: TodayStory): string {
  if (story.updates.length) {
    return story.updates[0].summary.trim() || "最新摘要未提供"
  }
  return story.events[0]?.event.event.trim() || "今日事件"
}

/** Keep exact in-window dates separate from approximate dates and unknown windows. */
export function catalystDateGroups(projection?: InvestmentCatalysts30d | null) {
  if (!projection) return { exact: [], uncertain: [], state: "unknown" as const }
  const exact = projection.items.filter(item => item.date_precision === "day" && item.date !== null && item.window_membership === "within")
  return {
    exact,
    uncertain: [...projection.items.filter(item => !exact.includes(item)), ...projection.uncertain_items],
    state: projection.state,
  }
}

/** One plain reason a non-exact checkpoint or catalyst row isn't in the exact
 * (day-precision, in-window) list, derived only from fields the producer
 * already sent -- never inferred from ticker or title text. */
export function nonExactDateReason(item: { date_precision: string; date: string | null; window_membership: string }): string {
  if (item.date_precision === "month") return "只知月份"
  if (!item.date) return "日期未公布"
  if (item.window_membership !== "within") return "窗口關係未確認"
  return "日期精度未達日"
}

const LEGACY_IDENTITY_LIMITATION_RE = /(?:legacy|pool)?\s*登記缺明示事件\s*identity(?:[；;]?\s*未自動合併)?/i

/** True for the producer's "registration has no explicit event identity"
 * note (legacy or pool wording). A row whose state line already says it is
 * not linked to an event does not need this note a second time. */
export function isEventIdentityLimitation(text: string): boolean {
  return LEGACY_IDENTITY_LIMITATION_RE.test(text)
}

/** Producer limitation strings are shown as-is except for the "no explicit
 * event identity" phrase, which reads as an internal term; everything else
 * stays the producer's own wording. */
export function translateLegacyLimitation(text: string): string {
  return LEGACY_IDENTITY_LIMITATION_RE.test(text) ? "沒有對應的事件身份" : text
}

/** The producer's exact coverage-gap reason for a next_catalyst registration
 * whose date has already passed. */
export const EXPIRED_CATALYST_GAP_REASON = "next_catalyst 已過期"

/** Coverage gaps for "資料待整理", minus registrations that have simply
 * expired: the owner decided those can be discarded here, since keeping the
 * registrations current is Investment Note's own job. Every other reason
 * stays, word for word. */
export function withoutExpiredCatalystGaps<T extends { reason: string }>(gaps: readonly T[]): T[] {
  return gaps.filter(gap => gap.reason !== EXPIRED_CATALYST_GAP_REASON)
}

/** One plain reason for a "資料待整理" row: the producer's own limitations,
 * translated, or -- when there are none -- the fact that stands on its own:
 * this row has no event identity to anchor it. */
export function foldBReason(limitations: readonly string[]): string {
  const translated = limitations.map(translateLegacyLimitation).filter(Boolean)
  return translated.length ? translated.join("；") : "沒有對應的事件身份"
}

export type NonExactDateSplit<T> = { dated: T[]; undated: T[] }

/** Partition non-exact rows into "has some date information, just not an
 * exact in-window day" (fold A: 日期未定 -- e.g. only the month, or an
 * estimated day) vs "no usable date at all" (fold B: 資料待整理). The only
 * signal is whether the producer sent a non-blank `date` or `date_label`;
 * a missing event identity is a data-quality note, not a reason to hide an
 * upcoming event. Never merges rows by ticker, date or text similarity. */
export function splitNonExactByDateInfo<T>(items: readonly T[]): NonExactDateSplit<T> {
  const dated: T[] = []
  const undated: T[] = []
  for (const item of items) {
    const { date, date_label: label } = item as { date?: unknown; date_label?: unknown }
    const hasDate = [date, label].some(value => typeof value === "string" && value.trim() !== "")
    ;(hasDate ? dated : undated).push(item)
  }
  return { dated, undated }
}

export type TodayCheckpoint = {
  source: "brief" | "catalyst"
  relationship: "unlinked"
  date: string
  text: string
  check: string | null
  sourceLocation: string | null
}

/** Prefer the brief's explicit checkpoint; otherwise use only an exact, in-window
 * canonical catalyst. No ticker, date, or prose relation to an action is inferred. */
export function todayCheckpoint(brief: InvestmentBrief, projection?: InvestmentCatalysts30d | null): TodayCheckpoint | null {
  const upcoming = brief.upcoming[0]
  if (upcoming) return {
    source: "brief",
    relationship: "unlinked",
    date: upcoming.date_label || "日期未提供",
    text: upcoming.event,
    check: upcoming.check || null,
    sourceLocation: null,
  }
  const item = catalystDateGroups(projection).exact[0]
  if (!item) return null
  return {
    source: "catalyst",
    relationship: "unlinked",
    date: item.date ?? item.date_label ?? "日期未提供",
    text: [item.ticker, item.type || "事件類型未提供", item.raw].filter(Boolean).join(" · "),
    check: null,
    sourceLocation: item.source ? `${item.source.path}${item.source.line ? `:${item.source.line}` : ""}` : null,
  }
}


// Compatibility surfaces retained from reviewed shared inputs.
/**
 * Source-owned prose is anchored to its own market/session date, not the date
 * the reader happens to open the page. Missing or malformed dates stay
 * relative rather than inventing a session date.
 */
export function anchorRelativeDay(text: string, sourceDate: string | null): string {
  if (!sourceDate || !/^\d{4}-\d{2}-\d{2}$/.test(sourceDate)) return text
  const parsed = new Date(`${sourceDate}T00:00:00.000Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== sourceDate) return text

  const datedMarketDay = (market: string) => `${sourceDate} ${market}交易日`
  return text
    .replace(/台股今天/g, datedMarketDay("台股"))
    .replace(/今天台股/g, datedMarketDay("台股"))
    .replace(/美股今天/g, datedMarketDay("美股"))
    .replace(/今天美股/g, datedMarketDay("美股"))
    .replace(/台股今日/g, datedMarketDay("台股"))
    .replace(/今日台股/g, datedMarketDay("台股"))
    .replace(/美股今日/g, datedMarketDay("美股"))
    .replace(/今日美股/g, datedMarketDay("美股"))
    .replace(/今天/g, `${sourceDate} 當日`)
    .replace(/今日/g, `${sourceDate} 當日`)
}

/** Resolve an observed timestamp to its Taiwan calendar date for the UI. */
export function taipeiCalendarDate(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return null
  const timestamp = new Date(value)
  if (!Number.isFinite(timestamp.getTime())) return null
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(timestamp).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function staleBriefStatusText(date: string | null, sessionLabel: string | null, cutoff: string): string {
  return `目前沿用 ${date ?? "日期未提供"} · ${sessionLabel ?? "版次未標示"}；資訊截至 ${cutoff}。`
}
