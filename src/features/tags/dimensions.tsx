import { useAppTranslation as useTranslation } from '@/i18n/use-translation'

import { createContext, useContext } from 'react'

import { DIMS0, DIM_PALETTE, type Dim, type DimDef } from '@/domain/library'

export const DimsCtx = createContext<DimDef[]>(DIMS0)

export const useDims = () => {
  const { t: translate } = useTranslation()

  const dims = useContext(DimsCtx)
  const def = (id: Dim): DimDef =>
    dims.find((x) => x.id === id) ?? { id, label: translate('app:uncategorized'), chip: DIM_PALETTE[7] }
  return { dims, def }
}
