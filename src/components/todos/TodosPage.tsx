import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  addTodo,
  archiveTodos,
  deleteTodo,
  getTodos,
  toggleTodo,
} from "@/lib/api"
import { useWrite, writeErrorText } from "@/lib/writes"
import { Card, SectionHeading } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Disclosure } from "@/components/ui/disclosure"

export function TodosPage() {
  const todosQuery = useQuery({ queryKey: ["todos"], queryFn: getTodos })

  // Every write refetches both this page and 今日 — the Top Todo peek there
  // reads the same file, and a tick that only updated one of them would make
  // the two tabs disagree about what is done.
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

  if (todosQuery.isPending) {
    return <p className="p-6 text-body text-ink-3">讀取待辦資料中…</p>
  }

  if (todosQuery.isError) {
    return (
      <p className="p-6 text-body text-bad">
        讀不到待辦資料：{(todosQuery.error as Error).message}
      </p>
    )
  }

  const data = todosQuery.data
  const activeCategory = category || data.category_options[0] || "其他"
  const problem =
    writeErrorText(toggle.error) ??
    writeErrorText(create.error) ??
    writeErrorText(remove.error) ??
    writeErrorText(archive.error)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    create.mutate(
      { category: activeCategory, text: trimmed, due, goal_id: goalId },
      {
        onSuccess: () => {
          setText("")
          setDue("")
          setGoalId("")
        },
      },
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-display font-bold tracking-tight text-ink">
          本週 Todo
        </h1>
        <p className="text-caption text-ink-3">
          輕量隨手待辦收件箱 · 想規劃本週可跑 /record-todo
        </p>
      </div>

      {problem && (
        <p className="text-caption text-bad" role="status">
          {problem}
        </p>
      )}

      {/* 本月 Milestone 唯讀鏡像 */}
      {data.month_milestones.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionHeading>本月 Milestone 鏡像</SectionHeading>
          <Card className="flex flex-col gap-2 p-4">
            <p className="text-caption text-ink-3">
              唯讀鏡子 · 編輯在目標 tab · ⚡ 自動判定 · ✅ 已完成 · ⬜ 進行中
            </p>
            <ul className="flex flex-col gap-1.5 text-label text-ink-2">
              {data.month_milestones.map((m, idx) => (
                <li key={idx} className="flex items-baseline gap-2">
                  <span className="text-caption">
                    {m.auto_done ? "⚡" : m.done ? "✅" : "⬜"}
                  </span>
                  <strong className="font-semibold text-ink">
                    {m.goal_title}
                  </strong>
                  <span className="text-ink-3">— {m.text}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {/* 新增 */}
      <section className="flex flex-col gap-2">
        <SectionHeading>隨手 Todo</SectionHeading>
        <Card className="p-3">
          <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
            <select
              aria-label="分類"
              value={activeCategory}
              onChange={(e) => setCategory(e.target.value)}
              className="h-7 rounded-sm border-[0.5px] border-line bg-paper px-2 text-caption text-ink-2"
            >
              {data.category_options.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              aria-label="待辦內容"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="新 todo…"
              className="h-7 min-w-0 flex-1 rounded-sm border-[0.5px] border-line bg-paper px-2 text-label text-ink placeholder:text-ink-4"
            />
            <input
              aria-label="截止日"
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="h-7 rounded-sm border-[0.5px] border-line bg-paper px-2 text-caption text-ink-2"
            />
            <select
              aria-label="關聯目標"
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className="h-7 max-w-[220px] rounded-sm border-[0.5px] border-line bg-paper px-2 text-caption text-ink-2"
            >
              <option value="">（不關聯目標）</option>
              {data.goal_options.map((g) => (
                <option key={g.id} value={g.id}>
                  🎯 {g.title}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={!text.trim() || create.isPending}>
              ➕ 加入
            </Button>
          </form>
        </Card>
      </section>

      {/* 待辦統計列 */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-4 text-label tabular-nums">
          <span className="text-caption text-ink-3">
            待辦{" "}
            <b className="text-num font-bold text-ink">{data.active_count}</b>
          </span>
          <span className="text-caption text-ink-3">
            已完成{" "}
            <b className="text-num font-bold text-ink">{data.done_count}</b>
          </span>
          <span className="text-caption text-ink-3">
            完成率 <b className="text-num font-bold text-ink">{data.rate}%</b>
          </span>
          {data.archivable_count > 0 && (
            <Button
              onClick={() => archive.mutate(undefined)}
              disabled={archive.isPending}
            >
              歸檔 {data.archivable_count} 個完成超過 7 天的
            </Button>
          )}
        </div>

        {data.categories.length === 0 ? (
          <p className="text-body text-ink-3">目前沒有待辦事項。</p>
        ) : (
          <div className="flex flex-col gap-3">
            {data.categories.map((cat) => (
              <Disclosure
                key={cat.name}
                open={cat.active_count > 0}
                summary={
                  <span className="font-semibold text-ink">
                    {cat.name} · {cat.active_count} 待辦 / {cat.total_count} 共
                  </span>
                }
              >
                <ul className="flex flex-col gap-2 py-1 text-label text-ink-2">
                  {cat.items.map((todo) => (
                    <li
                      key={todo.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b-[0.5px] border-line-soft pb-1.5 last:border-b-0 last:pb-0"
                    >
                      <label className="flex flex-1 items-center gap-2">
                        <Checkbox
                          checked={todo.done}
                          disabled={toggle.isPending}
                          onChange={(e) =>
                            toggle.mutate({
                              id: todo.id,
                              done: e.target.checked,
                            })
                          }
                        />
                        <span
                          className={
                            todo.done ? "line-through text-ink-4" : "text-ink"
                          }
                        >
                          {todo.text}
                        </span>
                      </label>
                      <div className="flex items-center gap-2 text-caption text-ink-4">
                        {todo.goal_title && <span>🎯 {todo.goal_title}</span>}
                        {todo.due && <span>{todo.due}</span>}
                        <Button
                          variant="link"
                          aria-label={`刪除 ${todo.text}`}
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(todo.id)}
                        >
                          🗑
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </Disclosure>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
