/**
 * Groups to Tags Migration
 *
 * Migrates the hierarchical Groups system to the flat Tags system.
 * - Converts all groups (flattened) to tags
 * - Maps group.projectIds to project.tagIds
 * - Preserves names and colors
 * - Keeps groups.json as backup
 */

import { promises as fs } from 'fs'
import path from 'path'
import { getSyncDir } from '@main/utils/paths'
import { getTagStore } from '@main/storage/tag-store'
import { getDatabase } from '@main/storage/database'
import { logger } from '@main/utils/logger'
import type { Group } from '@shared/types/group'

interface GroupsRegistry {
  groups: Group[]
}

interface GroupProjectMapping {
  [groupId: string]: string[] // groupId → projectIds
}

/**
 * Checks if groups.json exists and migration is needed
 */
export function needsGroupToTagMigration(): boolean {
  const groupsPath = path.join(getSyncDir(), 'groups.json')
  try {
    const stats = require('fs').statSync(groupsPath)
    return stats.isFile()
  } catch {
    return false
  }
}

/**
 * Loads groups from groups.json (legacy file)
 */
async function loadGroupsFromJson(): Promise<GroupsRegistry> {
  const groupsPath = path.join(getSyncDir(), 'groups.json')
  try {
    const data = await fs.readFile(groupsPath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error('[Migration] Failed to read groups.json:', error)
    return { groups: [] }
  }
}

/**
 * Loads group-project mappings from SQLite database
 */
function loadGroupProjectMappings(): GroupProjectMapping {
  const db = getDatabase()

  try {
    const rows = db.prepare('SELECT group_id, project_id FROM group_projects').all() as Array<{
      group_id: string
      project_id: string
    }>

    const mapping: GroupProjectMapping = {}
    for (const row of rows) {
      if (!mapping[row.group_id]) {
        mapping[row.group_id] = []
      }
      mapping[row.group_id].push(row.project_id)
    }

    return mapping
  } catch (error) {
    console.error('[Migration] Failed to load group-project mappings:', error)
    return {}
  }
}

/**
 * Creates a backup of groups.json
 */
async function backupGroupsJson(): Promise<void> {
  const groupsPath = path.join(getSyncDir(), 'groups.json')
  const backupPath = path.join(getSyncDir(), 'groups.json.backup')

  try {
    await fs.copyFile(groupsPath, backupPath)
    logger.debug('[Migration] Created backup at:', backupPath)
  } catch (error) {
    console.error('[Migration] Failed to create backup:', error)
  }
}

/**
 * Migrates all groups to tags and updates project associations
 */
export async function migrateGroupsToTags(): Promise<{
  success: boolean
  groupsConverted: number
  projectsUpdated: number
  errors: string[]
}> {
  const errors: string[] = []
  let groupsConverted = 0
  let projectsUpdated = 0

  try {
    logger.debug('[Migration] Starting groups to tags migration...')

    // Step 1: Backup groups.json
    await backupGroupsJson()

    // Step 2: Load groups and mappings
    const { groups } = await loadGroupsFromJson()
    const groupProjectMappings = loadGroupProjectMappings()

    logger.debug(`[Migration] Found ${groups.length} groups to convert`)

    // Step 3: Initialize tag store
    const tagStore = getTagStore()
    await tagStore.initialize()

    // Step 4: Convert each group to a tag
    const groupIdToTagId = new Map<string, string>()

    for (const group of groups) {
      try {
        // Try to create tag with same name and color
        const tag = await tagStore.create(group.name, group.color || undefined)
        groupIdToTagId.set(group.id, tag.id)
        groupsConverted++

        logger.debug(`[Migration] Converted group "${group.name}" to tag "${tag.name}"`)
      } catch (error) {
        // If tag already exists, find it and reuse it
        if (error instanceof Error && error.message.includes('already exists')) {
          const existingTags = await tagStore.list()
          const existingTag = existingTags.find(
            (t) => t.name.toLowerCase() === group.name.toLowerCase()
          )

          if (existingTag) {
            groupIdToTagId.set(group.id, existingTag.id)
            logger.debug(`[Migration] Reusing existing tag "${existingTag.name}" for group "${group.name}"`)
          } else {
            const message = `Failed to convert group ${group.name}: Tag exists but couldn't be found`
            errors.push(message)
            console.error(`[Migration] ${message}`)
          }
        } else {
          const message = `Failed to convert group ${group.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
          errors.push(message)
          console.error(`[Migration] ${message}`)
        }
      }
    }

    // Step 5: Update project tagIds based on group associations
    const db = getDatabase()
    const projectsToUpdate = new Set<string>()

    // Build project → tagIds mapping
    const projectTagsMap = new Map<string, string[]>()

    for (const [groupId, projectIds] of Object.entries(groupProjectMappings)) {
      const tagId = groupIdToTagId.get(groupId)
      if (!tagId) {
        console.warn(`[Migration] No tag found for group ${groupId}, skipping projects`)
        continue
      }

      for (const projectId of projectIds) {
        if (!projectTagsMap.has(projectId)) {
          projectTagsMap.set(projectId, [])
        }
        projectTagsMap.get(projectId)!.push(tagId)
        projectsToUpdate.add(projectId)
      }
    }

    // Update each project's tagIds
    const updateStmt = db.prepare('UPDATE projects SET tag_ids = ? WHERE id = ?')
    const getProjectStmt = db.prepare('SELECT tag_ids FROM projects WHERE id = ?')

    for (const [projectId, tagIds] of projectTagsMap) {
      try {
        // Check if project already has these tags
        const row = getProjectStmt.get(projectId) as { tag_ids: string } | undefined
        if (row) {
          const existingTagIds = JSON.parse(row.tag_ids) as string[]

          // Merge new tags with existing ones (avoid duplicates)
          const mergedTagIds = [...new Set([...existingTagIds, ...tagIds])]

          // Only update if there are changes
          if (JSON.stringify(mergedTagIds) !== JSON.stringify(existingTagIds)) {
            updateStmt.run(JSON.stringify(mergedTagIds), projectId)
            projectsUpdated++
            logger.debug(
              `[Migration] Updated project ${projectId} with ${mergedTagIds.length} tags (${tagIds.length} new)`
            )
          } else {
            logger.debug(`[Migration] Project ${projectId} already has these tags, skipping`)
          }
        } else {
          console.warn(`[Migration] Project ${projectId} not found, skipping`)
        }
      } catch (error) {
        const message = `Failed to update project ${projectId}: ${error instanceof Error ? error.message : 'Unknown error'}`
        errors.push(message)
        console.error(`[Migration] ${message}`)
      }
    }

    logger.debug('[Migration] Groups to tags migration complete')
    logger.debug(`[Migration] - Groups converted: ${groupsConverted}`)
    logger.debug(`[Migration] - Projects updated: ${projectsUpdated}`)

    if (errors.length > 0) {
      console.warn(`[Migration] - Errors encountered: ${errors.length}`)
    }

    return {
      success: errors.length === 0,
      groupsConverted,
      projectsUpdated,
      errors
    }
  } catch (error) {
    const message = `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    errors.push(message)
    console.error(`[Migration] ${message}`)

    return {
      success: false,
      groupsConverted,
      projectsUpdated,
      errors
    }
  }
}

/**
 * Removes groups.json after successful migration
 * Only call this after confirming the migration was successful
 */
export async function cleanupGroupsJson(): Promise<void> {
  const groupsPath = path.join(getSyncDir(), 'groups.json')

  try {
    await fs.unlink(groupsPath)
    logger.debug('[Migration] Removed groups.json')
  } catch (error) {
    console.error('[Migration] Failed to remove groups.json:', error)
  }
}
