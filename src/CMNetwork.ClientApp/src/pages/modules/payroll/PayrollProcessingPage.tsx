import { Button } from '@progress/kendo-react-buttons'
import type { EmployeePayrollDto, PayrollLineInput, PayrollRunDto } from './types'
import { formatCurrency, runStatusLabel } from './types'

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
  onPostToGl: () => Promise<void>
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
  onPostToGl,
}: PayrollProcessingPageProps) => {
  return (
    <article className="card">
      <header className="card-head">
        <h3 className="card-title">Payroll Processing</h3>
        <p className="card-subtitle">Calculate, submit, and post payroll runs using live records</p>
      </header>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <select value={selectedPeriodId} onChange={(e) => onSelectPeriod(e.target.value)} style={{ flex: 1 }}>
          <option value="">Select pay period</option>
          {periodOptions.map((period) => (
            <option key={period.id} value={period.id}>{period.label}</option>
          ))}
        </select>
        <Button onClick={() => void onLoadSetup()} disabled={loading || !selectedPeriodId}>Load Setup</Button>
        <Button onClick={() => void onCalculate()} disabled={loading || lines.length === 0}>Calculate</Button>
        <Button onClick={() => void onSubmit()} disabled={loading || !run}>Submit</Button>
        <Button onClick={() => void onPostToGl()} disabled={loading || !run}>Post To GL</Button>
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
                  <td><input type="number" value={line.regularHours} onChange={(e) => onUpdateLine(line.employeeId, 'regularHours', Number(e.target.value))} /></td>
                  <td><input type="number" value={line.overtimeHours} onChange={(e) => onUpdateLine(line.employeeId, 'overtimeHours', Number(e.target.value))} /></td>
                  <td><input type="number" value={line.absenceHours} onChange={(e) => onUpdateLine(line.employeeId, 'absenceHours', Number(e.target.value))} /></td>
                  <td><input type="number" value={line.otherDeductions} onChange={(e) => onUpdateLine(line.employeeId, 'otherDeductions', Number(e.target.value))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  )
}
