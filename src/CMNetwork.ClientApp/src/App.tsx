import { useEffect } from 'react'
import { AppNotificationCenter } from './components/AppNotificationCenter'
import { AppRouter } from './router/AppRouter'
import { useUIStore } from './store/uiStore'

function App() {
  const theme = useUIStore((state) => state.theme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <>
      <AppRouter />
      <AppNotificationCenter />
    </>
  )
}

export default App
