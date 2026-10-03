import { useQuery } from "@tanstack/react-query"
import { getWork, type WorkData } from "@/lib/api"
import { Card, SectionHeading } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"

const sections: { key: keyof WorkData["groups"]; label: string; empty: string }[] = [
  { key: "in_progress", label: "進行中", empty: "目前沒有進行中的任務。" },
  { key: "needs_attention", label: "需要我處理", empty: "目前沒有需要你處理的事項。" },
  { key: "completed", label: "已完成", empty: "目前沒有已完成的任務。" },
]

export function WorkPage() {
  const query = useQuery({ queryKey: ["work"], queryFn: getWork, refetchOnMount: "always" })
  return (
    <div className="flex flex-col gap-6">
      <PageHeader page="work" />
      {query.isPending ? <p className="text-body text-ink-3" role="status">讀取任務中…</p>
        : query.isError || query.data.status === "unavailable" ? (
          <div className="flex items-center gap-3" role="status">
            <p className="text-body text-ink-2">目前讀不到任務清單，請稍後重試。</p>
            <Button onClick={() => void query.refetch()}>重試</Button>
          </div>
        ) : sections.map(({ key, label, empty }) => (
          <section key={key} aria-label={label} className="flex flex-col gap-3">
            <SectionHeading>{label}</SectionHeading>
            {query.data.groups[key].length === 0 ? <p className="text-body text-ink-3">{empty}</p> : (
              <Card className="p-4">
                <ul className="flex flex-col gap-4">
                  {query.data.groups[key].map(item => (
                    <li key={item.id} className="flex flex-col gap-1">
                      <h3 className="text-body font-semibold text-ink">{item.name}</h3>
                      <p className="text-body text-ink-2">{item.summary}</p>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </section>
        ))}
    </div>
  )
}
