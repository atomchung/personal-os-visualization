import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, SectionHeading } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { Button } from "@/components/ui/button"
import { ReadingText } from "./ReadingText"
import { historyDetailLookupId, historyReadingOrder, reusableLearningItems } from "@/lib/investmentFormat"
import {
  getInvestmentHistorySource,
  type InvestmentContext,
  type InvestmentHistory,
  type InvestmentHistoryDetail,
  type InvestmentHistoryItem,
  type InvestmentHistorySourceRef,
  type InvestmentReadState,
} from "@/lib/investment"

function stateLabel(state: InvestmentReadState) {
  switch (state) {
    case "ready": return "來源完整"
    case "empty": return "已確認沒有項目"
    case "unknown": return "狀態未知"
    case "partial": return "部分資料可讀"
    case "stale": return "資料已過期"
    case "conflict": return "資料互相矛盾"
    case "unavailable": return "來源不可用"
  }
}

function kindLabel(kind: InvestmentHistoryItem["kind"]) {
  if (kind === "decision") return "決策紀錄"
  if (kind === "decision_episode") return "決策事件"
  if (kind === "research_checkpoint") return "研究檢查點"
  if (kind === "thesis_learning") return "論點時間線"
  return kind
}

function outcomeLabel(item: InvestmentHistoryItem) {
  return item.outcome_state === "recorded" ? "已有後續結果" : "後續結果未知"
}

function sourceRefLocation(source: InvestmentHistorySourceRef) {
  const line = source.line == null
    ? ""
    : ` · ${source.line}${source.line_end && source.line_end !== source.line ? `–${source.line_end}` : ""}`
  return `${source.path}${line}`
}

function sourceLocation(item: InvestmentHistoryItem) {
  return sourceRefLocation(item.source)
}

function HistoryDetail({ data }: { data: InvestmentHistoryDetail | undefined }) {
  if (!data) return null
  const item = data.history.item
  const recordedOutcome = item?.outcome?.state === "recorded" || item?.outcome_state === "recorded"
  return (
    <div className="flex min-w-0 flex-col gap-2 border-t border-line-soft pt-2">
      {item ? <>
        {item.reason ? <div><p className="text-caption font-medium text-ink-3">當時記錄的理由</p><p className="break-words text-body text-ink-2">{item.reason}</p></div> : null}
        {typeof item.evidence === "string" ? <div><p className="text-caption font-medium text-ink-3">當時記錄的關鍵事實</p><p className="break-words text-body text-ink-2">{item.evidence}</p></div> : Array.isArray(item.evidence) && item.evidence.length ? <div><p className="text-caption font-medium text-ink-3">當時引用的來源位置</p><ul className="list-disc pl-4 text-caption text-ink-2">{item.evidence.map((source, index) => <li key={`${index}:${source.path}`}>{sourceRefLocation(source)}</li>)}</ul></div> : null}
        <p className="break-words text-caption text-ink-3">後續結果：{recordedOutcome ? item.outcome?.text || (item.checkpoints?.some((point) => point.outcome.state === "recorded") ? "已記錄檢查點結果，見下方" : "已記錄，文字未提供") : "未知"}</p>
        {item.checkpoints?.length ? <div><p className="text-caption font-medium text-ink-3">後續檢查點</p><ul className="flex list-disc flex-col gap-1 pl-4 text-caption text-ink-2">{item.checkpoints.map((point, index) => <li key={`${index}:${point.date ?? "unknown"}`}>{point.date ?? "日期未知"}{point.what ? ` · ${point.what}` : ""}：{point.outcome.state === "recorded" ? point.outcome.text || "結果已記錄，文字未提供" : "結果未知"}{point.source ? ` · ${sourceRefLocation(point.source)}` : ""}</li>)}</ul></div> : null}
        <p className="break-words text-caption text-ink-3">已記錄心得：{item.learning_state === "recorded" ? item.learning || "已標記有記錄，文字未提供" : "尚未記錄"}</p>
        {item.learning_role === "reusable_framework" ? <Chip tone="ok">來源明確分類：可重用框架</Chip> : null}
        {data.history.source_text ? <div className="min-w-0"><p className="mb-1 text-caption font-medium text-ink-3">來源原文片段</p><ReadingText text={data.history.source_text} /></div> : <p className="text-caption text-ink-3">producer 沒有提供可展開原文；保留上方來源位置與結構化欄位。</p>}
        {item.missing.length ? <ul className="list-disc pl-4 text-caption text-warn">{item.missing.map((missing, index) => <li key={`${index}:${missing}`}>{missing}</li>)}</ul> : null}
        <p className="break-words text-caption text-ink-3">詳細資料狀態：{stateLabel(data.state)} · producer：{data.producer} · 讀取時間：{data.generated_at}</p>
      </> : <>
        <p className="text-body text-warn">這筆歷史明細目前沒有可用項目；不以空白代替成功讀取。</p>
        {data.history.conflicts?.length ? <p className="text-caption text-warn">找到 {data.history.conflicts.length} 筆互相衝突的同 ID 紀錄。</p> : null}
      </>}
      {data.limitations.map((limitation, index) => <p key={`${index}:${limitation}`} className="break-words text-caption text-warn">{limitation}</p>)}
    </div>
  )
}

function UnindexedHistoryDetail({ item }: { item: InvestmentHistoryItem }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 border-t border-line-soft pt-2">
      <p className="text-body text-warn">producer 沒有提供有效的 stable ID，無法安全讀取這筆明細；來源位置與 partial 狀態仍保留。</p>
      {item.missing.map((missing, index) => <p key={`${index}:${missing}`} className="break-words text-caption text-warn">{missing}</p>)}
    </div>
  )
}

function useHistoryDetail(item: InvestmentHistoryItem, open: boolean) {
  const detailId = historyDetailLookupId(item)
  const query = useQuery({
    queryKey: ["investment-history-source", detailId ?? `unindexed:${item.source.path}:${item.source.line ?? "unknown"}`],
    queryFn: ({ signal }) => detailId === null
      ? Promise.reject(new Error("History item has no explicit stable ID."))
      : getInvestmentHistorySource(detailId, signal),
    enabled: open && detailId !== null,
    retry: false,
  })
  return { detailId, query }
}

function HistoryItem({ item }: { item: InvestmentHistoryItem }) {
  const [open, setOpen] = useState(false)
  const { detailId, query: detail } = useHistoryDetail(item, open)
  return (
    <Card className="flex min-w-0 flex-col gap-2 p-3">
      <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-body font-medium text-ink">{item.title}</h3>
          <p className="break-words text-caption text-ink-3">{item.date ?? "日期未知"} · {sourceLocation(item)}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <Chip tone="mute">{kindLabel(item.kind)}</Chip>
          <Chip tone={item.state === "ready" ? "ok" : "warn"}>{stateLabel(item.state)}</Chip>
          <Chip tone={item.outcome_state === "recorded" ? "ok" : "warn"}>{outcomeLabel(item)}</Chip>
        </div>
      </div>
      <p className="break-words text-caption text-ink-3">learning 分類：{item.learning_role === "reusable_framework" ? "可重用框架" : item.learning_role === "historical_case" ? "歷史案例" : "未知或未提供"}</p>
      <details onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary className="cursor-pointer text-caption font-medium text-ink-3">讀取這筆 producer 明細</summary>
        <div className="min-w-0 pt-2">
          {detailId === null ? <UnindexedHistoryDetail item={item} /> : <>
            {detail.isPending ? <p className="text-body text-ink-3">讀取明細中…</p> : null}
            {detail.isError ? <p role="alert" className="text-body text-warn">這筆歷史明細目前無法讀取。</p> : null}
            {detail.data ? <HistoryDetail data={detail.data} /> : null}
          </>}
        </div>
      </details>
    </Card>
  )
}

function LearningFramework({ item }: { item: InvestmentHistoryItem }) {
  const [open, setOpen] = useState(false)
  const { detailId, query: detail } = useHistoryDetail(item, open)
  return (
    <Card className="flex min-w-0 flex-col gap-2 p-3">
      <h3 className="break-words text-body font-medium text-ink">{item.title}</h3>
      <p className="break-words text-caption text-ink-3">{sourceLocation(item)} · {item.date ?? "日期未知"}</p>
      <p className="text-caption text-ink-3">只依 producer 明確標記的 reusable_framework 分類。</p>
      <details onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary className="cursor-pointer text-caption font-medium text-ink-3">讀取來源心得</summary>
        <div className="min-w-0 pt-2">
          {detailId === null ? <UnindexedHistoryDetail item={item} /> : <>
            {detail.isPending ? <p className="text-body text-ink-3">讀取明細中…</p> : null}
            {detail.isError ? <p role="alert" className="text-body text-warn">這筆學習明細目前無法讀取。</p> : null}
            {detail.data ? <HistoryDetail data={detail.data} /> : null}
          </>}
        </div>
      </details>
    </Card>
  )
}

function ContextBlock({ context }: { context: InvestmentContext }) {
  const decisions = context.decisions ?? []
  const evidence = context.evidence ?? []
  const warnings = context.warnings ?? []
  const approved = decisions.filter((item) => item.kind === "approved")
  const rejected = decisions.filter((item) => item.kind === "rejected")
  const nextAction = typeof context.current_state?.next_action === "string" ? context.current_state.next_action : "尚未記錄"
  const lastSession = typeof context.current_state?.last_session === "string" ? context.current_state.last_session : "未知"
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
      {evidence.length ? <details><summary className="cursor-pointer text-caption font-medium text-ink-3">AI 可展開的來源證據</summary><div className="flex flex-col gap-2 pt-2">{evidence.slice(0, 3).map((item, index) => <div key={index} className="min-w-0"><p className="break-words text-caption text-ink-3">{item.source.path} · {item.source.line_start}–{item.source.line_end}</p><p className="break-words text-caption text-ink-2">{item.text}</p></div>)}</div></details> : null}
      {warnings.length ? <p className="text-caption text-warn">工作脈絡限制：{warnings.slice(0, 2).join(" ")}</p> : null}
    </Card>
  )
}

function noItemsMessage(state: InvestmentReadState) {
  if (state === "empty") return "來源已確認沒有歷史項目。"
  if (state === "partial") return "目前沒有可確認的歷史項目；來源仍有未完整讀取的部分。"
  if (state === "stale") return "目前沒有可確認的最新歷史項目；讀取結果已過期。"
  if (state === "conflict") return "目前沒有可安全呈現的歷史項目；來源有身份衝突。"
  if (state === "ready") return "來源完整，但沒有歷史項目。"
  return "目前無法確認是否有可回看的歷史項目。"
}

function noFrameworkMessage(state: InvestmentReadState, hasItems: boolean, classificationUnknown: boolean) {
  if (!hasItems && state !== "ready" && state !== "empty") return "來源狀態未確認，現在無法判定是否有可重用框架。"
  if (!hasItems) return "目前沒有歷史項目可分類。"
  if (classificationUnknown) return "來源尚未提供可確認的學習分類；此頁不從標題或項目類型推導可重用框架。"
  return "來源未標記可重用框架。"
}

export function InvestmentHistory({ data, context }: { data: InvestmentHistory; context?: InvestmentContext }) {
  const [showAll, setShowAll] = useState(false)
  const items = data.history.items
  const frameworks = reusableLearningItems(items)
  const learningClassificationUnknown = items.some((item) => !item.learning_role || item.learning_role === "unknown")
  const frameworkIds = new Set(frameworks.map((item) => item.id))
  const ordered = historyReadingOrder(items.filter((item) => !frameworkIds.has(item.id)))
  const visibleItems = showAll ? ordered : ordered.slice(0, 12)
  const hiddenCount = ordered.length - visibleItems.length
  const undatedCount = ordered.filter((item) => !item.date).length
  const frameworkEmptyMessage = noFrameworkMessage(data.state, items.length > 0, learningClassificationUnknown)
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label="復盤與學習">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2"><SectionHeading>復盤與學習</SectionHeading><Chip tone={data.state === "ready" || data.state === "empty" ? "ok" : "warn"}>{stateLabel(data.state)}</Chip></div>
        <p className="break-words text-caption text-ink-3">producer：{data.producer} · as_of：{data.as_of} · source_cutoff：{data.source_cutoff} · generated_at：{data.generated_at}</p>
        <p className="text-body text-ink-3">只呈現來源明示的理由、結果與學習分類；未知關係不補猜。</p>
      </div>
      {data.limitations.map((limitation, index) => <p key={`${index}:${limitation}`} className="break-words text-caption text-warn">資料限制：{limitation}</p>)}
      <section className="flex min-w-0 flex-col gap-2" aria-label="可重用框架">
        <div className="flex flex-wrap items-baseline gap-2"><SectionHeading>可重用框架</SectionHeading><span className="text-caption text-ink-3">{frameworks.length} 項</span></div>
        {frameworks.length ? <div className="flex min-w-0 flex-col gap-2">{frameworks.map((item, index) => <LearningFramework key={item.id ?? `unindexed:${item.source.path}:${item.source.line ?? "unknown"}:${index}`} item={item} />)}</div> : <p className="text-body text-ink-3">{frameworkEmptyMessage}</p>}
      </section>
      <details className="border-t border-line-soft pt-2">
        <summary className="cursor-pointer py-1 text-body font-medium text-ink">歷史紀錄與後續結果 · {data.history.count} 筆</summary>
        <div className="flex flex-col gap-3 pt-2">
          {ordered.length ? <>
            <p className="text-caption text-ink-3">有日期的紀錄在前；每筆保留 producer 的狀態、限制與來源位置。{undatedCount ? `其中 ${undatedCount} 筆沒有日期，列在有日期的紀錄之後。` : ""}</p>
            <p className="text-caption text-ink-3">先顯示 {visibleItems.length} / {ordered.length} 筆。</p>
            <div className="flex min-w-0 flex-col gap-2">{visibleItems.map((item, index) => <HistoryItem key={item.id ?? `unindexed:${item.source.path}:${item.source.line ?? "unknown"}:${index}`} item={item} />)}</div>
            {hiddenCount > 0 ? <Button type="button" className="self-start" onClick={() => setShowAll(true)}>顯示其餘 {hiddenCount} 筆歷史</Button> : null}
            {showAll && ordered.length > 12 ? <Button type="button" variant="link" className="self-start" onClick={() => setShowAll(false)}>收合到前 12 筆</Button> : null}
          </> : <p className="text-body text-ink-3">{noItemsMessage(data.state)}</p>}
        </div>
      </details>
      {context ? <details className="border-t border-line-soft pt-2"><summary className="cursor-pointer py-1 text-body font-medium text-ink">目前工作的唯讀脈絡</summary><div className="pt-2"><ContextBlock context={context} /></div></details> : null}
      {data.sources.length ? <p className="break-words text-caption text-ink-3">來源索引：{data.sources.join("、")}</p> : null}
    </section>
  )
}
