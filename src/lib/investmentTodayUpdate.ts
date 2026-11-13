import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient, type Query, type QueryClient } from "@tanstack/react-query"
import {
  getInvestmentTodayUpdate, postInvestmentTodayUpdate,
  type TodayMarketPayload, type TodayUpdateStatus,
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
/** A poll that fails during a run is shown as a failure only after this long. */
const RUNNING_ERROR_GRACE_MS = 60_000

type TodayUpdateQueryView = {
  data: TodayUpdateStatus | undefined
  error: Error | null
  dataUpdatedAt: number
  errorUpdatedAt: number
}

/** The status the view shows. A read error becomes a failed status (keeping any
 * cached content) unless it is a brief poll failure during a running run. */
export function presentTodayUpdate({ data, error, dataUpdatedAt, errorUpdatedAt }: TodayUpdateQueryView): TodayUpdateStatus | undefined {
  if (!error) return data
  if (data?.state === "running" && errorUpdatedAt - dataUpdatedAt <= RUNNING_ERROR_GRACE_MS) return data
  return {
    ...(data ?? { started_at: null, latest: null }),
    state: "failed",
    finished_at: new Date(errorUpdatedAt).toISOString(),
    message: error.message,
  }
}

/** Message for a start that failed before the provider returned a status. */
export function startFailureMessage(error: unknown): string {
  return error instanceof Error && error.message.trim() ? error.message : "更新要求沒有送出"
}

/** Query options for the run status, polled every 5 seconds while it is running.
 * The read stays enabled while a cached run is still running, so the poll
 * continues when another view is selected; nothing is read before the view
 * first asks for it. */
export function todayUpdateQueryOptions(client: QueryClient, enabled: boolean) {
  return {
    queryKey: TODAY_UPDATE_KEY,
    queryFn: ({ signal }: { signal: AbortSignal }) => getInvestmentTodayUpdate(signal),
    enabled: enabled || client.getQueryData<TodayUpdateStatus>(TODAY_UPDATE_KEY)?.state === "running",
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: (query: Query<TodayUpdateStatus, Error, TodayUpdateStatus, typeof TODAY_UPDATE_KEY>) => query.state.data?.state === "running" ? POLL_MS : false,
    // A run takes minutes; the reader usually looks elsewhere meanwhile.
    refetchIntervalInBackground: true,
  } as const
}

/** Mutation options for starting a run. */
export function todayUpdateStartOptions(client: QueryClient) {
  return {
    // An in-flight read started before the POST must not overwrite the returned `running`.
    onMutate: () => client.cancelQueries({ queryKey: TODAY_UPDATE_KEY }),
    mutationFn: (market?: TodayMarketPayload) => postInvestmentTodayUpdate(market),
    onSuccess: (next: TodayUpdateStatus) => { client.setQueryData(TODAY_UPDATE_KEY, next) },
    onError: (error: Error) => {
      // A request that never reached the backend still has to show up as a failed update.
      const now = new Date().toISOString()
      client.setQueryData<TodayUpdateStatus>(TODAY_UPDATE_KEY, current => ({
        latest: current?.latest ?? null, state: "failed", started_at: now, finished_at: now,
        message: startFailureMessage(error),
      }))
    },
  }
}

/** Run status (raw query), the status the view presents, and the start mutation. */
export function useTodayUpdate(enabled = true) {
  const client = useQueryClient()
  const status = useQuery(todayUpdateQueryOptions(client, enabled))
  const presented = presentTodayUpdate(status)
  const start = useMutation(todayUpdateStartOptions(client))
  return { status, presented, start }
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
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(timer)
  }, [active])
  return now
}
