import { useMemo, useState } from 'react'
import { Button } from '@progress/kendo-react-buttons'
import { Input, TextArea, MaskedTextBox, type InputChangeEvent, type TextAreaChangeEvent } from '@progress/kendo-react-inputs'
import { Dialog, DialogActionsBar } from '@progress/kendo-react-dialogs'
import { Badge } from '@progress/kendo-react-indicators'
import { useAuthStore } from '../../store/authStore'
import { roleLabels, type Role } from '../../types/auth'
import { DashboardCard } from '../../components/DashboardCard'
import { apiClient } from '../../services/apiClient'
import { mockEmployees } from '../../services/mockDashboardData'
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

const ROLES: Role[] = ['accountant', 'faculty-admin', 'employee', 'authorized-viewer', 'auditor', 'cfo']

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

export const UserManagementModule = () => {
  const user = useAuthStore((state) => state.user)
  const selectedRole = useAuthStore((state) => state.selectedRole)
  const pushToast = useNotificationStore((state) => state.push)
  const currentRole = selectedRole || user?.role || 'super-admin'

  const [employees, setEmployees] = useState<Employee[]>(mockEmployees)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [formData, setFormData] = useState<EmployeeFormData>(emptyFormData)
  const [savingUser, setSavingUser] = useState(false)

  const fullName = useMemo(
    () => [formData.firstName, formData.middleName, formData.lastName].filter(Boolean).join(' '),
    [formData.firstName, formData.middleName, formData.lastName],
  )

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
      middleName: splitName.length > 2 ? splitName.slice(1, splitName.length - 1).join(' ') : '',
      lastName: splitName.length > 1 ? splitName[splitName.length - 1] : '',
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

  const validateCreateForm = (): boolean => {
    if (!formData.firstName || !formData.lastName || !formData.birthdate || !formData.address) {
      pushToast('error', 'Please complete all required employee fields.')
      return false
    }

    const computedAge = formData.age === '' ? calculateAge(formData.birthdate) : Number(formData.age)
    if (computedAge < 18) {
      pushToast('error', 'Employee must be at least 18 years old.')
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
      const generatedEmail = `${formData.firstName}.${formData.lastName}`
        .toLowerCase()
        .replace(/\s+/g, '.')
        .concat('@cmnetwork.com')

      const generatedPassword = `CMN!${new Date().getFullYear()}${Math.floor(Math.random() * 900 + 100)}`

      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleName: formData.middleName,
        birthdate: formData.birthdate,
        gender: formData.gender,
        age: Number(formData.age),
        address: formData.address,
        tinNumber: formData.tinNumber,
        sssNumber: formData.sssNumber,
        role: formData.role,
        department: formData.department || null,
        generatedEmail,
        generatedPassword,
      }

      try {
        await apiClient.post('/v1/users', payload)
      } catch {
        // Keep UX flow working in mock mode when API is unavailable.
      }

      const newEmployee: Employee = {
        id: `EMP-${String(employees.length + 1).padStart(3, '0')}`,
        email: generatedEmail,
        fullName,
        department: formData.department || 'Unassigned',
        role: formData.role,
        status: formData.status,
        joinDate: new Date().toISOString().split('T')[0],
      }

      setEmployees((current) => [newEmployee, ...current])
      setShowCreateDialog(false)
      pushToast('success', 'Employee account created successfully.')
    } finally {
      setSavingUser(false)
    }
  }

  const handleSaveEdit = () => {
    if (!selectedEmployee) return

    const updatedFullName = [formData.firstName, formData.middleName, formData.lastName]
      .filter(Boolean)
      .join(' ')

    setEmployees(
      employees.map((emp) =>
        emp.id === selectedEmployee.id
          ? {
              ...emp,
              fullName: updatedFullName || emp.fullName,
              department: formData.department || emp.department,
              role: formData.role,
              status: formData.status,
            }
          : emp,
      ),
    )

    setShowEditDialog(false)
    setSelectedEmployee(null)
    pushToast('success', 'Employee updated successfully.')
  }

  const handleConfirmDelete = () => {
    if (!selectedEmployee) return

    setEmployees(employees.filter((emp) => emp.id !== selectedEmployee.id))
    setShowDeleteConfirm(false)
    setSelectedEmployee(null)
    pushToast('warning', 'Employee account deleted.')
  }

  const activeCount = employees.filter((e) => e.status === 'active').length
  const pendingCount = employees.filter((e) => e.status === 'pending').length

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
            <div className="kpi-value">{activeCount}</div>
            <p className="kpi-subtitle">Employees with access</p>
          </div>
        </DashboardCard>

        <DashboardCard title="Pending Invitations">
          <div className="kpi-card">
            <div className="kpi-title">Awaiting Activation</div>
            <div className="kpi-value">{pendingCount}</div>
            <p className="kpi-subtitle">New hires and transfers</p>
          </div>
        </DashboardCard>

        <DashboardCard title="Total Users">
          <div className="kpi-card">
            <div className="kpi-title">Overall Count</div>
            <div className="kpi-value">{employees.length}</div>
            <p className="kpi-subtitle">Active + Pending + Inactive</p>
          </div>
        </DashboardCard>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <Button themeColor="primary" onClick={handleCreateClick}>
          Create Employee Account
        </Button>
      </div>

      <DashboardCard title="Employee Directory">
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
                <tr key={emp.id}>
                  <td><strong>{emp.fullName}</strong></td>
                  <td>{emp.email}</td>
                  <td>{emp.department}</td>
                  <td>
                    <Badge>{roleLabels[emp.role]}</Badge>
                  </td>
                  <td>
                    <Badge themeColor={emp.status === 'active' ? 'success' : emp.status === 'pending' ? 'warning' : 'warning'}>
                      {emp.status}
                    </Badge>
                  </td>
                  <td>{new Date(emp.joinDate).toLocaleDateString()}</td>
                  <td>
                    <Button size="small" fillMode="flat" onClick={() => handleEditClick(emp)} title="Edit">
                      Edit
                    </Button>
                    <Button size="small" fillMode="flat" onClick={() => handleDeleteClick(emp)} title="Delete">
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardCard>

      {showCreateDialog && (
        <Dialog title="Create Employee Account" onClose={() => setShowCreateDialog(false)}>
          <div style={{ padding: '16px', minWidth: '620px' }}>
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label>First Name</label>
                <Input value={formData.firstName} onChange={(e: InputChangeEvent) => setFormData((current) => ({ ...current, firstName: String(e.target.value) }))} />
              </div>

              <div>
                <label>Middle Name</label>
                <Input value={formData.middleName} onChange={(e: InputChangeEvent) => setFormData((current) => ({ ...current, middleName: String(e.target.value) }))} />
              </div>

              <div>
                <label>Last Name</label>
                <Input value={formData.lastName} onChange={(e: InputChangeEvent) => setFormData((current) => ({ ...current, lastName: String(e.target.value) }))} />
              </div>

              <div>
                <label>Birthdate</label>
                <input
                  type="date"
                  value={formData.birthdate}
                  onChange={(event) => handleBirthdateChange(event.target.value)}
                  className="role-select"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label>Gender</label>
                <select
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
                <label>Age (must be 18+)</label>
                <Input
                  type="number"
                  value={String(formData.age)}
                  onChange={(e: InputChangeEvent) => setFormData((current) => ({ ...current, age: Number(e.target.value) || '' }))}
                />
              </div>

              <div>
                <label>Address</label>
                <TextArea
                  value={formData.address}
                  onChange={(e: TextAreaChangeEvent) => setFormData((current) => ({ ...current, address: String(e.target.value) }))}
                  rows={3}
                />
              </div>

              <div>
                <label>TIN Number</label>
                <MaskedTextBox
                  mask="000-000-000-000"
                  value={formData.tinNumber}
                  onChange={(event) => setFormData((current) => ({ ...current, tinNumber: String(event.target.value) }))}
                />
              </div>

              <div>
                <label>SSS Number</label>
                <MaskedTextBox
                  mask="00-0000000-0"
                  value={formData.sssNumber}
                  onChange={(event) => setFormData((current) => ({ ...current, sssNumber: String(event.target.value) }))}
                />
              </div>

              <div>
                <label>Role Assignment</label>
                <select
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
                <label>Department (optional for non-faculty)</label>
                <Input
                  value={formData.department}
                  onChange={(e: InputChangeEvent) => setFormData((current) => ({ ...current, department: String(e.target.value) }))}
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
              <label>First Name</label>
              <Input value={formData.firstName} onChange={(e: InputChangeEvent) => setFormData((current) => ({ ...current, firstName: String(e.target.value) }))} />
            </div>
            <div>
              <label>Middle Name</label>
              <Input value={formData.middleName} onChange={(e: InputChangeEvent) => setFormData((current) => ({ ...current, middleName: String(e.target.value) }))} />
            </div>
            <div>
              <label>Last Name</label>
              <Input value={formData.lastName} onChange={(e: InputChangeEvent) => setFormData((current) => ({ ...current, lastName: String(e.target.value) }))} />
            </div>
            <div>
              <label>Department</label>
              <Input value={formData.department} onChange={(e: InputChangeEvent) => setFormData((current) => ({ ...current, department: String(e.target.value) }))} />
            </div>
            <div>
              <label>Status</label>
              <select
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
    </section>
  )
}
