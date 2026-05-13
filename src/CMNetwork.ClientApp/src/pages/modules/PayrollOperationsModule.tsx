import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@progress/kendo-react-buttons'
import { apiClient } from '../../services/apiClient'
import { useAuthStore } from '../../store/authStore'
import { useNotificationStore } from '../../store/notificationStore'
import { extractApiError } from '../../utils/errorUtils'
import { MyPayslipsPage } from './payroll/MyPayslipsPage'
import { PayrollApprovalPage } from './payroll/PayrollApprovalPage'
import { payrollFaqItems, payrollWalkthroughSteps } from './payroll/helpContent'
import type { PayrollHelpRole } from './payroll/helpContent'
import { PayrollOverviewPage } from './payroll/PayrollOverviewPage'
import { PayrollProcessingPage } from './payroll/PayrollProcessingPage'
import { PayPeriodManagementPage } from './payroll/PayPeriodManagementPage'
import type {
  EmployeePayrollDto,
  PayPeriodDto,
  PayrollLineInput,
  PayrollIntegrationCapabilitiesDto,
  PayrollRegisterDto,
  PayrollRunDto,
  PayslipSummaryDto,
} from './payroll/types'

export const PayrollOperationsModule = () => {
  const selectedRole = useAuthStore((state) => state.selectedRole)
  const pushToast = useNotificationStore((state) => state.push)
  const isAccountant = selectedRole === 'accountant' || selectedRole === 'super-admin'
  const isCfo = selectedRole === 'cfo' || selectedRole === 'super-admin'
  const isEmployee = selectedRole === 'employee' || selectedRole === 'super-admin'

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)
  const [walkthroughOpen, setWalkthroughOpen] = useState(false)
  const [helpQuery, setHelpQuery] = useState('')

  const [activePage, setActivePage] = useState<'overview' | 'periods' | 'processing' | 'approval' | 'payslips'>('overview')
  const [periods, setPeriods] = useState<PayPeriodDto[]>([])
  const [runs, setRuns] = useState<PayrollRunDto[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState('')
  const [employees, setEmployees] = useState<EmployeePayrollDto[]>([])
  const [lines, setLines] = useState<PayrollLineInput[]>([])
  const [run, setRun] = useState<PayrollRunDto | null>(null)
  const [capabilities, setCapabilities] = useState<PayrollIntegrationCapabilitiesDto | null>(null)

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

  const loadPeriods = useCallback(async () => {
    try {
      const response = await apiClient.get<PayPeriodDto[]>('/payroll/pay-periods')
      setPeriods(response.data)
    } catch (error) {
      const message = extractApiError(error, 'Unable to load pay periods.')
      setError(message)
      pushToast('error', message)
    }
  }, [pushToast])

  const loadRuns = useCallback(async () => {
    try {
      const response = await apiClient.get<PayrollRunDto[]>('/payroll/runs')
      setRuns(response.data)
    } catch (error) {
      const message = extractApiError(error, 'Unable to load payroll runs.')
      setError(message)
      pushToast('error', message)
    }
  }, [pushToast])

  const loadCapabilities = useCallback(async () => {
    if (!isAccountant && !isCfo) return

    try {
      const response = await apiClient.get<PayrollIntegrationCapabilitiesDto>('/payroll/integration-capabilities')
      setCapabilities(response.data)
    } catch (error) {
      const message = extractApiError(error, 'Unable to load payroll integration capabilities.')
      setError(message)
      pushToast('error', message)
    }
  }, [isAccountant, isCfo, pushToast])

  const loadMyPayslips = useCallback(async () => {
    if (!isEmployee) return
    try {
      const response = await apiClient.get<PayslipSummaryDto[]>('/payroll/payslips/my-payslips')
      setMyPayslips(response.data)
    } catch (error) {
      const message = extractApiError(error, 'Unable to load payslips.')
      setError(message)
      pushToast('error', message)
    }
  }, [isEmployee, pushToast])

  useEffect(() => {
    void loadPeriods()
    void loadRuns()
    void loadMyPayslips()
    void loadCapabilities()
  }, [loadCapabilities, loadMyPayslips, loadPeriods, loadRuns])

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
    } catch (error) {
      const message = extractApiError(error, 'Unable to load payroll setup for selected period.')
      setError(message)
      pushToast('error', message)
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
      pushToast('success', 'Pay period created successfully.')
    } catch (error) {
      const message = extractApiError(error, 'Unable to create pay period.')
      setError(message)
      pushToast('error', message)
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
      pushToast('success', 'Payroll calculated. Review totals before submitting.')
    } catch (error) {
      const message = extractApiError(error, 'Unable to calculate payroll.')
      setError(message)
      pushToast('error', message)
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
      pushToast('success', 'Payroll submitted. CFO can now approve or reject this run.')
    } catch (error) {
      const message = extractApiError(error, 'Unable to submit payroll.')
      setError(message)
      pushToast('error', message)
    } finally {
      setLoading(false)
    }
  }

  const onWithdraw = async () => {
    if (!run) {
      setError('No payroll run available.')
      return
    }

    const note = globalThis.prompt('Optional: reason for withdrawal', 'Correcting hours and deductions')
    if (note === null) return

    setLoading(true)
    setError('')
    try {
      const response = await apiClient.post<PayrollRunDto>(`/payroll/runs/${run.id}/withdraw`, {
        withdrawalReason: note,
      })
      setRun(response.data)
      await loadRuns()
      pushToast('warning', 'Payroll withdrawn to Draft for correction.')
    } catch (error) {
      const message = extractApiError(error, 'Unable to withdraw payroll.')
      setError(message)
      pushToast('error', message)
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
      pushToast('success', 'Payroll posted to GL successfully.')
    } catch (error) {
      const message = extractApiError(error, 'Unable to post payroll to GL.')
      setError(message)
      pushToast('error', message)
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
    } catch (error) {
      const message = extractApiError(error, 'Unable to load payroll register.')
      setError(message)
      pushToast('error', message)
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
      pushToast('success', 'Payroll approved. Payslips were generated for included employees.')
    } catch (error) {
      const message = extractApiError(error, 'Unable to approve payroll.')
      setError(message)
      pushToast('error', message)
    } finally {
      setLoading(false)
    }
  }

  const onReject = async () => {
    if (!registerRunId) return
    const reason = globalThis.prompt('Enter rejection reason')
    if (!reason) return

    setLoading(true)
    setError('')
    try {
      await apiClient.post(`/payroll/runs/${registerRunId}/reject`, { rejectionReason: reason })
      await loadRuns()
      await loadRegister()
      pushToast('warning', 'Payroll rejected and returned for correction.')
    } catch (error) {
      const message = extractApiError(error, 'Unable to reject payroll.')
      setError(message)
      pushToast('error', message)
    } finally {
      setLoading(false)
    }
  }

  const onReopen = async () => {
    if (!registerRunId) return

    const reason = globalThis.prompt('Re-open reason (required):')
    if (!reason?.trim()) {
      setError('Re-open reason is required.')
      return
    }

    setLoading(true)
    setError('')
    try {
      await apiClient.post(`/payroll/runs/${registerRunId}/re-open`, { reopenReason: reason.trim() })
      await loadRuns()
      await loadRegister()
      pushToast('warning', 'Payroll re-opened and moved back to Draft.')
    } catch (error) {
      const message = extractApiError(error, 'Unable to re-open payroll.')
      setError(message)
      pushToast('error', message)
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

  const roleForHelp: PayrollHelpRole =
    selectedRole === 'accountant'
    || selectedRole === 'cfo'
    || selectedRole === 'employee'
    || selectedRole === 'super-admin'
      ? selectedRole
      : 'employee'
  const reopenGuidance = selectedRole === 'cfo'
    ? 'CFO re-open is allowed only within 24 hours after approval and before posting/payment.'
    : 'SuperAdmin can re-open approved/processed runs before posting/payment. All changes are audited.'
  const contextualFaqs = useMemo(() => {
    const query = helpQuery.trim().toLowerCase()
    return payrollFaqItems.filter((item) => {
      const matchesRole = item.roles.includes(roleForHelp)
      const matchesPage = item.pages.includes(activePage)
      const matchesQuery = query.length === 0
        || item.question.toLowerCase().includes(query)
        || item.answer.toLowerCase().includes(query)
      return matchesRole && matchesPage && matchesQuery
    })
  }, [activePage, helpQuery, roleForHelp])

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

          <Button fillMode="outline" onClick={() => setWalkthroughOpen(true)}>
            Payroll Walkthrough
          </Button>
          <Button fillMode="outline" onClick={() => setHelpOpen((current) => !current)}>
            Need Help?
          </Button>
        </div>

        {helpOpen && (
          <section style={{ marginTop: '0.9rem', border: '1px solid #d1d5db', borderRadius: '0.6rem', padding: '0.8rem' }}>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: '0.6rem' }}>
              <strong>Help for {activePage}</strong>
              <input
                type="search"
                placeholder="Search help"
                value={helpQuery}
                onChange={(e) => setHelpQuery(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>

            {contextualFaqs.length === 0 ? (
              <p className="card-subtitle" style={{ margin: 0 }}>
                No matching help topics. Try a different keyword or open Payroll Walkthrough.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                {contextualFaqs.map((item) => (
                  <article key={item.id} style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '0.6rem' }}>
                    <p style={{ margin: 0, fontWeight: 600 }}>{item.question}</p>
                    <p className="card-subtitle" style={{ marginBottom: 0 }}>{item.answer}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </article>

      {walkthroughOpen && (
        <section style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '1rem',
        }}>
          <article className="card" style={{ width: 'min(860px, 100%)', maxHeight: '85vh', overflowY: 'auto' }}>
            <header className="card-head">
              <h3 className="card-title">Payroll Walkthrough</h3>
              <p className="card-subtitle">Replay this guide anytime from the Payroll page.</p>
            </header>
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              {payrollWalkthroughSteps.map((step) => (
                <article key={step.title} style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '0.65rem' }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>{step.title}</p>
                  <p className="card-subtitle" style={{ marginBottom: 0 }}>{step.detail}</p>
                </article>
              ))}
            </div>
            <div style={{ marginTop: '0.8rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button fillMode="outline" onClick={() => setWalkthroughOpen(false)}>Close</Button>
            </div>
          </article>
        </section>
      )}

      {activePage === 'overview' && (
        <PayrollOverviewPage periods={periods} runs={runs} capabilities={capabilities} />
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
          onWithdraw={onWithdraw}
          onPostToGl={onPostToGl}
          canWithdraw={isAccountant}
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
          onReopen={onReopen}
          reopenGuidance={reopenGuidance}
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
