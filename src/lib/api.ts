import { request } from "@/lib/transport"

export type Suggestion = {
  task_slug: string
  title: string
  next_action: string
  goal_title: string
  goal_target: string
  goal_attributed: boolean
  current_milestone: string
  proposed_milestone: string
  expected_benefit: string
  benefit_defined: boolean
  why_now: string
  next_actor: string
  action_kind: string
  evidence_ref: string
  human_verdict: "" | "accept" | "not_now" | "wrong_context"
}

export type Cockpit = {
  week_id: string
  focus_goal_title: string
  focus_goal_target: string
  focus_milestone: string
  focus_proposed_milestone: string
  suggestions: Suggestion[]
}

export type Tone = "ok" | "warn" | "bad" | "accent" | "info" | "mute"

export type Pillar = {
  label: string
  value: string
  unit: string
  sub: string
  pct: number
  tone: string
  delta: string
  delta_tone: Tone
  spark: number[]
}

export type Thread = {
  slug: string
  title: string
  emoji: string
  days_label: string
  next_action: string
  supplied: boolean
  nomination: string
}

export type Home = {
  hero: {
    greeting: string
    name: string
    week_label: string
    usage_missing: boolean
    diagnosis: { label: string; value: string; note: string }[]
  }
  pillars: Pillar[]
  threads: {
    supply_rate: number | null
    supplied: number
    total: number
    pending_nominations: number
    items: Thread[]
  }
  todos: { id: string; text: string; category: string; tone: Tone }[]
  todo_total: number
  categories: {
    category: string
    hours: number
    commits: number
    cloud_sessions: number
    cloud_commits: number
  }[]
  categories_note: string
  inbox: {
    pending: number
    stale: number
    health_label: string
    health_tone: Tone
    rows: { time_label: string; cwd: string; text: string; heavy: boolean }[]
    hidden: number
  }
  cockpit: Cockpit
}

export type FocusSubBucket = {
  time_category: string
  active_hhmm: string
  active_min: number
  share_pct: string
  session_count: number
  top_session_text: string
}

export type FocusGoal = {
  id: string
  title: string
  category: string
  target: string
  current: string
  progress_type: string
  is_updated: boolean
}

export type FocusRow = {
  goal_category: string
  active_hhmm: string
  active_min: number
  share_pct: string
  session_count: number
  goals_updated: number
  goals_total: number
  sub_buckets: FocusSubBucket[]
  hint: string | null
  top_session_text: string
  top_session_category: string
  goals: FocusGoal[]
}

export type OrphanTime = {
  category: string
  active_hhmm: string
  active_min: number
  share_pct: string
  sessions: number
}

export type StaleGoal = {
  id: string
  category: string
  title: string
  current: string
}

export type OverallPeek = {
  available: boolean
  period_key: string
  headline: string
  n_threads: number
  narrative: string
}

export type FocusKPIs = {
  total_active_hhmm: string
  total_active_min: number
  linked_hhmm: string
  linked_min: number
  linked_pct: string
  orphan_hhmm: string
  orphan_min: number
  stale_goals_count: number
}

export type FocusData = {
  days: number
  period_label: string
  overall: OverallPeek
  kpis: FocusKPIs
  rows: FocusRow[]
  orphan_time: OrphanTime[]
  stale_goals: StaleGoal[]
}

export type TimePeriod = "week" | "last_week" | "4w"

export type WeeklyUsageRow = {
  week_start: string
  label: string
  /** agent key → that agent's slice of the week. null = the aggregate failed
   * for that agent, which is "unknown", never zero. */
  agents: Record<string, { output_tokens: number | null; cost_usd: number | null }>
  output_tokens: number | null
  cost_usd: number | null
  turns: number
  /** Wall-clock active hours, only for the weeks the session snapshot reaches. */
  active_hours: number | null
  is_current: boolean
  /** Agents whose local transcripts no longer reach this week — the number is
   * low because the data was deleted, not because the week was quiet. */
  truncated_agents: string[]
  /** Agents CC Story could not aggregate when the snapshot was built. */
  unknown_agents: string[]
}

export type CcstoryUsageCoverage = {
  complete: boolean
  incomplete_agents: string[]
  providers: Record<string, string>
} | null

export type CcstoryMcpOverview = {
  available: boolean
  error?: string
  recap: null | {
    ok: boolean
    error?: string
    since: string | null
    until: string | null
    active_hours: number | null
    cost_usd: number | null
    usage_coverage: CcstoryUsageCoverage
    unpriced_models: string[]
    agents: {
      agent: string
      label: string
      sessions: number | null
      messages: number | null
      time_share: number | null
      session_share: number | null
    }[]
    categories: {
      name: string
      active_hours: number | null
    }[]
  }
  comparison: null | {
    ok: boolean
    error?: string
    current_label: string | null
    previous_label: string | null
    current_active_hours: number | null
    previous_active_hours: number | null
    current_cost_usd: number | null
    previous_cost_usd: number | null
    usage_coverage: {
      current: CcstoryUsageCoverage
      previous: CcstoryUsageCoverage
    }
    unpriced_models: { current: string[]; previous: string[] }
    deltas: {
      category: string
      current_hours: number | null
      previous_hours: number | null
      pct_change: number | null
    }[]
  }
  trend: null | {
    ok: boolean
    error?: string
    period: string | null
    count: number | null
    usage_coverage: CcstoryUsageCoverage
    unpriced_models: string[]
    points: {
      label: string | null
      since: string | null
      until: string | null
      active_hours: number | null
      cost_usd: number | null
      buckets: {
        name: string
        active_hours: number | null
        sessions: number | null
      }[]
      unpriced_models: string[]
      usage_coverage: CcstoryUsageCoverage
    }[]
  }
}

export type TimeData = {
  period: TimePeriod
  period_label: string
  cycle_caption: string
  /** Non-empty only when the page was asked for a past date: says which parts
   * of the payload the snapshot did not actually recompute for it. */
  as_of_note: string
  // Every number on the page is sliced out of one background snapshot, so its
  // age is the age of the page.
  snapshot: { age_label: string | null; is_stale: boolean; missing: boolean }
  kpis: {
    // `sub` is set only when `value` is "—" and says why the snapshot cannot
    // serve that window.
    output: { label: string; value: string; delta: string; sub: string | null }
    cost: { label: string; value: string; sub: string; caveat: string }
    sessions: { label: string; value: string; delta: string }
    active_hours: { label: string; value: string; sub: string }
  }
  verdict: { available: boolean; tone: string; text: string }
  summary_lines: string[]
  weekly_trend: {
    available: boolean
    agents: { key: string; label: string }[]
    rows: WeeklyUsageRow[]
    coverage_note: string
    hint: string
  }
  ccstory_mcp: CcstoryMcpOverview
  worth_rows: {
    agent: string
    agent_label: string
    plan_label: string
    monthly_fee_usd: number | null
    monthly_api_cost_usd: number | null
    leverage: number | null
    /** A free plan is not an unset fee: it gets no leverage figure either, but
     * for a different reason, and the table says which. */
    is_free: boolean
    /** Complete weeks this agent actually had data for. Below 3 the monthly
     * projection is withheld rather than extrapolated from one or two weeks. */
    sample_weeks: number
    weekly_output_avg: number | null
  }[]
  narrative_state: {
    available: boolean
    period_key: string
    /** CC Story's own window label, `YYYY-MM-DD_YYYY-MM-DD`, or null for rows
     * written before it was recorded. */
    source_window: string | null
    /** One sentence naming the span the narratives actually cover — CC Story's
     * "week" is a rolling 7 days, not the Monday-anchored week above. */
    window_note: string
    hint: string
  }
  activity_blocks: {
    category: string
    hours: number
    session_count: number
    sub_breakdown: string
    narrative: string
    fallback_bullets: string[]
  }[]
  agent_rows: {
    agent: string
    agent_label: string
    session_count: number
    active_hhmm: string
    median_min: number
    /** null = the aggregate failed for this agent in at least one week of the
     * period; the total would be wrong, not merely smaller. */
    output_m: number | null
    longest_min: number
    longest_topic: string
  }[]
  category_rows: {
    category: string
    active_hhmm: string
    active_hours: number
    share_pct: string
    commits: number
    cloud_sessions: number
    cloud_commits: number
  }[]
  daily_active: { date: string; category: string; minutes: number }[]
  daily_models: { date: string; model: string; out_m: number }[]
  top_sessions: {
    date: string
    agent: string
    category: string
    active_hhmm: string
    topic: string
    session_id: string
  }[]
}

export type GoalCardItem = {
  id: string
  title: string
  target: string
  goal_type: string
  type_badge: string
  progress_type: string
  current: string
  metric: { label: string; pct?: number | null; warn?: string | null } | null
  milestones: { text: string; done: boolean; auto_done: boolean; is_current_month: boolean }[]
  milestone_done_count: number
  milestone_total_count: number
  open_todos: string[]
  done_todos: string[]
  week_hours: number | null
  folder_ref?: string
  note?: string
  artifact_stats?: string[]
}

export type GoalsData = {
  quarter_label: string
  ai_evidence: {
    covered_hours: string
    shared_hours: string
    unattributed_hours: string
    goal_count: number
    window: string
    coverage_status: string
    source_kind: string
    goals: {
      title: string
      total_hours: string
      exclusive_hours: string
      shared_hours: string
      projects_touched: string
      latest_activity: string
    }[]
  } | null
  effect_lens: {
    total_tasks: number
    linked_tasks: number
    pct_linked: number
    unlinked_tasks: number
    by_goal: { goal_title: string; count: number; active: number; zombie: number }[]
    by_cluster: { cluster: string; count: number; active: number; zombie: number; pct_linked: string; shipped: string }[]
    unlinked_slugs: string[]
  }
  roadmap_months: {
    ym: string
    label: string
    groups: {
      parent_id: string
      parent_title: string
      items: { goal_title: string; text: string; done: boolean; auto_done: boolean }[]
    }[]
  }[]
  groups: {
    parent_id: string
    title: string
    subtitle: string
    done_milestones: number
    total_milestones: number
    goals: GoalCardItem[]
  }[]
  paused_groups: {
    parent_id: string
    title: string
    subtitle: string
    goals: GoalCardItem[]
  }[]
  uncategorized: GoalCardItem[]
  total_active_goals: number
}

export type IdealItem = {
  id: string
  title: string
  status: string
  status_label: string
  theme: string
  goal_fit: string
  goal_fit_label: string
  problem: string
  user_story: string
  minimum_execution_unit: string
  cheapest_test: string
  success_signal: string
  confidence: string
  next_action: string
  quantification: { label?: string; value?: string; basis?: string; note?: string }[]
  evidence: { path?: string; note?: string }[]
}

export type IdealData = {
  kpis: {
    total_cards: number
    exploring: number
    validated: number
    high_fit: number
  }
  source_snapshot: Record<string, any>
  themes: string[]
  status_labels: Record<string, string>
  goal_fit_labels: Record<string, string>
  items: IdealItem[]
}

export type HealthGoalStatus = {
  id: string
  title: string
  /** 現在的絕對數字（例：已完成 214 次 · 還差 96 次） */
  sub: string
  /** 起點走到目標的百分比 — 四條進度條同一把尺 */
  pct: number
  /** 進度條左端的標籤（起點） */
  start_label: string
  /** 進度條右端的標籤（目標本身） */
  goal_label: string
  status_text: string
  status_tone: "ok" | "warn" | "bad" | "mute"
  note: string
  marker_pct: number | null
  marker_label: string
  signed: boolean
}

export type HealthKPIItem = {
  label: string
  value: string
  sub?: string
}

export type HealthData = {
  goals_status: HealthGoalStatus[]
  data_gaps: { icon: string; text: string }[]
  coach: {
    week_start: string
    intent: string
    notes: { icon: string; text: string }[]
    plan_version: number | null
    age_days: number | null
  } | null
  cards: {
    vo2: {
      title: string
      target_badge: string
      kpis: HealthKPIItem[]
      caption: string
      run_mix_caption: string
      intensity_mix: {
        low_pct: number
        mid_pct: number
        high_pct: number
        calibrated: boolean
        total_min: number
      }
      runs_table: {
        date: string
        kind: string
        duration: string
        pace: string
        hr: string
        z2_endurance: string
        drift: string
      }[]
    }
    body: {
      title: string
      target_badge: string
      kpis: HealthKPIItem[]
      caption: string
      gap_parts: string[]
      projection_text: string
      trends_table: { metric: string; m1: string; m3: string }[]
    }
    pullup: {
      title: string
      target_badge: string
      kpis: HealthKPIItem[]
      caption: string
      best_text: string
      suggestion: string
      history_points: { date: string; assist_kg: number; max_reps: number }[]
      back_count: number
    }
    bench: {
      title: string
      target_badge: string
      kpis: HealthKPIItem[]
      caption: string
      gap_text: string
      best_text: string
      history_points: { date: string; e1rm: number; weight: number; reps: number }[]
    }
  }
  annual: {
    kpis: HealthKPIItem[]
    month_summary: {
      this_month: number
      projected: number
      mom_arrow: string
      mom_color: string
      prev_month: number
    }
    monthly_table: {
      month: string
      count: number
      per_week: string
      vs_goal: string
      runs: number
      strength: number
      hours: string
    }[]
  }
  recovery: {
    data_date: string | null
    hrv_status: string
    sample_nights: string
    sleep_7d_avg: string
    readiness_score: string
    action: string
    action_level: string
    reasons: string[]
    caveat: string
  }
  charts: {
    weekly_body: {
      week_start: string
      weight: number | null
      body_fat: number | null
      lean_mass: number | null
    }[]
    weekly_parts: {
      week_start: string
      chest: number
      back: number
      legs: number
      running: number
      other: number
    }[]
  }
  running_annual: {
    total_km: number
    runs_n: number
    avg_km_per_run: number
    avg_pace_str: string
    avg_hr_val: number
    longest_km: number
    total_hours: number
    peak_hr: number
    monthly_trend: {
      ym: string
      km: number
      runs: number
      pace_min: number | null
    }[]
  } | null
  // 力量訓練歷史 — hand-logged sets only; Garmin records attendance, not weight.
  history: {
    strength_log: {
      date: string
      exercise: string
      set_number: number | null
      weight_kg: number | null
      assist_kg: number | null
      reps: number | null
      rpe: number | null
      slow_negative: boolean
      notes: string
    }[]
    pullup_assist_trend: {
      date: string
      assist_kg: number | null
      max_reps: number | null
    }[]
  }
}

export type TodosData = {
  month_milestones: {
    goal_title: string
    text: string
    done: boolean
    auto_done: boolean
  }[]
  active_count: number
  done_count: number
  rate: number
  categories: {
    name: string
    active_count: number
    total_count: number
    items: {
      id: string
      text: string
      category: string
      done: boolean
      due: string
      goal_id: string
      goal_title: string
    }[]
  }[]
  category_options: string[]
  goal_options: { id: string; title: string }[]
  archivable_count: number
}

export type Verdict = "accept" | "not_now" | "wrong_context" | "clear"

/** Which week to render. Read-only; see web/api.py on why the trial needs it. */
export const AS_OF = new URLSearchParams(location.search).get("as_of") ?? ""

/** A write the server refused because the caller's view was stale (409) or
 * because another writer held the file (503). Both are worth showing verbatim:
 * "this todo was archived while your tab was open" is information, not noise. */
export class WriteRejected extends Error {
  // A plain field, not a `constructor(readonly status: ...)` parameter
  // property: tsconfig has `erasableSyntaxOnly`, which rejects any TS syntax
  // that emits runtime code.
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "WriteRejected"
    this.status = status
  }
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text()
    let detail = body
    try {
      detail = (JSON.parse(body) as { detail?: string }).detail ?? body
    } catch {
      /* not JSON — show the raw body */
    }
    if (res.status === 409 || res.status === 503) {
      throw new WriteRejected(res.status, detail)
    }
    throw new Error(`${res.status} ${detail}`)
  }
  return res.json() as Promise<T>
}

const post = <T>(url: string, body?: unknown) =>
  request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(json<T>)

const asOfQuery = AS_OF ? `?as_of=${AS_OF}` : ""

export const getHome = () => request(`/api/home${asOfQuery}`).then(json<Home>)

export const getFocus = (days: number = 7) =>
  request(`/api/focus?days=${days}${AS_OF ? `&as_of=${AS_OF}` : ""}`).then(
    json<FocusData>,
  )

export const getTime = (period: TimePeriod = "week") =>
  request(`/api/time?period=${period}${AS_OF ? `&as_of=${AS_OF}` : ""}`).then(
    json<TimeData>,
  )

export const getGoals = () => request("/api/goals").then(json<GoalsData>)

export const getIdeal = () => request("/api/ideal").then(json<IdealData>)

export const getHealth = () => request("/api/health").then(json<HealthData>)

export const getTodos = () => request("/api/todos").then(json<TodosData>)

export const sendVerdict = (task_slug: string, verdict: Verdict) =>
  post<Cockpit>("/api/cockpit/feedback", {
    task_slug,
    verdict,
    as_of: AS_OF || null,
  })

// --- writes -----------------------------------------------------------------

export const toggleTodo = (id: string, done: boolean) =>
  post<{ id: string; done: boolean }>(`/api/todos/${id}/toggle`, { done })

export const addTodo = (input: {
  category: string
  text: string
  due?: string
  goal_id?: string
}) => post<{ id: string }>("/api/todos", input)

export const deleteTodo = (id: string) =>
  request(`/api/todos/${id}`, { method: "DELETE" }).then(json<{ id: string }>)

export const archiveTodos = () =>
  post<{ archived: number }>("/api/todos/archive")

export const setMilestoneDone = (
  goalId: string,
  index: number,
  done: boolean,
) => post<{ done: boolean }>(`/api/goals/${goalId}/milestones/${index}`, { done })

export const acceptNomination = (
  slug: string,
  expected_text: string,
  text?: string,
) =>
  post<{ slug: string; next_action: string }>(
    `/api/nominations/${slug}/accept`,
    { expected_text, text: text ?? null },
  )

export const skipNomination = (slug: string, expected_text: string) =>
  post<{ slug: string }>(`/api/nominations/${slug}/skip`, { expected_text })

export type WorkItem = { id: string; name: string; summary: string }
export type WorkData = {
  status: "ready" | "unavailable"
  groups: { in_progress: WorkItem[]; needs_attention: WorkItem[]; completed: WorkItem[] }
}
export const getWork = () => request("/api/work").then(json<WorkData>)
