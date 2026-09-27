import { useQuery } from "@tanstack/react-query"
import { getTwRelativeStrength, type TwRelativeStrength } from "@/lib/investment"
import { formatNumber, sourceTimestamp } from "@/lib/investmentFormat"

export function useTaiwanRs() {
  return useQuery({ queryKey: ["investment-tw-relative-strength"], queryFn: ({ signal }) => getTwRelativeStrength(signal), staleTime: 300_000, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false })
}
export type TaiwanRsProps = { symbol: string; data?: TwRelativeStrength & { cached?: boolean }; pending: boolean; failed: boolean }

/** Join only exact canonical symbols with confirmed exchange identity. */
function holding({ symbol, data }: TaiwanRsProps) {
  const exchange = symbol.endsWith(".TW") ? "TWSE" : symbol.endsWith(".TWO") ? "TPEx" : null
  return exchange ? data?.holdings.find(row => row.symbol === symbol && row.exchange === exchange) : undefined
}
function points(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "未取得" : `${formatNumber(value, true)} 個百分點`
}
export function TaiwanRsCell(props: TaiwanRsProps) {
  const row = holding(props)
  const value = props.data?.state === "unavailable" || row?.state === "unavailable" ? null : row?.market_rs_pp
  return <span data-tw-rs-symbol={props.symbol} className="flex min-w-0 flex-col gap-1">
    <span className="text-caption text-ink-3 sm:hidden">相對強度</span>
    <span className={`tabular-nums ${value != null && value > 0 ? "text-ok" : value != null && value < 0 ? "text-bad" : "text-ink-3"}`}>{props.pending && !props.data ? "讀取中…" : points(value)}</span>
    <span className="text-caption text-ink-3">對 {row?.market_benchmark?.id ?? "基準未提供"}</span>
    <span className="text-micro text-ink-3">{row?.window_trading_days == null ? "窗口未提供" : `${row.window_trading_days} 交易日`} · {row?.as_of ?? "日期未提供"}</span>
    {props.failed ? <span role="status" className="text-caption text-warn">{props.data ? "更新失敗，保留原資料" : "讀取失敗"}</span> : null}
    {props.data?.cached ? <span className="text-micro text-ink-3">快取資料</span> : null}
    {row?.state === "partial" ? <span className="text-micro text-ink-3">部分可用</span> : null}
  </span>
}
export function TaiwanRsDetails(props: TaiwanRsProps) {
  const row = holding(props)
  return <div className="flex min-w-0 flex-col gap-2">
    <p>台股相對強度：{props.data?.state === "unavailable" || row?.state === "unavailable" ? "來源不可用" : row ? "部分可用" : "來源未提供此標的的比較資料"}</p>
    {row ? <>
      <p>基準：{row.market_benchmark?.id ?? "未提供"} · {row.market_benchmark?.label ?? "名稱未提供"}</p>
      <p>比較窗口 {sourceTimestamp(row.window_start)} 至 {sourceTimestamp(row.as_of)} · {row.window_trading_days ?? "未知"} 個交易日；觀察點 {row.coverage.holding_sessions ?? "未知"}/{row.coverage.expected_sessions ?? "未知"}</p>
      <p>同業相對強度：{points(row.peer_rs_pp)} · 同業籃子：{row.peer_group ?? "未提供"}</p>
      {row.limitations.map((item, index) => <p key={index} className="text-warn">{item}</p>)}
      <p>來源原因：{row.reason_codes.join("、") || "未提供"} · Provider symbol：{row.provider_symbol ?? "未提供"}</p>
      <p>個股價格來源：{row.price_source ?? "未提供"}</p><p className="break-all">大盤來源：{row.benchmark_source ?? "未提供"}</p>
    </> : null}
    {props.data ? <>
      {props.data.limitations.map((item, index) => <p key={index} className="text-warn">{item}</p>)}
      <p>要求日期 {sourceTimestamp(props.data.requested_date)} · 產出 {sourceTimestamp(props.data.generated_at)} · 來源截止 {sourceTimestamp(props.data.source_cutoff)} · 本機讀取 {sourceTimestamp(props.data.read_at)}{props.data.cached ? " · 使用快取" : ""}</p>
      <p>Producer：{props.data.producer} · ID：{props.data.id}</p>
      {props.data.sources.map((source, index) => <p key={index} className="break-all">來源：{source}</p>)}
    </> : null}
  </div>
}
