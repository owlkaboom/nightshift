/**
 * Integration storage layer
 * Manages integration connections and sources (GitHub, JIRA, etc.)
 */

import { app } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import type {
  Integration,
  CreateIntegrationData,
  IntegrationConnection,
  IntegrationSource,
  CreateConnectionData,
  CreateSourceData,
  GitHubConfig,
  JiraConfig,
  JiraSourceConfig
} from '@shared/types'

const INTEGRATIONS_FILE = path.join(app.getPath('userData'), 'integrations.json')

/**
 * Integration registry file structure (v2 - hierarchical)
 */
interface IntegrationsRegistryV2 {
  version: 2
  connections: IntegrationConnection[]
  sources: IntegrationSource[]
}

/**
 * Legacy integration registry file structure (v1 - flat)
 */
interface IntegrationsRegistryV1 {
  integrations: Integration[]
}

/**
 * Union type for registry versions
 */
type IntegrationsRegistry = IntegrationsRegistryV2 | IntegrationsRegistryV1

/**
 * Get the path to the integrations.json file
 */
export function getIntegrationsFilePath(): string {
  return INTEGRATIONS_FILE
}

/**
 * Check if registry is v1 (legacy)
 */
function isV1Registry(registry: IntegrationsRegistry): registry is IntegrationsRegistryV1 {
  return 'integrations' in registry
}

/**
 * Migrate v1 registry to v2 (flat integrations → connections + sources)
 */
async function migrateV1ToV2(v1: IntegrationsRegistryV1): Promise<IntegrationsRegistryV2> {
  console.log('[IntegrationStore] Migrating v1 registry to v2...')

  const connections: IntegrationConnection[] = []
  const sources: IntegrationSource[] = []

  // Convert each legacy integration into 1 connection + 1 source
  for (const integration of v1.integrations) {
    const connectionId = integration.id // Preserve ID for credential lookup
    const sourceId = `${integration.id}_source`

    if (integration.type === 'github') {
      const config = integration.config as GitHubConfig

      // Create connection (auth only)
      const connection: IntegrationConnection = {
        id: connectionId,
        type: 'github',
        name: integration.name,
        enabled: integration.enabled,
        createdAt: integration.createdAt,
        lastTestedAt: null,
        config: {
          type: 'github'
          // Token remains in secure storage with same key
        }
      }
      connections.push(connection)

      // Create source (repo + filters)
      const source: IntegrationSource = {
        id: sourceId,
        connectionId,
        name: `${config.owner}/${config.repo}`,
        enabled: integration.enabled,
        createdAt: integration.createdAt,
        config: {
          type: 'github',
          sourceType: 'repository',
          owner: config.owner,
          repo: config.repo,
          defaultLabels: config.defaultLabels,
          autoCreatePR: config.autoCreatePR
        }
      }
      sources.push(source)
    } else if (integration.type === 'jira') {
      const config = integration.config as JiraConfig

      // Create connection (auth + base URL)
      const connection: IntegrationConnection = {
        id: connectionId,
        type: 'jira',
        name: integration.name,
        enabled: integration.enabled,
        createdAt: integration.createdAt,
        lastTestedAt: null,
        config: {
          type: 'jira',
          baseUrl: config.baseUrl,
          email: config.email
          // Token remains in secure storage with same key
        }
      }
      connections.push(connection)

      // Create source based on what was configured
      let sourceConfig: JiraSourceConfig
      if (config.jql) {
        // Custom JQL filter
        sourceConfig = {
          type: 'jira',
          sourceType: 'jql',
          jql: config.jql
        }
      } else {
        // Default to project source
        sourceConfig = {
          type: 'jira',
          sourceType: 'project',
          projectKey: config.projectKey
        }
      }

      const source: IntegrationSource = {
        id: sourceId,
        connectionId,
        name: config.projectKey,
        enabled: integration.enabled,
        createdAt: integration.createdAt,
        config: sourceConfig
      }
      sources.push(source)
    }
  }

  console.log(`[IntegrationStore] Migration complete: ${connections.length} connections, ${sources.length} sources`)

  return {
    version: 2,
    connections,
    sources
  }
}

/**
 * Ensure the integrations file exists
 */
async function ensureIntegrationsFile(): Promise<void> {
  try {
    await fs.access(INTEGRATIONS_FILE)
  } catch {
    const defaultRegistry: IntegrationsRegistryV2 = {
      version: 2,
      connections: [],
      sources: []
    }
    await fs.writeFile(INTEGRATIONS_FILE, JSON.stringify(defaultRegistry, null, 2), 'utf-8')
  }
}

/**
 * Read the integrations registry (automatically migrates v1 to v2)
 */
async function readRegistry(): Promise<IntegrationsRegistryV2> {
  await ensureIntegrationsFile()
  const content = await fs.readFile(INTEGRATIONS_FILE, 'utf-8')
  const registry = JSON.parse(content) as IntegrationsRegistry

  // Auto-migrate v1 to v2
  if (isV1Registry(registry)) {
    const v2 = await migrateV1ToV2(registry)
    await writeRegistry(v2)
    return v2
  }

  return registry
}

/**
 * Write the integrations registry
 */
async function writeRegistry(registry: IntegrationsRegistryV2): Promise<void> {
  await fs.writeFile(INTEGRATIONS_FILE, JSON.stringify(registry, null, 2), 'utf-8')
}

/**
 * Generate a unique connection ID
 */
function generateConnectionId(): string {
  return `connection_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Generate a unique source ID
 */
function generateSourceId(): string {
  return `source_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

// ============================================================================
// CONNECTION CRUD OPERATIONS
// ============================================================================

/**
 * List all connections
 */
export async function listConnections(): Promise<IntegrationConnection[]> {
  const registry = await readRegistry()
  return registry.connections
}

/**
 * Get a single connection by ID
 */
export async function getConnection(id: string): Promise<IntegrationConnection | null> {
  const registry = await readRegistry()
  return registry.connections.find((c) => c.id === id) || null
}

/**
 * Create a new connection
 */
export async function createConnection(data: CreateConnectionData): Promise<IntegrationConnection> {
  const registry = await readRegistry()

  const connection: IntegrationConnection = {
    id: generateConnectionId(),
    ...data,
    createdAt: new Date().toISOString(),
    lastTestedAt: null
  }

  registry.connections.push(connection)
  await writeRegistry(registry)

  return connection
}

/**
 * Update an existing connection
 */
export async function updateConnection(
  id: string,
  updates: Partial<Omit<IntegrationConnection, 'id' | 'createdAt'>>
): Promise<IntegrationConnection | null> {
  const registry = await readRegistry()
  const index = registry.connections.findIndex((c) => c.id === id)

  if (index === -1) {
    return null
  }

  registry.connections[index] = {
    ...registry.connections[index],
    ...updates
  }

  await writeRegistry(registry)
  return registry.connections[index]
}

/**
 * Delete a connection and all its sources
 */
export async function deleteConnection(id: string): Promise<boolean> {
  const registry = await readRegistry()
  const index = registry.connections.findIndex((c) => c.id === id)

  if (index === -1) {
    return false
  }

  // Remove the connection
  registry.connections.splice(index, 1)

  // Remove all sources belonging to this connection
  registry.sources = registry.sources.filter((s) => s.connectionId !== id)

  await writeRegistry(registry)
  return true
}

/**
 * Get connections by type
 */
export async function getConnectionsByType(type: 'github' | 'jira'): Promise<IntegrationConnection[]> {
  const registry = await readRegistry()
  return registry.connections.filter((c) => c.type === type)
}

// ============================================================================
// SOURCE CRUD OPERATIONS
// ============================================================================

/**
 * List all sources
 */
export async function listSources(): Promise<IntegrationSource[]> {
  const registry = await readRegistry()
  return registry.sources
}

/**
 * Get a single source by ID
 */
export async function getSource(id: string): Promise<IntegrationSource | null> {
  const registry = await readRegistry()
  return registry.sources.find((s) => s.id === id) || null
}

/**
 * Get all sources for a specific connection
 */
export async function getSourcesForConnection(connectionId: string): Promise<IntegrationSource[]> {
  const registry = await readRegistry()
  return registry.sources.filter((s) => s.connectionId === connectionId)
}

/**
 * Create a new source
 */
export async function createSource(data: CreateSourceData): Promise<IntegrationSource> {
  const registry = await readRegistry()

  // Verify connection exists
  const connectionExists = registry.connections.some((c) => c.id === data.connectionId)
  if (!connectionExists) {
    throw new Error(`Connection ${data.connectionId} not found`)
  }

  const source: IntegrationSource = {
    id: generateSourceId(),
    ...data,
    createdAt: new Date().toISOString()
  }

  registry.sources.push(source)
  await writeRegistry(registry)

  return source
}

/**
 * Update an existing source
 */
export async function updateSource(
  id: string,
  updates: Partial<Omit<IntegrationSource, 'id' | 'createdAt' | 'connectionId'>>
): Promise<IntegrationSource | null> {
  const registry = await readRegistry()
  const index = registry.sources.findIndex((s) => s.id === id)

  if (index === -1) {
    return null
  }

  registry.sources[index] = {
    ...registry.sources[index],
    ...updates
  }

  await writeRegistry(registry)
  return registry.sources[index]
}

/**
 * Delete a source
 */
export async function deleteSource(id: string): Promise<boolean> {
  const registry = await readRegistry()
  const index = registry.sources.findIndex((s) => s.id === id)

  if (index === -1) {
    return false
  }

  registry.sources.splice(index, 1)
  await writeRegistry(registry)

  return true
}

// ============================================================================
// LEGACY COMPATIBILITY LAYER
// ============================================================================

/**
 * List all integrations (legacy wrapper)
 * @deprecated Use listConnections() and listSources() instead
 */
export async function listIntegrations(): Promise<Integration[]> {
  // This is for backward compatibility only
  // Returns empty array since we've migrated to connections/sources
  return []
}

/**
 * Get a single integration by ID (legacy wrapper)
 * @deprecated Use getConnection() or getSource() instead
 */
export async function getIntegration(_id: string): Promise<Integration | null> {
  return null
}

/**
 * Create a new integration (legacy wrapper)
 * @deprecated Use createConnection() and createSource() instead
 */
export async function createIntegration(_data: CreateIntegrationData): Promise<Integration> {
  throw new Error('createIntegration is deprecated. Use createConnection and createSource instead.')
}

/**
 * Update an existing integration (legacy wrapper)
 * @deprecated Use updateConnection() or updateSource() instead
 */
export async function updateIntegration(
  _id: string,
  _updates: Partial<Omit<Integration, 'id' | 'createdAt'>>
): Promise<Integration | null> {
  return null
}

/**
 * Delete an integration (legacy wrapper)
 * @deprecated Use deleteConnection() or deleteSource() instead
 */
export async function deleteIntegration(id: string): Promise<boolean> {
  // Try to delete as connection first
  const connectionDeleted = await deleteConnection(id)
  if (connectionDeleted) return true

  // Otherwise try as source
  return await deleteSource(id)
}

/**
 * Get integrations by type (legacy wrapper)
 * @deprecated Use getConnectionsByType() instead
 */
export async function getIntegrationsByType(_type: 'github' | 'jira'): Promise<Integration[]> {
  return []
}

/**
 * Get integrations for a specific project (legacy wrapper)
 * @deprecated Projects no longer link to integrations directly
 */
export async function getIntegrationsForProject(_projectId: string): Promise<Integration[]> {
  return []
}
