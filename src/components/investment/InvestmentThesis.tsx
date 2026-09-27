import { Card, CardSection, SectionHeading, SubsectionHeading } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { ReadingText, InlineText } from "./ReadingText"
import { BRIEF_SESSION_LABELS, sourceTimestamp } from "@/lib/investmentFormat"
import type { InvestmentBrief } from "@/lib/investment"

/** The arrow is the producer's own direction mark at the head of `change`.
 * It is read, never assigned: an unmarked row keeps its text and gets no chip,
 * because guessing a direction here would invent a judgement the brief did not make. */
const ARROWS = { "↑": "上調", "↓": "下調", "→": "維持" } as const
type Arrow = keyof typeof ARROWS

function splitDirection(change: string): { arrow: Arrow | null; rest: string } {
  const head = change.trim().slice(0, 1)
  if (head in ARROWS) return { arrow: head as Arrow, rest: change.trim().slice(1).trim() }
  return { arrow: null, rest: change.trim() }
}

export function thesisDirectionCounts(rows: InvestmentBrief["thesis_changes"]): Record<Arrow | "unmarked", number> {
  const counts = { "↑": 0, "↓": 0, "→": 0, unmarked: 0 }
  for (const row of rows) {
    const { arrow } = splitDirection(row.change || "")
    counts[arrow ?? "unmarked"] += 1
  }
  return counts
}

function ThesisCard({ row, events }: { row: InvestmentBrief["thesis_changes"][number]; events: InvestmentBrief["events"] }) {
  const { arrow, rest } = splitDirection(row.change || "")
  const event = row.event_index !== null ? events[row.event_index] : undefined
  return <CardSection as="article" density="normal">
    <div className="flex min-w-0 flex-wrap items-baseline gap-2">
      <h3 className="min-w-0 text-body font-semibold leading-relaxed text-ink"><InlineText text={row.thesis} /></h3>
      {arrow ? <Chip tone="mute">{`${arrow} ${ARROWS[arrow]}`}</Chip> : null}
    </div>
    {rest ? <p className="text-body leading-relaxed text-ink-2"><span className="font-medium text-ink">今天的變化：</span><InlineText text={rest} /></p> : null}
    {row.reason ? <p className="text-body leading-relaxed text-ink-2"><span className="font-medium text-ink">依據：</span><InlineText text={row.reason} /></p> : null}
    {event ? <p className="text-caption text-ink-3">來自今日事件：<InlineText text={event.event} /></p> : null}
  </CardSection>
}

function AlertCard({ text }: { text: string }) {
  return <CardSection as="article" density="normal">
    <ReadingText text={text} />
  </CardSection>
}

/** The thesis status view keeps today's assessment and continuing risk notes
 * together while preserving their distinct source fields and time horizons. */
export function InvestmentThesis({ b }: { b: InvestmentBrief }) {
  const version = b.session ? BRIEF_SESSION_LABELS[b.session] : null
  const alerts = b.risk_notes.filter(note => note.trim())
  const structuredRisks = b.risks.filter(row => row.risk.trim())
  const unlinked = b.thesis_changes.filter(row => row.event_index === null).length
  const limitations = [...new Set([...(b.source?.limitations ?? []), ...(b.envelope?.limitations ?? [])])]
  const confirmedComplete = b.state === "current"
    && b.envelope?.completeness === "ready"
    && (!b.source || b.source.state === "current")
    && limitations.length === 0
  const sourceStatus = b.state === "missing" || b.source?.state === "missing"
    ? "簡報來源尚未取得，無法確認是否有論點變化或風險。"
    : b.state === "invalid" || b.source?.state === "invalid"
      ? "簡報未能完整辨識；空白欄位不代表沒有變化或風險。"
      : b.state === "stale" || b.source?.state === "stale"
        ? "目前使用較早的簡報資料；空白欄位不代表最新狀態沒有變化或風險。"
        : b.envelope?.completeness === "partial"
          ? "簡報來源標示內容不完整；空白欄位不代表沒有變化或風險。"
          : b.envelope?.completeness === "unavailable"
            ? "目前無法確認簡報資料是否完整；空白欄位不代表沒有變化或風險。"
            : limitations.length
              ? "簡報來源列有未完成項目；空白欄位不代表沒有變化或風險。"
              : !confirmedComplete
                ? "簡報來源未明示完整度；空白欄位不代表沒有變化或風險。"
                : null
  const emptyThesisCopy = confirmedComplete
    ? "已確認完整的簡報沒有列出論點變化。"
    : "目前沒有可讀的論點變化；請先確認簡報來源完整。"
  const emptyRiskCopy = confirmedComplete
    ? "已確認完整的簡報沒有列出風險段落。"
    : "目前沒有可讀的風險註記；請先確認簡報來源完整。"
  return <section className="flex min-w-0 flex-col gap-3 break-words" aria-label="論點近況">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <SectionHeading>論點近況</SectionHeading>
      <span className="metadata">{b.date ?? "日期未提供"}{version ? ` · ${version}` : " · 版次未標示"} · 資料截至 {sourceTimestamp(b.source_cutoff)}</span>
    </div>
    <p className="text-caption text-ink-3">這裡把今天的判斷變化和仍需留意的風險放在一起；來源欄位與時間範圍仍分開顯示。</p>
    {sourceStatus ? <p role="status" className="text-caption leading-relaxed text-warn">{sourceStatus}</p> : null}
    {limitations.length ? <ul className="list-disc pl-5 text-caption leading-relaxed text-warn">{limitations.map((item, index) => <li key={index}><InlineText text={item} /></li>)}</ul> : null}
    <Card className="min-w-0 divide-y divide-line-soft overflow-hidden">
      <CardSection as="section" density="reading" aria-label="今天的論點變化">
        <SubsectionHeading>今天的論點變化</SubsectionHeading>
        <p className="text-caption text-ink-3">↑ ↓ → 是簡報自己標的方向。這裡呈現本日評估；事件卡上的「現在要注意」則是當日盯盤項。{unlinked ? `本日 ${unlinked} 條沒有標出對應事件，只列在這裡。` : ""}</p>
        {b.thesis_changes.length ? <div className="-mx-4 divide-y divide-line-soft sm:-mx-5">
          {b.thesis_changes.map((row, index) => <ThesisCard key={`${row.thesis}-${index}`} row={row} events={b.events} />)}
        </div> : !b.thesis_notes.length ? <p className="text-body text-ink-3">{emptyThesisCopy}</p> : null}
        {b.thesis_notes.length ? <ReadingText text={b.thesis_notes.join("\n\n")} /> : null}
      </CardSection>

      <CardSection as="section" density="reading" aria-label="持續觀察的風險">
        <SubsectionHeading>持續觀察的風險</SubsectionHeading>
        <p className="text-caption text-ink-3">簡報的風險段落原文。目前的等級與解除條件寫在各條文字裡（如果那天的簡報有寫）；這裡不自行判定解除，來源也沒有獨立的解除欄位。</p>
        {structuredRisks.length ? <div className="-mx-4 divide-y divide-line-soft sm:-mx-5">
          {structuredRisks.map((row, index) => <article key={`risk-${index}`} className="flex flex-col gap-1 p-4 sm:px-5">
            <p className="text-body font-medium leading-relaxed text-warn"><InlineText text={row.risk} /></p>
            {row.status ? <p className="text-body leading-relaxed text-ink-2"><InlineText text={row.status} /></p> : null}
            {row.event_index !== null && b.events[row.event_index]
              ? <p className="text-caption text-ink-3">來自今日事件：<InlineText text={b.events[row.event_index]!.event} /></p> : null}
          </article>)}
        </div> : null}
        {alerts.length ? <div className="-mx-4 divide-y divide-line-soft sm:-mx-5">
          {alerts.map((note, index) => <AlertCard key={`note-${index}`} text={note} />)}
        </div> : null}
        {!structuredRisks.length && !alerts.length ? <p className="text-body text-ink-3">{emptyRiskCopy}</p> : null}
      </CardSection>
    </Card>
  </section>
}
