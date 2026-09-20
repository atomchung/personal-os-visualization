/** Presentation-only helpers. Never rewrite or infer the source's judgment. */
const PURE_NO_CHANGE_ACTIONS = new Set(["沒有新資訊", "暫無新資訊", "無新資訊", "不重複升級"])

function comparisonText(text: string): string {
  return text.trim().replace(/\s+/g, " ")
}

/** Remove exact repeats only within the overview; keep the source text intact. */
export function briefOverviewActions(actions: readonly string[], headline: string): string[] {
  const seen = new Set([comparisonText(headline)])
  return actions.filter(action => {
    const key = comparisonText(action)
    const label = key.replace(/[。．.!！?？]+$/, "")
    if (!key || PURE_NO_CHANGE_ACTIONS.has(label) || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** An unresolved or broken reference must remain visible in the additional section. */
export function isBriefEventReference(index: number | null | undefined, eventCount: number): boolean {
  return typeof index === "number" && Number.isInteger(index) && index >= 0 && index < eventCount
}
