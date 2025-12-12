# Testing the Spotlight Feature System

This guide explains how to test the feature highlighting and spotlight system in Nightshift.

## Overview

The spotlight system consists of two main features:

1. **Walkthrough Tours** - Step-by-step guided tours with spotlights
2. **Feature Highlights** - Automatic spotlights for new features

## Quick Start - Testing Spotlights

### 1. Open the Debug Utility

Open this file in your browser to manipulate the walkthrough state:
```bash
open scripts/debug-walkthrough-state.html
```

### 2. Reset State to See Spotlights

In the debug utility, click:
- **"Mark All Features Unseen"** - To see all feature spotlights
- **"Reset Walkthrough"** - To see the walkthrough tour prompt
- **"Clear All State"** - Nuclear option, resets everything

### 3. Launch the App

```bash
npm run dev
```

## Testing Feature Spotlights

### Current Features (v0.3.0)

| Feature ID | Version | Location | Selector |
|------------|---------|----------|----------|
| `voice-task-input` | 0.2.0 | Board view | `[data-feature="voice-task-input"]` |
| `integrations-panel` | 0.3.0 | Settings | `[data-feature="integrations-panel"]` |
| `planning-sessions` | 0.2.0 | Planning | `[data-feature="planning-sessions"]` |
| `skills-system` | 0.2.0 | Skills | `[data-feature="skills-system"]` |
| `task-virtualization` | 0.3.0 | Board | `[data-feature="virtualized-board"]` |
| `rich-text-editor` | 0.3.0 | Board | `[data-feature="rich-text-editor"]` |

### How to Test a Specific Feature

1. **Mark the feature as unseen** in debug utility
2. **Navigate to the route** where the feature lives
3. **Verify the spotlight appears** automatically
4. **Check the spotlight behavior**:
   - ✓ Semi-transparent overlay appears
   - ✓ Blue border highlights the element
   - ✓ Tooltip shows feature description
   - ✓ Clicking "Got it" dismisses and marks as seen
   - ✓ Feature doesn't show again after dismissal

### Testing the Integrations Spotlight

```bash
# 1. Reset state
open scripts/debug-walkthrough-state.html
# Click "Mark All Features Unseen"

# 2. Start app
npm run dev

# 3. Navigate to Settings
# Click on Settings in sidebar

# Expected: Spotlight should appear on integrations panel
```

### Testing Voice Task Spotlight

```bash
# 1. Mark voice-task-input as unseen
# 2. Navigate to /board
# 3. Look for the "Voice" button
# Expected: Should see spotlight on voice button (if element exists)
```

## Testing Walkthrough Tours

### Full Tour Test

1. **Clear all state** in debug utility
2. **Launch app** - Should see "Take a Tour?" dialog
3. **Click "Start Tour"**
4. **Verify each step**:
   - Step 1: Welcome message
   - Step 2: Task Board explanation
   - Step 3: Add Task button
   - Step 4: Board cards
   - Step 5: Projects
   - Step 6: Planning
   - Step 7: Skills
   - Step 8: Settings
   - Step 9: Completion

### Keyboard Navigation Test

During walkthrough:
- Press `→` (right arrow) - Should go to next step
- Press `←` (left arrow) - Should go to previous step
- Press `Escape` - Should exit walkthrough

## Troubleshooting

### Spotlight Not Appearing?

**Check 1: Is the element on the page?**
```javascript
// Open DevTools console
document.querySelector('[data-feature="integrations-panel"]')
// Should return an element, not null
```

**Check 2: Is the feature marked as unseen?**
```javascript
// Open DevTools console
JSON.parse(localStorage.getItem('nightshift:walkthrough-state'))
// Check seenFeatures array - feature ID should NOT be in the list
```

**Check 3: Check console for errors**
- Open DevTools console
- Look for errors related to WalkthroughProvider or AutoFeatureSpotlight

**Check 4: Verify version logic**
```javascript
// Open DevTools console
const state = JSON.parse(localStorage.getItem('nightshift:walkthrough-state'))
console.log('Last seen version:', state.lastSeenVersion)
console.log('App version:', '0.3.0')
// Features with version > lastSeenVersion should be highlighted
```

### Element Has Wrong Position?

The spotlight uses `getBoundingClientRect()` to position itself. If positioning is wrong:

1. Check if the target element has `position: fixed` or `transform` (can cause issues)
2. Verify the element is visible (not `display: none` or `visibility: hidden`)
3. Check if the element is in a scrollable container

### Feature Badge Not Showing?

The `FeatureBadge` component checks `hasSeenFeature()` and auto-hides if seen.

```javascript
// DevTools console
const state = JSON.parse(localStorage.getItem('nightshift:walkthrough-state'))
console.log('Seen features:', state.seenFeatures)
// If your feature ID is in this list, badge won't show
```

## Adding New Spotlight Features

### 1. Add to features.ts

```typescript
// src/renderer/src/components/walkthrough/features.ts
export const FEATURE_HIGHLIGHTS: FeatureHighlight[] = [
  // ... existing features
  {
    id: 'my-new-feature',
    version: '0.4.0', // Version when added
    title: 'New Feature Name',
    description: 'What this feature does',
    targetSelector: '[data-feature="my-new-feature"]', // CSS selector
    route: '/route-path', // Where feature lives
    tooltipPlacement: 'bottom' // Optional: top, bottom, left, right
  }
]
```

### 2. Add data-feature attribute to element

```tsx
// In your component
<div data-feature="my-new-feature">
  {/* Your feature UI */}
</div>
```

### 3. Test it

```bash
# Mark as unseen in debug utility
# Navigate to the route
# Verify spotlight appears
```

## Dev Console Helpers

Open DevTools console and paste these helpers:

```javascript
// Get current walkthrough state
window.getWalkthroughState = () => {
  return JSON.parse(localStorage.getItem('nightshift:walkthrough-state') || '{}')
}

// Mark a feature as unseen
window.markFeatureUnseen = (featureId) => {
  const state = JSON.parse(localStorage.getItem('nightshift:walkthrough-state') || '{}')
  state.seenFeatures = (state.seenFeatures || []).filter(id => id !== featureId)
  localStorage.setItem('nightshift:walkthrough-state', JSON.stringify(state))
  console.log(`Marked ${featureId} as unseen. Refresh to see spotlight.`)
}

// List all features on current page
window.listFeaturesOnPage = () => {
  const elements = document.querySelectorAll('[data-feature]')
  console.log('Features on current page:')
  elements.forEach(el => {
    console.log('  -', el.getAttribute('data-feature'), el)
  })
}

// Check if element exists for a feature
window.checkFeature = (featureId) => {
  const el = document.querySelector(`[data-feature="${featureId}"]`)
  if (el) {
    console.log('✓ Element found:', el)
    console.log('  Bounds:', el.getBoundingClientRect())
  } else {
    console.log('✗ Element NOT found for:', featureId)
  }
}
```

## Test Checklist

- [ ] Walkthrough prompt appears on first launch
- [ ] Can complete full walkthrough tour
- [ ] Can skip walkthrough
- [ ] Keyboard navigation works (arrows, escape)
- [ ] Feature spotlights appear on route navigation
- [ ] Spotlights dismiss and mark as seen
- [ ] Features don't reappear after being seen
- [ ] Tooltip positions correctly (doesn't go off-screen)
- [ ] Multiple features on same route show one at a time
- [ ] State persists across app restarts

## Known Issues

- Spotlight may be laggy when transitioning between steps (mentioned in recent changes)
- Task board not showing when no tasks exist (may affect board-related spotlights)

## Files to Check

If you need to debug or modify the spotlight system:

| File | Purpose |
|------|---------|
| `src/renderer/src/components/walkthrough/AutoFeatureSpotlight.tsx` | Auto spotlight logic |
| `src/renderer/src/components/walkthrough/WalkthroughSpotlight.tsx` | Spotlight UI |
| `src/renderer/src/components/walkthrough/features.ts` | Feature definitions |
| `src/renderer/src/stores/walkthrough-store.ts` | State management |
| `src/renderer/src/components/walkthrough/WalkthroughProvider.tsx` | Context provider |
| `scripts/debug-walkthrough-state.html` | Debug utility |
