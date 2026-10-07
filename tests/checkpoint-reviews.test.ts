import test, { after, before } from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { createElement, type ComponentType } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createServer, type ViteDevServer } from "vite"
import { checkpointReviewsView, type InvestmentCheckpointReviews } from "../src/lib/investmentCheckpointReviews.ts"
import { sourceTimestamp } from "../src/lib/investmentFormat.ts"
import { getInvestment, getSelectedInvestmentProvider, setInvestmentProvider, type InvestmentData } from "../src/lib/investment.ts"
import { demoInvestmentProvider } from "../src/demo/investmentProvider.ts"
import { investment as syntheticInvestment } from "./fixtures/extended-ui.ts"
import { syntheticJudgmentUpdate, syntheticPresentationBrief, syntheticPresentationToday } from "./fixtures/today-presentation.ts"

// Exact source-owned renderer examples, frozen at Investment Note
// 1d394c9419654b92d1e9298383ace92e0dc5909a. These are not reconstructed receipts.
const exampleBytes = readFileSync(new URL("../src/demo/checkpoint-review-examples.json", import.meta.url))
const examples = JSON.parse(exampleBytes.toString("utf8")).examples as Record<"day2" | "day3" | "untracked" | "revision_mismatch", InvestmentCheckpointReviews>
const example = (name: keyof typeof examples = "day2") => structuredClone(examples[name])

let server: ViteDevServer
let Reviews: ComponentType<{ projection: unknown; readFailed?: boolean; synthetic?: boolean }>
let previousLocation: PropertyDescriptor | undefined

before(async () => {
  previousLocation = Object.getOwnPropertyDescriptor(globalThis, "location")
  Object.defineProperty(globalThis, "location", { value: { origin: "http://localhost", hostname: "localhost" }, configurable: true })
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  Reviews = (await server.ssrLoadModule("/src/components/investment/TodayCheckpointReviews.tsx")).TodayCheckpointReviews
})

after(async () => {
  await server?.close()
  if (previousLocation) Object.defineProperty(globalThis, "location", previousLocation)
  else Reflect.deleteProperty(globalThis, "location")
})

function renderReviews(projection: unknown, options: { readFailed?: boolean; synthetic?: boolean } = {}) {
  return renderToStaticMarkup(createElement(Reviews, { projection, ...options }))
}

function containsText(html: string, text: string) {
  const escaped = renderToStaticMarkup(createElement("span", null, text)).slice(6, -7)
  assert.ok(html.includes(escaped), `Missing source text: ${text}`)
}

function expiredNotDueItem() {
  const backlog = example("day3").items.find(item => item.checkpoint_id === "synthetic-backlog")!
  const gap = example("day3").items.find(item => item.assessment_origin === "reader_gap")!
  return {
    ...backlog,
    assessment: gap.assessment,
    assessment_origin: gap.assessment_origin,
    reason_code: gap.reason_code,
    review: null,
    last_review: backlog.review!,
    judgment_effect: gap.judgment_effect,
    action_effect: gap.action_effect,
    provenance: { ...backlog.provenance, review: null, read_at: "2026-10-05T09:00:00+08:00" },
    display: gap.display,
  }
}

function stoppedExample() {
  const projection = example()
  const row = projection.items.find(item => item.assessment_origin === "reader_gap")!
  row.state = "stopped"
  row.reason_code = "stopped"
  row.stop = {
    origin: structuredClone(row.origin), stopped_at: "2026-10-02T08:03:00+08:00",
    reason: "合成問題的答案已不影響當前選項，停止追蹤；原結果仍未知。",
    source: { path: "wiki/morning/briefs/2026-10-02.md", source_revision: `sha256:${"a".repeat(64)}`,
      source_cutoff: "2026-10-02T08:04:00+08:00", generated_at: "2026-10-02T08:05:00+08:00" },
  }
  row.display.status_label = "停止關注"
  row.display.result = "原問題尚未取得可確認的答案；停止關注不代表預期已驗證。"
  projection.items = [row]
  projection.stopped_count = 1
  return projection
}

test("stopping attention preserves an unknown result and separate historical counts", () => {
  const projection = stoppedExample()
  const before = structuredClone(projection)
  const view = checkpointReviewsView(projection)
  assert.equal(view.invalidCount, 0)
  assert.equal(view.items[0].state, "stopped")
  assert.equal(view.items[0].assessment, "no_data")
  assert.equal(view.items[0].review, null)
  assert.deepEqual(view.items[0].judgment_effect, { state: "unknown" })
  assert.equal(view.projection?.completed_count, 3)
  assert.equal(view.projection?.stopped_count, 1)
  const html = renderReviews(projection)
  containsText(html, projection.items[0].stop!.reason)
  containsText(html, projection.items[0].display.result)
  containsText(html, "回查狀態")
  containsText(html, "停止追蹤不代表已確認結果。")
  assert.doesNotMatch(html, /今天的答案|支持原預期|無新變化，已完成回查/)
  assert.deepEqual(projection, before, "renderer does not infer or mutate lifecycle")
})

test("a stopped row requires an exact source-authored stop and cannot become a completed answer", () => {
  for (const mutate of [
    (p: InvestmentCheckpointReviews) => { delete p.items[0].stop },
    (p: InvestmentCheckpointReviews) => { p.items[0].stop!.origin.checkpoint_id = "synthetic-other" },
    (p: InvestmentCheckpointReviews) => { p.items[0].stop!.origin.source_revision = "different" },
    (p: InvestmentCheckpointReviews) => { p.items[0].stop!.reason = "" },
    (p: InvestmentCheckpointReviews) => { p.items[0].state = "completed" },
  ]) {
    const projection = stoppedExample()
    mutate(projection)
    const view = checkpointReviewsView(projection)
    assert.equal(view.items.length, 0)
    assert.equal(view.invalidCount, 1)
    assert.doesNotMatch(renderReviews(projection), /停止理由：/)
  }
})

test("stopping keeps a previously authored no-data review and its effects", () => {
  const projection = stoppedExample()
  const answered = example().items.find(item => item.assessment === "no_data" && item.review)!
  answered.state = "stopped"
  answered.stop = { ...projection.items[0].stop!, origin: structuredClone(answered.origin) }
  answered.display.status_label = "停止關注"
  projection.items = [answered]
  const view = checkpointReviewsView(projection)
  assert.equal(view.invalidCount, 0)
  assert.deepEqual(view.items[0].review, answered.review)
  assert.deepEqual(view.items[0].judgment_effect, answered.judgment_effect)
  containsText(renderReviews(projection), answered.review!.result)
})

test("checkpoint renderer examples retain the exact frozen source Git blob bytes", () => {
  const digest = createHash("sha1").update(`blob ${exampleBytes.byteLength}\0`).update(exampleBytes).digest("hex")
  assert.equal(digest, "e15ba6c7426b77fe54bcc2a91868f9cfd760467b", "source fixtures must be copied byte-for-byte, including the trailing newline")
})

test("checkpoint reviews project all five source outcomes with the original answer and separate effects", () => {
  const projection = example()
  const view = checkpointReviewsView(projection)
  assert.equal(view.unavailable, false)
  assert.equal(view.invalidCount, 0)
  assert.deepEqual(view.items, projection.items)
  assert.deepEqual([...new Set(view.items.map(item => item.assessment))].sort(), ["challenged", "no_change", "no_data", "not_due", "supported"])
  const html = renderReviews(projection)
  containsText(html, projection.display!.title)
  for (const item of projection.items) {
    for (const text of [item.question, item.expectation, ...Object.values(item.display)]) containsText(html, text)
    for (const effect of [item.judgment_effect, item.action_effect]) {
      if (effect.state !== "unknown") {
        containsText(html, effect.summary)
        containsText(html, effect.reason)
      }
    }
  }
  const challenged = view.items.find(item => item.assessment === "challenged")!
  assert.equal(challenged.judgment_effect.state, "changed")
  assert.equal(challenged.action_effect.state, "maintained", "a challenged expectation is not an inferred trade")
})

test("two questions in the same story keep their independent identities and opposing results", () => {
  const projection = example()
  const questions = checkpointReviewsView(projection).items.filter(item => item.story_id === "synthetic-demand")
  assert.deepEqual(questions.map(item => item.checkpoint_id), ["synthetic-demand-supply", "synthetic-demand-volume"])
  assert.deepEqual(questions.map(item => item.assessment), ["challenged", "supported"])
  const html = renderReviews(projection)
  for (const item of questions) {
    containsText(html, item.question)
    containsText(html, item.display.result)
  }
})

test("partial checkpoint coverage retains completed results and the producer coverage warning", () => {
  const projection = example()
  projection.state = "partial"
  projection.problems = ["synthetic available-file read gap"]
  projection.coverage.history_complete = false
  projection.coverage.untracked_recent_artifacts = ["wiki/morning/briefs/2001-02-03.md"]
  projection.display!.coverage_label = "合成來源涵蓋不完整，已完成的逐題結果仍保留。"
  const view = checkpointReviewsView(projection)
  assert.equal(view.unavailable, false)
  assert.equal(view.items.filter(item => item.state === "completed").length, 3)
  assert.equal(view.projection?.completed_count, 3)
  const html = renderReviews(projection)
  containsText(html, projection.display!.coverage_label)
  containsText(html, projection.problems[0])
  containsText(html, projection.coverage.untracked_recent_artifacts[0])
  for (const item of projection.items.filter(item => item.state === "completed")) containsText(html, item.display.result)
})

test("Today renders checkpoint answers independently of partial state, preserved judgment, and missing or stale brief", async () => {
  const { TodayBrief } = await server.ssrLoadModule("/src/components/investment/InvestmentPage.tsx")
  for (const variant of ["partial", "preserved", "missing", "stale"] as const) {
    const { brief, today } = variant === "preserved"
      ? syntheticJudgmentUpdate("preserved")
      : { brief: syntheticPresentationBrief(), today: syntheticPresentationToday() }
    today.checkpoint_reviews = example()
    today.state = "partial"
    if (variant !== "preserved") {
      brief.judgment = null
      today.current_judgment = undefined
    }
    if (variant === "missing" || variant === "stale") brief.state = variant
    const client = new QueryClient()
    client.setQueryData(["investment-narrative"], { news_events: null, catalysts_30d: null })
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(TodayBrief, {
      b: brief, today, readFailed: false, onOpenThesis: () => undefined,
    })))
    containsText(html, examples.day2.items[0].question)
    containsText(html, examples.day2.items[0].display.result)
    const sectionIndex = html.indexOf(examples.day2.display!.title)
    assert.ok(sectionIndex >= 0 && sectionIndex < html.indexOf('aria-label="今天發生了什麼"'), variant)
    assert.doesNotMatch(html, /判斷已更新/, "completed question results do not manufacture a new daily judgment")
  }
})

test("the Investment page still exposes available checkpoint answers when the brief object is absent", async () => {
  const { InvestmentPage } = await server.ssrLoadModule("/src/components/investment/InvestmentPage.tsx")
  const client = new QueryClient()
  client.setQueryData(["investment"], {
    ...structuredClone(syntheticInvestment),
    brief: null,
    today: { ...syntheticPresentationToday(), state: "partial", current_judgment: undefined, checkpoint_reviews: example() },
  })
  try {
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(InvestmentPage)))
    containsText(html, examples.day2.display!.title)
    containsText(html, examples.day2.items[0].display.result)
    assert.doesNotMatch(html, /判斷已更新/)
  } finally {
    client.clear()
  }
})

test("missing and untracked checkpoint projections do not claim a completed check or no new information", () => {
  for (const input of [undefined, null]) {
    const view = checkpointReviewsView(input)
    assert.equal(view.unavailable, true)
    assert.deepEqual(view.items, [])
    assert.doesNotMatch(renderReviews(input), /支持原預期|挑戰原預期|無新變化，已完成回查|已完成 0/)
  }
  const untracked = example("untracked")
  const html = renderReviews(untracked)
  containsText(html, untracked.display!.empty_message)
  assert.deepEqual(checkpointReviewsView(untracked).items, [])
  assert.doesNotMatch(html, /無新變化，已完成回查|沒有重要增量/)
})

test("invalid projection versions and malformed containers fail closed without adopting their answers", () => {
  const invalidInputs: unknown[] = [
    "not an object", [], {}, { ...example(), schema_version: 2 }, { ...example(), schema_version: "1" },
    { ...example(), items: null }, { ...example(), completed_count: -1 }, { ...example(), completed_count: 1.5 },
    { ...example(), coverage: null }, { ...example(), state: "not-a-contract-state" },
    { ...example(), state: ["ready"] }, { ...example(), state: JSON.parse('{"toString":null}') },
  ]
  for (const input of invalidInputs) {
    const view = checkpointReviewsView(input)
    assert.equal(view.unavailable, true)
    assert.deepEqual(view.items, [])
    assert.ok(!renderReviews(input).includes(examples.day2.items[0].display.result))
  }
  const earlyInvalid = { ...example("untracked"), state: "invalid", display: undefined, problems: ["invalid_candidate_path"] }
  const html = renderReviews(earlyInvalid)
  assert.doesNotMatch(html, /無新變化，已完成回查|沒有重要增量/)
})

test("plain JSON enum arrays and objects are rejected without coercion or rendering exceptions", () => {
  const source = example().items[0]
  const gap = example().items.find(item => item.assessment_origin === "reader_gap")!
  for (const malformed of [["challenged"], JSON.parse('{"toString":null}')]) {
    const invalidRows = [
      { ...source, state: malformed },
      { ...source, assessment: malformed, review: { ...source.review!, assessment: malformed } },
      { ...source, judgment_effect: { ...source.judgment_effect, state: malformed } },
      { ...source, review: { ...source.review!, evidence: [{ ...source.review!.evidence[0], kind: malformed }] } },
      { ...gap, assessment: malformed },
    ]
    for (const row of invalidRows) {
      const projection = JSON.parse(JSON.stringify({ ...example(), items: [row, examples.day2.items[1]] }))
      const view = checkpointReviewsView(projection)
      assert.equal(view.unavailable, false)
      assert.equal(view.invalidCount, 1)
      assert.deepEqual(view.items.map(item => item.checkpoint_id), ["synthetic-demand-volume"])
      const html = renderReviews(projection)
      containsText(html, examples.day2.items[1].display.result)
      assert.ok(!html.includes(row.display.result))
    }
  }
})

test("one malformed question does not erase valid sibling answers or leak its rejected result", () => {
  for (const replacement of [null, { ...examples.day2.items[0], question: 42 }, { ...examples.day2.items[0], display: null }]) {
    const projection = { ...example(), items: [replacement, ...example().items.slice(1)] }
    const view = checkpointReviewsView(projection)
    assert.equal(view.unavailable, false)
    assert.equal(view.invalidCount, 1)
    assert.deepEqual(view.items.map(item => item.checkpoint_id), examples.day2.items.slice(1).map(item => item.checkpoint_id))
    const html = renderReviews(projection)
    containsText(html, examples.day2.items[1].display.result)
    assert.ok(!html.includes(examples.day2.items[0].display.result))
    assert.match(html, /無法|未能|不完整|格式|不一致/)
  }
})

test("source-invalid rows retain null assessment and unknown effects without recovering rejected receipts", () => {
  const projection = example("revision_mismatch")
  const view = checkpointReviewsView(projection)
  assert.equal(view.invalidCount, 0, "source-invalid is a valid contract row, not a malformed transport row")
  assert.deepEqual(view.items, projection.items)
  const invalid = view.items.filter(item => item.state === "invalid")
  assert.equal(invalid.length, 5)
  for (const item of invalid) {
    assert.equal(item.assessment, null)
    assert.equal(item.review, null)
    assert.deepEqual(item.judgment_effect, { state: "unknown" })
    assert.deepEqual(item.action_effect, { state: "unknown" })
  }
  const html = renderReviews(projection)
  containsText(html, invalid[0].display.status_label)
  containsText(html, invalid[0].display.result)
  containsText(html, invalid[0].display.judgment_label)
  containsText(html, invalid[0].display.action_label)
  assert.ok(!html.includes(examples.day2.items[0].display.result))
})

test("not-due is the source's status and does not change with the browser clock", t => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2099-01-01T00:00:00Z") })
  try {
    const projection = example()
    const item = checkpointReviewsView(projection).items.find(row => row.checkpoint_id === "synthetic-backlog")!
    assert.equal(item.assessment, "not_due")
    assert.equal(item.state, "pending")
    const html = renderReviews(projection)
    containsText(html, item.display.status_label)
    containsText(html, item.display.result)
    containsText(html, sourceTimestamp(item.due_at))
  } finally {
    t.mock.timers.reset()
  }
})

test("reader gaps remain distinct from source no-data reviews", () => {
  const projection = example()
  const view = checkpointReviewsView(projection)
  const sourceReview = view.items.find(item => item.checkpoint_id === "synthetic-disclosure")!
  const readerGap = view.items.find(item => item.checkpoint_id === "synthetic-shipping")!
  assert.equal(sourceReview.assessment, "no_data")
  assert.equal(sourceReview.assessment_origin, "source")
  assert.ok(sourceReview.review)
  assert.equal(readerGap.assessment, "no_data")
  assert.equal(readerGap.assessment_origin, "reader_gap")
  assert.equal(readerGap.review, null)
  const html = renderReviews(projection)
  containsText(html, sourceReview.display.result)
  containsText(html, readerGap.display.result)
  containsText(html, readerGap.display.judgment_label)
  containsText(html, readerGap.display.action_label)
})

test("an expired own-question not-due receipt stays in history and never becomes the current answer", () => {
  const item = expiredNotDueItem()
  const oldReview = item.last_review
  const projection = { ...example("day3"), items: [item] }
  const view = checkpointReviewsView(projection)
  assert.equal(view.invalidCount, 0)
  assert.equal(view.items[0].review, null)
  assert.equal(view.items[0].assessment, "no_data")
  assert.deepEqual(view.items[0].last_review, oldReview)
  assert.deepEqual(view.items[0].judgment_effect, { state: "unknown" })
  assert.deepEqual(view.items[0].action_effect, { state: "unknown" })
  const html = renderReviews(projection)
  const currentAnswer = html.slice(html.indexOf("<article"), html.indexOf("<details"))
  containsText(currentAnswer, item.display.result)
  assert.ok(!currentAnswer.includes(oldReview.result))
  containsText(html, oldReview.result)
  assert.match(html, /不是目前答案/)
})

test("a historical receipt for another question or a completed result is rejected instead of attached to this question", () => {
  const item = expiredNotDueItem()
  const completedReview = example().items.find(row => row.state === "completed")!.review!
  const invalidReviews = [
    { ...item.last_review, origin: { ...item.origin, checkpoint_id: "synthetic-other-question" } },
    { ...completedReview, origin: item.origin, story_id: item.story_id },
  ]
  for (const last_review of invalidReviews) {
    const projection = { ...example(), items: [{ ...item, last_review }] }
    const view = checkpointReviewsView(projection)
    assert.equal(view.invalidCount, 1)
    assert.deepEqual(view.items, [])
    assert.ok(!renderReviews(projection).includes(item.display.result))
  }
})

test("a claimed completed answer with no evidence is not rendered as a validated completion", () => {
  const projection = example()
  const item = projection.items[0]
  item.review!.evidence = []
  const view = checkpointReviewsView(projection)
  assert.equal(view.invalidCount, 1)
  assert.ok(!view.items.some(row => row.checkpoint_id === item.checkpoint_id))
  const html = renderReviews(projection)
  assert.ok(!html.includes(item.display.result))
  containsText(html, projection.items[1].display.result)
})

test("duplicate explicit question IDs are rejected while a different question in the same story survives", () => {
  const projection = example()
  projection.items.push(structuredClone(projection.items[0]))
  const view = checkpointReviewsView(projection)
  assert.equal(view.invalidCount, 2)
  assert.equal(view.items.length, 5)
  assert.ok(!view.items.some(item => item.checkpoint_id === "synthetic-demand-supply"))
  assert.ok(view.items.some(item => item.checkpoint_id === "synthetic-demand-volume"))
  const html = renderReviews(projection)
  assert.ok(!html.includes(projection.items[0].display.result))
  containsText(html, projection.items[1].display.result)
})

test("the shared Today provider boundary never invents checkpoint reviews from legacy or Hub-shaped summaries", async () => {
  let previous
  try { previous = getSelectedInvestmentProvider() } catch { previous = demoInvestmentProvider }
  const legacy = structuredClone(syntheticInvestment)
  delete legacy.today.checkpoint_reviews
  const hubLike = {
    ...structuredClone(legacy),
    today: { state: "partial", baseline: legacy.brief, limitations: ["Synthetic Hub-shaped summary, not a full Today reader response."] },
  } as unknown as InvestmentData
  try {
    for (const payload of [legacy, hubLike]) {
      const calls: string[] = []
      setInvestmentProvider({
        ...demoInvestmentProvider,
        id: "synthetic-checkpoint-boundary-test",
        async getToday() { calls.push("getToday"); return payload },
        async getJudgment() { calls.push("getJudgment"); throw new Error("Judgment cannot be used to synthesize Today checkpoints") },
        async getOptional() { calls.push("getOptional"); throw new Error("Optional capabilities cannot fill in Today checkpoints") },
      })
      const actual = await getInvestment()
      assert.equal(actual, payload, "the shared provider reader passes through its selected full-Today payload")
      assert.deepEqual(calls, ["getToday"])
      assert.equal(Object.hasOwn(actual.today, "checkpoint_reviews"), false)
      assert.equal(checkpointReviewsView(actual.today.checkpoint_reviews).unavailable, true)
      assert.deepEqual(checkpointReviewsView(actual.today).items, [], "nested Hub-like baseline content is not a checkpoint projection")
      assert.ok(!renderReviews(actual.today.checkpoint_reviews).includes(examples.day2.items[0].display.result))
    }
  } finally {
    setInvestmentProvider(previous)
  }
})

test("day three preserves cumulative completion without reopening or inventing missing completed questions", () => {
  const projection = example("day3")
  const view = checkpointReviewsView(projection)
  assert.equal(view.projection?.completed_count, 3)
  assert.equal(view.items.length, 3)
  assert.equal(view.items.filter(item => item.state === "completed").length, 0)
  const html = renderReviews(projection)
  for (const item of examples.day2.items.filter(item => item.state === "completed")) {
    assert.ok(!view.items.some(row => row.checkpoint_id === item.checkpoint_id))
    assert.ok(!html.includes(item.question))
  }
  for (const item of projection.items) containsText(html, item.display.result)
  assert.match(html, /(?:完成[^<]*3|3[^<]*完成)/, "the displayed total is the source's cumulative count, not the visible completed-row count")
})

test("checkpoint review disclosure leaves two source-ordered questions visible and four reachable", () => {
  const projection = example()
  const html = renderReviews(projection)
  const marker = html.indexOf('data-testid="checkpoint-reviews-more"')
  assert.ok(marker >= 0)
  const foldStart = html.lastIndexOf("<details", marker)
  const openingTag = html.slice(foldStart, html.indexOf(">", foldStart) + 1)
  assert.doesNotMatch(openingTag, /\bopen(?:[= >])/)
  const visible = html.slice(0, foldStart)
  const folded = html.slice(foldStart)
  for (const item of projection.items.slice(0, 2)) containsText(visible, item.question)
  for (const item of projection.items.slice(2)) {
    assert.ok(!visible.includes(item.question))
    containsText(folded, item.question)
  }
  assert.match(folded, /<summary[^>]*>[^<]*4/)
})

test("cached read failures retain answers and explicitly qualify their current validity", () => {
  const projection = example()
  const html = renderReviews(projection, { readFailed: true })
  containsText(html, projection.items[0].display.result)
  assert.match(html, /讀取失敗|上次讀取|保留.*未確認/)
  assert.match(html, /role="(?:status|alert)"/)
})

test("source disclosure retains the baseline, exact origin, review evidence and independent cutoff times", () => {
  const projection = example()
  const item = projection.items[0]
  const html = renderReviews(projection)
  for (const text of [...Object.values(item.baseline), item.origin.path, item.origin.source_revision, item.checkpoint_id,
    item.story_id,
    item.provenance.review!.path, item.provenance.review!.source_revision,
    ...item.review!.evidence.flatMap(evidence => [evidence.source_url, evidence.summary]),
  ]) containsText(html, text)
  for (const timestamp of [item.provenance.origin_generated_at, item.provenance.origin_cutoff, item.provenance.read_at,
    item.provenance.review!.source_cutoff, item.provenance.review!.generated_at, item.review!.checked_at, item.review!.evidence_cutoff,
    ...item.review!.evidence.flatMap(evidence => [evidence.data_as_of, evidence.published_at, evidence.checked_at]),
  ]) {
    containsText(html, sourceTimestamp(timestamp))
    containsText(html, timestamp)
  }
  assert.match(html, /<details/)
})

test("checkpoint review rendering needs no provider reads, refreshes, writes or fetches", async t => {
  const runtime = await server.ssrLoadModule("/src/lib/investment.ts")
  const { demoInvestmentProvider } = await server.ssrLoadModule("/src/demo/investmentProvider.ts")
  let previous
  try { previous = runtime.getSelectedInvestmentProvider() } catch { previous = demoInvestmentProvider }
  const calls: string[] = []
  const provider = new Proxy(demoInvestmentProvider, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver)
      if (typeof value !== "function") return value
      return () => { calls.push(String(key)); throw new Error(`Unexpected provider call: ${String(key)}`) }
    },
  })
  t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected checkpoint review network request") })
  runtime.setInvestmentProvider(provider)
  try {
    const html = renderReviews(example())
    containsText(html, examples.day2.items[0].display.result)
    assert.deepEqual(calls, [])
    assert.doesNotMatch(html, /<form\b|<button\b/, "the projection exposes no mutation or refresh controls")
  } finally {
    runtime.setInvestmentProvider(previous)
  }
})
