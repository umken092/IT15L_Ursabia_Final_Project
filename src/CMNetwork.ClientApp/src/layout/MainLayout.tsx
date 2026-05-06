import { Button } from '@progress/kendo-react-buttons'
import {
  arrowDownIcon,
  arrowUpIcon,
  arrowsSwapIcon,
  banknoteOutlineIcon,
  bellIcon,
  dashboardOutlineIcon,
  envelopeIcon,
  fileReportIcon,
  gearIcon,
  menuIcon,
  securityCheckOutlineIcon,
  slidersIcon,
  userOutlineIcon,
  usersOutlineIcon,
  walletOutlineIcon,
  type SVGIcon,
} from '@progress/kendo-svg-icons'
import { SvgIcon } from '@progress/kendo-react-common'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { menuByRole } from '../services/navigationService'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { CurrencyPicker } from './CurrencyPicker'
import { roleLabels } from '../types/auth'
import type { Role } from '../types/auth'

const baseSidebarIconByPath: Record<string, SVGIcon> = {
  '/module/user-management': usersOutlineIcon,
  '/module/system-settings': gearIcon,
  '/module/general-ledger': dashboardOutlineIcon,
  '/module/accounts-payable': arrowDownIcon,
  '/module/accounts-receivable': arrowUpIcon,
  '/module/bank-reconciliation': arrowsSwapIcon,
  '/module/dept-reports': fileReportIcon,
  '/module/fa-approvals': envelopeIcon,
  '/module/fa-reports': fileReportIcon,
  '/module/department-report': fileReportIcon,
  '/module/approvals': securityCheckOutlineIcon,
  '/module/expense-claims': walletOutlineIcon,
  '/module/payslips': banknoteOutlineIcon,
  '/module/executive-summary': fileReportIcon,
  '/module/av-reports': fileReportIcon,
  '/module/audit-logs': fileReportIcon,
  '/module/approvals-inbox': envelopeIcon,
  '/module/budget-control': slidersIcon,
  '/module/budget-cost-control': slidersIcon,
  '/module/financial-reports': fileReportIcon,
  '/module/profile': userOutlineIcon,
  '/module/reports': fileReportIcon,
}

const dashboardPathByRole: Record<Role, string> = {
  'super-admin': '/dashboard/super-admin',
  accountant: '/dashboard/accountant',
  'faculty-admin': '/dashboard/faculty-admin',
  employee: '/dashboard/employee',
  'authorized-viewer': '/dashboard/authorized-viewer',
  auditor: '/dashboard/auditor',
  cfo: '/dashboard/cfo',
}

const breadcrumbLabelByPath: Partial<Record<Role, Record<string, string[]>>> = {
  employee: {
    '/dashboard/employee': ['Workspace'],
    '/module/payslips': ['Workspace', 'Payroll'],
    '/module/expense-claims': ['Workspace', 'Claims'],
    '/module/profile': ['Workspace', 'Profile'],
  },
  accountant: {
    '/dashboard/accountant': ['Workspace'],
    '/module/general-ledger': ['Workspace', 'Ledger'],
    '/module/accounts-payable': ['Workspace', 'Payables'],
    '/module/accounts-receivable': ['Workspace', 'Receivables'],
    '/module/bank-reconciliation': ['Workspace', 'Reconciliation'],
    '/module/reports': ['Workspace', 'Reports'],
  },
  'faculty-admin': {
    '/dashboard/faculty-admin': ['Workspace'],
    '/module/dept-reports': ['Workspace', 'Department Reports'],
    '/module/fa-approvals': ['Workspace', 'Approvals Inbox'],
    '/module/fa-reports': ['Workspace', 'Reports'],
    '/module/department-report': ['Workspace', 'Department Reports'],
    '/module/approvals': ['Workspace', 'Approvals'],
    '/module/budget-cost-control': ['Workspace', 'Budget Control'],
  },
}

const formatCrumb = (segment: string) =>
  segment
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')

const isRole = (value: string): value is Role => {
  return Object.hasOwn(roleLabels, value)
}

const splitPathAndHash = (path: string) => {
  const [pathname, hashFragment] = path.split('#')
  return {
    pathname,
    hash: hashFragment ? `#${hashFragment}` : '',
  }
}

const getSidebarIcon = (role: Role, path: string) => {
  const pathname = splitPathAndHash(path).pathname
  return pathname === dashboardPathByRole[role] ? dashboardOutlineIcon : baseSidebarIconByPath[pathname] ?? null
}

const getBreadcrumbs = (role: Role, pathname: string) => {
  const mappedCrumbs = breadcrumbLabelByPath[role]?.[pathname]
  if (mappedCrumbs?.length) {
    return mappedCrumbs
  }

  return pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => formatCrumb(segment))
}

export const MainLayout = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const selectedRole = useAuthStore((state) => state.selectedRole)
  const logout = useAuthStore((state) => state.logout)
  const sidebarOpen = useUIStore((state) => state.sidebarOpen)
  const toggleSidebar = useUIStore((state) => state.toggleSidebar)
  const closeSidebar = useUIStore((state) => state.closeSidebar)
  const theme = useUIStore((state) => state.theme)
  const toggleTheme = useUIStore((state) => state.toggleTheme)

  if (!user) {
    return null
  }

  const fallbackRole = isRole(user.role) ? user.role : 'employee'
  const currentRole = selectedRole && isRole(selectedRole) ? selectedRole : fallbackRole
  const roleClassName = `role-${currentRole}`
  const crumbs = getBreadcrumbs(currentRole, location.pathname)
  const menuItems = menuByRole[currentRole] ?? menuByRole[fallbackRole] ?? []

  const isItemActive = (path: string, exact = false) => {
    const { pathname, hash } = splitPathAndHash(path)
    const hashMatches = hash ? location.hash === hash : location.hash === ''

    if (exact) {
      return location.pathname === pathname && hashMatches
    }

    return hash
      ? location.pathname === pathname && location.hash === hash
      : (location.pathname === pathname && location.hash === '') || location.pathname.startsWith(`${pathname}/`)
  }

  const isChildActive = (path: string) => {
    const { pathname, hash } = splitPathAndHash(path)
    if (location.pathname !== pathname) {
      return false
    }

    return hash ? location.hash === hash : true
  }

  const hasActiveChild = (children?: { path: string }[]) => {
    if (!children?.length) {
      return false
    }

    return children.some((child) => isChildActive(child.path))
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const handleSidebarLinkClick = () => {
    if (globalThis.matchMedia('(max-width: 960px)').matches) {
      closeSidebar()
    }
  }

  return (
    <div className={`app-shell ${roleClassName}`}>
      <aside className={`sidebar ${roleClassName} ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="sidebar-brand">
          <img src="/CMN.png" alt="CMNetwork logo" className="sidebar-logo" />
          <div>
            <strong>CMNetwork</strong>
            <p>Accounting ERP</p>
          </div>
        </div>

        <div className="sidebar-section-label">Navigation</div>
        <nav className="sidebar-nav">
          {menuItems.map((item) => {
            const childActive = hasActiveChild(item.children)
            const parentRouteActive = isItemActive(item.path, true)
            const expanded = Boolean(item.children?.length && (parentRouteActive || childActive))
            const parentActive = item.children?.length
              ? parentRouteActive && !childActive
              : parentRouteActive
            const parentIcon = getSidebarIcon(currentRole, item.path)

            return (
              <div key={`${item.label}-${item.path}`}>
                <Link
                  to={item.path}
                  className={`sidebar-link ${parentActive ? 'active' : ''}`.trim()}
                  onClick={handleSidebarLinkClick}
                >
                  {parentIcon && (
                    <span className="sidebar-link-icon" aria-hidden="true">
                      <SvgIcon icon={parentIcon} />
                    </span>
                  )}
                  <span className="sidebar-link-label">{item.label}</span>
                </Link>
                {expanded ? (
                  <div className="sidebar-subnav">
                    {item.children?.map((child) => {
                      const childIcon = getSidebarIcon(currentRole, child.path)

                      return (
                        <Link
                          key={`${child.label}-${child.path}`}
                          to={child.path}
                          className={`sidebar-link sidebar-sublink ${isChildActive(child.path) ? 'active' : ''}`.trim()}
                          onClick={handleSidebarLinkClick}
                        >
                          {childIcon && (
                            <span className="sidebar-link-icon" aria-hidden="true">
                              <SvgIcon icon={childIcon} />
                            </span>
                          )}
                          <span className="sidebar-link-label">{child.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div>
            <strong>{user.fullName}</strong>
            <p>{roleLabels[currentRole] ?? roleLabels[fallbackRole]}</p>

          </div>
          <Button onClick={handleLogout} themeColor="secondary" className="sidebar-logout-btn">
            Logout
          </Button>
        </div>
      </aside>

      <div className={`content-area ${roleClassName}`}>
        <header className={`topbar ${roleClassName}`}>
          <div className="topbar-left">
            <button className="topbar-btn shell-btn" onClick={toggleSidebar} title="Toggle sidebar">
              <SvgIcon icon={menuIcon} />
            </button>
            <div className={`breadcrumb ${roleClassName}`}>
              <span className="breadcrumb-brand">CMN ERP</span>
              {crumbs.length > 0 && <span style={{ color: 'var(--muted)' }}>›</span>}
              {crumbs.map((crumb, idx) => (
                <span key={`${crumb}-${idx === crumbs.length - 1 ? 'last' : idx}`} className={idx === crumbs.length - 1 ? 'breadcrumb-current' : 'breadcrumb-segment'}>
                  {formatCrumb(crumb)}
                </span>
              ))}
            </div>
          </div>

          <div className="topbar-actions">
            <CurrencyPicker />
            <button className="topbar-btn shell-btn" onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <div className="topbar-notification-wrap">
              <button className="topbar-btn shell-btn" title="Notifications">
                <SvgIcon icon={bellIcon} />
              </button>
              <span className="topbar-dot" aria-hidden="true" />
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
