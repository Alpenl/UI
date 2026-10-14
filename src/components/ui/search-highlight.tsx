import { type ReactNode } from 'react'

export const Mark = ({ text, q }: { text: string; q: string }): ReactNode => {
  const k = q.trim().toLowerCase()
  if (!k) return text
  const lower = text.toLowerCase()
  const out: ReactNode[] = []
  let at = 0
  for (let i = lower.indexOf(k); i >= 0; i = lower.indexOf(k, at)) {
    if (i > at) out.push(text.slice(at, i))
    out.push(
      <mark key={i} className="bg-[#fde9a8] text-inherit rounded-sm">
        {text.slice(i, i + k.length)}
      </mark>,
    )
    at = i + k.length
  }
  if (!out.length) return text
  if (at < text.length) out.push(text.slice(at))
  return <>{out}</>
}
