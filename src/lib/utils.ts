import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/* tailwind-merge has to be told about our type scale, or it cannot tell a
 * font size from a colour: `text-paper` (colour) and `text-caption` (size)
 * look identical to it, so it treats them as one group and silently drops
 * the earlier one — a black button with black text. Listing the sizes makes
 * the split deterministic. Keep in sync with the --text-* tokens generated
 * by scripts/build_web_tokens.py. */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "hero",
            "display",
            "metric",
            "num",
            "section",
            "body",
            "label",
            "caption",
            "micro",
            "chip",
          ],
        },
      ],
    },
  },
})

/** shadcn/ui's class helper: merge conditional classes, last Tailwind wins. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
