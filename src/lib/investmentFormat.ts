import type { ActionItemStatus, InvestmentActionItem, InvestmentBrief, InvestmentTodayView } from "./investment"

const VALUE_FORMAT = new Intl.NumberFormat("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const CHANGE_FORMAT = new Intl.NumberFormat("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero" })
const TIME_FORMAT = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false })
const DAY_FORMAT = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "2-digit", day: "2-digit" })
const DATE_FORMAT = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" })
const SOURCE_TIME_FORMAT = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
export const NARRATIVE_FALSIFIER_UNAVAILABLE_COPY = "此讀取資料未提供獨立的明確推翻條件欄位；挑戰訊號不等同於推翻條件。"

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

export function narrativeSignalSections<T extends { direction: "supports" | "challenges" }>(
  signals: T[],
  explicitFalsifiers: string[] = [],
) {
  return {
    challengeSignals: signals.filter(signal => signal.direction === "challenges"),
    supportSignals: signals.filter(signal => signal.direction === "supports"),
    explicitFalsifiers,
  }
}

export function narrativeDisplayState<T extends string>(
  narrativeState: T | null | undefined,
  evidenceState: T | null | undefined,
  dataState: T | null | undefined,
): T | null | undefined {
  return narrativeState ?? evidenceState ?? dataState
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

export type TodayActionEntry = {
  key: string
  text: string
  origin: "update" | "brief"
  date: string | null
  source: string | null
  id: string | null
}

export type TodayActionPlan = {
  actions: TodayActionEntry[]
  research: TodayActionEntry[]
  coverageMessage: string | null
  emptyMessage: string
}

/** Keep every next step reachable and make an empty list meaningful only when
 * both the current formal brief and the current-day update feed are complete. */
export function todayActionPlan(
  brief: InvestmentBrief,
  today?: InvestmentTodayView,
  readFailed = false,
): TodayActionPlan {
  const actions: TodayActionEntry[] = []
  const research: TodayActionEntry[] = []
  const seen = new Set<string>()
  const add = (input: Omit<TodayActionEntry, "key" | "kind">) => {
    const normalized = input.text.replace(/[*_`~]/g, "").trim()
    const text = normalized.replace(/^(?:繼續觀察|觀察|行動)[：:]\s*/, "").trim()
    if (!text || !briefActions([text]).length || seen.has(text)) return
    seen.add(text)
    const isResearch = /^(?:補研究|补研究)(?:[：:]|\s|$)/.test(text)
    const entry = { ...input, key: `${input.origin}:${input.id ?? text}`, text }
    ;(isResearch ? research : actions).push(entry)
  }
  for (const update of today?.updates ?? []) {
    if (update.action.trim()) add({ text: update.action, origin: "update", date: update.observed_at, source: update.source_path || null, id: update.id })
  }
  if (brief.action_items?.length) {
    for (const item of brief.action_items) {
      add({ text: item.text, origin: "brief", date: item.date || brief.date, source: item.source || brief.source?.title || "正式簡報", id: item.id })
    }
  } else {
    for (const [index, text] of brief.actions.entries()) {
      add({ text, origin: "brief", date: brief.date, source: brief.source?.title || "正式簡報", id: `legacy-${index + 1}` })
    }
  }

  const limitations = [...new Set([...(brief.source?.limitations ?? []), ...(brief.envelope?.limitations ?? []), ...(today?.limitations ?? [])].filter(Boolean))]
  let coverageMessage: string | null = null
  if (readFailed) coverageMessage = "這次更新讀取失敗；以下保留上次資料，不能確認是否有新增行動。"
  else if (brief.state === "missing" || brief.source?.state === "missing") coverageMessage = "今日簡報來源尚未取得，無法確認完整的下一步行動。"
  else if (brief.state === "invalid" || brief.source?.state === "invalid") coverageMessage = "今日簡報部分內容未能辨識；空白欄位不代表沒有行動。"
  else if (brief.state === "stale" || brief.source?.state === "stale") coverageMessage = "目前是較早的簡報；不能用空白欄位判定最新行動。"
  else if (brief.envelope?.completeness === "partial") coverageMessage = "今日簡報資料不完整；空白欄位不代表沒有行動。"
  else if (brief.envelope?.completeness === "unavailable") coverageMessage = "無法確認今日簡報資料是否完整。"
  else if (today?.state === "partial") coverageMessage = "盤中更新資料不完整；空白欄位不代表沒有新增行動。"
  else if (today?.state === "unavailable") coverageMessage = "目前無法確認簡報後是否有新增行動。"
  else if (!today) coverageMessage = "尚未取得今日更新狀態；目前只列出簡報中的行動。"
  else if (brief.state !== "current" || brief.envelope?.completeness !== "ready" || (brief.source && brief.source.state !== "current")) coverageMessage = "簡報來源未明示完整度；空白欄位不代表沒有行動。"
  else if (limitations.length) coverageMessage = "來源列有尚未完成的資料項目；請展開查看。"

  const emptyMessage = coverageMessage
    ? "目前未讀到可確認的立即行動。"
    : research.length
      ? `已確認沒有列出立即行動；另有 ${research.length} 項補研究，請展開查看。`
      : "已確認本版簡報與今日更新沒有列出下一步行動。"
  return { actions, research, coverageMessage, emptyMessage }
}

/** Keep structured next steps in source order; drop only pure no-information labels. */
export function visibleActionItems<T extends { text: string }>(items: readonly T[]): T[] {
  const kept = new Set(briefActions(items.map(item => item.text)))
  return items.filter(item => kept.has(item.text))
}

const ACTION_STATUS_LABEL: Record<ActionItemStatus, string> = {
  open: "尚未結案",
  "has-canonical-home": "已有判斷頁可承接",
  closed: "正式紀錄已寫下編號",
}

export function actionStatusLabel(status: ActionItemStatus): string {
  return ACTION_STATUS_LABEL[status]
}

/** Extra sentence for statuses that are easy to misread as done. */
export function actionStatusNote(status: ActionItemStatus): string | null {
  if (status === "has-canonical-home") return "這還不算完成。判斷頁已可承接，正式紀錄尚未寫下編號。"
  return null
}

export function isCanonicalActionId(value: string | undefined): boolean {
  return typeof value === "string" && value.startsWith("ai:")
}

export function openActionItems(items: readonly InvestmentActionItem[]): InvestmentActionItem[] {
  return items.filter(item => item.status === "open" || item.status === "has-canonical-home")
}

/** Drop items already shown in today's next steps, matching id or exact text. */
export function remainingActions(
  items: readonly InvestmentActionItem[],
  today: readonly { id?: string; text: string }[],
): InvestmentActionItem[] {
  const ids = new Set(today.map(item => item.id).filter((id): id is string => Boolean(id)))
  const texts = new Set(today.map(item => item.text.trim()).filter(Boolean))
  return openActionItems(items)
    .filter(item => !ids.has(item.id) && !texts.has(item.text.trim()))
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || a.id.localeCompare(b.id))
}

/** Keep source items; only hide older ones from the first screen. Missing dates stay visible. */
export function recentActions(items: readonly InvestmentActionItem[], asOf: string | null | undefined, days = 2): InvestmentActionItem[] {
  const end = asOf?.slice(0, 10)
  if (!end || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return [...items]
  const startDate = new Date(`${end}T00:00:00Z`)
  startDate.setUTCDate(startDate.getUTCDate() - days)
  const start = startDate.toISOString().slice(0, 10)
  return items.filter(item => !item.date || (item.date >= start && item.date <= end))
}

export function historyReadingOrder<T extends { id: string; date: string | null }>(items: readonly T[]): T[] {
  const dated = items.filter((item) => item.date).sort((a, b) => (b.date || "").localeCompare(a.date || "") || a.id.localeCompare(b.id))
  const undated = items.filter((item) => !item.date)
  return [...dated, ...undated]
}

export type WorkPanelView = "loading" | "error" | "stale" | "empty" | "ready"

/** Fetch-state discriminant so a failed first load is not rendered as an empty list. */
export function workPanelView(query: {
  isPending: boolean
  isError: boolean
  data?: { items?: readonly unknown[] } | null
}): WorkPanelView {
  if (query.data == null) return query.isError ? "error" : "loading"
  if (query.isError) return "stale"
  return (query.data.items?.length ?? 0) > 0 ? "ready" : "empty"
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
