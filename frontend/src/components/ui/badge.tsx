import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground border-transparent',
        secondary: 'bg-muted text-foreground border-transparent',
        outline: 'text-foreground',
        // HU19-20, HU29-30: prioridad / riesgo
        alto: 'bg-red-100 text-red-700 border-transparent',
        medio: 'bg-amber-100 text-amber-700 border-transparent',
        bajo: 'bg-green-100 text-green-700 border-transparent',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
