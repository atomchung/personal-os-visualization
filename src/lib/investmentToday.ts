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
  return story.updates[0]?.summary.trim() || story.events[0]?.event.event.trim() || "今日事件"
}
