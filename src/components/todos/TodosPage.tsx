import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  addTodo,
  archiveTodos,
  deleteTodo,
  getTodos,
  getWork,
  toggleTodo,
  type WorkAgent,
  type WorkData,
  type WorkLink,
  type WorkRun,
  type WorkState,
  type WorkTaskSummary,
} from "@/lib/api"
import { useWrite, writeErrorText } from "@/lib/writes"
import { Card, SectionHeading } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Chip } from "@/components/ui/chip"
import { Disclosure } from "@/components/ui/disclosure"
import { PageHeader } from "@/components/ui/page-header"
import { sourceTimestamp } from "@/lib/investmentFormat"

const WORK_STATE: Record<WorkState, { label: string; tone: "ok" | "warn" | "bad" | "info" | "accent" | "mute" }> = {
  open: { label: "待開始", tone: "info" },
  in_progress: { label: "進行中", tone: "accent" },
  awaiting_verification: { label: "等待驗證", tone: "warn" },
  done: { label: "已完成", tone: "ok" },
  paused: { label: "已暫停", tone: "mute" },
  archived: { label: "已封存", tone: "mute" },
  unknown: { label: "狀態未知", tone: "warn" },
}

const COMPLETION_STAGE = {
  implementation: { label: "完成實作", tone: "info" as const, detail: "這只記錄實作階段，不代表已交付或驗收。" },
  delivered: { label: "已交付", tone: "warn" as const, detail: "已交付不代表使用者已確認。" },
  user_verified: { label: "使用者已確認", tone: "ok" as const, detail: "完成階段記錄為使用者已確認；來源驗證時間與依據另列。" },
  unknown: { label: "完成證據未知", tone: "warn" as const, detail: "來源沒有可確認的完成階段。" },
}
const RUN_STATE: Record<WorkRun["state"], string> = {
  queued: "排隊中",
  running: "執行中",
  completed: "已完成",
  failed: "失敗",
  interrupted: "已中斷",
  unknown: "狀態未知",
}

type WorkGroup = "needs_user" | "in_progress" | "awaiting_verification" | "open" | "done" | "paused" | "unknown" | "archived"

function workGroup(task: WorkTaskSummary): WorkGroup {
  if (task.needs_user_action) return "needs_user"
  if (task.state === "in_progress") return "in_progress"
  if (task.state === "awaiting_verification") return "awaiting_verification"
  if (task.state === "open") return "open"
  if (task.state === "done") return "done"
  if (task.state === "paused") return "paused"
  if (task.state === "archived") return "archived"
  return "unknown"
}

function knownAgent(run: WorkRun, agents: WorkAgent[]) {
  if (run.agent_state !== "known" || !run.agent_id) return null
  return agents.find((agent) => agent.id === run.agent_id) ?? null
}

function trustedHref(link: WorkLink): string | null {
  if (link.state !== "supported" || !link.url) return null
  const url = link.url.trim()
  if (link.kind === "agent_task") {
    return /^codex:\/\/threads\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(url) ? url : null
  }
  if (link.kind === "pull_request" && /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/\d+\/?$/.test(url)) return url
  if (link.kind === "issue" && /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/issues\/\d+\/?$/.test(url)) return url
  if (link.kind === "source" && /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/(?:blob|tree|commit)\/[A-Za-z0-9._/-]+$/.test(url)) return url
  return null
}

function LinkList({ links }: { links: WorkLink[] }) {
  if (links.length === 0) return null
  const visibleLinks = links.map((link) => {
    const href = trustedHref(link)
    return { link, href }
  })
  return <ul className="flex flex-wrap gap-x-3 gap-y-1 text-caption">
    {visibleLinks.map(({ link, href }, index) => (
      <li key={`${link.kind}-${index}`}>
        {href ? <a className="text-info underline underline-offset-2" href={href} target={href.startsWith("https:") ? "_blank" : undefined} rel={href.startsWith("https:") ? "noreferrer" : undefined}>
          {link.label || "開啟已記錄連結"}
        </a> : <span className="text-ink-3">{link.label || "來源連結"} · {link.state === "invalid" ? "連結格式未通過驗證" : link.state === "unsupported" ? "此類連結不在這裡開啟" : "來源沒有提供可開啟網址"}</span>}
      </li>
    ))}
  </ul>
}

function actorLabel(task: WorkTaskSummary, agents: WorkAgent[]) {
  if (task.next_actor_state === "unknown") return "執行者未知"
  if (task.next_actor_state === "unassigned" || !task.next_actor) return "未提供"
  if (task.next_actor === "human") return "你"
  if (task.next_actor === "agent" || task.next_actor === "any_agent") return "任一工具"
  if (task.next_actor === "external") return "外部工具或來源"
  return agents.find((agent) => agent.id === task.next_actor)?.label ?? "執行者未知"
}

function WorkRuns({ task, agents }: { task: WorkTaskSummary; agents: WorkAgent[] }) {
  if (task.agent_runs.length === 0 && task.relations_state === "recorded") return null
  const linked = task.agent_runs.filter((run) => knownAgent(run, agents) !== null)
  const unlinked = task.agent_runs.filter((run) => knownAgent(run, agents) === null)
  const relationNote = task.relations_state === "unknown"
    ? "工具關聯未記錄或無法確認；沒有依文字猜測工具。"
    : task.relations_state === "partial"
      ? "部分工具關聯無法確認；沒有依文字猜測工具。"
      : ""

  return <details className="group rounded-sm border-[0.5px] border-line-soft px-3 py-2">
    <summary className="cursor-pointer text-caption font-medium text-ink-2">
      工作紀錄 · {task.agent_runs.length} 筆
    </summary>
    <div className="mt-2 flex flex-col gap-2">
      {relationNote ? <p className="text-caption text-ink-3">{relationNote}</p> : null}
      {linked.length > 0 ? <ul className="flex flex-col gap-2">
        {linked.map((run, index) => {
          const agent = knownAgent(run, agents)
          const runLink: WorkLink[] = run.url ? [{ kind: "agent_task", label: "開啟工具工作紀錄", state: run.link_state === "supported" ? "supported" : "invalid", url: run.url }] : []
          return <li key={run.run_id ?? `run-${index}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-caption text-ink-2">
            <strong className="font-semibold text-ink">{agent?.label ?? agent?.id}</strong>
            <span>工作紀錄 {run.run_id ?? "識別碼未提供"}</span>
            <span>已記錄狀態：{RUN_STATE[run.state]}</span>
            <span>最近活動：{sourceTimestamp(run.last_activity_at)}</span>
            <LinkList links={runLink} />
          </li>
        })}
      </ul> : null}
      {unlinked.length > 0 ? <details className="rounded-sm border-[0.5px] border-line-soft px-2.5 py-1.5">
        <summary className="cursor-pointer text-caption text-ink-3">未確認工具關聯 · {unlinked.length} 筆</summary>
        <ul className="mt-2 flex flex-col gap-1 text-caption text-ink-3">
          {unlinked.map((run, index) => <li key={run.run_id ?? `unknown-run-${index}`}>工作紀錄 {run.run_id ?? "識別碼未提供"} · 工具未知 · 已記錄狀態：{RUN_STATE[run.state]} · 最近活動：{sourceTimestamp(run.last_activity_at)}</li>)}
        </ul>
      </details> : null}
    </div>
  </details>
}

function WorkTaskCard({ task, agents }: { task: WorkTaskSummary; agents: WorkAgent[] }) {
  const [copyStatus, setCopyStatus] = useState("")
  const state = WORK_STATE[task.state] ?? WORK_STATE.unknown
  const completion = COMPLETION_STAGE[task.completion.stage] ?? COMPLETION_STAGE.unknown
  const nextActor = actorLabel(task, agents)

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(task.copy_summary)
      setCopyStatus("摘要已複製；請自行貼到選擇的工具。")
    } catch {
      setCopyStatus("無法複製摘要；可以手動引用卡片內容。")
    }
  }

  return <Card role="article" className="flex flex-col gap-3 p-3 sm:p-4">
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <h3 className="break-words text-body font-semibold text-ink">{task.title}</h3>
        <p className="mt-1 text-micro text-ink-4">成果識別碼：{task.slug}</p>
      </div>
      <Chip tone={state.tone} aria-label={`工作狀態：${state.label}`}>{state.label}</Chip>
      {task.agent_match === "unknown" ? <Chip tone="warn">此工具關聯未知</Chip> : null}
    </div>

    {task.next_action ? <div className="grid gap-2 sm:grid-cols-2">
      <div className="min-w-0">
        <p className="text-caption text-ink-3">下一步</p>
        <p className="break-words text-body text-ink-2">{task.next_action}</p>
      </div>
      <div className="flex flex-col gap-1 text-caption text-ink-3">
        <p>下一個執行者：<strong className="font-medium text-ink-2">{nextActor}</strong>{task.action_kind ? ` · ${task.action_kind}` : ""}</p>
        {task.next_action_at ? <p>下一步日期：{sourceTimestamp(task.next_action_at)}</p> : null}
      </div>
    </div> : <p className="text-caption text-ink-3">來源尚未提供下一步。</p>}

    {task.blocked_by ? <p className="break-words rounded-sm border-[0.5px] border-warn/30 px-2.5 py-2 text-caption text-warn">阻塞：{task.blocked_by}</p> : null}

    <div className="grid gap-2 rounded-sm bg-bg-2 p-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={completion.tone}>{completion.label}</Chip>
          <span className="text-micro text-ink-4">{completion.detail}</span>
        </div>
        <details className="rounded-sm border-[0.5px] border-line-soft px-2.5 py-1.5">
          <summary className="cursor-pointer text-caption font-medium text-ink-2">完成證據</summary>
          <p className="mt-1 break-words text-caption text-ink-2">{task.completion.evidence ?? "來源沒有提供完成證據。"}</p>
        </details>
      </div>
      <dl className="grid min-w-0 grid-cols-1 gap-x-3 gap-y-1 text-micro text-ink-3 sm:grid-cols-2">
        <div><dt>來源驗證時間</dt><dd className="text-ink-2">{sourceTimestamp(task.source_verified_at)}</dd></div>
        <div><dt>驗證依據</dt><dd className="break-words text-ink-2">{task.verification_basis ?? "來源未提供"}</dd></div>
        <div><dt>最近工作紀錄</dt><dd className="text-ink-2">{sourceTimestamp(task.last_session_at)}</dd></div>
        <div><dt>來源修改時間</dt><dd className="text-ink-2">{sourceTimestamp(task.source_modified_at)}</dd></div>
        <div><dt>來源狀態</dt><dd className="break-words text-ink-2">{task.source_status ?? "未知"}</dd></div>
        <div><dt>狀態依據</dt><dd className="text-ink-2">{task.state_source === "work_state" ? "工作標註" : task.state_source === "source_status" ? "來源狀態" : "未知"}</dd></div>
        <div><dt>來源類型</dt><dd className="text-ink-2">{task.source_kind === "task" ? "工作記錄" : task.source_kind === "archived_task" ? "封存記錄" : task.source_kind === "legacy" ? "舊格式記錄" : "封存舊格式"}</dd></div>
      </dl>
    </div>

    {task.state_annotation_invalid ? <p className="text-caption text-warn">工作狀態標註不在支援的狀態範圍；目前狀態依來源判定。</p> : null}
    {task.stale_flags.length > 0 ? <div className="flex flex-col gap-1 text-caption text-warn">
      {task.stale_flags.map((flag, index) => <p key={`${flag}-${index}`}>{flag}</p>)}
    </div> : null}

    {task.links.length > 0 ? <Disclosure summary={<span className="font-medium text-ink-2">已記錄連結 · {task.links.length}</span>}><LinkList links={task.links} /></Disclosure> : <p className="text-caption text-ink-3">來源未記錄可開啟連結；可以複製摘要交給選擇的工具。</p>}

    <div className="flex flex-wrap items-center justify-between gap-2 border-t-[0.5px] border-line-soft pt-2">
      <WorkRuns task={task} agents={agents} />
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button size="sm" onClick={copySummary}>複製工作摘要</Button>
        {copyStatus ? <span role="status" className="text-caption text-ink-3">{copyStatus}</span> : null}
      </div>
    </div>
  </Card>
}

function WorkSourceOverview({ data }: { data: WorkData }) {
  const state = data.source.state
  const tone = state === "ready" ? "ok" : state === "partial" ? "warn" : "bad"
  const label = state === "ready" ? "來源可讀" : state === "partial" ? "來源部分可讀" : "來源不可用"
  const coverage = data.source.coverage
  const count = (value: number | null) => value === null ? "未知" : String(value)
  const archivedIncluded = coverage.archived_included === null
    ? "未知"
    : coverage.archived_included
      ? `是 · ${count(coverage.archived_indexed)} 筆`
      : "否"
  return <section className="flex flex-col gap-2" aria-label="工作來源狀態">
    <Card className="flex flex-col gap-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={tone}>{label}</Chip>
        <span className="text-caption text-ink-3">投影產生時間：{sourceTimestamp(data.as_of)}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-caption text-ink-3 sm:grid-cols-4 xl:grid-cols-8">
        <div><dt>讀取檔案</dt><dd className="font-medium text-ink-2">{count(coverage.files_seen)}</dd></div>
        <div><dt>已整理成果</dt><dd className="font-medium text-ink-2">{count(coverage.indexed)}</dd></div>
        <div><dt>舊格式未整理</dt><dd className="font-medium text-ink-2">{count(coverage.legacy_unstructured)}</dd></div>
        <div><dt>讀取錯誤</dt><dd className="font-medium text-ink-2">{count(coverage.read_errors)}</dd></div>
        <div><dt>封存資料已納入</dt><dd className="font-medium text-ink-2">{archivedIncluded}</dd></div>
        <div><dt>封存舊格式</dt><dd className="font-medium text-ink-2">{count(coverage.archived_legacy_unstructured)}</dd></div>
        <div><dt>重複成果已合併</dt><dd className="font-medium text-ink-2">{count(coverage.duplicate_slugs_collapsed)}</dd></div>
        <div><dt>工具關聯未知</dt><dd className="font-medium text-ink-2">{count(coverage.unlinked_relations)}</dd></div>
      </dl>
      {data.source.warnings.length > 0 ? <ul className="flex flex-col gap-1 text-caption text-warn">
        {data.source.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
      </ul> : null}
    </Card>
  </section>
}

function ActivitySummary({ data }: { data: WorkData["activity_summary"] }) {
  const stateLabel = data.state === "available" ? "可讀" : "資料未知"
  const snapshotLabel = data.snapshot_state === "current" ? "快照現行" : data.snapshot_state === "stale" ? "快照較舊" : data.snapshot_state === "missing" ? "快照缺失" : "快照無法讀取"
  const tone = data.state !== "available" ? "mute" : data.snapshot_state === "stale" ? "warn" : "info"
  return <Card className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-body font-semibold text-ink">AI 使用概況</h2>
        <Chip tone={tone}>{stateLabel} · {snapshotLabel}</Chip>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {data.metrics.map((metric) => <div key={metric.key} className="min-w-0">
          <dt className="text-micro text-ink-3">{metric.label}</dt>
          <dd className="break-words text-label font-semibold tabular-nums text-ink">{metric.state === "available" && metric.value !== null ? metric.value : "未知"}</dd>
        </div>)}
      </dl>
      <p className="mt-1 text-micro text-ink-4">使用量只提供整體彙總，未分配到單一工作。{data.note} 讀取時間：{sourceTimestamp(data.as_of)} · 使用快照日期：{sourceTimestamp(data.source_as_of)}</p>
    </div>
    <a className="shrink-0 text-caption font-medium text-info underline underline-offset-2" href="?tab=time">前往 AI 使用頁</a>
  </Card>
}

function WorkRefreshNotice({ isError, isFetching, isStale, error, dataUpdatedAt }: {
  isError: boolean
  isFetching: boolean
  isStale: boolean
  error: unknown
  dataUpdatedAt: number
}) {
  if (!dataUpdatedAt) return null
  const lastSuccessfulFetch = sourceTimestamp(new Date(dataUpdatedAt).toISOString())
  const freshness = `上次成功讀取：${lastSuccessfulFetch}。工作卡片的來源驗證、修改與活動時間仍是來源記錄時間。`
  if (isError) {
    const message = error instanceof Error ? error.message : "未知錯誤"
    return <Card role="alert" className="border-[0.5px] border-bad/30 p-3 text-caption text-bad">
      重新讀取失敗，目前保留上次成功讀取的工作資料。{freshness}無法確認最新狀態。錯誤：{message}
    </Card>
  }
  if (isFetching) return <Card role="status" className="border-[0.5px] border-warn/30 p-3 text-caption text-warn">
    正在重新讀取；目前顯示上次成功讀取的工作資料。{freshness}尚未確認最新狀態。
  </Card>
  if (isStale) return <Card role="status" className="border-[0.5px] border-warn/30 p-3 text-caption text-warn">
    工作資料已超過重新讀取期限，尚未確認最新狀態。{freshness}
  </Card>
  return null
}

function groupTitle(group: WorkGroup) {
  if (group === "needs_user") return "需要你先處理"
  if (group === "in_progress") return "正在進行"
  if (group === "awaiting_verification") return "等待驗證"
  if (group === "open") return "待開始"
  if (group === "done") return "已完成"
  if (group === "paused") return "已暫停"
  if (group === "unknown") return "狀態未知"
  return "已封存"
}

function WorkOutcomes({ data, agentFilter, onAgentFilterChange }: { data: WorkData; agentFilter: string; onAgentFilterChange: (value: string) => void }) {
  const workAvailable = data.source.state !== "unavailable"
  const filteredTasks = data.tasks
  const groups: WorkGroup[] = ["needs_user", "in_progress", "awaiting_verification", "open", "done", "paused", "unknown", "archived"]

  return <section className="flex flex-col gap-3" aria-label="工作成果">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <SectionHeading>工作成果</SectionHeading>
      {data.agents.length > 0 ? <label className="flex items-center gap-2 text-caption text-ink-3">
        <span>工具</span>
        <select aria-label="依工具篩選工作成果" value={agentFilter} onChange={(event) => onAgentFilterChange(event.target.value)} className="h-8 max-w-[220px] rounded-sm border-[0.5px] border-line bg-paper px-2 text-caption text-ink-2">
          <option value="all">全部工具</option>
          {data.agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.label}</option>)}
        </select>
      </label> : null}
    </div>
    {data.filter ? <p className="text-micro text-ink-3" role="status">
      符合 {data.filter.matched} 項 · 未知工具關聯保留 {data.filter.unknown_relation_included} 項 · 明確不符略過 {data.filter.explicitly_unmatched_omitted} 項
    </p> : null}
    {!workAvailable ? <Card role="status" className="p-4 text-body text-warn">來源目前不可用；沒有將讀取失敗顯示成「沒有工作」。請稍後重試。</Card> : null}
    {workAvailable && filteredTasks.length === 0 ? <Card className="p-4 text-body text-ink-3">
      {agentFilter !== "all"
        ? "所選工具沒有明確符合或關聯未知的工作成果。"
        : data.source.state === "ready" && data.source.coverage.read_errors === 0 && data.source.coverage.legacy_unstructured === 0
        ? "來源清楚回報目前沒有工作成果。"
        : "目前沒有整理出的工作成果；來源涵蓋不完整或仍有未整理記錄，不能判定沒有工作。"}
    </Card> : null}
    {workAvailable ? groups.map((group) => {
      const items = filteredTasks.filter((task) => workGroup(task) === group)
      if (items.length === 0) return null
      const cards = <div className="flex flex-col gap-2">{items.map((task, index) => <WorkTaskCard key={`${task.slug}-${index}`} task={task} agents={data.agents} />)}</div>
      if (group === "done" || group === "archived") {
        return <Disclosure key={group} summary={<span className="font-semibold text-ink">{groupTitle(group)} · {items.length}</span>}>{cards}</Disclosure>
      }
      return <section key={group} className="flex flex-col gap-2"><h3 className="text-caption font-semibold text-ink-2">{groupTitle(group)} · {items.length}</h3>{cards}</section>
    }) : null}
  </section>
}

export function TodosPage() {
  const [agentFilter, setAgentFilter] = useState("all")
  const requestedAgent = agentFilter === "all" ? undefined : agentFilter
  const workQuery = useQuery({ queryKey: ["work", requestedAgent ?? "all"], queryFn: () => getWork(requestedAgent) })
  const todosQuery = useQuery({ queryKey: ["todos"], queryFn: getTodos })

  const toggle = useWrite(
    (v: { id: string; done: boolean }) => toggleTodo(v.id, v.done),
    ["todos", "home"],
  )
  const create = useWrite(addTodo, ["todos", "home"])
  const remove = useWrite(deleteTodo, ["todos", "home"])
  const archive = useWrite(archiveTodos, ["todos", "home"])

  const [category, setCategory] = useState("")
  const [text, setText] = useState("")
  const [due, setDue] = useState("")
  const [goalId, setGoalId] = useState("")

  const todos = todosQuery.data
  const activeCategory = category || todos?.category_options[0] || "其他"
  const problem = writeErrorText(toggle.error) ?? writeErrorText(create.error) ?? writeErrorText(remove.error) ?? writeErrorText(archive.error)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    create.mutate({ category: activeCategory, text: trimmed, due, goal_id: goalId }, {
      onSuccess: () => { setText(""); setDue(""); setGoalId("") },
    })
  }

  return <div className="flex flex-col gap-5">
    <PageHeader page="todos" />
    {!workQuery.data && workQuery.isPending ? <Card role="status" className="p-4 text-body text-ink-3">讀取工作狀態中…</Card> : null}
    {workQuery.data ? <WorkRefreshNotice isError={workQuery.isError} isFetching={workQuery.isFetching} isStale={workQuery.isStale} error={workQuery.error} dataUpdatedAt={workQuery.dataUpdatedAt} /> : null}
    {!workQuery.data && workQuery.isError ? <Card role="alert" className="p-4 text-body text-bad">讀不到工作狀態：{(workQuery.error as Error).message}。讀取失敗不代表沒有工作。</Card> : null}
    {workQuery.data ? <>
      <ActivitySummary data={workQuery.data.activity_summary} />
      <WorkSourceOverview data={workQuery.data} />
      <WorkOutcomes data={workQuery.data} agentFilter={agentFilter} onAgentFilterChange={setAgentFilter} />
    </> : null}

    <Disclosure summary={<span className="font-semibold text-ink">短待辦與里程碑 · {todosQuery.isPending ? "讀取中" : todosQuery.isError ? "目前無法讀取" : `${todos?.active_count ?? 0} 件未完成`}</span>}>
      {todosQuery.isPending ? <p className="py-2 text-caption text-ink-3">讀取短待辦中…</p> : null}
      {todosQuery.isError ? <p role="alert" className="py-2 text-caption text-bad">讀不到短待辦資料：{(todosQuery.error as Error).message}</p> : null}
      {todos ? <div className="flex flex-col gap-4 py-2">
        {problem ? <p className="text-caption text-bad" role="status">{problem}</p> : null}
        {todos.month_milestones.length > 0 ? <section className="flex flex-col gap-2">
          <h2 className="text-body font-semibold text-ink">本月里程碑摘要</h2>
          <Card className="flex flex-col gap-2 p-3">
            <p className="text-caption text-ink-3">里程碑由目標頁維護；此處只供快速查看。</p>
            <ul className="flex flex-col gap-1.5 text-label text-ink-2">
              {todos.month_milestones.map((milestone, index) => <li key={`${milestone.goal_title}-${index}`} className="flex flex-wrap items-baseline gap-2">
                <span className="text-caption">{milestone.auto_done ? "⚡" : milestone.done ? "✅" : "⬜"}</span>
                <strong className="font-semibold text-ink">{milestone.goal_title}</strong>
                <span className="text-ink-3">— {milestone.text}</span>
              </li>)}
            </ul>
          </Card>
        </section> : null}

        <section className="flex flex-col gap-2">
          <h2 className="text-body font-semibold text-ink">新增短待辦</h2>
          <Card className="p-3">
            <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
              <select aria-label="分類" value={activeCategory} onChange={(event) => setCategory(event.target.value)} className="h-8 rounded-sm border-[0.5px] border-line bg-paper px-2 text-caption text-ink-2">
                {todos.category_options.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <input aria-label="待辦內容" value={text} onChange={(event) => setText(event.target.value)} placeholder="新增一件短待辦…" className="h-8 min-w-0 flex-1 rounded-sm border-[0.5px] border-line bg-paper px-2 text-label text-ink placeholder:text-ink-4" />
              <input aria-label="截止日" type="date" value={due} onChange={(event) => setDue(event.target.value)} className="h-8 rounded-sm border-[0.5px] border-line bg-paper px-2 text-caption text-ink-2" />
              <select aria-label="關聯目標" value={goalId} onChange={(event) => setGoalId(event.target.value)} className="h-8 max-w-[220px] rounded-sm border-[0.5px] border-line bg-paper px-2 text-caption text-ink-2">
                <option value="">（不關聯目標）</option>
                {todos.goal_options.map((goal) => <option key={goal.id} value={goal.id}>🎯 {goal.title}</option>)}
              </select>
              <Button type="submit" disabled={!text.trim() || create.isPending}>加入</Button>
            </form>
          </Card>
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-3 text-caption tabular-nums text-ink-3">
            <span>待辦 <b className="font-bold text-ink">{todos.active_count}</b></span>
            <span>已完成 <b className="font-bold text-ink">{todos.done_count}</b></span>
            {todos.archivable_count > 0 ? <Button onClick={() => archive.mutate(undefined)} disabled={archive.isPending}>歸檔 {todos.archivable_count} 個完成超過 7 天的</Button> : null}
          </div>
          {todos.categories.length === 0 ? <p className="text-caption text-ink-3">目前沒有短待辦。</p> : <div className="flex flex-col gap-2">
            {todos.categories.map((cat) => <Disclosure key={cat.name} open={cat.active_count > 0} summary={<span className="font-semibold text-ink">{cat.name} · {cat.active_count} 未完成 / {cat.total_count} 件</span>}>
              <ul className="flex flex-col gap-2 py-1 text-label text-ink-2">
                {cat.items.map((todo) => <li key={todo.id} className="flex flex-wrap items-center justify-between gap-2 border-b-[0.5px] border-line-soft pb-1.5 last:border-b-0 last:pb-0">
                  <label className="flex min-w-0 flex-1 items-center gap-2">
                    <Checkbox checked={todo.done} disabled={toggle.isPending} onChange={(event) => toggle.mutate({ id: todo.id, done: event.target.checked })} />
                    <span className={todo.done ? "break-words text-ink-4 line-through" : "break-words text-ink"}>{todo.text}</span>
                  </label>
                  <div className="flex items-center gap-2 text-caption text-ink-4">
                    {todo.goal_title ? <span>🎯 {todo.goal_title}</span> : null}
                    {todo.due ? <span>{todo.due}</span> : null}
                    <Button variant="link" aria-label={`刪除 ${todo.text}`} disabled={remove.isPending} onClick={() => remove.mutate(todo.id)}>刪除</Button>
                  </div>
                </li>)}
              </ul>
            </Disclosure>)}
          </div>}
        </section>
      </div> : null}
    </Disclosure>
  </div>
}
