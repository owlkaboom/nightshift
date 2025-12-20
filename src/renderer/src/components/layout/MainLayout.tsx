import { useUIStore } from '@/stores'
import { useLocation } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import { ReactNode, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sidebar } from './Sidebar'

interface MainLayoutProps {
  children: ReactNode
}

// Pages that should be rendered in full-scope mode without padding
const FULL_SCOPE_PAGES = ['/notes']

export function MainLayout({ children }: MainLayoutProps) {
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const location = useLocation()
  const [isMac, setIsMac] = useState(true) // Default to mac for initial render

  useEffect(() => {
    window.api.getPlatform().then((platform) => {
      setIsMac(platform === 'darwin')
    })
  }, [])

  // Determine if current page is full-scope
  const isFullScopePage = FULL_SCOPE_PAGES.includes(location.pathname)

  // Use smaller spacing on Windows/Linux (h-1 = 4px) vs macOS (h-8 = 32px)
  const titleBarHeight = isMac ? 'h-8' : 'h-1'
  const contentPadding = isFullScopePage ? '' : (isMac ? 'pt-8' : 'pt-1')

  return (
    <div className="flex h-screen bg-background">
      {/* Title bar drag region - smaller on Windows */}
      <div className={`fixed top-0 left-0 right-0 ${titleBarHeight} titlebar-drag-region z-50`} />

      {/* Mobile sidebar overlay backdrop */}
      {!sidebarCollapsed && (
        <div
          className="sm:hidden fixed inset-0 bg-black/50 z-30"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar - full height with platform-specific padding for title bar */}
      <Sidebar />

      {/* Main content - platform-specific padding */}
      <main className={`flex-1 ${contentPadding} flex flex-col overflow-hidden`}>
        {/* Mobile menu button - only show when sidebar is collapsed */}
        {sidebarCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="sm:hidden fixed top-10 left-2 z-20"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}

        <div className="flex-1 min-h-0">
          {children}
        </div>
      </main>
    </div>
  )
}
