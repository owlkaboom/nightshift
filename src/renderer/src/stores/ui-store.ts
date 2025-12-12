/**
 * Zustand store for UI state
 */

import { create } from 'zustand'

type ModalType =
  | 'addProject'
  | 'editProject'
  | 'addTask'
  | 'editTask'
  | 'taskDetail'
  | 'confirmDelete'
  | null

interface UIState {
  // Sidebar
  sidebarCollapsed: boolean

  // Modals
  activeModal: ModalType
  modalData: unknown

  // Panels
  detailPanelOpen: boolean
  detailPanelWidth: number

  // Theme
  theme: 'light' | 'dark' | 'system'

  // Notifications
  notifications: Notification[]

  // Actions
  toggleSidebar: () => void
  openModal: (modal: ModalType, data?: unknown) => void
  closeModal: () => void
  toggleDetailPanel: () => void
  setDetailPanelWidth: (width: number) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  addNotification: (notification: Omit<Notification, 'id'>) => string
  updateNotification: (id: string, updates: Partial<Omit<Notification, 'id'>>) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void
}

/** Action button for notifications */
export interface NotificationAction {
  label: string
  onClick: () => void | Promise<void>
}

export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  /** Duration in ms. 0 or negative means no auto-dismiss */
  duration?: number
  /** Optional action button */
  action?: NotificationAction
}

let notificationId = 0

export const useUIStore = create<UIState>((set) => ({
  // Initial state
  sidebarCollapsed: false,
  activeModal: null,
  modalData: null,
  detailPanelOpen: false,
  detailPanelWidth: 400,
  theme: 'system',
  notifications: [],

  // Sidebar actions
  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
  },

  // Modal actions
  openModal: (modal: ModalType, data?: unknown) => {
    set({ activeModal: modal, modalData: data })
  },

  closeModal: () => {
    set({ activeModal: null, modalData: null })
  },

  // Panel actions
  toggleDetailPanel: () => {
    set((state) => ({ detailPanelOpen: !state.detailPanelOpen }))
  },

  setDetailPanelWidth: (width: number) => {
    set({ detailPanelWidth: Math.max(300, Math.min(800, width)) })
  },

  // Theme actions
  setTheme: (theme: 'light' | 'dark' | 'system') => {
    set({ theme })
    // Apply theme to document
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.classList.toggle('dark', prefersDark)
    } else {
      document.documentElement.classList.toggle('dark', theme === 'dark')
    }
  },

  // Notification actions
  addNotification: (notification: Omit<Notification, 'id'>) => {
    const id = `notification-${++notificationId}`
    set((state) => ({
      notifications: [...state.notifications, { ...notification, id }]
    }))

    // Auto-remove after duration (default 5 seconds)
    // Duration of 0 or negative means no auto-dismiss
    const duration = notification.duration ?? 5000
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id)
        }))
      }, duration)
    }

    return id
  },

  updateNotification: (id: string, updates: Partial<Omit<Notification, 'id'>>) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, ...updates } : n
      )
    }))
  },

  removeNotification: (id: string) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id)
    }))
  },

  clearNotifications: () => {
    set({ notifications: [] })
  }
}))
