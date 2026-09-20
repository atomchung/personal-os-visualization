import { Button } from "@/components/ui/button"
import { NAV_ITEMS, type TabKey } from "@/lib/informationArchitecture"

export function AppNav({
  tab,
  onChange,
}: {
  tab: TabKey
  onChange: (nextTab: TabKey) => void
}) {
  return (
    <nav
      aria-label="Personal OS 分頁"
      className="flex min-w-0 flex-col gap-3 border-b border-line-soft pb-3 sm:flex-row sm:items-center sm:gap-5"
    >
      <span className="shrink-0 text-section font-bold tracking-tight text-ink">Personal OS</span>
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pb-1" role="list">
        {NAV_ITEMS.map((item) => (
          <Button
            key={item.key}
            aria-current={tab === item.key ? "page" : undefined}
            data-frequent={item.frequent ? "true" : undefined}
            variant={tab === item.key ? "selected" : "ghost"}
            size="sm"
            className="shrink-0 rounded-full px-3"
            onClick={() => onChange(item.key)}
          >
            {item.label}
          </Button>
        ))}
        <Button
          aria-current={tab === "guide" ? "page" : undefined}
          variant={tab === "guide" ? "selected" : "ghost"}
          size="sm"
          className="shrink-0 rounded-full px-3"
          onClick={() => onChange("guide")}
        >
          介面規範
        </Button>
      </div>
    </nav>
  )
}
