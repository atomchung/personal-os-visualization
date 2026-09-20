import type { FocusRow } from "@/lib/api"
import { Card } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { Disclosure } from "@/components/ui/disclosure"

export function FocusRowCard({ row }: { row: FocusRow }) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      {/* Header row: category · hours · share · meta */}
      <div className="flex flex-wrap items-baseline gap-2.5">
        <span className="text-section font-bold text-ink">
          {row.goal_category}
        </span>
        <span className="text-num font-bold tabular-nums text-ink">
          {row.active_hhmm}
        </span>
        <Chip tone="ok">{row.share_pct} 佔比</Chip>
        <span className="text-caption text-ink-3">
          {row.session_count} 段工作紀錄 · 目標 {row.goals_updated}/
          {row.goals_total} 有更新
        </span>
      </div>

      {/* Sub-bucket breakdown */}
      {row.sub_buckets.length > 1 && row.active_min > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-caption text-ink-3">
          <span className="font-medium text-ink-2">📊 子分類：</span>
          {row.sub_buckets.map((b, idx) => (
            <span key={b.time_category} className="inline-flex items-center">
              <span>
                {b.time_category} {b.active_hhmm} ({b.share_pct})
              </span>
              {idx < row.sub_buckets.length - 1 && (
                <span className="mx-1 text-ink-4">·</span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Priority gap hint */}
      {row.hint && (
        <div className="rounded-sm border-[0.5px] border-warn/30 bg-warn/15 px-3 py-1.5 text-caption font-medium text-warn">
          {row.hint}
        </div>
      )}

      {/* Top session preview */}
      {row.top_session_text && (
        <p className="text-caption text-ink-3">
          💬 最長工作紀錄開頭（{row.top_session_category}）：
          <span className="text-ink-2">{row.top_session_text}</span>
        </p>
      )}

      {/* Goals list */}
      <Disclosure summary={`目標清單 (${row.goals.length})`}>
        {row.goals.length === 0 ? (
          <p className="text-caption text-ink-4">此類別無目標</p>
        ) : (
          <ul className="flex flex-col gap-1.5 py-1 text-label text-ink-2">
            {row.goals.map((g) => (
              <li key={g.id} className="flex items-baseline gap-2">
                <span className="text-caption">
                  {g.is_updated ? "✅" : "⬜"}
                </span>
                <strong className="font-semibold text-ink">{g.title}</strong>
                <span className="text-caption text-ink-3">
                  — {g.current || g.target || "(未更新)"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Disclosure>
    </Card>
  )
}
