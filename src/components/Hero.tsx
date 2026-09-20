import type { Home } from "@/lib/api"

/** Greeting + a data strip. The strip is deliberately not a paragraph: four
 *  readings separated by mid-dots scan faster than a sentence about them. */
export function Hero({ hero }: { hero: Home["hero"] }) {
  return (
    <header className="flex items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-ink text-section font-bold text-paper">
        {Array.from(hero.name.trim())[0]?.toUpperCase() || "P"}
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h1 className="text-display font-bold leading-display tracking-tight text-ink">
            {hero.greeting} {hero.name}
          </h1>
          <span className="text-caption text-ink-3">{hero.week_label}</span>
        </div>
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-label text-ink-3">
          {hero.diagnosis.map((d, i) => (
            <span key={d.label} className="flex items-baseline gap-1">
              {i > 0 && <span className="mr-1 text-ink-4">·</span>}
              {d.label}
              <b className="font-semibold text-ink-2">{d.value}</b>
              {d.note && <span className="text-ink-4">{d.note}</span>}
            </span>
          ))}
        </p>
        {hero.usage_missing && (
          <p className="text-caption text-warn">
            AI usage 快照尚未建立，上面的數字是 0 而不是「沒用」 —— 跑
            scripts/refresh_usage_cache.py 重建。
          </p>
        )}
      </div>
    </header>
  )
}
