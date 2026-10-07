/** Read-only projection of today.checkpoint_reviews/v1.
 * Source contract: investment-note@1d394c9419654b92d1e9298383ace92e0dc5909a,
 * knowledge/checkpoint-review-contract.md. Investment Note owns validation,
 * question identity, assessment, completion and all display text.
 */
export type CheckpointAssessment = "supported" | "challenged" | "no_change" | "not_due" | "no_data"
export type CheckpointEffect = { state: "unknown" } | { state: "maintained" | "changed"; summary: string; reason: string }
export type CheckpointOrigin = { path: string; source_revision: string; checkpoint_id: string }
export type CheckpointStop = {
  origin: CheckpointOrigin
  stopped_at: string
  reason: string
  source: { path: string; source_revision: string; source_cutoff: string; generated_at: string }
}
export type CheckpointReview = {
  origin: CheckpointOrigin
  story_id: string
  checked_at: string
  evidence_cutoff: string
  result: string
  assessment: CheckpointAssessment
  judgment_effect: Exclude<CheckpointEffect, { state: "unknown" }>
  action_effect: Exclude<CheckpointEffect, { state: "unknown" }>
  evidence: { kind: "event" | "market_observation" | "source_check"; source_url: string; data_as_of: string; published_at: string; checked_at: string; summary: string }[]
  /** Optional source-owned event result; not interpreted by this renderer. */
  event_result?: unknown
}
export type InvestmentCheckpointReviewItem = {
  checkpoint_id: string
  story_id: string
  question: string
  expectation: string
  due_at: string
  origin: CheckpointOrigin
  baseline: { judgment: string; action: string; reason: string; source_refs: string }
  state: "completed" | "pending" | "stopped" | "invalid"
  assessment: CheckpointAssessment | null
  assessment_origin: "source" | "reader_gap"
  reason_code: string
  review: CheckpointReview | null
  last_review: CheckpointReview | null
  stop?: CheckpointStop
  judgment_effect: CheckpointEffect
  action_effect: CheckpointEffect
  provenance: {
    origin_generated_at: string
    origin_cutoff: string
    review: { path: string; source_revision: string; source_cutoff: string; generated_at: string } | null
    read_at: string
  }
  display: { status_label: string; result: string; judgment_label: string; action_label: string }
}
export type InvestmentCheckpointReviews = {
  schema_version: 1
  state: "ready" | "untracked" | "partial" | "invalid"
  items: InvestmentCheckpointReviewItem[]
  completed_count: number
  stopped_count?: number
  coverage: { untracked_recent_artifacts: string[]; history_complete: boolean; scope: "available_brief_files"; identity_coverage: "explicit_declarations_only" }
  problems: string[]
  candidate_problems: string[]
  display?: { title: string; empty_message: string; coverage_label: string }
}

type RecordValue = Record<string, unknown>
const record = (value: unknown): value is RecordValue => Boolean(value) && typeof value === "object" && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === "string")
const fields = (value: unknown, names: string[]): value is RecordValue => record(value) && names.every(name => text(value[name]))
const assessments = ["supported", "challenged", "no_change", "not_due", "no_data"]
const oneOf = (value: unknown, values: readonly string[]) => typeof value === "string" && values.includes(value)
const isOrigin = (value: unknown) => fields(value, ["path", "source_revision", "checkpoint_id"])
const isEffect = (value: unknown) => record(value) && (value.state === "unknown" || oneOf(value.state, ["maintained", "changed"]) && fields(value, ["summary", "reason"]))

function isReview(value: unknown): value is CheckpointReview {
  return fields(value, ["story_id", "checked_at", "evidence_cutoff", "result"])
    && isOrigin(value.origin) && oneOf(value.assessment, assessments)
    && isEffect(value.judgment_effect) && (value.judgment_effect as CheckpointEffect).state !== "unknown"
    && isEffect(value.action_effect) && (value.action_effect as CheckpointEffect).state !== "unknown"
    && Array.isArray(value.evidence) && value.evidence.every(item => fields(item, ["source_url", "data_as_of", "published_at", "checked_at", "summary"])
      && oneOf(item.kind, ["event", "market_observation", "source_check"]))
}

/** Guard the consumer's rendering boundary, not the producer's replay algorithm.
 * Do not parse prose, compare dates to the browser clock, re-hash source files,
 * synthesize reviews, or promote a missing review into a completed question. */
function isItem(value: unknown): value is InvestmentCheckpointReviewItem {
  if (!fields(value, ["checkpoint_id", "story_id", "question", "expectation", "due_at", "reason_code"])
    || !isOrigin(value.origin) || (value.origin as CheckpointOrigin).checkpoint_id !== value.checkpoint_id
    || !fields(value.baseline, ["judgment", "action", "reason", "source_refs"])
    || !fields(value.display, ["status_label", "result", "judgment_label", "action_label"])
    || !fields(value.provenance, ["origin_generated_at", "origin_cutoff", "read_at"])
    || !(value.provenance.review === null || fields(value.provenance.review, ["path", "source_revision", "source_cutoff", "generated_at"]))
    || !isEffect(value.judgment_effect) || !isEffect(value.action_effect)
    || !(value.last_review === null || isReview(value.last_review))) return false
  const judgment = value.judgment_effect as CheckpointEffect
  const action = value.action_effect as CheckpointEffect
  const origin = value.origin as CheckpointOrigin
  if (value.state === "stopped") {
    if (!fields(value.stop, ["stopped_at", "reason"]) || !isOrigin(value.stop.origin)
      || !fields(value.stop.source, ["path", "source_revision", "source_cutoff", "generated_at"])) return false
    const stopOrigin = value.stop.origin as CheckpointOrigin
    if (["path", "source_revision", "checkpoint_id"].some(key => stopOrigin[key as keyof CheckpointOrigin] !== origin[key as keyof CheckpointOrigin])) return false
  } else if (value.stop !== undefined) return false
  const matchesQuestion = (review: CheckpointReview) => review.origin.checkpoint_id === value.checkpoint_id && review.story_id === value.story_id
    && review.origin.path === origin.path && review.origin.source_revision === origin.source_revision
  if (value.last_review !== null && (!matchesQuestion(value.last_review as CheckpointReview)
    || (value.last_review as CheckpointReview).assessment !== "not_due" || value.review !== null)) return false
  if (value.review === null) return value.assessment_origin === "reader_gap"
    && judgment.state === "unknown" && action.state === "unknown" && value.provenance.review === null
    && (value.state === "invalid" ? value.assessment === null
      : (value.state === "pending" || value.state === "stopped") && oneOf(value.assessment, ["not_due", "no_data"]))
  if (!isReview(value.review) || value.assessment_origin !== "source" || value.provenance.review === null
    || judgment.state === "unknown" || action.state === "unknown") return false
  const review = value.review
  return matchesQuestion(review)
    && review.assessment === value.assessment
    && ["state", "summary", "reason"].every(key => (review.judgment_effect as unknown as RecordValue)[key] === (judgment as unknown as RecordValue)[key]
      && (review.action_effect as unknown as RecordValue)[key] === (action as unknown as RecordValue)[key])
    && (value.state === "completed" ? review.evidence.length > 0 && ["supported", "challenged", "no_change"].includes(review.assessment)
      : (value.state === "pending" || value.state === "stopped") && ["not_due", "no_data"].includes(review.assessment))
}

export function checkpointReviewsView(input: unknown): {
  projection: InvestmentCheckpointReviews | null
  items: InvestmentCheckpointReviewItem[]
  invalidCount: number
  unavailable: boolean
} {
  const unavailable = { projection: null, items: [], invalidCount: 0, unavailable: true }
  if (!record(input) || input.schema_version !== 1 || !oneOf(input.state, ["ready", "untracked", "partial", "invalid"])
    || !Array.isArray(input.items) || !Number.isInteger(input.completed_count) || (input.completed_count as number) < 0
    || (input.stopped_count !== undefined && (!Number.isInteger(input.stopped_count) || (input.stopped_count as number) < 0))
    || !strings(input.problems) || !strings(input.candidate_problems) || !record(input.coverage)
    || !strings(input.coverage.untracked_recent_artifacts) || typeof input.coverage.history_complete !== "boolean"
    || input.coverage.scope !== "available_brief_files" || input.coverage.identity_coverage !== "explicit_declarations_only"
    || !(input.state === "invalid" && input.display === undefined || record(input.display) && text(input.display.title)
      && typeof input.display.empty_message === "string" && typeof input.display.coverage_label === "string")) return unavailable
  const ids = new Map<unknown, number>()
  for (const item of input.items) if (record(item)) ids.set(item.checkpoint_id, (ids.get(item.checkpoint_id) ?? 0) + 1)
  const items = input.items.filter((item): item is InvestmentCheckpointReviewItem => isItem(item) && ids.get(item.checkpoint_id) === 1)
  return { projection: input as InvestmentCheckpointReviews, items, invalidCount: input.items.length - items.length, unavailable: false }
}
