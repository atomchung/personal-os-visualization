import type { InvestmentBrief, InvestmentTodayUpdate } from "./investment"

export type TodayStoryEvent = {
  event: InvestmentBrief["events"][number]
  event_index: number
}

export type TodayStory = {
  key: string
  story_id: string | null
  events: TodayStoryEvent[]
  /** Kept in the producer's order, which places the newest update first. */
  updates: InvestmentTodayUpdate[]
}

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
    .replace(/今天/g, `${sourceDate} 當日`)
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

/**
 * Join only on explicit producer-owned identity. Brief events without an ID
 * and updates without an ID stay independent; wording and tickers are never
 * used to infer that two entries describe the same story.
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
