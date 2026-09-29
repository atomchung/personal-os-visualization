import { Card } from "@/components/ui/card"
import type { CcstoryMcpOverview, CcstoryUsageCoverage } from "@/lib/api"
import { formatUnpricedModelCostNote } from "@/lib/ccstoryPricing"
import { humanizeSystemLabel } from "@/lib/informationArchitecture"

const hours = (value: number | null) =>
  value === null ? "—" : value.toFixed(1) + "h"
const usd = (value: number | null) =>
  value === null ? "—" : "$" + value.toLocaleString(undefined, { maximumFractionDigits: 2 })

function coverageText(coverage: CcstoryUsageCoverage) {
  if (!coverage) return "覆蓋資料不可用"
  if (coverage.complete) return "用量覆蓋完整"
  const missing = coverage.incomplete_agents
    .map((agent) => humanizeSystemLabel(agent))
    .join("、")
  return missing ? "覆蓋不完整：" + missing : "用量覆蓋不完整"
}

export function CcstoryMcpPanel({ data }: { data: CcstoryMcpOverview }) {
  if (!data.available) {
    return (
      <Card className="p-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-label font-semibold text-ink">CCStory MCP</h3>
          <p className="text-caption text-ink-3">
            {data.error ?? "MCP 快照尚未建立；更新 scripts/refresh_usage_cache.py 快照後會顯示。"}
          </p>
        </div>
      </Card>
    )
  }

  const recap = data.recap?.ok ? data.recap : null
  const comparison = data.comparison?.ok ? data.comparison : null
  const trend = data.trend?.ok ? data.trend : null
  const trendPoints = trend?.points.slice(-4).reverse() ?? []
  const unpricedRecapNote = recap
    ? formatUnpricedModelCostNote(recap.unpriced_models)
    : null
  const unpricedComparisonNote = comparison
    ? formatUnpricedModelCostNote(comparison.unpriced_models.current)
    : null

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-label font-semibold text-ink">CCStory MCP 本週摘要</h3>
        {recap?.since && recap.until && (
          <span className="text-micro text-ink-4">
            {recap.since.slice(0, 10)} 至 {recap.until.slice(0, 10)}
          </span>
        )}
      </div>

      {recap ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex flex-col gap-1">
              <span className="text-micro text-ink-4">活躍時間</span>
              <span className="text-section font-semibold tabular-nums text-ink">{hours(recap.active_hours)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-micro text-ink-4">已知費率成本估算</span>
              <span className="text-section font-semibold tabular-nums text-ink">{usd(recap.cost_usd)}</span>
            </div>
            <div className="col-span-2 flex flex-col gap-1 sm:col-span-2">
              <span className="text-micro text-ink-4">用量來源</span>
              <span className="text-caption text-ink-3">{coverageText(recap.usage_coverage)}</span>
              {unpricedRecapNote && (
                <span className="text-micro text-warn">{unpricedRecapNote}</span>
              )}
            </div>
          </div>

          {recap.agents.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-label">
                <thead className="border-b-[0.5px] border-line-soft text-caption font-semibold text-ink-3">
                  <tr>
                    <th className="py-2 pr-3">Agent</th>
                    <th className="py-2 pr-3">工作紀錄</th>
                    <th className="py-2 pr-3">訊息</th>
                    <th className="py-2">時間佔比</th>
                  </tr>
                </thead>
                <tbody className="divide-y-[0.5px] divide-line-soft text-ink-2">
                  {recap.agents.map((agent) => (
                    <tr key={agent.agent}>
                      <td className="py-2 pr-3 font-medium text-ink">{humanizeSystemLabel(agent.label)}</td>
                      <td className="py-2 pr-3 tabular-nums">{agent.sessions ?? "—"}</td>
                      <td className="py-2 pr-3 tabular-nums">{agent.messages ?? "—"}</td>
                      <td className="py-2 tabular-nums">
                        {agent.time_share === null ? "—" : (agent.time_share * 100).toFixed(0) + "%"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {recap.categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {recap.categories.map((category) => (
                <span
                  key={category.name}
                  className="rounded-md bg-bg-2 px-2 py-1 text-caption text-ink-2"
                >
                  {category.name} · {hours(category.active_hours)}
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-caption text-ink-3">
          {data.recap?.error ?? "本週 recap 尚不可用"}
        </p>
      )}

      {comparison ? (
        <p className="text-caption text-ink-3">
          {comparison.current_label ?? "本週"} 活躍 {hours(comparison.current_active_hours)}（前期{" "}
          {hours(comparison.previous_active_hours)}）；已知費率成本 {usd(comparison.current_cost_usd)}（前期{" "}
          {usd(comparison.previous_cost_usd)}）。{coverageText(comparison.usage_coverage.current)}
          {unpricedComparisonNote ? "；" + unpricedComparisonNote : ""}
        </p>
      ) : (
        <p className="text-caption text-ink-4">
          {data.comparison?.error ?? "前期比較尚不可用"}
        </p>
      )}

      {trendPoints.length > 0 ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-3">
          {trendPoints.map((point, index) => (
            <span key={point.since ?? point.label ?? "trend-" + index}>
              {point.label ?? point.since ?? "週"}：{hours(point.active_hours)} · {usd(point.cost_usd)}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-caption text-ink-4">{data.trend?.error ?? "CCStory MCP 趨勢尚不可用"}</p>
      )}
      <p className="text-micro text-ink-4">
        由 PersonalOS 快照呼叫 CCStory MCP；未要求 narrator，並只保留彙總欄位。
      </p>
    </Card>
  )
}
