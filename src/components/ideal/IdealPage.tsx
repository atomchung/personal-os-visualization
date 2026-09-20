import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getIdeal } from "@/lib/api"
import { Card, SectionHeading } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { Disclosure } from "@/components/ui/disclosure"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"

const STATUS_TONE: Record<string, "ok" | "warn" | "info" | "accent" | "mute"> = {
  exploring: "accent",
  validated: "ok",
  candidate: "info",
  parked: "mute",
  done: "ok",
}

export function IdealPage() {
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [selectedTheme, setSelectedTheme] = useState<string>("all")

  const idealQuery = useQuery({
    queryKey: ["ideal"],
    queryFn: getIdeal,
  })

  if (idealQuery.isPending) {
    return <p className="p-6 text-body text-ink-3">讀取理想池資料中…</p>
  }

  if (idealQuery.isError) {
    return (
      <p className="p-6 text-body text-bad">
        讀不到理想池資料：{(idealQuery.error as Error).message}
      </p>
    )
  }

  const data = idealQuery.data
  const kpis = data.kpis

  const filteredItems = data.items.filter((item) => {
    if (selectedStatus !== "all" && item.status !== selectedStatus) return false
    if (selectedTheme !== "all" && item.theme !== selectedTheme) return false
    return true
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader page="ideal" />

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="flex flex-col gap-2 p-3">
          <div className="text-caption text-ink-3">問題卡</div>
          <div className="text-hero font-bold leading-display tabular-nums text-ink">
            {kpis.total_cards}
          </div>
          <div className="mt-auto text-micro text-ink-4">全池積壓</div>
        </Card>

        <Card className="flex flex-col gap-2 p-3">
          <div className="text-caption text-ink-3">正在探索</div>
          <div className="text-hero font-bold leading-display tabular-nums text-ink">
            {kpis.exploring}
          </div>
          <div className="mt-auto">
            <Chip tone="accent">探索中</Chip>
          </div>
        </Card>

        <Card className="flex flex-col gap-2 p-3">
          <div className="text-caption text-ink-3">已驗證</div>
          <div className="text-hero font-bold leading-display tabular-nums text-ink">
            {kpis.validated}
          </div>
          <div className="mt-auto">
            <Chip tone="ok">已驗證</Chip>
          </div>
        </Card>

        <Card className="flex flex-col gap-2 p-3">
          <div className="text-caption text-ink-3">高目標關聯</div>
          <div className="text-hero font-bold leading-display tabular-nums text-ink">
            {kpis.high_fit}
          </div>
          <div className="mt-auto">
            <Chip tone="info">High Fit</Chip>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-md bg-bg-2 p-0.5">
          <Button
            variant={selectedStatus === "all" ? "selected" : "ghost"}
            size="sm"
            onClick={() => setSelectedStatus("all")}
          >
            全部狀態
          </Button>
          {Object.entries(data.status_labels).map(([key, label]) => (
            <Button
              key={key}
              variant={selectedStatus === key ? "selected" : "ghost"}
              size="sm"
              onClick={() => setSelectedStatus(key)}
            >
              {label}
            </Button>
          ))}
        </div>

        {data.themes.length > 1 && (
          <div className="flex items-center gap-1 rounded-md bg-bg-2 p-0.5">
            <Button
              variant={selectedTheme === "all" ? "selected" : "ghost"}
              size="sm"
              onClick={() => setSelectedTheme("all")}
            >
              全部主題
            </Button>
            {data.themes.map((theme) => (
              <Button
                key={theme}
                variant={selectedTheme === theme ? "selected" : "ghost"}
                size="sm"
                onClick={() => setSelectedTheme(theme)}
              >
                {theme}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Problem Cards */}
      <section className="flex flex-col gap-3">
        <SectionHeading
          aside={
            <span className="text-caption text-ink-4">
              顯示 {filteredItems.length} / {data.items.length} 張問題卡
            </span>
          }
        >
          問題清單
        </SectionHeading>

        {filteredItems.length === 0 ? (
          <p className="text-body text-ink-3">目前篩選條件下無問題卡。</p>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredItems.map((item) => (
              <Card key={item.id} className="flex flex-col gap-3 p-4">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Chip tone={STATUS_TONE[item.status] ?? "mute"}>
                      {item.status_label}
                    </Chip>
                    <span className="text-section font-bold text-ink">
                      {item.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Chip tone="mute">{item.theme}</Chip>
                    <Chip tone="info">目標關聯：{item.goal_fit_label}</Chip>
                  </div>
                </div>

                {/* Details */}
                <div className="flex flex-col gap-2 text-label text-ink-2">
                  {item.problem && (
                    <div>
                      <strong className="text-ink">問題：</strong>
                      {item.problem}
                    </div>
                  )}
                  {item.user_story && (
                    <div>
                      <strong className="text-ink">使用者故事：</strong>
                      {item.user_story}
                    </div>
                  )}
                  {item.minimum_execution_unit && (
                    <div>
                      <strong className="text-ink">最小執行單位：</strong>
                      {item.minimum_execution_unit}
                    </div>
                  )}
                  {item.cheapest_test && (
                    <div>
                      <strong className="text-ink">最便宜測試：</strong>
                      {item.cheapest_test}
                    </div>
                  )}
                  {item.next_action && (
                    <div className="rounded-sm bg-bg-3 p-2 font-medium text-ink">
                      <span className="text-accent">👉 下一步：</span>
                      {item.next_action}
                    </div>
                  )}
                </div>

                {/* Quantification & Evidence Disclosure */}
                {(item.quantification.length > 0 || item.evidence.length > 0) && (
                  <Disclosure summary="量化訊號與來源證據">
                    <div className="flex flex-col gap-2 py-1 text-caption text-ink-3">
                      {item.quantification.length > 0 && (
                        <div>
                          <span className="font-semibold text-ink-2">量化訊號：</span>
                          <ul className="list-disc pl-4">
                            {item.quantification.map((q, i) => (
                              <li key={i}>
                                {q.label}：<strong className="text-ink">{q.value}</strong> ({q.basis} · {q.note})
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {item.evidence.length > 0 && (
                        <div>
                          <span className="font-semibold text-ink-2">來源證據：</span>
                          <ul className="list-disc pl-4 font-mono text-micro">
                            {item.evidence.map((ev, i) => (
                              <li key={i}>
                                {ev.path}：{ev.note}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </Disclosure>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
