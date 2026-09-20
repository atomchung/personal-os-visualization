import { useQuery } from "@tanstack/react-query"
import { getGoals, setMilestoneDone, type GoalCardItem } from "@/lib/api"
import { useWrite, writeErrorText } from "@/lib/writes"
import { Card, SectionHeading } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Chip } from "@/components/ui/chip"
import { Disclosure } from "@/components/ui/disclosure"
import { PageHeader } from "@/components/ui/page-header"

type MilestoneWrite = ReturnType<
  typeof useWrite<{ goalId: string; index: number; done: boolean }, unknown>
>

function GoalCard({ g, tick }: { g: GoalCardItem; tick: MilestoneWrite }) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-section font-bold text-ink">{g.title}</span>
          {g.type_badge && <Chip tone="mute">{g.type_badge}</Chip>}
        </div>
        <span className="text-caption text-ink-3">{g.target}</span>
      </div>

      {/* Metric progress */}
      {g.metric && (
        <div className="flex flex-col gap-1">
          {g.metric.pct !== null && g.metric.pct !== undefined && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-2">
              <div
                className="h-full rounded-full bg-sys-blue"
                style={{
                  width: `${Math.min(100, Math.max(0, g.metric.pct * 100))}%`,
                }}
              />
            </div>
          )}
          <span className="text-caption text-ink-2">{g.metric.label}</span>
          {g.metric.warn && (
            <span className="text-caption text-warn">{g.metric.warn}</span>
          )}
        </div>
      )}

      {/* Manual current state */}
      {g.current && (
        <div className="rounded-sm bg-bg-3 p-2 text-caption text-ink-2">
          <span className="text-ink-4">現狀：</span>
          {g.current}
        </div>
      )}

      {/* Milestones */}
      {g.milestones.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="text-micro font-semibold text-ink-4">
            月度里程碑 · {g.milestone_done_count}/{g.milestone_total_count} 完成
          </div>
          <ul className="flex flex-col gap-1 text-label text-ink-2">
            {g.milestones.map((m, idx) => (
              <li key={idx} className="flex items-baseline gap-1.5">
                {/* ⚡ = set by core/milestones.py from a condition. Unticking it
                    would only be re-applied by the next autofix pass, so the
                    box is shown as a state, not a control. */}
                {m.auto_done ? (
                  <span className="text-caption" title="condition 自動判定">
                    ⚡
                  </span>
                ) : (
                  <Checkbox
                    className="translate-y-px"
                    checked={m.done}
                    disabled={tick.isPending}
                    aria-label={m.text}
                    onChange={(e) =>
                      tick.mutate({
                        goalId: g.id,
                        index: idx,
                        done: e.target.checked,
                      })
                    }
                  />
                )}
                <span
                  className={
                    m.is_current_month
                      ? "font-semibold text-ink"
                      : m.done
                        ? "text-ink-4"
                        : ""
                  }
                >
                  {m.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Linked todos & week hours footer */}
      {(g.open_todos.length > 0 || g.done_todos.length > 0 || g.week_hours !== null || (g.artifact_stats && g.artifact_stats.length > 0)) && (
        <div className="mt-auto flex flex-col gap-1 border-t-[0.5px] border-line-soft pt-2 text-caption text-ink-3">
          {g.week_hours !== null && (
            <div className="font-medium text-ink-2">
              ⏱ 本週投入 {g.week_hours}h
              {g.folder_ref && <span className="text-ink-4">（📁 {g.folder_ref}）</span>}
            </div>
          )}
          {g.open_todos.length > 0 && (
            <div>
              <span className="text-ink-4">推進中：</span>
              {g.open_todos.join(" · ")}
            </div>
          )}
          {g.done_todos.length > 0 && (
            <div>
              <span className="text-ink-4">最近完成：</span>
              {g.done_todos.join(" · ")}
            </div>
          )}
          {g.artifact_stats && g.artifact_stats.length > 0 && (
            <div className="text-ink-3">
              📦 {g.artifact_stats.join(" · ")}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

export function GoalsPage() {
  const goalsQuery = useQuery({
    queryKey: ["goals"],
    queryFn: getGoals,
  })

  // 本週 Todo mirrors this month's milestones, so a tick has to refresh it too.
  const tick = useWrite(
    (v: { goalId: string; index: number; done: boolean }) =>
      setMilestoneDone(v.goalId, v.index, v.done),
    ["goals", "todos"],
  )

  if (goalsQuery.isPending) {
    return <p className="p-6 text-body text-ink-3">讀取目標資料中…</p>
  }

  if (goalsQuery.isError) {
    return (
      <p className="p-6 text-body text-bad">
        讀不到目標資料：{(goalsQuery.error as Error).message}
      </p>
    )
  }

  const data = goalsQuery.data

  return (
    <div className="flex flex-col gap-6">
      <PageHeader page="goals" action={<Chip tone="mute">{data.quarter_label}</Chip>} />

      {writeErrorText(tick.error) && (
        <p className="text-caption text-bad" role="status">
          {writeErrorText(tick.error)}
        </p>
      )}

      {/* 🧭 AI 工作紀錄 */}
      {data.ai_evidence && (
        <section className="flex flex-col gap-2">
          <SectionHeading>
            🧭 AI 工作紀錄
            <span className="text-caption text-ink-3 font-normal">
              {" "}· 窗口：{data.ai_evidence.window}
            </span>
          </SectionHeading>
          <Card className="flex flex-col gap-3 p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="flex flex-col">
                <span className="text-caption text-ink-3">最近完整週目標活動</span>
                <span className="text-display font-bold tabular-nums text-ink">
                  {data.ai_evidence.covered_hours}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-caption text-ink-3">其中共享活動</span>
                <span className="text-display font-bold tabular-nums text-ink">
                  {data.ai_evidence.shared_hours}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-caption text-ink-3">未歸屬活動</span>
                <span className="text-display font-bold tabular-nums text-ink">
                  {data.ai_evidence.unattributed_hours}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-caption text-ink-3">歸屬目標數</span>
                <span className="text-display font-bold tabular-nums text-ink">
                  {data.ai_evidence.goal_count}
                </span>
              </div>
            </div>

            {data.ai_evidence.goals.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-label">
                  <thead className="border-b-[0.5px] border-line-soft bg-bg-3 text-caption font-semibold text-ink-3">
                    <tr>
                      <th className="px-3 py-1.5">目標</th>
                      <th className="px-3 py-1.5">AI 工作紀錄</th>
                      <th className="px-3 py-1.5">單獨歸屬</th>
                      <th className="px-3 py-1.5">共享活動</th>
                      <th className="px-3 py-1.5">涉及專案</th>
                      <th className="px-3 py-1.5">最近活動</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-[0.5px] divide-line-soft text-ink-2 tabular-nums">
                    {data.ai_evidence.goals.map((g, idx) => (
                      <tr key={idx} className="hover:bg-bg-3/50">
                        <td className="px-3 py-1.5 font-medium text-ink">{g.title}</td>
                        <td className="px-3 py-1.5">{g.total_hours}</td>
                        <td className="px-3 py-1.5">{g.exclusive_hours}</td>
                        <td className="px-3 py-1.5">{g.shared_hours}</td>
                        <td className="px-3 py-1.5">{g.projects_touched}</td>
                        <td className="px-3 py-1.5 text-ink-3">{g.latest_activity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>
      )}

      {/* 🔍 工作線 → 目標 → 效果 */}
      {data.effect_lens && (
        <section className="flex flex-col gap-2">
          <SectionHeading>
            🔍 工作線 → 目標 → 效果
            <span className="text-caption text-ink-3 font-normal">
              {" "}· {data.effect_lens.linked_tasks}/{data.effect_lens.total_tasks} 條線掛了目標（{data.effect_lens.pct_linked}%）
            </span>
          </SectionHeading>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="flex flex-col gap-2 p-3">
              <span className="text-caption font-semibold text-ink-3">按目標</span>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-label">
                  <thead className="border-b-[0.5px] border-line-soft text-caption text-ink-3">
                    <tr>
                      <th className="py-1">目標</th>
                      <th className="py-1">線數</th>
                      <th className="py-1">活躍</th>
                      <th className="py-1">停滯</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-[0.5px] divide-line-soft text-ink-2 tabular-nums">
                    {data.effect_lens.by_goal.map((r, i) => (
                      <tr key={i}>
                        <td className="py-1 font-medium text-ink">{r.goal_title}</td>
                        <td className="py-1">{r.count}</td>
                        <td className="py-1">{r.active}</td>
                        <td className="py-1 text-ink-4">{r.zombie}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="flex flex-col gap-2 p-3">
              <span className="text-caption font-semibold text-ink-3">按專案群組</span>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-label">
                  <thead className="border-b-[0.5px] border-line-soft text-caption text-ink-3">
                    <tr>
                      <th className="py-1">專案群組</th>
                      <th className="py-1">線數</th>
                      <th className="py-1">已連結目標%</th>
                      <th className="py-1">已交付</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-[0.5px] divide-line-soft text-ink-2 tabular-nums">
                    {data.effect_lens.by_cluster.map((r, i) => (
                      <tr key={i}>
                        <td className="py-1 font-medium text-ink">{r.cluster}</td>
                        <td className="py-1">{r.count}</td>
                        <td className="py-1">{r.pct_linked}</td>
                        <td className="py-1">{r.shipped}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </section>
      )}

      {/* 未來三個月路線圖 */}
      {data.roadmap_months.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionHeading>未來三個月路線圖</SectionHeading>
          <div className="grid gap-3 sm:grid-cols-3">
            {data.roadmap_months.map((m) => (
              <Card key={m.ym} className="flex flex-col gap-2 p-3">
                <div className="flex items-baseline justify-between border-b-[0.5px] border-line-soft pb-1.5">
                  <span className="font-bold text-ink">{m.ym}</span>
                  <Chip tone="mute">{m.label}</Chip>
                </div>
                {m.groups.length === 0 ? (
                  <span className="text-caption text-ink-4">尚無里程碑</span>
                ) : (
                  <div className="flex flex-col gap-2">
                    {m.groups.map((grp) => (
                      <div key={grp.parent_id} className="flex flex-col gap-1">
                        <span className="text-micro font-semibold text-ink-3">
                          {grp.parent_title}
                        </span>
                        <ul className="flex flex-col gap-1 pl-1 text-label text-ink-2">
                          {grp.items.map((it, idx) => (
                            <li key={idx} className="flex items-baseline gap-1.5">
                              <span className="text-caption">
                                {it.auto_done ? "⚡" : it.done ? "✅" : "⬜"}
                              </span>
                              <span>
                                <strong className="font-semibold text-ink">{it.goal_title}</strong> — {it.text}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* G1~G4 Active Groups */}
      {data.groups.map((group) => (
        <section key={group.parent_id} className="flex flex-col gap-3">
          <SectionHeading
            aside={
              <span className="text-caption text-ink-3">
                {group.total_milestones > 0 ? `— ${group.done_milestones}/${group.total_milestones}` : ""}
                {group.subtitle ? ` · ${group.subtitle}` : ""}
              </span>
            }
          >
            {group.title}
          </SectionHeading>

          <div className="grid gap-3 sm:grid-cols-2">
            {group.goals.map((g) => (
              <GoalCard key={g.id} g={g} tick={tick} />
            ))}
          </div>
        </section>
      ))}

      {/* Paused Groups */}
      {data.paused_groups.length > 0 && (
        <section className="flex flex-col gap-2">
          <Disclosure summary={`⏸ 暫緩的目標（${data.paused_groups.length} 組）`}>
            <div className="flex flex-col gap-4 py-2">
              <span className="text-caption text-ink-3">累積彈藥，等觸發條件</span>
              {data.paused_groups.map((pg) => (
                <div key={pg.parent_id} className="flex flex-col gap-2">
                  <span className="font-semibold text-ink">{pg.title}</span>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {pg.goals.map((g) => (
                      <GoalCard key={g.id} g={g} tick={tick} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Disclosure>
        </section>
      )}
    </div>
  )
}
