const VALUE_FORMAT = new Intl.NumberFormat("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const CHANGE_FORMAT = new Intl.NumberFormat("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero" })
const TIME_FORMAT = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false })
const DAY_FORMAT = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "2-digit", day: "2-digit" })
const DATE_FORMAT = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" })
const SOURCE_TIME_FORMAT = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })

/** Taipei clock time; never mistake the same month/day in another year for today. */
export function quoteTime(value: string | null, now = new Date()): string {
  if (!value) return "時間未知"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "時間未知"
  const day = DATE_FORMAT.format(date)
  if (day === DATE_FORMAT.format(now)) return TIME_FORMAT.format(date)
  const sameYear = day.split("/")[0] === DATE_FORMAT.format(now).split("/")[0]
  return `${sameYear ? DAY_FORMAT.format(date) : day} ${TIME_FORMAT.format(date)}`
}

export function formatNumber(value: number | null, signed = false): string {
  if (value === null || !Number.isFinite(value)) return "—"
  return (signed ? CHANGE_FORMAT : VALUE_FORMAT).format(value)
}

/** Preserve date-only precision and upstream unknown; never substitute a fetch time. */
export function sourceTimestamp(value: string | null | undefined): string {
  if (!value || value === "unknown") return "未提供"
  const day = value.slice(0, 10)
  const date = new Date(`${day}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day) return "時間未能辨識"
  if (value === day) return day
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value)) return "時間未能辨識"
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) return "時間未能辨識"
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return `${value.replace("T", " ")}（未註明時區）`
  const parts = Object.fromEntries(SOURCE_TIME_FORMAT.formatToParts(timestamp).map(part => [part.type, part.value]))
  return `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute} 台北`
}

const PURE_NO_CHANGE_ACTIONS = new Set(["沒有新資訊", "暫無新資訊", "無新資訊", "不重複升級"])
/** Presentation-only: preserve source order, numbers, negation and distinct wording. */
export function briefActions(actions: readonly string[]): string[] {
  const seen = new Set<string>()
  return actions.filter(action => {
    const key = action.trim()
    if (!key || seen.has(key) || PURE_NO_CHANGE_ACTIONS.has(key.replace(/[。．.!！?？]+$/, ""))) return false
    seen.add(key)
    return true
  })
}

/** An unresolvable reference is unlinked content, not permission to discard it. */
export function groupBriefRows<T extends { event_index?: number | null }>(rows: readonly T[], eventCount: number): { byEvent: T[][]; unlinked: T[] } {
  const byEvent: T[][] = Array.from({ length: eventCount }, () => [])
  const unlinked: T[] = []
  for (const row of rows) {
    const index = row.event_index
    if (typeof index === "number" && Number.isInteger(index) && index >= 0 && index < eventCount) byEvent[index].push(row)
    else unlinked.push(row)
  }
  return { byEvent, unlinked }
}
