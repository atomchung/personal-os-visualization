import { CardSection, SubsectionHeading } from "@/components/ui/card"
import type { InvestmentNarrativeSource, InvestmentNarrativeThesisEvidence } from "@/lib/investment"
import { claimEvidenceView, type ClaimEvidenceDirection, type ClaimEvidenceIssue, type ClaimEvidenceRow } from "@/lib/investmentClaimEvidence"
import { sourceTimestamp } from "@/lib/investmentFormat"
import { InlineText } from "./ReadingText"

const DIRECTIONS: Record<ClaimEvidenceDirection, string> = {
  supports: "支持此主張",
  challenges: "挑戰此主張",
  mixed: "對此主張有混合影響",
  unknown: "關係尚待確認",
}

type SnapshotState = "available" | "cached" | "stale"

function Source({ label, source }: { label: string; source?: InvestmentNarrativeSource | null }) {
  return <p className="break-all">{label}：{source ? <>{source.label ? `${source.label} · ` : ""}{source.path}{source.line ? `:${source.line}` : ""}</> : "來源位置未提供"}</p>
}

function RelationRow({ row, snapshotState }: { row: ClaimEvidenceRow; snapshotState: SnapshotState }) {
  const item = row.evidence
  const date = item && "source_date" in item ? item.source_date : item?.evidence_date
  // Transport/snapshot freshness qualifies the presentation only. It cannot
  // rewrite the producer's explicit direction or make expired evidence current.
  const timing = row.timing === "historical" ? "historical" : snapshotState !== "available" ? "snapshot" : row.timing
  const timingLabel = timing === "historical" ? "歷史資料，來源已過期" : timing === "snapshot" ? "保留來源關係記錄，目前尚未重新確認" : timing === "current" ? "來源標示目前有效" : "證據時效尚未確認"
  return <li data-claim-direction={row.direction} data-evidence-timing={timing} className="flex min-w-0 flex-col gap-1.5 border-t border-line-soft py-3 first:border-0 first:pt-0 last:pb-0">
    <p className="text-caption font-medium text-ink-2">{timingLabel}</p>
    <p className="whitespace-pre-wrap text-body leading-relaxed text-ink-2">{row.relation.reason ? <InlineText text={row.relation.reason} /> : "來源尚未提供關係理由。"}</p>
    {row.timing === "historical" ? <p className="text-caption text-ink-3">保留過去的關係記錄，不代表目前仍然成立。</p> : null}
    {row.notes.map((note, index) => <p key={index} className="text-caption leading-relaxed text-ink-3">{note}</p>)}
    {row.sourceUrl ? <a href={row.sourceUrl} target="_blank" rel="noreferrer" className="w-fit text-caption text-ink underline decoration-accent decoration-2 underline-offset-2">查看這筆證據來源 ↗</a> : null}
    <details className="text-caption leading-relaxed text-ink-3">
      <summary className="cursor-pointer py-1">關係理由的出處與日期</summary>
      <div className="flex min-w-0 flex-col gap-1 pt-1">
        <p className="break-all">證據 ID：{row.relation.evidence_id} · 主張 ID：{row.relation.claim_id}</p>
        <p>關係評估日：{sourceTimestamp(row.relation.assessed_at)} · 證據來源日：{sourceTimestamp(date)}</p>
        {row.direction === "unknown" ? <p>來源填寫方向：{DIRECTIONS[row.relation.direction] ?? "未提供可辨識方向"}；尚未採用為已確認關係。</p> : null}
        <Source label="關係來源" source={row.relation.source} />
        <Source label="證據來源" source={item?.source} />
        {item?.explanation ? <p className="whitespace-pre-wrap">證據原文：<InlineText text={item.explanation} /></p> : null}
        {!row.sourceUrl ? <p>沒有可明確對應並安全開啟的公開來源連結。</p> : null}
        {[...(row.relation.limitations ?? []), ...(item?.limitations ?? [])].map((limitation, index) => <p key={index}>限制：{limitation}</p>)}
      </div>
    </details>
  </li>
}

function rawText(row: Record<string, unknown>, key: string): string | null {
  return typeof row[key] === "string" && row[key].trim() ? row[key] : null
}

function Issue({ issue }: { issue: ClaimEvidenceIssue }) {
  return <li className="flex min-w-0 flex-col gap-1 border-t border-line-soft py-2 first:border-0 first:pt-0">
    <p className="text-ink-2">{issue.message}</p>
    {issue.evidenceId || issue.claimId ? <p className="break-all">{issue.evidenceId ? `證據 ID：${issue.evidenceId}` : ""}{issue.evidenceId && issue.claimId ? " · " : ""}{issue.claimId ? `主張 ID：${issue.claimId}` : ""}</p> : null}
    {issue.rows.map((row, index) => {
      const source = row.source && typeof row.source === "object" && "path" in row.source && typeof row.source.path === "string" ? row.source as InvestmentNarrativeSource : null
      return <div key={index} className="flex min-w-0 flex-col gap-1 border-l-2 border-line-soft pl-3">
        {rawText(row, "title") ? <p>{rawText(row, "title")}</p> : null}
        {rawText(row, "claim_statement") ? <p><InlineText text={rawText(row, "claim_statement")!} /></p> : null}
        {rawText(row, "reason") ? <p><InlineText text={rawText(row, "reason")!} /></p> : null}
        {rawText(row, "direction") ? <p>來源填寫方向：{DIRECTIONS[row.direction as ClaimEvidenceDirection] ?? rawText(row, "direction")}</p> : null}
        {rawText(row, "assessed_at") ? <p>關係評估日：{sourceTimestamp(rawText(row, "assessed_at"))}</p> : null}
        <Source label="原始資料來源" source={source} />
        {Array.isArray(row.limitations) ? row.limitations.filter((value): value is string => typeof value === "string").map((value, i) => <p key={i}>限制：{value}</p>) : null}
      </div>
    })}
  </li>
}

export function ClaimEvidence({ evidence, snapshotState = "available" }: { evidence: InvestmentNarrativeThesisEvidence; snapshotState?: SnapshotState }) {
  const view = claimEvidenceView(evidence)
  const snapshot = snapshotState === "cached" ? "cached" : snapshotState === "stale" || evidence.state === "stale" ? "stale" : "available"
  return <CardSection as="article" density="normal" aria-label="主張與證據" data-claim-evidence-state={view.state} data-claim-evidence-snapshot={snapshot} className="min-w-0 break-words [overflow-wrap:anywhere]">
    <SubsectionHeading>主張與證據</SubsectionHeading>
    {snapshot !== "available" ? <p className="text-caption leading-relaxed text-warn">{snapshot === "cached" ? "本次讀取失敗；以下保留上次讀取的主張與關係，尚未重新確認目前狀態。" : "來源整體標為較舊；以下保留原有主張與關係，尚未重新確認目前狀態。"}</p> : null}
    <p className="text-caption leading-relaxed text-ink-3">{view.notice}</p>
    {view.claims.map(({ claim, rows }) => <section key={claim.claim_id} aria-label={claim.title || "來源主張"} className="flex min-w-0 flex-col gap-3 border-t border-line-soft pt-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h4 className="text-body font-semibold text-ink">{claim.title || "主張標題未提供"}</h4>
        <p className="whitespace-pre-wrap text-body leading-relaxed text-ink-2">{claim.claim_statement ? <InlineText text={claim.claim_statement} /> : "主張原文未提供。"}</p>
      </div>
      {(["supports", "challenges", "mixed", "unknown"] as const).map(direction => {
        const items = rows.filter(row => row.direction === direction)
        return items.length ? <div key={direction} className="flex min-w-0 flex-col gap-2">
          <h5 className="text-caption font-semibold text-ink">{DIRECTIONS[direction]}</h5>
          <ul className="flex min-w-0 flex-col">{items.map((row, index) => <RelationRow key={`${row.relation.evidence_id}:${index}`} row={row} snapshotState={snapshot} />)}</ul>
        </div> : null
      })}
      {!rows.length ? <p className="text-caption leading-relaxed text-ink-3">{view.state === "unavailable" ? "此主張的關係資料尚未提供。" : "目前沒有可明確對應到此主張的關係列；不代表沒有支持或反方。"}</p> : null}
      <details className="text-caption leading-relaxed text-ink-3"><summary className="cursor-pointer py-1">主張原文出處</summary><div className="flex min-w-0 flex-col gap-1 pt-1"><p className="break-all">主張 ID：{claim.claim_id}</p><Source label="主張來源" source={claim.source} />{claim.supersedes ? <p className="break-all">來源明示取代的主張 ID：{claim.supersedes}</p> : null}</div></details>
    </section>)}
    {view.issues.length ? <details className="text-caption leading-relaxed text-ink-3"><summary className="cursor-pointer py-1">未連結或有衝突的資料 · {view.issues.length} 項</summary><ul className="flex min-w-0 flex-col pt-2">{view.issues.map((issue, index) => <Issue key={index} issue={issue} />)}</ul></details> : null}
    {view.reasons.length || view.sources.length ? <details className="text-caption leading-relaxed text-ink-3"><summary className="cursor-pointer py-1">關係資料的範圍與來源</summary><div className="flex min-w-0 flex-col gap-1 pt-1">{view.reasons.map((reason, index) => <p key={index}>{reason}</p>)}{view.sources.map((source, index) => <Source key={index} label="資料來源" source={source} />)}</div></details> : null}
  </CardSection>
}
