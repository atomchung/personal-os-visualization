import { useQuery } from "@tanstack/react-query"
import { getHealth } from "@/lib/api"
import { Card, SectionHeading } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { Disclosure } from "@/components/ui/disclosure"

const GOAL_GRADIENTS: Record<string, string> = {
  annual: "linear-gradient(90deg, var(--color-sys-indigo) 0%, var(--color-sys-purple) 100%)",
  pull: "linear-gradient(90deg, var(--color-sys-orange) 0%, var(--color-accent) 100%)",
  run: "linear-gradient(90deg, var(--color-sys-teal) 0%, var(--color-sys-blue) 100%)",
  body: "linear-gradient(90deg, var(--color-sys-mint) 0%, var(--color-sys-green) 100%)",
  regress: "linear-gradient(90deg, var(--color-sys-pink) 0%, var(--color-sys-red) 100%)",
}

export function HealthPage() {
  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
  })

  if (healthQuery.isPending) {
    return <p className="p-6 text-body text-ink-3">讀取運動資料中…</p>
  }

  if (healthQuery.isError) {
    return (
      <p className="p-6 text-body text-bad">
        讀不到運動資料：{(healthQuery.error as Error).message}
      </p>
    )
  }

  const data = healthQuery.data
  const rec = data.recovery
  const annual = data.annual
  const cards = data.cards
  const running = data.running_annual
  const history = data.history

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-display font-bold tracking-tight text-ink">
          運動 × 體態
        </h1>
        <p className="text-caption text-ink-3">
          Garmin 每天自動同步；重訓重量靠 /log-strength 手動記
        </p>
      </div>

      {/* 1. 🎯 目標狀態 (4 Gradient Progress Bars) */}
      <section className="flex flex-col gap-2">
        <SectionHeading>🎯 目標狀態</SectionHeading>
        <Card className="flex flex-col gap-3.5 p-4">
          {data.goals_status.map((item) => {
            const anchor = 22.0
            const pctClamped = Math.max(0, Math.min(100, item.pct))
            return (
              <div
                key={item.id}
                className="flex flex-col gap-2 border-b-[0.5px] border-line-soft pb-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4"
              >
                {/* Left label */}
                <div className="flex w-full flex-col sm:w-[220px] sm:shrink-0">
                  <span className="text-label font-bold text-ink">
                    {item.title}
                  </span>
                  <span className="text-caption text-ink-3">{item.sub}</span>
                </div>

                {/* Middle Track — 左端起點、右端目標，四條同一把尺 */}
                <div className="flex w-full flex-1 flex-col gap-1">
                <div className="relative h-3.5 w-full overflow-hidden rounded-full bg-bg-2">
                  {item.signed ? (
                    <>
                      {item.pct > 0 && (
                        <div
                          className="absolute top-0 h-full rounded-full"
                          style={{
                            left: `${anchor}%`,
                            width: `${(Math.max(pctClamped, 1) / 100) * (100 - anchor)}%`,
                            background: GOAL_GRADIENTS.body,
                          }}
                        />
                      )}
                      {item.pct < 0 && (
                        <div
                          className="absolute top-0 h-full rounded-full"
                          style={{
                            left: `${Math.max(0, anchor - (Math.abs(item.pct) / 100) * anchor)}%`,
                            width: `${Math.min(anchor, Math.max(1, (Math.abs(item.pct) / 100) * anchor))}%`,
                            background: GOAL_GRADIENTS.regress,
                          }}
                        />
                      )}
                      {/* Anchor tick for baseline */}
                      <div
                        className="absolute top-0 h-full w-[2px] bg-ink-4"
                        style={{ left: `${anchor}%` }}
                        title="年初基準"
                      />
                    </>
                  ) : (
                    <div
                      className="absolute left-0 top-0 h-full rounded-full"
                      style={{
                        width: `${Math.max(2, pctClamped)}%`,
                        background: GOAL_GRADIENTS[item.id] ?? GOAL_GRADIENTS.annual,
                      }}
                    />
                  )}

                  {/* Marker for elapsed time if annual */}
                  {item.marker_pct !== null && (
                    <div
                      className="absolute top-0 h-full w-[2px] bg-ink-2 z-10"
                      style={{ left: `${Math.min(99.5, item.marker_pct)}%` }}
                      title={item.marker_label}
                    />
                  )}
                </div>
                  <div className="flex items-baseline justify-between gap-2 text-micro text-ink-4">
                    {/* 起點是 0 的那幾條不標——寫出來也沒告訴讀者任何事 */}
                    <span>{item.start_label}</span>
                    <span className="font-semibold text-ink-3">{item.goal_label}</span>
                  </div>
                </div>

                {/* Right metrics */}
                <div className="flex w-full items-baseline justify-between gap-2 sm:w-[190px] sm:shrink-0 sm:flex-col sm:items-end sm:justify-center">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-section font-bold tabular-nums"
                      style={{
                        color:
                          item.pct < 0
                            ? "var(--color-bad)"
                            : item.status_tone === "ok"
                            ? "var(--color-ok)"
                            : "var(--color-ink)",
                      }}
                    >
                      {item.pct.toFixed(0)}%
                    </span>
                    <Chip tone={item.status_tone}>{item.status_text}</Chip>
                  </div>
                  <span className="text-micro text-ink-3">{item.note}</span>
                </div>
              </div>
            )
          })}
          <p className="text-micro text-ink-4">
            右端是目標，百分比是走到目標的進度；起點不是 0 的才標在左端。體重／體脂雙向：灰線是年初，往左紅色＝比年初更遠。年度的灰線是今年已過的時間。
          </p>
        </Card>
      </section>

      {/* 2. 🧠 本週該注意 — 該做什麼只有教練一個聲音；本機只補教練看不到的資料缺口 */}
      <section className="flex flex-col gap-2">
        <SectionHeading>🧠 本週該注意</SectionHeading>
        <Card className="flex flex-col gap-3 p-4">
          {data.coach ? (
            <div className="flex flex-col gap-1.5 rounded-sm bg-bg-3 p-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-caption font-semibold text-ink">🧭 教練</span>
                <span className="text-micro text-ink-4">
                  本週 {data.coach.week_start}
                  {data.coach.plan_version !== null && ` · 計畫 v${data.coach.plan_version}`}
                </span>
              </div>
              {data.coach.intent && (
                <p className="text-label leading-body text-ink-2">{data.coach.intent}</p>
              )}
              <ul className="flex flex-col gap-1.5 text-label leading-body text-ink-2">
                {data.coach.notes.map((n, idx) => (
                  <li key={idx} className="flex items-baseline gap-2">
                    <span className="text-caption">{n.icon}</span>
                    <span>{n.text}</span>
                  </li>
                ))}
              </ul>
              <p className="text-micro text-ink-4">
                {data.coach.age_days ?? 0} 天前抓的（跑 /coach-brief 更新）
              </p>
            </div>
          ) : (
            <p className="text-label leading-body text-ink-3">
              教練說法尚未同步或已過期——這一區的訓練指示只從教練來，跑 /coach-brief 抓一次。
            </p>
          )}

          {data.data_gaps.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-caption font-semibold text-ink-3">📉 資料缺口</span>
              <ul className="flex flex-col gap-1.5 text-caption leading-body text-ink-3">
                {data.data_gaps.map((item, idx) => (
                  <li key={idx} className="flex items-baseline gap-2">
                    <span className="text-caption">{item.icon}</span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </section>

      {/* 3. 4 大 Baseline 目標卡片 (2x2 Grid) - 結構強制高度統一！ */}
      <section className="flex flex-col gap-3">
        <SectionHeading>四項指標細節</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Card 1: VO2max */}
          <Card className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-section font-bold text-ink">{cards.vo2.title}</span>
              <Chip tone="ok">{cards.vo2.target_badge}</Chip>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {cards.vo2.kpis.map((k, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-caption text-ink-3">{k.label}</span>
                  <span className="text-display font-bold tabular-nums text-ink">{k.value}</span>
                  {k.sub && <span className="text-micro text-ink-4">{k.sub}</span>}
                </div>
              ))}
            </div>

            <div className="flex flex-col text-caption text-ink-3">
              <span>{cards.vo2.caption}</span>
              <span>{cards.vo2.run_mix_caption}</span>
            </div>

            <Disclosure summary={`🏃‍♂️ 跑步品質與強度分佈（近 30 天 ${cards.vo2.runs_table.length} 次）`}>
              <div className="flex flex-col gap-3 py-1">
                {cards.vo2.intensity_mix.total_min > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex h-5 overflow-hidden rounded-sm bg-bg-2 text-micro font-semibold text-paper">
                      {cards.vo2.intensity_mix.low_pct > 0 && (
                        <div
                          className="flex items-center justify-center bg-sys-teal"
                          style={{ width: `${cards.vo2.intensity_mix.low_pct}%` }}
                        >
                          {cards.vo2.intensity_mix.low_pct}%
                        </div>
                      )}
                      {cards.vo2.intensity_mix.mid_pct > 0 && (
                        <div
                          className="flex items-center justify-center bg-sys-gray"
                          style={{ width: `${cards.vo2.intensity_mix.mid_pct}%` }}
                        >
                          {cards.vo2.intensity_mix.mid_pct}%
                        </div>
                      )}
                      {cards.vo2.intensity_mix.high_pct > 0 && (
                        <div
                          className="flex items-center justify-center bg-sys-orange"
                          style={{ width: `${cards.vo2.intensity_mix.high_pct}%` }}
                        >
                          {cards.vo2.intensity_mix.high_pct}%
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-micro text-ink-3">
                      <span><b className="text-sys-teal">■</b> 低 Z1–2</span>
                      <span><b className="text-sys-gray">■</b> 中 Z3</span>
                      <span><b className="text-sys-orange">■</b> 高 Z4–5</span>
                    </div>
                  </div>
                )}

                {cards.vo2.runs_table.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-micro">
                      <thead className="border-b-[0.5px] border-line-soft text-caption text-ink-3">
                        <tr>
                          <th className="py-1">日期</th>
                          <th className="py-1">類型</th>
                          <th className="py-1">時長</th>
                          <th className="py-1">配速</th>
                          <th className="py-1">HR</th>
                          <th className="py-1">Z2 續航</th>
                          <th className="py-1">漂移</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y-[0.5px] divide-line-soft text-ink-2 tabular-nums">
                        {cards.vo2.runs_table.map((r, idx) => (
                          <tr key={idx}>
                            <td className="py-1 text-ink-3">{r.date}</td>
                            <td className="py-1 font-medium text-ink">{r.kind}</td>
                            <td className="py-1">{r.duration}</td>
                            <td className="py-1">{r.pace}</td>
                            <td className="py-1">{r.hr}</td>
                            <td className="py-1">{r.z2_endurance}</td>
                            <td className="py-1">{r.drift}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Disclosure>
          </Card>

          {/* Card 2: 體重 / 體脂 */}
          <Card className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-section font-bold text-ink">{cards.body.title}</span>
              <Chip tone="mute">{cards.body.target_badge}</Chip>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {cards.body.kpis.map((k, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-caption text-ink-3">{k.label}</span>
                  <span className="text-display font-bold tabular-nums text-ink">{k.value}</span>
                  {k.sub && <span className="text-micro text-ink-4">{k.sub}</span>}
                </div>
              ))}
            </div>

            <div className="text-caption text-ink-3">{cards.body.caption}</div>

            <Disclosure summary="⚖️ 體組成拆解與趨勢">
              <div className="flex flex-col gap-2 py-1 text-caption text-ink-2">
                {cards.body.gap_parts.length > 0 && (
                  <div>
                    <strong className="text-ink">🎯 距離目標：</strong>
                    {cards.body.gap_parts.filter(Boolean).join(" · ")}
                  </div>
                )}

                <div className="text-micro text-ink-3">
                  📅 {cards.body.projection_text}
                </div>

                <table className="w-full text-left text-micro">
                  <thead className="border-b-[0.5px] border-line-soft text-caption text-ink-3">
                    <tr>
                      <th className="py-1">指標</th>
                      <th className="py-1">近 1 月</th>
                      <th className="py-1">近 3 月</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-[0.5px] divide-line-soft text-ink-2 tabular-nums">
                    {cards.body.trends_table.map((row) => (
                      <tr key={row.metric}>
                        <td className="py-1 font-medium text-ink">{row.metric}</td>
                        <td className="py-1">{row.m1}</td>
                        <td className="py-1">{row.m3}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Disclosure>
          </Card>

          {/* Card 3: 引體向上 */}
          <Card className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-section font-bold text-ink">{cards.pullup.title}</span>
              <Chip tone="ok">{cards.pullup.target_badge}</Chip>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {cards.pullup.kpis.map((k, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-caption text-ink-3">{k.label}</span>
                  <span className="text-display font-bold tabular-nums text-ink">{k.value}</span>
                  {k.sub && <span className="text-micro text-ink-4">{k.sub}</span>}
                </div>
              ))}
            </div>

            <div className="text-caption text-ink-3">{cards.pullup.caption}</div>

            <Disclosure summary={`💪 輔助重量趨勢（${cards.pullup.history_points.length} 次記錄）`}>
              <div className="flex flex-col gap-2 py-1 text-caption text-ink-2">
                {cards.pullup.best_text && (
                  <div className="text-micro text-ink-3">{cards.pullup.best_text}</div>
                )}
                {cards.pullup.back_count > cards.pullup.history_points.length && (
                  <div className="text-micro text-ink-4">
                    Garmin 另偵測到 {cards.pullup.back_count} 次練背（無手動重量記錄）
                  </div>
                )}
                <div className="rounded-sm bg-bg-3 p-2 text-micro font-medium text-ink-2">
                  📋 {cards.pullup.suggestion}
                </div>

                {cards.pullup.history_points.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-micro">
                      <thead className="border-b-[0.5px] border-line-soft text-caption text-ink-3">
                        <tr>
                          <th className="py-1">日期</th>
                          <th className="py-1">最低輔助 kg</th>
                          <th className="py-1">最高次數</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y-[0.5px] divide-line-soft text-ink-2 tabular-nums">
                        {cards.pullup.history_points.map((p, idx) => (
                          <tr key={idx}>
                            <td className="py-1 text-ink-3">{p.date}</td>
                            <td className="py-1 font-bold text-ink">{p.assist_kg} kg</td>
                            <td className="py-1">{p.max_reps} 下</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Disclosure>
          </Card>

          {/* Card 4: 臥推 */}
          <Card className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-section font-bold text-ink">{cards.bench.title}</span>
              <Chip tone="ok">{cards.bench.target_badge}</Chip>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {cards.bench.kpis.map((k, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-caption text-ink-3">{k.label}</span>
                  <span className="text-display font-bold tabular-nums text-ink">{k.value}</span>
                  {k.sub && <span className="text-micro text-ink-4">{k.sub}</span>}
                </div>
              ))}
            </div>

            <div className="flex flex-col text-caption text-ink-3">
              {cards.bench.gap_text && (
                <span className="font-medium text-ink-2">{cards.bench.gap_text}</span>
              )}
              <span>{cards.bench.caption}</span>
            </div>

            <Disclosure summary={`🏋️ e1RM 趨勢（${cards.bench.history_points.length} 次記錄）`}>
              <div className="flex flex-col gap-2 py-1 text-caption text-ink-2">
                {cards.bench.best_text && (
                  <div className="text-micro text-ink-3">{cards.bench.best_text}</div>
                )}

                {cards.bench.history_points.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-micro">
                      <thead className="border-b-[0.5px] border-line-soft text-caption text-ink-3">
                        <tr>
                          <th className="py-1">日期</th>
                          <th className="py-1">e1RM</th>
                          <th className="py-1">重量</th>
                          <th className="py-1">次數</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y-[0.5px] divide-line-soft text-ink-2 tabular-nums">
                        {cards.bench.history_points.map((p, idx) => (
                          <tr key={idx}>
                            <td className="py-1 text-ink-3">{p.date}</td>
                            <td className="py-1 font-bold text-ink">{p.e1rm} kg</td>
                            <td className="py-1">{p.weight} kg</td>
                            <td className="py-1">{p.reps} 次</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Disclosure>
          </Card>
        </div>
      </section>

      {/* Annual activity history; personal targets belong in the data. */}
      <section className="flex flex-col gap-2">
        <SectionHeading>🏃 年度運動紀錄</SectionHeading>
        <Card className="flex flex-col gap-4 p-4">
          <div className="grid grid-cols-3 gap-3">
            {annual.kpis.map((k, i) => (
              <div key={i} className="flex flex-col">
                <span className="text-caption text-ink-3">{k.label}</span>
                <span className="text-display font-bold tabular-nums text-ink">{k.value}</span>
                {k.sub && <span className="text-micro text-ink-4">{k.sub}</span>}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm bg-bg-3 p-3 text-caption text-ink-3">
            <span>📅 本月（截至今天）<b className="text-ink-2">{annual.month_summary.this_month}</b> 次</span>
            <span>
              預估月底 <b className={annual.month_summary.mom_color === "ok" ? "text-ok" : annual.month_summary.mom_color === "bad" ? "text-bad" : "text-ink-3"}>
                {annual.month_summary.mom_arrow} {annual.month_summary.projected}
              </b>
            </span>
            <span>上個月 <b>{annual.month_summary.prev_month}</b> 次</span>
          </div>

          {annual.monthly_table.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-caption font-semibold text-ink-3">📅 逐月分布（目標 6.0 次/週）</span>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-label">
                  <thead className="border-b-[0.5px] border-line-soft bg-bg-3 text-caption font-semibold text-ink-3">
                    <tr>
                      <th className="px-3 py-1.5">月</th>
                      <th className="px-3 py-1.5">次數</th>
                      <th className="px-3 py-1.5">次/週</th>
                      <th className="px-3 py-1.5">vs 目標</th>
                      <th className="px-3 py-1.5">跑</th>
                      <th className="px-3 py-1.5">重訓</th>
                      <th className="px-3 py-1.5">時數</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-[0.5px] divide-line-soft text-ink-2 tabular-nums">
                    {annual.monthly_table.map((m) => (
                      <tr key={m.month} className="hover:bg-bg-3/50">
                        <td className="px-3 py-1.5 font-medium text-ink">{m.month}</td>
                        <td className="px-3 py-1.5">{m.count}</td>
                        <td className="px-3 py-1.5">{m.per_week}</td>
                        <td className="px-3 py-1.5">{m.vs_goal}</td>
                        <td className="px-3 py-1.5">{m.runs}</td>
                        <td className="px-3 py-1.5">{m.strength}</td>
                        <td className="px-3 py-1.5">{m.hours}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <span className="text-micro text-ink-4">* = 當月未走完，次/週已按已過天數換算</span>
            </div>
          )}
        </Card>
      </section>

      {/* 5. 🌙 今日恢復狀況 */}
      <section className="flex flex-col gap-2">
        <SectionHeading>
          🌙 今日恢復
          {rec.data_date && (
            <span className="text-caption text-ink-3 font-normal"> · {rec.data_date}</span>
          )}
        </SectionHeading>
        <Card className="flex flex-col gap-3 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex flex-col">
              <span className="text-caption text-ink-3">HRV 狀態</span>
              <span className="text-display font-bold text-ink">{rec.hrv_status}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-caption text-ink-3">睡眠覆蓋</span>
              <span className="text-display font-bold text-ink">{rec.sample_nights}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-caption text-ink-3">睡眠 7 日均值</span>
              <span className="text-display font-bold tabular-nums text-ink">{rec.sleep_7d_avg}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-caption text-ink-3">訓練準備度</span>
              <span className="text-display font-bold tabular-nums text-ink">{rec.readiness_score}</span>
            </div>
          </div>

          {rec.action_level !== "normal" && (
            <div
              className={`rounded-sm p-2.5 text-label font-medium ${
                rec.action_level === "caution"
                  ? "bg-warn/15 text-warn"
                  : "bg-bg-3 text-ink-2"
              }`}
            >
              {rec.action}
            </div>
          )}

          {rec.reasons.length > 0 && (
            <div className="text-caption text-ink-3">
              觀察到：{rec.reasons.join(" · ")}
            </div>
          )}

          <p className="text-micro text-ink-4">{rec.caveat}</p>
        </Card>
      </section>

      {/* 6. 🏃‍♂️ 跑步年度報告 */}
      {running && (
        <section className="flex flex-col gap-2">
          <SectionHeading>
            🏃‍♂️ 跑步年度報告
            <span className="text-caption text-ink-3 font-normal">
              {" "}· 累積 {running.total_km} km · {running.runs_n} 次 · 總時長 {running.total_hours} 小時
            </span>
          </SectionHeading>

          <Card className="flex flex-col gap-4 p-4">
            {/* 4 Pillars */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="flex flex-col justify-between rounded-md border-[0.5px] border-line-soft bg-bg-3 p-3">
                <span className="text-caption font-semibold text-info">總里程</span>
                <div className="flex items-baseline gap-1 py-1">
                  <span className="text-hero font-bold tabular-nums text-ink">{running.total_km}</span>
                  <span className="text-caption text-ink-3">km</span>
                </div>
                <span className="text-micro text-ink-4">最長 {running.longest_km} km</span>
              </div>

              <div className="flex flex-col justify-between rounded-md border-[0.5px] border-line-soft bg-bg-3 p-3">
                <span className="text-caption font-semibold text-info">跑步次數</span>
                <div className="flex items-baseline gap-1 py-1">
                  <span className="text-hero font-bold tabular-nums text-ink">{running.runs_n}</span>
                  <span className="text-caption text-ink-3">次</span>
                </div>
                <span className="text-micro text-ink-4">平均 {running.avg_km_per_run} km/次</span>
              </div>

              <div className="flex flex-col justify-between rounded-md border-[0.5px] border-line-soft bg-bg-3 p-3">
                <span className="text-caption font-semibold text-info">平均配速</span>
                <div className="flex items-baseline gap-1 py-1">
                  <span className="text-hero font-bold tabular-nums text-ink">{running.avg_pace_str}</span>
                  <span className="text-caption text-ink-3">/km</span>
                </div>
                <span className="text-micro text-ink-4">目標 7&apos;00/km</span>
              </div>

              <div className="flex flex-col justify-between rounded-md border-[0.5px] border-line-soft bg-bg-3 p-3">
                <span className="text-caption font-semibold text-info">平均 HR</span>
                <div className="flex items-baseline gap-1 py-1">
                  <span className="text-hero font-bold tabular-nums text-ink">{running.avg_hr_val}</span>
                  <span className="text-caption text-ink-3">bpm</span>
                </div>
                <span className="text-micro text-ink-4">最高 {running.peak_hr} bpm</span>
              </div>
            </div>

            {/* Monthly Trend Table */}
            {running.monthly_trend.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-caption font-semibold text-ink-3">📊 月度跑量 × 配速明細</span>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-label">
                    <thead className="border-b-[0.5px] border-line-soft bg-bg-3 text-caption font-semibold text-ink-3">
                      <tr>
                        <th className="px-3 py-1.5">月份</th>
                        <th className="px-3 py-1.5">跑量 (km)</th>
                        <th className="px-3 py-1.5">次數</th>
                        <th className="px-3 py-1.5">平均配速</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-[0.5px] divide-line-soft text-ink-2 tabular-nums">
                      {running.monthly_trend.map((m) => (
                        <tr key={m.ym} className="hover:bg-bg-3/50">
                          <td className="px-3 py-1.5 font-medium text-ink">{m.ym}</td>
                          <td className="px-3 py-1.5">{m.km} km</td>
                          <td className="px-3 py-1.5">{m.runs} 次</td>
                          <td className="px-3 py-1.5">
                            {m.pace_min ? `${Math.floor(m.pace_min)}'${Math.round((m.pace_min % 1) * 60).toString().padStart(2, "0")}/km` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>
        </section>
      )}

      {/* 📚 力量訓練歷史 — folded, because it is a ledger to look something up
          in, not something to read on the way past. */}
      {history.strength_log.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionHeading>📚 力量訓練歷史</SectionHeading>
          <Disclosure summary={`全部手動紀錄（${history.strength_log.length} 組）`}>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-left text-micro">
                <thead className="sticky top-0 bg-paper text-caption text-ink-3">
                  <tr className="border-b-[0.5px] border-line-soft">
                    <th className="py-1 pr-2">日期</th>
                    <th className="py-1 pr-2">動作</th>
                    <th className="py-1 pr-2">組</th>
                    <th className="py-1 pr-2">重量</th>
                    <th className="py-1 pr-2">輔助</th>
                    <th className="py-1 pr-2">次數</th>
                    <th className="py-1 pr-2">RPE</th>
                    <th className="py-1 pr-2">慢放</th>
                    <th className="py-1">備註</th>
                  </tr>
                </thead>
                <tbody className="divide-y-[0.5px] divide-line-soft text-ink-2 tabular-nums">
                  {history.strength_log.map((r, idx) => (
                    <tr key={idx}>
                      <td className="py-1 pr-2 text-ink-3">{r.date}</td>
                      <td className="py-1 pr-2 text-ink">{r.exercise}</td>
                      <td className="py-1 pr-2">{r.set_number ?? "—"}</td>
                      <td className="py-1 pr-2">{r.weight_kg != null ? `${r.weight_kg} kg` : "—"}</td>
                      <td className="py-1 pr-2">{r.assist_kg != null ? `${r.assist_kg} kg` : "—"}</td>
                      <td className="py-1 pr-2">{r.reps ?? "—"}</td>
                      <td className="py-1 pr-2">{r.rpe ?? "—"}</td>
                      <td className="py-1 pr-2">{r.slow_negative ? "✓" : ""}</td>
                      <td className="py-1 text-ink-4">{r.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Disclosure>

          {history.pullup_assist_trend.length > 0 && (
            <Disclosure
              summary={`📈 引體輔助重量趨勢（全期 ${history.pullup_assist_trend.length} 次）`}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-micro">
                  <thead className="border-b-[0.5px] border-line-soft text-caption text-ink-3">
                    <tr>
                      <th className="py-1">日期</th>
                      <th className="py-1">平均輔助 kg（目標降到 0）</th>
                      <th className="py-1">單組最高次數</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-[0.5px] divide-line-soft text-ink-2 tabular-nums">
                    {history.pullup_assist_trend.map((p, idx) => (
                      <tr key={idx}>
                        <td className="py-1 text-ink-3">{p.date}</td>
                        <td className="py-1 font-bold text-ink">{p.assist_kg ?? "—"}</td>
                        <td className="py-1">{p.max_reps ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Disclosure>
          )}
        </section>
      )}
    </div>
  )
}
