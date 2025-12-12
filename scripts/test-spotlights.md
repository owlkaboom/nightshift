# Feature Spotlight Testing Guide

## Setup
1. Run the app in dev mode: `npm run dev`
2. Open DevTools Console (Cmd+Option+I on Mac)
3. Filter console to show only `[AutoFeatureSpotlight]` messages

## Current State (from debug panel)
- Walkthrough Completed: Yes ✓
- Spotlights Enabled: Yes ✓
- Seen Features: `voice-task-input`

## Features to Test

### 1. Planning Sessions Spotlight
**Route:** `/planning`
**Expected:** Should show spotlight on page load

**Steps:**
1. Navigate to Planning tab
2. Check console for:
   ```
   [AutoFeatureSpotlight] Route changed: /planning
   [AutoFeatureSpotlight] Unseen features: 1
   [AutoFeatureSpotlight] Unseen feature IDs: ["planning-sessions"]
   [AutoFeatureSpotlight] Attempting to show feature: planning-sessions
   [AutoFeatureSpotlight] Bounds calculated successfully: {...}
   ```
3. Spotlight should appear highlighting the planning view

**If it doesn't work:**
- Check for "Spotlight blocked" message
- Check for "Could not calculate bounds" warning
- Run in console: `document.querySelector('[data-feature="planning-sessions"]')`

---

### 2. Skills System Spotlight
**Route:** `/skills`
**Expected:** Should show spotlight on page load

**Steps:**
1. Navigate to Skills tab
2. Check console for spotlight messages
3. Spotlight should appear highlighting the skills view

**If it doesn't work:**
- Same debugging steps as above
- Run: `document.querySelector('[data-feature="skills-system"]')`

---

### 3. Rich Text Editor Spotlight
**Route:** `/board` + Open Add Task Dialog
**Expected:** Should show spotlight when dialog opens

**Steps:**
1. Navigate to Board tab
2. Click "Add Task" button to open the dialog
3. Check console for spotlight messages
4. Spotlight should highlight the text editor in the dialog

**If it doesn't work:**
- The dialog must be OPEN for the element to exist
- Run: `document.querySelector('[data-feature="rich-text-editor"]')`

---

## Common Issues

### Issue: "Spotlight blocked: walkthrough not completed/skipped"
**Solution:** The walkthrough state is incorrect. Check the debug panel.

### Issue: "Could not calculate bounds for feature: X"
**Solution:** Element not found or not visible. Check if:
- You're on the correct route
- The element exists in the DOM
- The element is visible (not hidden)

### Issue: "Unseen features: 0"
**Solution:** All features have been marked as seen. To reset:
1. Open debug panel (Cmd+Shift+D in dev mode)
2. Click "Clear All Seen Features"
3. Navigate to the route again

---

## Manual Testing Checklist

- [ ] Planning Sessions spotlight shows on /planning
- [ ] Skills System spotlight shows on /skills
- [ ] Rich Text Editor spotlight shows when opening Add Task dialog
- [ ] Clicking "Got it" dismisses the spotlight
- [ ] Dismissing one spotlight shows the next unseen feature on that route
- [ ] Spotlights don't show for already-seen features
- [ ] Console shows clear debug messages

---

## Reset Testing State

To test spotlights again after dismissing them:

**Option 1: Debug Panel (Dev Mode Only)**
1. Press Cmd+Shift+D to open debug panel
2. Click "Clear All Seen Features"

**Option 2: LocalStorage**
Open console and run:
```javascript
const state = JSON.parse(localStorage.getItem('nightshift:walkthrough-state'))
state.seenFeatures = ['voice-task-input'] // Keep only this one
localStorage.setItem('nightshift:walkthrough-state', JSON.stringify(state))
location.reload()
```

**Option 3: Nuclear Option**
```javascript
localStorage.removeItem('nightshift:walkthrough-state')
location.reload()
// Note: This will trigger the walkthrough prompt again
```
