import { DIMS0, type DimDef } from '@/domain/library'
import { t } from '@/i18n'
// Only untouched built-in labels are translated; user-defined labels remain content.
export function localizeDimensions(dims: DimDef[]): DimDef[] {
  return dims.map((dim) => {
    if (dim.label !== DIMS0.find((item) => item.id === dim.id)?.label) return dim
    const keys = {
      topic: 'common:dimensionTopic',
      type: 'common:dimensionType',
      trait: 'common:dimensionTrait',
      medium: 'common:dimensionMedium',
    } as const
    const id = dim.id as keyof typeof keys
    return id in keys ? { ...dim, label: t(keys[id]) } : dim
  })
}
