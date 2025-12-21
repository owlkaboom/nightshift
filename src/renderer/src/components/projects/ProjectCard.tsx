import type { Project, Tag, ClaudeMdAnalysis } from '@shared/types'
import { PROJECT_ICONS } from '@shared/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TagChip } from '@/components/tags/TagChip'
import { QualityIndicator } from '@/components/context'
import * as LucideIcons from 'lucide-react'
import { FolderGit2, Folder, ExternalLink, Trash2, GitBranch, Edit2, Search, Download, RefreshCw, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { GitConversionCheck } from '@shared/ipc-types'

interface ProjectCardProps {
  project: Project
  path?: string | null
  currentBranch?: string | null
  tags?: Tag[]
  onRemove: (id: string) => void
  onEdit: (project: Project) => void
  onOpenFolder: (path: string) => void
  onViewDetails?: (project: Project) => void
  onAnalyze?: (project: Project) => void
  onImportIssues?: (project: Project) => void
  onConvertToGit?: (project: Project) => void
}

export function ProjectCard({ project, path, currentBranch, tags, onRemove, onEdit, onOpenFolder, onViewDetails, onAnalyze, onImportIssues, onConvertToGit }: ProjectCardProps) {
  const isGitProject = !!project.gitUrl
  const [analysis, setAnalysis] = useState<ClaudeMdAnalysis | null>(null)
  const [conversionCheck, setConversionCheck] = useState<GitConversionCheck | null>(null)
  const [checkingConversion, setCheckingConversion] = useState(false)

  // Fetch CLAUDE.md analysis on mount
  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const result = await window.api.analyzeClaudeMd(project.id)
        setAnalysis(result)
      } catch (error) {
        console.error('[ProjectCard] Failed to analyze CLAUDE.md:', error)
      }
    }

    fetchAnalysis()
  }, [project.id])

  // Check if project can be converted to Git (only for non-Git projects)
  useEffect(() => {
    if (!isGitProject && onConvertToGit) {
      const checkConversion = async () => {
        setCheckingConversion(true)
        try {
          const result = await window.api.checkGitConversion(project.id)
          setConversionCheck(result)
        } catch (error) {
          console.error('[ProjectCard] Failed to check Git conversion:', error)
        } finally {
          setCheckingConversion(false)
        }
      }

      checkConversion()
    }
  }, [project.id, isGitProject, onConvertToGit])

  const getIconComponent = (iconName: string) => {
    const Icon = LucideIcons[iconName as keyof typeof LucideIcons] as LucideIcons.LucideIcon
    return Icon || (isGitProject ? FolderGit2 : Folder)
  }

  const renderIcon = () => {
    if (project.icon) {
      // Check if it's a Lucide icon name
      if (PROJECT_ICONS.includes(project.icon as (typeof PROJECT_ICONS)[number])) {
        const Icon = getIconComponent(project.icon)
        return <Icon className="h-5 w-5 text-primary" />
      }
      // It's a custom image URL/path
      return (
        <img
          src={project.icon}
          alt=""
          className="h-5 w-5 object-contain"
          onError={(e) => {
            // Fallback to default icon on error
            e.currentTarget.style.display = 'none'
            const fallbackIcon = e.currentTarget.nextSibling as HTMLElement
            if (fallbackIcon) fallbackIcon.style.display = 'block'
          }}
        />
      )
    }
    // Default icon based on project type
    return isGitProject ? (
      <FolderGit2 className="h-5 w-5 text-primary" />
    ) : (
      <Folder className="h-5 w-5 text-primary" />
    )
  }

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on buttons
    if ((e.target as HTMLElement).closest('button')) {
      return
    }
    onViewDetails?.(project)
  }

  return (
    <Card
      className={`group relative overflow-hidden ${onViewDetails ? 'cursor-pointer hover:border-primary/50 transition-colors' : ''}`}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              {renderIcon()}
              {/* Fallback icon (hidden by default) */}
              {project.icon && !PROJECT_ICONS.includes(project.icon as (typeof PROJECT_ICONS)[number]) && (
                <span style={{ display: 'none' }}>
                  {isGitProject ? (
                    <FolderGit2 className="h-5 w-5 text-primary" />
                  ) : (
                    <Folder className="h-5 w-5 text-primary" />
                  )}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base truncate">{project.name}</CardTitle>
                {analysis && <QualityIndicator score={analysis.qualityScore} size="sm" />}
                {onViewDetails && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-auto" />
                )}
              </div>
              {isGitProject && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <GitBranch className="h-3 w-3 shrink-0" />
                  <span className="font-mono truncate">
                    {currentBranch || project.defaultBranch || 'main'}
                  </span>
                </div>
              )}
              {!isGitProject && (
                <div className="text-xs text-muted-foreground">
                  Directory
                </div>
              )}
            </div>
          </div>
          {/* Desktop: absolute positioned actions on hover */}
          <div className="hidden sm:flex absolute top-3 right-3 gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded-md p-1 shadow-sm">
            {path && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onOpenFolder(path)}
                title="Open in Finder"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
            {!isGitProject && onConvertToGit && conversionCheck?.canConvert && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onConvertToGit(project)}
                title={`Convert to Git Project (${conversionCheck.gitUrl})`}
                disabled={checkingConversion}
              >
                <RefreshCw className={`h-4 w-4 ${checkingConversion ? 'animate-spin' : ''}`} />
              </Button>
            )}
            {onImportIssues && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onImportIssues(project)}
                title="Import Issues from Integrations"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            {onAnalyze && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onAnalyze(project)}
                title="Analyze for Skills"
              >
                <Search className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(project)}
              title="Edit Project"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onRemove(project.id)}
              title="Remove Project"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          {isGitProject && project.gitUrl && (
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-muted-foreground shrink-0">Git URL:</span>
              <span className="font-mono text-xs truncate" title={project.gitUrl}>
                {project.gitUrl.replace(/^https?:\/\//, '').replace(/\.git$/, '')}
              </span>
            </div>
          )}
          {path && (
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-muted-foreground shrink-0">Path:</span>
              <span className="font-mono text-xs truncate" title={path}>
                {path.replace(/^\/Users\/[^/]+/, '~')}
              </span>
            </div>
          )}
          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-2">
              {tags.map((tag) => (
                <TagChip key={tag.id} tag={tag} size="sm" />
              ))}
            </div>
          )}
        </div>
        {/* Mobile: actions at bottom */}
        <div className="flex sm:hidden gap-1 mt-3 pt-3 border-t">
          {path && (
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={() => onOpenFolder(path)}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Open
            </Button>
          )}
          {!isGitProject && onConvertToGit && conversionCheck?.canConvert && (
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={() => onConvertToGit(project)}
              disabled={checkingConversion}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${checkingConversion ? 'animate-spin' : ''}`} />
              Convert
            </Button>
          )}
          {onImportIssues && (
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={() => onImportIssues(project)}
            >
              <Download className="h-4 w-4 mr-1" />
              Import
            </Button>
          )}
          {onAnalyze && (
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={() => onAnalyze(project)}
            >
              <Search className="h-4 w-4 mr-1" />
              Analyze
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={() => onEdit(project)}
          >
            <Edit2 className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 text-destructive hover:text-destructive"
            onClick={() => onRemove(project.id)}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
