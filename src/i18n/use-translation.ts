import { useTranslation } from 'react-i18next'
/** Namespaced keys stay explicit while every reusable component subscribes to language changes. */
export function useAppTranslation() {
  return useTranslation(['app', 'library', 'sites', 'admin', 'common', 'domain'] as const)
}
