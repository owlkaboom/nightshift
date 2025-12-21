/**
 * Setup Integration Dialog
 *
 * Multi-step wizard for adding new GitHub or JIRA integrations
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Github, Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react'
import { useIntegrationStore } from '@/stores/integration-store'
import type { IntegrationType, GitHubConnectionConfig, JiraConnectionConfig } from '@shared/types'
import { cn } from '@/lib/utils'

interface SetupIntegrationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SetupIntegrationDialog({ open, onOpenChange }: SetupIntegrationDialogProps) {
  const { createConnection, testConnection } = useIntegrationStore()

  const [integrationType, setIntegrationType] = useState<IntegrationType>('github')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string } | null>(null)

  // GitHub fields
  const [githubName, setGithubName] = useState('')
  const [githubOwner, setGithubOwner] = useState('')
  const [githubRepo, setGithubRepo] = useState('')
  const [githubToken, setGithubToken] = useState('')
  const [githubAutoCreatePR, setGithubAutoCreatePR] = useState(false)
  const [githubDefaultLabels, setGithubDefaultLabels] = useState('')

  // JIRA fields
  const [jiraName, setJiraName] = useState('')
  const [jiraBaseUrl, setJiraBaseUrl] = useState('')
  const [jiraEmail, setJiraEmail] = useState('')
  const [jiraToken, setJiraToken] = useState('')

  const resetForm = () => {
    setGithubName('')
    setGithubOwner('')
    setGithubRepo('')
    setGithubToken('')
    setGithubAutoCreatePR(false)
    setGithubDefaultLabels('')
    setJiraName('')
    setJiraBaseUrl('')
    setJiraEmail('')
    setJiraToken('')
    setTestResult(null)
  }

  const handleClose = () => {
    resetForm()
    onOpenChange(false)
  }

  const validateGitHub = () => {
    return (
      githubName.trim() !== '' &&
      githubOwner.trim() !== '' &&
      githubRepo.trim() !== '' &&
      githubToken.trim() !== ''
    )
  }

  const validateJira = () => {
    return (
      jiraName.trim() !== '' &&
      jiraBaseUrl.trim() !== '' &&
      jiraEmail.trim() !== '' &&
      jiraToken.trim() !== ''
    )
  }

  const handleSave = async () => {
    if (integrationType === 'github' && !validateGitHub()) return
    if (integrationType === 'jira' && !validateJira()) return

    setSaving(true)
    try {
      if (integrationType === 'github') {
        // GitHub still uses legacy integration model for now
        // TODO: Migrate to connection/source model
        const config: GitHubConnectionConfig = {
          type: 'github'
        }

        await createConnection({
          type: 'github',
          name: githubName.trim(),
          enabled: true,
          config
        }, githubToken.trim())
      } else {
        // JIRA uses new connection model
        const config: JiraConnectionConfig = {
          type: 'jira',
          baseUrl: jiraBaseUrl.trim(),
          email: jiraEmail.trim()
        }

        await createConnection({
          type: 'jira',
          name: jiraName.trim(),
          enabled: true,
          config
        }, jiraToken.trim())
      }

      handleClose()
    } catch {
      // Error is handled by store
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)

    try {
      // Create a temporary connection to test
      let tempConnection
      if (integrationType === 'github') {
        const config: GitHubConnectionConfig = {
          type: 'github'
        }
        tempConnection = await createConnection({
          type: 'github',
          name: `__test_${Date.now()}`,
          enabled: false,
          config
        }, githubToken.trim())
      } else {
        const config: JiraConnectionConfig = {
          type: 'jira',
          baseUrl: jiraBaseUrl.trim(),
          email: jiraEmail.trim()
        }
        tempConnection = await createConnection({
          type: 'jira',
          name: `__test_${Date.now()}`,
          enabled: false,
          config
        }, jiraToken.trim())
      }

      // Test the connection
      const result = await testConnection(tempConnection.id)
      setTestResult({
        success: result.success,
        message: result.error || result.details || (result.success ? 'Connection successful!' : 'Connection failed')
      })

      // Delete the temporary connection
      await window.api.deleteConnection(tempConnection.id)
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Test failed'
      })
    } finally {
      setTesting(false)
    }
  }

  const isValid = integrationType === 'github' ? validateGitHub() : validateJira()

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Integration</DialogTitle>
          <DialogDescription>
            Connect to GitHub or JIRA to import issues as tasks
          </DialogDescription>
        </DialogHeader>

        <Tabs value={integrationType} onValueChange={(v) => setIntegrationType(v as IntegrationType)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="github">
              <Github className="mr-2 h-4 w-4" />
              GitHub
            </TabsTrigger>
            <TabsTrigger value="jira">
              <Settings className="mr-2 h-4 w-4" />
              JIRA
            </TabsTrigger>
          </TabsList>

          <TabsContent value="github" className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="github-name">Integration Name</Label>
                <Input
                  id="github-name"
                  placeholder="My GitHub Repo"
                  value={githubName}
                  onChange={(e) => setGithubName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="github-owner">Owner/Organization</Label>
                  <Input
                    id="github-owner"
                    placeholder="octocat"
                    value={githubOwner}
                    onChange={(e) => setGithubOwner(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="github-repo">Repository</Label>
                  <Input
                    id="github-repo"
                    placeholder="hello-world"
                    value={githubRepo}
                    onChange={(e) => setGithubRepo(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="github-token">Personal Access Token</Label>
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    Create token
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <Input
                  id="github-token"
                  type="password"
                  placeholder="ghp_..."
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Required scopes: repo, read:org
                </p>
              </div>

              <div>
                <Label htmlFor="github-labels">Default Labels (optional)</Label>
                <Input
                  id="github-labels"
                  placeholder="bug, feature, enhancement"
                  value={githubDefaultLabels}
                  onChange={(e) => setGithubDefaultLabels(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Comma-separated list of labels to filter issues
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="github-auto-pr">Auto-create Pull Requests</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Automatically create PR when task is accepted
                  </p>
                </div>
                <Switch
                  id="github-auto-pr"
                  checked={githubAutoCreatePR}
                  onCheckedChange={setGithubAutoCreatePR}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="jira" className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="jira-name">Integration Name</Label>
                <Input
                  id="jira-name"
                  placeholder="My JIRA Workspace"
                  value={jiraName}
                  onChange={(e) => setJiraName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  A friendly name for this JIRA connection
                </p>
              </div>

              <div>
                <Label htmlFor="jira-url">JIRA Base URL</Label>
                <Input
                  id="jira-url"
                  placeholder="https://your-domain.atlassian.net"
                  value={jiraBaseUrl}
                  onChange={(e) => setJiraBaseUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Your JIRA Cloud instance URL
                </p>
              </div>

              <div>
                <Label htmlFor="jira-email">Email</Label>
                <Input
                  id="jira-email"
                  type="email"
                  placeholder="user@example.com"
                  value={jiraEmail}
                  onChange={(e) => setJiraEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Your JIRA account email address
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="jira-token">API Token</Label>
                  <a
                    href="https://id.atlassian.com/manage-profile/security/api-tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    Create token
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <Input
                  id="jira-token"
                  type="password"
                  placeholder="API token"
                  value={jiraToken}
                  onChange={(e) => setJiraToken(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Generate an API token from your Atlassian account settings
                </p>
              </div>

              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">
                  After creating this connection, you'll be able to add specific boards, sprints, filters, or projects as sources to import issues from.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {testResult && (
          <div className={cn(
            "flex items-center gap-2 rounded-md border p-3",
            testResult.success
              ? "border-green-200 bg-green-50 text-green-900"
              : "border-red-200 bg-red-50 text-red-900"
          )}>
            {testResult.success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <span className="text-sm">{testResult.message}</span>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={!isValid || testing || saving}
          >
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              'Test Connection'
            )}
          </Button>
          <Button onClick={handleSave} disabled={!isValid || saving || testing}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Integration'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Import Settings icon for JIRA tab
import { Settings } from 'lucide-react'
