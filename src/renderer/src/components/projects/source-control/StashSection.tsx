/**
 * StashSection - Manage git stashes
 */

import { useState } from 'react'
import { useSourceControlStore } from '@/stores'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ChevronDown,
  ChevronRight,
  Package,
  Play,
  Trash2,
  Download,
  Loader2
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export function StashSection() {
  const {
    stashes,
    isStashing,
    loadingStashes,
    stagedFiles,
    unstagedFiles,
    stashSave,
    stashApply,
    stashPop,
    stashDrop
  } = useSourceControlStore()

  const [open, setOpen] = useState(false)
  const [stashDialogOpen, setStashDialogOpen] = useState(false)
  const [stashMessage, setStashMessage] = useState('')
  const [includeUntracked, setIncludeUntracked] = useState(true)

  const hasChanges = stagedFiles.length > 0 || unstagedFiles.length > 0

  const handleStash = async () => {
    await stashSave(stashMessage || undefined, includeUntracked)
    setStashDialogOpen(false)
    setStashMessage('')
  }

  const handleDrop = (index: number, message: string) => {
    if (confirm(`Drop stash "${message}"? This cannot be undone.`)) {
      stashDrop(index)
    }
  }

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center justify-between px-3 py-2 border-t">
          <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium uppercase text-muted-foreground hover:text-foreground">
            {open ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            <Package className="h-3 w-3 mr-1" />
            Stashes
            {stashes.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                {stashes.length}
              </span>
            )}
          </CollapsibleTrigger>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setStashDialogOpen(true)}
            disabled={!hasChanges || isStashing}
          >
            {isStashing ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Download className="h-3 w-3 mr-1" />
            )}
            Stash
          </Button>
        </div>

        <CollapsibleContent>
          {loadingStashes ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : stashes.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground text-center">
              No stashes
            </div>
          ) : (
            <div className="space-y-1 pb-2">
              {stashes.map((stash) => (
                <div
                  key={stash.ref}
                  className="group flex items-start gap-2 px-3 py-1.5 hover:bg-muted/50"
                >
                  <Package className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate">{stash.message}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {stash.branch} &middot;{' '}
                      {formatDistanceToNow(new Date(stash.date), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => stashApply(stash.index)}
                      title="Apply (keep stash)"
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => stashPop(stash.index)}
                      title="Pop (apply and remove)"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => handleDrop(stash.index, stash.message)}
                      title="Drop stash"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Stash dialog */}
      <Dialog open={stashDialogOpen} onOpenChange={setStashDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Stash Changes</DialogTitle>
            <DialogDescription>
              Save your changes temporarily to the stash
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="stash-message">Message (optional)</Label>
              <Input
                id="stash-message"
                placeholder="Work in progress..."
                value={stashMessage}
                onChange={(e) => setStashMessage(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-untracked"
                checked={includeUntracked}
                onCheckedChange={(checked) => setIncludeUntracked(checked === true)}
              />
              <label
                htmlFor="include-untracked"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Include untracked files
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStashDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStash} disabled={isStashing}>
              {isStashing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Stash Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
