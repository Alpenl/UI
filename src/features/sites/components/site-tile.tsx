import { domainOf, type Article } from '@/domain/library'

export const FALLBACK = ['#0b57d0', '#1e8e5a', '#d9822b', '#8e4ec6', '#c2410c', '#0e7490']

export const brandOf = (a: Article) => a.site?.brand ?? FALLBACK[a.id % FALLBACK.length]

export function Tile({ a, big }: { a: Article; big?: boolean }) {
  const dead = a.site?.status === 'dead'
  return (
    <div
      className={`relative overflow-hidden ${big ? 'h-44' : 'h-28'} ${dead ? 'grayscale opacity-70' : ''}`}
      style={{
        background: `radial-gradient(120% 140% at 15% 0%, ${brandOf(a)}, color-mix(in srgb, ${brandOf(a)} 62%, #000))`,
      }}
    >
      <div
        className="absolute inset-0 opacity-[.14]"
        style={{
          backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />
      <span
        className={`absolute font-serif font-semibold text-white/95 leading-none select-none ${big ? 'left-6 bottom-4 text-[84px]' : 'left-4 bottom-2.5 text-[52px]'}`}
      >
        {a.title.trim().charAt(0).toUpperCase()}
      </span>
      <span
        className={`absolute font-mono text-white/80 ${big ? 'right-5 bottom-5 text-[12px]' : 'right-3.5 bottom-3.5 text-[12px]'}`}
      >
        {domainOf(a)}
      </span>
    </div>
  )
}
