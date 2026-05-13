import { useEffect, useMemo, useState } from 'react'
import { Button } from '@progress/kendo-react-buttons'
import { apiClient } from '../../services/apiClient'
import { useAuthStore } from '../../store/authStore'
import { MyPayslipsPage } from './payroll/MyPayslipsPage'
import { PayrollApprovalPage } from './payroll/PayrollApprovalPage'
import { PayrollOverviewPage } from './payroll/PayrollOverviewPage'
import { PayrollProcessingPage } from './payroll/PayrollProcessingPage'
import { PayPeriodManagementPage } from './payroll/PayPeriodManagementPage'
import type {
  EmployeePayrollDto,
  PayPeriodDto,
  PayrollLineInput,
  PayrollRegisterDto,
  PayrollRunDto,
  PayslipSummaryDto,
} from './payroll/types'

export const PayrollOperationsModule = () => {
  const selectedRole = useAuthStore((state) => state.selectedRole)
  const isAccountant = selectedRole === 'accountant' || selectedRole === 'super-admin'
  const isCfo = selectedRole === 'cfo' || selectedRole === 'super-admin'
  const isEmployee = selectedRole === 'employee' || selectedRole === 'super-admin'

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [activePage, setActivePage] = useState<'overview' | 'periods' | 'processing' | 'approval' | 'payslips'>('overview')
  const [periods, setPeriods] = useState<PayPeriodDto[]>([])
  const [runs, setRuns] = useState<PayrollRunDto[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState('')
  const [employees, setEmployees] = useState<EmployeePayrollDto[]>([])
  const [lines, setLines] = useState<PayrollLineInput[]>([])
  const [run, setRun] = useState<PayrollRunDto | null>(null)

  const [registerRunId, setRegisterRunId] = useState('')
  const [register, setRegister] = useState<PayrollRegisterDto | null>(null)
  const [myPayslips, setMyPayslips] = useState<PayslipSummaryDto[]>([])

  const [createPeriod, setCreatePeriod] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    frequency: 1,
    cutoffDate: '',
    payDate: '',
  })

  const loadPeriods = async () => {
    try {
      const response = await apiClient.get<PayPeriodDto[]>('/payroll/pay-periods')
      setPeriods(response.data)
    } catch {
      setError('Unable to load pay periods.')
    }
  }

  const loadRuns = async () => {
    try {
      const response = await apiClient.get<PayrollRunDto[]>('/payroll/runs')
      setRuns(response.data)
    } catch {
      setError('Unable to load payroll runs.')
    }
  }

  const loadMyPayslips = async () => {
    if (!isEmployee) return
    try {
      const response = await apiClient.get<PayslipSummaryDto[]>('/payroll/payslips/my-payslips')
      setMyPayslips(response.data)
    } catch {
      setError('Unable to load payslips.')
    }
  }

  useEffect(() => {
    void loadPeriods()
    void loadRuns()
    void loadMyPayslips()
  }, [])

  const periodOptions = useMemo(
    () => periods.map((period) => ({
      id: period.id,
      label: `${period.year}-${String(period.month).padStart(2, '0')}`,
    })),
    [periods],
  )

  const loadSetup = async () => {
    if (!selectedPeriodId) return

    setLoading(true)
    setError('')
    try {
      const response = await apiClient.get<{ payPeriodId: string; employees: EmployeePayrollDto[] }>(
        `/payroll/runs/${selectedPeriodId}/setup`,
      )
      const employeesData = response.data.employees
      setEmployees(employeesData)
      setLines(
        employeesData.map((employee) => ({
          employeeId: employee.id,
          employeeName: employee.name,
          regularHours: 0,
          overtimeHours: 0,
          absenceHours: 0,
          otherDeductions: 0,
        })),
      )
    } catch {
      setError('Unable to load payroll setup for selected period.')
    } finally {
      setLoading(false)
    }
  }

  const onCreatePeriod = async () => {
    setLoading(true)
    setError('')
    try {
      await apiClient.post('/payroll/pay-periods', createPeriod)
      await loadPeriods()
      await loadRuns()
    } catch {
      setError('Unable to create pay period.')
    } finally {
      setLoading(false)
    }
  }

  const onCalculate = async () => {
    if (!selectedPeriodId) {
      setError('Select a pay period first.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await apiClient.post<PayrollRunDto>(`/payroll/runs/${selectedPeriodId}/calculate`, {
        lineItems: lines,
      })
      setRun(response.data)
      setRegisterRunId(response.data.id)
      await loadRuns()
    } catch {
      setError('Unable to calculate payroll.')
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async () => {
    if (!run) {
      setError('Calculate payroll first.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await apiClient.post<PayrollRunDto>(`/payroll/runs/${run.id}/submit`)
      setRun(response.data)
      setRegisterRunId(response.data.id)
      await loadRuns()
    } catch {
      setError('Unable to submit payroll.')
    } finally {
      setLoading(false)
    }
  }

  const onPostToGl = async () => {
    if (!run) {
      setError('No payroll run available.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await apiClient.post<PayrollRunDto>(`/payroll/runs/${run.id}/post-to-gl`)
      setRun(response.data)
      await loadRuns()
    } catch {
      setError('Unable to post payroll to GL.')
    } finally {
      setLoading(false)
    }
  }

  const loadRegister = async () => {
    if (!registerRunId) return

    setLoading(true)
    setError('')
    try {
      const response = await apiClient.get<PayrollRegisterDto>(`/payroll/runs/${registerRunId}/register`)
      setRegister(response.data)
    } catch {
      setError('Unable to load payroll register.')
    } finally {
      setLoading(false)
    }
  }

  const onApprove = async () => {
    if (!registerRunId) return
    setLoading(true)
    setError('')
    try {
      await apiClient.post(`/payroll/runs/${registerRunId}/approve`, { approverNotes: '' })
      await loadRuns()
      await loadMyPayslips()
      await loadRegister()
    } catch {
      setError('Unable to approve payroll.')
    } finally {
      setLoading(false)
    }
  }

  const onReject = async () => {
    if (!registerRunId) return
    const reason = window.prompt('Enter rejection reason')
    if (!reason) return

    setLoading(true)
    setError('')
    try {
      await apiClient.post(`/payroll/runs/${registerRunId}/reject`, { rejectionReason: reason })
      await loadRuns()
      await loadRegister()
    } catch {
      setError('Unable to reject payroll.')
    } finally {
      setLoading(false)
    }
  }

  const updateLine = (employeeId: string, field: keyof PayrollLineInput, value: number) => {
    setLines((current) =>
      current.map((line) =>
        line.employeeId === employeeId
          ? {
              ...line,
              [field]: Number.isFinite(value) ? value : 0,
            }
          : line,
      ),
    )
  }

  const onCreatePeriodChange = (field: keyof typeof createPeriod, value: number | string) => {
    setCreatePeriod((current) => ({ ...current, [field]: value }))
  }

  const pageButtons = [
    { key: 'overview', label: 'Overview', visible: true },
    { key: 'periods', label: 'Pay Periods', visible: isAccountant },
    { key: 'processing', label: 'Processing', visible: isAccountant },
    { key: 'approval', label: 'Approval', visible: isCfo },
    { key: 'payslips', label: 'My Payslips', visible: isEmployee },
  ] as const

  return (
    <section className="page-fade-in">
      <article className="card" style={{ marginBottom: '1rem' }}>
        <header className="card-head">
          <h2 className="card-title">Payroll Operations</h2>
          <p className="card-subtitle">Five dedicated pages backed by live payroll records</p>
        </header>

        {error && (
          <p style={{ color: '#9b1c1c', background: '#fee2e2', padding: '0.65rem', borderRadius: '0.5rem' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {pageButtons.filter((button) => button.visible).map((button) => (
            <Button
              key={button.key}
              onClick={() => setActivePage(button.key)}
              fillMode={activePage === button.key ? 'solid' : 'outline'}
            >
              {button.label}
            </Button>
          ))}
        </div>
      </article>

      {activePage === 'overview' && (
        <PayrollOverviewPage periods={periods} runs={runs} />
      )}

      {activePage === 'periods' && isAccountant && (
        <PayPeriodManagementPage
          periods={periods}
          createPeriod={createPeriod}
          loading={loading}
          onCreatePeriodChange={onCreatePeriodChange}
          onCreatePeriod={onCreatePeriod}
          onSelectPeriod={setSelectedPeriodId}
          selectedPeriodId={selectedPeriodId}
        />
      )}

      {activePage === 'processing' && isAccountant && (
        <PayrollProcessingPage
          loading={loading}
          selectedPeriodId={selectedPeriodId}
          periodOptions={periodOptions}
          employees={employees}
          lines={lines}
          run={run}
          onSelectPeriod={setSelectedPeriodId}
          onLoadSetup={loadSetup}
          onUpdateLine={updateLine}
          onCalculate={onCalculate}
          onSubmit={onSubmit}
          onPostToGl={onPostToGl}
        />
      )}

      {activePage === 'approval' && isCfo && (
        <PayrollApprovalPage
          loading={loading}
          runs={runs}
          selectedRunId={registerRunId}
          register={register}
          onSelectRun={setRegisterRunId}
          onLoadRegister={loadRegister}
          onApprove={onApprove}
          onReject={onReject}
        />
      )}

      {activePage === 'payslips' && isEmployee && (
        <MyPayslipsPage
          payslips={myPayslips}
          loading={loading}
          onRefresh={loadMyPayslips}
        />
      )}
    </section>
  )
}
