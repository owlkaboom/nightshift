# Feature Spotlight Custom Content

## Overview

The Feature Spotlight system now supports custom content (markdown, images, GIFs, and videos) to provide richer, more informative feature introductions to users.

## Changes Made

### 1. Fixed Duplicate Spotlight Triggers

**Problem:** The spotlight was triggering twice before marking a feature as seen.

**Solution:** Added a `isDismissingRef` flag to prevent the route change effect from re-triggering while a feature is being dismissed. This ensures:
- The spotlight only shows once per feature
- Smooth transitions between multiple spotlights on the same route
- No race conditions between `markFeatureSeen` and the route effect

**Files Changed:**
- `src/renderer/src/components/walkthrough/AutoFeatureSpotlight.tsx` (lines 30, 95, 104, 233, 238, 264, 270)

### 2. Added Custom Content Support

**New Types:**
```typescript
interface FeatureContent {
  type: 'markdown' | 'image' | 'video'
  source: string
  alt?: string
  maxWidth?: number
  maxHeight?: number
}

interface FeatureHighlight {
  // ... existing fields
  content?: FeatureContent // New optional field
}
```

**Features:**
- **Markdown**: Render rich formatted text with bold, italic, lists, etc.
- **Images/GIFs**: Display visual demonstrations with size constraints
- **Videos**: Auto-playing looping videos for animated demos

**Files Changed:**
- `src/shared/types/walkthrough.ts` - Added `FeatureContent` interface
- `src/renderer/src/components/walkthrough/AutoFeatureSpotlight.tsx` - Added rendering logic
- `src/renderer/src/components/walkthrough/features.ts` - Added documentation and example

## Usage

### Adding Markdown Content

```typescript
{
  id: 'my-feature',
  targetSelector: '[data-feature="my-feature"]',
  title: 'My Feature',
  description: 'A short description',
  content: {
    type: 'markdown',
    source: `
**How to use:**
1. Click the button
2. Enter your data
3. Press submit
    `.trim()
  }
}
```

### Adding Image/GIF Content

```typescript
{
  id: 'my-feature',
  targetSelector: '[data-feature="my-feature"]',
  title: 'My Feature',
  description: 'A short description',
  content: {
    type: 'image',
    source: '/assets/demo.gif',
    alt: 'Demo of the feature',
    maxWidth: 400,
    maxHeight: 300
  }
}
```

### Adding Video Content

```typescript
{
  id: 'my-feature',
  targetSelector: '[data-feature="my-feature"]',
  title: 'My Feature',
  description: 'A short description',
  content: {
    type: 'video',
    source: '/assets/demo.mp4',
    alt: 'Video demonstration',
    maxWidth: 500,
    maxHeight: 350
  }
}
```

## Technical Details

### Rendering

The custom content is rendered in the spotlight tooltip below the main description:

1. **Markdown**: Uses the `MarkdownRenderer` component with prose styling
2. **Images**: Centered with responsive sizing and shadow effects
3. **Videos**: Auto-play, loop, muted, with responsive sizing

### Size Constraints

- Default max width: 100%
- Default max height: 300px (images/videos)
- Can be overridden with `maxWidth` and `maxHeight` properties
- Uses `object-fit: contain` to maintain aspect ratio

### Accessibility

- All images and videos support `alt` text
- Videos include fallback text if the browser doesn't support the format
- Markdown content is properly structured with semantic HTML

## Example

The `voice-task-input` feature highlight now includes markdown content demonstrating the usage pattern:

```typescript
{
  id: 'voice-task-input',
  title: 'Voice Task Input',
  description: 'Create tasks using your voice!',
  content: {
    type: 'markdown',
    source: `
**How to use:**
1. Click the **Add Task** button
2. Look for the microphone icon
3. Click it to start recording
4. Speak your task description
5. Click again to stop and transcribe
    `.trim()
  }
}
```

## Testing

To test the feature spotlight:

1. Clear localStorage to reset seen features:
   ```javascript
   localStorage.removeItem('nightshift:walkthrough-state')
   ```

2. Navigate to a route with feature highlights (e.g., `/board`)

3. The spotlight should appear exactly once for each unseen feature

4. Custom content should render correctly based on the `content.type`

## Future Enhancements

Potential improvements:
- Support for multiple content items per feature
- Interactive elements within custom content
- Animation control for videos
- PDF support
- Embedded iframe content
