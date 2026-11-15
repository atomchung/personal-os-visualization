import { useQueries, useQuery } from "@tanstack/react-query"
import {
  getInvestmentMarket, getInvestmentPulse, getMarketExplore, getMomentumLeaders, getRelativeStrength, getStockQuote, getTwRelativeStrength,
} from "@/lib/investment"
import type { InvestmentMarketPulse, MarketExploreMarket, MomentumLeadersCoverage, MomentumReading } from "@/lib/investment"
import { taipeiClock } from "@/lib/investmentFormat"
import { taipeiCalendarDate } from "@/lib/investmentToday"
import type { TodayMarketPayload } from "@/lib/investmentTodayUpdate"

export function instant(value: string | null | undefined): number | null {
  if (!value || !taipeiClock(value)) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** The newest qualified timestamp among the values, or null. */
export function newestTime(values: (string | null | undefined)[]): string | null {
  let best: string | null = null
  let bestAt = -Infinity
  for (const value of values) {
    const at = instant(value)
    if (at !== null && at > bestAt) { best = value ?? null; bestAt = at }
  }
  return best
}

/** HH:MM (Taipei) of the newest qualified timestamp, or null. */
export function newestClock(values: (string | null | undefined)[]): string | null {
  return taipeiClock(newestTime(values))
}

type LiveIndexQuote = { value?: number | null; change?: number | null; change_percent?: number | null; quoted_at?: string | null }

/** The Taiwan index reading block 5 shows. Once the exchange has published the
 * close for the live quote's own day, that official figure is used: the live
 * feed's last bar can differ from the close. Before that, or when the live
 * quote's day cannot be read, the live quote. Without a live value, the
 * published reading. */
export function taiwanIndexReading(live: LiveIndexQuote | undefined, pulse: InvestmentMarketPulse | undefined) {
  const official = pulse?.index
  const officialDay = (official?.direction_check?.as_of ?? pulse?.as_of ?? "").slice(0, 10)
  const liveDay = taipeiCalendarDate(live?.quoted_at)
  const trusted = !official?.direction_check || official.direction_check.status === "confirmed"
  const published = official?.value != null && trusted && /^\d{4}-\d{2}-\d{2}$/.test(officialDay) && liveDay != null && officialDay >= liveDay
  if (live?.value != null && !published) return { value: live.value, change: live.change ?? null, changePct: live.change_percent ?? null, time: live.quoted_at ?? null }
  return { value: official?.value ?? null, change: official?.change ?? null, changePct: official?.change_pct ?? null, time: pulse?.source_cutoff ?? null }
}

/** One row of the holdings table. `relativeStrength` is against the row's own
 * market benchmark; `vsSemis` exists for US rows only. */
export type MarketHoldingRow = {
  symbol: string
  holding?: boolean
  price?: number | null
  today: number | null
  return20d: number | null
  vs20ma?: number | null
  vs50ma?: number | null
  rsi?: number | null
  relativeStrength: number | null
  vsSemis?: number | null
  macdBearish?: boolean
}

/** What block 5 renders. Only the first five fields are needed to build the update payload. */
export type TodayMarketData = {
  twValue: number | null
  twChange: number | null
  twChangePct: number | null
  usItems: { symbol: string; label: string; value: number | null; change_percent?: number | null; quoted_at?: string | null }[]
  holdings: MarketHoldingRow[]
  reading?: MomentumReading
  coverage?: MomentumLeadersCoverage
  pulse?: InvestmentMarketPulse
  exploreMarkets?: MarketExploreMarket[]
  time?: string | null
  timeAt?: string | null
}

/** Everything block 5 displays. Shared with the page-level update button so the
 * numbers sent with a manual run are the numbers the reader sees. */
export function useTodayMarketData(enabled = true): TodayMarketData {
  const market = useQuery({ queryKey: ["investment-market"], queryFn: ({ signal }) => getInvestmentMarket(signal), enabled, staleTime: 15_000, retry: false, refetchOnWindowFocus: true })
  const pulse = useQuery({ queryKey: ["investment-pulse"], queryFn: ({ signal }) => getInvestmentPulse(signal), enabled, staleTime: 60_000, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false })
  const leaders = useQuery({ queryKey: ["investment-momentum-leaders"], queryFn: ({ signal }) => getMomentumLeaders(signal), enabled, staleTime: 300_000, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false })
  const usRs = useQuery({ queryKey: ["investment-relative-strength"], queryFn: ({ signal }) => getRelativeStrength(signal), enabled, staleTime: 300_000, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false })
  const twRs = useQuery({ queryKey: ["investment-tw-relative-strength"], queryFn: ({ signal }) => getTwRelativeStrength(signal), enabled, staleTime: 300_000, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false })
  const explore = useQuery({ queryKey: ["investment-explore"], queryFn: ({ signal }) => getMarketExplore(signal), enabled, staleTime: 60_000, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false })
  // The whole registered roster: holdings by book value, then the watchlist.
  const rows = leaders.data?.rows ?? []
  const quotes = useQueries({ queries: rows.map(row => ({ queryKey: ["investment-quote", row.symbol], queryFn: ({ signal }: { signal: AbortSignal }) => getStockQuote(row.symbol, signal), enabled, staleTime: 15_000, retry: false, refetchOnWindowFocus: true })) })

  const twii = market.data?.items.find(item => item.symbol === "^TWII")
  const tw = taiwanIndexReading(twii, pulse.data)
  const twValue = tw.value
  const twChange = tw.change
  const twChangePct = tw.changePct
  const usItems = (market.data?.items ?? []).filter(item => item.market === "us" && item.value != null).slice(0, 3)
  const rsByTicker = new Map((usRs.data?.rows ?? []).map(row => [row.ticker, row] as const))
  const twRsReading = (symbol: string): number | null => {
    if (!/\.(TW|TWO)$/.test(symbol)) return null
    const exchange = symbol.endsWith(".TWO") ? "TPEx" : "TWSE"
    const row = twRs.data?.state === "unavailable" ? undefined : twRs.data?.holdings.find(item => item.provider_symbol === symbol && item.exchange === exchange)
    return row && row.state !== "unavailable" ? row.market_rs_pp : null
  }
  const holdings: MarketHoldingRow[] = rows.map((row, index) => {
    const taiwan = /\.(TW|TWO)$/.test(row.symbol)
    return {
      symbol: row.symbol,
      holding: row.holding,
      price: quotes[index]?.data?.value ?? row.last_close ?? null,
      today: quotes[index]?.data?.change_percent ?? null,
      return20d: row.return_20d_pct ?? null,
      vs20ma: row.vs_20ma_pct ?? null,
      vs50ma: row.vs_50ma_pct ?? null,
      rsi: row.rsi14 ?? null,
      relativeStrength: taiwan ? twRsReading(row.symbol) : rsByTicker.get(row.symbol)?.rs_spy ?? null,
      vsSemis: taiwan ? null : rsByTicker.get(row.symbol)?.rs_soxx ?? null,
      // Same rule as the holdings table on the default Today view.
      macdBearish: row.return_20d_pct != null && (row.macd === "bearish" || row.macd === "bearish_cross"),
    }
  })
  const timeAt = newestTime([tw.time, ...usItems.map(item => item.quoted_at), ...quotes.map(q => q.data?.quoted_at)])
  return {
    twValue, twChange, twChangePct, usItems, holdings, reading: leaders.data?.reading, coverage: leaders.data?.coverage,
    pulse: pulse.data, exploreMarkets: explore.data?.markets, time: taipeiClock(timeAt), timeAt,
  }
}

/** Compact object sent with a manual update: index tile, US indicators, per-holding rows. */
export function buildTodayMarketPayload(data: TodayMarketData): TodayMarketPayload {
  return {
    taiwan_index: data.twValue != null ? { value: data.twValue, change: data.twChange, change_pct: data.twChangePct } : null,
    us_indicators: data.usItems.map(item => ({ symbol: item.symbol, label: item.label, value: item.value, change_pct: item.change_percent ?? null })),
    holdings: data.holdings.map(row => ({ ticker: row.symbol, today_pct: row.today, return_20d_pct: row.return20d, relative_strength: row.relativeStrength })),
  }
}

