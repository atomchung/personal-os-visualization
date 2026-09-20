import type { OverallPeek } from "@/lib/api"
import { Disclosure } from "@/components/ui/disclosure"
import { SectionHeading } from "@/components/ui/card"

function renderParagraph(paragraph: string, key: number) {
  const lines = paragraph.split("\n").filter((ln) => ln.trim().length > 0)
  const isBulletBlock = lines.length > 0 && lines.every((ln) => ln.trim().startsWith("- "))

  if (isBulletBlock) {
    return (
      <ul key={key} className="flex list-disc flex-col gap-1 pl-5 text-body text-ink-2">
        {lines.map((ln, idx) => {
          const itemText = ln.trim().replace(/^- /, "")
          return <li key={idx}>{renderFormattedText(itemText)}</li>
        })}
      </ul>
    )
  }

  return (
    <p key={key} className="text-body leading-body text-ink-2">
      {renderFormattedText(paragraph)}
    </p>
  )
}

function renderFormattedText(text: string) {
  // Split on **bold**
  const parts = text.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}

export function OverallNarrative({ overall }: { overall: OverallPeek }) {
  if (!overall.available || !overall.narrative) {
    return (
      <section className="flex flex-col gap-1.5">
        <SectionHeading>🧭 本週總覽</SectionHeading>
        <p className="text-caption text-ink-3">
          💤 本週總覽：還沒有資料（跑 scripts/refresh_ccstory.py week 產一份）
        </p>
      </section>
    )
  }

  const paragraphs = overall.narrative.split(/\n{2,}/).filter((p) => p.trim().length > 0)

  return (
    <section className="flex flex-col gap-2">
      <SectionHeading
        aside={
          <span className="text-caption text-ink-4">
            ccstory · {overall.n_threads} threads
          </span>
        }
      >
        🧭 本週總覽
      </SectionHeading>
      {overall.headline && (
        <p className="text-body font-semibold text-ink">{overall.headline}</p>
      )}
      <Disclosure summary="展開全部">
        <div className="flex flex-col gap-3 py-1">
          {paragraphs.map((p, idx) => renderParagraph(p, idx))}
        </div>
      </Disclosure>
    </section>
  )
}
