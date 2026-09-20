import type { Pillar } from "@/lib/api"
import { Card } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"

/** Eight cycles of output volume, drawn small enough to read as texture. */
function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const max = Math.max(...values) || 1
  const step = 100 / (values.length - 1)
  const points = values
    .map((v, i) => `${i * step},${20 - (v / max) * 18}`)
    .join(" ")
  return (
    <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="h-4 w-full">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export function PillarGrid({ pillars }: { pillars: Pillar[] }) {
  return (
    // One row on a wide window, two on a narrow one. The card decides its own
    // height from its content — never a fixed height, which clips a long
    // subline instead of growing.
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {pillars.map((p) => (
        // Fixed slot order, so the same row of every card lines up with its
        // neighbours: label / value / bar / subline / optional spark / delta.
        // The spark sits AFTER the subline and the delta is pushed to the
        // bottom with mt-auto — otherwise the one card that has a chart
        // shoves its own text down and nothing agrees with anything.
        <Card key={p.label} className="flex h-full flex-col gap-2 p-3">
          <div className="text-caption text-ink-3">{p.label}</div>
          <div className="flex items-baseline gap-1">
            <span className="text-hero font-bold leading-display tabular-nums text-ink">
              {p.value}
            </span>
            <span className="text-caption text-ink-3">{p.unit}</span>
          </div>
          <div
            className="h-1 overflow-hidden rounded-full bg-bg-2"
            style={{ color: `var(--color-${p.tone})` }}
          >
            <div
              className="h-full rounded-full bg-current"
              style={{ width: `${Math.min(100, Math.max(0, p.pct * 100))}%` }}
            />
          </div>
          <div className="text-micro text-ink-3">{p.sub}</div>
          {p.spark.length > 1 && (
            <div style={{ color: `var(--color-${p.tone})` }}>
              <Spark values={p.spark} />
            </div>
          )}
          {p.delta && (
            <div className="mt-auto pt-0.5">
              <Chip tone={p.delta_tone}>{p.delta}</Chip>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
