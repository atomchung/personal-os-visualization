import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, SectionHeading, SubsectionHeading } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { DEMO_MODE } from "@/lib/transport"
import { NARRATIVE_FALSIFIER_UNAVAILABLE_COPY, narrativeDisplayState, narrativeSignalSections, sourceTimestamp } from "@/lib/investmentFormat"
import {
  getInvestmentNarrative,
  type InvestmentNarrative,
  type InvestmentNarrativeDirectionalSignal,
  type InvestmentNarrativeEvidenceLayer,
  type InvestmentNarrativeRecordedChange,
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

function LayerEvidenceCard({ layer }: { layer: InvestmentNarrativeEvidenceLayer }) {
  return <li className="flex min-w-0 flex-col gap-3 border-t border-line-soft py-4 first:border-0 first:pt-0 last:pb-0">
    <div className="flex min-w-0 flex-col gap-3">
      <h4 className="text-body font-semibold text-ink">{layer.layer_id} · {layer.label}</h4>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-caption font-medium text-ink-2">支持證據</p>
          {layer.supporting.length ? <ul className="list-disc pl-5 text-body leading-relaxed text-ink-2">{layer.supporting.map((item, index) => <li key={index}><InlineText text={item} /></li>)}</ul> : <p className="text-caption leading-relaxed text-ink-3">未明確連結到此層。</p>}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-caption font-medium text-ink-2">反證</p>
          {layer.opposing.length ? <ul className="list-disc pl-5 text-body leading-relaxed text-ink-2">{layer.opposing.map((item, index) => <li key={index}><InlineText text={item} /></li>)}</ul> : <p className="text-caption leading-relaxed text-ink-3">未明確連結到此層。</p>}
        </div>
      </div>
    </div>
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

function NarrativeContent({ data, narrative }: { data: InvestmentNarrative; narrative: InvestmentNarrative["narratives"][number] }) {
  const evidence = narrative.thesis_evidence
  // The current producer contract has no dedicated falsifier field.
  const { challengeSignals, supportSignals, explicitFalsifiers } = narrativeSignalSections(evidence.directional_signals)
  const sources = uniqueSources([
    ...narrative.references,
    ...evidence.layers.map(layer => layer.source),
    ...evidence.directional_signals.map(signal => signal.source),
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
      <StateNote state={evidence.state} reason={evidence.reason} />
      {evidence.layers.length ? <ol className="flex min-w-0 flex-col">{evidence.layers.map(layer => <LayerEvidenceCard key={layer.layer_id} layer={layer} />)}</ol> : <p className="text-body text-ink-3">來源尚未提供可辨識的五層結構。</p>}
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
        <p>Scorecard 更新：{sourceTimestamp(narrative.updated)} · 頁面讀取資料截點：{sourceTimestamp(data.source_cutoff)}</p>
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
    <p className="text-caption leading-relaxed text-ink-3">依序看五層證據、目前訊號、日期與來源、最近一次明確記錄；資料完整度不代表論點成立。要回找當時判斷、後續結果與已記錄心得，請到 <Button variant="link" className="inline min-h-0 px-0 py-0 align-baseline" onClick={onOpenHistory}>舊判斷回看</Button>。交易紀錄核對是另一項工作；PersonalOS 目前沒有對應入口。</p>
    {narrative ? <StateNote state={narrative.state} reason={narrative.state_reason} /> : null}
    {DEMO_MODE ? <p className="text-caption text-ink-3">展示內容全為合成範例；個人論點與持倉保持未知。</p> : null}
    {query.isPending && !data ? <p role="status" className="text-body text-ink-3">正在讀取論點來源；讀取完成前不顯示健康狀態。</p> : null}
    {query.isError ? <p role="alert" className="text-caption text-warn">這次論點來源讀取失敗。{data ? "以下保留上次讀取結果。" : "目前無法確認論點狀態。"}請按更新資料重試。</p> : null}
    {!query.isPending && !query.isError && !narrative ? <p role="status" className="text-body text-ink-3">目前沒有可讀的 AI narrative；來源未提供資料，不補寫論點。</p> : null}
    {data && narrative ? <NarrativeContent data={data} narrative={narrative} /> : null}
  </section>
}
