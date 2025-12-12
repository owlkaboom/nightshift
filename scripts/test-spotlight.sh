#!/bin/bash
# Spotlight Feature Testing Script
#
# This script helps you test the spotlight feature system quickly

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Nightshift Spotlight Testing Tool    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Show menu
echo -e "${YELLOW}What would you like to test?${NC}"
echo ""
echo "  1) Mark all features as UNSEEN (will show all spotlights)"
echo "  2) Mark all features as SEEN (will hide all spotlights)"
echo "  3) Reset walkthrough (will show tour prompt)"
echo "  4) Clear ALL state (nuclear option - fresh start)"
echo "  5) Open debug utility in browser"
echo "  6) Show current state (read-only)"
echo "  7) Run the app with dev tools"
echo ""
read -p "Enter your choice (1-7): " choice

case $choice in
  1)
    echo -e "${GREEN}✓ Marking all features as unseen...${NC}"
    echo 'const state = JSON.parse(localStorage.getItem("nightshift:walkthrough-state") || "{}"); state.seenFeatures = []; localStorage.setItem("nightshift:walkthrough-state", JSON.stringify(state)); console.log("Done! Restart the app to see spotlights.");' | pbcopy
    echo ""
    echo -e "${YELLOW}JavaScript copied to clipboard!${NC}"
    echo "Steps:"
    echo "  1. Open the app (npm run dev)"
    echo "  2. Open DevTools (Cmd+Option+I)"
    echo "  3. Paste into console (Cmd+V) and press Enter"
    echo "  4. Reload the app (Cmd+R)"
    echo "  5. Navigate to any view to see spotlights"
    ;;

  2)
    echo -e "${GREEN}✓ Marking all features as seen...${NC}"
    echo 'const features = ["voice-task-input", "planning-sessions", "skills-system", "task-virtualization", "rich-text-editor", "integrations-panel"]; const state = JSON.parse(localStorage.getItem("nightshift:walkthrough-state") || "{}"); state.seenFeatures = features; localStorage.setItem("nightshift:walkthrough-state", JSON.stringify(state)); console.log("Done! No spotlights will show.");' | pbcopy
    echo ""
    echo -e "${YELLOW}JavaScript copied to clipboard!${NC}"
    echo "Steps:"
    echo "  1. Open the app (npm run dev)"
    echo "  2. Open DevTools (Cmd+Option+I)"
    echo "  3. Paste into console (Cmd+V) and press Enter"
    echo "  4. Reload the app (Cmd+R)"
    ;;

  3)
    echo -e "${GREEN}✓ Resetting walkthrough...${NC}"
    echo 'const state = JSON.parse(localStorage.getItem("nightshift:walkthrough-state") || "{}"); state.walkthroughCompleted = false; state.walkthroughSkipped = false; localStorage.setItem("nightshift:walkthrough-state", JSON.stringify(state)); console.log("Done! Walkthrough prompt will show on next launch.");' | pbcopy
    echo ""
    echo -e "${YELLOW}JavaScript copied to clipboard!${NC}"
    echo "Steps:"
    echo "  1. Open the app (npm run dev)"
    echo "  2. Open DevTools (Cmd+Option+I)"
    echo "  3. Paste into console (Cmd+V) and press Enter"
    echo "  4. Reload the app (Cmd+R)"
    ;;

  4)
    echo -e "${RED}⚠️  Clearing ALL walkthrough state...${NC}"
    echo 'localStorage.removeItem("nightshift:walkthrough-state"); console.log("Done! All state cleared.");' | pbcopy
    echo ""
    echo -e "${YELLOW}JavaScript copied to clipboard!${NC}"
    echo "Steps:"
    echo "  1. Open the app (npm run dev)"
    echo "  2. Open DevTools (Cmd+Option+I)"
    echo "  3. Paste into console (Cmd+V) and press Enter"
    echo "  4. Reload the app (Cmd+R)"
    ;;

  5)
    echo -e "${GREEN}✓ Opening debug utility...${NC}"
    open scripts/debug-walkthrough-state.html
    ;;

  6)
    echo -e "${GREEN}✓ Showing current state...${NC}"
    echo 'console.log(JSON.parse(localStorage.getItem("nightshift:walkthrough-state") || "{}"));' | pbcopy
    echo ""
    echo -e "${YELLOW}JavaScript copied to clipboard!${NC}"
    echo "Steps:"
    echo "  1. Open the app (npm run dev)"
    echo "  2. Open DevTools (Cmd+Option+I)"
    echo "  3. Paste into console (Cmd+V) and press Enter"
    ;;

  7)
    echo -e "${GREEN}✓ Starting app with dev tools...${NC}"
    echo ""
    echo -e "${BLUE}Pro tip:${NC} Press ${YELLOW}Cmd+Shift+D${NC} in the app to open the Spotlight Debug Panel!"
    echo ""
    npm run dev
    ;;

  *)
    echo -e "${RED}Invalid choice. Exiting.${NC}"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}Done!${NC}"
