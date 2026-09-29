/** Owner design decisions of 2026-09-27 (personal-os-visualization issue 60):
 * Today 「今天怎麼做」 field layout, the 我的判斷 目前判斷 block (with the
 * folded 長期論點 below it) and per-layer status line, the merged 待處理
 * section, and dropping expired next_catalyst registrations from 資料待整理,
 * plus the three review blocks raised on them. Pure helpers are asserted directly; the
 * renderers go through vite's ssrLoadModule + renderToStaticMarkup, the same
 * pattern tests/judgment-and-folds.test.ts uses. All data here is synthetic. */
import test, { after, before } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createElement, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createServer, type ViteDevServer } from "vite"
import { investment, investmentActions, investmentNarrative } from "./fixtures/extended-ui.ts"
import type { InvestmentActions, InvestmentNarrative, InvestmentNarrativeEvidenceLayer } from "../src/lib/investment.ts"
import {
  firstSentence, layerGapLine, layerOpposingStatus, layerReadingCaption, layerReadingText, layerStatusLine, layerStatusLineFor,
  NARRATIVE_NEXT_CHECKPOINT_UNLINKED, NARRATIVE_SUMMARY_DRIFT, NARRATIVE_SUMMARY_STALE, NARRATIVE_SUMMARY_UNAVAILABLE,
  narrativeSummaryLines, pendingActionsCountLine,
} from "../src/lib/investmentFormat.ts"
import { EXPIRED_CATALYST_GAP_REASON, withoutExpiredCatalystGaps } from "../src/lib/investmentToday.ts"

let server: ViteDevServer
let previousLocation: PropertyDescriptor | undefined

before(async () => {
  previousLocation = Object.getOwnPropertyDescriptor(globalThis, "location")
  Object.defineProperty(globalThis, "location", { value: { origin: "http://localhost", hostname: "localhost" }, configurable: true })
  server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
})

after(async () => {
  await server.close()
  if (previousLocation) Object.defineProperty(globalThis, "location", previousLocation)
  else Reflect.deleteProperty(globalThis, "location")
})

function withQueryData(element: ReactElement, entries: [unknown[], unknown][] = []) {
  const client = new QueryClient()
  for (const [key, data] of entries) client.setQueryData(key, data)
  return renderToStaticMarkup(createElement(QueryClientProvider, { client }, element))
}

/* ---------- Q2-C: one status line per layer ---------- */

test("layerOpposingStatus maps every branch from challenge count and coverage state only", () => {
  assert.equal(layerOpposingStatus(1, "sufficient"), "有反方證據", "linked challenging evidence wins over any coverage state")
  assert.equal(layerOpposingStatus(2, undefined), "有反方證據")
  assert.equal(layerOpposingStatus(0, "sufficient"), "查過沒找到")
  assert.equal(layerOpposingStatus(0, "insufficient"), "查得不完整")
  assert.equal(layerOpposingStatus(0, "unavailable"), "還沒查")
  assert.equal(layerOpposingStatus(0, "unknown"), "還沒查")
  assert.equal(layerOpposingStatus(0, null), "還沒查", "a missing receipt is not checked, never 'nothing found'")
  assert.equal(layerOpposingStatus(0, undefined), "還沒查")
  assert.equal(layerOpposingStatus(0, "something-new"), "還沒查", "an unrecognised state never upgrades to a checked result")
})

test("layerStatusLine uses the fixed template and names unknown-direction records only when present", () => {
  assert.equal(layerStatusLine({ supports: 2, challenges: 0 }, "unknown"), "支持 2 筆・挑戰 0 筆・反方：還沒查")
  assert.equal(layerStatusLine({ supports: 0, challenges: 1, unknown: 0 }, "sufficient"), "支持 0 筆・挑戰 1 筆・反方：有反方證據")
  assert.equal(layerStatusLine({ supports: 0, challenges: 0, unknown: 1 }, null), "支持 0 筆・挑戰 0 筆・方向未明 1 筆・反方：還沒查")
})

test("layerStatusLineFor counts exactly the records the layer card lists", () => {
  const layers = investmentNarrative.narratives[0].thesis_evidence.layers
  assert.deepEqual(layers.map(layer => layerStatusLineFor(layer)), [
    "支持 0 筆・挑戰 1 筆・反方：有反方證據",
    "支持 0 筆・挑戰 0 筆・反方：查得不完整",
    "支持 0 筆・挑戰 0 筆・反方：還沒查",
    "支持 0 筆・挑戰 0 筆・反方：還沒查",
    "支持 0 筆・挑戰 0 筆・反方：還沒查",
  ], "demo coverage states are sufficient (overridden by the linked challenge), insufficient, unavailable, unknown and missing")

  const record = structuredClone(layers[0].evidence![0])
  const support = { ...record, evidence_id: "synthetic-support", polarity: "supports" as const }
  const unknownDirection = { ...record, evidence_id: "synthetic-unknown", polarity: "unknown" as const }
  const withEvidence: InvestmentNarrativeEvidenceLayer = {
    ...structuredClone(layers[1]), evidence: [support, unknownDirection], supporting: [support], opposing: [], opposing_coverage: { state: "sufficient", checked_at: null, scope: null, reason: "", source: null },
  }
  assert.equal(layerStatusLineFor(withEvidence), "支持 1 筆・挑戰 0 筆・方向未明 1 筆・反方：查過沒找到", "supporting[] repeats evidence[]; it is not counted twice")

  const legacyOnly: InvestmentNarrativeEvidenceLayer = { ...structuredClone(layers[1]), evidence: [], supporting: ["既有支持記錄"], opposing: ["既有挑戰記錄"], opposing_coverage: null }
  assert.equal(layerStatusLineFor(legacyOnly), "支持 1 筆・挑戰 1 筆・反方：有反方證據", "older producers' plain-text records still count on their side")
})

/* ---------- Q3: 目前判斷 lines ---------- */

test("firstSentence splits at the first 。 or a period followed by whitespace, keeping closing marks", () => {
  assert.equal(firstSentence("合成判斷第一句。第二句不應出現。"), "合成判斷第一句。")
  assert.equal(firstSentence("**合成判斷第一句。**第二句"), "**合成判斷第一句。**", "closing bold stays with the sentence")
  assert.equal(firstSentence("First part. Second part."), "First part.")
  assert.equal(firstSentence("**Bound synthetic evidence to the registry.** Claim 01 = supports."), "**Bound synthetic evidence to the registry.**")
  assert.equal(firstSentence("中文句。English. More"), "中文句。", "whichever stop comes first wins")
  assert.equal(firstSentence("Eng first. 中文。"), "Eng first.")
  assert.equal(firstSentence("Utilization rose 3.5% while prices held"), "Utilization rose 3.5% while prices held", "a decimal point is not a sentence end")
  assert.equal(firstSentence("  沒有句號的整段  "), "沒有句號的整段")
})

const SIGNALS = [
  { direction: "challenges" as const, indicator: "**合成指標甲**（示範）" },
  { direction: "supports" as const, indicator: "**合成指標甲**（示範）" },
  { direction: "challenges" as const, indicator: "合成指標乙" },
  { direction: "supports" as const, indicator: "合成指標乙" },
]
const JUDGMENT = "**Bound synthetic L0 evidence to the registry without changing the thesis.** Claim 01 = supports; claim 02 = mixed. **Debate: NO — 本輪只做合成對位。**"
type SummaryInput = Parameters<typeof narrativeSummaryLines>[0]
const AVAILABLE: SummaryInput = {
  readable: true,
  tension: { state: "ready", text: "不是「會不會」，是「**誰先撐不住**」。" },
  latest: { state: "ready", date: "2026-09-26", judgment: JUDGMENT },
  nextCheckpoint: null,
  // A partial evidence state is about layers and claims; the signal list itself was read.
  signals: { state: "partial", items: SIGNALS },
}
const lineOf = (input: SummaryInput, label: string) => narrativeSummaryLines(input).find(line => line.label === label)

test("narrativeSummaryLines fills four labelled lines from explicitly available sources", () => {
  assert.deepEqual(narrativeSummaryLines(AVAILABLE), [
    { label: "現在的張力", text: "不是「會不會」，是「**誰先撐不住**」。", muted: false },
    { label: "最近一次記錄", text: "2026-09-26 · **Bound synthetic L0 evidence to the registry without changing the thesis.**", muted: false },
    { label: "接下來看", text: NARRATIVE_NEXT_CHECKPOINT_UNLINKED, muted: true },
    { label: "訊號", text: "支持 2 條・挑戰 2 條 · 支持首條：**合成指標甲**（示範）；挑戰首條：**合成指標甲**（示範）", muted: false },
  ])
  assert.equal(NARRATIVE_NEXT_CHECKPOINT_UNLINKED, "來源沒有把下一個檢查點連到這個論點")
  assert.deepEqual(lineOf({ ...AVAILABLE, signals: { state: "ready", items: [SIGNALS[1]] } }, "訊號"), { label: "訊號", text: "支持 1 條・挑戰 0 條 · 支持首條：**合成指標甲**（示範）", muted: false }, "a zero on one side of a readable list is a real zero")
})

test("narrativeSummaryLines shows a producer-linked next checkpoint verbatim when one is given", () => {
  assert.deepEqual(lineOf({ ...AVAILABLE, nextCheckpoint: " 2026-10-05 · 合成交付檢查 " }, "接下來看"), { label: "接下來看", text: "2026-10-05 · 合成交付檢查", muted: false })
  assert.deepEqual(lineOf({ ...AVAILABLE, nextCheckpoint: "   " }, "接下來看"), { label: "接下來看", text: NARRATIVE_NEXT_CHECKPOINT_UNLINKED, muted: true })
})

// Review block 1: an unavailable, unknown or missing signal source is not a definite zero.
test("narrativeSummaryLines never turns an unreadable signal list into 「支持 0 條・挑戰 0 條」", () => {
  const unavailable = { label: "訊號", text: NARRATIVE_SUMMARY_UNAVAILABLE, muted: true }
  assert.equal(NARRATIVE_SUMMARY_UNAVAILABLE, "目前無法取得")
  assert.deepEqual(lineOf({ ...AVAILABLE, signals: { state: "unknown", items: [] } }, "訊號"), unavailable)
  assert.deepEqual(lineOf({ ...AVAILABLE, signals: { state: "partial", items: [] } }, "訊號"), unavailable, "the producer flags an empty or unreadable table; it is never a confirmed zero")
  assert.deepEqual(lineOf({ ...AVAILABLE, signals: { state: "ready", items: [] } }, "訊號"), unavailable)
  assert.deepEqual(lineOf({ ...AVAILABLE, signals: { state: "unknown", items: SIGNALS } }, "訊號"), unavailable, "an unknown evidence state does not vouch for its leftover list")
  assert.deepEqual(lineOf({ ...AVAILABLE, signals: null }, "訊號"), unavailable, "a missing evidence block")
  assert.deepEqual(lineOf({ ...AVAILABLE, signals: undefined }, "訊號"), unavailable)
  assert.deepEqual(lineOf({ ...AVAILABLE, signals: { state: "stale", items: SIGNALS } }, "訊號"), { label: "訊號", text: NARRATIVE_SUMMARY_STALE, muted: true })
  for (const input of [{ ...AVAILABLE, signals: null }, { ...AVAILABLE, signals: { state: "unknown", items: [] } }]) {
    assert.ok(narrativeSummaryLines(input).every(line => !/支持 0 條・挑戰 0 條/.test(line.text)))
  }
})

// Review block 1: tension and the latest record are gated on their own state, not only on a value.
test("narrativeSummaryLines uses each source's state: stale leftovers stay out, unreadable is never 「尚未記錄」", () => {
  assert.equal(NARRATIVE_SUMMARY_STALE, "來源較舊，不列入目前判斷")
  assert.equal(NARRATIVE_SUMMARY_DRIFT, "來源關聯不一致，不列入目前判斷")
  const tension = (state: string, text: string | null) => lineOf({ ...AVAILABLE, tension: { state, text } }, "現在的張力")
  assert.deepEqual(tension("stale", "舊的合成張力"), { label: "現在的張力", text: NARRATIVE_SUMMARY_STALE, muted: true }, "a stale section's text is not shown as current")
  assert.deepEqual(tension("drift", "合成張力"), { label: "現在的張力", text: NARRATIVE_SUMMARY_DRIFT, muted: true })
  assert.deepEqual(tension("unknown", "合成張力"), { label: "現在的張力", text: NARRATIVE_SUMMARY_UNAVAILABLE, muted: true }, "unconfirmed text is not presented as the current tension")
  assert.deepEqual(tension("ready", null), { label: "現在的張力", text: NARRATIVE_SUMMARY_UNAVAILABLE, muted: true })
  assert.deepEqual(lineOf({ ...AVAILABLE, tension: null }, "現在的張力"), { label: "現在的張力", text: NARRATIVE_SUMMARY_UNAVAILABLE, muted: true })

  const latest = (value: SummaryInput["latest"]) => lineOf({ ...AVAILABLE, latest: value }, "最近一次記錄")
  const unreadable = { label: "最近一次記錄", text: NARRATIVE_SUMMARY_UNAVAILABLE, muted: true }
  assert.deepEqual(latest({ state: "unknown", date: null, judgment: null }), unreadable, "no readable dated entry is unknown, not 尚未記錄")
  assert.deepEqual(latest(null), unreadable)
  assert.deepEqual(latest(undefined), unreadable)
  assert.deepEqual(latest({ state: "ready", date: null, judgment: null }), unreadable)
  assert.deepEqual(latest({ state: "stale", date: "2026-06-01", judgment: "舊的合成判斷。" }), { label: "最近一次記錄", text: NARRATIVE_SUMMARY_STALE, muted: true })
  assert.deepEqual(latest({ state: "conflict", date: "2026-09-26", judgment: "合成判斷。" }), { label: "最近一次記錄", text: NARRATIVE_SUMMARY_DRIFT, muted: true }, "a learning-id conflict leaves the latest record ambiguous")
  assert.deepEqual(latest({ state: "partial", date: "2026-09-26", judgment: null }), { label: "最近一次記錄", text: "2026-09-26 · 當時判斷未提供", muted: false }, "partial concerns the record's links; its own date still shows")
  assert.deepEqual(latest({ state: "partial", date: null, judgment: "合成判斷。後續。" }), { label: "最近一次記錄", text: "日期未提供 · 合成判斷。", muted: false })
  for (const state of ["unknown", "stale", "drift", "conflict", "partial", "ready"]) {
    for (const line of narrativeSummaryLines({ ...AVAILABLE, tension: { state, text: null }, latest: { state, date: null, judgment: null } })) {
      assert.doesNotMatch(line.text, /尚未記錄/, `${state}: 尚未記錄 is never used for an unreadable source`)
    }
  }
})

test("narrativeSummaryLines shows nothing kept from an earlier read as current when this read failed", () => {
  assert.deepEqual(narrativeSummaryLines({ ...AVAILABLE, readable: false, nextCheckpoint: "2026-10-05 · 合成交付檢查" }), [
    { label: "現在的張力", text: NARRATIVE_SUMMARY_UNAVAILABLE, muted: true },
    { label: "最近一次記錄", text: NARRATIVE_SUMMARY_UNAVAILABLE, muted: true },
    { label: "接下來看", text: NARRATIVE_SUMMARY_UNAVAILABLE, muted: true },
    { label: "訊號", text: NARRATIVE_SUMMARY_UNAVAILABLE, muted: true },
  ])
})

// Review block 3: the first sentence is shown whole and wraps; formatting never clips it.
test("narrativeSummaryLines keeps the latest record's whole first sentence, however long", () => {
  const longSentence = `${"合成".repeat(120)}。`
  const long = lineOf({ ...AVAILABLE, latest: { state: "ready", date: "2026-09-26", judgment: `${longSentence}第二句不顯示。` } }, "最近一次記錄")!
  assert.equal(long.text, `2026-09-26 · ${longSentence}`)
  assert.doesNotMatch(long.text, /…/)
  const english = `**${"Synthetic evidence was bound to the registry ".repeat(6).trim()}.**`
  assert.equal(lineOf({ ...AVAILABLE, latest: { state: "ready", date: "2026-09-26", judgment: `${english} Second sentence.` } }, "最近一次記錄")!.text, `2026-09-26 · ${english}`)
})

/* ---------- Q4: 待處理 count line ---------- */

test("pendingActionsCountLine states producer counts and the oldest open date, and is absent when unreadable", () => {
  const template = investmentActions.items[0]
  const data: Pick<InvestmentActions, "state" | "items" | "counts"> = {
    state: "ready",
    counts: { open: 2, has_canonical_home: 1, closed: 0 },
    items: [
      { ...template, id: "ai:new", status: "open", date: "2026-09-26" },
      { ...template, id: "ai:old", status: "open", date: "2026-09-13" },
      { ...template, id: "ai:home", status: "has-canonical-home", date: "2026-09-01" },
    ],
  }
  assert.equal(pendingActionsCountLine(data, false), "Investment Note 還有 2 筆未結案的行動（最舊 2026-09-13）；另 1 筆已有正式歸宿。", "the oldest date is taken from open items only")
  assert.equal(pendingActionsCountLine({ ...data, state: "partial" }, false), "Investment Note 還有 2 筆未結案的行動（最舊 2026-09-13）；另 1 筆已有正式歸宿。")
  assert.equal(pendingActionsCountLine({ ...data, counts: { open: 0, has_canonical_home: 1, closed: 0 }, items: [data.items[2]] }, false), "Investment Note 還有 0 筆未結案的行動；另 1 筆已有正式歸宿。")
  assert.equal(pendingActionsCountLine({ ...data, items: data.items.map(item => ({ ...item, date: "" })) }, false), "Investment Note 還有 2 筆未結案的行動（最舊日期未提供）；另 1 筆已有正式歸宿。")
  assert.equal(pendingActionsCountLine(data, true), null, "a failed read must not show a count that reads as current")
  assert.equal(pendingActionsCountLine({ ...data, state: "unavailable" }, false), null, "an unavailable source is unknown, not zero")
  assert.equal(pendingActionsCountLine(undefined, false), null)
})

test("InvestmentNoteActions shows one count line and folds the existing rows into one collapsed list", async () => {
  const { InvestmentNoteActions } = await server.ssrLoadModule("/src/components/investment/InvestmentPage.tsx")
  const html = renderToStaticMarkup(createElement(InvestmentNoteActions, { data: investmentActions, isPending: false, isError: false }))
  assert.match(html.replace(/<[^>]+>/g, ""), /Investment Note 還有 1 筆未結案的行動（最舊 2026-09-20）；另 1 筆已有正式歸宿。/)
  assert.match(html, /<span class="whitespace-nowrap">2026-09-20<\/span>/, "the date never breaks at its hyphens on a narrow screen")
  assert.match(html, /<details><summary[^>]*>展開 2 筆行動<\/summary>/, "the rows sit in a details that is closed by default")
  assert.doesNotMatch(html, /<details open/)
  assert.match(html, /把交付證據門檻寫進判斷頁後再決定是否改變假設。/, "existing rows keep their text")
  assert.match(html, /已有判斷頁可承接/, "existing rows keep their status chip")
  assert.match(html, /編號與來源/, "existing rows keep their id/source details")
  assert.doesNotMatch(html, /先前已記錄：不因單一產品發布改動持倉。/, "closed items stay out, as before")
  assert.doesNotMatch(html, /尚未結束的行動/)

  const failed = renderToStaticMarkup(createElement(InvestmentNoteActions, { data: investmentActions, isPending: false, isError: true }))
  assert.match(failed, /待續行動這次讀不到；不把上次內容當成目前待續工作。本機筆記仍可使用。/)
  assert.doesNotMatch(failed, /Investment Note 還有/)
  assert.doesNotMatch(failed, /展開 \d+ 筆行動/)

  const unavailable = renderToStaticMarkup(createElement(InvestmentNoteActions, { data: { ...investmentActions, state: "unavailable", message: "合成：待辦掃描目前無法執行。", items: [], counts: { open: 0, has_canonical_home: 0, closed: 0 } }, isPending: false, isError: false }))
  assert.match(unavailable, /合成：待辦掃描目前無法執行。/)
  assert.doesNotMatch(unavailable, /Investment Note 還有 0 筆/, "unavailable never reads as zero")
})

// Review block 2: rows and count share one unreadable flag.
test("InvestmentNoteActions shows no action rows for an unavailable payload that still carries items", async () => {
  const { InvestmentNoteActions } = await server.ssrLoadModule("/src/components/investment/InvestmentPage.tsx")
  const leftover = { ...investmentActions, state: "unavailable" as const, message: "合成：待辦掃描目前無法執行。" }
  assert.ok(leftover.items.some(item => item.status === "open"), "the payload still carries open items")
  const html = renderToStaticMarkup(createElement(InvestmentNoteActions, { data: leftover, isPending: false, isError: false }))
  assert.match(html, /合成：待辦掃描目前無法執行。/)
  assert.doesNotMatch(html, /Investment Note 還有/)
  assert.doesNotMatch(html, /展開 \d+ 筆行動|<details/, "no fold and no rows")
  assert.doesNotMatch(html, /整理兩個待查問題|把交付證據門檻寫進判斷頁/, "leftover item text never renders")
})

test("the Work tab merges the owner's items and Investment Note actions into one 待處理 section ahead of 我的提醒", () => {
  const page = readFileSync(new URL("../src/components/investment/InvestmentPage.tsx", import.meta.url), "utf8")
  const panel = page.slice(page.indexOf('id="investment-panel-work"'), page.indexOf('id="investment-panel-history"'))
  assert.match(panel, /aria-label="待處理"/)
  assert.match(panel, /<SectionHeading>待處理<\/SectionHeading><p className="text-caption text-ink-3">你記下的問題與研究，加上 Investment Note 還沒結案的行動。<\/p>/)
  assert.doesNotMatch(panel, /我留下的問題與研究|尚未結束的行動/, "the two old sections are gone")
  const owner = panel.indexOf("<InvestmentWorkPanel")
  const note = panel.indexOf("<InvestmentNoteActions")
  const reminders = panel.indexOf('<InvestmentReminderPanel mode="attention"')
  assert.ok(owner > 0 && owner < note, "the owner's own items come first, unchanged")
  assert.ok(note < reminders, "我的提醒 stays its own section after the merged one")
  assert.ok(panel.indexOf("<ResearchWatch") > reminders, "the 30-day events list stays on this tab")
})

/* ---------- Q2/Q3 rendered: 我的判斷 ---------- */

function narrativePayload(): InvestmentNarrative {
  const payload = structuredClone(investmentNarrative)
  const narrative = payload.narratives[0]
  narrative.current_tension = { state: "ready", text: "合成張力：回報晚到時誰先撐不住。", source: null, reason: null }
  narrative.thesis_evidence.latest_recorded_change = {
    date: "2026-09-26", judgment: JUDGMENT, key_evidence: "合成關鍵事實。", later_verification: "合成後續驗證。",
    state: "ready", missing: [], source: null,
  }
  return payload
}

// Owner refinement of Q3: the top block is 目前判斷 (the latest summary); the
// long-held thesis is 長期論點, kept in place below it but folded by default.
test("我的判斷 opens with the 目前判斷 block, folds 長期論點 below it, and keeps the rest in order", async () => {
  const { InvestmentNarrativeSection } = await server.ssrLoadModule("/src/components/investment/InvestmentNarrative.tsx")
  const html = withQueryData(createElement(InvestmentNarrativeSection, { enabled: false, onOpenHistory: () => undefined }), [[["investment-narrative"], narrativePayload()]])
  assert.doesNotMatch(html, /摘要|論點全文/, "the interim names are gone")
  const order = [">目前判斷</h3>", ">長期論點</h3>", ">支持訊號</h3>", ">挑戰訊號</h3>", ">最近一次明確記錄的判斷與驗證</h3>", ">下一驗證點</h3>", ">五層詳細證據</h3>"]
  const positions = order.map(marker => html.indexOf(marker))
  assert.ok(positions.every(position => position > 0), `every section renders: ${positions.join(",")}`)
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, "目前判斷 first, 長期論點 right below it, everything else in its previous order")
  assert.equal((html.match(/>目前判斷<\/h3>/g) ?? []).length, 1)

  const current = html.slice(html.indexOf(">目前判斷</h3>"), html.indexOf(">長期論點</h3>"))
  assert.match(current, /<dt[^>]*>現在的張力<\/dt><dd[^>]*>合成張力：回報晚到時誰先撐不住。<\/dd>/)
  assert.match(current, /<dt[^>]*>最近一次記錄<\/dt><dd[^>]*>2026-09-26 · <strong>Bound synthetic L0 evidence to the registry without changing the thesis.<\/strong><\/dd>/)
  assert.match(current, /<dt[^>]*>接下來看<\/dt><dd class="[^"]*text-ink-3[^"]*">來源沒有把下一個檢查點連到這個論點<\/dd>/)
  assert.match(current, /<dt[^>]*>訊號<\/dt><dd[^>]*>支持 1 條・挑戰 1 條 · 支持首條：Synthetic paid usage；挑戰首條：Synthetic customer return<\/dd>/)

  const fold = /<details aria-label="長期論點"([^>]*)><summary[^>]*><h3[^>]*>長期論點<\/h3><\/summary>/.exec(html)
  assert.ok(fold, "長期論點 is a details whose summary is its heading")
  assert.doesNotMatch(fold[1], /\bopen\b/, "collapsed by default")
  const thesis = html.slice(html.indexOf(">長期論點</h3>"), html.indexOf(">支持訊號</h3>"))
  assert.match(thesis, /合成 AI 基礎設施案例/, "the thesis content itself is unchanged inside the fold")
  assert.match(thesis, /現在的張力/)
  assert.match(html, /先看目前判斷與支持／挑戰訊號，再回看最近一次明確記錄與下一驗證點，最後展開五層來源證據。/)
})

// Review block 1: a failed read keeps earlier data on the page, but 目前判斷 must not present it as current.
test("after a failed read, the 目前判斷 block shows 目前無法取得 instead of the retained data", async () => {
  const { InvestmentNarrativeSection } = await server.ssrLoadModule("/src/components/investment/InvestmentNarrative.tsx")
  const client = new QueryClient()
  client.setQueryData(["investment-narrative"], narrativePayload())
  const query = client.getQueryCache().find({ queryKey: ["investment-narrative"] })!
  query.setState({ status: "error", error: new Error("synthetic read failure"), fetchStatus: "idle" })
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(InvestmentNarrativeSection, { enabled: false, onOpenHistory: () => undefined })))
  assert.match(html, /這次論點來源讀取失敗。以下保留上次讀取結果。/)
  const current = html.slice(html.indexOf(">目前判斷</h3>"), html.indexOf(">長期論點</h3>"))
  assert.equal((current.match(/<dd class="[^"]*text-ink-3[^"]*">目前無法取得<\/dd>/g) ?? []).length, 4)
  assert.doesNotMatch(current, /合成張力|Bound synthetic|支持 1 條/, "retained values stay out of the current block")
})

test("each evidence layer shows one status line under its title; the longer opposing notes live in its details", async () => {
  const { InvestmentNarrativeSection } = await server.ssrLoadModule("/src/components/investment/InvestmentNarrative.tsx")
  const payload = narrativePayload()
  payload.narratives[0].thesis_evidence.layers[3].opposing_coverage = { state: "unknown", checked_at: null, scope: null, reason: "沒有明確反方 evidence coverage receipt；空清單不代表沒有反方", source: null }
  const html = withQueryData(createElement(InvestmentNarrativeSection, { enabled: false, onOpenHistory: () => undefined }), [[["investment-narrative"], payload]])
  const chunks = html.split("<h4").slice(1)
  assert.equal(chunks.length, 5)
  const expected = [
    "支持 0 筆・挑戰 1 筆・反方：有反方證據",
    "支持 0 筆・挑戰 0 筆・反方：查得不完整",
    "支持 0 筆・挑戰 0 筆・反方：還沒查",
    "支持 0 筆・挑戰 0 筆・反方：還沒查",
    "支持 0 筆・挑戰 0 筆・反方：還沒查",
  ]
  chunks.forEach((chunk, index) => {
    const status = chunk.indexOf(expected[index])
    assert.ok(status > 0, `layer ${index} status line: ${expected[index]}`)
    assert.ok(status < chunk.indexOf("明確證據方向"), "the status line sits directly under the title")
    const details = chunk.indexOf("這層的背景與來源")
    for (const old of ["反方證據連結：", "反方涵蓋："]) {
      assert.ok(chunk.indexOf(old) > details, `${old} moved into the layer's details`)
    }
  })
  const receipt = chunks[3]
  assert.ok(receipt.indexOf("沒有明確反方 evidence coverage receipt") > receipt.indexOf("這層的背景與來源"), "the receipt wording is detail-only")
  assert.doesNotMatch(html, /反方檢查範圍與來源/, "no separate nested details on the main level")
})

/* ---------- Q2-B: one AI-written reading per layer ---------- */

const syntheticReading = {
  state: "ready" as const, text: "合成層的目前認知。", as_of: "2026-09-27", basis: "合成依據（2026-09-20）",
  authored_by: "ai_scorecard", layer_revision: "0123456789abcdef", current_layer_revision: "0123456789abcdef",
  limitations: [], source: null,
}
const syntheticGap = {
  gap_id: "gap-synthetic", pillar_id: "l1_cloud", missing: "合成缺口", closes_when: "合成季報", expected_by: "2026-10",
  expected_by_precision: "month" as const, overdue: false, state: "ready" as const, source: null,
}

test("a layer reading is shown only when its text is usable, with an AI provenance line and closable gaps", () => {
  assert.equal(layerReadingText({ current_reading: syntheticReading }), "合成層的目前認知。")
  assert.equal(layerReadingText({ current_reading: { ...syntheticReading, text: "  " } }), null)
  assert.equal(layerReadingText({ current_reading: { ...syntheticReading, state: "conflict", text: null } }), null)
  assert.equal(layerReadingText({}), null, "an older producer without readings keeps the status line")
  assert.equal(layerReadingCaption(syntheticReading), "AI 整理・2026-09-27・依據：合成依據（2026-09-20）")
  assert.equal(layerReadingCaption({ as_of: null, basis: null }), "AI 整理・日期未提供・依據：未提供")
  assert.equal(layerReadingCaption({ as_of: "2026-09-27", basis: "  " }), "AI 整理・2026-09-27・依據：未提供", "a blank basis reads as missing")
  assert.equal(layerGapLine(syntheticGap), "還缺：合成缺口｜合成季報・預計 2026-10")
  assert.equal(layerGapLine({ ...syntheticGap, overdue: true }), "還缺：合成缺口｜合成季報・預計 2026-10・已過預計時間")
})

test("a layer with a reading shows it under the title in place of the status line; other layers keep the status line", async () => {
  const { InvestmentNarrativeSection } = await server.ssrLoadModule("/src/components/investment/InvestmentNarrative.tsx")
  const payload = narrativePayload()
  const layers = payload.narratives[0].thesis_evidence.layers
  layers[1].current_reading = syntheticReading
  layers[1].gaps = [syntheticGap]
  layers[2].current_reading = { ...syntheticReading, state: "conflict", text: null }
  const html = withQueryData(createElement(InvestmentNarrativeSection, { enabled: false, onOpenHistory: () => undefined }), [[["investment-narrative"], payload]])
  const chunks = html.split("<h4").slice(1)
  const top = (chunk: string) => chunk.slice(0, chunk.indexOf("明確證據方向"))
  assert.match(top(chunks[1]), /合成層的目前認知。/)
  assert.match(top(chunks[1]), /AI 整理・2026-09-27・依據：合成依據（2026-09-20）/)
  assert.match(top(chunks[1]), /還缺：合成缺口｜合成季報・預計 2026-10/)
  assert.doesNotMatch(top(chunks[1]), /支持 0 筆・挑戰 0 筆/, "the reading replaces the counted status line")
  assert.match(top(chunks[2]), /支持 0 筆・挑戰 0 筆・反方：還沒查/, "an unusable reading falls back to the status line")
  assert.match(top(chunks[0]), /支持 0 筆・挑戰 1 筆・反方：有反方證據/)
  assert.ok(chunks[1].indexOf("反方涵蓋：") > chunks[1].indexOf("這層的背景與來源"), "opposing coverage stays in the details")
})

/* ---------- Q1: Today 「今天怎麼做」 ---------- */

test("今天怎麼做 renders the judgment as a headline plus label-over-body fields, with no bold inline labels", async () => {
  const { TodayNextSteps } = await server.ssrLoadModule("/src/components/investment/InvestmentPage.tsx")
  const brief = structuredClone(investment.brief)
  const judgment = brief.judgment!
  const serializedLegacy = `${judgment.judgment}； why_now: ${judgment.why_now}； revisit: ${judgment.revisit}； decision_effect: ${judgment.decision_effect}； provenance: story_id=demo-storage-event`
  brief.actions = [serializedLegacy]
  brief.action_items = [{ ...brief.action_items![0], kind: "unknown", text: serializedLegacy }]
  const html = withQueryData(createElement(TodayNextSteps, { b: brief, today: structuredClone(investment.today) }))
  assert.doesNotMatch(html, /為什麼現在：|何時回看：|什麼會改變判斷：/, "no inline 標籤： prefixes remain")
  assert.doesNotMatch(html, /<span class="font-medium text-ink">/, "no bold inline label spans remain in the card")
  const field = (label: string) => new RegExp(`<dt class="text-caption text-ink-3">${label}</dt><dd class="text-body leading-relaxed text-ink-2">`)
  assert.match(html, field("為什麼現在"))
  assert.match(html, field("何時回看"))
  assert.match(html, field("什麼會改變判斷"))
  const headline = html.indexOf(judgment.judgment)
  assert.ok(headline > 0 && headline < html.indexOf(">為什麼現在</dt>"), "chip + judgment sentence stay the row headline")
  assert.ok(html.indexOf(">為什麼現在</dt>") < html.indexOf(">何時回看</dt>") && html.indexOf(">何時回看</dt>") < html.indexOf(">什麼會改變判斷</dt>"))
  assert.match(html, /<dt class="text-caption text-ink-3">整體判斷<\/dt><dd class="text-body leading-relaxed font-medium text-ink">/, "the overall summary keeps its emphasis under its own label")
  assert.match(html, /<summary class="cursor-pointer py-1">檢查點與來源<\/summary>/, "the bottom details stays")
  assert.match(html, /已核對的事件 story_id：demo-storage-event/)
  assert.match(html, /來源文件：demo-investment-research-loop-v1/)
  assert.match(html, /來源修訂：sha256:synthetic-demo-judgment/)
  assert.doesNotMatch(html, /why_now: /, "the producer's serialized legacy fields do not repeat the structured card")
  assert.doesNotMatch(html, /<details class="mt-3|class="mb-[23] /, "spacing comes from the container gap, not child margins")
})

test("今天怎麼做 action rows use the same field layout and left edge as the judgment row", async () => {
  const { TodayNextSteps } = await server.ssrLoadModule("/src/components/investment/InvestmentPage.tsx")
  const brief = structuredClone(investment.brief)
  const template = brief.action_items![0]
  brief.judgment = null
  brief.actions = []
  brief.action_items = [
    { ...template, id: "ai:synthetic-primary", kind: "action", status: "open", text: "合成主要行動。", evidence: ["合成理由一"] },
    { ...template, id: "ai:synthetic-second", kind: "watch", status: "open", text: "合成次要行動。", evidence: ["合成理由二"] },
  ]
  const html = withQueryData(createElement(TodayNextSteps, { b: brief, today: { ...structuredClone(investment.today), updates: [] } }))
  assert.doesNotMatch(html, /為什麼現在：/)
  assert.equal((html.match(/<dt class="text-caption text-ink-3">為什麼現在<\/dt>/g) ?? []).length, 2, "each row's reason is a labelled field")
  const rows = html.match(/<li class="flex min-w-0 flex-col gap-3 border-l-2 pl-3 border-[a-z-]+">/g) ?? []
  assert.equal(rows.length, 2, "primary and secondary rows share one left-edge rule")
})

/* ---------- 資料待整理: drop expired registrations ---------- */

test("withoutExpiredCatalystGaps drops only the exact expired reason", () => {
  const gaps = [
    { ticker: "A", reason: EXPIRED_CATALYST_GAP_REASON },
    { ticker: "B", reason: "next_catalyst 缺失" },
    { ticker: "C", reason: "next_catalyst 缺出處標記" },
    { ticker: "D", reason: "推估日無確定窗口" },
    { ticker: "E", reason: "next_catalyst 已過期（另有說明）" },
  ]
  assert.equal(EXPIRED_CATALYST_GAP_REASON, "next_catalyst 已過期")
  assert.deepEqual(withoutExpiredCatalystGaps(gaps).map(gap => gap.ticker), ["B", "C", "D", "E"], "anything but the exact reason stays")
  assert.equal(gaps.length, 5, "the input is not mutated")
})

test("FutureContent leaves expired registrations out of 資料待整理 and its count", async () => {
  const { FutureContent } = await server.ssrLoadModule("/src/components/investment/InvestmentNarrative.tsx")
  const projection = {
    state: "partial", window_start: "2026-09-27", window_end: "2026-10-27",
    items: [], uncertain_items: [], past_items: [],
    coverage_gaps: [
      { ticker: "EXPA", reason: "next_catalyst 已過期" },
      { ticker: "EXPB", reason: "next_catalyst 已過期" },
      { ticker: "MISS", reason: "next_catalyst 缺失" },
      { ticker: "MARK", reason: "next_catalyst 缺出處標記" },
    ],
    limitations: [],
  }
  const html = renderToStaticMarkup(createElement(FutureContent, { projection }))
  assert.match(html, /資料待整理 · 2/)
  assert.doesNotMatch(html, /EXPA|EXPB|已過期/)
  assert.match(html, /MISS（?[^<]*：next_catalyst 缺失/)
  assert.match(html, /MARK[^<]*：next_catalyst 缺出處標記/)

  const onlyExpired = renderToStaticMarkup(createElement(FutureContent, { projection: { ...projection, coverage_gaps: projection.coverage_gaps.slice(0, 2) } }))
  assert.doesNotMatch(onlyExpired, /資料待整理/, "a fold of only expired rows disappears")
})

test("the catalysts_30d fallback leaves expired registrations out of 資料待整理 and its count", async () => {
  const { TodayCatalysts } = await server.ssrLoadModule("/src/components/investment/InvestmentNarrative.tsx")
  const payload = structuredClone(investmentNarrative)
  payload.future_checkpoints = null
  payload.catalysts_30d!.coverage_gaps = [
    { ticker: "EXPA", reason: "next_catalyst 已過期", source: { path: "synthetic/catalysts.md", line: 30 } },
    { ticker: "MISS", reason: "next_catalyst 缺失" },
    { ticker: "LIVE", reason: "live holding 缺可掃描 wiki source" },
  ]
  const html = withQueryData(createElement(TodayCatalysts, { enabled: false }), [[["investment-narrative"], payload]])
  assert.match(html, /資料待整理 · 2/, "the demo projection has no undated catalyst rows, so only the two kept gaps count")
  assert.doesNotMatch(html, /EXPA|已過期/)
  assert.match(html, /MISS：next_catalyst 缺失/)
  assert.match(html, /LIVE：live holding 缺可掃描 wiki source/)
})
