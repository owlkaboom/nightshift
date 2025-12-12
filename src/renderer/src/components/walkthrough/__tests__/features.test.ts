import { describe, expect, it } from 'vitest'
import {
  featureHighlights,
  getFeatureById,
  getFeaturesForRoute,
  getUnseenFeaturesForRoute
} from '../features'

describe('Feature Highlights', () => {
  describe('featureHighlights registry', () => {

    it('has all required properties for each feature', () => {
      featureHighlights.forEach((feature) => {
        expect(feature).toHaveProperty('id')
        expect(feature).toHaveProperty('targetSelector')
        expect(feature).toHaveProperty('title')
        expect(feature).toHaveProperty('description')
        expect(typeof feature.id).toBe('string')
        expect(typeof feature.targetSelector).toBe('string')
        expect(typeof feature.title).toBe('string')
        expect(typeof feature.description).toBe('string')
      })
    })

    it('has unique feature IDs', () => {
      const ids = featureHighlights.map((f) => f.id)
      const uniqueIds = new Set(ids)
      expect(ids.length).toBe(uniqueIds.size)
    })

    it('can have optional priority for ordering', () => {
      const featuresWithPriority = featureHighlights.filter((f) => f.priority !== undefined)
      expect(featuresWithPriority.length).toBeGreaterThan(0)
      featuresWithPriority.forEach((feature) => {
        expect(typeof feature.priority).toBe('number')
      })
    })
  })

  describe('getFeaturesForRoute', () => {
    it('returns features for /settings route', () => {
      const features = getFeaturesForRoute('/settings')
      const featureIds = features.map((f) => f.id)
      expect(featureIds).toContain('integrations-panel')
    })

    it('returns features for /board route', () => {
      const features = getFeaturesForRoute('/board')
      const featureIds = features.map((f) => f.id)
      expect(featureIds).toContain('voice-task-input')
      expect(featureIds).toContain('task-virtualization')
      expect(featureIds).toContain('rich-text-editor')
    })

    it('returns empty array for route without features', () => {
      const features = getFeaturesForRoute('/nonexistent')
      expect(features).toEqual([])
    })
  })

  describe('getFeatureById', () => {

    it('returns undefined for non-existent feature ID', () => {
      const feature = getFeatureById('non-existent-feature')
      expect(feature).toBeUndefined()
    })

    it('returns features by their exact IDs', () => {
      const testIds = ['voice-task-input', 'planning-sessions', 'skills-system']
      testIds.forEach((id) => {
        const feature = getFeatureById(id)
        expect(feature).toBeDefined()
        expect(feature?.id).toBe(id)
      })
    })
  })

  describe('getUnseenFeaturesForRoute', () => {

    it('filters out already seen features', () => {
      const unseenFeatures = getUnseenFeaturesForRoute(
        '/settings',
        ['integrations-panel'],
        true
      )
      const featureIds = unseenFeatures.map((f) => f.id)
      expect(featureIds).not.toContain('integrations-panel')
    })

    it('returns empty array when all features are seen', () => {
      const unseenFeatures = getUnseenFeaturesForRoute(
        '/settings',
        ['integrations-panel'],
        true
      )
      expect(unseenFeatures).toEqual([])
    })

    it('returns empty array when spotlights are disabled', () => {
      const unseenFeatures = getUnseenFeaturesForRoute(
        '/settings',
        [],
        false
      )
      expect(unseenFeatures).toEqual([])
    })

    it('handles route with no features gracefully', () => {
      const unseenFeatures = getUnseenFeaturesForRoute('/nonexistent', [], true)
      expect(unseenFeatures).toEqual([])
    })

    it('sorts features by priority', () => {
      const unseenFeatures = getUnseenFeaturesForRoute('/board', [], true)
      // Should be sorted by priority (lower = first)
      if (unseenFeatures.length > 1) {
        for (let i = 0; i < unseenFeatures.length - 1; i++) {
          const currentPriority = unseenFeatures[i].priority ?? 100
          const nextPriority = unseenFeatures[i + 1].priority ?? 100
          expect(currentPriority).toBeLessThanOrEqual(nextPriority)
        }
      }
    })

    it('returns all board features when none are seen', () => {
      const unseenFeatures = getUnseenFeaturesForRoute('/board', [], true)
      const featureIds = unseenFeatures.map((f) => f.id)
      expect(featureIds).toContain('voice-task-input')
      expect(featureIds).toContain('task-virtualization')
      expect(featureIds).toContain('rich-text-editor')
    })
  })
})
