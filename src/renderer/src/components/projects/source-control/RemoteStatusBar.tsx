/**
 * RemoteStatusBar - Shows ahead/behind status and remote actions
 */

import { useSourceControlStore } from '@/stores'
import { Button } from '@/components/ui/button'
import { ArrowDown, ArrowUp, RefreshCw, Upload, Download, Cloud, CloudOff } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function RemoteStatusBar() {
  const {
    remoteStatus,
    isFetching,
    isPulling,
    isPushing,
    fetch,
    pull,
    push
  } = useSourceControlStore()

  if (!remoteStatus?.hasRemote) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/50">
        <CloudOff className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">No remote configured</span>
      </div>
    )
  }

  const { ahead, behind, tracking } = remoteStatus

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
      <div className="flex items-center gap-2">
        <Cloud className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-mono">
          {tracking || remoteStatus.remote}
        </span>
        {(ahead > 0 || behind > 0) && (
          <div className="flex items-center gap-1 text-xs">
            {ahead > 0 && (
              <span className="flex items-center gap-0.5 text-green-600">
                <ArrowUp className="h-3 w-3" />
                {ahead}
              </span>
            )}
            {behind > 0 && (
              <span className="flex items-center gap-0.5 text-orange-600">
                <ArrowDown className="h-3 w-3" />
                {behind}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        {/* Fetch */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => fetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Fetch from remote</TooltipContent>
        </Tooltip>

        {/* Pull */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => pull()}
              disabled={isPulling || behind === 0}
            >
              <Download className={`h-3.5 w-3.5 ${isPulling ? 'animate-pulse' : ''}`} />
              {behind > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-orange-600 text-[10px] text-white flex items-center justify-center">
                  {behind}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Pull {behind > 0 ? `${behind} commits` : 'from remote'}
          </TooltipContent>
        </Tooltip>

        {/* Push */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => push()}
              disabled={isPushing || ahead === 0}
            >
              <Upload className={`h-3.5 w-3.5 ${isPushing ? 'animate-pulse' : ''}`} />
              {ahead > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-green-600 text-[10px] text-white flex items-center justify-center">
                  {ahead}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Push {ahead > 0 ? `${ahead} commits` : 'to remote'}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
