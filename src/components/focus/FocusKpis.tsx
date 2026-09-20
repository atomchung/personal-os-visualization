import type { FocusKPIs } from "@/lib/api"
import { Card } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"

export function FocusKpis({ kpis }: { kpis: FocusKPIs }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card className="flex flex-col gap-2 p-3">
        <div className="text-caption text-ink-3">總活躍時間</div>
        <div className="text-hero font-bold leading-display tabular-nums text-ink">
          {kpis.total_active_hhmm}
        </div>
        <div className="mt-auto text-micro text-ink-4">區間內全部投入</div>
      </Card>

      <Card className="flex flex-col gap-2 p-3">
        <div className="text-caption text-ink-3">對應目標的時間</div>
        <div className="text-hero font-bold leading-display tabular-nums text-ink">
          {kpis.linked_hhmm}
        </div>
        <div className="mt-auto flex items-center gap-1.5">
          <Chip tone="ok">{kpis.linked_pct} 佔比</Chip>
        </div>
      </Card>

      <Card className="flex flex-col gap-2 p-3">
        <div className="text-caption text-ink-3">落空時間 (無目標)</div>
        <div className="text-hero font-bold leading-display tabular-nums text-ink">
          {kpis.orphan_hhmm}
        </div>
        <div className="mt-auto flex items-center gap-1.5">
          {kpis.orphan_min > 0 ? (
            <Chip tone="warn">無對應目標</Chip>
          ) : (
            <Chip tone="ok">無落空</Chip>
          )}
        </div>
      </Card>

      <Card className="flex flex-col gap-2 p-3">
        <div className="text-caption text-ink-3">休眠目標</div>
        <div className="text-hero font-bold leading-display tabular-nums text-ink">
          {kpis.stale_goals_count}
        </div>
        <div className="mt-auto flex items-center gap-1.5">
          {kpis.stale_goals_count > 0 ? (
            <Chip tone="warn">{kpis.stale_goals_count} 個目標零投入</Chip>
          ) : (
            <Chip tone="ok">全員活躍</Chip>
          )}
        </div>
      </Card>
    </div>
  )
}
