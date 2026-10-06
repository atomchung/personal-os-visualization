import { Card, SectionHeading } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { checkpointReviewsView, type InvestmentCheckpointReviewItem, type CheckpointEffect } from "@/lib/investmentCheckpointReviews"
import { sourceTimestamp } from "@/lib/investmentFormat"

function Stamp({ value }: { value: string }) {
  return <time dateTime={value} title={value}>{sourceTimestamp(value)}</time>
}

function Effect({ label, effect }: { label: string; effect: CheckpointEffect }) {
  return <p className="text-body leading-relaxed text-ink-2"><span className="font-medium text-ink">{label}</span>{effect.state !== "unknown" ? <>：{effect.summary}</> : null}</p>
}

function EvidenceLink({ url }: { url: string }) {
  // Links are optional navigation, never fetched or turned into automatic quotes.
  let safe = false
  try { safe = ["https:", "http:"].includes(new URL(url).protocol) } catch { /* Render unknown URLs as text. */ }
  return safe ? <a href={url} target="_blank" rel="noreferrer" className="underline underline-offset-2">{url}</a> : <span>{url}</span>
}

function CheckpointItem({ item }: { item: InvestmentCheckpointReviewItem }) {
  const review = item.review
  return <article aria-label={item.question} data-checkpoint-id={item.checkpoint_id} className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-caption text-ink-3">原先的問題</p>
        <h3 className="mt-1 text-body font-semibold leading-relaxed text-ink">{item.question}</h3>
      </div>
      <Chip tone={item.state === "invalid" || item.assessment === "no_data" ? "warn" : "mute"}>{item.display.status_label}</Chip>
    </div>
    <div className="flex min-w-0 flex-col gap-1">
      <p className="text-caption text-ink-3">今天的答案</p>
      <p className="text-body leading-relaxed text-ink">{item.display.result}</p>
    </div>
    <div role="group" aria-label="判斷與行動影響" className="flex min-w-0 flex-col gap-1 border-l-2 border-line-soft pl-3">
      <Effect label={item.display.judgment_label} effect={item.judgment_effect} />
      <Effect label={item.display.action_label} effect={item.action_effect} />
    </div>
    <details className="min-w-0 text-caption leading-relaxed text-ink-3">
      <summary className="cursor-pointer py-2">原預期、期限與來源</summary>
      <dl className="mt-2 grid min-w-0 gap-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-4 sm:gap-y-2">
        <dt className="font-medium text-ink-2">原預期</dt><dd>{item.expectation}</dd>
        <dt className="font-medium text-ink-2">檢查期限</dt><dd><Stamp value={item.due_at} /></dd>
        <dt className="font-medium text-ink-2">原判斷／行動</dt><dd className="flex min-w-0 flex-col gap-1"><p>{item.baseline.judgment}</p><p>{item.baseline.action}</p><p>{item.baseline.reason}</p></dd>
        <dt className="font-medium text-ink-2">影響的理由</dt><dd className="flex min-w-0 flex-col gap-1">
          {item.judgment_effect.state !== "unknown" ? <p>{item.display.judgment_label}：{item.judgment_effect.reason}</p> : <p>{item.display.judgment_label}</p>}
          {item.action_effect.state !== "unknown" ? <p>{item.display.action_label}：{item.action_effect.reason}</p> : <p>{item.display.action_label}</p>}
        </dd>
        <dt className="font-medium text-ink-2">原始依據</dt><dd>{item.baseline.source_refs}</dd>
        <dt className="font-medium text-ink-2">問題來源</dt><dd className="flex min-w-0 flex-col gap-1"><p>{item.origin.path}</p><p>版本：{item.origin.source_revision}</p><p>產出：<Stamp value={item.provenance.origin_generated_at} /></p><p>資料截止：<Stamp value={item.provenance.origin_cutoff} /></p></dd>
        {review ? <><dt className="font-medium text-ink-2">本次回查</dt><dd className="flex min-w-0 flex-col gap-1"><p>查核：<Stamp value={review.checked_at} /></p><p>證據截止：<Stamp value={review.evidence_cutoff} /></p></dd></> : null}
        {item.provenance.review ? <><dt className="font-medium text-ink-2">回查來源</dt><dd className="flex min-w-0 flex-col gap-1"><p>{item.provenance.review.path}</p><p>版本：{item.provenance.review.source_revision}</p><p>產出：<Stamp value={item.provenance.review.generated_at} /></p><p>資料截止：<Stamp value={item.provenance.review.source_cutoff} /></p></dd></> : null}
        {review?.evidence.length ? <><dt className="font-medium text-ink-2">證據</dt><dd><ul className="flex min-w-0 flex-col gap-3">{review.evidence.map((evidence, index) => <li key={index} className="flex min-w-0 flex-col gap-1"><p>{evidence.summary}</p><EvidenceLink url={evidence.source_url} /><p>資料日期：<Stamp value={evidence.data_as_of} /></p><p>發布：<Stamp value={evidence.published_at} /> · 查核：<Stamp value={evidence.checked_at} /></p><p>來源類型：{evidence.kind}</p></li>)}</ul></dd></> : null}
        {item.last_review ? <><dt className="font-medium text-ink-2">較早回查</dt><dd><p>不是目前答案 · <Stamp value={item.last_review.checked_at} /></p><p>{item.last_review.result}</p></dd></> : null}
        <dt className="font-medium text-ink-2">身分與讀取</dt><dd className="flex min-w-0 flex-col gap-1"><p>問題 ID：{item.checkpoint_id}</p><p>Story ID：{item.story_id}</p><p>讀取：<Stamp value={item.provenance.read_at} /></p><p>{item.assessment_origin === "source" ? "來源明示回查" : "來源讀取器標示缺口"} · {item.reason_code}</p></dd>
      </dl>
    </details>
  </article>
}

/** No provider calls, browser-clock lifecycle or cross-story inference here. */
export function TodayCheckpointReviews({ projection, readFailed = false, synthetic = false }: { projection?: unknown; readFailed?: boolean; synthetic?: boolean }) {
  const view = checkpointReviewsView(projection)
  const data = view.projection
  const title = data?.display?.title ?? "昨天觀察的事"
  return <section aria-label={title} className="flex min-w-0 flex-col gap-3 break-words [overflow-wrap:anywhere]">
    <SectionHeading>{title}</SectionHeading>
    {synthetic && data ? <p className="text-caption text-ink-3">合成回查範例，非真實觀察或正式回查紀錄。</p> : null}
    {readFailed ? <p role="status" className="text-caption text-warn">本次讀取失敗；以下保留上次讀到的回查，尚未確認是否有新版本。</p> : null}
    {view.unavailable ? <p role="status" className="text-body text-warn">尚未取得可辨識的逐題回查資料，不能確認昨天的觀察結果。</p> : <>
      {data?.display?.coverage_label ? <p role="status" className="text-caption text-warn">{data.display.coverage_label}</p> : null}
      {data?.state === "invalid" ? <p role="status" className="text-body text-warn">回查資料無法驗證，不能確認結果。</p> : null}
      {view.invalidCount ? <p role="status" className="text-caption text-warn">{view.invalidCount} 筆回查欄位或身分不一致，未呈現為有效答案；其餘可讀項目保留。</p> : null}
      {view.items.length ? <Card className="min-w-0 divide-y divide-line-soft">
        {view.items.slice(0, 2).map(item => <CheckpointItem key={item.checkpoint_id} item={item} />)}
        {view.items.length > 2 ? <details data-testid="checkpoint-reviews-more" className="min-w-0">
          <summary className="cursor-pointer px-4 py-3 text-body font-medium text-ink-2 sm:px-5">其他觀察 · {view.items.length - 2}</summary>
          <div className="min-w-0 divide-y divide-line-soft">{view.items.slice(2).map(item => <CheckpointItem key={item.checkpoint_id} item={item} />)}</div>
        </details> : null}
      </Card> : !view.invalidCount && data?.display?.empty_message ? <p role="status" className="text-body text-ink-2">{data.display.empty_message}</p> : null}
      <p className="text-caption text-ink-3">僅涵蓋來源明示登記的問題；未登記的觀察不在此列。</p>
      <details className="min-w-0 text-caption leading-relaxed text-ink-3">
        <summary className="cursor-pointer py-2">回查涵蓋範圍與資料缺口</summary>
        <div className="flex min-w-0 flex-col gap-2 pt-2">
          <p>可讀歷史中已完成 {data?.completed_count} 題；這是歷史總數，不代表今天新增或所有觀察都已回查。</p>
          <p>{data?.coverage.history_complete ? "本次可取得檔案的掃描未遇到缺口；不保證歷史從未缺檔。" : "本次可取得檔案的掃描有缺口，涵蓋範圍不完整。"}</p>
          {data?.coverage.untracked_recent_artifacts.length ? <div><p>今日／昨日尚未登記逐題觀察的來源：</p><ul>{data.coverage.untracked_recent_artifacts.map((path, index) => <li key={index}>{path}</li>)}</ul></div> : null}
          {[...(data?.problems ?? []), ...(data?.candidate_problems ?? [])].map((problem, index) => <p key={index} className="text-warn">{problem}</p>)}
        </div>
      </details>
    </>}
  </section>
}
