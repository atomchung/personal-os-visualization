import { useState } from "react"
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query"
import { DEMO_MODE } from "@/lib/transport"
import { Button } from "@/components/ui/button"
import { Card, CardSection, ReadingColumn, SectionHeading, SubsectionHeading } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { PageHeader } from "@/components/ui/page-header"
import { MarketIndicators } from "./MarketIndicators"
import { StockMomentum } from "./StockMomentum"
import {
  actionStatusLabel, actionStatusNote, briefJudgmentView, briefSessionRows, BRIEF_SESSION_LABELS, groupBriefRows, numberedTargets, openActionItems, todayActionPlan, todayActionSection, todayNextSteps,
  sourceTimestamp,
} from "@/lib/investmentFormat"
import { ResearchWatch, ResearchLibrary, CatalystProjection } from "./ResearchWatch"
import { ReadingText, InlineText } from "./ReadingText"
import { InvestmentWorkPanel, InvestmentWatchNotes } from "./InvestmentWork"
import { PendingBoard } from "./InvestmentPending"
import { InvestmentHistory } from "./InvestmentHistory"
import { InvestmentNarrativeSection } from "./InvestmentNarrative"
import { anchorRelativeDay, buildTodayStories, taipeiCalendarDate, todayStoryHeadline, type TodayStory } from "@/lib/investmentToday"
import {
  getInvestment, getInvestmentWatch, getInvestmentMarket, getInvestmentPulse,
  getTwRelativeStrength, getInvestmentPending, getInvestmentHistory, getInvestmentContext, getInvestmentResearch,
  getInvestmentSource, getInvestmentWork,
  getInvestmentActions, getMarketExplore, getInvestmentNarrative,
  type InvestmentActionItem, type InvestmentBrief, type InvestmentSource, type InvestmentTodayView,
} from "@/lib/investment"

function SourceText({ source }: { source: InvestmentSource }) {
  const [open, setOpen] = useState(false)
  const query = useQuery({ queryKey: ["investment-source", source.id, source.generated_at], queryFn: ({ signal }) => getInvestmentSource(source.id, signal), enabled: open, staleTime: 0, retry: false, refetchOnWindowFocus: false })
  return <details onToggle={e => setOpen(e.currentTarget.open)}>
    <summary className="cursor-pointer py-2 text-body font-medium">閱讀完整簡報 · {source.date ?? "日期未提供"}</summary>
    <div className="w-full pt-3">{query.isPending ? <p className="text-body text-ink-3">載入原文中…</p> : query.isError ? <p role="alert" className="text-body text-warn">簡報原文讀取失敗，請按更新資料。</p> : query.data ? <ReadingText text={query.data.text} /> : null}</div>
  </details>
}

function todayText(text: string): string {
  return text
    .replace(/\bCORE\b/g, "半導體核心（NVDA／台積電）")
    .replace(/\bMEMORY\b/g, "記憶體")
    .replace(/\bINTERCONNECT\b/g, "AI 互連")
    .replace(/相對強度/g, "相對大盤強弱")
}

function todayBriefText(text: string, briefDate: string | null): string {
  return anchorRelativeDay(todayText(text), briefDate)
}

function StoryPoint({ label, text, date }: { label: string; text: string; date: string | null }) {
  const content = todayBriefText(text, date)
  const targets = numberedTargets(content)
  return <li><span className="font-medium text-ink">{label}：</span>{targets ? <>
    {targets.intro ? <InlineText text={targets.intro} /> : null}
    <ul className="mt-1 flex flex-col gap-1 pl-5 [list-style-type:circle]">{targets.items.map((item, index) => <li key={index}><InlineText text={item} /></li>)}</ul>
  </> : <InlineText text={content} />}</li>
}

function ThesisRows({ rows, briefDate }: { rows: InvestmentBrief["thesis_changes"]; briefDate: string | null }) {
  return <ul className="flex flex-col gap-3">{rows.map((row, index) => <li key={index} className="text-body leading-relaxed text-ink-2">
    <p><span className="font-medium text-ink"><InlineText text={todayBriefText(row.thesis, briefDate)} /></span>{row.change ? <> · <InlineText text={todayBriefText(row.change, briefDate)} /></> : null}</p>
    {row.reason && row.reason.length <= 80 ? <p className="mt-1"><InlineText text={todayBriefText(row.reason, briefDate)} /></p> : null}
    {row.reason && row.reason.length > 80 ? <details className="text-caption text-ink-3"><summary className="cursor-pointer py-1">查看變化理由</summary><p className="pt-1 text-body text-ink-2"><InlineText text={todayBriefText(row.reason, briefDate)} /></p></details> : null}
  </li>)}</ul>
}

function RiskRows({ rows, briefDate }: { rows: InvestmentBrief["risks"]; briefDate: string | null }) {
  return <ul className="flex flex-col gap-3">{rows.map((row, index) => <li key={index} className="text-body leading-relaxed text-ink-2">
    <p className="font-medium text-warn"><InlineText text={todayBriefText(row.risk, briefDate)} /></p>
    {row.status && row.status.length <= 80 ? <p className="mt-1"><InlineText text={todayBriefText(row.status, briefDate)} /></p> : null}
    {row.status && row.status.length > 80 ? <details className="text-caption text-ink-3"><summary className="cursor-pointer py-1">查看風險狀態</summary><p className="pt-1 text-body text-ink-2"><InlineText text={todayBriefText(row.status, briefDate)} /></p></details> : null}
  </li>)}</ul>
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

function ContinuationList({ items, compact = false, olderCount = 0, onOpenWork }: { items: InvestmentActionItem[]; compact?: boolean; olderCount?: number; onOpenWork?: () => void }) {
  if (!items.length && !olderCount) return null
  const limit = compact ? 2 : 8
  const shown = items.slice(0, limit)
  const rest = items.slice(limit)
  return <div className="flex min-w-0 flex-col gap-2">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <SubsectionHeading>來源記錄的待續行動</SubsectionHeading>
      {onOpenWork ? <Button variant="link" onClick={onOpenWork}>到研究與策略</Button> : null}
    </div>
    <p className="text-caption text-ink-3">{compact ? "還沒結束；可到研究與策略接著看。" : "來自判斷與研究紀錄，和你在本機記下的問題分開。"}{olderCount ? ` 更早的 ${olderCount} 項留在「研究與策略」。` : ""}</p>
    <ul className="flex min-w-0 flex-col gap-2">{shown.map(item => <ContinuationRow key={item.id} item={item} showDate={!compact} />)}</ul>
    {rest.length ? <details><summary className="cursor-pointer py-2 text-caption font-medium">來源另列 {rest.length} 項</summary><ul className="mt-2 flex min-w-0 flex-col gap-2">{rest.map(item => <ContinuationRow key={item.id} item={item} showDate={!compact} />)}</ul></details> : null}
  </div>
}

function TodayActionRow({ entry, brief, primary = false }: {
  entry: ReturnType<typeof todayActionPlan>["actions"][number]
  brief: InvestmentBrief
  primary?: boolean
}) {
  const formalVersion = brief.session ? BRIEF_SESSION_LABELS[brief.session] : "版次未標示"
  const sourceDate = entry.origin === "update" ? taipeiCalendarDate(entry.date) : brief.date
  return <li data-testid={primary ? "primary-next-step" : "secondary-next-step"} className={`flex min-w-0 flex-col gap-2 ${primary ? "border-l-2 border-accent/50 pl-3" : ""}`}>
    <p className="text-caption font-medium text-ink-3">{entry.origin === "update" ? "盤中更新" : primary ? "優先閱讀的下一步" : "其他下一步"}{entry.origin === "brief" ? ` · ${entry.sourceKind === "watch" ? "等／觀察" : entry.sourceKind === "research" ? "查／研究" : entry.sourceKind === "action" ? "做／行動" : "做／等／查分類未提供"}` : ""}</p>
    <p className="text-body leading-relaxed text-ink-2"><InlineText text={todayBriefText(entry.text.replace(/^(?:補研究|补研究)(?:[：:]|\s)+/, ""), sourceDate)} /></p>
    {entry.origin === "brief" ? <>
      <p className="text-caption text-ink-3">為什麼現在：來源未提供此項獨立理由。</p>
      <p className="text-caption text-ink-3">何時再看：來源未提供此項明確日期或觸發條件；保留上方原文。</p>
      <p className="text-caption text-ink-3">目前狀態：{entry.sourceStatus ? actionStatusLabel(entry.sourceStatus) : "來源未提供"}</p>
    </> : <p className="text-caption text-ink-3">盤中時間：{sourceTimestamp(entry.date)}</p>}
    <details>
      <summary className="cursor-pointer py-1 text-caption text-ink-3">查看來源</summary>
      <div className="flex flex-col gap-1 pt-1 text-caption text-ink-3">
        <p>來源：{entry.source ?? "未提供"}</p>
        {entry.origin === "brief" ? <p>正式簡報：{entry.date ?? "日期未提供"} · {formalVersion}</p> : null}
        {entry.origin === "update" ? <p className="break-all">更新 ID：{entry.id ?? "未提供"}</p> : <>
          {entry.id ? <p>行動 ID：{entry.id}</p> : null}
          <p>簡報截止：{sourceTimestamp(brief.source_cutoff)}</p>
          <p>簡報產出：{sourceTimestamp(brief.generated_at)}</p>
        </>}
      </div>
    </details>
  </li>
}

function StructuredBriefJudgment({ brief }: { brief: InvestmentBrief }) {
  const view = briefJudgmentView(brief.judgment)
  if (!view) return null
  const label = view.class === "trade" ? "交易" : view.class === "watch" ? "觀察" : "忽略"
  const tone = view.class === "trade" ? "warn" as const : view.class === "watch" ? "info" as const : "mute" as const
  const formalVersion = brief.session ? BRIEF_SESSION_LABELS[brief.session] : "版次未標示"
  return <div data-testid="structured-brief-judgment" className="flex min-w-0 flex-col gap-2 border-l-2 border-accent/50 pl-3">
    <div className="flex flex-wrap items-center gap-2"><Chip tone={tone}>{label}</Chip><p className="text-body font-medium leading-relaxed text-ink"><InlineText text={todayBriefText(view.judgment, brief.date)} /></p></div>
    <p className="text-caption leading-relaxed text-ink-2"><span className="font-medium text-ink">為什麼現在：</span><InlineText text={todayBriefText(view.whyNow, brief.date)} /></p>
    {view.revisit ? <p className="text-caption leading-relaxed text-ink-2"><span className="font-medium text-ink">何時回看：</span><InlineText text={todayBriefText(view.revisit, brief.date)} /></p> : null}
    {view.decisionEffect ? <p className="text-caption leading-relaxed text-ink-2"><span className="font-medium text-ink">什麼會改變判斷：</span><InlineText text={todayBriefText(view.decisionEffect, brief.date)} /></p> : null}
    <details className="text-caption text-ink-3">
      <summary className="cursor-pointer py-1">查看來源</summary>
      <div className="flex min-w-0 flex-col gap-1 pt-1">
        <p>正式簡報：{brief.date ?? "日期未提供"} · {formalVersion}</p>
        <p>簡報截止：{sourceTimestamp(view.provenance?.source_cutoff ?? brief.source_cutoff)}</p>
        {view.provenance?.validated_story_ids?.length ? <p className="break-all">事件 ID：{view.provenance.validated_story_ids.join("、")}</p> : null}
        {view.provenance?.source_revision ? <p className="break-all">來源修訂：{view.provenance.source_revision}</p> : null}
        {view.provenance?.artifact ? <p className="break-all">來源：{view.provenance.artifact}</p> : null}
        {view.provenance?.declared_unverified ? <p className="break-all">來源原始參照：{view.provenance.declared_unverified}</p> : null}
      </div>
    </details>
  </div>
}

type TodayBriefRows = {
  theses: { byEvent: InvestmentBrief["thesis_changes"][]; unlinked: InvestmentBrief["thesis_changes"] }
  risks: { byEvent: InvestmentBrief["risks"][]; unlinked: InvestmentBrief["risks"] }
}

function TodayStoryCard({ story, theses, risks, briefDate }: {
  story: TodayStory
  theses: TodayBriefRows["theses"]
  risks: TodayBriefRows["risks"]
  briefDate: string | null
}) {
  const latestUpdate = story.updates[0]
  const heading = todayStoryHeadline(story)
  const headingDate = latestUpdate ? taipeiCalendarDate(latestUpdate.observed_at) : briefDate
  const latestImpact = latestUpdate?.portfolio_impact.trim()
  const latestAction = latestUpdate?.action.trim()
  const hasSources = story.updates.length > 0 || Boolean(story.story_id)
  return <CardSection as="article" density="normal">
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
      <div className="min-w-0">
        {latestUpdate ? <p className="text-caption font-medium text-ink-3">目前狀態</p> : null}
        <SubsectionHeading><InlineText text={todayBriefText(heading, headingDate)} /></SubsectionHeading>
      </div>
      {latestUpdate ? <span className="shrink-0 metadata">更新於 {sourceTimestamp(latestUpdate.observed_at)}</span> : null}
    </div>
    {story.updates.map((item, index) => <div key={item.id} className="flex min-w-0 flex-col gap-2">
      {index > 0 ? <p className="text-caption font-medium text-ink-3">較早盤中觀察 · {sourceTimestamp(item.observed_at)}</p> : null}
      {item.summary.trim() !== heading.trim() ? <p className="text-body leading-relaxed text-ink-2"><InlineText text={todayBriefText(item.summary, taipeiCalendarDate(item.observed_at))} /></p> : null}
      {item.portfolio_impact ? <ul className="flex min-w-0 flex-col gap-2 pl-5 text-body leading-relaxed text-ink-2 [list-style-type:disc]">
        {item.portfolio_impact ? <StoryPoint label="對判斷的影響" text={item.portfolio_impact} date={taipeiCalendarDate(item.observed_at)} /> : null}
      </ul> : null}
      {item.action ? <details className="text-caption text-ink-3"><summary className="cursor-pointer py-1">這筆更新的原始提醒</summary><p className="pt-1 text-body leading-relaxed text-ink-2"><InlineText text={todayBriefText(item.action, taipeiCalendarDate(item.observed_at))} /></p></details> : null}
    </div>)}
    {story.events.map(({ event, event_index }, index) => <details key={event_index} open={!story.updates.length} className="min-w-0 text-ink-3">
      <summary className="cursor-pointer py-1 text-caption font-medium">{index === 0 ? "正式簡報基線與論據" : "同故事中的另一份正式簡報"}</summary>
      <div className="flex min-w-0 flex-col gap-2 pt-2">
      {event.event.trim() !== heading.trim() ? <p className="text-body font-medium leading-relaxed text-ink"><InlineText text={todayBriefText(event.event, briefDate)} /></p> : null}
      {event.market_reaction ? <p className="text-body leading-relaxed text-ink-2"><span className="font-medium text-ink">簡報市場反應：</span><InlineText text={todayBriefText(event.market_reaction, briefDate)} /></p> : null}
      {event.interpretation ? <p className="text-body leading-relaxed text-ink-2"><span className="font-medium text-ink">簡報市場解讀：</span><InlineText text={todayBriefText(event.interpretation, briefDate)} /></p> : null}
      {event.impact && event.impact.trim() !== latestImpact ? <p className="text-body leading-relaxed text-ink-2"><span className="font-medium text-ink">簡報基線的持倉影響：</span><InlineText text={todayBriefText(event.impact, briefDate)} /></p> : null}
      {event.today && event.today.trim() !== latestAction ? <p className="text-body leading-relaxed text-ink-2"><span className="font-medium text-ink">簡報基線提醒：</span><InlineText text={todayBriefText(event.today, briefDate)} /></p> : null}
      </div>
    </details>)}
    {story.events.map(({ event_index }) => theses.byEvent[event_index].length || risks.byEvent[event_index].length ? <div key={`judgment-${event_index}`} className="flex min-w-0 flex-col gap-3 border-t border-line-soft pt-3">
      {theses.byEvent[event_index].length ? <div><p className="mb-2 text-caption font-medium text-ink-3">此事件的論點變化</p><ThesisRows rows={theses.byEvent[event_index]} briefDate={briefDate} /></div> : null}
      {risks.byEvent[event_index].length ? <div><p className="mb-2 text-caption font-medium text-warn">此事件的風險</p><RiskRows rows={risks.byEvent[event_index]} briefDate={briefDate} /></div> : null}
    </div> : null)}
    {hasSources ? <details className="border-t border-line-soft pt-2 text-caption text-ink-3">
      <summary className="cursor-pointer py-1">來源與事件身分</summary>
      {story.story_id ? <p className="pt-1">事件 ID：{story.story_id}</p> : <p className="pt-1">來源沒有提供可用的事件 ID；此項目保持獨立。</p>}
      {story.updates.length ? <ul className="flex min-w-0 flex-col gap-1 pt-1">{story.updates.map(item => <li key={item.id} className="break-all">{item.id} · {sourceTimestamp(item.observed_at)} · {item.source_path}</li>)}</ul> : null}
    </details> : null}
  </CardSection>
}

function TodayBriefSessions({ brief, hasUpdates }: { brief: InvestmentBrief; hasUpdates: boolean }) {
  const rows = briefSessionRows(brief)
  const selected = rows.find(row => row.matches)
  return <section aria-label="簡報版本" className="flex min-w-0 flex-col gap-2 border-b border-line-soft pb-3">
    <p className="metadata">{brief.date ? sourceTimestamp(brief.date) : "日期未提供"} · {selected?.label ?? "版次未標示"}</p>
    <p className="metadata">資訊截至 {sourceTimestamp(brief.source_cutoff)}{hasUpdates ? " · 下方另列盤中更新" : ""}</p>
    <details className="text-caption text-ink-3"><summary className="cursor-pointer py-1">班次與產出時間</summary>
      <p className="pt-1">實際產出：{sourceTimestamp(brief.generated_at)}。班次時段是目標，不代表自動產出或送達；共享資料沒有排程狀態。</p>
      <ul className="mt-2 flex flex-col gap-1">{rows.map(row => <li key={row.session}>{row.label} · 目標 {row.targetTime} 台北 · {row.matches ? "本次所選簡報" : "本次資料未提供此班次"}</li>)}</ul>
    </details>
  </section>
}

/** Reading structure only. Meaning, order, changes and event links come from the source. */
function TodayNextSteps({ b, today, readFailed }: { b: InvestmentBrief; today?: InvestmentTodayView; readFailed: boolean }) {
  const actionPlan = todayActionPlan(b, today, readFailed)
  const actionSection = todayActionSection(b)
  const structuredCandidate = briefJudgmentView(b.judgment)
  const formalEntries = [...actionPlan.actions, ...actionPlan.research].filter(entry => entry.origin === "brief")
  // The producer emits a judgment only for one primary formal item. If the
  // payload contradicts that invariant, keep every legacy item visible.
  const structuredJudgment = structuredCandidate && formalEntries.length === 1 ? structuredCandidate : null
  const displayPlan = structuredJudgment ? {
    ...actionPlan,
    actions: actionPlan.actions.filter(entry => entry.origin === "update"),
    research: actionPlan.research.filter(entry => entry.origin === "update"),
  } : actionPlan
  const nextSteps = todayNextSteps(displayPlan)
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label={actionSection.heading}>
      <div className="flex min-w-0 flex-col gap-1">
        <SectionHeading>{actionSection.heading}</SectionHeading>
        {actionSection.context ? <p className="text-caption text-warn">{actionSection.context}</p> : null}
      </div>
      <Card density="reading" className="min-w-0">
        {today?.decision_summary ? <p className="mb-3 text-body font-medium leading-relaxed text-ink"><InlineText text={todayBriefText(today.decision_summary, today.decision_summary_date ?? null)} /></p> : null}
        {actionPlan.coverageMessage ? <p role="status" className="mb-3 text-caption leading-relaxed text-warn">{actionPlan.coverageMessage}</p> : null}
        {structuredJudgment ? <StructuredBriefJudgment brief={b} /> : <p className="mb-3 text-caption text-ink-3">先列來源的行動／觀察，再列補研究；同類維持來源順序，這是閱讀順序。</p>}
        {nextSteps.primary ? <ul className={`flex min-w-0 flex-col gap-4 ${structuredJudgment ? "mt-4 border-t border-line-soft pt-3" : ""}`}><TodayActionRow entry={nextSteps.primary} brief={b} primary />{nextSteps.secondary.map(entry => <TodayActionRow key={entry.key} entry={entry} brief={b} />)}</ul> : structuredJudgment ? null : <p className="text-body text-ink-3">{actionPlan.emptyMessage} 未列出項目不代表今天不用動；行動狀態與再看條件仍未知。</p>}
        {nextSteps.remaining.length ? <details className="mt-3 border-t border-line-soft pt-2 text-caption text-ink-3"><summary className="cursor-pointer py-1">其他更新 · {nextSteps.remaining.length} 項</summary><ul className="mt-2 flex min-w-0 flex-col gap-3">{nextSteps.remaining.map(entry => <TodayActionRow key={entry.key} entry={entry} brief={b} />)}</ul></details> : null}
        {b.upcoming.length ? <details className="mt-3 border-t border-line-soft pt-2 text-caption text-ink-3"><summary className="cursor-pointer py-1">其他近期檢查</summary><p className="py-2">這些檢查點沒有明示與上方判斷的關係，因此分開列出。</p><ul className="flex flex-col gap-2">{b.upcoming.map((item, index) => <li key={index}>{item.date_label} · <InlineText text={item.event} />{item.check ? <p>要看什麼：<InlineText text={item.check} /></p> : <p>驗證條件未提供。</p>}</li>)}</ul></details> : null}
        {b.thesis_changes.length || b.risks.length ? <p className="mt-4 border-t border-line-soft pt-3 text-caption leading-relaxed text-ink-3">論點變化 {b.thesis_changes.length} 條、風險 {b.risks.length} 條；見下方事件與「未連結故事的判斷與風險」。來源未標明與哪項行動相關。</p> : null}
        {b.headline ? <details className="mt-4 border-t border-line-soft pt-3 text-caption text-ink-3"><summary className="cursor-pointer py-1">晨報判斷</summary><div className="w-full pt-2 text-body leading-relaxed text-ink-2"><ReadingText text={todayBriefText(b.headline, b.date)} /></div></details> : null}
        {b.source?.limitations.length || b.envelope?.limitations.length ? <details className="mt-3 border-t border-line-soft pt-3 text-caption text-ink-3"><summary className="cursor-pointer py-1">資料完整度</summary>
          {b.envelope?.producer ? <p className="mt-2">產出方式：{b.envelope.producer}</p> : null}
          {b.envelope?.limitations.length ? <ul className="mt-2 list-disc pl-4 text-warn">{b.envelope.limitations.map((limitation, index) => <li key={`envelope-${index}`}>{limitation}</li>)}</ul> : null}
          {b.source?.limitations.length ? <ul className="mt-2 list-disc pl-4 text-warn">{b.source.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul> : null}
        </details> : null}
      </Card>
    </section>
  )
}

function TodayBrief({ b, today }: { b: InvestmentBrief; today?: InvestmentTodayView }) {
  const updates = today?.updates ?? []
  const stories = buildTodayStories(b.date, b.events, updates)
  const theses = groupBriefRows(b.thesis_changes, b.events.length)
  const risks = groupBriefRows(b.risks, b.events.length)
  const hasUnlinked = theses.unlinked.length > 0 || risks.unlinked.length > 0 || b.thesis_notes.length > 0 || b.risk_notes.length > 0
  const envelopeIncomplete = b.envelope && b.envelope.completeness !== "ready"
  return <section aria-label="今日簡報" className="flex min-w-0 flex-col gap-6 break-words">


    <TodayBriefSessions brief={b} hasUpdates={updates.length > 0} />
    <section aria-label="今天發生了什麼" className="flex min-w-0 flex-col gap-3">
      <SectionHeading>今天發生了什麼</SectionHeading>
      {b.state === "stale" ? <p role="status" className="text-caption text-warn">這是較早的正式簡報；目前尚無今日新版。</p> : null}
      {b.state === "invalid" ? <p role="status" className="text-caption text-warn">這份簡報部分內容未能辨識，已保留可讀段落與完整原文。</p> : null}
      {envelopeIncomplete ? <p role="status" className="text-caption text-warn">{b.envelope?.completeness === "partial" ? "這份簡報資料不完整；細節可在下方來源展開查看。" : "這份簡報的資料包目前無法確認是否完整。"}</p> : null}
      {stories.length ? <Card className="min-w-0 divide-y divide-line-soft overflow-hidden">
        {stories.map(story => <TodayStoryCard key={story.key} story={story} theses={theses} risks={risks} briefDate={b.date} />)}
      </Card> : b.headline ? <Card density="reading" className="min-w-0"><ReadingText text={todayBriefText(b.headline, b.date)} /></Card> : <p className="text-body text-ink-3">尚未取得可讀的今日變化。</p>}
      {b.event_notes.length ? <ReadingText text={todayBriefText(b.event_notes.join("\n\n"), b.date)} /> : null}
      {hasUnlinked ? <details className="text-caption text-ink-3"><summary className="cursor-pointer py-1">未連結故事的判斷與風險</summary><Card density="reading" className="mt-2 grid min-w-0 gap-4">
        {theses.unlinked.length > 0 || b.thesis_notes.length > 0 ? <div className="flex min-w-0 flex-col gap-3"><ThesisRows rows={theses.unlinked} briefDate={b.date} />{b.thesis_notes.length ? <ReadingText text={todayBriefText(b.thesis_notes.join("\n\n"), b.date)} /> : null}</div> : null}
        {risks.unlinked.length > 0 || b.risk_notes.length > 0 ? <div className="flex min-w-0 flex-col gap-3"><p className="text-caption font-medium text-warn">要留意的風險</p><RiskRows rows={risks.unlinked} briefDate={b.date} />{b.risk_notes.length ? <ReadingText text={todayBriefText(b.risk_notes.join("\n\n"), b.date)} /> : null}</div> : null}
      </Card></details> : null}
    </section>


    {b.source ? <div className="border-t border-line-soft"><SourceText key={b.source.id} source={b.source} /></div> : null}
  </section>
}

const VIEWS = [["today", "今日"], ["judgment", "我的判斷"], ["research", "研究與策略"], ["review", "復盤與學習"]] as const
type View = typeof VIEWS[number][0]

export function InvestmentPage() {
  const [view, setView] = useState<View>("today")
  const [refreshing, setRefreshing] = useState(false)
  const [notice, setNotice] = useState("")
  const client = useQueryClient()
  const fetching = useIsFetching({ predicate: q => String(q.queryKey[0]).startsWith("investment") })
  const query = useQuery({ queryKey: ["investment"], queryFn: ({ signal }) => getInvestment(signal), retry: false, refetchOnWindowFocus: true, staleTime: 60_000 })
  const watch = useQuery({ queryKey: ["investment-watch"], queryFn: ({ signal }) => getInvestmentWatch(signal), enabled: view === "research", retry: false, refetchOnWindowFocus: false })
  const researchIndex = useQuery({ queryKey: ["investment-research"], queryFn: ({ signal }) => getInvestmentResearch(signal), enabled: view === "research", retry: false, refetchOnWindowFocus: false })
  const actions = useQuery({ queryKey: ["investment-actions"], queryFn: ({ signal }) => getInvestmentActions(signal), enabled: view === "research", retry: false, refetchOnWindowFocus: false, staleTime: 60_000 })
  const history = useQuery({ queryKey: ["investment-history"], queryFn: ({ signal }) => getInvestmentHistory(signal), enabled: view === "review", retry: false, refetchOnWindowFocus: false })
  const context = useQuery({ queryKey: ["investment-context"], queryFn: ({ signal }) => getInvestmentContext(signal), enabled: view === "review", retry: false, refetchOnWindowFocus: false })
  const hub = useQuery({ queryKey: ["investment-narrative"], queryFn: ({ signal }) => getInvestmentNarrative(signal), enabled: view === "today" || view === "research", retry: false, refetchOnWindowFocus: false, staleTime: 60_000 })
  const b = query.data?.brief
  const workContinuation = openActionItems(actions.data?.items ?? [])
  const openSourceActions = workContinuation.filter(item => item.status === "open")
  const sourceActionsWithHome = workContinuation.filter(item => item.status === "has-canonical-home")
  function openView(next: View) {
    setView(next)
    document.getElementById(`investment-tab-${next}`)?.focus()
  }
  async function refresh() {
    setRefreshing(true)
    setNotice("正在更新目前頁面的資料…")
    const failures: string[] = []
    async function run<T>(label: string, key: readonly unknown[], fn: () => Promise<T>): Promise<T | undefined> {
      try { return await client.fetchQuery({ queryKey: key, queryFn: fn, staleTime: 0, retry: false }) }
      catch { failures.push(label); return undefined }
    }
    try {
      if (view === "today") {
        const [brief, market, explore, pulse] = await Promise.all([
          run("簡報", ["investment"], () => getInvestment()),
          run("市場行情", ["investment-market"], () => getInvestmentMarket(undefined, true)),
          run("市場探索", ["investment-explore"], () => getMarketExplore(undefined, true)),
          run("台股整體盤感", ["investment-pulse"], () => getInvestmentPulse()),
          run("催化劑投影", ["investment-narrative"], () => getInvestmentNarrative()),
          run("台股持倉相對強弱", ["investment-tw-relative-strength"], () => getTwRelativeStrength()),
        ])
        if (brief?.brief.state === "invalid" || brief?.brief.state === "missing") failures.push("簡報內容")
        if (brief?.brief.source?.limitations.length) failures.push("簡報部分段落")
        if (market?.state === "unavailable" || market?.state === "partial") failures.push("部分市場報價")
        if (explore?.state === "partial") failures.push("部分市場探索")
        if (!pulse || pulse.state !== "ready") failures.push("台股整體盤感")
        await client.invalidateQueries({ queryKey: ["investment-source"], refetchType: "active" })
      } else if (view === "judgment") {
        const narrative = await run("我的判斷", ["investment-narrative"], () => getInvestmentNarrative())
        if (narrative && narrative.state !== "ready") failures.push("我的論點部分來源")
        if (!narrative) failures.push("我的論點")
      } else if (view === "research") {
        const [research, sourceDates, actionBoard, personalWork, systemReminders] = await Promise.all([
          run("正式 Research", ["investment-research"], () => getInvestmentResearch()),
          run("Watch 日期", ["investment-watch"], () => getInvestmentWatch()),
          run("待續行動", ["investment-actions"], () => getInvestmentActions()),
          run("我的投資事項", ["investment-work"], () => getInvestmentWork()),
          run("系統提醒", ["investment-pending"], () => getInvestmentPending()),
        ])
        await run("催化劑投影", ["investment-narrative"], () => getInvestmentNarrative())
        if (research && research.state !== "ready" && research.state !== "empty") failures.push("正式 Research 部分來源")
        if (sourceDates && ((sourceDates.state !== "ready" && sourceDates.state !== "empty") || sourceDates.watch.coverage.errors.length)) failures.push("部分 Watch 日期來源")
        if (actionBoard?.state === "unavailable") failures.push("待續行動")
        if (!personalWork) failures.push("我的投資事項")
        if (systemReminders && systemReminders.state !== "ready" && systemReminders.state !== "empty") failures.push("系統提醒部分來源")
      } else {
        const [records] = await Promise.all([
          run("歷史來源", ["investment-history"], () => getInvestmentHistory()),
          run("研究脈絡", ["investment-context"], () => getInvestmentContext()),
        ])
        if (records && records.state !== "ready") failures.push("部分歷史來源")
      }
      const at = new Date().toLocaleTimeString("zh-TW", { timeZone: "Asia/Taipei", hour12: false })
      setNotice(`${at} ${failures.length ? `已重新讀取，仍未取得：${[...new Set(failures)].join("、")}` : "已重新讀取目前頁面"}。各資料的截止時間仍以頁面標示為準。`)
    } finally { setRefreshing(false) }
  }
  return <div className="flex min-w-0 flex-col gap-4 break-words">
    <PageHeader page="investment" showSummary action={<Button disabled={refreshing || fetching > 0} onClick={() => void refresh()}>{refreshing ? "更新中…" : fetching > 0 ? "資料載入中…" : "更新資料"}</Button>} />
    {notice ? <p role="status" aria-live="polite" className="text-caption text-ink-3">{notice}</p> : null}
    <nav aria-label="投資內容" className="flex min-w-0 gap-4 overflow-x-auto border-b border-line-soft sm:gap-5" role="tablist">{VIEWS.map(([key, label], index) => <Button key={key} id={`investment-tab-${key}`} role="tab" aria-controls={`investment-panel-${key}`} aria-selected={view === key} tabIndex={view === key ? 0 : -1} variant="link" className={`shrink-0 rounded-none border-b-2 px-0 py-3 ${view === key ? "border-accent text-ink" : "border-transparent text-ink-3"}`} onClick={() => setView(key)} onKeyDown={event => {
      const next = event.key === "ArrowRight" ? (index + 1) % VIEWS.length : event.key === "ArrowLeft" ? (index + VIEWS.length - 1) % VIEWS.length : event.key === "Home" ? 0 : event.key === "End" ? VIEWS.length - 1 : null
      if (next !== null) { event.preventDefault(); openView(VIEWS[next][0]) }
    }}>{label}</Button>)}</nav>
    <div id="investment-panel-today" role="tabpanel" aria-labelledby="investment-tab-today" hidden={view !== "today"} className={view === "today" ? "flex min-w-0 flex-col gap-6" : "hidden"}>
      {query.isError ? <p role="alert" className="text-body text-warn">簡報讀取失敗。{b ? "目前保留上次內容。" : ""}請按更新資料重試。</p> : null}
      {query.isPending ? <p className="text-body text-ink-3">讀取簡報中…</p> : null}
      <ReadingColumn className="flex min-w-0 flex-col gap-6">
        {b ? <TodayNextSteps b={b} today={query.data?.today} readFailed={query.isError} /> : null}
        <CatalystProjection data={hub.data?.catalysts_30d} pending={hub.isPending} failed={hub.isError} />
        {b ? <TodayBrief b={b} today={query.data?.today} /> : null}
      </ReadingColumn>
      <MarketIndicators />
      <StockMomentum />
    </div>
    <div id="investment-panel-judgment" role="tabpanel" aria-labelledby="investment-tab-judgment" hidden={view !== "judgment"} className={view === "judgment" ? "flex min-w-0 flex-col gap-6" : "hidden"}>
      <ReadingColumn><InvestmentNarrativeSection enabled={view === "judgment"} onOpenHistory={() => openView("review")} /></ReadingColumn>
    </div>
    <div id="investment-panel-research" role="tabpanel" aria-labelledby="investment-tab-research" hidden={view !== "research"} className={view === "research" ? "flex min-w-0 flex-col gap-5" : "hidden"}>
      {watch.isError ? <p role="alert" className="text-body text-warn">Watch 日期來源本次讀取失敗。{watch.data ? "仍顯示上次內容。" : ""}</p> : null}
      {researchIndex.isError ? <p role="alert" className="text-body text-warn">正式 Research index 讀取失敗；不以 Watch 項目代替。</p> : null}
      {actions.isError ? <p role="status" className="text-caption text-warn">待續行動這次讀不到。{actions.data ? "以下保留上次內容。" : ""}本機筆記仍可使用。</p> : null}
      {actions.data?.state === "unavailable" ? <p role="status" className="text-caption text-warn">{actions.data.message || "待續行動目前無法取得。"}</p> : null}
      <ReadingColumn><CatalystProjection heading="未來 30 天催化劑" data={hub.data?.catalysts_30d} pending={hub.isPending} failed={hub.isError} /></ReadingColumn>
      {watch.data ? <details><summary className="cursor-pointer py-2 text-caption text-ink-3">既有 Watch 與簡報日期清單（涵蓋獨立）</summary><ReadingColumn><ResearchWatch data={watch.data} brief={b} /></ReadingColumn></details> : null}
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
      {actions.data && actions.data.state !== "unavailable" ? <section className="flex min-w-0 flex-col gap-2" aria-label="來源記錄的待續事項" data-testid="investment-source-actions">
        <SectionHeading>來源記錄的待續事項</SectionHeading>
        <p className="text-caption text-ink-3">按來源提供的 status 分開顯示。資料契約沒有判定哪些項目需要 owner 決策或代表系統狀態，因此不推定緊急程度；個人筆記與系統提醒另列。</p>
        {openSourceActions.length ? <details><summary className="cursor-pointer py-2 text-body font-medium">來源 status：尚未結案 · {openSourceActions.length} 項</summary><ReadingColumn className="pt-2"><ContinuationList items={openSourceActions} /></ReadingColumn></details> : null}
        {sourceActionsWithHome.length ? <details><summary className="cursor-pointer py-2 text-body font-medium">來源 status：已有判斷頁可承接 · {sourceActionsWithHome.length} 項</summary><ReadingColumn className="pt-2"><ContinuationList items={sourceActionsWithHome} /></ReadingColumn></details> : null}
        {!workContinuation.length ? <p className="text-body text-ink-3">目前讀取的來源沒有 status 為尚未結案或已有判斷頁可承接的記錄；這不代表已確認沒有需要 owner 決定的事項。</p> : null}
        {actions.data.limitations.map((note, index) => <p key={index} className="text-caption text-warn">{note}</p>)}
      </section> : null}
      <details className="border-t border-line-soft pt-2" data-testid="investment-personal-notes">
        <summary className="cursor-pointer py-2 text-body font-medium text-ink">PersonalOS 本機：我的問題與提醒</summary>
        <ReadingColumn className="flex min-w-0 flex-col gap-5 pt-3">
          <section className="flex min-w-0 flex-col gap-3" aria-label="我留下的問題與研究">
            <div className="flex flex-col gap-1"><SectionHeading>我留下的問題與研究</SectionHeading><p className="text-caption text-ink-3">只保存 PersonalOS 本機的結論與待續筆記，不會改寫正式判斷；它們與來源狀態和系統整理分開。</p></div>
            <InvestmentWorkPanel research={watch.data?.watch.research ?? []} />
          </section>
          <InvestmentWatchNotes />
        </ReadingColumn>
      </details>
      <details className="border-t border-line-soft pt-2" data-testid="investment-system-status">
        <summary className="cursor-pointer py-2 text-body font-medium text-ink">系統整理的狀態提醒（唯讀，不自動列為 owner 待辦）</summary>
        <ReadingColumn className="pt-3"><PendingBoard /></ReadingColumn>
      </details>
    </div>
    <div id="investment-panel-review" role="tabpanel" aria-labelledby="investment-tab-review" hidden={view !== "review"} className={view === "review" ? "flex min-w-0 flex-col gap-4" : "hidden"}>
      {history.isPending || context.isPending ? <p className="text-body text-ink-3">讀取歷史與研究脈絡中…</p> : null}
      {history.isError ? <p role="alert" className="text-body text-warn">歷史來源這次無法取得，請稍後重試。</p> : null}
      {context.isError ? <p role="alert" className="text-body text-warn">研究脈絡這次無法取得；歷史資料仍可單獨查看。</p> : null}
      {history.data ? <ReadingColumn><InvestmentHistory data={history.data} context={context.data} /></ReadingColumn> : null}
    </div>
    <details className="border-t border-line-soft pt-3"><summary className="cursor-pointer py-2 text-caption text-ink-3">資料來源與讀取狀況{watch.data?.watch.coverage.errors.length ? ` · ${watch.data.watch.coverage.errors.length} 項異常` : ""}</summary><div className="flex flex-col gap-2 pt-2 metadata">
      <p>{DEMO_MODE ? "簡報、研究、日期與行情全由合成資料提供。更新資料只重讀範例，不連接帳戶或外部資料。" : "簡報、研究和日期讀取本機 Investment Note；行情向 Yahoo Finance 查詢。更新資料不會同步 Git 或重新生成 AI 簡報。"}</p>
      <p>每週觀察：{query.data?.weekly_watch.date ?? "尚未取得日期"}。目前只提供日期，無法據此確認本週回顧是否完成。</p>
      <p>投資論點的自動檢查尚未接入；没有提醒不代表論點已通過檢查。</p>
      {researchIndex.data ? <p>正式 Research：{researchIndex.data.state} · producer {researchIndex.data.producer} · source_cutoff {researchIndex.data.source_cutoff}</p> : null}
      {watch.data ? <><p>Watch 已讀 {watch.data.watch.coverage.scanned_files} 份相關來源；{watch.data.watch.coverage.missing_catalysts.length} 份未填下次事件日期。未填日期不算讀取故障。</p>{watch.data.watch.coverage.errors.map((error, index) => <p key={index}>{error.path}：{error.message}</p>)}{watch.data.watch.coverage.omissions.length ? <p>另有 {watch.data.watch.coverage.omissions.length} 份相關來源未納入：{watch.data.watch.coverage.omissions.slice(0, 5).map(item => `${item.path}（${item.reason}）`).join("、")}</p> : null}</> : null}
    </div></details>
  </div>
}
