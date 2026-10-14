import { createContext, useContext, type ReactNode } from 'react'

export const MutationLock = createContext(false)
export const useMutationLock = () => useContext(MutationLock)

/** Disable native editing controls without blocking navigation, selection or scrolling. */
export function MutationBoundary({ children }: { children: ReactNode }) {
  return (
    <fieldset disabled={useMutationLock()} className="contents">
      {children}
    </fieldset>
  )
}
