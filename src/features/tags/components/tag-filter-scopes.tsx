import { useRouteField } from '@/app/navigation'
import { useAppTranslation } from '@/i18n/use-translation'
import type { TagScope } from '@/api/tag-structure'
import { useLiveStore } from '@/api/live-store'
import type { Dim } from '@/domain/library'
import { TagCloud } from '@/components/domain/tag-cloud'

/** Active tag filters as a cloud; in `editing` mode pills jiggle and can be removed one by one. */
export function TagFilterScopes({
  tags,
  dimOf,
  editing,
  remove,
}: {
  tags: string[]
  dimOf: (n: string) => Dim
  editing: boolean
  remove: (name: string) => void
}) {
  const { t } = useAppTranslation()
  const [filters, setFilters] = useRouteField('filters')
  const [kind] = useRouteField('kind')
  const { data } = useLiveStore()
  if (!tags.length) return null
  return (
    <>
      <TagCloud
        size="sm"
        editing={editing}
        onRemove={remove}
        items={tags.map((name) => ({
          id: name,
          label: name,
          dim: data.tags.find((x) => x.name === name)?.dim ?? dimOf(name),
        }))}
      />
      {data.relationsVersion === 1 && (
        <div className="space-y-2 text-[12px]">
          {tags.map((name) => {
            const tag = data.tags.find((x) => x.name === name)
            if (!tag) return null
            return (
              <label key={tag.ref} className="flex items-center justify-between gap-2">
                <span className="truncate">{name}</span>
                <select
                  aria-label={name}
                  value={filters[kind].tagScopes[tag.ref] ?? 'exact'}
                  onChange={(e) =>
                    setFilters((xs) => ({
                      ...xs,
                      [kind]: {
                        ...xs[kind],
                        tagScopes: { ...xs[kind].tagScopes, [tag.ref]: e.target.value as TagScope },
                      },
                    }))
                  }
                  className="h-7 pl-2 text-g-sub"
                >
                  <option value="exact">{t('admin:exactTag')}</option>
                  <option value="with_narrower">{t('admin:withNarrower')}</option>
                </select>
              </label>
            )
          })}
        </div>
      )}
    </>
  )
}
