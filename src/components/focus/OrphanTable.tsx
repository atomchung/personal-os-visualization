import type { OrphanTime } from "@/lib/api"
import { Card, SectionHeading } from "@/components/ui/card"

export function OrphanTable({ items }: { items: OrphanTime[] }) {
  if (items.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <SectionHeading>沒對應到目標的時間</SectionHeading>
      <p className="-mt-1 text-caption text-ink-3">
        這些類別花了時間，但沒有對應的人生目標。要麼建目標，要麼減量。
      </p>
      <Card className="overflow-hidden p-0">
        <table className="w-full text-left text-label">
          <thead className="border-b-[0.5px] border-line-soft bg-bg-3 text-caption font-semibold text-ink-3">
            <tr>
              <th className="px-3.5 py-2">分類</th>
              <th className="px-3.5 py-2">時間</th>
              <th className="px-3.5 py-2">% 總時</th>
              <th className="px-3.5 py-2">Sessions</th>
            </tr>
          </thead>
          <tbody className="divide-y-[0.5px] divide-line-soft text-ink-2">
            {items.map((r) => (
              <tr key={r.category} className="hover:bg-bg-3/50">
                <td className="px-3.5 py-2 font-medium text-ink">{r.category}</td>
                <td className="px-3.5 py-2 tabular-nums">{r.active_hhmm}</td>
                <td className="px-3.5 py-2 tabular-nums">{r.share_pct}</td>
                <td className="px-3.5 py-2 tabular-nums">{r.sessions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  )
}
