import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
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

function BucketColumn({ bucket, marketState }: { bucket: MarketExploreBucket; marketState: MarketExploreMarket["state"] }) {
  const items = bucket.items.slice(0, 3)
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
        <p className="text-body text-ink-3">{marketState === "ready" ? "本次掃描沒有標的通過這個分類。" : "目前沒有可列標的；資料不完整，不能據此判定整個市場都沒有符合項目。"}</p>
      )}
    </div>
  )
}

function MarketBoard({ market, embedded = false, priorSnapshot = false }: { market: MarketExploreMarket; embedded?: boolean; priorSnapshot?: boolean }) {
  const label = MARKET_LABEL[market.market]
  const buckets = orderedBuckets(market.buckets)
  const hasItems = buckets.some(bucket => bucket.items.length > 0)
  const stateLabel = market.state === "ready" ? "完整" : market.state === "partial" ? "部分" : "無法取得"
  return (
    <div className={`flex min-w-0 flex-col gap-3 ${embedded ? "" : "rounded-lg border-[0.5px] border-line-soft bg-paper p-4 shadow-sm sm:p-5"}`}>
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
        <SubsectionHeading>{embedded ? "市場資金在哪" : label}</SubsectionHeading>
        <span className="flex flex-wrap items-baseline gap-2 text-caption text-ink-3"><Chip tone={market.state === "ready" ? "ok" : "warn"}>{stateLabel}</Chip>{priorSnapshot ? <Chip tone="warn">先前快照</Chip> : null}<span>資料日 {sourceTimestamp(market.as_of)} · 來源截止 {sourceTimestamp(market.source_cutoff)}</span></span>
      </div>
      {market.state === "unavailable" ? <p role="status" className="text-body text-warn">此市場資料目前無法確認；以下保留的內容不是最新。</p> : null}
      {market.state !== "unavailable" && !hasItems ? <p role="status" className="text-body text-ink-3">{market.state === "partial" ? "目前部分掃描沒有可列標的；不能據此判定整個市場都沒有符合項目。" : priorSnapshot ? "先前的完整掃描沒有符合條件的標的；這不是最新結果。" : "本次完整掃描沒有符合條件的標的。"}</p> : null}
      {market.state !== "unavailable" ? buckets.length ? (
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
          {buckets.map(bucket => <BucketColumn key={bucket.key} bucket={bucket} marketState={market.state} />)}
        </div>
      ) : (
        <p className="text-body text-ink-3">這市場沒有可列的分類。</p>
      ) : priorSnapshot && hasItems ? <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">{buckets.map(bucket => <BucketColumn key={bucket.key} bucket={bucket} marketState={market.state} />)}</div> : null}
      <details className="border-t border-line-soft pt-2 text-caption text-ink-3">
        <summary className="cursor-pointer py-1">覆蓋與口徑</summary>
        <div className="flex flex-col gap-1 pt-1">
          <p>掃描 {market.universe_size} 檔 · 產出 {market.producer || "未提供"}</p>
          <p>產出時間：{sourceTimestamp(market.generated_at)}</p>
          {market.state === "partial" ? <p>本次只涵蓋部分符合條件的標的；沒有用持倉或其他名單補位。</p> : null}
          {market.limitations.map((limitation, index) => <p key={`limit-${index}`}>{limitation}</p>)}
          {buckets.map(bucket => <p key={`method-${bucket.key}`}>{bucket.label || BUCKET_LABEL[bucket.key]}：{bucket.method || "方法未提供"}{bucket.key === "active" && relativeVolumeNote(bucket.method) ? ` · ${relativeVolumeNote(bucket.method)}` : ""}</p>)}
        </div>
      </details>
    </div>
  )
}

export function MarketExplore({ market, embedded = false }: { market: "tw" | "us"; embedded?: boolean }) {
  const [lastUsableMarkets, setLastUsableMarkets] = useState<Partial<Record<"tw" | "us", MarketExploreMarket>>>({})
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
    if (!data || data.state === "unavailable") return
    setLastUsableMarkets(current => {
      let next = current
      for (const item of data.markets) {
        if (item.state === "unavailable" || current[item.market] === item) continue
        if (next === current) next = { ...current }
        next[item.market] = item
      }
      return next
    })
  }, [data])
  const pending = query.isPending && !data
  const selected = data?.markets.find(item => item.market === market)
  const unavailable = data?.state === "unavailable" || selected?.state === "unavailable"
  const producerCachedSnapshot = data?.cached && selected?.state !== "unavailable" ? selected : undefined
  const previousSnapshot = lastUsableMarkets[market] ?? producerCachedSnapshot
  const usingPreviousSnapshot = unavailable && Boolean(previousSnapshot)
  const displayedMarket = unavailable ? previousSnapshot : selected
  const priorSnapshot = Boolean((query.isError && data) || usingPreviousSnapshot)
  const caption = data?.note?.trim() || "市場線索，不是基本面證據、持倉排名或買賣建議。"

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label={`${MARKET_LABEL[market]}市場探索`} aria-busy={query.isFetching}>
      {!embedded ? <div><SectionHeading>市場資金在哪</SectionHeading><p className="mt-1 text-caption text-ink-3">{caption}</p></div> : <p className="text-caption text-ink-3">{caption}</p>}
      {pending ? <p role="status" className="text-body text-ink-3">整理市場資金線索中…</p> : null}
      {query.isError && !data ? <p role="alert" className="text-body text-warn">市場探索這次無法取得；目前無法判定是否有符合標的。</p> : null}
      {query.isError && data ? <p role="alert" className="text-body text-warn">市場探索更新失敗，以下保留上次讀取內容；不是最新結果。</p> : null}
      {unavailable && !usingPreviousSnapshot ? <p role="status" className="text-body text-warn">{selected ? `${MARKET_LABEL[market]}探索資料目前無法取得；不代表沒有符合標的。` : data?.message || "市場探索資料目前無法取得；不代表沒有符合標的。"}</p> : null}
      {usingPreviousSnapshot ? <p role="status" className="text-body text-warn">目前無法取得新的{MARKET_LABEL[market]}探索結果；以下是先前快照。</p> : null}
      {data && !selected && !unavailable ? <p role="status" className="text-body text-warn">資料沒有回傳{MARKET_LABEL[market]}探索結果；無法判定是否有符合標的。</p> : null}
      {displayedMarket && (!unavailable || usingPreviousSnapshot) ? <MarketBoard market={displayedMarket} embedded={embedded} priorSnapshot={priorSnapshot} /> : null}
      <p className="text-micro text-ink-3">{DEMO_MODE ? "數字全部由展示資料提供，沒有掃描真實市場。" : "候選名單由來源排序；這是市場線索，不是買賣建議。"}</p>
    </section>
  )
}
