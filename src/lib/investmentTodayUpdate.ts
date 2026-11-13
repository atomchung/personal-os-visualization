import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getInvestmentTodayUpdate, postInvestmentTodayUpdate,
  type TodayMarketPayload, type TodayUpdateState, type TodayUpdateStatus,
} from "@/lib/investment"

/** UI hooks for the manual "update view and news" run. The contract types live
 * with the Investment provider boundary in `investment.ts`; every read and start
 * goes through the selected provider, so the synthetic reference provider and a
 * private provider drive the same view. */

export type {
  TodayMarketPayload, TodayUpdate, TodayUpdateConclusion, TodayUpdateNews, TodayUpdateState, TodayUpdateStatus,
  TodayUpdateView, TodayUpdateWatch,
} from "@/lib/investment"

export const TODAY_UPDATE_KEY = ["investment-today-update"] as const
const POLL_MS = 5_000

/** Status of the manual run, polled every 5 seconds while it is running. */
export function useTodayUpdate(enabled = true) {
  const client = useQueryClient()
  const status = useQuery({
    queryKey: TODAY_UPDATE_KEY,
    queryFn: ({ signal }) => getInvestmentTodayUpdate(signal),
    enabled,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: query => query.state.data?.state === "running" ? POLL_MS : false,
    // A run takes minutes; the reader usually looks elsewhere meanwhile.
    refetchIntervalInBackground: true,
  })
  const state = status.data?.state
  const previous = useRef<TodayUpdateState | undefined>(undefined)
  useEffect(() => {
    if (previous.current === "running" && state && state !== "running") void client.invalidateQueries({ queryKey: TODAY_UPDATE_KEY })
    previous.current = state
  }, [client, state])
  const start = useMutation({
    mutationFn: (market?: TodayMarketPayload) => postInvestmentTodayUpdate(market),
    onSuccess: next => client.setQueryData(TODAY_UPDATE_KEY, next),
    onError: error => {
      // A request that never reached the backend still has to show up as a failed update.
      const now = new Date().toISOString()
      client.setQueryData<TodayUpdateStatus>(TODAY_UPDATE_KEY, current => ({
        latest: current?.latest ?? null, state: "failed", started_at: now, finished_at: now,
        message: error instanceof Error && error.message.startsWith("更新要求") ? error.message : "更新要求沒有送出",
      }))
    },
  })
  return { status, start }
}

/** m:ss since `startedAt`; null when it cannot be read. */
export function elapsedLabel(startedAt: string | null | undefined, nowMs: number): string | null {
  const started = startedAt ? Date.parse(startedAt) : NaN
  if (!Number.isFinite(started)) return null
  const seconds = Math.max(0, Math.floor((nowMs - started) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

/** Current time in ms, refreshed every second while `active`. */
export function useNowWhile(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(timer)
  }, [active])
  return now
}
