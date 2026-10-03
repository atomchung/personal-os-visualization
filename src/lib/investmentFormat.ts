import type { ActionItemKind, ActionItemStatus, InvestmentActionItem, InvestmentActions, InvestmentBrief, InvestmentBriefJudgment, InvestmentBriefJudgmentClass, InvestmentLayerGap, InvestmentLayerReading, InvestmentNarrativeEvidenceLayer, InvestmentNarrativeLayerEvidence, InvestmentNarrativeLayerEvidenceItem, InvestmentNarrativeLayerPlayer, InvestmentNarrativeLayerRow, InvestmentNewsMarket, InvestmentRefreshStatus, InvestmentTodayView, InvestmentWork } from "./investment"

const VALUE_FORMAT = new Intl.NumberFormat("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const CHANGE_FORMAT = new Intl.NumberFormat("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero" })
const TIME_FORMAT = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false })
const DAY_FORMAT = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "2-digit", day: "2-digit" })
const DATE_FORMAT = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" })
const SOURCE_TIME_FORMAT = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
const TAIPEI_DATE_PARTS = new Intl.DateTimeFormat("en", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" })

export function taipeiCalendarToday(now = new Date()): string {
  const parts = TAIPEI_DATE_PARTS.formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? ""
  return `${part("year")}-${part("month")}-${part("day")}`
}

export function investmentReminderIsForToday(item: Pick<InvestmentWork, "kind" | "status" | "expires_on" | "promoted_to_today">, today: string): boolean {
  return item.kind === "watch" && item.status === "open" && (item.expires_on === today || item.promoted_to_today === true)
}

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

const TZ_QUALIFIED_DATETIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i

/** Epoch millis, but only for a string that unambiguously names one instant:
 * a full datetime (not date-only) carrying an explicit Z or numeric UTC
 * offset. A bare `Date.parse`/`new Date(...)` silently accepts a date-only
 * or offset-less string too, as if it meant midnight UTC or the reader's
 * local zone -- exactly the ambiguity a freshness comparison must not paper
 * over, and exactly the shape a clock display must refuse to show a time for. */
function parseTimezoneQualifiedInstant(value: string | null | undefined): number | null {
  if (!value || !TZ_QUALIFIED_DATETIME_RE.test(value.trim())) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

/** HH:MM in Taipei only; null for a missing, date-only, offset-less, or
 * otherwise unparsable timestamp. Distinct from `quoteTime`/`sourceTimestamp`,
 * which also carry the date and tolerate a date-only or offset-less value. */
export function taipeiClock(value: string | null | undefined): string | null {
  const instant = parseTimezoneQualifiedInstant(value)
  return instant === null ? null : TIME_FORMAT.format(new Date(instant))
}

export function formatNumber(value: number | null, signed = false): string {
  if (value === null || !Number.isFinite(value)) return "—"
  return (signed ? CHANGE_FORMAT : VALUE_FORMAT).format(value)
}

export function marketIndexDirectionDisplay(
  status: string | null | undefined,
  change: number | null,
  changePercent: number | null,
) {
  if (status === "confirmed") return { state: "confirmed" as const, change, changePercent }
  return {
    state: status === "needs_review" ? "needs_review" as const : "unknown" as const,
    change: null,
    changePercent: null,
  }
}

/** Which Taiwan-tab block the page shows right now: the live intraday quote
 * ("open"/"closed_before_daily"/an "unknown" that still has a quote) or the
 * TWSE/TPEx close-of-day pulse ("closed_with_daily"), never both. */
export type TwSessionState = "open" | "closed_with_daily" | "closed_before_daily" | "unknown"

/**
 * Cross-references TWSE's own regular-session bounds (Yahoo chart meta
 * `currentTradingPeriod.regular`, threaded through by `core/investment_market.py`
 * as `session_start`/`session_end`) against the exchange date the TWSE/TPEx
 * close-of-day pulse already covers (`pulse.as_of`). No Taiwan holiday
 * calendar is consulted anywhere here or elsewhere in PersonalOS -- a day
 * this cannot place returns "unknown" rather than a guess dressed up as one
 * of the other three states.
 *
 * - `now` in `[regularStart, regularEnd)` *and* `quotedAt` is dated today's
 *   own Taipei date -> "open": the owner's own rule is "when the market is
 *   open, prioritize intraday". The same-day quote is required because
 *   Yahoo's bounds are not proof the exchange is trading today -- on a
 *   Taiwan holiday they can still read a normal 09:00-13:30 while the last
 *   real quote is days old.
 * - Without valid bounds at all, "closed" can never be confirmed -> "unknown",
 *   even with a quote or a daily pulse in hand -- a quote timestamp alone is
 *   not proof the session has ended.
 * - Otherwise (bounds valid, `now` outside them), the reference date starts
 *   as `quotedAt`'s own Taipei date, and only advances to `regularEnd`'s own
 *   date once `now` has passed it *and* there is also a same-day quote --
 *   i.e. today is confirmed to have actually traded, so a stale quote cannot
 *   make an out-of-date pulse look caught up to a close that really
 *   happened. Without a same-day quote (a holiday whose bounds still read a
 *   normal session, or simply no quote yet today), the reference never gets
 *   forced past the quote's own day -- today's nominal bounds alone are not
 *   treated as a close that actually happened. `dailyAsOf >= reference`
 *   means the close-of-day pulse has caught up to that reference session ->
 *   "closed_with_daily"; a still-lagging pulse keeps the page on the
 *   intraday number instead of showing an older close as if it were
 *   current -> "closed_before_daily".
 * - No reference date at all -> "unknown".
 */
export function classifyTwSession(input: {
  now: number
  regularStart: string | null | undefined
  regularEnd: string | null | undefined
  quotedAt: string | null | undefined
  dailyAsOf: string | null | undefined
}): TwSessionState {
  // A non-finite "now" (a caller bug, a bad Date.parse upstream, etc.) must
  // never be silently treated as "outside the session" -- that would let an
  // indeterminate instant fall through to a confident closed_with_daily /
  // closed_before_daily below.
  if (!Number.isFinite(input.now)) return "unknown"
  const start = input.regularStart ? Date.parse(input.regularStart) : NaN
  const end = input.regularEnd ? Date.parse(input.regularEnd) : NaN
  const boundsValid = Number.isFinite(start) && Number.isFinite(end) && start < end

  const quotedMs = input.quotedAt ? Date.parse(input.quotedAt) : NaN
  const quotedDate = Number.isFinite(quotedMs) ? taipeiCalendarToday(new Date(quotedMs)) : null
  // Evidence today actually traded: a quote dated today's own Taipei date.
  // Yahoo's regular-session bounds are not that evidence by themselves -- on
  // a Taiwan holiday they can still read a normal 09:00-13:30 while the last
  // real quote is days old.
  const quoteIsToday = quotedDate !== null && quotedDate === taipeiCalendarToday(new Date(input.now))
  if (boundsValid && start <= input.now && input.now < end && quoteIsToday) return "open"
  // Without valid bounds we cannot confirm the session is not open right now
  // -- a quote timestamp alone is not proof of "closed" (Yahoo can omit
  // `currentTradingPeriod.regular` on an otherwise-valid quote). Stay
  // "unknown" rather than assert a close we have no evidence for.
  if (!boundsValid) return "unknown"

  // From here, bounds are valid and `now` is confirmed outside [start, end).
  // The reference date starts as the quote's own date. It only advances to
  // today's own close date once `now` has passed `end` *and* we also have
  // same-day evidence trading happened (`quoteIsToday`) -- that is what lets
  // a stale quote be recognized as behind a just-confirmed close on a real
  // trading day (finding: a matching stale pulse must not be misread as
  // caught up to a close that only the stale quote's own day evidences).
  // Without that same-day evidence -- a Taiwan holiday whose bounds still
  // read a normal session, or simply no quote from today yet -- the
  // reference never gets forced past the quote's own day: today's nominal
  // bounds alone are not treated as a close that actually happened.
  let reference = quotedDate
  if (input.now >= end && quoteIsToday) {
    const endDate = taipeiCalendarToday(new Date(end))
    if (reference === null || endDate > reference) reference = endDate
  }

  if (input.dailyAsOf && reference !== null && input.dailyAsOf >= reference) return "closed_with_daily"
  if (reference !== null) return "closed_before_daily"
  return "unknown"
}

/** Which of the two Taiwan-tab blocks is primary for a given state -- the
 * other one stays reachable behind a closed-by-default disclosure, never both
 * shown open at once. Intraday is primary by default (the owner's own rule:
 * prioritize intraday while the market is open); the close-of-day pulse only
 * takes over once it has caught up to the session ("closed_with_daily"), or
 * when the state cannot be determined and there is no intraday quote left to
 * fall back to either -- the pulse is then the only thing left to show. */
export function primaryTwBlock(state: TwSessionState, hasIntradayQuote: boolean): "intraday" | "daily" {
  if (state === "closed_with_daily") return "daily"
  if (state === "unknown" && !hasIntradayQuote) return "daily"
  return "intraday"
}

/**
 * Whether to keep refetching the close-of-day pulse right now.
 *
 * - `closed_before_daily` always polls: today's session is confirmed closed
 *   but the pulse has not caught up to it at all yet.
 * - `closed_with_daily` polls only while there is still something concrete
 *   to wait for: the pulse's own readiness field (`pulse.state` from
 *   `core/investment_pulse.py` -- "ready" | "partial" | "unavailable", never
 *   inferred from any individual missing number) is not yet "ready", *and*
 *   the pulse actually covers today's Taipei date (a partial pulse for an
 *   older day is not waiting on anything new), *and* the Taipei clock is
 *   still before 18:00 (a cutoff past which a still-missing source, e.g.
 *   TPEx after TWSE published, is treated as final for the day rather than
 *   polled forever). Any one of those failing stops the polling.
 * - Every other state (`open`, `unknown`) never polls.
 */
export function shouldPollTwPulse(input: {
  sessionState: TwSessionState
  pulseState: "ready" | "partial" | "unavailable" | undefined
  pulseAsOf: string | null | undefined
  now: number
}): boolean {
  if (input.sessionState === "closed_before_daily") return true
  if (input.sessionState !== "closed_with_daily") return false
  if (input.pulseState === "ready") return false
  const nowDate = new Date(input.now)
  // Checking the constructed Date's own validity (rather than
  // `Number.isFinite(input.now)` alone) also catches a finite but
  // out-of-range instant, e.g. `Number.MAX_VALUE`: finite, but
  // `new Date(...)` still yields an Invalid Date, whose `.toISOString()`
  // below would otherwise throw instead of failing safe.
  if (Number.isNaN(nowDate.getTime())) return false
  if (!input.pulseAsOf || input.pulseAsOf !== taipeiCalendarToday(nowDate)) return false
  const clock = taipeiClock(nowDate.toISOString())
  return clock !== null && clock < "18:00"
}

/** Exact wording the owner asked for: a state word, a timestamp people can
 * check against a clock, and (for the two "closed" states) the source that
 * timestamp is measured in -- never a close-of-day number silently reused as
 * if it were current, and never an intraday number silently reused as a close. */
export function twSessionLabel(
  state: TwSessionState,
  quotedAt: string | null | undefined,
  dailyAsOf: string | null | undefined,
): string {
  if (state === "open") {
    const clock = taipeiClock(quotedAt)
    return clock ? `盤中 ${clock} · Yahoo（有延遲）` : "盤中 · Yahoo（有延遲）"
  }
  if (state === "closed_with_daily") return dailyAsOf ? `收盤 ${dailyAsOf} · TWSE/TPEx 日結` : "收盤 · TWSE/TPEx 日結"
  if (state === "closed_before_daily") return "已收盤 · 日結資料尚未公布"
  return "時段未知"
}

export const NARRATIVE_FALSIFIER_UNAVAILABLE_COPY = "此讀取資料未提供獨立的明確推翻條件欄位；挑戰訊號不等同於推翻條件。"

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

/** Split one evidence layer into the groups the layer card renders. Structured
 * records come from `evidence` when the producer sends it (its supporting and
 * opposing arrays then repeat the same records); older producers only send
 * `supporting`/`opposing`, where plain strings are legacy source records. */
export function layerEvidenceGroups(layer: Pick<InvestmentNarrativeEvidenceLayer, "evidence" | "supporting" | "opposing" | "challenging" | "unknown">) {
  const supporting = layer.supporting ?? []
  const opposing = [...(layer.opposing ?? []), ...(layer.challenging ?? [])]
  const normalize = (item: InvestmentNarrativeLayerRow | InvestmentNarrativeLayerEvidence, side: "supports" | "challenges" | "unknown" = "unknown"): InvestmentNarrativeLayerEvidence => {
    const full = item as Partial<InvestmentNarrativeLayerEvidence>
    return {
      evidence_id: item.evidence_id ?? "", pillar_id: item.pillar_id ?? "",
      entity_id: item.entity_id ?? "", entity_ticker: full.entity_ticker ?? null, player: item.player ?? "來源未提供玩家",
      evidence_type: full.evidence_type ?? "unknown", numeric_state: full.numeric_state ?? "unknown",
      numeric_value: full.numeric_value ?? null, unit: full.unit ?? null,
      source_date: full.source_date ?? item.evidence_date ?? null, evidence_date: item.evidence_date,
      source_type: item.source_type ?? "", source_url: item.source_url ?? null,
      // Group membership is an explicitly authored direction; it is never
      // inferred from a ticker, title, date or prose. An explicit polarity wins.
      polarity: item.polarity ?? side, explanation: item.explanation ?? "",
      as_of: item.as_of ?? null, recorded_at: item.recorded_at ?? null,
      freshness: item.freshness ?? "unknown", valid_until: item.valid_until ?? null,
      source: item.source ?? null, state: item.state === "unlinked" ? "unknown" : item.state ?? "unknown",
      limitations: item.limitations ?? [],
    }
  }
  const records = (items: InvestmentNarrativeLayerEvidenceItem[], side: "supports" | "challenges" | "unknown") => items.flatMap(item => typeof item === "string" ? [] : [normalize(item, side)])
  const principal = (layer.evidence ?? []).map(item => normalize(item))
  const branches = [...records(supporting, "supports"), ...records(opposing, "challenges"), ...records(layer.unknown ?? [], "unknown")]
  // Suppress only an explicitly identified, identical repeated record. Extra
  // branch rows and anonymous rows stay visible; no prose similarity matching.
  const authoredKey = (item: InvestmentNarrativeLayerEvidence) => item.evidence_id ? `${item.pillar_id}:${item.evidence_id}:${JSON.stringify(item)}` : null
  const shown = new Set(principal.map(authoredKey).filter(key => key !== null))
  const evidence = [...principal, ...branches.filter(item => {
    const key = authoredKey(item)
    if (key && shown.has(key)) return false
    if (key) shown.add(key)
    return true
  })]
  return {
    evidence,
    supporting: evidence.filter(item => item.polarity === "supports"),
    challenging: evidence.filter(item => item.polarity === "challenges"),
    unknown: evidence.filter(item => item.polarity === "unknown"),
    legacySupporting: supporting.filter((item): item is string => typeof item === "string"),
    legacyOpposing: opposing.filter((item): item is string => typeof item === "string"),
    legacyUnknown: (layer.unknown ?? []).filter((item): item is string => typeof item === "string"),
  }
}

export type LayerEntityEvidenceGroup = {
  entityId: string
  players: InvestmentNarrativeLayerPlayer[]
  evidence: InvestmentNarrativeLayerEvidence[]
}

/** Group player and evidence rows only by the producer's exact entity_id.
 * Names, tickers, dates and prose never create a relationship. */
export function layerEntityEvidenceGroups(layer: Pick<InvestmentNarrativeEvidenceLayer, "players" | "evidence" | "supporting" | "opposing" | "challenging" | "unknown">) {
  const groups = new Map<string, LayerEntityEvidenceGroup>()
  const getGroup = (entityId: string) => {
    let group = groups.get(entityId)
    if (!group) {
      group = { entityId, players: [], evidence: [] }
      groups.set(entityId, group)
    }
    return group
  }
  const unlinkedPlayers: InvestmentNarrativeLayerPlayer[] = []
  for (const player of layer.players ?? []) {
    if (!player.entity_id.trim()) unlinkedPlayers.push(player)
    else getGroup(player.entity_id).players.push(player)
  }
  const unlinkedEvidence: InvestmentNarrativeLayerEvidence[] = []
  for (const item of layerEvidenceGroups(layer).evidence) {
    if (!item.entity_id.trim()) unlinkedEvidence.push(item)
    else getGroup(item.entity_id).evidence.push(item)
  }
  return { groups: [...groups.values()], unlinkedPlayers, unlinkedEvidence }
}

export const LAYER_ENTITY_PAGE_SIZE = 20

/** Filter by producer-provided identity and record fields for direct lookup. */
export function filterLayerEntityGroups(groups: LayerEntityEvidenceGroup[], query: string) {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return groups
  return groups.filter(group => [
    group.entityId,
    ...group.players.map(player => player.player),
    ...group.evidence.flatMap(item => [item.player, item.entity_ticker ?? "", item.evidence_id, item.explanation]),
  ].some(value => value.toLocaleLowerCase().includes(needle)))
}

export function paginateLayerEntityGroups<T>(items: T[], requestedPage: number, pageSize = LAYER_ENTITY_PAGE_SIZE) {
  const size = Number.isFinite(pageSize) ? Math.max(1, Math.floor(pageSize)) : LAYER_ENTITY_PAGE_SIZE
  const pageCount = Math.max(1, Math.ceil(items.length / size))
  const page = Math.min(pageCount, Math.max(1, Math.floor(requestedPage) || 1))
  return {
    page,
    pageCount,
    pageSize: size,
    total: items.length,
    items: items.slice((page - 1) * size, page * size),
  }
}

export type LayerOpposingStatus = "有反方證據" | "查過沒找到" | "查得不完整" | "還沒查"

/** The opposing side of one layer in plain words, from two producer fields
 * only: any explicitly linked challenging record wins; otherwise the opposing
 * coverage receipt's own state. A missing, unknown or unavailable receipt is
 * "not checked yet" -- an empty challenge list never reads as "nothing found". */
export function layerOpposingStatus(challengeCount: number, coverageState: string | null | undefined): LayerOpposingStatus {
  if (challengeCount > 0) return "有反方證據"
  if (coverageState === "sufficient") return "查過沒找到"
  if (coverageState === "insufficient") return "查得不完整"
  return "還沒查"
}

/** One status line under a layer title. Records whose direction the producer
 * left unknown are named only when there are some, so a layer holding only
 * such records never reads as "支持 0・挑戰 0" and nothing else. */
export function layerStatusLine(
  counts: { supports: number; challenges: number; unknown?: number },
  coverageState: string | null | undefined,
): string {
  const unknown = counts.unknown ? `・方向未明 ${counts.unknown} 筆` : ""
  return `支持 ${counts.supports} 筆・挑戰 ${counts.challenges} 筆${unknown}・反方：${layerOpposingStatus(counts.challenges, coverageState)}`
}

/** A layer's own status line, counting exactly the records its card lists. */
export function layerStatusLineFor(layer: Pick<InvestmentNarrativeEvidenceLayer, "evidence" | "supporting" | "opposing" | "challenging" | "unknown" | "opposing_coverage">): string {
  const groups = layerEvidenceGroups(layer)
  return layerStatusLine({
    supports: groups.supporting.length + groups.legacySupporting.length,
    challenges: groups.challenging.length + groups.legacyOpposing.length,
    unknown: groups.unknown.length + groups.legacyUnknown.length,
  }, layer.opposing_coverage?.state)
}

/** The layer's AI-written reading when the producer supplied usable text.
 * A missing, blank or unusable reading returns null, so the card falls back
 * to the counted status line instead of an empty block. */
export function layerReadingText(value: Pick<InvestmentNarrativeEvidenceLayer, "current_reading"> | InvestmentLayerReading | null | undefined): string | null {
  const reading = value && "text" in value ? value : value?.current_reading
  const text = reading?.text
  return typeof text === "string" && text.trim() ? text.trim() : null
}

/** Provenance under a reading: missing dates and basis remain explicit. */
export function layerReadingCaption(reading: Pick<InvestmentLayerReading, "as_of" | "basis"> | null | undefined): string | null {
  if (!reading) return null
  const asOf = reading.as_of?.trim() || "日期未提供"
  const basis = reading.basis?.trim() || "未提供"
  return `AI 整理・${asOf}・依據：${basis}`
}

/** One closable gap: what is missing, what closes it, and by when. */
export function layerGapLine(gap: Pick<InvestmentLayerGap, "missing" | "closes_when" | "expected_by" | "overdue">): string {
  const missing = gap.missing?.trim() || "未提供"
  const closesWhen = gap.closes_when?.trim() || "未提供"
  const expectedBy = gap.expected_by?.trim() || "未提供"
  return `還缺：${missing}｜${closesWhen}・預計 ${expectedBy}${gap.overdue ? "・已過預計時間" : ""}`
}

const SENTENCE_END_RE = /。[*_」』）)"'’”]*|\.[*_」』）)"'’”]*(?=\s|$)/

/** The text up to and including its first sentence end: 「。」, or "." that is
 * followed by whitespace or the end of the text. Closing marks right after the
 * stop (`**`, 」, ）…) stay with the sentence, so Markdown emphasis that wraps
 * the whole sentence is not cut in half. Verbatim otherwise. */
export function firstSentence(text: string): string {
  const value = text.trim()
  const end = SENTENCE_END_RE.exec(value)
  return end ? value.slice(0, end.index + end[0].length) : value
}

export const NARRATIVE_NEXT_CHECKPOINT_UNLINKED = "來源沒有把下一個檢查點連到這個論點"
export const NARRATIVE_SUMMARY_UNAVAILABLE = "目前無法取得"
export const NARRATIVE_SUMMARY_STALE = "來源較舊，不列入目前判斷"
export const NARRATIVE_SUMMARY_DRIFT = "來源關聯不一致，不列入目前判斷"

export type NarrativeSummaryLine = {
  label: "現在的張力" | "最近一次記錄" | "接下來看" | "訊號"
  text: string
  /** A fixed stand-in rather than the source's own content. */
  muted: boolean
}

type NarrativeSummaryLabel = NarrativeSummaryLine["label"]
const NARRATIVE_SUMMARY_LABELS: readonly NarrativeSummaryLabel[] = ["現在的張力", "最近一次記錄", "接下來看", "訊號"]

/** Fixed stand-in for a summary source that is not explicitly available: an
 * old source and a conflicting one say so; anything else unreadable, unknown
 * or missing is "cannot be read right now" -- never "not recorded" or zero. */
function summaryStandIn(state: string | null | undefined): string {
  if (state === "stale") return NARRATIVE_SUMMARY_STALE
  if (state === "drift" || state === "conflict") return NARRATIVE_SUMMARY_DRIFT
  return NARRATIVE_SUMMARY_UNAVAILABLE
}

/** The four lines of the 目前判斷 block at the top of 我的判斷. Each line is
 * the producer's own text or a fixed template filled with existing fields,
 * and only from a source whose own state says it is available:
 * - 現在的張力: the tension text verbatim, only when that section is ready;
 * - 最近一次記錄: date + the full first sentence of the latest dated
 *   judgment, only when that record is ready or partial (the date and
 *   judgment are its own fields; partial concerns its links);
 * - 接下來看: a checkpoint the producer itself links to this narrative --
 *   never one paired by ticker, date or wording -- else a fixed line;
 * - 訊號: support/challenge counts, only from a non-empty signal list under
 *   a ready or partial evidence state. The producer builds that list from
 *   one table and flags an empty or unreadable table itself, so an empty
 *   list is never a confirmed zero.
 * `readable` is false when this read failed while earlier data is still on
 * the page: nothing from that earlier read is presented as current then. */
export function narrativeSummaryLines(input: {
  readable: boolean
  tension: { state: string; text: string | null } | null | undefined
  latest: { state: string; date: string | null; judgment: string | null } | null | undefined
  nextCheckpoint: string | null | undefined
  signals: { state: string; items: readonly { direction: "supports" | "challenges"; indicator: string }[] } | null | undefined
}): NarrativeSummaryLine[] {
  if (!input.readable) return NARRATIVE_SUMMARY_LABELS.map(label => ({ label, text: NARRATIVE_SUMMARY_UNAVAILABLE, muted: true }))

  const tensionText = input.tension?.text?.trim() || ""
  const tension = input.tension?.state === "ready" && tensionText
    ? { text: tensionText, muted: false }
    : { text: summaryStandIn(input.tension?.state), muted: true }

  const latestState = input.latest?.state
  const date = input.latest?.date?.trim() || ""
  const judgment = input.latest?.judgment?.trim() || ""
  const latest = (latestState === "ready" || latestState === "partial") && (date || judgment)
    ? { text: `${date ? sourceTimestamp(date) : "日期未提供"} · ${judgment ? firstSentence(judgment) : "當時判斷未提供"}`, muted: false }
    : { text: summaryStandIn(latestState), muted: true }

  const next = input.nextCheckpoint?.trim() || ""

  const signalState = input.signals?.state
  const signalItems = input.signals?.items ?? []
  let signals = { text: summaryStandIn(signalState), muted: true }
  if ((signalState === "ready" || signalState === "partial") && signalItems.length) {
    const supports = signalItems.filter(signal => signal.direction === "supports")
    const challenges = signalItems.filter(signal => signal.direction === "challenges")
    const firstSupport = supports[0]?.indicator.trim() || ""
    const firstChallenge = challenges[0]?.indicator.trim() || ""
    const firsts = [
      firstSupport ? `支持首條：${firstSupport}` : null,
      firstChallenge ? `挑戰首條：${firstChallenge}` : null,
    ].filter((item): item is string => Boolean(item))
    signals = { text: `支持 ${supports.length} 條・挑戰 ${challenges.length} 條${firsts.length ? ` · ${firsts.join("；")}` : ""}`, muted: false }
  }

  return [
    { label: "現在的張力", ...tension },
    { label: "最近一次記錄", ...latest },
    { label: "接下來看", text: next || NARRATIVE_NEXT_CHECKPOINT_UNLINKED, muted: !next },
    { label: "訊號", ...signals },
  ]
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

export type TodayJudgmentTimeMetadata = {
  judgmentLine: string
  sourceCutoffLine: string | null
  laterScanLine: string | null
}

/** Keep formal production time, accepted source cutoff, and a later incremental
 * scan receipt as three separate facts. A scan is associated with this brief
 * only when the producer explicitly binds it to the same generated_at instant. */
export function todayJudgmentTimeMetadata(
  brief: Pick<InvestmentBrief, "state" | "date" | "generated_at" | "source_cutoff" | "session">,
  today?: InvestmentTodayView,
): TodayJudgmentTimeMetadata {
  const sessionLabels: Record<string, string> = {
    "tw-open-prep": "台股開盤前判斷",
    "us-open-prep": "美股開盤前判斷",
  }
  const sessionLabel = (brief.session && sessionLabels[brief.session]) || "正式簡報判斷"
  const productionTime = taipeiClock(brief.generated_at)
  const productionLabel = productionTime ?? (brief.generated_at ? "時間未能辨識" : "時間未提供")
  const month = brief.date?.match(/^\d{4}-(\d{2})-(\d{2})$/)
  const shortDate = month ? `${Number(month[1])}/${Number(month[2])}` : brief.date
  const carried = brief.state === "stale" && shortDate ? `沿用 ${shortDate} ` : ""
  const judgmentLine = `${carried}${sessionLabel} · 更新 ${productionLabel}`
  const sourceCutoffLine = brief.source_cutoff ? `資料截至 ${sourceTimestamp(brief.source_cutoff)}` : null

  const marketKey = brief.session === "tw-open-prep" ? "tw" : brief.session === "us-open-prep" ? "us" : null
  const marketProjection = marketKey ? today?.intraday_refresh?.markets[marketKey] : undefined
  const receipt = marketProjection?.latest_receipt
  const producedAt = parseTimezoneQualifiedInstant(brief.generated_at)
  const receiptBaselineAt = parseTimezoneQualifiedInstant(receipt?.baseline_generated_at)
  const receiptFinishedAt = parseTimezoneQualifiedInstant(receipt?.finished_at)
  let laterScanLine: string | null = null
  if (receipt && producedAt !== null && receiptBaselineAt === producedAt && receiptFinishedAt !== null && receiptFinishedAt > producedAt) {
    const scanTime = taipeiClock(receipt.finished_at) ?? "時間未能辨識"
    const marketName = marketKey === "tw" ? "台股" : "美股"
    const resultCode = receipt.result ?? marketProjection?.state
    const failed = resultCode === "failed" || receipt.coverage_state === "failed"
    const partial = !failed && (resultCode === "partial" || receipt.coverage_state === "partial")
    const result = resultCode === "no_material_update" ? "完成，沒有重大更新"
      : resultCode === "updated" ? "有新增事件"
      : resultCode === "needs_deeper_analysis" ? "仍有候選待深入分析"
      : resultCode === "unavailable" ? "來源不可用"
      : resultCode ? `結果：${resultCode}` : "結果未提供"
    const outcome = failed ? `失敗；保留 ${productionLabel} 最新成功判斷`
      : partial ? `僅部分完成；保留 ${productionLabel} 最新成功判斷`
      : `${result}；正式判斷仍更新於 ${productionLabel}`
    laterScanLine = `後續${marketName}快掃 ${scanTime} ${outcome}`
  }

  return { judgmentLine, sourceCutoffLine, laterScanLine }
}

const ACTION_STATUS_LABEL: Record<ActionItemStatus, string> = {
  open: "尚未結案",
  "has-canonical-home": "已有判斷頁可承接",
  closed: "正式紀錄已寫下編號",
  unknown: "狀態未知",
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function nonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function validOptionalText(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string"
}

const ACTION_ITEM_STATUSES: readonly ActionItemStatus[] = ["open", "has-canonical-home", "closed", "unknown"]
const ACTION_ITEM_KINDS: readonly ActionItemKind[] = ["no_change", "watch", "research", "action", "unknown"]

function isContractActionItem(value: unknown): value is InvestmentActionItem {
  if (!isRecord(value)) return false
  return typeof value.id === "string"
    && typeof value.text === "string"
    && ACTION_ITEM_STATUSES.includes(value.status as ActionItemStatus)
    && (value.kind === undefined || ACTION_ITEM_KINDS.includes(value.kind as ActionItemKind))
    && Array.isArray(value.tickers) && value.tickers.every(ticker => typeof ticker === "string")
    && Array.isArray(value.evidence) && value.evidence.every(evidence => typeof evidence === "string")
    && typeof value.artifact_id === "string"
    && typeof value.source === "string"
    && typeof value.date === "string"
}

export function validatedBriefJudgment(brief: InvestmentBrief): InvestmentBriefJudgment | null {
  const value: unknown = brief.judgment
  if (!isRecord(value)) return null
  if (value.class !== "trade" && value.class !== "watch" && value.class !== "ignore") return null
  if (!nonEmptyText(value.judgment) || !nonEmptyText(value.why_now)) return null
  if (!validOptionalText(value.revisit) || !validOptionalText(value.decision_effect)) return null
  if (value.class === "watch" && (!nonEmptyText(value.revisit) || !nonEmptyText(value.decision_effect))) return null
  if (!Object.hasOwn(value, "provenance")) return null

  const provenance = value.provenance
  if (provenance !== null) {
    if (!isRecord(provenance)) return null
    for (const key of ["declared_unverified", "artifact", "source_revision", "source_cutoff"]) {
      if (!validOptionalText(provenance[key])) return null
    }
    if (provenance.validated_story_ids !== undefined
      && (!Array.isArray(provenance.validated_story_ids) || !provenance.validated_story_ids.every(id => typeof id === "string"))) return null
  }

  return value as unknown as InvestmentBriefJudgment
}

export type StructuredBriefJudgmentReplacement = {
  judgment: InvestmentBriefJudgment
  source: "action_items" | "actions"
  index: number
}

function hasLegacyJudgmentSerialization(text: string, judgment: InvestmentBriefJudgment): boolean {
  const labels = new Set(Array.from(text.matchAll(/(?:^|[;；])\s*(why_now|revisit|decision_effect|provenance)\s*[:：]/gi), match => match[1].toLowerCase()))
  if (!labels.has("why_now")) return false
  if (judgment.class === "watch" && (!labels.has("revisit") || !labels.has("decision_effect"))) return false
  if (judgment.provenance !== null && !labels.has("provenance")) return false
  return true
}

/**
 * A structured judgment replaces the legacy primary row only when the producer
 * contract describes exactly one unclassified formal item whose text has the
 * named legacy-serialization fields. The row's prose is deliberately not
 * compared with the judgment: a mismatch in shape, count, markers, or explicit
 * kind keeps every legacy row visible.
 */
export function structuredBriefJudgmentReplacement(brief: InvestmentBrief): StructuredBriefJudgmentReplacement | null {
  const judgment = validatedBriefJudgment(brief)
  if (!judgment || !Array.isArray(brief.actions)) return null

  if (brief.action_items !== undefined && !Array.isArray(brief.action_items)) return null
  const hasExplicitActionRelation = Object.prototype.hasOwnProperty.call(judgment, "same_action_id")
  const linkedId: unknown = judgment.same_action_id
  if (hasExplicitActionRelation) {
    if (typeof linkedId !== "string" || !linkedId.trim() || linkedId !== linkedId.trim()
      || !Array.isArray(brief.action_items)) return null
    // The producer emits this pointer only for one same-source, same-class
    // action. Recheck exact uniqueness and the shared classification before
    // suppressing a row; malformed or ambiguous pointers keep both records.
    const matches = brief.action_items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => isRecord(item) && item.id === linkedId)
    if (matches.length === 1) {
      const { item, index } = matches[0]
      if (isContractActionItem(item) && item.kind === judgment.class && ["open", "has-canonical-home"].includes(item.status)) {
        return { judgment, source: "action_items", index }
      }
    }
    return null
  }
  if (brief.action_items?.length) {
    if (brief.action_items.length !== 1 || brief.actions.length > 1) return null
    const item: unknown = brief.action_items[0]
    if (!isContractActionItem(item) || !nonEmptyText(item.text)) return null
    if (item.status === "closed" && item.kind !== "no_change") return null
    if (item.kind !== undefined && item.kind !== "unknown") return null
    if (legacyActionKind(item.text) !== "unknown") return null
    if (!hasLegacyJudgmentSerialization(item.text, judgment)) return null
    if (brief.actions.length === 1 && legacyActionKind(brief.actions[0]) !== "unknown") return null
    return { judgment, source: "action_items", index: 0 }
  }

  if (brief.actions.length !== 1 || !nonEmptyText(brief.actions[0])) return null
  if (legacyActionKind(brief.actions[0]) !== "unknown") return null
  if (!hasLegacyJudgmentSerialization(brief.actions[0], judgment)) return null
  return { judgment, source: "actions", index: 0 }
}

export const JUDGMENT_CLASS_LABEL: Record<InvestmentBriefJudgmentClass, string> = {
  trade: "交易", watch: "觀察", ignore: "忽略",
}

const MARKET_SCAN_LABEL: Record<InvestmentNewsMarket, string> = { tw: "台股", us: "美股" }

/** Plain-language wording for a completed/failed/no-change news scan, from
 * the real producer's own state machine (core/investment_refresh.py):
 * "no-change" is always zero new updates; "success" carries a positive
 * count, or null specifically when a server restart made counting
 * impossible (that path never reports a real zero -- a same-run zero is
 * "no-change" instead). An exactly-zero "success" is still read the same as
 * "no-change" defensively, rather than left unworded. */
function scanResultWording(state: "success" | "failed" | "no-change", newUpdateCount: number | null | undefined): string {
  if (state === "failed") return "失敗，保留上一版"
  if (state === "success") {
    if (typeof newUpdateCount === "number" && Number.isFinite(newUpdateCount)) {
      return newUpdateCount > 0 ? `有 ${newUpdateCount} 則新消息` : "沒有影響判斷的新消息"
    }
    return "已完成（新增則數未知）"
  }
  return "沒有影響判斷的新消息"
}

/** The latest quick-scan result, only when both its own timestamp and the
 * brief's source cutoff are timezone-qualified instants and the scan
 * happened strictly after that cutoff -- a scan that predates the brief, one
 * that never ran, or a cutoff too ambiguous to compare against, all say
 * nothing about the brief's freshness and must not be shown beside it.
 * "running"/"idle" are never reported here; that progress already has its
 * own place in the refresh-status area above this note. */
export function newsScanNote(
  status: Pick<InvestmentRefreshStatus, "state" | "market_scope" | "last_updated" | "new_update_count"> | null | undefined,
  briefSourceCutoff: string | null | undefined,
): string | null {
  if (!status || status.state === "idle" || status.state === "running") return null
  const eventAt = parseTimezoneQualifiedInstant(status.last_updated)
  const cutoff = parseTimezoneQualifiedInstant(briefSourceCutoff)
  if (eventAt === null || cutoff === null || eventAt <= cutoff) return null
  const clock = TIME_FORMAT.format(new Date(eventAt))
  const market = status.market_scope ? MARKET_SCAN_LABEL[status.market_scope] : ""
  return `${market}快掃 ${clock}：${scanResultWording(status.state, status.new_update_count)}`
}

const PROVIDER_LABEL: Record<string, string> = { agy: "Antigravity", claude: "Claude", codex: "Codex", grok: "Grok" }

/** Plain-language stand-in for a raw route note like "claude fallback 1" --
 * names who actually produced the result and, only when it took more than
 * one try, how many earlier models did not succeed. */
export function providerCompletionNote(status: Pick<InvestmentRefreshStatus, "provider" | "fallback_depth"> & { state?: InvestmentRefreshStatus["state"] }): string | null {
  if (!status.provider) return null
  const label = PROVIDER_LABEL[status.provider] ?? status.provider
  const failedBefore = typeof status.fallback_depth === "number" && status.fallback_depth > 0
    ? `（先前 ${status.fallback_depth} 個模型未成功）` : ""
  const outcome = status.state === "failed" ? "執行失敗" : status.state === "running" ? "執行中" : "完成"
  return `由 ${label} ${outcome}${failedBefore}`
}

/** Raw model id / per-provider errors stay off the main line; a hover title
 * is enough for anyone who wants the receipt. */
export function providerDetailTitle(status: Pick<InvestmentRefreshStatus, "model" | "provider_errors" | "provider_log_path" | "baseline_path" | "baseline_revision" | "baseline_cutoff_at" | "input_cutoff" | "source_cutoff" | "provider_invocation_count" | "provider_call_count" | "today_judgment_state" | "news_write_state"> | null | undefined): string | undefined {
  if (!status) return undefined
  const parts: string[] = []
  if (status.model) parts.push(`model: ${status.model}`)
  if (typeof status.provider_invocation_count === "number") parts.push(`provider invocations: ${status.provider_invocation_count}`)
  if (typeof status.provider_call_count === "number") parts.push(`provider calls: ${status.provider_call_count}`)
  if (status.news_write_state) parts.push(`news write: ${status.news_write_state}`)
  if (status.today_judgment_state) parts.push(`judgment readback: ${status.today_judgment_state}`)
  if (status.baseline_path) parts.push(`baseline: ${status.baseline_path}`)
  if (status.baseline_revision) parts.push(`baseline revision: ${status.baseline_revision}`)
  if (status.baseline_cutoff_at) parts.push(`baseline cutoff: ${status.baseline_cutoff_at}`)
  if (status.input_cutoff) parts.push(`input cutoff: ${status.input_cutoff}`)
  if (status.source_cutoff) parts.push(`source cutoff: ${status.source_cutoff}`)
  if (status.provider_log_path) parts.push(`provider log: ${status.provider_log_path}`)
  const errors = Object.entries(status.provider_errors ?? {})
  if (errors.length) parts.push(`errors: ${errors.map(([key, value]) => `${key}=${value}`).join(", ")}`)
  return parts.length ? parts.join(" · ") : undefined
}

/** today_view already classifies each brief action's `kind`, strips markdown
 * and drops prefixes -- this only assembles 今天怎麼做's list: intraday
 * updates first, then `action_items` of kind action/watch. When no item
 * carries a `kind` at all (an older payload, or a demo fixture written
 * before the field existed) that filter would silently go empty, so this
 * falls back to the plain-string `actions` list instead. Dedups by trimmed
 * text, in source order, without mutating any input. */
export function followupTexts(
  intradayActions: readonly string[],
  actionItems: readonly InvestmentActionItem[],
  actions: readonly string[],
): string[] {
  const classified = actionItems.some(item => item.kind !== undefined)
  const baseline = classified
    ? actionItems.filter(item => item.kind === "action" || item.kind === "watch").map(item => item.text)
    : actions
  const seen = new Set<string>()
  const followups: string[] = []
  for (const text of [...intradayActions, ...baseline]) {
    const key = text.trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    followups.push(key)
  }
  return followups
}

export type TodayNextStep = {
  key: string
  text: string
  kind: ActionItemKind
  status: ActionItemStatus | null
  reason: string | null
  date: string | null
  source: string | null
  id: string | null
  artifactId: string | null
  storyId: string | null
  declaredDecisionTransition: boolean | null
  origin: "update" | "brief"
}

function legacyActionKind(text: string): ActionItemKind {
  if (/^行動[：:]/.test(text.trim())) return "action"
  if (/^(?:繼續觀察|觀察)[：:]/.test(text.trim())) return "watch"
  if (/^補研究[：:]/.test(text.trim())) return "research"
  return "unknown"
}

function stripActionPrefix(text: string): string {
  return text.trim().replace(/^(?:繼續觀察|觀察|行動|補研究)[：:]\s*/, "")
}

/** Keep source kinds/statuses and only use a same-update impact as that update's reason. */
export function currentTodayActionEntries(brief: InvestmentBrief, today?: InvestmentTodayView, allowJudgmentReplacement = true): TodayNextStep[] {
  const entries: TodayNextStep[] = []
  const seenIds = new Set<string>()
  const briefIdCounts = new Map<string, number>()
  for (const item of brief.action_items ?? []) {
    if (!isRecord(item) || typeof item.id !== "string" || !item.id.trim()) continue
    briefIdCounts.set(item.id, (briefIdCounts.get(item.id) ?? 0) + 1)
  }
  const ambiguousBriefIds = new Set([...briefIdCounts].filter(([, count]) => count > 1).map(([id]) => id))
  const replacement = allowJudgmentReplacement ? structuredBriefJudgmentReplacement(brief) : null
  const add = (entry: TodayNextStep) => {
    if (!entry.text.trim()) return
    const identity = entry.id ? `${entry.origin}:${entry.id}` : null
    const ambiguousBriefId = entry.origin === "brief" && entry.id !== null && ambiguousBriefIds.has(entry.id)
    if (identity && seenIds.has(identity) && !ambiguousBriefId) return
    if (identity) seenIds.add(identity)
    entries.push(entry)
  }
  for (const update of today?.updates ?? []) {
    if (!update.action.trim()) continue
    add({
      key: `update:${update.id}`,
      text: update.action.trim(),
      kind: "unknown",
      status: null,
      reason: update.portfolio_impact.trim() && update.portfolio_impact.trim() !== update.action.trim() ? update.portfolio_impact.trim() : null,
      date: update.observed_at || null,
      source: update.source_path || null,
      id: update.id || null,
      artifactId: null,
      storyId: update.story_id || null,
      declaredDecisionTransition: update.declared_decision_transition ?? null,
      origin: "update",
    })
  }
  if (brief.action_items?.length) {
    for (const [index, item] of brief.action_items.entries()) {
      if (replacement?.source === "action_items" && replacement.index === index) continue
      if (item.status === "closed" && item.kind !== "no_change") continue
      add({
        key: `brief:${item.id || entries.length}${item.id && ambiguousBriefIds.has(item.id) ? `:${index}` : ""}`,
        text: item.text.trim(),
        kind: item.kind ?? "unknown",
        status: item.status ?? null,
        reason: item.evidence.map(value => value.trim()).filter(Boolean).join("；") || null,
        date: item.date || brief.date,
        source: item.source || brief.source?.title || null,
        id: item.id || null,
        artifactId: item.artifact_id || null,
        storyId: null,
        declaredDecisionTransition: null,
        origin: "brief",
      })
    }
  } else {
    brief.actions.forEach((text, index) => {
      if (replacement?.source === "actions" && replacement.index === index) return
      add({
        key: `brief:legacy:${index}`,
        text: stripActionPrefix(text),
        kind: legacyActionKind(text),
        status: null,
        reason: null,
        date: brief.date,
        source: brief.source?.title || null,
        id: null,
        artifactId: null,
        storyId: null,
        declaredDecisionTransition: null,
        origin: "brief",
      })
    })
  }
  return entries
}

/** Keep the last usable brief snapshot visible while it is date-stale. */
export function currentTodayActionPlan(brief: InvestmentBrief, today?: InvestmentTodayView, allowJudgmentReplacement = true): TodayNextStep[] {
  const availableBrief = brief.state === "current" || brief.state === "stale"
    ? brief
    : { ...brief, action_items: [], actions: [] }
  const currentToday = today?.state === "ready"
    ? today
    : today ? { ...today, updates: [] } : undefined
  // A stale snapshot's source action is the content to preserve. Replacing it
  // with a derived current-day judgment would hide that source row because the
  // judgment itself is only eligible for a current brief.
  const mayReplaceWithJudgment = brief.state === "current" && allowJudgmentReplacement
  return currentTodayActionEntries(availableBrief, currentToday, mayReplaceWithJudgment)
}

/** Show the overall summary once, unless a step already carries the exact same text. */
export function todayGlobalDecisionSummary(summary: string, steps: readonly { text: string }[]): string | null {
  const value = summary.trim()
  if (!value || steps.some(step => step.text.trim() === value)) return null
  return value
}

export function todayActionKindLabel(kind: ActionItemKind, origin: TodayNextStep["origin"], historicalBrief = false): string {
  if (origin === "update") return "盤中補充觀察"
  if (historicalBrief && kind === "no_change") return "前版：不調整"
  if (kind === "action") return "現在行動"
  if (kind === "watch") return "等待／觀察"
  if (kind === "research") return "補研究"
  if (kind === "no_change") return "今天不用動"
  return "類型未知"
}

export function openActionItems(items: readonly InvestmentActionItem[]): InvestmentActionItem[] {
  return items.filter(item => item.status === "open" || item.status === "has-canonical-home")
}

/** A failed read cannot present cached formal actions as current owner work. */
export function currentOpenActionItems(items: readonly InvestmentActionItem[], readFailed: boolean): InvestmentActionItem[] {
  return readFailed ? [] : openActionItems(items)
}

/** The one line that stands in for Investment Note's own action list inside
 * 待處理. Counts are the producer's; the oldest date is the earliest dated
 * open item. No line at all when the read failed or the source is
 * unavailable -- a count there would read as "nothing left", not "unknown". */
export function pendingActionsCountLine(
  data: Pick<InvestmentActions, "state" | "items" | "counts"> | null | undefined,
  readFailed: boolean,
): string | null {
  if (readFailed || !data || data.state === "unavailable") return null
  const items = data.items ?? []
  const open = data.counts?.open ?? items.filter(item => item.status === "open").length
  const home = data.counts?.has_canonical_home ?? items.filter(item => item.status === "has-canonical-home").length
  const oldest = items
    .filter(item => item.status === "open")
    .map(item => (item.date ?? "").slice(0, 10))
    .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort()[0]
  const since = open > 0 ? (oldest ? `（最舊 ${oldest}）` : "（最舊日期未提供）") : ""
  return `Investment Note 還有 ${open} 筆未結案的行動${since}；另 ${home} 筆已有正式歸宿。`
}

export const RESEARCH_ROLE_COPY = "Research 用來深入尚未解決的公司、事件或問題。研究工作、等待／檢查點與系統可計算狀態分開呈現。"
export const RESEARCH_EVENT_LINKAGE_COPY = "研究筆記與簡報事件按來源分開保留；相同日期或標的本身不代表同一事件，沒有明示關係時不合併。"

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

export function historyReadingOrder<T extends { id: string | null; date: string | null }>(items: readonly T[]): T[] {
  const dated = items.filter((item) => item.date).sort((a, b) => (b.date || "").localeCompare(a.date || "") || (a.id ?? "").localeCompare(b.id ?? ""))
  const undated = items.filter((item) => !item.date)
  return [...dated, ...undated]
}

/** Only an explicit producer ID may be sent to the exact detail endpoint. */
export function historyDetailLookupId(item: { id: string | null }): string | null {
  return typeof item.id === "string" && item.id.length > 0 ? item.id : null
}

/** Only an explicit producer classification can promote history into a reusable framework. */
export function reusableLearningItems<T extends { learning_role?: string }>(items: readonly T[]): T[] {
  return items.filter((item) => item.learning_role === "reusable_framework")
}

export type WorkPanelView = "loading" | "error" | "stale" | "empty" | "ready"

/** Fetch-state discriminant so a failed first load is not rendered as an empty list. */
export function workPanelView(query: {
  isPending: boolean
  isError: boolean
  data?: { items?: readonly unknown[] } | null
  dataUpdatedAt?: number
}): WorkPanelView {
  if (query.data == null) return query.isError ? "error" : "loading"
  if (query.isError) return (query.dataUpdatedAt ?? 0) > 0 ? "stale" : "error"
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

/** Only producer group identities and exact membership IDs define this navigation lens.
 * All items outside usable explicit memberships remain visible, including old envelopes. */
export function researchDirectionView(data: import("./investment.ts").InvestmentResearch) {
  const projection = data.research.direction_groups
  const groups = (projection?.schema_version === 1 ? projection.groups : []).map(group => ({
    ...group,
    items: data.research.items.filter(item => group.item_ids.includes(item.id)),
    missingItemIds: group.item_ids.filter(id => !data.research.items.some(item => item.id === id)),
  }))
  const linked = new Set(groups.flatMap(group => group.items.map(item => item.id)))
  return {
    groups,
    other: data.research.items.filter(item => !linked.has(item.id)),
    state: projection?.schema_version === 1 ? projection.state : "unavailable",
    limitations: projection?.limitations ?? ["Research 方向分類尚未提供；保留全部研究，不推定方向。"],
  }
}

/** Validate explicit producer linkage without joining records or substituting IDs.
 * Partial coverage remains partial even when this one recorded chain is linked. */
export function historyChainLinked(item: import("./investment.ts").InvestmentHistoryItem, peers: readonly import("./investment.ts").InvestmentHistoryItem[] = [item]): boolean {
  const outcomeRecorded = item.outcome_state === "recorded" || (item.outcome_state == null && item.outcome?.state === "recorded")
  return item.chain_state === "linked" && item.kind === "decision_episode" && Boolean(item.id && item.decision_id && item.date)
    && item.state === "ready" && peers.filter(row => row.id === item.id || (row.decision_id && row.decision_id === item.decision_id)).length === 1
    && item.learning_state === "recorded" && (item.learning_role === "reusable_framework" || item.learning_role === "historical_case") && outcomeRecorded
}

/** Detail carries the exact source slices; index intentionally omits prose and checkpoints. */
export function historyChainDetailLinked(item: import("./investment.ts").InvestmentHistoryItem, peers: readonly import("./investment.ts").InvestmentHistoryItem[] = [item], conflicts: readonly import("./investment.ts").InvestmentHistoryItem[] = []): boolean {
  const located = (ref: import("./investment.ts").InvestmentHistorySourceRef | null | undefined) => Boolean(ref?.path && ref.line && (ref.line_end == null || ref.line_end >= ref.line))
  return conflicts.length === 0 && historyChainLinked(item, peers) && Boolean(item.reason?.trim()) && located(item.decision_source)
    && Boolean(item.learning?.trim()) && located(item.learning_source)
    && Boolean(item.checkpoints?.some(point => point.relation_state === "linked" && point.date && point.date > item.date! && point.outcome.state === "recorded" && point.outcome.text?.trim() && located(point.source)))
}


// Compatibility surfaces retained from reviewed shared inputs.
export const BRIEF_SESSION_METADATA = {
  "tw-open-prep": { label: "台股盤前注意 · 正式版", targetTime: "08:00" },
  "us-open-prep": { label: "美股盤前注意 · 正式版", targetTime: "21:15" },
} as const

export type BriefSession = keyof typeof BRIEF_SESSION_METADATA

export const BRIEF_SESSION_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(BRIEF_SESSION_METADATA).map(([session, metadata]) => [session, metadata.label]),
)

const PILLAR_ID_BY_LAYER_ID: Record<string, string> = {
  L0: "l0_hardware",
  L1: "l1_cloud",
  L2: "l2_models",
  "L2.5": "l2_5_application_software",
  L3: "l3_end_buyers",
}

export function unlinkedRowsWithoutLayerCard<
  Row extends { pillar_id?: string | null },
  Layer extends { layer_id?: string; pillar_id?: string | null },
>(rows: Row[] | null | undefined, layers: Layer[]): Row[] {
  const displayedPillarIds = new Set(layers.flatMap(layer => {
    const pillarId = layer.pillar_id || (layer.layer_id ? PILLAR_ID_BY_LAYER_ID[layer.layer_id] : undefined)
    return pillarId ? [pillarId] : []
  }))
  return (rows ?? []).filter(row => !row.pillar_id || !displayedPillarIds.has(row.pillar_id))
}

/** Calendar day shown to the user, independent of the browser host timezone. */
export function taipeiDateIso(now = new Date()): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export type BriefSessionRow = {
  session: BriefSession
  label: string
  targetTime: string
  matches: boolean
  state: InvestmentBrief["state"] | null
  date: string | null
  generatedAt: string | null
  sourceCutoff: string | null
}

export type TodayActionSection = { heading: string; context: string | null }

/** Label the latest available older brief without presenting it as today's new decision. */
export function todayActionSection(brief: Pick<InvestmentBrief, "state" | "date" | "session">): TodayActionSection {
  if (brief.state !== "stale") return { heading: "今天怎麼做", context: null }
  const session = brief.session ? BRIEF_SESSION_LABELS[brief.session] ?? "版次未標示" : "版次未標示"
  return {
    heading: "目前可用行動",
    context: `沿用 ${brief.date ?? "日期未提供"} · ${session}；這是目前最新可用簡報，不代表今天新產生的決定。`,
  }
}

/** A single selected brief belongs only to its producer-declared session. */
export function briefSessionRows(brief: Pick<InvestmentBrief, "state" | "date" | "generated_at" | "source_cutoff" | "session">): BriefSessionRow[] {
  return (Object.entries(BRIEF_SESSION_METADATA) as [BriefSession, typeof BRIEF_SESSION_METADATA[BriefSession]][]).map(([session, metadata]) => {
    const matches = brief.session === session
    return {
      session,
      label: metadata.label,
      targetTime: metadata.targetTime,
      matches,
      state: matches ? brief.state : null,
      date: matches ? brief.date : null,
      generatedAt: matches ? brief.generated_at : null,
      sourceCutoff: matches ? brief.source_cutoff : null,
    }
  })
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

/** Split only explicit producer-numbered targets; preserve every word and order. */
export function numberedTargets(text: string): { intro: string; items: string[] } | null {
  const markers = [...text.matchAll(/[①②③④⑤⑥⑦⑧⑨⑩]/g)]
  if (markers.length < 2 || markers[0].index === undefined) return null
  const items = markers.map((marker, index) => text.slice(
    marker.index! + marker[0].length,
    index + 1 < markers.length ? markers[index + 1].index : text.length,
  ).trim())
  if (items.some(item => !item)) return null
  return { intro: text.slice(0, markers[0].index).trim(), items }
}

export type TodayActionEntry = {
  key: string
  text: string
  origin: "update" | "brief"
  date: string | null
  source: string | null
  id: string | null
  sourceStatus?: ActionItemStatus | null
  sourceKind?: "action" | "watch" | "research" | null
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
  let sequence = 0
  const add = (input: Omit<TodayActionEntry, "key">) => {
    const normalized = input.text.replace(/[*_`~]/g, "").trim()
    const text = normalized.replace(/^(?:繼續觀察|觀察|行動)[：:]\s*/, "").trim()
    if (!text || !briefActions([text]).length) return
    const identity = input.id
      ? `${input.origin}:id:${input.id}`
      : `${input.origin}:${input.source ?? ""}:${input.date ?? ""}:${normalized}`
    if (seen.has(identity)) return
    seen.add(identity)
    const isResearch = /^(?:補研究|补研究)(?:[：:]|\s|$)/.test(text)
    const sourceKind = /^(?:繼續觀察|觀察)[：:]/.test(normalized) ? "watch" as const : /^(?:行動)[：:]/.test(normalized) ? "action" as const : isResearch ? "research" as const : null
    const entry = { ...input, sourceKind, key: `${input.origin}:${input.id ?? `legacy-${sequence}`}`, text }
    sequence += 1
    ;(isResearch ? research : actions).push(entry)
  }
  for (const update of today?.updates ?? []) {
    if (update.action.trim()) add({ text: update.action, origin: "update", date: update.observed_at, source: update.source_path || null, id: update.id })
  }
  if (brief.action_items?.length) {
    for (const item of brief.action_items) {
      add({ text: item.text, origin: "brief", date: item.date || brief.date, source: item.source || brief.source?.title || "正式簡報", id: item.id, sourceStatus: item.status })
    }
  } else {
    for (const text of brief.actions) add({ text, origin: "brief", date: brief.date, source: brief.source?.title || "正式簡報", id: null })
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

/** Bound the first decision surface without inventing priority or linking by prose. */
export function todayNextSteps(plan: TodayActionPlan) {
  const entries = [...plan.actions, ...plan.research]
  return { primary: entries[0] ?? null, secondary: entries.slice(1, 3), remaining: entries.slice(3) }
}

/** Keep structured next steps in source order; drop only pure no-information labels. */
export function visibleActionItems<T extends { text: string }>(items: readonly T[]): T[] {
  const kept = new Set(briefActions(items.map(item => item.text)))
  return items.filter(item => kept.has(item.text))
}
