import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

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

/** Labelled fields inside a card: each label sits on its own line in small
 * secondary text with the body below it, so every field starts at the same
 * left edge -- instead of a bold inline "標籤：" run into long text. */
export function FieldList({ className, ...props }: React.ComponentProps<"dl">) {
  return <dl data-slot="field-list" className={cn("flex min-w-0 flex-col gap-3", className)} {...props} />
}

const fieldBodyVariants = cva("text-body leading-relaxed", {
  variants: {
    tone: {
      default: "text-ink-2",
      /** A fixed stand-in for something the source did not provide. */
      muted: "text-ink-3",
      /** Summary text that already carried emphasis before it had a label. */
      strong: "font-medium text-ink",
    },
  },
  defaultVariants: { tone: "default" },
})

export function Field({
  label,
  children,
  tone,
  className,
}: {
  label: React.ReactNode
  children: React.ReactNode
  className?: string
} & VariantProps<typeof fieldBodyVariants>) {
  return (
    <div data-slot="field" className={cn("flex min-w-0 flex-col gap-1", className)}>
      <dt className="text-caption text-ink-3">{label}</dt>
      <dd className={fieldBodyVariants({ tone })}>{children}</dd>
    </div>
  )
}
