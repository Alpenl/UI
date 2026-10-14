import { useRouteField } from '@/app/navigation'
import { useLiveStore } from '@/api/live-store'
import { useAppTranslation } from '@/i18n/use-translation'
import type { TagScope } from '@/api/tag-structure'

export function TagFilterScopes() {
  const { t } = useAppTranslation()
  const { data } = useLiveStore()
  const [filters, setFilters] = useRouteField('filters')
  const [kind] = useRouteField('kind')
  if (data.relationsVersion !== 1) return null
  return (
    <div className="space-y-2 text-[12px]">
      {filters[kind].fTags.map((name) => {
        const tag = data.tags.find((x) => x.name === name)
        if (!tag) return null
        const count = data.server?.tag_rollups?.[tag.ref]
        return (
          <label key={tag.ref} className="block">
            {name}
            <select
              className="ml-2 border border-g-line rounded-lg p-1 bg-white"
              value={filters[kind].tagScopes[tag.ref] ?? 'exact'}
              onChange={(e) =>
                setFilters((xs) => ({
                  ...xs,
                  [kind]: { ...xs[kind], tagScopes: { ...xs[kind].tagScopes, [tag.ref]: e.target.value as TagScope } },
                }))
              }
            >
              <option value="exact">{t('admin:exactTag')}</option>
              <option value="with_narrower">{t('admin:withNarrower')}</option>
            </select>
            {count && (
              <span className="block text-g-sub">
                {t('admin:rollupCounts', { direct: count.direct, total: count.total, via: count.via_narrower })}
              </span>
            )}
          </label>
        )
      })}
    </div>
  )
}
