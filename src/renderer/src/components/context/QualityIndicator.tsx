import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QualityIndicatorProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

/**
 * Visual indicator for CLAUDE.md quality score
 * - Green (✓): score > 70 - Comprehensive
 * - Yellow (⚠): score 30-70 - Basic
 * - Red (✗): score < 30 - Minimal/None
 */
export function QualityIndicator({
  score,
  size = 'md',
  showLabel = false,
  className
}: QualityIndicatorProps) {
  const getQualityLevel = () => {
    if (score >= 70) return 'high'
    if (score >= 30) return 'medium'
    return 'low'
  }

  const quality = getQualityLevel()

  const config = {
    high: {
      icon: CheckCircle2,
      label: 'Comprehensive',
      color: 'text-green-600 dark:text-green-500',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800'
    },
    medium: {
      icon: AlertCircle,
      label: 'Basic',
      color: 'text-yellow-600 dark:text-yellow-500',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
      borderColor: 'border-yellow-200 dark:border-yellow-800'
    },
    low: {
      icon: XCircle,
      label: 'Minimal',
      color: 'text-red-600 dark:text-red-500',
      bgColor: 'bg-red-100 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-800'
    }
  }

  const { icon: Icon, label, color, bgColor, borderColor } = config[quality]

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  }

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  if (showLabel) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border',
          bgColor,
          borderColor,
          className
        )}
        title={`Quality score: ${score}/100`}
      >
        <Icon className={cn(iconSizes[size], color)} />
        <span className={cn(textSizes[size], color, 'font-medium')}>
          {label}
        </span>
        <span className={cn(textSizes[size], 'text-muted-foreground')}>
          ({score})
        </span>
      </div>
    )
  }

  return (
    <div
      className={cn('inline-flex', className)}
      title={`Quality score: ${score}/100 (${label})`}
    >
      <Icon className={cn(iconSizes[size], color)} />
    </div>
  )
}
