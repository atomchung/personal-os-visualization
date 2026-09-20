import type { ReactNode } from "react"

/** A bounded Markdown subset; no source HTML or active content is interpreted. */
export function InlineText({text}: {text: string}): ReactNode {
  return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^\s)]+\)|`[^`]+`|<br\s*\/?\s*>)/gi).map((part, i) => {
    if (/^<br/i.test(part)) return <br key={i} />
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2,-2)}</strong>
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className="break-all text-label">{part.slice(1,-1)}</code>
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) {
      let safe = false
      try { const u = new URL(link[2]); safe = ["https:", "http:"].includes(u.protocol) && !u.username && !u.password } catch { /* Relative source references remain text. */ }
      return safe ? <a key={i} href={link[2]} target="_blank" rel="noreferrer" className="underline underline-offset-2">{link[1]}</a> : <span key={i}>{link[1]}</span>
    }
    return part
  })
}

function cells(line: string) { return line.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map(v => v.trim().replace(/\\\|/g,"|")) }

export function ReadingText({text}: {text: string}) {
  const lines = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").split(/\r?\n/)
  const blocks: ReactNode[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || /^-{3,}$/.test(line)) continue
    if (line.startsWith("|") && /^\s*\|?\s*:?-{3,}/.test(lines[i+1] ?? "")) {
      const headers = cells(line); const rows: string[][] = []; i += 2
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(cells(lines[i++]))
      i--
      blocks.push(<div key={i} className="min-w-0 overflow-x-auto"><table className="w-full border-collapse text-label"><thead><tr>{headers.map((h,n)=><th key={n} className="min-w-[140px] border-b border-line p-2 text-left align-top font-semibold"><InlineText text={h}/></th>)}</tr></thead><tbody>{rows.map((r,n)=><tr key={n}>{r.map((v,m)=><td key={m} className="border-b border-line-soft p-2 align-top"><InlineText text={v}/></td>)}</tr>)}</tbody></table></div>)
    } else if (/^#{1,6} /.test(line)) {
      blocks.push(<h3 key={i} className="pt-2 text-section font-semibold text-ink"><InlineText text={line.replace(/^#+\s*/, "")}/></h3>)
    } else if (/^[-*] |^\d+\. /.test(line)) {
      const items: string[] = [line.replace(/^(?:[-*]|\d+\.)\s+/, "")]
      while (/^\s*(?:[-*]|\d+\.) /.test(lines[i+1] ?? "")) items.push(lines[++i].trim().replace(/^(?:[-*]|\d+\.)\s+/, ""))
      blocks.push(<ul key={i} className="flex list-disc flex-col gap-2 pl-4">{items.map((v,n)=><li key={n}><InlineText text={v}/></li>)}</ul>)
    } else {
      const para=[line.replace(/^>\s?/, "")]
      while (i+1<lines.length && lines[i+1].trim() && !/^(?:#|\||[-*] |\d+\. |---)/.test(lines[i+1])) para.push(lines[++i])
      blocks.push(<p key={i} className="whitespace-pre-wrap"><InlineText text={para.join("\n")}/></p>)
    }
  }
  return <div className="flex min-w-0 flex-col gap-3 break-words text-body leading-relaxed text-ink-2">{blocks}</div>
}
