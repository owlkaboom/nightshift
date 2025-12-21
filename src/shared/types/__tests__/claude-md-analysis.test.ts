/**
 * Tests for CLAUDE.md analysis
 */

import { describe, it, expect } from 'vitest'
import { analyzeClaudeMd, calculateQualityScore } from '../claude-md-analysis'
import type { ClaudeMdSubFile } from '../claude-md-analysis'

describe('analyzeClaudeMd', () => {
  describe('section detection', () => {
    it('detects testing guidelines in CLAUDE.md sections', () => {
      const content = `# Project

## Testing

Run tests with npm test.`

      const result = analyzeClaudeMd(content, '/project/CLAUDE.md', [])

      expect(result.hasTestingGuidelines).toBe(true)
      expect(result.sections).toHaveLength(1)
      expect(result.sections[0].title).toBe('Testing')
    })

    it('detects testing guidelines from QA sections', () => {
      const content = `# Project

## QA Process

Quality assurance guidelines.`

      const result = analyzeClaudeMd(content, '/project/CLAUDE.md', [])

      expect(result.hasTestingGuidelines).toBe(true)
    })

    it('detects testing guidelines from spec sections', () => {
      const content = `# Project

## Specification Testing

BDD and spec patterns.`

      const result = analyzeClaudeMd(content, '/project/CLAUDE.md', [])

      expect(result.hasTestingGuidelines).toBe(true)
    })

    it('detects testing guidelines from quality sections', () => {
      const content = `# Project

## Code Quality Standards

Quality metrics and standards.`

      const result = analyzeClaudeMd(content, '/project/CLAUDE.md', [])

      expect(result.hasTestingGuidelines).toBe(true)
    })

    it('detects testing guidelines from coverage sections', () => {
      const content = `# Project

## Test Coverage Requirements

Minimum 80% coverage required.`

      const result = analyzeClaudeMd(content, '/project/CLAUDE.md', [])

      expect(result.hasTestingGuidelines).toBe(true)
    })

    it('detects architecture info in CLAUDE.md sections', () => {
      const content = `# Project

## Architecture Overview

This is a monorepo.`

      const result = analyzeClaudeMd(content, '/project/CLAUDE.md', [])

      expect(result.hasArchitectureInfo).toBe(true)
    })
  })

  describe('sub-file detection', () => {
    it('detects testing guidelines from sub-files', () => {
      const content = `# Project

## Quick Start

npm install`

      const subFiles: ClaudeMdSubFile[] = [
        {
          path: '/project/.claude/docs/testing.md',
          name: 'testing.md',
          description: 'Testing guidelines',
          lineCount: 50,
          sizeBytes: 1024,
          lastModified: new Date().toISOString()
        }
      ]

      const result = analyzeClaudeMd(content, '/project/CLAUDE.md', subFiles)

      expect(result.hasTestingGuidelines).toBe(true)
      expect(result.subFiles).toHaveLength(1)
    })

    it('detects testing guidelines from qa sub-files', () => {
      const content = `# Project`

      const subFiles: ClaudeMdSubFile[] = [
        {
          path: '/project/.claude/docs/qa-checklist.md',
          name: 'qa-checklist.md',
          description: 'QA checklist',
          lineCount: 30,
          sizeBytes: 512,
          lastModified: new Date().toISOString()
        }
      ]

      const result = analyzeClaudeMd(content, '/project/CLAUDE.md', subFiles)

      expect(result.hasTestingGuidelines).toBe(true)
    })

    it('detects testing guidelines from spec sub-files', () => {
      const content = `# Project`

      const subFiles: ClaudeMdSubFile[] = [
        {
          path: '/project/.claude/docs/spec-patterns.md',
          name: 'spec-patterns.md',
          description: 'BDD spec patterns',
          lineCount: 40,
          sizeBytes: 768,
          lastModified: new Date().toISOString()
        }
      ]

      const result = analyzeClaudeMd(content, '/project/CLAUDE.md', subFiles)

      expect(result.hasTestingGuidelines).toBe(true)
    })

    it('detects testing guidelines from quality sub-files', () => {
      const content = `# Project`

      const subFiles: ClaudeMdSubFile[] = [
        {
          path: '/project/.claude/docs/code-quality.md',
          name: 'code-quality.md',
          description: 'Code quality standards',
          lineCount: 60,
          sizeBytes: 1200,
          lastModified: new Date().toISOString()
        }
      ]

      const result = analyzeClaudeMd(content, '/project/CLAUDE.md', subFiles)

      expect(result.hasTestingGuidelines).toBe(true)
    })

    it('detects testing guidelines from coverage sub-files', () => {
      const content = `# Project`

      const subFiles: ClaudeMdSubFile[] = [
        {
          path: '/project/.claude/docs/coverage-requirements.md',
          name: 'coverage-requirements.md',
          description: 'Test coverage requirements',
          lineCount: 25,
          sizeBytes: 400,
          lastModified: new Date().toISOString()
        }
      ]

      const result = analyzeClaudeMd(content, '/project/CLAUDE.md', subFiles)

      expect(result.hasTestingGuidelines).toBe(true)
    })

    it('detects architecture info from sub-files', () => {
      const content = `# Project

## Quick Start

npm install`

      const subFiles: ClaudeMdSubFile[] = [
        {
          path: '/project/.claude/docs/architecture.md',
          name: 'architecture.md',
          description: 'System architecture',
          lineCount: 100,
          sizeBytes: 2048,
          lastModified: new Date().toISOString()
        }
      ]

      const result = analyzeClaudeMd(content, '/project/CLAUDE.md', subFiles)

      expect(result.hasArchitectureInfo).toBe(true)
    })

    it('detects architecture from abbreviated file names', () => {
      const content = `# Project`

      const subFiles: ClaudeMdSubFile[] = [
        {
          path: '/project/.claude/docs/arch.md',
          name: 'arch.md',
          description: 'Architecture',
          lineCount: 100,
          sizeBytes: 2048,
          lastModified: new Date().toISOString()
        }
      ]

      const result = analyzeClaudeMd(content, '/project/CLAUDE.md', subFiles)

      expect(result.hasArchitectureInfo).toBe(true)
    })

    it('handles both section and sub-file testing guidelines', () => {
      const content = `# Project

## Test Commands

Run tests`

      const subFiles: ClaudeMdSubFile[] = [
        {
          path: '/project/.claude/docs/testing.md',
          name: 'testing.md',
          description: 'Detailed testing guide',
          lineCount: 50,
          sizeBytes: 1024,
          lastModified: new Date().toISOString()
        }
      ]

      const result = analyzeClaudeMd(content, '/project/CLAUDE.md', subFiles)

      expect(result.hasTestingGuidelines).toBe(true)
      // Should count both section and sub-file
      expect(result.sectionCount).toBe(1)
      expect(result.subFiles).toHaveLength(1)
    })
  })

  describe('quality score impact', () => {
    it('awards points for testing guidelines from sub-files', () => {
      const withoutTesting = analyzeClaudeMd(
        '# Project\n\n## Quick Start\n\nnpm install',
        '/project/CLAUDE.md',
        []
      )

      const withTestingSubFile = analyzeClaudeMd(
        '# Project\n\n## Quick Start\n\nnpm install',
        '/project/CLAUDE.md',
        [
          {
            path: '/project/.claude/docs/testing.md',
            name: 'testing.md',
            description: 'Testing guide',
            lineCount: 50,
            sizeBytes: 1024,
            lastModified: new Date().toISOString()
          }
        ]
      )

      // Should get +10 points for testing guidelines
      expect(withTestingSubFile.qualityScore).toBeGreaterThan(withoutTesting.qualityScore)
      expect(withTestingSubFile.qualityScore - withoutTesting.qualityScore).toBeGreaterThanOrEqual(10)
    })
  })
})

describe('calculateQualityScore', () => {
  it('awards 10 points for testing guidelines', () => {
    const baseScore = calculateQualityScore({
      exists: true,
      lineCount: 50,
      sectionCount: 3,
      hasQuickStart: true,
      hasCodeConventions: false,
      hasTechStack: false,
      hasTestingGuidelines: false,
      hasArchitectureInfo: false,
      hasSubFiles: false
    })

    const withTesting = calculateQualityScore({
      exists: true,
      lineCount: 50,
      sectionCount: 3,
      hasQuickStart: true,
      hasCodeConventions: false,
      hasTechStack: false,
      hasTestingGuidelines: true,
      hasArchitectureInfo: false,
      hasSubFiles: false
    })

    expect(withTesting - baseScore).toBe(10)
  })

  it('awards 15 points for architecture info', () => {
    const baseScore = calculateQualityScore({
      exists: true,
      lineCount: 50,
      sectionCount: 3,
      hasQuickStart: true,
      hasCodeConventions: false,
      hasTechStack: false,
      hasTestingGuidelines: false,
      hasArchitectureInfo: false,
      hasSubFiles: false
    })

    const withArchitecture = calculateQualityScore({
      exists: true,
      lineCount: 50,
      sectionCount: 3,
      hasQuickStart: true,
      hasCodeConventions: false,
      hasTechStack: false,
      hasTestingGuidelines: false,
      hasArchitectureInfo: true,
      hasSubFiles: false
    })

    expect(withArchitecture - baseScore).toBe(15)
  })

  it('caps score at 100', () => {
    const score = calculateQualityScore({
      exists: true,
      lineCount: 200,
      sectionCount: 10,
      hasQuickStart: true,
      hasCodeConventions: true,
      hasTechStack: true,
      hasTestingGuidelines: true,
      hasArchitectureInfo: true,
      hasSubFiles: true
    })

    expect(score).toBeLessThanOrEqual(100)
  })
})
