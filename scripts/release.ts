#!/usr/bin/env npx tsx
/**
 * Release automation script for Nightshift
 *
 * Usage:
 *   npx tsx scripts/release.ts <version-type> [--dry-run] [--ci]
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
 *   --ci       Run in CI mode (outputs to GITHUB_OUTPUT, uses [skip ci] in commits)
 *
 * Examples:
 *   npx tsx scripts/release.ts patch
 *   npx tsx scripts/release.ts minor --dry-run
 *   npx tsx scripts/release.ts 2.0.0-beta.1
 */

import { readFileSync, writeFileSync, appendFileSync } from 'fs'
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

function getBaseVersion(version: string): string {
  // Extract base version without prerelease suffix (1.0.0-beta.1 -> 1.0.0)
  return version.replace(/-[a-z]+\.\d+$/, '')
}

function consolidateBetaChangelogs(changelog: string, baseVersion: string): {
  consolidated: string
  content: string
} {
  // Find all beta entries for this base version and consolidate them
  const betaPattern = new RegExp(
    `## \\[${baseVersion.replace(/\./g, '\\.')}-beta\\.(\\d+)\\][^]*?(?=## \\[|$)`,
    'g'
  )

  const betaEntries: { num: number; content: string }[] = []
  let match

  while ((match = betaPattern.exec(changelog)) !== null) {
    const betaNum = parseInt(match[1], 10)
    // Extract content between the header and the next section
    const fullMatch = match[0]
    const headerEnd = fullMatch.indexOf('\n')
    const content = fullMatch.slice(headerEnd + 1).trim()
    if (content) {
      betaEntries.push({ num: betaNum, content })
    }
  }

  // Sort by beta number (ascending) so changes appear in chronological order
  betaEntries.sort((a, b) => a.num - b.num)

  // Combine all beta content
  const consolidatedContent = betaEntries.map((e) => e.content).join('\n\n')

  // Remove all beta entries from changelog
  let consolidated = changelog.replace(betaPattern, '')

  // Clean up any duplicate newlines
  consolidated = consolidated.replace(/\n{3,}/g, '\n\n')

  // Remove beta version links from the bottom
  const betaLinkPattern = new RegExp(
    `\\[${baseVersion.replace(/\./g, '\\.')}-beta\\.\\d+\\]:.*\\n?`,
    'g'
  )
  consolidated = consolidated.replace(betaLinkPattern, '')

  return { consolidated, content: consolidatedContent }
}

function updateChangelog(
  currentVersion: string,
  newVersion: string,
  isReleaseFromBeta: boolean
): void {
  let changelog = readChangelog()

  const today = new Date().toISOString().split('T')[0]
  const unreleasedHeader = '## [Unreleased]'
  const newVersionHeader = `## [${newVersion}] - ${today}`

  let consolidatedBetaContent = ''

  // If releasing from beta, consolidate all beta changelogs first
  if (isReleaseFromBeta) {
    const baseVersion = getBaseVersion(currentVersion)
    const result = consolidateBetaChangelogs(changelog, baseVersion)
    changelog = result.consolidated
    consolidatedBetaContent = result.content
    console.log(`  Consolidated ${baseVersion}-beta.* changelog entries`)
  }

  // Replace Unreleased with new version and add new Unreleased section
  if (changelog.includes(unreleasedHeader)) {
    const newSection = consolidatedBetaContent
      ? `${unreleasedHeader}\n\n${newVersionHeader}\n\n${consolidatedBetaContent}`
      : `${unreleasedHeader}\n\n${newVersionHeader}`

    changelog = changelog.replace(unreleasedHeader, newSection)
  }

  // Update the comparison links at the bottom
  const repoUrl = 'https://github.com/owlkaboom/nightshift'
  const unreleasedLink = `[Unreleased]: ${repoUrl}/compare/v${newVersion}...HEAD`

  // For release from beta, link back to the last non-beta version or the first beta
  let previousVersion = currentVersion
  if (isReleaseFromBeta) {
    // Find the version before the beta cycle started
    const baseVersion = getBaseVersion(currentVersion)
    const versionMatch = changelog.match(
      new RegExp(`\\[${baseVersion.replace(/\./g, '\\.')}-beta\\.1\\]:.*?/v([^.]+\\.[^.]+\\.[^.]+)\\.\\.\\.`)
    )
    if (versionMatch) {
      previousVersion = versionMatch[1]
    } else {
      // Fallback: just use the first beta
      previousVersion = `${baseVersion}-beta.1`
    }
  }

  const newVersionLink = `[${newVersion}]: ${repoUrl}/compare/v${previousVersion}...v${newVersion}`

  // Find and update the links section
  const linksRegex = /\[Unreleased\]:.*$/m
  if (linksRegex.test(changelog)) {
    changelog = changelog.replace(linksRegex, `${unreleasedLink}\n${newVersionLink}`)
  }

  writeChangelog(changelog)
}

function gitCommitAndTag(version: string, dryRun: boolean, ciMode: boolean): void {
  // In CI mode, add [skip ci] to prevent the commit from triggering another CI run
  const commitMessage = ciMode
    ? `chore(release): v${version} [skip ci]`
    : `chore(release): v${version}`

  const commands = [
    'git add package.json package-lock.json CHANGELOG.md',
    `git commit -m "${commitMessage}"`,
    `git tag -a v${version} -m "Release v${version}"`
  ]

  for (const cmd of commands) {
    console.log(`  $ ${cmd}`)
    if (!dryRun) {
      execSync(cmd, { cwd: ROOT, stdio: 'inherit' })
    }
  }
}

function writeGitHubOutput(version: string, isPrerelease: boolean): void {
  const outputFile = process.env.GITHUB_OUTPUT
  if (outputFile) {
    appendFileSync(outputFile, `version=${version}\n`)
    appendFileSync(outputFile, `is_prerelease=${isPrerelease}\n`)
    console.log(`  Wrote to GITHUB_OUTPUT: version=${version}, is_prerelease=${isPrerelease}`)
  }
}

function main(): void {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const ciMode = args.includes('--ci')
  const versionType = args.find((arg) => !arg.startsWith('--'))

  if (!versionType) {
    console.error('Usage: npx tsx scripts/release.ts <version-type> [--dry-run] [--ci]')
    console.error('')
    console.error('Version types: patch, minor, major, beta, release, or exact version')
    process.exit(1)
  }

  const pkg = readPackageJson()
  const currentVersion = pkg.version
  const newVersion = bumpVersion(currentVersion, versionType)

  // Determine if this is a release from beta (consolidation needed)
  const currentSemVer = parseSemVer(currentVersion)
  const isReleaseFromBeta = versionType === 'release' && currentSemVer.prerelease === 'beta'

  // Determine if the new version is a prerelease
  const newSemVer = parseSemVer(newVersion)
  const isPrerelease = newSemVer.prerelease !== null

  console.log('')
  console.log(`  Nightshift Release`)
  console.log(`  ==================`)
  console.log('')
  console.log(`  Current version: ${currentVersion}`)
  console.log(`  New version:     ${newVersion}`)
  if (isReleaseFromBeta) {
    console.log(`  Mode:            Releasing from beta (will consolidate changelogs)`)
  }
  if (ciMode) {
    console.log(`  CI Mode:         Enabled`)
  }
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

  // Update package-lock.json by running npm install with no changes
  console.log('  Updating package-lock.json...')
  if (!dryRun) {
    execSync('npm install --package-lock-only', { cwd: ROOT, stdio: 'pipe' })
  }

  // Update changelog
  console.log('  Updating CHANGELOG.md...')
  if (!dryRun) {
    updateChangelog(currentVersion, newVersion, isReleaseFromBeta)
  }

  // Git commit and tag
  console.log('')
  console.log('  Git operations:')
  gitCommitAndTag(newVersion, dryRun, ciMode)

  // Write GitHub Actions output if in CI mode
  if (ciMode) {
    console.log('')
    console.log('  GitHub Actions:')
    writeGitHubOutput(newVersion, isPrerelease)
  }

  console.log('')
  console.log(`  Release v${newVersion} ${dryRun ? 'would be' : 'is'} ready!`)
  console.log('')

  if (!ciMode) {
    console.log('  Next steps:')
    console.log('    1. Review the changes')
    console.log('    2. Push to remote: git push && git push --tags')
    console.log('    3. The GitHub Actions workflow will build and publish the release')
    console.log('')
  }
}

main()
