import assert from "node:assert/strict"
import test from "node:test"

import { classifyTwSession, primaryTwBlock, shouldPollTwPulse, twSessionLabel } from "../src/lib/investmentFormat.ts"

// A single fixed Monday TWSE regular session: 2026-09-28 09:00-13:30 Taipei
// (UTC+8, no DST), i.e. 2026-09-28T01:00:00Z - 2026-09-28T05:30:00Z. All
// times below are fixed instants -- never `Date.now()` -- so this behavior is
// verifiable at any time of day, outside real market hours included.
const REGULAR_START = "2026-09-28T01:00:00Z"
const REGULAR_END = "2026-09-28T05:30:00Z"

test("during the regular session the state is 'open' regardless of the pulse's own as_of", () => {
  const open = (now: string, dailyAsOf: string | null) => classifyTwSession({
    now: Date.parse(now), regularStart: REGULAR_START, regularEnd: REGULAR_END,
    quotedAt: "2026-09-28T02:00:00Z", dailyAsOf,
  })
  assert.equal(open("2026-09-28T01:00:00Z", null), "open") // right at the opening bell
  assert.equal(open("2026-09-28T03:15:00Z", "2026-09-25"), "open") // mid-session, stale pulse still doesn't override
  assert.equal(open("2026-09-28T05:29:59Z", "2026-09-28"), "open") // one second before close
  assert.equal(classifyTwSession({
    now: Date.parse("2026-09-28T05:30:00Z"), regularStart: REGULAR_START, regularEnd: REGULAR_END,
    quotedAt: "2026-09-28T02:00:00Z", dailyAsOf: null,
  }), "closed_before_daily") // the end bound itself is exclusive -- exactly closing time is already "closed"
})

test("after close, a same-day pulse means 'closed_with_daily' and a stale one means 'closed_before_daily'", () => {
  const afterClose = (dailyAsOf: string | null) => classifyTwSession({
    now: Date.parse("2026-09-28T07:00:00Z"), regularStart: REGULAR_START, regularEnd: REGULAR_END,
    quotedAt: "2026-09-28T05:29:00Z", dailyAsOf,
  })
  assert.equal(afterClose("2026-09-28"), "closed_with_daily")
  assert.equal(afterClose("2026-09-25"), "closed_before_daily") // last Friday's pulse, today's session already closed
  assert.equal(afterClose(null), "closed_before_daily") // no pulse at all yet
})

test("before today's open, the reference date comes from the last quote, not from today's (not-yet-started) bounds", () => {
  const preOpen = (dailyAsOf: string | null) => classifyTwSession({
    now: Date.parse("2026-09-28T00:30:00Z"), // 08:30 Taipei, 30 minutes before the bell
    regularStart: REGULAR_START, regularEnd: REGULAR_END,
    quotedAt: "2026-09-25T05:29:00Z", // last Friday's final quote
    dailyAsOf,
  })
  assert.equal(preOpen("2026-09-25"), "closed_with_daily") // Friday's pulse already caught up to Friday's close
  assert.equal(preOpen("2026-09-24"), "closed_before_daily") // pulse still lagging behind Friday's close
  assert.equal(preOpen(null), "closed_before_daily")
})

test("no bounds and no quote is 'unknown' even when a daily pulse exists -- it is never assumed fresh", () => {
  assert.equal(classifyTwSession({
    now: Date.parse("2026-09-28T07:00:00Z"), regularStart: null, regularEnd: null, quotedAt: null, dailyAsOf: "2026-09-28",
  }), "unknown")
  assert.equal(classifyTwSession({
    now: Date.parse("2026-09-28T07:00:00Z"), regularStart: null, regularEnd: null, quotedAt: null, dailyAsOf: null,
  }), "unknown")
})

test("malformed, inverted, or missing bounds never produce a false 'open' -- and never a confident 'closed' either", () => {
  // A quote timestamp alone is not proof the session has ended: without valid
  // bounds we have no evidence the market is not open right now, so this must
  // stay "unknown", not "closed_before_daily" (a live intraday quote could
  // otherwise render mislabelled "已收盤").
  assert.equal(classifyTwSession({
    now: Date.parse("2026-09-28T03:00:00Z"), regularStart: "not-a-date", regularEnd: REGULAR_END,
    quotedAt: "2026-09-28T02:00:00Z", dailyAsOf: null,
  }), "unknown")
  assert.equal(classifyTwSession({
    now: Date.parse("2026-09-28T03:00:00Z"), regularStart: REGULAR_END, regularEnd: REGULAR_START, // end before start
    quotedAt: "2026-09-28T02:00:00Z", dailyAsOf: null,
  }), "unknown")
  assert.equal(classifyTwSession({
    now: Date.parse("2026-09-28T03:00:00Z"), regularStart: null, regularEnd: null,
    quotedAt: "2026-09-28T02:00:00Z", dailyAsOf: "2026-09-28",
  }), "unknown") // even a same-day quote plus a matching pulse is not "closed_with_daily" without bounds
})

test("after a confirmed close with a SAME-DAY quote, a matching stale pulse is read as still lagging, not caught up", () => {
  // Today's session (bounds) has definitely ended, and there IS a same-day
  // quote (unlike the holiday case below), so today's close counts as
  // confirmed evidence. A pulse still dated Friday must not be misread as
  // "caught up" just because it happens to equal the reference we'd get from
  // a stale quote -- here the quote itself is today's, so the reference is
  // today, and Friday's pulse is correctly still lagging.
  const sameDayQuoteAfterClose = classifyTwSession({
    now: Date.parse("2026-09-28T07:00:00Z"), regularStart: REGULAR_START, regularEnd: REGULAR_END,
    quotedAt: "2026-09-28T05:29:00Z", dailyAsOf: "2026-09-25",
  })
  assert.equal(sameDayQuoteAfterClose, "closed_before_daily")
  // The same same-day quote, but the pulse has genuinely caught up to today.
  assert.equal(classifyTwSession({
    now: Date.parse("2026-09-28T07:00:00Z"), regularStart: REGULAR_START, regularEnd: REGULAR_END,
    quotedAt: "2026-09-28T05:29:00Z", dailyAsOf: "2026-09-28",
  }), "closed_with_daily")
})

test("after a confirmed close WITHOUT a same-day quote, the reference never gets forced past the quote's own (stale) day", () => {
  // Without any same-day quote, `now >= end` is not treated as proof today
  // closed (that would be presuming a holiday's nominal bounds are a real
  // close). The reference stays the stale quote's own date, so a pulse
  // dated the same day as that stale quote reads as caught up to *that* day
  // -- not forced into "still behind today" the way the same-day-quote case
  // above is.
  assert.equal(classifyTwSession({
    now: Date.parse("2026-09-28T07:00:00Z"), regularStart: REGULAR_START, regularEnd: REGULAR_END,
    quotedAt: "2026-09-25T05:29:00Z", dailyAsOf: "2026-09-25",
  }), "closed_with_daily")
  assert.equal(classifyTwSession({
    now: Date.parse("2026-09-28T07:00:00Z"), regularStart: REGULAR_START, regularEnd: REGULAR_END,
    quotedAt: "2026-09-25T05:29:00Z", dailyAsOf: "2026-09-24",
  }), "closed_before_daily") // the pulse is even older than the stale quote's own day
})

test("a Taiwan holiday whose Yahoo bounds still read a normal session stays 'closed_with_daily' with the old label all afternoon, not just mid-session", () => {
  // 2026-09-28 is a holiday: bounds read 09:00-13:30 as usual, but the last
  // real TAIEX quote and pulse are both from 2026-09-24. This must hold
  // *past* the nominal close too (13:31, and later at 18:00) -- not only
  // while `now` still happens to sit inside the nominal bounds -- otherwise
  // the days-old quote becomes primary under "已收盤 · 日結資料尚未公布" the
  // moment the clock crosses the nominal end.
  for (const now of ["2026-09-28T05:31:00Z" /* 13:31 Taipei */, "2026-09-28T10:00:00Z" /* 18:00 Taipei */]) {
    const state = classifyTwSession({
      now: Date.parse(now), regularStart: REGULAR_START, regularEnd: REGULAR_END,
      quotedAt: "2026-09-24T05:30:00Z", dailyAsOf: "2026-09-24",
    })
    assert.equal(state, "closed_with_daily", `expected closed_with_daily at ${now}`)
    assert.equal(twSessionLabel(state, "2026-09-24T05:30:00Z", "2026-09-24"), "收盤 2026-09-24 · TWSE/TPEx 日結")
  }
})

test("a normal trading day at 13:31 with a same-day quote and yesterday's pulse is closed_before_daily, then closed_with_daily once the pulse catches up", () => {
  const at1331 = (dailyAsOf: string | null) => classifyTwSession({
    now: Date.parse("2026-09-28T05:31:00Z"), // 13:31 Taipei, one minute after the nominal close
    regularStart: REGULAR_START, regularEnd: REGULAR_END,
    quotedAt: "2026-09-28T05:30:30Z", // a genuine same-day quote, just at the close
    dailyAsOf,
  })
  assert.equal(at1331("2026-09-27"), "closed_before_daily") // yesterday's pulse, today's close not reflected yet
  assert.equal(at1331("2026-09-28"), "closed_with_daily") // pulse has caught up to today
})

test("a non-finite 'now' is never treated as evidence of a close", () => {
  // A caller bug (a bad Date.parse, an uninitialized tick, etc.) must not let
  // an indeterminate instant fall through to a confident "closed" state --
  // that could select the daily block, or the "已收盤" label, during an
  // actually-open session.
  for (const now of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.equal(classifyTwSession({
      now, regularStart: REGULAR_START, regularEnd: REGULAR_END,
      quotedAt: "2026-09-28T05:29:00Z", dailyAsOf: "2026-09-28",
    }), "unknown")
  }
})

test("labels match the owner's exact wording for each state", () => {
  assert.equal(twSessionLabel("open", "2026-09-28T03:15:00Z", null), "盤中 11:15 · Yahoo（有延遲）")
  assert.equal(twSessionLabel("open", null, null), "盤中 · Yahoo（有延遲）") // no quote timestamp -- degrade gracefully, still say "open"
  assert.equal(twSessionLabel("closed_with_daily", "2026-09-28T07:00:00Z", "2026-09-28"), "收盤 2026-09-28 · TWSE/TPEx 日結")
  assert.equal(twSessionLabel("closed_before_daily", "2026-09-28T07:00:00Z", "2026-09-25"), "已收盤 · 日結資料尚未公布")
  assert.equal(twSessionLabel("unknown", null, null), "時段未知")
})

test("primary-block selection never shows both, and unknown falls back to whichever data exists", () => {
  assert.equal(primaryTwBlock("open", true), "intraday")
  assert.equal(primaryTwBlock("closed_before_daily", true), "intraday")
  assert.equal(primaryTwBlock("closed_with_daily", true), "daily")
  assert.equal(primaryTwBlock("closed_with_daily", false), "daily") // pulse is primary even if, oddly, no quote either
  assert.equal(primaryTwBlock("unknown", true), "intraday") // some intraday data exists -- show it rather than a bare "unknown"
  assert.equal(primaryTwBlock("unknown", false), "daily") // nothing intraday -- fall back to the pulse if there is one
})

test("inside Yahoo's session bounds, a quote from an earlier day is not 'open' (exchange holiday)", () => {
  // 2026-09-28 was a Taiwan holiday: the bounds can still read 09:00-13:30,
  // but the last TAIEX quote is from 2026-09-24. Showing it as "盤中" would
  // label a four-day-old number as live.
  const holiday = classifyTwSession({
    now: Date.parse("2026-09-28T03:15:00Z"), regularStart: REGULAR_START, regularEnd: REGULAR_END,
    quotedAt: "2026-09-24T05:30:00Z", dailyAsOf: "2026-09-24",
  })
  assert.equal(holiday, "closed_with_daily")
  assert.equal(twSessionLabel(holiday, "2026-09-24T05:30:00Z", "2026-09-24"), "收盤 2026-09-24 · TWSE/TPEx 日結")
  assert.equal(primaryTwBlock(holiday, true), "daily")
  // Same shape before today's first quote arrives on a normal trading day:
  // yesterday's close-of-day stays primary until a same-day quote exists.
  assert.equal(classifyTwSession({
    now: Date.parse("2026-09-28T01:00:30Z"), regularStart: REGULAR_START, regularEnd: REGULAR_END,
    quotedAt: "2026-09-25T05:30:00Z", dailyAsOf: "2026-09-25",
  }), "closed_with_daily")
})

test("shouldPollTwPulse: closed_with_daily polls only for a same-day partial pulse before 18:00 Taipei", () => {
  // 14:02 Taipei on 2026-09-28, the coordinator's own reported case: TWSE is
  // out but TPEx is not, so the pulse is "partial" for today.
  const at1402 = Date.parse("2026-09-28T06:02:00Z")
  assert.equal(shouldPollTwPulse({
    sessionState: "closed_with_daily", pulseState: "partial", pulseAsOf: "2026-09-28", now: at1402,
  }), true)
  // Complete -- nothing left to wait for, regardless of time of day.
  assert.equal(shouldPollTwPulse({
    sessionState: "closed_with_daily", pulseState: "ready", pulseAsOf: "2026-09-28", now: at1402,
  }), false)
  // Partial, but for an earlier day -- not waiting on anything new today.
  assert.equal(shouldPollTwPulse({
    sessionState: "closed_with_daily", pulseState: "partial", pulseAsOf: "2026-09-25", now: at1402,
  }), false)
  // Partial and today, but past the 18:00 cutoff -- a still-missing source
  // is treated as final for the day rather than polled forever.
  assert.equal(shouldPollTwPulse({
    sessionState: "closed_with_daily", pulseState: "partial", pulseAsOf: "2026-09-28",
    now: Date.parse("2026-09-28T10:00:00Z") /* exactly 18:00 Taipei */,
  }), false)
  assert.equal(shouldPollTwPulse({
    sessionState: "closed_with_daily", pulseState: "partial", pulseAsOf: "2026-09-28",
    now: Date.parse("2026-09-28T09:59:00Z") /* 17:59 Taipei, one minute before the cutoff */,
  }), true)
  // "unavailable" is not complete either -- same treatment as "partial".
  assert.equal(shouldPollTwPulse({
    sessionState: "closed_with_daily", pulseState: "unavailable", pulseAsOf: "2026-09-28", now: at1402,
  }), true)
  // Missing as_of at all -- cannot confirm it covers today, so no polling.
  assert.equal(shouldPollTwPulse({
    sessionState: "closed_with_daily", pulseState: "partial", pulseAsOf: null, now: at1402,
  }), false)
})

test("shouldPollTwPulse: closed_before_daily always polls; open, unknown, and a non-finite clock never do", () => {
  assert.equal(shouldPollTwPulse({
    sessionState: "closed_before_daily", pulseState: undefined, pulseAsOf: null, now: Date.parse("2026-09-28T06:02:00Z"),
  }), true) // regardless of the pulse's own fields -- there is no pulse for today at all yet
  assert.equal(shouldPollTwPulse({
    sessionState: "open", pulseState: "partial", pulseAsOf: "2026-09-28", now: Date.parse("2026-09-28T02:00:00Z"),
  }), false)
  assert.equal(shouldPollTwPulse({
    sessionState: "unknown", pulseState: "partial", pulseAsOf: "2026-09-28", now: Date.parse("2026-09-28T06:02:00Z"),
  }), false)
  // Number.MAX_VALUE is finite but produces an Invalid Date -- must fail
  // safe (false), not throw from `.toISOString()` inside the function.
  for (const now of [Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_VALUE]) {
    assert.equal(shouldPollTwPulse({ sessionState: "closed_with_daily", pulseState: "partial", pulseAsOf: "2026-09-28", now }), false)
  }
})
