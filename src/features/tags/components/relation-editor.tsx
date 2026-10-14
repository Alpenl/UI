import { useState } from 'react'
import { useLiveStore } from '@/api/live-store'
import { useAppTranslation } from '@/i18n/use-translation'
import { StructurePreview } from './structure-preview'
import { TagPicker } from '@/components/domain/tag-cloud'

export function RelationEditor({ tagRef }: { tagRef: string }) {
  const { t } = useAppTranslation()
  const { data } = useLiveStore()
  const current = data.parents?.[tagRef] ?? ''
  const [parent, setParent] = useState(current)
  const rollup = data.server?.tag_rollups?.[tagRef]
  return (
    <section className="col-span-2 max-[1000px]:col-span-1 rounded-lg border border-g-line p-3 text-[13px] space-y-2">
      <p>{t('admin:relationMeaning')}</p>
      <div>
        <p className="mb-2">{t('admin:broaderTag')}</p>
        <TagPicker
          label={t('admin:broaderTag')}
          noneLabel={t('admin:noBroader')}
          value={parent}
          onChange={setParent}
          tags={data.tags
            .filter((tag) => tag.ref && tag.ref !== tagRef)
            .map((tag) => ({ id: tag.ref!, label: tag.name, dim: tag.dim }))}
        />
      </div>
      {rollup && (
        <p>{t('admin:rollupCounts', { direct: rollup.direct, total: rollup.total, via: rollup.via_narrower })}</p>
      )}
      {parent !== current && (
        <StructurePreview change={{ kind: 'relation', child_ref: tagRef, parent_ref: parent }} onSaved={() => {}} />
      )}
    </section>
  )
}
