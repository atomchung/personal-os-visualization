import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getTime, type TimePeriod } from "@/lib/api"
import { Card, SectionHeading } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { DayStack } from "@/components/time/DayStack"
import { WeeklyTrend } from "@/components/time/WeeklyTrend"
import { PageHeader } from "@/components/ui/page-header"
import { humanizeSystemLabel } from "@/lib/informationArchitecture"

const CATEGORY_TOKEN: Record<string, string> = {
  投資: "--color-cat-1",
  輸出: "--color-cat-2",
  學習: "--color-cat-3",
  職涯: "--color-cat-4",
  其他: "--color-cat-5",
}

// 顏色分兩組：Claude 家族用暖色深淺，其他廠商各自一色。同一天裡「哪個模型吃掉
// 產出」和「哪個廠商吃掉產出」是兩個問題，這張圖回答前者。
const MODEL_TOKEN: Record<string, string> = {
  Fable: "--color-sys-orange",
  Opus: "--color-sys-blue",
  Sonnet: "--color-sys-indigo",
  Haiku: "--color-sys-green",
  GPT: "--color-sys-purple",
  Gemini: "--color-sys-teal",
  Other: "--color-sys-gray",
}

const PERIODS: { key: TimePeriod; label: string }[] = [
  { key: "week", label: "本週" },
  { key: "last_week", label: "上週" },
  { key: "4w", label: "近 4 週" },
]

const CHIP_TONE = ["ok", "warn", "bad", "info", "accent", "mute"] as const
type ChipTone = (typeof CHIP_TONE)[number]
const toChipTone = (tone: string): ChipTone =>
  (CHIP_TONE as readonly string[]).includes(tone) ? (tone as ChipTone) : "mute"

function renderFormattedSummary(text: string) {
  const parts = text.split(/(<b>.*?<\/b>)/g)
  return parts.map((part, i) => {
    if (part.startsWith("<b>") && part.endsWith("</b>")) {
      return (
        <strong key={i} className="font-semibold text-ink">
          {part.slice(3, -4)}
        </strong>
      )
    }
    return part
  })
}

export function TimePage() {
  const [period, setPeriod] = useState<TimePeriod>("week")
  const timeQuery = useQuery({
    queryKey: ["time", period],
    queryFn: () => getTime(period),
  })

  if (timeQuery.isPending) {
    return <p className="p-6 text-body text-ink-3">讀取 AI 使用資料中…</p>
  }

  if (timeQuery.isError) {
    return (
      <p className="p-6 text-body text-bad">
        讀不到 AI 使用資料：{(timeQuery.error as Error).message}
      </p>
    )
  }

  const data = timeQuery.data
  const kpis = data.kpis
  const trend = data.weekly_trend

  return (
    <div className="flex flex-col gap-6">
      {/* Header & period switch */}
      <section className="flex flex-col gap-3">
        <PageHeader
          page="time"
          action={
            <div className="flex items-center gap-1 rounded-md bg-bg-2 p-0.5">
              {PERIODS.map((p) => (
                <Button
                  key={p.key}
                  variant={period === p.key ? "selected" : "ghost"}
                  size="sm"
                  onClick={() => setPeriod(p.key)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          }
        />
        <div className="flex flex-col gap-1">
            <p className="text-caption text-ink-3">{data.cycle_caption}</p>
            {data.as_of_note && (
              <p className="text-micro text-warn">{data.as_of_note}</p>
            )}
            <p className="text-micro text-ink-4">
              {data.snapshot.missing
                ? "使用紀錄尚未建立；目前數字不代表沒有使用。"
                : `使用紀錄更新於 ${data.snapshot.age_label}${data.snapshot.is_stale ? "（資料較舊，請先更新再比較）" : ""}`}
            </p>
        </div>

        {/* 4 KPI cards — 配額那格 2026-08-25 拿掉，恢復步驟寫在 web/time_tab.py 檔頭 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="flex flex-col gap-2 p-3">
            <div className="text-caption text-ink-3">{humanizeSystemLabel(kpis.output.label)}</div>
            <div className="text-hero font-bold leading-display tabular-nums text-ink">
              {kpis.output.value}
            </div>
            <div className="mt-auto flex flex-col gap-1">
              <Chip tone="mute">{kpis.output.delta}</Chip>
              {kpis.output.sub ? (
                <span className="text-micro text-ink-4">{kpis.output.sub}</span>
              ) : null}
            </div>
          </Card>

          <Card className="flex flex-col gap-2 p-3">
            <div className="text-caption text-ink-3">{kpis.cost.label}</div>
            <div className="text-hero font-bold leading-display tabular-nums text-ink">
              {kpis.cost.value}
            </div>
            <div className="mt-auto text-micro text-ink-4" title={kpis.cost.caveat}>
              {kpis.cost.sub}
            </div>
          </Card>

          <Card className="flex flex-col gap-2 p-3">
            <div className="text-caption text-ink-3">{humanizeSystemLabel(kpis.sessions.label)}</div>
            <div className="text-hero font-bold leading-display tabular-nums text-ink">
              {kpis.sessions.value}
            </div>
            <div className="mt-auto">
              <Chip tone="mute">{kpis.sessions.delta}</Chip>
            </div>
          </Card>

          <Card className="flex flex-col gap-2 p-3">
            <div className="text-caption text-ink-3">{kpis.active_hours.label}</div>
            <div className="text-hero font-bold leading-display tabular-nums text-ink">
              {kpis.active_hours.value}
            </div>
            <div className="mt-auto text-micro text-ink-4">{kpis.active_hours.sub}</div>
          </Card>
        </div>
      </section>

      {/* 每週 output 趨勢 — 這頁的主軸：長期用量有沒有站在一個穩定水位 */}
      <section className="flex flex-col gap-2">
        <SectionHeading
          aside={
            data.verdict.available ? (
              <Chip tone={toChipTone(data.verdict.tone)}>{data.verdict.text}</Chip>
            ) : null
          }
        >
          每週文字產出（自然週）
        </SectionHeading>
        {trend.available ? (
          <WeeklyTrend
            rows={trend.rows}
            agents={trend.agents}
            coverageNote={trend.coverage_note}
          />
        ) : (
          <Card className="p-4 text-body text-ink-3">{trend.hint}</Card>
        )}
      </section>

      {/* 訂閱對帳 */}
      <section className="flex flex-col gap-2">
        <SectionHeading>訂閱划不划算</SectionHeading>
        <Card className="overflow-hidden p-0">
          <table className="w-full text-left text-label">
            <thead className="border-b-[0.5px] border-line-soft bg-bg-3 text-caption font-semibold text-ink-3">
              <tr>
                <th className="px-3.5 py-2">工具</th>
                <th className="px-3.5 py-2">月訂閱費</th>
                <th className="px-3.5 py-2">每月外部成本估算</th>
                <th className="px-3.5 py-2">槓桿</th>
                <th className="px-3.5 py-2">平均每週文字產出</th>
                <th className="px-3.5 py-2">樣本</th>
              </tr>
            </thead>
            <tbody className="divide-y-[0.5px] divide-line-soft text-ink-2">
              {data.worth_rows.map((r) => (
                <tr key={r.agent} className="hover:bg-bg-3/50">
                  <td className="px-3.5 py-2 font-medium text-ink">{r.plan_label}</td>
                  <td className="px-3.5 py-2 tabular-nums">
                    {r.monthly_fee_usd === null ? (
                      <span className="text-ink-4">未設定</span>
                    ) : r.is_free ? (
                      <span className="text-ink-4">免費</span>
                    ) : (
                      `$${r.monthly_fee_usd.toLocaleString()}`
                    )}
                  </td>
                  <td className="px-3.5 py-2 tabular-nums">
                    {r.monthly_api_cost_usd === null
                      ? "—"
                      : `$${r.monthly_api_cost_usd.toLocaleString()}`}
                  </td>
                  <td
                    className="px-3.5 py-2 font-semibold tabular-nums text-ink"
                    title={kpis.cost.caveat}
                  >
                    {r.leverage === null ? "—" : `${r.leverage}×`}
                    {r.leverage !== null && (
                      <span className="ml-1 text-micro font-normal text-ink-4">偏高</span>
                    )}
                  </td>
                  <td className="px-3.5 py-2 tabular-nums">
                    {r.weekly_output_avg === null
                      ? "—"
                      : `${(r.weekly_output_avg / 1e6).toFixed(2)}M`}
                  </td>
                  <td className="px-3.5 py-2 tabular-nums text-ink-3">
                    {r.sample_weeks} 週
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="text-micro text-ink-4">
          外部成本估算 = 該工具自己有完整資料的完整週平均 × 4.33（樣本欄是週數，
          少於 3 週就不推月成本）。{kpis.cost.caveat}。訂閱費仍以本機設定為準。
        </p>
      </section>

      {/* 本期做了什麼 */}
      <section className="flex flex-col gap-3">
        <SectionHeading>{data.period_label} 做了什麼</SectionHeading>

        {data.summary_lines.length > 0 && (
          <Card className="bg-bg-3 p-3 text-body leading-body text-ink-2">
            <p>
              {data.summary_lines.map((line, idx) => (
                <span key={idx} className="mr-2">
                  {renderFormattedSummary(line)}
                </span>
              ))}
            </p>
          </Card>
        )}

        {data.narrative_state.available
          ? data.narrative_state.window_note && (
              <p className="text-caption text-ink-4">
                {data.narrative_state.window_note}
              </p>
            )
          : data.narrative_state.hint && (
              <p className="text-caption text-ink-4">{data.narrative_state.hint}</p>
            )}

        <div className="flex flex-col gap-3">
          {data.activity_blocks.map((b) => (
            <Card key={b.category} className="flex flex-col gap-2 p-4">
              <div className="flex items-baseline gap-2.5">
                <span
                  className="text-section font-bold"
                  style={{ color: `var(${CATEGORY_TOKEN[b.category] ?? "--color-ink"})` }}
                >
                  {b.category}
                </span>
                <span className="text-caption text-ink-3">
                  {b.hours}h · {b.session_count} 段工作紀錄
                </span>
              </div>
              {b.sub_breakdown && (
                <div className="text-caption text-ink-3">{b.sub_breakdown}</div>
              )}
              {b.narrative ? (
                <p className="whitespace-pre-line text-body leading-body text-ink-2">
                  {b.narrative}
                </p>
              ) : b.fallback_bullets.length > 0 ? (
                <ul className="flex list-disc flex-col gap-1 pl-5 text-label text-ink-2">
                  {b.fallback_bullets.map((bullet, idx) => (
                    <li key={idx}>{bullet}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-caption text-ink-4">這期沒有留下摘要</p>
              )}
            </Card>
          ))}
        </div>
      </section>

      {/* 各 agent 分工 */}
      <section className="flex flex-col gap-2">
        <SectionHeading>各工具的工作量</SectionHeading>
        <Card className="overflow-hidden p-0">
          <table className="w-full text-left text-label">
            <thead className="border-b-[0.5px] border-line-soft bg-bg-3 text-caption font-semibold text-ink-3">
              <tr>
                <th className="px-3.5 py-2">工具</th>
                <th className="px-3.5 py-2">工作紀錄</th>
                <th className="px-3.5 py-2">中位長度</th>
                <th className="px-3.5 py-2">時數合計（未去重）</th>
                <th className="px-3.5 py-2">文字產出</th>
                <th className="px-3.5 py-2">最長的一場</th>
              </tr>
            </thead>
            <tbody className="divide-y-[0.5px] divide-line-soft text-ink-2">
              {data.agent_rows.map((r) => (
                <tr key={r.agent} className="hover:bg-bg-3/50">
                  <td className="px-3.5 py-2 font-medium text-ink">{humanizeSystemLabel(r.agent_label)}</td>
                  <td className="px-3.5 py-2 tabular-nums">{r.session_count}</td>
                  <td className="px-3.5 py-2 tabular-nums">{r.median_min}m</td>
                  <td className="px-3.5 py-2 tabular-nums">{r.active_hhmm}</td>
                  <td className="px-3.5 py-2 tabular-nums">
                    {r.output_m === null ? "—" : `${r.output_m}M`}
                  </td>
                  <td className="max-w-xs truncate px-3.5 py-2" title={r.longest_topic}>
                    {r.longest_min}m · {r.longest_topic}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="text-micro text-ink-4">
          時數合計未去重（同一段時間平行使用兩個工具會各算一次），所以三列加起來會多於
          上面的主動時數；中位長度是解釋下面那張榜單的閱讀方式。
        </p>
      </section>

      {/* 按類別 */}
      <section className="flex flex-col gap-2">
        <SectionHeading>按類別（投入時間／本地變更／雲端）</SectionHeading>
        <Card className="overflow-hidden p-0">
          <table className="w-full text-left text-label">
            <thead className="border-b-[0.5px] border-line-soft bg-bg-3 text-caption font-semibold text-ink-3">
              <tr>
                <th className="px-3.5 py-2">分類</th>
                <th className="px-3.5 py-2">本地時間</th>
                <th className="px-3.5 py-2">佔比</th>
                <th className="px-3.5 py-2">本地變更</th>
                <th className="px-3.5 py-2">雲端工作紀錄</th>
                <th className="px-3.5 py-2">雲端變更</th>
              </tr>
            </thead>
            <tbody className="divide-y-[0.5px] divide-line-soft text-ink-2">
              {data.category_rows.map((r) => (
                <tr key={r.category} className="hover:bg-bg-3/50">
                  <td className="flex items-center gap-1.5 px-3.5 py-2 font-medium text-ink">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{
                        color: `var(${CATEGORY_TOKEN[r.category] ?? "--color-ink-3"})`,
                        backgroundColor: "currentColor",
                      }}
                    />
                    {r.category}
                  </td>
                  <td className="px-3.5 py-2 tabular-nums">{r.active_hhmm}</td>
                  <td className="px-3.5 py-2 tabular-nums">{r.share_pct}</td>
                  <td className="px-3.5 py-2 tabular-nums">{r.commits || "—"}</td>
                  <td className="px-3.5 py-2 tabular-nums">{r.cloud_sessions || "—"}</td>
                  <td className="px-3.5 py-2 tabular-nums">{r.cloud_commits || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      {/* 每日拆解 — 兩張圖同一個時間軸，一張看做什麼、一張看花多少 */}
      {(data.daily_active.length > 0 || data.daily_models.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          <DayStack
            title="每日活躍時間"
            caption="單位：分鐘 · 顏色 = 類別 · 逐日加總未去重，所以每日總和會高於上面的主動時數"
            rows={data.daily_active.map((d) => ({
              date: d.date,
              key: d.category,
              value: d.minutes,
            }))}
            colors={CATEGORY_TOKEN}
            unit=" 分"
          />
          <DayStack
            title="每日文字產出"
            caption="顏色 = 工具 · 日曆日切分"
            rows={data.daily_models.map((d) => ({
              date: d.date,
              key: d.model,
              value: d.out_m,
            }))}
            colors={MODEL_TOKEN}
            unit="M"
            decimals={2}
          />
        </div>
      )}

      {/* 最花時間的工作紀錄 */}
      <section className="flex flex-col gap-2">
        <SectionHeading>最花時間的工作紀錄</SectionHeading>
        <Card className="overflow-hidden p-0">
          <table className="w-full text-left text-label">
            <thead className="border-b-[0.5px] border-line-soft bg-bg-3 text-caption font-semibold text-ink-3">
              <tr>
                <th className="px-3.5 py-2">日期</th>
                <th className="px-3.5 py-2">工具</th>
                <th className="px-3.5 py-2">類別</th>
                <th className="px-3.5 py-2">活躍</th>
                <th className="px-3.5 py-2">主題</th>
                <th className="px-3.5 py-2">紀錄識別碼</th>
              </tr>
            </thead>
            <tbody className="divide-y-[0.5px] divide-line-soft text-ink-2">
              {data.top_sessions.map((s, idx) => (
                <tr key={idx} className="hover:bg-bg-3/50">
                  <td className="whitespace-nowrap px-3.5 py-2 tabular-nums text-ink-3">
                    {s.date}
                  </td>
                  <td className="px-3.5 py-2 font-medium text-ink">{humanizeSystemLabel(s.agent)}</td>
                  <td className="px-3.5 py-2 font-medium">{s.category}</td>
                  <td className="px-3.5 py-2 tabular-nums">{s.active_hhmm}</td>
                  <td className="max-w-xs truncate px-3.5 py-2 text-ink-2" title={s.topic}>
                    {s.topic}
                  </td>
                  <td
                    className="max-w-[120px] truncate px-3.5 py-2 font-mono text-micro text-ink-4"
                    title={s.session_id}
                  >
                    {s.session_id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  )
}
