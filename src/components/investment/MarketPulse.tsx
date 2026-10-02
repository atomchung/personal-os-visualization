import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import {
  getInvestmentMarket, getInvestmentPulse, HOLDING_POLL_MS, IDLE_POLL_MS, isRecentQuote,
  type InvestmentMarket, type InvestmentMarketPulse,
} from "@/lib/investment"
import { classifyTwSession, formatNumber, marketIndexDirectionDisplay, primaryTwBlock, shouldPollTwPulse, sourceTimestamp, twSessionLabel, type TwSessionState } from "@/lib/investmentFormat"
import { DEMO_MODE } from "@/lib/transport"
import { MarketIndicators } from "./MarketIndicators"
import { MarketExplore } from "./MarketExplore"

const NUM = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 })
const MARKETS = [
  { key: "tw", label: "台股" },
  { key: "us", label: "美股" },
] as const
type MarketKey = typeof MARKETS[number]["key"]
// Matches core/investment_pulse.py's own CACHE_TTL_SECONDS (10 minutes):
// polling any faster would only replay the same cached payload for free,
// never surface the later publication sooner. See useTaiwanPulseRetry.
const PULSE_RETRY_MS = 10 * 60_000

function number(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : NUM.format(value)
}

function pct(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : `${formatNumber(value, true)}%`
}

function ratio(value: number | null): string {
  return value == null || !Number.isFinite(value) ? "—" : `${NUM.format(value * 100)}%`
}

function tone(value: number | null): string {
  return value == null ? "text-ink-3" : value > 0 ? "text-ok" : value < 0 ? "text-bad" : "text-ink-2"
}

function turnover(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return `${NUM.format(value / 100_000_000)} 億`
}

function BreadthRow({ label, value }: { label: string; value: InvestmentMarketPulse["breadth"]["combined"] }) {
  return <div className="grid grid-cols-[minmax(5rem,1fr)_repeat(3,minmax(2.5rem,auto))] items-baseline gap-2 border-b border-line-soft py-2 last:border-b-0">
    <span className="text-caption text-ink-3">{label}</span>
    <span className="text-body tabular-nums text-ok">{number(value.up)}</span>
    <span className="text-body tabular-nums text-bad">{number(value.down)}</span>
    <span className="text-body tabular-nums text-ink-2">{number(value.flat)}</span>
  </div>
}

function ThemeList({ title, rows }: { title: string; rows: InvestmentMarketPulse["themes"]["strongest"] }) {
  return <div className="flex min-w-0 flex-col gap-2">
    <h3 className="text-body font-medium text-ink">{title}</h3>
    {rows.length ? <ul className="flex flex-col gap-1">{rows.map(row => <li key={`${title}-${row.theme}`} className="flex min-w-0 flex-wrap items-baseline justify-between gap-2 text-body text-ink-2"><span className="min-w-0">{row.theme}</span><span className={`shrink-0 tabular-nums ${tone(row.avg_change_pct)}`}>{pct(row.avg_change_pct)}</span></li>)}</ul> : <p className="text-body text-ink-3">未提供</p>}
  </div>
}

function isTodayTaipei(value: string | null): boolean {
  if (!value) return false
  return value.slice(0, 10) === new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date())
}

function flowAmount(value: number | null): string {
  return value == null || !Number.isFinite(value) ? "—" : `${formatNumber(value / 100_000_000, true)} 億`
}

function SessionFlowSection({ flow }: { flow: InvestmentMarketPulse["flow"] }) {
  if (!flow.as_of) return null
  const inst = flow.institutional
  return <div className="min-w-0 border-t border-line-soft pt-3">
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
      <h4 className="text-body font-medium text-ink">盤後量價與法人</h4>
      {isTodayTaipei(flow.as_of) ? null : <span className="text-caption text-ink-3">資料日 {flow.as_of}</span>}
    </div>
    <p className="text-body text-ink-2">量價：加權收 {number(flow.index_close)}（{formatNumber(flow.index_change, true)}）；上市總成交金額（含 ETF 等全部證券） {turnover(flow.turnover_ntd)}，比前一日 {pct(flow.turnover_vs_prev_pct)}、比前 20 日平均 {pct(flow.turnover_vs_avg20_pct)}。</p>
    {inst.status === "published" ? <p className="text-body text-ink-2">法人：外資 {flowAmount(inst.foreign_net_ntd)}、投信 {flowAmount(inst.trust_net_ntd)}、自營商 {flowAmount(inst.dealer_net_ntd)}，合計 {flowAmount(inst.total_net_ntd)}；前一日外資 {flowAmount(inst.prev_foreign_net_ntd)}。</p> : inst.status === "not_published" ? <p className="text-body text-ink-3">三大法人約 15:00 公布。</p> : <p className="text-body text-ink-3">三大法人資料這次沒有取得。</p>}
  </div>
}

/** Same shape as the ticker quotes' own polling (see StockMomentum's per-symbol
 * `useQueries`): fast while the index quote itself is recent, slow once it has
 * gone quiet -- not MarketIndicators' cross-market "is anything active"
 * timer, which stays keyed to US-hours instruments and would under-poll ^TWII
 * all through the Taiwan session. Shares the "investment-market" cache with
 * MarketIndicators (same queryKey), so this never doubles the network cost;
 * it only gives the Taiwan tab its own, more appropriate refresh cadence. */
function useTaiwanIndexQuote() {
  return useQuery({
    queryKey: ["investment-market"],
    queryFn: ({ signal }) => getInvestmentMarket(signal),
    staleTime: 15_000,
    retry: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: (q) => {
      if (DEMO_MODE) return false
      const twii = q.state.data?.items.find(item => item.symbol === "^TWII")
      return isRecentQuote(twii?.quoted_at) ? HOLDING_POLL_MS : IDLE_POLL_MS
    },
    refetchIntervalInBackground: false,
  })
}

/** A wall clock that ticks forward on its own, independently of whether the
 * index quote fetch keeps succeeding. Session classification must not freeze
 * at the last successful fetch's timestamp -- a stalled or failing refetch
 * right around the close would otherwise leave the page reporting "open"
 * indefinitely, since `now` would never advance past the session's own end.
 * The lazy initializer runs once, synchronously, as part of mounting this
 * component's own state -- not a read during an already-rendered render body
 * -- and the effect only ever calls `setNow` from the interval's own later
 * callback, never synchronously within the effect itself. */
function useNowTick(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function TaiwanIndexIntraday({ twii, isError, isPending }: {
  twii?: InvestmentMarket["items"][number]
  isError: boolean
  isPending: boolean
}) {
  const change = twii?.change ?? null
  const statuses: string[] = []
  if (isError) statuses.push(twii ? "更新失敗，顯示上次數值" : "讀取失敗，盤中報價不可用")
  if (!twii && !isError) statuses.push(isPending ? "讀取中…" : "盤中報價未取得")
  if (twii?.state === "stale") statuses.push("較早報價；以下保留來源提供的數值與時間")
  else if (twii && (twii.state === "unavailable" || twii.value == null)) statuses.push("來源未提供盤中數值")

  return <div className="min-w-0">
    <p className="text-caption text-ink-3">盤中即時指數 · 加權指數</p>
    <p className="text-display font-semibold tabular-nums text-ink">{number(twii?.value ?? null)}</p>
    <p className={`text-body tabular-nums ${tone(change)}`}>{number(change)} 點 · {pct(twii?.change_percent ?? null)}</p>
    {statuses.length ? <p role="status" className="text-caption text-warn">{statuses.join(" · ")}</p> : null}
    <p className="text-micro text-ink-3">Yahoo Finance · 報價時間 {sourceTimestamp(twii?.quoted_at)} · 報價可能延遲。</p>
  </div>
}

function TaiwanOverview({ pulseQuery }: {
  pulseQuery: { data?: InvestmentMarketPulse; isError: boolean; isPending: boolean; refetch: () => void }
}) {
  const pulse = pulseQuery.data
  // Mounted unconditionally -- independent of whether the pulse below has
  // loaded, failed, or is still pending -- so a pulse failure never also
  // stops the real-time TAIEX request from starting.
  const indexQuery = useTaiwanIndexQuote()
  const twii = indexQuery.data?.items.find(item => item.symbol === "^TWII")
  // A ticking clock, not the snapshot's own fetch time: session state must
  // keep advancing toward "closed" even if the index fetch stalls or starts
  // failing right around the close (otherwise a frozen `fetched_at` would
  // leave the page reporting "open" indefinitely).
  const now = useNowTick(30_000)
  const sessionState = classifyTwSession({
    now,
    regularStart: twii?.session_start ?? null,
    regularEnd: twii?.session_end ?? null,
    quotedAt: twii?.quoted_at ?? null,
    dailyAsOf: pulse?.as_of ?? null,
  })
  // While the page believes today's session has closed but the close-of-day
  // pulse has not caught up to it yet (closed_before_daily), or has caught
  // up but is still only partially published for today -- e.g. TWSE is out
  // and TPEx is not yet, so 上櫃/漲停/跌停 stay blank -- keep checking for the
  // rest, until `shouldPollTwPulse`'s own cutoff. Otherwise the page would
  // need a manual reload to ever pick up the later publication. See
  // `shouldPollTwPulse` for the full, exported, unit-tested condition; never
  // armed outside it (open, already fully caught up, or undetermined).
  const shouldPoll = shouldPollTwPulse({ sessionState, pulseState: pulse?.state, pulseAsOf: pulse?.as_of ?? null, now })
  const retryPulse = pulseQuery.refetch
  useEffect(() => {
    // Depend on the boolean decision and the `refetch` function, not the
    // whole query-result object or raw inputs -- both stay referentially/
    // value-stable across the 30s re-renders `useNowTick` otherwise causes,
    // so the interval is not torn down and rebuilt before a 10-minute
    // countdown can complete; it only restarts when the decision itself
    // actually flips (e.g. crossing 18:00, or the pulse becoming ready).
    if (DEMO_MODE || !shouldPoll) return
    const id = setInterval(() => { retryPulse() }, PULSE_RETRY_MS)
    return () => clearInterval(id)
  }, [shouldPoll, retryPulse])
  return <TaiwanMarketPresentation
    pulse={pulse}
    pulseError={pulseQuery.isError}
    pulsePending={pulseQuery.isPending}
    twii={twii}
    indexError={indexQuery.isError}
    indexPending={indexQuery.isPending}
    sessionState={sessionState}
  />
}

export function TaiwanMarketPresentation({ pulse, pulseError, pulsePending, twii, indexError, indexPending, sessionState }: {
  pulse?: InvestmentMarketPulse
  pulseError: boolean
  pulsePending: boolean
  twii?: InvestmentMarket["items"][number]
  indexError: boolean
  indexPending: boolean
  sessionState: TwSessionState
}) {
  const sessionLabel = twSessionLabel(sessionState, twii?.quoted_at ?? null, pulse?.as_of ?? null)
  const showIntradayPrimary = primaryTwBlock(sessionState, twii?.value != null) === "intraday"
  const intradayBlock = <TaiwanIndexIntraday twii={twii} isError={indexError} isPending={indexPending} />

  if (!pulse) {
    return <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-body font-medium text-ink">盤中即時指數</h3>
        <span className="text-caption text-ink-3">{sessionLabel}</span>
      </div>
      {intradayBlock}
      <p role="status" className={`text-body ${pulseError ? "text-warn" : "text-ink-3"}`}>
        {pulseError ? "台股市場脈搏這次無法取得；保留缺值，不以空清單代替。請按上方「刷新盤面」重試。" : pulsePending ? "讀取台股整體盤感中…" : "台股日線市場快照尚未提供。"}
      </p>
    </div>
  }

  const direction = marketIndexDirectionDisplay(pulse.index.direction_check?.status, pulse.index.change, pulse.index.change_pct)
  const directionLabel = direction.state === "confirmed"
    ? "來源已確認方向"
    : direction.state === "needs_review" ? "漲跌方向待核對" : "漲跌方向未能確認"
  const b = pulse.breadth
  const pulseCompleteness = pulse.state === "ready" ? "完整" : pulse.state === "partial" ? "部分" : "無法取得"
  const dailyBlock = <section aria-label="日線市場快照" className="flex min-w-0 flex-col gap-3">
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2 border-b border-line-soft pb-2">
      <div className="min-w-0">
        <h4 className="text-body font-medium text-ink">加權指數與市場廣度</h4>
        <p className="text-caption text-ink-3">TWSE／TPEx 日線快照 · 成交額與族群熱度</p>
      </div>
      <Chip tone={pulse.state === "ready" ? "ok" : "warn"}>{pulseCompleteness}</Chip>
    </div>
    <div className="flex min-w-0 flex-col gap-1 text-caption text-ink-3">
      <p>快照日期 {sourceTimestamp(pulse.as_of)} · 資料截止 {sourceTimestamp(pulse.source_cutoff)}</p>
      <p>行情來源日：TWSE {sourceTimestamp(pulse.source_dates?.twse)} · TPEx {sourceTimestamp(pulse.source_dates?.tpex)}</p>
    </div>
    {pulse.state === "unavailable" ? <p role="status" className="text-body text-warn">這次沒有取得台股市場脈搏；缺值不代表沒有變化。</p> : <>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <p className="text-caption text-ink-3">日線指數（TWSE） · {pulse.index.label}</p>
          <p className="text-display font-semibold tabular-nums text-ink">{number(pulse.index.value)}</p>
          <p className={`text-body tabular-nums ${tone(direction.changePercent)}`}>{direction.state === "confirmed" ? `${number(direction.change)} 點 · ${pct(direction.changePercent)}` : directionLabel}</p>
          <p className="text-caption text-ink-3">指數行情日 {sourceTimestamp(pulse.source_dates?.twse)}</p>
          {direction.state !== "confirmed" && pulse.index.direction_check?.reason ? <p className="text-caption text-ink-3">{pulse.index.direction_check.reason}</p> : null}
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 text-caption">
          <span className="text-ink-3">漲方比例</span><span className="text-right tabular-nums text-ink-2">{ratio(pulse.breadth.advancer_ratio)}</span>
          <span className="text-ink-3">漲停 / 跌停</span><span className="text-right tabular-nums text-ink-2">{number(b.combined.limit_up)} / {number(b.combined.limit_down)}</span>
          <span className="text-ink-3">個股成交額</span><span className="text-right tabular-nums text-ink-2">{turnover(pulse.turnover.combined_stock)}</span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="grid grid-cols-[minmax(5rem,1fr)_repeat(3,minmax(2.5rem,auto))] gap-2 border-b border-line py-2 text-caption text-ink-3"><span>市場</span><span className="text-right">漲</span><span className="text-right">跌</span><span className="text-right">平</span></div>
        <BreadthRow label="上市" value={b.twse} />
        <BreadthRow label="上櫃" value={b.tpex} />
        <BreadthRow label="合計" value={b.combined} />
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1"><p className="text-caption text-ink-3">成交額（新台幣）</p><p className="text-body text-ink-2">上市個股 {turnover(pulse.turnover.twse_common_stock)} · 上櫃個股 {turnover(pulse.turnover.tpex_stock)}</p></div>
        <div className="grid min-w-0 grid-cols-2 gap-3"><ThemeList title="科技鏈熱度 · 強" rows={pulse.themes.strongest} /><ThemeList title="科技鏈熱度 · 弱" rows={pulse.themes.weakest} /></div>
      </div>
    </>}
    <SessionFlowSection flow={pulse.flow} />
  </section>

  const supportingViewSummary = showIntradayPrimary
    ? `日線市場快照 · 截止 ${sourceTimestamp(pulse.source_cutoff)}`
    : `盤中即時指數 · Yahoo Finance · ${sourceTimestamp(twii?.quoted_at)}`

  return <div className="flex min-w-0 flex-col gap-4">
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
      <h3 className="text-body font-medium text-ink">{showIntradayPrimary ? "盤中即時指數" : "日線市場快照"}</h3>
      <span className="text-caption text-ink-3">{sessionLabel}</span>
    </div>
    {pulseError ? <p role="status" className="text-caption text-warn">台股市場脈搏更新失敗；以下保留上次快照與原始日期，不是本次更新。</p> : null}
    {showIntradayPrimary ? intradayBlock : dailyBlock}
    <details className="border-t border-line-soft pt-3">
      <summary className="cursor-pointer py-1 text-caption text-ink-3">{supportingViewSummary}</summary>
      <div className="flex min-w-0 flex-col gap-4 pt-2">{showIntradayPrimary ? dailyBlock : intradayBlock}</div>
    </details>
    <details className="border-t border-line-soft pt-2 text-caption text-ink-3"><summary className="cursor-pointer py-1">市場資料時間、覆蓋與方向核對</summary><div className="flex flex-col gap-1 pt-1"><p>要求日期：{sourceTimestamp(pulse.requested_date)} · 資料產出：{sourceTimestamp(pulse.generated_at)}</p><p>產出：{pulse.producer}</p><p>資料截止：{sourceTimestamp(pulse.source_cutoff)}</p><p>方向核對：{directionLabel}{pulse.index.direction_check?.session_flow_status ? ` · 盤後來源 ${pulse.index.direction_check.session_flow_status}` : ""}</p>{pulse.index.direction_check?.reason ? <p>{pulse.index.direction_check.reason}</p> : null}{pulse.index.direction_check ? <div className="grid grid-cols-1 gap-1 rounded border border-line-soft p-2 sm:grid-cols-2"><p>TWSE 日結原值：{number(pulse.index.direction_check.twse_close)} 點；漲跌 {number(pulse.index.direction_check.twse_change)} 點（{pct(pulse.index.direction_check.twse_change_pct)}）</p><p>盤後量價原值：收 {number(pulse.index.direction_check.session_flow_close)} 點；漲跌 {number(pulse.index.direction_check.session_flow_change)} 點</p></div> : null}<p>TWSE 行情日：{sourceTimestamp(pulse.source_dates?.twse)} · TPEx 行情日：{sourceTimestamp(pulse.source_dates?.tpex)}</p>{pulse.flow.as_of ? <p>{pulse.flow.basis}</p> : null}{pulse.flow.as_of || pulse.flow.limitations.length ? <p>來源：TWSE 每日市場成交資訊（FMTQIK）、三大法人買賣金額統計表（BFI82U）</p> : null}{pulse.flow.limitations.map((item, index) => <p key={`flow-${index}`}>{item}</p>)}{pulse.limitations.map((item, index) => <p key={index}>{item}</p>)}</div></details>
  </div>
}

function UnitedStatesOverview() {
  return <div className="flex min-w-0 flex-col gap-3">
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
      <h3 className="text-body font-medium text-ink">整體盤感</h3>
      <span className="text-caption text-ink-3">breadth · 成交額 · sector/theme：未提供</span>
    </div>
    <MarketIndicators market="us" showHeading={false} />
    <p className="text-caption text-ink-3">目前只顯示可靠取得的 benchmark；沒有同等可靠的美股 breadth／成交額／sector snapshot，不用台股數字補位。</p>
  </div>
}

function MarketTab({ market, pulseQuery }: {
  market: MarketKey
  pulseQuery: { data?: InvestmentMarketPulse; isError: boolean; isPending: boolean; refetch: () => void }
}) {
  return <div role="tabpanel" aria-label={`${market === "tw" ? "台股" : "美股"}現在盤面`} className="flex min-w-0 flex-col gap-4 pt-4">
    {market === "tw" ? <TaiwanOverview pulseQuery={pulseQuery} /> : <UnitedStatesOverview />}
    <div className="border-t border-line-soft pt-4">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-body font-medium text-ink">市場資金在哪</h3>
        <span className="text-caption text-ink-3">市場篩選線索，不是持倉排名</span>
      </div>
      <MarketExplore market={market} showHeading={false} embedded />
    </div>
  </div>
}

export function MarketPulse() {
  const [market, setMarket] = useState<MarketKey>("tw")
  const query = useQuery({ queryKey: ["investment-pulse"], queryFn: ({ signal }) => getInvestmentPulse(signal), staleTime: 60_000, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false })
  return <Card aria-label="現在盤面與市場資金" className="min-w-0 overflow-hidden shadow-sm">
    <div className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-body font-medium text-ink">市場現在怎麼走</p>
          <p className="text-caption text-ink-3">台股盤中以 Yahoo Finance 加權指數為主；日線市場快照列出 TWSE／TPEx 行情日、廣度、成交額與族群熱度，兩種資料各自標示來源時間。美股指標會自動更新。</p>
        </div>
        <div role="tablist" aria-label="市場" className="flex min-w-0 gap-3 border-b border-line-soft">
          {MARKETS.map((item, index) => <Button key={item.key} role="tab" aria-selected={market === item.key} tabIndex={market === item.key ? 0 : -1} variant="link" className={`rounded-none border-b-2 px-0 py-2 text-body ${market === item.key ? "border-accent text-ink" : "border-transparent text-ink-3"}`} onClick={() => setMarket(item.key)} onKeyDown={event => {
            const next = event.key === "Home" ? 0 : event.key === "End" ? MARKETS.length - 1 : event.key === "ArrowRight" ? (index + 1) % MARKETS.length : event.key === "ArrowLeft" ? (index + MARKETS.length - 1) % MARKETS.length : null
            if (next === null) return
            event.preventDefault()
            setMarket(MARKETS[next].key)
            ;(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next])?.focus()
          }}>{item.label}</Button>)}
        </div>
      </div>
      <MarketTab market={market} pulseQuery={query} />
    </div>
  </Card>
}
