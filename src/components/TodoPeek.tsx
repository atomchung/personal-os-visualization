import type { Home } from "@/lib/api"
import { toggleTodo } from "@/lib/api"
import { useWrite, writeErrorText } from "@/lib/writes"
import { Card, SectionHeading } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Chip } from "@/components/ui/chip"

export function TodoPeek({ todos, total }: { todos: Home["todos"]; total: number }) {
  // Refetches 本週 Todo as well: same file, and the completion rate over there
  // is derived from it.
  const toggle = useWrite(
    (v: { id: string; done: boolean }) => toggleTodo(v.id, v.done),
    ["home", "todos"],
  )
  const problem = writeErrorText(toggle.error)

  return (
    <section className="flex flex-col gap-2">
      <SectionHeading aside={<Chip tone="mute">{total} 待辦</Chip>}>
        今日 Top Todo
      </SectionHeading>
      {problem && (
        <p className="text-caption text-bad" role="status">
          {problem}
        </p>
      )}
      {todos.length === 0 ? (
        <p className="text-body text-ink-3">沒有待辦 — 「本週 Todo」加一個</p>
      ) : (
        <Card className="divide-y-[0.5px] divide-line-soft">
          {todos.map((t) => (
            <label
              key={t.id}
              className="flex cursor-pointer items-center gap-2 px-3.5 py-2"
            >
              <Checkbox
                checked={false}
                disabled={toggle.isPending}
                onChange={() => toggle.mutate({ id: t.id, done: true })}
              />
              <span className="flex-1 text-body text-ink-2">{t.text}</span>
              <Chip tone={t.tone}>{t.category}</Chip>
            </label>
          ))}
        </Card>
      )}
    </section>
  )
}
