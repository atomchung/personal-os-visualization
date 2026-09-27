import { cn } from "@/lib/utils"
import { cva } from "class-variance-authority"

type ContentDensity = "compact" | "normal" | "reading"

const cardDensityVariants = cva("", {
  variants: {
    density: {
      compact: "p-3",
      normal: "p-4 sm:p-5",
      reading: "mx-auto w-full max-w-[800px] p-4 sm:p-5",
    },
  },
})

const cardSectionVariants = cva("flex min-w-0 flex-col", {
  variants: {
    density: {
      compact: "gap-2 p-3",
      normal: "gap-3 p-4 sm:p-5",
      reading: "gap-4 p-4 sm:p-5",
    },
  },
})

/* The app has exactly two surfaces: a white card is a content unit, grey text
 * is auxiliary information. Nothing in between — a third, tinted surface was
 * tried once and only made "is this a box or not?" ambiguous. */
export function Card({
  className,
  density,
  ...props
}: React.ComponentProps<"div"> & { density?: ContentDensity }) {
  return (
    <div
      data-slot="card"
      data-density={density}
      className={cn(
        "rounded-lg border-[0.5px] border-line-soft bg-paper shadow-sm",
        density ? cardDensityVariants({ density }) : undefined,
        className,
      )}
      {...props}
    />
  )
}

/** A card's content spacing preset; it adds no background or border. */
export function CardSection({
  as: Tag = "div",
  className,
  density = "normal",
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  as?: "div" | "article" | "section"
  density?: ContentDensity
}) {
  return (
    <Tag
      data-slot="card-section"
      data-density={density}
      className={cn(cardSectionVariants({ density }), className)}
      {...props}
    />
  )
}

/** Keeps prose at a comfortable line length while allowing data views to stay wide. */
export function ReadingColumn({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="reading-column"
      className={cn("mx-auto w-full max-w-[800px]", className)}
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
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <h2 className="min-w-0 text-section font-semibold tracking-tight text-ink">{children}</h2>
      {aside}
    </div>
  )
}

/** A stable child heading; it is intentionally lighter than SectionHeading. */
export function SubsectionHeading({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <h3 className={cn("text-body font-semibold tracking-tight text-ink", className)}>{children}</h3>
}
