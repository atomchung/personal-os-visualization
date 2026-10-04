import type { InvestmentClaim, InvestmentEvidenceClaimRelation, InvestmentNarrativeLayerEvidence, InvestmentNarrativeLayerRow, InvestmentNarrativeSource, InvestmentNarrativeThesisEvidence } from "./investment.ts"

type Evidence = InvestmentNarrativeLayerEvidence | InvestmentNarrativeLayerRow
export type ClaimEvidenceDirection = InvestmentEvidenceClaimRelation["direction"]
export type ClaimEvidenceRow = {
  relation: InvestmentEvidenceClaimRelation
  direction: ClaimEvidenceDirection
  evidence: Evidence | null
  sourceUrl: string | null
  timing: "current" | "historical" | "unknown"
  notes: string[]
}
export type ClaimEvidenceIssue = {
  message: string
  evidenceId?: string
  claimId?: string
  rows: Array<Record<string, unknown>>
}
export type ClaimEvidenceView = {
  state: "unavailable" | "empty" | "ready" | "partial" | "unknown" | "conflict"
  notice: string
  claims: Array<{ claim: InvestmentClaim; rows: ClaimEvidenceRow[] }>
  issues: ClaimEvidenceIssue[]
  reasons: string[]
  sources: InvestmentNarrativeSource[]
}

const NOTICE: Record<ClaimEvidenceView["state"], string> = {
  unavailable: "來源尚未提供證據與主張的關係資料；目前無法查看逐項支持或反方。",
  empty: "來源明確列出零筆已對應的關係；這不代表沒有反方證據。",
  ready: "逐項呈現來源已連結的主張與理由；列出的關係不代表反方已完整檢查。",
  partial: "關係資料部分可用；尚未連結或待確認的內容另列，不能當成沒有反方。",
  unknown: "關係資料尚未確認；保留來源原文，暫不作支持或挑戰分類。",
  conflict: "部分主張或關係有衝突；衝突內容另列，尚未選定其中一筆。",
}

/** Only HTTPS public source URLs from an exact, unambiguous evidence ID. */
export function claimEvidenceSourceUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null
  } catch { return null }
}

const records = <T>(values: T[]) => [...new Map(values.map(value => [JSON.stringify(value), value])).values()]
const idExists = (value: unknown): value is string => typeof value === "string" && Boolean(value.trim())

function evidenceRows(evidence: InvestmentNarrativeThesisEvidence): Evidence[] {
  // Branch arrays can repeat the principal rows. Deduplicate only identical
  // records; distinct records with one ID remain ambiguous, never latest-wins.
  return records(evidence.layers.flatMap(layer => [
    ...(layer.evidence ?? []),
    ...[...(layer.supporting ?? []), ...(layer.challenging ?? []), ...(layer.opposing ?? []), ...(layer.unknown ?? [])].filter((row): row is Evidence => typeof row !== "string"),
    ...(layer.unlinked_evidence ?? []), ...(layer.conflicts ?? []),
  ]).concat(evidence.unlinked_evidence ?? []))
}

function indexById<T>(rows: T[], getId: (row: T) => string | undefined) {
  const index = new Map<string, T[]>()
  for (const row of rows) {
    const id = getId(row)
    if (idExists(id)) index.set(id, [...(index.get(id) ?? []), row])
  }
  return index
}

/** A read-only exact-ID projection, not a judgment or a completeness test.
 * Layer polarity, ticker, titles and prose never create claim relationships. */
export function claimEvidenceView(evidence: InvestmentNarrativeThesisEvidence): ClaimEvidenceView {
  const registry = evidence.claim_registry
  const receipt = evidence.evidence_claim_relations
  const allEvidence = evidenceRows(evidence)
  const byEvidenceId = indexById(allEvidence, row => row.evidence_id)
  const embedded = allEvidence.filter(row => Array.isArray(row.claim_relations))
  const declared = receipt ? Array.isArray(receipt.relations) : embedded.length > 0
  // A declared global receipt owns the relationship list, including an empty
  // one. Embedded rows are only used when that receipt is absent.
  const issues: ClaimEvidenceIssue[] = []
  const embeddedRelations = embedded.flatMap(row => (row.claim_relations ?? []).filter(relation => {
    if (relation.evidence_id === row.evidence_id) return true
    if (!receipt) issues.push({ message: "證據列與關係列的 ID 不一致，暫不建立關係。", evidenceId: row.evidence_id, claimId: relation.claim_id, rows: [relation] })
    return false
  }))
  const relations = records(receipt ? receipt.relations ?? [] : embeddedRelations)
  const reasons = [receipt?.reason, registry?.reason].filter((reason): reason is string => Boolean(reason))
  const sources = [receipt?.source, registry?.source].filter((source): source is InvestmentNarrativeSource => Boolean(source))
  const byClaimId = indexById(records(registry?.claims ?? []), row => row.claim_id)
  const claimConflicts = new Set<string>()
  for (const conflict of registry?.conflicts ?? []) {
    if (idExists(conflict.claim_id)) claimConflicts.add(conflict.claim_id)
    issues.push({ message: "來源列出主張衝突，暫不選定主張文字。", claimId: idExists(conflict.claim_id) ? conflict.claim_id : undefined, rows: Array.isArray(conflict.rows) ? conflict.rows : [conflict] })
  }
  for (const [id, rows] of byClaimId) {
    if (rows.length > 1 && !claimConflicts.has(id)) {
      claimConflicts.add(id)
      issues.push({ message: "同一主張 ID 有多筆不同內容，暫不選定其中一筆。", claimId: id, rows })
    }
  }
  for (const row of registry?.unlinked_claims ?? []) issues.push({ message: "來源列出尚未連結的主張。", rows: [row] })

  const groups = [...byClaimId].filter(([id, rows]) => !claimConflicts.has(id) && rows.length === 1 && rows[0].state === "ready").map(([, rows]) => ({ claim: rows[0], rows: [] as ClaimEvidenceRow[] }))
  const groupById = new Map(groups.map(group => [group.claim.claim_id, group]))
  const pairKey = (row: { evidence_id: string; claim_id: string }) => JSON.stringify([row.evidence_id, row.claim_id])
  const conflictingPairs = new Set((receipt?.conflicts ?? []).map(pairKey))
  for (const conflict of receipt?.conflicts ?? []) issues.push({ message: "來源列出關係衝突，暫不採用方向。", evidenceId: conflict.evidence_id, claimId: conflict.claim_id, rows: conflict.rows })
  const byPair = indexById(relations, pairKey)
  for (const [key, rows] of byPair) {
    if (rows.length > 1 && !conflictingPairs.has(key)) {
      conflictingPairs.add(key)
      issues.push({ message: "同一證據與主張有多筆不同關係，暫不選定方向。", evidenceId: rows[0].evidence_id, claimId: rows[0].claim_id, rows })
    }
  }
  for (const row of receipt?.unlinked_relations ?? []) issues.push({ message: "來源列出尚未連結的關係。", rows: [row] })
  for (const id of receipt?.unlinked_evidence_ids ?? []) issues.push({ message: "來源尚未把這筆證據連到主張。", evidenceId: id, rows: [] })

  const unknownReceipt = Boolean(receipt && (receipt.schema_version !== 1 || receipt.state === "unknown" || receipt.state === "conflict" && !receipt.conflicts?.length))
  const unknownRegistry = Boolean(registry && (registry.schema_version !== 1 || registry.state === "unknown" || registry.state === "conflict" && !registry.conflicts?.length))
  for (const relation of relations) {
    if (conflictingPairs.has(pairKey(relation))) continue
    const group = groupById.get(relation.claim_id)
    if (!idExists(relation.evidence_id) || !idExists(relation.claim_id) || relation.relation_state !== "linked" || !group) {
      issues.push({ message: "關係尚無可明確對應的主張或證據 ID；保留來源理由。", evidenceId: relation.evidence_id, claimId: relation.claim_id, rows: [relation] })
      continue
    }
    const matches = byEvidenceId.get(relation.evidence_id) ?? []
    const item = matches.length === 1 ? matches[0] : null
    const notes: string[] = []
    if (matches.length > 1) notes.push("證據 ID 對應多筆不同資料，無法選定出處與時效。")
    else if (!item) notes.push("尚無對應的證據資料，無法確認出處與時效。")
    const timing = item?.freshness === "stale" || item?.state === "stale" ? "historical" : item?.freshness === "current" && item.state === "ready" ? "current" : "unknown"
    const known = relation.state === "ready" && relation.reason?.trim() && item && ["ready", "stale"].includes(item.state ?? "unknown") && !unknownReceipt && !unknownRegistry && item.claim_link_state !== "unlinked"
    const direction = known && ["supports", "challenges", "mixed"].includes(relation.direction) ? relation.direction : "unknown"
    if (relation.state !== "ready") notes.push("來源尚未確認這筆關係，不能視為已成立的支持或挑戰。")
    if (item?.claim_link_reason) notes.push(item.claim_link_reason)
    if (item?.claim_link_state === "partial") notes.push("這筆證據的主張關係仍有缺口。")
    group.rows.push({ relation, direction, evidence: item, sourceUrl: item ? claimEvidenceSourceUrl(item.source_url) : null, timing, notes })
  }

  const missingEmbedded = !receipt && embedded.length > 0 && embedded.length < allEvidence.length
  const partial = issues.length > 0 || missingEmbedded || receipt?.state === "partial" || registry?.state === "partial" || allEvidence.some(row => row.claim_link_state === "partial" || row.claim_link_state === "unlinked") || groups.some(group => group.rows.some(row => row.direction === "unknown" || row.timing === "unknown"))
  let state: ClaimEvidenceView["state"]
  if (conflictingPairs.size || claimConflicts.size || receipt?.state === "conflict" || registry?.state === "conflict") state = "conflict"
  else if (!declared) state = "unavailable"
  else if (unknownReceipt || unknownRegistry) state = "unknown"
  else if (partial) state = "partial"
  else if (!relations.length) state = "empty"
  else state = "ready"
  if (missingEmbedded) reasons.push("部分證據未提供關係欄位；已列出的關係不是完整清單。")
  if (registry == null && declared) reasons.push("來源尚未提供主張清單與文字；不從層級或證據說明補寫。")
  const notice = !declared && state !== "unavailable" ? `${NOTICE.unavailable} ${NOTICE[state]}` : declared && !relations.length && state !== "empty" ? `${NOTICE.empty} ${NOTICE[state]}` : NOTICE[state]
  return { state, notice, claims: groups, issues, reasons, sources }
}
