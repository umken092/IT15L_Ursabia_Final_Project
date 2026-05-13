import { Button } from '@progress/kendo-react-buttons'
import type { EmployeePayrollDto, PayrollLineInput, PayrollRunDto } from './types'
import {
  canEditPayrollInputs,
  canPostToGl,
  canSubmitPayrollRun,
  formatCurrency,
  payrollFlowSteps,
  runStatusLabel,
} from './types'

interface PayrollProcessingPageProps {
  loading: boolean
  selectedPeriodId: string
  periodOptions: Array<{ id: string; label: string }>
  employees: EmployeePayrollDto[]
  lines: PayrollLineInput[]
  run: PayrollRunDto | null
  onSelectPeriod: (periodId: string) => void
  onLoadSetup: () => Promise<void>
  onUpdateLine: (employeeId: string, field: keyof PayrollLineInput, value: number) => void
  onCalculate: () => Promise<void>
  onSubmit: () => Promise<void>
  onWithdraw: () => Promise<void>
  onPostToGl: () => Promise<void>
  canWithdraw: boolean
}

export const PayrollProcessingPage = ({
  loading,
  selectedPeriodId,
  periodOptions,
  employees,
  lines,
  run,
  onSelectPeriod,
  onLoadSetup,
  onUpdateLine,
  onCalculate,
  onSubmit,
  onWithdraw,
  onPostToGl,
  canWithdraw,
}: PayrollProcessingPageProps) => {
  const runStatus = run?.status
  const allowEditing = canEditPayrollInputs(runStatus)
  let helperText = 'This payroll run is finalized. Start a new period for additional processing.'

  if (selectedPeriodId === '') {
    helperText = 'Select an active pay period to begin processing.'
  } else if (lines.length === 0) {
    helperText = 'Click Load Setup to fetch employees for this period.'
  } else if (run === null) {
    helperText = 'Enter hours and deductions, then click Calculate.'
  } else if (canSubmitPayrollRun(run.status)) {
    helperText = 'Review totals, then click Submit to send to CFO for approval.'
  } else if (run.status === 2) {
    helperText = 'Payroll is submitted. Use Withdraw if corrections are required before approval.'
  } else if (canPostToGl(run.status)) {
    helperText = 'Payroll is approved/processed. Post to GL when ready to finalize accounting entries.'
  }

  const showSuccessBanner = (message: string) => (
    <div className="success-banner">
      <p>{message}</p>
    </div>
  )

  return (
    <>
      {runStatus === 5 && showSuccessBanner('Payroll processed successfully!')}
      {runStatus === 3 && showSuccessBanner('Payroll approved successfully!')}
      <article className="card">
        <header className="card-head">
          <h3 className="card-title">Payroll Processing</h3>
          <p className="card-subtitle">Calculate, submit, and post payroll runs using live records</p>
        </header>

        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          {payrollFlowSteps.map((step) => {
            const isActive = runStatus === step.status
            return (
              <span
                key={step.status}
                style={{
                  borderRadius: '999px',
                  border: `1px solid ${isActive ? '#0f766e' : '#d1d5db'}`,
                  background: isActive ? '#ccfbf1' : '#f9fafb',
                  color: isActive ? '#134e4a' : '#374151',
                  padding: '0.2rem 0.6rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                }}
              >
                {step.label}
              </span>
            )
          })}
        </div>

        <p className="card-subtitle" style={{ marginTop: 0, marginBottom: '0.75rem' }}>{helperText}</p>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <select value={selectedPeriodId} onChange={(e) => onSelectPeriod(e.target.value)} style={{ flex: 1 }}>
            <option value="">Select pay period</option>
            {periodOptions.map((period) => (
              <option key={period.id} value={period.id}>{period.label}</option>
            ))}
          </select>
          <Button onClick={() => void onLoadSetup()} disabled={loading || !selectedPeriodId}>Load Setup</Button>
          <Button onClick={() => void onCalculate()} disabled={loading || lines.length === 0 || !allowEditing}>Calculate</Button>
          <Button onClick={() => void onSubmit()} disabled={loading || !run || !canSubmitPayrollRun(run.status)}>Submit</Button>
          <Button onClick={() => void onWithdraw()} disabled={loading || run?.status !== 2 || !canWithdraw}>Withdraw</Button>
          <Button onClick={() => void onPostToGl()} disabled={loading || !run || !canPostToGl(run.status)}>Post To GL</Button>
        </div>

        {run && (
          <p className="card-subtitle" style={{ marginTop: 0 }}>
            Run {run.id.slice(0, 8)} | {run.payPeriodLabel} | {runStatusLabel(run.status)} | Gross {formatCurrency(run.totalGrossPay)} | Net {formatCurrency(run.totalNetPay)}
          </p>
        )}

        {employees.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-like" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Regular</th>
                  <th>OT</th>
                  <th>Absent</th>
                  <th>Other Deductions</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.employeeId}>
                    <td>{line.employeeName}</td>
                    <td><input type="number" value={line.regularHours} disabled={!allowEditing} onChange={(e) => onUpdateLine(line.employeeId, 'regularHours', Number(e.target.value))} placeholder="Total regular hours" title="Enter total regular hours worked for the period (not PHP)" /></td>
                    <td><input type="number" value={line.overtimeHours} disabled={!allowEditing} onChange={(e) => onUpdateLine(line.employeeId, 'overtimeHours', Number(e.target.value))} placeholder="Total OT hours" title="Enter total overtime hours worked for the period (not PHP)" /></td>
                    <td><input type="number" value={line.absenceHours} disabled={!allowEditing} onChange={(e) => onUpdateLine(line.employeeId, 'absenceHours', Number(e.target.value))} placeholder="Total absent hours" title="Enter total hours absent for the period (not PHP)" /></td>
                    <td><input type="number" value={line.otherDeductions} disabled={!allowEditing} onChange={(e) => onUpdateLine(line.employeeId, 'otherDeductions', Number(e.target.value))} placeholder="₱ deductions" title="Enter total other deductions in PHP (₱)" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="card-subtitle" style={{ marginTop: '0.75rem' }}>
          Tip: Backward transitions are controlled. Use Withdraw for submitted runs that need correction.
        </p>
      </article>
    </>
  )
}
