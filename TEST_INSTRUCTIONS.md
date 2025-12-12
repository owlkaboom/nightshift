# Feature Spotlight Testing Instructions

## What was the problem?

The feature spotlight system wasn't showing highlights for new features. The code had all the pieces but was missing the automatic spotlight trigger component.

## What was fixed?

1. **Created `AutoFeatureSpotlight` component** - A new component that automatically detects and shows spotlights for unseen features when navigating to different routes
2. **Added debug logging** - Console logs to track feature detection
3. **Created debug tool** - `scripts/debug-walkthrough-state.html` for managing localStorage state

## How to test:

### Option 1: Quick Test (Reset state to see features)

1. Open the app (dev server should be running at http://localhost:5173)

2. Open DevTools Console to see debug logs

3. In DevTools Console, run:
   ```javascript
   // Clear walkthrough state to show features as "unseen"
   localStorage.removeItem('nightshift:walkthrough-state')
   location.reload()
   ```

4. Navigate to Settings page - you should see the **integrations-panel** feature spotlight!

5. Click "Got it" or click the backdrop to dismiss it

6. Check the console for logs like:
   ```
   [AutoFeatureSpotlight] Route changed: /settings
   [AutoFeatureSpotlight] Unseen features: [...]
   [AutoFeatureSpotlight] Showing feature: integrations-panel
   ```

### Option 2: Use Debug Tool

1. Open `scripts/debug-walkthrough-state.html` in your browser

2. This tool lets you:
   - View current walkthrough state
   - Clear all state
   - Mark all features as seen/unseen
   - Reset walkthrough

3. Click "Mark All Features Unseen" to reset

4. Refresh the Nightshift app

5. Navigate through different routes to see features highlighted:
   - `/board` - voice-task-input, task-virtualization, rich-text-editor
   - `/planning` - planning-sessions
   - `/skills` - skills-system
   - `/settings` - integrations-panel

### Option 3: Manual localStorage manipulation

Open DevTools Console in the app and run:

```javascript
// Get current state
const state = JSON.parse(localStorage.getItem('nightshift:walkthrough-state'))
console.log('Current state:', state)

// Mark all features as unseen
state.seenFeatures = []
state.lastSeenVersion = '0.1.0'  // Set to earlier version
localStorage.setItem('nightshift:walkthrough-state', JSON.stringify(state))
location.reload()
```

## Expected Behavior:

When you navigate to a route with unseen features:

1. **Spotlight appears** - Dark overlay with cutout highlighting the feature
2. **Blue border** - Pulsing blue border around the highlighted element
3. **Tooltip shows** - Card with feature title, description, and "New" badge
4. **Console logs** - Debug info about what's being shown
5. **Dismiss works** - Clicking "Got it" or backdrop dismisses and marks as seen
6. **Next feature** - If multiple unseen features on same route, next one shows after dismissing

## Debugging tips:

- **Check console logs** - Look for `[AutoFeatureSpotlight]` messages
- **Check elements** - Look for `data-feature="..."` attributes on DOM elements
- **Check localStorage** - Verify state with `localStorage.getItem('nightshift:walkthrough-state')`
- **Check positioning** - Tooltip should position itself intelligently based on available space

## Code changes made:

1. **Created**: `src/renderer/src/components/walkthrough/AutoFeatureSpotlight.tsx`
2. **Modified**: `src/renderer/src/components/walkthrough/index.ts` (export)
3. **Modified**: `src/renderer/src/routes/__root.tsx` (render component)
4. **Created**: `scripts/debug-walkthrough-state.html` (debug tool)
5. **Created**: `TEST_INSTRUCTIONS.md` (this file)

## Notes:

- Features only show when NOT during walkthrough tour (isActive = false)
- Features show one at a time per route
- Features are version-gated (compare app version to feature version)
- Element must exist in DOM with `data-feature="feature-id"` attribute
