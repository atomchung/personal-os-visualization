import { SectionHeading } from "@/components/ui/card"
import { InlineText } from "./ReadingText"
import { sourceTimestamp } from "@/lib/investmentFormat"
import type { InvestmentMarketObservation } from "@/lib/investment"

function observationTitle(row: InvestmentMarketObservation): string {
  return row.event?.trim() || row.title?.trim() || row.summary?.trim() || row.observation_value?.trim() || "市場讀數"
}

function observationTime(row: InvestmentMarketObservation): string | null {
  return row.observation_as_of || row.source?.at || row.observed_at || row.source_published_at || row.at || null
}

function observationSource(row: InvestmentMarketObservation): string | null {
  return row.source?.path || row.source_path || row.source_url || null
}

export function MarketObservations({ observations, title = "市場讀數" }: { observations: InvestmentMarketObservation[]; title?: string }) {
  if (!observations.length) return null
  return <section aria-label="市場讀數" className="flex min-w-0 flex-col gap-3">
    <div className="flex min-w-0 flex-col gap-1">
      <SectionHeading>{title} · {observations.length}</SectionHeading>
      <p className="text-caption text-ink-3">來源分類為市場觀察；與事件及其 story ID 分開呈現。</p>
    </div>
    <ul className="flex min-w-0 flex-col gap-3">
      {observations.map((row, index) => {
        const timestamp = observationTime(row)
        const source = observationSource(row)
        const value = row.observation_value?.trim() || row.market_reaction?.trim() || ""
        return <li key={`${row.source?.path ?? row.source_path ?? row.source_url ?? "observation"}:${index}`} className="flex min-w-0 flex-col gap-2 border-l-2 border-line-soft pl-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="min-w-0 text-body font-medium leading-relaxed text-ink"><InlineText text={observationTitle(row)} /></p>
            {row.market ? <span className="text-caption text-ink-3">{row.market === "tw" ? "台股" : "美股"}</span> : null}
            {timestamp ? <span className="text-caption text-ink-3">{sourceTimestamp(timestamp)}</span> : null}
          </div>
          {value && value !== observationTitle(row) ? <p className="text-body leading-relaxed text-ink-2"><span className="text-ink-3">讀數 · </span><InlineText text={value} /></p> : null}
          {row.interpretation ? <p className="text-body leading-relaxed text-ink-2"><span className="text-ink-3">來源解讀 · </span><InlineText text={row.interpretation} /></p> : null}
          {row.transition_reason ? <p className="text-body leading-relaxed text-ink-2"><span className="text-ink-3">來源標示的判斷變化 · </span><InlineText text={row.transition_reason} /></p> : null}
          {row.impact ? <p className="text-body leading-relaxed text-ink-2"><span className="text-ink-3">來源影響 · </span><InlineText text={row.impact} /></p> : null}
          {row.today ? <p className="text-body leading-relaxed text-ink-2"><span className="text-ink-3">來源提醒 · </span><InlineText text={row.today} /></p> : null}
          <details className="text-caption text-ink-3">
            <summary className="cursor-pointer py-1">來源與觀察欄位</summary>
            <div className="flex min-w-0 flex-col gap-1 pt-1">
              {source ? <p className="break-all">來源：{source}</p> : <p>來源位置未提供。</p>}
              {row.source_category ? <p>來源類別：{row.source_category}</p> : null}
              {row.observation_relation ? <p>觀察對象：{row.observation_relation}</p> : null}
              {row.is_price_or_proxy_observation === true ? <p>來源分類為價格或代理指標。</p> : null}
              {row.declared_decision_transition === true ? <p>來源明示此觀察可能改變判斷。</p> : null}
              {row.source?.source_cutoff || row.source_cutoff ? <p>資訊截至：{sourceTimestamp(row.source?.source_cutoff ?? row.source_cutoff)}</p> : null}
            </div>
          </details>
        </li>
      })}
    </ul>
  </section>
}
