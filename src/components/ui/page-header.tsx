import { PAGE_COPY, type PageKey } from "@/lib/informationArchitecture"

export function PageHeader({
  page,
  action,
  showSummary = true,
}: {
  page: PageKey | "guide"
  action?: React.ReactNode
  showSummary?: boolean
}) {
  const copy = PAGE_COPY[page]
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-display font-bold leading-display tracking-tight text-ink">
          {copy.label}
        </h1>
        {showSummary ? <p className="max-w-[720px] text-caption leading-body text-ink-3">
          {copy.summary}
        </p> : null}
      </div>
      {action}
    </header>
  )
}
