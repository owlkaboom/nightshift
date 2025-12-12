import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground hover:bg-accent hover:text-accent-foreground',
        // Task status variants
        backlog: 'border-transparent bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
        queued: 'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        awaiting_agent:
          'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
        running:
          'border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        paused:
          'border-transparent bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
        completed:
          'border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        failed: 'border-transparent bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        cancelled:
          'border-transparent bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
        needs_review:
          'border-transparent bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
        rejected:
          'border-transparent bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300',
        // Priority variants
        high: 'border-transparent bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        medium:
          'border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        low: 'border-transparent bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
