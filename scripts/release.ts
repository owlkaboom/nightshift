#!/usr/bin/env npx tsx
/**
 * Release automation script for Nightshift
 *
 * Usage:
 *   npx tsx scripts/release.ts <version-type> [--dry-run]
 *
 * Version types:
 *   patch    - Bug fixes (1.0.0 -> 1.0.1)
 *   minor    - New features (1.0.0 -> 1.1.0)
 *   major    - Breaking changes (1.0.0 -> 2.0.0)
 *   beta     - Beta increment (1.0.0-beta.1 -> 1.0.0-beta.2)
 *   release  - Remove beta suffix (1.0.0-beta.2 -> 1.0.0)
 *   <semver> - Exact version (e.g., 1.2.3 or 1.2.3-beta.1)
 *
 * Options:
 *   --dry-run  Show what would happen without making changes
 *
 * Examples:
 *   npx tsx scripts/release.ts patch
 *   npx tsx scripts/release.ts minor --dry-run
 *   npx tsx scripts/release.ts 2.0.0-beta.1
 */

import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { join } from 'path'

const ROOT = join(__dirname, '..')
const PACKAGE_JSON = join(ROOT, 'package.json')
const CHANGELOG = join(ROOT, 'CHANGELOG.md')

interface PackageJson {
  version: string
  [key: string]: unknown
}

function readPackageJson(): PackageJson {
  return JSON.parse(readFileSync(PACKAGE_JSON, 'utf-8'))
}

function writePackageJson(pkg: PackageJson): void {
  writeFileSync(PACKAGE_JSON, JSON.stringify(pkg, null, 2) + '\n')
}

function readChangelog(): string {
  return readFileSync(CHANGELOG, 'utf-8')
}

function writeChangelog(content: string): void {
  writeFileSync(CHANGELOG, content)
}

interface SemVer {
  major: number
  minor: number
  patch: number
  prerelease: string | null
  prereleaseNum: number | null
}

function parseSemVer(version: string): SemVer {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([a-z]+)\.(\d+))?$/)
  if (!match) {
    throw new Error(`Invalid semver: ${version}`)
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || null,
    prereleaseNum: match[5] ? parseInt(match[5], 10) : null
  }
}

function formatSemVer(v: SemVer): string {
  const base = `${v.major}.${v.minor}.${v.patch}`
  if (v.prerelease && v.prereleaseNum !== null) {
    return `${base}-${v.prerelease}.${v.prereleaseNum}`
  }
  return base
}

function bumpVersion(current: string, type: string): string {
  // Check if type is an exact version
  if (/^\d+\.\d+\.\d+(-[a-z]+\.\d+)?$/.test(type)) {
    return type
  }

  const v = parseSemVer(current)

  switch (type) {
    case 'patch':
      return formatSemVer({ ...v, patch: v.patch + 1, prerelease: null, prereleaseNum: null })

    case 'minor':
      return formatSemVer({
        ...v,
        minor: v.minor + 1,
        patch: 0,
        prerelease: null,
        prereleaseNum: null
      })

    case 'major':
      return formatSemVer({
        ...v,
        major: v.major + 1,
        minor: 0,
        patch: 0,
        prerelease: null,
        prereleaseNum: null
      })

    case 'beta':
      if (v.prerelease === 'beta' && v.prereleaseNum !== null) {
        return formatSemVer({ ...v, prereleaseNum: v.prereleaseNum + 1 })
      }
      // Start a new beta cycle for the next patch
      return formatSemVer({
        ...v,
        patch: v.patch + 1,
        prerelease: 'beta',
        prereleaseNum: 1
      })

    case 'release':
      if (!v.prerelease) {
        throw new Error('Current version is not a prerelease')
      }
      return formatSemVer({ ...v, prerelease: null, prereleaseNum: null })

    default:
      throw new Error(`Unknown version type: ${type}`)
  }
}

function updateChangelog(currentVersion: string, newVersion: string): void {
  let changelog = readChangelog()

  const today = new Date().toISOString().split('T')[0]
  const unreleasedHeader = '## [Unreleased]'
  const newVersionHeader = `## [${newVersion}] - ${today}`

  // Replace Unreleased with new version and add new Unreleased section
  if (changelog.includes(unreleasedHeader)) {
    changelog = changelog.replace(
      unreleasedHeader,
      `${unreleasedHeader}\n\n${newVersionHeader}`
    )
  }

  // Update the comparison links at the bottom
  const repoUrl = 'https://github.com/owlkaboom/nightshift'
  const unreleasedLink = `[Unreleased]: ${repoUrl}/compare/v${newVersion}...HEAD`
  const newVersionLink = `[${newVersion}]: ${repoUrl}/compare/v${currentVersion}...v${newVersion}`

  // Find and update the links section
  const linksRegex = /\[Unreleased\]:.*$/m
  if (linksRegex.test(changelog)) {
    changelog = changelog.replace(linksRegex, `${unreleasedLink}\n${newVersionLink}`)
  }

  writeChangelog(changelog)
}

function gitCommitAndTag(version: string, dryRun: boolean): void {
  const commands = [
    'git add package.json CHANGELOG.md',
    `git commit -m "chore(release): v${version}"`,
    `git tag -a v${version} -m "Release v${version}"`
  ]

  for (const cmd of commands) {
    console.log(`  $ ${cmd}`)
    if (!dryRun) {
      execSync(cmd, { cwd: ROOT, stdio: 'inherit' })
    }
  }
}

function main(): void {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const versionType = args.find((arg) => !arg.startsWith('--'))

  if (!versionType) {
    console.error('Usage: npx tsx scripts/release.ts <version-type> [--dry-run]')
    console.error('')
    console.error('Version types: patch, minor, major, beta, release, or exact version')
    process.exit(1)
  }

  const pkg = readPackageJson()
  const currentVersion = pkg.version
  const newVersion = bumpVersion(currentVersion, versionType)

  console.log('')
  console.log(`  Nightshift Release`)
  console.log(`  ==================`)
  console.log('')
  console.log(`  Current version: ${currentVersion}`)
  console.log(`  New version:     ${newVersion}`)
  console.log('')

  if (dryRun) {
    console.log('  [DRY RUN] No changes will be made')
    console.log('')
  }

  // Update package.json
  console.log('  Updating package.json...')
  if (!dryRun) {
    pkg.version = newVersion
    writePackageJson(pkg)
  }

  // Update changelog
  console.log('  Updating CHANGELOG.md...')
  if (!dryRun) {
    updateChangelog(currentVersion, newVersion)
  }

  // Git commit and tag
  console.log('')
  console.log('  Git operations:')
  gitCommitAndTag(newVersion, dryRun)

  console.log('')
  console.log(`  Release v${newVersion} ${dryRun ? 'would be' : 'is'} ready!`)
  console.log('')
  console.log('  Next steps:')
  console.log('    1. Review the changes')
  console.log('    2. Push to remote: git push && git push --tags')
  console.log('    3. Build the release: npm run build:mac (or build:win, build:linux)')
  console.log('')
}

main()
