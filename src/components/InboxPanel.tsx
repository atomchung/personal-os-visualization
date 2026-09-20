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
            <Chip tone="mute">{inbox.pending} 待 triage</Chip>
            {inbox.stale > 0 && <Chip tone="warn">stale {inbox.stale}</Chip>}
            <Chip tone={inbox.health_tone}>hook {inbox.health_label}</Chip>
          </span>
        }
      >
        Inbox
      </SectionHeading>

      {empty ? (
        <p className="text-body text-ok">Inbox 已清空 ✓</p>
      ) : (
        <Disclosure
          summary={`最近 session（顯示 ${inbox.rows.length} / ${inbox.pending} 條 · 完整 triage 走 /session-board）`}
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
              還有 {inbox.hidden} 條未顯示 · 批次處理用 /session-board
            </p>
          )}
        </Disclosure>
      )}
    </section>
  )
}
