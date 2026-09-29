/** Coverage for owner-feedback issues #56 (judgment row), #58 (checkpoint
 * folds) and the plain-language status copy in #59, scoped to this agent's
 * files. Pure-function behavior is asserted directly; the two fold/linkage
 * renderers are exercised through vite's ssrLoadModule + renderToStaticMarkup,
 * the same pattern tests/event-news.test.ts already uses for these exact
 * components. */
import test from "node:test"
import assert from "node:assert/strict"
import { createServer } from "vite"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { investment } from "./fixtures/extended-ui.ts"
import type { InvestmentActionItem, InvestmentBrief, InvestmentBriefJudgment } from "../src/lib/investment.ts"
import {
  JUDGMENT_CLASS_LABEL, newsScanNote, providerCompletionNote, providerDetailTitle,
  structuredBriefJudgmentReplacement, taipeiClock, currentTodayActionEntries as todayActionPlan, validatedBriefJudgment,
} from "../src/lib/investmentFormat.ts"
import { foldBReason, nonExactDateReason, splitNonExactByDateInfo, translateLegacyLimitation } from "../src/lib/investmentToday.ts"

test("structured judgment replaces only one contract-valid, unclassified formal item", () => {
  const judgment: InvestmentBriefJudgment = {
    class: "watch", judgment: "今天不交易", why_now: "尚未有新證據。",
    revisit: "收盤後再看需求訊號。", decision_effect: "需求確認才重新評估。",
    provenance: { validated_story_ids: ["story-1"], artifact: "wiki/morning/brief.md", source_revision: "sha256:demo", source_cutoff: "2026-09-27T08:00:00+08:00" },
  }
  const template = investment.brief.action_items![0]
  const legacyText = "舊版正式主要項目文案； why_now: 尚未有新證據； revisit: 收盤後再看； decision_effect: 訊號確認後重新評估； provenance: story_id=story-1"
  const legacyItem: InvestmentActionItem = { ...template, id: "ai:legacy", kind: "unknown", status: "open", text: legacyText }
  const single: InvestmentBrief = { ...structuredClone(investment.brief), actions: [legacyText], action_items: [legacyItem], judgment }
  assert.equal(structuredBriefJudgmentReplacement(single)?.judgment, judgment)
  assert.deepEqual(todayActionPlan(single).map(item => item.text), [], "the unique, unclassified serialized row is replaced without comparing its prose")
  assert.deepEqual(todayActionPlan(single, undefined, false).map(item => item.text), [legacyText], "a read failure keeps the old formal row in source detail")

  const unmarked: InvestmentBrief = { ...single, actions: ["無法辨認的舊版行動文案。"], action_items: [{ ...legacyItem, text: "無法辨認的舊版行動文案。" }] }
  assert.equal(structuredBriefJudgmentReplacement(unmarked), null, "an unmarked action is not assumed to serialize the judgment")
  assert.deepEqual(todayActionPlan(unmarked).map(item => item.text), ["無法辨認的舊版行動文案。"])

  const explicitlyTyped: InvestmentBrief = { ...single, actions: [`觀察：${legacyText}`], action_items: [{ ...legacyItem, kind: "unknown", text: `觀察：${legacyText}` }] }
  assert.equal(structuredBriefJudgmentReplacement(explicitlyTyped), null, "a legacy prefix is an explicit generic kind even when kind metadata is missing")
  assert.deepEqual(todayActionPlan(explicitlyTyped).map(item => item.text), [`觀察：${legacyText}`])

  const ambiguous: InvestmentActionItem = { ...template, id: "ai:second", kind: "unknown", status: "open", text: "第二筆正式項目。" }
  const multiple: InvestmentBrief = { ...single, action_items: [legacyItem, ambiguous], actions: [legacyItem.text, ambiguous.text] }
  assert.equal(structuredBriefJudgmentReplacement(multiple), null, "multiple formal rows fail closed")
  assert.deepEqual(todayActionPlan(multiple).map(item => item.text), [legacyItem.text, ambiguous.text])

  for (const kind of ["action", "watch", "research", "no_change"] as const) {
    const explicitGeneric = { ...single, action_items: [{ ...legacyItem, kind }] }
    assert.equal(structuredBriefJudgmentReplacement(explicitGeneric), null, `${kind} is an explicit generic source kind`)
    assert.deepEqual(todayActionPlan(explicitGeneric).map(item => item.text), [legacyItem.text])
  }
})

test("structured judgment follows its class-specific completeness contract and preserves malformed legacy payloads", () => {
  const judgment: InvestmentBriefJudgment = {
    class: "watch", judgment: "今天先觀察", why_now: "新證據仍不足。",
    revisit: "收盤後再看。", decision_effect: "若訊號延續才重新評估。", provenance: null,
  }
  const template = investment.brief.action_items![0]
  const legacyText = "舊版觀察文字； why_now: 新證據仍不足； revisit: 收盤後再看； decision_effect: 若訊號延續才重新評估"
  const actionItem: InvestmentActionItem = { ...template, id: "ai:legacy", kind: "unknown", status: "open", text: legacyText }
  const valid = { ...structuredClone(investment.brief), actions: [legacyText], action_items: [actionItem], judgment }

  for (const changed of [
    { ...judgment, revisit: null },
    { ...judgment, decision_effect: "  " },
    { ...judgment, why_now: "  " },
    { ...judgment, class: "unknown" as never },
    { ...judgment, provenance: [] as never },
    { ...judgment, provenance: { validated_story_ids: "story-1" } as never },
  ]) {
    const malformed = { ...valid, judgment: changed }
    assert.equal(structuredBriefJudgmentReplacement(malformed), null)
    assert.equal(validatedBriefJudgment(malformed), null)
    assert.deepEqual(todayActionPlan(malformed).map(item => item.text), [actionItem.text], "invalid producer payload never consumes the legacy row")
  }

  for (const classification of ["trade", "ignore"] as const) {
    const tradeOrIgnoreText = "舊版交易文字； why_now: 新證據仍不足"
    const sparse = { ...valid, actions: [tradeOrIgnoreText], action_items: [{ ...actionItem, text: tradeOrIgnoreText }], judgment: { ...judgment, class: classification, revisit: null, decision_effect: null } }
    assert.equal(structuredBriefJudgmentReplacement(sparse)?.judgment.class, classification, "trade and ignore only require judgment and why_now")
    assert.deepEqual(todayActionPlan(sparse), [])
  }

  const explicitLegacyPrefix: InvestmentBrief = { ...valid, action_items: [], actions: ["觀察：原有行動文案。"] }
  assert.equal(structuredBriefJudgmentReplacement(explicitLegacyPrefix), null, "legacy rows explicitly tagged as action/watch/research remain untouched")
  assert.deepEqual(todayActionPlan(explicitLegacyPrefix).map(item => item.text), ["原有行動文案。"])
})

test("JUDGMENT_CLASS_LABEL renders the three producer classes in plain Chinese", () => {
  assert.deepEqual(JUDGMENT_CLASS_LABEL, { trade: "交易", watch: "觀察", ignore: "忽略" })
})

test("taipeiClock only formats a timezone-qualified datetime; date-only or offset-less values show no clock", () => {
  assert.equal(taipeiClock("2026-09-27T18:47:07+08:00"), "18:47")
  assert.equal(taipeiClock("2026-09-27T10:47:07Z"), "18:47")
  assert.equal(taipeiClock("2026-09-27"), null, "date-only has no time to show")
  assert.equal(taipeiClock("2026-09-27T18:47:07"), null, "no Z or offset makes the instant ambiguous")
  assert.equal(taipeiClock(null), null)
  assert.equal(taipeiClock("not-a-date"), null)
})

test("newsScanNote excludes running/idle entirely, requires a timezone-qualified cutoff, and uses the real server's success/no-change/failed wording", () => {
  const cutoff = "2026-09-27T08:15:00+08:00"
  assert.equal(newsScanNote(undefined, cutoff), null, "a scan that never ran says nothing")
  assert.equal(newsScanNote({ state: "idle", market_scope: "tw", last_updated: null, new_update_count: null }, cutoff), null)
  assert.equal(newsScanNote({ state: "running", market_scope: "tw", last_updated: "2026-09-27T18:45:00+08:00", new_update_count: null }, cutoff), null, "progress belongs in the refresh-status area, not this header note")
  assert.equal(newsScanNote({ state: "no-change", market_scope: "tw", last_updated: "2026-09-27T07:00:00+08:00", new_update_count: 0 }, cutoff), null, "a scan that predates the brief must not look fresher than it is")
  assert.equal(newsScanNote({ state: "no-change", market_scope: "tw", last_updated: "2026-09-27T18:47:07+08:00", new_update_count: 0 }, null), null, "a missing brief cutoff can never be shown to postdate -- no note, not an unconditional one")
  assert.equal(newsScanNote({ state: "no-change", market_scope: "tw", last_updated: "2026-09-27T18:47:07+08:00", new_update_count: 0 }, "2026-09-27"), null, "a date-only cutoff is not timezone-qualified")
  assert.equal(newsScanNote({ state: "no-change", market_scope: "tw", last_updated: "2026-09-27", new_update_count: 0 }, cutoff), null, "a date-only scan timestamp is not timezone-qualified either")
  assert.equal(newsScanNote({ state: "failed", market_scope: "us", last_updated: "2026-09-27T21:20:00+08:00", new_update_count: null }, cutoff), "美股快掃 21:20：失敗，保留上一版")
  assert.equal(newsScanNote({ state: "no-change", market_scope: "tw", last_updated: "2026-09-27T18:47:07+08:00", new_update_count: 0 }, cutoff), "台股快掃 18:47：沒有影響判斷的新消息")
  assert.equal(newsScanNote({ state: "success", market_scope: "tw", last_updated: "2026-09-27T18:47:07+08:00", new_update_count: 3 }, cutoff), "台股快掃 18:47：有 3 則新消息")
  assert.equal(newsScanNote({ state: "success", market_scope: "tw", last_updated: "2026-09-27T18:47:07+08:00", new_update_count: 0 }, cutoff), "台股快掃 18:47：沒有影響判斷的新消息", "a defensive exactly-zero success reads the same as no-change")
  assert.equal(newsScanNote({ state: "success", market_scope: "tw", last_updated: "2026-09-27T18:47:07+08:00", new_update_count: null }, cutoff), "台股快掃 18:47：已完成（新增則數未知）", "a server-restart success (real state: null count) never claims zero or any specific count")
  assert.equal(newsScanNote({ state: "no-change", market_scope: null, last_updated: "2026-09-27T18:47:07+08:00", new_update_count: 0 }, cutoff), "快掃 18:47：沒有影響判斷的新消息", "unknown market scope omits the market prefix rather than guessing")
})

test("providerCompletionNote and providerDetailTitle keep raw model/provider_errors off the main line", () => {
  assert.equal(providerCompletionNote({ provider: null, fallback_depth: null }), null)
  assert.equal(providerCompletionNote({ provider: "claude", fallback_depth: 0 }), "由 Claude 完成")
  assert.equal(providerCompletionNote({ provider: "claude", fallback_depth: 1 }), "由 Claude 完成（先前 1 個模型未成功）")
  assert.equal(providerCompletionNote({ provider: "grok", fallback_depth: null }), "由 Grok 完成")
  assert.doesNotMatch(providerCompletionNote({ provider: "claude", fallback_depth: 1 }) ?? "", /fallback/)

  assert.equal(providerDetailTitle(undefined), undefined)
  assert.equal(providerDetailTitle({ model: null, provider_errors: {} }), undefined)
  assert.equal(providerDetailTitle({ model: "opus[1m]", provider_errors: { codex: "timeout: timeout after 75s" } }), "model: opus[1m] · errors: codex=timeout: timeout after 75s")
})

test("splitNonExactByDateInfo keeps any row with date information visible, whatever its identity", () => {
  const monthOnly = { story_id: null, date: null, date_label: "2026-10", ticker: "A" }
  const estimatedDay = { date: null, date_label: "2026-10-27", ticker: "B" }
  const exactDate = { story_id: "earnings-c", date: "2026-10-05", date_label: null, ticker: "C" }
  const noDate = { story_id: "earnings-d", date: null, date_label: null, ticker: "D" }
  const blankLabel = { date: null, date_label: "   ", ticker: "E" }
  const noFields = { ticker: "F" }
  const { dated, undated } = splitNonExactByDateInfo([monthOnly, estimatedDay, exactDate, noDate, blankLabel, noFields])
  assert.deepEqual(dated, [monthOnly, estimatedDay, exactDate], "an upcoming event without an event identity is not hidden")
  assert.deepEqual(undated, [noDate, blankLabel, noFields], "an identity without any date still has no usable date")
})

test("nonExactDateReason and foldBReason derive plain reasons only from producer-sent fields", () => {
  assert.equal(nonExactDateReason({ date_precision: "month", date: null, window_membership: "possible" }), "只知月份")
  assert.equal(nonExactDateReason({ date_precision: "imprecise", date: null, window_membership: "unknown" }), "日期未公布")
  assert.equal(nonExactDateReason({ date_precision: "day", date: "2026-10-05", window_membership: "possible" }), "窗口關係未確認")
  assert.equal(translateLegacyLimitation("legacy 登記缺明示事件 identity；未自動合併"), "沒有對應的事件身份")
  assert.equal(translateLegacyLimitation("推估日無確定窗口"), "推估日無確定窗口", "a normal producer reason passes through unchanged")
  assert.equal(foldBReason([]), "沒有對應的事件身份")
  assert.equal(foldBReason(["legacy 登記缺明示事件 identity；未自動合併"]), "沒有對應的事件身份")
  assert.equal(foldBReason(["來源已過期", "尚待覆核"]), "來源已過期；尚待覆核")
})

test("FutureContent splits non-exact rows into 日期未定 (has story_id) and 資料待整理 (no identity, plus coverage gaps), dropping the old merged fold and its per-item orange limitations", async () => {
  const previousLocation = Object.getOwnPropertyDescriptor(globalThis, "location")
  Object.defineProperty(globalThis, "location", { value: { origin: "http://localhost", hostname: "localhost" }, configurable: true })
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
  try {
    const { FutureContent } = await server.ssrLoadModule("/src/components/investment/InvestmentNarrative.tsx")
    const source = { path: "wiki/SYNTH/index.md", line: 4 }
    const base = {
      title: "合成事件", state: "unlinked", date: "2026-10-05", date_label: "2026-10-05",
      date_precision: "day", window_membership: "within", affected_tickers: [] as string[], affected_scopes: [],
      checks: [], sources: [source], limitations: [] as string[],
    }
    const dated = { ...base, story_id: "synth-followup", title: "月份未定的合成事件", date: null, date_label: "2026-10", date_precision: "month", window_membership: "possible" }
    const undated = { ...base, story_id: null, title: "沒有事件身份的合成登記", affected_tickers: ["SYNTH"], date: null, date_label: null, date_precision: "imprecise", window_membership: "unknown", limitations: ["legacy 登記缺明示事件 identity；未自動合併"] }
    const projection = {
      state: "partial", window_start: "2026-09-27", window_end: "2026-10-27",
      items: [], uncertain_items: [dated, undated], past_items: [],
      coverage_gaps: [{ ticker: "0050.TW", reason: "live holding 缺可掃描 wiki source" }],
      limitations: [],
    }
    const html = renderToStaticMarkup(createElement(FutureContent, { projection }))
    assert.doesNotMatch(html, /日期或事件關聯未確認/, "the old merged fold header must be gone")
    assert.match(html, /日期未定 · 1/)
    assert.match(html, /月份未定的合成事件/)
    assert.match(html, /只知月份/)
    assert.match(html, /資料待整理 · 2/, "the no-identity row and the coverage gap share fold B")
    assert.match(html, /沒有對應的事件身份/)
    assert.doesNotMatch(html, /legacy/i, "the internal legacy phrasing must be translated away")
    // Finding #2: the event's own title must always show, even when it also
    // has affected tickers -- tickers are extra context, never a replacement.
    assert.match(html, /沒有事件身份的合成登記（SYNTH）：沒有對應的事件身份/)
    assert.match(html, /0050\.TW/)
    assert.match(html, /live holding 缺可掃描 wiki source/)
    // The section-level state Chip legitimately uses a warn tone; scope the
    // "no per-item orange limitation line" check to the two folds themselves.
    const foldsOnward = html.slice(html.indexOf("日期未定"))
    assert.doesNotMatch(foldsOnward, /text-warn/, "fold rows drop their per-item orange limitation styling")
  } finally { await server.close(); if (previousLocation) Object.defineProperty(globalThis, "location", previousLocation); else Reflect.deleteProperty(globalThis, "location") }
})

test("catalysts_30d fallback fold B renders the producer's actual event text, date and source, not just a ticker and a generic reason", async () => {
  const previousLocation = Object.getOwnPropertyDescriptor(globalThis, "location")
  Object.defineProperty(globalThis, "location", { value: { origin: "http://localhost", hostname: "localhost" }, configurable: true })
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
  try {
    const { CatalystFoldBRow } = await server.ssrLoadModule("/src/components/investment/InvestmentNarrative.tsx")
    const item = {
      ticker: "CIEN", type: "watchlist",
      raw: "~2026-09 上旬 Q3 FY26 earnings（⏳ 公司未公告：Ciena IR 2026-07-25 查最新為 Q2 FY26）",
      date_precision: "month", date: null, date_label: "2026-09",
      source_qualifiers: ["未公告"], source: { path: "wiki/CIEN/index.md", line: 9 }, window_membership: "possible",
    }
    const html = renderToStaticMarkup(createElement(CatalystFoldBRow, { item }))
    assert.match(html, /CIEN/)
    assert.match(html, /2026-09/)
    assert.match(html, /~2026-09 上旬 Q3 FY26 earnings/, "the producer's actual event text must render, not be dropped")
    assert.match(html, /只知月份/)
    assert.match(html, /wiki\/CIEN\/index\.md:9/, "source location must render when present")
  } finally { await server.close(); if (previousLocation) Object.defineProperty(globalThis, "location", previousLocation); else Reflect.deleteProperty(globalThis, "location") }
})

test("EventNews suppresses the two unresolved main-level lines only when both tickers and thesis relation are missing, and notes it once in the source details", async () => {
  const previousLocation = Object.getOwnPropertyDescriptor(globalThis, "location")
  Object.defineProperty(globalThis, "location", { value: { origin: "http://localhost", hostname: "localhost" }, configurable: true })
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
  try {
    const { EventNews } = await server.ssrLoadModule("/src/components/investment/EventNews.tsx")
    const source = { path: "wiki/morning/briefs/2026-09-27.md", item_index: 0, at: "2026-09-27T08:05:00+08:00" }
    const bare = {
      key: "bare-event", story_id: "bare-event", title: "沒有標的或論點關聯的合成事件", state: "unlinked",
      ticker_link_state: "unknown", thesis_link_state: "unlinked", affected_tickers: [] as string[],
      ticker_effects: [], thesis_effects: [], canonical_claim_effects: [],
      occurrences: [{ kind: "brief", title: "沒有標的或論點關聯的合成事件", market_reaction: null, interpretation: null, impact: null, source }],
      checkpoint: { state: "unlinked", story_id: "bare-event", checks: [] }, limitations: [],
    }
    const html = renderToStaticMarkup(createElement(EventNews, { projection: { state: "ready", items: [bare], limitations: [] } }))
    assert.doesNotMatch(html, /影響標的：來源尚未明示/)
    assert.doesNotMatch(html, /對論點的影響/)
    assert.doesNotMatch(html, /來源未明示論點關聯；不由標的名稱推定。/)
    assert.match(html, /來源沒有標明影響標的與論點關聯。/)

    const tickersOnly = { ...bare, key: "tickers-only", affected_tickers: ["SYNTH"] }
    const tickersOnlyHtml = renderToStaticMarkup(createElement(EventNews, { projection: { state: "ready", items: [tickersOnly], limitations: [] } }))
    assert.match(tickersOnlyHtml, /影響標的：SYNTH/)
    assert.match(tickersOnlyHtml, /來源未明示論點關聯；不由標的名稱推定。/, "thesis relation is still individually reported as missing when tickers are present")
    assert.doesNotMatch(tickersOnlyHtml, /來源沒有標明影響標的與論點關聯。/)
  } finally { await server.close(); if (previousLocation) Object.defineProperty(globalThis, "location", previousLocation); else Reflect.deleteProperty(globalThis, "location") }
})
