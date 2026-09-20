import type { Suggestion, Verdict } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"

const VERDICTS: { value: Exclude<Verdict, "clear">; label: string }[] = [
  { value: "accept", label: "本週要做" },
  { value: "not_now", label: "不是現在" },
  { value: "wrong_context", label: "脈絡不對" },
]

const VERDICT_LABEL: Record<string, string> = {
  accept: "本週要做",
  not_now: "不是現在",
  wrong_context: "脈絡不對",
}

/** One `label：value` detail row — thin grey label, one ink step up for the
 *  value. Bold is reserved for the card title; see the emphasis contract. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-caption text-ink-3">
      {label}：<span className="text-ink-2">{value}</span>
    </div>
  )
}

export function CockpitCard({
  item,
  onVerdict,
  busy,
}: {
  item: Suggestion
  onVerdict: (verdict: Verdict) => void
  busy: boolean
}) {
  const chosen = item.human_verdict
  const hasDetail =
    item.goal_attributed ||
    Boolean(item.current_milestone) ||
    Boolean(item.proposed_milestone) ||
    item.benefit_defined

  return (
    // The card owns its footer. Buttons are children of the same element that
    // draws the border — the thing Streamlit could not express, where a widget
    // row could only float underneath and be faked back on with :has().
    <article className="rounded-lg border-[0.5px] border-line-soft bg-paper shadow-sm">
      {/* One spacing decision for the whole body: change gap-2 and every row
          moves together. No margin on any child, so nothing can drift. */}
      <div className="flex flex-col gap-2 px-3.5 py-3">
        <div>
          <h3 className="text-body font-bold text-ink">{item.title}</h3>
          <p className="mt-1 text-body text-ink-2">{item.next_action}</p>
        </div>

        {/* Only rows that carry something. An unattributed thread and an
            undefined benefit each used to spend a full line saying they were
            empty, while the chips below already said the same thing — two
            lines of nothing on every card. */}
        {hasDetail && (
          <div className="flex flex-col gap-1">
            {item.goal_attributed && (
              <Row
                label="大目標"
                value={
                  item.goal_target
                    ? `${item.goal_title} · ${item.goal_target}`
                    : item.goal_title
                }
              />
            )}
            {item.current_milestone && (
              <Row label="Milestone" value={item.current_milestone} />
            )}
            {item.proposed_milestone && (
              <Row label="AI 下一 Milestone 草案" value={item.proposed_milestone} />
            )}
            {item.benefit_defined && (
              <Row label="完成收益" value={item.expected_benefit} />
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {chosen === "accept" && <Chip tone="ok">人已選：本週要做</Chip>}
          <Chip tone="accent">{item.why_now}</Chip>
          {!item.goal_attributed && <Chip tone="mute">未歸屬目標</Chip>}
          <Chip tone={item.benefit_defined ? "accent" : "warn"}>
            {item.benefit_defined ? "收益已定義" : "收益待定義"}
          </Chip>
          <Chip tone="mute">
            {item.next_actor} · {item.action_kind}
          </Chip>
        </div>

        <div className="text-micro text-ink-3">{item.evidence_ref}</div>
      </div>

      <footer className="flex items-center gap-1.5 border-t-[0.5px] border-line-soft px-3.5 py-2">
        {VERDICTS.map((verdict) => (
          <Button
            key={verdict.value}
            variant={chosen === verdict.value ? "selected" : "ghost"}
            disabled={busy}
            onClick={() => onVerdict(verdict.value)}
          >
            {verdict.label}
          </Button>
        ))}
        {chosen && (
          <span className="ml-auto flex items-center gap-2 text-caption text-ink-3">
            已記錄：{VERDICT_LABEL[chosen]}
            <Button variant="link" disabled={busy} onClick={() => onVerdict("clear")}>
              撤銷
            </Button>
          </span>
        )}
      </footer>
    </article>
  )
}
