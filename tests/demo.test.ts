import assert from "node:assert/strict"
import { test } from "node:test"
import { createDemoRequest } from "../src/demo/transport.ts"
import { briefOverviewActions, isBriefEventReference } from "../src/lib/investmentBriefPresentation.ts"

const write = (body: unknown, method = "POST") => ({ method, body: JSON.stringify(body) })

test("every page runs with no network; unknown routes and real symbols fail closed", async () => {
  const original = globalThis.fetch
  globalThis.fetch = () => { throw new Error("Unexpected network request") }
  try {
    const request = createDemoRequest()
    for (const path of ["home", "cockpit", "focus", "time", "goals", "ideal", "health", "todos", "investment", "investment/market", "investment/watch", "investment/pending", "investment/work", "investment/momentum/universe", "investment/quote?symbol=DEMO", "investment/momentum?symbol=DEMO", "investment/source?id=demo-brief"]) {
      const result = await request(`/api/${path}`)
      assert.equal(result.status, 200, path)
      assert.equal(typeof await result.json(), "object", path)
    }
    for (const path of ["/api/not-implemented", "/api/investment/momentum?symbol=REAL", "/api/investment/source?id=private", "http://localhost:8000/api/home", "https://example.com/api/home", "//localhost/api/home"]) assert.equal((await request(path)).status, 404, path)
    assert.equal((await request("/api/not-implemented", write({}))).status, 404)
  } finally { globalThis.fetch = original }
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

test("overview removes exact repetitions but does not rewrite source strings", () => {
  const actions = ["維持觀察。", "維持觀察。", "  下次確認交付量。  ", "下次確認交付量。"]
  assert.deepEqual(briefOverviewActions(actions, "維持觀察。"), ["  下次確認交付量。  "])
  assert.equal(actions.length, 4)
})

test("only pure no-change labels and blank actions are omitted", () => {
  assert.deepEqual(briefOverviewActions(["沒有新資訊。", "不重複升級", " ", "沒有新資訊，但交付風險尚未解除。", "先不動，原判斷仍成立。"], ""), ["沒有新資訊，但交付風險尚未解除。", "先不動，原判斷仍成立。"])
})

test("opposing judgments, different numbers, and uncertainty survive", () => {
  const actions = ["成長 5%。", "成長 0.5%。", "維持原判斷。", "不維持原判斷。", "來源過期，尚未確認。"]
  assert.deepEqual(briefOverviewActions(actions, "今日觀察。"), actions)
})

test("whitespace-equivalent overview text appears only once", () => {
  assert.deepEqual(briefOverviewActions(["先看\n交付量", "先看 交付量", "再看成本"], "先看 交付量"), ["再看成本"])
})

test("unresolved event references cannot silently disappear", () => {
  for (const index of [null, undefined, -1, 2, 0.5, NaN, Infinity]) assert.equal(isBriefEventReference(index, 2), false)
  assert.equal(isBriefEventReference(0, 0), false)
  assert.equal(isBriefEventReference(0, 2), true)
  assert.equal(isBriefEventReference(1, 2), true)
})
