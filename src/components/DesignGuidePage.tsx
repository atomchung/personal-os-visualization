import { useState } from "react"
import { NAV_GROUPS } from "@/lib/informationArchitecture"
import { Button } from "@/components/ui/button"
import { Card, SectionHeading, SubsectionHeading } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { Disclosure } from "@/components/ui/disclosure"
import { PageHeader } from "@/components/ui/page-header"

type GuideView = "structure" | "components" | "triage"

const VIEWS: { key: GuideView; label: string }[] = [
  { key: "structure", label: "資訊架構" },
  { key: "components", label: "共用元件" },
  { key: "triage", label: "問題分流" },
]

export function DesignGuidePage() {
  const [view, setView] = useState<GuideView>("structure")
  const [selectedExample, setSelectedExample] = useState("投資")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader page="guide" />

      <nav aria-label="規範內容" className="flex flex-wrap gap-2">
        {VIEWS.map((item) => (
          <Button
            key={item.key}
            aria-pressed={view === item.key}
            variant={view === item.key ? "selected" : "ghost"}
            onClick={() => setView(item.key)}
          >
            {item.label}
          </Button>
        ))}
      </nav>

      {view === "structure" ? (
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-2">
            <SectionHeading>父子層級</SectionHeading>
            <Card className="p-4">
              <ul className="flex flex-col gap-3 text-label text-ink-2">
                {NAV_GROUPS.map((group) => (
                  <li key={group.id}>
                    <strong className="font-semibold text-ink">{group.label}</strong>
                    <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
                      {group.items.map((item) => (
                        <li key={item.key}>
                          <span className="font-medium text-ink">{item.label}</span>
                          <span className="text-ink-3"> · {item.short}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </Card>
          </section>

          <section className="flex flex-col gap-2">
            <SectionHeading>摘要只做入口</SectionHeading>
            <Card className="flex flex-col gap-3 p-4">
              <p className="text-body text-ink-2">
                今日只顯示各領域的一句摘要與下一步；完整研究、運動紀錄、目標清單、待辦與 AI 使用細節，回到對應子頁查看。
              </p>
              <div className="flex flex-wrap gap-2" role="list" aria-label="摘要範例">
                {["投資", "運動", "目標", "待辦", "AI 使用"].map((label) => (
                  <Button
                    key={label}
                    variant={selectedExample === label ? "selected" : "ghost"}
                    onClick={() => setSelectedExample(label)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <p className="text-caption text-ink-3" aria-live="polite">
                {selectedExample}：摘要說明現在要看什麼；不在今日重複整段內容。
              </p>
            </Card>
          </section>
        </div>
      ) : null}

      {view === "components" ? (
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-2">
            <SectionHeading>共用元件展示</SectionHeading>
            <Card className="flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-1">
                <SubsectionHeading>父標題</SubsectionHeading>
                <p className="text-body text-ink-2">正文維持同一閱讀寬度，狀態用文字加 chip 表達。</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="ok">資料完整</Chip>
                <Chip tone="warn">需要補資料</Chip>
                <Chip tone="mute">唯讀摘要</Chip>
              </div>
              <Disclosure summary="展開看子層級與來源">
                <div className="flex flex-col gap-2 py-1 text-caption text-ink-2">
                  <SubsectionHeading>子標題</SubsectionHeading>
                  <ul className="flex list-disc flex-col gap-1 pl-5">
                    <li>子項目保留縮排，不與父項目攤在同一層。</li>
                    <li>展開後提供摘要沒有的來源或驗證內容。</li>
                  </ul>
                </div>
              </Disclosure>
            </Card>
          </section>
        </div>
      ) : null}

      {view === "triage" ? (
        <div className="flex flex-col gap-4">
          <SectionHeading>三類問題先分清楚</SectionHeading>
          {[
            ["視覺化", "標題層級、字級、間距、重複呈現或操作找不到。", "介面先修"],
            ["資料整合", "API 契約、摘要與完整頁的對應、同步或狀態標示不一致。", "本機整合端"],
            ["上游來源", "原始筆記缺日期、結果、事件名稱或驗證條件。", "來源負責端"],
          ].map(([label, description, owner]) => (
            <Card key={label} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="flex min-w-0 flex-col gap-1">
                <SubsectionHeading>{label}</SubsectionHeading>
                <p className="text-body text-ink-2">{description}</p>
              </div>
              <Chip tone={label === "上游來源" ? "warn" : "info"}>{owner}</Chip>
            </Card>
          ))}
          <p className="text-caption text-ink-3">
            介面能解決的先交付；來源缺口要列出實例與負責端，不能用改字把未知變成已知。
          </p>
        </div>
      ) : null}
    </div>
  )
}
