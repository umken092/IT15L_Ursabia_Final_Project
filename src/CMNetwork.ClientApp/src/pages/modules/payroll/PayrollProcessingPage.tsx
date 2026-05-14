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

      {/* Status chip bar */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {payrollFlowSteps.map((step) => {
          const isActive = runStatus === step.status
          return (
            <span
              key={step.status}
              style={{
                borderRadius: '999px',
                border: `1px solid ${isActive ? '#0f766e' : '#e5e7eb'}`,
                background: isActive ? '#ccfbf1' : '#f9fafb',
                color: isActive ? '#134e4a' : '#6b7280',
                padding: '0.25rem 0.8rem',
                fontSize: '0.78rem',
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '0.02em',
              }}
            >
              {step.label}
            </span>
          )
        })}
      </div>

      {/* Selection row */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'center' }}>
        <select
          value={selectedPeriodId}
          onChange={(e) => onSelectPeriod(e.target.value)}
          style={{
            flex: 1,
            height: '2.5rem',
            padding: '0 0.75rem',
            border: '1.5px solid #d1d5db',
            borderRadius: '0.375rem',
            fontSize: '0.9375rem',
            color: '#111827',
            background: '#fff',
          }}
        >
          <option value="">Select pay period</option>
          {periodOptions.map((period) => (
            <option key={period.id} value={period.id}>{period.label}</option>
          ))}
        </select>
        <Button onClick={() => void onLoadSetup()} disabled={loading || !selectedPeriodId}>Load Setup</Button>
      </div>

      {/* Helper text */}
      <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>{helperText}</p>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <Button onClick={() => void onCalculate()} disabled={loading || lines.length === 0 || !allowEditing}>Calculate</Button>
        <Button onClick={() => void onSubmit()} disabled={loading || !run || !canSubmitPayrollRun(run.status)}>Submit</Button>
        <Button fillMode="outline" onClick={() => void onWithdraw()} disabled={loading || run?.status !== 2 || !canWithdraw}>Withdraw</Button>
        <Button fillMode="outline" onClick={() => void onPostToGl()} disabled={loading || !run || !canPostToGl(run.status)}>Post To GL</Button>
      </div>

      {/* Run summary */}
      {run && (
        <div style={{ background: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: '0.5rem', padding: '0.65rem 1rem', marginBottom: '1.25rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.875rem', color: '#064e3b' }}>
          <span><strong>Run:</strong> {run.id.slice(0, 8)}</span>
          <span><strong>Period:</strong> {run.payPeriodLabel}</span>
          <span><strong>Status:</strong> {runStatusLabel(run.status)}</span>
          <span><strong>Gross:</strong> {formatCurrency(run.totalGrossPay)}</span>
          <span><strong>Net:</strong> {formatCurrency(run.totalNetPay)}</span>
        </div>
      )}

      {/* Data table */}
      {employees.length > 0 && (
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                {[
                  { label: 'Employee Name', align: 'left' as const },
                  { label: 'Regular Hrs', align: 'right' as const },
                  { label: 'OT Hrs', align: 'right' as const },
                  { label: 'Absent Hrs', align: 'right' as const },
                  { label: 'Other Deductions (₱)', align: 'right' as const },
                ].map((col) => (
                  <th
                    key={col.label}
                    style={{
                      textAlign: col.align,
                      padding: '0.75rem 1rem',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: '#374151',
                      borderBottom: '1px solid #e5e7eb',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr
                  key={line.employeeId}
                  style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f3f4f6' }}
                >
                  <td style={{ padding: '0.875rem 1rem', color: '#111827', fontWeight: 500, whiteSpace: 'nowrap' }}>{line.employeeName}</td>
                  <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                    <input type="number" value={line.regularHours} disabled={!allowEditing} onChange={(e) => onUpdateLine(line.employeeId, 'regularHours', Number(e.target.value))} placeholder="0" title="Total regular hours worked this period" style={{ width: '80px', textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                    <input type="number" value={line.overtimeHours} disabled={!allowEditing} onChange={(e) => onUpdateLine(line.employeeId, 'overtimeHours', Number(e.target.value))} placeholder="0" title="Total overtime hours worked this period" style={{ width: '80px', textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                    <input type="number" value={line.absenceHours} disabled={!allowEditing} onChange={(e) => onUpdateLine(line.employeeId, 'absenceHours', Number(e.target.value))} placeholder="0" title="Total hours absent this period" style={{ width: '80px', textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                    <input type="number" value={line.otherDeductions} disabled={!allowEditing} onChange={(e) => onUpdateLine(line.employeeId, 'otherDeductions', Number(e.target.value))} placeholder="0.00" title="Other deductions in PHP (₱)" style={{ width: '100px', textAlign: 'right' }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: '#9ca3af' }}>
        Tip: Backward transitions are controlled. Use Withdraw for submitted runs that need correction.
      </p>
    </>
  )
}
