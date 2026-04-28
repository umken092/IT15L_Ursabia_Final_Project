import { Navigate, Route, Routes } from 'react-router-dom'
import { MainLayout } from '../layout/MainLayout'
import { LandingPage } from '../pages/LandingPage'
import { LoginPage } from '../pages/LoginPage'
import { ModulePlaceholderPage } from '../pages/ModulePlaceholderPage'
import { RoleDashboardPage } from '../pages/RoleDashboardPage'
import { PrivateRoute } from '../routes/PrivateRoute'

export const AppRouter = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<PrivateRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/dashboard/:role" element={<RoleDashboardPage />} />
          <Route path="/module/:moduleKey" element={<ModulePlaceholderPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
