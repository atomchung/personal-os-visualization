import type { ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, SectionHeading } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { getInvestmentPending, type InvestmentPending, type PendingBlock, type PendingGate, type PendingRevisit, type PendingWeekly } from "@/lib/investment"
import { ReadingText, InlineText } from "./ReadingText"

/** 同一句話講三種時態，讀者不必自己算日期。 */
function dueText(days: number): string {
  if (days > 0) return `逾期 ${days} 天`
  return days === 0 ? "今天到期" : `還有 ${-days} 天`
}

/** 三塊共用的外框：標題、來源、狀態、以及讀不到時那一句中文原因。 */
function Block({block, summary, children}: {block: PendingBlock; summary: ReactNode; children: ReactNode}) {
  const down = block.state === "unavailable"
  return <Card className="flex min-w-0 flex-col gap-2 p-3">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-section font-semibold text-ink">{block.title}</h3>
        {down ? <Chip tone="warn">這次無法取得</Chip> : summary}
      </div>
      <span className="break-all text-caption text-ink-3">{block.source}</span>
    </div>
    <p className="text-caption text-ink-3">{block.note}</p>
    {down ? <p role="status" className="text-body text-warn">{block.message}</p> : children}
    {block.limitations.map((note, i) => <p key={i} className="text-caption text-ink-3">{note}</p>)}
  </Card>
}

function Revisit({data}: {data: PendingRevisit}) {
  const counts = data.counts
  return <Block block={data} summary={<Chip tone={counts.due_unmarked ? "warn" : "ok"}>{counts.due_unmarked ?? 0} 筆 · {counts.groups ?? 0} 組</Chip>}>
    <div className="flex min-w-0 flex-col gap-2">
      {data.groups.length === 0
        ? <p className="text-body text-ink-3">目前沒有到期、還沒標記確認的舊判斷。</p>
        : <ul className="flex flex-col divide-y divide-line-soft">
            {data.groups.map(group => <li key={group.label} className="py-2">
              <details>
                <summary className="cursor-pointer text-body text-ink">
                  <span className="font-medium">{group.label}</span>
                  <span className="text-ink-3">　{group.items.length} 筆 · 最久{dueText(group.overdue_days)}</span>
                </summary>
                <ul className="flex flex-col gap-2 pt-2">
                  {group.items.map((item, i) => <li key={`${item.due}:${item.horizon}:${i}`} className="flex min-w-0 flex-col gap-1">
                    <span className="text-body text-ink"><InlineText text={item.decision}/></span>
                    <span className="text-caption text-ink-3">
                      決策後 {item.horizon} 天回看 · 到期 {item.due} · {dueText(item.overdue_days)}
                      {item.candidate_runs.length ? ` · 可能已在 ${item.candidate_runs.join("、")} 的復盤紀錄中確認` : ""}
                    </span>
                  </li>)}
                </ul>
              </details>
            </li>)}
          </ul>}
      {counts.marked || counts.not_applicable
        ? <p className="text-caption text-ink-3">另有 {counts.marked ?? 0} 格已標記確認、{counts.not_applicable ?? 0} 格這一期不需回看，兩者都不列。</p>
        : null}
    </div>
  </Block>
}

function Gate({data}: {data: PendingGate}) {
  const counts = data.counts
  return <Block block={data} summary={<Chip tone={counts.due ? "warn" : "ok"}>{counts.due ?? 0} 項到期 · 登記 {counts.registered ?? 0} 項</Chip>}>
    {data.items.length === 0
      ? <p className="text-body text-ink-3">目前沒有登記中的待確認事項。</p>
      : <ul className="flex flex-col divide-y divide-line-soft">
          {data.items.map(item => <li key={item.id} className="flex min-w-0 flex-col gap-1 py-2">
            <span className="text-body text-ink"><InlineText text={item.what}/></span>
            <span className={item.overdue_days >= 0 ? "text-caption text-warn" : "text-caption text-ink-3"}>
              {dueText(item.overdue_days)} · 到期 {item.due} · {item.file}:{item.line}
            </span>
          </li>)}
        </ul>}
  </Block>
}

function Weekly({data}: {data: PendingWeekly}) {
  const open = data.action_items.filter(item => !item.done).length
  return <Block block={data} summary={<Chip tone={open ? "warn" : "ok"}>{data.alerts.length} 則警示 · {open} 項待辦</Chip>}>
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-caption text-ink-3">
        {data.date ? `${data.date} 的週報` : "尚無週報"}
        {data.age_days === null ? "" : ` · ${data.age_days} 天前產出`}
        {data.path ? ` · ${data.path}` : ""}
      </p>
      {data.alerts.length ? <ul className="flex flex-col gap-2">
        {data.alerts.map((alert, i) => <li key={i} className="flex min-w-0 flex-col gap-1">
          <details>
            <summary className="flex cursor-pointer flex-wrap items-center gap-2">
              <Chip tone={alert.tone === "bad" ? "bad" : alert.tone === "warn" ? "warn" : "info"}>警示</Chip>
              <span className="text-body text-ink"><InlineText text={alert.title}/></span>
            </summary>
            <div className="pt-2"><ReadingText text={alert.body}/></div>
          </details>
        </li>)}
      </ul> : null}
      {data.action_items.length ? <div className="flex flex-col gap-2">
        <h4 className="text-body font-medium text-ink">週報中的待辦</h4>
        <ul className="flex flex-col gap-2">
          {data.action_items.map((item, i) => <li key={i} className="flex min-w-0 flex-col gap-1">
            <span className="text-body text-ink-2">
              {item.done ? <Chip tone="mute">已完成</Chip> : null}
              {item.done ? " " : ""}<InlineText text={item.text}/>
            </span>
            {item.detail.length ? <ul className="flex list-disc flex-col gap-1 pl-4">
              {item.detail.map((line, n) => <li key={n} className="text-caption text-ink-3"><InlineText text={line}/></li>)}
            </ul> : null}
          </li>)}
        </ul>
      </div> : null}
    </div>
  </Block>
}

/** 系統整理的提醒：三個既有工具的結果，看板只讀不寫。 */
export function PendingBoard() {
  const query = useQuery({queryKey: ["investment-pending"], queryFn: ({signal}) => getInvestmentPending(signal), retry: false, refetchOnWindowFocus: false})
  const data: InvestmentPending | undefined = query.data
  return <section className="flex min-w-0 flex-col gap-3" aria-label="系統整理的提醒">
    <div className="flex flex-col gap-1">
      <SectionHeading>系統整理的提醒</SectionHeading>
      <p className="text-caption text-ink-3">{data?.scope ?? "投資筆記整理的回看、待確認事項與每週觀察；看板只顯示，不寫回投資筆記。"}</p>
    </div>
    {query.isPending ? <p className="text-body text-ink-3">正在讀取舊判斷、待確認事項與每週觀察…</p> : null}
    {query.isError ? <p role="alert" className="text-body text-warn">系統提醒這次讀取失敗，請按更新全部重試。</p> : null}
    {data ? <>
      <Revisit data={data.revisit}/>
      <Gate data={data.gate}/>
      <Weekly data={data.weekly}/>
    </> : null}
  </section>
}
