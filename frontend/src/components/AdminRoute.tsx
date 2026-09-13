import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

// Nested inside ProtectedRoute — only needs to additionally gate on role,
// since ProtectedRoute already handles the loading/not-logged-in cases.
export function AdminRoute() {
  const { user } = useAuth()

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/alarms" replace />
  }

  return <Outlet />
}
