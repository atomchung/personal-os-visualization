import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, SectionHeading, SubsectionHeading } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { DEMO_MODE } from "@/lib/transport"
import { NARRATIVE_FALSIFIER_UNAVAILABLE_COPY, narrativeDisplayState, narrativeSignalSections, sourceTimestamp, unlinkedRowsWithoutLayerCard } from "@/lib/investmentFormat"
import {
  getInvestmentNarrative,
  type InvestmentNarrative,
  type InvestmentNarrativeDirectionalSignal,
  type InvestmentNarrativeLayerEvidenceItem,
  type InvestmentNarrativeEvidenceLayer,
  type InvestmentNarrativeLayerRow,
  type InvestmentNarrativeRecordedChange,
  type InvestmentNarrativeScorecardUpdate,
  type InvestmentNarrativeSource,
  type InvestmentNarrativeState,
} from "@/lib/investment"
import { InlineText } from "./ReadingText"

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

const LAYER_STATE_COPY = {
  ready: { label: "證據可讀", tone: "mute" as const },
  partial: { label: "部分資料待確認", tone: "warn" as const },
  stale: { label: "此層來源較舊", tone: "warn" as const },
  conflict: { label: "關聯互相矛盾", tone: "bad" as const },
  unknown: { label: "證據狀態未知", tone: "mute" as const },
}
const EVIDENCE_SOURCE_COPY: Record<string, string> = {
  company_filing: "公司申報資料",
  company_ir: "公司公告",
  government_data: "政府資料",
  public_research: "公開研究",
  other_public: "其他公開來源",
}

function publicEvidenceHref(value?: string): URL | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:" ? url : null
  } catch {
    return null
  }
}

function EvidenceRow({ item }: { item: InvestmentNarrativeLayerEvidenceItem }) {
  if (typeof item === "string") return <li className="text-body leading-relaxed text-ink-2"><InlineText text={item} /></li>
  const href = publicEvidenceHref(item.source_url)
  const date = item.evidence_date ? sourceTimestamp(item.evidence_date) : "日期未提供"
  const sourceType = item.source_type ? EVIDENCE_SOURCE_COPY[item.source_type] || item.source_type : "來源類型未提供"
  const freshnessCopy = item.freshness === "current" ? "目前" : item.freshness === "stale" ? "較舊" : item.freshness === "unknown" ? "未確認" : null
  return <li className="flex min-w-0 flex-col gap-2 border-t border-line-soft py-3 first:border-0 first:pt-0 last:pb-0">
    <p className="text-body leading-relaxed text-ink-2">{item.explanation ? <InlineText text={item.explanation} /> : "來源未提供這筆資料與論點的關聯說明。"}</p>
    <p className="text-caption text-ink-3">證據日期 {date} · {sourceType}{freshnessCopy ? ` · 新鮮度：${freshnessCopy}` : item.state === "stale" ? " · 新鮮度：較舊" : item.state === "unknown" ? " · 新鮮度：未確認" : ""}</p>
    {href ? <a className="break-all text-caption text-ink-2 underline hover:text-ink" href={href.href} target="_blank" rel="noreferrer">開啟公開來源 · {href.host}</a> : <p className="text-caption text-ink-3">公開來源連結未提供或格式無效。</p>}
    <details className="text-caption text-ink-3">
      <summary className="cursor-pointer py-1">日期與資料列出處</summary>
      <div className="flex min-w-0 flex-col gap-1 pt-1">
        <p>來源資料截至：{sourceTimestamp(item.as_of)}</p>
        <p>列入日期：{sourceTimestamp(item.recorded_at)}</p>
        {item.valid_until ? <p>有效至：{sourceTimestamp(item.valid_until)}</p> : null}
        {item.evidence_id ? <p>證據資料 ID：{item.evidence_id}</p> : null}
        {item.entity_id ? <p>玩家 ID：{item.entity_id}</p> : null}
        {item.freshness ? <p>來源新鮮度：{item.freshness}</p> : null}
        {item.limitations?.length ? <ul className="list-disc pl-4 text-warn">{item.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul> : null}
        <ul className="flex flex-col gap-1"><SourceReference source={item.source} /></ul>
      </div>
    </details>
  </li>
}

function EvidenceGroup({ title, items }: {
  title: string
  items: InvestmentNarrativeLayerEvidenceItem[]
}) {
  return <div className="flex min-w-0 flex-col gap-2">
    <p className="text-caption font-medium text-ink-2">{title}</p>
    <ul className="flex min-w-0 flex-col">{items.map((item, index) => <EvidenceRow key={typeof item === "string" ? `${title}:${index}` : item.evidence_id || `${title}:${index}`} item={item} />)}</ul>
  </div>
}

function IntegrityRows({ title, rows }: { title: string; rows: InvestmentNarrativeLayerRow[] }) {
  if (!rows.length) return null
  return <details className="text-caption text-ink-3">
    <summary className="cursor-pointer py-1">{title} · {rows.length} 筆</summary>
    <ul className="flex min-w-0 flex-col gap-2 pt-2">{rows.map((row, index) => <li key={`${row.evidence_id || row.entity_id || title}:${index}`} className="flex min-w-0 flex-col gap-1 border-t border-line-soft pt-2 first:border-0 first:pt-0">
      <p className="text-body text-ink-2">{row.player || row.explanation || row.evidence_id || "未命名資料列"}</p>
      {row.evidence_id ? <p>證據資料 ID：{row.evidence_id}</p> : null}
      {row.pillar_id ? <p>層級代碼：{row.pillar_id}</p> : null}
      <p>玩家 ID：{row.entity_id || "未提供"}{row.recorded_at ? ` · 列入日期 ${sourceTimestamp(row.recorded_at)}` : ""}</p>
      {row.evidence_date ? <p>證據日期：{sourceTimestamp(row.evidence_date)}</p> : null}
      {row.source_url ? <p className="break-all">公開連結：{row.source_url}</p> : null}
      {row.limitations?.length ? <ul className="list-disc pl-4 text-warn">{row.limitations.map((limitation, limitationIndex) => <li key={limitationIndex}>{limitation}</li>)}</ul> : null}
      <ul className="flex flex-col gap-1"><SourceReference source={row.source} /></ul>
    </li>)}</ul>
  </details>
}

function PlayerRelations({ players }: { players: NonNullable<InvestmentNarrativeEvidenceLayer["players"]> }) {
  if (!players.length) return null
  return <div className="flex min-w-0 flex-col gap-1">
    <p className="text-caption font-medium text-ink-2">明確記錄的玩家</p>
    <ul className="flex min-w-0 flex-col gap-2">{players.map(player => <li key={player.entity_id} className="flex min-w-0 flex-col gap-1">
      <p className="text-body leading-relaxed text-ink-2">{player.player}</p>
      <details className="text-caption text-ink-3">
        <summary className="cursor-pointer py-1">玩家關係出處</summary>
        <div className="flex min-w-0 flex-col gap-1 pt-1">
          <p>列入日期：{sourceTimestamp(player.recorded_at)}</p>
          <p>玩家 ID：{player.entity_id}</p>
          <ul className="flex flex-col gap-1"><SourceReference source={player.source} /></ul>
        </div>
      </details>
    </li>)}</ul>
  </div>
}

function layerEvidence(layer: InvestmentNarrativeEvidenceLayer, polarity: "supports" | "challenges" | "unknown") {
  const explicit = polarity === "supports"
    ? layer.supporting
    : polarity === "challenges"
      ? (layer.opposing?.length ? layer.opposing : layer.challenging)
      : layer.unknown
  return explicit?.length ? explicit : layer.evidence?.filter(item => item.polarity === polarity) ?? []
}

function LayerEvidenceCard({ layer }: { layer: InvestmentNarrativeEvidenceLayer }) {
  const supporting = layerEvidence(layer, "supports")
  const opposing = layerEvidence(layer, "challenges")
  const unknown = layerEvidence(layer, "unknown")
  const players = layer.players ?? []
  const conflicts = layer.conflicts ?? []
  const unlinkedEvidence = layer.unlinked_evidence ?? []
  const unlinkedPlayers = layer.unlinked_players ?? []
  const groups = [
    { title: "支持證據", items: supporting },
    { title: "挑戰證據", items: opposing },
    { title: "方向未定", items: unknown },
  ].filter(group => group.items.length)
  const linkedEvidenceCount = supporting.length + opposing.length + unknown.length
  const stateCopy = layer.state ? LAYER_STATE_COPY[layer.state] : null
  return <li className="flex min-w-0 flex-col gap-3 border-t border-line-soft py-4 first:border-0 first:pt-0 last:pb-0">
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
      <h4 className="text-body font-semibold text-ink">{layer.layer_id} · {layer.label}</h4>
      {stateCopy ? <Chip tone={stateCopy.tone}>{stateCopy.label}</Chip> : null}
    </div>
    {layer.unknown_reason ? <p className="text-caption leading-relaxed text-ink-3">{layer.unknown_reason}</p> : null}
    <PlayerRelations players={players} />
    {linkedEvidenceCount ? <>
      <p className="text-caption text-ink-3" aria-label="明確連結的資料列數">已連結資料列：支持 {supporting.length} · 挑戰 {opposing.length} · 方向未定 {unknown.length}</p>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">{groups.map(group => <EvidenceGroup key={group.title} title={group.title} items={group.items} />)}</div>
    </> : <p className="text-body leading-relaxed text-ink-3">
      {layer.link_state === "unlinked"
        ? "來源尚未提供可安全連結到此層的日期化公開證據；這不代表外部沒有相關資料，方向維持未知。"
        : "來源目前沒有可安全連結到此層的日期化公開證據；方向維持未知，不能由此判定正反。"}
    </p>}
    {conflicts.length || unlinkedEvidence.length || unlinkedPlayers.length ? <div className="flex min-w-0 flex-col gap-1 border-t border-line-soft pt-2">
      <IntegrityRows title="來源標示為衝突的資料" rows={conflicts} />
      <IntegrityRows title="無法安全連結的證據資料" rows={unlinkedEvidence} />
      <IntegrityRows title="無法安全連結的玩家關係" rows={unlinkedPlayers} />
    </div> : null}
    <details className="text-caption text-ink-3">
      <summary className="cursor-pointer py-1">這層的背景與來源</summary>
      <div className="flex flex-col gap-2 pt-2">
        <p><span className="font-medium text-ink-2">價值鏈位置：</span>{layer.who_earns || "來源未提供"}</p>
        <p><span className="font-medium text-ink-2">證據例：</span>{layer.evidence_examples || "來源未提供"}</p>
        <p><span className="font-medium text-ink-2">可證明範圍：</span>{layer.what_it_proves || "來源未提供"}</p>
        <p>證據日期：{sourceTimestamp(layer.source_date)} · 文件更新：{sourceTimestamp(layer.document_updated)}</p>
        <ul className="flex flex-col gap-1"><SourceReference source={layer.source} /></ul>
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
  return <article className="flex min-w-0 flex-col gap-2 p-4 sm:p-5">
    <SubsectionHeading>最近一次明確記錄的判斷與驗證</SubsectionHeading>
    {!hasContent ? <p className="text-body text-ink-3">尚未記錄。這裡只讀 scorecard 時間線，不以最新新聞或事件代替 learning。</p> : <>
      <p className="text-caption text-ink-3">{sourceTimestamp(record.date)}</p>
      <p className="text-body leading-relaxed text-ink-2"><span className="font-medium text-ink">當時判斷：</span>{record.judgment ? <InlineText text={record.judgment} /> : "尚未記錄"}</p>
      <p className="text-body leading-relaxed text-ink-2"><span className="font-medium text-ink">關鍵事實：</span>{record.key_evidence ? <InlineText text={record.key_evidence} /> : "尚未記錄"}</p>
      <p className="text-body leading-relaxed text-ink-2"><span className="font-medium text-ink">後續驗證：</span>{record.later_verification ? <InlineText text={record.later_verification} /> : "尚未記錄"}</p>
    </>}
    <StateNote state={record.state} reason={record.missing.length ? record.missing.join("；") : null} />
  </article>
}

const SCORECARD_REVIEW_STATUS_COPY: Record<InvestmentNarrativeScorecardUpdate["status"], string> = {
  evidence_updated_thesis_changed: "證據已更新，論點有變更",
  evidence_updated_thesis_unchanged: "證據已更新，論點維持",
  reviewed_thesis_changed: "已覆核，論點有變更",
  reviewed_thesis_unchanged: "已覆核，論點維持",
  evidence_pending_review: "有新證據待覆核",
  not_reviewed: "尚未覆核",
  unknown: "無法確認覆核狀態",
}
const PILLAR_LABELS: Record<string, string> = {
  l0_hardware: "L0 硬體供應",
  l1_cloud: "L1 雲端算力",
  l2_models: "L2 基礎模型",
  l2_5_application_software: "L2.5 應用軟體",
  l3_end_buyers: "L3 終端買方",
}

function scorecardScope(scope: string[]) {
  return scope.map(pillar => PILLAR_LABELS[pillar] ?? pillar).join(" · ") || "未提供範圍"
}

function ScorecardReview({ update }: { update?: InvestmentNarrativeScorecardUpdate | null }) {
  return <div className="flex min-w-0 flex-col gap-1 border-t border-line-soft pt-2">
    <p className="font-medium text-ink-2">AI 論點覆核記錄</p>
    <p>明確覆核日期：{sourceTimestamp(update?.updated_at)}</p>
    <p>覆核結果：{update ? SCORECARD_REVIEW_STATUS_COPY[update.status] : "來源未提供明確記錄"}</p>
    <p>覆核範圍：{scorecardScope(update?.scope ?? [])}</p>
    <p>Scorecard 原始文件更新：{sourceTimestamp(update?.document_updated_at)}</p>
    {update?.state ? <StateNote state={update.state} reason={update.reason} /> : <p className="text-caption text-ink-3">來源未提供可確認覆核日期、結果與範圍的資料。</p>}
    <ul className="flex flex-col gap-1"><SourceReference source={update?.source} /></ul>
  </div>
}

function NarrativeContent({ data, narrative }: { data: InvestmentNarrative; narrative: InvestmentNarrative["narratives"][number] }) {
  const evidence = narrative.thesis_evidence
  const unlinkedEvidence = unlinkedRowsWithoutLayerCard(evidence.unlinked_evidence, evidence.layers)
  const unlinkedPlayers = unlinkedRowsWithoutLayerCard(evidence.unlinked_players, evidence.layers)
  // The current producer contract has no dedicated falsifier field.
  const { challengeSignals, supportSignals, explicitFalsifiers } = narrativeSignalSections(evidence.directional_signals)
  const sources = uniqueSources([
    ...narrative.references,
    ...evidence.layers.map(layer => layer.source),
    ...evidence.directional_signals.map(signal => signal.source),
    evidence.scorecard_update?.source,
    ...unlinkedEvidence.map(row => row.source),
    ...unlinkedPlayers.map(row => row.source),
    evidence.latest_recorded_change.source,
  ])
  return <Card className="min-w-0 divide-y divide-line-soft overflow-hidden">
    <article className="flex min-w-0 flex-col gap-2 p-4 sm:p-5">
      <SubsectionHeading>我在押什麼</SubsectionHeading>
      {narrative.title ? <p className="text-caption text-ink-3">{narrative.title}</p> : null}
      {narrative.what_i_bet.narrative.text ? <p className="text-body leading-relaxed text-ink-2"><InlineText text={narrative.what_i_bet.narrative.text} /></p> : null}
      {narrative.what_i_bet.owner_thesis.text ? <p className="text-body leading-relaxed text-ink-2"><InlineText text={narrative.what_i_bet.owner_thesis.text} /></p> : null}
      {!narrative.what_i_bet.narrative.text && !narrative.what_i_bet.owner_thesis.text ? <p className="text-body text-ink-3">來源尚未提供可讀的論點；不補寫投資主張。</p> : null}
    </article>

    <article className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
      <SubsectionHeading>五層證據</SubsectionHeading>
      <p className="text-caption leading-relaxed text-ink-3">支持與反證只在來源明確連到該層時列出；沒有連結就保留未知，不代表該層沒有證據。</p>
      <div className="flex min-w-0 flex-col gap-1" aria-label="五層證據覆蓋狀態">
        <p className="text-caption font-medium text-ink-2">證據覆蓋：{STATE_COPY[evidence.state].label}</p>
        <StateNote state={evidence.state} reason={evidence.reason} />
      </div>
      {evidence.layers.length ? <ol className="flex min-w-0 flex-col">{evidence.layers.map(layer => <LayerEvidenceCard key={layer.layer_id} layer={layer} />)}</ol> : <p className="text-body text-ink-3">來源尚未提供可辨識的五層結構。</p>}
      {unlinkedEvidence.length || unlinkedPlayers.length ? <details className="border-t border-line-soft pt-2 text-caption text-ink-3">
        <summary className="cursor-pointer py-1">未顯示在五層卡片的資料</summary>
        <div className="flex min-w-0 flex-col gap-2 pt-2">
          <p>下列資料未能安全顯示在上方五層卡片；保留來源提供的層級代碼與限制，不推測證據方向。</p>
          <IntegrityRows title="未連結的證據資料" rows={unlinkedEvidence} />
          <IntegrityRows title="未連結的玩家關係" rows={unlinkedPlayers} />
        </div>
      </details> : null}
    </article>

    <article className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
      <SubsectionHeading>哪些訊號會支持或挑戰論點</SubsectionHeading>
      {narrative.current_tension.text ? <div className="flex flex-col gap-1 border-l-2 border-line pl-3">
        <p className="text-caption font-medium text-ink-2">目前張力</p>
        <p className="text-body leading-relaxed text-ink-2"><InlineText text={narrative.current_tension.text} /></p>
      </div> : null}
      <SignalGroup title="來源列出的挑戰訊號" signals={challengeSignals} emptyLabel="來源尚未列出明確的挑戰訊號。" />
      <SignalGroup title="來源列出的支持訊號" signals={supportSignals} emptyLabel="來源尚未列出明確的支持訊號。" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-caption font-medium text-ink-2">明確推翻條件</p>
        {explicitFalsifiers.length ? <ul className="list-disc pl-5 text-body leading-relaxed text-ink-2">{explicitFalsifiers.map((condition, index) => <li key={index}><InlineText text={condition} /></li>)}</ul> : <p className="text-caption leading-relaxed text-ink-3">{NARRATIVE_FALSIFIER_UNAVAILABLE_COPY}</p>}
      </div>
      {!evidence.directional_signals.length ? <p className="text-caption leading-relaxed text-ink-3">可用訊號缺失不等於反方不存在；不從文字或近期事件推測。</p> : null}
    </article>

    <details className="p-4 text-caption text-ink-3 sm:p-5">
      <summary className="cursor-pointer">日期與來源</summary>
      <div className="flex flex-col gap-2 pt-2">
        <ScorecardReview update={evidence.scorecard_update} />
        <p>看板論點資料更新日：{sourceTimestamp(narrative.updated)}</p>
        <p>看板資料產生時間：{sourceTimestamp(data.generated_at)} · 來源資料截點：{sourceTimestamp(data.source_cutoff)}</p>
        <p>文件更新日不代表每項訊號的發生日；來源沒有標日期時維持未知。</p>
        <ul className="flex flex-col gap-1">{sources.map((source, index) => <SourceReference key={`${source.path}:${source.line ?? index}`} source={source} />)}</ul>
        {data.limitations.map((limitation, index) => <p key={index} className="text-warn">{limitation}</p>)}
      </div>
    </details>

    <RecordedLearning record={evidence.latest_recorded_change} />
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
  return <section aria-label="我的論點｜五層證據" className="flex min-w-0 flex-col gap-3 break-words">
    <SectionHeading aside={<StateChip state={state} />}>我的論點｜五層證據</SectionHeading>
    <p className="text-caption leading-relaxed text-ink-3">依序看五層證據、目前訊號、日期與來源、最近一次明確記錄；資料完整度不代表論點成立。要回找當時判斷、後續結果與已記錄心得，請到 <Button variant="link" className="inline min-h-0 px-0 py-0 align-baseline" onClick={onOpenHistory}>復盤與學習</Button>。交易紀錄核對是另一項工作；PersonalOS 目前沒有對應入口。</p>
    {narrative ? <StateNote state={narrative.state} reason={narrative.state_reason} /> : null}
    {DEMO_MODE ? <p className="text-caption text-ink-3">展示內容全為合成範例；個人論點與持倉保持未知。</p> : null}
    {query.isPending && !data ? <p role="status" className="text-body text-ink-3">正在讀取論點來源；讀取完成前不顯示健康狀態。</p> : null}
    {query.isError ? <p role="alert" className="text-caption text-warn">這次論點來源讀取失敗。{data ? "以下保留上次讀取結果。" : "目前無法確認論點狀態。"}請按更新資料重試。</p> : null}
    {!query.isPending && !query.isError && !narrative ? <p role="status" className="text-body text-ink-3">目前沒有可讀的 AI narrative；來源未提供資料，不補寫論點。</p> : null}
    {data && narrative ? <NarrativeContent data={data} narrative={narrative} /> : null}
  </section>
}
