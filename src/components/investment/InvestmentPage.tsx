import { useEffect, useState, type ReactNode } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { DEMO_MODE } from "@/lib/transport"
import { Button } from "@/components/ui/button"
import { Card, Field, FieldList, ReadingColumn, SectionHeading } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { PageHeader } from "@/components/ui/page-header"
import { MarketPulse } from "./MarketPulse"
import { StockMomentum } from "./StockMomentum"
import {
  actionStatusLabel, actionStatusNote, currentOpenActionItems, groupBriefRows,
  JUDGMENT_CLASS_LABEL, newsScanNote, pendingActionsCountLine, providerCompletionNote, providerDetailTitle, taipeiClock,
  sourceTimestamp, structuredBriefJudgmentReplacement, validatedBriefJudgment, todayActionKindLabel, currentTodayActionPlan, todayActionSection, todayGlobalDecisionSummary,
} from "@/lib/investmentFormat"
import { ResearchWatch, ResearchLibrary } from "./ResearchWatch"
import { ReadingText, InlineText } from "./ReadingText"
import { buildTodayStories, todayCheckpoint, todayStoryHeadline, type TodayStory } from "@/lib/investmentToday"
import { DayTimeline, TargetText } from "./DayTimeline"
import { EventNews } from "./EventNews"
import { marketObservationKey, MarketObservations, uniqueMarketObservations } from "./MarketObservations"
import { InvestmentReminderPanel, InvestmentWorkPanel } from "./InvestmentWork"
import { PendingBoard } from "./InvestmentPending"
import { InvestmentHistory } from "./InvestmentHistory"
import { InvestmentNarrativeSection, TodayCatalysts } from "./InvestmentNarrative"
import { InvestmentThesis } from "./InvestmentThesis"
import {
  BRIEF_SESSION_LABELS, getInvestment, getInvestmentWatch, getInvestmentResearch,
  getInvestmentHistory, getInvestmentContext, getInvestmentSource,
  getInvestmentActions, getInvestmentNarrative, getInvestmentRefreshStatus, postInvestmentRefresh,
  type InvestmentIntradayMarketProjection, type InvestmentIntradayRefresh, type InvestmentRefreshAction, type InvestmentRefreshStatus,
  type InvestmentActionItem, type InvestmentActions, type InvestmentBrief, type InvestmentMarketObservation, type InvestmentSource, type InvestmentTodayView,
} from "@/lib/investment"

function SourceText({ source }: { source: InvestmentSource }) {
  const [open, setOpen] = useState(false)
  const query = useQuery({ queryKey: ["investment-source", source.id, source.generated_at], queryFn: ({ signal }) => getInvestmentSource(source.id, signal), enabled: open, staleTime: 0, retry: false, refetchOnWindowFocus: false })
  return <details onToggle={e => setOpen(e.currentTarget.open)}>
    <summary className="cursor-pointer py-2 text-body font-medium">閱讀完整簡報 · {source.date ?? "日期未提供"}</summary>
    <div className="max-w-[900px] pt-3">{query.isPending ? <p className="text-body text-ink-3">載入原文中…</p> : query.isError ? <p role="alert" className="text-body text-warn">簡報原文讀取失敗，請按更新資料。</p> : query.data ? <ReadingText text={query.data.text} /> : null}</div>
  </details>
}

function TodayAnchor({ children }: { children: ReactNode }) {
  return <h2 className="text-label font-semibold tracking-wide text-ink-3">{children}</h2>
}

function durationLabel(raw: number): string {
  const seconds = Math.max(0, Math.round(raw))
  if (seconds < 60) return `${seconds} 秒`
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`
}

const INTRADAY_MARKET_LABEL = { tw: "台股", us: "美股" } as const

function intradayResultLabel(result: string | undefined): string {
  switch (result) {
    case "no_material_update": return "完成，沒有重大更新"
    case "updated": return "已更新事件"
    case "needs_deeper_analysis": return "有候選仍待深入分析"
    case "partial": return "部分來源完成"
    case "failed": return "刷新失敗"
    case "unavailable": return "來源不可用"
    default: return result || "結果未提供"
  }
}

function intradayFreshnessLabel(freshness: string | undefined): string {
  switch (freshness) {
    case "baseline": return "沿用正式簡報基準"
    case "fresh": return "截止已前移"
    case "stale": return "未前移成功截止"
    case "unknown": return "新鮮度未知"
    default: return "新鮮度未提供"
  }
}

function intradayMarketSummary(market: InvestmentIntradayMarketProjection | undefined): string {
  if (!market) return "刷新狀態未提供"
  if (!market.latest_receipt && market.state === "not_requested") return "尚未執行；沿用正式簡報基準"
  const result = market.latest_receipt?.result ?? market.state
  return `${intradayResultLabel(result)} · ${intradayFreshnessLabel(market.freshness)}`
}

function qualifiedDuration(start: string | null | undefined, finish: string | null | undefined): string | null {
  if (!start || !finish || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(start) || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(finish)) return null
  const startAt = Date.parse(start)
  const finishAt = Date.parse(finish)
  return Number.isFinite(startAt) && Number.isFinite(finishAt) && finishAt >= startAt
    ? durationLabel((finishAt - startAt) / 1000) : null
}

function intradayMarketDegraded(market: InvestmentIntradayMarketProjection | undefined): boolean {
  if (!market) return true
  const result = market.latest_receipt?.result ?? market.state
  return market.freshness === "stale" || market.freshness === "unknown"
    || ["partial", "failed", "unavailable"].includes(result)
    || ["partial", "failed"].includes(market.latest_receipt?.coverage_state ?? "")
}

function TodayIntradayReceipts({ refresh, readFailed }: { refresh?: InvestmentIntradayRefresh; readFailed: boolean }) {
  if (!refresh) return <section aria-label="台美盤中刷新回執" className="flex min-w-0 flex-col gap-2 border-y border-line-soft py-2">
    <p role="status" className="text-caption text-warn">{readFailed
      ? "本次簡報重讀失敗；上次成功讀取的 Today 沒有台美分市場增量回執，無法確認目前狀態、cutoff 或費用金額。"
      : "Today 讀回未提供台美分市場增量回執；各自 cutoff、執行狀態與費用金額目前無法確認。"}</p>
  </section>
  const markets = (["tw", "us"] as const).map(key => [key, refresh.markets[key]] as const)
  const degraded = markets.some(([, value]) => intradayMarketDegraded(value))
  return <section aria-label="台美盤中刷新回執" className="flex min-w-0 flex-col gap-2 border-y border-line-soft py-2">
    <p role="status" className={`text-caption ${degraded || readFailed ? "text-warn" : "text-ink-3"}`}>
      {readFailed ? "本次簡報重讀失敗；以下保留上次成功讀到的回執，不代表目前狀態。 " : ""}
      {markets.map(([key, value]) => `${INTRADAY_MARKET_LABEL[key]}：${intradayMarketSummary(value)}`).join(" · ")}
    </p>
    <details className="text-caption text-ink-3">
      <summary className="cursor-pointer py-1">盤中截止、執行時間與來源回執</summary>
      <div className="mt-2 flex min-w-0 flex-col gap-3">
        {markets.map(([key, market]) => {
          const receipt = market?.latest_receipt
          const start = receipt?.started_at
          const finish = receipt?.finished_at
          const elapsed = qualifiedDuration(start, finish)
          const callCount = receipt?.calls
          return <div key={key} className="flex min-w-0 flex-col gap-1 border-l-2 border-line-soft pl-3">
            <p className="font-medium text-ink-2">{INTRADAY_MARKET_LABEL[key]} · {intradayMarketSummary(market)}</p>
            {market ? <>
              <p>正式基準 cutoff：{sourceTimestamp(market.baseline_cutoff)}</p>
              {receipt?.baseline_cutoff_at ? <p>本次回執採用的基準 cutoff：{sourceTimestamp(receipt.baseline_cutoff_at)}</p> : null}
              <p>本次輸入 cutoff：{sourceTimestamp(market.input_cutoff)}</p>
              {receipt?.source_cutoff ? <p>本次搜尋 cutoff：{sourceTimestamp(receipt.source_cutoff)}</p> : null}
              {receipt ? <p>本次輸出 cutoff：{sourceTimestamp(receipt.output_cutoff)}</p> : null}
              <p>最近成功 cutoff：{sourceTimestamp(market.last_successful_cutoff)}</p>
            </> : <p>此市場的回執資料未提供。</p>}
            {start || finish ? <p>開始：{sourceTimestamp(start)} · 結束：{sourceTimestamp(finish)}{elapsed ? ` · 耗時 ${elapsed}` : ""}</p> : null}
            {receipt ? <>
              <p>結果：{intradayResultLabel(receipt.result)} · 覆蓋：{receipt.coverage_state ?? "未提供"} · 停止階段：{receipt.stop_stage ?? "未提供"}</p>
              <p>探索查詢：{callCount?.discovery ?? "未提供"} · 候選：{receipt.candidate_count ?? "未提供"} · 來源查證：{callCount?.verification ?? "未提供"}</p>
              {receipt.discovery_scope?.length ? <p>搜尋範圍：{receipt.discovery_scope.join("、")}</p> : null}
              {receipt.source_categories?.length ? <p>來源類別：{receipt.source_categories.join("、")}</p> : null}
              <p>回執列出的 story ID：{receipt.updated_story_ids?.length ?? "未提供"} · 市場讀數：{receipt.market_observations?.length ?? "未提供"}</p>
              {receipt.updated_story_ids?.length ? <details className="text-caption text-ink-3"><summary className="cursor-pointer py-1">回執列出的 story ID · {receipt.updated_story_ids.length}</summary><ul className="flex min-w-0 flex-col gap-1 pt-1">{receipt.updated_story_ids.map((storyId, index) => <li key={`${storyId}:${index}`} className="break-all">{storyId}</li>)}</ul></details> : null}
              {receipt.story_statuses?.length ? <details className="text-caption text-ink-3"><summary className="cursor-pointer py-1">逐筆事件結果 · {receipt.story_statuses.length}</summary><ul className="flex min-w-0 flex-col gap-2 pt-1">{receipt.story_statuses.map((item, index) => <li key={`${item.story_id}:${index}`} className="flex min-w-0 flex-col gap-1 break-words border-l-2 border-line-soft pl-2"><p className="break-all">{item.story_id} · {item.status} · {item.outcome}</p>{item.summary ? <p><InlineText text={item.summary} /></p> : null}{item.source_cutoff ? <p>來源截止：{sourceTimestamp(item.source_cutoff)}</p> : null}</li>)}</ul></details> : null}
              {receipt.baseline_path ? <p className="break-all">基準來源：{receipt.baseline_path}</p> : null}
              {receipt.baseline_artifact_sha256 ? <p className="break-all">基準修訂：{receipt.baseline_artifact_sha256}</p> : null}
              {receipt.limitations?.map((limitation, index) => <p key={`receipt-${index}`} className="text-warn">{limitation}</p>)}
            </> : null}
            {market?.limitations.map((limitation, index) => <p key={`market-${index}`} className="text-warn">{limitation}</p>)}
            <p>費用金額未由來源回報；耗時與查詢次數不換算金額。</p>
          </div>
        })}
        {refresh.limitations.map((limitation, index) => <p key={`refresh-${index}`} className="text-warn">{limitation}</p>)}
      </div>
    </details>
  </section>
}

function refreshStateLabel(action: InvestmentRefreshAction, status: InvestmentRefreshStatus | undefined): string {
  const marketName = status?.market_scope === "tw" ? "台股" : status?.market_scope === "us" ? "美股" : null
  const scanName = status?.scan_mode === "quick" ? "快掃" : status?.scan_mode === "deep" ? "深度掃描" : "掃描"
  const name = action === "market" ? "盤面" : `${marketName ? `${marketName}消息` : "最新消息"}${scanName}`
  if (!status || status.state === "idle") return `${name}尚未更新`
  if (status.state === "running") {
    const started = status.started_at ? Date.parse(status.started_at) : Number.NaN
    const elapsed = Number.isFinite(started) ? Math.max(0, Math.floor((Date.now() - started) / 1000)) : null
    return `${name}進行中${elapsed === null ? "…" : ` · 已進行 ${durationLabel(elapsed)}`}`
  }
  const providerNote = action === "news" ? providerCompletionNote(status) : null
  const route = providerNote ? ` · ${providerNote}` : ""
  const duration = action === "news" && typeof status.duration_seconds === "number" && Number.isFinite(status.duration_seconds)
    ? ` · 總耗時 ${durationLabel(status.duration_seconds)}`
    : ""
  if (status.state === "failed") return `${name}更新失敗：${status.message}${duration}${route}`
  if (action === "news" && status.state === "no-change") return `${name}於 ${sourceTimestamp(status.last_updated)} 完成，無影響當前判斷的新消息${duration}${route}`
  return `${name}完成於 ${sourceTimestamp(status.last_updated)}${status.message ? ` · ${status.message}` : ""}${duration}${route}`
}

function statusTone(status: InvestmentActionItem["status"]): "warn" | "info" | "ok" {
  if (status === "open") return "warn"
  if (status === "closed") return "ok"
  return "info"
}

function ContinuationRow({ item, showDate }: { item: InvestmentActionItem; showDate: boolean }) {
  const note = actionStatusNote(item.status)
  return <li className="flex min-w-0 flex-col gap-1">
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <p className="min-w-0 text-body leading-relaxed text-ink-2"><InlineText text={item.text} /></p>
      <Chip tone={statusTone(item.status)}>{actionStatusLabel(item.status)}</Chip>
    </div>
    {note ? <p className="text-caption text-ink-3">{note}</p> : null}
    {showDate ? <p className="text-caption text-ink-3">{item.date || "日期未提供"}</p> : null}
    <details>
      <summary className="cursor-pointer py-1 text-caption text-ink-3">編號與來源</summary>
      <div className="flex flex-col gap-1 pt-1 text-caption text-ink-3">
        <p>編號：{item.id}</p>
        {!showDate && item.date ? <p>日期：{item.date}</p> : null}
        {item.tickers.length ? <p>相關標的：{item.tickers.join("、")}</p> : null}
        {item.evidence.length ? <p>證據：{item.evidence.join("、")}</p> : null}
        <p>來源：{item.source}</p>
      </div>
    </details>
  </li>
}

/** Investment Note's own unfinished actions inside 待處理: one count line, the
 * existing rows folded into a single collapsed list. A failed or unavailable
 * read keeps its warning and shows no count, so it never reads as zero. */
export function InvestmentNoteActions({ data, isPending, isError, splitStatuses = false }: { data: InvestmentActions | undefined; isPending: boolean; isError: boolean; splitStatuses?: boolean }) {
  // One flag for both the rows and the count: a failed read or an
  // unavailable payload shows neither, whatever items it still carries.
  const unreadable = isError || data?.state === "unavailable"
  const items = currentOpenActionItems(data?.items ?? [], unreadable)
  const countLine = pendingActionsCountLine(data, unreadable)
  return <div role="group" className="flex min-w-0 flex-col gap-2 border-t border-line-soft pt-3" aria-label="Investment Note 未結案的行動">
    {isError ? <p role="status" className="text-caption text-warn">待續行動這次讀不到；不把上次內容當成目前待續工作。本機筆記仍可使用。</p> : null}
    {data?.state === "unavailable" ? <p role="status" className="text-caption text-warn">{data.message || "待續行動目前無法取得。"}</p> : null}
    {isPending && !data ? <p role="status" className="text-caption text-ink-3">正在讀取 Investment Note 的行動…</p> : null}
    {countLine ? <p className="text-body leading-relaxed text-ink-2">{countLine.split(/(\d{4}-\d{2}-\d{2})/).map((part, index) => index % 2 ? <span key={index} className="whitespace-nowrap">{part}</span> : part)}</p> : null}
    {countLine && data?.state === "partial" && data.limitations.length ? <p className="text-caption text-ink-3">{data.limitations.join("；")}</p> : null}
    {splitStatuses ? (["open", "has-canonical-home"] as const).map(status => {
      const group = items.filter(item => item.status === status)
      return group.length ? <details key={status}>
        <summary className="cursor-pointer py-2 text-body font-medium">來源 status：{status === "open" ? "尚未結案" : "已有判斷頁可承接"} · {group.length} 項</summary>
        <ul className="flex min-w-0 flex-col gap-2 pt-2">{group.map(item => <ContinuationRow key={item.id} item={item} showDate />)}</ul>
      </details> : null
    }) : items.length ? <details>
      <summary className="cursor-pointer py-1 text-caption text-ink-3">展開 {items.length} 筆行動</summary>
      <ul className="flex min-w-0 flex-col gap-2 pt-2">{items.map(item => <ContinuationRow key={item.id} item={item} showDate />)}</ul>
    </details> : null}
  </div>
}

function StoryCard({ story, b }: { story: TodayStory; b: InvestmentBrief }) {
  const latest = story.updates[0]
  const heading = todayStoryHeadline(story)
  const impact = latest?.portfolio_impact.trim() || ""
  const watch = latest?.action.trim() || ""
  const hasHistory = story.updates.length > 0 || Boolean(story.story_id) || story.events.length > 1
  const changes = groupBriefRows(b.thesis_changes, b.events.length)
  const risks = groupBriefRows(b.risks, b.events.length)
  return <article className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
      <h3 className="min-w-0 text-body font-semibold leading-relaxed text-ink"><InlineText text={heading} /></h3>
      {latest ? <span className="shrink-0 text-caption text-ink-3">更新於 {sourceTimestamp(latest.observed_at)}</span> : null}
    </div>
    {latest && !latest.summary.trim() ? <p role="status" className="text-caption text-warn">最新盤中摘要未提供；以下保留簡報基線與其他來源。</p> : null}
    {story.events.map(({ event, event_index }, index) => <div key={event_index} className="flex min-w-0 flex-col gap-2">
      <p className="text-caption font-medium text-ink-3">{index === 0 ? "正式簡報基線" : "同故事中的另一份正式簡報"}</p>
      {event.event.trim() !== heading.trim() ? <p className="text-body font-medium leading-relaxed text-ink"><InlineText text={event.event} /></p> : null}
      {event.market_reaction ? <p className="text-body leading-relaxed text-ink-2"><span className="font-medium text-ink">簡報市場反應：</span><InlineText text={event.market_reaction} /></p> : null}
      {event.interpretation ? <p className="text-body leading-relaxed text-ink-2"><span className="font-medium text-ink">簡報市場解讀：</span><InlineText text={event.interpretation} /></p> : null}
      {event.impact && event.impact.trim() !== latest?.portfolio_impact.trim() ? <p className="text-body leading-relaxed text-ink-2"><span className="font-medium text-ink">簡報基線的持倉影響：</span><InlineText text={event.impact} /></p> : null}
      {event.today && event.today.trim() !== latest?.action.trim() ? <p className="text-body leading-relaxed text-ink-2"><span className="font-medium text-ink">簡報基線提醒：</span><InlineText text={event.today} /></p> : null}
      {changes.byEvent[event_index].length || risks.byEvent[event_index].length ? <div className="flex min-w-0 flex-col gap-2 border-t border-line-soft pt-2">
        <p className="text-caption font-medium text-ink-3">這則事件的判斷與風險</p>
        {changes.byEvent[event_index].length ? <ul className="flex list-disc flex-col gap-1 pl-5 text-body leading-relaxed text-ink-2">{changes.byEvent[event_index].map((row, rowIndex) => <li key={`thesis-${rowIndex}`}><span className="font-medium text-ink">{row.thesis}</span>{row.change ? <> · {row.change}</> : null}{row.reason ? <p className="text-caption text-ink-3">依據：{row.reason}</p> : null}</li>)}</ul> : null}
        {risks.byEvent[event_index].length ? <ul className="flex list-disc flex-col gap-1 pl-5 text-body leading-relaxed text-ink-2">{risks.byEvent[event_index].map((row, rowIndex) => <li key={`risk-${rowIndex}`}><span className="text-warn">{row.risk}</span>{row.status ? <p className="text-caption text-ink-3">{row.status}</p> : null}</li>)}</ul> : null}
      </div> : null}
    </div>)}
    {impact ? <p className="text-body leading-relaxed text-ink-2"><span className="font-medium text-ink">對判斷的影響：</span><InlineText text={impact} /></p> : null}
    {watch ? <p className="text-body leading-relaxed text-ink-2"><span className="font-medium text-ink">現在要注意：</span><InlineText text={watch} /></p> : null}
    {hasHistory ? <details className="border-t border-line-soft pt-2 text-caption text-ink-3">
      <summary className="cursor-pointer py-1">來源歷史與事件身分</summary>
      {story.story_id ? <p className="pt-1">story_id：{story.story_id}</p> : null}
      {story.updates.length ? <ul className="flex flex-col gap-2 pt-1">{story.updates.map((update, index) => <li key={update.id}>
        <p>{index === 0 ? "最新盤中觀察" : "較早盤中觀察"} · {sourceTimestamp(update.observed_at)}</p>
        <p className="mt-1">來源 ID：{update.id} · 路徑：{update.source_path}</p>
        <p className="mt-1">摘要：{update.summary.trim() || "最新摘要未提供"}</p>
        {update.portfolio_impact ? <p className="mt-1">對判斷的影響：{update.portfolio_impact}</p> : null}
        {update.action ? <p className="mt-1">現在要注意：{update.action}</p> : null}
      </li>)}</ul> : null}
    </details> : null}
  </article>
}

/** Keep producer-authored thesis/risk meaning in the action reading path. */
function ThesisAttention({ b, onOpenThesis, presentation, timelineStoryIds }: {
  b: InvestmentBrief
  onOpenThesis: () => void
  presentation: "timeline" | "stories" | "none"
  timelineStoryIds: ReadonlySet<string>
}) {
  const changes = groupBriefRows(b.thesis_changes.filter(row => row.thesis.trim() || row.change.trim()), b.events.length)
  const risks = groupBriefRows(b.risks.filter(row => row.risk.trim()), b.events.length)
  const keepSeparate = <T extends { event_index: number | null }>(rows: T[][], unlinked: T[]) => [
    ...unlinked,
    ...rows.flatMap((items, eventIndex) => {
      const storyId = b.events[eventIndex]?.story_id?.trim()
      if (presentation === "stories") return []
      if (presentation === "timeline" && storyId && timelineStoryIds.has(storyId)) return []
      return items
    }),
  ]
  const separateChanges = keepSeparate(changes.byEvent, changes.unlinked)
  const separateRisks = keepSeparate(risks.byEvent, risks.unlinked)
  const notes = b.risk_notes.filter(note => note.trim())
  const thesisNotes = b.thesis_notes.filter(note => note.trim())
  if (!separateChanges.length && !separateRisks.length && !notes.length && !thesisNotes.length) return null
  const renderChange = (row: InvestmentBrief["thesis_changes"][number], index: number) => <li key={`thesis-${index}`}>
    <span className="font-medium text-ink"><InlineText text={row.thesis} /></span>{row.change ? <> · <InlineText text={row.change} /></> : null}
    {row.reason ? <p className="text-caption text-ink-3">依據：<InlineText text={row.reason} /></p> : null}
  </li>
  const renderRisk = (row: InvestmentBrief["risks"][number], index: number) => <li key={`risk-${index}`}>
    <span className="text-warn"><InlineText text={row.risk} /></span>{row.status ? <p className="text-caption text-ink-3"><InlineText text={row.status} /></p> : null}
  </li>
  return <details className="border-t border-line-soft pt-2 text-caption text-ink-3">
    <summary className="cursor-pointer py-1">未連結簡報論點與風險</summary>
    <div className="flex min-w-0 flex-col gap-2 pt-2">
    {b.state === "stale" ? <p>沿用較早簡報的未連結內容。</p> : null}
    {separateChanges.length || separateRisks.length ? <div className="border-l-2 border-line-soft pl-3">
      <p className="text-caption font-medium text-ink-2">未連結或無法跨投影核對的簡報論點與風險</p>
      {(separateChanges.some(row => row.event_index !== null) || separateRisks.some(row => row.event_index !== null)) ? <p className="text-caption text-ink-3">部分項目在簡報內有事件索引，但時間軸沒有可核對的相同 story_id；保留在這裡，不依文字或日期配對。</p> : null}
      <ul className="flex list-disc flex-col gap-2 pl-5 text-body leading-relaxed text-ink-2">
        {separateChanges.map(renderChange)}{separateRisks.map(renderRisk)}
      </ul>
    </div> : null}
    {notes.length ? <div className="border-l-2 border-warn pl-3">
      <p className="text-caption font-medium text-ink-2">跨日風險註記</p>
      <ul className="list-disc pl-5 text-body leading-relaxed text-ink-2">{notes.map((note, index) => <li key={`note-${index}`}><InlineText text={note} /></li>)}</ul>
    </div> : null}
    {thesisNotes.length ? <div className="border-l-2 border-line-soft pl-3">
      <p className="text-caption font-medium text-ink-2">其他論點補充</p>
      <ul className="list-disc pl-5 text-body leading-relaxed text-ink-2">{thesisNotes.map((note, index) => <li key={`thesis-note-${index}`}><InlineText text={note} /></li>)}</ul>
    </div> : null}
    <Button variant="link" className="self-start" onClick={onOpenThesis}>看完整論點與來源</Button>
    </div>
  </details>
}

export function TodayNextSteps({ b, today, readFailed = false }: { b: InvestmentBrief; today?: InvestmentTodayView; readFailed?: boolean }) {
  // Only a current, contract-consistent judgment may replace the source row.
  // On read failure, keep the cached source snapshot visible without deriving
  // a new judgment from it.
  const replacement = !readFailed && b.state === "current" ? structuredBriefJudgmentReplacement(b) : null
  const judgment = replacement?.judgment ?? (!readFailed && b.state === "current" ? validatedBriefJudgment(b) : null)
  const previousJudgment = readFailed && typeof b.judgment?.judgment === "string" && b.judgment.judgment.trim()
    ? b.judgment.judgment.trim()
    : null
  const cachedSteps = readFailed
    ? currentTodayActionPlan(b, today, false)
    : currentTodayActionPlan(b, today)
  // A failed refresh does not replace the last successful snapshot. Keep its
  // rows visible with the warning below so a transport error cannot look like
  // an empty action list.
  const steps = cachedSteps
  const catalystQuery = useQuery({
    queryKey: ["investment-narrative"],
    queryFn: ({ signal }) => getInvestmentNarrative(signal),
    enabled: !readFailed && b.state === "current" && b.upcoming.length === 0,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  })
  // With a source judgment, its own row takes the primary slot. Only an
  // exact, unique producer-linked action ID is removed from `steps`; missing
  // or ambiguous relationships keep the source action visible below.
  const primary = judgment ? undefined : steps[0]
  const secondary = judgment ? steps.slice(0, 2) : steps.slice(1, 3)
  const remaining = judgment ? steps.slice(2) : steps.slice(3)
  const decisionSummary = readFailed || b.state === "stale" ? "" : today?.decision_summary?.trim() || ""
  const globalDecisionSummary = todayGlobalDecisionSummary(decisionSummary, steps)
  const actionSection = todayActionSection(b)
  const checkpoint = !readFailed && b.state === "current" ? todayCheckpoint(b, catalystQuery.data?.catalysts_30d) : null
  // Detail-only content: never rendered on the card's main level (see below).
  const checkpointNote = checkpoint
    ? <p><span className="font-medium text-ink-2">{checkpoint.source === "brief" ? "簡報另列檢查點（與上方行動的關係未標明）" : checkpoint.relationship === "unlinked" ? "下一個來源事件（尚未連到上方行動）" : "來源未提供與上方行動的關係"}：</span> {checkpoint.date} · <InlineText text={checkpoint.text} />{checkpoint.check ? <>；檢查 <InlineText text={checkpoint.check} /></> : checkpoint.source === "brief" ? "；檢查條件未提供。" : null}{checkpoint.sourceLocation ? <span> · 來源：{checkpoint.sourceLocation}</span> : null}</p>
    : catalystQuery.isPending && b.state === "current"
      ? <p>簡報未另列檢查點；正在讀取 30 天來源事件。</p>
      : catalystQuery.isError && b.state === "current"
        ? <p>簡報未另列檢查點，且 30 天事件讀取失敗；下一檢查點未知。</p>
        : <p>下一個明確檢查點未知；來源沒有提供可確認的日期、事件或 checkpoint。</p>
  const status = (value: InvestmentActionItem["status"] | null) => value ? actionStatusLabel(value) : "狀態未提供"
  // Headline (chips + text); a labelled reason field only when one exists --
  // never a placeholder for a missing one. Source/id detail moved below.
  const row = (item: (typeof steps)[number], isPrimary = false) => <li key={item.key} className={`flex min-w-0 flex-col gap-3 border-l-2 pl-3 ${isPrimary ? "border-accent" : "border-line-soft"}`}>
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Chip tone={isPrimary ? "info" : "mute"}>{todayActionKindLabel(item.kind, item.origin, readFailed || b.state === "stale")}</Chip>
      <Chip tone={item.status ? statusTone(item.status) : "mute"}>{status(item.status)}</Chip>
      <p className="min-w-0 text-body font-medium leading-relaxed text-ink"><TargetText text={item.text} /></p>
    </div>
    {item.reason?.trim() ? <FieldList><Field label="為什麼現在"><InlineText text={item.reason.trim()} /></Field></FieldList> : null}
  </li>
  const sourceNotes = (readFailed ? cachedSteps : steps).filter(item => item.date || item.source || item.id || item.sameTextRecords?.length)
  return <section className="flex min-w-0 flex-col gap-3" aria-label={actionSection.heading}>
    <SectionHeading>{actionSection.heading}</SectionHeading>
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="flex min-w-0 flex-col gap-3">
      {actionSection.context ? <p role="status" className="text-caption text-warn">{actionSection.context}</p> : b.state === "missing" ? <p role="status" className="text-caption text-warn">尚未取得正式簡報；不將舊快取或殘留欄位當作今天已確認的工作。</p> : b.state === "invalid" ? <p role="status" className="text-caption text-warn">正式簡報無法完整辨識；其中的行動不列為今天已確認的工作。</p> : null}
      {today?.state === "partial" || today?.state === "unavailable" ? <p role="status" className="text-caption text-warn">今日更新狀態為 {today.state}；空白欄位不能確認沒有新行動。</p> : null}
      {globalDecisionSummary ? <FieldList><Field label="整體判斷" tone="strong"><TargetText text={globalDecisionSummary} /></Field></FieldList> : null}
      {readFailed ? <p role="status" className="text-body text-warn">本次簡報讀取失敗；以下保留上次成功讀到的簡報與行動，是否已有新版本尚未確認。</p> : null}
      {judgment ? <div role="group" aria-label="主要下一步" className="flex min-w-0 flex-col gap-3 border-l-2 border-accent pl-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Chip tone="info">{JUDGMENT_CLASS_LABEL[judgment.class]}</Chip>
            <p className="min-w-0 text-body font-medium leading-relaxed text-ink"><InlineText text={judgment.judgment} /></p>
          </div>
          <FieldList>
            <Field label="為什麼現在"><InlineText text={judgment.why_now} /></Field>
            {judgment.revisit ? <Field label="何時回看"><InlineText text={judgment.revisit} /></Field> : null}
            {judgment.decision_effect ? <Field label="什麼會改變判斷"><InlineText text={judgment.decision_effect} /></Field> : null}
          </FieldList>
        </div>
        : primary ? <ol className="flex min-w-0 flex-col gap-3" aria-label="主要下一步">{row(primary, true)}</ol>
        : decisionSummary ? <p className="text-body leading-relaxed text-ink-2">{b.state === "stale" ? "今天的判斷尚未取得。" : checkpoint ? "來源未列出獨立行動；行動狀態未明示，下一個已知檢查點如下。" : "來源未列出獨立行動；行動狀態與下一檢查點未明示。"}</p>
        : b.state === "current" ? <p className="text-body text-ink-3">{checkpoint ? "沒有可確認的下一步；來源未明示「今天不用動」，已知檢查點保留在來源明細。" : "沒有可確認的下一步；來源沒有明示「今天不用動」或下一檢查點。"}</p>
        : <p role="status" className="text-body text-warn">目前沒有可確認的下一步；資料缺失不代表今天不用動。</p>}
      {secondary.length ? <ol className="flex min-w-0 flex-col gap-3" aria-label="其他行動">{secondary.map(item => row(item))}</ol> : null}
      {remaining.length ? <details className="border-t border-line-soft pt-2 text-caption text-ink-3"><summary className="cursor-pointer py-1">來源另列 {remaining.length} 項</summary><ol className="mt-3 flex min-w-0 flex-col gap-3">{remaining.map(item => row(item))}</ol></details> : null}
      <details className="border-t border-line-soft pt-2 text-caption text-ink-3">
        <summary className="cursor-pointer py-1">檢查點與來源</summary>
        <div className="mt-2 flex min-w-0 flex-col gap-3">
          <div>{checkpointNote}</div>
          {previousJudgment ? <p>上次讀取的判斷（目前未確認）：<InlineText text={previousJudgment} /></p> : null}
          {b.upcoming.length ? <div className="flex min-w-0 flex-col gap-2">
            <p className="font-medium text-ink-2">近期檢查 · {b.upcoming.length}</p>
            <p>這些事件未提供與上方行動的明確關係，分開保留。</p>
            <ul className="flex min-w-0 flex-col gap-2">{b.upcoming.map((item, index) => <li key={index}><span>{item.date_label} · </span><InlineText text={item.event} />{item.check ? <p>檢查：<InlineText text={item.check} /></p> : <p>檢查條件未提供。</p>}</li>)}</ul>
          </div> : null}
          {sourceNotes.length ? <div className="flex min-w-0 flex-col gap-2">
            <p className="font-medium text-ink-2">{readFailed ? "上次成功讀取的行動（是否已有新版本尚未確認）" : "這項工作的來源"}</p>
            <ul className="flex min-w-0 flex-col gap-2">{sourceNotes.map(item => <li key={item.key} className="flex min-w-0 flex-col gap-1"><p><TargetText text={item.text} /></p>{item.date ? <p>記錄日期：{sourceTimestamp(item.date)}</p> : null}{item.source ? <p className="break-all">來源：{item.source}</p> : null}{item.id ? <p className="break-all">ID：{item.id}</p> : null}{item.sameTextRecords?.length ? <><p>另有 {item.sameTextRecords.length} 筆來源紀錄文字完全相同；僅按原文相同收合，是否為同一件事未確認。</p><ul className="flex min-w-0 flex-col gap-1">{item.sameTextRecords.map((record, recordIndex) => <li key={`${record.origin}:${record.id ?? recordIndex}`} className="break-all">{record.origin === "brief" ? "簡報" : "盤中更新"}{record.date ? ` · ${sourceTimestamp(record.date)}` : " · 日期未提供"}{record.source ? ` · ${record.source}` : ""}{record.id ? ` · ID：${record.id}` : ""}{record.reason ? <p>該來源自己的理由：<InlineText text={record.reason} /></p> : null}</li>)}</ul></> : null}</li>)}</ul>
          </div> : null}
          {judgment ? <div className="flex min-w-0 flex-col gap-1">
            <p className="font-medium text-ink-2">判斷依據</p>
            <p>簡報版次：{b.session ? BRIEF_SESSION_LABELS[b.session] ?? b.session : "版次未標示"}</p>
            {(judgment.provenance?.source_cutoff || b.source_cutoff) ? <p>判斷資料截至：{sourceTimestamp(judgment.provenance?.source_cutoff ?? b.source_cutoff)}</p> : null}
            {judgment.provenance?.validated_story_ids?.length ? <p className="break-all">已核對的事件 story_id：{judgment.provenance.validated_story_ids.join("、")}</p> : null}
            {judgment.provenance?.artifact ? <p className="break-all">來源文件：{judgment.provenance.artifact}</p> : null}
            {judgment.provenance?.source_revision ? <p className="break-all">來源修訂：{judgment.provenance.source_revision}</p> : null}
            {judgment.provenance?.declared_unverified ? <p>來源自述、尚未逐項查核：{judgment.provenance.declared_unverified}</p> : null}
          </div> : null}
        </div>
      </details>
      {b.source?.limitations.length || b.envelope?.limitations.length ? <details className="border-t border-line-soft pt-3 text-caption text-ink-3"><summary className="cursor-pointer py-1">資料完整度</summary>
        {b.envelope?.producer ? <p className="mt-2">產出方式：{b.envelope.producer}</p> : null}
        {b.envelope?.limitations.length ? <ul className="mt-2 list-disc pl-4 text-warn">{b.envelope.limitations.map((limitation, index) => <li key={`envelope-${index}`}>{limitation}</li>)}</ul> : null}
        {b.source?.limitations.length ? <ul className="mt-2 list-disc pl-4 text-warn">{b.source.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul> : null}
      </details> : null}
      </div>
    </Card>
  </section>
}

function TodayBrief({ b, today, newsStatus, onOpenThesis, readFailed }: { b: InvestmentBrief; today?: InvestmentTodayView; newsStatus?: InvestmentRefreshStatus; onOpenThesis: () => void; readFailed: boolean }) {
  const eventQuery = useQuery({ queryKey: ["investment-narrative"], queryFn: ({ signal }) => getInvestmentNarrative(signal), retry: false, refetchOnWindowFocus: false, staleTime: 60_000 })
  const news = eventQuery.isError ? null : eventQuery.data?.news_events
  const version = b.session ? BRIEF_SESSION_LABELS[b.session] : null
  const updates = today?.updates ?? []
  // The producer's own cycle line. Empty from a producer too old to send it, in
  // which case the day still renders through the per-story cards below.
  const timeline = today?.timeline ?? []
  const intradayMarketObservations = today?.intraday_refresh?.market_observations ?? []
  const intradayMarketObservationKeys = new Set(intradayMarketObservations.map(marketObservationKey))
  const timelineMarketObservationKeys = new Set(timeline.flatMap(node => node.kind === "brief"
    ? (node.market_observations ?? []).map(marketObservationKey)
    : node.information_kind === "market_observation" ? [marketObservationKey(node as InvestmentMarketObservation)] : []))
  const currentFormalMarketObservations = [
    ...(b.market_observations ?? []),
    ...(today?.market_observations ?? []),
  ].filter(row => !intradayMarketObservationKeys.has(marketObservationKey(row)))
  const standaloneNewsMarketObservations = (news?.market_observations ?? []).filter(row =>
    !intradayMarketObservationKeys.has(marketObservationKey(row))
      && !timelineMarketObservationKeys.has(marketObservationKey(row)))
  const formalMarketObservations = uniqueMarketObservations([
    ...currentFormalMarketObservations,
    ...standaloneNewsMarketObservations,
  ])
  const hiddenMarketObservationKeys = new Set([
    ...formalMarketObservations.map(marketObservationKey),
    ...intradayMarketObservations.map(marketObservationKey),
  ])
  const visibleTimeline = timeline.filter(node => !(node.kind === "update" && node.information_kind === "market_observation"
    && hiddenMarketObservationKeys.has(marketObservationKey(node as InvestmentMarketObservation))))
  const stories = buildTodayStories(b.date, b.events, updates)
  const envelopeIncomplete = b.envelope && b.envelope.completeness !== "ready"
  const headline = b.headline.trim()
  const decisionSummary = b.state === "stale" ? "" : today?.decision_summary?.trim() || ""
  const cutoffClock = taipeiClock(b.source_cutoff)
  const scanNote = newsScanNote(newsStatus, b.source_cutoff)
  return <section aria-label="今日簡報" className="flex min-w-0 flex-col gap-6 break-words">
    <TodayNextSteps b={b} today={today} readFailed={readFailed} />
    <section aria-label="今天發生了什麼" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <TodayAnchor>今天發生了什麼</TodayAnchor>
        {/* With a line, "資料截至 <baseline cutoff>" is the wrong number to put at
            the top: the baseline is only the newest formal brief, and an intraday
            update after it is more recent than its cutoff. Name the newest point
            on the line instead; each version's own cutoff sits on its own node. */}
        <span className="text-caption text-ink-3">{b.date ?? "日期未提供"}{version ? ` · ${version}` : " · 版次未標示"}{cutoffClock ? ` · 資料截至 ${cutoffClock}` : ""}{scanNote ? ` · ${scanNote}` : ""}</span>
      </div>
      {b.state === "stale" ? <p role="status" className="text-caption text-warn">目前是較早的簡報，請留意資料截止時間。</p> : null}
      {b.state === "invalid" ? <p role="status" className="text-caption text-warn">這份簡報部分內容未能辨識，已保留可讀段落與完整原文。</p> : null}
      {envelopeIncomplete ? <p role="status" className="text-caption text-warn">{b.envelope?.completeness === "partial" ? "這份簡報資料不完整；細節可在下方來源展開查看。" : "這份簡報的資料包目前無法確認是否完整。"}</p> : null}
      {news ? <EventNews projection={news} /> : null}
      {formalMarketObservations.length ? <MarketObservations title="正式簡報與事件讀回的市場讀數" observations={formalMarketObservations} /> : null}
      {intradayMarketObservations.length ? <MarketObservations title="盤中增量市場讀數" observations={intradayMarketObservations} /> : null}
      {visibleTimeline.length ? news
        ? <details className="text-caption text-ink-3"><summary className="cursor-pointer py-1">簡報版次與掃描時間軸</summary><DayTimeline nodes={visibleTimeline} brief={b} showBriefMarketObservations hiddenMarketObservationKeys={hiddenMarketObservationKeys} /></details>
        // One line for the whole cycle. The headline is not repeated above it:
        // it is the newest brief's own first line and already sits on that node,
        // and printing it separately is what made 今日基線 read as contradicting
        // the card underneath whenever an intraday update had moved on.
        : <DayTimeline nodes={timeline} brief={b} hiddenMarketObservationKeys={hiddenMarketObservationKeys} />
        : !news && stories.length ? <Card className="min-w-0 divide-y divide-line-soft overflow-hidden">
        {headline && headline !== decisionSummary ? <p className="p-4 text-body leading-relaxed text-ink-2 sm:p-5"><span className="font-medium text-ink">今日基線：</span><ReadingText text={headline} /></p> : null}
        {stories.map(story => <StoryCard key={story.key} story={story} b={b} />)}
      </Card> : !news && headline ? <Card className="min-w-0 p-4 sm:p-5"><span className="font-medium text-ink">今日基線：</span><ReadingText text={headline} /></Card> : !news && !formalMarketObservations.length && !intradayMarketObservations.length ? <p className="text-body text-ink-3">尚未取得可讀的今日變化。</p> : null}
      {b.event_notes.length ? <ReadingText text={b.event_notes.join("\n\n")} /> : null}
      <ThesisAttention
        b={b}
        onOpenThesis={onOpenThesis}
        presentation={timeline.length ? "timeline" : stories.length ? "stories" : "none"}
        timelineStoryIds={new Set(timeline.flatMap(node => node.kind === "brief" ? node.events.flatMap(event => event.story_id?.trim() ? [event.story_id.trim()] : []) : []))}
      />
    </section>

    {b.source ? <div className="border-t border-line-soft"><SourceText key={b.source.id} source={b.source} /></div> : null}
  </section>
}

const VIEWS = [["today", "Today"], ["thesis", "我的判斷"], ["work", "研究與策略"], ["history", "復盤與學習"]] as const
type View = typeof VIEWS[number][0]

export function InvestmentPage() {
  const [view, setView] = useState<View>("today")
  const [refreshError, setRefreshError] = useState("")
  const client = useQueryClient()
  const query = useQuery({ queryKey: ["investment"], queryFn: ({ signal }) => getInvestment(signal), retry: false, refetchOnWindowFocus: true, staleTime: 60_000 })
  const marketRefresh = useQuery({ queryKey: ["investment-refresh-status", "market"], queryFn: ({ signal }) => getInvestmentRefreshStatus("market", signal), retry: false, refetchOnWindowFocus: false, refetchInterval: (q) => q.state.data?.state === "running" ? 2_000 : false })
  const newsRefresh = useQuery({ queryKey: ["investment-refresh-status", "news"], queryFn: ({ signal }) => getInvestmentRefreshStatus("news", signal), retry: false, refetchOnWindowFocus: false, refetchInterval: (q) => q.state.data?.state === "running" ? 2_000 : false })
  const watch = useQuery({ queryKey: ["investment-watch"], queryFn: ({ signal }) => getInvestmentWatch(signal), enabled: view === "work", retry: false, refetchOnWindowFocus: false })
  const researchIndex = useQuery({ queryKey: ["investment-research"], queryFn: ({ signal }) => getInvestmentResearch(signal), enabled: view === "work", retry: false, refetchOnWindowFocus: false })
  const actions = useQuery({ queryKey: ["investment-actions"], queryFn: ({ signal }) => getInvestmentActions(signal), enabled: view === "work", retry: false, refetchOnWindowFocus: false, staleTime: 60_000 })
  const history = useQuery({ queryKey: ["investment-history"], queryFn: ({ signal }) => getInvestmentHistory(signal), enabled: view === "history", retry: false, refetchOnWindowFocus: false })
  const context = useQuery({ queryKey: ["investment-context"], queryFn: ({ signal }) => getInvestmentContext(signal), enabled: view === "history", retry: false, refetchOnWindowFocus: false })
  useEffect(() => {
    const state = marketRefresh.data?.state
    if (!state || state === "idle" || state === "running") return
    void Promise.all([
      client.invalidateQueries({ queryKey: ["investment-market"], refetchType: "active" }),
      client.invalidateQueries({ queryKey: ["investment-pulse"], refetchType: "active" }),
      client.invalidateQueries({ queryKey: ["investment"], refetchType: "active" }),
      client.invalidateQueries({ queryKey: ["investment-narrative"], refetchType: "active" }),
      client.invalidateQueries({ queryKey: ["investment-source"], refetchType: "active" }),
    ])
  }, [client, marketRefresh.data?.last_updated, marketRefresh.data?.state])
  useEffect(() => {
    const state = marketRefresh.data?.discovery_state
    if (!state || state === "idle" || state === "running") return
    void client.invalidateQueries({ queryKey: ["investment-explore"], refetchType: "active" })
  }, [client, marketRefresh.data?.discovery_state, marketRefresh.data?.discovery_updated_at])
  useEffect(() => {
    const state = newsRefresh.data?.state
    if (!state || state === "idle" || state === "running" || state === "failed") return
    void Promise.all([
      client.invalidateQueries({ queryKey: ["investment"], refetchType: "active" }),
      client.invalidateQueries({ queryKey: ["investment-narrative"], refetchType: "active" }),
      client.invalidateQueries({ queryKey: ["investment-source"], refetchType: "active" }),
    ])
  }, [client, newsRefresh.data?.last_updated, newsRefresh.data?.state])
  const b = query.data?.brief
  function openView(next: View) {
    setView(next)
    document.getElementById(`investment-tab-${next}`)?.focus()
  }
  async function runRefresh(action: InvestmentRefreshAction, market?: "tw" | "us") {
    setRefreshError("")
    try {
      await postInvestmentRefresh(action, market)
      await client.invalidateQueries({ queryKey: ["investment-refresh-status", action] })
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "更新操作失敗，請稍後重試。")
    }
  }

  return <div className="flex min-w-0 flex-col gap-4 break-words">
    <PageHeader page="investment" />
    {view === "today" ? <div className="flex min-w-0 flex-col gap-2" aria-label="Today 更新操作">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button disabled={marketRefresh.data?.state === "running"} onClick={() => void runRefresh("market")}>刷新盤面</Button>
        <Button disabled={newsRefresh.data?.state === "running"} onClick={() => void runRefresh("news", "tw")}>台股消息快掃</Button>
        <Button disabled={newsRefresh.data?.state === "running"} onClick={() => void runRefresh("news", "us")}>美股消息快掃</Button>
      </div>
      <div className="flex min-w-0 flex-col gap-1 text-caption text-ink-3" aria-live="polite">
        <p>{refreshStateLabel("market", marketRefresh.data)}{marketRefresh.data?.discovery_state === "running" ? " · 市場資金掃描仍在背景整理" : marketRefresh.data?.discovery_state === "partial" ? " · 市場資金掃描部分完成" : marketRefresh.data?.discovery_state === "failed" ? " · 市場資金掃描失敗" : ""}</p>
        <p title={providerDetailTitle(newsRefresh.data)}>{refreshStateLabel("news", newsRefresh.data)}</p>
      </div>
    </div> : null}
    {refreshError ? <p role="alert" aria-live="polite" className="text-caption text-warn">{refreshError}</p> : null}
    {view === "today" && query.data?.today ? <TodayIntradayReceipts refresh={query.data.today.intraday_refresh} readFailed={query.isError} /> : null}
    <nav aria-label="投資內容" className="flex min-w-0 gap-4 overflow-x-auto border-b border-line-soft sm:gap-5" role="tablist">{VIEWS.map(([key, label], index) => <Button key={key} id={`investment-tab-${key}`} role="tab" aria-controls={`investment-panel-${key}`} aria-selected={view === key} tabIndex={view === key ? 0 : -1} variant="link" className={`shrink-0 rounded-none border-b-2 px-0 py-3 ${view === key ? "border-accent text-ink" : "border-transparent text-ink-3"}`} onClick={() => setView(key)} onKeyDown={event => {
      const next = event.key === "ArrowRight" ? (index + 1) % VIEWS.length : event.key === "ArrowLeft" ? (index + VIEWS.length - 1) % VIEWS.length : event.key === "Home" ? 0 : event.key === "End" ? VIEWS.length - 1 : null
      if (next !== null) { event.preventDefault(); openView(VIEWS[next][0]) }
    }}>{label}</Button>)}</nav>
    <div id="investment-panel-today" role="tabpanel" aria-labelledby="investment-tab-today" hidden={view !== "today"} className={view === "today" ? "flex min-w-0 flex-col gap-5" : "hidden"}>
      {query.isError ? <p role="alert" className="text-body text-warn">簡報讀取失敗。{b ? "目前保留上次內容。" : ""}請按更新資料重試。</p> : null}
      {query.isPending ? <p className="text-body text-ink-3">讀取簡報中…</p> : null}
      {b ? <TodayBrief b={b} today={query.data?.today} readFailed={query.isError} newsStatus={newsRefresh.data} onOpenThesis={() => openView("thesis")} /> : null}
      <TodayCatalysts enabled={view === "today"} />
      <section className="flex min-w-0 flex-col gap-3" aria-label="現在盤面">
        <TodayAnchor>現在盤面</TodayAnchor>
        <MarketPulse />
      </section>
      <section className="flex min-w-0 flex-col gap-3" aria-label="我的持倉">
        <TodayAnchor>我的持倉</TodayAnchor>
        <StockMomentum />
      </section>
    </div>
    <div id="investment-panel-thesis" role="tabpanel" aria-labelledby="investment-tab-thesis" hidden={view !== "thesis"} className={view === "thesis" ? "flex min-w-0 flex-col gap-5" : "hidden"}>
      <ReadingColumn><InvestmentNarrativeSection enabled={view === "thesis"} onOpenHistory={() => openView("history")} /></ReadingColumn>
      {query.isPending ? <p className="text-body text-ink-3">讀取簡報中…</p> : null}
      {query.isError ? <p role="alert" className="text-body text-warn">簡報讀取失敗。{b ? "目前保留上次讀取的資料；資料截止時間仍以簡報標示為準。" : "目前沒有可用的簡報資料。"}請按更新資料重試。</p> : null}
      {b ? <ReadingColumn><InvestmentThesis b={b} /></ReadingColumn> : null}
    </div>
    <div id="investment-panel-work" role="tabpanel" aria-labelledby="investment-tab-work" hidden={view !== "work"} className={view === "work" ? "flex min-w-0 flex-col gap-5" : "hidden"}>
      {watch.isError ? <p role="alert" className="text-body text-warn">Watch 日期來源本次讀取失敗。{watch.data ? "仍顯示上次內容。" : ""}</p> : null}
      {researchIndex.isError ? <p role="alert" className="text-body text-warn">正式 Research index 讀取失敗；不以 Watch 項目代替。</p> : null}
      <ReadingColumn><TodayCatalysts enabled={view === "work"} heading="未來 30 天催化劑" /></ReadingColumn>
      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-3" aria-label="研究">
          <div className="flex flex-col gap-1"><SectionHeading>目前研究方向</SectionHeading><p className="text-body text-ink-3">先看來源明示的方向；個別研究、證據與來源按需展開。未連結／未知項目留在 Other coverage。</p></div>
          {researchIndex.isPending ? <p role="status" className="text-body text-ink-3">讀取正式 Research index…</p> : null}
          {researchIndex.data ? <ResearchLibrary data={researchIndex.data} /> : null}
          {watch.isPending ? <p className="text-body text-ink-3">讀取 Watch 日期…</p> : null}
        </section>
        <section className="flex min-w-0 flex-col gap-3" aria-label="策略">
          <SectionHeading>策略</SectionHeading>
          <Card density="compact" className="flex flex-col gap-2"><p className="text-body text-ink-2">目前的唯讀資料契約沒有提供獨立的策略內容，因此這裡標示為尚未提供。</p><p className="text-caption text-ink-3">不從研究文字、持倉或市場行情推導策略。</p></Card>
        </section>
      </div>
      <ReadingColumn className="flex min-w-0 flex-col gap-5">
        <section className="flex min-w-0 flex-col gap-3" aria-label="待處理">
          <div className="flex flex-col gap-1"><SectionHeading>待處理</SectionHeading><p className="text-caption text-ink-3">你記下的問題與研究，加上 Investment Note 還沒結案的行動。</p></div>
          <InvestmentWorkPanel research={watch.data?.watch.research ?? []} />
          <InvestmentNoteActions data={actions.data} isPending={actions.isPending} isError={actions.isError} splitStatuses />
        </section>
        <InvestmentReminderPanel mode="attention" enabled={view === "work"} />
      </ReadingColumn>
      {watch.data ? <details><summary className="cursor-pointer py-2 text-caption text-ink-3">既有 Watch 與簡報日期清單（涵蓋獨立）</summary><ReadingColumn><ResearchWatch data={watch.data} brief={b} /></ReadingColumn></details> : null}
      <details className="border-t border-line-soft pt-2" data-testid="investment-system-status">
        <summary className="cursor-pointer py-2 text-body font-medium text-ink">系統整理的狀態提醒（唯讀，不自動列為 owner 待辦）</summary>
        <ReadingColumn className="pt-3"><PendingBoard /></ReadingColumn>
      </details>
    </div>

    <div id="investment-panel-history" role="tabpanel" aria-labelledby="investment-tab-history" hidden={view !== "history"} className={view === "history" ? "flex min-w-0 flex-col gap-4" : "hidden"}>
      {history.isPending || context.isPending ? <p className="text-body text-ink-3">讀取歷史與研究脈絡中…</p> : null}
      {history.isError ? <p role="alert" className="text-body text-warn">歷史來源這次無法取得，請稍後重試。</p> : null}
      {context.isError ? <p role="alert" className="text-body text-warn">研究脈絡這次無法取得；歷史資料仍可單獨查看。</p> : null}
      {history.data ? <ReadingColumn><InvestmentHistory data={history.data} context={context.data} /></ReadingColumn> : null}
    </div>
    <details className="border-t border-line-soft pt-3"><summary className="cursor-pointer py-2 text-caption text-ink-3">資料來源與讀取狀況{watch.data?.watch.coverage.errors.length ? ` · ${watch.data.watch.coverage.errors.length} 項異常` : ""}</summary><div className="flex flex-col gap-2 pt-2 text-caption text-ink-3">
      <p>{DEMO_MODE ? "簡報、研究、日期與行情全由合成資料提供。更新資料只重讀範例，不連接帳戶或外部資料。" : "簡報、研究和日期讀取本機 Investment Note；行情向 Yahoo Finance 查詢。「刷新盤面」會先把本機 Investment Note 快轉到 GitHub 最新（只 fast-forward，本機有分岔或未提交重疊就停），不會重新生成 AI 簡報，也不會推送任何東西。"}</p>
      <p>每週觀察：{query.data?.weekly_watch.date ?? "尚未取得日期"}。目前只提供日期，無法據此確認本週回顧是否完成。</p>
      <p>投資論點的自動檢查尚未接入；没有提醒不代表論點已通過檢查。</p>
      {watch.data ? <><p>已讀 {watch.data.watch.coverage.scanned_files} 份相關來源；{watch.data.watch.coverage.missing_catalysts.length} 份未填下次事件日期。未填日期不算讀取故障。</p>{watch.data.watch.coverage.errors.map((error, index) => <p key={index}>{error.path}：{error.message}</p>)}{watch.data.watch.coverage.omissions.length ? <p>另有 {watch.data.watch.coverage.omissions.length} 份相關來源未納入：{watch.data.watch.coverage.omissions.slice(0, 5).map(item => `${item.path}（${item.reason}）`).join("、")}</p> : null}</> : null}
    </div></details>
  </div>
}
