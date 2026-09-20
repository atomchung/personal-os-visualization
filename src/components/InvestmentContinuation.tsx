import { useQuery } from "@tanstack/react-query"
import { DEMO_MODE } from "@/lib/transport"
import { getInvestment } from "@/lib/investment"
import { Card, SectionHeading } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { InlineText } from "@/components/investment/ReadingText"

/** The Today hand-off is intentionally small: it points to one live research question. */
export function InvestmentContinuation() {
  const query = useQuery({ queryKey: ["investment"], queryFn: ({ signal }) => getInvestment(signal), retry: false, staleTime: 60_000 })
  const brief = query.data?.brief
  const thesis = brief?.thesis_changes.find((item) => item.thesis)?.thesis
  const next = brief?.upcoming[0]
  if (query.isPending) return null
  if (query.isError || !brief || !thesis) return null
  return (
    <section className="flex min-w-0 flex-col gap-2" aria-label="今日正在研究的問題">
      <div className="flex flex-wrap items-center gap-2"><SectionHeading>今日正在研究的問題</SectionHeading><Chip tone="accent">{DEMO_MODE ? "合成案例" : "本機資料"}</Chip></div>
      <Card className="flex min-w-0 flex-col gap-2 p-3">
        <p className="break-words text-body font-medium text-ink"><InlineText text={thesis} /></p>
        <p className="break-words text-body text-ink-2">{next ? <>下一個檢查點：{next.event}；要找的證據：{next.check}</> : "下一步尚未記錄。"}</p>
        <a href="?tab=investment" className="text-caption font-medium text-ink-3 underline underline-offset-2">展開研究、證據與下一步 →</a>
      </Card>
    </section>
  )
}
