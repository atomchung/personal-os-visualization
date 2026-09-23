import { useQuery } from "@tanstack/react-query"
import { Card, SectionHeading, SubsectionHeading } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { DEMO_MODE } from "@/lib/transport"
import { sourceTimestamp } from "@/lib/investmentFormat"
import {
  getInvestmentNarrative,
  type InvestmentNarrative,
  type InvestmentNarrativeExpression,
  type InvestmentNarrativeSource,
  type InvestmentNarrativeState,
} from "@/lib/investment"
import { InlineText } from "./ReadingText"

type DisplayState = InvestmentNarrativeState | "unavailable"

const STATE_COPY: Record<DisplayState, { label: string; tone: "ok" | "warn" | "bad" | "mute" }> = {
  ready: { label: "來源已對上", tone: "ok" },
  partial: { label: "資料部分可用", tone: "warn" },
  stale: { label: "來源較舊", tone: "warn" },
  drift: { label: "來源關聯不一致", tone: "bad" },
  unknown: { label: "狀態未知", tone: "mute" },
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

function DecisionViewLink({ item }: { item: InvestmentNarrativeExpression }) {
  const decision = item.decision_view
  if (decision.state !== "ready" || !decision.decision_id) {
    return <div className="flex flex-wrap items-center gap-2">
      <StateChip state={decision.state} />
      <span className="text-caption text-ink-3">{decision.reason || "現有 Decision View 尚不可用。"}</span>
    </div>
  }
  const href = `/api/investment/decision-view?ticker=${encodeURIComponent(item.ticker)}&decision_id=${encodeURIComponent(decision.decision_id)}`
  return <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="inline-flex min-h-8 items-center font-semibold text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-sys-blue"
  >查看現有 Decision View · {decision.decision_id} ↗</a>
}

function ExpressionRow({ item }: { item: InvestmentNarrativeExpression }) {
  const holdingState = item.holding_state === "ready" ? "ready" : "unknown"
  const sources = [item.linkage.source, item.thesis_source, ...item.decision_view.sources]
  return <li className="flex min-w-0 flex-col gap-2 border-t border-line-soft py-3 first:border-0 first:pt-0 last:pb-0">
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-body font-semibold text-ink">{item.ticker}</span>
      <StateChip state={holdingState} />
      {item.linkage.state !== "ready" ? <StateChip state={item.linkage.state} /> : null}
      {item.holding_reason ? <span className="text-caption text-ink-3">{item.holding_reason}</span> : null}
    </div>
    <DecisionViewLink item={item} />
    {item.linkage.reason ? <StateNote state={item.linkage.state} reason={item.linkage.reason} /> : null}
    {sources.some(Boolean) ? <details className="text-caption text-ink-3">
      <summary className="cursor-pointer py-1">查看持倉與判斷來源</summary>
      <ul className="flex flex-col gap-1 pt-1"><SourceReference source={item.linkage.source} /><SourceReference source={item.thesis_source} />{item.decision_view.sources.map((source, index) => <SourceReference key={`${source.path}:${index}`} source={source} />)}</ul>
    </details> : null}
  </li>
}

function NarrativeContent({ data, narrative }: { data: InvestmentNarrative; narrative: InvestmentNarrative["narratives"][number] }) {
  const latest = narrative.latest_change
  return <Card className="min-w-0 divide-y divide-line-soft overflow-hidden">
    <article className="flex min-w-0 flex-col gap-2 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SubsectionHeading>我在押什麼</SubsectionHeading>
        <StateChip state={narrative.what_i_bet.state} />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-caption text-ink-3">AI 大故事</p>
          <StateChip state={narrative.what_i_bet.narrative.state} />
        </div>
        {narrative.what_i_bet.narrative.text ? <p className="text-body leading-relaxed text-ink-2"><InlineText text={narrative.what_i_bet.narrative.text} /></p> : <p className="text-body text-ink-3">尚未取得可讀的敘事內容。</p>}
        <StateNote state={narrative.what_i_bet.narrative.state} reason={narrative.what_i_bet.narrative.reason} />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-caption text-ink-3">既有 owner thesis</p>
          <StateChip state={narrative.what_i_bet.owner_thesis.state} />
        </div>
        {narrative.what_i_bet.owner_thesis.text ? <p className="text-body leading-relaxed text-ink-2"><InlineText text={narrative.what_i_bet.owner_thesis.text} /></p> : <p className="text-body text-ink-3">尚未取得 owner thesis。</p>}
        <StateNote state={narrative.what_i_bet.owner_thesis.state} reason={narrative.what_i_bet.owner_thesis.reason} />
      </div>
      <div className="flex min-w-0 flex-col gap-2 border-l-2 border-line pl-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SubsectionHeading>當前關鍵張力</SubsectionHeading>
          <StateChip state={narrative.current_tension.state} />
        </div>
        {narrative.current_tension.text ? <p className="text-body leading-relaxed text-ink-2"><InlineText text={narrative.current_tension.text} /></p> : <p className="text-body text-ink-3">尚未取得來源中的關鍵張力。</p>}
        <StateNote state={narrative.current_tension.state} reason={narrative.current_tension.reason} />
      </div>
      <StateNote state={narrative.what_i_bet.state} reason={narrative.what_i_bet.reason} />
    </article>

    <article className="flex min-w-0 flex-col gap-2 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SubsectionHeading>哪些持倉在表達這個故事</SubsectionHeading>
        <StateChip state={narrative.expressions.state} />
      </div>
      {narrative.expressions.items.length ? <ul className="flex min-w-0 flex-col">{narrative.expressions.items.map(item => <ExpressionRow key={item.ticker} item={item} />)}</ul> : <p className="text-body text-ink-3">{narrative.expressions.reason || "目前無法確認哪些持倉表達這個故事。"}</p>}
      <StateNote state={narrative.expressions.state} reason={narrative.expressions.reason} />
    </article>

    <article className="flex min-w-0 flex-col gap-2 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SubsectionHeading>最近哪一環變化，為什麼重要</SubsectionHeading>
        <StateChip state={latest.state} />
      </div>
      {latest.item ? <>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-body font-medium leading-relaxed text-ink"><InlineText text={latest.item.text || "事件文字未知"} /></p>
          <span className="text-caption text-ink-3">{sourceTimestamp(latest.item.at)}</span>
        </div>
        {latest.item.why_important ? <p className="text-body leading-relaxed text-ink-2"><span className="font-medium text-ink">為什麼重要：</span><InlineText text={latest.item.why_important} /></p> : <p className="text-body text-ink-3">來源尚未提供這次變化對判斷的影響；重要性未知。</p>}
        {latest.item.market_reaction || latest.item.interpretation ? <details className="text-caption text-ink-3">
          <summary className="cursor-pointer py-1">查看市場反應與來源判讀</summary>
          <div className="flex flex-col gap-2 pt-1 text-body leading-relaxed text-ink-2">{latest.item.market_reaction ? <p><InlineText text={latest.item.market_reaction} /></p> : null}{latest.item.interpretation ? <p><InlineText text={latest.item.interpretation} /></p> : null}</div>
        </details> : null}
      </> : <p className="text-body text-ink-3">目前沒有明確關聯到這個故事的最新事件；不以文字相似推斷。</p>}
      <StateNote state={latest.state} reason={latest.reason} />
    </article>

    <details className="p-4 text-caption text-ink-3 sm:p-5">
      <summary className="cursor-pointer">資料來源與完整度</summary>
      <div className="flex flex-col gap-2 pt-2">
        <p>論點：{narrative.narrative_id || "ID 未知"} · scorecard 更新：{sourceTimestamp(narrative.updated)} · 論點來源時間：{sourceTimestamp(data.source_cutoff)}</p>
        <ul className="flex flex-col gap-1">{narrative.references.map((source, index) => source ? <SourceReference key={`${source.path}:${index}`} source={source} /> : null)}</ul>
        {data.limitations.map((limitation, index) => <p key={index} className="text-warn">{limitation}</p>)}
      </div>
    </details>
  </Card>
}

export function InvestmentNarrativeSection({ enabled }: { enabled: boolean }) {
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
  const state: DisplayState = query.isError ? "unavailable" : data?.state ?? "unknown"
  return <section aria-label="我的論點" className="flex min-w-0 flex-col gap-3 break-words">
    <SectionHeading aside={<StateChip state={state} />}>我的論點</SectionHeading>
    <p className="text-caption text-ink-3">沿著同一條論點脈絡讀：我在押什麼 → 關鍵張力 → 哪些持倉在表達 → 最近哪一環變化及其重要性。每一環都保留來源狀態。</p>
    {DEMO_MODE ? <p className="text-caption text-ink-3">展示版只提供合成資料；個人論點與持倉保持未知。</p> : null}
    {query.isPending && !data ? <p role="status" className="text-body text-ink-3">正在讀取論點來源；讀取完成前不顯示健康狀態。</p> : null}
    {query.isError ? <p role="alert" className="text-caption text-warn">這次論點來源讀取失敗。{data ? "以下保留上次讀取結果。" : "目前無法確認論點狀態。"}請按更新資料重試。</p> : null}
    {!query.isPending && !query.isError && !narrative ? <p role="status" className="text-body text-ink-3">目前沒有可讀的 AI narrative；來源未提供資料，不補寫論點。</p> : null}
    {data && narrative ? <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <SubsectionHeading>{narrative.title || "AI 大故事標題未提供"}</SubsectionHeading>
        <span className="text-caption text-ink-3">論點來源時間 {sourceTimestamp(data.source_cutoff)}</span>
      </div>
      <StateNote state={narrative.state} reason={narrative.state_reason} />
      <NarrativeContent data={data} narrative={narrative} />
    </> : null}
  </section>
}
