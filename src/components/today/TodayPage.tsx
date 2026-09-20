import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { getHome, sendVerdict, type Home, type Verdict } from "@/lib/api"
import { Hero } from "@/components/Hero"
import { PillarGrid } from "@/components/PillarGrid"
import { CockpitCard } from "@/components/CockpitCard"
import { ThreadInventory } from "@/components/ThreadInventory"
import { TodoPeek } from "@/components/TodoPeek"
import { CategoryBars } from "@/components/CategoryBars"
import { InboxPanel } from "@/components/InboxPanel"
import { SectionHeading } from "@/components/ui/card"
import { InvestmentContinuation } from "@/components/InvestmentContinuation"

export function TodayPage() {
  const qc = useQueryClient()
  const home = useQuery({ queryKey: ["home"], queryFn: getHome })

  // The server returns the rebuilt cockpit, so the write and the refresh are
  // one round trip — cached_weekly_cockpit.clear() + st.rerun(), minus the
  // rerun of everything else on the page.
  const verdict = useMutation({
    mutationFn: (vars: { slug: string; verdict: Verdict }) =>
      sendVerdict(vars.slug, vars.verdict),
    onSuccess: (cockpit) =>
      qc.setQueryData(["home"], (prev: Home | undefined) =>
        prev ? { ...prev, cockpit } : prev,
      ),
  })

  if (home.isPending) {
    return <p className="p-6 text-body text-ink-3">讀取中…</p>
  }
  if (home.isError) {
    return (
      <p className="p-6 text-body text-bad">
        讀不到資料：{(home.error as Error).message}
      </p>
    )
  }

  const data = home.data
  const cockpit = data.cockpit

  return (
    <div className="flex flex-col gap-6">
      <Hero hero={data.hero} />

      <section className="flex flex-col gap-2">
        <SectionHeading>本週選擇 · {cockpit.week_id}</SectionHeading>
        <p className="-mt-1 text-caption text-ink-3">
          這裡是整理後的建議；是否列入本週承諾由你決定
        </p>
        {verdict.isError && (
          <p className="text-caption text-bad">
            寫入失敗：{(verdict.error as Error).message}
          </p>
        )}
        {cockpit.suggestions.length === 0 ? (
          <p className="text-body text-ink-3">目前訊號不足，系統選擇不硬湊建議。</p>
        ) : (
          <div className="flex flex-col gap-3">
            {cockpit.suggestions.map((item) => (
              <CockpitCard
                key={item.task_slug}
                item={item}
                busy={verdict.isPending}
                onVerdict={(v) =>
                  verdict.mutate({ slug: item.task_slug, verdict: v })
                }
              />
            ))}
          </div>
        )}
      </section>

      <PillarGrid pillars={data.pillars} />

      <InvestmentContinuation />

      <ThreadInventory threads={data.threads} />

      {/* Two columns on a wide window, stacked on a narrow one. */}
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <TodoPeek todos={data.todos} total={data.todo_total} />
        <CategoryBars rows={data.categories} note={data.categories_note} />
      </div>

      <InboxPanel inbox={data.inbox} />
    </div>
  )
}
