import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { WeeklyUsageRow } from "@/lib/api"

/* 每週 output token 趨勢：一根 = 一個自然週，堆疊 = 三個 agent。
 *
 * 只畫 output 不畫總 token，因為 input 幾乎全是 cache read（cache hit ~97%），
 * 那條線量的是「同一段 context 被重讀幾次」，不是「做了多少事」。 */

const AGENT_COLOR: Record<string, string> = {
  claude: "--color-sys-orange",
  codex: "--color-sys-indigo",
  antigravity: "--color-sys-teal",
}

// null is "the aggregate for that agent failed", never zero — a dash, not a 0.00M.
// 表格預設只列最近四週。十二根長條看的是形狀，一眼掃過去就好；十二列數字要逐行讀，
// 而下面還有五個區塊在等——把不常看的八列收起來，需要時再展開。
const TABLE_ROWS_COLLAPSED = 4

const M = (n: number | null) => (n === null ? "—" : `${(n / 1e6).toFixed(2)}M`)
const USD = (n: number | null) => (n === null ? "—" : `$${n.toLocaleString()}`)

export function WeeklyTrend({
  rows,
  agents,
  coverageNote,
}: {
  rows: WeeklyUsageRow[]
  agents: { key: string; label: string }[]
  coverageNote: string
}) {
  const [expanded, setExpanded] = useState(false)
  const max = Math.max(...rows.map((r) => r.output_tokens ?? 0), 1)
  const newestFirst = [...rows].reverse()
  const tableRows = expanded ? newestFirst : newestFirst.slice(0, TABLE_ROWS_COLLAPSED)
  const hidden = newestFirst.length - tableRows.length
  // The payload carries agent keys; everything the reader sees is the label.
  const nameOf = (key: string) => agents.find((a) => a.key === key)?.label ?? key
  const blindLabels = (r: WeeklyUsageRow) => r.truncated_agents.map(nameOf).join("/")

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {agents.map((a) => (
          <span key={a.key} className="flex items-center gap-1 text-micro text-ink-3">
            <span
              className="size-2 rounded-full"
              style={{ background: `var(${AGENT_COLOR[a.key] ?? "--color-sys-gray"})` }}
            />
            {a.label}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto">
        <div className="flex h-36 min-w-full items-end gap-1.5">
          {rows.map((r) => {
            const total = r.output_tokens ?? 0
            const tip = [
              `${r.label} · ${M(r.output_tokens)} output · ${USD(r.cost_usd)}`,
              ...agents.map((a) => `${a.label} ${M(r.agents[a.key]?.output_tokens ?? null)}`),
              r.truncated_agents.length
                ? `⚠ ${blindLabels(r)} 的逐字稿已不涵蓋這週`
                : "",
              r.unknown_agents.length
                ? `⚠ ${r.unknown_agents.map(nameOf).join("/")} 這次沒算成功，數字不完整`
                : "",
            ]
              .filter(Boolean)
              .join("\n")
            return (
              <div
                key={r.week_start}
                className="flex h-full min-w-[28px] flex-1 flex-col justify-end gap-1"
                title={tip}
              >
                <span className="text-center text-micro tabular-nums text-ink-3">
                  {/* Only label bars tall enough to hold one. The near-zero
                    * weeks put their label on the axis line and crowd the
                    * neighbours; the table right below carries every number. */}
                  {total >= max * 0.08 ? M(r.output_tokens) : ""}
                </span>
                <div
                  className="flex w-full flex-col justify-end gap-px"
                  style={{ height: `${(total / max) * 100}%` }}
                >
                  {agents.map((a) => {
                    const v = r.agents[a.key]?.output_tokens ?? 0
                    if (v <= 0 || total <= 0) return null
                    return (
                      <div
                        key={a.key}
                        className="w-full rounded-xs"
                        style={{
                          height: `${(v / total) * 100}%`,
                          background: `var(${AGENT_COLOR[a.key] ?? "--color-sys-gray"})`,
                          // 兩種淡化講的不是同一件事，所以給兩個深度：進行中的
                          // 一週還會長高，被清掉逐字稿的一週則永遠不會補回來。
                          opacity:
                            r.truncated_agents.length || r.unknown_agents.length
                              ? 0.3
                              : r.is_current
                                ? 0.6
                                : 1,
                        }}
                      />
                    )
                  })}
                </div>
                <span className="text-center text-micro text-ink-4">
                  {r.label.replace(/ .*/, "")}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-label">
          <thead className="border-b-[0.5px] border-line-soft text-caption font-semibold text-ink-3">
            <tr>
              <th className="py-2 pr-3">週</th>
              <th className="py-2 pr-3">Output 合計</th>
              {agents.map((a) => (
                <th key={a.key} className="py-2 pr-3">
                  {a.label}
                </th>
              ))}
              <th className="py-2 pr-3">主動時數</th>
              <th className="py-2">API 等價</th>
            </tr>
          </thead>
          <tbody className="divide-y-[0.5px] divide-line-soft text-ink-2">
            {tableRows.map((r) => (
              <tr key={r.week_start} className="hover:bg-bg-3/50">
                <td className="whitespace-nowrap py-2 pr-3 font-medium text-ink">
                  {r.label}
                  {r.is_current && (
                    <span className="ml-1 text-micro text-ink-4">進行中</span>
                  )}
                  {r.truncated_agents.length > 0 && (
                    <span className="ml-1 text-micro text-warn">
                      缺 {blindLabels(r)}
                    </span>
                  )}
                  {r.unknown_agents.length > 0 && (
                    <span className="ml-1 text-micro text-bad">
                      {r.unknown_agents.map(nameOf).join("/")} 沒算成功
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3 font-semibold tabular-nums text-ink">
                  {M(r.output_tokens)}
                </td>
                {agents.map((a) => (
                  <td key={a.key} className="py-2 pr-3 tabular-nums">
                    {M(r.agents[a.key]?.output_tokens ?? null)}
                  </td>
                ))}
                <td className="py-2 pr-3 tabular-nums">
                  {r.active_hours === null ? "—" : `${r.active_hours.toFixed(1)}h`}
                </td>
                <td className="py-2 tabular-nums">{USD(r.cost_usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hidden > 0 || expanded ? (
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? "只看最近 4 週" : `展開其餘 ${hidden} 週`}
          </Button>
        </div>
      ) : null}

      <p className="text-micro text-ink-4">
        半透明 = 本週還在進行中；更淡的 = 那一週的逐字稿已被清掉，數字只是殘料。
      </p>
      {coverageNote && <p className="text-micro text-ink-4">{coverageNote}</p>}
    </Card>
  )
}
