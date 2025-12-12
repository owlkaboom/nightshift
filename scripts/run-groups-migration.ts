#!/usr/bin/env tsx
/**
 * Script to run the groups-to-tags migration manually
 * Run with: npx tsx scripts/run-groups-migration.ts
 */

import { migrateGroupsToTags, cleanupGroupsJson } from '../src/main/storage/migrations/migrate-groups-to-tags'
import { getTagStore } from '../src/main/storage/tag-store'
import { initializeDatabase } from '../src/main/storage/database'

async function main() {
  console.log('=== Groups to Tags Migration ===\n')

  try {
    // Initialize database
    console.log('Initializing database...')
    initializeDatabase()

    // Initialize tag store
    const tagStore = getTagStore()
    await tagStore.initialize()

    // Run migration
    const result = await migrateGroupsToTags()

    console.log('\n=== Migration Results ===')
    console.log(`Success: ${result.success}`)
    console.log(`Groups converted: ${result.groupsConverted}`)
    console.log(`Projects updated: ${result.projectsUpdated}`)

    if (result.errors.length > 0) {
      console.log(`\nErrors (${result.errors.length}):`)
      result.errors.forEach((err) => console.log(`  - ${err}`))
    }

    if (result.success) {
      console.log('\n✓ Migration completed successfully!')
      console.log('\nYou can now:')
      console.log('  1. Remove the groups.json file (or it will be cleaned up on next app start)')
      console.log('  2. Remove group-related code from the backend')
      console.log('  3. Update the task system to use tagIds instead of groupId')
    } else {
      console.log('\n✗ Migration completed with errors')
      console.log('Please review the errors above and fix them before proceeding')
    }

    // List the created tags
    console.log('\n=== Created Tags ===')
    const tags = await tagStore.list()
    tags.forEach((tag) => {
      console.log(`  - ${tag.name} (${tag.id}) ${tag.color || ''}`)
    })
  } catch (error) {
    console.error('\n✗ Migration failed:', error)
    process.exit(1)
  }
}

main()
