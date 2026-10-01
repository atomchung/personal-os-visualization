import { Card } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { InlineText } from "./ReadingText"
import { sourceTimestamp } from "@/lib/investmentFormat"
import type { NewsEvents, NewsEvent, EventSource, EventCheckResult, InvestmentOverdueCheckpoint } from "@/lib/investment"

const DIRECTIONS: Record<string, string> = { supports: "支持", challenges: "挑戰", mixed: "正反並存", unknown: "方向待確認" }

export function EventSources({ sources }: { sources: EventSource[] }) {
  return <ul className="flex min-w-0 flex-col gap-2 text-caption text-ink-3">{sources.map((source, index) => <li key={index} className="flex min-w-0 flex-col gap-1">
    <p className="break-all">{source.path ?? "來源位置未提供"}{source.line ? `:${source.line}` : ""}{source.at ? ` · ${sourceTimestamp(source.at)}` : ""}</p>
    {source.source_cutoff ? <p>資訊截至 {sourceTimestamp(source.source_cutoff)}</p> : null}
    {source.raw ? <p className="text-body leading-relaxed"><InlineText text={source.raw} /></p> : null}
  </li>)}</ul>
}

const CHECK_OUTCOMES: Record<EventCheckResult["outcome"], string> = {
  resolved: "檢查已完成", no_new_disclosure: "本次沒有新增揭露", follow_up: "另有後續驗證點",
}

function hasVerifiedResult(event: NewsEvent): boolean {
  const checkpoint = event.checkpoint
  const proof = checkpoint.event_result
  return checkpoint.state === "linked" && !!event.story_id && checkpoint.story_id === event.story_id
    && checkpoint.result_state === "resolved" && proof?.state === "verified"
    && proof.schema_version === 1 && proof.story_id === event.story_id && proof.status === "result_received"
    && proof.verification_state === "verified" && proof.source_type === "primary"
}

function CheckpointResults({ event, events }: { event: NewsEvent; events: NewsEvent[] }) {
  const checkpoint = event.checkpoint
  const sameEvent = checkpoint.state === "linked" && !!event.story_id && checkpoint.story_id === event.story_id
  const proof = checkpoint.event_result
  const verified = hasVerifiedResult(event)
  return <details className="text-caption text-ink-3">
    <summary className="cursor-pointer py-1">原先登記的驗證點 · {sameEvent ? "同一事件" : "來源關聯待釐清"}</summary>
    {verified ? <p className="pb-2">原事件結果已核實；個別後續驗證點另列。</p> : checkpoint.result_state === "partial" || proof?.state === "partial" ? <p className="pb-2">結果來源部分可用，尚未確認完成。</p> : null}
    <ul className="flex min-w-0 flex-col gap-3">{checkpoint.checks.map((check, index) => {
      const result = check.result
      const proofChecks = proof?.check_results?.filter(item => item.scope === check.scope) ?? []
      const proofCheck = proofChecks.length === 1 ? proofChecks[0] : null
      const outcome = verified && check.state === "registered" && result?.scope === check.scope
        && check.result_state === result.outcome && Object.hasOwn(CHECK_OUTCOMES, result.outcome)
        && typeof result.summary === "string" && result.summary.trim() && proofCheck?.outcome === result.outcome
        && proofCheck.summary === result.summary && proofCheck.follow_up_story_id === result.follow_up_story_id ? result : null
      const followUp = outcome?.follow_up_story_id
      const titles = [...new Set(events.filter(item => item.story_id === followUp).map(item => item.title.trim()).filter(Boolean))]
      const followUpTitle = followUp && titles.length === 1 ? titles[0] : null
      return <li key={index} className="flex min-w-0 flex-col gap-1">
        <p>{check.scope} · {check.check ?? "檢查條件未提供"} · {outcome ? CHECK_OUTCOMES[outcome.outcome] : "結果尚未逐項驗證"}</p>
        {outcome ? <p className="text-body leading-relaxed text-ink-2"><InlineText text={outcome.summary} /></p> : null}
        {followUp ? <p className="break-all">後續事件 · {followUpTitle ? <><InlineText text={followUpTitle} /> · </> : null}{followUp}</p> : null}
        {outcome?.outcome === "follow_up" && !followUp ? <p>後續事件身份未提供。</p> : null}
      </li>
    })}</ul>
  </details>
}

function EventCard({ event, events }: { event: NewsEvent; events: NewsEvent[] }) {
  const latest = event.occurrences.at(-1)
  const hasTickers = event.affected_tickers.length > 0
  const hasThesisRelation = event.canonical_claim_effects.length > 0 || event.thesis_effects.length > 0
  // Neither side of the linkage is present -- say so once, inside the
  // existing source details, instead of two separate unresolved main lines.
  const missingLinkage = !hasTickers && !hasThesisRelation
  return <Card className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2"><p className="text-body font-medium leading-relaxed text-ink"><InlineText text={event.title} /></p><div className="flex flex-wrap gap-2">{hasVerifiedResult(event) ? <Chip tone="mute">原事件結果已核實</Chip> : null}{event.state === "conflict" ? <Chip tone="warn">來源影響有分歧</Chip> : event.state === "unlinked" ? <Chip tone="mute">事件關聯未登記</Chip> : null}</div></div>
    {missingLinkage ? null : <p className="text-caption text-ink-3">影響標的：{hasTickers ? event.affected_tickers.join("、") : "來源尚未明示"}</p>}
    {latest?.source.source_cutoff || latest?.source.at ? <p className="text-caption text-ink-3">來源資訊截至 {sourceTimestamp(latest.source.source_cutoff ?? latest.source.at)}</p> : null}
    {latest?.market_reaction ? <p className="text-body leading-relaxed text-ink-2"><span className="text-ink-3">市場反應 · </span><InlineText text={latest.market_reaction} /></p> : null}
    {latest?.interpretation ? <p className="text-body leading-relaxed text-ink-2"><span className="text-ink-3">市場解讀 · </span><InlineText text={latest.interpretation} /></p> : null}
    {event.ticker_effects.length ? <ul className="flex min-w-0 flex-col gap-2">{event.ticker_effects.map((effect, index) => <li key={index} className="text-body leading-relaxed text-ink-2"><span className="font-medium">{effect.ticker}：</span><InlineText text={effect.effect} /></li>)}</ul> : latest?.impact ? <p className="text-body leading-relaxed text-ink-2"><span className="text-ink-3">來源的持倉影響 · </span><InlineText text={latest.impact} /></p> : null}
    {missingLinkage ? null : <div className="flex min-w-0 flex-col gap-2 border-t border-line-soft pt-2">
      <p className="text-caption font-medium text-ink-3">對論點的影響</p>
      {event.canonical_claim_effects.map((effect, index) => <p key={`claim-${index}`} className="text-body leading-relaxed text-ink-2">{DIRECTIONS[effect.direction] ?? "方向待確認"} · {effect.claim_id}：<InlineText text={effect.reason} /></p>)}
      {event.thesis_effects.map((effect, index) => <p key={`candidate-${index}`} className="text-body leading-relaxed text-ink-2"><span className="text-caption text-ink-3">候選判讀 · </span>{DIRECTIONS[effect.direction] ?? "方向待確認"} · {effect.narrative_id ?? effect.thesis_ref ?? "論點未提供"}：<InlineText text={effect.reason ?? "來源未說明影響理由"} /></p>)}
      {!hasThesisRelation ? <p className="text-caption text-ink-3">來源未明示論點關聯；不由標的名稱推定。</p> : null}
    </div>}
    {event.checkpoint.state !== "unlinked" ? <CheckpointResults event={event} events={events} /> : null}
    <details className="border-t border-line-soft pt-2 text-caption text-ink-3"><summary className="cursor-pointer py-1">來源與事件更新 · {event.occurrences.length}</summary>
      {missingLinkage ? <p className="pb-2">來源沒有標明影響標的與論點關聯。</p> : null}
      <ul className="flex min-w-0 flex-col gap-3">{event.occurrences.map((occurrence, index) => <li key={index} className="flex min-w-0 flex-col gap-1"><p className="text-body"><InlineText text={occurrence.title} /></p>{occurrence.impact ? <p><InlineText text={occurrence.impact} /></p> : null}<EventSources sources={[occurrence.source]} /></li>)}</ul>
    </details>
    {event.canonical_claim_effects.length ? <details className="text-caption text-ink-3"><summary className="cursor-pointer py-1">已登記的論點證據來源</summary><ul className="flex min-w-0 flex-col gap-2">{event.canonical_claim_effects.map((effect, index) => <li key={index}>{effect.evidence_id} · {effect.claim_id}{effect.source ? <EventSources sources={[effect.source]} /> : null}</li>)}</ul></details> : null}
    {event.limitations.map((limitation, index) => <p key={index} className="text-caption text-warn">{limitation}</p>)}
  </Card>
}

export function EventNews({ projection }: { projection: NewsEvents }) {
  return <div className="flex min-w-0 flex-col gap-3">
    {projection.state !== "ready" ? <p className="text-caption text-ink-3">事件來源或關聯部分可用；缺少關聯不代表沒有影響。</p> : null}
    {projection.items.length ? [...projection.items].reverse().map(event => <EventCard key={event.key} event={event} events={[...projection.items, ...(projection.retired_items ?? [])]} />) : <p className="text-body text-ink-3">本次來源沒有可讀的事件；不代表沒有新聞。</p>}
    {projection.overdue_checkpoints?.length ? <OverdueCheckpoints items={projection.overdue_checkpoints} /> : null}
  </div>
}

function OverdueCheckpoints({ items }: { items: InvestmentOverdueCheckpoint[] }) {
  return <section aria-label="已到期檢查點" className="flex min-w-0 flex-col gap-3 border-t border-line-soft pt-3">
    <div className="flex min-w-0 flex-col gap-1">
      <p className="text-body font-medium text-ink">已到期檢查點 · 等待來源更新</p>
      <p className="text-caption text-ink-3">這是來源回報狀態，無需手動確認；尚未確認的結果不當作已完成或新判斷。</p>
    </div>
    <ul className="flex min-w-0 flex-col gap-3">
      {items.map(item => <li key={item.story_id} className="flex min-w-0 flex-col gap-2 border-l-2 border-line-soft pl-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-2"><p className="min-w-0 text-body font-medium text-ink"><InlineText text={item.title} /></p><Chip tone="warn">{item.result_state === "pending" ? "等待來源回報" : "來源結果未確認"}</Chip><span className="text-caption text-ink-3">到期 {sourceTimestamp(item.due_date)}</span></div>
        {item.checks.map((check, index) => <p key={`${check.scope}:${index}`} className="text-body text-ink-2">{check.scope} · {check.check || "來源未提供檢查條件"}</p>)}
        {item.affected_tickers.length || item.affected_scopes.length ? <p className="text-caption text-ink-3">涵蓋：{[...item.affected_tickers, ...item.affected_scopes].join("、")}</p> : null}
        <details className="text-caption text-ink-3"><summary className="cursor-pointer py-1">來源與事件身份</summary><ul className="flex flex-col gap-1 pt-1">{item.sources.map((source, index) => <li key={`${source.path ?? "source"}:${index}`} className="break-all">{source.path ?? "來源位置未提供"}{source.line ? `:${source.line}` : ""}{source.raw ? <p className="pt-1"><InlineText text={source.raw} /></p> : null}</li>)}</ul><p className="pt-1">story ID：{item.story_id}</p>{!item.sources.length ? <p>來源位置未提供。</p> : null}{item.limitations.map((note, index) => <p key={`limitation:${index}`} className="text-warn"><InlineText text={note} /></p>)}</details>
      </li>)}
    </ul>
  </section>
}
