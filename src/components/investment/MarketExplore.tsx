import { useQuery } from "@tanstack/react-query"
import { Card, SectionHeading, SubsectionHeading } from "@/components/ui/card"
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
const MARKET_RANK = { tw: 0, us: 1 } as const
const BUCKET_RANK = { fast: 0, active: 1, sustained: 2 } as const
const NUM = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 })

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
  const label = item.activity.label?.trim() || null
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
    return <p className="text-caption text-ink-3">1日 <span className={`tabular-nums ${tone(item.change_1d_pct)}`}>{pct(item.change_1d_pct)}</span> · 7日 <span className={`tabular-nums ${tone(item.change_7d_pct)}`}>{pct(item.change_7d_pct)}</span></p>
  }
  if (bucket.key === "active") {
    return <p className="text-caption text-ink-3">量能 {activityText(item)}</p>
  }
  const rsWindow = item.rs_benchmark_window?.trim() || "未提供"
  const hasSustained = item.rs_benchmark_1m_pp != null || item.vs_50ma_pct != null
  return <p className="text-caption text-ink-3">{hasSustained ? <>相對強弱 <span className={`tabular-nums ${tone(item.rs_benchmark_1m_pp)}`}>{pct(item.rs_benchmark_1m_pp)}</span>（{rsWindow}） · 距50日線 <span className={`tabular-nums ${tone(item.vs_50ma_pct)}`}>{pct(item.vs_50ma_pct)}</span></> : "未提供"}</p>
}

function BucketColumn({ bucket }: { bucket: MarketExploreBucket }) {
  const items = bucket.items.slice(0, 3)
  const volumeNote = bucket.key === "active" ? relativeVolumeNote(bucket.method) : null
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <SubsectionHeading>{bucket.label || BUCKET_LABEL[bucket.key]}</SubsectionHeading>
      {items.length ? (
        <ul className="flex min-w-0 flex-col">
          {items.map(item => (
            <li key={item.symbol} className="flex min-w-0 flex-col gap-1 border-b border-line-soft py-2 last:border-b-0">
              <div className="flex min-w-0 flex-wrap items-center gap-1">
                <span className="text-body font-medium text-ink">{item.label}</span>
                <span className="text-caption text-ink-3">{item.symbol}</span>
                {item.researched ? <Chip tone="mute">已有研究</Chip> : null}
              </div>
              <BucketMetrics bucket={bucket} item={item} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body text-ink-3">這個分類目前沒有可列的標的。</p>
      )}
    </div>
  )
}

function MarketBoard({ market }: { market: MarketExploreMarket }) {
  const label = MARKET_LABEL[market.market]
  const buckets = orderedBuckets(market.buckets)
  return (
    <Card className="flex min-w-0 flex-col gap-3 overflow-hidden p-4 sm:p-5">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
        <SubsectionHeading>{label}</SubsectionHeading>
        <span className="text-caption text-ink-3">資料截至 {sourceTimestamp(market.as_of)}</span>
      </div>
      {market.state === "partial" ? <p role="status" className="text-caption text-warn">這市場只有部分標的通過篩選，沒有補上持倉或其他名單。</p> : null}
      {market.state === "unavailable" ? <p role="status" className="text-body text-warn">這市場目前無法取得資金線索。</p> : null}
      {market.limitations.length ? <ul className="list-disc pl-5 text-caption text-warn">{market.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul> : null}
      {market.state === "unavailable" ? null : buckets.length ? (
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
          {buckets.map(bucket => <BucketColumn key={bucket.key} bucket={bucket} />)}
        </div>
      ) : (
        <p className="text-body text-ink-3">這市場沒有可列的分類。</p>
      )}
      <details className="border-t border-line-soft pt-2 text-caption text-ink-3">
        <summary className="cursor-pointer py-1">資料口徑</summary>
        <div className="flex flex-col gap-1 pt-1">
          <p>掃描 {market.universe_size} 檔 · 產出 {market.producer || "未提供"}</p>
          <p>產出時間：{sourceTimestamp(market.generated_at)} · 來源截止：{sourceTimestamp(market.source_cutoff)}</p>
          {buckets.map(bucket => <p key={`method-${bucket.key}`}>{bucket.label || BUCKET_LABEL[bucket.key]}：{bucket.method || "方法未提供"}{bucket.key === "active" && relativeVolumeNote(bucket.method) ? ` · ${relativeVolumeNote(bucket.method)}` : ""}</p>)}
        </div>
      </details>
    </Card>
  )
}

export function MarketExplore() {
  const query = useQuery({
    queryKey: ["investment-explore"],
    queryFn: ({ signal }) => getMarketExplore(signal),
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const data = query.data
  const pending = query.isPending && !data
  const failed = query.isError && !data
  const stale = query.isError && !!data
  const hasItems = data?.markets.some(market => market.buckets.some(bucket => bucket.items.length > 0)) ?? false
  const visibleMarkets = data ? orderedMarkets(data.markets).filter(market => market.buckets.some(bucket => bucket.items.length > 0)) : []
  const caption = data?.note?.trim() || "市場線索，不是持倉強弱，也不是交易建議。"

  // Today is a decision-reading surface, not an operational error dashboard.
  // A first-load producer failure stays available in the global source status instead of
  // occupying a full primary section; stale cached data remains visible and explicitly marked.
  if (failed || data?.state === "unavailable" || (data && !hasItems)) return null

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label="市場資金在哪" aria-busy={query.isFetching}>
      <div>
        <SectionHeading>市場資金在哪</SectionHeading>
        <p className="mt-1 text-caption text-ink-3">{caption}</p>
      </div>
      {pending ? <p role="status" className="text-body text-ink-3">整理市場資金線索中…</p> : null}
      {stale ? <p role="alert" className="text-body text-warn">市場探索更新失敗。以下是先前內容，不是最新。</p> : null}
      {data && data.state !== "unavailable" ? (
        <>
          <div className="flex min-w-0 flex-col gap-3">
            {visibleMarkets.map(market => <MarketBoard key={market.market} market={market} />)}
          </div>
        </>
      ) : null}
      <p className="text-micro text-ink-3">{DEMO_MODE ? "數字全部由展示資料提供，沒有掃描真實市場。" : "這是市場篩選後的線索，不是持倉相對強弱，也不是買賣建議。"}</p>
    </section>
  )
}
