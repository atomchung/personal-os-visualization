export type TabKey =
  | "today"
  | "investment"
  | "focus"
  | "time"
  | "goals"
  | "ideal"
  | "health"
  | "todos"
  | "guide"

export type PageKey = Exclude<TabKey, "guide" | "today">

export type NavItem = {
  key: TabKey
  label: string
  short: string
  frequent?: boolean
}

export type NavGroup = {
  id: "common" | "progress" | "review"
  label: string
  items: NavItem[]
}

/**
 * The app-wide information architecture. Keep this as the only place where
 * page order, parent groups, and navigation labels are maintained.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "common",
    label: "常用",
    items: [
      { key: "today", label: "今日", short: "現況與下一步", frequent: true },
      { key: "investment", label: "投資", short: "今日研究與回看", frequent: true },
    ],
  },
  {
    id: "progress",
    label: "推進",
    items: [
      { key: "focus", label: "焦點", short: "時間與目標" },
      { key: "goals", label: "目標", short: "進度與里程碑" },
      { key: "todos", label: "待辦", short: "可直接完成的事" },
    ],
  },
  {
    id: "review",
    label: "回看",
    items: [
      { key: "health", label: "運動", short: "訓練與恢復" },
      { key: "time", label: "AI 使用", short: "投入與產出" },
      { key: "ideal", label: "想法池", short: "探索中的問題" },
    ],
  },
]

/** The reading path is flat; the parent groups above remain documentation and guide metadata. */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items)

export const PAGE_COPY: Record<"today" | PageKey | "guide", { label: string; summary: string }> = {
  today: {
    label: "今日",
    summary: "先看現在的狀態與下一步；完整內容回到各自的工作頁。",
  },
  investment: {
    label: "投資",
    summary: "Investment Note 維護投資正本；今日、判斷、研究與復盤在此唯讀呈現。個人筆記另存在 PersonalOS，不改寫正式判斷。",
  },
  focus: {
    label: "焦點",
    summary: "把時間投入與目標放在同一張圖上，找出正在前進與落空的地方。",
  },
  goals: {
    label: "目標",
    summary: "看目標進度與里程碑；目標的完整內容只在這裡維護。",
  },
  todos: {
    label: "待辦",
    summary: "處理可以直接勾掉的短事項；里程碑仍由目標頁維護。",
  },
  health: {
    label: "運動",
    summary: "看訓練、恢復與身體指標；資料缺口會另外標出。",
  },
  time: {
    label: "AI 使用",
    summary: "回看這段時間把 AI 用在哪裡，並標出哪些數字還不完整。",
  },
  ideal: {
    label: "想法池",
    summary: "整理仍在探索的問題與下一個最便宜的測試。",
  },
  guide: {
    label: "介面規範",
    summary: "一套層級、文案與資料問題分流，讓每個頁面讀法一致。",
  },
}

export function isTabKey(value: string | null): value is TabKey {
  return value !== null && [
    "today",
    "investment",
    "focus",
    "time",
    "goals",
    "ideal",
    "health",
    "todos",
    "guide",
  ].includes(value)
}

/** Keep internal telemetry labels out of the primary reading path. */
export function humanizeSystemLabel(value: string) {
  return value
    .replace(/\bAI Agent\b/gi, "AI 工具")
    .replace(/\bAgent\b/gi, "工具")
    .replace(/\bSessions?\b/gi, "工作紀錄")
    .replace(/輸出\s*token/gi, "文字產出")
    .replace(/\bOutput(?: tokens?)?\b/gi, "文字產出")
    .replace(/\bCommits?\b/gi, "變更")
}
