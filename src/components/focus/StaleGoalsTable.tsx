import type { StaleGoal } from "@/lib/api"
import { Card, SectionHeading } from "@/components/ui/card"

export function StaleGoalsTable({ goals }: { goals: StaleGoal[] }) {
  if (goals.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <SectionHeading>休眠目標（此區間沒投入）</SectionHeading>
      <p className="-mt-1 text-caption text-ink-3">
        這些手動目標在此區間沒有對應的 AI Agent 時間。可能是線下推進中、也可能是被忽略。
      </p>
      <Card className="overflow-hidden p-0">
        <table className="w-full text-left text-label">
          <thead className="border-b-[0.5px] border-line-soft bg-bg-3 text-caption font-semibold text-ink-3">
            <tr>
              <th className="px-3.5 py-2">分類</th>
              <th className="px-3.5 py-2">目標</th>
              <th className="px-3.5 py-2">現狀</th>
            </tr>
          </thead>
          <tbody className="divide-y-[0.5px] divide-line-soft text-ink-2">
            {goals.map((g) => (
              <tr key={g.id} className="hover:bg-bg-3/50">
                <td className="px-3.5 py-2 font-medium text-ink">{g.category}</td>
                <td className="px-3.5 py-2 font-medium text-ink">{g.title}</td>
                <td className="px-3.5 py-2 text-ink-3">{g.current}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  )
}
