# Feature Spotlight Refactor Plan

## Problem Statement

The current spotlight system uses app version to determine which features to show users. This has several issues:

1. **New user overwhelm** - Installing v1.5.0 could trigger spotlights for every feature since v0.1.0
2. **Fragile coupling** - Features aren't inherently tied to versions; they're tied to whether the user has seen them
3. **Maintenance burden** - Developers must track which version introduced each feature

## Current Implementation

```
features.ts defines:
  - id, version, targetSelector, route, title, description

Logic:
  - Compare feature.version against lastSeenVersion
  - Show if version >= lastSeenVersion AND !seenFeatures.includes(id)
```

## Proposed Implementation

### 1. Simplify Feature Definitions

Remove `version` field from feature definitions:

```typescript
// Before
interface FeatureHighlight {
  id: string
  version: string  // e.g., '0.2.0'
  targetSelector: string
  route: string
  title: string
  description: string
  badgeText?: string
}

// After
interface FeatureHighlight {
  id: string
  targetSelector: string
  route: string
  title: string
  description: string
  badgeText?: string
  priority?: number  // Optional: control display order (lower = first)
}
```

### 2. Simplify Detection Logic

```typescript
// Before
export const getUnseenFeaturesForRoute = (
  route: string,
  lastSeenVersion: string,
  seenFeatureIds: string[]
): FeatureHighlight[] => {
  const routeFeatures = getFeaturesForRoute(route)
  const newFeatures = routeFeatures.filter((feature) => {
    return compareVersions(feature.version, lastSeenVersion) >= 0
  })
  return newFeatures.filter((feature) => !seenFeatureIds.includes(feature.id))
}

// After
export const getUnseenFeaturesForRoute = (
  route: string,
  seenFeatureIds: string[],
  spotlightsEnabled: boolean
): FeatureHighlight[] => {
  if (!spotlightsEnabled) return []

  const routeFeatures = getFeaturesForRoute(route)
  return routeFeatures
    .filter((feature) => !seenFeatureIds.includes(feature.id))
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
}
```

### 3. Update Walkthrough State

```typescript
// Before
interface WalkthroughState {
  walkthroughCompleted: boolean
  walkthroughSkipped: boolean
  seenFeatures: string[]
  lastSeenVersion: string  // Remove this
}

// After
interface WalkthroughState {
  walkthroughCompleted: boolean
  walkthroughSkipped: boolean
  seenFeatures: string[]
  spotlightsEnabled: boolean  // New: user toggle
}
```

### 4. Add Settings Toggle

Add a toggle in the Settings view under the existing walkthrough section:

```
[x] Show feature spotlights
    Highlight new features as you discover them

[Restart Tour] button (existing)
```

### 5. Handle New Users

Keep current behavior:
- New users see the walkthrough prompt first
- After completing/skipping walkthrough, spotlights are enabled
- Spotlights only show for features not covered in the walkthrough

Optional enhancement (can defer):
- Limit to 1-2 spotlights per session to avoid fatigue
- Add "Don't show these again" link on spotlight tooltip

## Files to Modify

| File | Changes |
|------|---------|
| `src/shared/types/walkthrough.ts` | Remove `lastSeenVersion`, add `spotlightsEnabled` to state type |
| `src/renderer/src/stores/walkthrough-store.ts` | Update state shape, add `setSpotlightsEnabled` action, remove version logic |
| `src/renderer/src/components/walkthrough/features.ts` | Remove `version` from definitions, remove `compareVersions`, simplify `getUnseenFeaturesForRoute` |
| `src/renderer/src/components/walkthrough/AutoFeatureSpotlight.tsx` | Update to use new detection logic |
| `src/renderer/src/components/walkthrough/WalkthroughProvider.tsx` | Remove version prop handling |
| `src/renderer/src/routes/__root.tsx` | Remove `appVersion` prop passing if no longer needed |
| `src/renderer/src/views/SettingsView.tsx` | Add spotlights toggle |
| `src/renderer/src/components/walkthrough/SpotlightDebugPanel.tsx` | Update debug panel to reflect new state |

## Migration

For existing users:
- `seenFeatures` array is preserved (no change)
- `lastSeenVersion` field ignored/removed
- `spotlightsEnabled` defaults to `true`

No data migration needed - just updated logic.

## Out of Scope (Future Considerations)

- Per-session spotlight limiting
- Spotlight categories (e.g., "power user" vs "basic" features)
- Analytics on spotlight engagement
- A/B testing spotlight content

## Implementation Order

1. Update types (`walkthrough.ts`)
2. Update store (`walkthrough-store.ts`)
3. Simplify features (`features.ts`)
4. Update AutoFeatureSpotlight component
5. Update WalkthroughProvider (remove version handling)
6. Add settings toggle
7. Update debug panel
8. Clean up unused version code in root
