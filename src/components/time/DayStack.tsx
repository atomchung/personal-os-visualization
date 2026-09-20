import { Card } from "@/components/ui/card"

/* One stacked column per day. Streamlit drew these with altair; here they are
 * divs, because the alternative is a charting dependency for two charts whose
 * whole job is "which day, how much, split by what".
 *
 * Column height is the day's total against the busiest day, so the shape reads
 * as volume over time; the segments inside carry the split. */
export type DayDatum = { date: string; key: string; value: number }

export function DayStack({
  title,
  caption,
  rows,
  colors,
  unit,
  decimals = 0,
}: {
  title: string
  caption?: string
  rows: DayDatum[]
  /** key → CSS custom property name, e.g. "--color-cat-1". */
  colors: Record<string, string>
  unit: string
  decimals?: number
}) {
  if (rows.length === 0) return null

  // Sum duplicates rather than stacking them: two rows with the same date and
  // key are one quantity split across raw ids, and drawing them as two segments
  // of the same colour reads as a rendering fault.
  const byDay = new Map<string, Map<string, number>>()
  for (const r of rows) {
    if (r.value <= 0) continue
    let bucket = byDay.get(r.date)
    if (!bucket) byDay.set(r.date, (bucket = new Map()))
    bucket.set(r.key, (bucket.get(r.key) ?? 0) + r.value)
  }
  // One stacking order for every column, taken from the legend. Iterating each
  // day's own map put 投資 at the bottom on Monday and at the top on Tuesday,
  // which makes a stacked chart unreadable — the eye tracks bands, not labels.
  const keys = Object.keys(colors).filter((k) => rows.some((r) => r.key === k))
  for (const k of rows.map((r) => r.key)) if (!keys.includes(k)) keys.push(k)
  const rank = new Map(keys.map((k, i) => [k, i]))

  const days = [...byDay.entries()]
    .map(
      ([date, m]) =>
        [
          date,
          [...m]
            .map(([key, value]) => ({ date, key, value }))
            .sort((a, b) => (rank.get(a.key) ?? 99) - (rank.get(b.key) ?? 99)),
        ] as const,
    )
    .sort((a, b) => a[0].localeCompare(b[0]))
  if (days.length === 0) return null

  const totals = days.map(([, items]) => items.reduce((s, i) => s + i.value, 0))
  const max = Math.max(...totals, 1)
  const fallback = "--color-sys-gray"

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-label font-semibold text-ink">{title}</span>
        <div className="flex flex-wrap items-center gap-2">
          {keys.map((k) => (
            <span key={k} className="flex items-center gap-1 text-micro text-ink-3">
              <span
                className="size-2 rounded-full"
                style={{ background: `var(${colors[k] ?? fallback})` }}
              />
              {k}
            </span>
          ))}
        </div>
      </div>
      <Card className="p-3">
        {/* Many days on a narrow window: scroll the plot, never the page. */}
        <div className="overflow-x-auto">
          <div className="flex h-32 min-w-full items-end gap-1">
            {days.map(([date, items], i) => {
              const total = totals[i]
              return (
                <div
                  key={date}
                  className="flex h-full min-w-[10px] flex-1 flex-col justify-end gap-px"
                  title={`${date} · ${total.toFixed(decimals)}${unit}\n${items
                    .map((it) => `${it.key} ${it.value.toFixed(decimals)}${unit}`)
                    .join("\n")}`}
                >
                  {items.map((it) => (
                    <div
                      key={it.key}
                      className="w-full rounded-xs"
                      style={{
                        height: `${(it.value / max) * 100}%`,
                        background: `var(${colors[it.key] ?? fallback})`,
                      }}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
        <div className="mt-1 flex justify-between text-micro text-ink-4">
          <span>{days[0][0]}</span>
          <span>{days[days.length - 1][0]}</span>
        </div>
        {caption && <p className="mt-1 text-micro text-ink-4">{caption}</p>}
      </Card>
    </section>
  )
}
