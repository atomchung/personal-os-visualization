import { DEMO_MODE } from "@/lib/transport"
import { useState } from "react"
import { AppNav } from "@/components/AppNav"
import { DesignGuidePage } from "@/components/DesignGuidePage"
import { isTabKey, type TabKey } from "@/lib/informationArchitecture"
import { TodayPage } from "@/components/today/TodayPage"
import { FocusPage } from "@/components/focus/FocusPage"
import { TimePage } from "@/components/time/TimePage"
import { GoalsPage } from "@/components/goals/GoalsPage"
import { IdealPage } from "@/components/ideal/IdealPage"
import { HealthPage } from "@/components/health/HealthPage"
import { TodosPage } from "@/components/todos/TodosPage"
import { InvestmentPage } from "@/components/investment/InvestmentPage"
import { Button } from "@/components/ui/button"

export default function App() {
  const [tab, setTab] = useState<TabKey>(() => {
    const p = new URLSearchParams(location.search).get("tab")
    return isTabKey(p) ? p : "today"
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
      <AppNav tab={tab} onChange={handleTabChange} />

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
      {tab === "guide" && <DesignGuidePage />}
    </main>
  )
}
