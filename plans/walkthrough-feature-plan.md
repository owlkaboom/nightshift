# Walkthrough & Feature Highlights Implementation Plan

## Overview

Build a new user walkthrough system with spotlight-style UI that guides users through the app's core capabilities, plus a feature highlights system that badges and spotlights new features after updates.

## User Decisions

- **UI Style**: Spotlight/Tooltip - highlights actual UI elements with backdrop dimming
- **Trigger**: Prompt to start - show "Take a tour?" prompt after initial setup
- **Feature Alerts**: Badge + Spotlight - show badge dots on new features, spotlight when user visits

---

## Architecture

### Core Components

```
src/renderer/src/components/walkthrough/
├── WalkthroughProvider.tsx    # Context provider, manages state
├── WalkthroughSpotlight.tsx   # Spotlight overlay with tooltip
├── WalkthroughPrompt.tsx      # "Take a tour?" prompt dialog
├── WalkthroughTooltip.tsx     # Tooltip content with navigation
├── FeatureBadge.tsx           # "New" badge for feature highlights
└── index.ts                   # Exports
```

### State Management

```
src/renderer/src/stores/walkthrough-store.ts
```

Zustand store managing:
- Current walkthrough step
- Whether walkthrough is active
- Completed walkthrough flag
- Seen features list (for feature highlights)
- Last seen app version

### Type Definitions

```
src/shared/types/walkthrough.ts
```

---

## Data Structures

### WalkthroughStep

```typescript
interface WalkthroughStep {
  id: string
  targetSelector: string        // CSS selector for element to highlight
  title: string
  description: string
  route?: string                // Optional route to navigate to first
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto'
  spotlightPadding?: number     // Padding around highlighted element
  beforeShow?: () => void       // Callback before showing step
}
```

### FeatureHighlight

```typescript
interface FeatureHighlight {
  id: string
  version: string               // App version when feature was added
  targetSelector: string
  title: string
  description: string
  route?: string                // Route where this feature lives
}
```

### WalkthroughState (persisted)

```typescript
interface WalkthroughState {
  walkthroughCompleted: boolean
  walkthroughSkipped: boolean
  seenFeatures: string[]        // IDs of features user has seen
  lastSeenVersion: string       // Last app version user opened
}
```

---

## Implementation Steps

### Phase 1: Core Infrastructure

1. **Create walkthrough types** (`src/shared/types/walkthrough.ts`)
   - WalkthroughStep interface
   - FeatureHighlight interface
   - WalkthroughState interface

2. **Create walkthrough store** (`src/renderer/src/stores/walkthrough-store.ts`)
   - Zustand store with persistence to localStorage
   - Actions: startWalkthrough, nextStep, prevStep, skipWalkthrough, completeWalkthrough
   - Actions: markFeatureSeen, getUnseenFeatures, updateLastSeenVersion
   - Computed: currentStep, isActive, hasUnseenFeatures

3. **Define walkthrough steps** (`src/renderer/src/components/walkthrough/steps.ts`)
   - Define the tour sequence covering key features:
     1. Welcome/Board overview
     2. Sidebar navigation
     3. Adding a project
     4. Creating a task
     5. Task queue/status
     6. Planning sessions
     7. Skills configuration
     8. Settings overview

4. **Define feature highlights** (`src/renderer/src/components/walkthrough/features.ts`)
   - Versioned list of features to highlight
   - Easy to add new features with each release

### Phase 2: Spotlight UI Components

5. **WalkthroughProvider** (`src/renderer/src/components/walkthrough/WalkthroughProvider.tsx`)
   - React context wrapping the app
   - Handles keyboard navigation (arrow keys, Escape)
   - Manages spotlight positioning calculations
   - Auto-navigates to routes when needed

6. **WalkthroughSpotlight** (`src/renderer/src/components/walkthrough/WalkthroughSpotlight.tsx`)
   - Full-screen backdrop with "hole" cut out for target element
   - Uses CSS clip-path or SVG mask for spotlight effect
   - Smooth transitions between steps
   - Click-outside behavior (advance or close)

7. **WalkthroughTooltip** (`src/renderer/src/components/walkthrough/WalkthroughTooltip.tsx`)
   - Positioned tooltip next to highlighted element
   - Shows: step title, description, progress indicator
   - Navigation: Previous, Next, Skip buttons
   - Auto-positions to avoid viewport edges

8. **WalkthroughPrompt** (`src/renderer/src/components/walkthrough/WalkthroughPrompt.tsx`)
   - Dialog shown after InitSetupDialog completes
   - "Welcome! Would you like a quick tour?"
   - Buttons: "Start Tour", "Maybe Later", "Skip"

### Phase 3: Feature Highlights

9. **FeatureBadge** (`src/renderer/src/components/walkthrough/FeatureBadge.tsx`)
   - Small pulsing dot/badge component
   - Wraps any element to show "new" indicator
   - Auto-hides after user interacts or views spotlight

10. **Feature spotlight integration**
    - When user navigates to a page with unseen features
    - Auto-show spotlight for that feature (one at a time)
    - Mark as seen after dismissal

### Phase 4: Integration

11. **Integrate WalkthroughProvider into app**
    - Wrap in `__root.tsx` after TooltipProvider
    - Add WalkthroughSpotlight as sibling to MainLayout

12. **Add walkthrough trigger logic**
    - After InitSetupDialog completes (not skipped), show WalkthroughPrompt
    - Store prompt shown state to avoid re-showing

13. **Add FeatureBadge to relevant UI elements**
    - Sidebar items for new sections
    - New buttons/features in views
    - Easy to add via wrapper component

14. **Add "Restart Tour" option in Settings**
    - Button in settings to restart walkthrough
    - Clears completed/skipped state

15. **Add keyboard shortcuts**
    - Escape to exit walkthrough
    - Arrow keys for prev/next
    - Disable other shortcuts during walkthrough

---

## Walkthrough Tour Sequence

| Step | Route | Target | Title | Description |
|------|-------|--------|-------|-------------|
| 1 | /board | .sidebar | Welcome to Nightshift | Your AI task orchestrator. Let's explore the key features. |
| 2 | /board | [data-tour="board"] | Task Board | This is your command center. View and manage all your AI coding tasks here. |
| 3 | /board | [data-tour="add-task"] | Create Tasks | Click here to create a new task for the AI to work on. |
| 4 | /board | [data-tour="task-card"] | Task Cards | Each card represents a task. Drag to reorder, click to view details. |
| 5 | /projects | [data-tour="projects"] | Projects | Organize your work by project. Each project has its own task queue. |
| 6 | /planning | [data-tour="planning"] | AI Planning | Have interactive planning sessions with AI before creating tasks. |
| 7 | /skills | [data-tour="skills"] | Skills | Customize AI behavior with skill prompts for different coding styles. |
| 8 | /settings | [data-tour="settings"] | Settings | Configure agents, themes, and preferences here. |
| 9 | - | - | You're Ready! | Start by adding a project and creating your first task. Happy coding! |

---

## Storage Strategy

**localStorage keys:**
- `nightshift:walkthrough-state` - JSON blob with WalkthroughState

**Why localStorage vs config.json:**
- Walkthrough state is UI/session-specific
- Doesn't need to sync across machines
- Follows existing pattern (init-setup-skipped uses localStorage)

---

## File Changes Summary

### New Files
- `src/shared/types/walkthrough.ts`
- `src/renderer/src/stores/walkthrough-store.ts`
- `src/renderer/src/components/walkthrough/WalkthroughProvider.tsx`
- `src/renderer/src/components/walkthrough/WalkthroughSpotlight.tsx`
- `src/renderer/src/components/walkthrough/WalkthroughTooltip.tsx`
- `src/renderer/src/components/walkthrough/WalkthroughPrompt.tsx`
- `src/renderer/src/components/walkthrough/FeatureBadge.tsx`
- `src/renderer/src/components/walkthrough/steps.ts`
- `src/renderer/src/components/walkthrough/features.ts`
- `src/renderer/src/components/walkthrough/index.ts`

### Modified Files
- `src/renderer/src/routes/__root.tsx` - Add WalkthroughProvider, prompt trigger
- `src/renderer/src/stores/index.ts` - Export walkthrough store
- `src/shared/types/index.ts` - Export walkthrough types
- `src/renderer/src/views/SettingsView.tsx` - Add "Restart Tour" button
- Various views - Add `data-tour` attributes to key elements

---

## Technical Considerations

### Spotlight Positioning
- Use `getBoundingClientRect()` to get target element position
- Recalculate on window resize and scroll
- Handle elements that may not exist yet (wait for mount)

### Route Navigation
- Use TanStack Router's `useNavigate` for programmatic navigation
- Wait for route transition before showing spotlight
- Handle cases where target element doesn't exist on route

### Z-Index Management
- Spotlight backdrop: z-50 (same as dialogs)
- Tooltip: z-51
- Ensure highlighted element is visually above backdrop

### Accessibility
- Keyboard navigation (Tab, Enter, Escape, Arrows)
- ARIA labels for screen readers
- Focus management during walkthrough

### Animation
- Smooth transitions between steps (300ms)
- Subtle pulse animation on spotlight
- Tooltip fade in/out
