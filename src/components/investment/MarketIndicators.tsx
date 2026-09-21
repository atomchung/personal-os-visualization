import { useQuery } from "@tanstack/react-query"
import { Card, SectionHeading } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { ACTIVE_POLL_MS, IDLE_POLL_MS, SESSION_LABELS, getInvestmentMarket } from "@/lib/investment"
import { formatNumber, quoteTime } from "@/lib/investmentFormat"
import { DEMO_MODE } from "@/lib/transport"

function quoteLink(value: string): string | undefined {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.hostname === "finance.yahoo.com" ? url.href : undefined
  } catch {
    return undefined
  }
}

/** Quotes refresh on their own while this tab is open; they never rewrite the brief. */
export function MarketIndicators() {
  const query = useQuery({
    queryKey: ["investment-market"],
    queryFn: ({ signal }) => getInvestmentMarket(signal),
    staleTime: 15_000,
    retry: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: (q) => DEMO_MODE ? false : (q.state.data?.active === false ? IDLE_POLL_MS : ACTIVE_POLL_MS),
    refetchIntervalInBackground: false,
  })
  const data = query.data

  return (
    <section className="flex min-w-0 flex-col gap-2" aria-label="現在盤面" aria-busy={query.isFetching}>
      <div className="flex flex-wrap items-baseline gap-2">
        <SectionHeading>現在盤面</SectionHeading>
        <span className="text-caption text-ink-3">
          {DEMO_MODE ? "固定合成報價" : <>{data ? `讀取 ${quoteTime(data.fetched_at)}` : ""}{data ? (data.active ? " · 開著就每 30 秒更新" : " · 休市，每 5 分鐘確認") : ""}</>}
        </span>
      </div>
      {query.isPending ? <p role="status" className="text-body text-ink-3">正在讀取市場指標…</p> : null}
      {query.isError ? (
        <p role="status" className="text-caption leading-body text-warn">
          {data ? "本次更新失敗，保留上次取得的報價與時間。" : "暫時讀不到市場指標，仍可閱讀簡報。"}
        </p>
      ) : null}
      {data?.state === "unavailable" ? (
        <p className="text-caption leading-body text-warn">目前無法取得市場報價。</p>
      ) : data?.state === "partial" ? (
        <p className="text-caption leading-body text-warn">部分指標未取得或已過時，請留意各項報價時間。</p>
      ) : null}
      {data && data.items.length > 0 ? (
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {data.items.map((item) => {
            const link = quoteLink(item.source_url)
            const up = item.change !== null && item.change > 0
            const down = item.change !== null && item.change < 0
            return (
              <Card key={item.symbol} className="flex min-w-0 flex-col gap-1 p-2">
                <div className="flex flex-wrap items-center justify-between gap-1 text-label font-semibold leading-body text-ink-2">
                  <span className="min-w-0">
                    {link ? <a href={link} target="_blank" rel="noreferrer" className="hover:underline">{item.label}</a> : item.label}
                    {item.code ? <span className="font-normal text-ink-3"> {item.code}</span> : null}
                  </span>
                  {item.session ? <Chip tone={item.session === "regular" ? "ok" : "mute"}>{SESSION_LABELS[item.session]}</Chip> : null}
                </div>
                <p className="flex min-w-0 flex-wrap items-baseline gap-1 text-body font-semibold leading-body tabular-nums text-ink">
                  <span className="min-w-0 break-words">{formatNumber(item.value)}</span>
                  {item.value !== null && item.unit ? <span className="text-caption font-normal text-ink-3">{item.unit}</span> : null}
                </p>
                <p className={`flex flex-wrap gap-1 text-caption leading-body tabular-nums ${up ? "text-ok" : down ? "text-bad" : "text-ink-3"}`}>
                  <span>{formatNumber(item.change, true)}</span>
                  <span>({item.change_percent === null ? "—" : `${formatNumber(item.change_percent, true)}%`})</span>
                </p>
                <p className="text-micro leading-body text-ink-3">{quoteTime(item.quoted_at)}</p>
                {item.state !== "available" ? <div><Chip tone="warn">{item.state === "stale" ? "較早報價" : "未取得"}</Chip></div> : null}
              </Card>
            )
          })}
        </div>
      ) : null}
      <p className="text-micro text-ink-3">{DEMO_MODE ? "數字全部由展示資料提供，沒有查詢行情供應商。" : "Yahoo Finance，報價可能延遲；漲跌較前一交易日收盤；時間為台北時間。半導體是費城半導體指數（SOX），台股大盤是加權指數。"}</p>
    </section>
  )
}
