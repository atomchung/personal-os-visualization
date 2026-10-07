import { SectionHeading } from "@/components/ui/card"
import { InlineText } from "./ReadingText"
import { sourceTimestamp } from "@/lib/investmentFormat"
import type { InvestmentMarketObservation } from "@/lib/investment"

const OBSERVATION_FIELDS = [
  "information_kind", "event", "title", "summary", "market_reaction", "interpretation", "impact", "today",
  "observation_value", "observation_as_of", "observation_relation", "source_url", "source_published_at",
  "source_category", "is_price_or_proxy_observation", "declared_decision_transition", "transition_reason",
  "market", "at", "observed_at", "source_cutoff", "source_revision", "source_path", "source",
] as const

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => [key, canonicalValue(nested)]))
  }
  return value
}

/**
 * Deduplicate only a complete structured observation identity. Timeline nodes
 * add display-only `at` and `summary` fields, so identical title summaries are
 * normalized away. Authored interpretations, cutoffs and revisions stay distinct.
 * Sparse records fall back
 * to full-record equality and never join on a title or date alone.
 */
export function marketObservationKey(row: InvestmentMarketObservation): string {
  const event = row.event?.trim() || row.title?.trim()
  const value = row.observation_value?.trim() || row.market_reaction?.trim()
  const observedAt = observationTime(row)
  const source = observationSource(row)
  if (row.information_kind === "market_observation" && row.market?.trim() && event && value && observedAt && source) {
    const authored = Object.fromEntries(OBSERVATION_FIELDS
      .filter(key => key in row && key !== "at" && key !== "source" && key !== "source_path" && key !== "observed_at"
        && !(key === "summary" && (row.summary?.trim() === event || ("kind" in row && row.kind === "update"))))
      .map(key => [key, row[key]]))
    return JSON.stringify(canonicalValue({ ...authored, source,
      source_location: { line: row.source?.line ?? null, raw: row.source?.raw ?? null }, observed_at: observedAt,
      source_revision: row.source_revision ?? row.source?.source_revision ?? null,
      source_cutoff: row.source_cutoff ?? row.source?.source_cutoff ?? null }))
  }
  const observation = Object.fromEntries(OBSERVATION_FIELDS.filter(key => key in row).map(key => [key, row[key]]))
  return `full:${JSON.stringify(canonicalValue(observation))}`
}

export function uniqueMarketObservations(rows: readonly InvestmentMarketObservation[]): InvestmentMarketObservation[] {
  const seen = new Set<string>()
  return rows.filter(row => {
    const key = marketObservationKey(row)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function observationTitle(row: InvestmentMarketObservation): string {
  return row.event?.trim() || row.title?.trim() || row.summary?.trim() || row.observation_value?.trim() || "市場讀數"
}

function observationTime(row: InvestmentMarketObservation): string | null {
  return row.observation_as_of || row.source?.at || row.observed_at || row.source_published_at || null
}

function observationSource(row: InvestmentMarketObservation): string | null {
  return row.source?.path || row.source_path || row.source_url || null
}

function observationMarketLabel(market: string | null | undefined): string | null {
  if (market === "tw") return "台股"
  if (market === "us") return "美股"
  return market ? `市場 ${market}` : null
}

export function MarketObservations({ observations, title = "市場讀數", embedded = false }: { observations: InvestmentMarketObservation[]; title?: string; embedded?: boolean }) {
  if (!observations.length) return null
  return <section aria-label={title} className="flex min-w-0 flex-col gap-3">
    <div className="flex min-w-0 flex-col gap-1">
      {embedded ? <p className="text-label font-medium text-ink-2">{title} · {observations.length}</p> : <SectionHeading>{title} · {observations.length}</SectionHeading>}
      {!embedded ? <p className="text-caption text-ink-3">來源分類為市場觀察；與事件及其 story ID 分開呈現。</p> : null}
    </div>
    <ul className="flex min-w-0 flex-col gap-3">
      {observations.map((row, index) => {
        const timestamp = observationTime(row)
        const source = observationSource(row)
        const value = row.observation_value?.trim() || row.market_reaction?.trim() || ""
        return <li key={`${row.source?.path ?? row.source_path ?? row.source_url ?? "observation"}:${index}`} className="flex min-w-0 flex-col gap-2 border-l-2 border-line-soft pl-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="min-w-0 text-body font-medium leading-relaxed text-ink"><InlineText text={observationTitle(row)} /></p>
            {observationMarketLabel(row.market) ? <span className="text-caption text-ink-3">{observationMarketLabel(row.market)}</span> : null}
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
