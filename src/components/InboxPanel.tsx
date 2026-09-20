import type { Home } from "@/lib/api"
import { Chip } from "@/components/ui/chip"
import { Disclosure } from "@/components/ui/disclosure"
import { SectionHeading } from "@/components/ui/card"

/* The hook-health chip is not decoration: a dead Stop hook once went unnoticed
 * for eleven days. Showing when the file last changed is what surfaces it. */
export function InboxPanel({ inbox }: { inbox: Home["inbox"] }) {
  const empty = inbox.pending === 0 && inbox.stale === 0
  return (
    <section className="flex flex-col gap-2">
      <SectionHeading
        aside={
          <span className="flex flex-wrap items-center gap-1.5">
            <Chip tone="mute">{inbox.pending} 待整理</Chip>
            {inbox.stale > 0 && <Chip tone="warn">{inbox.stale} 筆較舊</Chip>}
            <Chip tone={inbox.health_tone}>入口 {inbox.health_label}</Chip>
          </span>
        }
      >
        待整理
      </SectionHeading>

      {empty ? (
        <p className="text-body text-ok">待整理已清空 ✓</p>
      ) : (
        <Disclosure
          summary={`最近工作紀錄（顯示 ${inbox.rows.length} / ${inbox.pending} 條 · 完整整理另有入口）`}
        >
          <ul className="flex flex-col">
            {inbox.rows.map((row, i) => (
              <li
                key={`${row.time_label}-${i}`}
                className="flex items-baseline gap-2 border-b-[0.5px] border-line-soft py-1 last:border-b-0"
              >
                <span className="w-10 shrink-0 text-micro tabular-nums text-ink-4">
                  {row.time_label}
                </span>
                <Chip tone="mute" className="shrink-0">
                  {row.cwd}
                </Chip>
                <span className="truncate text-caption text-ink-2" title={row.text}>
                  {row.text}
                  {row.heavy && " 🔥"}
                </span>
              </li>
            ))}
          </ul>
          {inbox.hidden > 0 && (
            <p className="mt-2 text-caption text-ink-4">
              還有 {inbox.hidden} 條未顯示 · 批次整理請回到工作紀錄入口
            </p>
          )}
        </Disclosure>
      )}
    </section>
  )
}
