import assert from "node:assert/strict"
import { test } from "node:test"
import { createDemoRequest } from "../src/demo/transport.ts"
import { investmentScenario } from "../src/demo/generated/investment-scenario.ts"
import { splitCatalyst } from "../src/lib/investmentDates.ts"
import { NAV_GROUPS, isTabKey } from "../src/lib/informationArchitecture.ts"

const write = (body: unknown, method = "POST") => ({ method, body: JSON.stringify(body) })

test("the shared information architecture keeps frequent entry points and domain ownership clear", () => {
  assert.equal(isTabKey("today"), true)
  assert.equal(isTabKey("guide"), true)
  assert.equal(isTabKey("not-a-page"), false)
  assert.deepEqual(NAV_GROUPS.map((group) => group.label), ["常用", "推進", "回看"])
  assert.deepEqual(NAV_GROUPS[0].items.map((item) => item.key), ["today", "investment"])
  assert.equal(NAV_GROUPS[0].items.every((item) => item.frequent === true), true)
})

test("every page runs with no network; unknown routes and real symbols fail closed", async () => {
  const original = globalThis.fetch
  globalThis.fetch = () => { throw new Error("Unexpected network request") }
  try {
    const request = createDemoRequest()
    for (const path of ["home", "cockpit", "focus", "time", "goals", "ideal", "health", "todos", "investment", "investment/market", "investment/watch", "investment/history", "investment/context", "investment/pending", "investment/work", "investment/momentum/universe", "investment/momentum/leaders", `investment/quote?symbol=${investmentScenario.symbol}`, `investment/momentum?symbol=${investmentScenario.symbol}`, `investment/source?id=${investmentScenario.source_id}`, `investment/history/source?id=${investmentScenario.history[0].id}`]) {
      const result = await request(`/api/${path}`)
      assert.equal(result.status, 200, path)
      assert.equal(typeof await result.json(), "object", path)
    }
    const leaders = await (await request("/api/investment/momentum/leaders")).json()
    assert.equal(leaders.leaders[0].return_20d_pct, 4.8)
    assert.equal(leaders.leaders[0].vs_20ma_pct, 2.6)
    for (const path of ["/api/not-implemented", "/api/investment/momentum?symbol=REAL", "/api/investment/source?id=private", "/api/investment/history/source?id=private", "http://localhost:8000/api/home", "https://example.com/api/home", "//localhost/api/home"]) assert.equal((await request(path)).status, 404, path)
    assert.equal((await request("/api/not-implemented", write({}))).status, 404)
  } finally { globalThis.fetch = original }
})

test("history and Context expose one coherent scenario with explicit unknown results", async () => {
  const request = createDemoRequest()
  const history = await (await request("/api/investment/history")).json()
  const context = await (await request("/api/investment/context")).json()
  assert.equal(history.items[0].date, "2026-09-13")
  assert.equal(history.items[0].result_state, "unknown")
  assert.equal(context.read_only, true)
  assert.equal(context.task.slug, investmentScenario.context.task_slug)
  assert.equal(context.current_state.next_action, investmentScenario.context.next_action)
  assert.equal(context.evidence[0].source.line_start, history.items[1].source.line_start)
})

test("registered event labels use source wording instead of a generic topic directory", () => {
  const event = splitCatalyst("2026-09-30 MU Q4 FY26（Micron IR 公告）— guidance 門檻首個檢查點")
  assert.equal(event.event, "MU Q4 FY26")
  assert.equal(event.verify, "guidance 門檻首個檢查點")
})

test("todo writes update the shared home projection and remain isolated per visitor", async () => {
  const request = createDemoRequest()
  const otherVisitor = createDemoRequest()
  const created = await (await request("/api/todos", write({ text: "Only in this browser", category: "輸出" }))).json()
  let home = await (await request("/api/home")).json()
  assert(home.todos.some((t: {id: string}) => t.id === created.id))
  await request(`/api/todos/${created.id}/toggle`, write({ done: true }))
  home = await (await request("/api/home")).json()
  assert(!home.todos.some((t: {id: string}) => t.id === created.id))
  const items = await (await request("/api/todos")).json()
  assert.equal(items.done_count, 2)
  assert.equal((await (await otherVisitor("/api/todos")).json()).done_count, 1)
  await request(`/api/todos/${created.id}`, { method: "DELETE" })
  assert.equal((await request(`/api/todos/${created.id}/toggle`, write({ done: false }))).status, 409)
})

test("milestones, feedback, and nominations preserve their shared projections", async () => {
  const request = createDemoRequest()
  await request("/api/goals/demo-build/milestones/1", write({ done: true }))
  const goals = await (await request("/api/goals")).json()
  assert.equal(goals.groups[0].done_milestones, 2)
  assert.equal((await (await request("/api/todos")).json()).month_milestones[1].done, true)
  await request("/api/cockpit/feedback", write({ task_slug: "demo-paper-plane", verdict: "accept" }))
  let home = await (await request("/api/home")).json()
  assert.equal(home.cockpit.suggestions[0].human_verdict, "accept")
  const expected_text = home.threads.items[0].nomination
  assert.equal((await request("/api/nominations/demo-paper-plane/accept", write({ expected_text: "stale" }))).status, 409)
  await request("/api/nominations/demo-paper-plane/accept", write({ expected_text }))
  home = await (await request("/api/home")).json()
  assert.equal(home.threads.items[0].next_action, expected_text)
  assert.equal(home.threads.pending_nominations, 0)
})

test("investment writes honor versions; malformed and cancelled requests are visible", async () => {
  const request = createDemoRequest()
  const item = await (await request("/api/investment/work", write({ kind: "research", text: "Synthetic question" }))).json()
  const update = { version: 1, status: "done", kind: "research", conclusion: "Example result" }
  assert.equal((await request(`/api/investment/work/${item.id}`, write(update, "PATCH"))).status, 200)
  assert.equal((await request(`/api/investment/work/${item.id}`, write(update, "PATCH"))).status, 409)
  assert.equal((await request("/api/todos", { method: "POST", body: "invalid" })).status, 422)
  assert.equal((await request("/api/todos", write({ text: "" }))).status, 422)
  assert.equal((await request("/api/goals/demo-build/milestones/1", write({ done: "true" }))).status, 422)
  await assert.rejects(request("/api/home", { signal: AbortSignal.abort() }), { name: "AbortError" })
})
