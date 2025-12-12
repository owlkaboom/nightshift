import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { MarkdownRenderer } from '@/components/ui/markdown-renderer'
import { Info, FileText, Github, ExternalLink, Copy, Check } from 'lucide-react'
import { APP_NAME } from '@shared/constants'

export function AboutPanel() {
  const [version, setVersion] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [changelogOpen, setChangelogOpen] = useState(false)
  const [changelogContent, setChangelogContent] = useState<string>('')
  const [loadingChangelog, setLoadingChangelog] = useState(false)

  useEffect(() => {
    window.api.getVersion().then(setVersion)
  }, [])

  const handleCopyVersion = async () => {
    await navigator.clipboard.writeText(`${APP_NAME} v${version}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOpenChangelog = async () => {
    setLoadingChangelog(true)
    setChangelogOpen(true)
    try {
      const content = await window.api.getChangelog()
      setChangelogContent(content)
    } catch (error) {
      console.error('Failed to load changelog:', error)
      setChangelogContent('# Error\n\nFailed to load changelog.')
    } finally {
      setLoadingChangelog(false)
    }
  }

  const handleOpenGithub = () => {
    window.api.openExternal('https://github.com/your-username/nightshift')
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            About {APP_NAME}
          </CardTitle>
          <CardDescription>Version information and resources</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="space-y-1">
              <p className="text-sm font-medium">Version</p>
              <p className="text-2xl font-mono font-bold">{version || '...'}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyVersion}
              className="gap-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenChangelog}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              View Changelog
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenGithub}
              className="gap-2"
            >
              <Github className="h-4 w-4" />
              GitHub
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {APP_NAME} is an AI task orchestrator that helps developers queue, manage, and review AI-assisted coding tasks.
          </p>
        </CardContent>
      </Card>

      <Dialog open={changelogOpen} onOpenChange={setChangelogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Changelog</DialogTitle>
            <DialogDescription>
              All notable changes to {APP_NAME}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            {loadingChangelog ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">Loading changelog...</p>
              </div>
            ) : (
              <MarkdownRenderer content={changelogContent} className="text-sm" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
