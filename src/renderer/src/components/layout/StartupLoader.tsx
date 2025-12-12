/**
 * StartupLoader - Full-screen loading indicator during app initialization
 * Shows rotating funny messages while backend services start up
 */

import { useState, useEffect } from 'react'
import { Loader2, Moon } from 'lucide-react'

// Funny loading messages that rotate during startup
const LOADING_MESSAGES = [
  "Brewing coffee for the AI...",
  "Teaching robots to be helpful...",
  "Warming up the neural pathways...",
  "Convincing electrons to cooperate...",
  "Polishing the silicon brain...",
  "Loading infinite patience...",
  "Calibrating the sarcasm detector...",
  "Reticulating splines...",
  "Untangling the internet tubes...",
  "Feeding the hamsters that power the servers...",
  "Consulting the magic 8-ball...",
  "Downloading more RAM...",
  "Asking ChatGPT for startup tips...",
  "Performing interpretive dance for the CPU...",
  "Bribing the firewall...",
  "Waking up the night owls...",
  "Charging the flux capacitor...",
  "Negotiating with localhost...",
  "Summoning the code spirits...",
  "Stretching the bits and bytes...",
]

interface StartupLoaderProps {
  /** Current status message from main process */
  statusMessage?: string
  /** Whether to show (false = startup complete) */
  visible: boolean
}

export function StartupLoader({ statusMessage, visible }: StartupLoaderProps) {
  const [funnyMessage, setFunnyMessage] = useState(() =>
    LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]
  )

  // Rotate funny messages every 2.5 seconds
  useEffect(() => {
    if (!visible) return

    const interval = setInterval(() => {
      setFunnyMessage(prev => {
        // Pick a new message that's different from the current one
        let newMessage = prev
        while (newMessage === prev) {
          newMessage = LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]
        }
        return newMessage
      })
    }, 2500)

    return () => clearInterval(interval)
  }, [visible])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      {/* Logo/Icon */}
      <div className="mb-8 flex items-center gap-3">
        <Moon className="h-12 w-12 text-primary" />
        <span className="text-3xl font-bold text-foreground">Nightshift</span>
      </div>

      {/* Spinner */}
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-6" />

      {/* Funny rotating message */}
      <p className="text-lg text-muted-foreground mb-2 transition-opacity duration-300">
        {funnyMessage}
      </p>

      {/* Actual status message (smaller, below) */}
      {statusMessage && (
        <p className="text-sm text-muted-foreground/60">
          {statusMessage}
        </p>
      )}
    </div>
  )
}
