import { useState } from "react"
import type { Home } from "@/lib/api"
import { acceptNomination, skipNomination } from "@/lib/api"
import { useWrite, writeErrorText } from "@/lib/writes"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { Disclosure } from "@/components/ui/disclosure"
import { SectionHeading } from "@/components/ui/card"

/* Inventory, not a choice surface — the cockpit above is where a decision
 * gets made. Rendering every active thread expanded would recreate the
 * prioritisation problem the cockpit exists to solve, so it stays folded.
 *
 * The one thing it does write is the nomination verdict: a draft next_action is
 * either good enough to stamp onto the card or it is not, and that judgment is
 * cheap enough to belong beside the draft rather than in another tab. */
export function ThreadInventory({ threads }: { threads: Home["threads"] }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState("")

  const accept = useWrite(
    (v: { slug: string; expected: string; text?: string }) =>
      acceptNomination(v.slug, v.expected, v.text),
    ["home", "focus"],
  )
  const skip = useWrite(
    (v: { slug: string; expected: string }) => skipNomination(v.slug, v.expected),
    ["home", "focus"],
  )
  const problem = writeErrorText(accept.error) ?? writeErrorText(skip.error)
  const busy = accept.isPending || skip.isPending

  return (
    <section className="flex flex-col gap-2">
      <SectionHeading
        aside={
          threads.pending_nominations > 0 ? (
            <Chip tone="accent">🤖 {threads.pending_nominations} 提名待處理</Chip>
          ) : undefined
        }
      >
        進行中事項
      </SectionHeading>

      {problem && (
        <p className="text-caption text-bad" role="status">
          {problem}
        </p>
      )}

      {threads.total === 0 ? (
        <p className="text-body text-ink-3">
          14 天內沒有進行中的事項
        </p>
      ) : (
        // A handful of threads costs less to show than to hide. Folding is
        // for the case this exists to prevent: a wall of 70 cards.
        <Disclosure
          open={threads.total <= 5 || threads.pending_nominations > 0}
          summary={`全部進行中事項（${threads.total} 條）${threads.total <= 5 ? "" : " · 需要時再展開"}`}
        >
          <ul className="flex flex-col gap-2.5">
            {threads.items.map((t) => (
              <li key={t.slug} className="flex flex-col gap-1">
                <div className="flex items-baseline gap-1.5">
                  <span>{t.emoji}</span>
                  <span className="text-label font-semibold text-ink">
                    {t.title}
                  </span>
                  <span className="text-micro text-ink-4">{t.days_label}</span>
                  {!t.supplied && <Chip tone="warn">缺下一步</Chip>}
                </div>
                <p className="text-caption text-ink-2">{t.next_action || "—"}</p>
                {t.nomination && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-caption text-ink-3">🤖 提名：</span>
                    {editing === t.slug ? (
                      <input
                        aria-label="修改提名"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        className="min-w-0 flex-1 rounded-sm border-[0.5px] border-line bg-paper px-2 py-px text-caption text-ink"
                      />
                    ) : (
                      <span className="flex-1 text-caption text-ink-2">
                        {t.nomination}
                      </span>
                    )}
                    <Button
                      disabled={busy || (editing === t.slug && !draft.trim())}
                      onClick={() =>
                        accept.mutate(
                          {
                            slug: t.slug,
                            expected: t.nomination,
                            text:
                              editing === t.slug ? draft.trim() : undefined,
                          },
                          { onSuccess: () => setEditing(null) },
                        )
                      }
                    >
                      蓋章
                    </Button>
                    <Button
                      variant="link"
                      disabled={busy}
                      onClick={() => {
                        setEditing(editing === t.slug ? null : t.slug)
                        setDraft(t.nomination)
                      }}
                    >
                      {editing === t.slug ? "取消" : "✎ 改"}
                    </Button>
                    <Button
                      variant="link"
                      disabled={busy}
                      onClick={() =>
                        skip.mutate({ slug: t.slug, expected: t.nomination })
                      }
                    >
                      略過
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
    </section>
  )
}
