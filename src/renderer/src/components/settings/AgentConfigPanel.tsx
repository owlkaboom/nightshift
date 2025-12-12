/**
 * Agent Configuration Panel component for the settings view
 *
 * Allows users to:
 * - Select the default agent for task execution
 * - Configure API keys for agents that require them
 * - Enable/disable specific agents
 * - Set agent-specific settings like tier and custom paths
 */

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAgentCacheStore } from '@/stores/agent-cache-store'
import {
  Select,
  SelectContent,
  SelectItem,
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
import {
  Loader2,
  Bot,
  Check,
  X,
  Key,
  FolderOpen,
  AlertTriangle,
  Shield,
  ShieldAlert,
  Eye,
  EyeOff,
  Brain,
  Play
} from 'lucide-react'
import type { AgentConfigInfo, SecureStorageInfo } from '@shared/ipc-types'
import { cn } from '@/lib/utils'

// Gemini tier options
const GEMINI_TIERS = [
  { value: 'free', label: 'Free Tier', description: 'Limited requests per minute' },
  { value: 'tier_1', label: 'Tier 1', description: '500 RPM, $0 minimum billing' },
  { value: 'tier_2', label: 'Tier 2', description: '1000 RPM, higher limits' },
  { value: 'tier_3', label: 'Tier 3', description: '2000 RPM, enterprise' }
]

export function AgentConfigPanel() {
  const [agents, setAgents] = useState<AgentConfigInfo[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string>('')
  const [secureStorageInfo, setSecureStorageInfo] = useState<SecureStorageInfo | null>(null)

  // Get cache refresh function
  const { refresh: refreshAgentCache } = useAgentCacheStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // API key dialog state
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false)
  const [apiKeyAgent, setApiKeyAgent] = useState<AgentConfigInfo | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [apiKeyVisible, setApiKeyVisible] = useState(false)
  const [apiKeyError, setApiKeyError] = useState<string | null>(null)
  const [apiKeySaving, setApiKeySaving] = useState(false)

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true)
      const [agentList, selected, storageInfo] = await Promise.all([
        window.api.listAgentConfigs(),
        window.api.getSelectedAgent(),
        window.api.getSecureStorageInfo()
      ])
      setAgents(agentList)
      setSelectedAgentId(selected)
      setSecureStorageInfo(storageInfo)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent configuration')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  const handleSelectAgent = async (agentId: string) => {
    try {
      setSaving(true)
      setError(null)
      await window.api.setSelectedAgent(agentId)
      setSelectedAgentId(agentId)
      // Refresh agent cache after config change
      await refreshAgentCache()
      setSuccess('Default agent updated')
      setTimeout(() => setSuccess(null), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default agent')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleAgent = async (agent: AgentConfigInfo) => {
    try {
      await window.api.setAgentEnabled(agent.id, !agent.enabled)
      await fetchAgents()
      // Refresh agent cache after config change
      await refreshAgentCache()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle agent')
    }
  }

  const handleSetTier = async (agentId: string, tier: string) => {
    try {
      await window.api.setAgentTier(agentId, tier)
      await fetchAgents()
      setSuccess('Tier updated')
      setTimeout(() => setSuccess(null), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set tier')
    }
  }

  const handleSelectCustomPath = async (agentId: string) => {
    try {
      const path = await window.api.selectFile([{ name: 'Executables', extensions: ['*'] }])
      if (path) {
        await window.api.setAgentCustomPath(agentId, path)
        await fetchAgents()
        setSuccess('Custom path set')
        setTimeout(() => setSuccess(null), 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set custom path')
    }
  }

  const handleClearCustomPath = async (agentId: string) => {
    try {
      await window.api.setAgentCustomPath(agentId, null)
      await fetchAgents()
      setSuccess('Custom path cleared')
      setTimeout(() => setSuccess(null), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear custom path')
    }
  }

  const handleSetThinkingMode = async (agentId: string, enabled: boolean) => {
    try {
      await window.api.setAgentSetting(agentId, 'thinkingMode', enabled)
      setSuccess(`Thinking mode ${enabled ? 'enabled' : 'disabled'}`)
      setTimeout(() => setSuccess(null), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update thinking mode')
    }
  }

  const openApiKeyDialog = (agent: AgentConfigInfo) => {
    setApiKeyAgent(agent)
    setApiKeyInput('')
    setApiKeyVisible(false)
    setApiKeyError(null)
    setApiKeyDialogOpen(true)
  }

  const handleSaveApiKey = async () => {
    if (!apiKeyAgent) return

    try {
      setApiKeySaving(true)
      setApiKeyError(null)

      // Validate first
      const validation = await window.api.validateAgentApiKey(apiKeyAgent.id, apiKeyInput)
      if (!validation.valid) {
        setApiKeyError(validation.error || 'Invalid API key')
        return
      }

      // Save the key
      await window.api.setAgentApiKey(apiKeyAgent.id, apiKeyInput)
      await fetchAgents()
      // Refresh agent cache after config change
      await refreshAgentCache()
      setApiKeyDialogOpen(false)
      setSuccess('API key saved securely')
      setTimeout(() => setSuccess(null), 2000)
    } catch (err) {
      setApiKeyError(err instanceof Error ? err.message : 'Failed to save API key')
    } finally {
      setApiKeySaving(false)
    }
  }

  const handleDeleteApiKey = async (agentId: string) => {
    if (!confirm('Delete this API key? The agent may not work without it.')) return

    try {
      await window.api.deleteAgentApiKey(agentId)
      await fetchAgents()
      // Refresh agent cache after config change
      await refreshAgentCache()
      setSuccess('API key deleted')
      setTimeout(() => setSuccess(null), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete API key')
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI Agents
        </CardTitle>
        <CardDescription>
          Configure which AI agent to use for task execution and manage API credentials
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Secure Storage Status */}
        {secureStorageInfo && (
          <div
            className={cn(
              'flex items-center gap-2 p-3 rounded-lg border text-sm',
              secureStorageInfo.isEncryptionAvailable
                ? 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400'
                : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400'
            )}
          >
            {secureStorageInfo.isEncryptionAvailable ? (
              <>
                <Shield className="h-4 w-4" />
                <span>
                  API keys are encrypted using {secureStorageInfo.storageBackend === 'darwin' ? 'macOS Keychain' :
                    secureStorageInfo.storageBackend === 'win32' ? 'Windows DPAPI' :
                    secureStorageInfo.storageBackend}
                </span>
              </>
            ) : (
              <>
                <ShieldAlert className="h-4 w-4" />
                <span>
                  Secure storage not available. API keys will use basic encoding.
                </span>
              </>
            )}
          </div>
        )}

        {/* Error/Success Messages */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 text-green-700 dark:text-green-400 text-sm">
            <Check className="h-4 w-4" />
            {success}
          </div>
        )}

        {/* Agent List */}
        <div className="space-y-4" data-feature="model-agent-selector">
          {agents
            .filter((agent) => agent.id !== 'gemini' && agent.id !== 'openrouter')
            .map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                isSelected={agent.id === selectedAgentId}
                onSelect={() => handleSelectAgent(agent.id)}
                onToggle={() => handleToggleAgent(agent)}
                onSetApiKey={() => openApiKeyDialog(agent)}
                onDeleteApiKey={() => handleDeleteApiKey(agent.id)}
                onSetTier={(tier) => handleSetTier(agent.id, tier)}
                onSelectCustomPath={() => handleSelectCustomPath(agent.id)}
                onClearCustomPath={() => handleClearCustomPath(agent.id)}
                onSetThinkingMode={(enabled) => handleSetThinkingMode(agent.id, enabled)}
                saving={saving}
              />
            ))}
        </div>

        {/* API Key Dialog */}
        <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Set API Key for {apiKeyAgent?.name}
              </DialogTitle>
              <DialogDescription>
                Enter your API key. It will be stored securely on your local machine.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {apiKeyError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  {apiKeyError}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="api-key"
                    type={apiKeyVisible ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder={
                      apiKeyAgent?.id === 'gemini' ? 'AIza...' :
                      apiKeyAgent?.id === 'openrouter' ? 'sk-or-...' :
                      'Enter API key'
                    }
                    className="font-mono"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setApiKeyVisible(!apiKeyVisible)}
                    type="button"
                  >
                    {apiKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {apiKeyAgent?.id === 'gemini' && (
                  <p className="text-xs text-muted-foreground">
                    Get your API key from{' '}
                    <button
                      className="text-primary underline cursor-pointer"
                      onClick={() =>
                        window.api.openExternal('https://aistudio.google.com/app/apikey')
                      }
                    >
                      Google AI Studio
                    </button>
                  </p>
                )}
                {apiKeyAgent?.id === 'openrouter' && (
                  <p className="text-xs text-muted-foreground">
                    Get your API key from{' '}
                    <button
                      className="text-primary underline cursor-pointer"
                      onClick={() =>
                        window.api.openExternal('https://openrouter.ai/keys')
                      }
                    >
                      OpenRouter Keys
                    </button>
                    . Requires{' '}
                    <button
                      className="text-primary underline cursor-pointer"
                      onClick={() =>
                        window.api.openExternal('https://www.npmjs.com/package/@openrouter/cli')
                      }
                    >
                      @openrouter/cli
                    </button>
                    {' '}installed globally.
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setApiKeyDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveApiKey} disabled={!apiKeyInput || apiKeySaving}>
                {apiKeySaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save API Key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

/**
 * Individual agent card component
 */
function AgentCard({
  agent,
  isSelected,
  onSelect,
  onToggle,
  onSetApiKey,
  onDeleteApiKey,
  onSetTier,
  onSelectCustomPath,
  onClearCustomPath,
  onSetThinkingMode,
  saving
}: {
  agent: AgentConfigInfo
  isSelected: boolean
  onSelect: () => void
  onToggle: () => void
  onSetApiKey: () => void
  onDeleteApiKey: () => void
  onSetTier: (tier: string) => void
  onSelectCustomPath: () => void
  onClearCustomPath: () => void
  onSetThinkingMode: (enabled: boolean) => void
  saving: boolean
}) {
  const [thinkingMode, setThinkingMode] = useState(false)
  const [testingCli, setTestingCli] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; version?: string; error?: string } | null>(null)

  // Load thinking mode setting when component mounts
  useEffect(() => {
    if (agent.id === 'claude-code') {
      window.api.getAgentSetting(agent.id, 'thinkingMode').then((value) => {
        setThinkingMode(value === true)
      })
    }
  }, [agent.id])

  const handleThinkingModeToggle = () => {
    const newValue = !thinkingMode
    setThinkingMode(newValue)
    onSetThinkingMode(newValue)
  }

  const handleTestCli = async () => {
    setTestingCli(true)
    setTestResult(null)
    try {
      const result = await window.api.testAgentCli(agent.id)
      setTestResult(result)
      // Auto-clear success after 5 seconds
      if (result.success) {
        setTimeout(() => setTestResult(null), 5000)
      }
    } catch (err) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to test CLI'
      })
    } finally {
      setTestingCli(false)
    }
  }

  const canBeSelected = agent.available && (!agent.requiresApiKey || agent.hasApiKey)

  return (
    <div
      className={cn(
        'border rounded-lg p-4 transition-all',
        isSelected && 'border-primary bg-primary/5',
        !agent.enabled && 'opacity-60'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {/* Selection Radio */}
          <button
            onClick={onSelect}
            disabled={!canBeSelected || saving}
            className={cn(
              'mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
              isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/50',
              !canBeSelected && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
          </button>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{agent.name}</span>
              {isSelected && <Badge variant="default">Active</Badge>}
              {!agent.available && <Badge variant="outline">Not Installed</Badge>}
              {agent.requiresApiKey && !agent.hasApiKey && (
                <Badge variant="destructive">API Key Required</Badge>
              )}
              {agent.hasApiKey && <Badge variant="secondary">API Key Set</Badge>}
            </div>

            {/* Capabilities */}
            <div className="flex flex-wrap gap-1">
              {agent.capabilities.supportsSkills && (
                <Badge variant="outline" className="text-xs">
                  Skills
                </Badge>
              )}
              {agent.capabilities.supportsProjectConfig && (
                <Badge variant="outline" className="text-xs">
                  Project Config
                </Badge>
              )}
              {agent.capabilities.supportsContextFiles && (
                <Badge variant="outline" className="text-xs">
                  Context Files
                </Badge>
              )}
            </div>

            {/* Executable Path */}
            {agent.executablePath && (
              <p className="text-xs text-muted-foreground font-mono truncate max-w-md">
                {agent.customPath || agent.executablePath}
              </p>
            )}
            {!agent.available && (
              <p className="text-xs text-muted-foreground">
                Install the CLI to use this agent
              </p>
            )}
          </div>
        </div>

        {/* Enable/Disable Toggle */}
        <button
          onClick={onToggle}
          className={cn(
            'w-10 h-6 rounded-full transition-colors relative cursor-pointer',
            agent.enabled ? 'bg-primary' : 'bg-muted'
          )}
        >
          <div
            className={cn(
              'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
              agent.enabled ? 'translate-x-5' : 'translate-x-1'
            )}
          />
        </button>
      </div>

      {/* Agent-specific settings */}
      {agent.enabled && (
        <div className="mt-4 pt-4 border-t space-y-3">
          {/* API Key Management */}
          {agent.requiresApiKey && (
            <div className="flex items-center gap-2">
              <Label className="w-24 text-sm">API Key</Label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onSetApiKey}>
                  <Key className="h-4 w-4 mr-1" />
                  {agent.hasApiKey ? 'Update' : 'Set'} Key
                </Button>
                {agent.hasApiKey && (
                  <Button variant="outline" size="sm" onClick={onDeleteApiKey}>
                    <X className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Tier Selection (Gemini) */}
          {agent.id === 'gemini' && (
            <div className="flex items-center gap-2">
              <Label className="w-24 text-sm">API Tier</Label>
              <Select value={agent.tier || 'free'} onValueChange={onSetTier}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GEMINI_TIERS.map((tier) => (
                    <SelectItem key={tier.value} value={tier.value}>
                      <div>
                        <div>{tier.label}</div>
                        <div className="text-xs text-muted-foreground">{tier.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Thinking Mode Toggle (Claude Code only) */}
          {agent.id === 'claude-code' && (
            <div className="flex items-center gap-2">
              <Label className="w-24 text-sm">Thinking</Label>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleThinkingModeToggle}
                  className={cn(
                    'w-10 h-6 rounded-full transition-colors relative cursor-pointer',
                    thinkingMode ? 'bg-primary' : 'bg-muted'
                  )}
                >
                  <div
                    className={cn(
                      'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                      thinkingMode ? 'translate-x-5' : 'translate-x-1'
                    )}
                  />
                </button>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Brain className="h-4 w-4" />
                  <span>{thinkingMode ? 'Extended thinking enabled by default' : 'Thinking disabled by default'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Custom Path */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="w-24 text-sm">Executable</Label>
              <div className="flex gap-2 flex-1">
                <Input
                  value={agent.customPath || agent.executablePath || 'Auto-detect'}
                  readOnly
                  className="font-mono text-sm flex-1"
                />
                <Button variant="outline" size="sm" onClick={onSelectCustomPath} title="Select custom path">
                  <FolderOpen className="h-4 w-4" />
                </Button>
                {agent.customPath && (
                  <Button variant="outline" size="sm" onClick={onClearCustomPath} title="Clear custom path">
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestCli}
                  disabled={testingCli}
                  title="Test CLI executable"
                >
                  {testingCli ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            {/* Test Result */}
            {testResult && (
              <div
                className={cn(
                  'flex items-center gap-2 p-2 rounded text-sm ml-26',
                  testResult.success
                    ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                    : 'bg-destructive/10 text-destructive'
                )}
              >
                {testResult.success ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>CLI working! Version: {testResult.version || 'unknown'}</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4" />
                    <span>{testResult.error || 'CLI test failed'}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
