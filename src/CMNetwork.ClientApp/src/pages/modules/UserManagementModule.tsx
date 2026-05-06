/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react'
import type { AxiosError } from 'axios'
import { Button } from '@progress/kendo-react-buttons'
import { Input, TextArea, MaskedTextBox, type InputChangeEvent, type TextAreaChangeEvent } from '@progress/kendo-react-inputs'
import { Dialog, DialogActionsBar } from '@progress/kendo-react-dialogs'
import { SvgIcon } from '@progress/kendo-react-common'
import { eyeIcon, eyeSlashIcon } from '@progress/kendo-svg-icons'
import { useAuthStore } from '../../store/authStore'
import { roleLabels, type Role } from '../../types/auth'
import { DashboardCard } from '../../components/DashboardCard'
import { adminService } from '../../services/adminService'
import type { SecurityPolicySettings } from '../../services/adminService'
import { useNotificationStore } from '../../store/notificationStore'

interface Employee {
  id: string
  email: string
  fullName: string
  department: string
  role: Role
  status: 'active' | 'inactive' | 'pending'
  joinDate: string
}

interface EmployeeFormData {
  firstName: string
  middleName: string
  lastName: string
  birthdate: string
  gender: 'Male' | 'Female' | 'Other'
  age: number | ''
  address: string
  tinNumber: string
  sssNumber: string
  department: string
  role: Role
  status: 'active' | 'inactive' | 'pending'
}

interface UserSummary {
  active: number
  pending: number
  total: number
}

interface DirectoryQuery {
  search: string
  role: 'all' | Role
  department: string
  page: number
}

const ROLES: Role[] = ['accountant', 'faculty-admin', 'employee', 'authorized-viewer', 'auditor', 'cfo']
const PAGE_SIZE = 10
const DEFAULT_PASSWORD_POLICY: SecurityPolicySettings['password'] = {
  minLength: 12,
  maxLength: 128,
  blockedTerms: ['password', '123456', '12345678', 'qwerty', 'admin', 'administrator', 'welcome', 'letmein', 'abc123'].join('\n'),
  forbidUserContext: true,
  forbidCompanyName: true,
  expireOnlyOnCompromise: true,
  allowUnicode: true,
  requireUppercase: false,
  requireLowercase: false,
  requireNumbers: false,
  requireSymbols: false,
  preventReuse: 0,
}

const emptyFormData: EmployeeFormData = {
  firstName: '',
  middleName: '',
  lastName: '',
  birthdate: '',
  gender: 'Male',
  age: '',
  address: '',
  tinNumber: '',
  sssNumber: '',
  department: '',
  role: 'employee',
  status: 'active',
}

const calculateAge = (birthdate: string): number => {
  if (!birthdate) {
    return 0
  }

  const today = new Date()
  const birth = new Date(birthdate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDifference = today.getMonth() - birth.getMonth()

  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birth.getDate())) {
    age -= 1
  }

  return age
}

const isValidBirthdate = (birthdate: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
    return false
  }

  const [year, month, day] = birthdate.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)

  return parsed.getFullYear() === year
    && parsed.getMonth() === month - 1
    && parsed.getDate() === day
}

const isSuperAdminRole = (role: string) => role === 'super-admin'

const getStatusClassName = (status: Employee['status']) => `um-status-pill ${status}`

const statusTooltips: Record<Employee['status'], string> = {
  active: 'Active - user can sign in and access permitted modules.',
  pending: 'Pending - account created but awaiting first sign-in or activation.',
  inactive: 'Inactive - account is disabled and cannot sign in.',
}

const getStatusTooltip = (status: Employee['status']) => statusTooltips[status]

const getRoleLabel = (role: Role) => roleLabels[role] ?? 'Unassigned'

interface UserDirectoryRowProps {
  employee: Employee
  onEdit: (employee: Employee) => void
  onPassword: (employee: Employee) => void
  onUnlock: (employee: Employee) => void
  onDelete: (employee: Employee) => void
}

const UserDirectoryRow = ({ employee, onEdit, onPassword, onUnlock, onDelete }: UserDirectoryRowProps) => {
  const roleLabel = getRoleLabel(employee.role)
  const passwordChangeDisabled = isSuperAdminRole(employee.role)
  const passwordActionTitle = passwordChangeDisabled
    ? 'Superadmin passwords cannot be changed here'
    : 'Change Password'

  return (
    <tr>
      <td>
        <div className="um-user-cell">
          <span className="um-avatar">{getInitials(employee.fullName)}</span>
          <strong>{employee.fullName}</strong>
        </div>
      </td>
      <td>{employee.email}</td>
      <td>{employee.department || 'Unassigned'}</td>
      <td>
        <span
          className="um-role-badge-content"
          data-tooltip={`Role: ${roleLabel}. Determines which modules and approvals ${employee.fullName} can access.`}
        >
          <span>{roleLabel}</span>
        </span>
      </td>
      <td>
        <span
          className={getStatusClassName(employee.status)}
          data-tooltip={getStatusTooltip(employee.status)}
        >
          {employee.status}
        </span>
      </td>
      <td>{new Date(employee.joinDate).toLocaleDateString()}</td>
      <td>
        <Button size="small" fillMode="flat" onClick={() => onEdit(employee)} title="Edit">
          Edit
        </Button>
        <Button
          size="small"
          fillMode="flat"
          onClick={() => onPassword(employee)}
          title={passwordActionTitle}
          disabled={passwordChangeDisabled}
        >
          Change Password
        </Button>
        <Button
          size="small"
          fillMode="flat"
          onClick={() => onUnlock(employee)}
          title="Unlock account (clear lockout)"
        >
          Unlock
        </Button>
        <Button size="small" fillMode="flat" onClick={() => onDelete(employee)} title="Delete">
          Delete
        </Button>
      </td>
    </tr>
  )
}

interface PasswordResetDialogProps {
  employee: Employee | null
  isOpen: boolean
  passwordForm: { newPassword: string; confirmPassword: string }
  passwordPolicy: SecurityPolicySettings['password']
  passwordIssues: string[]
  showNewPassword: boolean
  showConfirmPassword: boolean
  savingPassword: boolean
  onNewPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onToggleNewPassword: () => void
  onToggleConfirmPassword: () => void
  onSave: () => void
  onClose: () => void
}

const PasswordResetDialog = ({
  employee,
  isOpen,
  passwordForm,
  passwordPolicy,
  passwordIssues,
  showNewPassword,
  showConfirmPassword,
  savingPassword,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onToggleNewPassword,
  onToggleConfirmPassword,
  onSave,
  onClose,
}: PasswordResetDialogProps) => {
  if (!isOpen || !employee) {
    return null
  }

  const passwordFeedbackClass = passwordIssues.length === 0 ? 'is-ok' : 'is-warn'
  const passwordFeedbackText = passwordIssues.length === 0
    ? 'Password follows the current policy.'
    : passwordIssues.join(' ')

  return (
    <Dialog title={`Change Password - ${employee.fullName}`} onClose={onClose}>
      <div style={{ padding: '16px', minWidth: '420px', display: 'grid', gap: '16px' }}>
        <div>
          <label htmlFor="password-reset-email">Email</label>
          <Input id="password-reset-email" value={employee.email} disabled />
        </div>
        <div className="um-password-policy-card">
          <strong>Password policy</strong>
          <ul className="um-password-policy-list">
            <li>{passwordPolicy.minLength}-{passwordPolicy.maxLength} characters</li>
            <li>No mandatory uppercase, number, or symbol rules</li>
            <li>All standard ASCII and Unicode characters are allowed</li>
            <li>Weak, common, company, and user-context terms are blocked</li>
            <li>No scheduled password expiration unless compromise is suspected</li>
          </ul>
        </div>
        <div>
          <label htmlFor="password-reset-new">New Password</label>
          <div className="um-password-input-wrap">
            <Input
              id="password-reset-new"
              className="um-password-input"
              type={showNewPassword ? 'text' : 'password'}
              value={passwordForm.newPassword}
              onChange={(e: InputChangeEvent) => onNewPasswordChange(String(e.value ?? ''))}
            />
            <button
              className="um-password-toggle"
              type="button"
              aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              title={showNewPassword ? 'Hide password' : 'Show password'}
              onClick={onToggleNewPassword}
            >
              <SvgIcon icon={showNewPassword ? eyeSlashIcon : eyeIcon} />
            </button>
          </div>
          {passwordForm.newPassword.length > 0 && (
            <div className={`um-password-feedback ${passwordFeedbackClass}`}>
              {passwordFeedbackText}
            </div>
          )}
        </div>
        <div>
          <label htmlFor="password-reset-confirm">Confirm Password</label>
          <div className="um-password-input-wrap">
            <Input
              id="password-reset-confirm"
              className="um-password-input"
              type={showConfirmPassword ? 'text' : 'password'}
              value={passwordForm.confirmPassword}
              onChange={(e: InputChangeEvent) => onConfirmPasswordChange(String(e.value ?? ''))}
            />
            <button
              className="um-password-toggle"
              type="button"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              title={showConfirmPassword ? 'Hide password' : 'Show password'}
              onClick={onToggleConfirmPassword}
            >
              <SvgIcon icon={showConfirmPassword ? eyeSlashIcon : eyeIcon} />
            </button>
          </div>
        </div>
      </div>
      <DialogActionsBar>
        <Button themeColor="primary" onClick={onSave} disabled={savingPassword}>
          {savingPassword ? 'Saving...' : 'Update Password'}
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActionsBar>
    </Dialog>
  )
}

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return 'NA'
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0] ?? ''}${parts.at(-1)?.[0] ?? ''}`.toUpperCase()
}

const getErrorMessage = (error: unknown, fallback: string) => {
  const responseMessage = (error as AxiosError<{ message?: string }>)?.response?.data?.message
  return typeof responseMessage === 'string' && responseMessage.trim().length > 0
    ? responseMessage
    : fallback
}

const splitPasswordTerms = (value?: string) => (value ?? DEFAULT_PASSWORD_POLICY.blockedTerms)
  .split(/[\r\n,;]+/)
  .map((term) => term.trim().toLowerCase())
  .filter((term) => term.length >= 3)

const getPasswordPolicyIssues = (
  password: string,
  employee: Employee | null,
  policy: SecurityPolicySettings['password'],
) => {
  const issues: string[] = []
  const normalized = password.toLowerCase()

  if (password.length < policy.minLength) {
    issues.push(`Use at least ${policy.minLength} characters.`)
  }

  if (password.length > policy.maxLength) {
    issues.push(`Use no more than ${policy.maxLength} characters.`)
  }

  if (splitPasswordTerms(policy.blockedTerms).some((term) => normalized.includes(term))) {
    issues.push('Avoid common, compromised, or dictionary-style words.')
  }

  if (policy.forbidCompanyName && normalized.includes('cmnetwork')) {
    issues.push('Do not include the company name.')
  }

  if (policy.forbidUserContext && employee) {
    const contextualTerms = [
      employee.email,
      employee.email.split('@')[0],
      ...employee.fullName.split(/\s+/),
    ]
      .flatMap((term) => term.split(/[@._\-\s]+/))
      .map((term) => term.trim().toLowerCase())
      .filter((term) => term.length >= 3)

    if (contextualTerms.some((term) => normalized.includes(term))) {
      issues.push('Do not include the user name, username, or email terms.')
    }
  }

  return issues
}

const getCreateFormValidationError = (formData: EmployeeFormData) => {
  const missingFields: string[] = []

  if (!formData.firstName.trim()) {
    missingFields.push('First Name')
  }

  if (!formData.lastName.trim()) {
    missingFields.push('Last Name')
  }

  if (!formData.birthdate.trim()) {
    missingFields.push('Birthdate')
  }

  if (!formData.address.trim()) {
    missingFields.push('Address')
  }

  if (missingFields.length > 0) {
    return `Please complete required field(s): ${missingFields.join(', ')}.`
  }

  if (!isValidBirthdate(formData.birthdate)) {
    return 'Please enter a valid birthdate.'
  }

  const computedAge = formData.age === '' ? calculateAge(formData.birthdate) : Number(formData.age)
  if (computedAge < 18) {
    return 'Employee must be at least 18 years old.'
  }

  return null
}

const getUserSummary = (users: Employee[]): UserSummary => ({
  active: users.filter((employee) => employee.status === 'active').length,
  pending: users.filter((employee) => employee.status === 'pending').length,
  total: users.length,
})

export const UserManagementModule = () => {
  const user = useAuthStore((state) => state.user)
  const selectedRole = useAuthStore((state) => state.selectedRole)
  const pushToast = useNotificationStore((state) => state.push)
  const currentRole = selectedRole || user?.role || 'super-admin'

  const [employees, setEmployees] = useState<Employee[]>([])
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [formData, setFormData] = useState<EmployeeFormData>(emptyFormData)
  const [savingUser, setSavingUser] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' })
  const [passwordPolicy, setPasswordPolicy] = useState<SecurityPolicySettings['password']>(DEFAULT_PASSWORD_POLICY)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [directoryDepartments, setDirectoryDepartments] = useState<string[]>([])
  const [userSummary, setUserSummary] = useState<UserSummary>({ active: 0, pending: 0, total: 0 })
  const currentPasswordIssues = getPasswordPolicyIssues(passwordForm.newPassword, selectedEmployee, passwordPolicy)

  const loadUserSummary = async () => {
    try {
      const users = await adminService.getUsers()
      setUserSummary(getUserSummary(users))
      setDirectoryDepartments(
        [...new Set(users.map((item) => item.department))]
          .filter((value) => value && value.trim().length > 0)
          .sort((a, b) => a.localeCompare(b)),
      )
    } catch {
      pushToast('error', 'Failed to load user totals.')
    }
  }

  const loadPasswordPolicy = async () => {
    try {
      const settings = await adminService.getSecurityPolicySettings()
      setPasswordPolicy(settings.password)
    } catch {
      setPasswordPolicy(DEFAULT_PASSWORD_POLICY)
    }
  }

  const loadUsers = async (query?: Partial<DirectoryQuery>) => {
    const nextSearch = query?.search ?? searchTerm
    const nextRole = query?.role ?? roleFilter
    const nextDepartment = query?.department ?? departmentFilter
    const nextPage = query?.page ?? page

    try {
      setLoadingUsers(true)
      const response = await adminService.getUsersPaged({
        search: nextSearch.trim().length > 0 ? nextSearch.trim() : undefined,
        role: nextRole === 'all' ? undefined : nextRole,
        department: nextDepartment === 'all' ? undefined : nextDepartment,
        page: nextPage,
        pageSize: PAGE_SIZE,
      })

      setEmployees(response.items)
      setTotalCount(response.totalCount)
      setDirectoryDepartments((current) => {
        const merged = [...new Set([...current, ...response.items.map((item) => item.department)])]
        return merged.filter((value) => value && value.trim().length > 0).sort((a, b) => a.localeCompare(b))
      })
    } catch {
      pushToast('error', 'Failed to load users.')
    } finally {
      setLoadingUsers(false)
    }
  }

  const resetDirectoryFilters = () => {
    setSearchTerm('')
    setRoleFilter('all')
    setDepartmentFilter('all')
    setPage(1)
  }

  useEffect(() => {
    void loadUsers()
  }, [departmentFilter, page, roleFilter, searchTerm])

  useEffect(() => {
    void loadUserSummary()
    void loadPasswordPolicy()
  }, [])

  const handleCreateClick = () => {
    setFormData(emptyFormData)
    setShowCreateDialog(true)
  }

  const handleEditClick = (emp: Employee) => {
    const splitName = emp.fullName.split(' ')
    setSelectedEmployee(emp)
    setFormData({
      ...emptyFormData,
      firstName: splitName[0] || '',
      middleName: splitName.length > 2 ? splitName.slice(1, -1).join(' ') : '',
      lastName: splitName.length > 1 ? (splitName.at(-1) ?? '') : '',
      department: emp.department,
      role: emp.role,
      status: emp.status,
    })
    setShowEditDialog(true)
  }

  const handleDeleteClick = (emp: Employee) => {
    setSelectedEmployee(emp)
    setShowDeleteConfirm(true)
  }

  const handlePasswordClick = (emp: Employee) => {
    if (isSuperAdminRole(emp.role)) {
      pushToast('warning', 'Superadmin passwords cannot be changed here.')
      return
    }

    setSelectedEmployee(emp)
    setPasswordForm({ newPassword: '', confirmPassword: '' })
    setShowNewPassword(false)
    setShowConfirmPassword(false)
    setShowPasswordDialog(true)
  }

  const handleUnlockClick = async (emp: Employee) => {
    try {
      await adminService.unlockUser(emp.id)
      pushToast('success', `Account unlocked for ${emp.fullName}.`)
    } catch {
      pushToast('error', `Failed to unlock account for ${emp.fullName}.`)
    }
  }

  const validateCreateForm = (): boolean => {
    const validationError = getCreateFormValidationError(formData)
    if (validationError) {
      pushToast('error', validationError)
      return false
    }

    return true
  }

  const handleBirthdateChange = (value: string) => {
    const computedAge = calculateAge(value)
    setFormData((current) => ({
      ...current,
      birthdate: value,
      age: computedAge || '',
    }))
  }

  const handleSaveCreate = async () => {
    if (!validateCreateForm()) {
      return
    }

    setSavingUser(true)

    try {
      const computedAge = formData.age === '' ? calculateAge(formData.birthdate) : Number(formData.age)

      const generatedEmail = `${formData.firstName}.${formData.lastName}`
        .toLowerCase()
        .replaceAll(' ', '.')
        .concat('@cmnetwork.com')

      const generatedPassword = `harbor-slate-lumen-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 100)}`

      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleName: formData.middleName,
        birthdate: formData.birthdate,
        gender: formData.gender,
        age: computedAge,
        address: formData.address,
        tinNumber: formData.tinNumber,
        sssNumber: formData.sssNumber,
        role: formData.role,
        department: formData.department || null,
        generatedEmail,
        generatedPassword,
      }

      await adminService.createUser(payload)
      await Promise.all([loadUsers(), loadUserSummary()])
      setShowCreateDialog(false)
      pushToast('success', `Employee account created successfully. Login email: ${generatedEmail}`)
    } catch (error) {
      pushToast('error', getErrorMessage(error, 'Unable to create employee account.'))
    } finally {
      setSavingUser(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!selectedEmployee) return

    try {
      await adminService.updateUser(selectedEmployee.id, {
        firstName: formData.firstName,
        middleName: formData.middleName,
        lastName: formData.lastName,
        department: formData.department || null,
        role: formData.role,
        status: formData.status,
      })

      await Promise.all([loadUsers(), loadUserSummary()])
      setShowEditDialog(false)
      setSelectedEmployee(null)
      pushToast('success', 'Employee updated successfully.')
    } catch {
      pushToast('error', 'Unable to update employee account.')
    }
  }

  const handleSavePassword = async () => {
    if (!selectedEmployee) return

    if (currentPasswordIssues.length > 0) {
      pushToast('error', currentPasswordIssues.join(' '))
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      pushToast('error', 'Passwords do not match.')
      return
    }

    setSavingPassword(true)

    try {
      await adminService.resetUserPassword(selectedEmployee.id, { newPassword: passwordForm.newPassword })
      resetDirectoryFilters()
      await Promise.all([
        loadUsers({ search: '', role: 'all', department: 'all', page: 1 }),
        loadUserSummary(),
      ])
      setShowPasswordDialog(false)
      setSelectedEmployee(null)
      setPasswordForm({ newPassword: '', confirmPassword: '' })
      setShowNewPassword(false)
      setShowConfirmPassword(false)
      pushToast('success', `Password updated for ${selectedEmployee.fullName}.`)
    } catch (error) {
      pushToast('error', getErrorMessage(error, 'Unable to update user password.'))
    } finally {
      setSavingPassword(false)
    }
  }

  const handleClosePasswordDialog = () => {
    setShowPasswordDialog(false)
    setShowNewPassword(false)
    setShowConfirmPassword(false)
    setPasswordForm({ newPassword: '', confirmPassword: '' })
  }

  const handleConfirmDelete = async () => {
    if (!selectedEmployee) return

    try {
      await adminService.deleteUser(selectedEmployee.id)
      await Promise.all([loadUsers(), loadUserSummary()])
      setShowDeleteConfirm(false)
      setSelectedEmployee(null)
      pushToast('warning', 'Employee account deleted.')
    } catch {
      pushToast('error', 'Unable to delete employee account.')
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const startRow = totalCount === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const endRow = Math.min(safePage * PAGE_SIZE, totalCount)
  const hasDirectoryFilters = searchTerm.trim().length > 0 || roleFilter !== 'all' || departmentFilter !== 'all'
  const filteredResultLabel = totalCount === 1 ? ' filtered result' : ' filtered results'
  const paginationFilterLabel = hasDirectoryFilters ? filteredResultLabel : ''
  const emptyUsersMessage = loadingUsers ? 'Loading users...' : 'No users match your search and filters.'

  useEffect(() => {
    setPage(1)
  }, [departmentFilter, roleFilter, searchTerm])

  return (
    <section style={{ padding: '0' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 className="page-title">
          Welcome, {user?.fullName} - {roleLabels[currentRole]} Dashboard
        </h1>
      </div>

      <div className="dashboard-grid cols-3" style={{ marginBottom: '24px' }}>
        <DashboardCard title="Active Users">
          <div className="kpi-card">
            <div className="kpi-title">Total Active</div>
            <div className="kpi-value">{userSummary.active}</div>
            <p className="kpi-subtitle">Employees with access</p>
          </div>
        </DashboardCard>

        <DashboardCard title="Pending Invitations">
          <div className="kpi-card">
            <div className="kpi-title">Awaiting Activation</div>
            <div className="kpi-value">{userSummary.pending}</div>
            <p className="kpi-subtitle">New hires and transfers</p>
          </div>
        </DashboardCard>

        <DashboardCard title="Total Users">
          <div className="kpi-card">
            <div className="kpi-title">Overall Count</div>
            <div className="kpi-value">{userSummary.total}</div>
            <p className="kpi-subtitle">Active + Pending + Inactive</p>
          </div>
        </DashboardCard>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <Button themeColor="primary" className="um-create-btn" onClick={handleCreateClick}>
          Create Employee Account
        </Button>
      </div>

      <DashboardCard title="Employee Directory">
        <div className="um-toolbar">
          <Input
            value={searchTerm}
            onChange={(event: InputChangeEvent) => setSearchTerm(String(event.value ?? ''))}
            placeholder="Search by name or email"
            className="um-search"
          />
          <select
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
            className="role-select um-filter"
          >
            <option value="all">Filter by Department</option>
            {directoryDepartments.map((department) => (
              <option key={department} value={department}>{department}</option>
            ))}
          </select>
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as 'all' | Role)}
            className="role-select um-filter"
          >
            <option value="all">Filter by Role</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>{roleLabels[role]}</option>
            ))}
          </select>
        </div>

        {hasDirectoryFilters && (
          <div className="um-filter-status">
            <span>{totalCount} matching {totalCount === 1 ? 'user' : 'users'} from {userSummary.total} total users</span>
            <Button size="small" fillMode="flat" onClick={resetDirectoryFilters}>Clear filters</Button>
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Role</th>
                <th>Status</th>
                <th>Join Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <UserDirectoryRow
                  key={emp.id}
                  employee={emp}
                  onEdit={handleEditClick}
                  onPassword={handlePasswordClick}
                  onUnlock={handleUnlockClick}
                  onDelete={handleDeleteClick}
                />
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={7} className="um-empty-state">
                    {emptyUsersMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="um-pagination">
          <span>
            Showing {startRow}-{endRow} of {totalCount}{paginationFilterLabel}
          </span>
          <div className="um-pagination-actions">
            <Button size="small" fillMode="outline" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              Previous
            </Button>
            <span className="um-page-label">Page {safePage} of {totalPages}</span>
            <Button size="small" fillMode="outline" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
              Next
            </Button>
          </div>
        </div>
      </DashboardCard>

      {showCreateDialog && (
        <Dialog title="Create Employee Account" onClose={() => setShowCreateDialog(false)}>
          <div
            style={{
              padding: '16px',
              width: 'min(620px, 92vw)',
              maxHeight: 'calc(100vh - 220px)',
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            <div style={{ display: 'grid', gap: '16px', paddingRight: '4px' }}>
              <div>
                <label htmlFor="create-first-name">First Name</label>
                <Input id="create-first-name" value={formData.firstName} onChange={(e: InputChangeEvent) => setFormData((current) => ({ ...current, firstName: String(e.value ?? '') }))} />
              </div>

              <div>
                <label htmlFor="create-middle-name">Middle Name</label>
                <Input id="create-middle-name" value={formData.middleName} onChange={(e: InputChangeEvent) => setFormData((current) => ({ ...current, middleName: String(e.value ?? '') }))} />
              </div>

              <div>
                <label htmlFor="create-last-name">Last Name</label>
                <Input id="create-last-name" value={formData.lastName} onChange={(e: InputChangeEvent) => setFormData((current) => ({ ...current, lastName: String(e.value ?? '') }))} />
              </div>

              <div>
                <label htmlFor="create-birthdate">Birthdate</label>
                <input
                  id="create-birthdate"
                  type="date"
                  value={formData.birthdate}
                  onChange={(event) => handleBirthdateChange(event.target.value)}
                  className="role-select"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label htmlFor="create-gender">Gender</label>
                <select
                  id="create-gender"
                  value={formData.gender}
                  onChange={(event) => setFormData((current) => ({ ...current, gender: event.target.value as EmployeeFormData['gender'] }))}
                  className="role-select"
                  style={{ width: '100%' }}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="create-age">Age (must be 18+)</label>
                <Input
                  id="create-age"
                  type="number"
                  value={String(formData.age)}
                  onChange={(e: InputChangeEvent) => setFormData((current) => ({ ...current, age: Number(e.value) || '' }))}
                />
              </div>

              <div>
                <label htmlFor="create-address">Address</label>
                <TextArea
                  id="create-address"
                  value={formData.address}
                  onChange={(e: TextAreaChangeEvent) => setFormData((current) => ({ ...current, address: String(e.value ?? '') }))}
                  rows={3}
                />
              </div>

              <div>
                <label htmlFor="create-tin">TIN Number</label>
                <MaskedTextBox
                  id="create-tin"
                  mask="000-000-000-000"
                  value={formData.tinNumber}
                  onChange={(event) => setFormData((current) => ({ ...current, tinNumber: String(event.value ?? '') }))}
                />
              </div>

              <div>
                <label htmlFor="create-sss">SSS Number</label>
                <MaskedTextBox
                  id="create-sss"
                  mask="00-0000000-0"
                  value={formData.sssNumber}
                  onChange={(event) => setFormData((current) => ({ ...current, sssNumber: String(event.value ?? '') }))}
                />
              </div>

              <div>
                <label htmlFor="create-role">Role Assignment</label>
                <select
                  id="create-role"
                  value={formData.role}
                  onChange={(event) => setFormData((current) => ({ ...current, role: event.target.value as Role }))}
                  className="role-select"
                  style={{ width: '100%' }}
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>{roleLabels[role]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="create-department">Department (optional for non-faculty)</label>
                <Input
                  id="create-department"
                  value={formData.department}
                  onChange={(e: InputChangeEvent) => setFormData((current) => ({ ...current, department: String(e.value ?? '') }))}
                />
              </div>
            </div>
          </div>
          <DialogActionsBar>
            <Button themeColor="primary" onClick={handleSaveCreate} disabled={savingUser}>
              {savingUser ? 'Saving...' : 'Save Employee'}
            </Button>
            <Button onClick={() => setShowCreateDialog(false)}>Cancel</Button>
          </DialogActionsBar>
        </Dialog>
      )}

      {showEditDialog && selectedEmployee && (
        <Dialog title={`Edit User - ${selectedEmployee.fullName}`} onClose={() => setShowEditDialog(false)}>
          <div style={{ padding: '16px', minWidth: '480px', display: 'grid', gap: '16px' }}>
            <div>
              <label htmlFor="edit-first-name">First Name</label>
              <Input id="edit-first-name" value={formData.firstName} onChange={(e: InputChangeEvent) => setFormData((current) => ({ ...current, firstName: String(e.value ?? '') }))} />
            </div>
            <div>
              <label htmlFor="edit-middle-name">Middle Name</label>
              <Input id="edit-middle-name" value={formData.middleName} onChange={(e: InputChangeEvent) => setFormData((current) => ({ ...current, middleName: String(e.value ?? '') }))} />
            </div>
            <div>
              <label htmlFor="edit-last-name">Last Name</label>
              <Input id="edit-last-name" value={formData.lastName} onChange={(e: InputChangeEvent) => setFormData((current) => ({ ...current, lastName: String(e.value ?? '') }))} />
            </div>
            <div>
              <label htmlFor="edit-department">Department</label>
              <Input id="edit-department" value={formData.department} onChange={(e: InputChangeEvent) => setFormData((current) => ({ ...current, department: String(e.value ?? '') }))} />
            </div>
            <div>
              <label htmlFor="edit-status">Status</label>
              <select
                id="edit-status"
                value={formData.status}
                onChange={(event) => setFormData((current) => ({ ...current, status: event.target.value as EmployeeFormData['status'] }))}
                className="role-select"
                style={{ width: '100%' }}
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <DialogActionsBar>
            <Button themeColor="primary" onClick={handleSaveEdit}>Save Changes</Button>
            <Button onClick={() => setShowEditDialog(false)}>Cancel</Button>
          </DialogActionsBar>
        </Dialog>
      )}

      {showDeleteConfirm && selectedEmployee && (
        <Dialog title="Confirm Delete" onClose={() => setShowDeleteConfirm(false)}>
          <div style={{ padding: '16px' }}>
            <p>Are you sure you want to delete <strong>{selectedEmployee.fullName}</strong>?</p>
          </div>
          <DialogActionsBar>
            <Button themeColor="error" onClick={handleConfirmDelete}>Delete User</Button>
            <Button onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
          </DialogActionsBar>
        </Dialog>
      )}

      <PasswordResetDialog
        employee={selectedEmployee}
        isOpen={showPasswordDialog}
        passwordForm={passwordForm}
        passwordPolicy={passwordPolicy}
        passwordIssues={currentPasswordIssues}
        showNewPassword={showNewPassword}
        showConfirmPassword={showConfirmPassword}
        savingPassword={savingPassword}
        onNewPasswordChange={(value) => setPasswordForm((current) => ({ ...current, newPassword: value }))}
        onConfirmPasswordChange={(value) => setPasswordForm((current) => ({ ...current, confirmPassword: value }))}
        onToggleNewPassword={() => setShowNewPassword((current) => !current)}
        onToggleConfirmPassword={() => setShowConfirmPassword((current) => !current)}
        onSave={handleSavePassword}
        onClose={handleClosePasswordDialog}
      />
    </section>
  )
}
