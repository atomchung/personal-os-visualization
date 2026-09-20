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

type ListItem = { ordered: boolean; text: string; children: ListBlock[] }
type ListBlock = { ordered: boolean; items: ListItem[] }

function listLine(line: string) {
  const match = line.match(/^(\s*)([-*+]\s+|\d+[.]\s+)(.*)$/)
  if (!match) return null
  return {
    indent: match[1].replace(/\t/g, "  ").length,
    ordered: /^\d/.test(match[2]),
    text: match[3],
  }
}

/** Parse a Markdown list without discarding indentation-based child items. */
function parseList(lines: string[], start: number, baseIndent?: number): { block: ListBlock; next: number } {
  const first = listLine(lines[start])
  if (!first) return { block: { ordered: false, items: [] }, next: start }
  const indent = baseIndent ?? first.indent
  const block: ListBlock = { ordered: first.ordered, items: [] }
  let index = start
  while (index < lines.length) {
    const current = listLine(lines[index])
    if (!current || current.indent < indent || current.ordered !== block.ordered && current.indent === indent) break
    if (current.indent > indent) {
      const previous = block.items.at(-1)
      if (!previous) break
      const nested = parseList(lines, index, current.indent)
      previous.children.push(nested.block)
      index = nested.next
      continue
    }
    block.items.push({ ordered: current.ordered, text: current.text, children: [] })
    index += 1
  }
  return { block, next: index }
}

function renderList(block: ListBlock, key: string): ReactNode {
  const Tag = block.ordered ? "ol" : "ul"
  return (
    <Tag key={key} className="flex list-disc flex-col gap-2 pl-5 [&_ol]:list-decimal [&_ol]:pt-1 [&_ul]:pt-1">
      {block.items.map((item, index) => (
        <li key={`${key}-${index}`}>
          <InlineText text={item.text} />
          {item.children.map((child, childIndex) => renderList(child, `${key}-${index}-${childIndex}`))}
        </li>
      ))}
    </Tag>
  )
}

function isBlockStart(line: string) {
  const trimmed = line.trim()
  return /^#{1,6}\s/.test(trimmed) || /^[-*+]\s+/.test(trimmed) || /^\d+[.]\s+/.test(trimmed) || trimmed.startsWith("|") || /^-{3,}$/.test(trimmed)
}

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
      const level = Math.min(6, Math.max(3, (line.match(/^#+/)?.[0].length ?? 1) + 2))
      const Heading = `h${level}` as keyof React.JSX.IntrinsicElements
      const className = level === 3 ? "pt-2 text-section font-semibold text-ink" : level === 4 ? "pt-1 text-label font-semibold text-ink" : "pt-1 text-caption font-semibold text-ink"
      blocks.push(<Heading key={i} className={className}><InlineText text={line.replace(/^#+\s*/, "")}/></Heading>)
    } else if (listLine(lines[i])) {
      const parsed = parseList(lines, i)
      blocks.push(renderList(parsed.block, `list-${i}`))
      i = parsed.next - 1
    } else {
      const para=[line.replace(/^>\s?/, "")]
      while (i+1<lines.length && lines[i+1].trim() && !isBlockStart(lines[i+1])) para.push(lines[++i])
      blocks.push(<p key={i} className="whitespace-pre-wrap"><InlineText text={para.join("\n")}/></p>)
    }
  }
  return <div className="flex min-w-0 flex-col gap-3 break-words text-body leading-relaxed text-ink-2">{blocks}</div>
}
