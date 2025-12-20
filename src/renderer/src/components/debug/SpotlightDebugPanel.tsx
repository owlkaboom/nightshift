import { useState } from 'react'
import { useWalkthroughStore } from '@/stores/walkthrough-store'
import { featureHighlights } from '@/components/walkthrough/features'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface SpotlightDebugPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SpotlightDebugPanel({ open, onOpenChange }: SpotlightDebugPanelProps) {
  const {
    walkthroughCompleted,
    walkthroughSkipped,
    seenFeatures,
    spotlightsEnabled,
    markFeatureSeen,
    markFeatureUnseen,
    markAllFeaturesUnseen,
    hasSeenFeature,
    setSpotlightsEnabled
  } = useWalkthroughStore()

  const [checkResults, setCheckResults] = useState<Record<string, boolean>>({})

  const handleCheckElements = () => {
    const results: Record<string, boolean> = {}
    featureHighlights.forEach((feature) => {
      const element = document.querySelector(feature.targetSelector)
      results[feature.id] = !!element
    })
    setCheckResults(results)
  }

  const handleMarkAllUnseen = () => {
    markAllFeaturesUnseen()
  }

  const handleMarkAllSeen = () => {
    featureHighlights.forEach((feature) => {
      markFeatureSeen(feature.id)
    })
  }

  const handleResetWalkthrough = () => {
    // Reset via localStorage since store doesn't expose these setters
    const storageKey = 'nightshift:walkthrough-state'
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      const parsed = JSON.parse(stored)
      parsed.walkthroughCompleted = false
      parsed.walkthroughSkipped = false
      localStorage.setItem(storageKey, JSON.stringify(parsed))
      window.location.reload()
    }
  }

  const handleClearAll = () => {
    if (confirm('Clear all walkthrough state? This will reload the page.')) {
      localStorage.removeItem('nightshift:walkthrough-state')
      window.location.reload()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Spotlight Debug Panel</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current State */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Current State</h3>
            <div className="bg-muted p-3 rounded-md text-xs font-mono space-y-1">
              <div>
                <span className="text-muted-foreground">Walkthrough Completed:</span>{' '}
                <span className={walkthroughCompleted ? 'text-green-500' : 'text-red-500'}>
                  {walkthroughCompleted ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Walkthrough Skipped:</span>{' '}
                <span className={walkthroughSkipped ? 'text-yellow-500' : 'text-muted-foreground'}>
                  {walkthroughSkipped ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Spotlights Enabled:</span>{' '}
                <span className={spotlightsEnabled ? 'text-green-500' : 'text-red-500'}>
                  {spotlightsEnabled ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Seen Features:</span>{' '}
                <span className="text-muted-foreground">
                  {seenFeatures.length > 0 ? seenFeatures.join(', ') : 'None'}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Actions</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setSpotlightsEnabled(!spotlightsEnabled)}
              >
                {spotlightsEnabled ? 'Disable' : 'Enable'} Spotlights
              </Button>
              <Button variant="outline" onClick={handleMarkAllUnseen}>
                Mark All Features Unseen
              </Button>
              <Button variant="outline" onClick={handleMarkAllSeen}>
                Mark All Features Seen
              </Button>
              <Button variant="outline" onClick={handleResetWalkthrough}>
                Reset Walkthrough
              </Button>
              <Button variant="destructive" onClick={handleClearAll}>
                Clear All State
              </Button>
            </div>
          </div>

          {/* Feature List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Features Status</h3>
              <Button size="sm" variant="outline" onClick={handleCheckElements}>
                Check Elements
              </Button>
            </div>
            <div className="space-y-2">
              {featureHighlights.map((feature) => {
                const seen = hasSeenFeature(feature.id)
                const elementExists = checkResults[feature.id]

                return (
                  <div
                    key={feature.id}
                    className="bg-muted p-3 rounded-md flex items-start justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-xs font-mono ${seen ? 'text-muted-foreground' : 'text-primary'}`}
                        >
                          {feature.id}
                        </span>
                        {feature.priority !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            Priority: {feature.priority}
                          </span>
                        )}
                        {elementExists !== undefined && (
                          <span
                            className={`text-xs ${elementExists ? 'text-green-500' : 'text-red-500'}`}
                          >
                            {elementExists ? '✓ Element found' : '✗ Element missing'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mb-1">{feature.title}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        Selector: {feature.targetSelector}
                      </div>
                      <div className="text-xs text-muted-foreground">Route: {feature.route}</div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div
                        className={`text-xs px-2 py-1 rounded ${
                          seen
                            ? 'bg-muted-foreground/20 text-muted-foreground'
                            : 'bg-primary/20 text-primary'
                        }`}
                      >
                        {seen ? 'Seen' : 'Unseen'}
                      </div>
                      {seen && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markFeatureUnseen(feature.id)}
                        >
                          Mark Unseen
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Help Text */}
          <div className="bg-muted p-3 rounded-md text-xs text-muted-foreground">
            <p className="mb-2">
              <strong>Tip:</strong> To test a feature spotlight:
            </p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Click "Check Elements" to see which features exist on the current page</li>
              <li>Mark a feature as "Unseen" (or mark all unseen)</li>
              <li>Navigate to the feature's route</li>
              <li>The spotlight should appear automatically</li>
            </ol>
            <p className="mt-2">
              If a feature shows "Element missing", navigate to its route first, then check again.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
