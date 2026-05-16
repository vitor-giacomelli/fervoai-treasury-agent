import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'

import { cn } from '../../lib/utils'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean
}

export function Button({ className, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      className={cn(
        'inline-flex items-center justify-center rounded border border-cyan-400/60 bg-cyan-400/10 px-3 py-2 font-mono text-xs uppercase tracking-widest text-cyan-200 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
