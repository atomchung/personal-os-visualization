/** Closed, browser-memory-only adapter. No network, storage, or live fallback. */
import { cockpit, createState, DATE, focus, goals, health, home, ideal, investment, investmentActions, investmentContext, investmentHistory, investmentHistorySources, leaders, market, marketExplore, momentum, pending, quote, STAMP, timeData, todos, universe, watch } from "./fixtures.ts"
import { investmentScenario } from "./generated/investment-scenario.ts"

export function createDemoRequest() {
  const state = createState()
  const reply = (data: unknown, status = 200) => Response.json(data, { status })
  const rejected = (detail: string, status = 422) => reply({ detail }, status)

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
        case "/api/investment/actions": return reply(investmentActions)
        case "/api/investment/explore": return reply(marketExplore)
        case "/api/investment/market": return reply(market)
        case "/api/investment/momentum/universe": return reply(universe)
        case "/api/investment/momentum/leaders": return reply(leaders)
        case "/api/investment/quote":
        case "/api/investment/momentum":
          if (url.searchParams.get("symbol") !== "DEMO") return rejected("只有 DEMO 合成標的可用。", 404)
          return reply(path.endsWith("quote") ? quote : momentum)
        case "/api/investment/watch": return reply(watch)
        case "/api/investment/history": return reply(investmentHistory)
        case "/api/investment/context": return reply(investmentContext)
        case "/api/investment/history/source": {
          const item = investmentHistorySources[url.searchParams.get("id") ?? ""]
          return item ? reply(item) : rejected("找不到這段合成歷史來源。", 404)
        }
        case "/api/investment/pending": return reply(pending)
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
      if (typeof body.text !== "string" || !body.text.trim() || body.text.length > 2000 || !["decision", "research"].includes(String(body.kind))) return rejected("請提供有效的範例工作。")
      const item = { id: `demo-work-${++state.sequence}`, kind: body.kind as "decision" | "research", text: body.text.trim(), source_id: String(body.source_id ?? ""), source_label: String(body.source_label ?? ""), status: "open" as const, conclusion: "", version: 1, updated_at: STAMP }
      state.investmentWork.push(item)
      return reply(item)
    }
    const workMatch = path.match(/^\/api\/investment\/work\/([^/]+)$/)
    if (method === "PATCH" && workMatch) {
      const item = state.investmentWork.find(w => w.id === decodeURIComponent(workMatch[1]))
      if (!item || body.version !== item.version) return rejected("範例工作版本已變更，請重新讀取。", 409)
      if (!["open", "watching", "done"].includes(String(body.status)) || !["decision", "research"].includes(String(body.kind)) || typeof body.conclusion !== "string") return rejected("請提供有效的工作狀態。")
      Object.assign(item, { status: body.status, kind: body.kind, conclusion: body.conclusion, version: item.version + 1 })
      return reply(item)
    }
    return rejected("此操作未提供示範，不會送到任何資料來源。", 404)
  }
}

export const demoRequest = createDemoRequest()
