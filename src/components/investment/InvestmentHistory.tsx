import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, SectionHeading, SubsectionHeading } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { Button } from "@/components/ui/button"
import { ReadingText } from "./ReadingText"
import { historyChainDetailLinked, historyChainLinked, historyDetailLookupId, historyReadingOrder, reusableLearningItems } from "@/lib/investmentFormat"
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

function HistoryDetail({ data, peers }: { data: InvestmentHistoryDetail | undefined; peers: InvestmentHistoryItem[] }) {
  if (!data) return null
  const item = data.history.item
  const recordedOutcome = item?.outcome?.state === "recorded" || item?.outcome_state === "recorded"
  return (
    <div className="flex min-w-0 flex-col gap-2 border-t border-line-soft pt-2">
      {item ? <>
        <p className="text-caption text-ink-3">歷史判斷 → 後續結果 → 已記錄心得：{historyChainDetailLinked(item, peers, data.history.conflicts) ? "來源明確連結" : "關係未知或不完整"}；這不代表 owner 核可或今日建議。</p>
        <p className="break-words text-caption text-ink-3">歷史 decision ID：{item.decision_id ?? "未提供"}</p>
        {item.decision_source ? <p className="break-words text-caption text-ink-3">判斷出處：{sourceRefLocation(item.decision_source)}</p> : null}
        {item.learning_source ? <p className="break-words text-caption text-ink-3">心得出處：{sourceRefLocation(item.learning_source)}</p> : null}
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

function HistoryItem({ item, peers }: { item: InvestmentHistoryItem; peers: InvestmentHistoryItem[] }) {
  const [open, setOpen] = useState(false)
  const { detailId, query: detail } = useHistoryDetail(item, open)
  return (
    <Card density="compact" className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <SubsectionHeading className="break-words">{item.title}</SubsectionHeading>
          <p className="break-words metadata">{item.date ?? "日期未知"} · {sourceLocation(item)}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <Chip tone="mute">{kindLabel(item.kind)}</Chip>
          <Chip tone={item.state === "ready" ? "ok" : "warn"}>{stateLabel(item.state)}</Chip>
          <Chip tone={item.outcome_state === "recorded" ? "ok" : "warn"}>{outcomeLabel(item)}</Chip>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-2 text-body text-ink-2" aria-label="記錄的決策結果與學習">
        <p>當時決策／理由：{item.reason || "索引未提供；可展開明細"}</p>
        <p>後續結果：{item.outcome?.state === "recorded" ? item.outcome.text || "已記錄，文字未提供" : item.outcome_state === "recorded" ? "已記錄，可展開明細" : "未知"}</p>
        <p>已記錄心得：{item.learning_state === "recorded" ? item.learning || "已記錄，可展開明細" : "尚未記錄"}</p>
      </div>
      <p className="break-words text-caption text-ink-3">learning 分類：{item.learning_role === "reusable_framework" ? "可重用框架" : item.learning_role === "historical_case" ? "歷史案例" : "未知或未提供"}</p>
      <details onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary className="cursor-pointer text-caption font-medium text-ink-3">讀取這筆 producer 明細</summary>
        <div className="min-w-0 pt-2">
          {detailId === null ? <UnindexedHistoryDetail item={item} /> : <>
            {detail.isPending ? <p className="text-body text-ink-3">讀取明細中…</p> : null}
            {detail.isError ? <p role="alert" className="text-body text-warn">這筆歷史明細目前無法讀取。</p> : null}
            {detail.data ? <HistoryDetail data={detail.data} peers={peers} /> : null}
          </>}
        </div>
      </details>
    </Card>
  )
}

function LearningFramework({ item, peers }: { item: InvestmentHistoryItem; peers: InvestmentHistoryItem[] }) {
  const [open, setOpen] = useState(false)
  const { detailId, query: detail } = useHistoryDetail(item, open)
  return (
    <Card density="compact" className="flex min-w-0 flex-col gap-2">
      <SubsectionHeading className="break-words">{item.title}</SubsectionHeading>
      <p className="break-words text-caption text-ink-3">{sourceLocation(item)} · {item.date ?? "日期未知"}</p>
      <p className="text-caption text-ink-3">只依 producer 明確標記的 reusable_framework 分類。</p>
      <details onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary className="cursor-pointer text-caption font-medium text-ink-3">讀取來源心得</summary>
        <div className="min-w-0 pt-2">
          {detailId === null ? <UnindexedHistoryDetail item={item} /> : <>
            {detail.isPending ? <p className="text-body text-ink-3">讀取明細中…</p> : null}
            {detail.isError ? <p role="alert" className="text-body text-warn">這筆學習明細目前無法讀取。</p> : null}
            {detail.data ? <HistoryDetail data={detail.data} peers={peers} /> : null}
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
    <Card density="compact" className="flex min-w-0 flex-col gap-3">
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
  const linked = items.filter(item => historyChainLinked(item, items))
  const frameworks = reusableLearningItems(items).filter(item => !linked.includes(item))
  const learningClassificationUnknown = items.some((item) => !item.learning_role || item.learning_role === "unknown")
  const frameworkIds = new Set(frameworks.map((item) => item.id))
  const researchRecords = items.filter(item => item.kind === "research_checkpoint" && !linked.includes(item) && !frameworkIds.has(item.id))
  const ordered = historyReadingOrder(items.filter((item) => !frameworkIds.has(item.id) && !linked.includes(item) && !researchRecords.includes(item)))
  const visibleItems = showAll ? ordered : ordered.slice(0, 12)
  const hiddenCount = ordered.length - visibleItems.length
  const undatedCount = ordered.filter((item) => !item.date).length
  const frameworkEmptyMessage = linked.length ? "來源明確分類的框架已顯示在上方完整案例。" : noFrameworkMessage(data.state, items.length > 0, learningClassificationUnknown)
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label="復盤與學習">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2"><SectionHeading>復盤與學習</SectionHeading><Chip tone={data.state === "ready" || data.state === "empty" ? "ok" : "warn"}>{stateLabel(data.state)}</Chip></div>
        <p className="break-words metadata">producer：{data.producer} · as_of：{data.as_of} · source_cutoff：{data.source_cutoff} · generated_at：{data.generated_at}</p>
        <p className="text-body text-ink-3">用已記錄的決策 → 後續結果 → 心得理解交易與決策過程。公司研究檢查點另列；來源未提供今年反覆模式，不由紀錄數量推算。</p>
      </div>
      {data.limitations.map((limitation, index) => <p key={`${index}:${limitation}`} className="break-words text-caption text-warn">資料限制：{limitation}</p>)}
      <section className="flex min-w-0 flex-col gap-2" aria-label="已連結的歷史判斷">
        <SectionHeading>當時判斷 → 後續結果 → 已記錄心得</SectionHeading>
        <p className="text-caption text-ink-3">只顯示來源明確連結的歷史案例；不代表 owner 核可或今日建議。整體資料完整度仍以上方狀態為準。</p>
        {linked.length ? linked.map(item => <HistoryItem key={item.id} item={item} peers={items} />) : <p className="text-body text-ink-3">尚未讀到可確認完整關係的案例。</p>}
      </section>
      <section className="flex min-w-0 flex-col gap-2" aria-label="可重用框架">
        <div className="flex flex-wrap items-baseline gap-2"><SectionHeading>可重用框架</SectionHeading><span className="text-caption text-ink-3">{frameworks.length} 項</span></div>
        {frameworks.length ? <div className="flex min-w-0 flex-col gap-2">{frameworks.map((item, index) => <LearningFramework key={item.id ?? `unindexed:${item.source.path}:${item.source.line ?? "unknown"}:${index}`} item={item} peers={items} />)}</div> : <p className="text-body text-ink-3">{frameworkEmptyMessage}</p>}
      </section>
      <details className="border-t border-line-soft pt-2">
        <summary className="cursor-pointer py-1 text-body font-medium text-ink">歷史紀錄與後續結果 · {data.history.count} 筆</summary>
        <div className="flex flex-col gap-3 pt-2">
          {ordered.length ? <>
            <p className="text-caption text-ink-3">有日期的紀錄在前；每筆保留 producer 的狀態、限制與來源位置。{undatedCount ? `其中 ${undatedCount} 筆沒有日期，列在有日期的紀錄之後。` : ""}</p>
            <p className="text-caption text-ink-3">先顯示 {visibleItems.length} / {ordered.length} 筆。</p>
            <div className="flex min-w-0 flex-col gap-2">{visibleItems.map((item, index) => <HistoryItem key={item.id ?? `unindexed:${item.source.path}:${item.source.line ?? "unknown"}:${index}`} item={item} peers={items} />)}</div>
            {hiddenCount > 0 ? <Button type="button" className="self-start" onClick={() => setShowAll(true)}>顯示其餘 {hiddenCount} 筆歷史</Button> : null}
            {showAll && ordered.length > 12 ? <Button type="button" variant="link" className="self-start" onClick={() => setShowAll(false)}>收合到前 12 筆</Button> : null}
          </> : <p className="text-body text-ink-3">{noItemsMessage(data.state)}</p>}
        </div>
      </details>
      <details className="border-t border-line-soft pt-2"><summary className="cursor-pointer py-1 text-body font-medium text-ink">公司研究檢查點 · {researchRecords.length} 筆</summary><p className="py-2 text-caption text-ink-3">這些是來源明示的 research_checkpoint，不等同交易學習；未明示分類的紀錄保留原狀。</p><div className="flex min-w-0 flex-col gap-2">{historyReadingOrder(researchRecords).map((item, index) => <HistoryItem key={item.id ?? `research:${index}`} item={item} peers={items} />)}</div></details>
      {context ? <details className="border-t border-line-soft pt-2"><summary className="cursor-pointer py-1 text-body font-medium text-ink">目前工作的唯讀脈絡</summary><div className="pt-2"><ContextBlock context={context} /></div></details> : null}
      {data.sources.length ? <p className="break-words metadata">來源索引：{data.sources.join("、")}</p> : null}
    </section>
  )
}
