/** Closed, browser-memory-only adapter. No network, storage, or live fallback. */
import { cockpit, createState, DATE, focus, goals, health, home, ideal, investment, investmentActions, investmentContext, investmentHistory, investmentHistorySources, investmentNarrative, investmentResearch, leaders, market, marketExplore, momentum, pending, pulse, quote, relativeStrength, STAMP, timeData, todos, twRelativeStrength, universe, watch } from "./extended-ui.ts"
import { investmentScenario } from "../../src/demo/generated/investment-scenario.ts"

export function createDemoRequest() {
  const state = createState()
  const refreshState = {
    market: { action: "market", state: "idle", started_at: null as string | null, last_updated: null as string | null, message: "尚未執行這個更新。", error: null as string | null, discovery_state: "idle", discovery_updated_at: null as string | null, trigger: null as string | null, new_update_count: null as number | null, scan_mode: null as "quick" | "deep" | null, market_scope: null as "tw" | "us" | null, duration_seconds: null as number | null, provider_elapsed_seconds: null as number | null },
    news: { action: "news", state: "idle", started_at: null as string | null, last_updated: null as string | null, message: "尚未執行這個更新。", error: null as string | null, discovery_state: "idle", discovery_updated_at: null as string | null, trigger: null as string | null, new_update_count: null as number | null, scan_mode: null as "quick" | "deep" | null, market_scope: null as "tw" | "us" | null, duration_seconds: null as number | null, provider_elapsed_seconds: null as number | null },
  }
  const now = () => new Date().toISOString()
  const runDemoRefresh = (action: "market" | "news", market?: "tw" | "us") => {
    const current = refreshState[action]
    const stamp = now()
    Object.assign(current, {
      state: "running", started_at: stamp, last_updated: stamp, message: action === "market" ? "正在刷新合成盤面。" : `正在掃描合成${market === "us" ? "美股" : "台股"}消息。`, error: null,
      discovery_state: action === "market" ? "running" : "idle", discovery_updated_at: null, new_update_count: null,
      scan_mode: action === "news" ? "quick" : null, market_scope: action === "news" ? market ?? "tw" : null,
      duration_seconds: null, provider_elapsed_seconds: null,
    })
    globalThis.setTimeout(() => {
      const completed = now()
      Object.assign(current, action === "market"
        ? { state: "success", last_updated: completed, message: "盤面、行情與市場脈搏已更新。", discovery_state: "ready", discovery_updated_at: completed }
        // provider/model/fallback_depth/provider_errors mirror the real
        // producer's shape so the demo build exercises the plain-language
        // status copy and the "今天發生了什麼" scan-header note end to end.
        : { state: "no-change", last_updated: completed, message: "掃描完成，無影響當前判斷的新消息。", new_update_count: 0, provider: "claude", model: "opus[1m]", fallback_depth: 1, provider_errors: { codex: "timeout: timeout after 75s" } })
    }, 350)
    return current
  }
  const reply = (data: unknown, status = 200) => Response.json(data, { status })
  const rejected = (detail: string, status = 422) => reply({ detail }, status)
  // Mirrors core/store.py's date handling for kind "watch": a blank expiry
  // defaults to a week out from the demo's fixed "today" (DATE), and an
  // unparsable one is rejected rather than silently stored.
  const addDaysIso = (iso: string, days: number) => {
    const d = new Date(`${iso}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
  }
  const resolveWatchExpiry = (raw: string): string | null => {
    if (!raw) return addDaysIso(DATE, 7)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
    // Round-trip rejects dates JS would roll over (2026-02-30 -> 03-02),
    // matching Python's date.fromisoformat.
    const parsed = new Date(`${raw}T00:00:00Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw ? raw : null
  }

  return async (input: string, init: RequestInit = {}): Promise<Response> => {
    if (init.signal?.aborted) throw new DOMException("Request aborted", "AbortError")
    // Only relative API paths are accepted; absolute URLs never reach a server.
    if (!input.startsWith("/api/") || input.startsWith("//")) return rejected("展示版只提供合成資料。", 404)
    const url = new URL(input, "https://demo.invalid")
    const path = url.pathname
    const method = (init.method ?? "GET").toUpperCase()
    if (method === "GET") {
      switch (path) {
        case "/api/home": return reply(home(state))
        case "/api/cockpit": return reply(cockpit(state))
        case "/api/todos": return reply(todos(state))
        case "/api/goals": return reply(goals(state))
        case "/api/focus": return reply(focus(Number(url.searchParams.get("days")) || 7))
        case "/api/time": {
          const period = url.searchParams.get("period") ?? "week"
          if (!["week", "last_week", "4w"].includes(period)) return rejected("不支援的展示期間。")
          return reply(timeData(period as "week" | "last_week" | "4w"))
        }
        case "/api/ideal": return reply(ideal)
        case "/api/health": return reply(health)
        case "/api/investment": return reply(investment)
        case "/api/investment/narrative": return reply(investmentNarrative)
        case "/api/investment/actions": return reply(investmentActions)
        case "/api/investment/explore": return reply(marketExplore)
        case "/api/investment/market": return reply(market)
        case "/api/investment/pulse": return reply(pulse)
        case "/api/investment/refresh/status": {
          const action = url.searchParams.get("action")
          if (action !== "market" && action !== "news") return rejected("不支援的更新操作。")
          return reply(refreshState[action])
        }
        case "/api/investment/momentum/universe": return reply(universe)
        case "/api/investment/momentum/leaders": return reply(leaders)
        case "/api/investment/momentum/relative-strength": return reply(relativeStrength)
        case "/api/investment/tw-relative-strength": return reply(twRelativeStrength)
        case "/api/investment/quote":
        case "/api/investment/momentum":
          if (url.searchParams.get("symbol") !== "DEMO") return rejected("只有 DEMO 合成標的可用。", 404)
          return reply(path.endsWith("quote") ? quote : momentum)
        case "/api/investment/watch": return reply({ as_of: watch.generated_at, ...watch.watch })
        case "/api/investment/watch/read-model": return reply(watch)
        case "/api/investment/research": return reply(investmentResearch)
        case "/api/investment/research/detail": {
          const item = investmentResearch.research.items.find(row => row.id === url.searchParams.get("id"))
          if (!item) return rejected("找不到這份合成 Research。", 404)
          return reply({
            schema_version: "1.0", artifact: "investment-research-detail",
            id: `research-detail:${item.id}`, as_of: "unknown",
            generated_at: STAMP, source_cutoff: "unknown", producer: "synthetic-demo",
            state: "partial", limitations: ["僅供合成範例展示"],
            sources: [item.source.path],
            research: { item, detail: { text: `${investmentScenario.source_text}\n\n此文字為合成案例。`, what: item.question ?? undefined } },
          })
        }
        case "/api/investment/history": return reply(investmentHistory)
        case "/api/investment/context": return reply(investmentContext)
        case "/api/investment/history/source": {
          const item = investmentHistorySources[url.searchParams.get("id") ?? ""]
          return item ? reply(item) : rejected("找不到這段合成歷史來源。", 404)
        }
        case "/api/investment/pending": return reply({ as_of: pending.generated_at, ...pending.pending })
        case "/api/investment/pending/read-model": return reply(pending)
        case "/api/investment/work": return reply({ items: state.investmentWork })
        case "/api/investment/source":
          if (url.searchParams.get("id") !== investmentScenario.source_id) return rejected("找不到這份合成來源。", 404)
          return reply({ title: investmentScenario.source_title, date: DATE, text: `${investmentScenario.source_text}\n\n此文字由私人端的情境規格重新生成，未取自任何私人筆記、帳戶或市場來源。` })
        default: return rejected("此資料尚未加入展示版。", 404)
      }
    }

    let body: Record<string, unknown> = {}
    try {
      const parsed = init.body === undefined ? {} : JSON.parse(String(init.body))
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return rejected("請提供有效的操作內容。")
      body = parsed
    } catch { return rejected("操作內容格式錯誤。") }

    if (method === "POST" && path === "/api/todos") {
      if (typeof body.text !== "string" || !body.text.trim() || body.text.length > 500) return rejected("請填寫 1–500 字的待辦。")
      const category = String(body.category ?? "其他")
      if (!["輸出", "投資", "學習", "其他"].includes(category)) return rejected("不支援的分類。")
      const id = `demo-todo-${++state.sequence}`
      const goal_id = body.goal_id === "demo-build" ? "demo-build" : ""
      state.todos.push({ id, text: body.text.trim(), category, done: false, due: String(body.due ?? ""), goal_id, goal_title: goal_id ? "完成紙飛機筆記原型" : "" })
      return reply({ id })
    }
    if (method === "POST" && path === "/api/investment/refresh") {
      if (body.action !== "market" && body.action !== "news") return rejected("不支援的更新操作。")
      if (body.market !== undefined && body.market !== "tw" && body.market !== "us") return rejected("不支援的市場範圍。")
      if (body.action === "market" && body.market !== undefined) return rejected("市場範圍只能用於消息掃描。")
      return reply(runDemoRefresh(body.action, body.market as "tw" | "us" | undefined))
    }
    if (method === "POST" && path === "/api/todos/archive") return reply({ archived: 0 })
    const todoMatch = path.match(/^\/api\/todos\/([^/]+)(\/toggle)?$/)
    if (todoMatch && ((method === "DELETE" && !todoMatch[2]) || (method === "POST" && todoMatch[2]))) {
      const index = state.todos.findIndex(t => t.id === decodeURIComponent(todoMatch[1]))
      if (index < 0) return rejected("這項待辦已不存在，請重新整理。", 409)
      if (method === "DELETE") return reply({ id: state.todos.splice(index, 1)[0].id })
      if (typeof body.done !== "boolean") return rejected("請提供完成狀態。")
      state.todos[index].done = body.done
      return reply({ id: state.todos[index].id, done: body.done })
    }
    const milestone = path.match(/^\/api\/goals\/demo-build\/milestones\/([01])$/)
    if (method === "POST" && milestone) {
      if (typeof body.done !== "boolean") return rejected("請提供完成狀態。")
      state.milestones[Number(milestone[1])] = body.done
      return reply({ done: body.done })
    }
    if (method === "POST" && path === "/api/cockpit/feedback") {
      if (body.task_slug !== "demo-paper-plane") return rejected("找不到這項範例工作。", 409)
      if (!["accept", "not_now", "wrong_context", "clear"].includes(String(body.verdict))) return rejected("不支援的判斷。")
      state.verdict = body.verdict === "clear" ? "" : body.verdict as typeof state.verdict
      return reply(cockpit(state))
    }
    if (method === "POST" && ["/api/nominations/demo-paper-plane/accept", "/api/nominations/demo-paper-plane/skip"].includes(path)) {
      if (!state.nomination || body.expected_text !== state.nomination) return rejected("範例提名已改變，請重新讀取。", 409)
      if (path.endsWith("accept")) state.nextAction = typeof body.text === "string" && body.text.trim() ? body.text.trim() : state.nomination
      state.nomination = ""
      return reply({ slug: "demo-paper-plane", next_action: state.nextAction })
    }
    if (method === "POST" && path === "/api/investment/work") {
      if (typeof body.text !== "string" || !body.text.trim() || Array.from(body.text).length > 500 || !["decision", "research", "watch"].includes(String(body.kind))) return rejected("請提供有效的範例工作。")
      const kind = body.kind as "decision" | "research" | "watch"
      let expires_on = ""
      if (kind === "watch") {
        const resolved = resolveWatchExpiry(typeof body.expires_on === "string" ? body.expires_on.trim() : "")
        if (resolved === null) return rejected("到期日格式應為 YYYY-MM-DD。")
        expires_on = resolved
      }
      const text = body.text.trim()
      const source_id = String(body.source_id ?? "")
      // Same retry rule as core/store.py _is_retry.
      const existing = state.investmentWork.find(w => w.kind === kind && w.text === text && w.source_id === source_id
        && (kind !== "watch" || ((w.expires_on ?? "") === expires_on && w.status !== "done")))
      if (existing) return reply(existing)
      const item = { id: `demo-work-${++state.sequence}`, kind, text, source_id, source_label: String(body.source_label ?? ""), status: "open" as const, conclusion: "", expires_on, ...(kind === "watch" ? { promoted_to_today: false } : {}), version: 1, updated_at: STAMP }
      state.investmentWork.push(item)
      return reply(item)
    }
    const workMatch = path.match(/^\/api\/investment\/work\/([^/]+)$/)
    if (method === "PATCH" && workMatch) {
      const item = state.investmentWork.find(w => w.id === decodeURIComponent(workMatch[1]))
      if (!item || body.version !== item.version) return rejected("範例工作版本已變更，請重新讀取。", 409)
      if (!["open", "watching", "done"].includes(String(body.status)) || !["decision", "research", "watch"].includes(String(body.kind)) || typeof body.conclusion !== "string" || (body.promoted_to_today !== undefined && typeof body.promoted_to_today !== "boolean")) return rejected("請提供有效的工作狀態。")
      if ((item.kind === "watch") !== (body.kind === "watch")) return rejected("注意事項和其他事項不能互換類型。")
      if (body.promoted_to_today !== undefined && item.kind !== "watch") return rejected("只有個人提醒可加入今日。")
      // expires_on is intentionally left out of this Object.assign -- a
      // resolution (status/conclusion/kind) never edits a watch note's deadline.
      Object.assign(item, { status: body.status, kind: body.kind, conclusion: body.conclusion, version: item.version + 1 })
      if (item.kind === "watch") item.promoted_to_today = typeof body.promoted_to_today === "boolean" ? body.promoted_to_today : item.promoted_to_today === true
      return reply(item)
    }
    return rejected("此操作未提供示範，不會送到任何資料來源。", 404)
  }
}

export const demoRequest = createDemoRequest()
