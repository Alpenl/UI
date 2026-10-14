import { useState } from 'react'
import { useLiveStore } from '@/api/live-store'
import { useAppTranslation } from '@/i18n/use-translation'
import { StructurePreview } from './structure-preview'

export function RelationEditor({ tagRef }: { tagRef: string }) {
  const { t } = useAppTranslation()
  const { data } = useLiveStore()
  const current = data.parents?.[tagRef] ?? ''
  const [parent, setParent] = useState(current)
  const rollup = data.server?.tag_rollups?.[tagRef]
  return (
    <section className="col-span-2 max-[1000px]:col-span-1 rounded-lg border border-g-line p-3 text-[13px] space-y-2">
      <p>{t('admin:relationMeaning')}</p>
      <label className="block">
        {t('admin:broaderTag')}
        <select
          className="block mt-2 border border-g-line rounded-lg p-2 w-full bg-white"
          value={parent}
          onChange={(e) => setParent(e.target.value)}
        >
          <option value="">{t('admin:noBroader')}</option>
          {data.tags
            .filter((tag) => tag.ref !== tagRef)
            .map((tag) => (
              <option key={tag.ref} value={tag.ref}>
                {tag.name} · {data.dims?.find((d) => d.id === tag.dim)?.label ?? tag.dim}
              </option>
            ))}
        </select>
      </label>
      {rollup && (
        <p>{t('admin:rollupCounts', { direct: rollup.direct, total: rollup.total, via: rollup.via_narrower })}</p>
      )}
      {parent !== current && (
        <StructurePreview change={{ kind: 'relation', child_ref: tagRef, parent_ref: parent }} onSaved={() => {}} />
      )}
    </section>
  )
}
