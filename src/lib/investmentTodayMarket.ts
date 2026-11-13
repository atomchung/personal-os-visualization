import { useQueries, useQuery } from "@tanstack/react-query"
import {
  getInvestmentMarket, getInvestmentPulse, getMomentumLeaders, getRelativeStrength, getStockQuote, getTwRelativeStrength,
} from "@/lib/investment"
import { taipeiClock } from "@/lib/investmentFormat"
import type { TodayMarketPayload } from "@/lib/investmentTodayUpdate"

export function instant(value: string | null | undefined): number | null {
  if (!value || !taipeiClock(value)) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** HH:MM (Taipei) of the newest qualified timestamp, or null. */
export function newestClock(values: (string | null | undefined)[]): string | null {
  let best: string | null = null
  let bestAt = -Infinity
  for (const value of values) {
    const at = instant(value)
    if (at !== null && at > bestAt) { best = value ?? null; bestAt = at }
  }
  return best ? taipeiClock(best) : null
}

type MarketHoldingRow = { symbol: string; today: number | null; return20d: number | null; relativeStrength: number | null }

/** Everything block 5 displays. Shared with the page-level update button so the
 * numbers sent with a manual run are the numbers the reader sees. */
export function useTodayMarketData(enabled = true) {
  const market = useQuery({ queryKey: ["investment-market"], queryFn: ({ signal }) => getInvestmentMarket(signal), enabled, staleTime: 15_000, retry: false, refetchOnWindowFocus: true })
  const pulse = useQuery({ queryKey: ["investment-pulse"], queryFn: ({ signal }) => getInvestmentPulse(signal), enabled, staleTime: 60_000, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false })
  const leaders = useQuery({ queryKey: ["investment-momentum-leaders"], queryFn: ({ signal }) => getMomentumLeaders(signal), enabled, staleTime: 300_000, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false })
  const usRs = useQuery({ queryKey: ["investment-relative-strength"], queryFn: ({ signal }) => getRelativeStrength(signal), enabled, staleTime: 300_000, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false })
  const twRs = useQuery({ queryKey: ["investment-tw-relative-strength"], queryFn: ({ signal }) => getTwRelativeStrength(signal), enabled, staleTime: 300_000, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false })
  const rows = (leaders.data?.rows ?? []).slice(0, 8)
  const quotes = useQueries({ queries: rows.map(row => ({ queryKey: ["investment-quote", row.symbol], queryFn: ({ signal }: { signal: AbortSignal }) => getStockQuote(row.symbol, signal), enabled, staleTime: 15_000, retry: false, refetchOnWindowFocus: true })) })

  const twii = market.data?.items.find(item => item.symbol === "^TWII")
  const twLive = twii?.value != null
  const twValue = twLive ? twii?.value ?? null : pulse.data?.index.value ?? null
  const twChange = twLive ? twii?.change ?? null : pulse.data?.index.change ?? null
  const twChangePct = twLive ? twii?.change_percent ?? null : pulse.data?.index.change_pct ?? null
  const usItems = (market.data?.items ?? []).filter(item => item.market === "us" && item.value != null).slice(0, 3)
  const rsByTicker = new Map((usRs.data?.rows ?? []).map(row => [row.ticker, row] as const))
  const twRsReading = (symbol: string): number | null => {
    if (!/\.(TW|TWO)$/.test(symbol)) return null
    const exchange = symbol.endsWith(".TWO") ? "TPEx" : "TWSE"
    const row = twRs.data?.state === "unavailable" ? undefined : twRs.data?.holdings.find(item => item.provider_symbol === symbol && item.exchange === exchange)
    return row && row.state !== "unavailable" ? row.market_rs_pp : null
  }
  const holdings: MarketHoldingRow[] = rows.map((row, index) => ({
    symbol: row.symbol,
    today: quotes[index]?.data?.change_percent ?? null,
    return20d: row.return_20d_pct ?? null,
    relativeStrength: /\.(TW|TWO)$/.test(row.symbol) ? twRsReading(row.symbol) : rsByTicker.get(row.symbol)?.rs_spy ?? null,
  }))
  const time = newestClock([twLive ? twii?.quoted_at : pulse.data?.source_cutoff, ...usItems.map(item => item.quoted_at), ...quotes.map(q => q.data?.quoted_at)])
  return { twValue, twChange, twChangePct, usItems, holdings, reading: leaders.data?.reading, coverage: leaders.data?.coverage, time }
}

type TodayMarketData = ReturnType<typeof useTodayMarketData>

/** Compact object sent with a manual update: index tile, US indicators, per-holding rows. */
export function buildTodayMarketPayload(data: TodayMarketData): TodayMarketPayload {
  return {
    taiwan_index: data.twValue != null ? { value: data.twValue, change: data.twChange, change_pct: data.twChangePct } : null,
    us_indicators: data.usItems.map(item => ({ symbol: item.symbol, label: item.label, value: item.value, change_pct: item.change_percent ?? null })),
    holdings: data.holdings.map(row => ({ ticker: row.symbol, today_pct: row.today, return_20d_pct: row.return20d, relative_strength: row.relativeStrength })),
  }
}

