/**
 * Display and manage context attachments in a planning session
 */

import type { ContextAttachment } from '@shared/types'
import { X, FileText, Link as LinkIcon, StickyNote, Folder, AlertCircle } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'

interface ContextAttachmentListProps {
  attachments: ContextAttachment[]
  onRemove?: (attachmentId: string) => void
  readonly?: boolean
}

export function ContextAttachmentList({
  attachments,
  onRemove,
  readonly = false
}: ContextAttachmentListProps) {
  if (!attachments || attachments.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <ContextAttachmentChip
          key={attachment.id}
          attachment={attachment}
          onRemove={readonly ? undefined : onRemove}
        />
      ))}
    </div>
  )
}

interface ContextAttachmentChipProps {
  attachment: ContextAttachment
  onRemove?: (attachmentId: string) => void
}

function ContextAttachmentChip({ attachment, onRemove }: ContextAttachmentChipProps) {
  const icon = getIconForType(attachment.type)
  const variant = attachment.error ? 'destructive' : 'secondary'

  const chipContent = (
    <Badge variant={variant} className="flex items-center gap-1 pr-1">
      {icon}
      <span className="max-w-[200px] truncate">{attachment.label}</span>
      {attachment.error && (
        <AlertCircle className="h-3 w-3 ml-1" />
      )}
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="h-4 w-4 p-0 hover:bg-destructive/20 ml-1"
          onClick={(e) => {
            e.stopPropagation()
            onRemove(attachment.id)
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </Badge>
  )

  if (attachment.error) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{chipContent}</TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <div className="font-medium">Failed to load context</div>
            <div className="text-xs text-muted-foreground">{attachment.error}</div>
            <div className="text-xs text-muted-foreground">Source: {attachment.reference}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{chipContent}</TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1">
          <div className="font-medium">{getTypeLabel(attachment.type)}</div>
          <div className="text-xs text-muted-foreground max-w-[300px] truncate">
            {attachment.reference}
          </div>
          {attachment.content && (
            <div className="text-xs text-muted-foreground">
              {formatContentSize(attachment.content.length)}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function getIconForType(type: string) {
  switch (type) {
    case 'file':
      return <FileText className="h-3 w-3" />
    case 'url':
      return <LinkIcon className="h-3 w-3" />
    case 'note':
      return <StickyNote className="h-3 w-3" />
    case 'project':
      return <Folder className="h-3 w-3" />
    default:
      return null
  }
}

function getTypeLabel(type: string): string {
  switch (type) {
    case 'file':
      return 'File'
    case 'url':
      return 'URL'
    case 'note':
      return 'Note'
    case 'project':
      return 'Project'
    default:
      return type
  }
}

function formatContentSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} bytes`
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
}
