import { cn } from "@/lib/utils"

/* The app has exactly two surfaces: a white card is a content unit, grey text
 * is auxiliary information. Nothing in between — a third, tinted surface was
 * tried once and only made "is this a box or not?" ambiguous. */
export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-lg border-[0.5px] border-line-soft bg-paper shadow-sm",
        className,
      )}
      {...props}
    />
  )
}

/** Section anchor: heavier than any text inside the block it opens. */
export function SectionHeading({
  children,
  aside,
}: {
  children: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-1.5">
      <h2 className="text-body font-bold tracking-tight text-ink">{children}</h2>
      {aside}
    </div>
  )
}

/** A stable child heading; it is intentionally lighter than SectionHeading. */
export function SubsectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-section font-semibold tracking-tight text-ink">{children}</h3>
}
