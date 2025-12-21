/**
 * ChangedFilesList - Shows staged and unstaged changes in a directory tree structure
 */

import { useSourceControlStore } from '@/stores'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  FileText,
  FilePlus,
  FileX,
  FileEdit,
  AlertTriangle,
  RotateCcw,
  Folder,
  FolderOpen
} from 'lucide-react'
import { useState, useMemo } from 'react'
import type { FileStatus } from '@shared/types'
import { cn } from '@/lib/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu'

// Tree node types
interface FileNode {
  type: 'file'
  path: string
  name: string
  file: FileStatus
}

interface DirectoryNode {
  type: 'directory'
  path: string
  name: string
  children: TreeNode[]
}

type TreeNode = FileNode | DirectoryNode

/**
 * Build a directory tree from a flat list of files
 */
function buildFileTree(files: FileStatus[]): DirectoryNode {
  const root: DirectoryNode = {
    type: 'directory',
    path: '',
    name: '',
    children: []
  }

  for (const file of files) {
    const parts = file.path.split('/')
    let currentNode = root

    // Navigate/create directory structure
    for (let i = 0; i < parts.length - 1; i++) {
      const dirName = parts[i]
      const dirPath = parts.slice(0, i + 1).join('/')

      let existingDir = currentNode.children.find(
        (child): child is DirectoryNode =>
          child.type === 'directory' && child.name === dirName
      )

      if (!existingDir) {
        existingDir = {
          type: 'directory',
          path: dirPath,
          name: dirName,
          children: []
        }
        currentNode.children.push(existingDir)
      }

      currentNode = existingDir
    }

    // Add the file
    currentNode.children.push({
      type: 'file',
      path: file.path,
      name: parts[parts.length - 1],
      file
    })
  }

  // Sort children: directories first, then files, both alphabetically
  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    return nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
  }

  const sortTree = (node: DirectoryNode): void => {
    node.children = sortNodes(node.children)
    node.children.forEach((child) => {
      if (child.type === 'directory') {
        sortTree(child)
      }
    })
  }

  sortTree(root)
  return root
}

function getFileIcon(status: FileStatus['status']) {
  switch (status) {
    case 'added':
    case 'untracked':
      return <FilePlus className="h-4 w-4 text-green-600" />
    case 'deleted':
      return <FileX className="h-4 w-4 text-red-600" />
    case 'modified':
      return <FileEdit className="h-4 w-4 text-yellow-600" />
    case 'renamed':
      return <FileText className="h-4 w-4 text-blue-600" />
    case 'conflicted':
      return <AlertTriangle className="h-4 w-4 text-orange-600" />
    default:
      return <FileText className="h-4 w-4" />
  }
}

function getStatusBadge(status: FileStatus['status']) {
  const labels: Record<FileStatus['status'], string> = {
    added: 'A',
    modified: 'M',
    deleted: 'D',
    renamed: 'R',
    untracked: 'U',
    conflicted: '!'
  }
  const colors: Record<FileStatus['status'], string> = {
    added: 'text-green-600',
    modified: 'text-yellow-600',
    deleted: 'text-red-600',
    renamed: 'text-blue-600',
    untracked: 'text-muted-foreground',
    conflicted: 'text-orange-600'
  }
  return (
    <span className={cn('font-mono text-xs font-bold', colors[status])}>
      {labels[status]}
    </span>
  )
}

interface DirectoryItemProps {
  node: DirectoryNode
  level: number
  onStageAll?: () => void
  onUnstageAll?: () => void
  onStage?: (path: string) => void
  onUnstage?: (path: string) => void
  onDiscard?: (path: string) => void
  onSelect?: (path: string, staged: boolean) => void
  selectedFile?: string | null
  selectedFileStaged?: boolean
}

function DirectoryItem({
  node,
  level,
  onStageAll,
  onUnstageAll,
  onStage,
  onUnstage,
  onDiscard,
  onSelect,
  selectedFile,
  selectedFileStaged
}: DirectoryItemProps) {
  const [isOpen, setIsOpen] = useState(true)

  // Count files in this directory (recursively)
  const fileCount = useMemo(() => {
    const count = (n: DirectoryNode): number => {
      return n.children.reduce((acc, child) => {
        if (child.type === 'file') return acc + 1
        return acc + count(child)
      }, 0)
    }
    return count(node)
  }, [node])

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-muted/50 text-sm"
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        {isOpen ? (
          <FolderOpen className="h-4 w-4 text-blue-500 shrink-0" />
        ) : (
          <Folder className="h-4 w-4 text-blue-500 shrink-0" />
        )}
        <span className="font-medium truncate">{node.name}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {fileCount}
        </span>
      </div>
      {isOpen && (
        <div>
          {node.children.map((child, idx) => {
            if (child.type === 'directory') {
              return (
                <DirectoryItem
                  key={`dir-${child.path}-${idx}`}
                  node={child}
                  level={level + 1}
                  onStageAll={onStageAll}
                  onUnstageAll={onUnstageAll}
                  onStage={onStage}
                  onUnstage={onUnstage}
                  onDiscard={onDiscard}
                  onSelect={onSelect}
                  selectedFile={selectedFile}
                  selectedFileStaged={selectedFileStaged}
                />
              )
            }
            return (
              <FileItem
                key={`file-${child.path}-${idx}`}
                file={child.file}
                level={level + 1}
                onStage={() => onStage?.(child.path)}
                onUnstage={() => onUnstage?.(child.path)}
                onDiscard={() => onDiscard?.(child.path)}
                onClick={() => onSelect?.(child.path, child.file.staged)}
                isSelected={selectedFile === child.path && selectedFileStaged === child.file.staged}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

interface FileItemProps {
  file: FileStatus
  level: number
  onStage?: () => void
  onUnstage?: () => void
  onDiscard?: () => void
  onClick?: () => void
  isSelected?: boolean
}

function FileItem({ file, level, onStage, onUnstage, onDiscard, onClick, isSelected }: FileItemProps) {
  const fileName = file.path.split('/').pop() || file.path

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            'group flex items-center gap-2 py-1.5 cursor-pointer hover:bg-muted/50',
            isSelected && 'bg-accent'
          )}
          style={{ paddingLeft: `${level * 12 + 8}px`, paddingRight: '12px' }}
          onClick={onClick}
        >
          {getFileIcon(file.status)}
          <span className="font-medium text-sm truncate flex-1 min-w-0">
            {fileName}
          </span>
          {getStatusBadge(file.status)}

          {/* Stage/Unstage button on hover */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            {file.staged ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation()
                  onUnstage?.()
                }}
                title="Unstage"
              >
                <Minus className="h-3 w-3" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation()
                  onStage?.()
                }}
                title="Stage"
              >
                <Plus className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {file.staged ? (
          <ContextMenuItem onClick={onUnstage}>
            <Minus className="mr-2 h-4 w-4" />
            Unstage
          </ContextMenuItem>
        ) : (
          <ContextMenuItem onClick={onStage}>
            <Plus className="mr-2 h-4 w-4" />
            Stage
          </ContextMenuItem>
        )}
        {!file.staged && file.status !== 'untracked' && (
          <ContextMenuItem onClick={onDiscard} className="text-destructive">
            <RotateCcw className="mr-2 h-4 w-4" />
            Discard Changes
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function ChangedFilesList() {
  const {
    stagedFiles,
    unstagedFiles,
    selectedFile,
    selectedFileStaged,
    stageFile,
    unstageFile,
    stageAll,
    unstageAll,
    discardChanges,
    selectFile
  } = useSourceControlStore()

  const [stagedOpen, setStagedOpen] = useState(true)
  const [unstagedOpen, setUnstagedOpen] = useState(true)

  // Build trees for staged and unstaged files
  const stagedTree = useMemo(() => buildFileTree(stagedFiles), [stagedFiles])
  const unstagedTree = useMemo(() => buildFileTree(unstagedFiles), [unstagedFiles])

  const hasChanges = stagedFiles.length > 0 || unstagedFiles.length > 0

  if (!hasChanges) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No changes</p>
          <p className="text-xs">Your working tree is clean</p>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full w-full">
      <div className="py-2">
        {/* Staged Changes */}
        {stagedFiles.length > 0 && (
          <Collapsible open={stagedOpen} onOpenChange={setStagedOpen}>
            <div className="flex items-center gap-2 px-3 py-1">
              <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium uppercase text-muted-foreground hover:text-foreground">
                {stagedOpen ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                Staged Changes
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-green-600/20 text-green-700 dark:text-green-400">
                  {stagedFiles.length}
                </span>
              </CollapsibleTrigger>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs shrink-0"
                onClick={() => unstageAll()}
              >
                <Minus className="h-3 w-3 mr-1" />
                Unstage All
              </Button>
            </div>
            <CollapsibleContent>
              {stagedTree.children.map((child, idx) => {
                if (child.type === 'directory') {
                  return (
                    <DirectoryItem
                      key={`staged-dir-${child.path}-${idx}`}
                      node={child}
                      level={0}
                      onUnstage={unstageFile}
                      onSelect={selectFile}
                      selectedFile={selectedFile}
                      selectedFileStaged={selectedFileStaged}
                    />
                  )
                }
                return (
                  <FileItem
                    key={`staged-file-${child.path}-${idx}`}
                    file={child.file}
                    level={0}
                    onUnstage={() => unstageFile(child.path)}
                    onClick={() => selectFile(child.path, true)}
                    isSelected={selectedFile === child.path && selectedFileStaged}
                  />
                )
              })}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Unstaged Changes */}
        {unstagedFiles.length > 0 && (
          <Collapsible open={unstagedOpen} onOpenChange={setUnstagedOpen}>
            <div className="flex items-center gap-2 px-3 py-1 mt-2">
              <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium uppercase text-muted-foreground hover:text-foreground">
                {unstagedOpen ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                Changes
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-yellow-600/20 text-yellow-700 dark:text-yellow-400">
                  {unstagedFiles.length}
                </span>
              </CollapsibleTrigger>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs shrink-0"
                onClick={() => stageAll()}
              >
                <Plus className="h-3 w-3 mr-1" />
                Stage All
              </Button>
            </div>
            <CollapsibleContent>
              {unstagedTree.children.map((child, idx) => {
                if (child.type === 'directory') {
                  return (
                    <DirectoryItem
                      key={`unstaged-dir-${child.path}-${idx}`}
                      node={child}
                      level={0}
                      onStage={stageFile}
                      onDiscard={(path) => {
                        if (confirm(`Discard changes to ${path}?`)) {
                          discardChanges(path)
                        }
                      }}
                      onSelect={selectFile}
                      selectedFile={selectedFile}
                      selectedFileStaged={selectedFileStaged}
                    />
                  )
                }
                return (
                  <FileItem
                    key={`unstaged-file-${child.path}-${idx}`}
                    file={child.file}
                    level={0}
                    onStage={() => stageFile(child.path)}
                    onDiscard={() => {
                      if (confirm(`Discard changes to ${child.path}?`)) {
                        discardChanges(child.path)
                      }
                    }}
                    onClick={() => selectFile(child.path, false)}
                    isSelected={selectedFile === child.path && !selectedFileStaged}
                  />
                )
              })}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </ScrollArea>
  )
}
