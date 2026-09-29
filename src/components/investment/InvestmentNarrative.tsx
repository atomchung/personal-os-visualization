import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardSection, Field, FieldList, SectionHeading, SubsectionHeading } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { DEMO_MODE } from "@/lib/transport"
import { layerEvidenceGroups, layerGapLine, layerReadingCaption, layerReadingText, layerStatusLineFor, NARRATIVE_FALSIFIER_UNAVAILABLE_COPY, narrativeDisplayState, narrativeSignalSections, narrativeSummaryLines, sourceTimestamp } from "@/lib/investmentFormat"
import { catalystDateGroups, foldBReason, isEventIdentityLimitation, nonExactDateReason, splitNonExactByDateInfo, translateLegacyLimitation, withoutExpiredCatalystGaps } from "@/lib/investmentToday"
import {
  getInvestmentNarrative,
  type InvestmentCatalystItem,
  type FutureCheckpoint,
  type FutureCheckpoints,
  type InvestmentNarrative,
  type InvestmentNarrativeDirectionalSignal,
  type InvestmentNarrativeEvidenceLayer,
  type InvestmentNarrativeLayerEvidence,
  type InvestmentNarrativeRecordedChange,
  type InvestmentNarrativeSource,
  type InvestmentNarrativeState,
} from "@/lib/investment"
import { InlineText } from "./ReadingText"
import { EventSources } from "./EventNews"

type DisplayState = InvestmentNarrativeState | "unavailable"

const STATE_COPY: Record<DisplayState, { label: string; tone: "ok" | "warn" | "bad" | "mute" }> = {
  ready: { label: "資料欄位齊備", tone: "mute" },
  partial: { label: "資料部分可用", tone: "warn" },
  stale: { label: "來源較舊", tone: "warn" },
  drift: { label: "來源關聯不一致", tone: "bad" },
  unknown: { label: "資料狀態未知", tone: "mute" },
  unavailable: { label: "目前無法取得", tone: "warn" },
}

function StateChip({ state }: { state: DisplayState }) {
  const copy = STATE_COPY[state]
  return <Chip tone={copy.tone}>{copy.label}</Chip>
}

function StateNote({ state, reason }: { state: InvestmentNarrativeState; reason?: string | null }) {
  if (state === "ready" && !reason) return null
  return <p className={`text-caption leading-relaxed ${state === "drift" || state === "stale" || state === "partial" ? "text-warn" : "text-ink-3"}`}>
    {reason || STATE_COPY[state].label}
  </p>
}

/** The producer's own explanation of a non-ready state stays available but
 * folded: its wording uses internal terms (claim, relation, review), and the
 * state itself is already shown right next to it. */
export function StateReasonDetails({ reason }: { reason?: string | null }) {
  if (!reason?.trim()) return null
  return <details className="text-caption leading-relaxed text-ink-3">
    <summary className="cursor-pointer py-1">資料狀態說明</summary>
    <p className="pt-1">{reason}</p>
  </details>
}

const DIRECTION_COPY: Record<InvestmentNarrativeEvidenceLayer["direction_state"], string> = {
  supports: "明確列出的資料支持此層供應商訊號",
  challenges: "明確列出的資料挑戰此層供應商訊號",
  mixed: "此層同時有支持與挑戰資料",
  unknown: "尚無明確的本層方向判斷",
  ready: "來源未標明本層方向",
  partial: "本層方向資料不完整",
  stale: "本層方向資料較舊",
  drift: "本層來源關聯不一致",
}

function publicSourceUrl(value: string | null | undefined) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}

function evidenceValue(item: InvestmentNarrativeLayerEvidence) {
  if (item.numeric_state === "not_applicable") return "數值不適用"
  if (item.numeric_state !== "known" || item.numeric_value === null || !item.unit) return "數值未知"
  const unitCopy: Record<string, string> = {
    percent: "%",
    percentage_points: "百分點",
    basis_points: "基點",
    USD_billions: "十億美元",
    USD_millions: "百萬美元",
    USD_thousands: "千美元",
    TWD_billions: "十億新台幣",
    TWD_millions: "百萬新台幣",
    TWD_thousands: "千新台幣",
  }
  const suffix = unitCopy[item.unit] || item.unit
  return suffix === "%" ? `${item.numeric_value}%` : `${item.numeric_value} ${suffix}`
}

function evidenceSourceType(sourceType: string) {
  const labels: Record<string, string> = {
    company_filing: "公司公開申報",
    company_ir: "公司投資人關係資料",
    government_data: "政府資料",
    public_research: "公開研究",
    other_public: "其他公開來源",
  }
  return labels[sourceType] || "公開來源"
}

function freshnessLabel(freshness: InvestmentNarrativeLayerEvidence["freshness"]) {
  if (freshness === "current") return "來源目前有效"
  if (freshness === "stale") return "來源已過期"
  return "新鮮度未知"
}

function EvidenceRow({ item }: { item: InvestmentNarrativeLayerEvidence }) {
  const sourceUrl = publicSourceUrl(item.source_url)
  const ticker = item.entity_ticker ? ` · ${item.entity_ticker}` : ""
  return <li className="flex min-w-0 flex-col gap-1.5 border-t border-line-soft py-3 first:border-0 first:pt-0 last:pb-0">
    <p className="text-body font-medium text-ink-2">{item.player}{ticker} · {evidenceValue(item)} · 來源日期 {sourceTimestamp(item.source_date)}</p>
    {item.explanation ? <p className="text-body leading-relaxed text-ink-2"><InlineText text={item.explanation} /></p> : <p className="text-caption text-ink-3">來源說明未提供。</p>}
    <p className="text-caption text-ink-3">{evidenceSourceType(item.source_type)} · 適用日期 {sourceTimestamp(item.as_of)} · {freshnessLabel(item.freshness)}{item.recorded_at ? ` · 記錄於 ${sourceTimestamp(item.recorded_at)}` : ""}</p>
    {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer" className="w-fit text-caption text-accent underline underline-offset-2">查看公開來源 ↗</a> : <p className="text-caption text-warn">沒有可安全開啟的公開來源連結。</p>}
    {item.limitations.length ? <p className="text-caption text-ink-3">限制：{item.limitations.join("；")}</p> : null}
  </li>
}

function EvidenceGroup({ title, items, emptyLabel }: {
  title: string
  items: InvestmentNarrativeLayerEvidence[]
  emptyLabel: string
}) {
  return <div className="flex min-w-0 flex-col gap-1">
    <p className="text-caption font-medium text-ink-2">{title}</p>
    {items.length ? <ul className="flex min-w-0 flex-col">{items.map(item => <EvidenceRow key={item.evidence_id} item={item} />)}</ul> : <p className="text-caption leading-relaxed text-ink-3">{emptyLabel}</p>}
  </div>
}

function SourceReference({ source }: { source: InvestmentNarrativeSource | null | undefined }) {
  if (!source) return null
  return <li className="break-all">{source.label ? `${source.label} · ` : ""}{source.path}{source.line ? ` · 第 ${source.line} 行` : ""}</li>
}

function uniqueSources(sources: Array<InvestmentNarrativeSource | null | undefined>) {
  const byLocation = new Map<string, InvestmentNarrativeSource>()
  for (const source of sources) {
    if (source) byLocation.set(`${source.path}:${source.line ?? ""}`, source)
  }
  return [...byLocation.values()]
}

function LayerEvidenceCard({ layer }: { layer: InvestmentNarrativeEvidenceLayer }) {
  const { evidence, supporting, challenging, unknown: unknownEvidence, legacySupporting, legacyOpposing } = layerEvidenceGroups(layer)
  const players = layer.players ?? []
  const state: InvestmentNarrativeState = layer.state === "conflict" ? "drift" : layer.state ?? "unknown"
  const coverage = layer.opposing_coverage
  const reading = layerReadingText(layer)
  const gaps = layer.gaps ?? []
  return <li className="flex min-w-0 flex-col gap-3 border-t border-line-soft py-4 first:border-0 first:pt-0 last:pb-0">
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <h4 className="text-body font-semibold text-ink">{layer.layer_id} · {layer.label}</h4>
          <StateChip state={state} />
        </div>
        {reading && layer.current_reading ? <>
          <p className="text-body leading-relaxed text-ink-2">{reading}</p>
          <p className="text-caption leading-relaxed text-ink-3">{layerReadingCaption(layer.current_reading)}</p>
        </> : <p className="text-caption leading-relaxed text-ink-2">{layerStatusLineFor(layer)}</p>}
        {gaps.length ? <ul aria-label="這層還缺什麼" className="flex min-w-0 flex-col gap-1">{gaps.map(gap => <li key={gap.gap_id} className="text-caption leading-relaxed text-ink-2">{layerGapLine(gap)}</li>)}</ul> : null}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-caption font-medium text-ink-2">明確證據方向</p>
          <p className="text-caption leading-relaxed text-ink-3">{DIRECTION_COPY[layer.direction_state]}</p>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-caption font-medium text-ink-2">明確連結的玩家</p>
          {players.length ? <ul className="list-disc pl-5 text-body leading-relaxed text-ink-2">{players.map(player => <li key={player.entity_id}>{player.player}</li>)}</ul> : <p className="text-caption leading-relaxed text-ink-3">尚未建立玩家關係；不從背景文字推測。</p>}
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <EvidenceGroup title="支持此層的公開證據" items={supporting} emptyLabel="尚無明確連結的支持證據。" />
          <EvidenceGroup title="挑戰此層的公開證據" items={challenging} emptyLabel="尚無明確連結的挑戰證據。" />
        </div>
        {unknownEvidence.length ? <EvidenceGroup title="方向未明的證據" items={unknownEvidence} emptyLabel="" /> : null}
        {legacySupporting.length || legacyOpposing.length ? <div className="flex flex-col gap-2">
          {legacySupporting.length ? <p className="text-caption text-ink-3">既有支持記錄：{legacySupporting.map((item, index) => <span key={index}>{index ? "；" : ""}<InlineText text={item} /></span>)}</p> : null}
          {legacyOpposing.length ? <p className="text-caption text-ink-3">既有挑戰記錄：{legacyOpposing.map((item, index) => <span key={index}>{index ? "；" : ""}<InlineText text={item} /></span>)}</p> : null}
        </div> : null}
        {layer.unknown_reason ? <StateNote state={state} reason={layer.unknown_reason} /> : null}
      </div>
    </div>
    <details className="text-caption text-ink-3">
      <summary className="cursor-pointer py-1">這層的背景與來源</summary>
      <div className="flex flex-col gap-2 pt-2">
        <p>方向性資料狀態：{DIRECTION_COPY[layer.direction_state]}{layer.unknown_reason ? ` · ${layer.unknown_reason}` : ""}</p>
        <p>反方證據連結：{challenging.length ? `明確連結 ${challenging.length} 項` : "目前沒有明確連結的反方證據"}{layer.link_state === "unlinked" ? "；此層證據關係未連結" : ""}。</p>
        <p>反方涵蓋：{coverage?.state === "sufficient" ? "檢查記錄標示涵蓋充分" : coverage?.state === "insufficient" ? "檢查涵蓋不足" : coverage?.state === "unavailable" ? "檢查來源不可用" : coverage?.state === "unknown" ? "涵蓋狀態未知" : "未提供檢查記錄，涵蓋狀態未知"}。</p>
        {coverage?.reason ? <p>{coverage.reason}</p> : null}
        {coverage ? <div className="flex flex-col gap-1"><p>反方檢查日期：{sourceTimestamp(coverage.checked_at)} · 範圍：{coverage.scope || "未提供"}</p><ul><SourceReference source={coverage.source} /></ul></div> : null}
        {layer.current_reading ? <div className="flex min-w-0 flex-col gap-1">
          <p className="font-medium text-ink-2">目前認知的來源與限制</p>
          <p>來源狀態：{layer.current_reading.state} · 整理者：{layer.current_reading.authored_by || "未提供"}</p>
          {layer.current_reading.limitations.length ? <ul className="list-disc pl-4 text-warn">{layer.current_reading.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul> : null}
          <ul className="flex flex-col gap-1"><SourceReference source={layer.current_reading.source} /></ul>
        </div> : null}
        {gaps.length ? <div className="flex min-w-0 flex-col gap-1">
          <p className="font-medium text-ink-2">待補資訊的來源</p>
          <ul className="flex min-w-0 flex-col gap-2">{gaps.map((gap, index) => <li key={gap.gap_id || index}>
            <p>{gap.missing || "未提供"} · 狀態：{gap.state}</p>
            <ul><SourceReference source={gap.source} /></ul>
          </li>)}</ul>
        </div> : null}
        <p><span className="font-medium text-ink-2">價值鏈位置：</span>{layer.who_earns || "來源未提供"}</p>
        <p><span className="font-medium text-ink-2">證據例：</span>{layer.evidence_examples || "來源未提供"}</p>
        <p><span className="font-medium text-ink-2">可證明範圍：</span>{layer.what_it_proves || "來源未提供"}</p>
        <p>證據日期：{sourceTimestamp(layer.source_date)} · 文件更新：{sourceTimestamp(layer.document_updated)}</p>
        <ul className="flex flex-col gap-1"><SourceReference source={layer.source} />{players.map((player, index) => <SourceReference key={`${player.entity_id}:${index}`} source={player.source} />)}{evidence.map((item, index) => <SourceReference key={`${item.evidence_id}:${index}`} source={item.source} />)}</ul>
      </div>
    </details>
  </li>
}

function DirectionalSignal({ signal }: { signal: InvestmentNarrativeDirectionalSignal }) {
  return <li className="flex min-w-0 flex-col gap-1.5 border-t border-line-soft py-3 first:border-0 first:pt-0 last:pb-0">
    <p className="text-body leading-relaxed text-ink-2"><InlineText text={signal.text} /></p>
    <p className="text-caption text-ink-3">{signal.indicator} · {signal.dispute}</p>
    <p className="text-caption text-ink-3">{signal.layer_id ? `明確連結至 ${signal.layer_id}` : "尚未連結特定層"}</p>
    <details className="text-caption text-ink-3">
      <summary className="cursor-pointer py-1">訊號日期與來源</summary>
      <div className="flex min-w-0 flex-col gap-1 pt-1">
        <p>來源渠道：{signal.source_channels || "未提供"}</p>
        <p>訊號日期：{sourceTimestamp(signal.source_date)}</p>
        <p>文件更新日：{sourceTimestamp(signal.document_updated)}</p>
        <ul className="flex flex-col gap-1"><SourceReference source={signal.source} /></ul>
      </div>
    </details>
  </li>
}

function SignalGroup({ title, signals, emptyLabel }: {
  title: string
  signals: InvestmentNarrativeDirectionalSignal[]
  emptyLabel: string
}) {
  return <div className="flex min-w-0 flex-col gap-2">
    <p className="text-caption font-medium text-ink-2">{title}</p>
    {signals.length ? <ul className="flex min-w-0 flex-col">{signals.map((signal, index) => <DirectionalSignal key={`${signal.indicator}:${index}`} signal={signal} />)}</ul> : <p className="text-caption leading-relaxed text-ink-3">{emptyLabel}</p>}
  </div>
}

function RecordedLearning({ record }: { record: InvestmentNarrativeRecordedChange }) {
  const hasContent = Boolean(record.date || record.judgment || record.key_evidence || record.later_verification)
  return <CardSection as="article" density="normal" className="flex min-w-0 flex-col gap-2">
    <SubsectionHeading>最近一次明確記錄的判斷與驗證</SubsectionHeading>
    {!hasContent ? <p className="text-body text-ink-3">尚未記錄。這裡只讀 scorecard 時間線，不以最新新聞或事件代替 learning。</p> : <>
      <p className="text-caption text-ink-3">{sourceTimestamp(record.date)}</p>
      <p className="text-body leading-relaxed text-ink-2"><span className="font-medium text-ink">當時判斷：</span>{record.judgment ? <InlineText text={record.judgment} /> : "尚未記錄"}</p>
      <p className="text-body leading-relaxed text-ink-2"><span className="font-medium text-ink">關鍵事實：</span>{record.key_evidence ? <InlineText text={record.key_evidence} /> : "尚未記錄"}</p>
      <p className="text-body leading-relaxed text-ink-2"><span className="font-medium text-ink">後續驗證：</span>{record.later_verification ? <InlineText text={record.later_verification} /> : "尚未記錄"}</p>
    </>}
    <StateNote state={record.state} reason={record.missing.length ? record.missing.join("；") : null} />
  </CardSection>
}

function CatalystRow({ item, exact = false }: { item: InvestmentCatalystItem; exact?: boolean }) {
  const membership = exact ? "來源標示在 30 天窗口內" : item.window_membership === "possible" ? "日期或窗口可能涵蓋，尚未確認" : "窗口關係未知"
  const date = item.date ?? item.date_label ?? "日期未提供"
  return <li className="flex min-w-0 flex-col gap-1 border-t border-line-soft py-2 first:border-0 first:pt-0">
    <p className="text-body font-medium leading-relaxed text-ink-2">{date} · {item.ticker} · {item.type || "事件類型未提供"}</p>
    <p className="text-body leading-relaxed text-ink-2"><InlineText text={item.raw} /></p>
    <p className="text-caption text-ink-3">{membership}{item.source_qualifiers.length ? ` · 出處註記：${item.source_qualifiers.join("、")}` : " · 出處註記未提供"}</p>
    {item.source ? <p className="break-all text-caption text-ink-3">來源：{item.source.path}{item.source.line ? `:${item.source.line}` : ""}</p> : <p className="text-caption text-warn">來源位置未提供。</p>}
  </li>
}

/** Fold B row for the catalysts_30d fallback schema ("資料待整理"): this older
 * shape carries no story_id, but it still has the producer's own event text
 * -- render it (item.raw, already length-bounded by the backend, same as
 * CatalystRow above) plus date and source when present, instead of only the
 * ticker and a generic date reason. Secondary style throughout, no warn tone. */
export function CatalystFoldBRow({ item }: { item: InvestmentCatalystItem }) {
  const date = item.date ?? item.date_label
  return <li className="flex min-w-0 flex-col gap-1 border-t border-line-soft py-2 first:border-0 first:pt-0 text-caption leading-relaxed text-ink-3">
    <p>{item.ticker}{date ? ` · ${date}` : ""}</p>
    <p><InlineText text={item.raw} /></p>
    <p>{nonExactDateReason(item)}</p>
    {item.source ? <p className="break-all">來源：{item.source.path}{item.source.line ? `:${item.source.line}` : ""}</p> : null}
  </li>
}

function FutureRow({ item }: { item: FutureCheckpoint }) {
  return <li className="flex min-w-0 flex-col gap-2 border-t border-line-soft py-3 first:border-0 first:pt-0">
    <p className="text-body font-medium leading-relaxed text-ink-2">{item.date ?? item.date_label ?? "日期未確認"} · <InlineText text={item.title} /></p>
    <p className="text-caption text-ink-3">影響：{[...item.affected_tickers, ...item.affected_scopes].join("、") || "來源未提供"}{item.source_qualifiers?.length ? ` · ${item.source_qualifiers.join("、")}` : ""}</p>
    {item.state === "conflict" ? <p className="text-caption text-warn">同一事件有不同日期來源；尚未選定日期。</p> : item.state === "unlinked" ? <p className="text-caption text-ink-3">來源尚未登記事件關聯，保留為獨立項目。</p> : item.state !== "ready" ? <p className="text-caption text-warn">事件資料尚未確認。</p> : null}
    {item.checks.length ? <ul className="flex min-w-0 flex-col gap-2">{item.checks.map((check, index) => <li key={index} className="text-body leading-relaxed text-ink-2"><span className="font-medium">{check.scope}：</span><InlineText text={check.check ?? "檢查條件未提供"} /></li>)}</ul> : null}
    <details className="text-caption text-ink-3"><summary className="cursor-pointer py-1">來源與登記原文 · {item.sources.length}</summary><EventSources sources={item.sources} /></details>
    {item.limitations.filter(limitation => !(item.state === "unlinked" && isEventIdentityLimitation(limitation))).map((limitation, index) => <p key={index} className="text-caption text-warn">{limitation}</p>)}
  </li>
}

/** Fold A ("日期未定"): same date/title reading as the exact list, plus one
 * plain reason the date isn't exact yet. No orange tone -- an unresolved
 * date is not a data problem the way a missing event identity is. */
function FutureFoldARow({ item }: { item: FutureCheckpoint }) {
  return <li className="flex min-w-0 flex-col gap-1 border-t border-line-soft py-2 first:border-0 first:pt-0">
    <p className="text-body leading-relaxed text-ink-2">{item.date ?? item.date_label ?? "日期未確認"} · <InlineText text={item.title} /></p>
    <p className="text-caption text-ink-3">{nonExactDateReason(item)}</p>
  </li>
}

/** Fold B ("資料待整理"): one plain line per row, secondary style throughout
 * -- these rows do not belong on the reading list above, but are kept
 * visible rather than silently dropped. The event's own title always shows;
 * affected tickers are extra context after it, never a replacement for it. */
function FoldBRow({ label, context, reason }: { label: string; context?: string | null; reason: string }) {
  return <li className="text-caption leading-relaxed text-ink-3">{label}{context ? `（${context}）` : ""}：{reason}</li>
}

export function FutureContent({ projection, heading = "接下來會改變判斷的事情" }: { projection: FutureCheckpoints; heading?: string }) {
  const exact = projection.items.filter(item => item.date_precision === "day" && item.window_membership === "within")
  const nonExact = [...projection.items.filter(item => !exact.includes(item)), ...projection.uncertain_items]
  const { dated: foldA, undated: foldBEvents } = splitNonExactByDateInfo(nonExact)
  const foldBRows = [
    ...foldBEvents.map(item => ({
      key: `event:${item.story_id ?? item.title}`,
      label: item.title,
      context: item.affected_tickers.length ? item.affected_tickers.join("、") : null,
      reason: foldBReason(item.limitations),
    })),
    ...withoutExpiredCatalystGaps(projection.coverage_gaps).map((gap, index) => ({ key: `gap:${index}:${gap.ticker}`, label: gap.ticker, context: null as string | null, reason: translateLegacyLimitation(gap.reason) })),
  ]
  return <section aria-label={heading} className="flex min-w-0 flex-col gap-2">
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2"><SubsectionHeading>{heading}</SubsectionHeading><Chip tone={projection.state === "ready" ? "mute" : "warn"}>{projection.state === "ready" ? "來源完整" : projection.state === "unknown" ? "狀態未知" : "來源部分可用"}</Chip></div>
    <Card className="flex min-w-0 flex-col gap-3 p-3 sm:p-4">
      <p className="text-caption text-ink-3">窗口 {projection.window_start} 至 {projection.window_end}；同一事件合併呈現，各標的與論點的檢查分開保留。</p>
      {exact.length ? <ul className="flex min-w-0 flex-col">{exact.slice(0, 3).map((item, index) => <FutureRow key={item.story_id ?? `legacy:${index}`} item={item} />)}</ul> : <p className="text-body text-ink-3">來源沒有列出日期明確的窗口內事件；不代表沒有未來事件。</p>}
      {exact.length > 3 ? <details className="border-t border-line-soft pt-2 text-caption text-ink-3"><summary className="cursor-pointer py-1">其他日期明確的事件 · {exact.length - 3}</summary><ul className="flex min-w-0 flex-col">{exact.slice(3).map((item, index) => <FutureRow key={item.story_id ?? `more:${index}`} item={item} />)}</ul></details> : null}
      {foldA.length ? <details className="border-t border-line-soft pt-2 text-caption text-ink-3"><summary className="cursor-pointer py-1">日期未定 · {foldA.length}</summary><ul className="flex min-w-0 flex-col">{foldA.map((item, index) => <FutureFoldARow key={item.story_id ?? `undated:${index}`} item={item} />)}</ul></details> : null}
      {projection.limitations.map((limitation, index) => <p key={index} className="text-caption text-ink-3">{limitation}</p>)}
      {foldBRows.length ? <details className="border-t border-line-soft pt-2 text-caption text-ink-3"><summary className="cursor-pointer py-1">資料待整理 · {foldBRows.length}</summary>
        <p className="py-2">這些登記沒有可用的日期或資料不完整，不影響上方清單；需要時到 Investment Note 更新。</p>
        <ul className="flex min-w-0 flex-col gap-1">{foldBRows.map(row => <FoldBRow key={row.key} label={row.label} context={row.context} reason={row.reason} />)}</ul>
      </details> : null}
    </Card>
  </section>
}

/** Compact Today projection. This is independent of the brief query and never links by ticker or prose. */
export function TodayCatalysts({ enabled, heading = "接下來會改變判斷的事情" }: { enabled: boolean; heading?: string }) {
  const query = useQuery({
    queryKey: ["investment-narrative"],
    queryFn: ({ signal }) => getInvestmentNarrative(signal),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  })
  const projection = query.data?.catalysts_30d
  const view = catalystDateGroups(projection)
  const exact = view.exact.slice(0, 3)
  const moreExact = view.exact.slice(3)
  // Same split as FutureContent: rows with any date information stay visible
  // under 日期未定; only rows with no usable date join the coverage gaps.
  const { dated: foldA, undated: foldBItems } = splitNonExactByDateInfo(view.uncertain)
  const foldBRows = projection ? [
    ...foldBItems.map((item, index) => ({ kind: "catalyst" as const, key: `event:${index}:${item.ticker}`, item })),
    ...withoutExpiredCatalystGaps(projection.coverage_gaps).map((gap, index) => ({ kind: "gap" as const, key: `gap:${index}:${gap.ticker}`, ticker: gap.ticker, reason: translateLegacyLimitation(gap.reason) })),
  ] : []
  if (query.data?.future_checkpoints && !query.isError) return <FutureContent projection={query.data.future_checkpoints} heading={heading} />
  return <section aria-label={heading} className="flex min-w-0 flex-col gap-2">
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2"><SubsectionHeading>{heading}</SubsectionHeading>{projection ? <Chip tone={projection.state === "ready" ? "mute" : "warn"}>{projection.state === "ready" ? "來源完整" : projection.state === "partial" ? "來源部分可用" : "狀態未知"}</Chip> : null}</div>
    <Card className="min-w-0 p-3 sm:p-4">
      <p className="mb-2 text-caption leading-relaxed text-ink-3">有限投影自 Investment Note 的 next_catalyst 登記；日期與來源限定照原樣保留，不依代號或文字合併。</p>
      {query.isPending && !query.data ? <p role="status" className="text-body text-ink-3">讀取未來事件中…</p> : null}
      {query.isError ? <p role="status" className="text-caption text-warn">事件投影讀取失敗；目前無法確認是否有下一個檢查點。</p> : null}
      {!query.isError && query.data && !projection ? <p role="status" className="text-body text-ink-3">此版來源沒有提供 30 天事件投影；下一檢查點未知。</p> : null}
      {projection ? <>
        <p className="mb-2 text-caption text-ink-3">窗口 {sourceTimestamp(projection.window_start)} 至 {sourceTimestamp(projection.window_end)}</p>
        {exact.length ? <ul className="flex min-w-0 flex-col" aria-label="日期明確的近期事件">{exact.map(item => <CatalystRow key={`${item.source?.path ?? "unknown"}:${item.source?.line ?? "unknown"}:${item.ticker}:${item.date ?? "unknown"}`} item={item} exact />)}</ul> : null}
        {moreExact.length ? <details className="border-t border-line-soft pt-2 text-caption text-ink-3"><summary className="cursor-pointer py-1">另外 {moreExact.length} 個窗口內事件</summary><ul className="flex min-w-0 flex-col pt-2">{moreExact.map(item => <CatalystRow key={`${item.source?.path ?? "unknown"}:${item.source?.line ?? "unknown"}:${item.ticker}:${item.date ?? "unknown"}`} item={item} exact />)}</ul></details> : null}
        {foldA.length ? <details className="border-t border-line-soft pt-2 text-caption text-ink-3"><summary className="cursor-pointer py-1">日期未定 · {foldA.length}</summary><ul className="flex min-w-0 flex-col pt-2">{foldA.map((item, index) => <li key={`${item.source?.path ?? "unknown"}:${item.source?.line ?? index}:${item.ticker}`} className="flex min-w-0 flex-col gap-1 border-t border-line-soft py-2 first:border-0 first:pt-0">
          <p className="text-body leading-relaxed text-ink-2">{item.date ?? item.date_label ?? "日期未提供"} · {item.ticker} · <InlineText text={item.raw} /></p>
          <p className="text-caption text-ink-3">{nonExactDateReason(item)}</p>
        </li>)}</ul></details> : null}
        {!view.exact.length && !view.uncertain.length ? <p className="text-body text-ink-3">來源沒有列出可確認的近期事件；完整覆蓋狀態為 {projection.state}，空清單不代表沒有事件。</p> : null}
        {projection.limitations.map((item, index) => <p key={index} className="text-caption text-warn">{item}</p>)}
        {foldBRows.length ? <details className="border-t border-line-soft pt-2 text-caption text-ink-3"><summary className="cursor-pointer py-1">資料待整理 · {foldBRows.length}</summary>
          <p className="py-2">這些登記沒有可用的日期或資料不完整，不影響上方清單；需要時到 Investment Note 更新。</p>
          <ul className="flex min-w-0 flex-col gap-1 pt-1">{foldBRows.map(row => row.kind === "catalyst"
            ? <CatalystFoldBRow key={row.key} item={row.item} />
            : <li key={row.key} className="text-caption leading-relaxed text-ink-3">{row.ticker}：{row.reason}</li>)}</ul>
        </details> : null}
      </> : null}
      {!query.isError && !query.isPending && !query.data ? <p className="text-body text-ink-3">目前沒有可讀的事件投影；下一檢查點未知。</p> : null}
    </Card>
  </section>
}

function NarrativeContent({ data, narrative, readable }: { data: InvestmentNarrative; narrative: InvestmentNarrative["narratives"][number]; readable: boolean }) {
  const evidence = narrative.thesis_evidence
  const { challengeSignals, supportSignals, explicitFalsifiers } = narrativeSignalSections(evidence.directional_signals)
  const sources = uniqueSources([
    ...narrative.references,
    ...evidence.layers.flatMap(layer => [layer.source, layer.opposing_coverage?.source, ...(layer.players ?? []).map(player => player.source), ...(layer.evidence ?? []).map(item => item.source)]),
    ...evidence.directional_signals.map(signal => signal.source),
    evidence.latest_recorded_change.source,
  ])
  const hasUnlinkedCatalyst = Boolean(data.catalysts_30d?.items.length || data.catalysts_30d?.uncertain_items.length)
  const summary = narrativeSummaryLines({
    readable,
    tension: narrative.current_tension,
    latest: evidence?.latest_recorded_change,
    // No producer field links a checkpoint to a narrative yet -- 下一驗證點
    // below says the same -- and one is never paired by ticker, date or text.
    nextCheckpoint: null,
    signals: evidence ? { state: evidence.state, items: evidence.directional_signals ?? [] } : null,
  })
  return <Card className="min-w-0 divide-y divide-line-soft overflow-hidden">
    <CardSection as="article" density="normal" aria-label="目前判斷" className="flex min-w-0 flex-col gap-3">
      <SubsectionHeading>目前判斷</SubsectionHeading>
      <FieldList>
        {summary.map(line => <Field key={line.label} label={line.label} tone={line.muted ? "muted" : "default"}><InlineText text={line.text} /></Field>)}
      </FieldList>
    </CardSection>

    {/* The long-held thesis rarely changes and the owner already knows it:
        kept in place, folded by default, one click away. */}
    <details aria-label="長期論點" className="p-4 sm:p-5">
      <summary className="cursor-pointer"><h3 className="inline text-section font-semibold tracking-tight text-ink">長期論點</h3></summary>
      <div className="flex min-w-0 flex-col gap-2 pt-3">
        {narrative.title ? <p className="text-caption text-ink-3">{narrative.title}</p> : null}
        <StateNote state={narrative.state} reason={narrative.state_reason} />
        {narrative.what_i_bet.narrative.text ? <p className="text-body leading-relaxed text-ink-2"><InlineText text={narrative.what_i_bet.narrative.text} /></p> : null}
        {narrative.what_i_bet.owner_thesis.text ? <p className="text-body leading-relaxed text-ink-2"><InlineText text={narrative.what_i_bet.owner_thesis.text} /></p> : null}
        {!narrative.what_i_bet.narrative.text && !narrative.what_i_bet.owner_thesis.text ? <p className="text-body text-ink-3">來源尚未提供可讀的論點；不補寫投資主張。</p> : null}
        {narrative.current_tension.text ? <div className="flex flex-col gap-1 border-l-2 border-line pl-3"><p className="text-caption font-medium text-ink-2">現在的張力</p><p className="text-body leading-relaxed text-ink-2"><InlineText text={narrative.current_tension.text} /></p></div> : null}
      </div>
    </details>

    <CardSection as="article" density="normal" aria-label="支持訊號" className="flex min-w-0 flex-col gap-3">
      <SubsectionHeading>支持訊號</SubsectionHeading>
      <SignalGroup title="來源明確列出的支持訊號" signals={supportSignals} emptyLabel="來源尚未列出明確的支持訊號；不以新聞或文字相似度補上。" />
    </CardSection>

    <CardSection as="article" density="normal" aria-label="挑戰訊號" className="flex min-w-0 flex-col gap-3">
      <SubsectionHeading>挑戰訊號</SubsectionHeading>
      <SignalGroup title="來源明確列出的挑戰訊號" signals={challengeSignals} emptyLabel="來源尚未列出明確的挑戰訊號；不以空白代表沒有反方。" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-caption font-medium text-ink-2">明確推翻條件</p>
        {explicitFalsifiers.length ? <ul className="list-disc pl-5 text-body leading-relaxed text-ink-2">{explicitFalsifiers.map((condition, index) => <li key={index}><InlineText text={condition} /></li>)}</ul> : <p className="text-caption leading-relaxed text-ink-3">{NARRATIVE_FALSIFIER_UNAVAILABLE_COPY}</p>}
      </div>
    </CardSection>

    <RecordedLearning record={evidence.latest_recorded_change} />

    <CardSection as="article" density="normal" aria-label="下一驗證點" className="flex min-w-0 flex-col gap-2">
      <SubsectionHeading>下一驗證點</SubsectionHeading>
      <p className="text-body text-ink-3">目前來源沒有把下一檢查點明確連到這個論點或層級；{hasUnlinkedCatalyst ? "其他近期事件已在 Today 顯示，這裡不依代號或文字推定關係。" : "因此保持未知，不用事件日期或近期新聞代替。"}</p>
    </CardSection>

    <CardSection as="article" density="normal" className="flex min-w-0 flex-col gap-3">
      <SubsectionHeading>五層詳細證據</SubsectionHeading>
      <p className="text-caption leading-relaxed text-ink-3">方向、支持／挑戰資料、對應關係與反方檢查狀態分開呈現；沒有明確連結不代表沒有相關證據。</p>
      <div className="flex min-w-0 flex-col gap-1" aria-label="五層證據覆蓋狀態"><p className="text-caption font-medium text-ink-2">證據覆蓋：{STATE_COPY[evidence.state].label}</p><StateReasonDetails reason={evidence.reason} /></div>
      {evidence.scorecard_update?.status === "evidence_pending_review" ? <p role="status" className="text-caption leading-relaxed text-warn">新證據尚待論點覆核；最近一次明確覆核日為 {sourceTimestamp(evidence.scorecard_update.updated_at)}。新增資料不代表論點已確認或改變。</p> : null}
      {evidence.layers.length ? <ol className="flex min-w-0 flex-col">{evidence.layers.map(layer => <LayerEvidenceCard key={layer.layer_id} layer={layer} />)}</ol> : <p className="text-body text-ink-3">來源尚未提供可辨識的五層結構。</p>}
    </CardSection>

    <details className="p-4 text-caption text-ink-3 sm:p-5">
      <summary className="cursor-pointer">日期與來源</summary>
      <div className="flex flex-col gap-2 pt-2">
        <p>Scorecard 更新：{sourceTimestamp(narrative.updated)} · 頁面讀取資料截點：{sourceTimestamp(data.source_cutoff)}</p>
        <p>文件更新日不代表每項訊號的發生日；來源沒有標日期時維持未知。</p>
        <ul className="flex flex-col gap-1">{sources.map((source, index) => <SourceReference key={`${source.path}:${source.line ?? index}`} source={source} />)}</ul>
        {data.limitations.map((limitation, index) => <p key={index} className="text-warn">{limitation}</p>)}
      </div>
    </details>

  </Card>
}

export function InvestmentNarrativeSection({ enabled, onOpenHistory }: { enabled: boolean; onOpenHistory: () => void }) {
  const query = useQuery({
    queryKey: ["investment-narrative"],
    queryFn: ({ signal }) => getInvestmentNarrative(signal),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  })
  const data = query.data
  const narrative = data?.narratives[0]
  const state: DisplayState = query.isError ? "unavailable" : narrativeDisplayState(narrative?.state, narrative?.thesis_evidence.state, data?.state) ?? "unknown"
  return <section aria-label="我的判斷" className="flex min-w-0 flex-col gap-3 break-words">
    <SectionHeading aside={<StateChip state={state} />}>我的判斷</SectionHeading>
    <p className="text-caption leading-relaxed text-ink-3">先看目前判斷與支持／挑戰訊號，再回看最近一次明確記錄與下一驗證點，最後展開五層來源證據。資料完整度不代表論點成立。要回看當時判斷、後來結果與已記錄心得，請到 <Button variant="link" className="inline min-h-0 px-0 py-0 align-baseline" onClick={onOpenHistory}>復盤與學習</Button>。交易紀錄核對是另一項工作；PersonalOS 目前沒有對應入口。</p>
    {narrative ? <StateReasonDetails reason={narrative.state_reason} /> : null}
    {DEMO_MODE ? <p className="text-caption text-ink-3">展示內容全為合成範例；個人論點與持倉保持未知。</p> : null}
    {query.isPending && !data ? <p role="status" className="text-body text-ink-3">正在讀取論點來源；讀取完成前不顯示健康狀態。</p> : null}
    {query.isError ? <p role="alert" className="text-caption text-warn">這次論點來源讀取失敗。{data ? "以下保留上次讀取結果。" : "目前無法確認論點狀態。"}請按更新資料重試。</p> : null}
    {!query.isPending && !query.isError && !narrative ? <p role="status" className="text-body text-ink-3">目前沒有可讀的 AI narrative；來源未提供資料，不補寫論點。</p> : null}
    {data && narrative ? <NarrativeContent data={data} narrative={narrative} readable={!query.isError} /> : null}
  </section>
}
