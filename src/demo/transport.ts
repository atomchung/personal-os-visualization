/** Closed, browser-memory-only adapter. No network, storage, or live fallback. */
import { cockpit, createState, focus, goals, health, home, ideal, timeData, todos, work, workForAgent } from "./fixtures.ts"
import { taipeiCalendarToday } from "../lib/investmentFormat.ts"
import {
  addInvestmentWork,
  getInvestment,
  getInvestmentCapability,
  getInvestmentActions,
  getInvestmentContext,
  getInvestmentHistory,
  getInvestmentHistorySource,
  getInvestmentMarket,
  getInvestmentNarrative,
  getInvestmentPending,
  getInvestmentResearch,
  getInvestmentResearchDetail,
  getInvestmentSource,
  getInvestmentWatch,
  getInvestmentWork,
  getMarketExplore,
  getMomentumLeaders,
  getMomentumUniverse,
  getStockMomentum,
  getStockQuote,
  getTwRelativeStrength,
  saveInvestmentWork,
  getInvestmentPulse,
  setInvestmentProvider,
  type InvestmentWork,
} from "../lib/investment.ts"
import { demoInvestmentProvider } from "./investmentProvider.ts"

// Each demo transport uses its own memory-only provider instance/state.
setInvestmentProvider(demoInvestmentProvider)

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function resolveWatchExpiry(raw: unknown): string | null {
  const value = typeof raw === "string" && raw.trim() ? raw.trim() : addDays(taipeiCalendarToday(), 7)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = Date.parse(`${value}T00:00:00Z`)
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) return null
  return value
}

export function createDemoRequest() {
  const state = createState()
  const reply = (data: unknown, status = 200) => Response.json(data, { status })
  const rejected = (detail: string, status = 422) => reply({ detail }, status)
  const read = async (handler: () => Promise<unknown>) => {
    try { return reply(await handler()) }
    catch (error) {
      const message = error instanceof Error ? error.message : "Investment 資料尚未提供。"
      return rejected(message.replace(/^NOT_FOUND: /, ""), message.startsWith("NOT_FOUND: ") ? 404 : 503)
    }
  }
  const assertCapability = (capability: Parameters<typeof getInvestmentCapability>[0]) => {
    const declared = getInvestmentCapability(capability)
    if (declared.status === "unavailable") throw new Error(declared.limitations.join(" ") || `${capability} unavailable`)
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
        case "/api/work": {
          if (!url.searchParams.has("agent")) return reply(work)
          const filtered = workForAgent(url.searchParams.get("agent") ?? "")
          return filtered ? reply(filtered) : rejected("agent must be declared")
        }
        case "/api/goals": return reply(goals(state))
        case "/api/focus": return reply(focus(Number(url.searchParams.get("days")) || 7))
        case "/api/time": {
          const period = url.searchParams.get("period") ?? "week"
          if (!["week", "last_week", "4w"].includes(period)) return rejected("不支援的展示期間。")
          return reply(timeData(period as "week" | "last_week" | "4w"))
        }
        case "/api/ideal": return reply(ideal)
        case "/api/health": return reply(health)
        case "/api/investment": return read(() => getInvestment())
        case "/api/investment/narrative": return read(() => { assertCapability("judgment"); return getInvestmentNarrative() })
        case "/api/investment/actions": return read(() => { assertCapability("actions"); return getInvestmentActions() })
        case "/api/investment/explore": return read(() => { assertCapability("market"); return getMarketExplore() })
        case "/api/investment/market": return read(() => { assertCapability("market"); return getInvestmentMarket() })
        case "/api/investment/pulse": return read(() => { assertCapability("market"); return getInvestmentPulse() })
        case "/api/investment/tw-relative-strength": return read(() => { assertCapability("market"); return getTwRelativeStrength() })
        case "/api/investment/momentum/universe": return read(() => { assertCapability("market"); return getMomentumUniverse() })
        case "/api/investment/momentum/leaders": return read(() => { assertCapability("market"); return getMomentumLeaders() })
        case "/api/investment/quote":
        case "/api/investment/momentum":
          if (url.searchParams.get("symbol") !== "DEMO") return rejected("只有 DEMO 合成標的可用。", 404)
          return read(() => { assertCapability(path.endsWith("quote") ? "quote" : "market"); return path.endsWith("quote") ? getStockQuote("DEMO") : getStockMomentum("DEMO") })
        case "/api/investment/research": return read(() => { assertCapability("research"); return getInvestmentResearch() })
        case "/api/investment/research/detail": {
          const id=url.searchParams.get("id") ?? ""
          return read(async () => {
            assertCapability("research")
            const detail = await getInvestmentResearchDetail(id)
            if (!detail.research.item) throw new Error("NOT_FOUND: 找不到這段合成 Research 來源。")
            return detail
          })
        }
        case "/api/investment/watch/read-model": return read(() => { assertCapability("watch"); return getInvestmentWatch() })
        case "/api/investment/history": return read(() => { assertCapability("history"); return getInvestmentHistory() })
        case "/api/investment/context": return read(() => getInvestmentContext())
        case "/api/investment/history/source": {
          const id=url.searchParams.get("id") ?? ""
          return read(async () => {
            assertCapability("history")
            const detail = await getInvestmentHistorySource(id)
            if (!detail.history.item) throw new Error("NOT_FOUND: 找不到這段合成歷史來源。")
            return detail
          })
        }
        case "/api/investment/pending/read-model": return read(() => { assertCapability("pending"); return getInvestmentPending() })
        case "/api/investment/work": return read(() => getInvestmentWork())
        case "/api/investment/source":
          return read(() => getInvestmentSource(url.searchParams.get("id") ?? ""))
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
      if (typeof body.text !== "string" || !body.text.trim() || body.text.length > 500 || !["decision", "research", "watch"].includes(String(body.kind))) return rejected("請提供有效的範例工作。")
      const kind = body.kind as "decision" | "research" | "watch"
      const expires_on = kind === "watch" ? resolveWatchExpiry(typeof body.expires_on === "string" ? body.expires_on.trim() : "") : ""
      if (expires_on === null) return rejected("到期日格式應為 YYYY-MM-DD。")
      const text = body.text.trim()
      const source_id = String(body.source_id ?? "")
      return read(() => addInvestmentWork({kind, text, source_id, source_label: String(body.source_label ?? ""), ...(kind === "watch" ? {expires_on: expires_on!} : {})}))
    }
    const workMatch = path.match(/^\/api\/investment\/work\/([^/]+)$/)
    if (method === "PATCH" && workMatch) {
      const currentItems = (await getInvestmentWork()).items
      const item = currentItems.find(w => w.id === decodeURIComponent(workMatch[1]))
      if (!item || body.version !== item.version) return rejected("範例工作版本已變更，請重新讀取。", 409)
      if (!["open", "watching", "done"].includes(String(body.status)) || !["decision", "research", "watch"].includes(String(body.kind)) || typeof body.conclusion !== "string") return rejected("請提供有效的工作狀態。")
      if ((item.kind === "watch") !== (body.kind === "watch")) return rejected("注意事項和其他事項不能互換類型。")
      const hasPromotion = Object.prototype.hasOwnProperty.call(body, "promoted_to_today")
      if (hasPromotion && (item.kind !== "watch" || typeof body.promoted_to_today !== "boolean")) return rejected("只有個人提醒可以明確加入今日。")
      const updated: InvestmentWork = {...item, status: body.status as InvestmentWork["status"], kind: body.kind as InvestmentWork["kind"], conclusion: body.conclusion as string}
      if (hasPromotion) updated.promoted_to_today = body.promoted_to_today as boolean
      return read(() => saveInvestmentWork(updated))
    }
    return rejected("此操作未提供示範，不會送到任何資料來源。", 404)
  }
}

export const demoRequest = createDemoRequest()
