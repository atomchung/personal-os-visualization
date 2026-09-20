import { useMutation, useQueryClient } from "@tanstack/react-query"
import { WriteRejected } from "@/lib/api"

/** Query keys a write can invalidate. Every page reads from one payload, so a
 * write refetches whole pages rather than patching cached objects — the numbers
 * on these pages are derived (completion rate, supply rate, milestone counts)
 * and patching one field would leave the derived ones lying. */
export type PageKey = "home" | "todos" | "goals" | "focus" | "investment-work"

/**
 * A mutation that refetches the pages it affects and turns a rejection into a
 * sentence worth reading.
 *
 * 409 is not a failure of the click; it means the data moved under the tab —
 * the todo was archived, the nomination was regenerated, the milestone is
 * machine-owned. The page is refetched in that case too, so what the user sees next
 * is the truth rather than the click he thought he made.
 */
export function useWrite<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  invalidates: PageKey[],
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      for (const key of invalidates) qc.invalidateQueries({ queryKey: [key] })
    },
  })
}

export function writeErrorText(error: unknown): string | null {
  if (!error) return null
  if (error instanceof WriteRejected) {
    return error.status === 409 ? error.message : `暫時寫不進去：${error.message}`
  }
  return `寫入失敗：${(error as Error).message}`
}
