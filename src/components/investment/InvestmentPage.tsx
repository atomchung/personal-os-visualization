import { useState } from "react"
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query"
import { DEMO_MODE } from "@/lib/transport"
import { Button } from "@/components/ui/button"
import { Card, SectionHeading, SubsectionHeading } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { MarketIndicators } from "./MarketIndicators"
import { briefActions, groupBriefRows, sourceTimestamp } from "@/lib/investmentFormat"
import { StockMomentum } from "./StockMomentum"
import { ResearchWatch, ResearchLibrary } from "./ResearchWatch"
import { ReadingText, InlineText } from "./ReadingText"
import { InvestmentWorkPanel } from "./InvestmentWork"
import { PendingBoard } from "./InvestmentPending"
import { InvestmentHistory } from "./InvestmentHistory"
import {
  BRIEF_SESSION_LABELS, getInvestment, getInvestmentWatch, getInvestmentMarket,
  getInvestmentPending, getInvestmentHistory, getInvestmentContext, getMomentumLeaders,
  getMomentumUniverse, getStockMomentum, getStockQuote, getInvestmentSource, getInvestmentWork,
  type InvestmentBrief, type InvestmentSource,
} from "@/lib/investment"

function SourceText({ source }: { source: InvestmentSource }) {
  const [open, setOpen] = useState(false)
  const query = useQuery({ queryKey: ["investment-source", source.id, source.generated_at], queryFn: ({ signal }) => getInvestmentSource(source.id, signal), enabled: open, staleTime: 0, retry: false, refetchOnWindowFocus: false })
  return <details onToggle={e => setOpen(e.currentTarget.open)}>
    <summary className="cursor-pointer py-2 text-body font-medium">閱讀完整簡報 · {source.date ?? "日期未提供"}</summary>
    <div className="max-w-[900px] pt-3">{query.isPending ? <p className="text-body text-ink-3">載入原文中…</p> : query.isError ? <p role="alert" className="text-body text-warn">簡報原文讀取失敗，請按更新資料。</p> : query.data ? <ReadingText text={query.data.text} /> : null}</div>
  </details>
}

function ThesisRows({ rows }: { rows: InvestmentBrief["thesis_changes"] }) {
  return <ul className="flex flex-col gap-3">{rows.map((row, index) => <li key={index} className="text-body leading-relaxed text-ink-2">
    <p><span className="font-medium text-ink"><InlineText text={row.thesis} /></span>{row.change ? <> · <InlineText text={row.change} /></> : null}</p>
    {row.reason ? <p className="mt-1"><InlineText text={row.reason} /></p> : null}
  </li>)}</ul>
}

function RiskRows({ rows }: { rows: InvestmentBrief["risks"] }) {
  return <ul className="flex flex-col gap-3">{rows.map((row, index) => <li key={index} className="text-body leading-relaxed text-ink-2">
    <p className="font-medium text-warn"><InlineText text={row.risk} /></p>
    {row.status ? <p className="mt-1"><InlineText text={row.status} /></p> : null}
  </li>)}</ul>
}

function ActionList({ actions }: { actions: string[] }) {
  return <ul className="flex list-disc flex-col gap-2 pl-5 text-body leading-relaxed text-ink-2">{actions.map((action, index) => <li key={index}><InlineText text={action} /></li>)}</ul>
}

/** Reading structure only. Meaning, order, changes and event links come from the source. */
function TodayBrief({ b }: { b: InvestmentBrief }) {
  const version = b.session ? BRIEF_SESSION_LABELS[b.session] : null
  const actions = briefActions(b.actions)
  const theses = groupBriefRows(b.thesis_changes, b.events.length)
  const risks = groupBriefRows(b.risks, b.events.length)
  const hasUnlinked = theses.unlinked.length > 0 || risks.unlinked.length > 0 || b.thesis_notes.length > 0 || b.risk_notes.length > 0
  return <section aria-label="今日簡報" className="flex min-w-0 flex-col gap-6 break-words">
    <Card className="min-w-0 overflow-hidden border-l-4 border-l-accent shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-soft bg-bg-2 px-4 py-3 sm:px-5">
        <SectionHeading>今日判斷</SectionHeading>
        <span className="text-caption text-ink-3">{b.date ?? "日期未提供"}{version ? ` · ${version}` : " · 版次未標示"}</span>
      </div>
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        {b.state === "stale" ? <p role="status" className="text-caption text-warn">目前是較早的簡報，請留意資料截止時間。</p> : null}
        {b.state === "invalid" ? <p role="status" className="text-caption text-warn">這份簡報部分內容未能辨識，已保留可讀段落與完整原文。</p> : null}
        <div className="max-w-[960px] text-section leading-relaxed text-ink">{b.headline ? <ReadingText text={b.headline} /> : <p className="text-body text-ink-3">尚未取得可讀的投資判斷。</p>}</div>
        <div className="border-t border-line-soft pt-4">
          <SubsectionHeading>下一步</SubsectionHeading>
          <div className="mt-2">{actions.length ? <>
            <ActionList actions={actions.slice(0, 3)} />
            {actions.length > 3 ? <details className="mt-2"><summary className="cursor-pointer py-2 text-caption font-medium">另有 {actions.length - 3} 項下一步</summary><ActionList actions={actions.slice(3)} /></details> : null}
          </> : <p className="text-body text-ink-3">這份簡報沒有列出具體下一步；不代表不需要行動。</p>}</div>
        </div>
        <div className="border-t border-line-soft pt-3 text-caption text-ink-3">
          <p>資料截至 {sourceTimestamp(b.source_cutoff)}</p>
          <details><summary className="cursor-pointer py-2">簡報時間與完整度</summary>
            <p>產出時間：{sourceTimestamp(b.generated_at)}</p>
            {b.source?.limitations.length ? <ul className="mt-2 list-disc pl-4 text-warn">{b.source.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul> : null}
          </details>
        </div>
        {b.source?.limitations.length ? <p role="status" className="text-caption text-warn">部分來源或段落不完整，詳見上方「簡報時間與完整度」。</p> : null}
      </div>
    </Card>

    {b.events.length > 0 || b.event_notes.length > 0 ? <section aria-label="今日變化與持倉影響" className="flex min-w-0 flex-col gap-3">
      <SectionHeading>今日變化與持倉影響</SectionHeading>
      {b.events.length ? <Card className="min-w-0 divide-y divide-line-soft overflow-hidden">{b.events.map((event, index) => <article key={`${b.date}:${index}`} className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
        <SubsectionHeading><InlineText text={event.event} /></SubsectionHeading>
        {event.impact ? <p className="text-body leading-relaxed text-ink-2"><span className="font-medium text-ink">對持倉的影響：</span><InlineText text={event.impact} /></p> : null}
        {event.today ? <p className="text-body leading-relaxed text-ink-2"><span className="font-medium text-ink">現在要注意：</span><InlineText text={event.today} /></p> : null}
        {event.interpretation ? <p className="text-body leading-relaxed text-ink-2"><InlineText text={event.interpretation} /></p> : null}
        {theses.byEvent[index].length ? <div className="border-l-2 border-line pl-3"><p className="mb-2 text-caption font-medium text-ink-3">投資判斷</p><ThesisRows rows={theses.byEvent[index]} /></div> : null}
        {risks.byEvent[index].length ? <div className="border-l-2 border-warn pl-3"><p className="mb-2 text-caption font-medium text-warn">要留意的風險</p><RiskRows rows={risks.byEvent[index]} /></div> : null}
        {event.market_reaction ? <details><summary className="cursor-pointer py-2 text-caption font-medium text-ink-3">市場反應與細節</summary><div className="pt-1 text-body leading-relaxed text-ink-2"><InlineText text={event.market_reaction} /></div></details> : null}
      </article>)}</Card> : null}
      {b.event_notes.length ? <ReadingText text={b.event_notes.join("\n\n")} /> : null}
    </section> : null}

    {hasUnlinked ? <section aria-label="投資判斷與風險" className="flex min-w-0 flex-col gap-3">
      <SectionHeading>投資判斷與風險</SectionHeading>
      <Card className="grid min-w-0 gap-5 p-4 sm:p-5">
        {theses.unlinked.length > 0 || b.thesis_notes.length > 0 ? <div className="flex min-w-0 flex-col gap-3"><SubsectionHeading>判斷的變化與理由</SubsectionHeading><ThesisRows rows={theses.unlinked} />{b.thesis_notes.length ? <ReadingText text={b.thesis_notes.join("\n\n")} /> : null}</div> : null}
        {risks.unlinked.length > 0 || b.risk_notes.length > 0 ? <div className="flex min-w-0 flex-col gap-3"><SubsectionHeading>要留意的風險</SubsectionHeading><RiskRows rows={risks.unlinked} />{b.risk_notes.length ? <ReadingText text={b.risk_notes.join("\n\n")} /> : null}</div> : null}
      </Card>
    </section> : null}

    {b.upcoming.length > 0 || b.upcoming_notes.length > 0 ? <section aria-label="接下來要留意" className="flex min-w-0 flex-col gap-3">
      <SectionHeading>接下來要留意</SectionHeading>
      <Card className="min-w-0 divide-y divide-line-soft overflow-hidden">{b.upcoming.map((item, index) => <div key={index} className="flex min-w-0 flex-col gap-1 p-4 sm:p-5">
        <p className="text-caption text-ink-3">{item.date_label || "日期未提供"}</p>
        <p className="text-body font-medium"><InlineText text={item.event} /></p>
        {item.check ? <p className="text-body leading-relaxed text-ink-2"><InlineText text={item.check} /></p> : null}
      </div>)}</Card>
      {b.upcoming_notes.length ? <ReadingText text={b.upcoming_notes.join("\n\n")} /> : null}
    </section> : null}

    {b.market_pulse.length > 0 || b.market_pulse_notes.length > 0 ? <section aria-label="市場正在定價什麼" className="flex min-w-0 flex-col gap-3">
      <div><SectionHeading>市場正在定價什麼</SectionHeading><p className="mt-1 text-caption text-ink-3">簡報當時的市場解讀 · {sourceTimestamp(b.source_cutoff)}</p></div>
      {b.market_pulse.length ? <Card className="min-w-0 divide-y divide-line-soft overflow-hidden">{b.market_pulse.map((item, index) => <div key={index} className="grid min-w-0 gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:p-5">
        <div><p className="text-body font-medium"><InlineText text={item.variable} /></p><p className="mt-1 text-body text-ink-2"><InlineText text={item.latest} /></p></div>
        <p className="text-body leading-relaxed text-ink-2"><InlineText text={item.meaning} /></p>
      </div>)}</Card> : null}
      {b.market_pulse_notes.length ? <ReadingText text={b.market_pulse_notes.join("\n\n")} /> : null}
    </section> : null}
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
  const watch = useQuery({ queryKey: ["investment-watch"], queryFn: ({ signal }) => getInvestmentWatch(signal), retry: false, refetchOnWindowFocus: false })
  const history = useQuery({ queryKey: ["investment-history"], queryFn: ({ signal }) => getInvestmentHistory(signal), enabled: view === "history", retry: false, refetchOnWindowFocus: false })
  const context = useQuery({ queryKey: ["investment-context"], queryFn: ({ signal }) => getInvestmentContext(signal), enabled: view === "history", retry: false, refetchOnWindowFocus: false })
  const b = query.data?.brief
  function openView(next: View) {
    setView(next)
    document.getElementById(`investment-tab-${next}`)?.focus()
  }
  async function refresh() {
    setRefreshing(true)
    setNotice("正在更新簡報、研究、持倉與市場行情…")
    const failures: string[] = []
    async function run<T>(label: string, key: readonly unknown[], fn: () => Promise<T>): Promise<T | undefined> {
      try { return await client.fetchQuery({ queryKey: key, queryFn: fn, staleTime: 0, retry: false }) }
      catch { failures.push(label); return undefined }
    }
    try {
      const [brief, research, market, universe, , pending, leaders] = await Promise.all([
        run("簡報", ["investment"], () => getInvestment()), run("研究", ["investment-watch"], () => getInvestmentWatch()),
        run("市場行情", ["investment-market"], () => getInvestmentMarket(undefined, true)), run("股票清單", ["investment-momentum-universe"], () => getMomentumUniverse()),
        run("我的投資事項", ["investment-work"], () => getInvestmentWork()),
        run("系統提醒", ["investment-pending"], () => getInvestmentPending()),
        run("清單動能", ["investment-momentum-leaders"], () => getMomentumLeaders(undefined, true)),
      ])
      if (brief?.brief.state === "invalid" || brief?.brief.state === "missing") failures.push("簡報內容")
      if (research?.coverage.errors.length) failures.push("部分研究來源")
      if (brief?.brief.source?.limitations.length) failures.push("簡報部分段落")
      if (market?.state === "unavailable" || market?.state === "partial") failures.push("部分市場報價")
      if (pending) failures.push(...([["舊判斷回看", pending.revisit], ["待確認事項", pending.gate], ["每週觀察", pending.weekly]] as const).filter(([, item]) => item.state === "unavailable").map(([label]) => label))
      if (universe?.state === "unavailable") failures.push("股票清單")
      if (leaders?.state === "unavailable" || leaders?.state === "partial") failures.push("清單動能部分日線")
      if (universe?.state === "ready") {
        const results = await Promise.all(universe.symbols.map(symbol => run(symbol, ["investment-momentum", symbol], () => getStockMomentum(symbol, undefined, true))))
        results.forEach((result, index) => { if (result?.daily.state === "unavailable") failures.push(`${universe.symbols[index]} 日線`) })
        const quotes = await Promise.all(universe.symbols.map(symbol => run(`${symbol} 最新價`, ["investment-quote", symbol], () => getStockQuote(symbol, undefined, true))))
        quotes.forEach((quote, index) => { if (quote && quote.state !== "available") failures.push(`${universe.symbols[index]} 最新價`) })
      }
      if (view === "history") {
        const [records] = await Promise.all([
          run("歷史來源", ["investment-history"], () => getInvestmentHistory()),
          run("研究脈絡", ["investment-context"], () => getInvestmentContext()),
        ])
        if (records && records.state !== "ready") failures.push("部分歷史來源")
      }
      await client.invalidateQueries({ queryKey: ["investment-source"], refetchType: "active" })
      if (client.getQueryCache().findAll({ queryKey: ["investment-source"], type: "active" }).some(item => item.state.status === "error")) failures.push("簡報原文")
      const at = new Date().toLocaleTimeString("zh-TW", { timeZone: "Asia/Taipei", hour12: false })
      setNotice(`${at} ${failures.length ? `已重新讀取，仍未取得：${[...new Set(failures)].join("、")}` : "已重新讀取資料"}。簡報與行情各自的截止時間仍以頁面標示為準。`)
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
      <StockMomentum />
      {watch.data?.research.length ? <section aria-label="繼續研究" className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><SectionHeading>繼續研究</SectionHeading><Button variant="link" onClick={() => openView("work")}>查看研究與證據</Button></div>
        <Card className="min-w-0 divide-y divide-line-soft overflow-hidden">{watch.data.research.slice(0, 3).map(item => <div key={item.id} className="flex min-w-0 flex-col gap-1 p-4">
          <p className="text-body font-medium"><InlineText text={item.title} /></p>
          {item.purpose ? <p className="text-body leading-relaxed text-ink-2"><InlineText text={item.purpose} /></p> : null}
          <p className="text-caption text-ink-3">{item.topic} · 更新 {item.source.updated ?? "日期未提供"}</p>
        </div>)}</Card>
        {watch.data.research.length > 3 ? <p className="text-caption text-ink-3">另有 {watch.data.research.length - 3} 項研究，完整內容留在「正在研究」。</p> : null}
      </section> : null}
    </div>
    <div id="investment-panel-work" role="tabpanel" aria-labelledby="investment-tab-work" hidden={view !== "work"} className={view === "work" ? "flex min-w-0 flex-col gap-5" : "hidden"}>
      <section className="flex min-w-0 flex-col gap-3" aria-label="我留下的問題與研究">
        <div className="flex flex-col gap-1"><SectionHeading>我留下的問題與研究</SectionHeading><p className="text-caption text-ink-3">在這裡接續問題與研究，系統整理的提醒另列在下方。</p></div>
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
    {watch.isError ? <p role="alert" className="text-body text-warn">研究與重要日期本次讀取失敗。{watch.data ? "仍顯示上次內容。" : ""}</p> : null}
    <details className="border-t border-line-soft pt-3"><summary className="cursor-pointer py-2 text-caption text-ink-3">資料來源與讀取狀況{watch.data?.coverage.errors.length ? ` · ${watch.data.coverage.errors.length} 項異常` : ""}</summary><div className="flex flex-col gap-2 pt-2 text-caption text-ink-3">
      <p>{DEMO_MODE ? "簡報、研究、日期與行情全由合成資料提供。更新資料只重讀範例，不連接帳戶或外部資料。" : "簡報、研究和日期讀取本機 Investment Note；行情向 Yahoo Finance 查詢。更新資料不會同步 Git 或重新生成 AI 簡報。"}</p>
      <p>每週觀察：{query.data?.weekly_watch.date ?? "尚未取得日期"}。目前只提供日期，無法據此確認本週回顧是否完成。</p>
      <p>投資論點的自動檢查尚未接入；没有提醒不代表論點已通過檢查。</p>
      {watch.data ? <><p>已讀 {watch.data.coverage.scanned_files} 份相關來源；{watch.data.coverage.missing_catalysts.length} 份未填下次事件日期。未填日期不算讀取故障。</p>{watch.data.coverage.errors.map((error, index) => <p key={index}>{error.path}：{error.message}</p>)}{watch.data.coverage.omissions.length ? <p>另有 {watch.data.coverage.omissions.length} 份相關來源未納入：{watch.data.coverage.omissions.slice(0, 5).map(item => `${item.path}（${item.reason}）`).join("、")}</p> : null}</> : null}
    </div></details>
  </div>
}
