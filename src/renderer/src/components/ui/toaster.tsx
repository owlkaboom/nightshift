import { useUIStore } from '@/stores'
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport
} from './toast'

export function Toaster() {
  const { notifications, removeNotification } = useUIStore()

  return (
    <ToastProvider>
      {notifications.map((notification) => (
        <Toast
          key={notification.id}
          variant={notification.type}
          onOpenChange={(open) => {
            if (!open) removeNotification(notification.id)
          }}
        >
          <div className="grid gap-1">
            <ToastTitle>{notification.title}</ToastTitle>
            {notification.message && (
              <ToastDescription>{notification.message}</ToastDescription>
            )}
          </div>
          {notification.action && (
            <ToastAction
              altText={notification.action.label}
              onClick={(e) => {
                e.preventDefault()
                notification.action?.onClick()
              }}
            >
              {notification.action.label}
            </ToastAction>
          )}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
