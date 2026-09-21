import { useState } from "react"
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query"
import { DEMO_MODE } from "@/lib/transport"
import { Button } from "@/components/ui/button"
import { Card, SectionHeading, SubsectionHeading } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { PageHeader } from "@/components/ui/page-header"
import { MarketIndicators } from "./MarketIndicators"
import { MarketExplore } from "./MarketExplore"
import {
  actionStatusLabel, actionStatusNote, briefActions, groupBriefRows, openActionItems,
  sourceTimestamp,
} from "@/lib/investmentFormat"
import { ResearchWatch, ResearchLibrary } from "./ResearchWatch"
import { ReadingText, InlineText } from "./ReadingText"
import { InvestmentWorkPanel } from "./InvestmentWork"
import { PendingBoard } from "./InvestmentPending"
import { InvestmentHistory } from "./InvestmentHistory"
import {
  BRIEF_SESSION_LABELS, getInvestment, getInvestmentWatch, getInvestmentMarket,
  getInvestmentPending, getInvestmentHistory, getInvestmentContext,
  getInvestmentSource, getInvestmentWork,
  getInvestmentActions, getMarketExplore,
  type InvestmentActionItem, type InvestmentBrief, type InvestmentSource,
} from "@/lib/investment"

function SourceText({ source }: { source: InvestmentSource }) {
  const [open, setOpen] = useState(false)
  const query = useQuery({ queryKey: ["investment-source", source.id, source.generated_at], queryFn: ({ signal }) => getInvestmentSource(source.id, signal), enabled: open, staleTime: 0, retry: false, refetchOnWindowFocus: false })
  return <details onToggle={e => setOpen(e.currentTarget.open)}>
    <summary className="cursor-pointer py-2 text-body font-medium">閱讀完整簡報 · {source.date ?? "日期未提供"}</summary>
    <div className="max-w-[900px] pt-3">{query.isPending ? <p className="text-body text-ink-3">載入原文中…</p> : query.isError ? <p role="alert" className="text-body text-warn">簡報原文讀取失敗，請按更新資料。</p> : query.data ? <ReadingText text={query.data.text} /> : null}</div>
  </details>
}

function todayText(text: string): string {
  return text
    .replace(/\bCORE\b/g, "半導體核心（NVDA／台積電）")
    .replace(/\bMEMORY\b/g, "記憶體")
    .replace(/\bINTERCONNECT\b/g, "AI 互連")
    .replace(/相對強度/g, "相對大盤強弱")
}

function ThesisRows({ rows }: { rows: InvestmentBrief["thesis_changes"] }) {
  return <ul className="flex flex-col gap-3">{rows.map((row, index) => <li key={index} className="text-body leading-relaxed text-ink-2">
    <p><span className="font-medium text-ink"><InlineText text={todayText(row.thesis)} /></span>{row.change ? <> · <InlineText text={todayText(row.change)} /></> : null}</p>
    {row.reason ? <p className="mt-1"><InlineText text={todayText(row.reason)} /></p> : null}
  </li>)}</ul>
}

function RiskRows({ rows }: { rows: InvestmentBrief["risks"] }) {
  return <ul className="flex flex-col gap-3">{rows.map((row, index) => <li key={index} className="text-body leading-relaxed text-ink-2">
    <p className="font-medium text-warn"><InlineText text={todayText(row.risk)} /></p>
    {row.status ? <p className="mt-1"><InlineText text={todayText(row.status)} /></p> : null}
  </li>)}</ul>
}

function statusTone(status: InvestmentActionItem["status"]): "warn" | "info" | "ok" {
  if (status === "open") return "warn"
  if (status === "closed") return "ok"
  return "info"
}

function ContinuationRow({ item, showDate }: { item: InvestmentActionItem; showDate: boolean }) {
  const note = actionStatusNote(item.status)
  return <li className="flex min-w-0 flex-col gap-1">
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <p className="min-w-0 text-body leading-relaxed text-ink-2"><InlineText text={item.text} /></p>
      <Chip tone={statusTone(item.status)}>{actionStatusLabel(item.status)}</Chip>
    </div>
    {note ? <p className="text-caption text-ink-3">{note}</p> : null}
    {showDate ? <p className="text-caption text-ink-3">{item.date || "日期未提供"}</p> : null}
    <details>
      <summary className="cursor-pointer py-1 text-caption text-ink-3">編號與來源</summary>
      <div className="flex flex-col gap-1 pt-1 text-caption text-ink-3">
        <p>編號：{item.id}</p>
        {!showDate && item.date ? <p>日期：{item.date}</p> : null}
        {item.tickers.length ? <p>相關標的：{item.tickers.join("、")}</p> : null}
        {item.evidence.length ? <p>證據：{item.evidence.join("、")}</p> : null}
        <p>來源：{item.source}</p>
      </div>
    </details>
  </li>
}

function ContinuationList({ items, compact = false, olderCount = 0, onOpenWork }: { items: InvestmentActionItem[]; compact?: boolean; olderCount?: number; onOpenWork?: () => void }) {
  if (!items.length && !olderCount) return null
  const limit = compact ? 2 : 8
  const shown = items.slice(0, limit)
  const rest = items.slice(limit)
  return <div className="flex min-w-0 flex-col gap-2">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <SubsectionHeading>尚未結束的行動</SubsectionHeading>
      {onOpenWork ? <Button variant="link" onClick={onOpenWork}>到正在研究</Button> : null}
    </div>
    <p className="text-caption text-ink-3">{compact ? "還沒結束；可到正在研究接著看。" : "來自判斷與研究紀錄，和你在本機記下的問題分開。"}{olderCount ? ` 更早的 ${olderCount} 項留在「正在研究」。` : ""}</p>
    <ul className="flex min-w-0 flex-col gap-2">{shown.map(item => <ContinuationRow key={item.id} item={item} showDate={!compact} />)}</ul>
    {rest.length ? <details><summary className="cursor-pointer py-2 text-caption font-medium">另有 {rest.length} 項尚未結束</summary><ul className="mt-2 flex min-w-0 flex-col gap-2">{rest.map(item => <ContinuationRow key={item.id} item={item} showDate={!compact} />)}</ul></details> : null}
  </div>
}

function todayFollowups(b: InvestmentBrief): string[] {
  const raw = b.action_items?.length ? b.action_items.map(item => item.text) : b.actions
  return briefActions(raw)
    .map(text => text.replace(/[*_`~]/g, "").trim())
    .filter(text => !/^補研究[：:]/.test(text))
    .map(text => todayText(text.replace(/^(?:繼續觀察|觀察|行動)[：:]\s*/, "")))
    .filter(Boolean)
    .slice(0, 2)
}

/** Reading structure only. Meaning, order, changes and event links come from the source. */
function TodayBrief({ b }: { b: InvestmentBrief }) {
  const version = b.session ? BRIEF_SESSION_LABELS[b.session] : null
  const followups = todayFollowups(b)
  const theses = groupBriefRows(b.thesis_changes, b.events.length)
  const risks = groupBriefRows(b.risks, b.events.length)
  const hasUnlinked = theses.unlinked.length > 0 || risks.unlinked.length > 0 || b.thesis_notes.length > 0 || b.risk_notes.length > 0
  const envelopeIncomplete = b.envelope && b.envelope.completeness !== "ready"
  return <section aria-label="今日簡報" className="flex min-w-0 flex-col gap-6 break-words">
    <section aria-label="今天發生了什麼" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <SectionHeading>今天發生了什麼</SectionHeading>
        <span className="text-caption text-ink-3">{b.date ?? "日期未提供"}{version ? ` · ${version}` : " · 版次未標示"} · 資料截至 {sourceTimestamp(b.source_cutoff)}</span>
      </div>
      {b.state === "stale" ? <p role="status" className="text-caption text-warn">目前是較早的簡報，請留意資料截止時間。</p> : null}
      {b.state === "invalid" ? <p role="status" className="text-caption text-warn">這份簡報部分內容未能辨識，已保留可讀段落與完整原文。</p> : null}
      {envelopeIncomplete ? <p role="status" className="text-caption text-warn">{b.envelope?.completeness === "partial" ? "這份簡報資料不完整；細節可在下方來源展開查看。" : "這份簡報的資料包目前無法確認是否完整。"}</p> : null}
      {b.events.length ? <Card className="min-w-0 divide-y divide-line-soft overflow-hidden">{b.events.map((event, index) => <article key={`${b.date}:${index}`} className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
        <SubsectionHeading><InlineText text={todayText(event.event)} /></SubsectionHeading>
        {event.impact ? <p className="text-body leading-relaxed text-ink-2"><span className="font-medium text-ink">對持倉的影響：</span><InlineText text={todayText(event.impact)} /></p> : null}
        {event.today ? <p className="text-body leading-relaxed text-ink-2"><span className="font-medium text-ink">現在要注意：</span><InlineText text={todayText(event.today)} /></p> : null}
        {theses.byEvent[index].length ? <div className="border-l-2 border-line pl-3"><p className="mb-2 text-caption font-medium text-ink-3">判斷變化</p><ThesisRows rows={theses.byEvent[index]} /></div> : null}
        {risks.byEvent[index].length ? <div className="border-l-2 border-warn pl-3"><p className="mb-2 text-caption font-medium text-warn">要留意的風險</p><RiskRows rows={risks.byEvent[index]} /></div> : null}
        {event.interpretation || event.market_reaction ? <details><summary className="cursor-pointer py-2 text-caption font-medium text-ink-3">市場反應與細節</summary><div className="flex flex-col gap-2 pt-1 text-body leading-relaxed text-ink-2">{event.market_reaction ? <p><InlineText text={todayText(event.market_reaction)} /></p> : null}{event.interpretation ? <p><InlineText text={todayText(event.interpretation)} /></p> : null}</div></details> : null}
      </article>)}</Card> : b.headline ? <Card className="min-w-0 p-4 sm:p-5"><ReadingText text={b.headline} /></Card> : <p className="text-body text-ink-3">尚未取得可讀的今日變化。</p>}
      {b.event_notes.length ? <ReadingText text={b.event_notes.join("\n\n")} /> : null}
      {hasUnlinked ? <details className="text-caption text-ink-3"><summary className="cursor-pointer py-1">其他判斷變化</summary><Card className="mt-2 grid min-w-0 gap-5 p-4 sm:p-5">
        {theses.unlinked.length > 0 || b.thesis_notes.length > 0 ? <div className="flex min-w-0 flex-col gap-3"><ThesisRows rows={theses.unlinked} />{b.thesis_notes.length ? <ReadingText text={b.thesis_notes.join("\n\n")} /> : null}</div> : null}
        {risks.unlinked.length > 0 || b.risk_notes.length > 0 ? <div className="flex min-w-0 flex-col gap-3"><p className="text-caption font-medium text-warn">要留意的風險</p><RiskRows rows={risks.unlinked} />{b.risk_notes.length ? <ReadingText text={b.risk_notes.join("\n\n")} /> : null}</div> : null}
      </Card></details> : null}
    </section>

    <section className="flex min-w-0 flex-col gap-3" aria-label="今天怎麼做">
      <SectionHeading>今天怎麼做</SectionHeading>
      <Card className="min-w-0 p-4 sm:p-5">
        {followups.length ? <ul className="flex list-disc flex-col gap-2 pl-5 text-body leading-relaxed text-ink-2">{followups.map((item, index) => <li key={index}><InlineText text={item} /></li>)}</ul> : <p className="text-body text-ink-3">目前沒有新的動作或特別注意事項。</p>}
        {b.headline ? <details className="mt-4 border-t border-line-soft pt-3 text-caption text-ink-3"><summary className="cursor-pointer py-1">晨報判斷</summary><div className="max-w-[960px] pt-2 text-body leading-relaxed text-ink-2"><ReadingText text={b.headline} /></div></details> : null}
        {b.source?.limitations.length || b.envelope?.limitations.length ? <details className="mt-3 border-t border-line-soft pt-3 text-caption text-ink-3"><summary className="cursor-pointer py-1">資料完整度</summary>
          {b.envelope?.producer ? <p className="mt-2">產出方式：{b.envelope.producer}</p> : null}
          {b.envelope?.limitations.length ? <ul className="mt-2 list-disc pl-4 text-warn">{b.envelope.limitations.map((limitation, index) => <li key={`envelope-${index}`}>{limitation}</li>)}</ul> : null}
          {b.source?.limitations.length ? <ul className="mt-2 list-disc pl-4 text-warn">{b.source.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul> : null}
        </details> : null}
      </Card>
    </section>

    {b.source ? <div className="border-t border-line-soft"><SourceText key={b.source.id} source={b.source} /></div> : null}
  </section>
}

const VIEWS = [["today", "今日"], ["work", "正在研究"], ["month", "近期要留意"], ["history", "舊判斷回看"]] as const
type View = typeof VIEWS[number][0]

export function InvestmentPage() {
  const [view, setView] = useState<View>("today")
  const [refreshing, setRefreshing] = useState(false)
  const [notice, setNotice] = useState("")
  const client = useQueryClient()
  const fetching = useIsFetching({ predicate: q => String(q.queryKey[0]).startsWith("investment") })
  const query = useQuery({ queryKey: ["investment"], queryFn: ({ signal }) => getInvestment(signal), retry: false, refetchOnWindowFocus: true, staleTime: 60_000 })
  const watch = useQuery({ queryKey: ["investment-watch"], queryFn: ({ signal }) => getInvestmentWatch(signal), enabled: view === "work" || view === "month", retry: false, refetchOnWindowFocus: false })
  const actions = useQuery({ queryKey: ["investment-actions"], queryFn: ({ signal }) => getInvestmentActions(signal), enabled: view === "work", retry: false, refetchOnWindowFocus: false, staleTime: 60_000 })
  const history = useQuery({ queryKey: ["investment-history"], queryFn: ({ signal }) => getInvestmentHistory(signal), enabled: view === "history", retry: false, refetchOnWindowFocus: false })
  const context = useQuery({ queryKey: ["investment-context"], queryFn: ({ signal }) => getInvestmentContext(signal), enabled: view === "history", retry: false, refetchOnWindowFocus: false })
  const b = query.data?.brief
  const workContinuation = openActionItems(actions.data?.items ?? [])
  function openView(next: View) {
    setView(next)
    document.getElementById(`investment-tab-${next}`)?.focus()
  }
  async function refresh() {
    setRefreshing(true)
    setNotice("正在更新目前頁面的資料…")
    const failures: string[] = []
    async function run<T>(label: string, key: readonly unknown[], fn: () => Promise<T>): Promise<T | undefined> {
      try { return await client.fetchQuery({ queryKey: key, queryFn: fn, staleTime: 0, retry: false }) }
      catch { failures.push(label); return undefined }
    }
    try {
      if (view === "today") {
        const [brief, market, explore] = await Promise.all([
          run("簡報", ["investment"], () => getInvestment()),
          run("市場行情", ["investment-market"], () => getInvestmentMarket(undefined, true)),
          run("市場探索", ["investment-explore"], () => getMarketExplore(undefined, true)),
        ])
        if (brief?.brief.state === "invalid" || brief?.brief.state === "missing") failures.push("簡報內容")
        if (brief?.brief.source?.limitations.length) failures.push("簡報部分段落")
        if (market?.state === "unavailable" || market?.state === "partial") failures.push("部分市場報價")
        if (explore?.state === "partial") failures.push("部分市場探索")
        await client.invalidateQueries({ queryKey: ["investment-source"], refetchType: "active" })
      } else if (view === "work") {
        const [research, actionBoard] = await Promise.all([
          run("研究", ["investment-watch"], () => getInvestmentWatch()),
          run("待續行動", ["investment-actions"], () => getInvestmentActions()),
          run("我的投資事項", ["investment-work"], () => getInvestmentWork()),
          run("系統提醒", ["investment-pending"], () => getInvestmentPending()),
        ])
        if (research?.coverage.errors.length) failures.push("部分研究來源")
        if (actionBoard?.state === "unavailable") failures.push("待續行動")
      } else if (view === "month") {
        const research = await run("重要日期", ["investment-watch"], () => getInvestmentWatch())
        if (research?.coverage.errors.length) failures.push("部分日期來源")
      } else {
        const [records] = await Promise.all([
          run("歷史來源", ["investment-history"], () => getInvestmentHistory()),
          run("研究脈絡", ["investment-context"], () => getInvestmentContext()),
        ])
        if (records && records.state !== "ready") failures.push("部分歷史來源")
      }
      const at = new Date().toLocaleTimeString("zh-TW", { timeZone: "Asia/Taipei", hour12: false })
      setNotice(`${at} ${failures.length ? `已重新讀取，仍未取得：${[...new Set(failures)].join("、")}` : "已重新讀取目前頁面"}。各資料的截止時間仍以頁面標示為準。`)
    } finally { setRefreshing(false) }
  }
  return <div className="flex min-w-0 flex-col gap-4 break-words">
    <PageHeader page="investment" action={<Button disabled={refreshing || fetching > 0} onClick={() => void refresh()}>{refreshing ? "更新中…" : fetching > 0 ? "資料載入中…" : "更新資料"}</Button>} />
    {notice ? <p role="status" aria-live="polite" className="text-caption text-ink-3">{notice}</p> : null}
    <nav aria-label="投資內容" className="flex min-w-0 gap-4 overflow-x-auto border-b border-line-soft sm:gap-5" role="tablist">{VIEWS.map(([key, label], index) => <Button key={key} id={`investment-tab-${key}`} role="tab" aria-controls={`investment-panel-${key}`} aria-selected={view === key} tabIndex={view === key ? 0 : -1} variant="link" className={`shrink-0 rounded-none border-b-2 px-0 py-3 ${view === key ? "border-accent text-ink" : "border-transparent text-ink-3"}`} onClick={() => setView(key)} onKeyDown={event => {
      const next = event.key === "ArrowRight" ? (index + 1) % VIEWS.length : event.key === "ArrowLeft" ? (index + VIEWS.length - 1) % VIEWS.length : event.key === "Home" ? 0 : event.key === "End" ? VIEWS.length - 1 : null
      if (next !== null) { event.preventDefault(); openView(VIEWS[next][0]) }
    }}>{label}</Button>)}</nav>
    <div id="investment-panel-today" role="tabpanel" aria-labelledby="investment-tab-today" hidden={view !== "today"} className={view === "today" ? "flex min-w-0 flex-col gap-6" : "hidden"}>
      {query.isError ? <p role="alert" className="text-body text-warn">簡報讀取失敗。{b ? "目前保留上次內容。" : ""}請按更新資料重試。</p> : null}
      {query.isPending ? <p className="text-body text-ink-3">讀取簡報中…</p> : null}
      {b ? <TodayBrief b={b} /> : null}
      <MarketIndicators />
      <MarketExplore />
    </div>
    <div id="investment-panel-work" role="tabpanel" aria-labelledby="investment-tab-work" hidden={view !== "work"} className={view === "work" ? "flex min-w-0 flex-col gap-5" : "hidden"}>
      {actions.isError ? <p role="status" className="text-caption text-warn">待續行動這次讀不到。{actions.data ? "以下保留上次內容。" : ""}本機筆記仍可使用。</p> : null}
      {actions.data?.state === "unavailable" ? <p role="status" className="text-caption text-warn">{actions.data.message || "待續行動目前無法取得。"}</p> : null}
      {workContinuation.length ? <section className="flex min-w-0 flex-col gap-2" aria-label="尚未結束的行動"><ContinuationList items={workContinuation} /></section> : null}
      <section className="flex min-w-0 flex-col gap-3" aria-label="我留下的問題與研究">
        <div className="flex flex-col gap-1"><SectionHeading>我留下的問題與研究</SectionHeading><p className="text-caption text-ink-3">在這裡接續本機筆記與研究；正式待續行動列在上方，系統整理的提醒另列在下方。</p></div>
        <InvestmentWorkPanel research={watch.data?.research ?? []} />
      </section>
      {watch.data ? <ResearchLibrary data={watch.data} /> : null}
      <PendingBoard />
    </div>
    <div id="investment-panel-month" role="tabpanel" aria-labelledby="investment-tab-month" hidden={view !== "month"} className={view === "month" ? "flex min-w-0 flex-col gap-4" : "hidden"}>{watch.data ? <ResearchWatch data={watch.data} brief={b} /> : <p className="text-body text-ink-3">{watch.isError ? "日期資料讀取失敗，請按更新資料。" : "正在讀取重要日期…"}</p>}</div>
    <div id="investment-panel-history" role="tabpanel" aria-labelledby="investment-tab-history" hidden={view !== "history"} className={view === "history" ? "flex min-w-0 flex-col gap-4" : "hidden"}>
      {history.isPending || context.isPending ? <p className="text-body text-ink-3">讀取歷史與研究脈絡中…</p> : null}
      {history.isError ? <p role="alert" className="text-body text-warn">歷史來源這次無法取得，請稍後重試。</p> : null}
      {context.isError ? <p role="alert" className="text-body text-warn">研究脈絡這次無法取得；歷史資料仍可單獨查看。</p> : null}
      {history.data ? <InvestmentHistory data={history.data} context={context.data} /> : null}
    </div>
    {view !== "today" && watch.isError ? <p role="alert" className="text-body text-warn">研究與重要日期本次讀取失敗。{watch.data ? "仍顯示上次內容。" : ""}</p> : null}
    <details className="border-t border-line-soft pt-3"><summary className="cursor-pointer py-2 text-caption text-ink-3">資料來源與讀取狀況{watch.data?.coverage.errors.length ? ` · ${watch.data.coverage.errors.length} 項異常` : ""}</summary><div className="flex flex-col gap-2 pt-2 text-caption text-ink-3">
      <p>{DEMO_MODE ? "簡報、研究、日期與行情全由合成資料提供。更新資料只重讀範例，不連接帳戶或外部資料。" : "簡報、研究和日期讀取本機 Investment Note；行情向 Yahoo Finance 查詢。更新資料不會同步 Git 或重新生成 AI 簡報。"}</p>
      <p>每週觀察：{query.data?.weekly_watch.date ?? "尚未取得日期"}。目前只提供日期，無法據此確認本週回顧是否完成。</p>
      <p>投資論點的自動檢查尚未接入；没有提醒不代表論點已通過檢查。</p>
      {watch.data ? <><p>已讀 {watch.data.coverage.scanned_files} 份相關來源；{watch.data.coverage.missing_catalysts.length} 份未填下次事件日期。未填日期不算讀取故障。</p>{watch.data.coverage.errors.map((error, index) => <p key={index}>{error.path}：{error.message}</p>)}{watch.data.coverage.omissions.length ? <p>另有 {watch.data.coverage.omissions.length} 份相關來源未納入：{watch.data.coverage.omissions.slice(0, 5).map(item => `${item.path}（${item.reason}）`).join("、")}</p> : null}</> : null}
    </div></details>
  </div>
}
