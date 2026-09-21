import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, SectionHeading } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { Button } from "@/components/ui/button"
import { ReadingText } from "./ReadingText"
import { historyReadingOrder } from "@/lib/investmentFormat"
import {
  getInvestmentHistorySource,
  type InvestmentContext,
  type InvestmentHistory,
  type InvestmentHistoryItem,
} from "@/lib/investment"

function stateLabel(state: InvestmentHistory["state"]) {
  return state === "ready" ? "來源完整" : state === "partial" ? "部分來源可讀" : "來源不可用"
}

function kindLabel(kind: InvestmentHistoryItem["kind"]) {
  if (kind === "decision_review") return "決策復盤"
  if (kind === "weekly_review") return "每週回顧"
  if (kind === "mistake") return "經驗教訓"
  return kind
}

function resultLabel(item: InvestmentHistoryItem) {
  return item.result_state === "known" ? "已有後續結果" : "尚未找到對應紀錄"
}

function HistoryItem({ item }: { item: InvestmentHistoryItem }) {
  const [open, setOpen] = useState(false)
  const detail = useQuery({
    queryKey: ["investment-history-source", item.id],
    queryFn: ({ signal }) => getInvestmentHistorySource(item.id, signal),
    enabled: open && item.detail_state === "available",
    retry: false,
  })
  return (
    <Card className="flex min-w-0 flex-col gap-2 p-3">
      <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-body font-medium text-ink">{item.title}</h3>
          <p className="break-words text-caption text-ink-3">
            {item.date ?? "日期未記錄"} · {item.source.path} · {item.source.line_start}–{item.source.line_end}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <Chip tone="mute">{kindLabel(item.kind)}</Chip>
          <Chip tone={item.result_state === "known" ? "ok" : "warn"}>{resultLabel(item)}</Chip>
        </div>
      </div>
      <p className="break-words text-body leading-relaxed text-ink-2">{item.excerpt || "原文沒有可用摘要。"}</p>
      <p className="break-words text-caption text-ink-3">後續結果：{item.result || "未知"}</p>
      {item.detail_state === "truncated" ? (
        <p className="text-caption text-warn">原文段落超過安全展開上限，只保留摘要與來源位置。</p>
      ) : (
        <details onToggle={(event) => setOpen(event.currentTarget.open)}>
          <summary className="cursor-pointer text-caption font-medium text-ink-3">展開原文證據</summary>
          <div className="min-w-0 pt-2">
            {detail.isPending ? <p className="text-body text-ink-3">讀取原文中…</p> : null}
            {detail.isError ? <p role="alert" className="text-body text-warn">這段原文目前無法讀取。</p> : null}
            {detail.data ? <ReadingText text={detail.data.text} /> : null}
          </div>
        </details>
      )}
    </Card>
  )
}

function ContextBlock({ context }: { context: InvestmentContext }) {
  const approved = context.decisions.filter((item) => item.kind === "approved")
  const rejected = context.decisions.filter((item) => item.kind === "rejected")
  const nextAction = typeof context.current_state.next_action === "string" ? context.current_state.next_action : "尚未記錄"
  const lastSession = typeof context.current_state.last_session === "string" ? context.current_state.last_session : "未知"
  return (
    <Card className="flex min-w-0 flex-col gap-3 p-3">
      <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <SectionHeading>本次事項的工作脈絡</SectionHeading>
          <p className="break-words text-caption text-ink-3">AI 與私人入口共用的唯讀工作範圍：{context.task.slug}</p>
        </div>
        <Chip tone="mute">唯讀 · {lastSession}</Chip>
      </div>
      <p className="break-words text-body text-ink-2">目前下一步：{nextAction}</p>
      {approved.length ? <div><h3 className="text-caption font-semibold text-ink">已核可方向</h3><ul className="mt-1 flex list-disc flex-col gap-1 pl-4 text-caption text-ink-2">{approved.slice(0, 3).map((item, index) => <li key={index}>{item.text}</li>)}</ul></div> : null}
      {rejected.length ? <div><h3 className="text-caption font-semibold text-ink">已否決／排除方向</h3><ul className="mt-1 flex list-disc flex-col gap-1 pl-4 text-caption text-ink-2">{rejected.slice(0, 3).map((item, index) => <li key={index}>{item.text}</li>)}</ul></div> : null}
      {context.evidence.length ? <details><summary className="cursor-pointer text-caption font-medium text-ink-3">AI 可展開的來源證據</summary><div className="flex flex-col gap-2 pt-2">{context.evidence.slice(0, 3).map((item, index) => <div key={index} className="min-w-0"><p className="break-words text-caption text-ink-3">{item.source.path} · {item.source.line_start}–{item.source.line_end}</p><p className="break-words text-caption text-ink-2">{item.text}</p></div>)}</div></details> : null}
      {context.warnings.length ? <p className="text-caption text-warn">工作脈絡限制：{context.warnings.slice(0, 2).join(" ")}</p> : null}
    </Card>
  )
}

export function InvestmentHistory({ data, context }: { data: InvestmentHistory; context?: InvestmentContext }) {
  const [showAll, setShowAll] = useState(false)
  const ordered = historyReadingOrder(data.items)
  const visibleItems = showAll ? ordered : ordered.slice(0, 12)
  const hiddenCount = ordered.length - visibleItems.length
  const undatedCount = ordered.filter((item) => !item.date).length
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label="投資歷史回看">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2"><SectionHeading>回看舊判斷與後續結果</SectionHeading><Chip tone={data.state === "ready" ? "ok" : "warn"}>{stateLabel(data.state)}</Chip></div>
        <p className="text-body text-ink-3">有日期的紀錄在前。沒有記錄結果時保持「未知」，不把空白推成結論。</p>
      </div>
      {context ? <ContextBlock context={context} /> : null}
      {data.coverage.errors.length ? <div className="flex flex-col gap-1 text-caption text-warn">{data.coverage.errors.map((error) => <p key={error.source_id}>{error.path}：{error.message}</p>)}</div> : null}
      {data.items.length ? <>
        <p className="text-caption text-ink-3">先顯示 {visibleItems.length} / {ordered.length} 筆；每筆都保留來源位置。{undatedCount ? `其中 ${undatedCount} 筆標題沒有日期，列在有日期的紀錄之後。` : ""}</p>
        <div className="flex min-w-0 flex-col gap-2">{visibleItems.map((item) => <HistoryItem key={item.id} item={item} />)}</div>
        {hiddenCount > 0 ? <Button type="button" className="self-start" onClick={() => setShowAll(true)}>顯示其餘 {hiddenCount} 筆歷史</Button> : null}
        {showAll && data.items.length > 12 ? <Button type="button" variant="link" className="self-start" onClick={() => setShowAll(false)}>收合到前 12 筆</Button> : null}
      </> : <p className="text-body text-ink-3">目前沒有可回看的歷史項目；沒有結果不代表沒有事件。</p>}
      {data.coverage.missing_sources.length ? <p className="text-caption text-warn">未讀取來源：{data.coverage.missing_sources.join("、")}。目前畫面只呈現可確認的部分。</p> : null}
    </section>
  )
}
