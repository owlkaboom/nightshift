/**
 * Setup Connection Dialog - Wizard flow for creating connections and sources
 *
 * Flow:
 * 1. Choose connection type (GitHub/Jira)
 * 2. Enter connection details and token
 * 3. Test connection
 * 4. Add first source (optional but recommended)
 */

import { useState } from 'react'
import type {
  IntegrationType,
  CreateConnectionData,
  CreateSourceData,
  GitHubConnectionConfig,
  JiraConnectionConfig,
  GitHubSourceConfig,
  JiraSourceConfig
} from '@shared/types'
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
import {
  Github,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Settings,
  ArrowLeft,
  ArrowRight
} from 'lucide-react'
import { useIntegrationStore } from '@/stores/integration-store'
import { JiraSourcePicker } from './JiraSourcePicker'
import { cn } from '@/lib/utils'

interface SetupConnectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type WizardStep = 'connection' | 'test' | 'source'

/**
 * Wizard dialog for creating a new connection and optionally adding a first source
 */
export function SetupConnectionDialog({ open, onOpenChange }: SetupConnectionDialogProps) {
  const { createConnection, testConnection, createSource } = useIntegrationStore()

  // Wizard state
  const [step, setStep] = useState<WizardStep>('connection')
  const [integrationType, setIntegrationType] = useState<IntegrationType>('github')
  const [createdConnectionId, setCreatedConnectionId] = useState<string | null>(null)

  // Loading states
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string } | null>(
    null
  )

  // GitHub connection fields
  const [githubName, setGithubName] = useState('')
  const [githubToken, setGithubToken] = useState('')

  // Jira connection fields
  const [jiraName, setJiraName] = useState('')
  const [jiraBaseUrl, setJiraBaseUrl] = useState('')
  const [jiraEmail, setJiraEmail] = useState('')
  const [jiraToken, setJiraToken] = useState('')

  // GitHub source fields
  const [githubSourceName, setGithubSourceName] = useState('')
  const [githubOwner, setGithubOwner] = useState('')
  const [githubRepo, setGithubRepo] = useState('')
  const [githubAutoCreatePR, setGithubAutoCreatePR] = useState(false)
  const [githubDefaultLabels, setGithubDefaultLabels] = useState('')

  // Jira source config (managed by JiraSourcePicker)
  const [jiraSourceName, setJiraSourceName] = useState('')
  const [jiraSourceConfig, setJiraSourceConfig] = useState<JiraSourceConfig | null>(null)

  const resetForm = () => {
    setStep('connection')
    setCreatedConnectionId(null)
    setGithubName('')
    setGithubToken('')
    setJiraName('')
    setJiraBaseUrl('')
    setJiraEmail('')
    setJiraToken('')
    setGithubSourceName('')
    setGithubOwner('')
    setGithubRepo('')
    setGithubAutoCreatePR(false)
    setGithubDefaultLabels('')
    setJiraSourceName('')
    setJiraSourceConfig(null)
    setTestResult(null)
  }

  const handleClose = () => {
    resetForm()
    onOpenChange(false)
  }

  const validateConnection = () => {
    if (integrationType === 'github') {
      return githubName.trim() !== '' && githubToken.trim() !== ''
    }
    return (
      jiraName.trim() !== '' &&
      jiraBaseUrl.trim() !== '' &&
      jiraEmail.trim() !== '' &&
      jiraToken.trim() !== ''
    )
  }

  const handleCreateConnection = async () => {
    if (!validateConnection()) return

    setSaving(true)
    try {
      let connectionData: CreateConnectionData
      let token: string

      if (integrationType === 'github') {
        const config: GitHubConnectionConfig = {
          type: 'github'
        }
        connectionData = {
          type: 'github',
          name: githubName.trim(),
          enabled: true,
          config
        }
        token = githubToken.trim()
      } else {
        const config: JiraConnectionConfig = {
          type: 'jira',
          baseUrl: jiraBaseUrl.trim(),
          email: jiraEmail.trim()
        }
        connectionData = {
          type: 'jira',
          name: jiraName.trim(),
          enabled: true,
          config
        }
        token = jiraToken.trim()
      }

      const connection = await createConnection(connectionData, token)
      setCreatedConnectionId(connection.id)
      setStep('test')
    } catch {
      // Error handled by store
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    if (!createdConnectionId) return

    setTesting(true)
    setTestResult(null)

    try {
      const result = await testConnection(createdConnectionId)
      setTestResult({
        success: result.success,
        message:
          result.error ||
          result.details ||
          (result.success ? 'Connection successful!' : 'Connection failed')
      })
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Test failed'
      })
    } finally {
      setTesting(false)
    }
  }

  const validateSource = () => {
    if (integrationType === 'github') {
      return (
        githubSourceName.trim() !== '' &&
        githubOwner.trim() !== '' &&
        githubRepo.trim() !== ''
      )
    }
    return jiraSourceName.trim() !== '' && jiraSourceConfig !== null
  }

  const handleCreateSource = async () => {
    if (!createdConnectionId || !validateSource()) return

    setSaving(true)
    try {
      let sourceData: CreateSourceData

      if (integrationType === 'github') {
        const config: GitHubSourceConfig = {
          type: 'github',
          sourceType: 'repository',
          owner: githubOwner.trim(),
          repo: githubRepo.trim(),
          autoCreatePR: githubAutoCreatePR,
          defaultLabels: githubDefaultLabels
            .split(',')
            .map((l) => l.trim())
            .filter(Boolean)
        }
        sourceData = {
          connectionId: createdConnectionId,
          name: githubSourceName.trim(),
          enabled: true,
          config
        }
      } else {
        if (!jiraSourceConfig) return
        sourceData = {
          connectionId: createdConnectionId,
          name: jiraSourceName.trim(),
          enabled: true,
          config: jiraSourceConfig
        }
      }

      await createSource(sourceData)
      handleClose()
    } catch {
      // Error handled by store
    } finally {
      setSaving(false)
    }
  }

  const handleSkipSource = () => {
    handleClose()
  }

  const canProceedToTest = validateConnection()
  const canProceedToSource = testResult?.success === true
  const canFinish = validateSource()

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {step === 'connection' && 'Create Connection'}
            {step === 'test' && 'Test Connection'}
            {step === 'source' && 'Add First Source'}
          </DialogTitle>
          <DialogDescription>
            {step === 'connection' && 'Enter authentication details for the service'}
            {step === 'test' && 'Verify that the connection works correctly'}
            {step === 'source' && 'Configure your first data source (recommended)'}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Connection Details */}
        {step === 'connection' && (
          <Tabs
            value={integrationType}
            onValueChange={(v) => setIntegrationType(v as IntegrationType)}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="github">
                <Github className="mr-2 h-4 w-4" />
                GitHub
              </TabsTrigger>
              <TabsTrigger value="jira">
                <Settings className="mr-2 h-4 w-4" />
                Jira
              </TabsTrigger>
            </TabsList>

            <TabsContent value="github" className="space-y-4">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="github-name">Connection Name</Label>
                  <Input
                    id="github-name"
                    placeholder="My GitHub Account"
                    value={githubName}
                    onChange={(e) => setGithubName(e.target.value)}
                  />
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
              </div>
            </TabsContent>

            <TabsContent value="jira" className="space-y-4">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="jira-name">Connection Name</Label>
                  <Input
                    id="jira-name"
                    placeholder="My Work Jira"
                    value={jiraName}
                    onChange={(e) => setJiraName(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="jira-url">Jira Base URL</Label>
                  <Input
                    id="jira-url"
                    placeholder="https://your-domain.atlassian.net"
                    value={jiraBaseUrl}
                    onChange={(e) => setJiraBaseUrl(e.target.value)}
                  />
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
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Step 2: Test Connection */}
        {step === 'test' && (
          <div className="space-y-4">
            <div className="rounded-md border p-4 bg-muted/50">
              <p className="text-sm text-muted-foreground mb-2">
                Click "Test Connection" to verify your credentials work correctly.
              </p>
              <Button onClick={handleTestConnection} disabled={testing} size="sm">
                {testing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </Button>
            </div>

            {testResult && (
              <div
                className={cn(
                  'flex items-center gap-2 rounded-md border p-3',
                  testResult.success
                    ? 'border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100'
                    : 'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100'
                )}
              >
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <span className="text-sm">{testResult.message}</span>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Add Source */}
        {step === 'source' && createdConnectionId && (
          <div className="space-y-4">
            {integrationType === 'github' ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="github-source-name">Source Name</Label>
                  <Input
                    id="github-source-name"
                    placeholder="Frontend Repo"
                    value={githubSourceName}
                    onChange={(e) => setGithubSourceName(e.target.value)}
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
            ) : (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="jira-source-name">Source Name</Label>
                  <Input
                    id="jira-source-name"
                    placeholder="Platform Board"
                    value={jiraSourceName}
                    onChange={(e) => setJiraSourceName(e.target.value)}
                  />
                </div>

                <JiraSourcePicker
                  connectionId={createdConnectionId}
                  value={jiraSourceConfig}
                  onChange={setJiraSourceConfig}
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 'connection' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleCreateConnection} disabled={!canProceedToTest || saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </>
          )}

          {step === 'test' && (
            <>
              <Button variant="outline" onClick={() => setStep('connection')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={() => setStep('source')} disabled={!canProceedToSource}>
                {canProceedToSource ? (
                  <>
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                ) : (
                  'Test First'
                )}
              </Button>
            </>
          )}

          {step === 'source' && (
            <>
              <Button variant="outline" onClick={handleSkipSource}>
                Skip
              </Button>
              <Button onClick={handleCreateSource} disabled={!canFinish || saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Finish'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
