import { useEffect, useRef, useState, type ReactNode } from "react"
import "./judgment.css"
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
  JUDGMENT_CLASS_LABEL, newsRefreshHasPendingCandidates, newsRefreshResultsConfirmed, newsScanNote, pendingActionsCountLine, providerCompletionNote, providerDetailTitle, taipeiClock,
  sourceTimestamp, structuredBriefJudgmentReplacement, validatedBriefJudgment, todayActionKindLabel, currentTodayActionPlan, todayActionSection, todayGlobalDecisionSummary, todayJudgmentTimeMetadata,
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
import { TodayCheckpointReviews } from "./TodayCheckpointReviews"
import {
  BRIEF_SESSION_LABELS, getInvestment, getInvestmentWatch, getInvestmentResearch,
  getInvestmentHistory, getInvestmentContext, getInvestmentSource,
  getInvestmentActions, getInvestmentNarrative, getInvestmentRefreshStatus, postInvestmentRefresh, rereadInvestmentRefreshStatuses,
  type InvestmentIntradayMarketProjection, type InvestmentIntradayRefresh, type InvestmentNewsMarketResult, type InvestmentNewsScope, type InvestmentRefreshAction, type InvestmentRefreshStatus,
  type InvestmentActionItem, type InvestmentActions, type InvestmentBrief, type InvestmentMarketObservation, type InvestmentSource, type InvestmentTodayUpdate, type InvestmentTodayView,
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
    case "no_material_update": return "來源回報沒有重要增量"
    case "updated": return "已更新事件"
    case "needs_deeper_analysis": return "有候選仍待深入分析"
    case "partial": return "部分來源完成"
    case "failed": return "刷新失敗"
    case "unavailable": return "來源不可用"
    default: return "結果尚未確認"
  }
}

function intradayFreshnessLabel(freshness: string | undefined): string {
  switch (freshness) {
    case "baseline": return "沿用正式簡報"
    case "fresh": return "資料截止時間已更新"
    case "stale": return "本次未能更新資料截止時間"
    default: return "資料截止時間尚未確認"
  }
}

function intradayMarketSummary(market: InvestmentIntradayMarketProjection | undefined): string {
  if (!market) return "刷新狀態未提供"
  if (!market.latest_receipt && market.state === "not_requested") return "尚無可採用的盤中更新；沿用正式簡報"
  const result = market.latest_receipt?.result ?? market.state
  if (result === "no_material_update") {
    const coverage = market.latest_receipt?.coverage_state
    const summary = coverage === "complete" && ["fresh", "current"].includes(market.freshness)
      ? "此次掃描範圍內沒有重要增量"
      : coverage === "partial" ? "本次掃描僅部分完成，不能確認有無重要增量"
        : coverage === "failed" ? "本次掃描失敗，不能確認有無重要增量"
          : coverage === "complete" ? "較早掃描回報沒有重要增量，目前未確認"
            : "掃描完整度未確認，不能判定沒有重要增量"
    return `${summary} · ${intradayFreshnessLabel(market.freshness)}`
  }
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

export function TodayIntradayReceipts({ refresh, readFailed }: { refresh?: InvestmentIntradayRefresh; readFailed: boolean }) {
  // A formal brief is complete without an optional intraday scan. Only actual
  // scan receipts or explicit outcomes belong in this execution-status surface.
  if (!refresh) return null
  const markets = (["tw", "us"] as const).map(key => [key, refresh.markets[key]] as const)
    .filter(([, market]) => Boolean(market?.latest_receipt || market?.last_successful_refresh
      || ["updated", "no_material_update", "needs_deeper_analysis", "partial", "failed"].includes(market?.state ?? "")))
  if (!markets.length) return null
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
              {receipt ? <p>本次輸入 cutoff：{sourceTimestamp(receipt.input_cutoff)}</p> : null}
              <p>下次搜尋起點：{sourceTimestamp(market.input_cutoff)}</p>
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

export function refreshStateLabel(action: InvestmentRefreshAction, status: InvestmentRefreshStatus | undefined, error?: unknown): string {
  const marketName = status?.market_scope === "tw" ? "台股" : status?.market_scope === "us" ? "美股" : null
  const scanName = status?.scan_mode === "quick" ? "快掃" : status?.scan_mode === "deep" ? "深度掃描" : "掃描"
  const name = action === "market" ? "盤面" : status?.market_scope === "both" ? "台股與美股消息更新" : `${marketName ? `${marketName}消息` : "最新消息"}${scanName}`
  if (error) {
    const detail = error instanceof Error && error.message.trim() ? error.message.trim() : "本機狀態讀取失敗"
    return `${name}狀態讀取失敗：${detail}`
  }
  if (!status) return `${name}狀態讀取中…`
  if (status.state === "idle") return `${name}尚未更新`
  if (status.state === "running") {
    const started = status.started_at ? Date.parse(status.started_at) : Number.NaN
    const elapsed = Number.isFinite(started) ? Math.max(0, Math.floor((Date.now() - started) / 1000)) : null
    return `${name}進行中${elapsed === null ? "…" : ` · 已進行 ${durationLabel(elapsed)}`}`
  }
  if (action === "news" && ["success", "no-change"].includes(status.state) && !newsRefreshResultsConfirmed(status)) return `${name}結果未完整確認；請查看分市場結果。`
  const providerNote = action === "news" ? providerCompletionNote(status) : null
  const route = providerNote ? ` · ${providerNote}` : ""
  const duration = action === "news" && typeof status.duration_seconds === "number" && Number.isFinite(status.duration_seconds)
    ? ` · 總耗時 ${durationLabel(status.duration_seconds)}`
    : ""
  if (status.state === "failed") return `${name}更新失敗：${status.message}${duration}${route}`
  if (status.state === "partial") return `${name}部分完成：${status.message}${duration}${route}`
  if (action === "news" && ["success", "no-change"].includes(status.state) && newsRefreshHasPendingCandidates(status)) return `${name}已保存，仍有候選待確認 · ${sourceTimestamp(status.last_updated)}${duration}${route}`
  if (action === "news" && status.state === "no-change") return `${name}於 ${sourceTimestamp(status.last_updated)} 完成，${status.market_scope === "both" ? "本次未發現重要新事件" : "無影響當前判斷的新消息"}${duration}${route}`
  return `${name}完成於 ${sourceTimestamp(status.last_updated)}${status.message ? ` · ${status.message}` : ""}${duration}${route}`
}

/** Surface ongoing work or a degraded outcome; keep completed execution prose in details. */
function refreshAttentionLabel(action: InvestmentRefreshAction, status: InvestmentRefreshStatus | undefined, error?: unknown): string | null {
  const marketName = status?.market_scope === "tw" ? "台股" : status?.market_scope === "us" ? "美股" : "消息"
  const name = action === "market" ? "盤面更新" : status?.market_scope === "both" ? "消息更新" : `${marketName}${status?.scan_mode === "deep" ? "深度掃描" : "快掃"}`
  if (error) return `${name}狀態讀取失敗`
  if (!status) return null
  if (action === "news" && status.market_scope === "both") {
    if (status.state === "running") return `消息更新進行中 · ${(["tw", "us"] as const).map(key => `${INTRADAY_MARKET_LABEL[key]}${newsChildStateLabel(status.markets?.[key])}`).join(" · ")}`
    if (["success", "no-change"].includes(status.state) && !newsRefreshResultsConfirmed(status)) return "消息更新結果未完整確認"
    if (["success", "no-change"].includes(status.state) && newsRefreshHasPendingCandidates(status)) return "消息已保存，仍有候選待確認"
  }
  if (status.state === "running") return refreshStateLabel(action, status)
  if (status.state === "failed") return `${name}失敗`
  if (status.state === "partial") return `${name}部分完成`
  if (action === "market" && status.discovery_state === "running") return "市場資金掃描進行中"
  if (action === "market" && status.discovery_state === "failed") return "市場資金掃描失敗"
  if (action === "market" && status.discovery_state === "partial") return "市場資金掃描部分完成"
  return null
}

function newsChildStateLabel(child: InvestmentNewsMarketResult | undefined): string {
  if (child?.state === "success" && child.intraday_result === "needs_deeper_analysis") {
    const saved = ["written", "already_present"]
    return saved.includes(child.receipt_write_state ?? "") && saved.includes(child.news_write_state ?? "")
      ? "已保存，仍有候選待確認" : "結果未確認"
  }
  switch (child?.state) {
    case "running": return "更新中"
    case "success": return "更新完成"
    case "no-change": return "未發現重要新事件"
    case "partial": return "部分完成"
    case "failed": return "更新失敗"
    case "unavailable": return "來源無法取得"
    default: return "結果未確認"
  }
}

function NewsMarketResults({ status, readFailed }: { status: InvestmentRefreshStatus; readFailed: boolean }) {
  if (status.market_scope !== "both") return null
  return <div aria-label="本次台股與美股消息結果" className="flex min-w-0 flex-col gap-3">
    {readFailed ? <p className="text-warn">本次狀態讀取失敗；以下保留上次回報的分市場結果，目前尚未確認。</p> : null}
    {(["tw", "us"] as const).map(key => {
      const child = status.markets?.[key]
      return <div key={key} className="flex min-w-0 flex-col gap-1 border-l-2 border-line-soft pl-3">
        <p className="font-medium text-ink-2">{INTRADAY_MARKET_LABEL[key]} · {newsChildStateLabel(child)}</p>
        {child ? <>
          {child.message ? <p>來源回報：{child.message}</p> : null}
          {child.error ? <p className="text-warn">來源錯誤：{child.error}</p> : null}
          <p>開始：{sourceTimestamp(child.started_at)} · 完成：{sourceTimestamp(child.finished_at)}</p>
          <p>覆蓋：{child.coverage_state ?? "未確認"} · 回執保存：{child.receipt_write_state ?? "未確認"} · 事件保存：{child.news_write_state ?? "未確認"}</p>
          {child.baseline_cutoff_at ? <p>正式基準資料截至：{sourceTimestamp(child.baseline_cutoff_at)}</p> : null}
          {child.input_cutoff ? <p>輸入資料截至：{sourceTimestamp(child.input_cutoff)}</p> : null}
          {child.source_cutoff ? <p>來源資料截至：{sourceTimestamp(child.source_cutoff)}</p> : null}
          {child.output_cutoff ? <p>輸出資料截至：{sourceTimestamp(child.output_cutoff)}</p> : null}
          <details><summary className="cursor-pointer py-1">這個市場的來源回執欄位</summary><pre className="whitespace-pre-wrap break-words pt-2">{JSON.stringify(child, null, 2)}</pre></details>
        </> : <p>本次未提供這個市場的結果；不採用較早的回執代替。</p>}
      </div>
    })}
  </div>
}

export function InvestmentRefreshDetails({ marketStatus, newsStatus, marketError, newsError, operationError, refresh, readFailed }: {
  marketStatus?: InvestmentRefreshStatus; newsStatus?: InvestmentRefreshStatus
  marketError?: unknown; newsError?: unknown; operationError?: string
  refresh?: InvestmentIntradayRefresh; readFailed: boolean
}) {
  // This job's child results own its progress. Older Today receipts stay in
  // the source disclosure and must not masquerade as this job's outcomes.
  const receiptAttention = newsStatus?.market_scope === "both" ? [] : (["tw", "us"] as const).flatMap(key => {
    const market = refresh?.markets[key]
    const receipt = market?.latest_receipt
    if (!receipt || market?.state === "not_requested") return []
    const name = `${INTRADAY_MARKET_LABEL[key]}快掃`
    if (readFailed) return [`${name}回執本次讀取失敗`]
    if ([market?.state, receipt.result, receipt.coverage_state].includes("failed")) return [`${name}失敗`]
    if ([market?.state, receipt.result, receipt.coverage_state].includes("partial")) return [`${name}部分完成`]
    if (market?.state === "unknown" || receipt.result === "unavailable") return [`${name}結果未確認`]
    return []
  })
  const attention = [...new Set([operationError ? "更新操作失敗" : null,
    refreshAttentionLabel("market", marketStatus, marketError), refreshAttentionLabel("news", newsStatus, newsError), ...receiptAttention]
    .filter(Boolean))].join(" · ")
  const degraded = Boolean(operationError || marketError || newsError || receiptAttention.length
    || [marketStatus?.state, newsStatus?.state, marketStatus?.discovery_state].some(state => state === "failed" || state === "partial")
    || (newsStatus?.market_scope === "both" && ["success", "no-change"].includes(newsStatus.state) && !newsRefreshResultsConfirmed(newsStatus)))
  return <div className="flex min-w-0 flex-col gap-1 text-caption text-ink-3" aria-label="更新狀態與紀錄">
    {attention ? <p role={operationError ? "alert" : "status"} aria-live="polite" className={degraded ? "text-warn" : "text-ink-3"}>{attention} · 詳情可展開查看</p> : null}
    <details>
      <summary className="cursor-pointer py-1">更新紀錄與來源回執</summary>
      <div className="flex min-w-0 flex-col gap-3 pt-2">
        {operationError ? <p className="text-warn">更新操作失敗：{operationError}</p> : null}
        {(["market", "news"] as const).map(action => {
          const status = action === "market" ? marketStatus : newsStatus
          const error = action === "market" ? marketError : newsError
          const providerDetail = providerDetailTitle(status)
          return <div key={action} className="flex min-w-0 flex-col gap-1 break-words border-l-2 border-line-soft pl-3">
            <p className={error || status?.state === "partial" || status?.state === "failed" ? "text-warn" : "text-ink-3"}>{refreshStateLabel(action, status, error)}</p>
            {status ? <>
              <p>來源狀態：{status.state} · 開始時間：{status.started_at ?? "未提供"} · 最後更新：{status.last_updated ?? "未提供"}</p>
              {status.message && ["idle", "running", "no-change"].includes(status.state) ? <p>來源回報：{status.message}</p> : null}
              {status.sync_note ? <p>同步紀錄：{status.sync_note}</p> : null}
              {status.error ? <p className="text-warn">來源錯誤：{status.error}</p> : null}
              {action === "market" ? <p>市場資金掃描：{status.discovery_state} · 更新時間：{status.discovery_updated_at ?? "未提供"}</p> : null}
              {providerDetail ? <p className="break-all">{providerDetail}</p> : null}
              {action === "news" ? <NewsMarketResults status={status} readFailed={Boolean(error)} /> : null}
            </> : null}
          </div>
        })}
        <TodayIntradayReceipts refresh={refresh} readFailed={readFailed} />
      </div>
    </details>
  </div>
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
  const currentJudgment = !readFailed && b.state === "current" ? today?.current_judgment ?? null : null
  const briefMarket = b.session === "tw-open-prep" ? "tw" : b.session === "us-open-prep" ? "us" : null
  const marketProjection = briefMarket ? today?.intraday_refresh?.markets[briefMarket] : null
  const marketJudgment = marketProjection?.current_judgment ?? null
  const hasIdentity = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0
  const latestAssessment = currentJudgment?.latest_assessment
  const marketLatestAssessment = marketJudgment?.latest_assessment
  const receiptReadbackMatches = Boolean(currentJudgment && briefMarket
    && currentJudgment.market === briefMarket
    && hasIdentity(currentJudgment.baseline?.revision)
    && hasIdentity(currentJudgment.baseline?.source_cutoff)
    && marketProjection?.baseline_revision === currentJudgment.baseline?.revision
    && marketProjection?.baseline_cutoff === currentJudgment.baseline?.source_cutoff
    && marketJudgment?.state === currentJudgment.state
    && hasIdentity(latestAssessment?.assessed_at)
    && hasIdentity(latestAssessment?.source_revision)
    && marketLatestAssessment?.assessed_at === latestAssessment?.assessed_at
    && marketLatestAssessment?.source_revision === latestAssessment?.source_revision)
  const marketDelta = marketJudgment?.current_delta ?? null
  const acceptedDelta = receiptReadbackMatches && Boolean(currentJudgment?.current_delta && marketDelta)
    && currentJudgment?.effective_source === "last_successful_reassessment"
    && hasIdentity(currentJudgment.current_delta?.provenance?.assessed_at)
    && hasIdentity(currentJudgment.current_delta?.provenance?.source_revision)
    && hasIdentity(currentJudgment.current_delta?.provenance?.baseline_revision)
    && hasIdentity(currentJudgment.current_delta?.provenance?.baseline_cutoff_at)
    && currentJudgment.current_delta?.provenance?.baseline_revision === currentJudgment.baseline?.revision
    && currentJudgment.current_delta?.provenance?.baseline_cutoff_at === currentJudgment.baseline?.source_cutoff
    && currentJudgment.current_delta?.judgment === marketDelta?.judgment
    && currentJudgment.current_delta?.why_now === marketDelta?.why_now
    && currentJudgment.current_delta?.class === marketDelta?.class
    && currentJudgment.current_delta?.revisit === marketDelta?.revisit
    && currentJudgment.current_delta?.decision_effect === marketDelta?.decision_effect
    && currentJudgment.current_delta?.provenance?.assessed_at === marketDelta?.provenance?.assessed_at
    && currentJudgment.current_delta?.provenance?.source_revision === marketDelta?.provenance?.source_revision
    && currentJudgment.current_delta?.provenance?.baseline_revision === marketDelta?.provenance?.baseline_revision
    && currentJudgment.current_delta?.provenance?.baseline_cutoff_at === marketDelta?.provenance?.baseline_cutoff_at
    ? currentJudgment.current_delta ?? currentJudgment.effective_judgment : null
  const judgment = acceptedDelta ?? replacement?.judgment
    ?? (!readFailed && b.state === "current" ? validatedBriefJudgment(b) : null)
  const previousJudgment = (readFailed || b.state === "stale") && typeof b.judgment?.judgment === "string" && b.judgment.judgment.trim()
    ? b.judgment.judgment.trim()
    : null
  // These are receipts for the same assessment, not inferred event/claim relations.
  // A retained delta can remain readable after a failed scan without being a fresh review.
  const assessmentMatches = receiptReadbackMatches
    && latestAssessment?.state === marketLatestAssessment?.state
    && latestAssessment?.reason === marketLatestAssessment?.reason
    && latestAssessment?.reason_code === marketLatestAssessment?.reason_code
    && latestAssessment?.baseline_cutoff_at === currentJudgment?.baseline?.source_cutoff
    && latestAssessment?.baseline_cutoff_at === marketLatestAssessment?.baseline_cutoff_at
  const assessmentReceipt = marketProjection?.latest_receipt
  const assessmentCurrent = assessmentMatches
    && ["fresh", "current"].includes(marketProjection?.freshness ?? "")
    && ["ready", "updated", "no_material_update"].includes(marketProjection?.state ?? "")
    && today?.state !== "unavailable"
    && assessmentReceipt?.coverage_state === "complete"
    && ["updated", "no_material_update"].includes(assessmentReceipt?.result ?? "")
    && assessmentReceipt?.finished_at === latestAssessment?.assessed_at
    && assessmentReceipt?.baseline_cutoff_at === currentJudgment?.baseline?.source_cutoff
    && hasIdentity(assessmentReceipt?.baseline_artifact_sha256)
    && `sha256:${assessmentReceipt.baseline_artifact_sha256}` === currentJudgment?.baseline?.revision
  const assessmentConfirmed = assessmentCurrent && latestAssessment?.state === currentJudgment?.state
    && (currentJudgment?.state === "reassessed" ? Boolean(acceptedDelta)
      : currentJudgment?.state === "unchanged" || currentJudgment?.state === "preserved"
        ? !currentJudgment.current_delta || Boolean(acceptedDelta) : false)
  const formalJudgment = currentJudgment?.formal_judgment
  const priorJudgment = acceptedDelta && formalJudgment?.judgment !== judgment?.judgment
    ? formalJudgment : null
  const actionUnchanged = acceptedDelta && formalJudgment?.class === acceptedDelta.class
  const hasAssessment = Boolean(latestAssessment || marketLatestAssessment || marketProjection?.latest_receipt)
  const assessmentHeading = assessmentConfirmed
    ? currentJudgment?.state === "reassessed" ? "判斷已更新"
      : currentJudgment?.state === "unchanged" ? "已重評，判斷維持不變" : "沿用既有判斷"
    : "本次無法確認，保留既有判斷"
  const assessmentReason = assessmentMatches ? latestAssessment?.reason?.trim() : null
  const cachedSteps = readFailed
    ? currentTodayActionPlan(b, today, false)
    : currentTodayActionPlan(b, today)
  // Formal actions stay with the judgment. Intraday source reminders remain
  // readable in TodayIntradayReading, including after a failed reread.
  const steps = cachedSteps.filter(item => item.origin === "brief")
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
  const primary = judgment ? undefined : steps.find(item => item.origin === "brief") ?? steps[0]
  const otherSteps = primary ? steps.filter(item => item !== primary) : steps
  const secondary = otherSteps.slice(0, 2)
  const remaining = otherSteps.slice(2)
  const decisionSummary = readFailed || b.state === "stale" ? "" : today?.decision_summary?.trim() || ""
  const globalDecisionSummary = todayGlobalDecisionSummary(decisionSummary, cachedSteps)
  const actionSection = todayActionSection(b)
  const judgmentTime = todayJudgmentTimeMetadata(b, today, acceptedDelta, readFailed)
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
  const actionSourceLine = (item: (typeof steps)[number]) => {
    const previous = readFailed ? "上次成功讀取的" : ""
    const parts = item.origin === "update"
      ? readFailed ? ["上次成功讀取的盤中補充觀察"] : ["盤中補充觀察"]
      : [`${previous}${b.state === "stale" ? "沿用的" : "正式簡報"}行動`]
    if (item.date) parts.push(`${item.origin === "update" ? "更新時間" : "記錄日期"} ${sourceTimestamp(item.date)}`)
    if (item.origin === "update") parts.push(item.declaredDecisionTransition === null
      ? "與正式判斷的關係未說明"
      : item.declaredDecisionTransition ? "來源表示正式判斷有變" : "來源表示正式判斷不變")
    return parts.join(" · ")
  }
  // Headline (chips + text); a labelled reason field only when one exists --
  // never a placeholder for a missing one. Source/id detail moved below.
  const row = (item: (typeof steps)[number], isPrimary = false) => <li key={item.key} className={`flex min-w-0 flex-col gap-3 border-l-2 pl-3 ${isPrimary ? "border-accent" : "border-line-soft"}`}>
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Chip tone={isPrimary ? "info" : "mute"}>{todayActionKindLabel(item.kind, item.origin, readFailed || b.state === "stale")}</Chip>
      <Chip tone={item.status ? statusTone(item.status) : "mute"}>{status(item.status)}</Chip>
      <p className="min-w-0 text-body font-medium leading-relaxed text-ink"><TargetText text={item.text} /></p>
    </div>
    {item.reason?.trim() ? <FieldList><Field label="行動原因"><InlineText text={item.reason.trim()} /></Field></FieldList> : null}
    {actionSourceLine(item) ? <p className="text-caption text-ink-3">{actionSourceLine(item)}</p> : null}
  </li>
  const sourceNotes = steps.filter(item => item.date || item.source || item.id || item.artifactId || item.storyId)
  const renderSecondaryGroup = (origin: (typeof steps)[number]["origin"], label: string) => {
    const items = secondary.filter(item => item.origin === origin)
    return items.length ? <div role="group" aria-label={label} className="flex min-w-0 flex-col gap-2">
      <p className="text-caption font-medium text-ink-2">{label}</p>
      <ol className="flex min-w-0 flex-col gap-3">{items.map(item => row(item))}</ol>
    </div> : null
  }
  return <section className="flex min-w-0 flex-col gap-3 break-words [overflow-wrap:anywhere]" aria-label={actionSection.heading}>
    <SectionHeading>{actionSection.heading}</SectionHeading>
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="flex min-w-0 flex-col gap-3">
      {previousJudgment ? <p className="text-body leading-relaxed text-ink-2">上次讀取的判斷（目前未確認）：<InlineText text={previousJudgment} /></p> : null}
      {judgment ? <div role="group" aria-label="主要下一步" className="flex min-w-0 flex-col gap-3 border-l-2 border-accent pl-3">
          <p className="sr-only">{acceptedDelta ? assessmentConfirmed ? "現在判斷" : "上次有效判斷（本次未確認）" : "正式簡報判斷"}</p>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Chip tone="info">{JUDGMENT_CLASS_LABEL[judgment.class]}</Chip>
            <p className="min-w-0 text-body font-medium leading-relaxed text-ink"><InlineText text={judgment.judgment} /></p>
          </div>
          <FieldList>
            <Field label={acceptedDelta ? "相較原先，多知道什麼" : "這次新資訊與判斷"}><InlineText text={judgment.why_now} /></Field>
            {judgment.revisit ? <Field label="接下來看什麼"><InlineText text={judgment.revisit} /></Field> : null}
            {judgment.decision_effect ? <Field label="什麼結果會改變判斷"><InlineText text={judgment.decision_effect} /></Field> : null}
          </FieldList>
        </div>
        : primary ? <ol className="flex min-w-0 flex-col gap-3" aria-label="主要下一步">{row(primary, true)}</ol>
        : decisionSummary ? <p className="text-body leading-relaxed text-ink-2">{b.state === "stale" ? "今天的判斷尚未取得。" : checkpoint ? "來源未列出獨立行動；行動狀態未明示，下一個已知檢查點如下。" : "來源未列出獨立行動；行動狀態與下一檢查點未明示。"}</p>
        : b.state === "current" ? <p className="text-body text-ink-3">{checkpoint ? "沒有可確認的下一步；來源未明示「今天不用動」，已知檢查點保留在來源明細。" : "沒有可確認的下一步；來源沒有明示「今天不用動」或下一檢查點。"}</p>
        : <p role="status" className="text-body text-warn">目前沒有可確認的下一步；資料缺失不代表今天不用動。</p>}
      {b.state === "current" || b.state === "stale" ? <p role="note" aria-label="正式判斷時間與後續快掃" className="text-caption text-ink-3">{judgmentTime.summaryLine}</p> : null}
      {actionSection.context ? <p role="status" className="text-caption text-warn">{actionSection.context}</p> : b.state === "missing" ? <p role="status" className="text-caption text-warn">尚未取得正式簡報；不將舊快取或殘留欄位當作今天已確認的工作。</p> : b.state === "invalid" ? <p role="status" className="text-caption text-warn">正式簡報無法完整辨識；其中的行動不列為今天已確認的工作。</p> : null}
      {today?.state === "partial" || today?.state === "unavailable" ? <p role="status" className="text-caption text-warn">{today.state === "partial" ? "今日資料只更新了一部分" : "今日更新資料目前無法取得"}；空白欄位不能確認沒有新行動。</p> : null}
      {hasAssessment && !assessmentConfirmed ? <p role="status" className="text-caption text-warn">本次無法確認，保留既有判斷。</p> : null}
      {readFailed ? <p role="status" className="text-caption text-warn">本次簡報讀取失敗；以下保留上次成功讀到的簡報與行動，是否已有新版本尚未確認。</p> : null}
      {globalDecisionSummary ? <FieldList><Field label="整體判斷" tone="strong"><TargetText text={globalDecisionSummary} /></Field></FieldList> : null}
      {secondary.length ? <div role="group" aria-label="其他行動" className="flex min-w-0 flex-col gap-3">
        {renderSecondaryGroup("brief", "正式簡報其他行動")}
      </div> : null}
      {remaining.length ? <details className="border-t border-line-soft pt-2 text-caption text-ink-3"><summary className="cursor-pointer py-1">來源另列 {remaining.length} 項</summary><ol className="mt-3 flex min-w-0 flex-col gap-3">{remaining.map(item => row(item))}</ol></details> : null}
      <details className="border-t border-line-soft pt-2 text-caption text-ink-3">
        <summary className="cursor-pointer py-1">檢查點與來源</summary>
        <div className="mt-2 flex min-w-0 flex-col gap-3">
          {b.state === "current" || b.state === "stale" ? <div className="flex min-w-0 flex-col gap-1">
            <p>{judgmentTime.judgmentLine}</p>
            {judgmentTime.sourceCutoffLine ? <p>{judgmentTime.sourceCutoffLine}</p> : null}
            {judgmentTime.laterScanLine ? <p>{judgmentTime.laterScanLine}</p> : null}
          </div> : null}
          {hasAssessment ? <div aria-label="這次判斷更新" className="flex min-w-0 flex-col gap-1 border-l-2 border-line pl-3">
            <p className="font-medium text-ink-2">{assessmentHeading}{assessmentConfirmed && acceptedDelta && actionUnchanged ? ` · 行動仍是${JUDGMENT_CLASS_LABEL[acceptedDelta.class]}` : ""}</p>
            {assessmentReason ? <p>{!assessmentConfirmed ? "上次回報的原因（本次未確認）：" : ""}<InlineText text={assessmentReason} /></p>
              : <p>{assessmentConfirmed ? "來源未提供本次覆核原因；不能由行動不變推定沒有新資訊。" : "尚不能確認這次有沒有重要新資訊；保留可讀的既有判斷。"}</p>}
            {assessmentConfirmed && latestAssessment?.assessed_at ? <p>本次查核：{sourceTimestamp(latestAssessment.assessed_at)}</p> : null}
          </div> : null}
          {priorJudgment ? <div role="group" aria-label="原先判斷" className="flex min-w-0 flex-col gap-1 border-l-2 border-line-soft pl-3">
            <p className="font-medium text-ink-3">原先判斷 · 正式簡報</p>
            <p><InlineText text={priorJudgment.judgment} /></p>
          </div> : null}
          <div>{checkpointNote}</div>
          {b.upcoming.length ? <div className="flex min-w-0 flex-col gap-2">
            <p className="font-medium text-ink-2">近期檢查 · {b.upcoming.length}</p>
            <p>這些事件未提供與上方行動的明確關係，分開保留。</p>
            <ul className="flex min-w-0 flex-col gap-2">{b.upcoming.map((item, index) => <li key={index}><span>{item.date_label} · </span><InlineText text={item.event} />{item.check ? <p>檢查：<InlineText text={item.check} /></p> : <p>檢查條件未提供。</p>}</li>)}</ul>
          </div> : null}
          {sourceNotes.length ? <div className="flex min-w-0 flex-col gap-2">
            <p className="font-medium text-ink-2">{readFailed ? "上次成功讀取的行動（是否已有新版本尚未確認）" : "這項工作的來源"}</p>
            <ul className="flex min-w-0 flex-col gap-2">{sourceNotes.map(item => <li key={item.key} className="flex min-w-0 flex-col gap-1">{item.date ? <p>記錄日期：{sourceTimestamp(item.date)}</p> : null}{item.source ? <p className="break-all">來源：{item.source}</p> : null}{item.id ? <p className="break-all">ID：{item.id}</p> : null}{item.storyId ? <p className="break-all">story_id：{item.storyId}</p> : null}{item.artifactId ? <p className="break-all">artifact ID：{item.artifactId}</p> : null}</li>)}</ul>
          </div> : null}
          {judgment ? <div className="flex min-w-0 flex-col gap-1">
            <p className="font-medium text-ink-2">判斷依據</p>
            <p>簡報版次：{b.session ? BRIEF_SESSION_LABELS[b.session] ?? b.session : "版次未標示"}</p>
            {acceptedDelta && currentJudgment?.baseline?.revision ? <p className="break-all">已核對簡報內容版本：{currentJudgment.baseline.revision}</p> : null}
            {acceptedDelta && currentJudgment?.baseline?.source_cutoff ? <p>重評基線資料截至：{sourceTimestamp(currentJudgment.baseline.source_cutoff)}</p> : null}
            {acceptedDelta && acceptedDelta.provenance?.assessed_at ? <p>這項判斷重評完成：{sourceTimestamp(acceptedDelta.provenance.assessed_at)}</p> : null}
            {(judgment.provenance?.source_cutoff || b.source_cutoff) ? <p>判斷資料截至：{sourceTimestamp(judgment.provenance?.source_cutoff ?? b.source_cutoff)}</p> : null}
            {judgment.provenance?.validated_story_ids?.length ? <p className="break-all">已核對的事件 story_id：{judgment.provenance.validated_story_ids.join("、")}</p> : null}
            {replacement?.source === "action_items" ? <p className="break-all">來源明示關聯 action ID：{judgment.same_action_id}</p> : null}
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

// Only qualified source instants establish order. Records with unknown times
// stay visible rather than being described as older than a dated record.
function intradayReadingGroups<T>(rows: readonly T[], timestamp: (row: T) => string | null | undefined) {
  const dated = rows.map((row, index) => {
    const raw = timestamp(row)
    return { row, index, at: raw && taipeiClock(raw) ? Date.parse(raw) : null }
  })
  const known = dated.filter(item => item.at !== null).sort((left, right) => right.at! - left.at! || left.index - right.index)
  const latest = known[0]?.at
  return {
    visible: [...known.filter(item => item.at === latest), ...dated.filter(item => item.at === null)].map(item => item.row),
    older: known.filter(item => item.at !== latest).map(item => item.row),
  }
}

function intradayUpdateTime(update: InvestmentTodayUpdate) {
  return update.scan_completed_at || update.observed_at
}

export function TodayIntradayReading({ today, readFailed = false }: { today?: InvestmentTodayView; readFailed?: boolean }) {
  const updates = today?.updates ?? []
  const observations = uniqueMarketObservations(today?.intraday_refresh?.market_observations ?? [])
  if (!updates.length && !observations.length) return null
  const updateGroups = intradayReadingGroups(updates, intradayUpdateTime)
  const observationGroups = intradayReadingGroups(observations, row => row.observation_as_of || row.source?.at || row.observed_at || row.source_published_at)
  const renderUpdate = (update: InvestmentTodayUpdate, index: number) => {
    const mode = update.scan_mode === "quick" ? "消息快掃" : update.scan_mode === "deep" ? "來源標示持倉深掃" : "盤中來源更新（模式未提供）"
    const market = update.market_scope === "tw" ? "台股" : update.market_scope === "us" ? "美股" : update.market_scope === "all" ? "跨市場" : "市場範圍未提供"
    const time = intradayUpdateTime(update)
    return <article key={`${update.id}:${index}`} aria-label="盤中來源判讀" className="flex min-w-0 flex-col gap-3 border-l-2 border-line-soft pl-3">
      <p className="text-caption text-ink-3">{market} · {mode} · {update.scan_completed_at ? "完成" : "記錄"} {time ? sourceTimestamp(time) : "時間未提供"}{update.coverage_state === "partial" ? " · 部分來源完成" : ""}</p>
      {update.summary?.trim() ? <p className="text-body font-medium leading-relaxed text-ink"><InlineText text={update.summary} /></p>
        : <p className="text-caption text-warn">這筆更新未提供摘要；來源影響與提醒如下。</p>}
      <FieldList>
        {update.information_kind === "market_observation" && update.observation_value ? <Field label="市場讀數"><InlineText text={update.observation_value} /></Field> : null}
        {update.portfolio_impact ? <Field label="對持倉與判斷的影響"><TargetText text={update.portfolio_impact} /></Field> : null}
        {update.action ? <Field label="來源提醒" tone="strong"><TargetText text={update.action} /></Field> : null}
      </FieldList>
      <details className="text-caption text-ink-3">
        <summary className="cursor-pointer py-1">這筆更新的範圍與來源</summary>
        <div className="flex min-w-0 flex-col gap-1 pt-2">
          {update.scan_mode === "quick" ? <p>消息快掃檢查市場新聞增量；未發現重要新事件不代表每個持倉均已重新分析。</p>
            : update.scan_mode === "deep" ? <p>來源將這筆更新標為持倉深掃；完成程度仍以來源覆蓋標記與限制為準。</p>
              : <p>來源未標明快掃或深掃，不推定掃描範圍。</p>}
          <p>{update.coverage_state === "partial" ? "來源覆蓋：部分完成" : update.coverage_state === "complete" ? "來源覆蓋：來源回報完整" : "來源覆蓋：未提供"}</p>
          <p>{update.declared_decision_transition === true ? "來源標記：正式判斷有變；是否採用仍以主卡已核對的判斷為準。" : update.declared_decision_transition === false ? "來源標記：正式判斷不變。" : "來源未明示是否改變正式判斷；這筆更新本身不取代主卡判斷。"}</p>
          {update.transition_reason ? <p><InlineText text={update.transition_reason} /></p> : null}
          {update.market_date ? <p>市場日期：{update.market_date === "unknown" ? "待核對" : update.market_date}</p> : null}
          {update.scan_started_at ? <p>掃描開始：{sourceTimestamp(update.scan_started_at)}</p> : null}
          {update.scan_completed_at ? <p>掃描完成：{sourceTimestamp(update.scan_completed_at)}</p> : null}
          {update.observed_at ? <p>記錄時間：{sourceTimestamp(update.observed_at)}</p> : null}
          {update.source_cutoff ? <p>資訊截至：{sourceTimestamp(update.source_cutoff)}</p> : null}
          {update.information_kind ? <p>來源分類：{update.information_kind}</p> : null}
          {update.event ? <p>來源事件：<InlineText text={update.event} /></p> : null}
          {update.event_title ? <p>來源事件名稱：<InlineText text={update.event_title} /></p> : null}
          {update.market ? <p>來源市場：{update.market}</p> : null}
          {update.source_url ? <p className="break-all">來源網址：{update.source_url}</p> : null}
          {update.source_published_at ? <p>來源發布：{sourceTimestamp(update.source_published_at)}</p> : null}
          {update.source_category ? <p>來源類別：{update.source_category}</p> : null}
          {update.observation_value ? <p>觀察值：<InlineText text={update.observation_value} /></p> : null}
          {update.observation_as_of ? <p>觀察時間：{sourceTimestamp(update.observation_as_of)}</p> : null}
          {update.observation_relation ? <p>觀察對象：{update.observation_relation}</p> : null}
          {update.is_price_or_proxy_observation !== undefined ? <p>來源價格／代理指標標記：{String(update.is_price_or_proxy_observation)}</p> : null}
          {update.source_path ? <p className="break-all">來源：{update.source_path}</p> : null}
          {update.id ? <p className="break-all">更新 ID {update.id}</p> : null}
          {update.story_id ? <p className="break-all">story_id {update.story_id}</p> : null}
          {update.relevance.length ? <p className="break-all">來源標示相關性：{JSON.stringify(update.relevance)}</p> : null}
        </div>
      </details>
    </article>
  }
  return <section aria-label="盤中更新" className="flex min-w-0 flex-col gap-3">
    <SectionHeading>盤中更新</SectionHeading>
    <Card className="flex min-w-0 flex-col gap-4 p-4 sm:p-5">
      <p className="text-caption text-ink-3">盤中內容是來源補充；是否更新正式判斷，以主卡已核對的結果為準。</p>
      {readFailed || today?.state === "unavailable" ? <p role="status" className="text-caption text-warn">本次盤中資料未確認；保留上次可讀內容。</p>
        : today?.state === "partial" ? <p role="status" className="text-caption text-warn">盤中資料部分可用；以下保留來源更新，未涵蓋的部分仍未知。</p> : null}
      {updateGroups.visible.map(renderUpdate)}
      {observationGroups.visible.length ? <MarketObservations title="盤中市場讀數" observations={observationGroups.visible} embedded /> : null}
      {updateGroups.older.length || observationGroups.older.length ? <details className="border-t border-line-soft pt-2 text-caption text-ink-3">
        <summary className="cursor-pointer py-1">較早盤中紀錄 · {updateGroups.older.length + observationGroups.older.length}</summary>
        <div className="flex min-w-0 flex-col gap-4 pt-3">{updateGroups.older.map(renderUpdate)}
          <MarketObservations title="較早市場讀數" observations={observationGroups.older} embedded />
        </div>
      </details> : null}
      {today?.limitations.length || today?.intraday_refresh?.limitations.length ? <details className="border-t border-line-soft pt-2 text-caption text-ink-3">
        <summary className="cursor-pointer py-1">盤中來源限制</summary>
        <ul className="list-disc pl-4 pt-2">{[...(today.limitations ?? []), ...(today.intraday_refresh?.limitations ?? [])].map((item, index) => <li key={index}>{item}</li>)}</ul>
      </details> : null}
    </Card>
  </section>
}

export function TodayBrief({ b, today, newsStatus, onOpenThesis, readFailed }: { b: InvestmentBrief; today?: InvestmentTodayView; newsStatus?: InvestmentRefreshStatus; onOpenThesis: () => void; readFailed: boolean }) {
  const eventQuery = useQuery({ queryKey: ["investment-narrative"], queryFn: ({ signal }) => getInvestmentNarrative(signal), retry: false, refetchOnWindowFocus: false, staleTime: 60_000 })
  const news = eventQuery.isError ? null : eventQuery.data?.news_events
  const version = b.session ? BRIEF_SESSION_LABELS[b.session] : null
  const updates = today?.updates ?? []
  // The producer's own cycle line. Empty from a producer too old to send it, in
  // which case the day still renders through the per-story cards below.
  const timeline = today?.timeline ?? []
  const hiddenUpdateReasons = new Map(updates.flatMap(item =>
    item.id && item.portfolio_impact ? [[item.id, item.portfolio_impact.trim()] as const] : []))
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
  const stories = buildTodayStories(b.date, b.events, [])
  const envelopeIncomplete = b.envelope && b.envelope.completeness !== "ready"
  const headline = b.headline.trim()
  const decisionSummary = b.state === "stale" ? "" : today?.decision_summary?.trim() || ""
  const cutoffClock = taipeiClock(b.source_cutoff)
  const scanNote = newsStatus?.state === "no-change" ? null : newsScanNote(newsStatus, b.source_cutoff)
  return <section aria-label="今日簡報" className="flex min-w-0 flex-col gap-6 break-words">
    <TodayNextSteps b={b} today={today} readFailed={readFailed} />
    <TodayIntradayReading today={today} readFailed={readFailed} />
    <TodayCheckpointReviews projection={today?.checkpoint_reviews} readFailed={readFailed} synthetic={DEMO_MODE} />
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
      {visibleTimeline.length
        ? <details className="text-caption text-ink-3"><summary className="cursor-pointer py-1">簡報版次與掃描時間軸</summary><DayTimeline nodes={visibleTimeline} brief={b} showBriefMarketObservations hiddenMarketObservationKeys={hiddenMarketObservationKeys} hiddenUpdateReasons={hiddenUpdateReasons} /></details>
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
  const [startingRefresh, setStartingRefresh] = useState<ReadonlySet<InvestmentRefreshAction>>(() => new Set())
  const pendingRefresh = useRef(new Set<InvestmentRefreshAction>())
  const client = useQueryClient()
  const query = useQuery({ queryKey: ["investment"], queryFn: ({ signal }) => getInvestment(signal), retry: false, refetchOnWindowFocus: true, staleTime: 60_000 })
  const marketRefresh = useQuery({ queryKey: ["investment-refresh-status", "market"], queryFn: ({ signal }) => getInvestmentRefreshStatus("market", signal), retry: false, refetchOnMount: "always", refetchOnWindowFocus: false, refetchInterval: (q) => q.state.data?.state === "running" ? 2_000 : false })
  const newsRefresh = useQuery({ queryKey: ["investment-refresh-status", "news"], queryFn: ({ signal }) => getInvestmentRefreshStatus("news", signal), retry: false, refetchOnMount: "always", refetchOnWindowFocus: false, refetchInterval: (q) => q.state.data?.state === "running" ? 2_000 : false })
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
  async function runRefresh(action: InvestmentRefreshAction, market?: InvestmentNewsScope) {
    if (pendingRefresh.current.has(action) || (action === "news" ? newsRefresh.data?.state : marketRefresh.data?.state) === "running") return
    pendingRefresh.current.add(action)
    setStartingRefresh(current => new Set(current).add(action))
    setRefreshError("")
    try {
      const status = await postInvestmentRefresh(action, market)
      client.setQueryData(["investment-refresh-status", action], status)
      await client.invalidateQueries({ queryKey: ["investment-refresh-status", action] })
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "更新操作失敗，請稍後重試。")
    } finally {
      pendingRefresh.current.delete(action)
      setStartingRefresh(current => { const next = new Set(current); next.delete(action); return next })
    }
  }

  return <div className="flex min-w-0 flex-col gap-4 break-words">
    <PageHeader page="investment" />
    {view === "today" ? <div className="flex min-w-0 flex-col gap-2" aria-label="Today 更新操作">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button disabled={startingRefresh.has("market") || marketRefresh.data?.state === "running"} onClick={() => void runRefresh("market")}>刷新盤面</Button>
        <Button disabled={startingRefresh.has("news") || newsRefresh.data?.state === "running"} onClick={() => void runRefresh("news", "both")}>更新消息</Button>
        {marketRefresh.isError || newsRefresh.isError ? <Button disabled={marketRefresh.isFetching || newsRefresh.isFetching} title="只重新讀取狀態，不會啟動行情或新聞刷新" onClick={() => void rereadInvestmentRefreshStatuses(() => marketRefresh.refetch(), () => newsRefresh.refetch())}>重新讀取狀態</Button> : null}
      </div>
      <p className="text-caption text-ink-3">更新台股與美股消息，結果集中在盤中更新。</p>
    </div> : null}
    <InvestmentRefreshDetails marketStatus={marketRefresh.data} newsStatus={newsRefresh.data} marketError={marketRefresh.error} newsError={newsRefresh.error} operationError={refreshError} refresh={query.data?.today?.intraday_refresh} readFailed={query.isError} />
    <nav aria-label="投資內容" className="flex min-w-0 gap-4 overflow-x-auto border-b border-line-soft sm:gap-5" role="tablist">{VIEWS.map(([key, label], index) => <Button key={key} id={`investment-tab-${key}`} role="tab" aria-controls={`investment-panel-${key}`} aria-selected={view === key} tabIndex={view === key ? 0 : -1} variant="link" className={`shrink-0 rounded-none border-b-2 px-0 py-3 ${view === key ? "border-accent text-ink" : "border-transparent text-ink-3"}`} onClick={() => setView(key)} onKeyDown={event => {
      const next = event.key === "ArrowRight" ? (index + 1) % VIEWS.length : event.key === "ArrowLeft" ? (index + VIEWS.length - 1) % VIEWS.length : event.key === "Home" ? 0 : event.key === "End" ? VIEWS.length - 1 : null
      if (next !== null) { event.preventDefault(); openView(VIEWS[next][0]) }
    }}>{label}</Button>)}</nav>
    <div id="investment-panel-today" role="tabpanel" aria-labelledby="investment-tab-today" hidden={view !== "today"} className={view === "today" ? "flex min-w-0 flex-col gap-5" : "hidden"}>
      {query.isError ? <p role="alert" className="text-body text-warn">簡報讀取失敗。{b ? "目前保留上次內容。" : ""}請按更新資料重試。</p> : null}
      {query.isPending ? <p className="text-body text-ink-3">讀取簡報中…</p> : null}
      {b ? <TodayBrief b={b} today={query.data?.today} readFailed={query.isError} newsStatus={newsRefresh.data} onOpenThesis={() => openView("thesis")} /> : null}
      {!b && !query.isPending ? <TodayIntradayReading today={query.data?.today} readFailed={query.isError} /> : null}
      {!b && !query.isPending ? <TodayCheckpointReviews projection={query.data?.today?.checkpoint_reviews} readFailed={query.isError} synthetic={DEMO_MODE} /> : null}
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
    <div id="investment-panel-thesis" role="tabpanel" aria-labelledby="investment-tab-thesis" hidden={view !== "thesis"} className={view === "thesis" ? "judgment-workspace flex min-w-0 flex-col gap-5" : "hidden"}>
      <InvestmentNarrativeSection enabled={view === "thesis"} onOpenHistory={() => openView("history")}>
      {query.isPending ? <p className="text-body text-ink-3">讀取簡報中…</p> : null}
      {query.isError ? <p role="alert" className="text-body text-warn">簡報讀取失敗。{b ? "目前保留上次讀取的資料；資料截止時間仍以簡報標示為準。" : "目前沒有可用的簡報資料。"}請按更新資料重試。</p> : null}
      {b ? <InvestmentThesis b={b} /> : null}
      </InvestmentNarrativeSection>
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
      <p>{DEMO_MODE ? "簡報、研究、日期與行情全由合成資料提供。更新資料只重讀範例，不連接帳戶或外部資料。" : "簡報、研究和日期讀取本機 Investment Note；行情向 Yahoo Finance 查詢。「刷新盤面」會先把本機 Investment Note 快轉到 GitHub 最新（只 fast-forward，本機有分岔或未提交重疊就停），不會重新生成正式簡報；若 Investment Note 提供已核實且明示可處理的財報結果，可能送出結果 PR 供審查，但不會自動合併。"}</p>
      <p>每週觀察：{query.data?.weekly_watch.date ?? "尚未取得日期"}。目前只提供日期，無法據此確認本週回顧是否完成。</p>
      <p>投資論點的自動檢查尚未接入；没有提醒不代表論點已通過檢查。</p>
      {watch.data ? <><p>已讀 {watch.data.watch.coverage.scanned_files} 份相關來源；{watch.data.watch.coverage.missing_catalysts.length} 份未填下次事件日期。未填日期不算讀取故障。</p>{watch.data.watch.coverage.errors.map((error, index) => <p key={index}>{error.path}：{error.message}</p>)}{watch.data.watch.coverage.omissions.length ? <p>另有 {watch.data.watch.coverage.omissions.length} 份相關來源未納入：{watch.data.watch.coverage.omissions.slice(0, 5).map(item => `${item.path}（${item.reason}）`).join("、")}</p> : null}</> : null}
    </div></details>
  </div>
}
