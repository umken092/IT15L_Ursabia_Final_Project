import { Button } from '@progress/kendo-react-buttons'
import type { PayrollRegisterDto, PayrollRunDto } from './types'
import { formatCurrency, runStatusLabel } from './types'

interface PayrollApprovalPageProps {
  loading: boolean
  runs: PayrollRunDto[]
  selectedRunId: string
  register: PayrollRegisterDto | null
  onSelectRun: (runId: string) => void
  onLoadRegister: () => Promise<void>
  onApprove: () => Promise<void>
  onReject: () => Promise<void>
}

export const PayrollApprovalPage = ({
  loading,
  runs,
  selectedRunId,
  register,
  onSelectRun,
  onLoadRegister,
  onApprove,
  onReject,
}: PayrollApprovalPageProps) => {
  const approvalCandidates = runs.filter((run) => run.status === 2)

  return (
    <article className="card">
      <header className="card-head">
        <h3 className="card-title">Payroll Approval</h3>
        <p className="card-subtitle">CFO review and disposition of submitted payroll runs</p>
      </header>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <select value={selectedRunId} onChange={(e) => onSelectRun(e.target.value)} style={{ flex: 1 }}>
          <option value="">Select submitted run</option>
          {approvalCandidates.map((run) => (
            <option key={run.id} value={run.id}>{`${run.payPeriodLabel} | ${run.id.slice(0, 8)}`}</option>
          ))}
        </select>
        <Button onClick={() => void onLoadRegister()} disabled={loading || !selectedRunId}>Load Register</Button>
      </div>

      {register && (
        <>
          <p className="card-subtitle" style={{ marginTop: 0 }}>
            {register.payPeriod} | {runStatusLabel(register.status)}
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="table-like" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Gross</th>
                  <th>Tax</th>
                  <th>SSS</th>
                  <th>PhilHealth</th>
                  <th>Pag-IBIG</th>
                  <th>Deductions</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {register.lineItems.map((item) => (
                  <tr key={item.employeeId}>
                    <td>{item.employeeName}</td>
                    <td>{formatCurrency(item.grossPay)}</td>
                    <td>{formatCurrency(item.trainTax)}</td>
                    <td>{formatCurrency(item.sssFee)}</td>
                    <td>{formatCurrency(item.philHealthFee)}</td>
                    <td>{formatCurrency(item.pagIbigFee)}</td>
                    <td>{formatCurrency(item.totalDeductions)}</td>
                    <td>{formatCurrency(item.netPay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: '0.75rem' }}>
            Total Net Pay <strong>{formatCurrency(register.totals.totalNetPay)}</strong>
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button onClick={() => void onApprove()} disabled={loading}>Approve</Button>
            <Button onClick={() => void onReject()} disabled={loading}>Reject</Button>
          </div>
        </>
      )}
    </article>
  )
}
