import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/* shadcn/ui convention: the component's source lives in this repo, so styling
 * it means editing this file — not overriding someone else's DOM from outside.
 * `data-slot` is the v4 hook for targeting parts from a parent. */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-sm " +
    "font-semibold transition-colors cursor-pointer disabled:pointer-events-none " +
    "disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-sys-blue",
  {
    variants: {
      variant: {
        // Quiet by default: these sit inside a card and must not outweigh it.
        ghost: "border-[0.5px] border-line bg-paper text-ink-2 hover:bg-bg-2",
        selected: "border-[0.5px] border-transparent bg-ink text-paper hover:opacity-85",
        link: "text-ink-3 hover:text-ink-2 underline-offset-2 hover:underline",
      },
      size: {
        sm: "h-7 px-2.5 text-caption",
        md: "h-8 px-3 text-label",
      },
    },
    defaultVariants: { variant: "ghost", size: "sm" },
  },
)

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}
