import { Notification, NotificationGroup } from '@progress/kendo-react-notification'
import { useNotificationStore } from '../store/notificationStore'

export const AppNotificationCenter = () => {
  const toasts = useNotificationStore((state) => state.toasts)
  const remove = useNotificationStore((state) => state.remove)

  return (
    <NotificationGroup
      style={{
        right: 16,
        top: 16,
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        zIndex: 1000,
      }}
    >
      {toasts.map((toast) => (
        <Notification
          key={toast.id}
          type={{ style: toast.type, icon: true }}
          closable
          onClose={() => remove(toast.id)}
        >
          {toast.message}
        </Notification>
      ))}
    </NotificationGroup>
  )
}
