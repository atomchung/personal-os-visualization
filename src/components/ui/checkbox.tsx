import { cn } from "@/lib/utils"

/* A real <input type="checkbox">, restyled with `appearance-none` rather than a
 * div pretending to be one — keyboard, focus ring and screen readers come free.
 * `accent-*` is not used because it takes a colour, not a token class, and the
 * design lint (rightly) rejects raw values. */
export function Checkbox({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        "size-3.5 shrink-0 cursor-pointer appearance-none rounded-full border-[1.5px]",
        "border-ink-5 transition-colors",
        "checked:border-accent checked:bg-accent",
        "disabled:cursor-not-allowed disabled:opacity-40",
        "focus-visible:outline-2 focus-visible:outline-sys-blue focus-visible:outline-offset-1",
        className,
      )}
      {...props}
    />
  )
}
