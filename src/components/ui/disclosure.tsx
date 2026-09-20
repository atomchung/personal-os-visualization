import { cn } from "@/lib/utils"

/** Native <details>: no library, no state, keyboard and find-in-page work. */
export function Disclosure({
  summary,
  children,
  className,
  open,
}: {
  summary: React.ReactNode
  children: React.ReactNode
  className?: string
  /** Starting state. React only writes this to the DOM when the value
   *  itself changes, so the user's own toggling is not fought on re-render. */
  open?: boolean
}) {
  return (
    <details
      open={open}
      className={cn(
        "group rounded-sm border-[0.5px] border-line-soft bg-paper",
        className,
      )}
    >
      <summary className="cursor-pointer list-none px-3 py-1.5 text-label text-ink-2 marker:content-none">
        <span className="inline-block w-3 text-ink-4 transition-transform group-open:rotate-90">
          ›
        </span>
        {summary}
      </summary>
      <div className="border-t-[0.5px] border-line-soft px-3 py-2">{children}</div>
    </details>
  )
}
