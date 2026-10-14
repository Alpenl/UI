import { cn } from '@/lib/utils'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
const buttonVariants = cva(
  'h-9 px-4 rounded-[4px] text-[13.5px] font-medium shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 transition disabled:opacity-40 disabled:pointer-events-none',
  {
    variants: {
      kind: {
        primary: 'bg-g-blue text-white hover:bg-g-blue-dark',
        text: 'text-g-blue hover:bg-g-tint',
        outline: 'text-g-ink border border-g-line bg-white hover:border-g-mute hover:bg-g-paper',
        danger: 'bg-g-red text-white hover:opacity-90',
      },
    },
    defaultVariants: { kind: 'text' },
  },
)
export type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }
export function Button({ className, kind, asChild = false, type = 'button', ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button'
  return <Component type={asChild ? undefined : type} className={cn(buttonVariants({ kind }), className)} {...props} />
}
export { Button as Btn }
