import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { isTokenLikelyValid } from '../services/mockAuthApi'
import { useAuthStore } from '../store/authStore'

export const PrivateRoute = () => {
  const location = useLocation()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const token = useAuthStore((state) => state.token)

  if (!isAuthenticated || !isTokenLikelyValid(token)) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
