import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getFocus } from "@/lib/api"
import { SectionHeading } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { OverallNarrative } from "./OverallNarrative"
import { FocusKpis } from "./FocusKpis"
import { FocusRowCard } from "./FocusRowCard"
import { OrphanTable } from "./OrphanTable"
import { StaleGoalsTable } from "./StaleGoalsTable"

export function FocusPage() {
  const [days, setDays] = useState<7 | 30>(7)
  const focusQuery = useQuery({
    queryKey: ["focus", days],
    queryFn: () => getFocus(days),
  })

  if (focusQuery.isPending) {
    return <p className="p-6 text-body text-ink-3">讀取焦點資料中…</p>
  }

  if (focusQuery.isError) {
    return (
      <p className="p-6 text-body text-bad">
        讀不到焦點資料：{(focusQuery.error as Error).message}
      </p>
    )
  }

  const data = focusQuery.data

  return (
    <div className="flex flex-col gap-6">
      {/* 🧭 本週總覽 — ccstory cross-category narrative */}
      <OverallNarrative overall={data.overall} />

      {/* Header & Period switch */}
      <section className="flex flex-col gap-3">
        <PageHeader
          page="focus"
          action={
            <div className="flex items-center gap-1 rounded-md bg-bg-2 p-0.5">
            <Button
              variant={days === 7 ? "selected" : "ghost"}
              size="sm"
              onClick={() => setDays(7)}
            >
              7 天
            </Button>
            <Button
              variant={days === 30 ? "selected" : "ghost"}
              size="sm"
              onClick={() => setDays(30)}
            >
              30 天
            </Button>
            </div>
          }
        />

        {/* Headline KPIs */}
        <FocusKpis kpis={data.kpis} />
      </section>

      {/* Goals receiving time */}
      <section className="flex flex-col gap-3">
        <SectionHeading>有時間投入的目標</SectionHeading>
        {data.rows.length === 0 ? (
          <p className="text-body text-ink-3">此區間無對應到目標的時間</p>
        ) : (
          <div className="flex flex-col gap-3">
            {data.rows.map((row) => (
              <FocusRowCard key={row.goal_category} row={row} />
            ))}
          </div>
        )}
      </section>

      {/* Orphan time */}
      <OrphanTable items={data.orphan_time} />

      {/* Stale goals */}
      <StaleGoalsTable goals={data.stale_goals} />
    </div>
  )
}
