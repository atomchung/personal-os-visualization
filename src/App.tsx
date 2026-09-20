import { DEMO_MODE } from "@/lib/transport"
import { useState } from "react"
import { TodayPage } from "@/components/today/TodayPage"
import { FocusPage } from "@/components/focus/FocusPage"
import { TimePage } from "@/components/time/TimePage"
import { GoalsPage } from "@/components/goals/GoalsPage"
import { IdealPage } from "@/components/ideal/IdealPage"
import { HealthPage } from "@/components/health/HealthPage"
import { TodosPage } from "@/components/todos/TodosPage"
import { InvestmentPage } from "@/components/investment/InvestmentPage"
import { Button } from "@/components/ui/button"

type TabKey = "today" | "investment" | "focus" | "time" | "goals" | "ideal" | "health" | "todos"

const TABS: { key: TabKey; label: string }[] = [
  { key: "today", label: "今日" },
  { key: "investment", label: "投資" },
  { key: "focus", label: "焦點" },
  { key: "time", label: "AI 使用" },
  { key: "goals", label: "目標" },
  { key: "ideal", label: "理想池" },
  { key: "health", label: "運動" },
  { key: "todos", label: "本週 Todo" },
]

export default function App() {
  const [tab, setTab] = useState<TabKey>(() => {
    const p = new URLSearchParams(location.search).get("tab") as TabKey
    const valid = TABS.some((t) => t.key === p)
    return valid ? p : "today"
  })

  const handleTabChange = (nextTab: TabKey) => {
    setTab(nextTab)
    const url = new URL(location.href)
    if (nextTab === "today") {
      url.searchParams.delete("tab")
    } else {
      url.searchParams.set("tab", nextTab)
    }
    window.history.replaceState(null, "", url.toString())
  }

  return (
    <main className="mx-auto flex max-w-[1080px] flex-col gap-6 p-6">
      {/* Navigation Bar */}
      <nav aria-label="Personal OS 分頁" className="flex flex-wrap items-center justify-between gap-3 border-b-[0.5px] border-line-soft pb-3">
        <span className="text-section font-bold tracking-tight text-ink">
          Personal OS
        </span>
        <div className="flex flex-wrap items-center gap-1 rounded-md bg-bg-2 p-0.5">
          {TABS.map((t) => (
            <Button
              key={t.key}
              aria-current={tab === t.key ? "page" : undefined}
              variant={tab === t.key ? "selected" : "ghost"}
              size="sm"
              onClick={() => handleTabChange(t.key)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </nav>

      {DEMO_MODE && (
        <aside aria-label="展示版說明" className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-bg-2 p-3 text-caption text-ink-2">
          <span><strong>合成資料展示版</strong> · 固定範例週 9/14–9/20，所有人物、專案與數字皆為虛構。操作只留在本頁，重新整理即還原。</span>
          <Button size="sm" onClick={() => window.location.reload()}>重設範例</Button>
        </aside>
      )}

      {/* Tab Content View */}
      {tab === "today" && <TodayPage />}
      {tab === "investment" && <InvestmentPage />}
      {tab === "focus" && <FocusPage />}
      {tab === "time" && <TimePage />}
      {tab === "goals" && <GoalsPage />}
      {tab === "ideal" && <IdealPage />}
      {tab === "health" && <HealthPage />}
      {tab === "todos" && <TodosPage />}
    </main>
  )
}
