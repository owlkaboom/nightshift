/**
 * BranchSelector - Branch switching and creation
 */

import { useState } from 'react'
import { useSourceControlStore } from '@/stores'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
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
import { GitBranch, Plus, Loader2 } from 'lucide-react'

export function BranchSelector() {
  const {
    branches,
    currentBranch,
    loadingBranches,
    checkoutBranch,
    createBranch
  } = useSourceControlStore()

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [creating, setCreating] = useState(false)

  const localBranches = branches.filter((b) => b.isLocal && !b.name.includes('/'))
  const remoteBranches = branches.filter((b) => !b.isLocal || b.name.includes('/'))

  const handleBranchChange = async (value: string) => {
    if (value === '__create__') {
      setCreateDialogOpen(true)
      return
    }
    await checkoutBranch(value)
  }

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return

    setCreating(true)
    try {
      await createBranch(newBranchName.trim())
      await checkoutBranch(newBranchName.trim())
      setCreateDialogOpen(false)
      setNewBranchName('')
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <div className="px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select
            value={currentBranch || undefined}
            onValueChange={handleBranchChange}
            disabled={loadingBranches}
          >
            <SelectTrigger className="h-8 text-xs flex-1">
              {loadingBranches ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Loading...</span>
                </div>
              ) : (
                <SelectValue placeholder="Select branch" />
              )}
            </SelectTrigger>
            <SelectContent>
              {/* Create new branch option */}
              <SelectItem value="__create__" className="font-medium">
                <div className="flex items-center gap-2">
                  <Plus className="h-3 w-3" />
                  Create New Branch
                </div>
              </SelectItem>

              {/* Local branches */}
              {localBranches.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="text-xs">Local Branches</SelectLabel>
                  {localBranches.map((branch) => (
                    <SelectItem key={branch.name} value={branch.name}>
                      <div className="flex items-center justify-between w-full gap-2">
                        <span className="font-mono text-xs truncate">{branch.name}</span>
                        {(branch.ahead !== undefined && branch.ahead > 0) ||
                         (branch.behind !== undefined && branch.behind > 0) ? (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {branch.ahead ? `+${branch.ahead}` : ''}
                            {branch.ahead && branch.behind ? '/' : ''}
                            {branch.behind ? `-${branch.behind}` : ''}
                          </span>
                        ) : null}
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}

              {/* Remote branches */}
              {remoteBranches.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="text-xs">Remote Branches</SelectLabel>
                  {remoteBranches.map((branch) => (
                    <SelectItem key={branch.name} value={branch.name}>
                      <span className="font-mono text-xs text-muted-foreground truncate">
                        {branch.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Create branch dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Branch</DialogTitle>
            <DialogDescription>
              Create a new branch from {currentBranch || 'HEAD'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="branch-name">Branch Name</Label>
              <Input
                id="branch-name"
                placeholder="feature/my-feature"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateBranch()
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateBranch} disabled={!newBranchName.trim() || creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create & Checkout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
