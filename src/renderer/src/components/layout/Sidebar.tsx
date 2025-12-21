import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores'
import { formatKbdParts } from '@/hooks/useKeyboardShortcuts'
import { Link, useLocation } from '@tanstack/react-router'
import {
  ListTodo,
  FolderGit2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Tag,
  Keyboard,
  Activity,
  MessageSquare,
  FileText,
  Calendar
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import appIcon from '@/assets/icon.png'
import { useState, useEffect } from 'react'
import { IntegrationsSection } from './IntegrationsSection'

interface NavItem {
  to: '/board' | '/projects' | '/tags' | '/notes' | '/planning' | '/schedule' | '/processes' | '/shortcuts'
  label: string
  icon: React.ElementType
  shortcut: string
}

const navItems: NavItem[] = [
  { to: '/board', label: 'Board', icon: ListTodo, shortcut: 'B' },
  { to: '/projects', label: 'Projects', icon: FolderGit2, shortcut: 'P' },
  { to: '/tags', label: 'Tags', icon: Tag, shortcut: 'T' },
  { to: '/notes', label: 'Notes', icon: FileText, shortcut: 'N' },
  { to: '/planning', label: 'Planning', icon: MessageSquare, shortcut: 'A' },
  { to: '/schedule', label: 'Schedule', icon: Calendar, shortcut: 'S' }
]

const getTourId = (to: string): string | undefined => {
  const tourMap: Record<string, string> = {
    '/projects': 'projects',
    '/planning': 'planning'
  }
  return tourMap[to]
}

interface SidebarProps {
  // No props needed anymore - navigation is handled by router
}

export function Sidebar({}: SidebarProps) {
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const location = useLocation()
  const [isMac, setIsMac] = useState(true) // Default to mac for initial render

  useEffect(() => {
    window.api.getPlatform().then((platform) => {
      setIsMac(platform === 'darwin')
    })
  }, [])

  // Use smaller spacing on Windows/Linux vs macOS
  const titleBarSpacing = isMac ? 'h-10' : 'h-1'

  return (
    <aside
      className={cn(
        'sidebar flex flex-col h-screen border-r bg-card transition-all duration-300',
        // On mobile (< 640px), hide completely when collapsed; on desktop show as icon bar
        sidebarCollapsed ? 'w-0 sm:w-16' : 'w-56',
        // On mobile, overlay the content when expanded
        'sm:relative fixed left-0 top-0 z-40',
        sidebarCollapsed && 'sm:border-r border-r-0'
      )}
    >
      {/* Spacer for title bar / window controls - platform-specific height */}
      <div className={`${titleBarSpacing} shrink-0`} />

      {/* Logo/Brand with collapse toggle */}
      <div className="flex h-12 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <img src={appIcon} alt="Nightshift" className="h-8 w-8 rounded-lg shrink-0 object-contain" />
          {!sidebarCollapsed && (
            <span className="font-semibold text-lg">Nightshift</span>
          )}
        </div>
        {!sidebarCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-8 w-8 shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Expand button when collapsed - below header */}
      {sidebarCollapsed && (
        <div className="flex justify-center py-2 border-b">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.to

            const tourId = getTourId(item.to)
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  title={`${item.label} (${item.shortcut})`}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                  data-tour={tourId}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!sidebarCollapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      <kbd className="text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {item.shortcut}
                      </kbd>
                    </>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Integrations Section */}
      <IntegrationsSection collapsed={sidebarCollapsed} />

      {/* Settings button */}
      <div className="p-2 border-t">
        <Link
          to="/settings"
          search={{ section: undefined }}
          title="Settings (,)"
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
            location.pathname === '/settings'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
          data-tour="settings"
        >
          <Settings className="h-5 w-5 shrink-0" />
          {!sidebarCollapsed && (
            <>
              <span className="flex-1 text-left">Settings</span>
              <kbd className="text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                ,
              </kbd>
            </>
          )}
        </Link>
      </div>

      {/* Process Monitor */}
      <div className="p-2 border-t">
        <Link
          to="/processes"
          title="Process Monitor"
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
            location.pathname === '/processes'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <Activity className="h-5 w-5 shrink-0" />
          {!sidebarCollapsed && (
            <>
              <span className="flex-1 text-left">Processes</span>
              <div className="flex items-center gap-0.5">
                {formatKbdParts('⌘P').map((part, index, array) => (
                  <span key={index} className="flex items-center gap-0.5">
                    <kbd className="text-muted-foreground bg-muted px-1.5 py-0.5 rounded text-xs">
                      {part}
                    </kbd>
                    {index < array.length - 1 && (
                      <span className="text-muted-foreground text-xs px-0.5">+</span>
                    )}
                  </span>
                ))}
              </div>
            </>
          )}
        </Link>
      </div>

      {/* Keyboard shortcuts */}
      <div className="p-2 border-t">
        <Link
          to="/shortcuts"
          title="Keyboard shortcuts"
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
            location.pathname === '/shortcuts'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <Keyboard className="h-5 w-5 shrink-0" />
          {!sidebarCollapsed && (
            <>
              <span className="flex-1 text-left">Shortcuts</span>
              <div className="flex items-center gap-0.5">
                {formatKbdParts('⌘/').map((part, index, array) => (
                  <span key={index} className="flex items-center gap-0.5">
                    <kbd className="text-muted-foreground bg-muted px-1.5 py-0.5 rounded text-xs">
                      {part}
                    </kbd>
                    {index < array.length - 1 && (
                      <span className="text-muted-foreground text-xs px-0.5">+</span>
                    )}
                  </span>
                ))}
              </div>
            </>
          )}
        </Link>
      </div>
    </aside>
  )
}
