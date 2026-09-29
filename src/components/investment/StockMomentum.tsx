import { useState } from "react"
import { useQueries, useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, SectionHeading } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { DEMO_MODE } from "@/lib/transport"
import {
  HOLDING_POLL_MS, IDLE_POLL_MS, SESSION_LABELS, getMomentumLeaders,
  getRelativeStrength, getStockQuote, isRecentQuote,
  type MomentumLeaders, type MomentumRow, type RelativeStrength, type RelativeStrengthRow, type StockQuote,
} from "@/lib/investment"
import { formatNumber, quoteTime } from "@/lib/investmentFormat"

import { TaiwanRsCell, TaiwanRsDetails, useTaiwanRs, type TaiwanRsProps } from "./TaiwanRs"

const NUM = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 })
const MACD = { bullish_cross: "偏多交叉", bearish_cross: "偏空交叉", bullish: "偏多", bearish: "偏空", flat: "持平" }
const GRID = "grid-cols-2 sm:grid-cols-[1.3fr_repeat(6,1fr)]"

function num(value: number | null | undefined, pct = false) {
  return value == null || !Number.isFinite(value) ? "—" : `${NUM.format(value)}${pct ? "%" : ""}`
}
function metricTone(value: number | null | undefined) {
  return value == null ? "text-ink-3" : value > 0 ? "text-ok" : value < 0 ? "text-bad" : "text-ink-3"
}
/** Same unit and precision as the Taiwan board's relative-strength figure (see
 * TaiwanRs.tsx's `formatRsPercent`): a signed percentage, two decimals, e.g.
 * "+10.35%" / "-3.05%". Missing keeps this table's own "—" wording -- never a
 * bare 0. */
export function formatRsPercent(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : `${formatNumber(value, true)}%`
}
/** `as_of` is always a plain "YYYY-MM-DD" from the backend; no locale/timezone work needed. */
function shortDate(iso: string): string {
  const parts = iso.split("-")
  return parts.length === 3 ? `${Number(parts[1])}/${Number(parts[2])}` : iso
}

type SortKey = "value" | "return" | "rs"
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "value", label: "依市值（預設）" },
  { key: "return", label: "依 20 日報酬" },
  { key: "rs", label: "依美股相對強度" },
]

/** "value" is the roster's own order (holdings by book market value, then
 * watchlist) -- already how the backend returns `rows`, so it needs no sort. */
function sortRows(rows: MomentumRow[], key: SortKey, rsByTicker: Map<string, RelativeStrengthRow>): MomentumRow[] {
  if (key === "value") return rows
  const weight = (row: MomentumRow): number | null =>
    key === "return" ? row.return_20d_pct : (rsByTicker.get(row.symbol)?.rs_spy ?? null)
  return [...rows].sort((a, b) => {
    const wa = weight(a), wb = weight(b)
    if (wa == null && wb == null) return 0
    if (wa == null) return 1
    if (wb == null) return -1
    return wb - wa
  })
}

function lagKey(row: MomentumRow): string {
  return `${row.as_of ?? ""}|${row.missing_dates.join(",")}`
}

/** The most common (as_of, missing_dates) combination among plain live lagging
 * rows (not last-known-good, not unavailable). The summary sentence already
 * names this combination once, so a row that matches it does not need its own
 * orange line -- only a row whose lag differs from the pack does. */
function majorityLagKey(rows: MomentumRow[]): string | null {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (row.source !== "live" || row.state === "unavailable" || row.lag_sessions <= 0) continue
    const key = lagKey(row)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let best: string | null = null
  let bestCount = 0
  for (const [key, count] of counts) {
    if (count > bestCount) { best = key; bestCount = count }
  }
  return best
}

/** Worst news first: no daily at all, a resurrected old snapshot, or a live
 * read missing session(s) that the majority of lagging rows are NOT also
 * missing (a majority-matching lag is disclosed as a muted caption instead --
 * see `mutedLagCaption`). */
function dailyStatus(row: MomentumRow, majority: string | null): string | null {
  if (row.state === "unavailable") return "日線未取得"
  if (row.source === "last_known_good") return `沿用 ${quoteTime(row.stored_at)} 取得的日線`
  if (row.lag_sessions > 0 && lagKey(row) !== majority) return `日線截至 ${row.as_of ? shortDate(row.as_of) : "—"}（Yahoo 尚未提供 ${row.missing_dates.map(shortDate).join("、")} 收盤）`
  return null
}

/** The quiet counterpart to `dailyStatus`: a row whose lag matches what the
 * summary line already states gets this caption under its price instead of a
 * repeated orange line. */
function mutedLagCaption(row: MomentumRow, majority: string | null): string | null {
  if (row.state === "unavailable" || row.source === "last_known_good") return null
  if (row.lag_sessions > 0 && row.as_of && lagKey(row) === majority) return `日線 ${shortDate(row.as_of)}`
  return null
}

function rsCaption(rs: RelativeStrengthRow): string {
  if (rs.group && rs.group_label) return `${rs.group_label} ${formatRsPercent(rs.rs_group)}`
  return `對半導體 ${formatRsPercent(rs.rs_soxx)}`
}

/** The old table-level line just said "相對強度資料不完整。" with no way to
 * tell which holding, or why, without opening every row. Name the symbols
 * this roster is actually missing a market-tier reading for; only fall back
 * to a bare count when the source's own shortfall does not line up with any
 * symbol currently on this board (e.g. a ticker the source covers that this
 * roster does not show). A real fetch failure keeps its own, more urgent
 * wording and stays the caller's job to color as a warning. */
export function relativeStrengthGapMessage(
  rows: readonly MomentumRow[],
  rsByTicker: Map<string, RelativeStrengthRow>,
  rs: RelativeStrength | undefined,
  isError: boolean,
): string | null {
  if (isError) return "相對強度這次沒有取得。"
  if (!rs || rs.state === "ready") return null
  const missing = rows
    .filter(row => !/\.(TW|TWO)$/.test(row.symbol) && (rsByTicker.get(row.symbol)?.rs_spy ?? null) == null)
    .map(row => row.symbol)
  if (missing.length) return `${missing.length} 檔沒有相對強度資料（${missing.join("、")}）；原因見各列`
  const shortfall = rs.coverage.rows - rs.coverage.scored
  return `相對強度來源有 ${shortfall} 檔沒有讀數；原因見各列`
}

function Row({ row, quote, quoteError, rs, busy, majority, tw, rsDate, rsWindow }: {
  tw: TaiwanRsProps; rsDate: string | null; rsWindow: number | null; row: MomentumRow; quote?: StockQuote; quoteError: boolean; rs?: RelativeStrengthRow; busy: boolean; majority: string | null
}) {
  const [open, setOpen] = useState(false)
  const change = quote?.change_percent ?? null
  const quoteMsg = quoteError
    ? (quote ? "報價更新失敗，顯示上次數值" : "報價未取得")
    : (!quote && !busy) || quote?.state === "unavailable" ? "報價未取得" : null
  const statusLine = [quoteMsg, dailyStatus(row, majority)].filter(Boolean).join(" · ")
  const lagCaption = mutedLagCaption(row, majority)
  return <li className="min-w-0 border-b border-line-soft last:border-b-0">
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={`grid w-full min-w-0 items-center gap-x-3 gap-y-2 px-3 py-3 text-left text-label hover:bg-bg-2 ${GRID}`}>
      <span className="flex min-w-0 flex-col gap-0.5 font-semibold text-ink">
        <span className="flex flex-wrap items-center gap-1">
          {row.symbol}
          {quote?.session ? <Chip tone="mute">{SESSION_LABELS[quote.session]}</Chip> : null}
          {!row.holding ? <Chip tone="info">觀察</Chip> : null}
        </span>
        <span className="text-caption font-normal text-ink-3">{quote?.value != null ? `${formatNumber(quote.value)}${quote.unit ? ` ${quote.unit}` : ""}` : busy ? "讀取價格中…" : "價格未取得"}</span>
        {lagCaption ? <span className="text-micro text-ink-3">{lagCaption}</span> : null}
      </span>
      <span className={`text-right tabular-nums sm:text-left ${metricTone(change)}`}>{num(change, true)}<span className="block text-micro font-normal text-ink-3 sm:hidden">漲跌</span></span>
      <span className={`tabular-nums ${metricTone(row.return_20d_pct)}`}><span className="text-caption text-ink-3 sm:hidden">20日報酬 </span>{num(row.return_20d_pct, true)}</span>
      <span className={`tabular-nums ${metricTone(row.vs_20ma_pct)}`}><span className="text-caption text-ink-3 sm:hidden">距20日線 </span>{num(row.vs_20ma_pct, true)}</span>
      <span className={`tabular-nums ${metricTone(row.vs_50ma_pct)}`}><span className="text-caption text-ink-3 sm:hidden">距50日線 </span>{num(row.vs_50ma_pct, true)}</span>
      <span className="tabular-nums"><span className="text-caption text-ink-3 sm:hidden">RSI </span>{num(row.rsi14)}</span>
      <span className="col-span-2 flex flex-col sm:col-span-1">
        <span className="text-caption text-ink-3 sm:hidden">{/\.(TW|TWO)$/.test(row.symbol) ? "" : "相對強度 "}</span>
        {/\.(TW|TWO)$/.test(row.symbol) ? <TaiwanRsCell {...tw} /> : rs ? <>
          <span className={`tabular-nums ${metricTone(rs.rs_spy)}`}>{formatRsPercent(rs.rs_spy)}</span>
          <span className="text-caption text-ink-3">{rsCaption(rs)}</span>
          <span className="text-micro text-ink-3">對 SPY · {rsWindow ?? "未知"} 交易日 · {rsDate ?? "日期未提供"}</span>
        </> : <span className="text-caption text-ink-3">未取得</span>}
      </span>
      {statusLine ? <span role="status" className="col-span-2 text-caption text-warn sm:col-span-7">{statusLine}</span> : null}
    </button>
    {open ? <div className="flex flex-col gap-2 border-t border-line-soft bg-bg-2 px-3 py-3 text-caption text-ink-3">
      <p>報價時間：{quote?.quoted_at ? quoteTime(quote.quoted_at) : "未取得"} · 最近完整收盤 {num(row.last_close)}（{row.as_of ?? "未取得"}）</p>
      <p>20 日報酬：{num(row.return_20d_pct, true)} · 距 5／20／50 日線：{num(row.vs_5ma_pct, true)} ／ {num(row.vs_20ma_pct, true)} ／ {num(row.vs_50ma_pct, true)}</p>
      <p>RSI：{num(row.rsi14)} · MACD：{row.macd ? MACD[row.macd] : "—"} · 距一年高點：{num(row.distance_high_pct, true)}</p>
      <p>一年收盤區間位置：{num(row.range_252_position_pct, true)}（低 {num(row.range_252_low)} · 高 {num(row.range_252_high)}）</p>
      {rs ? <p>60 日報酬：{num(rs.own_ret, true)} · 對大盤：{formatRsPercent(rs.rs_spy)} · 對半導體：{formatRsPercent(rs.rs_soxx)} · 對族群{rs.group_label ? `（${rs.group_label}）` : ""}：{rs.group ? formatRsPercent(rs.rs_group) : "未分組"}</p> : null}
      {/\.(TW|TWO)$/.test(row.symbol) ? <TaiwanRsDetails {...tw} /> : null}
      {busy ? <p>更新中…</p> : null}
      {row.notes.map((note, index) => <p key={index}>{note}</p>)}
    </div> : null}
  </li>
}

/** One conclusion and exceptions first; keep exact source metrics inspectable. */
function RosterReading({ data }: { data: MomentumLeaders }) {
  const { coverage, reading, rows } = data
  if (!reading || !reading.scored) return null
  const unknownMa = reading.above_20ma_unknown + reading.above_50ma_unknown
  const withDaily = coverage.candidate_count - coverage.unavailable_count
  const laggingDates = [...new Set(
    rows.filter(row => coverage.lagging_symbols.includes(row.symbol) && row.as_of).map(row => shortDate(row.as_of as string)),
  )].join("、")
  const macdBearishSymbols = rows
    .filter(row => row.return_20d_pct != null && (row.macd === "bearish" || row.macd === "bearish_cross"))
    .map(row => row.symbol)
  return <div className="flex flex-col gap-2 border-b border-line-soft px-3 py-3">
    <p className="text-body leading-relaxed text-ink-2">{withDaily} 檔有日線；其中 <span className="font-medium text-ink">{reading.strong} 檔同時符合強勢三條件</span>。</p>
    {macdBearishSymbols.length || coverage.unavailable_symbols.length || coverage.lagging_symbols.length ? <ul className="flex list-disc flex-col gap-1 pl-5 text-caption leading-relaxed text-ink-2">
      {macdBearishSymbols.length ? <li>MACD 偏空：{macdBearishSymbols.join("、")}。</li> : null}
      {coverage.unavailable_symbols.length ? <li>日線未取得：{coverage.unavailable_symbols.join("、")}。</li> : null}
      {coverage.lagging_symbols.length ? <li>{coverage.lagging_symbols.length} 檔日線截至 {laggingDates}；最新收盤尚未取得。</li> : null}
    </ul> : null}
    <details className="text-caption leading-relaxed text-ink-3"><summary className="cursor-pointer py-1">完整清單統計與判定口徑</summary>
      <p>清單 {coverage.candidate_count} 檔（持倉 {coverage.holding_count}、觀察 {coverage.watch_count}）；有日線 {withDaily} 檔。強勢三條件為 20 日報酬為正、站上 20 日線、站上 50 日線。</p>
      <p>站上 20 日線 {reading.above_20ma} 檔、站上 50 日線 {reading.above_50ma} 檔{unknownMa ? `；另有 ${unknownMa} 項均線讀數缺值` : ""}。</p>
      <p>RSI ≥ 70 有 {reading.rsi_over_70} 檔、≤ 30 有 {reading.rsi_under_30} 檔{reading.rsi_unknown ? `，${reading.rsi_unknown} 檔無讀數` : ""}；MACD 偏空 {reading.macd_bearish} 檔。</p>
      {reading.strongest ? <p>20 日報酬最高 {reading.strongest.symbol} {num(reading.strongest.return_20d_pct, true)}。</p> : null}
      {reading.weakest && reading.weakest.symbol !== reading.strongest?.symbol ? <p>20 日報酬最低 {reading.weakest.symbol} {num(reading.weakest.return_20d_pct, true)}。</p> : null}
    </details>
  </div>
}

export function StockMomentum() {
  const [all, setAll] = useState(false)
  const twQuery = useTaiwanRs()
  const [sortKey, setSortKey] = useState<SortKey>("value")
  const rowsQuery = useQuery({ queryKey: ["investment-momentum-leaders"], queryFn: ({ signal }) => getMomentumLeaders(signal), staleTime: 300_000, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false })
  const rsQuery = useQuery({ queryKey: ["investment-relative-strength"], queryFn: ({ signal }) => getRelativeStrength(signal), staleTime: 300_000, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false })
  const rows = rowsQuery.data?.rows ?? []
  const rsByTicker = new Map<string, RelativeStrengthRow>((rsQuery.data?.rows ?? []).map(row => [row.ticker, row] as const))
  const sorted = sortRows(rows, sortKey, rsByTicker)
  const visible = all ? sorted : sorted.slice(0, 8)
  const quotes = useQueries({ queries: visible.map(row => ({ queryKey: ["investment-quote", row.symbol], queryFn: ({ signal }: { signal: AbortSignal }) => getStockQuote(row.symbol, signal), staleTime: 15_000, retry: false, refetchOnWindowFocus: true, refetchOnReconnect: true, refetchInterval: (query: { state: { data?: StockQuote } }) => DEMO_MODE ? false : isRecentQuote(query.state.data?.quoted_at) ? HOLDING_POLL_MS : IDLE_POLL_MS, refetchIntervalInBackground: false })) })
  const rs = rsQuery.data
  const rsUnavailableMsg = relativeStrengthGapMessage(rows, rsByTicker, rs, rsQuery.isError)
  const majority = majorityLagKey(rows)
  const showEmpty = !rowsQuery.isPending && !rowsQuery.isError && rowsQuery.data && rowsQuery.data.state !== "unavailable" && rows.length === 0
  return <section className="flex min-w-0 flex-col gap-4" aria-label="持倉行情與動能">
    <Card className="min-w-0 overflow-hidden shadow-sm">
      <div className="flex flex-wrap items-baseline gap-2 border-b border-line-soft bg-bg-2 px-3 py-3 sm:px-4"><SectionHeading>行情與均線位置</SectionHeading><span className="text-caption text-ink-3">持倉＋已登記觀察清單</span></div>
      {rowsQuery.isPending ? <p className="px-3 py-4 text-body text-ink-3">整理最近完整日線中…</p> : null}
      {rowsQuery.isError ? <p role="alert" className="px-3 py-4 text-body text-warn">清單動能讀取失敗。{rowsQuery.data ? "下方保留上次資料。" : ""}請按上方更新資料。</p> : null}
      {!rowsQuery.isError && rowsQuery.data?.state === "unavailable" ? <p role="status" className="px-3 py-4 text-body text-warn">清單動能暫時無法取得。</p> : null}
      {rowsQuery.data ? <RosterReading data={rowsQuery.data} /> : null}
      {rsUnavailableMsg ? <p role="status" className={`border-b border-line-soft px-3 py-2 text-caption ${rsQuery.isError ? "text-warn" : "text-ink-3"}`}>{rsUnavailableMsg}</p> : null}
      {rows.length ? <div role="group" aria-label="排序方式" className="flex flex-wrap items-center gap-1 border-b border-line-soft px-3 py-2">
        {SORT_OPTIONS.map(option => <Button key={option.key} size="sm" aria-pressed={sortKey === option.key} variant={sortKey === option.key ? "selected" : "ghost"} onClick={() => setSortKey(option.key)}>{option.label}</Button>)}
      </div> : null}
      {rows.length ? <div className={`hidden gap-x-3 border-b border-line px-3 py-2 text-caption text-ink-3 sm:grid ${GRID}`}><span>個股／價格</span><span>漲跌</span><span>20日報酬</span><span>距20日線</span><span>距50日線</span><span>RSI</span><span>相對強度<span className="block text-micro text-ink-3">依各列基準與日期</span></span></div> : null}
      <ul>{visible.map((row, index) => <Row key={row.symbol} tw={{ symbol: row.symbol, data: twQuery.data, pending: twQuery.isPending, failed: twQuery.isError }} rsDate={rs?.as_of ?? null} rsWindow={rs?.window_trading_days ?? null} row={row} quote={quotes[index]?.data} quoteError={quotes[index]?.isError ?? false} rs={rsByTicker.get(row.symbol)} busy={quotes[index]?.isFetching ?? false} majority={majority} />)}</ul>
      {showEmpty ? <p className="px-3 py-4 text-body text-ink-3">這份清單沒有可比較的標的。</p> : null}
      {sorted.length > 8 ? <div className="border-t border-line-soft px-3 py-3"><Button onClick={() => setAll(!all)}>{all ? "收起其他持倉" : `顯示其餘 ${sorted.length - 8} 檔`}</Button></div> : null}
      <details className="border-t border-line-soft px-3 py-2 text-caption text-ink-3">
        <summary className="cursor-pointer py-1">報價與指標口徑</summary>
        <div className="flex flex-col gap-2 py-2">
          <p>{!DEMO_MODE && "美股最新價含盤前盤後，台股只有盤中；均線與 RSI 使用各自市場最近完整收盤的還原價計算。"}報價與日線的時間可能不同，點開個股可查看。</p>
          <p>大盤 SPY {num(rs?.benchmarks.market, true)}、半導體 SOXX {num(rs?.benchmarks.sector, true)}（60 交易日，資料日 {rs?.as_of ?? "未取得"}）。只涵蓋 relative_strength.py 讀得到的美股持倉，台股不在這份來源裡。</p>
          <p>強勢＝最近 20 個完整交易日報酬為正，且收盤在 20／50 日線上方。</p>
        </div>
      </details>
    </Card>
  </section>
}
