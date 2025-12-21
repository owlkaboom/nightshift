/**
 * Tests for ScoreBreakdown component
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreBreakdown } from '../ScoreBreakdown'
import type { ClaudeMdAnalysis } from '@shared/types'

// Helper to create mock analysis
function createMockAnalysis(overrides: Partial<ClaudeMdAnalysis> = {}): ClaudeMdAnalysis {
  return {
    exists: true,
    path: '/project/CLAUDE.md',
    content: '# Project',
    lineCount: 50,
    sectionCount: 3,
    hasQuickStart: false,
    hasCodeConventions: false,
    hasTechStack: false,
    hasTestingGuidelines: false,
    hasArchitectureInfo: false,
    sections: [],
    subFiles: [],
    qualityScore: 50,
    recommendations: [],
    analyzedAt: new Date().toISOString(),
    ...overrides
  }
}

describe('ScoreBreakdown', () => {
  it('renders quality score breakdown title', () => {
    const analysis = createMockAnalysis()
    render(<ScoreBreakdown analysis={analysis} />)

    expect(screen.getByText('Quality Score Breakdown')).toBeInTheDocument()
  })

  it('displays the overall score', () => {
    const analysis = createMockAnalysis({ qualityScore: 72 })
    render(<ScoreBreakdown analysis={analysis} />)

    expect(screen.getByText(/72\/100/)).toBeInTheDocument()
  })

  it('shows checked criteria for Quick Start', () => {
    const analysis = createMockAnalysis({
      hasQuickStart: true,
      qualityScore: 50
    })
    render(<ScoreBreakdown analysis={analysis} />)

    expect(screen.getByText('Quick Start guide')).toBeInTheDocument()
  })

  it('shows checked criteria for Code Conventions', () => {
    const analysis = createMockAnalysis({
      hasCodeConventions: true,
      qualityScore: 50
    })
    render(<ScoreBreakdown analysis={analysis} />)

    expect(screen.getByText('Code Conventions')).toBeInTheDocument()
  })

  it('shows checked criteria for Architecture Overview', () => {
    const analysis = createMockAnalysis({
      hasArchitectureInfo: true,
      qualityScore: 50
    })
    render(<ScoreBreakdown analysis={analysis} />)

    expect(screen.getByText('Architecture Overview')).toBeInTheDocument()
  })

  it('shows checked criteria for Testing Guidelines', () => {
    const analysis = createMockAnalysis({
      hasTestingGuidelines: true,
      qualityScore: 50
    })
    render(<ScoreBreakdown analysis={analysis} />)

    expect(screen.getByText('Testing Guidelines')).toBeInTheDocument()
  })

  it('shows checked criteria for Tech Stack', () => {
    const analysis = createMockAnalysis({
      hasTechStack: true,
      qualityScore: 50
    })
    render(<ScoreBreakdown analysis={analysis} />)

    expect(screen.getByText('Tech Stack')).toBeInTheDocument()
  })

  it('shows checked criteria for sub-files organization', () => {
    const analysis = createMockAnalysis({
      subFiles: [
        {
          path: '/project/.claude/docs/testing.md',
          name: 'testing.md',
          description: 'Testing guide',
          lineCount: 50,
          sizeBytes: 1024,
          lastModified: new Date().toISOString()
        }
      ],
      qualityScore: 50
    })
    render(<ScoreBreakdown analysis={analysis} />)

    expect(screen.getByText('Sub-files organization')).toBeInTheDocument()
  })

  it('shows content quality criteria', () => {
    const analysis = createMockAnalysis({
      exists: true,
      lineCount: 101, // > 100 to trigger comprehensive content criterion
      qualityScore: 50
    })
    render(<ScoreBreakdown analysis={analysis} />)

    // Only the checked criteria (lineCount > 0) should be shown
    expect(screen.getByText('CLAUDE.md exists')).toBeInTheDocument()
    // Additional criteria only shown when they apply
    expect(screen.getByText(/Substantial content/)).toBeInTheDocument()
    expect(screen.getByText(/Comprehensive content/)).toBeInTheDocument()
  })

  it('shows organization criteria for sections', () => {
    const analysis = createMockAnalysis({
      sectionCount: 5,
      qualityScore: 50
    })
    render(<ScoreBreakdown analysis={analysis} />)

    expect(screen.getByText('Multiple sections (3+)')).toBeInTheDocument()
    // Rich structure only shown when sectionCount >= 5
    expect(screen.getByText(/Rich structure/)).toBeInTheDocument()
  })

  it('displays category headers', () => {
    const analysis = createMockAnalysis()
    render(<ScoreBreakdown analysis={analysis} />)

    expect(screen.getByText('Essential Sections')).toBeInTheDocument()
    expect(screen.getByText('Content Quality')).toBeInTheDocument()
    expect(screen.getByText('Organization')).toBeInTheDocument()
  })

  it('shows point values for criteria', () => {
    const analysis = createMockAnalysis({
      hasQuickStart: true,
      qualityScore: 50
    })
    render(<ScoreBreakdown analysis={analysis} />)

    // Quick Start is worth 15 points - look for the points display
    const pointsElements = screen.getAllByText('15')
    expect(pointsElements.length).toBeGreaterThan(0)
  })

  it('shows criteria count in score summary', () => {
    const analysis = createMockAnalysis({
      hasQuickStart: true,
      hasCodeConventions: true,
      lineCount: 100,
      sectionCount: 5,
      qualityScore: 75
    })
    render(<ScoreBreakdown analysis={analysis} />)

    // Should show "X/Y criteria" where X is number checked
    expect(screen.getByText(/criteria/)).toBeInTheDocument()
  })

  it('renders with custom className', () => {
    const analysis = createMockAnalysis()
    const { container } = render(<ScoreBreakdown analysis={analysis} className="custom-class" />)

    expect(container.firstChild).toHaveClass('custom-class')
  })
})
