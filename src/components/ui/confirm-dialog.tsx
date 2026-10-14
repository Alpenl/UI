import * as Dialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { useAppTranslation } from '@/i18n/use-translation'

export function ConfirmDialog({
  trigger,
  title,
  body,
  confirmLabel,
  onConfirm,
}: {
  trigger: ReactNode
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
}) {
  const { t } = useAppTranslation()
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-g-line bg-white p-6 shadow-[0_12px_40px_rgba(0,0,0,.18)]">
          <Dialog.Title className="font-serif text-[19px] font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-[13.5px] leading-relaxed text-g-sub">{body}</Dialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button kind="outline">{t('admin:cancel')}</Button>
            </Dialog.Close>
            <Dialog.Close asChild>
              <Button kind="danger" onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
