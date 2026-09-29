import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { SectionHeading, SubsectionHeading } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { DEMO_MODE } from "@/lib/transport"
import {
  getMarketExplore,
  type MarketExploreBucket,
  type MarketExploreItem,
  type MarketExploreMarket,
} from "@/lib/investment"
import { formatNumber, sourceTimestamp } from "@/lib/investmentFormat"

const MARKET_LABEL = { tw: "台股", us: "美股" } as const
const BUCKET_LABEL = { fast: "漲得快", active: "量能熱", sustained: "持續強" } as const
// Plain-language gloss for the three bucket names. The exact rule stays in the
// producer's `method` string (shown under 覆蓋與口徑); this line only says what
// the column is, so an empty column reads as "nothing passed this filter"
// instead of "unbuilt feature".
const BUCKET_GLOSS = {
  fast: "今天漲幅最大的幾檔",
  // Deliberately not "成交金額": the producer falls back to estimated turnover,
  // relative volume or share volume when a market has no turnover column, and
  // the exact 口徑 it used is printed underneath from `bucket.method`.
  active: "今天量能最大的幾檔",
  sustained: "前兩類裡再通過技術確認的：站上 50 日線、相對大盤為正、且有量能讀數",
} as const
const CURRENCY: Record<string, string> = { tw: "NT$", us: "$" }
const MARKET_RANK = { tw: 0, us: 1 } as const
const BUCKET_RANK = { fast: 0, active: 1, sustained: 2 } as const
const NUM = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 })
type LastUsableMarkets = Partial<Record<"tw" | "us", MarketExploreMarket>>

function pct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return `${formatNumber(value, true)}%`
}

function qty(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return NUM.format(value)
}

function tone(value: number | null | undefined): string {
  return value == null ? "text-ink-3" : value > 0 ? "text-ok" : value < 0 ? "text-bad" : "text-ink-3"
}

function activityText(item: MarketExploreItem): string {
  const rawLabel = item.activity.label?.trim() || null
  const label = rawLabel === "turnover" ? "成交額"
    : rawLabel === "turnover_estimate" ? "估算成交額（USD）"
      : rawLabel === "relative_volume" ? "相對成交量"
        : rawLabel === "volume_shares" ? "股數成交量"
          : rawLabel
  const value = item.activity.value == null || !Number.isFinite(item.activity.value) ? null : qty(item.activity.value)
  if (!label && value == null) return "未提供"
  if (label && value != null) return `${label} ${value}`
  return label ?? value ?? "未提供"
}

function relativeVolumeNote(method: string): string | null {
  if (!/相對成交量|relative volume/i.test(method)) return null
  if (/不是周轉率|not turnover/i.test(method)) return null
  return "量能熱目前用相對成交量，不是周轉率。"
}

function orderedMarkets(markets: MarketExploreMarket[]): MarketExploreMarket[] {
  return [...markets].sort((a, b) => (MARKET_RANK[a.market] ?? 9) - (MARKET_RANK[b.market] ?? 9))
}

function orderedBuckets(buckets: MarketExploreBucket[]): MarketExploreBucket[] {
  return [...buckets].sort((a, b) => (BUCKET_RANK[a.key] ?? 9) - (BUCKET_RANK[b.key] ?? 9))
}

function BucketMetrics({ bucket, item }: { bucket: MarketExploreBucket; item: MarketExploreItem }) {
  if (bucket.key === "fast") {
    return <p className="text-caption text-ink-3">1日 <span className={`tabular-nums ${tone(item.change_1d_pct)}`}>{pct(item.change_1d_pct)}</span> · {item.change_7d_pct == null
      ? <span title="目前來源未提供可比的七日報酬">來源未提供 7 日</span>
      : <>7日 <span className={`tabular-nums ${tone(item.change_7d_pct)}`}>{pct(item.change_7d_pct)}</span></>}</p>
  }
  if (bucket.key === "active") {
    return <p className="text-caption text-ink-3">量能 {activityText(item)}</p>
  }
  const rsWindow = item.rs_benchmark_window?.trim() || "未提供"
  const hasSustained = item.rs_benchmark_1m_pp != null || item.vs_50ma_pct != null
  return <p className="text-caption text-ink-3">{hasSustained ? <>相對強弱 <span className={`tabular-nums ${tone(item.rs_benchmark_1m_pp)}`}>{pct(item.rs_benchmark_1m_pp)}</span>（{rsWindow}） · 距50日線 <span className={`tabular-nums ${tone(item.vs_50ma_pct)}`}>{pct(item.vs_50ma_pct)}</span></> : "未提供"}</p>
}

function price(value: number | null | undefined, market: string): string | null {
  if (value == null || !Number.isFinite(value)) return null
  return `${CURRENCY[market] ?? ""}${NUM.format(value)}`
}

function BucketColumn({ bucket, market }: { bucket: MarketExploreBucket; market: string }) {
  const items = bucket.items.slice(0, 3)
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-col gap-1">
        <SubsectionHeading>{bucket.label || BUCKET_LABEL[bucket.key]}</SubsectionHeading>
        <p className="text-caption text-ink-3">{BUCKET_GLOSS[bucket.key]}</p>
      </div>
      {items.length ? (
        <ul className="flex min-w-0 flex-col">
          {items.map(item => {
            const quoted = price(item.price, market)
            return <li key={item.symbol} className="flex min-w-0 flex-col gap-1 border-b border-line-soft py-2 last:border-b-0">
              <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2">
                <span className="flex min-w-0 flex-wrap items-center gap-1">
                  <span className="text-body font-medium text-ink">{item.label}</span>
                  <span className="text-caption text-ink-3">{item.symbol}</span>
                  {item.researched ? <Chip tone="mute">已有研究</Chip> : null}
                </span>
                <span className="shrink-0 text-body tabular-nums text-ink-2">{quoted ?? "價格未提供"}</span>
              </div>
              <BucketMetrics bucket={bucket} item={item} />
            </li>
          })}
        </ul>
      ) : (
        <p className="text-body text-ink-3">這次沒有標的通過這個分類（條件在上面）。</p>
      )}
    </div>
  )
}

function MarketBoard({ market, embedded = false, priorSnapshot = false }: { market: MarketExploreMarket; embedded?: boolean; priorSnapshot?: boolean }) {
  const label = MARKET_LABEL[market.market]
  // Keep the producer's three bucket contract visible even when one is empty;
  // an empty sustained bucket is a data limitation, not permission to hide the
  // decision surface or fill it from holdings.
  const buckets = orderedBuckets(market.buckets)
  const noCandidates = buckets.length > 0 && buckets.every(bucket => bucket.items.length === 0)
  const content = <div className={`flex min-w-0 flex-col gap-3 ${embedded ? "" : "rounded-lg border-[0.5px] border-line-soft bg-paper p-4 shadow-sm sm:p-5"}`}>
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
        <SubsectionHeading>{label}</SubsectionHeading>
        <span className="flex min-w-0 flex-wrap items-baseline gap-2 text-caption text-ink-3">
          <Chip tone={market.state === "ready" ? "ok" : "warn"}>{market.state === "ready" ? "完整" : market.state === "partial" ? "部分" : "無法取得"}</Chip>
          {priorSnapshot ? <Chip tone="warn">先前快照</Chip> : null}
          <span>資料日 {sourceTimestamp(market.as_of)}</span>
        </span>
      </div>
      {market.state === "unavailable" ? <p role="status" className="text-body text-warn">這市場目前無法取得資金線索。</p> : null}
      {market.state !== "unavailable" && noCandidates ? <p role="status" className="text-body text-ink-3">{market.state === "ready" ? "本次完整掃描沒有符合條件的標的。" : "目前部分掃描沒有可列標的；不能據此判定整個市場都沒有符合項目。"}</p> : null}
      {market.state === "unavailable" ? null : buckets.length ? (
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
          {buckets.map(bucket => <BucketColumn key={bucket.key} bucket={bucket} market={market.market} />)}
        </div>
      ) : (
        <p className="text-body text-ink-3">這市場沒有可列的分類。</p>
      )}
      <details className="border-t border-line-soft pt-2 text-caption text-ink-3">
        <summary className="cursor-pointer py-1">覆蓋與口徑</summary>
        <div className="flex flex-col gap-1 pt-1">
          <p>掃描 {market.universe_size} 檔 · 產出 {market.producer || "未提供"}</p>
          <p>產出時間：{sourceTimestamp(market.generated_at)} · 來源截止：{sourceTimestamp(market.source_cutoff)}</p>
          {market.state === "partial" ? <p>本次只涵蓋部分符合條件的標的；沒有用持倉或其他名單補位。</p> : null}
          {market.limitations.map((limitation, index) => <p key={`limit-${index}`}>{limitation}</p>)}
          {buckets.map(bucket => <p key={`method-${bucket.key}`}>{bucket.label || BUCKET_LABEL[bucket.key]}：{bucket.method || "方法未提供"}{bucket.key === "active" && relativeVolumeNote(bucket.method) ? ` · ${relativeVolumeNote(bucket.method)}` : ""}</p>)}
        </div>
      </details>
    </div>
  return content
}

export function MarketExplore({ market: selectedMarket, showHeading = true, embedded = false }: { market?: "tw" | "us"; showHeading?: boolean; embedded?: boolean } = {}) {
  const client = useQueryClient()
  const lastUsableQuery = useQuery({
    queryKey: ["investment-explore-last-usable"],
    queryFn: async (): Promise<LastUsableMarkets> => ({}),
    initialData: (): LastUsableMarkets => ({}),
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  })
  const query = useQuery({
    queryKey: ["investment-explore"],
    queryFn: ({ signal }) => getMarketExplore(signal),
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const data = query.data
  useEffect(() => {
    if (!data || (data.state === "unavailable" && !data.cached)) return
    client.setQueryData<LastUsableMarkets>(["investment-explore-last-usable"], current => {
      let next = current ?? {}
      for (const item of data.markets) {
        if (item.state === "unavailable" || current?.[item.market] === item) continue
        if (next === current) next = { ...current }
        next[item.market] = item
      }
      return next
    })
  }, [client, data])
  const pending = query.isPending && !data
  const failed = query.isError && !data
  const stale = query.isError && !!data
  const selected = data?.markets.filter(market => !selectedMarket || market.market === selectedMarket) ?? []
  const visibleMarkets = data ? orderedMarkets(selected) : []
  const renderedMarkets = visibleMarkets.map(market => {
    const unavailable = data?.state === "unavailable" || market.state === "unavailable"
    const producerCachedSnapshot = data?.cached && market.state !== "unavailable" ? market : undefined
    const previousSnapshot = lastUsableQuery.data[market.market] ?? producerCachedSnapshot
    return {
      marketKey: market.market,
      unavailable,
      snapshot: unavailable ? previousSnapshot : market,
      priorSnapshot: stale || (unavailable && Boolean(previousSnapshot)),
    }
  })
  const missingMarket = Boolean(data && data.state !== "unavailable" && selectedMarket && !visibleMarkets.length)
  const caption = data?.note?.trim() || "市場線索，不是持倉強弱，也不是交易建議。"

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label="市場資金在哪" aria-busy={query.isFetching}>
      {showHeading ? <div>
        <SectionHeading>市場資金在哪</SectionHeading>
        <p className="mt-1 text-caption text-ink-3">{caption}</p>
      </div> : null}
      {pending ? <p role="status" className="text-body text-ink-3">整理市場資金線索中…</p> : null}
      {failed ? <p role="alert" className="text-body text-warn">這次無法取得市場探索資料；不把缺值當成沒有符合標的。</p> : null}
      {stale ? <p role="alert" className="text-body text-warn">市場探索更新失敗。以下是先前內容，不是最新。</p> : null}
      {data?.state === "unavailable" && !visibleMarkets.length ? <p role="status" className="text-body text-warn">這次沒有取得市場資金線索；不把缺值當成沒有資金流向。</p> : null}
      {missingMarket ? <p role="status" className="text-body text-warn">資料沒有回傳{selectedMarket === "tw" ? "台股" : "美股"}探索結果；無法判定是否有符合標的。</p> : null}
      {data ? (
        <>
          <div className="flex min-w-0 flex-col gap-3">
            {renderedMarkets.map(item => <div key={item.marketKey} className="flex min-w-0 flex-col gap-2">
              {item.unavailable && item.snapshot ? <p role="status" className="text-body text-warn">目前無法取得新的{item.marketKey === "tw" ? "台股" : "美股"}探索結果；以下是先前快照。</p> : null}
              {item.unavailable && !item.snapshot ? <p role="status" className="text-body text-warn">{item.marketKey === "tw" ? "台股" : "美股"}探索資料目前無法取得；不代表沒有符合標的。</p> : null}
              {item.snapshot ? <MarketBoard market={item.snapshot} embedded={embedded} priorSnapshot={item.priorSnapshot} /> : null}
            </div>)}
          </div>
        </>
      ) : null}
      <p className="text-micro text-ink-3">{DEMO_MODE ? "數字全部由展示資料提供，沒有掃描真實市場。" : "這是市場篩選後的線索，不是持倉相對強弱，也不是買賣建議。"}</p>
    </section>
  )
}
