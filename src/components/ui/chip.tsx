import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/* Colour pairing rule from docs/DESIGN_SYSTEM.md: at this size the bright
 * sys-* fills fail contrast, so chips use text-safe semantic tokens and a
 * restrained tint that keeps state visible without competing with body text. */
const chipVariants = cva(
  "inline-flex items-center rounded-full px-2 py-px text-chip font-medium " +
    "leading-normal border-[0.5px] border-current/20",
  {
    variants: {
      tone: {
        ok: "bg-ok/15 text-ok",
        warn: "bg-warn/10 text-warn",
        bad: "bg-bad/15 text-bad",
        info: "bg-info/12 text-info",
        accent: "bg-accent/10 text-accent",
        mute: "bg-ink/7 text-ink-3",
      },
    },
    defaultVariants: { tone: "mute" },
  },
)

export function Chip({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof chipVariants>) {
  return <span className={cn(chipVariants({ tone }), className)} {...props} />
}
