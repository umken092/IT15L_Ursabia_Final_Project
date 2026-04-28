import { Button } from '@progress/kendo-react-buttons'
import { bellIcon, menuIcon } from '@progress/kendo-svg-icons'
import { SvgIcon } from '@progress/kendo-react-common'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { menuByRole } from '../services/mockDashboardData'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { roleLabels, roleDashboardPath } from '../types/auth'
import type { Role } from '../types/auth'

const formatCrumb = (segment: string) =>
  segment
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')

export const MainLayout = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const selectedRole = useAuthStore((state) => state.selectedRole)
  const logout = useAuthStore((state) => state.logout)
  const switchRole = useAuthStore((state) => state.switchRole)
  const sidebarOpen = useUIStore((state) => state.sidebarOpen)
  const toggleSidebar = useUIStore((state) => state.toggleSidebar)
  const closeSidebar = useUIStore((state) => state.closeSidebar)
  const theme = useUIStore((state) => state.theme)
  const toggleTheme = useUIStore((state) => state.toggleTheme)

  if (!user) {
    return null
  }

  const currentRole = selectedRole || user.role
  const crumbs = location.pathname.split('/').filter(Boolean)
  const menuItems = menuByRole[currentRole]

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const handleRoleSwitch = (newRole: Role) => {
    switchRole(newRole)
    navigate(roleDashboardPath(newRole))
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="sidebar-brand">
          <img src="/CMN.png" alt="CMNetwork logo" className="sidebar-logo" />
          <div>
            <strong>CMNetwork</strong>
            <p>Accounting ERP</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <div key={`${item.label}-${item.path}`}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active' : ''}`.trim()
                }
                onClick={closeSidebar}
              >
                {item.label}
              </NavLink>
              {item.children?.length ? (
                <div className="sidebar-subnav">
                  {item.children.map((child) => (
                    <NavLink
                      key={`${child.label}-${child.path}`}
                      to={child.path}
                      className={({ isActive }) =>
                        `sidebar-link sidebar-sublink ${isActive ? 'active' : ''}`.trim()
                      }
                      onClick={closeSidebar}
                    >
                      {child.label}
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div>
            <strong>{user.fullName}</strong>
            <p>{roleLabels[currentRole]}</p>
            {user.roles.length > 1 && (
              <div className="role-switcher">
                <label htmlFor="role-select">Switch Role:</label>
                <select
                  id="role-select"
                  value={currentRole}
                  onChange={(e) => handleRoleSwitch(e.target.value as Role)}
                  className="role-select"
                >
                  {user.roles.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <Button onClick={handleLogout} themeColor="secondary">
            Logout
          </Button>
        </div>
      </aside>

      <div className="content-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="topbar-btn" onClick={toggleSidebar} title="Toggle sidebar">
              <SvgIcon icon={menuIcon} />
            </button>
            <div className="breadcrumb">
              <span style={{ fontWeight: 600, color: 'var(--primary)' }}>CMN ERP</span>
              {crumbs.length > 0 && <span style={{ color: 'var(--muted)' }}>›</span>}
              {crumbs.map((crumb, idx) => (
                <span key={idx} style={{ color: idx === crumbs.length - 1 ? 'var(--text)' : 'var(--muted)' }}>
                  {formatCrumb(crumb)}
                </span>
              ))}
            </div>
          </div>

          <div className="topbar-actions">
            <button className="topbar-btn" onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <button className="topbar-btn" title="Notifications">
                <SvgIcon icon={bellIcon} />
              </button>
            </div>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
