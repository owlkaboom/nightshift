# Database Migrations

Nightshift uses SQLite for data persistence and includes an automatic migration system to keep your database schema up to date.

## How Migrations Work

### Automatic Migration on Startup

Every time Nightshift starts, it:

1. **Checks the current schema version** stored in the `schema_version` table
2. **Compares it to the target version** (currently v13)
3. **Runs any necessary migrations** sequentially from the current version to the target
4. **Verifies the schema** after migration to ensure all expected columns exist

The migration system is located in:
- `src/main/storage/migrations/schema.ts` - Main schema and migration logic
- `src/main/storage/index.ts` - Initialization entry point
- `src/main/index.ts` - Called during app startup

### Schema Versioning

Current schema version: **v13**

Recent migration history:
- **v13** (current): Added integration support (`integration_ids` on projects, `external_issue_id`, `external_issue_url`, `integration_id` on tasks)
- **v12**: Added `tag_refs` column to notes table
- **v11**: Added `tag_ids` column to tasks table, migrated group_id data
- **v10**: Added `tag_ids` column to projects table
- **v9**: Converted 'accepted' status to 'completed'
- **v8**: Added `completed_at` index for calendar view
- **v7**: Added `vault_path` to config table

See `src/main/storage/migrations/schema.ts` for full migration history.

## Troubleshooting Migration Issues

### Symptoms of Migration Problems

- Missing column errors in the console logs
- Database queries failing with "no such column" errors
- App crashing on startup after an update

### Diagnosing Issues

#### 1. Check Migration Logs

Start the app and check the console output for migration messages:

```
[Schema] Current schema version: 12, Target version: 13
[Schema] Migration needed from v12 to v13
[Schema] Running migrations from version 12 to 13
[Schema] Running migration v12 -> v13: Adding integration support
[Schema] Adding external_issue_id column to tasks table
[Schema] Migration v12 -> v13 complete
[Schema] Migration complete - updated version to 13
[Schema] Verification passed - all expected columns exist
```

If you see error messages or "Verification failed", there's a migration issue.

#### 2. Run the Database Verification Script

We provide a utility script to verify your database schema:

```bash
npm run verify-db
```

This will:
- Check your current schema version
- List all tables and columns
- Identify any missing columns
- Provide recommendations

Example output:

```
Nightshift Database Schema Verification
==================================================
Database path: /Users/you/.nightshift/nightshift.db
✅ Database file opened successfully

Schema version: 13
Expected version: 13

✅ Schema version is up to date

Verifying table: tasks
==================================================
Found 25 columns:
  - id (TEXT)
  - project_id (TEXT)
  - external_issue_id (TEXT)
  - external_issue_url (TEXT)
  - integration_id (TEXT)
  ...

✅ All required columns present
```

#### 3. Check Database File Location

The database is stored at: `~/.nightshift/nightshift.db`

- **macOS/Linux**: `~/.nightshift/nightshift.db`
- **Windows**: `C:\Users\YourName\.nightshift\nightshift.db`

### Common Issues and Solutions

#### Issue: "Missing column in tasks/projects table"

**Cause**: Migration didn't run or failed silently

**Solution**:
1. Check the app logs for migration errors
2. Run `npm run verify-db` to confirm missing columns
3. Restart the app - migrations run on every startup
4. If that doesn't work, see "Nuclear Option" below

#### Issue: "Database schema is at version X but app expects version Y"

**Cause**: The database wasn't migrated properly

**Solution**:
1. If database version < expected: Restart the app (migrations will run)
2. If database version > expected: You may have a newer dev version. Be cautious.

#### Issue: Migration runs but columns still missing

**Cause**: Migration code has a bug or SQLite error

**Solution**:
1. Check logs for SQLite errors (permission issues, disk full, etc.)
2. Ensure you're running the latest version of Nightshift
3. Report the issue with logs

### Nuclear Option: Fresh Database

If migrations continue to fail, you can start fresh:

⚠️ **WARNING**: This will delete all your tasks, projects, and settings!

1. **Close Nightshift completely**
2. **Backup your database** (just in case):
   ```bash
   cp ~/.nightshift/nightshift.db ~/.nightshift/nightshift.db.backup
   ```
3. **Delete the database file**:
   ```bash
   rm ~/.nightshift/nightshift.db
   ```
4. **Restart Nightshift** - it will create a fresh database with the latest schema

Your git repositories and task logs (in `~/.nightshift/tasks/`) will NOT be deleted.

## Migration System Design

### Key Principles

1. **Idempotent**: Migrations check if changes already exist before applying them
2. **Sequential**: Migrations run in order from current version to target
3. **Transactional**: Each migration checks for errors and logs results
4. **Verifiable**: Schema verification runs after migrations complete

### Adding a New Migration

When you need to add a new schema change:

1. **Increment `SCHEMA_VERSION`** in `src/main/storage/migrations/schema.ts`
2. **Add migration code** in the `runMigrations()` function:

```typescript
// Migration from v13 to v14: Add new_column to tasks
if (fromVersion < 14) {
  console.log('[Schema] Running migration v13 -> v14: Adding new_column')

  try {
    // Check if column already exists
    const taskColumns = db.pragma('table_info(tasks)') as Array<{ name: string }>
    const taskColumnNames = taskColumns.map(c => c.name)

    if (!taskColumnNames.includes('new_column')) {
      console.log('[Schema] Adding new_column to tasks table')
      db.exec(`ALTER TABLE tasks ADD COLUMN new_column TEXT`)
    }

    console.log('[Schema] Migration v13 -> v14 complete')
  } catch (error) {
    console.error('[Schema] Error during migration v13 -> v14:', error)
    throw error
  }
}
```

3. **Update fresh schema** in `createSchema()` to include the new column
4. **Update verification** in `verifySchema()` to check for the new column
5. **Test thoroughly**:
   - Fresh install (v0 → v14)
   - Upgrade from v13 → v14
   - Run `npm run verify-db` to confirm

### Migration Best Practices

1. **Always use `IF NOT EXISTS`** or check column existence before adding
2. **Add comprehensive logging** for each step
3. **Use try-catch** to handle SQLite errors gracefully
4. **Test with real user data** when possible
5. **Document breaking changes** in release notes
6. **Consider backward compatibility** when removing columns

## Debugging Tips

### Enable SQLite Verbose Mode

Edit `src/main/storage/database.ts`:

```typescript
db = new Database(dbPath, {
  verbose: console.log  // Uncomment this line
})
```

This will log every SQL statement executed, which can help identify issues.

### Check SQLite Version

```bash
sqlite3 --version
```

Nightshift requires SQLite 3.35.0+ for `DROP COLUMN` support (though we avoid using it).

### Manual Database Inspection

You can inspect the database manually:

```bash
sqlite3 ~/.nightshift/nightshift.db
```

Useful commands:
```sql
-- List all tables
.tables

-- Show schema for a table
.schema tasks

-- Check schema version
SELECT * FROM schema_version;

-- List all columns in tasks table
PRAGMA table_info(tasks);

-- Count rows
SELECT COUNT(*) FROM tasks;
```

## Getting Help

If you encounter migration issues:

1. **Collect logs**: Run the app and copy the full console output
2. **Run verification**: `npm run verify-db` and save the output
3. **Check database location**: Confirm `~/.nightshift/nightshift.db` exists
4. **Report issue**: Include:
   - Your OS and version
   - Nightshift version
   - Migration logs
   - Verification script output
   - Steps to reproduce

## Related Documentation

- [Storage Layer](.claude/docs/storage-layer.md) - Overview of SQLite storage
- [Architecture](.claude/docs/architecture.md) - Overall system design
- [Task Management](.claude/docs/task-management.md) - Task data schema
