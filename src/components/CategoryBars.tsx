import type { Home } from "@/lib/api"
import { Card, SectionHeading } from "@/components/ui/card"

/* Category colours are semantic and owned by core/styles.py
 * (CATEGORY_COLORS); they arrive as generated --color-cat-N tokens. */
const CATEGORY_TOKEN: Record<string, string> = {
  投資: "--color-cat-1",
  輸出: "--color-cat-2",
  學習: "--color-cat-3",
  職涯: "--color-cat-4",
  其他: "--color-cat-5",
}

export function CategoryBars({
  rows,
  note,
}: {
  rows: Home["categories"]
  note: string
}) {
  const max = Math.max(...rows.map((r) => r.hours), 0.1)
  return (
    <section className="flex flex-col gap-2">
      <SectionHeading>本週時間 × Commits（按類別）</SectionHeading>
      {rows.length === 0 ? (
        <p className="text-body text-ink-3">過去 7 天無活躍紀錄</p>
      ) : (
        <Card className="flex flex-col gap-1.5 p-3">
          {rows.map((r) => (
            <div
              key={r.category}
              className="flex items-center gap-2.5 text-label"
              style={{ color: `var(${CATEGORY_TOKEN[r.category] ?? "--color-ink-3"})` }}
            >
              <span className="w-12 shrink-0 text-ink-3">{r.category}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-2">
                <div
                  className="h-full rounded-full bg-current"
                  style={{ width: `${(r.hours / max) * 100}%` }}
                />
              </div>
              <span className="w-11 shrink-0 text-right font-medium tabular-nums text-ink-2">
                {r.hours.toFixed(1)}h
              </span>
              <span className="w-8 shrink-0 text-right text-micro tabular-nums text-ink-3">
                {r.commits ? `${r.commits}c` : "—"}
              </span>
              <span className="w-16 shrink-0 text-right text-micro font-medium tabular-nums">
                {r.cloud_sessions
                  ? `☁${r.cloud_sessions}s/${r.cloud_commits}c`
                  : ""}
              </span>
            </div>
          ))}
        </Card>
      )}
      <p className="text-caption text-ink-4">
        時數=本地 jsonl · c=本地 commits · ☁s/c=雲端 sessions/commits
        {note && ` · ${note}`}
      </p>
    </section>
  )
}
