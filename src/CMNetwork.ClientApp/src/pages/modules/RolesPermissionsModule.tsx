import { useEffect, useState } from 'react'
import { Dialog, DialogActionsBar } from '@progress/kendo-react-dialogs'
import { adminService } from '../../services/adminService'
import type { AdminUser } from '../../services/adminService'
import { useNotificationStore } from '../../store/notificationStore'
import { roleLabels } from '../../types/auth'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoleMeta {
  key: string
  label: string
  description: string
  isSystem: boolean
}

interface PermRow {
  moduleKey: string
  moduleLabel: string
  view: boolean
  create: boolean
  edit: boolean
  del: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SYSTEM_ROLES: RoleMeta[] = [
  {
    key: 'super-admin',
    label: 'Super Admin',
    description: 'Full system access and administration.',
    isSystem: true,
  },
  {
    key: 'accountant',
    label: 'Accountant',
    description: 'Manages ledger, payables, receivables and reconciliation.',
    isSystem: true,
  },
  {
    key: 'faculty-admin',
    label: 'Faculty Admin',
    description: 'Approves departmental budgets and faculty reports.',
    isSystem: true,
  },
  {
    key: 'employee',
    label: 'Employee',
    description: 'Submits expense claims and views personal payslips.',
    isSystem: true,
  },
  {
    key: 'authorized-viewer',
    label: 'Authorized Viewer',
    description: 'Read-only access to executive summaries and financial snapshots.',
    isSystem: true,
  },
  {
    key: 'auditor',
    label: 'Auditor',
    description: 'Full read access to audit trails, financial data and evidence.',
    isSystem: true,
  },
  {
    key: 'cfo',
    label: 'CFO',
    description: 'Approves budgets and reviews all consolidated financial reports.',
    isSystem: true,
  },
  {
    key: 'customer',
    label: 'Customer',
    description: 'Read-only portal access to own invoices and account statements.',
    isSystem: true,
  },
]

const MODULE_LIST = [
  { key: 'user-management', label: 'User Management' },
  { key: 'system-settings', label: 'System Settings' },
  { key: 'general-ledger', label: 'General Ledger' },
  { key: 'accounts-payable', label: 'Accounts Payable' },
  { key: 'accounts-receivable', label: 'Accounts Receivable' },
  { key: 'bank-reconciliation', label: 'Bank Reconciliation' },
  { key: 'financial-reports', label: 'Financial Reports' },
  { key: 'dept-reports', label: 'Department Reports' },
  { key: 'fa-approvals', label: 'Faculty Approvals' },
  { key: 'expense-claims', label: 'Expense Claims' },
  { key: 'payslips', label: 'Payslips' },
  { key: 'executive-summary', label: 'Executive Summary' },
  { key: 'av-reports', label: 'AV Reports' },
  { key: 'audit-logs', label: 'Audit Logs' },
  { key: 'budget-control', label: 'Budget Control' },
]

// Claim-based default permissions per role
const DEFAULT_PERMS: Record<string, Set<string>> = {
  'super-admin': new Set(
    MODULE_LIST.flatMap((m) => [
      `${m.key}:view`,
      `${m.key}:create`,
      `${m.key}:edit`,
      `${m.key}:delete`,
    ]),
  ),
  accountant: new Set([
    'general-ledger:view', 'general-ledger:create', 'general-ledger:edit',
    'accounts-payable:view', 'accounts-payable:create', 'accounts-payable:edit',
    'accounts-receivable:view', 'accounts-receivable:create', 'accounts-receivable:edit',
    'bank-reconciliation:view', 'bank-reconciliation:create',
    'financial-reports:view',
  ]),
  'faculty-admin': new Set([
    'dept-reports:view', 'dept-reports:create',
    'fa-approvals:view', 'fa-approvals:edit',
    'expense-claims:view',
  ]),
  employee: new Set([
    'expense-claims:view', 'expense-claims:create', 'expense-claims:edit',
    'payslips:view',
  ]),
  'authorized-viewer': new Set([
    'executive-summary:view',
    'av-reports:view',
  ]),
  auditor: new Set([
    'audit-logs:view',
    'general-ledger:view',
    'financial-reports:view',
    'expense-claims:view',
    'payslips:view',
  ]),
  cfo: new Set([
    'financial-reports:view',
    'budget-control:view', 'budget-control:edit',
    'audit-logs:view',
  ]),
  customer: new Set([
    'av-reports:view',
  ]),
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const buildPermRows = (roleKey: string): PermRow[] => {
  const perms = DEFAULT_PERMS[roleKey] ?? new Set<string>()
  return MODULE_LIST.map((m) => ({
    moduleKey: m.key,
    moduleLabel: m.label,
    view: perms.has(`${m.key}:view`),
    create: perms.has(`${m.key}:create`),
    edit: perms.has(`${m.key}:edit`),
    del: perms.has(`${m.key}:delete`),
  }))
}

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'NA'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts.at(-1)?.[0] ?? ''}`.toUpperCase()
}

// ─── Component ────────────────────────────────────────────────────────────────

export const RolesPermissionsModule = () => {
  const pushToast = useNotificationStore((state) => state.push)

  const [tab, setTab] = useState<'define' | 'permissions' | 'report'>('define')

  // Define Roles tab
  const [customRoles, setCustomRoles] = useState<RoleMeta[]>([])
  const [showAddRoleDialog, setShowAddRoleDialog] = useState(false)
  const [newRoleLabel, setNewRoleLabel] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')

  // Permissions tab
  const [selectedPermRole, setSelectedPermRole] = useState<string>('super-admin')
  const [permRows, setPermRows] = useState<PermRow[]>(buildPermRows('super-admin'))
  const [savingPerms, setSavingPerms] = useState(false)
  const [permsDirty, setPermsDirty] = useState(false)

  // Report tab
  const [reportUsers, setReportUsers] = useState<AdminUser[]>([])
  const [loadingReport, setLoadingReport] = useState(false)
  const [reportRoleFilter, setReportRoleFilter] = useState<string>('all')

  const allRoles: RoleMeta[] = [...SYSTEM_ROLES, ...customRoles]

  // Load users when report tab is active
  useEffect(() => {
    if (tab !== 'report') return
    const load = async () => {
      setLoadingReport(true)
      try {
        const users = await adminService.getUsers()
        setReportUsers(users)
      } catch {
        pushToast('error', 'Failed to load user report.')
      } finally {
        setLoadingReport(false)
      }
    }
    void load()
  }, [tab, pushToast])

  // ── Permissions tab handlers ─────────────────────────────────────────────

  const handlePermRoleChange = (roleKey: string) => {
    setSelectedPermRole(roleKey)
    setPermRows(buildPermRows(roleKey))
    setPermsDirty(false)
    // Load persisted permissions from backend and merge over the defaults
    const loadPerms = async () => {
      try {
        const saved = await adminService.getRolePermissions(roleKey)
        if (saved.length > 0) {
          setPermRows(
            MODULE_LIST.map((m) => ({
              moduleKey: m.key,
              moduleLabel: m.label,
              view: saved.includes(`${m.key}:view`),
              create: saved.includes(`${m.key}:create`),
              edit: saved.includes(`${m.key}:edit`),
              del: saved.includes(`${m.key}:delete`),
            })),
          )
        }
      } catch {
        // Non-fatal — keep defaults already set above
      }
    }
    void loadPerms()
  }

  const togglePerm = (idx: number, field: 'view' | 'create' | 'edit' | 'del') => {
    setPermRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: !row[field] } : row)),
    )
    setPermsDirty(true)
  }

  const handleSavePerms = async () => {
    setSavingPerms(true)
    try {
      const permissions = permRows.flatMap((row) => {
        const perms: string[] = []
        if (row.view) perms.push(`${row.moduleKey}:view`)
        if (row.create) perms.push(`${row.moduleKey}:create`)
        if (row.edit) perms.push(`${row.moduleKey}:edit`)
        if (row.del) perms.push(`${row.moduleKey}:delete`)
        return perms
      })
      await adminService.updateRolePermissions(selectedPermRole, permissions)
      setPermsDirty(false)
      pushToast(
        'success',
        `Permissions saved for ${allRoles.find((r) => r.key === selectedPermRole)?.label ?? selectedPermRole}.`,
      )
    } catch {
      pushToast('error', 'Failed to save permissions.')
    } finally {
      setSavingPerms(false)
    }
  }

  // ── Define Roles tab handlers ────────────────────────────────────────────

  const handleAddRole = () => {
    if (!newRoleLabel.trim()) return
    const key = newRoleLabel.trim().toLowerCase().split(/\s+/).join('-')
    if (allRoles.some((r) => r.key === key)) {
      pushToast('warning', 'A role with that name already exists.')
      return
    }
    setCustomRoles((prev) => [
      ...prev,
      {
        key,
        label: newRoleLabel.trim(),
        description: newRoleDesc.trim() || 'Custom role.',
        isSystem: false,
      },
    ])
    setNewRoleLabel('')
    setNewRoleDesc('')
    setShowAddRoleDialog(false)
    pushToast('success', `Role "${newRoleLabel.trim()}" created.`)
  }

  const handleDeleteCustomRole = (key: string) => {
    setCustomRoles((prev) => prev.filter((r) => r.key !== key))
    pushToast('info', 'Custom role removed.')
  }

  const openPermissionsForRole = (roleKey: string) => {
    handlePermRoleChange(roleKey)
    setTab('permissions')
  }

  // ── Report tab helpers ───────────────────────────────────────────────────

  const filteredReportUsers =
    reportRoleFilter === 'all'
      ? reportUsers
      : reportUsers.filter((u) => u.role === reportRoleFilter)

  const roleCounts = allRoles.reduce<Record<string, number>>((acc, r) => {
    acc[r.key] = reportUsers.filter((u) => u.role === r.key).length
    return acc
  }, {})

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="rp-scene">
      {/* Page header */}
      <div className="rp-page-header">
        <h1 className="rp-page-title">Roles &amp; Permissions</h1>
        <p className="rp-page-sub">
          Define roles, assign module-level claim permissions, and view role assignment reports.
        </p>
      </div>

      {/* Tab bar */}
      <div className="rp-tabbar">
        <button
          className={`rp-tab${tab === 'define' ? ' rp-tab-active' : ''}`}
          onClick={() => setTab('define')}
        >
          Define Roles
        </button>
        <button
          className={`rp-tab${tab === 'permissions' ? ' rp-tab-active' : ''}`}
          onClick={() => setTab('permissions')}
        >
          Assign Permissions
        </button>
        <button
          className={`rp-tab${tab === 'report' ? ' rp-tab-active' : ''}`}
          onClick={() => setTab('report')}
        >
          Role Assignment Report
        </button>
      </div>

      {/* ── Tab: Define Roles ─────────────────────────────────────────────── */}
      {tab === 'define' && (
        <div className="rp-card">
          <div className="rp-card-header">
            <div>
              <h2 className="rp-card-title">Role Definitions</h2>
              <p className="rp-card-sub">
                7 system roles are pre-seeded and cannot be deleted. Additional custom roles can be
                created and assigned permissions independently.
              </p>
            </div>
            <button className="rp-btn-primary" onClick={() => setShowAddRoleDialog(true)}>
              + Create Custom Role
            </button>
          </div>

          <table className="rp-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Description</th>
                <th>Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allRoles.map((role) => (
                <tr key={role.key}>
                  <td>
                    <div className="rp-role-cell">
                      <span className="rp-role-name">{role.label}</span>
                    </div>
                  </td>
                  <td className="rp-desc-cell">{role.description}</td>
                  <td>
                    <span
                      className={`rp-type-badge ${role.isSystem ? 'rp-badge-system' : 'rp-badge-custom'}`}
                    >
                      {role.isSystem ? 'System' : 'Custom'}
                    </span>
                  </td>
                  <td>
                    <div className="rp-row-actions">
                      <button
                        className="rp-action-btn"
                        onClick={() => openPermissionsForRole(role.key)}
                      >
                        Permissions
                      </button>
                      {!role.isSystem && (
                        <button
                          className="rp-action-btn rp-action-danger"
                          onClick={() => handleDeleteCustomRole(role.key)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tab: Assign Permissions ───────────────────────────────────────── */}
      {tab === 'permissions' && (
        <div className="rp-card">
          <div className="rp-card-header">
            <div>
              <h2 className="rp-card-title">Assign Permissions</h2>
              <p className="rp-card-sub">
                Toggle module-level access for each role. Each cell represents a claim (e.g.{' '}
                <code className="rp-code">general-ledger:view</code>).
              </p>
            </div>
            <div className="rp-perm-actions">
              <select
                className="rp-select"
                value={selectedPermRole}
                onChange={(e) => handlePermRoleChange(e.target.value)}
              >
                {allRoles.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
              <button
                className="rp-btn-primary"
                disabled={!permsDirty || savingPerms}
                onClick={() => {
                  void handleSavePerms()
                }}
              >
                {savingPerms ? 'Saving…' : 'Save Permissions'}
              </button>
            </div>
          </div>

          <div className="rp-perm-wrap">
            <table className="rp-table rp-perm-table">
              <thead>
                <tr>
                  <th className="rp-module-col">Module</th>
                  <th className="rp-perm-col">View</th>
                  <th className="rp-perm-col">Create</th>
                  <th className="rp-perm-col">Edit</th>
                  <th className="rp-perm-col">Delete</th>
                </tr>
              </thead>
              <tbody>
                {permRows.map((row, idx) => (
                  <tr key={row.moduleKey}>
                    <td className="rp-module-label">{row.moduleLabel}</td>
                    {(['view', 'create', 'edit', 'del'] as const).map((action) => (
                      <td key={action} className="rp-perm-cell">
                        <input
                          type="checkbox"
                          className="rp-checkbox"
                          checked={row[action]}
                          onChange={() => togglePerm(idx, action)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {permsDirty && (
            <p className="rp-unsaved-hint">● Unsaved permission changes — click Save Permissions.</p>
          )}
        </div>
      )}

      {/* ── Tab: Role Assignment Report ───────────────────────────────────── */}
      {tab === 'report' && (
        <div className="rp-card">
          <div className="rp-card-header">
            <div>
              <h2 className="rp-card-title">Role Assignment Report</h2>
              <p className="rp-card-sub">
                All users and their assigned roles. Filter by role to drill in.
              </p>
            </div>
          </div>

          {/* Role filter chips */}
          <div className="rp-filter-row">
            <button
              className={`rp-chip${reportRoleFilter === 'all' ? ' rp-chip-active' : ''}`}
              onClick={() => setReportRoleFilter('all')}
            >
              All <span className="rp-chip-count">{reportUsers.length}</span>
            </button>
            {allRoles.map((r) => (
              <button
                key={r.key}
                className={`rp-chip${reportRoleFilter === r.key ? ' rp-chip-active' : ''}`}
                onClick={() => setReportRoleFilter(r.key)}
              >
                {r.label}
                {(roleCounts[r.key] ?? 0) > 0 && (
                  <span className="rp-chip-count">{roleCounts[r.key]}</span>
                )}
              </button>
            ))}
          </div>

          {loadingReport ? (
            <p className="rp-loading">Loading users…</p>
          ) : (
            <table className="rp-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredReportUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="rp-empty-cell">
                      No users assigned to this role.
                    </td>
                  </tr>
                ) : (
                  filteredReportUsers.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="rp-user-cell">
                          <span className="rp-avatar">{getInitials(u.fullName)}</span>
                          <span>{u.fullName}</span>
                        </div>
                      </td>
                      <td className="rp-muted">{u.email}</td>
                      <td className="rp-muted">{u.department || '—'}</td>
                      <td>
                        <span className="rp-role-pill">
                          {roleLabels[u.role] ?? u.role}
                        </span>
                      </td>
                      <td>
                        <span className={`rp-status-pill rp-status-${u.status}`}>{u.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Add Custom Role dialog ────────────────────────────────────────── */}
      {showAddRoleDialog && (
        <Dialog title="Create Custom Role" onClose={() => setShowAddRoleDialog(false)} width={440}>
          <div className="rp-dialog-body">
            <p className="rp-dialog-sub">
              Custom roles inherit no permissions by default. Go to{' '}
              <strong>Assign Permissions</strong> after creation to configure access.
            </p>

            <label className="rp-label" htmlFor="rp-role-name">
              Role Name <span className="rp-required">*</span>
            </label>
            <input
              id="rp-role-name"
              className="rp-input"
              placeholder="e.g. Budget Reviewer"
              value={newRoleLabel}
              onChange={(e) => setNewRoleLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddRole()}
              autoFocus
            />

            <label className="rp-label" htmlFor="rp-role-desc">Description</label>
            <textarea
              id="rp-role-desc"
              className="rp-textarea"
              placeholder="What does this role do?"
              value={newRoleDesc}
              onChange={(e) => setNewRoleDesc(e.target.value)}
              rows={3}
            />
          </div>
          <DialogActionsBar>
            <button className="rp-btn-ghost" onClick={() => setShowAddRoleDialog(false)}>
              Cancel
            </button>
            <button
              className="rp-btn-primary"
              disabled={!newRoleLabel.trim()}
              onClick={handleAddRole}
            >
              Create Role
            </button>
          </DialogActionsBar>
        </Dialog>
      )}
    </div>
  )
}
